/**
 * GET /api/meetpoint/status
 * 서버에 카카오 키가 설정됐는지(값은 보내지 않음)와 지원 범위. /planner 개발 화면에서 사용.
 */
import { json } from '@/lib/meetpoint/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET() {
  return json({ configured: Boolean(process.env.KAKAO_REST_API_KEY?.trim()),
    transports: ['transit', 'car', 'walk'], timeBasis: 'query-time',
    maxParticipants: 8, maxCandidates: 6 });
}
