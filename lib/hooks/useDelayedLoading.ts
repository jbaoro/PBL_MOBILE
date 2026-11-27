'use client';

import { useEffect, useState } from 'react';

/**
 * Toss UX 엔지니어링 패턴: 지연 스켈레톤 훅.
 * 캐시 히트나 180ms 미만 빠른 응답에서는 스켈레톤이 순간적으로 번쩍이지 않도록 억제한다.
 */
export function useDelayedLoading(loading: boolean, delayMs = 180): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!loading) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [loading, delayMs]);

  return visible;
}
