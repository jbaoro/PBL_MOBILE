'use client';
/**
 * 2단계. 참가자 목록 (`/meetings/[id]/participants`)
 *
 * 실사용 편의 기능:
 * - 이전에 실제로 등록했던 '자주 만나는 멤버' 1탭 즉시 추가
 * - 물리 드래그 바텀시트로 연속 추가('저장 후 계속 추가')
 * - 원탭 이동수단 전환 + 실수 방지 삭제 Undo 스낵바
 * - 2명 이상일 때 실제 좌표 기반 60fps Canvas 분포 미리보기
 */
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconClose, IconCompass, IconPin, IconPlus, IconUsers } from '@/app/components/Icons';
import FlowLayout, { FlowLoading, flowStyles } from '@/components/flow/FlowLayout';
import { InteractiveRouteMap } from '@/components/meeting/InteractiveRouteMap';
import {
  AvatarInitial,
  TRANSPORT_OPTIONS,
  TransportIcon,
  nextColor,
  nextTransport,
} from '@/components/meeting/ParticipantBits';
import styles from '@/components/meeting/meeting.module.css';
import {
  MAX_PARTICIPANTS,
  MIN_PARTICIPANTS,
  TOTAL_STEPS,
  meetingPath,
  stepNumber,
  type MeetingParticipant,
} from '@/features/meeting/model';
import { meetingActions } from '@/features/meeting/store';
import { useMeetingStep } from '@/features/meeting/useMeetingStep';
import { distanceMeters } from '@/lib/meetpoint/geo';
import { haptic } from '@/lib/platform/haptics';
import { createId } from '@/lib/platform/id';
import {
  getRecentMembers,
  saveRecentMember,
  type SavedMemberTemplate,
} from '@/lib/platform/recents';

const ParticipantSheet = dynamic(
  () => import('@/components/meeting/ParticipantSheet').then((m) => m.ParticipantSheet),
  { ssr: false }
);

function spreadInfo(people: MeetingParticipant[]): { km: number; tier: string } {
  let maxM = 0;
  for (let i = 0; i < people.length; i += 1) {
    for (let j = i + 1; j < people.length; j += 1) {
      const d = distanceMeters(people[i].origin, people[j].origin);
      if (d > maxM) maxM = d;
    }
  }
  const km = Math.round(maxM / 100) / 10;
  const tier = km <= 25 ? '근거리 탐색' : km <= 80 ? '중거리 탐색' : '장거리 광역 탐색';
  return { km, tier };
}

function PersonRow({
  person,
  requireConfirm,
  onEdit,
  onCycleTransport,
  onRemove,
}: {
  person: MeetingParticipant;
  requireConfirm: boolean;
  onEdit: (person: MeetingParticipant) => void;
  onCycleTransport: (person: MeetingParticipant) => void;
  onRemove: (person: MeetingParticipant) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const transportLabel =
    TRANSPORT_OPTIONS.find((item) => item.value === person.transport)?.label ?? '대중교통';

  return (
    <li className={styles.personRow}>
      <button
        type="button"
        className={styles.personMainBtn}
        onClick={() => onEdit(person)}
        aria-label={`${person.name} 정보 수정`}
      >
        <AvatarInitial name={person.name} color={person.color} size={38} />
        <span className={styles.personText}>
          <strong>{person.name}</strong>
          <span className={styles.personPlace}>
            <IconPin size={11} color="var(--text-muted)" />
            {person.origin.name}
          </span>
        </span>
      </button>

      {confirming ? (
        <div className={styles.confirmRow}>
          <span>뺄까요?</span>
          <button
            type="button"
            className={styles.danger}
            onClick={() => {
              setConfirming(false);
              onRemove(person);
            }}
          >
            빼기
          </button>
          <button
            type="button"
            className={flowStyles.ghost}
            onClick={() => setConfirming(false)}
          >
            취소
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className={styles.quickTransportBtn}
            onClick={() => onCycleTransport(person)}
            title="누르면 이동 수단이 바뀝니다"
            aria-label={`${person.name} 이동 수단 변경 (현재 ${transportLabel})`}
          >
            <TransportIcon transport={person.transport} size={13} />
            <span>{transportLabel}</span>
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => (requireConfirm ? setConfirming(true) : onRemove(person))}
            aria-label={`${person.name} 빼기`}
          >
            <IconClose size={15} />
          </button>
        </>
      )}
    </li>
  );
}

