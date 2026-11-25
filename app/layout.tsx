import './globals.css';
import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#ffffff' };

export const metadata: Metadata = {
  title: 'MeetPoint',
  description: '참가자들의 실제 이동시간을 비교해 모두에게 공평한 약속 장소를 찾아드려요.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
