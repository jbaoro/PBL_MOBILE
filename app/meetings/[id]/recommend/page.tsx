'use client';
// 3. 추천 지역: 추천 실행 → 1순위 카드(균형도·지표·참가자별 시간) → 후보 순위 → 검색 범위·제외 후보 → 장소 찾기
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconAlert, IconClock, IconInfo, IconRefresh, IconSparkles, IconCheck } from '@/app/components/Icons';
import FlowLayout, { FlowLoading, flowStyles } from '@/components/flow/FlowLayout';
import { MiniMap, TravelTimeList } from '@/components/meeting/ResultBits';
import styles from '@/components/meeting/meeting.module.css';
import { balanceLabel, balanceScore, formatClock, minutesText, participantsForApi } from '@/features/meeting/display';
import { TOTAL_STEPS, meetingPath, stepNumber, type MeetingDraft } from '@/features/meeting/model';
import { meetingActions } from '@/features/meeting/store';
import { useMeetingStep } from '@/features/meeting/useMeetingStep';
import { ApiError, isAbort, meetpointApi } from '@/lib/api/client';
import type { CandidateResult, HubKind } from '@/lib/meetpoint/types';

const HUB_LABEL: Record<HubKind, string> = { subway: '지하철역', rail: '기차역', terminal: '버스터미널' };
const radiusText = (meters: number) => (meters >= 1000 ? `${Math.round(meters / 100) / 10}km` : `${meters}m`);

type RunState = { status: 'idle' } | { status: 'loading' } | { status: 'error'; error: ApiError };

function errorHelp(error: ApiError): string {
  switch (error.code) {
    case 'NOT_CONFIGURED': return '서버에 카카오 API 키가 설정되지 않았어요. .env.local의 KAKAO_REST_API_KEY를 확인해 주세요.';
    case 'PROVIDER_AUTH': return '카카오 API 사용 권한을 확인해야 해요. 카카오디벨로퍼스에서 카카오맵 사용 설정을 확인해 주세요.';
    case 'QUOTA_EXCEEDED': return '오늘 사용할 수 있는 지도 API 호출 한도를 다 썼어요. 한도가 갱신된 뒤 다시 시도해 주세요.';
    case 'NO_CANDIDATES': return '출발지를 가까운 역이나 터미널로 바꾸면 후보를 찾기 쉬워요.';
    default: return error.retryable ? '잠시 후 다시 시도해 주세요.' : '참가자 정보를 확인해 주세요.';
  }
}

function TopCard({ meeting, item }: { meeting: MeetingDraft; item: CandidateResult }) {
  const metrics = item.metrics!;
  const balance = balanceScore(metrics);
  return (
    <section className="hero-card" aria-labelledby="top-candidate">
      <div className="hero-header">
        <div className="hero-title-group">
          <span className="hero-eyebrow"><IconSparkles size={13} color="#2563eb" />추천 1순위</span>
          <h2 id="top-candidate">{item.candidate.name}</h2>
          <p className={styles.heroAddress}>{item.candidate.address}</p>
        </div>
        <div className="badge-fairness" title="가장 빨리 오는 사람 시간 ÷ 가장 오래 걸리는 사람 시간">
          <span className="badge-label">균형도</span>
          <span className="badge-value">{balance}</span>
        </div>
      </div>
      <div className="fairness-meter" role="meter" aria-label="이동시간 균형도" aria-valuemin={0} aria-valuemax={100} aria-valuenow={balance}>
        <div className="fairness-meter-bar" style={{ width: `${balance}%` }} />
      </div>
      <p className={styles.balanceHint}>{balanceLabel(balance)} · 가장 빨리 오는 사람과 가장 오래 걸리는 사람의 시간 비율이에요.</p>
      <div className="hero-meta">
        <div className="meta-pill"><span className="meta-score-label">최대</span><b>{minutesText(metrics.maxMinutes)}</b></div>
        <div className="meta-divider" />
        <div className="meta-pill"><span className="meta-score-label">차이</span><b>{minutesText(metrics.gapMinutes)}</b></div>
        <div className="meta-divider" />
        <div className="meta-pill"><IconClock size={14} color="#64748b" /><span>평균 <b>{minutesText(metrics.averageMinutes)}</b></span></div>
      </div>
      <MiniMap people={meeting.participants} destination={item.candidate} />
    </section>
  );
}

