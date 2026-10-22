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
export type CandidateResult = {
  candidate: Location;
  routes: RouteResult[];
  metrics: Metrics | null;
};
export type RecommendationResult = {
  ranked: CandidateResult[];
  excluded: CandidateResult[];
  generatedAt: string;
  timeBasis: 'query-time';
  searchedCandidateCount: number;
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
