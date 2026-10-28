import assert from 'node:assert/strict';
import test from 'node:test';
import { KakaoProvider } from '../../lib/meetpoint/server/kakao';
import { MeetPointError, publicError } from '../../lib/meetpoint/errors';
import type { Participant, Location } from '../../lib/meetpoint/types';

const destination: Location = { id: 'd', name: '목적지', address: '주소', lat: 37.5, lng: 127 };
const person: Participant = { id: 'p', name: '참가자', origin: { ...destination, lat: 37.6, lng: 126.8 }, transport: 'transit' };
function provider(data: unknown, status = 200, inspect?: (url: URL, init?: RequestInit) => void) {
  return new KakaoProvider({ key: 'test-secret-not-a-real-key', fetcher: (async (input, init) => {
    inspect?.(new URL(String(input)), init);
    return Response.json(data, { status });
  }) as typeof fetch });
}

test('transit adapter uses longitude for x, converts seconds to minutes and picks shortest complete route', async () => {
  const result = await provider({ status: 'OK', properties: {}, routes: [
    { properties: { totalTime: 1801, totalDistance: 9000 } }, { properties: { totalTime: 1201, totalDistance: 9500 } },
  ] }, 200, (url, init) => {
    assert.equal(url.pathname, '/v2/routing/publictraffic');
    assert.equal(url.searchParams.get('start_x'), '126.8');
    assert.equal(url.searchParams.get('start_y'), '37.6');
    assert.equal(url.searchParams.has('apiKey'), false);
    assert.equal(init?.cache, 'no-store');
  }).route(person, destination);
  assert.equal(result.durationMinutes, 1201 / 60);
  assert.equal(result.timeBasis, 'query-time');
});

test('car adapter converts summary seconds and uses the mobility endpoint', async () => {
  const result = await provider({ routes: [{ result_code: 0, summary: { duration: 120, distance: 1500 } }] }, 200, (url) => {
    assert.equal(url.hostname, 'apis-navi.kakaomobility.com');
    assert.equal(url.searchParams.get('origin'), '126.8,37.6');
    assert.equal(url.searchParams.get('priority'), 'TIME');
  }).route({ ...person, transport: 'car' }, destination);
  assert.equal(result.durationMinutes, 2);
  assert.equal(result.distanceMeters, 1500);
});

test('walk adapter parses real route times and omits unsafe provider links', async () => {
  const result = await provider({ status: 'OK', route: { properties: { totalTime: 901, totalDistance: 1100, landingUrl: 'javascript:alert(1)' } } })
    .route({ ...person, transport: 'walk' }, destination);
  assert.equal(result.durationMinutes, 901 / 60);
  assert.equal(result.url, undefined);
});

test('exact same coordinates require no provider call, while merely close points still require one', async () => {
  let calls = 0;
  const instance = provider({ status: 'NO_RESULTS' }, 200, () => { calls++; });
  assert.equal((await instance.route(person, person.origin)).durationMinutes, 0);
  assert.equal(calls, 0);
  await assert.rejects(instance.route(person, { ...person.origin, lat: person.origin.lat + 0.00001 }), (error: unknown) => error instanceof MeetPointError && error.code === 'NO_ROUTE');
  assert.equal(calls, 1);
});

test('missing keys, quota and authorization failures are explicit and do not expose secrets', async () => {
  await assert.rejects(new KakaoProvider({ key: '' }).searchLocations('강남역'), (error: unknown) => error instanceof MeetPointError && error.code === 'NOT_CONFIGURED');
  for (const [status, code] of [[401, 'PROVIDER_AUTH'], [403, 'PROVIDER_AUTH'], [429, 'QUOTA_EXCEEDED']] as const) {
    await assert.rejects(provider({ message: 'test-secret-not-a-real-key' }, status).route(person, destination), (error: unknown) => {
      assert.ok(error instanceof MeetPointError); assert.equal(error.code, code);
      assert.ok(!JSON.stringify(publicError(error)).includes('test-secret'));
      return true;
    });
  }
});

test('failed or malformed successful responses cannot become zero-minute routes', async () => {
  await assert.rejects(provider({ status: 'NO_RESULTS' }).route(person, destination), (error: unknown) => error instanceof MeetPointError && error.code === 'NO_ROUTE');
  for (const properties of [{ totalDistance: 100 }, { totalTime: null, totalDistance: 100 }, { totalTime: -2, totalDistance: 100 }]) {
    await assert.rejects(provider({ status: 'OK', routes: [{ properties }] }).route(person, destination), (error: unknown) => error instanceof MeetPointError && error.code === 'UPSTREAM_ERROR');
  }
});

test('abort signal yields a safe timeout error', async () => {
  const controller = new AbortController(); controller.abort();
  const instance = new KakaoProvider({ key: 'test', fetcher: (async (_input, init) => {
    init?.signal?.throwIfAborted(); throw new Error('unreachable');
  }) as typeof fetch });
  await assert.rejects(instance.route(person, destination, controller.signal), (error: unknown) => error instanceof MeetPointError && error.code === 'TIMEOUT');
});

test('keyword and address searches merge actual coordinates and expose partial search failures', async () => {
  const instance = new KakaoProvider({ key: 'test', fetcher: (async (input) => {
    if (String(input).includes('/address.')) return Response.json({}, { status: 500 });
    return Response.json({ documents: [{ id: '1', place_name: '역', address_name: '주소', x: '127', y: '37.5' }] });
  }) as typeof fetch });
  const result = await instance.searchLocations('역');
  assert.equal(result.locations.length, 1);
  assert.equal(result.locations[0].lat, 37.5);
  assert.equal(result.notices.length, 1);
});

test('place category, radius, keyword and pagination are forwarded without inventing ratings or opening hours', async () => {
  const result = await provider({ meta: { is_end: false }, documents: [{ id: '1', place_name: '카페', address_name: '주소', category_name: '음식점 > 카페', x: '127', y: '37.5', distance: '300', place_url: 'http://place.map.kakao.com/1' }] }, 200, (url) => {
    assert.equal(url.searchParams.get('category_group_code'), 'CE7');
    assert.equal(url.searchParams.get('page'), '2');
    assert.equal(url.searchParams.get('radius'), '1000');
    assert.equal(url.searchParams.get('query'), '커피');
  }).nearbyPlaces(destination, 'cafe', 1000, '커피', 2);
  assert.equal(result.places[0].distanceMeters, 300);
  assert.equal(result.hasNext, true);
  assert.equal(result.places[0].url, 'https://place.map.kakao.com/1');
  assert.equal('rating' in result.places[0], false);
});
