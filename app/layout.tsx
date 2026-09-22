import './globals.css'; //branch 확인용
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MeetPoint',
  description: '약속 장소 추천 PWA 데모',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
