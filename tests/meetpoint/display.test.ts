import assert from 'node:assert/strict';
import test from 'node:test';
import { balanceLabel, balanceScore, minutesText, participantsForApi, projectPoints } from '../../features/meeting/display';

test('균형도는 가장 빠른 사람 ÷ 가장 오래 걸리는 사람 비율이다', () => {
  assert.equal(balanceScore({ maxMinutes: 30, gapMinutes: 0, averageMinutes: 30 }), 100);
  assert.equal(balanceScore({ maxMinutes: 40, gapMinutes: 10, averageMinutes: 35 }), 75);
  assert.equal(balanceScore({ maxMinutes: 20, gapMinutes: 20, averageMinutes: 10 }), 0);
  assert.equal(balanceScore({ maxMinutes: 0, gapMinutes: 0, averageMinutes: 0 }), 100);
  assert.equal(balanceLabel(85), '매우 고름');
  assert.equal(balanceLabel(30), '차이가 큼');
});

test('분 표시는 반올림하고 1시간 이상은 시간 단위로 바꾼다', () => {
  assert.equal(minutesText(0), '0분');
  assert.equal(minutesText(0.4), '1분 미만');
  assert.equal(minutesText(26.6), '27분');
  assert.equal(minutesText(60), '1시간');
  assert.equal(minutesText(345.2), '5시간 45분');
});

test('API로 보낼 때 화면 전용 색상은 빠진다', () => {
  const origin = { id: 'o', name: '강남역', address: '주소', lat: 37.5, lng: 127 };
  assert.deepEqual(participantsForApi([{ id: 'a', name: '가', origin, transport: 'walk', color: 'rose' }]),
    [{ id: 'a', name: '가', origin, transport: 'walk' }]);
});

test('좌표 투영은 영역 안에 들어오고 북쪽이 위, 동쪽이 오른쪽이다', () => {
  const points = projectPoints([{ lat: 37.55, lng: 126.92 }, { lat: 37.49, lng: 127.03 }, { lat: 37.52, lng: 126.98 }], 400, 170, 30);
  for (const point of points) {
    assert.ok(point.x >= 30 - 0.1 && point.x <= 370.1 && point.y >= 30 - 0.1 && point.y <= 140.1);
  }
  assert.ok(points[0].y < points[1].y, '북쪽(위도 큰 쪽)이 위');
  assert.ok(points[0].x < points[1].x, '동쪽(경도 큰 쪽)이 오른쪽');
  assert.equal(projectPoints([{ lat: 37.5, lng: 127 }], 400, 170).length, 1);
});
