'use client';
/**
 * 1단계. 모임 정보 (`/meetings/[id]/info`)
 *
 * - 모임 이름: 필수, 최대 40자. 약속 목록·공유 글·캘린더 제목에 쓰인다.
 * - 날짜·시간: 선택. 시간만 넣고 날짜를 비우는 건 막는다.
 * 모임 정보는 이동시간 계산에 영향을 주지 않으므로, 바꿔도 이후 추천 결과는 그대로 둔다.
 */
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import FlowLayout, { FlowLoading, flowStyles } from '@/components/flow/FlowLayout';
import styles from '@/components/meeting/meeting.module.css';
import { TOTAL_STEPS, meetingPath, stepNumber } from '@/features/meeting/model';
import { meetingActions } from '@/features/meeting/store';
import { useMeetingStep } from '@/features/meeting/useMeetingStep';

const TITLE_MAX = 40;

export default function MeetingInfoPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { meeting } = useMeetingStep(params.id, 'info');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [touched, setTouched] = useState(false); // '다음'을 한 번 누른 뒤부터 오류 문구를 보여준다
  const [loaded, setLoaded] = useState(false);   // 저장된 값으로 입력칸을 채웠는지

  // 저장된 값으로 한 번만 채운다.
  useEffect(() => {
    if (!meeting || loaded) return;
    setTitle(meeting.title);
    const [savedDate = '', savedTime = ''] = (meeting.scheduledAt ?? '').split('T');
    setDate(savedDate);
    setTime(savedTime.slice(0, 5));
    setLoaded(true);
  }, [meeting, loaded]);

  if (!meeting) return <FlowLoading title="모임 정보" />;

  const titleError = !title.trim() ? '모임 이름을 입력해 주세요.' : null;
  const timeError = time && !date ? '시간을 정하려면 날짜도 골라 주세요.' : null;

  /** 검증 → 저장 → 2단계(참가자)로 이동 */
  function next(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (titleError || timeError) return;
    // 시간을 비우면 날짜만 저장한다(시간 미정). 자정(00:00)과 구분하기 위해서.
    meetingActions.updateInfo(params.id, { title, scheduledAt: date ? (time ? `${date}T${time}` : date) : undefined });
    router.push(meetingPath(params.id, 'participants'));
  }

  return (
    <FlowLayout title="모임 정보" backHref="/" backLabel="약속 목록으로"
      step={{ current: stepNumber('info'), total: TOTAL_STEPS }}
      bottom={<button type="submit" form="meeting-info" className={flowStyles.primary}>다음</button>}>
      <div className={styles.lead}>
        <h2>어떤 모임인가요?</h2>
        <p>모임 이름은 저장된 약속 목록과 공유 문구에 쓰여요.</p>
      </div>

      <form id="meeting-info" onSubmit={next} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="meeting-title">모임 이름</label>
          <input id="meeting-title" className="form-input" value={title} maxLength={TITLE_MAX} autoFocus={!meeting.title}
            placeholder="예: 동기 모임, 팀 회식, 생일 파티" aria-invalid={touched && !!titleError}
            onChange={(event) => setTitle(event.target.value)} />
          {touched && titleError && <p className={styles.error}>{titleError}</p>}
        </div>

        <div className={styles.field}>
          <span className={styles.label}>언제 만나나요?<span className={styles.optional}>선택</span></span>
          <div className={styles.row}>
            <input type="date" className="form-input" aria-label="날짜" value={date} onChange={(event) => setDate(event.target.value)} />
            <input type="time" className="form-input" aria-label="시간" value={time} onChange={(event) => setTime(event.target.value)} />
          </div>
          {touched && timeError && <p className={styles.error}>{timeError}</p>}
          <p className={styles.fieldHint}>이동시간은 조회하는 시점 기준이라, 약속 시각의 교통 상황은 반영되지 않아요.</p>
        </div>
      </form>
    </FlowLayout>
  );
}
