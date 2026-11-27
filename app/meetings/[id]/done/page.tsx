'use client';
/**
 * 6단계. 약속 확정·공유 (`/meetings/[id]/done`)
 *
 * 실사용 편의 기능:
 * - 1탭 고해상도 초대장 PNG 카드 이미지 생성·공유/저장 (출발지 주소 비공개)
 * - 주소 원탭 복사 (카카오T·티맵·배달앱 등 붙여넣기 편의)
 * - 카카오맵 + 카카오 길찾기 + 네이버지도 + 캘린더(.ics) 원탭 연동
 * - 오프라인에서도 기기 내 저장 데이터로 그대로 열람 가능
 */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  IconCalendar,
  IconCheck,
  IconClock,
  IconCopy,
  IconImage,
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
import { haptic } from '@/lib/platform/haptics';
import { shareOrDownloadInvitationPng } from '@/lib/platform/invite-card';
import { copyText, saveFile, shareText } from '@/lib/platform/share';

function naverMapLink(name: string, address: string): string {
  const q = `${name} ${address.split(' ').slice(0, 2).join(' ')}`.trim();
  return `https://map.naver.com/v5/search/${encodeURIComponent(q)}`;
}

export default function DonePage({ params }: { params: { id: string } }) {
  const { meeting } = useMeetingStep(params.id, 'done');
  const [status, setStatus] = useState<string | null>(null);
  const [savingImage, setSavingImage] = useState(false);
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
    haptic('light');
    const outcome = await shareText(text, meeting?.title || '약속');
    if (outcome === 'copied') {
      notify('약속 내용을 복사했어요. 단톡방에 바로 붙여 넣어 주세요.');
    } else if (outcome === 'failed') {
      notify('공유하지 못했어요. 아래 미리보기 내용을 직접 복사해 주세요.');
    }
  }

  async function copy() {
    haptic('light');
    notify(
      (await copyText(text))
        ? '약속 요약 내용을 복사했어요.'
        : '복사하지 못했어요. 아래 미리보기 내용을 직접 복사해 주세요.'
    );
  }

  async function copyAddress() {
    haptic('light');
    notify((await copyText(place.address)) ? '주소를 복사했어요.' : '주소를 복사하지 못했어요.');
  }

  async function saveInviteCard() {
    if (!meeting || savingImage) return;
    haptic('medium');
    setSavingImage(true);
    try {
      const outcome = await shareOrDownloadInvitationPng(meeting);
      if (outcome === 'downloaded') notify('초대장 이미지(PNG)를 저장했어요. 단톡방에 공유해 보세요.');
      else if (outcome === 'failed') notify('초대장 이미지를 만들지 못했어요.');
    } finally {
      setSavingImage(false);
    }
  }

  async function addToCalendar() {
    if (!meeting) return;
    haptic('light');
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
            <IconCopy size={16} color="var(--primary)" />
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
              <IconClock size={14} color="var(--primary)" />
              <span>{when}</span>
            </p>
          )}
          <button
            type="button"
            className={styles.inviteImageBtn}
            disabled={savingImage}
            onClick={() => void saveInviteCard()}
          >
            <IconImage size={15} color="var(--primary)" />
            <span>{savingImage ? '초대장 생성 중…' : '초대장 카드 이미지 저장·공유'}</span>
          </button>
        </div>
      </section>

      <section className={styles.detail} aria-labelledby="done-place">
        <span className={styles.placeCategory}>{categoryText(place.category)}</span>
        <h3 id="done-place" className={styles.donePlaceName}>
          {place.name}
        </h3>
        <div className={styles.addressRow}>
          <p className={styles.placeMetaLine} style={{ flex: 1, minWidth: 0 }}>
            <IconPin size={13} color="var(--text-muted)" />
            <span>{place.address}</span>
          </p>
          <button
            type="button"
            className={styles.copyAddrBtn}
            onClick={() => void copyAddress()}
            aria-label="주소 복사"
          >
            <IconCopy size={12} />
            <span>복사</span>
          </button>
        </div>
        {place.phone && (
          <p className={styles.placeMetaLine} style={{ marginTop: 6 }}>
            <IconPhone size={13} color="var(--text-muted)" />
            <a href={`tel:${place.phone}`}>{place.phone}</a>
          </p>
        )}
        <div className={styles.linkGrid}>
          <a
            className={flowStyles.secondary}
            href={kakaoMapLink(place)}
            target="_blank"
            rel="noreferrer"
          >
            <IconMap size={15} color="var(--primary)" />
            <span>카카오맵</span>
          </a>
          <a
            className={flowStyles.secondary}
            href={kakaoRouteLink(place)}
            target="_blank"
            rel="noreferrer"
          >
            <IconNavigation size={15} color="var(--primary)" />
            <span>길찾기</span>
          </a>
          <a
            className={flowStyles.secondary}
            href={naverMapLink(place.name, place.address)}
            target="_blank"
            rel="noreferrer"
          >
            <IconPin size={15} color="var(--primary)" />
            <span>네이버지도</span>
          </a>
          {meeting.scheduledAt && (
            <button
              type="button"
              className={flowStyles.secondary}
              onClick={() => void addToCalendar()}
            >
              <IconCalendar size={15} color="var(--primary)" />
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
        <p>참가자의 출발지 주소는 개인정보 보호를 위해 공유 문구와 초대장 이미지에서 제외했어요.</p>
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
