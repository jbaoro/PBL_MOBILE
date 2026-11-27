'use client';
/**
 * 약속 목록 (기본 주소 `/`)
 *
 * 실사용 편의 기능:
 * - 지난 모임의 참가자 구성만 그대로 가져오는 '멤버 그대로 새 약속' 1탭 복제
 * - 삭제 시 즉시 반영 + 4.5초 실행취소(Undo) 스낵바
 * - 약속이 4개 이상일 때만 표시되는 빠른 검색
 * - 다크모드 전환 및 PWA 설치 지원
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  IconClose,
  IconDuplicate,
  IconPin,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconUsers,
} from '@/app/components/Icons';
import FlowLayout, { FlowLoading, flowStyles } from '@/components/flow/FlowLayout';
import { AvatarStack } from '@/components/meeting/ParticipantBits';
import { PwaInstallButton } from '@/components/ui/PwaInstallButton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import {
  TOTAL_STEPS,
  meetingPath,
  meetingStatus,
  resumeStep,
  stepNumber,
  type MeetingDraft,
  type MeetingStatus,
} from '@/features/meeting/model';
import { scheduleText } from '@/features/meeting/share';
import { meetingActions, useMeetingList, useMeetingStore } from '@/features/meeting/store';
import { haptic } from '@/lib/platform/haptics';
import styles from './home.module.css';

const statusLabel: Record<MeetingStatus, string> = {
  draft: '작성 중',
  ready: '추천 준비 완료',
  recommended: '추천 완료',
  confirmed: '약속 확정',
};

type FilterKind = 'all' | 'active' | 'confirmed';

const MeetingCard = React.memo(function MeetingCard({
  meeting,
  onDuplicate,
  onDelete,
}: {
  meeting: MeetingDraft;
  onDuplicate: (meeting: MeetingDraft) => void;
  onDelete: (meeting: MeetingDraft) => void;
}) {
  const status = meetingStatus(meeting);
  const step = resumeStep(meeting);
  const stepIdx = stepNumber(step);
  const schedule = scheduleText(meeting.scheduledAt);
  const confirmedPlace = meeting.confirmedAt ? meeting.selectedPlace?.name : undefined;
  const progressRatio = status === 'confirmed' ? 1 : stepIdx / TOTAL_STEPS;

  return (
    <li className={styles.card}>
      <Link href={meetingPath(meeting.id, step)} className={styles.cardLink}>
        <div className={styles.cardTop}>
          <span className={`${styles.badge} ${styles[status]}`}>{statusLabel[status]}</span>
          <span className={styles.stepMini}>
            {status === 'confirmed' ? '완료' : `${stepIdx}/${TOTAL_STEPS}단계`}
          </span>
        </div>

        <strong className={styles.cardTitle}>{meeting.title || '제목 없는 약속'}</strong>

        <div className={styles.cardFooter}>
          <span className={styles.cardMeta}>
            {confirmedPlace ? (
              <span className={styles.cardPlace}>
                <IconPin size={12} color="var(--accent-green)" />
                {confirmedPlace}
                {schedule ? ` · ${schedule}` : ''}
              </span>
            ) : (
              [schedule, `${meeting.participants.length}명 참여`].filter(Boolean).join(' · ')
            )}
          </span>
          <AvatarStack people={meeting.participants} max={4} />
        </div>

        <div
          className={`${styles.miniBar} ${status === 'confirmed' ? styles.miniBarConfirmed : ''}`}
          aria-hidden="true"
        >
          <span style={{ transform: `scaleX(${progressRatio})` }} />
        </div>
      </Link>

      <button
        type="button"
        className={styles.deleteButton}
        onClick={() => onDelete(meeting)}
        aria-label={`${meeting.title || '제목 없는 약속'} 삭제`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </button>

      {meeting.participants.length > 0 && (
        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.cardActionBtn}
            onClick={() => onDuplicate(meeting)}
            title="이 멤버 그대로 새 약속 만들기"
            aria-label={`${meeting.title || '약속'} 멤버 그대로 새 약속 만들기`}
          >
            <IconDuplicate size={14} />
            <span>이 멤버 그대로 새 약속</span>
          </button>
        </div>
      )}
    </li>
  );
});

export default function MeetingsHome() {
  const router = useRouter();
  const { hydrated, meetings } = useMeetingList();
  const { saveError } = useMeetingStore();
  const [filter, setFilter] = useState<FilterKind>('all');
  const [searchText, setSearchText] = useState('');
  const [undoItem, setUndoItem] = useState<MeetingDraft | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return meetings.filter((m) => {
      if (filter === 'confirmed' && !m.confirmedAt) return false;
      if (filter === 'active' && m.confirmedAt) return false;
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        (m.selectedPlace?.name.toLowerCase().includes(q) ?? false) ||
        m.participants.some((p) => p.name.toLowerCase().includes(q))
      );
    });
  }, [meetings, filter, searchText]);

  const handleDuplicate = useCallback(
    (source: MeetingDraft) => {
      haptic('medium');
      const newId = meetingActions.duplicateWithMembers(source.id);
      if (newId) router.push(meetingPath(newId, 'info'));
    },
    [router]
  );

  const handleDelete = useCallback((target: MeetingDraft) => {
    haptic('light');
    meetingActions.remove(target.id);
    setUndoItem(target);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoItem(null), 4500);
  }, []);

  const handleUndo = useCallback(() => {
    if (!undoItem) return;
    haptic('success');
    meetingActions.restore(undoItem);
    clearTimeout(undoTimer.current);
    setUndoItem(null);
  }, [undoItem]);

  if (!hydrated) return <FlowLoading title="MeetPoint" />;

  function startNew() {
    haptic('light');
    const id = meetingActions.create();
    router.push(meetingPath(id, 'info'));
  }

  return (
    <FlowLayout
      title="MeetPoint"
      brand
      action={
        <div className={styles.headerActions}>
          <PwaInstallButton />
          <ThemeToggle />
        </div>
      }
      bottom={
        <button type="button" className={flowStyles.primary} onClick={startNew}>
          <IconPlus size={18} color="#ffffff" />
          <span>새 약속 만들기</span>
        </button>
      }
    >
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <span className={styles.heroEyebrow}>
          <IconSparkles size={12} color="#ffffff" />
          실측 경로 기반 공정 추천
        </span>
        <h2>
          모두에게 공평한
          <br />
          약속 장소를 한 번에
        </h2>
        <p>
          참가자의 출발지와 이동 수단만 넣으면 실제 소요 시간을 비교해 누구도 억울하지 않은
          중간 지점을 찾아드려요.
        </p>

        {meetings.length === 0 && (
          <div className={styles.howSteps} aria-label="이용 순서">
            <div className={styles.howStep}>
              <span className={styles.howNum}>STEP 1</span>
              <span className={styles.howText}>출발지·수단 입력</span>
            </div>
            <div className={styles.howStep}>
              <span className={styles.howNum}>STEP 2</span>
              <span className={styles.howText}>실측 경로 비교</span>
            </div>
            <div className={styles.howStep}>
              <span className={styles.howNum}>STEP 3</span>
              <span className={styles.howText}>장소 확정·공유</span>
            </div>
          </div>
        )}
      </section>

      {saveError && (
        <p className={flowStyles.notice} role="alert">
          {saveError}
        </p>
      )}

      <section aria-labelledby="saved-title">
        <div className={styles.listTop}>
          <h3 id="saved-title" className={styles.sectionTitle}>
            저장된 약속 <span className={styles.sectionCount}>{meetings.length}</span>
          </h3>

          {meetings.length >= 3 && (
            <div className={styles.filterPills} role="group" aria-label="약속 상태 필터">
              {(
                [
                  ['all', '전체'],
                  ['active', '진행 중'],
                  ['confirmed', '확정'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={styles.filterPill}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {meetings.length >= 4 && (
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon} aria-hidden="true">
              <IconSearch size={15} color="var(--text-muted)" />
            </span>
            <input
              type="search"
              className={styles.searchInput}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="약속 이름, 멤버, 확정 장소로 찾기"
              aria-label="저장된 약속 검색"
            />
            {searchText && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => setSearchText('')}
                aria-label="검색어 지우기"
              >
                <IconClose size={13} />
              </button>
            )}
          </div>
        )}

        {meetings.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true">
              <IconUsers size={22} color="var(--primary)" />
            </span>
            <strong>아직 만든 약속이 없어요</strong>
            <p>아래 버튼으로 첫 약속을 시작해 보세요.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <p>조건에 맞는 약속이 없어요.</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {filtered.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}

        <p className={styles.storageHint}>
          약속 내역은 이 기기에 안전하게 저장되며 오프라인에서도 확인할 수 있어요.
        </p>
      </section>

      {undoItem && (
        <div className={styles.undoBar} role="status" aria-live="polite">
          <span>&lsquo;{undoItem.title || '제목 없는 약속'}&rsquo;을 삭제했어요.</span>
          <button type="button" className={styles.undoBtn} onClick={handleUndo}>
            되돌리기
          </button>
        </div>
      )}
    </FlowLayout>
  );
}
