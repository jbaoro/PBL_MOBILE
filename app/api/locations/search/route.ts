/**
 * GET /api/locations/search?query=강남역
 * 출발지 검색 (장소명 + 주소, 최대 20개). 2단계-1 참가자 추가·수정 화면에서 사용.
 * 응답: { data: { locations: Location[], notices: string[] } }
 */
import { configuredProvider } from '@/lib/meetpoint/server/kakao';
import { handle } from '@/lib/meetpoint/server/http';
import { textValue } from '@/lib/meetpoint/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return handle(async () => {
    const query = textValue(new URL(request.url).searchParams.get('query'), '검색어', 80);
    return configuredProvider().searchLocations(query, request.signal);
  });
}
