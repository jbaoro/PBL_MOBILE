/**
 * 추천 흐름 (POST /api/recommendations 의 본체)
 *
 * 1. 거리 구분: 출발지 사이 최대 거리로 근거리(≤25km)·중거리(≤80km)·장거리
 * 2. 검색 지역 정하기: 근거리는 중간 지역 지하철역, 중거리는 3곳의 역·터미널,
 *    장거리는 중간 지역 + 각 출발지 주변 기차역·버스터미널
 * 3. 후보 모으기 → 이동수단별 대략 속도로 6곳까지 압축 (압축에만 쓰고 표시·순위에는 안 씀)
 * 4. 모든 참가자의 실제 경로 조회 → ranking.ts 기준으로 순위
 * 5. 비교 가능한 후보가 3곳 미만이면 범위를 넓히고 경로가 자주 실패한 참가자 쪽을 더 찾아 최대 4곳 추가
 * 6. 추천 이유·제외 사유·검색 범위를 붙여서 돌려준다.
 * 전 과정은 CallBudget 으로 호출 수(100)·동시 요청(4)·새 탐색 마감(40초)을 지킨다.
 */
import { MeetPointError, publicError } from '../errors';
import { centroid, distanceMeters } from '../geo';
import { calculateMetrics, rankCandidates } from '../ranking';
import { MAX_CANDIDATES } from '../validation';
import type {
  CandidateResult, CandidateSource, Coordinates, DistanceTier, HubKind, Location, Participant,
  RecommendationResult, RouteResult, SearchArea, SearchScope, Transport,
} from '../types';
import type { KakaoProvider } from './kakao';

// ── 제한값 ─────────────────────────────────────────────────────
// 추천 한 번에 쓰는 외부 API 호출 수·동시 요청 수·전체 대기시간의 상한.
// 참가자 8명 기준 기본 탐색(검색 ≤17 + 경로 6×8=48) 후 추가 탐색(검색 ≤6 + 경로 4×8=32)까지 들어가는 크기다.
export const SEARCH_LIMITS = {
  maxCalls: 100,
  concurrency: 4,
  deadlineMs: 40000,          // 이 시간이 지나면 새 탐색을 시작하지 않는다 (라우트 전체 제한은 55초)
  firstRoundCandidates: MAX_CANDIDATES,
  expansionCandidates: 4,
  minRankedCandidates: 3,     // 비교 가능한 후보가 이보다 적으면 추가 탐색
} as const;

// 출발지 사이 최대 거리 기준 (km)
export const TIER_THRESHOLDS_KM = { nearby: 25, regional: 80 } as const;
const TIER_LABEL: Record<DistanceTier, string> = { nearby: '근거리', regional: '중거리', long: '장거리' };
const TRANSPORT_LABEL: Record<Transport, string> = { transit: '대중교통', car: '자동차', walk: '도보' };
// 후보를 거리로 줄일 때만 쓰는 대략적인 속도 (m/분). 화면에 표시하거나 순위에 쓰지 않는다.
const ROUGH_SPEED: Record<Transport, number> = { walk: 75, transit: 400, car: 600 };

type Provider = Pick<KakaoProvider, 'nearbyHubs' | 'nearbyPlaces' | 'route'>;

// ── 공통 도구 ───────────────────────────────────────────────────

export async function mapLimited<T, R>(items: T[], concurrency: number, callback: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const result = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      result[index] = await callback(items[index], index);
    }
  }));
  return result;
}

/** 호출 수 예약 + 동시 실행 수 제한 + 탐색 마감 시각을 함께 관리한다. */
export class CallBudget {
  private used = 0;
  private active = 0;
  private waiting: Array<() => void> = [];
  private readonly deadline: number;
  constructor(private readonly maxCalls: number, private readonly concurrency: number, deadlineMs: number,
    private readonly now: () => number = Date.now) {
    this.deadline = now() + deadlineMs;
  }
  get calls() { return this.used; }
  get remaining() { return this.maxCalls - this.used; }
  expired() { return this.now() >= this.deadline; }
  /** n번의 호출을 미리 확보한다. 한도나 마감을 넘으면 false. */
  reserve(count: number): boolean {
    if (this.expired() || this.used + count > this.maxCalls) return false;
    this.used += count;
    return true;
  }
  async run<T>(action: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active++;
    try { return await action(); }
    finally { this.active--; this.waiting.shift()?.(); }
  }
}

