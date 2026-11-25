/**
 * GET /api/places?lat=&lng=&category=restaurant|cafe&radius=1000&query=&page=1
 * 지점 주변 음식점·카페 (카카오 장소 검색, 15개씩). 4단계 주변 장소 화면에서 사용.
 * radius 100~5000m, page 1~45. 응답: { data: { places: Place[], page, hasNext } }
 */
import { configuredProvider } from '@/lib/meetpoint/server/kakao';
import { handle } from '@/lib/meetpoint/server/http';
import { coordinatesFromQuery, integerParam, placeCategory, textValue } from '@/lib/meetpoint/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return handle(async () => {
    const params = new URL(request.url).searchParams;
    const center = coordinatesFromQuery(params);
    const category = placeCategory(params.get('category') ?? 'restaurant');
    const radius = integerParam(params.get('radius'), 1000, 100, 5000, '검색 반경');
    const page = integerParam(params.get('page'), 1, 1, 45, '페이지');
    const rawQuery = params.get('query');
    const query = rawQuery?.trim() ? textValue(rawQuery, '검색어', 80) : '';
    return configuredProvider().nearbyPlaces(center, category, radius, query, page, request.signal);
  });
}
