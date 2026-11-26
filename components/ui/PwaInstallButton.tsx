'use client';

import { useEffect, useState } from 'react';
import { IconDownload } from '@/app/components/Icons';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA 설치 지원 브라우저에서 beforeinstallprompt를 감지해 '앱 설치' 버튼을 띄운다.
 * 이미 설치되었거나 미지원 환경에서는 렌더링하지 않아 화면을 어지럽히지 않는다.
 */
export function PwaInstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') setDeferred(null);
  }

  return (
    <button
      type="button"
      onClick={() => void install()}
      aria-label="홈 화면에 앱으로 설치"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 32,
        padding: '0 10px',
        borderRadius: 999,
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        color: '#2563eb',
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      <IconDownload size={13} color="#2563eb" />
      <span>앱 설치</span>
    </button>
  );
}
