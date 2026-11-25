'use client';
// 2. 참가자 목록: 카드로 확인 · 추가 · 수정 · 삭제 → 2명 이상이면 추천 받기
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconClose, IconPin, IconPlus } from '@/app/components/Icons';
import FlowLayout, { FlowLoading, flowStyles } from '@/components/flow/FlowLayout';
import { AvatarInitial, TransportBadge } from '@/components/meeting/ParticipantBits';
import styles from '@/components/meeting/meeting.module.css';
import {
  MAX_PARTICIPANTS, MIN_PARTICIPANTS, TOTAL_STEPS, meetingPath, stepNumber, type MeetingParticipant,
} from '@/features/meeting/model';
import { meetingActions } from '@/features/meeting/store';
import { useMeetingStep } from '@/features/meeting/useMeetingStep';

function PersonCard({ meetingId, person }: { meetingId: string; person: MeetingParticipant }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className={styles.personCard}>
      <Link href={`${meetingPath(meetingId, 'participants')}/${encodeURIComponent(person.id)}`} className={styles.personLink}
        aria-label={`${person.name} 정보 수정`}>
        <AvatarInitial name={person.name} color={person.color} />
        <span className={styles.personText}>
          <strong>{person.name}</strong>
          <span className={styles.personPlace}><IconPin size={11} color="#94a3b8" />{person.origin.name}</span>
          <span><TransportBadge transport={person.transport} /></span>
        </span>
      </Link>
      {confirming ? (
        <div className={styles.confirmRow}>
          <span>뺄까요?</span>
          <button type="button" className={styles.danger} onClick={() => meetingActions.removeParticipant(meetingId, person.id)}>빼기</button>
          <button type="button" className={flowStyles.ghost} onClick={() => setConfirming(false)}>취소</button>
        </div>
      ) : (
        <button type="button" className={styles.iconButton} onClick={() => setConfirming(true)} aria-label={`${person.name} 빼기`}>
          <IconClose size={16} />
        </button>
      )}
    </li>
  );
}

export default function ParticipantsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { meeting } = useMeetingStep(params.id, 'participants');
  if (!meeting) return <FlowLoading title="참가자" />;

  const count = meeting.participants.length;
  const ready = count >= MIN_PARTICIPANTS;
  const addHref = `${meetingPath(meeting.id, 'participants')}/new`;

  return (
    <FlowLayout title={meeting.title || '참가자'} backHref={meetingPath(meeting.id, 'info')} backLabel="모임 정보로"
      step={{ current: stepNumber('participants'), total: TOTAL_STEPS }}
      bottom={<button type="button" className={flowStyles.primary} disabled={!ready}
        onClick={() => router.push(meetingPath(meeting.id, 'recommend'))}>
        {ready ? (meeting.recommendation ? '추천 결과 보기' : '만날 곳 추천 받기') : `참가자를 ${MIN_PARTICIPANTS - count}명 더 추가해 주세요`}
      </button>}>
      <div className={styles.lead}>
        <h2>누가 어디서 출발하나요?</h2>
        <p>참가자마다 출발지와 이동 수단을 넣으면 모두의 실제 이동시간을 비교해요.</p>
      </div>

      {meeting.recommendation && (
        <p className={styles.summary}>
          이미 추천을 받았어요. 출발지나 이동 수단을 바꾸면 추천을 다시 받아야 해요.
        </p>
      )}

      <div className={styles.listHeader}>
        <h2>참가자 <span style={{ color: 'var(--primary)' }}>{count}명</span></h2>
        <span>{MIN_PARTICIPANTS}~{MAX_PARTICIPANTS}명</span>
      </div>

      {count > 0 && (
        <ul className={styles.people}>
          {meeting.participants.map((person) => <PersonCard key={person.id} meetingId={meeting.id} person={person} />)}
        </ul>
      )}

      {count < MAX_PARTICIPANTS ? (
        <Link href={addHref} className={styles.addCard}>
          <IconPlus size={16} color="#2563eb" />
          {count === 0 ? '첫 번째 참가자 추가하기' : '참가자 추가'}
        </Link>
      ) : (
        <p className={styles.hint}>최대 {MAX_PARTICIPANTS}명까지 추가할 수 있어요.</p>
      )}

      {count === 1 && <p className={styles.hint}>공정한 중간 지점을 찾으려면 <b>1명 이상</b> 더 추가해 주세요.</p>}
    </FlowLayout>
  );
}
