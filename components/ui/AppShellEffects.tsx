'use client';

import { useEffect, useState } from 'react';
import { IconWifiOff } from '@/app/components/Icons';
import { initSavedTheme } from '@/components/ui/ThemeToggle';

/**
 * 전역 실사용 런타임 보조:
 * - 저장된 라이트/다크 테마 즉시 적용
 * - Service Worker(/sw.js) 등록으로 오프라인 상태에서도 저장된 약속 열람 보장
 * - 오프라인 전환 시 상단에 비침습적 상태 배너 노출
 */
export function AppShellEffects() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    initSavedTheme();

    const syncOnline = () => setOffline(!navigator.onLine);
    syncOnline();
    window.addEventListener('online', syncOnline);
    window.addEventListener('offline', syncOnline);

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    return () => {
      window.removeEventListener('online', syncOnline);
      window.removeEventListener('offline', syncOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <IconWifiOff size={14} color="#ffffff" />
      <span>오프라인 상태예요 · 저장된 약속과 확정 장소는 그대로 확인할 수 있어요.</span>
    </div>
  );
}
