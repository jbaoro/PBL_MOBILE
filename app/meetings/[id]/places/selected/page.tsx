'use client';
// 5. 장소 상세: 고른 장소까지 모든 참가자의 실제 이동시간을 다시 조회하고, 모두 성공하면 확정한다.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconAlert, IconPhone, IconPin, IconRefresh } from '@/app/components/Icons';
import FlowLayout, { FlowLoading, flowStyles } from '@/components/flow/FlowLayout';
import { TravelTimeList } from '@/components/meeting/ResultBits';
import styles from '@/components/meeting/meeting.module.css';
import {
  balanceLabel, balanceScore, categoryText, formatClock, maxDeltaText, minutesText, participantsForApi,
} from '@/features/meeting/display';
import { TOTAL_STEPS, meetingPath, selectedCandidate, stepNumber, type MeetingDraft } from '@/features/meeting/model';
import { meetingActions } from '@/features/meeting/store';
import { useMeetingStep } from '@/features/meeting/useMeetingStep';
import { ApiError, isAbort, meetpointApi } from '@/lib/api/client';

type RunState = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string };

export default function PlaceDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { meeting } = useMeetingStep(params.id, 'place');
  const [run, setRun] = useState<RunState>({ status: 'idle' });
  const controller = useRef<AbortController>();

  const check = useCallback(async (target: MeetingDraft) => {
    const place = target.selectedPlace;
    if (!place) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setRun({ status: 'loading' });
    try {
      const result = await meetpointApi.routesTo(participantsForApi(target.participants), place, request.signal);
      if (request.signal.aborted) return;
      meetingActions.setPlaceRoutes(target.id, result);
      setRun({ status: 'idle' });
    } catch (error) {
      if (isAbort(error) || request.signal.aborted) return;
      setRun({ status: 'error', message: error instanceof ApiError ? error.message : '이동시간을 확인하지 못했어요.' });
    }
  }, []);

  // 아직 조회하지 않은 장소면 들어오자마자 조회한다. (결과는 저장되어 다시 들어와도 재조회하지 않음)
  const needsCheck = !!meeting?.selectedPlace && !meeting.placeRoutes && run.status === 'idle';
  useEffect(() => {
    if (!needsCheck || !meeting) return;
    const timer = setTimeout(() => void check(meeting), 0);
    return () => clearTimeout(timer);
  }, [needsCheck, meeting, check]);
  useEffect(() => () => controller.current?.abort(), []);

  if (!meeting?.selectedPlace) return <FlowLoading title="장소 확인" />;
  const place = meeting.selectedPlace;
  const area = selectedCandidate(meeting);
  const result = meeting.placeRoutes;
  const metrics = result?.metrics ?? null;
  const placesHref = meetingPath(meeting.id, 'places');

  function confirm() {
    if (!meeting) return;
    meetingActions.confirm(meeting.id);
    router.push(meetingPath(meeting.id, 'done'));
  }

  const bottom = run.status === 'loading' || !result
    ? <button type="button" className={flowStyles.primary} disabled>이동시간 확인 중…</button>
    : metrics
      ? <>
          <Link href={placesHref} className={flowStyles.secondary}>다른 곳</Link>
          <button type="button" className={flowStyles.primary} onClick={confirm}>여기로 확정</button>
        </>
      : <Link href={placesHref} className={flowStyles.primary}>다른 장소 고르기</Link>;

  return (
    <FlowLayout title="장소 확인" backHref={placesHref} backLabel="주변 장소로"
      step={{ current: stepNumber('place'), total: TOTAL_STEPS }}
      action={result && run.status !== 'loading'
        ? <button type="button" className={styles.headerAction} onClick={() => void check(meeting)} aria-label="이동시간 다시 조회"><IconRefresh size={18} /></button>
        : undefined}
      bottom={bottom}>

      <section className={styles.placeHeader}>
        <span className={styles.placeCategory}>{categoryText(place.category)}</span>
        <h2>{place.name}</h2>
        <p className={styles.placeMetaLine}><IconPin size={12} color="#94a3b8" />{place.address}</p>
        {place.phone && <p className={styles.placeMetaLine}><IconPhone size={12} color="#94a3b8" /><a href={`tel:${place.phone}`}>{place.phone}</a></p>}
        {place.url && <a className={styles.routeLink} href={place.url} target="_blank" rel="noreferrer">카카오맵에서 보기 ↗</a>}
      </section>

      {run.status === 'error' && (
        <div className={flowStyles.notice} role="alert">
          {run.message} <button type="button" className={styles.inlineRetry} onClick={() => void check(meeting)}>다시 시도</button>
        </div>
      )}

      {(run.status === 'loading' || (!result && run.status === 'idle')) && (
        <div className={styles.listLoading} role="status"><span className={styles.smallSpinner} aria-hidden="true" />
          참가자 {meeting.participants.length}명의 이동시간을 이 장소 기준으로 다시 확인하고 있어요…</div>
      )}

      {result && run.status !== 'loading' && (
        <section className={styles.detail} aria-labelledby="place-times">
          <h3 id="place-times">이 장소까지 이동시간</h3>
          {metrics ? (
            <>
              <div className="hero-meta">
                <div className="meta-pill"><span className="meta-score-label">최대</span><b>{minutesText(metrics.maxMinutes)}</b></div>
                <div className="meta-divider" />
                <div className="meta-pill"><span className="meta-score-label">차이</span><b>{minutesText(metrics.gapMinutes)}</b></div>
                <div className="meta-divider" />
                <div className="meta-pill"><span className="meta-score-label">균형도</span><b>{balanceScore(metrics)}</b></div>
              </div>
              <p className={styles.balanceHint}>
                {balanceLabel(balanceScore(metrics))}
                {area?.metrics ? ` · ${area.candidate.name}(${maxDeltaText(area.metrics.maxMinutes, metrics.maxMinutes)})` : ''}
              </p>
            </>
          ) : (
            <p className={styles.failInline}><IconAlert size={14} color="#dc2626" />일부 참가자의 경로를 찾지 못해 이 장소로는 확정할 수 없어요. 다른 장소를 골라 주세요.</p>
          )}
          <TravelTimeList people={meeting.participants} routes={result.routes} />
          {result.routes[0]?.status === 'ok' && (
            <p className={styles.sourceNote}>{formatClock(result.routes[0].fetchedAt)} 조회 · 조회 시점 기준 예상 시간이에요.</p>
          )}
        </section>
      )}
    </FlowLayout>
  );
}
