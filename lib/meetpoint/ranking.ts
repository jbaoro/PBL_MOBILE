/**
 * 공정성 지표와 순위. 추천의 핵심 기준이 이 파일에 있다.
 *
 * 지표 (모두 반올림 전 분 단위)
 * - 최대(maxMinutes): 가장 오래 걸리는 사람의 시간
 * - 차이(gapMinutes): 가장 오래 걸리는 사람 - 가장 빨리 오는 사람
 * - 평균(averageMinutes): 전체 평균
 * 순위: 최대가 작은 순 → 차이가 작은 순 → 평균이 작은 순 → 후보 id 순(결과가 매번 같도록)
 * 즉 '한 사람만 너무 멀리 오는 곳'을 가장 먼저 피한다.
 */
import type { CandidateResult, Metrics, Participant, RouteResult, RouteSuccess } from './types';

/**
 * 한 후보의 지표. 모든 참가자의 경로가 정확히 한 번씩 성공했을 때만 계산하고, 아니면 null.
 * (실패한 경로를 0분으로 치거나 그 참가자를 빼고 계산하지 않는다)
 */
export function calculateMetrics(routes: RouteResult[], people: Participant[]): Metrics | null {
  if (people.length < 2 || routes.length !== people.length) return null;
  const expected = new Set(people.map((person) => person.id));
  if (expected.size !== people.length || new Set(routes.map((route) => route.participantId)).size !== people.length) return null;
  if (routes.some((route) => route.status !== 'ok' || !expected.has(route.participantId) ||
      !Number.isFinite(route.durationMinutes) || route.durationMinutes < 0)) return null;
  const values = (routes as RouteSuccess[]).map((route) => route.durationMinutes);
  const maxMinutes = Math.max(...values);
  return {
    maxMinutes,
    gapMinutes: maxMinutes - Math.min(...values),
    averageMinutes: values.reduce((sum, value) => sum + value, 0) / values.length,
  };
}

/** 지표가 있는 후보는 순위대로(ranked), 지표가 없는(경로 실패가 있는) 후보는 제외 목록(excluded)으로 나눈다. */
export function rankCandidates(candidates: CandidateResult[]) {
  const ranked = candidates.filter((item) => item.metrics !== null).sort((a, b) => {
    const left = a.metrics!;
    const right = b.metrics!;
    return left.maxMinutes - right.maxMinutes || left.gapMinutes - right.gapMinutes ||
      left.averageMinutes - right.averageMinutes || (a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0);
  });
  return { ranked, excluded: candidates.filter((item) => item.metrics === null) };
}
