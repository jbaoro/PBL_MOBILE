'use client';
/**
 * 약속 목록 (기본 주소 `/`)
 *
 * 앱의 첫 화면. 이 기기에 저장된 약속을 최근 수정 순으로 보여주고,
 * 새 약속을 만들면 1단계(모임 정보)로 이동한다.
 * 약속 카드를 누르면 그 약속에서 이어서 할 단계(resumeStep)로 바로 간다.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import FlowLayout, { FlowLoading, flowStyles } from '@/components/flow/FlowLayout';
import { meetingPath, meetingStatus, resumeStep, type MeetingDraft, type MeetingStatus } from '@/features/meeting/model';
import { scheduleText } from '@/features/meeting/share';
import { meetingActions, useMeetingList, useMeetingStore } from '@/features/meeting/store';
import styles from './home.module.css';

/** 약속 카드 위 상태 뱃지 문구 */
const statusLabel: Record<MeetingStatus, string> = {
  draft: '작성 중', ready: '추천 준비 완료', recommended: '추천 완료', confirmed: '확정',
};

/** 저장된 일시를 '2026년 12월 5일 (토) 오후 7:00' 형식으로. 공유 글과 같은 형식을 쓴다. */
function formatSchedule(value?: string): string | null {
  return scheduleText(value);
}

/** 약속 한 개. 삭제는 실수 방지를 위해 한 번 더 확인한다(브라우저 confirm 창 대신 카드 안에서). */
function MeetingCard({ meeting }: { meeting: MeetingDraft }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const status = meetingStatus(meeting);
  const schedule = formatSchedule(meeting.scheduledAt);
  const place = meeting.confirmedAt ? meeting.selectedPlace?.name : undefined;

  return (
    <li className={styles.card}>
      <Link href={meetingPath(meeting.id, resumeStep(meeting))} className={styles.cardLink}>
        <span className={`${styles.badge} ${styles[status]}`}>{statusLabel[status]}</span>
        <strong className={styles.cardTitle}>{meeting.title || '제목 없는 약속'}</strong>
        <span className={styles.cardMeta}>
          {[schedule, `${meeting.participants.length}명`, place].filter(Boolean).join(' · ')}
        </span>
      </Link>
      {confirmingDelete ? (
        <div className={styles.deleteConfirm}>
          <span>이 약속을 삭제할까요?</span>
          <button type="button" className={styles.deleteYes} onClick={() => meetingActions.remove(meeting.id)}>삭제</button>
          <button type="button" className={flowStyles.ghost} onClick={() => setConfirmingDelete(false)}>취소</button>
        </div>
      ) : (
        <button type="button" className={styles.deleteButton} onClick={() => setConfirmingDelete(true)}
          aria-label={`${meeting.title || '제목 없는 약속'} 삭제`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      )}
    </li>
  );
}

export default function MeetingsHome() {
  const router = useRouter();
  const { hydrated, meetings } = useMeetingList();
  const { saveError } = useMeetingStore();

  // 기기 저장소에서 약속을 불러오기 전에는 빈 목록 대신 로딩을 보여준다.
  if (!hydrated) return <FlowLoading title="MeetPoint" />;

  /** 빈 약속을 만들고 1단계로 이동 */
  function startNew() {
    const id = meetingActions.create();
    router.push(meetingPath(id, 'info'));
  }

  return (
    <FlowLayout title="MeetPoint"
      bottom={<button type="button" className={flowStyles.primary} onClick={startNew}>새 약속 만들기</button>}>
      <section className={styles.intro}>
        <h2>모두에게 공평한 약속 장소</h2>
        <p>참가자의 출발지와 이동 수단을 입력하면 실제 이동시간을 비교해 만나기 좋은 곳을 찾아드려요.</p>
      </section>

      {saveError && <p className={flowStyles.notice} role="alert">{saveError}</p>}

      <section aria-labelledby="saved-title">
        <h3 id="saved-title" className={styles.sectionTitle}>저장된 약속 <span>{meetings.length}</span></h3>
        {meetings.length === 0 ? (
          <div className={styles.empty}>
            <p>아직 저장된 약속이 없어요.</p>
            <p>아래 버튼으로 첫 약속을 만들어 보세요.</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {meetings.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} />)}
          </ul>
        )}
        <p className={styles.storageHint}>약속은 이 기기에만 저장돼요.</p>
      </section>
    </FlowLayout>
  );
}
