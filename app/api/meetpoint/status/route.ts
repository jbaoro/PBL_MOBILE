import { json } from '@/lib/meetpoint/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET() {
  return json({ configured: Boolean(process.env.KAKAO_REST_API_KEY?.trim()),
    transports: ['transit', 'car', 'walk'], timeBasis: 'query-time',
    maxParticipants: 8, maxCandidates: 6 });
}
