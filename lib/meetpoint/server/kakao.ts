import { MeetPointError } from '../errors';
import type { Coordinates, Location, Participant, Place, PlaceCategory, PlacePage, RouteSuccess } from '../types';

type Fetcher = typeof fetch;
type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const string = (value: unknown): string => typeof value === 'string' ? value : '';
const number = (value: unknown): number => typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;

function invalidResponse(): never {
  throw new MeetPointError('UPSTREAM_ERROR', '지도 서비스 응답을 확인할 수 없어요. 다시 시도해 주세요.', 502, true);
}

function nonnegative(value: unknown): number {
  const parsed = number(value);
  if (!Number.isFinite(parsed) || parsed < 0) invalidResponse();
  return parsed;
}

function safeUrl(value: unknown): string | undefined {
  try {
    const url = new URL(string(value));
    if ((url.protocol === 'https:' || url.protocol === 'http:') && ['map.kakao.com', 'place.map.kakao.com'].includes(url.hostname)) {
      url.protocol = 'https:';
      return url.toString();
    }
  } catch { /* Optional link is omitted if the provider did not return a safe URL. */ }
  return undefined;
}

function parseLocation(value: unknown, addressResult = false): Location | null {
  const item = object(value);
  const lat = number(item.y);
  const lng = number(item.x);
  const name = string(addressResult ? item.address_name : item.place_name);
  const address = string(item.road_address_name) || string(item.address_name);
  if (!name || !address || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    id: addressResult ? `address:${lng}:${lat}` : `kakao:${string(item.id)}`,
    name, address, lat, lng,
    category: string(item.category_name),
    url: safeUrl(item.place_url),
  };
}

export type KakaoOptions = { key: string; mobilityKey?: string; fetcher?: Fetcher; timeoutMs?: number };

export class KakaoProvider {
  private readonly options: KakaoOptions;
  constructor(options: KakaoOptions) { this.options = options; }

