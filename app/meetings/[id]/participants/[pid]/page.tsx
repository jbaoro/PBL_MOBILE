'use client';
/**
 * 2단계-1. 참가자 추가·수정 직접 주소 (`/meetings/[id]/participants/new` 또는 `/participants/[pid]`)
 */
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IconCheck } from '@/app/components/Icons';
import FlowLayout, { FlowLoading, flowStyles } from '@/components/flow/FlowLayout';
import LocationSearch from '@/components/meeting/LocationSearch';
import {
  COLOR_THEMES,
  TRANSPORT_OPTIONS,
  TransportIcon,
  nextColor,
} from '@/components/meeting/ParticipantBits';
import styles from '@/components/meeting/meeting.module.css';
import { MAX_PARTICIPANTS, TOTAL_STEPS, meetingPath, stepNumber } from '@/features/meeting/model';
import { meetingActions } from '@/features/meeting/store';
import { useMeetingStep } from '@/features/meeting/useMeetingStep';
import { createId } from '@/lib/platform/id';
import { saveRecentMember } from '@/lib/platform/recents';
import type { Location, Transport } from '@/lib/meetpoint/types';

const NAME_MAX = 12;

export default function ParticipantEditPage({ params }: { params: { id: string; pid: string } }) {
  const router = useRouter();
  const { meeting } = useMeetingStep(params.id, 'participants');
  const isNew = params.pid === 'new';
  const existing = meeting?.participants.find(
    (person) => person.id === decodeURIComponent(params.pid)
  );
  const listHref = meetingPath(params.id, 'participants');

  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(COLOR_THEMES[0].id);
  const [origin, setOrigin] = useState<Location>();
  const [transport, setTransport] = useState<Transport>('transit');
  const [touched, setTouched] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!meeting || loaded) return;
    if (existing) {
      setName(existing.name);
      setColor(existing.color ?? COLOR_THEMES[0].id);
      setOrigin(existing.origin);
      setTransport(existing.transport);
    } else {
      setColor(nextColor(meeting.participants.map((person) => person.color)));
      setName(meeting.participants.length === 0 ? '나' : '');
    }
    setLoaded(true);
  }, [meeting, existing, loaded]);

  const invalid =
    Boolean(meeting) &&
    ((!isNew && !existing) || (isNew && meeting!.participants.length >= MAX_PARTICIPANTS));
  useEffect(() => {
    if (invalid) router.replace(listHref);
  }, [invalid, router, listHref]);

  if (!meeting || invalid || !loaded) {
    return <FlowLoading title={isNew ? '참가자 추가' : '참가자 수정'} />;
  }

  const trimmed = name.trim();
  const nameError = !trimmed
    ? '이름을 입력해 주세요.'
    : meeting.participants.some((person) => person.id !== existing?.id && person.name === trimmed)
      ? '같은 이름의 참가자가 있어요.'
      : null;
  const originError = !origin ? '출발지를 검색해서 골라 주세요.' : null;
  const routeChanged =
    Boolean(existing && meeting.recommendation && origin) &&
    (existing!.origin.id !== origin!.id || existing!.transport !== transport);

  function save(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (nameError || originError || !origin) return;
    const saved = {
      id: existing?.id ?? createId('p_'),
      name: trimmed,
      color,
      origin,
      transport,
    };
    meetingActions.upsertParticipant(params.id, saved);
    saveRecentMember(saved);
    router.push(listHref);
  }

  return (
    <FlowLayout
      title={isNew ? '참가자 추가' : '참가자 수정'}
      backHref={listHref}
      backLabel="참가자 목록으로"
      step={{ current: stepNumber('participants'), total: TOTAL_STEPS }}
      bottom={
        <button type="submit" form="participant-form" className={flowStyles.primary}>
          {isNew ? '추가하기' : '저장하기'}
        </button>
      }
    >
      <form id="participant-form" onSubmit={save} noValidate>
        <div className={styles.surfaceCard}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="participant-name">
              이름
            </label>
            <input
              id="participant-name"
              className="form-input"
              value={name}
              maxLength={NAME_MAX}
              autoFocus={isNew}
              placeholder="예: 지민, 준호, 서연"
              aria-invalid={touched && Boolean(nameError)}
              onChange={(event) => setName(event.target.value)}
            />
            {touched && nameError && <p className={styles.error}>{nameError}</p>}
          </div>

          <div className={styles.field}>
            <span className={styles.label}>프로필 색상</span>
            <div className={styles.colors} role="group" aria-label="프로필 색상">
              {COLOR_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  className={styles.colorChip}
                  aria-pressed={color === theme.id}
                  aria-label={`${theme.label} 색상`}
                  onClick={() => setColor(theme.id)}
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                >
                  {color === theme.id ? (
                    <IconCheck size={16} color={theme.text} />
                  ) : (
                    <span className={styles.colorDot} style={{ backgroundColor: theme.text }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="participant-origin">
              출발지
            </label>
            <LocationSearch
              id="participant-origin"
              value={origin}
              invalid={touched && Boolean(originError)}
              onChange={setOrigin}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>이동 수단</span>
            <div className={styles.segment} role="group" aria-label="이동 수단">
              {TRANSPORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={styles.segmentOption}
                  aria-pressed={transport === option.value}
                  onClick={() => setTransport(option.value)}
                >
                  <TransportIcon transport={option.value} size={20} />
                  <span>{option.label}</span>
                  <small>{option.hint}</small>
                </button>
              ))}
            </div>
          </div>
        </div>

        {routeChanged && (
          <p className={flowStyles.notice} style={{ marginTop: 12 }}>
            출발지나 이동 수단이 바뀌어서, 저장하면 기존 추천 결과는 지워지고 다시 추천을 받아야 해요.
          </p>
        )}
      </form>
    </FlowLayout>
  );
}
