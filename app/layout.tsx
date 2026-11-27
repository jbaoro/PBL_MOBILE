/**
 * 모든 화면의 공통 HTML 틀.
 * - 외부 CDN 렌더 블로킹 @import 대신 next/font/google 자체 호스팅 폰트로 FCP/CLS 최적화
 * - PWA 설치 메타데이터 및 모바일 safe-area(viewportFit: 'cover') 지원
 */
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Noto_Sans_KR, Plus_Jakarta_Sans } from 'next/font/google';
import { AppShellEffects } from '@/components/ui/AppShellEffects';

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-kr',
  preload: true,
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-latin',
  preload: true,
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f4f6fa',
};

export const metadata: Metadata = {
  title: {
    default: 'MeetPoint — 공평한 약속 장소 찾기',
    template: '%s · MeetPoint',
  },
  description: '참가자들의 실제 이동시간을 비교해 모두에게 공평한 약속 장소를 찾아드려요.',
  applicationName: 'MeetPoint',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MeetPoint',
  },
  formatDetection: {
    telephone: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} ${plusJakarta.variable}`} suppressHydrationWarning>
      <body>
        <AppShellEffects />
        {children}
      </body>
    </html>
  );
}
