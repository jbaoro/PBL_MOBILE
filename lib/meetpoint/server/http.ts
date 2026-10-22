import { MeetPointError, publicError } from '../errors';

const responseHeaders = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' };
export function json(data: unknown): Response {
  return Response.json({ data }, { headers: responseHeaders });
}

export async function handle(action: () => Promise<unknown>): Promise<Response> {
  try { return json(await action()); }
  catch (error) {
    return Response.json({ error: publicError(error) }, {
      status: error instanceof MeetPointError ? error.httpStatus : 500,
      headers: responseHeaders,
    });
  }
}

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new MeetPointError('INVALID_INPUT', 'JSON 형식으로 요청해 주세요.', 415);
  }
  if (!request.body) throw new MeetPointError('INVALID_INPUT', '요청 내용이 비어 있어요.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) { await reader.cancel(); throw new MeetPointError('INVALID_INPUT', '요청 내용이 너무 커요.', 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch (error) {
    if (error instanceof MeetPointError) throw error;
    throw new MeetPointError('INVALID_INPUT', '요청 JSON을 읽을 수 없어요.');
  } finally { reader.releaseLock(); }
}

let active = 0;
let recentStarts: number[] = [];
export async function expensive<T>(request: Request, action: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const now = Date.now();
  recentStarts = recentStarts.filter((time) => now - time < 60000);
  if (active >= 2 || recentStarts.length >= 10) {
    throw new MeetPointError('BUSY', '다른 조회가 진행 중이거나 요청이 잦아요. 잠시 후 다시 시도해 주세요.', 429, true);
  }
  active++;
  recentStarts.push(now);
  try { return await action(AbortSignal.any([request.signal, AbortSignal.timeout(55000)])); }
  finally { active--; }
}
