'use client';
/**
 * 2단계-1. 참가자 추가·수정 (`/meetings/[id]/participants/new` 또는 `/participants/[참가자 id]`)
 *
 * - 이름: 필수, 최대 12자, 같은 약속 안에서 중복 불가
 * - 색상: 아바타 색. 새 참가자에게는 아직 안 쓴 색을 먼저 준다.
 * - 출발지: 검색 결과에서 골라야 한다(좌표가 있어야 경로를 조회할 수 있으므로).
 * - 이동 수단: 대중교통·자동차·도보
 * 이미 추천을 받은 상태에서 출발지·이동 수단을 바꾸면 저장 전에 '추천이 지워진다'고 알려준다.
 */
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IconCheck } from '@/app/components/Icons';
import FlowLayout, { FlowLoading, flowStyles } from '@/components/flow/FlowLayout';
import LocationSearch from '@/components/meeting/LocationSearch';
import { COLOR_THEMES, TRANSPORT_OPTIONS, TransportIcon, nextColor } from '@/components/meeting/ParticipantBits';
import styles from '@/components/meeting/meeting.module.css';
import { MAX_PARTICIPANTS, TOTAL_STEPS, meetingPath, stepNumber } from '@/features/meeting/model';
import { meetingActions } from '@/features/meeting/store';
import { useMeetingStep } from '@/features/meeting/useMeetingStep';
import { createId } from '@/lib/platform/id';
import type { Location, Transport } from '@/lib/meetpoint/types';

const NAME_MAX = 12;

export default function ParticipantEditPage({ params }: { params: { id: string; pid: string } }) {
  const router = useRouter();
  const { meeting } = useMeetingStep(params.id, 'participants');
  const isNew = params.pid === 'new';
  const existing = meeting?.participants.find((person) => person.id === decodeURIComponent(params.pid));
  const listHref = meetingPath(params.id, 'participants');

  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(COLOR_THEMES[0].id);
  const [origin, setOrigin] = useState<Location>();
  const [transport, setTransport] = useState<Transport>('transit');
  const [touched, setTouched] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 처음 한 번만 입력칸을 채운다: 수정이면 저장된 값, 추가면 기본값(첫 참가자 이름은 '나')
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

  // 없는 참가자 주소이거나 인원이 꽉 찼으면 목록으로 돌려보낸다.
  const invalid = !!meeting && ((!isNew && !existing) || (isNew && meeting.participants.length >= MAX_PARTICIPANTS));
  useEffect(() => { if (invalid) router.replace(listHref); }, [invalid, router, listHref]);

  if (!meeting || invalid || !loaded) return <FlowLoading title={isNew ? '참가자 추가' : '참가자 수정'} />;

  // 입력 검증
  const trimmed = name.trim();
  const nameError = !trimmed ? '이름을 입력해 주세요.'
    : meeting.participants.some((person) => person.id !== existing?.id && person.name === trimmed) ? '같은 이름의 참가자가 있어요.' : null;
  const originError = !origin ? '출발지를 검색해서 골라 주세요.' : null;
  // 경로에 영향을 주는 값이 바뀌었는지 (이름·색상만 바꾸면 추천 결과는 유지된다)
  const routeChanged = !!existing && !!meeting.recommendation && !!origin &&
    (existing.origin.id !== origin.id || existing.transport !== transport);

  /** 검증 → 저장(새 참가자면 id 발급) → 참가자 목록으로 */
  function save(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (nameError || originError || !origin) return;
    meetingActions.upsertParticipant(params.id, { id: existing?.id ?? createId('p_'), name: trimmed, color, origin, transport });
    router.push(listHref);
  }

  return (
    <FlowLayout title={isNew ? '참가자 추가' : '참가자 수정'} backHref={listHref} backLabel="참가자 목록으로"
      step={{ current: stepNumber('participants'), total: TOTAL_STEPS }}
      bottom={<button type="submit" form="participant-form" className={flowStyles.primary}>{isNew ? '추가하기' : '저장하기'}</button>}>
      <form id="participant-form" onSubmit={save} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="participant-name">이름</label>
          <input id="participant-name" className="form-input" value={name} maxLength={NAME_MAX} autoFocus={isNew}
            placeholder="예: 지민, 준호, 서연" aria-invalid={touched && !!nameError}
            onChange={(event) => setName(event.target.value)} />
          {touched && nameError && <p className={styles.error}>{nameError}</p>}
        </div>

        <div className={styles.field}>
          <span className={styles.label}>색상</span>
          <div className={styles.colors} role="group" aria-label="프로필 색상">
            {COLOR_THEMES.map((theme) => (
              <button key={theme.id} type="button" className={styles.colorChip} aria-pressed={color === theme.id}
                aria-label={`${theme.label} 색상`} onClick={() => setColor(theme.id)}
                style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}>
                {color === theme.id ? <IconCheck size={16} color={theme.text} /> : <span className={styles.colorDot} style={{ backgroundColor: theme.text }} />}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="participant-origin">출발지</label>
          <LocationSearch id="participant-origin" value={origin} invalid={touched && !!originError} onChange={setOrigin} />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>이동 수단</span>
          <div className={styles.segment} role="group" aria-label="이동 수단">
            {TRANSPORT_OPTIONS.map((option) => (
              <button key={option.value} type="button" className={styles.segmentOption}
                aria-pressed={transport === option.value} onClick={() => setTransport(option.value)}>
                <TransportIcon transport={option.value} size={20} />
                {option.label}
                <small>{option.hint}</small>
              </button>
            ))}
          </div>
        </div>

        {routeChanged && <p className={flowStyles.notice}>출발지나 이동 수단이 바뀌어서, 저장하면 기존 추천 결과는 지워지고 다시 추천을 받아야 해요.</p>}
      </form>
    </FlowLayout>
  );
}
