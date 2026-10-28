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
