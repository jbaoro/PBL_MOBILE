/**
 * POST /api/recommendations   body: { participants: Participant[] }
 * 추천 지역: 후보 탐색 → 모든 참가자의 실제 경로 비교 → 순위 (lib/meetpoint/server/service.ts).
 * 3단계 추천 지역 화면에서 사용. 무거운 조회라 사용자별 요청 제한(expensive)을 거친다. 최대 60초.
 * 응답: { data: RecommendationResult }
 */
import { configuredProvider } from '@/lib/meetpoint/server/kakao';
import { expensive, handle, readJson } from '@/lib/meetpoint/server/http';
import { recommend } from '@/lib/meetpoint/server/service';
import { participants, record } from '@/lib/meetpoint/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request: Request) {
  return handle(async () => {
    const body = record(await readJson(request));
    const people = participants(body.participants);
    return expensive(request, (signal) => recommend(configuredProvider(), people, signal));
  });
}
