export type Transport = 'transit' | 'car' | 'walk';
export type Coordinates = { lat: number; lng: number };
export type Location = Coordinates & {
  id: string;
  name: string;
  address: string;
  category?: string;
  url?: string;
};
export type Participant = {
  id: string;
  name: string;
  origin: Location;
  transport: Transport;
};
export type ApiErrorCode =
  | 'INVALID_INPUT' | 'NOT_CONFIGURED' | 'PROVIDER_AUTH' | 'QUOTA_EXCEEDED'
  | 'TIMEOUT' | 'UPSTREAM_ERROR' | 'NO_ROUTE' | 'NO_CANDIDATES' | 'BUSY';
export type PublicError = { code: ApiErrorCode; message: string; retryable: boolean };
export type RouteSuccess = {
  status: 'ok';
  participantId: string;
  destinationId: string;
  transport: Transport;
  durationMinutes: number;
  distanceMeters: number;
  fetchedAt: string;
  timeBasis: 'query-time';
  provider: 'kakao-map' | 'kakao-mobility' | 'same-location';
  url?: string;
};
export type RouteFailure = {
  status: 'error';
  participantId: string;
  destinationId: string;
  error: PublicError;
};
export type RouteResult = RouteSuccess | RouteFailure;
export type Metrics = { maxMinutes: number; gapMinutes: number; averageMinutes: number };
/** 후보를 찾은 지역: 참가자 사이 / 참가자 출발지 주변 / 후보가 부족해 넓혀 찾은 지역 */
export type CandidateSource = 'between' | 'origin' | 'expanded';
export type CandidateResult = {
  candidate: Location;
  routes: RouteResult[];
  metrics: Metrics | null;
  source?: CandidateSource;
  /** 추천 순위의 근거 (ranked에만) */
  reasons?: string[];
  /** 비교에서 제외된 이유 (excluded에만) */
  exclusionReason?: string;
};
/** 참가자 출발지 사이의 최대 거리로 나눈 구분 */
export type DistanceTier = 'nearby' | 'regional' | 'long';
export type HubKind = 'subway' | 'rail' | 'terminal';
export type SearchArea = Coordinates & {
  label: string;
  radiusMeters: number;
  kinds: HubKind[];
  source: CandidateSource;
};
export type SearchScope = {
  tier: DistanceTier;
  tierLabel: string;
  maxSpreadKm: number;          // 가장 멀리 떨어진 두 참가자 사이의 직선거리
  areas: SearchArea[];          // 실제로 검색한 지역
  rounds: number;               // 1 = 기본 탐색, 2 = 추가 탐색까지 수행
  collectedCount: number;       // 검색으로 모은 후보 수(중복 제거 후)
  apiCalls: number;             // 이번 추천에 사용한 외부 API 호출 수
  limited: boolean;             // 호출 수·시간 제한 때문에 탐색을 줄였는지
};
export type RecommendationResult = {
  ranked: CandidateResult[];
  excluded: CandidateResult[];
  generatedAt: string;
  timeBasis: 'query-time';
  searchedCandidateCount: number;
  searchScope: SearchScope;
  notices: string[];
};
export type PlaceCategory = 'restaurant' | 'cafe';
export type Place = Location & {
  category: string;
  phone?: string;
  distanceMeters?: number;
};
export type PlacePage = { places: Place[]; page: number; hasNext: boolean };
export type ApiResponse<T> = { data: T } | { error: PublicError };
