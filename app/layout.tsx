/**
 * 모든 화면의 공통 HTML 틀. 전역 스타일과 메타데이터(제목·설명·휴대폰 화면 설정)를 정한다.
 */
import './globals.css';
import type { Metadata, Viewport } from 'next';

// viewportFit: 'cover' — 아이폰 홈 표시줄 영역까지 화면을 쓰고, 여백은 각 화면에서 safe-area로 맞춘다.
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