// ── 1. 근거리·장거리 구분 ─────────────────────────────────────────

export function classifySpread(people: Participant[]): { tier: DistanceTier; maxSpreadMeters: number } {
  let maxSpreadMeters = 0;
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      maxSpreadMeters = Math.max(maxSpreadMeters, distanceMeters(people[i].origin, people[j].origin));
    }
  }
  const km = maxSpreadMeters / 1000;
  const tier: DistanceTier = km <= TIER_THRESHOLDS_KM.nearby ? 'nearby' : km <= TIER_THRESHOLDS_KM.regional ? 'regional' : 'long';
  return { tier, maxSpreadMeters };
}

// ── 2. 검색 지역을 참가자 분포에 맞춰 정하기 ─────────────────────────

/** 참가자 사이의 탐색점: 중심 → 도보 참가자 출발지 → 멀리 있는 참가자 쪽 중간 지점 (1km 이내 중복 제거) */
export function candidateAnchors(people: Participant[], limit = 3): Coordinates[] {
  const center = centroid(people.map((person) => person.origin));
  const byDistance = [...people].sort((a, b) => distanceMeters(b.origin, center) - distanceMeters(a.origin, center) || a.id.localeCompare(b.id));
  const walking = people.filter((person) => person.transport === 'walk').map((person) => person.origin);
  const seeds = [center, ...walking, ...byDistance.map((person) => centroid([center, person.origin]))];
  const anchors: Coordinates[] = [];
  for (const seed of seeds) {
    if (anchors.every((previous) => distanceMeters(previous, seed) > 1000)) anchors.push(seed);
    if (anchors.length === limit) break;
  }
  return anchors;
}

/** 서로 20km 안에 있는 출발지끼리 묶는다. (장거리에서 출발지 주변 역·터미널을 찾을 때 사용) */
export function originClusters(people: Participant[], radiusMeters = 20000): Participant[][] {
  const clusters: Participant[][] = [];
  for (const person of people) {
    const cluster = clusters.find((group) => distanceMeters(centroid(group.map((item) => item.origin)), person.origin) <= radiusMeters);
    if (cluster) cluster.push(person); else clusters.push([person]);
  }
  return clusters;
}

const names = (people: Participant[]) => people.length > 2 ? `${people[0].name} 외 ${people.length - 1}명` : people.map((person) => person.name).join('·');

export function planSearchAreas(people: Participant[], tier: DistanceTier, maxSpreadMeters: number): SearchArea[] {
  const describe = (point: Coordinates, index: number): string => {
    if (index === 0) return '참가자 중간 지역';
    const walker = people.find((person) => person.transport === 'walk' && distanceMeters(person.origin, point) < 1);
    if (walker) return `${walker.name}(도보) 출발지 주변`;
    const toward = [...people].sort((a, b) => distanceMeters(a.origin, point) - distanceMeters(b.origin, point))[0];
    return `${toward.name} 쪽 중간 지역`;
  };

  if (tier === 'nearby') {
    // 같은 생활권: 중심 근처 지하철역 위주로 좁게 찾는다.
    const radiusMeters = Math.round(Math.min(10000, Math.max(3000, maxSpreadMeters * 0.6)));
    return candidateAnchors(people, 2).map((point, index): SearchArea => ({
      ...point, label: describe(point, index), radiusMeters: index === 0 ? radiusMeters : 3000, kinds: ['subway'], source: 'between',
    }));
  }
  if (tier === 'regional') {
    return candidateAnchors(people, 3).map((point, index): SearchArea => ({
      ...point, label: describe(point, index), radiusMeters: 15000, kinds: ['subway', 'rail', 'terminal'], source: 'between',
    }));
  }
  // 장거리: 중간 지역의 역·터미널 + 각 출발지 주변의 주요 역·터미널
  const between = candidateAnchors(people, 3).map((point, index): SearchArea => ({
    ...point, label: describe(point, index), radiusMeters: 20000, kinds: ['rail', 'terminal', 'subway'], source: 'between',
  }));
  const origins = originClusters(people).slice(0, 4).map((group): SearchArea => ({
    ...centroid(group.map((person) => person.origin)), label: `${names(group)} 출발지 주변`,
    radiusMeters: 10000, kinds: ['rail', 'terminal'], source: 'origin',
  }));
  return [...between, ...origins];
}

