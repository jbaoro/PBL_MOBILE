import assert from 'node:assert/strict';
import test from 'node:test';
import { TtlCache, createProviderCaches, withCache, type MapProvider } from '../../lib/meetpoint/server/cache';
import { MeetPointError } from '../../lib/meetpoint/errors';
import type { Location, Participant, RouteSuccess } from '../../lib/meetpoint/types';

const destination: Location = { id: 'd1', name: '역삼역', address: '주소', lat: 37.500612, lng: 127.036431 };
const person: Participant = { id: 'p1', name: '지수', origin: { id: 'o', name: '강남역', address: '주소', lat: 37.497952, lng: 127.027619 }, transport: 'transit' };

function fakeInner(calls: string[], failRoute = false): MapProvider {
  return {
    searchLocations: async (query) => { calls.push(`search:${query}`); return { locations: [destination], notices: [] }; },
    nearbyHubs: async (_center, kind) => { calls.push(`hubs:${kind}`); return [destination]; },
    nearbyPlaces: async (_c, category, _r, _q, page) => { calls.push(`places:${category}:${page}`); return { places: [], page, hasNext: false }; },
    route: async (traveler, to): Promise<RouteSuccess> => {
      calls.push(`route:${traveler.id}->${to.id}`);
      if (failRoute) throw new MeetPointError('NO_ROUTE', '경로 없음', 422);
      return { status: 'ok', participantId: traveler.id, destinationId: to.id, transport: traveler.transport, durationMinutes: 9,
        distanceMeters: 900, fetchedAt: '2026-11-25T05:00:00Z', timeBasis: 'query-time', provider: 'kakao-map' };
    },
  };
}

test('같은 경로를 다시 조회하면 카카오를 부르지 않고, 다른 참가자·후보 ID로 바꿔 돌려준다', async () => {
  const calls: string[] = [];
  const provider = withCache(fakeInner(calls), createProviderCaches());
  await provider.route(person, destination);
  const again = await provider.route({ ...person, id: 'p2' }, { ...destination, id: 'place-9', lat: destination.lat + 0.000001 });
  assert.deepEqual(calls, ['route:p1->d1']);
  assert.equal(again.participantId, 'p2');
  assert.equal(again.destinationId, 'place-9');
  assert.equal(again.fetchedAt, '2026-11-25T05:00:00Z', '조회 시각은 원래 값을 유지');
  // 이동수단이 다르면 다른 조회
  await provider.route({ ...person, transport: 'car' }, destination);
  assert.equal(calls.length, 2);
});

test('실패한 경로는 저장하지 않는다', async () => {
  const calls: string[] = [];
  const provider = withCache(fakeInner(calls, true), createProviderCaches());
  await assert.rejects(provider.route(person, destination));
  await assert.rejects(provider.route(person, destination));
  assert.equal(calls.length, 2);
});

test('역·장소·출발지 검색도 같은 조건이면 저장된 결과를 쓴다', async () => {
  const calls: string[] = [];
  const provider = withCache(fakeInner(calls), createProviderCaches());
  await provider.nearbyHubs(destination, 'subway', 3000);
  await provider.nearbyHubs(destination, 'subway', 3000);
  await provider.nearbyHubs(destination, 'rail', 3000);
  await provider.nearbyPlaces(destination, 'cafe', 1000, '', 1);
  await provider.nearbyPlaces(destination, 'cafe', 1000, '', 1);
  await provider.nearbyPlaces(destination, 'cafe', 1000, '', 2);
  await provider.searchLocations('강남역');
  await provider.searchLocations(' 강남역 ');
  assert.deepEqual(calls, ['hubs:subway', 'hubs:rail', 'places:cafe:1', 'places:cafe:2', 'search:강남역']);
});

test('유효 시간이 지나면 다시 조회하고, 개수가 넘치면 가장 오래 안 쓴 것부터 지운다', () => {
  let clock = 0;
  const cache = new TtlCache<number>(1000, 2, () => clock);
  cache.set('a', 1); cache.set('b', 2);
  assert.equal(cache.get('a'), 1);          // a를 최근에 사용
  cache.set('c', 3);                         // 가장 오래 안 쓴 b가 빠짐
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a'), 1);
  clock = 1500;
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.size, 1);
});
