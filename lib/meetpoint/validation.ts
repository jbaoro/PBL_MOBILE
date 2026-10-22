import { MeetPointError } from './errors';
import type { Coordinates, Location, Participant, PlaceCategory, Transport } from './types';

export const MAX_PARTICIPANTS = 8;
export const MAX_CANDIDATES = 6;

function invalid(message: string): never {
  throw new MeetPointError('INVALID_INPUT', message);
}

export function record(value: unknown, label = '입력'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${label} 형식이 올바르지 않아요.`);
  return value as Record<string, unknown>;
}

export function textValue(value: unknown, label: string, max = 100): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    invalid(`${label}은(는) 1~${max}자로 입력해 주세요.`);
  }
  return value.trim();
}

export function coordinates(value: unknown): Coordinates {
  const point = record(value, '좌표');
  if (typeof point.lat !== 'number' || !Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90 ||
      typeof point.lng !== 'number' || !Number.isFinite(point.lng) || point.lng < -180 || point.lng > 180) {
    invalid('검색 결과에서 올바른 출발지 좌표를 선택해 주세요.');
  }
  return { lat: point.lat, lng: point.lng };
}

export function location(value: unknown): Location {
  const item = record(value, '장소');
  return {
    ...coordinates(item),
    id: textValue(item.id, '장소 ID', 160),
    name: textValue(item.name, '장소명'),
    address: textValue(item.address, '주소', 200),
  };
}

export function participants(value: unknown): Participant[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_PARTICIPANTS) {
    invalid(`참가자는 2~${MAX_PARTICIPANTS}명으로 입력해 주세요.`);
  }
  const result = value.map((raw): Participant => {
    const person = record(raw, '참가자');
    if (!['transit', 'car', 'walk'].includes(person.transport as string)) invalid('이동 수단을 선택해 주세요.');
    return {
      id: textValue(person.id, '참가자 ID', 80),
      name: textValue(person.name, '이름', 30),
      origin: location(person.origin),
      transport: person.transport as Transport,
    };
  });
  if (new Set(result.map((person) => person.id)).size !== result.length) invalid('참가자 ID가 중복되었어요.');
  return result;
}

export function integerParam(value: string | null, fallback: number, min: number, max: number, label: string): number {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) invalid(`${label}은(는) ${min}~${max} 사이 정수로 입력해 주세요.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) invalid(`${label} 범위를 확인해 주세요.`);
  return parsed;
}

export function coordinatesFromQuery(params: URLSearchParams): Coordinates {
  const lat = params.get('lat');
  const lng = params.get('lng');
  if (!lat?.trim() || !lng?.trim()) invalid('위도와 경도가 필요해요.');
  return coordinates({ lat: Number(lat), lng: Number(lng) });
}

export function placeCategory(value: unknown): PlaceCategory {
  if (value !== 'restaurant' && value !== 'cafe') invalid('음식점 또는 카페를 선택해 주세요.');
  return value;
}
