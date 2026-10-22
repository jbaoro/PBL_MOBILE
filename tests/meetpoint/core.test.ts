import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateMetrics, rankCandidates } from '../../lib/meetpoint/ranking';
import { coordinates, coordinatesFromQuery, participants, integerParam } from '../../lib/meetpoint/validation';
import { candidateAnchors, evaluateDestinations, mapLimited, shortlistCandidates } from '../../lib/meetpoint/server/service';
import { MeetPointError } from '../../lib/meetpoint/errors';
import type { CandidateResult, Location, Participant, RouteSuccess } from '../../lib/meetpoint/types';

export const destination: Location = { id: 'destination', name: '테스트 목적지', address: '테스트 주소', lat: 37.5, lng: 127 };
export const people: Participant[] = [
  { id: 'a', name: '가', origin: { ...destination, id: 'origin-a', lat: 37.7 }, transport: 'transit' },
  { id: 'b', name: '나', origin: { ...destination, id: 'origin-b', lat: 37.2 }, transport: 'car' },
];
function route(id: string, durationMinutes: number, destinationId = destination.id): RouteSuccess {
  return { status: 'ok', participantId: id, destinationId, transport: 'transit', durationMinutes, distanceMeters: 1000,
    provider: 'kakao-map', fetchedAt: '2026-10-21T00:00:00Z', timeBasis: 'query-time' };
}

test('metrics retain precision and match the report example', () => {
  const four = [42, 36, 18, 29].map((value, index) => route(String(index), value));
  const participants = four.map((value) => ({ ...people[0], id: value.participantId }));
  assert.deepEqual(calculateMetrics(four, participants), { maxMinutes: 42, gapMinutes: 24, averageMinutes: 31.25 });
});

test('max time, then gap, then average, then stable ID determine ranking without display rounding', () => {
  const candidate = (id: string, max: number, gap: number, avg: number): CandidateResult => ({
    candidate: { ...destination, id }, routes: [], metrics: { maxMinutes: max, gapMinutes: gap, averageMinutes: avg },
  });
  const items = [candidate('z', 30, 10, 25), candidate('b', 30, 10, 24), candidate('a', 30, 10, 24),
    candidate('gap', 30, 9, 29), candidate('max', 29.99, 29, 29), { ...candidate('excluded', 0, 0, 0), metrics: null }];
  assert.deepEqual(rankCandidates(items).ranked.map((item) => item.candidate.id), ['max', 'gap', 'a', 'b', 'z']);
  assert.equal(rankCandidates(items).excluded.length, 1);
  assert.equal(items[0].candidate.id, 'z');
});

test('incomplete, duplicate, failed and invalid participant routes cannot produce a score', () => {
  const good = [route('a', 10), route('b', 20)];
  assert.equal(calculateMetrics(good.slice(1), people), null);
  assert.equal(calculateMetrics([good[0], good[0]], people), null);
  assert.equal(calculateMetrics([route('a', NaN), good[1]], people), null);
  assert.equal(calculateMetrics([route('a', -1), good[1]], people), null);
  assert.equal(calculateMetrics([route('other', 0), good[1]], people), null);
  assert.equal(calculateMetrics([{ status: 'error', participantId: 'a', destinationId: 'x', error: { code: 'NO_ROUTE', message: '', retryable: false } }, good[1]], people), null);
  assert.deepEqual(calculateMetrics([route('a', 0), good[1]], people), { maxMinutes: 20, gapMinutes: 20, averageMinutes: 10 });
});

test('validation rejects coercion, duplicate IDs, unsupported modes, missing coordinates and excessive counts', () => {
  assert.throws(() => coordinates({ lat: '37.5', lng: 127 }), MeetPointError);
  assert.throws(() => coordinates({ lat: 91, lng: 127 }), MeetPointError);
  assert.throws(() => coordinates({ lat: 37.5, lng: Infinity }), MeetPointError);
  assert.throws(() => coordinatesFromQuery(new URLSearchParams('lat=&lng=127')), MeetPointError);
  assert.throws(() => participants([people[0]]), MeetPointError);
  assert.throws(() => participants([people[0], people[0]]), MeetPointError);
  assert.throws(() => participants([...people, { ...people[0], id: 'c', transport: 'bike' }]), MeetPointError);
  assert.throws(() => participants(Array.from({ length: 9 }, (_, index) => ({ ...people[0], id: String(index) }))), MeetPointError);
  assert.throws(() => integerParam('1.5', 1, 1, 45, '페이지'), MeetPointError);
  assert.throws(() => integerParam('0', 1, 1, 45, '페이지'), MeetPointError);
  assert.equal(integerParam(null, 1, 1, 45, '페이지'), 1);
  assert.equal(participants(people).length, 2);
});

test('route failure excludes only the affected candidate without dropping a participant', async () => {
  const provider = { route: async (person: Participant, point: Location) => {
    if (point.id === 'bad' && person.id === 'b') throw new MeetPointError('NO_ROUTE', '경로 없음');
    return route(person.id, person.id === 'a' ? 10 : 20, point.id);
  } };
  const evaluated = await evaluateDestinations(provider, people, [{ ...destination, id: 'bad' }, destination]);
  assert.equal(evaluated[0].metrics, null);
  assert.equal(evaluated[0].routes.length, 2);
  assert.equal(evaluated[1].metrics?.maxMinutes, 20);
  assert.equal(rankCandidates(evaluated).ranked.length, 1);
});

test('bounded parallelism preserves result order', async () => {
  let active = 0; let peak = 0;
  const result = await mapLimited([1, 2, 3, 4, 5, 6], 2, async (value) => {
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, (7 - value) * 2));
    active--; return value * 2;
  });
  assert.deepEqual(result, [2, 4, 6, 8, 10, 12]);
  assert.equal(peak, 2);
});

test('nationwide anchors and shortlist use origins, deduplicate nearby hubs and cap at six', () => {
  const nationwide = [people[0], { ...people[1], origin: { ...destination, lat: 35.18, lng: 129.07 }, transport: 'walk' as const }];
  const anchors = candidateAnchors(nationwide);
  assert.ok(anchors.some((point) => point.lat === 35.18));
  assert.ok(anchors.length <= 3);
  const hubs = Array.from({ length: 15 }, (_, index) => ({ ...destination, id: String(index), lat: 36 + index / 20 }));
  const selected = shortlistCandidates([...hubs, hubs[0], { ...hubs[1], id: 'same-coordinate' }], nationwide, anchors);
  assert.equal(selected.length, 6);
  assert.equal(new Set(selected.map((point) => point.lat)).size, 6);
});
