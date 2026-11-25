'use client';
/**
 * 6단계. 약속 확정·공유 (`/meetings/[id]/done`)
 *
 * - 공유하기: 휴대폰 공유 시트(카톡·문자 등)로 약속 요약 글을 보낸다. 공유 시트가 없는 PC에서는 자동으로 복사한다.
 * - 복사: 요약 글만 복사한다.
 * - 지도 보기·길찾기: 카카오맵 링크 (받는 사람의 현재 위치에서 길찾기가 열린다)
 * - 캘린더에 추가: .ics 일정 파일 (날짜를 입력한 경우에만)
 * 공유 글·일정 내용은 features/meeting/share.ts 에서 만든다. 출발지 주소는 개인정보라 넣지 않는다.
 * 실제 공유·복사·파일 저장은 lib/platform/share.ts 어댑터를 거친다. (앱 전환 시 교체 지점)
 */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconClock, IconPhone, IconPin, IconShare } from '@/app/components/Icons';
import FlowLayout, { FlowLoading, flowStyles } from '@/components/flow/FlowLayout';
import { TravelTimeList } from '@/components/meeting/ResultBits';
import styles from '@/components/meeting/meeting.module.css';
import { categoryText, minutesText } from '@/features/meeting/display';
import { TOTAL_STEPS, meetingPath, stepNumber } from '@/features/meeting/model';
import { buildIcs, buildShareText, icsFileName, kakaoMapLink, kakaoRouteLink, scheduleText } from '@/features/meeting/share';
import { useMeetingStep } from '@/features/meeting/useMeetingStep';
import { copyText, saveFile, shareText } from '@/lib/platform/share';

export default function DonePage({ params }: { params: { id: string } }) {
  const { meeting } = useMeetingStep(params.id, 'done');
  const [status, setStatus] = useState<string | null>(null); // 화면 아래 잠깐 뜨는 알림 문구
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!meeting?.selectedPlace || !meeting.placeRoutes) return <FlowLoading title="약속 확정" />;
  const place = meeting.selectedPlace;
  const metrics = meeting.placeRoutes.metrics;
  const when = scheduleText(meeting.scheduledAt);
  const text = buildShareText(meeting);

  /** 알림을 3초 동안 보여준다. */
  function notify(message: string) {
    setStatus(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(null), 3000);
  }

  /** 공유 시트 → 실패·미지원이면 복사. 사용자가 공유 창을 닫은 경우(cancelled)는 알리지 않는다. */
  async function share() {
    const outcome = await shareText(text, meeting?.title || '약속');
    if (outcome === 'copied') notify('공유 창을 열 수 없어 약속 내용을 복사했어요. 단톡방에 붙여 넣어 주세요.');
    else if (outcome === 'failed') notify('공유하지 못했어요. 아래 미리보기 내용을 직접 복사해 주세요.');
  }

  async function copy() {
    notify((await copyText(text)) ? '약속 내용을 복사했어요.' : '복사하지 못했어요. 아래 미리보기 내용을 직접 복사해 주세요.');
  }

  /** .ics 파일 만들기 → 휴대폰은 공유 시트로 파일 전달, PC는 내려받기 */
  async function addToCalendar() {
    if (!meeting) return;
    const ics = buildIcs(meeting, new Date());
    if (!ics) return;
    const outcome = await saveFile(icsFileName(meeting), ics, 'text/calendar;charset=utf-8');
    if (outcome === 'saved') notify('일정 파일을 내려받았어요. 파일을 열면 캘린더에 추가돼요.');
    else if (outcome === 'failed') notify('일정 파일을 만들지 못했어요.');
  }

  return (
    <FlowLayout title="약속 확정" backHref={meetingPath(meeting.id, 'place')} backLabel="장소 확인으로"
      step={{ current: stepNumber('done'), total: TOTAL_STEPS }}
      bottom={<>
        <button type="button" className={flowStyles.secondary} onClick={() => void copy()}>복사</button>
        <button type="button" className={flowStyles.primary} onClick={() => void share()}><IconShare size={18} color="#ffffff" />공유하기</button>
      </>}>

      <div className={styles.doneHero}>
        <span className={styles.doneIcon} aria-hidden="true"><IconCheck size={26} color="#ffffff" /></span>
        <p className={styles.doneTitle}>{meeting.title || '약속'}</p>
        <h2>{place.name}에서 만나요</h2>
        {when && <p className={styles.doneWhen}><IconClock size={14} color="#64748b" />{when}</p>}
      </div>

      <section className={styles.detail} aria-labelledby="done-place">
        <span className={styles.placeCategory}>{categoryText(place.category)}</span>
        <h3 id="done-place" className={styles.donePlaceName}>{place.name}</h3>
        <p className={styles.placeMetaLine}><IconPin size={12} color="#94a3b8" />{place.address}</p>
        {place.phone && <p className={styles.placeMetaLine}><IconPhone size={12} color="#94a3b8" /><a href={`tel:${place.phone}`}>{place.phone}</a></p>}
        <div className={styles.linkRow}>
          <a className={flowStyles.secondary} href={kakaoMapLink(place)} target="_blank" rel="noreferrer">지도 보기</a>
          <a className={flowStyles.secondary} href={kakaoRouteLink(place)} target="_blank" rel="noreferrer">길찾기</a>
          {meeting.scheduledAt && <button type="button" className={flowStyles.secondary} onClick={() => void addToCalendar()}>캘린더에 추가</button>}
        </div>
      </section>

      <section className={styles.detail} aria-labelledby="done-times">
        <h3 id="done-times">예상 이동시간</h3>
        {metrics && <p className={styles.balanceHint}>가장 오래 걸리는 사람 {minutesText(metrics.maxMinutes)} · 차이 {minutesText(metrics.gapMinutes)}</p>}
        <TravelTimeList people={meeting.participants} routes={meeting.placeRoutes.routes} />
      </section>

      <details className={styles.more}>
        <summary>보낼 내용 미리보기</summary>
        <pre className={styles.preview}>{text}</pre>
        <p>출발지 주소는 개인정보라 공유 내용에 넣지 않았어요.</p>
      </details>

      <div className={styles.doneLinks}>
        <Link href={meetingPath(meeting.id, 'places')}>다른 장소로 바꾸기</Link>
        <Link href="/">약속 목록으로</Link>
      </div>

      <div className={styles.toast} role="status" aria-live="polite">{status && <span>{status}</span>}</div>
    </FlowLayout>
  );
}