  private async request(path: string, params: Record<string, string>, signal?: AbortSignal, mobility = false): Promise<JsonObject> {
    const key = (mobility ? this.options.mobilityKey || this.options.key : this.options.key).trim();
    if (!key) throw new MeetPointError('NOT_CONFIGURED', '지도 서비스 연결 준비 중이에요. 설정 안내를 확인해 주세요.', 503);
    const deadline = AbortSignal.timeout(this.options.timeoutMs ?? 10000);
    const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
    try {
      const url = new URL(path, mobility ? 'https://apis-navi.kakaomobility.com' : 'https://dapi.kakao.com');
      url.search = new URLSearchParams(params).toString();
      const response = await (this.options.fetcher ?? fetch)(url, {
        headers: { Authorization: `KakaoAK ${key}` },
        cache: 'no-store',
        signal: requestSignal,
      });
      if (response.status === 401 || response.status === 403) {
        throw new MeetPointError('PROVIDER_AUTH', '지도 서비스 사용 권한을 확인해야 해요. API 활성화와 키 설정을 확인해 주세요.', 503);
      }
      if (response.status === 429) throw new MeetPointError('QUOTA_EXCEEDED', '지도 서비스의 호출 한도에 도달했어요. 잠시 후 또는 한도 갱신 후 시도해 주세요.', 429, true);
      if (!response.ok) throw new MeetPointError('UPSTREAM_ERROR', '지도 서비스가 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.', 502, true);
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || Array.isArray(data)) invalidResponse();
      return object(data);
    } catch (error) {
      if (error instanceof MeetPointError) throw error;
      if (requestSignal.aborted) throw new MeetPointError('TIMEOUT', '조회 시간이 길어졌거나 요청이 취소되었어요. 다시 시도해 주세요.', 504, true);
      throw new MeetPointError('UPSTREAM_ERROR', '지도 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.', 502, true);
    }
  }

  private documents(data: JsonObject): unknown[] {
    if (!Array.isArray(data.documents)) invalidResponse();
    return data.documents;
  }

  async searchLocations(query: string, signal?: AbortSignal): Promise<{ locations: Location[]; notices: string[] }> {
    const responses = await Promise.allSettled([
      this.request('/v2/local/search/keyword.json', { query, size: '10' }, signal),
      this.request('/v2/local/search/address.json', { query, size: '10' }, signal),
    ]);
    const locations: Location[] = [];
    const notices: string[] = [];
    let firstError: unknown;
    responses.forEach((response, index) => {
      if (response.status === 'rejected') { firstError ??= response.reason; notices.push(index ? '주소 검색을 완료하지 못했어요.' : '장소명 검색을 완료하지 못했어요.'); return; }
      for (const item of this.documents(response.value)) {
        const parsed = parseLocation(item, index === 1);
        if (parsed && !locations.some((previous) => previous.id === parsed.id || (previous.name === parsed.name && previous.lat === parsed.lat && previous.lng === parsed.lng))) locations.push(parsed);
      }
    });
    if (!locations.length && firstError) throw firstError;
    return { locations: locations.slice(0, 20), notices };
  }

  async nearbyHubs(center: Coordinates, kind: 'subway' | 'rail' | 'terminal', signal?: AbortSignal): Promise<Location[]> {
    const params: Record<string, string> = { x: String(center.lng), y: String(center.lat), radius: '20000', sort: 'distance', size: '15' };
    if (kind === 'subway') params.category_group_code = 'SW8';
    else params.query = kind === 'rail' ? '기차역' : '버스터미널';
    const data = await this.request(kind === 'subway' ? '/v2/local/search/category.json' : '/v2/local/search/keyword.json', params, signal);
    return this.documents(data).map((item) => parseLocation(item)).filter((item): item is Location => item !== null);
  }

  async nearbyPlaces(center: Coordinates, category: PlaceCategory, radius: number, query: string, page: number, signal?: AbortSignal): Promise<PlacePage> {
    const params: Record<string, string> = {
      x: String(center.lng), y: String(center.lat), radius: String(radius), sort: 'distance', size: '15', page: String(page),
      category_group_code: category === 'restaurant' ? 'FD6' : 'CE7',
    };
    if (query) params.query = query;
    const data = await this.request(query ? '/v2/local/search/keyword.json' : '/v2/local/search/category.json', params, signal);
    const places = this.documents(data).flatMap((raw): Place[] => {
      const parsed = parseLocation(raw);
      if (!parsed) return [];
      const item = object(raw);
      const distance = number(item.distance);
      return [{ ...parsed, category: string(item.category_name), phone: string(item.phone) || undefined,
        distanceMeters: Number.isFinite(distance) && distance >= 0 ? distance : undefined }];
    });
    const meta = object(data.meta);
    if (typeof meta.is_end !== 'boolean') invalidResponse();
    return { places, page, hasNext: !meta.is_end && page < 45 };
  }

  async route(person: Participant, destination: Location, signal?: AbortSignal): Promise<RouteSuccess> {
    const base = { participantId: person.id, destinationId: destination.id, transport: person.transport,
      timeBasis: 'query-time' as const, fetchedAt: new Date().toISOString() };
    // Zero is valid only for exactly identical coordinates, never for a failed route.
    if (person.origin.lat === destination.lat && person.origin.lng === destination.lng) {
      return { ...base, status: 'ok', durationMinutes: 0, distanceMeters: 0, provider: 'same-location' };
    }
    if (person.transport === 'car') {
      const data = await this.request('/v1/directions', {
        origin: `${person.origin.lng},${person.origin.lat}`, destination: `${destination.lng},${destination.lat}`,
        priority: 'TIME', summary: 'true', alternatives: 'false',
      }, signal, true);
      const routes = array(data.routes).map(object);
      if (!routes.length) invalidResponse();
      const route = routes.find((item) => item.result_code === 0);
      if (!route) throw new MeetPointError('NO_ROUTE', '이 구간의 자동차 경로를 찾지 못했어요.', 422);
      const summary = object(route.summary);
      return { ...base, status: 'ok', provider: 'kakao-mobility',
        durationMinutes: nonnegative(summary.duration) / 60, distanceMeters: nonnegative(summary.distance) };
    }
    const data = await this.request(`/v2/routing/${person.transport === 'transit' ? 'publictraffic' : 'walk'}`, {
      start_x: String(person.origin.lng), start_y: String(person.origin.lat),
      end_x: String(destination.lng), end_y: String(destination.lat), input_coord: 'WGS84', output_coord: 'WGS84',
      ...(person.transport === 'walk' ? { route_mode: 'SHORTEST' } : {}),
    }, signal);
    if (typeof data.status !== 'string') invalidResponse();
    if (data.status !== 'OK') throw new MeetPointError('NO_ROUTE', person.transport === 'transit'
      ? '이 구간의 대중교통 경로를 찾지 못했어요. 출발 위치나 이동 수단을 바꿔 주세요.'
      : '이 구간의 도보 경로를 찾지 못했어요. 이동 거리나 출발 위치를 확인해 주세요.', 422);
    if (person.transport === 'walk') {
      const properties = object(object(data.route).properties);
      return { ...base, status: 'ok', provider: 'kakao-map', durationMinutes: nonnegative(properties.totalTime) / 60,
        distanceMeters: nonnegative(properties.totalDistance), url: safeUrl(properties.landingUrl) };
    }
    // Compare complete routes, including the walking sections returned by the provider.
    const choices = array(data.routes).map((item) => object(object(item).properties)).map((item) => ({
      durationMinutes: nonnegative(item.totalTime) / 60, distanceMeters: nonnegative(item.totalDistance),
    })).sort((a, b) => a.durationMinutes - b.durationMinutes || a.distanceMeters - b.distanceMeters);
    if (!choices.length) invalidResponse();
    return { ...base, ...choices[0], status: 'ok', provider: 'kakao-map', url: safeUrl(object(data.properties).landingURL) };
  }
}

export function configuredProvider(): KakaoProvider {
  return new KakaoProvider({ key: process.env.KAKAO_REST_API_KEY ?? '', mobilityKey: process.env.KAKAO_MOBILITY_REST_API_KEY });
}
