'use client';
/**
 * 참가자 표시용 공통 조각: 색상 아바타, 스택 아바타, 이동수단 아이콘·칩, 색상·이동수단 목록.
 */
import React from 'react';
import { IconCar, IconTransit, IconWalk } from '@/app/components/Icons';
import type { MeetingParticipant } from '@/features/meeting/model';
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

export function nextColor(used: (string | undefined)[]): string {
  return (
    COLOR_THEMES.find((theme) => !used.includes(theme.id))?.id ??
    COLOR_THEMES[used.length % COLOR_THEMES.length].id
  );
}

export const TRANSPORT_OPTIONS: { value: Transport; label: string; hint: string }[] = [
  { value: 'transit', label: '대중교통', hint: '지하철·버스' },
  { value: 'car', label: '자동차', hint: '자가용·택시' },
  { value: 'walk', label: '도보', hint: '걸어서' },
];

export function nextTransport(current: Transport): Transport {
  const order: Transport[] = ['transit', 'car', 'walk'];
  return order[(order.indexOf(current) + 1) % order.length];
}

export function TransportIcon({ transport, size = 13 }: { transport: Transport; size?: number }) {
  if (transport === 'walk') return <IconWalk size={size} />;
  if (transport === 'car') return <IconCar size={size} />;
  return <IconTransit size={size} />;
}

export const AvatarInitial = React.memo(function AvatarInitial({
  name,
  color,
  size,
}: {
  name: string;
  color?: string;
  size?: number;
}) {
  const theme = COLOR_THEMES.find((item) => item.id === color) ?? COLOR_THEMES[0];
  return (
    <div
      className="avatar-initial-circle"
      aria-hidden="true"
      style={{
        backgroundColor: theme.bg,
        color: theme.text,
        border: `1.5px solid ${theme.border}`,
        ...(size
          ? {
              width: size,
              height: size,
              minWidth: size,
              fontSize: Math.max(11, Math.round(size * 0.38)),
            }
          : {}),
      }}
    >
      <span>{name.trim().charAt(0) || '참'}</span>
    </div>
  );
});

/** 약속 카드에서 참가자 구성을 한눈에 보여주는 겹침 아바타 그룹 */
export const AvatarStack = React.memo(function AvatarStack({
  people,
  max = 5,
}: {
  people: Pick<MeetingParticipant, 'id' | 'name' | 'color'>[];
  max?: number;
}) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }} aria-hidden="true">
      {shown.map((person, index) => {
        const theme = COLOR_THEMES.find((item) => item.id === person.color) ?? COLOR_THEMES[0];
        return (
          <span
            key={person.id}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10.5,
              fontWeight: 800,
              backgroundColor: theme.bg,
              color: theme.text,
              border: `1.5px solid #ffffff`,
              boxShadow: `0 0 0 1px ${theme.border}`,
              marginLeft: index === 0 ? 0 : -7,
            }}
          >
            {person.name.trim().charAt(0) || '참'}
          </span>
        );
      })}
      {rest > 0 && (
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 800,
            backgroundColor: '#f1f5f9',
            color: '#475569',
            border: '1.5px solid #ffffff',
            marginLeft: -7,
          }}
        >
          +{rest}
        </span>
      )}
    </span>
  );
});

export function TransportBadge({ transport }: { transport: Transport }) {
  const option = TRANSPORT_OPTIONS.find((item) => item.value === transport)!;
  return (
    <span className="transport-chip">
      <TransportIcon transport={transport} />
      <span>{option.label}</span>
    </span>
  );
}
