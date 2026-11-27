'use client';
/**
 * 3단계. 추천 지역 (`/meetings/[id]/recommend`)
 *
 * 실사용 편의 기능:
 * - 후보 순위 또는 Canvas 번호 핀 클릭 시 상단 히어로·지도·참가자별 증감(±분) 실시간 동기화
 * - 스크롤 시 상단 고정 요약 바(Sticky Context Bar)로 현재 보는 후보 맥락 유지
 * - 식당을 고르기 전에 '추천 지역만 먼저 단톡방에 공유/복사'하는 1탭 공유 지원
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconAlert,
  IconCheck,
  IconInfo,
  IconRefresh,
  IconShare,
  IconSparkles,
} from '@/app/components/Icons';
import FlowLayout, { FlowLoading, flowStyles } from '@/components/flow/FlowLayout';
import { BalanceRing, MiniMap, TravelTimeList } from '@/components/meeting/ResultBits';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { RecommendProgressView } from '@/components/ui/Skeleton';
import styles from '@/components/meeting/meeting.module.css';
import {
  balanceLabel,
  balanceScore,
  formatClock,
  minutesText,
  participantsForApi,
} from '@/features/meeting/display';
import {
  TOTAL_STEPS,
  meetingPath,
  stepNumber,
  type MeetingDraft,
} from '@/features/meeting/model';
import { meetingActions } from '@/features/meeting/store';
import { useMeetingStep } from '@/features/meeting/useMeetingStep';
import { ApiError, isAbort, meetpointApi } from '@/lib/api/client';
import { haptic } from '@/lib/platform/haptics';
import { buildRecommendShareText } from '@/lib/platform/recommend-share';
import { shareText } from '@/lib/platform/share';
import type { CandidateResult, HubKind } from '@/lib/meetpoint/types';

const HUB_LABEL: Record<HubKind, string> = {
  subway: '지하철역',
  rail: '기차역',
  terminal: '버스터미널',
};
const radiusText = (meters: number) =>
  meters >= 1000 ? `${Math.round(meters / 100) / 10}km` : `${meters}m`;

type RunState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: ApiError };

function errorHelp(error: ApiError): string {
  switch (error.code) {
    case 'NOT_CONFIGURED':
      return '서버에 카카오 API 키가 설정되지 않았어요. .env.local의 KAKAO_REST_API_KEY를 확인해 주세요.';
    case 'PROVIDER_AUTH':
      return '카카오 API 사용 권한을 확인해야 해요. 카카오디벨로퍼스에서 카카오맵 사용 설정을 확인해 주세요.';
    case 'QUOTA_EXCEEDED':
      return '오늘 사용할 수 있는 지도 API 호출 한도를 다 썼어요. 한도가 갱신된 뒤 다시 시도해 주세요.';
    case 'NO_CANDIDATES':
      return '출발지를 가까운 역이나 터미널로 바꾸면 후보를 찾기 쉬워요.';
    default:
      return error.retryable ? '잠시 후 다시 시도해 주세요.' : '참가자 정보를 확인해 주세요.';
  }
}

function deltaLabel(diffMinutes: number): string {
  const rounded = Math.round(diffMinutes);
  if (rounded === 0) return '같음';
  return rounded > 0 ? `+${rounded}분` : `${rounded}분`;
}

function ActiveHeroCard({
  meeting,
  ranked,
  viewing,
  rank,
  onSelectCandidate,
  onShareArea,
}: {
  meeting: MeetingDraft;
  ranked: CandidateResult[];
  viewing: CandidateResult;
  rank: number;
  onSelectCandidate: (candidateId: string) => void;
  onShareArea: () => void;
}) {
  const metrics = viewing.metrics!;
  const balance = balanceScore(metrics);
  const top = ranked[0];
  const topMetrics = top.metrics!;

  return (
    <section className="hero-card" aria-labelledby="active-candidate-title">
      <div className="hero-header">
        <div className="hero-title-group">
          <div className={styles.heroEyebrowRow}>
            <span className="hero-eyebrow" style={{ marginBottom: 0 }}>
              <IconSparkles size={12} color="var(--primary)" />
              {rank === 1 ? '추천 1순위' : `${rank}순위 후보 비교 중`}
            </span>
            <button
              type="button"
              className={styles.areaShareBtn}
              onClick={onShareArea}
              title="추천 지역 요약을 단톡방에 공유"
            >
              <IconShare size={12} />
              <span>지역 공유</span>
            </button>
          </div>
          <h2 id="active-candidate-title" style={{ marginTop: 6 }}>
            {viewing.candidate.name}
          </h2>
          <p className={styles.heroAddress}>{viewing.candidate.address}</p>
        </div>
        <BalanceRing score={balance} />
      </div>

      {rank > 1 && (
        <div className={styles.compareStrip}>
          <span>
            1순위({top.candidate.name}) 대비 최대{' '}
            <b>{deltaLabel(metrics.maxMinutes - topMetrics.maxMinutes)}</b> · 편차{' '}
            <b>{deltaLabel(metrics.gapMinutes - topMetrics.gapMinutes)}</b>
          </span>
          <button
            type="button"
            className={styles.backToTopBtn}
            onClick={() => {
              haptic('light');
              onSelectCandidate(top.candidate.id);
            }}
          >
            1순위로
          </button>
        </div>
      )}

      <p className={styles.balanceHint}>
        <b>{balanceLabel(balance)}</b> · 가장 빠른 사람과 가장 오래 걸리는 사람의 시간 균형 지표예요.
      </p>

      <div className="hero-meta">
        <div className="meta-pill">
          <span className="meta-score-label">최대 소요</span>
          <b>
            <AnimatedNumber value={metrics.maxMinutes} format={minutesText} />
          </b>
        </div>
        <div className="meta-pill">
          <span className="meta-score-label">시간 편차</span>
          <b>
            <AnimatedNumber value={metrics.gapMinutes} format={minutesText} />
          </b>
        </div>
        <div className="meta-pill">
          <span className="meta-score-label">평균 소요</span>
          <b>
            <AnimatedNumber value={metrics.averageMinutes} format={minutesText} />
          </b>
        </div>
      </div>

      <MiniMap
        people={meeting.participants}
        destination={viewing.candidate}
        routes={viewing.routes}
        candidates={ranked}
        onSelectCandidate={onSelectCandidate}
      />
    </section>
  );
}

function CandidateDetail({
  meeting,
  item,
  rank,
  baselineRoutes,
}: {
  meeting: MeetingDraft;
  item: CandidateResult;
  rank: number;
  baselineRoutes?: CandidateResult['routes'];
}) {
  return (
    <section className={styles.detail} aria-labelledby="detail-title">
      <h3 id="detail-title">
        {rank === 1 ? '왜 여기를 1순위로 추천하나요?' : `${rank}순위 · ${item.candidate.name} 분석`}
      </h3>
      {item.reasons && item.reasons.length > 0 && (
        <ul className={styles.reasons}>
          {item.reasons.map((reason) => (
            <li key={reason}>
              <IconCheck size={14} color="var(--accent-green)" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.subTitleRow}>
        <h4 className={styles.subTitle} style={{ margin: 0 }}>
          참가자별 실제 이동시간
        </h4>
        {rank > 1 && <span className={styles.deltaLegend}>1순위 대비 증감</span>}
      </div>
      <TravelTimeList
        people={meeting.participants}
        routes={item.routes}
        baselineRoutes={baselineRoutes}
      />
    </section>
  );
}

export default function RecommendPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { meeting } = useMeetingStep(params.id, 'recommend');
  const [run, setRun] = useState<RunState>({ status: 'idle' });
  const [viewingId, setViewingId] = useState<string>();
  const [stickyBarVisible, setStickyBarVisible] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const heroSentinelRef = useRef<HTMLDivElement | null>(null);
  const controller = useRef<AbortController>();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const recommend = useCallback(async (target: MeetingDraft) => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setRun({ status: 'loading' });
    try {
      const result = await meetpointApi.recommend(
        participantsForApi(target.participants),
        request.signal
      );
      if (request.signal.aborted) return;
      meetingActions.setRecommendation(target.id, result);
      setViewingId(undefined);
      setRun({ status: 'idle' });
    } catch (error) {
      if (isAbort(error) || request.signal.aborted) return;
      setRun({
        status: 'error',
        error:
          error instanceof ApiError
            ? error
            : new ApiError('UPSTREAM_ERROR', '추천을 완료하지 못했어요.', true),
      });
    }
  }, []);

  const needsRun = Boolean(meeting) && !meeting!.recommendation && run.status === 'idle';
  useEffect(() => {
    if (!needsRun || !meeting) return;
    const timer = setTimeout(() => void recommend(meeting), 0);
    return () => clearTimeout(timer);
  }, [needsRun, meeting, recommend]);

  useEffect(() => () => controller.current?.abort(), []);

  // 히어로 카드가 뷰포트 위로 벗어나면 컴팩트 상단 요약 바를 부드럽게 띄운다.
  useEffect(() => {
    const el = heroSentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => setStickyBarVisible(!entry.isIntersecting),
      { rootMargin: '-60px 0px 0px 0px', threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [meeting?.recommendation]);

  if (!meeting) return <FlowLoading title="추천 지역" />;
  const backHref = meetingPath(meeting.id, 'participants');
  const result = meeting.recommendation;

  if (run.status === 'loading' || (!result && run.status === 'idle')) {
    return (
      <FlowLayout
        title="추천 지역"
        backHref={backHref}
        backLabel="참가자 목록으로"
        step={{ current: stepNumber('recommend'), total: TOTAL_STEPS }}
      >
        <RecommendProgressView participantCount={meeting.participants.length} />
      </FlowLayout>
    );
  }

  if (run.status === 'error' && !result) {
    return (
      <FlowLayout
        title="추천 지역"
        backHref={backHref}
        backLabel="참가자 목록으로"
        step={{ current: stepNumber('recommend'), total: TOTAL_STEPS }}
        bottom={
          <>
            <Link href={backHref} className={flowStyles.secondary}>
              참가자 수정
            </Link>
            <button
              type="button"
              className={flowStyles.primary}
              onClick={() => void recommend(meeting)}
            >
              다시 시도
            </button>
          </>
        }
      >
        <div className={styles.failure} role="alert">
          <IconAlert size={30} color="var(--accent-red)" />
          <h2>{run.error.message}</h2>
          <p>{errorHelp(run.error)}</p>
        </div>
      </FlowLayout>
    );
  }

  if (!result) return <FlowLoading title="추천 지역" />;
  const ranked = result.ranked;
  const viewing =
    ranked.find((item) => item.candidate.id === (viewingId ?? meeting.selectedCandidateId)) ??
    ranked[0];
  const viewingRank = viewing ? ranked.indexOf(viewing) + 1 : 0;
  const scope = result.searchScope;

  function goPlaces() {
    if (!viewing || !meeting) return;
    haptic('medium');
    meetingActions.selectCandidate(meeting.id, viewing.candidate.id);
    router.push(meetingPath(meeting.id, 'places'));
  }

  async function shareCurrentArea() {
    if (!viewing || !meeting) return;
    haptic('light');
    const summary = buildRecommendShareText(meeting, viewing, viewingRank);
    const outcome = await shareText(summary, `${meeting.title || '약속'} 추천 지역`);
    if (outcome === 'copied') notify('추천 지역 요약을 복사했어요. 단톡방에 의견을 물어보세요.');
    else if (outcome === 'failed') notify('공유하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }

  return (
    <FlowLayout
      title="추천 지역"
      backHref={backHref}
      backLabel="참가자 목록으로"
      step={{ current: stepNumber('recommend'), total: TOTAL_STEPS }}
      action={
        <button
          type="button"
          className={styles.headerAction}
          onClick={() => {
            haptic('light');
            void recommend(meeting);
          }}
          aria-label="실시간 경로 다시 조회"
        >
          <IconRefresh size={18} />
        </button>
      }
      bottom={
        viewing ? (
          <button type="button" className={flowStyles.primary} onClick={goPlaces}>
            {viewing.candidate.name} 주변 장소 찾기
          </button>
        ) : (
          <Link href={backHref} className={flowStyles.primary}>
            참가자 정보 수정하기
          </Link>
        )
      }
    >
      {viewing && stickyBarVisible && (
        <div className={styles.stickyContextBar} aria-live="polite">
          <strong>
            {viewingRank}순위 · {viewing.candidate.name}
          </strong>
          <span>
            최대 {minutesText(viewing.metrics!.maxMinutes)} · 균형도{' '}
            {balanceScore(viewing.metrics!)}
          </span>
        </div>
      )}

      {run.status === 'error' && (
        <p className={flowStyles.notice} role="alert">
          다시 조회하지 못했어요: {run.error.message} 아래는 이전 결과예요.
        </p>
      )}

      <div className={styles.resultMetaBar}>
        <span className={styles.metaTag}>{scope.tierLabel}</span>
        <span>최대 {scope.maxSpreadKm}km</span>
        <span>·</span>
        <span>후보 {result.searchedCandidateCount}곳 비교</span>
        <span>·</span>
        <span>{formatClock(result.generatedAt)}</span>
      </div>

      {ranked.length === 0 ? (
        <section className={styles.failure}>
          <IconAlert size={30} color="var(--accent-amber)" />
          <h2>모두가 갈 수 있는 후보를 찾지 못했어요</h2>
          <p>아래 제외 사유를 확인하고, 출발지나 이동 수단을 바꿔 다시 추천을 받아 보세요.</p>
        </section>
      ) : (
        <>
          <div ref={heroSentinelRef}>
            {viewing && (
              <ActiveHeroCard
                meeting={meeting}
                ranked={ranked}
                viewing={viewing}
                rank={viewingRank}
                onSelectCandidate={setViewingId}
                onShareArea={() => void shareCurrentArea()}
              />
            )}
          </div>

          <section className="candidates-card" aria-labelledby="ranking-title">
            <div className="section-header">
              <h3 className="section-title" id="ranking-title">
                후보 순위
              </h3>
              <span className="section-subtext">눌러서 지도·증감 비교</span>
            </div>

            <div className="candidates-list">
              {ranked.map((item, index) => {
                const selected = item === viewing;
                return (
                  <button
                    key={item.candidate.id}
                    type="button"
                    aria-pressed={selected}
                    className={`candidate-item ${selected ? 'selected' : ''} ${styles.candidateButton}`}
                    onClick={() => {
                      haptic('light');
                      setViewingId(item.candidate.id);
                    }}
                  >
                    <span className="candidate-rank-info">
                      <span className="rank-badge">{index + 1}</span>
                      <span className={styles.candidateText}>
                        <span className="candidate-name-row">
                          <span className="candidate-name">{item.candidate.name}</span>
                          {item.source === 'origin' && (
                            <span className={styles.sourceTag}>출발지 근처</span>
                          )}
                          {item.source === 'expanded' && (
                            <span className={styles.sourceTag}>범위 확대</span>
                          )}
                        </span>
                        <span className="candidate-fairness-text">
                          최대 {minutesText(item.metrics!.maxMinutes)} · 편차{' '}
                          {minutesText(item.metrics!.gapMinutes)} · 균형도{' '}
                          {balanceScore(item.metrics!)}
                        </span>
                      </span>
                    </span>
                    {selected && (
                      <span className="selected-check-icon">
                        <IconCheck size={13} color="#ffffff" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className={styles.rule}>
              순위 기준: 최대 이동시간 → 참가자 간 시간 편차 → 평균 이동시간
            </p>
          </section>

          {viewing && (
            <CandidateDetail
              meeting={meeting}
              item={viewing}
              rank={viewingRank}
              baselineRoutes={viewingRank > 1 ? ranked[0].routes : undefined}
            />
          )}
        </>
      )}

      <details className={styles.more}>
        <summary>
          어디까지 찾아봤나요? 검색 지역 {scope.areas.length}곳
          {scope.rounds > 1 ? ' · 범위 확대 포함' : ''}
        </summary>
        <ul>
          {scope.areas.map((area, index) => (
            <li key={`${area.label}-${index}`}>
              <strong>{area.label}</strong>
              <span>
                반경 {radiusText(area.radiusMeters)} ·{' '}
                {area.kinds.map((kind) => HUB_LABEL[kind]).join('·')}
              </span>
            </li>
          ))}
        </ul>
        <p>
          검색으로 모은 후보 {scope.collectedCount}곳을 거리로 먼저 추린 뒤, 모든 참가자의 실제
          경로를 조회해 비교했어요.
          {scope.limited
            ? ' 조회 시간과 호출 수 제한으로 일부 후보는 비교하지 못했어요.'
            : ''}
        </p>
      </details>

      {result.excluded.length > 0 && (
        <details className={styles.more} open={ranked.length === 0}>
          <summary>비교에서 제외된 후보 {result.excluded.length}곳</summary>
          <ul>
            {result.excluded.map((item) => (
              <li key={item.candidate.id}>
                <strong>{item.candidate.name}</strong>
                <span className={styles.excludedReason}>{item.exclusionReason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {result.notices.length > 0 && (
        <div className={styles.notices}>
          {result.notices.map((notice) => (
            <p key={notice}>
              <IconInfo size={13} color="var(--text-sub)" />
              <span>{notice}</span>
            </p>
          ))}
        </div>
      )}

      {toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          <span>{toast}</span>
        </div>
      )}
    </FlowLayout>
  );
}
