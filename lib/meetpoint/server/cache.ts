// 카카오 호출 결과 캐시 (서버 메모리). 같은 조회를 반복할 때 무료 호출 한도를 아낀다.
// - 성공 결과만 저장한다. 실패(경로 없음·시간 초과·한도 초과 등)는 저장하지 않는다.
// - 서버 프로세스마다 따로 있다. 서버를 재시작하거나 인스턴스가 여러 개면 공유되지 않는다.
// - 이동시간은 교통 상황에 따라 바뀌므로 짧게(10분), 역·장소 검색은 길게(30분) 둔다.
import type { Coordinates, HubKind, Location, Participant, PlaceCategory, PlacePage, RouteSuccess } from '../types';
import type { KakaoProvider } from './kakao';

export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expiresAt: number }>();
  hits = 0;
  misses = 0;
  constructor(private readonly ttlMs: number, private readonly maxEntries: number, private readonly now: () => number = Date.now) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= this.now()) {
      if (entry) this.entries.delete(key);
      this.misses++;
      return undefined;
    }
    // 최근 사용 순서 유지 (가장 오래 안 쓴 것부터 지우기 위해)
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  get size() { return this.entries.size; }
  clear() { this.entries.clear(); this.hits = 0; this.misses = 0; }
}

/** 좌표는 소수점 5자리(약 1m)로 맞춰 키를 만든다. */
const point = (value: Coordinates) => `${value.lat.toFixed(5)},${value.lng.toFixed(5)}`;

export type MapProvider = Pick<KakaoProvider, 'searchLocations' | 'nearbyHubs' | 'nearbyPlaces' | 'route'>;

export type ProviderCaches = {
  routes: TtlCache<RouteSuccess>;
  hubs: TtlCache<Location[]>;
  places: TtlCache<PlacePage>;
  searches: TtlCache<{ locations: Location[]; notices: string[] }>;
};

export function createProviderCaches(now: () => number = Date.now): ProviderCaches {
  return {
    routes: new TtlCache(10 * 60_000, 5000, now),
    hubs: new TtlCache(30 * 60_000, 1000, now),
    places: new TtlCache(30 * 60_000, 1000, now),
    searches: new TtlCache(30 * 60_000, 1000, now),
  };
}

/** 같은 모양의 제공자를 감싸 캐시를 붙인다. */
export function withCache(inner: MapProvider, caches: ProviderCaches): MapProvider {
  return {
    async searchLocations(query: string, signal?: AbortSignal) {
      const key = query.trim().toLowerCase();
      const cached = caches.searches.get(key);
      if (cached) return cached;
      const result = await inner.searchLocations(query, signal);
      // 일부 검색이 실패한 결과(notices 있음)는 저장하지 않는다.
      if (!result.notices.length) caches.searches.set(key, result);
      return result;
    },

    async nearbyHubs(center: Coordinates, kind: HubKind, radiusMeters = 20000, signal?: AbortSignal) {
      const key = `${point(center)}|${kind}|${Math.round(radiusMeters)}`;
      const cached = caches.hubs.get(key);
      if (cached) return cached;
      const result = await inner.nearbyHubs(center, kind, radiusMeters, signal);
      caches.hubs.set(key, result);
      return result;
    },

    async nearbyPlaces(center: Coordinates, category: PlaceCategory, radius: number, query: string, page: number, signal?: AbortSignal) {
      const key = `${point(center)}|${category}|${radius}|${query.trim().toLowerCase()}|${page}`;
      const cached = caches.places.get(key);
      if (cached) return cached;
      const result = await inner.nearbyPlaces(center, category, radius, query, page, signal);
      caches.places.set(key, result);
      return result;
    },

    async route(person: Participant, destination: Location, signal?: AbortSignal) {
      const key = `${person.transport}|${point(person.origin)}|${point(destination)}`;
      const cached = caches.routes.get(key);
      // 저장된 결과는 다른 참가자·후보 ID로 다시 쓰일 수 있으므로 ID만 바꿔서 돌려준다. 조회 시각(fetchedAt)은 원래 값을 유지한다.
      if (cached) return { ...cached, participantId: person.id, destinationId: destination.id };
      const result = await inner.route(person, destination, signal);
      caches.routes.set(key, result);
      return result;
    },
  };
}
