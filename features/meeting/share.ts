/**
 * 확정된 약속을 공유하기 위한 글과 캘린더 파일 만들기. 순수 함수만 둔다. (웹·앱 공통)
 * 실제로 보내거나 저장하는 일은 lib/platform/share.ts 가 한다.
 */
import type { Location, Transport } from '../../lib/meetpoint/types';
import type { MeetingDraft } from './model';
import { minutesText } from './display';

const TRANSPORT_LABEL: Record<Transport, string> = { transit: '대중교통', car: '자동차', walk: '도보' };

// ── 약속 일시 ─────────────────────────────────────────────────

/** 약속 일시. 시간 미정이면 hour·minute 가 없다. */
export type Schedule = { year: number; month: number; day: number; hour?: number; minute?: number };

/** 'YYYY-MM-DD' 또는 'YYYY-MM-DDTHH:mm' (기기 현지 시각) */
export function parseSchedule(value?: string): Schedule | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number) as unknown as number[];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return hour === undefined || Number.isNaN(hour) ? { year, month, day } : { year, month, day, hour, minute };
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
/** '2026년 12월 5일 (토) 오후 7:00' / '2026년 12월 5일 (토) · 시간 미정'. 일시가 없으면 null */
export function scheduleText(value?: string): string | null {
  const s = parseSchedule(value);
  if (!s) return null;
  const weekday = WEEKDAYS[new Date(Date.UTC(s.year, s.month - 1, s.day)).getUTCDay()];
  const date = `${s.year}년 ${s.month}월 ${s.day}일 (${weekday})`;
  if (s.hour === undefined) return `${date} · 시간 미정`;
  const half = s.hour < 12 ? '오전' : '오후';
  const hour12 = s.hour % 12 === 0 ? 12 : s.hour % 12;
  return `${date} ${half} ${hour12}:${String(s.minute ?? 0).padStart(2, '0')}`;
}

// ── 지도 링크 ──────────────────────────────────────────────────

/** 카카오맵 길찾기(도착지 지정) 링크: /link/to/이름,위도,경도 */
export function kakaoRouteLink(place: Location): string {
  return `https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.lat},${place.lng}`;
}

/** 카카오맵 장소 링크(검색 결과에 있을 때) 또는 지도 표시 링크 */
export function kakaoMapLink(place: Location): string {
  return place.url ?? `https://map.kakao.com/link/map/${encodeURIComponent(place.name)},${place.lat},${place.lng}`;
}

// ── 공유 글 ───────────────────────────────────────────────────

/** 단톡방에 붙여 넣기 좋은 요약 글. 출발지 주소는 개인정보라 넣지 않는다. */
export function buildShareText(meeting: MeetingDraft): string {
  const place = meeting.selectedPlace;
  if (!place) return '';
  const lines: string[] = [`[MeetPoint] ${meeting.title || '약속'}`, ''];
  const when = scheduleText(meeting.scheduledAt);
  if (when) lines.push(`일시: ${when}`);
  lines.push(`장소: ${place.name}`, `주소: ${place.address}`);
  if (place.phone) lines.push(`전화: ${place.phone}`);
  lines.push(`지도: ${kakaoMapLink(place)}`, `길찾기: ${kakaoRouteLink(place)}`);

  const routes = meeting.placeRoutes?.routes ?? [];
  const times = meeting.participants.map((person) => {
    const route = routes.find((item) => item.participantId === person.id);
    const time = route?.status === 'ok' ? minutesText(route.durationMinutes) : '확인 못함';
    return `- ${person.name}(${TRANSPORT_LABEL[person.transport]}) ${time}`;
  });
  if (times.length) {
    lines.push('', '예상 이동시간', ...times);
    const metrics = meeting.placeRoutes?.metrics;
    if (metrics) lines.push(`가장 오래 걸리는 사람 ${minutesText(metrics.maxMinutes)} · 차이 ${minutesText(metrics.gapMinutes)}`);
    lines.push('(조회 시점 기준 예상 시간이라 실제와 다를 수 있어요)');
  }
  return lines.join('\n');
}

// ── 캘린더 파일(.ics) ──────────────────────────────────────────

const escapeIcs = (text: string) => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** 한 줄이 75바이트를 넘지 않게 접는다 (RFC 5545). 한글은 3바이트라 글자 단위로 센다. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of Array.from(line)) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // 이어지는 줄은 맨 앞 공백 1바이트
    if (bytes + size > limit) { parts.push(current); current = ''; bytes = 0; }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const pad = (value: number) => String(value).padStart(2, '0');
const utcStamp = (date: Date) =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

/**
 * 약속 일정 파일. 시간이 있으면 Asia/Seoul 기준 2시간 일정, 날짜만 있으면 하루 종일 일정.
 * 날짜가 없으면 null.
 */
export function buildIcs(meeting: MeetingDraft, now: Date, durationMinutes = 120): string | null {
  const schedule = parseSchedule(meeting.scheduledAt);
  const place = meeting.selectedPlace;
  if (!schedule || !place) return null;
  const date = `${schedule.year}${pad(schedule.month)}${pad(schedule.day)}`;
  let timing: string[];
  if (schedule.hour === undefined) {
    const next = new Date(Date.UTC(schedule.year, schedule.month - 1, schedule.day + 1));
    timing = [`DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(next.getUTCDate())}`];
  } else {
    // 한국 시간(UTC+9, 서머타임 없음)으로 해석해 UTC로 저장
    const start = new Date(Date.UTC(schedule.year, schedule.month - 1, schedule.day, schedule.hour - 9, schedule.minute ?? 0));
    timing = [`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(new Date(start.getTime() + durationMinutes * 60000))}`];
  }
  const description = buildShareText(meeting);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MeetPoint//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${meeting.id}@meetpoint`,
    `DTSTAMP:${utcStamp(now)}`,
    ...timing,
    `SUMMARY:${escapeIcs(meeting.title || '약속')}`,
    `LOCATION:${escapeIcs(`${place.name}, ${place.address}`)}`,
    `GEO:${place.lat};${place.lng}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `URL:${kakaoMapLink(place)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

/** 일정 파일 이름: 모임 이름에서 파일명에 못 쓰는 문자를 뺀다. */
export function icsFileName(meeting: MeetingDraft): string {
  const safe = (meeting.title || '약속').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 30) || '약속';
  return `${safe}.ics`;
}
