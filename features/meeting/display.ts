/**
 * 화면 표시용 계산: 균형도, 시간·거리 문구, 위치 그림 좌표 등.
 * 순수 함수만 둔다. 순위 계산(서버 ranking.ts)에는 쓰지 않는다.
 */
import type { Coordinates, Metrics, Participant, RouteResult } from '../../lib/meetpoint/types';
import type { MeetingParticipant } from './model';

/** API로 보낼 참가자: 화면 전용 필드(color)를 뺀다. */
export function participantsForApi(people: MeetingParticipant[]): Participant[] {
  return people.map(({ id, name, origin, transport }) => ({ id, name, origin, transport }));
}

/**
 * 균형도(0~100): 가장 빨리 오는 사람 시간 ÷ 가장 오래 걸리는 사람 시간.
 * 모두 비슷하게 걸리면 100에 가깝고, 한 사람만 오래 걸리면 낮아진다.
 * 모두 0분(같은 곳에서 출발)이면 100.
 */
export function balanceScore(metrics: Metrics): number {
  if (metrics.maxMinutes <= 0) return 100;
  const fastest = metrics.maxMinutes - metrics.gapMinutes;
  return Math.max(0, Math.min(100, Math.round((fastest / metrics.maxMinutes) * 100)));
}

/** 균형도 점수를 짧은 말로 */
export function balanceLabel(score: number): string {
  if (score >= 80) return '매우 고름';
  if (score >= 60) return '고른 편';
  if (score >= 40) return '조금 차이 남';
  return '차이가 큼';
}

/** 표시용 분: 1분 미만이지만 0이 아니면 '1분 미만', 그 외 반올림 */
export function minutesText(value: number): string {
  if (value <= 0) return '0분';
  if (value < 1) return '1분 미만';
  const rounded = Math.round(value);
  if (rounded < 60) return `${rounded}분`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`;
}

/** 성공한 경로의 분, 실패·없음이면 null */
export function successfulMinutes(route: RouteResult | undefined): number | null {
  return route && route.status === 'ok' ? route.durationMinutes : null;
}

/**
 * 좌표를 SVG 영역 안 점으로 바꾼다. (위도에 따른 경도 축소 반영, 가로·세로 비율 유지, 여백 포함)
 */
export function projectPoints(points: Coordinates[], width: number, height: number, padding = 28): { x: number; y: number }[] {
  if (!points.length) return [];
  const meanLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const scaleX = Math.cos((meanLat * Math.PI) / 180);
  const xs = points.map((point) => point.lng * scaleX);
  const ys = points.map((point) => point.lat);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  return points.map((_, index) => ({
    x: Math.round((offsetX + (xs[index] - minX) * scale) * 10) / 10,
    y: Math.round((height - offsetY - (ys[index] - minY) * scale) * 10) / 10, // 북쪽이 위
  }));
}

/** 조회 시각 표시: '오후 1:40' */
export function formatClock(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
}

/** 카카오 분류 '음식점 > 한식 > 냉면' → '한식 · 냉면' (앞의 큰 분류는 탭과 겹쳐서 뺀다) */
export function categoryText(category: string): string {
  const parts = category.split('>').map((part) => part.trim()).filter(Boolean);
  return (parts.length > 1 ? parts.slice(1) : parts).slice(-2).join(' · ');
}

/** 거리 표시: 1km 미만은 m, 이상은 km (2km, 1.5km). 값이 없으면 null */
export function distanceText(meters?: number): string | null {
  if (meters === undefined || !Number.isFinite(meters)) return null;
  return meters < 1000 ? `${Math.round(meters)}m` : `${Math.round(meters / 100) / 10}km`;
}

/** 지역(역) 기준 대비 실제 장소의 최대 이동시간 변화. 표시용. */
export function maxDeltaText(areaMax: number, placeMax: number): string {
  const delta = Math.round(placeMax - areaMax);
  if (delta === 0) return '지역 기준과 같아요';
  return delta > 0 ? `지역 기준보다 ${delta}분 더 걸려요` : `지역 기준보다 ${-delta}분 덜 걸려요`;
}
