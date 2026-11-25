'use client';
/**
 * 참가자 표시용 공통 조각: 색상 아바타, 이동수단 아이콘·칩, 색상·이동수단 목록.
 * 디자인은 기존 메인 화면(globals.css 의 avatar-initial-circle, transport-chip)을 그대로 쓴다.
 */
import { IconCar, IconTransit, IconWalk } from '@/app/components/Icons';
import type { Transport } from '@/lib/meetpoint/types';

/** 참가자 아바타 색 6가지 (배경·테두리·글자색) */
export const COLOR_THEMES = [
  { id: 'blue', label: '블루', bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb' },
  { id: 'emerald', label: '에메랄드', bg: '#ecfdf5', border: '#a7f3d0', text: '#059669' },
  { id: 'purple', label: '퍼플', bg: '#f5f3ff', border: '#ddd6fe', text: '#7c3aed' },
  { id: 'rose', label: '로즈', bg: '#fff1f2', border: '#fecdd3', text: '#e11d48' },
  { id: 'amber', label: '앰버', bg: '#fffbeb', border: '#fde68a', text: '#d97706' },
  { id: 'indigo', label: '인디고', bg: '#eef2ff', border: '#c7d2fe', text: '#4f46e5' },
] as const;

/** 새 참가자에게 아직 안 쓴 색을 순서대로 준다. */
export function nextColor(used: (string | undefined)[]): string {
  return COLOR_THEMES.find((theme) => !used.includes(theme.id))?.id ?? COLOR_THEMES[used.length % COLOR_THEMES.length].id;
}

/** 이동수단 선택지와 화면 문구 */
export const TRANSPORT_OPTIONS: { value: Transport; label: string; hint: string }[] = [
  { value: 'transit', label: '대중교통', hint: '지하철·버스' },
  { value: 'car', label: '자동차', hint: '자가용·택시' },
  { value: 'walk', label: '도보', hint: '걸어서' },
];

/** 이동수단 아이콘 */
export function TransportIcon({ transport, size = 13 }: { transport: Transport; size?: number }) {
  if (transport === 'walk') return <IconWalk size={size} />;
  if (transport === 'car') return <IconCar size={size} />;
  return <IconTransit size={size} />;
}

/** 이름 첫 글자를 담은 원형 아바타. color 가 없으면 첫 번째 색(블루) */
export function AvatarInitial({ name, color, size }: { name: string; color?: string; size?: number }) {
  const theme = COLOR_THEMES.find((item) => item.id === color) ?? COLOR_THEMES[0];
  return (
    <div className="avatar-initial-circle" aria-hidden="true"
      style={{ backgroundColor: theme.bg, color: theme.text, border: `1.5px solid ${theme.border}`,
        ...(size ? { width: size, height: size, minWidth: size } : {}) }}>
      <span>{name.trim().charAt(0) || '참'}</span>
    </div>
  );
}

/** 아이콘 + 이동수단 이름 칩 (참가자 카드에 사용) */
export function TransportBadge({ transport }: { transport: Transport }) {
  const option = TRANSPORT_OPTIONS.find((item) => item.value === transport)!;
  return (
    <span className="transport-chip">
      <TransportIcon transport={transport} />
      <span>{option.label}</span>
    </span>
  );
}
