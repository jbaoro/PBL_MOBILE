import assert from 'node:assert/strict';
import test from 'node:test';
import type { MeetingDraft } from '../../features/meeting/model';
import {
  buildIcs, buildShareText, foldIcsLine, icsFileName, kakaoRouteLink, parseSchedule, scheduleText,
} from '../../features/meeting/share';

const origin = (name: string, lat: number, lng: number) => ({ id: `o:${name}`, name, address: `${name} 비공개 주소`, lat, lng });
const place = { id: 'kakao:1', name: '평양면옥, 본점', address: '서울 강남구 테헤란로 101', lat: 37.5006, lng: 127.0364,
  category: '음식점 > 한식', phone: '02-555-0000', url: 'https://place.map.kakao.com/123' };
const meeting: MeetingDraft = {
  id: 'm1', title: '동기 모임; 송년회', scheduledAt: '2026-12-05T19:00', createdAt: '', updatedAt: '',
  participants: [
    { id: 'A', name: '지수', origin: origin('강남역', 37.49, 127.02), transport: 'transit' },
    { id: 'B', name: '민호', origin: origin('홍대입구역', 37.55, 126.92), transport: 'car' },
  ],
  selectedPlace: place,
  placeRoutes: {
    candidate: place, metrics: { maxMinutes: 21.7, gapMinutes: 9.3, averageMinutes: 17 },
    routes: [
      { status: 'ok', participantId: 'A', destinationId: 'kakao:1', transport: 'transit', durationMinutes: 12.4, distanceMeters: 1, fetchedAt: '', timeBasis: 'query-time', provider: 'kakao-map' },
      { status: 'ok', participantId: 'B', destinationId: 'kakao:1', transport: 'car', durationMinutes: 21.7, distanceMeters: 1, fetchedAt: '', timeBasis: 'query-time', provider: 'kakao-mobility' },
    ],
  },
  confirmedAt: '2026-11-25T05:00:00Z',
};

test('약속 일시: 시간 있음/날짜만/잘못된 값을 구분한다', () => {
  assert.deepEqual(parseSchedule('2026-12-05T19:00'), { year: 2026, month: 12, day: 5, hour: 19, minute: 0 });
  assert.deepEqual(parseSchedule('2026-12-05'), { year: 2026, month: 12, day: 5 });
  assert.equal(parseSchedule('2026-13-05'), null);
  assert.equal(parseSchedule(undefined), null);
  assert.equal(scheduleText('2026-12-05T19:00'), '2026년 12월 5일 (토) 오후 7:00');
  assert.equal(scheduleText('2026-12-05T00:30'), '2026년 12월 5일 (토) 오전 12:30');
  assert.equal(scheduleText('2026-12-05'), '2026년 12월 5일 (토) · 시간 미정');
});

test('길찾기 링크는 이름,위도,경도 순서이고 이름의 쉼표는 인코딩한다', () => {
  assert.equal(kakaoRouteLink(place), 'https://map.kakao.com/link/to/%ED%8F%89%EC%96%91%EB%A9%B4%EC%98%A5%2C%20%EB%B3%B8%EC%A0%90,37.5006,127.0364');
});

test('공유 글에는 장소·일시·이동시간이 들어가고 출발지 주소는 들어가지 않는다', () => {
  const text = buildShareText(meeting);
  assert.ok(text.startsWith('[MeetPoint] 동기 모임; 송년회'));
  assert.ok(text.includes('일시: 2026년 12월 5일 (토) 오후 7:00'));
  assert.ok(text.includes('장소: 평양면옥, 본점'));
  assert.ok(text.includes('길찾기: https://map.kakao.com/link/to/'));
  assert.ok(text.includes('- 지수(대중교통) 12분'));
  assert.ok(text.includes('- 민호(자동차) 22분'));
  assert.ok(text.includes('가장 오래 걸리는 사람 22분 · 차이 9분'));
  assert.ok(!text.includes('비공개 주소'));
  assert.equal(buildShareText({ ...meeting, selectedPlace: undefined }), '');
});

test('캘린더 파일: 한국 시간을 UTC로 바꾸고 특수문자를 이스케이프한다', () => {
  const ics = buildIcs(meeting, new Date('2026-11-25T05:00:00Z'))!;
  assert.ok(ics.includes('DTSTART:20261205T100000Z'));
  assert.ok(ics.includes('DTEND:20261205T120000Z'));
  assert.ok(ics.includes('SUMMARY:동기 모임\\; 송년회'));
  assert.ok(ics.includes('LOCATION:평양면옥\\, 본점\\, 서울 강남구 테헤란로 101'));
  assert.ok(ics.includes('UID:m1@meetpoint'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  // 모든 줄이 75바이트 이하
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
});

test('캘린더 파일: 날짜만 있으면 하루 종일, 날짜가 없으면 만들지 않는다', () => {
  const allDay = buildIcs({ ...meeting, scheduledAt: '2026-12-31' }, new Date())!;
  assert.ok(allDay.includes('DTSTART;VALUE=DATE:20261231'));
  assert.ok(allDay.includes('DTEND;VALUE=DATE:20270101'));
  assert.equal(buildIcs({ ...meeting, scheduledAt: undefined }, new Date()), null);
});

test('긴 줄 접기와 파일 이름', () => {
  const folded = foldIcsLine(`DESCRIPTION:${'가'.repeat(60)}`);
  const parts = folded.split('\r\n');
  assert.ok(parts.length > 1 && parts.slice(1).every((part) => part.startsWith(' ')));
  assert.equal(parts.map((part, index) => (index ? part.slice(1) : part)).join(''), `DESCRIPTION:${'가'.repeat(60)}`);
  assert.equal(icsFileName({ ...meeting, title: '송년회/2026: 동기' }), '송년회2026 동기.ics');
});
