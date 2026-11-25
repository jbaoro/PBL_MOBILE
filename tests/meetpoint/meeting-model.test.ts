import assert from 'node:assert/strict';
import test from 'node:test';
import * as model from '../../features/meeting/model';
import type { CandidateResult, Location, Participant, Place, RecommendationResult } from '../../lib/meetpoint/types';

const now = '2026-11-25T00:00:00.000Z';
const later = '2026-11-25T01:00:00.000Z';
const origin = (id: string, lat: number): Location => ({ id, name: id, address: `${id} 주소`, lat, lng: 127 });
const person = (id: string, lat = 37.5): Participant => ({ id, name: id, origin: origin(`o-${id}`, lat), transport: 'transit' });
const candidate = (id: string): CandidateResult => ({
  candidate: origin(id, 37.4), routes: [], metrics: { maxMinutes: 30, gapMinutes: 5, averageMinutes: 27 },
});
const recommendation: RecommendationResult = {
  ranked: [candidate('c1'), candidate('c2')], excluded: [], generatedAt: now, timeBasis: 'query-time',
  searchedCandidateCount: 2, notices: [],
  searchScope: { tier: 'nearby', tierLabel: '근거리', maxSpreadKm: 10, areas: [], rounds: 1, collectedCount: 2, apiCalls: 6, limited: false },
};
const place: Place = { ...origin('place1', 37.41), category: '카페' };

function confirmedMeeting() {
  let m = model.createMeeting('m1', now);
  m = model.updateInfo(m, { title: ' 동기 모임 ', scheduledAt: '2026-12-01T19:00' }, now);
  m = model.upsertParticipant(m, person('a'), now);
  m = model.upsertParticipant(m, person('b', 37.6), now);
  m = model.setRecommendation(m, recommendation, now);
  m = model.selectCandidateId(m, 'c1', now);
  m = model.selectPlace(m, place, now);
  m = model.setPlaceRoutes(m, { ...candidate('place1'), candidate: place }, now);
  return model.confirmMeeting(m, later);
}

test('a new meeting can only open the info step', () => {
  const m = model.createMeeting('m1', now);
  assert.equal(model.blockingStep(m, 'info'), null);
  assert.equal(model.blockingStep(m, 'participants'), 'info');
  assert.equal(model.blockingStep(m, 'done'), 'info');
  assert.equal(model.resumeStep(m), 'info');
  assert.equal(model.meetingStatus(m), 'draft');
});

test('recommendation requires a title and at least two participants', () => {
  let m = model.updateInfo(model.createMeeting('m1', now), { title: '모임' }, now);
  m = model.upsertParticipant(m, person('a'), now);
  assert.equal(model.blockingStep(m, 'recommend'), 'participants');
  m = model.upsertParticipant(m, person('b'), now);
  assert.equal(model.blockingStep(m, 'recommend'), null);
  assert.equal(model.meetingStatus(m), 'ready');
});

test('a fully completed meeting resumes at the done step', () => {
  const m = confirmedMeeting();
  assert.equal(m.title, '동기 모임');
  assert.equal(model.resumeStep(m), 'done');
  assert.equal(model.meetingStatus(m), 'confirmed');
});

test('changing a participant origin or transport clears every later result', () => {
  const m = confirmedMeeting();
  const moved = model.upsertParticipant(m, { ...person('a'), origin: origin('elsewhere', 37.3) }, later);
  assert.equal(moved.recommendation, undefined);
  assert.equal(moved.selectedCandidateId, undefined);
  assert.equal(moved.selectedPlace, undefined);
  assert.equal(moved.placeRoutes, undefined);
  assert.equal(moved.confirmedAt, undefined);
  assert.equal(model.resumeStep(moved), 'recommend');

  const transport = model.upsertParticipant(m, { ...person('a'), transport: 'car' }, later);
  assert.equal(transport.recommendation, undefined);
  const removed = model.removeParticipant(m, 'b', later);
  assert.equal(removed.recommendation, undefined);
  assert.equal(model.resumeStep(removed), 'participants');
});

test('renaming a participant keeps the results', () => {
  const m = confirmedMeeting();
  const renamed = model.upsertParticipant(m, { ...person('a'), name: '새이름' }, later);
  assert.ok(renamed.recommendation);
  assert.ok(renamed.confirmedAt);
});

test('choosing a different candidate or place clears only the later steps', () => {
  const m = confirmedMeeting();
  const otherCandidate = model.selectCandidateId(m, 'c2', later);
  assert.ok(otherCandidate.recommendation);
  assert.equal(otherCandidate.selectedPlace, undefined);
  assert.equal(otherCandidate.confirmedAt, undefined);
  assert.equal(model.selectCandidateId(m, 'not-in-results', later), m);

  const otherPlace = model.selectPlace(m, { ...place, id: 'place2' }, later);
  assert.equal(otherPlace.selectedCandidateId, 'c1');
  assert.equal(otherPlace.placeRoutes, undefined);
  assert.equal(otherPlace.confirmedAt, undefined);
});

test('a place cannot be confirmed unless every route succeeded', () => {
  let m = confirmedMeeting();
  m = model.selectPlace(m, { ...place, id: 'place2' }, later);
  m = model.setPlaceRoutes(m, { candidate: { ...place, id: 'place2' }, routes: [], metrics: null }, later);
  assert.equal(model.confirmMeeting(m, later).confirmedAt, undefined);
  // 다른 장소의 결과는 받아들이지 않는다.
  assert.equal(model.setPlaceRoutes(m, candidate('wrong'), later), m);
});

test('participants are capped at the maximum', () => {
  let m = model.updateInfo(model.createMeeting('m1', now), { title: '모임' }, now);
  for (let index = 0; index < model.MAX_PARTICIPANTS + 2; index++) m = model.upsertParticipant(m, person(`p${index}`), now);
  assert.equal(m.participants.length, model.MAX_PARTICIPANTS);
});

test('stored data round-trips and damaged entries are dropped', () => {
  const m = confirmedMeeting();
  const parsed = model.parseStoredMeetings(JSON.parse(model.serializeMeetings([m])));
  assert.deepEqual(parsed, [m]);

  assert.deepEqual(model.parseStoredMeetings(null), []);
  assert.deepEqual(model.parseStoredMeetings({ version: 999, meetings: [m] }), []);
  const broken = { version: model.STORAGE_VERSION, meetings: [m, { id: 'x' }, { ...m, id: 'm2', participants: [{ id: 'bad' }] }] };
  assert.deepEqual(model.parseStoredMeetings(broken).map((item) => item.id), ['m1']);

  const badResult = { version: model.STORAGE_VERSION, meetings: [{ ...m, recommendation: 'oops' }] };
  const [repaired] = model.parseStoredMeetings(badResult);
  assert.equal(repaired.recommendation, undefined);
  assert.equal(repaired.participants.length, 2);
});

test('paths map each step to its screen', () => {
  assert.equal(model.meetingPath('m1'), '/meetings/m1');
  assert.equal(model.meetingPath('m1', 'participants'), '/meetings/m1/participants');
  assert.equal(model.meetingPath('m1', 'place'), '/meetings/m1/places/selected');
  assert.equal(model.stepNumber('info'), 1);
  assert.equal(model.stepNumber('done'), model.TOTAL_STEPS);
});
