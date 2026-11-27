'use client';
/**
 * 5단계. 장소 확인 (`/meetings/[id]/places/selected`)
 *
 * 실사용 편의 기능:
 * - 추천 지역(역) 기준 대비 참가자별 문 앞까지 증감(±분) 배지 표시
 * - 주소 원탭 복사 + 전화 걸기(단체 예약 편의) + 카카오맵 바로가기
 * - 180ms 지연 스켈레톤 적용
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconAlert, IconCopy, IconPhone, IconPin, IconRefresh } from '@/app/components/Icons';
import FlowLayout, { FlowLoading, flowStyles } from '@/components/flow/FlowLayout';
import { MiniMap, TravelTimeList } from '@/components/meeting/ResultBits';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { RouteSkeletonList } from '@/components/ui/Skeleton';
import styles from '@/components/meeting/meeting.module.css';
import {
  balanceLabel,
  balanceScore,
  categoryText,
  formatClock,
  maxDeltaText,
  minutesText,
  participantsForApi,
} from '@/features/meeting/display';
import {
  TOTAL_STEPS,
  meetingPath,
  selectedCandidate,
  stepNumber,
  type MeetingDraft,
} from '@/features/meeting/model';
import { meetingActions } from '@/features/meeting/store';
import { useMeetingStep } from '@/features/meeting/useMeetingStep';
import { ApiError, isAbort, meetpointApi } from '@/lib/api/client';
import { useDelayedLoading } from '@/lib/hooks/useDelayedLoading';
import { haptic } from '@/lib/platform/haptics';
import { copyText } from '@/lib/platform/share';

type RunState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string };

export default function PlaceDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { meeting } = useMeetingStep(params.id, 'place');
  const [run, setRun] = useState<RunState>({ status: 'idle' });
  const [toast, setToast] = useState<string | null>(null);
  const controller = useRef<AbortController>();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const check = useCallback(async (target: MeetingDraft) => {
    const place = target.selectedPlace;
    if (!place) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setRun({ status: 'loading' });
    try {
      const result = await meetpointApi.routesTo(
        participantsForApi(target.participants),
        place,
        request.signal
      );
      if (request.signal.aborted) return;
      meetingActions.setPlaceRoutes(target.id, result);
      setRun({ status: 'idle' });
    } catch (error) {
      if (isAbort(error) || request.signal.aborted) return;
      setRun({
        status: 'error',
        message: error instanceof ApiError ? error.message : '이동시간을 확인하지 못했어요.',
      });
    }
  }, []);

  const needsCheck = Boolean(meeting?.selectedPlace) && !meeting?.placeRoutes && run.status === 'idle';
  useEffect(() => {
    if (!needsCheck || !meeting) return;
    const timer = setTimeout(() => void check(meeting), 0);
    return () => clearTimeout(timer);
  }, [needsCheck, meeting, check]);

  useEffect(() => () => controller.current?.abort(), []);

  const isLoadingRoutes = run.status === 'loading' || (!meeting?.placeRoutes && run.status === 'idle');
  const showSkeleton = useDelayedLoading(isLoadingRoutes, 180);

  if (!meeting?.selectedPlace) return <FlowLoading title="장소 확인" />;
  const place = meeting.selectedPlace;
  const area = selectedCandidate(meeting);
  const result = meeting.placeRoutes;
  const metrics = result?.metrics ?? null;
  const placesHref = meetingPath(meeting.id, 'places');

  function notify(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  async function copyAddress() {
    haptic('light');
    notify((await copyText(place.address)) ? '주소를 복사했어요.' : '주소를 복사하지 못했어요.');
  }

  function confirm() {
    if (!meeting) return;
    haptic('success');
    meetingActions.confirm(meeting.id);
    router.push(meetingPath(meeting.id, 'done'));
  }

  const bottom =
    run.status === 'loading' || !result ? (
      <button type="button" className={flowStyles.primary} disabled>
        실제 이동시간 확인 중…
      </button>
    ) : metrics ? (
      <>
        <Link href={placesHref} className={flowStyles.secondary}>
          다른 곳
        </Link>
        <button type="button" className={flowStyles.primary} onClick={confirm}>
          여기로 확정하기
        </button>
      </>
    ) : (
      <Link href={placesHref} className={flowStyles.primary}>
        다른 장소 고르기
      </Link>
    );

  return (
    <FlowLayout
      title="장소 확인"
      backHref={placesHref}
      backLabel="주변 장소로"
      step={{ current: stepNumber('place'), total: TOTAL_STEPS }}
      action={
        result && run.status !== 'loading' ? (
          <button
            type="button"
            className={styles.headerAction}
            onClick={() => void check(meeting)}
            aria-label="이동시간 다시 조회"
          >
            <IconRefresh size={18} />
          </button>
        ) : undefined
      }
      bottom={bottom}
    >
      <section className={styles.placeHeaderCard}>
        <span className={styles.placeCategory}>{categoryText(place.category)}</span>
        <h2>{place.name}</h2>
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
          <p className={styles.placeMetaLine}>
            <IconPhone size={13} color="var(--text-muted)" />
            <a href={`tel:${place.phone}`}>{place.phone}</a>
          </p>
        )}
        {place.url && (
          <a className={styles.routeLink} href={place.url} target="_blank" rel="noreferrer">
            카카오맵 장소 정보·후기 보기 ↗
          </a>
        )}
        <MiniMap
          people={meeting.participants}
          destination={place}
          routes={result?.routes}
          height={176}
        />
      </section>

      {run.status === 'error' && (
        <div className={flowStyles.notice} style={{ marginTop: 14 }} role="alert">
          {run.message}{' '}
          <button type="button" className={styles.inlineRetry} onClick={() => void check(meeting)}>
            다시 시도
          </button>
        </div>
      )}

      {showSkeleton && <RouteSkeletonList count={meeting.participants.length} />}

      {result && run.status !== 'loading' && (
        <section className={styles.detail} aria-labelledby="place-times">
          <div className={styles.subTitleRow} style={{ marginTop: 0, marginBottom: 12 }}>
            <h3 id="place-times" style={{ marginBottom: 0 }}>
              이 장소까지 실제 이동시간
            </h3>
            {area && <span className={styles.deltaLegend}>{area.candidate.name} 대비</span>}
          </div>

          {metrics ? (
            <>
              <div className="hero-meta">
                <div className="meta-pill">
                  <span className="meta-score-label">최대</span>
                  <b>
                    <AnimatedNumber value={metrics.maxMinutes} format={minutesText} />
                  </b>
                </div>
                <div className="meta-pill">
                  <span className="meta-score-label">편차</span>
                  <b>
                    <AnimatedNumber value={metrics.gapMinutes} format={minutesText} />
                  </b>
                </div>
                <div className="meta-pill">
                  <span className="meta-score-label">균형도</span>
                  <b>
                    <AnimatedNumber value={balanceScore(metrics)} />
                  </b>
                </div>
              </div>
              <p className={styles.deltaBanner}>
                {balanceLabel(balanceScore(metrics))}
                {area?.metrics
                  ? ` · ${area.candidate.name} 기준 ${maxDeltaText(area.metrics.maxMinutes, metrics.maxMinutes)}`
                  : ''}
              </p>
            </>
          ) : (
            <p className={styles.failInline}>
              <IconAlert size={15} color="var(--accent-red)" />
              일부 참가자의 경로를 찾지 못해 이 장소로는 확정할 수 없어요. 다른 장소를 골라 주세요.
            </p>
          )}

          <TravelTimeList
            people={meeting.participants}
            routes={result.routes}
            baselineRoutes={area?.routes}
          />

          {result.routes[0]?.status === 'ok' && (
            <p className={styles.sourceNote}>
              {formatClock(result.routes[0].fetchedAt)} 조회 · 조회 시점 기준 예상 시간이에요.
            </p>
          )}
        </section>
      )}

      {toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          <span>{toast}</span>
        </div>
      )}
    </FlowLayout>
  );
}
