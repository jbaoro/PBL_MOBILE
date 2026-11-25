/**
 * 서버와 화면이 함께 쓰는 데이터 형식 (API 계약).
 * 좌표는 WGS84(lat 위도, lng 경도), 시간은 반올림하지 않은 분, 거리는 m.
 */
export type Transport = 'transit' | 'car' | 'walk';
export type Coordinates = { lat: number; lng: number };
export type Location = Coordinates & {
  id: string;
  name: string;
  address: string;
  category?: string;
  url?: string;
};
/** 참가자: 출발지(검색 결과에서 고른 장소)와 이동수단 */
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
/** 경로 조회 성공. timeBasis: 'query-time' = 조회한 시점 기준 예상 시간 (약속 시각 예측 아님) */
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
/** 참가자 한 명 → 목적지 한 곳 결과. 실패도 결과에 남겨 제외 사유를 보여줄 수 있게 한다. */
export type RouteResult = RouteSuccess | RouteFailure;
/** 공정성 지표 (ranking.ts 참고) */
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
/** 추천 결과: 순위 후보(ranked), 경로 실패가 있어 제외된 후보(excluded), 검색 범위, 안내 문구 */
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
/** 모든 API 응답 형식 */
export type ApiResponse<T> = { data: T } | { error: PublicError };
