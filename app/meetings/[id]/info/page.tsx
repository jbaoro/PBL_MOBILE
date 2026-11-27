'use client';
/**
 * 1단계. 모임 정보 (`/meetings/[id]/info`)
 *
 * - 원탭 추천 모임명 칩 + 실제 날짜가 표시되는 빠른 날짜(오늘·내일·금·토·일)·시간 칩
 * - 날짜/시간 원탭 지우기 + 실시간 한국어 일정 미리보기
 */
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { IconCalendar, IconClose } from '@/app/components/Icons';
import FlowLayout, { FlowLoading, flowStyles } from '@/components/flow/FlowLayout';
import styles from '@/components/meeting/meeting.module.css';
import { TOTAL_STEPS, meetingPath, stepNumber } from '@/features/meeting/model';
import { scheduleText } from '@/features/meeting/share';
import { meetingActions } from '@/features/meeting/store';
import { useMeetingStep } from '@/features/meeting/useMeetingStep';
import { haptic } from '@/lib/platform/haptics';

const TITLE_MAX = 40;
const TITLE_PRESETS = ['동기 모임', '팀 회식', '주말 브런치', '스터디', '생일 파티'];
const TIME_PRESETS = [
  { label: '점심 12:00', value: '12:00' },
  { label: '오후 3:00', value: '15:00' },
  { label: '저녁 7:00', value: '19:00' },
  { label: '시간 미정', value: '' },
];

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shortMd(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function buildQuickDates(): { label: string; value: string }[] {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const dayOfWeek = today.getDay();
  const daysToFri = (5 - dayOfWeek + 7) % 7 || 7;
  const fri = new Date(today);
  fri.setDate(today.getDate() + daysToFri);
  const sat = new Date(fri);
  sat.setDate(fri.getDate() + 1);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);

  const raw = [
    { label: '오늘', value: toDateInput(today) },
    { label: '내일', value: toDateInput(tomorrow) },
    { label: `금 (${shortMd(fri)})`, value: toDateInput(fri) },
    { label: `토 (${shortMd(sat)})`, value: toDateInput(sat) },
    { label: `일 (${shortMd(sun)})`, value: toDateInput(sun) },
  ];

  // 오늘/내일과 겹치는 요일 칩은 중복 제거
  return raw.filter((item, idx, arr) => arr.findIndex((o) => o.value === item.value) === idx);
}

export default function MeetingInfoPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { meeting } = useMeetingStep(params.id, 'info');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [touched, setTouched] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const quickDates = useMemo(() => buildQuickDates(), []);

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
  const preview = date ? scheduleText(time ? `${date}T${time}` : date) : null;

  function next(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (titleError || timeError) return;
    haptic('light');
    meetingActions.updateInfo(params.id, {
      title,
      scheduledAt: date ? (time ? `${date}T${time}` : date) : undefined,
    });
    router.push(meetingPath(params.id, 'participants'));
  }

  return (
    <FlowLayout
      title="모임 정보"
      backHref="/"
      backLabel="약속 목록으로"
      step={{ current: stepNumber('info'), total: TOTAL_STEPS }}
      bottom={
        <button type="submit" form="meeting-info" className={flowStyles.primary}>
          참가자 입력으로
        </button>
      }
    >
      <div className={styles.lead}>
        <h2>어떤 모임인가요?</h2>
        <p>모임 이름은 약속 목록과 최종 공유 문구·초대장에 사용돼요.</p>
      </div>

      <form id="meeting-info" onSubmit={next} noValidate>
        <div className={styles.surfaceCard}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="meeting-title">
              모임 이름
            </label>
            <input
              id="meeting-title"
              className="form-input"
              value={title}
              maxLength={TITLE_MAX}
              autoFocus={!meeting.title}
              placeholder="예: 동기 모임, 팀 회식, 생일 파티"
              aria-invalid={touched && Boolean(titleError)}
              onChange={(event) => setTitle(event.target.value)}
            />
            {touched && titleError && <p className={styles.error}>{titleError}</p>}

            <div className={styles.quickChips} role="group" aria-label="자주 쓰는 모임 이름">
              {TITLE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={styles.quickChip}
                  aria-pressed={title === preset}
                  onClick={() => {
                    haptic('light');
                    setTitle(preset);
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.surfaceCard}>
          <div className={styles.field}>
            <div className={styles.labelRow}>
              <span className={styles.label} style={{ marginBottom: 0 }}>
                언제 만나나요?<span className={styles.optional}>선택</span>
              </span>
              {(date || time) && (
                <button
                  type="button"
                  className={styles.clearInlineBtn}
                  onClick={() => {
                    haptic('light');
                    setDate('');
                    setTime('');
                  }}
                >
                  <IconClose size={12} />
                  <span>지우기</span>
                </button>
              )}
            </div>

            <div className={styles.quickChips} role="group" aria-label="빠른 날짜 선택">
              {quickDates.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={styles.quickChip}
                  aria-pressed={date === item.value}
                  onClick={() => {
                    haptic('light');
                    setDate(date === item.value ? '' : item.value);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className={styles.row} style={{ marginTop: 12 }}>
              <input
                type="date"
                className="form-input"
                aria-label="날짜"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
              <input
                type="time"
                className="form-input"
                aria-label="시간"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </div>

            {date && (
              <div className={styles.quickChips} role="group" aria-label="빠른 시간 선택">
                {TIME_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={styles.quickChip}
                    aria-pressed={time === preset.value}
                    onClick={() => {
                      haptic('light');
                      setTime(preset.value);
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}

            {touched && timeError && <p className={styles.error}>{timeError}</p>}

            {preview && (
              <div className={styles.schedulePreview}>
                <IconCalendar size={15} color="var(--primary)" />
                <span>{preview}</span>
              </div>
            )}

            <p className={styles.fieldHint}>
              이동시간은 조회 시점 기준이며, 날짜를 넣으면 확정 후 캘린더(.ics)에 추가할 수 있어요.
            </p>
          </div>
        </div>
      </form>
    </FlowLayout>
  );
}