function CandidateDetail({ meeting, item, rank }: { meeting: MeetingDraft; item: CandidateResult; rank: number }) {
  return (
    <section className={styles.detail} aria-labelledby="detail-title">
      <h3 id="detail-title">{rank === 1 ? '왜 여기를 추천하나요?' : `${rank}순위 ${item.candidate.name}`}</h3>
      {item.reasons && item.reasons.length > 0 && (
        <ul className={styles.reasons}>{item.reasons.map((reason) => <li key={reason}><IconCheck size={13} color="#059669" />{reason}</li>)}</ul>
      )}
      <h4 className={styles.subTitle}>참가자별 이동시간</h4>
      <TravelTimeList people={meeting.participants} routes={item.routes} />
    </section>
  );
}

export default function RecommendPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { meeting } = useMeetingStep(params.id, 'recommend');
  const [run, setRun] = useState<RunState>({ status: 'idle' });
  const [viewingId, setViewingId] = useState<string>();
  const controller = useRef<AbortController>();

  const recommend = useCallback(async (target: MeetingDraft) => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setRun({ status: 'loading' });
    try {
      const result = await meetpointApi.recommend(participantsForApi(target.participants), request.signal);
      if (request.signal.aborted) return;
      meetingActions.setRecommendation(target.id, result);
      setViewingId(undefined);
      setRun({ status: 'idle' });
    } catch (error) {
      if (isAbort(error) || request.signal.aborted) return;
      setRun({ status: 'error', error: error instanceof ApiError ? error : new ApiError('UPSTREAM_ERROR', '추천을 완료하지 못했어요.', true) });
    }
  }, []);

  // 추천 결과가 없으면 화면에 들어오자마자 실행한다.
  // (개발 모드의 두 번 실행을 피하려고 다음 틱에 시작하고, 화면을 떠나면 취소)
  const needsRun = !!meeting && !meeting.recommendation && run.status === 'idle';
  useEffect(() => {
    if (!needsRun || !meeting) return;
    const timer = setTimeout(() => void recommend(meeting), 0);
    return () => clearTimeout(timer);
  }, [needsRun, meeting, recommend]);
  useEffect(() => () => controller.current?.abort(), []);

  if (!meeting) return <FlowLoading title="추천 지역" />;
  const backHref = meetingPath(meeting.id, 'participants');
  const result = meeting.recommendation;

  // 실행 중
  if (run.status === 'loading' || (!result && run.status === 'idle')) {
    return (
      <FlowLayout title="추천 지역" backHref={backHref} backLabel="참가자 목록으로"
        step={{ current: stepNumber('recommend'), total: TOTAL_STEPS }}>
        <div className={styles.running} role="status">
          <span className={styles.bigSpinner} aria-hidden="true" />
          <h2>만나기 좋은 곳을 찾고 있어요</h2>
          <p>후보 지역을 모은 뒤, 참가자 {meeting.participants.length}명의 실제 경로를 하나씩 비교하고 있어요.</p>
          <p className={styles.runningHint}>거리가 멀면 최대 1분 정도 걸릴 수 있어요.</p>
        </div>
      </FlowLayout>
    );
  }

  // 실패 (이전 결과가 없을 때)
  if (run.status === 'error' && !result) {
    return (
      <FlowLayout title="추천 지역" backHref={backHref} backLabel="참가자 목록으로"
        step={{ current: stepNumber('recommend'), total: TOTAL_STEPS }}
        bottom={<>
          <Link href={backHref} className={flowStyles.secondary}>참가자 수정</Link>
          <button type="button" className={flowStyles.primary} onClick={() => void recommend(meeting)}>다시 시도</button>
        </>}>
        <div className={styles.failure} role="alert">
          <IconAlert size={28} color="#dc2626" />
          <h2>{run.error.message}</h2>
          <p>{errorHelp(run.error)}</p>
        </div>
      </FlowLayout>
    );
  }

  if (!result) return <FlowLoading title="추천 지역" />;
  const ranked = result.ranked;
  const viewing = ranked.find((item) => item.candidate.id === (viewingId ?? meeting.selectedCandidateId)) ?? ranked[0];
  const viewingRank = viewing ? ranked.indexOf(viewing) + 1 : 0;
  const scope = result.searchScope;

  function goPlaces() {
    if (!viewing || !meeting) return;
    meetingActions.selectCandidate(meeting.id, viewing.candidate.id);
    router.push(meetingPath(meeting.id, 'places'));
  }

  return (
    <FlowLayout title="추천 지역" backHref={backHref} backLabel="참가자 목록으로"
      step={{ current: stepNumber('recommend'), total: TOTAL_STEPS }}
      action={<button type="button" className={styles.headerAction} onClick={() => void recommend(meeting)} aria-label="다시 조회">
        <IconRefresh size={18} /></button>}
      bottom={viewing
        ? <button type="button" className={flowStyles.primary} onClick={goPlaces}>{viewing.candidate.name} 근처 장소 찾기</button>
        : <Link href={backHref} className={flowStyles.primary}>참가자 정보 수정하기</Link>}>

      {run.status === 'error' && <p className={flowStyles.notice} role="alert">다시 조회하지 못했어요: {run.error.message} 아래는 이전 결과예요.</p>}

      <p className={styles.resultMeta}>
        {scope.tierLabel} · 참가자 간 최대 {scope.maxSpreadKm}km · 후보 {result.searchedCandidateCount}곳 비교 · {formatClock(result.generatedAt)} 조회
      </p>

      {ranked.length === 0 ? (
        <section className={styles.failure}>
          <IconAlert size={28} color="#d97706" />
          <h2>모두가 갈 수 있는 후보를 찾지 못했어요</h2>
          <p>아래 제외 사유를 확인하고, 출발지나 이동 수단을 바꿔 다시 추천을 받아 보세요.</p>
        </section>
      ) : (
        <>
          <TopCard meeting={meeting} item={ranked[0]} />

          <section className="candidates-card" aria-labelledby="ranking-title">
            <div className="section-header">
              <h3 className="section-title" id="ranking-title">후보 순위</h3>
              <span className="section-subtext">눌러서 자세히 보기</span>
            </div>
            <div className="candidates-list">
              {ranked.map((item, index) => {
                const selected = item === viewing;
                return (
                  <button key={item.candidate.id} type="button" aria-pressed={selected}
                    className={`candidate-item ${selected ? 'selected' : ''} ${styles.candidateButton}`}
                    onClick={() => setViewingId(item.candidate.id)}>
                    <span className="candidate-rank-info">
                      <span className="rank-badge">{index + 1}</span>
                      <span className={styles.candidateText}>
                        <span className="candidate-name-row">
                          <span className="candidate-name">{item.candidate.name}</span>
                          {item.source === 'origin' && <span className={styles.sourceTag}>출발지 근처</span>}
                          {item.source === 'expanded' && <span className={styles.sourceTag}>범위 확대</span>}
                        </span>
                        <span className="candidate-fairness-text">
                          최대 {minutesText(item.metrics!.maxMinutes)} · 차이 {minutesText(item.metrics!.gapMinutes)} · 균형도 {balanceScore(item.metrics!)}
                        </span>
                      </span>
                    </span>
                    {selected && <span className="selected-check-icon"><IconCheck size={14} color="#ffffff" /></span>}
                  </button>
                );
              })}
            </div>
            <p className={styles.rule}>순위 기준: 가장 오래 걸리는 사람의 시간 → 참가자 간 시간 차이 → 평균 시간</p>
          </section>

          {viewing && <CandidateDetail meeting={meeting} item={viewing} rank={viewingRank} />}
        </>
      )}

      <details className={styles.more}>
        <summary>어디까지 찾아봤나요? 검색 지역 {scope.areas.length}곳{scope.rounds > 1 ? ' · 범위 확대 포함' : ''}</summary>
        <ul>{scope.areas.map((area, index) => (
          <li key={`${area.label}-${index}`}><strong>{area.label}</strong><span>반경 {radiusText(area.radiusMeters)} · {area.kinds.map((kind) => HUB_LABEL[kind]).join('·')}</span></li>
        ))}</ul>
        <p>검색으로 모은 후보 {scope.collectedCount}곳을 거리로 먼저 추린 뒤, 모든 참가자의 실제 경로를 조회해 비교했어요.
          {scope.limited ? ' 조회 시간과 호출 수 제한으로 일부 후보는 비교하지 못했어요.' : ''}</p>
      </details>

      {result.excluded.length > 0 && (
        <details className={styles.more} open={ranked.length === 0}>
          <summary>비교에서 제외된 후보 {result.excluded.length}곳</summary>
          <ul>{result.excluded.map((item) => (
            <li key={item.candidate.id}><strong>{item.candidate.name}</strong><span className={styles.excludedReason}>{item.exclusionReason}</span></li>
          ))}</ul>
        </details>
      )}

      {result.notices.length > 0 && (
        <div className={styles.notices}>
          {result.notices.map((notice) => <p key={notice}><IconInfo size={13} color="#64748b" />{notice}</p>)}
        </div>
      )}
    </FlowLayout>
  );
}
