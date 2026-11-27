'use client';
/**
 * 추천 결과 표시 조각 (3단계 추천 지역, 5단계 장소 확인, 6단계 확정에서 사용)
 * - MiniMap: 60fps HiDPI 인터랙티브 위치·경로 시각화 Canvas
 * - BalanceRing: SVG 원형 균형도 게이지
 * - TravelTimeList: GPU 가속(scaleX) 참가자별 이동시간 비교 막대 + 기준 대비 증감(±분) 배지
 */
import React from 'react';
import { AvatarInitial, TransportIcon } from './ParticipantBits';
import { InteractiveRouteMap } from './InteractiveRouteMap';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { distanceText, minutesText } from '@/features/meeting/display';
import type { MeetingParticipant } from '@/features/meeting/model';
import type { CandidateResult, Location, RouteResult } from '@/lib/meetpoint/types';
import styles from './meeting.module.css';

export function MiniMap({
  people,
  destination,
  routes,
  candidates,
  onSelectCandidate,
  height = 204,
}: {
  people: MeetingParticipant[];
  destination: Location;
  routes?: RouteResult[];
  candidates?: CandidateResult[];
  onSelectCandidate?: (candidateId: string) => void;
  height?: number;
}) {
  return (
    <InteractiveRouteMap
      people={people}
      destination={destination}
      routes={routes}
      candidates={candidates}
      onSelectCandidate={onSelectCandidate}
      height={height}
      caption="실제 좌표 기준 위치 관계예요. 소요 시간은 카카오 실측 경로 기준이에요."
    />
  );
}

/** SVG 원형 균형도 링 게이지 */
export const BalanceRing = React.memo(function BalanceRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const r = 24;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - clamped / 100);
  const stroke = clamped >= 75 ? '#10b981' : clamped >= 55 ? '#3b82f6' : '#f59e0b';
  const track = clamped >= 75 ? 'rgba(16,185,129,0.18)' : clamped >= 55 ? 'rgba(59,130,246,0.18)' : 'rgba(245,158,11,0.18)';

  return (
    <div
      className={styles.balanceRing}
      role="meter"
      aria-label="이동시간 균형도"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      title="가장 빨리 오는 사람 시간 ÷ 가장 오래 걸리는 사람 시간"
    >
      <svg width="62" height="62" viewBox="0 0 62 62" aria-hidden="true">
        <circle cx="31" cy="31" r={r} fill="none" stroke={track} strokeWidth="5.5" />
        <circle
          cx="31"
          cy="31"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 31 31)"
          style={{
            transition:
              'stroke-dashoffset 0.45s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.25s ease',
          }}
        />
      </svg>
      <div className={styles.balanceRingCenter}>
        <strong style={{ color: stroke }}>
          <AnimatedNumber value={clamped} />
        </strong>
        <span>균형도</span>
      </div>
    </div>
  );
});

/**
 * 참가자별 이동시간: GPU scaleX 애니메이션 막대 + 평균 기준선 + 거리 + 상세 경로 링크.
 * baselineRoutes가 주어지면(예: 1순위 대비 2순위 비교, 또는 역 대비 실제 식당 비교)
 * 각 참가자 옆에 ±분 증감 배지를 표시해 직관적인 의사결정을 돕는다.
 */
export const TravelTimeList = React.memo(function TravelTimeList({
  people,
  routes,
  baselineRoutes,
}: {
  people: MeetingParticipant[];
  routes: RouteResult[];
  baselineRoutes?: RouteResult[];
}) {
  const okMinutes = routes
    .filter((r): r is Extract<RouteResult, { status: 'ok' }> => r.status === 'ok')
    .map((r) => r.durationMinutes);
  const longest = Math.max(1, ...okMinutes);
  const shortest = okMinutes.length > 1 ? Math.min(...okMinutes) : -1;
  const avg =
    okMinutes.length > 1
      ? okMinutes.reduce((sum, v) => sum + v, 0) / okMinutes.length
      : null;
  const avgRatio = avg !== null ? Math.min(100, (avg / longest) * 100) : null;

  return (
    <ul className={styles.times}>
      {people.map((person) => {
        const route = routes.find((item) => item.participantId === person.id);
        const ok = route?.status === 'ok' ? route : undefined;
        const baseRoute = baselineRoutes?.find((item) => item.participantId === person.id);
        const baseOk = baseRoute?.status === 'ok' ? baseRoute : undefined;
        const deltaMin =
          ok && baseOk ? Math.round(ok.durationMinutes - baseOk.durationMinutes) : null;

        const isLongest = ok && okMinutes.length > 1 && ok.durationMinutes === longest;
        const isShortest =
          ok && okMinutes.length > 1 && ok.durationMinutes === shortest && !isLongest;
        const ratio = ok ? Math.max(0.05, Math.min(1, ok.durationMinutes / longest)) : 0;
        const distLabel = ok ? distanceText(ok.distanceMeters) : null;

        return (
          <li key={person.id} className={styles.timeRow}>
            <AvatarInitial name={person.name} color={person.color} size={36} />
            <div className={styles.timeBody}>
              <div className={styles.timeHead}>
                <strong className={styles.timeName}>{person.name}</strong>
                <span className={styles.timeMode}>
                  <TransportIcon transport={person.transport} size={12} />
                </span>
                {isLongest && <span className={styles.tagLongest}>최장</span>}
                {isShortest && <span className={styles.tagFastest}>최단</span>}
                {distLabel && <span className={styles.timeDist}>{distLabel}</span>}

                {ok ? (
                  <span className={styles.timeRight}>
                    {deltaMin !== null && deltaMin !== 0 && (
                      <span
                        className={deltaMin < 0 ? styles.deltaFaster : styles.deltaSlower}
                        title="기준 대비 시간 변화"
                      >
                        {deltaMin > 0 ? `+${deltaMin}분` : `${deltaMin}분`}
                      </span>
                    )}
                    <b className={`${styles.timeValue} ${isLongest ? styles.timeLongest : ''}`}>
                      <AnimatedNumber value={ok.durationMinutes} format={minutesText} />
                    </b>
                  </span>
                ) : (
                  <b className={styles.timeFail}>조회 실패</b>
                )}
              </div>

              {ok ? (
                <div className={styles.track} aria-hidden="true">
                  <span
                    className={`${styles.trackFill} ${isLongest ? styles.trackLongest : ''}`}
                    style={{ transform: `scaleX(${ratio})` }}
                  />
                  {avgRatio !== null && (
                    <i
                      className={styles.avgMarker}
                      style={{ left: `${avgRatio}%` }}
                      title={`평균 ${minutesText(avg!)}`}
                    />
                  )}
                </div>
              ) : (
                <p className={styles.timeError}>
                  {route?.status === 'error' ? route.error.message : '경로를 확인하지 못했어요.'}
                </p>
              )}

              {ok?.url && (
                <a className={styles.routeLink} href={ok.url} target="_blank" rel="noreferrer">
                  카카오맵 상세 경로 ↗
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
});
