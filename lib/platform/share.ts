/**
 * 복사·공유·파일 저장 어댑터. 화면에서는 브라우저 API(navigator.share 등)를 직접 쓰지 않고 이 파일을 쓴다.
 * 앱(React Native)으로 옮길 때는 expo-clipboard / Share / expo-sharing 구현으로 이 파일만 바꾼다.
 */

/** 클립보드 복사. 보안 연결(https·localhost)이 아니면 예전 방식(execCommand)으로 한 번 더 시도한다. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* 아래 방식으로 다시 시도 */ }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

/** shared: 공유 창으로 보냄 / copied: 공유 창이 없어 복사함 / cancelled: 사용자가 닫음 / failed: 둘 다 실패 */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** 기기의 공유 시트를 열고, 지원하지 않으면 클립보드에 복사한다. */
export async function shareText(text: string, title?: string): Promise<ShareOutcome> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed';
}

/**
 * 파일 내려받기(캘린더 .ics 등). 휴대폰에서는 공유 시트로 파일을 넘길 수 있으면 그쪽을 먼저 쓴다.
 * 앱에서는 expo-file-system + expo-sharing 구현으로 바꾼다.
 */
export async function saveFile(name: string, content: string, mimeType: string): Promise<'shared' | 'saved' | 'cancelled' | 'failed'> {
  try {
    const file = typeof File === 'function' ? new File([content], name, { type: mimeType }) : null;
    if (file && typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        return 'shared';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      }
    }
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'saved';
  } catch {
    return 'failed';
  }
}
