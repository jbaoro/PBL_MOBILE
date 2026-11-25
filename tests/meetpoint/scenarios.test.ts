// 추천 흐름 시나리오 테스트: 실제 역 좌표로 만든 가짜 지도 서비스를 사용한다. (외부 API 호출 없음)
// 가짜 경로 규칙: 대중교통은 120km 초과 시 경로 없음(KTX·고속버스 미지원 가정), 도보는 15km 초과 시 경로 없음.
import assert from 'node:assert/strict';
import test from 'node:test';
import { distanceMeters } from '../../lib/meetpoint/geo';
import { MeetPointError } from '../../lib/meetpoint/errors';
import { CallBudget, SEARCH_LIMITS, classifySpread, recommend } from '../../lib/meetpoint/server/service';
import { KakaoProvider } from '../../lib/meetpoint/server/kakao';
import { EXPENSIVE_LIMITS, expensive } from '../../lib/meetpoint/server/http';
import type { Coordinates, HubKind, Location, Participant, PlacePage, RouteSuccess, Transport } from '../../lib/meetpoint/types';

type Hub = Location & { kinds: HubKind[] };
const hub = (name: string, lat: number, lng: number, ...kinds: HubKind[]): Hub =>
  ({ id: `hub:${name}`, name, address: `${name} 주소`, lat, lng, kinds });

const HUBS: Hub[] = [
  // 서울
  hub('강남역', 37.4979, 127.0276, 'subway'), hub('역삼역', 37.5006, 127.0364, 'subway'), hub('선릉역', 37.5045, 127.0490, 'subway'),
  hub('홍대입구역', 37.5575, 126.9244, 'subway'), hub('합정역', 37.5495, 126.9139, 'subway'), hub('건대입구역', 37.5404, 127.0692, 'subway'),
  hub('왕십리역', 37.5612, 127.0371, 'subway'), hub('서울역', 37.5547, 126.9707, 'subway', 'rail'), hub('시청역', 37.5657, 126.9769, 'subway'),
  hub('을지로3가역', 37.5663, 126.9910, 'subway'), hub('충무로역', 37.5612, 126.9942, 'subway'), hub('사당역', 37.4765, 126.9816, 'subway'),
  hub('고속터미널역', 37.5049, 127.0049, 'subway', 'terminal'), hub('신도림역', 37.5088, 126.8912, 'subway'), hub('영등포역', 37.5157, 126.9074, 'subway', 'rail'),
  // 수도권
  hub('수원역', 37.2656, 127.0000, 'subway', 'rail'), hub('인천역', 37.4766, 126.6168, 'subway'), hub('부평역', 37.4895, 126.7245, 'subway'),
  hub('대화역', 37.6762, 126.7473, 'subway'), hub('판교역', 37.3948, 127.1112, 'subway'), hub('금정역', 37.3722, 126.9434, 'subway'),
  // 장거리
  hub('천안아산역', 36.7945, 127.1045, 'rail'), hub('오송역', 36.6203, 127.3274, 'rail'), hub('대전역', 36.3326, 127.4344, 'rail', 'subway'),
  hub('대전복합터미널', 36.3510, 127.4374, 'terminal'), hub('김천구미역', 36.1137, 128.1806, 'rail'), hub('동대구역', 35.8793, 128.6286, 'rail', 'subway'),
  hub('부산역', 35.1151, 129.0422, 'rail', 'subway'), hub('서면역', 35.1579, 129.0592, 'subway'), hub('부산종합버스터미널', 35.2838, 129.0951, 'terminal', 'subway'),
];
const at = (name: string): Location => { const found = HUBS.find((item) => item.name === name)!; return { id: `origin:${name}`, name, address: found.address, lat: found.lat, lng: found.lng }; };
const person = (id: string, origin: string, transport: Transport): Participant => ({ id, name: id, origin: at(origin), transport });

