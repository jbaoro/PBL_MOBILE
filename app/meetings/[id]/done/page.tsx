'use client';
/**
 * 6단계. 약속 확정·공유 (`/meetings/[id]/done`)
 *
 * - 경량 60fps Canvas 컨페티 축하 효과
 * - 공유 시트(미지원 PC 자동 복사), 요약 복사, 지도·길찾기, 캘린더(.ics) 추가
 */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  IconCalendar,
  IconCheck,
  IconClock,
  IconCopy,
  IconMap,
  IconNavigation,
  IconPhone,
  IconPin,
  IconShare,
} from '@/app/components/Icons';
import FlowLayout, { FlowLoading, flowStyles } from '@/components/flow/FlowLayout';
import { TravelTimeList } from '@/components/meeting/ResultBits';
import { ConfettiBurst } from '@/components/ui/ConfettiBurst';
import styles from '@/components/meeting/meeting.module.css';
import { categoryText, minutesText } from '@/features/meeting/display';
import { TOTAL_STEPS, meetingPath, stepNumber } from '@/features/meeting/model';
import {
  buildIcs,
  buildShareText,
  icsFileName,
  kakaoMapLink,
  kakaoRouteLink,
  scheduleText,
} from '@/features/meeting/share';
import { useMeetingStep } from '@/features/meeting/useMeetingStep';
import { copyText, saveFile, shareText } from '@/lib/platform/share';

export default function DonePage({ params }: { params: { id: string } }) {
  const { meeting } = useMeetingStep(params.id, 'done');
  const [status, setStatus] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!meeting?.selectedPlace || !meeting.placeRoutes) return <FlowLoading title="약속 확정" />;

  const place = meeting.selectedPlace;
  const metrics = meeting.placeRoutes.metrics;
  const when = scheduleText(meeting.scheduledAt);
  const text = buildShareText(meeting);

  function notify(message: string) {
    setStatus(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(null), 3000);
  }

  async function share() {
    const outcome = await shareText(text, meeting?.title || '약속');
    if (outcome === 'copied') {
      notify('약속 내용을 복사했어요. 단톡방에 바로 붙여 넣어 주세요.');
    } else if (outcome === 'failed') {
      notify('공유하지 못했어요. 아래 미리보기 내용을 직접 복사해 주세요.');
    }
  }

  async function copy() {
    notify(
      (await copyText(text))
        ? '약속 요약 내용을 복사했어요.'
        : '복사하지 못했어요. 아래 미리보기 내용을 직접 복사해 주세요.'
    );
  }

  async function addToCalendar() {
    if (!meeting) return;
    const ics = buildIcs(meeting, new Date());
    if (!ics) return;
    const outcome = await saveFile(icsFileName(meeting), ics, 'text/calendar;charset=utf-8');
    if (outcome === 'saved') notify('일정 파일(.ics)을 저장했어요. 열면 캘린더에 등록돼요.');
    else if (outcome === 'failed') notify('일정 파일을 만들지 못했어요.');
  }

  return (
    <FlowLayout
      title="약속 확정"
      backHref={meetingPath(meeting.id, 'place')}
      backLabel="장소 확인으로"
      step={{ current: stepNumber('done'), total: TOTAL_STEPS }}
      bottom={
        <>
          <button type="button" className={flowStyles.secondary} onClick={() => void copy()}>
            <IconCopy size={16} color="#2563eb" />
            <span>복사</span>
          </button>
          <button type="button" className={flowStyles.primary} onClick={() => void share()}>
            <IconShare size={17} color="#ffffff" />
            <span>약속 공유하기</span>
          </button>
        </>
      }
    >
      <section className={styles.doneHeroWrap}>
        <ConfettiBurst />
        <div className={styles.doneHeroContent}>
          <span className={styles.doneIcon} aria-hidden="true">
            <IconCheck size={28} color="#ffffff" />
          </span>
          <span className={styles.doneBadge}>약속 확정 완료</span>
          <p className={styles.doneTitle}>{meeting.title || '약속'}</p>
          <h2>{place.name}에서 만나요</h2>
          {when && (
            <p className={styles.doneWhen}>
              <IconClock size={14} color="#2563eb" />
              <span>{when}</span>
            </p>
          )}
        </div>
      </section>

      <section className={styles.detail} aria-labelledby="done-place">
        <span className={styles.placeCategory}>{categoryText(place.category)}</span>
        <h3 id="done-place" className={styles.donePlaceName}>
          {place.name}
        </h3>
        <p className={styles.placeMetaLine}>
          <IconPin size={13} color="#94a3b8" />
          {place.address}
        </p>
        {place.phone && (
          <p className={styles.placeMetaLine} style={{ marginTop: 4 }}>
            <IconPhone size={13} color="#94a3b8" />
            <a href={`tel:${place.phone}`}>{place.phone}</a>
          </p>
        )}
        <div className={styles.linkRow}>
          <a
            className={flowStyles.secondary}
            href={kakaoMapLink(place)}
            target="_blank"
            rel="noreferrer"
          >
            <IconMap size={15} color="#2563eb" />
            <span>지도</span>
          </a>
          <a
            className={flowStyles.secondary}
            href={kakaoRouteLink(place)}
            target="_blank"
            rel="noreferrer"
          >
            <IconNavigation size={15} color="#2563eb" />
            <span>길찾기</span>
          </a>
          {meeting.scheduledAt && (
            <button
              type="button"
              className={flowStyles.secondary}
              onClick={() => void addToCalendar()}
            >
              <IconCalendar size={15} color="#2563eb" />
              <span>캘린더</span>
            </button>
          )}
        </div>
      </section>

      <section className={styles.detail} aria-labelledby="done-times">
        <h3 id="done-times">참가자 예상 이동시간</h3>
        {metrics && (
          <p className={styles.balanceHint}>
            가장 오래 걸리는 사람 {minutesText(metrics.maxMinutes)} · 편차{' '}
            {minutesText(metrics.gapMinutes)} · 평균 {minutesText(metrics.averageMinutes)}
          </p>
        )}
        <TravelTimeList people={meeting.participants} routes={meeting.placeRoutes.routes} />
      </section>

      <details className={styles.more}>
        <summary>공유 메시지 미리보기</summary>
        <pre className={styles.preview}>{text}</pre>
        <p>참가자의 출발지 주소는 개인정보 보호를 위해 공유 문구에서 제외했어요.</p>
      </details>

      <div className={styles.doneLinks}>
        <Link href={meetingPath(meeting.id, 'places')}>다른 장소로 바꾸기</Link>
        <Link href="/">약속 목록으로</Link>
      </div>

      <div className={styles.toast} role="status" aria-live="polite">
        {status && <span>{status}</span>}
      </div>
    </FlowLayout>
  );
}
