/**
 * 모바일 촉각 피드백(Web Vibration API).
 * 지원하지 않는 기기(PC·iOS Safari)나 모션 축소 환경에서는 조용히 무시한다.
 */
export type HapticStyle = 'light' | 'medium' | 'success';

const PATTERNS: Record<HapticStyle, number | number[]> = {
  light: 8,
  medium: 14,
  success: [10, 35, 16],
};

export function haptic(style: HapticStyle = 'light'): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  try {
    navigator.vibrate(PATTERNS[style]);
  } catch {
    // 브라우저 정책에 의해 차단된 경우 무시
  }
}
