/**
 * API 라우트 공통 도구: 응답 형식, 오류 처리, JSON 읽기, 무거운 조회(추천·경로)의 요청 제한.
 * 모든 응답은 { data } 또는 { error: { code, message, retryable } } 이고, 캐시하지 않는다(no-store).
 */
import { MeetPointError, publicError } from '../errors';

const responseHeaders = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' };
/** 성공 응답 { data } */
export function json(data: unknown): Response {
  return Response.json({ data }, { headers: responseHeaders });
}

/** 라우트 본문을 실행하고, 오류는 정해진 형식·HTTP 상태로 바꿔 응답한다. */
export async function handle(action: () => Promise<unknown>): Promise<Response> {
  try { return json(await action()); }
  catch (error) {
    return Response.json({ error: publicError(error) }, {
      status: error instanceof MeetPointError ? error.httpStatus : 500,
      headers: responseHeaders,
    });
  }
}

/** JSON 요청 본문 읽기. Content-Type 확인, 32KB 초과 거부, 잘못된 JSON 은 INVALID_INPUT */
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

// 무거운 조회(추천·경로)의 동시 실행·빈도 제한.
// 이전에는 서버 전체에 "동시 2건·분당 10건"이 걸려 있어 사용자 몇 명만 있어도 서로 막혔다.
// 이제 사용자(IP)별로 제한하고, 서버 전체에는 넉넉한 동시 실행 상한만 둔다.
// 메모리 기반이라 서버 인스턴스마다 따로 계산된다. (여러 인스턴스로 배포할 때는 공용 저장소로 옮겨야 함)
export const EXPENSIVE_LIMITS = { globalActive: 6, perClientActive: 1, perClientPerMinute: 6, timeoutMs: 55000 } as const;
let globalActive = 0;
const clients = new Map<string, { active: number; starts: number[] }>();

/** 요청한 사용자 구분 키: 프록시가 붙여 주는 IP, 없으면 'local'(개발 환경) */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'local';
}

/** 무거운 조회 실행: 제한을 넘으면 BUSY(429), 통과하면 55초 제한 시간 안에서 실행한다. */
export async function expensive<T>(request: Request, action: (signal: AbortSignal) => Promise<T>, now = Date.now()): Promise<T> {
  const key = clientKey(request);
  const client = clients.get(key) ?? { active: 0, starts: [] };
  client.starts = client.starts.filter((time) => now - time < 60000);
  if (client.active >= EXPENSIVE_LIMITS.perClientActive) {
    throw new MeetPointError('BUSY', '이전 조회가 아직 진행 중이에요. 끝난 뒤 다시 시도해 주세요.', 429, true);
  }
  if (client.starts.length >= EXPENSIVE_LIMITS.perClientPerMinute) {
    throw new MeetPointError('BUSY', '조회 요청이 너무 잦아요. 1분 정도 뒤에 다시 시도해 주세요.', 429, true);
  }
  if (globalActive >= EXPENSIVE_LIMITS.globalActive) {
    throw new MeetPointError('BUSY', '지금 조회하는 사람이 많아요. 잠시 후 다시 시도해 주세요.', 429, true);
  }
  globalActive++;
  client.active++;
  client.starts.push(now);
  clients.set(key, client);
  try { return await action(AbortSignal.any([request.signal, AbortSignal.timeout(EXPENSIVE_LIMITS.timeoutMs)])); }
  finally {
    globalActive--;
    client.active--;
    if (client.active === 0 && client.starts.length === 0) clients.delete(key);
    // 오래된 기록 정리 (메모리 누수 방지)
    if (clients.size > 5000) clients.forEach((value, id) => { if (value.active === 0) clients.delete(id); });
  }
}