// ── 3. 넉넉히 모은 후보를 거리로 줄이기 ────────────────────────────

type Collected = Location & { source: CandidateSource; areaIndex: number };

/** 이동수단별 대략 속도로 환산한 '가장 오래 걸릴 사람'의 추정 분. 사전 압축에만 쓴다. */
export function roughWorstMinutes(people: Participant[], point: Coordinates): number {
  return Math.max(...people.map((person) => distanceMeters(person.origin, point) / ROUGH_SPEED[person.transport]));
}
function roughGapMinutes(people: Participant[], point: Coordinates): number {
  const values = people.map((person) => distanceMeters(person.origin, point) / ROUGH_SPEED[person.transport]);
  return Math.max(...values) - Math.min(...values);
}

/**
 * 모은 후보 중에서 실제 경로를 조회할 후보를 고른다.
 * 1) 검색 지역마다 가장 가까운 후보를 하나씩 먼저 넣어 지역이 고르게 들어가게 하고
 * 2) 나머지는 추정 최대 이동시간 → 추정 차이 순으로 채운다.
 * 이미 비교한 후보와 500m 안에 있는 곳은 건너뛴다.
 */
export function shortlistCandidates<T extends Location>(locations: T[], people: Participant[], anchors: Coordinates[],
  options: { limit?: number; exclude?: Location[] } = {}): T[] {
  const limit = options.limit ?? MAX_CANDIDATES;
  const exclude = options.exclude ?? [];
  const unique = Array.from(new Map(locations.map((item) => [item.id, item])).values());
  const selected: T[] = [];
  const add = (item: T) => {
    if (selected.length >= limit) return;
    if ([...exclude, ...selected].some((previous) => previous.id === item.id || distanceMeters(previous, item) < 500)) return;
    selected.push(item);
  };
  for (const anchor of anchors) {
    const nearest = [...unique].sort((a, b) => distanceMeters(a, anchor) - distanceMeters(b, anchor) || a.id.localeCompare(b.id));
    const first = nearest.find((item) => ![...exclude, ...selected].some((previous) => previous.id === item.id || distanceMeters(previous, item) < 500));
    if (first) add(first);
  }
  unique.sort((a, b) => roughWorstMinutes(people, a) - roughWorstMinutes(people, b) ||
    roughGapMinutes(people, a) - roughGapMinutes(people, b) || a.id.localeCompare(b.id)).forEach(add);
  return selected;
}

const FATAL_CODES = ['NOT_CONFIGURED', 'PROVIDER_AUTH', 'QUOTA_EXCEEDED'];
const isFatal = (error: unknown) => error instanceof MeetPointError && FATAL_CODES.includes(error.code);

async function collectHubs(provider: Provider, areas: SearchArea[], budget: CallBudget, signal?: AbortSignal) {
  const queries = areas.flatMap((area, areaIndex) => area.kinds.map((kind) => ({ area, areaIndex, kind })));
  let skipped = 0;
  const responses = await Promise.all(queries.map(async ({ area, areaIndex, kind }) => {
    if (!budget.reserve(1)) { skipped++; return { locations: [] as Collected[] }; }
    try {
      const found = await budget.run(() => provider.nearbyHubs(area, kind as HubKind, area.radiusMeters, signal));
      return { locations: found.map((item): Collected => ({ ...item, source: area.source, areaIndex })) };
    } catch (error) {
      return { locations: [] as Collected[], error };
    }
  }));
  const errors = responses.flatMap((response) => ('error' in response && response.error ? [response.error] : []));
  const fatal = errors.find(isFatal);
  if (fatal) throw fatal;
  return { locations: responses.flatMap((response) => response.locations), errors, total: queries.length, skipped };
}

// ── 경로 조회와 비교 ─────────────────────────────────────────────

