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
