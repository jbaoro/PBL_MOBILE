import { MeetPointError, publicError } from '../errors';
import { centroid, distanceMeters } from '../geo';
import { calculateMetrics, rankCandidates } from '../ranking';
import { MAX_CANDIDATES } from '../validation';
import type { CandidateResult, Coordinates, Location, Participant, RecommendationResult, RouteResult } from '../types';
import { KakaoProvider } from './kakao';

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

export function candidateAnchors(people: Participant[]): Coordinates[] {
  const center = centroid(people.map((person) => person.origin));
  const byDistance = [...people].sort((a, b) => distanceMeters(b.origin, center) - distanceMeters(a.origin, center) || a.id.localeCompare(b.id));
  // Add a walking origin first: a geometric midpoint alone can overlook walkable options.
  const walking = people.filter((person) => person.transport === 'walk').map((person) => person.origin);
  const seeds = [center, ...walking, ...byDistance.map((person) => centroid([center, person.origin]))];
  const anchors: Coordinates[] = [];
  for (const seed of seeds) {
    if (anchors.every((previous) => distanceMeters(previous, seed) > 1000)) anchors.push(seed);
    if (anchors.length === 3) break;
  }
  return anchors;
}

export function shortlistCandidates(locations: Location[], people: Participant[], anchors: Coordinates[]): Location[] {
  const unique = Array.from(new Map(locations.map((item) => [item.id, item])).values());
  const selected: Location[] = [];
  const add = (item: Location) => {
    if (selected.length < MAX_CANDIDATES && selected.every((previous) => previous.id !== item.id && distanceMeters(previous, item) >= 500)) selected.push(item);
  };
  // Keep one option from each search area before filling the remaining shortlist.
  for (const anchor of anchors) {
    const nearby = [...unique].sort((a, b) => distanceMeters(a, anchor) - distanceMeters(b, anchor) || a.id.localeCompare(b.id));
    if (nearby[0]) add(nearby[0]);
  }
  const maximumDistance = (point: Coordinates) => Math.max(...people.map((person) => distanceMeters(person.origin, point)));
  unique.sort((a, b) => maximumDistance(a) - maximumDistance(b) || a.id.localeCompare(b.id)).forEach(add);
  return selected;
}

async function findCandidates(provider: KakaoProvider, people: Participant[], signal?: AbortSignal) {
  const anchors = candidateAnchors(people);
  const queries = anchors.flatMap((center) => (['subway', 'rail', 'terminal'] as const).map((kind) => ({ center, kind })));
  const responses = await mapLimited(queries, 3, async ({ center, kind }) => {
    try { return { locations: await provider.nearbyHubs(center, kind, signal) }; }
    catch (error) { return { locations: [] as Location[], error }; }
  });
  let locations = responses.flatMap((response) => response.locations);
  const errors = responses.filter((response) => response.error).map((response) => response.error);
  // Authentication or quota failures cannot improve by issuing more fallback calls.
  const fatal = errors.find((error) => error instanceof MeetPointError && ['NOT_CONFIGURED', 'PROVIDER_AUTH', 'QUOTA_EXCEEDED'].includes(error.code));
  if (fatal) throw fatal;
  const notices: string[] = [];
  if (errors.length) notices.push('일부 지역의 후보 검색을 완료하지 못해 확인된 후보만 비교했어요.');
  if (!locations.length) {
    if (errors.length === responses.length) throw errors[0];
    const fallback = await mapLimited(anchors, 2, (center) => provider.nearbyPlaces(center, 'cafe', 20000, '', 1, signal));
    locations = fallback.flatMap((page) => page.places);
    if (locations.length) notices.push('주변 교통 거점이 없어 검색된 카페를 만남 후보로 비교했어요.');
  }
  const candidates = shortlistCandidates(locations, people, anchors);
  if (!candidates.length) throw new MeetPointError('NO_CANDIDATES', '탐색 지역에서 만남 후보를 찾지 못했어요. 출발 위치를 가까운 역이나 터미널로 바꿔 주세요.', 422);
  return { candidates, notices };
}

export async function evaluateDestinations(provider: Pick<KakaoProvider, 'route'>, people: Participant[], destinations: Location[], signal?: AbortSignal): Promise<CandidateResult[]> {
  const pairs = destinations.flatMap((destination) => people.map((person) => ({ destination, person })));
  const routes = await mapLimited(pairs, 4, async ({ destination, person }): Promise<RouteResult> => {
    try {
      if (signal?.aborted) throw new MeetPointError('TIMEOUT', '조회 제한 시간이 지났어요. 다시 시도해 주세요.', 504, true);
      return await provider.route(person, destination, signal);
    } catch (error) {
      return { status: 'error', participantId: person.id, destinationId: destination.id, error: publicError(error) };
    }
  });
  return destinations.map((candidate) => {
    const candidateRoutes = routes.filter((route) => route.destinationId === candidate.id);
    return { candidate, routes: candidateRoutes, metrics: calculateMetrics(candidateRoutes, people) };
  });
}

export async function recommend(provider: KakaoProvider, people: Participant[], signal?: AbortSignal): Promise<RecommendationResult> {
  const { candidates, notices } = await findCandidates(provider, people, signal);
  const evaluated = await evaluateDestinations(provider, people, candidates, signal);
  return {
    ...rankCandidates(evaluated), generatedAt: new Date().toISOString(), timeBasis: 'query-time',
    searchedCandidateCount: candidates.length,
    notices: [...notices, '검색 지역의 최대 6개 후보를 비교한 결과예요. 전국 모든 장소를 비교한 결과는 아니에요.',
      '이동시간은 조회 시점 기준 예상치이며, 미래 약속 시각의 교통 상황과 막차 운행을 보장하지 않아요.'],
  };
}