export async function evaluateDestinations(provider: Pick<KakaoProvider, 'route'>, people: Participant[], destinations: Location[],
  signal?: AbortSignal, budget?: CallBudget): Promise<CandidateResult[]> {
  const pairs = destinations.flatMap((destination) => people.map((person) => ({ destination, person })));
  const call = <T>(action: () => Promise<T>) => (budget ? budget.run(action) : action());
  const routes = await mapLimited(pairs, SEARCH_LIMITS.concurrency, async ({ destination, person }): Promise<RouteResult> => {
    try {
      if (signal?.aborted) throw new MeetPointError('TIMEOUT', '조회 제한 시간이 지났어요. 다시 시도해 주세요.', 504, true);
      return await call(() => provider.route(person, destination, signal));
    } catch (error) {
      return { status: 'error', participantId: person.id, destinationId: destination.id, error: publicError(error) };
    }
  });
  return destinations.map((candidate) => {
    const candidateRoutes = routes.filter((route) => route.destinationId === candidate.id);
    return { candidate, routes: candidateRoutes, metrics: calculateMetrics(candidateRoutes, people) };
  });
}

/** 후보 전체 경로 수만큼 호출을 예약할 수 있는 후보까지만 남긴다. */
function affordable<T>(candidates: T[], people: Participant[], budget: CallBudget): T[] {
  const result: T[] = [];
  for (const candidate of candidates) {
    if (!budget.reserve(people.length)) break;
    result.push(candidate);
  }
  return result;
}

// ── 8. 추천 이유·제외 사유 ───────────────────────────────────────

const minutesText = (value: number) => `${Math.max(0, Math.round(value))}분`;
const failureText: Record<string, string> = {
  NO_ROUTE: '경로 없음', TIMEOUT: '조회 시간 초과', QUOTA_EXCEEDED: '호출 한도 초과', BUSY: '요청 혼잡',
};

export function exclusionReason(item: CandidateResult, people: Participant[]): string {
  const failed = item.routes.filter((route) => route.status === 'error');
  if (!failed.length) return '일부 참가자의 경로를 확인하지 못했어요.';
  return failed.map((route) => {
    const person = people.find((candidate) => candidate.id === route.participantId);
    const code = route.status === 'error' ? route.error.code : '';
    return `${person ? `${person.name}(${TRANSPORT_LABEL[person.transport]})` : '참가자'} ${failureText[code] ?? '조회 실패'}`;
  }).join(', ');
}

export function explainRanking(ranked: CandidateResult[], people: Participant[]): string[][] {
  if (!ranked.length) return [];
  const best = ranked[0].metrics!;
  const minGap = Math.min(...ranked.map((item) => item.metrics!.gapMinutes));
  const minAverage = Math.min(...ranked.map((item) => item.metrics!.averageMinutes));
  return ranked.map((item, index) => {
    const metrics = item.metrics!;
    const reasons: string[] = [];
    if (index === 0) reasons.push(`가장 오래 걸리는 사람도 ${minutesText(metrics.maxMinutes)}이면 도착해요.`);
    else if (Math.round(metrics.maxMinutes) > Math.round(best.maxMinutes)) {
      reasons.push(`1위보다 가장 오래 걸리는 사람이 ${minutesText(metrics.maxMinutes - best.maxMinutes)} 더 걸려요.`);
    } else reasons.push('1위와 최대 이동시간은 비슷하지만 이동시간 차이나 평균이 더 커요.');
    reasons.push(metrics.gapMinutes === minGap && ranked.length > 1
      ? `참가자 간 이동시간 차이가 ${minutesText(metrics.gapMinutes)}으로 가장 고르게 나뉘어요.`
      : `참가자 간 이동시간 차이는 ${minutesText(metrics.gapMinutes)}이에요.`);
    if (metrics.averageMinutes === minAverage && ranked.length > 1) reasons.push(`평균 이동시간이 ${minutesText(metrics.averageMinutes)}으로 가장 짧아요.`);
    const near = item.routes.find((route) => route.status === 'ok' && route.durationMinutes <= 5);
    if (item.source === 'origin' && near) {
      const person = people.find((candidate) => candidate.id === near.participantId);
      if (person) reasons.push(`${person.name}의 출발지 근처 교통 거점이에요.`);
    }
    if (item.source === 'expanded') reasons.push('후보가 부족해 탐색 범위를 넓혀 찾은 곳이에요.');
    return reasons;
  });
}