type FakeOptions = { routeError?: (person: Participant, destination: Location) => MeetPointError | null; hubs?: Hub[] };
function fakeProvider(options: FakeOptions = {}) {
  const stats = { hubSearches: 0, routes: 0, active: 0, peak: 0 };
  const track = async <T>(work: () => T): Promise<T> => {
    stats.active++; stats.peak = Math.max(stats.peak, stats.active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    try { return work(); } finally { stats.active--; }
  };
  const provider = {
    nearbyHubs: (center: Coordinates, kind: HubKind, radius = 20000) => track(() => {
      stats.hubSearches++;
      return (options.hubs ?? HUBS).filter((item) => item.kinds.includes(kind) && distanceMeters(center, item) <= radius)
        .sort((a, b) => distanceMeters(center, a) - distanceMeters(center, b)).slice(0, 15)
        .map(({ kinds: _kinds, ...location }) => location);
    }),
    nearbyPlaces: async (): Promise<PlacePage> => ({ places: [], page: 1, hasNext: false }),
    route: (traveler: Participant, destination: Location) => track((): RouteSuccess => {
      stats.routes++;
      const custom = options.routeError?.(traveler, destination);
      if (custom) throw custom;
      const meters = distanceMeters(traveler.origin, destination);
      if (traveler.transport === 'transit' && meters > 120000) throw new MeetPointError('NO_ROUTE', '대중교통 경로 없음', 422);
      if (traveler.transport === 'walk' && meters > 15000) throw new MeetPointError('NO_ROUTE', '도보 경로 없음', 422);
      const minutes = traveler.transport === 'walk' ? meters / 75 : traveler.transport === 'transit' ? meters / 400 + 8 : meters / 700 + 5;
      return { status: 'ok', participantId: traveler.id, destinationId: destination.id, transport: traveler.transport,
        durationMinutes: meters < 1 ? 0 : minutes, distanceMeters: meters, fetchedAt: '2026-11-25T00:00:00Z', timeBasis: 'query-time', provider: 'kakao-map' };
    }),
  };
  return { provider, stats };
}

function assertWellFormed(result: Awaited<ReturnType<typeof recommend>>, stats: ReturnType<typeof fakeProvider>['stats']) {
  assert.ok(stats.hubSearches + stats.routes <= SEARCH_LIMITS.maxCalls, 'API 호출 수 상한');
  assert.equal(result.searchScope.apiCalls, stats.hubSearches + stats.routes);
  assert.ok(stats.peak <= SEARCH_LIMITS.concurrency, '동시 요청 수 상한');
  for (let index = 1; index < result.ranked.length; index++) {
    assert.ok(result.ranked[index - 1].metrics!.maxMinutes <= result.ranked[index].metrics!.maxMinutes);
  }
  for (const item of result.ranked) assert.ok(item.reasons && item.reasons.length > 0, '추천 이유');
  for (const item of result.excluded) assert.ok(item.exclusionReason, '제외 사유');
  assert.ok(result.searchScope.areas.length > 0, '검색 범위');
}

test('서울 내: 근거리로 분류하고 지하철역 위주로 좁게 찾는다', async () => {
  const people = [person('지수', '강남역', 'transit'), person('민호', '홍대입구역', 'transit'), person('서연', '건대입구역', 'transit')];
  const { provider, stats } = fakeProvider();
  const result = await recommend(provider, people);
  assert.equal(result.searchScope.tier, 'nearby');
  assert.ok(result.searchScope.areas.every((area) => area.kinds.join() === 'subway' && area.radiusMeters <= 10000));
  assert.ok(result.ranked.length >= 3);
  assert.equal(result.searchScope.rounds, 1);
  assert.ok(result.ranked[0].reasons![0].includes('가장 오래 걸리는 사람도'));
  assertWellFormed(result, stats);
});

test('수도권: 중거리로 분류하고 중간 지역 3곳에서 역·터미널까지 찾는다', async () => {
  const people = [person('A', '수원역', 'transit'), person('B', '대화역', 'transit'), person('C', '인천역', 'car')];
  const { provider, stats } = fakeProvider();
  const result = await recommend(provider, people);
  assert.equal(result.searchScope.tier, 'regional');
  assert.equal(result.searchScope.areas.filter((area) => area.source === 'between').length, 3);
  assert.ok(result.ranked.length >= 3);
  assertWellFormed(result, stats);
});

test('서울–부산: 장거리로 분류하고 출발지 주변 역·터미널도 후보에 넣는다', async () => {
  const people = [person('서울', '서울역', 'car'), person('부산', '서면역', 'transit')];
  const { provider, stats } = fakeProvider();
  const result = await recommend(provider, people);
  assert.equal(result.searchScope.tier, 'long');
  assert.ok(result.searchScope.maxSpreadKm > 300);
  assert.ok(result.searchScope.areas.some((area) => area.source === 'origin' && area.label.includes('부산')));
  // 대중교통 참가자는 120km 밖으로 갈 수 없으므로 부산 근처 후보만 비교 가능하다.
  assert.ok(result.ranked.length >= 1);
  assert.ok(result.ranked.every((item) => distanceMeters(item.candidate, people[1].origin) <= 120000));
  assert.ok(result.excluded.some((item) => item.exclusionReason!.includes('부산(대중교통) 경로 없음')));
  assert.ok(result.notices.some((notice) => notice.includes('KTX')));
  assertWellFormed(result, stats);
});

test('도보 혼합: 도보 참가자 출발지 주변을 탐색하고 걸어갈 수 있는 후보를 고른다', async () => {
  const people = [person('걷는사람', '강남역', 'walk'), person('B', '역삼역', 'transit'), person('C', '사당역', 'car')];
  const { provider, stats } = fakeProvider();
  const result = await recommend(provider, people);
  assert.ok(result.searchScope.areas.some((area) => area.label.includes('(도보)')));
  assert.ok(result.ranked.length >= 1);
  assert.ok(distanceMeters(result.ranked[0].candidate, people[0].origin) < 5000);
  assertWellFormed(result, stats);
});

test('경로 없음: 모든 경로가 실패하면 추가 탐색까지 한 뒤 빈 순위와 제외 사유를 돌려준다', async () => {
  const people = [person('A', '강남역', 'transit'), person('B', '홍대입구역', 'transit')];
  const { provider, stats } = fakeProvider({ routeError: () => new MeetPointError('NO_ROUTE', '경로 없음', 422) });
  const result = await recommend(provider, people);
  assert.equal(result.ranked.length, 0);
  assert.ok(result.excluded.length > 0);
  assert.equal(result.searchScope.rounds, 2);
  assert.ok(result.notices.some((notice) => notice.includes('넓혀')));
  assert.ok(result.excluded.every((item) => item.exclusionReason!.includes('경로 없음')));
  assertWellFormed(result, stats);
});

test('후보 부족: 한 참가자의 경로가 자주 실패하면 그 참가자 쪽으로 넓혀 다시 찾는다', async () => {
  const people = [person('A', '강남역', 'transit'), person('B', '홍대입구역', 'transit'), person('C', '수원역', 'transit')];
  // C는 수원역에서 15km 이내 후보만 갈 수 있다고 가정
  const { provider } = fakeProvider({ routeError: (traveler, destination) => traveler.id === 'C' && distanceMeters(traveler.origin, destination) > 15000
    ? new MeetPointError('NO_ROUTE', '경로 없음', 422) : null });
  const result = await recommend(provider, people);
  assert.equal(result.searchScope.rounds, 2);
  assert.ok(result.searchScope.areas.some((area) => area.source === 'expanded' && area.label.includes('C')));
  assert.ok(result.ranked.length >= 1);
  assert.ok(result.ranked.some((item) => item.source === 'expanded' || item.source === 'between'));
});

test('호출 수 제한: 예산을 넘지 않고 줄인 사실을 알린다', async () => {
  const people = Array.from({ length: 8 }, (_, index) => person(`P${index}`, ['강남역', '홍대입구역', '건대입구역', '사당역', '신도림역', '왕십리역', '서울역', '판교역'][index], 'transit'));
  const { provider, stats } = fakeProvider();
  const result = await recommend(provider, people, undefined, new CallBudget(20, 4, 40000));
  assert.ok(stats.hubSearches + stats.routes <= 20);
  assert.equal(result.searchScope.limited, true);
  assert.ok(result.notices.some((notice) => notice.includes('제한')));
});

test('마감 시간이 지나면 추가 탐색을 시작하지 않는다', async () => {
  let clock = 0;
  const budget = new CallBudget(100, 4, 1000, () => clock);
  const people = [person('A', '강남역', 'transit'), person('B', '홍대입구역', 'transit')];
  const { provider } = fakeProvider({ routeError: () => { clock = 5000; return new MeetPointError('NO_ROUTE', '경로 없음', 422); } });
  const result = await recommend(provider, people, undefined, budget);
  assert.equal(result.searchScope.rounds, 1);
  assert.equal(result.searchScope.limited, true);
});

test('호출 한도 초과·인증 오류는 추가 탐색 없이 바로 알린다', async () => {
  const people = [person('A', '강남역', 'transit'), person('B', '홍대입구역', 'transit')];
  const { provider } = fakeProvider();
  const quota = { ...provider, nearbyHubs: async () => { throw new MeetPointError('QUOTA_EXCEEDED', '한도', 429, true); } };
  await assert.rejects(recommend(quota, people), (error: unknown) => error instanceof MeetPointError && error.code === 'QUOTA_EXCEEDED');
});

test('주변에 교통 거점과 카페가 전혀 없으면 후보 없음 오류를 낸다', async () => {
  const people = [person('A', '강남역', 'transit'), person('B', '홍대입구역', 'transit')];
  const { provider } = fakeProvider({ hubs: [] });
  await assert.rejects(recommend(provider, people), (error: unknown) => error instanceof MeetPointError && error.code === 'NO_CANDIDATES');
});

test('거리 구분 기준: 25km 이하 근거리, 80km 이하 중거리, 그 이상 장거리', () => {
  assert.equal(classifySpread([person('a', '강남역', 'car'), person('b', '홍대입구역', 'car')]).tier, 'nearby');
  assert.equal(classifySpread([person('a', '수원역', 'car'), person('b', '대화역', 'car')]).tier, 'regional');
  assert.equal(classifySpread([person('a', '서울역', 'car'), person('b', '부산역', 'car')]).tier, 'long');
});

test('대중교통 EQUAL_POINTS 응답은 실패가 아니라 도보 경로로 다시 조회한다', async () => {
  const calls: string[] = [];
  const provider = new KakaoProvider({ key: 'test', fetcher: (async (input) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    if (url.pathname.endsWith('publictraffic')) return Response.json({ status: 'EQUAL_POINTS' });
    return Response.json({ status: 'OK', route: { properties: { totalTime: 120, totalDistance: 150 } } });
  }) as typeof fetch });
  const result = await provider.route(person('A', '강남역', 'transit'), { ...at('강남역'), id: 'near', lat: 37.4981 });
  assert.equal(result.transport, 'transit');
  assert.equal(result.durationMinutes, 2);
  assert.deepEqual(calls, ['/v2/routing/publictraffic', '/v2/routing/walk']);
});

test('무거운 조회 제한은 사용자별로 걸리고 다른 사용자는 막지 않는다', async () => {
  const request = (ip: string) => new Request('http://localhost/api/recommendations', { headers: { 'x-forwarded-for': ip } });
  let release!: () => void;
  const running = expensive(request('1.1.1.1'), () => new Promise<void>((resolve) => { release = resolve; }));
  await assert.rejects(expensive(request('1.1.1.1'), async () => 'second'), (error: unknown) => error instanceof MeetPointError && error.code === 'BUSY');
  assert.equal(await expensive(request('2.2.2.2'), async () => 'other user'), 'other user');
  release(); await running;
  const base = 10_000_000;
  for (let index = 0; index < EXPENSIVE_LIMITS.perClientPerMinute; index++) await expensive(request('3.3.3.3'), async () => index, base);
  await assert.rejects(expensive(request('3.3.3.3'), async () => 0, base), (error: unknown) => error instanceof MeetPointError && error.code === 'BUSY');
  assert.equal(await expensive(request('3.3.3.3'), async () => 'later', base + 61000), 'later');
});
