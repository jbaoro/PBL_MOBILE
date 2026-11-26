'use client';

import { useEffect, useState } from 'react';
import styles from './Skeleton.module.css';

export function PlaceSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className={styles.stack} role="status" aria-label="주변 장소를 불러오는 중">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.placeCard} aria-hidden="true">
          <div className={styles.rowBetween}>
            <span className={`${styles.bone} ${styles.w55}`} style={{ height: 18 }} />
            <span className={`${styles.bone} ${styles.pill}`} />
          </div>
          <span className={`${styles.bone} ${styles.w35}`} style={{ height: 13 }} />
          <span className={`${styles.bone} ${styles.w80}`} style={{ height: 13 }} />
        </div>
      ))}
    </div>
  );
}

export function RouteSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className={styles.routeCard} role="status" aria-label="이동시간을 확인하는 중">
      <div className={styles.metricRow} aria-hidden="true">
        <span className={`${styles.bone} ${styles.metricBox}`} />
        <span className={`${styles.bone} ${styles.metricBox}`} />
        <span className={`${styles.bone} ${styles.metricBox}`} />
      </div>
      <div className={styles.stack} aria-hidden="true">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={styles.timeRow}>
            <span className={`${styles.bone} ${styles.avatar}`} />
            <div className={styles.timeLines}>
              <div className={styles.rowBetween}>
                <span className={`${styles.bone} ${styles.w35}`} style={{ height: 14 }} />
                <span className={`${styles.bone} ${styles.w20}`} style={{ height: 14 }} />
              </div>
              <span className={`${styles.bone} ${styles.w80}`} style={{ height: 7 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PROGRESS_STAGES = [
  '출발지 좌표와 분포 범위를 분석하고 있어요',
  '모두가 모이기 좋은 중간 교통 거점을 찾는 중이에요',
  '참가자별 실제 이동 경로와 소요 시간을 비교하고 있어요',
  '최대 시간과 편차가 가장 적은 순위로 정리하고 있어요',
];

/**
 * 추천 지역 조회 중 체감 대기 시간을 크게 낮추는 인터랙티브 레이더 진행 뷰.
 */
export function RecommendProgressView({ participantCount }: { participantCount: number }) {
  const [elapsedTenths, setElapsedTenths] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      setElapsedTenths(Math.floor((Date.now() - start) / 100));
    }, 100);
    return () => clearInterval(id);
  }, []);

  const seconds = (elapsedTenths / 10).toFixed(1);
  const stageIndex =
    elapsedTenths < 14 ? 0 : elapsedTenths < 36 ? 1 : elapsedTenths < 72 ? 2 : 3;

  return (
    <div className={styles.progressWrap} role="status" aria-live="polite">
      <div className={styles.radarBox} aria-hidden="true">
        <span className={styles.radarRingOuter} />
        <span className={styles.radarRingMid} />
        <span className={styles.radarCore} />
      </div>

      <h2 className={styles.progressTitle}>공평한 중간 지점을 찾고 있어요</h2>
      <p className={styles.progressStage}>{PROGRESS_STAGES[stageIndex]}</p>

      <div className={styles.progressMeta}>
        <span>참가자 {participantCount}명 실제 경로 비교</span>
        <span className="tabular-nums">{seconds}초</span>
      </div>

      <ol className={styles.stageSteps} aria-hidden="true">
        {['분포 분석', '거점 탐색', '실제 경로', '공정성 순위'].map((label, idx) => (
          <li
            key={label}
            className={`${styles.stageStep} ${
              idx < stageIndex ? styles.done : idx === stageIndex ? styles.active : ''
            }`}
          >
            <span className={styles.stageDot} />
            <span>{label}</span>
          </li>
        ))}
      </ol>

      <div className={styles.previewSkeleton} aria-hidden="true">
        <span className={`${styles.bone} ${styles.w55}`} style={{ height: 18 }} />
        <span className={`${styles.bone} ${styles.w80}`} style={{ height: 12 }} />
        <span className={`${styles.bone} ${styles.mapBone}`} />
      </div>
    </div>
  );
}
