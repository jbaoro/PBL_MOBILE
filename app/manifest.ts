import type { MetadataRoute } from 'next';

/**
 * PWA Web App Manifest.
 * 모바일 홈 화면 추가(설치) 시 네이티브 앱처럼 독립 창(standalone)으로 열리도록 구성한다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MeetPoint — 모두에게 공평한 약속 장소',
    short_name: 'MeetPoint',
    description: '참가자들의 실제 이동시간을 비교해 모두에게 공평한 약속 장소를 찾아드려요.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4f6fa',
    theme_color: '#2563eb',
    lang: 'ko',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/icon.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: '/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
    ],
  };
}