// ── 4. 후보 부족·경로 실패 시 추가 탐색 ────────────────────────────

/** 추가로 찾을 지역: 반경을 넓힌 중간 지역 + 경로 조회가 자주 실패한 참가자 쪽 */
export function planExpansionAreas(people: Participant[], areas: SearchArea[], evaluated: CandidateResult[]): SearchArea[] {
  const center = centroid(people.map((person) => person.origin));
  const result: SearchArea[] = [];
  const first = areas[0];
  if (first && (first.radiusMeters < 20000 || first.kinds.length < 3)) {
    result.push({ ...center, label: '참가자 중간 지역(범위 확대)', radiusMeters: Math.min(20000, first.radiusMeters * 2),
      kinds: ['subway', 'rail', 'terminal'], source: 'expanded' });
  }
  const failures = new Map<string, number>();
  for (const item of evaluated) {
    for (const route of item.routes) if (route.status === 'error') failures.set(route.participantId, (failures.get(route.participantId) ?? 0) + 1);
  }
  const struggling = people
    .filter((person) => (failures.get(person.id) ?? 0) >= Math.max(1, Math.ceil(evaluated.length / 2)))
    .sort((a, b) => (failures.get(b.id) ?? 0) - (failures.get(a.id) ?? 0))
    .slice(0, 2);
  // 같은 곳을 같은 종류·같거나 넓은 반경으로 이미 찾았으면 다시 찾지 않는다.
  const all: HubKind[] = ['subway', 'rail', 'terminal'];
  const covered = (point: Coordinates, radiusMeters: number) => [...areas, ...result].some((area) =>
    distanceMeters(area, point) <= 3000 && area.radiusMeters >= radiusMeters && all.every((kind) => area.kinds.includes(kind)));
  for (const person of struggling) {
    const toward = centroid([center, person.origin]);
    if (!covered(toward, 15000)) {
      result.push({ ...toward, label: `${person.name} 쪽으로 넓힌 지역`, radiusMeters: 15000, kinds: all, source: 'expanded' });
    }
    if (!covered(person.origin, 8000)) {
      result.push({ ...person.origin, label: `${person.name} 출발지 주변(범위 확대)`, radiusMeters: 8000, kinds: all, source: 'expanded' });
    }
  }
  return result.slice(0, 2);
}

// ── 전체 흐름 ────────────────────────────────────────────────────

