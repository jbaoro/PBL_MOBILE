/**
 * 약속·참가자 id 만들기 (예: 'm_3f9a1c2b7d4e'). 기기 안에서만 쓰므로 12자리면 충분하다.
 * crypto.randomUUID 가 없는 오래된 브라우저에서는 시간 + 난수로 만든다.
 */
export function createId(prefix = ''): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}${random}`;
}