export default function ParticipantsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { meeting } = useMeetingStep(params.id, 'participants');
  const [sheetState, setSheetState] = useState<
    { open: false } | { open: true; editing?: MeetingParticipant }
  >({ open: false });
  const [recentMembers, setRecentMembers] = useState<SavedMemberTemplate[]>([]);
  const [toast, setToast] = useState<{ message: string; undoPerson?: MeetingParticipant } | null>(
    null
  );
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setRecentMembers(getRecentMembers());
    return () => clearTimeout(toastTimer.current);
  }, []);

  const showToast = useCallback((message: string, undoPerson?: MeetingParticipant) => {
    setToast({ message, undoPerson });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), undoPerson ? 4500 : 2600);
  }, []);

  const spread = useMemo(
    () => (meeting && meeting.participants.length >= 2 ? spreadInfo(meeting.participants) : null),
    [meeting]
  );

  // 현재 약속에 아직 들어있지 않은 '자주 만나는 멤버'만 추천 칩으로 노출
  const availableRecents = useMemo(() => {
    if (!meeting || meeting.participants.length >= MAX_PARTICIPANTS) return [];
    const usedNames = new Set(meeting.participants.map((p) => p.name));
    return recentMembers.filter((m) => !usedNames.has(m.name)).slice(0, 5);
  }, [meeting, recentMembers]);

  const handleQuickAddRecent = useCallback(
    (member: SavedMemberTemplate) => {
      if (!meeting || meeting.participants.length >= MAX_PARTICIPANTS) return;
      haptic('medium');
      const color =
        member.color && !meeting.participants.some((p) => p.color === member.color)
          ? member.color
          : nextColor(meeting.participants.map((p) => p.color));
      meetingActions.upsertParticipant(meeting.id, {
        id: createId('p_'),
        name: member.name,
        color,
        origin: member.origin,
        transport: member.transport,
      });
      showToast(`${member.name}님(${member.origin.name})을 바로 추가했어요.`);
    },
    [meeting, showToast]
  );

  const handleCycleTransport = useCallback(
    (person: MeetingParticipant) => {
      if (!meeting) return;
      haptic('light');
      const next = nextTransport(person.transport);
      const nextLabel = TRANSPORT_OPTIONS.find((item) => item.value === next)?.label ?? next;
      const updated = { ...person, transport: next };
      meetingActions.upsertParticipant(meeting.id, updated);
      saveRecentMember(updated);
      showToast(`${person.name}님의 이동 수단을 ${nextLabel}(으)로 바꿨어요.`);
    },
    [meeting, showToast]
  );

  const handleRemove = useCallback(
    (person: MeetingParticipant) => {
      if (!meeting) return;
      haptic('light');
      const hadRecommendation = Boolean(meeting.recommendation);
      meetingActions.removeParticipant(meeting.id, person.id);
      showToast(`${person.name}님을 제외했어요.`, hadRecommendation ? undefined : person);
    },
    [meeting, showToast]
  );

  const handleUndoRemove = useCallback(() => {
    if (!meeting || !toast?.undoPerson) return;
    haptic('success');
    meetingActions.upsertParticipant(meeting.id, toast.undoPerson);
    clearTimeout(toastTimer.current);
    setToast(null);
  }, [meeting, toast]);

  if (!meeting) return <FlowLoading title="참가자" />;

  const count = meeting.participants.length;
  const ready = count >= MIN_PARTICIPANTS;

  return (
    <FlowLayout
      title={meeting.title || '참가자'}
      backHref={meetingPath(meeting.id, 'info')}
      backLabel="모임 정보로"
      step={{ current: stepNumber('participants'), total: TOTAL_STEPS }}
      bottom={
        <button
          type="button"
          className={flowStyles.primary}
          disabled={!ready}
          onClick={() => {
            haptic('medium');
            router.push(meetingPath(meeting.id, 'recommend'));
          }}
        >
          {ready
            ? meeting.recommendation
              ? '추천 결과 보기'
              : '만날 곳 추천 받기'
            : `참가자를 ${MIN_PARTICIPANTS - count}명 더 추가해 주세요`}
        </button>
      }
    >
      <div className={styles.lead}>
        <h2>누가 어디서 출발하나요?</h2>
        <p>참가자마다 출발지와 이동 수단을 넣으면 실제 이동시간을 비교해 드려요.</p>
      </div>

      {meeting.recommendation && (
        <p className={styles.summary}>
          이미 추천을 받은 약속이에요. 출발지나 이동 수단을 바꾸면 추천을 다시 조회해요.
        </p>
      )}

      {spread && (
        <section className={styles.previewMapCard} aria-label="참가자 출발지 분포 미리보기">
          <div className={styles.previewMapTop}>
            <span className={styles.previewMapTitle}>
              <IconCompass size={15} color="var(--primary)" />
              출발지 분포 미리보기
            </span>
            <span className={styles.previewSpreadBadge}>
              최대 {spread.km}km · {spread.tier}
            </span>
          </div>
          <InteractiveRouteMap people={meeting.participants} height={162} />
        </section>
      )}

      {availableRecents.length > 0 && (
        <section className={styles.recentMembersCard} aria-label="자주 만나는 멤버 빠르게 추가">
          <div className={styles.recentMembersHeader}>
            <IconUsers size={13} color="var(--primary)" />
            <span>자주 만나는 멤버 1탭 추가</span>
          </div>
          <div className={styles.quickChips} style={{ marginTop: 8 }}>
            {availableRecents.map((member) => (
              <button
                key={`${member.name}-${member.origin.id}`}
                type="button"
                className={styles.recentMemberChip}
                onClick={() => handleQuickAddRecent(member)}
              >
                <IconPlus size={12} color="var(--primary)" />
                <b>{member.name}</b>
                <span>{member.origin.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className={styles.listHeader}>
        <h2>
          참가자 <span style={{ color: 'var(--primary)' }}>{count}명</span>
        </h2>
        <span>
          {count > 0
            ? `${MIN_PARTICIPANTS}~${MAX_PARTICIPANTS}명 · 이동 수단 탭 전환`
            : `${MIN_PARTICIPANTS}~${MAX_PARTICIPANTS}명`}
        </span>
      </div>

      {count === 0 ? (
        <button
          type="button"
          className={styles.addCardStandalone}
          onClick={() => setSheetState({ open: true })}
        >
          <IconPlus size={18} color="var(--primary)" />
          <span>첫 번째 참가자 추가하기</span>
        </button>
      ) : (
        <div className={styles.peopleCard}>
          <ul className={styles.people}>
            {meeting.participants.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                requireConfirm={Boolean(meeting.recommendation)}
                onEdit={(target) => setSheetState({ open: true, editing: target })}
                onCycleTransport={handleCycleTransport}
                onRemove={handleRemove}
              />
            ))}
          </ul>

          {count < MAX_PARTICIPANTS && (
            <button
              type="button"
              className={styles.addCard}
              onClick={() => setSheetState({ open: true })}
            >
              <IconPlus size={16} color="var(--primary)" />
              <span>참가자 추가하기</span>
            </button>
          )}
        </div>
      )}

      {count >= MAX_PARTICIPANTS && (
        <p className={styles.hint}>최대 {MAX_PARTICIPANTS}명까지 추가할 수 있어요.</p>
      )}
      {count === 1 && (
        <p className={styles.hint}>
          공정한 중간 지점을 찾으려면 <b>1명 이상</b> 더 추가해 주세요.
        </p>
      )}

      {sheetState.open && (
        <ParticipantSheet
          meeting={meeting}
          editing={sheetState.editing}
          onClose={() => {
            setRecentMembers(getRecentMembers());
            setSheetState({ open: false });
          }}
          onSaved={(msg) => showToast(msg)}
        />
      )}

      {toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          <div className={styles.toastInner}>
            <span>{toast.message}</span>
            {toast.undoPerson && (
              <button type="button" className={styles.toastUndoBtn} onClick={handleUndoRemove}>
                되돌리기
              </button>
            )}
          </div>
        </div>
      )}
    </FlowLayout>
  );
}
