/**
 * 실사용 편의용 기기 내 로컬 히스토리:
 * 1) 최근 검색해 선택한 실제 출발지(최대 6곳) — 반복 검색 없이 1탭 재사용
 * 2) 자주 만나는 멤버(최대 8명) — 다른 약속 만들 때 1탭 추가
 * 3) 약속별 찜한 주변 장소(북마크) — 후보 식당/카페 비교용
 *
 * 모든 항목은 사용자가 실제로 카카오 검색으로 고른 검증 좌표만 저장한다.
 */
import type { MeetingParticipant } from '@/features/meeting/model';
import type { Location, Transport } from '@/lib/meetpoint/types';

const ORIGINS_KEY = 'meetpoint.recentOrigins.v1';
const MEMBERS_KEY = 'meetpoint.recentMembers.v1';
const BOOKMARKS_PREFIX = 'meetpoint.bookmarks.v1.';

export type SavedMemberTemplate = {
  name: string;
  color?: string;
  origin: Location;
  transport: Transport;
};

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 공간 부족·사생활 보호 모드 무시
  }
}

function isValidLocation(v: unknown): v is Location {
  if (!v || typeof v !== 'object') return false;
  const loc = v as Record<string, unknown>;
  return (
    typeof loc.id === 'string' &&
    typeof loc.name === 'string' &&
    typeof loc.address === 'string' &&
    typeof loc.lat === 'number' &&
    Number.isFinite(loc.lat) &&
    typeof loc.lng === 'number' &&
    Number.isFinite(loc.lng)
  );
}

export function getRecentOrigins(): Location[] {
  const list = safeRead<unknown[]>(ORIGINS_KEY, []);
  if (!Array.isArray(list)) return [];
  return list.filter(isValidLocation).slice(0, 6);
}

export function saveRecentOrigin(location: Location): void {
  const prev = getRecentOrigins().filter((item) => item.id !== location.id);
  safeWrite(ORIGINS_KEY, [location, ...prev].slice(0, 6));
}

export function getRecentMembers(): SavedMemberTemplate[] {
  const list = safeRead<unknown[]>(MEMBERS_KEY, []);
  if (!Array.isArray(list)) return [];
  return list
    .filter((item): item is SavedMemberTemplate => {
      if (!item || typeof item !== 'object') return false;
      const m = item as Record<string, unknown>;
      return (
        typeof m.name === 'string' &&
        m.name.trim().length > 0 &&
        isValidLocation(m.origin) &&
        (m.transport === 'transit' || m.transport === 'car' || m.transport === 'walk')
      );
    })
    .slice(0, 8);
}

export function saveRecentMember(person: Pick<MeetingParticipant, 'name' | 'color' | 'origin' | 'transport'>): void {
  saveRecentOrigin(person.origin);
  const trimmed = person.name.trim();
  if (!trimmed) return;
  const entry: SavedMemberTemplate = {
    name: trimmed,
    color: person.color,
    origin: person.origin,
    transport: person.transport,
  };
  const prev = getRecentMembers().filter(
    (item) => !(item.name === trimmed && item.origin.id === person.origin.id)
  );
  safeWrite(MEMBERS_KEY, [entry, ...prev].slice(0, 8));
}

export function getBookmarkedPlaceIds(meetingId: string): string[] {
  const list = safeRead<unknown[]>(`${BOOKMARKS_PREFIX}${meetingId}`, []);
  return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
}

export function toggleBookmarkedPlace(meetingId: string, placeId: string): string[] {
  const current = getBookmarkedPlaceIds(meetingId);
  const exists = current.includes(placeId);
  const next = exists ? current.filter((id) => id !== placeId) : [placeId, ...current].slice(0, 20);
  safeWrite(`${BOOKMARKS_PREFIX}${meetingId}`, next);
  return next;
}
