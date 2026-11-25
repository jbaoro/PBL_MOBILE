/**
 * POST /api/routes   body: { participants: Participant[], destination: Location }
 * 모든 참가자 → 한 장소까지 이동시간. 5단계 장소 확인 화면에서 사용. 사용자별 요청 제한을 거친다.
 * 응답: { data: CandidateResult }  (한 명이라도 실패하면 metrics 가 null → 확정 불가)
 */
import { configuredProvider } from '@/lib/meetpoint/server/kakao';
import { expensive, handle, readJson } from '@/lib/meetpoint/server/http';
import { evaluateDestinations } from '@/lib/meetpoint/server/service';
import { location, participants, record } from '@/lib/meetpoint/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request: Request) {
  return handle(async () => {
    const body = record(await readJson(request));
    const people = participants(body.participants);
    const destination = location(body.destination);
    return expensive(request, async (signal) => (await evaluateDestinations(configuredProvider(), people, [destination], signal))[0]);
  });
}
