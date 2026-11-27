'use client';

import { useEffect, useState } from 'react';
import { IconMoon, IconSun } from '@/app/components/Icons';
import { haptic } from '@/lib/platform/haptics';

const THEME_KEY = 'meetpoint.theme';
export type ThemeMode = 'light' | 'dark';

export function resolveCurrentTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const attr = document.documentElement.dataset.theme;
  if (attr === 'dark' || attr === 'light') return attr;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: ThemeMode, persist = true): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0b1120' : '#f4f6fa');
  }
  if (persist) {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }
  window.dispatchEvent(new CustomEvent('meetpoint:theme-change', { detail: theme }));
}

export function initSavedTheme(): void {
  if (typeof window === 'undefined') return;
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') {
      applyTheme(saved, false);
      return;
    }
  } catch {
    // ignore
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? 'dark' : 'light', false);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(resolveCurrentTheme());
    setMounted(true);
    const onChange = () => setTheme(resolveCurrentTheme());
    window.addEventListener('meetpoint:theme-change', onChange);
    return () => window.removeEventListener('meetpoint:theme-change', onChange);
  }, []);

  function toggle() {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    haptic('light');
    applyTheme(next, true);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted && theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
      title={mounted && theme === 'dark' ? '라이트 모드' : '다크 모드'}
      style={{
        width: 36,
        height: 36,
        borderRadius: 11,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        color: 'var(--text-sub)',
      }}
    >
      {mounted && theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
    </button>
  );
}
