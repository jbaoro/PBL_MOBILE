// MeetPoint API 클라이언트. 화면에서는 fetch를 직접 쓰지 않고 이 모듈만 사용한다.
// 웹에서는 같은 도메인의 /api를 부르고, 앱에서는 NEXT_PUBLIC_API_BASE_URL(배포 주소)을 부른다.
import type {
  ApiErrorCode, ApiResponse, CandidateResult, Coordinates, Location, Participant,
  PlaceCategory, PlacePage, RecommendationResult,
} from '@/lib/meetpoint/types';

const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');

export type ClientErrorCode = ApiErrorCode | 'NETWORK' | 'ABORTED';

export class ApiError extends Error {
  readonly code: ClientErrorCode;
  readonly retryable: boolean;
  constructor(code: ClientErrorCode, message: string, retryable: boolean) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.retryable = retryable;
  }
}

export const isAbort = (error: unknown) => error instanceof ApiError && error.code === 'ABORTED';

async function request<T>(path: string, options: { signal?: AbortSignal; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, options.body === undefined
      ? { signal: options.signal }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options.body), signal: options.signal });
  } catch {
    if (options.signal?.aborted) throw new ApiError('ABORTED', '요청이 취소되었어요.', false);
    throw new ApiError('NETWORK', '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.', true);
  }
  let payload: ApiResponse<T>;
  try {
    payload = await response.json() as ApiResponse<T>;
  } catch {
    if (options.signal?.aborted) throw new ApiError('ABORTED', '요청이 취소되었어요.', false);
    throw new ApiError('UPSTREAM_ERROR', '서버 응답을 읽지 못했어요. 다시 시도해 주세요.', true);
  }
  if ('error' in payload) throw new ApiError(payload.error.code, payload.error.message, payload.error.retryable);
  if (!response.ok) throw new ApiError('UPSTREAM_ERROR', '요청을 완료하지 못했어요. 다시 시도해 주세요.', true);
  return payload.data;
}

export type ServiceStatus = {
  configured: boolean; transports: string[]; timeBasis: 'query-time'; maxParticipants: number; maxCandidates: number;
};

export type NearbyPlacesQuery = Coordinates & {
  category: PlaceCategory; radius?: number; query?: string; page?: number;
};

export const meetpointApi = {
  status: (signal?: AbortSignal) => request<ServiceStatus>('/api/meetpoint/status', { signal }),

  searchLocations: (query: string, signal?: AbortSignal) =>
    request<{ locations: Location[]; notices: string[] }>(`/api/locations/search?query=${encodeURIComponent(query.trim())}`, { signal }),

  recommend: (participants: Participant[], signal?: AbortSignal) =>
    request<RecommendationResult>('/api/recommendations', { signal, body: { participants } }),

  nearbyPlaces: ({ lat, lng, category, radius, query, page }: NearbyPlacesQuery, signal?: AbortSignal) => {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng), category });
    if (radius) params.set('radius', String(radius));
    if (query?.trim()) params.set('query', query.trim());
    if (page) params.set('page', String(page));
    return request<PlacePage>(`/api/places?${params.toString()}`, { signal });
  },

  routesTo: (participants: Participant[], destination: Location, signal?: AbortSignal) =>
    request<CandidateResult>('/api/routes', { signal, body: { participants, destination } }),
};
