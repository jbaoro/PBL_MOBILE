import type { CandidateResult, Metrics, Participant, RouteResult, RouteSuccess } from './types';

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

export function rankCandidates(candidates: CandidateResult[]) {
  const ranked = candidates.filter((item) => item.metrics !== null).sort((a, b) => {
    const left = a.metrics!;
    const right = b.metrics!;
    return left.maxMinutes - right.maxMinutes || left.gapMinutes - right.gapMinutes ||
      left.averageMinutes - right.averageMinutes || (a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0);
  });
  return { ranked, excluded: candidates.filter((item) => item.metrics === null) };
}
