/**
 * MeetPoint API 클라이언트. 화면에서는 fetch 를 직접 쓰지 않고 이 모듈만 사용한다.
 * 웹에서는 같은 도메인의 /api 를 부르고, 앱에서는 NEXT_PUBLIC_API_BASE_URL(배포 주소)을 부른다.
 *
 * 서버 응답은 항상 { data } 또는 { error: { code, message, retryable } } 형식이다.
 * 오류는 모두 ApiError 로 바꿔 던지므로, 화면은 error.message 를 그대로 보여주면 된다.
 */
import type {
  ApiErrorCode, ApiResponse, CandidateResult, Coordinates, Location, Participant,
  PlaceCategory, PlacePage, RecommendationResult,
} from '@/lib/meetpoint/types';

const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');

/** 서버 오류 코드 + 클라이언트에서만 생기는 오류(NETWORK: 연결 실패, ABORTED: 요청 취소) */
export type ClientErrorCode = ApiErrorCode | 'NETWORK' | 'ABORTED';

/** 화면에 보여줄 한국어 message 와, 다시 시도해 볼 만한지(retryable)를 담는다. */
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

/** 사용자가 화면을 떠나거나 새 요청을 보내서 취소된 요청인지. 취소는 오류로 보여주지 않는다. */
export const isAbort = (error: unknown) => error instanceof ApiError && error.code === 'ABORTED';

/** 공통 요청: body 가 있으면 POST(JSON), 없으면 GET */
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

/** /api/meetpoint/status 응답: 카카오 키 설정 여부와 지원 범위 */
export type ServiceStatus = {
  configured: boolean; transports: string[]; timeBasis: 'query-time'; maxParticipants: number; maxCandidates: number;
};

/** 주변 장소 검색 조건. radius 기본 1000m, page 기본 1 (서버 기본값) */
export type NearbyPlacesQuery = Coordinates & {
  category: PlaceCategory; radius?: number; query?: string; page?: number;
};

/** 서버 API 목록. 각 함수의 signal 로 요청을 취소할 수 있다. */
export const meetpointApi = {
  status: (signal?: AbortSignal) => request<ServiceStatus>('/api/meetpoint/status', { signal }),

  /** 출발지 검색 (장소명 + 주소, 최대 20개) */
  searchLocations: (query: string, signal?: AbortSignal) =>
    request<{ locations: Location[]; notices: string[] }>(`/api/locations/search?query=${encodeURIComponent(query.trim())}`, { signal }),

  /** 추천 지역 (후보 탐색 → 실제 경로 비교 → 순위). 최대 약 1분 걸릴 수 있다. */
  recommend: (participants: Participant[], signal?: AbortSignal) =>
    request<RecommendationResult>('/api/recommendations', { signal, body: { participants } }),

  /** 지점 주변 음식점·카페 */
  nearbyPlaces: ({ lat, lng, category, radius, query, page }: NearbyPlacesQuery, signal?: AbortSignal) => {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng), category });
    if (radius) params.set('radius', String(radius));
    if (query?.trim()) params.set('query', query.trim());
    if (page) params.set('page', String(page));
    return request<PlacePage>(`/api/places?${params.toString()}`, { signal });
  },

  /** 모든 참가자 → 한 장소까지 이동시간 (5단계 장소 확인) */
  routesTo: (participants: Participant[], destination: Location, signal?: AbortSignal) =>
    request<CandidateResult>('/api/routes', { signal, body: { participants, destination } }),
};