export async function recommend(provider: Provider, people: Participant[], signal?: AbortSignal,
  budget = new CallBudget(SEARCH_LIMITS.maxCalls, SEARCH_LIMITS.concurrency, SEARCH_LIMITS.deadlineMs)): Promise<RecommendationResult> {
  const { tier, maxSpreadMeters } = classifySpread(people);
  const areas = planSearchAreas(people, tier, maxSpreadMeters);
  const notices: string[] = [];
  let limited = false;

  // 기본 탐색: 후보 수집 → 압축 → 실제 경로 비교
  const collected = await collectHubs(provider, areas, budget, signal);
  if (collected.skipped) limited = true;
  let pool: Collected[] = collected.locations;
  if (collected.errors.length) notices.push('일부 지역의 후보 검색을 완료하지 못해 확인된 후보만 비교했어요.');
  if (!pool.length) {
    if (collected.errors.length && collected.errors.length === collected.total) throw collected.errors[0];
    const fallbackAreas = areas.filter((area) => area.source === 'between').slice(0, 2);
    const pages = await Promise.all(fallbackAreas.map(async (area, areaIndex) => {
      if (!budget.reserve(1)) return [];
      try {
        const page = await budget.run(() => provider.nearbyPlaces(area, 'cafe', Math.min(20000, area.radiusMeters), '', 1, signal));
        return page.places.map((item): Collected => ({ ...item, source: 'between', areaIndex }));
      } catch (error) { if (isFatal(error)) throw error; return []; }
    }));
    pool = pages.flat();
    if (pool.length) notices.push('주변 교통 거점이 없어 검색된 카페를 만남 후보로 비교했어요.');
  }

  const shortlist = shortlistCandidates(pool, people, areas, { limit: SEARCH_LIMITS.firstRoundCandidates });
  const firstBatch = affordable(shortlist, people, budget);
  if (firstBatch.length < shortlist.length) limited = true;
  let evaluated = (await evaluateDestinations(provider, people, firstBatch, signal, budget))
    .map((item, index): CandidateResult => ({ ...item, source: firstBatch[index].source }));
  const fatalRoute = evaluated.flatMap((item) => item.routes).find((route) => route.status === 'error' && FATAL_CODES.includes(route.error.code));
  let rounds = 1;
  const searchedAreas = [...areas];

  // 추가 탐색: 비교 가능한 후보가 부족할 때만
  const rankedCount = () => evaluated.filter((item) => item.metrics).length;
  if (!fatalRoute && rankedCount() < SEARCH_LIMITS.minRankedCandidates) {
    if (budget.expired() || budget.remaining < people.length) {
      limited = true;
    } else {
      const extraAreas = planExpansionAreas(people, areas, evaluated);
      if (extraAreas.length) {
        rounds = 2;
        searchedAreas.push(...extraAreas);
        const more = await collectHubs(provider, extraAreas, budget, signal);
        if (more.skipped) limited = true;
        const extraPool: Collected[] = [...pool, ...more.locations.map((item) => ({ ...item, source: 'expanded' as const }))];
        pool = extraPool;
        const extraShortlist = shortlistCandidates(extraPool, people, extraAreas,
          { limit: SEARCH_LIMITS.expansionCandidates, exclude: evaluated.map((item) => item.candidate) });
        const secondBatch = affordable(extraShortlist, people, budget);
        if (secondBatch.length < extraShortlist.length) limited = true;
        if (secondBatch.length) {
          const extra = await evaluateDestinations(provider, people, secondBatch, signal, budget);
          evaluated = [...evaluated, ...extra.map((item, index): CandidateResult => ({ ...item, source: secondBatch[index].source }))];
          const added = extra.filter((item) => item.metrics).length;
          notices.push(added
            ? `비교할 수 있는 후보가 부족해 탐색 범위를 넓혀 ${added}곳을 더 찾았어요.`
            : '탐색 범위를 넓혀 더 찾아봤지만 모든 참가자가 갈 수 있는 후보를 추가로 찾지 못했어요.');
        }
      }
    }
  }

  if (!evaluated.length) {
    throw new MeetPointError('NO_CANDIDATES', '탐색 지역에서 만남 후보를 찾지 못했어요. 출발 위치를 가까운 역이나 터미널로 바꿔 주세요.', 422);
  }

  const { ranked, excluded } = rankCandidates(evaluated);
  const reasons = explainRanking(ranked, people);
  if (limited) notices.push('조회 시간과 호출 수 제한으로 일부 후보는 비교하지 못했어요.');
  if (tier === 'long' && people.some((person) => person.transport === 'transit')) {
    notices.push('대중교통 길찾기는 시내·광역 버스와 지하철 중심이라 KTX·고속버스 경로는 포함되지 않을 수 있어요. 장거리는 자동차로도 비교해 보세요.');
  }
  notices.push('이동시간은 조회 시점 기준 예상치이며, 미래 약속 시각의 교통 상황과 막차 운행을 보장하지 않아요.');

  const searchScope: SearchScope = {
    tier, tierLabel: TIER_LABEL[tier], maxSpreadKm: Math.round(maxSpreadMeters / 100) / 10,
    areas: searchedAreas, rounds, collectedCount: new Set(pool.map((item) => item.id)).size,
    apiCalls: budget.calls, limited,
  };
  return {
    ranked: ranked.map((item, index) => ({ ...item, reasons: reasons[index] })),
    excluded: excluded.map((item) => ({ ...item, exclusionReason: exclusionReason(item, people) })),
    generatedAt: new Date().toISOString(), timeBasis: 'query-time',
    searchedCandidateCount: evaluated.length, searchScope, notices,
  };
}
