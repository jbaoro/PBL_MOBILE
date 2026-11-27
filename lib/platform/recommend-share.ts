import { balanceScore, minutesText } from '@/features/meeting/display';
import type { MeetingDraft } from '@/features/meeting/model';
import type { CandidateResult, Transport } from '@/lib/meetpoint/types';

const TRANSPORT_LABEL: Record<Transport, string> = {
  transit: '대중교통',
  car: '자동차',
  walk: '도보',
};

/**
 * 3단계 추천 지역 단계에서 식당을 고르기 전,
 * 단톡방에 '어느 역/지역에서 만날지' 먼저 의견을 물어보기 위한 요약 텍스트.
 * 출발지 주소는 개인정보 보호를 위해 넣지 않는다.
 */
export function buildRecommendShareText(
  meeting: MeetingDraft,
  candidate: CandidateResult,
  rank: number
): string {
  const lines: string[] = [
    `[MeetPoint 추천 지역 ${rank}순위] ${meeting.title || '약속'}`,
    '',
    `후보 지역: ${candidate.candidate.name}`,
    `주소: ${candidate.candidate.address}`,
  ];

  if (candidate.metrics) {
    lines.push(
      `균형도 ${balanceScore(candidate.metrics)}점 · 최대 ${minutesText(candidate.metrics.maxMinutes)} · 편차 ${minutesText(candidate.metrics.gapMinutes)} · 평균 ${minutesText(candidate.metrics.averageMinutes)}`
    );
  }

  lines.push('', '참가자별 예상 이동시간');
  for (const person of meeting.participants) {
    const route = candidate.routes.find((r) => r.participantId === person.id);
    const time = route?.status === 'ok' ? minutesText(route.durationMinutes) : '확인 불가';
    lines.push(`- ${person.name}(${TRANSPORT_LABEL[person.transport]}) ${time}`);
  }

  lines.push('', '여기 근처에서 만나는 건 어때요?');
  return lines.join('\n');
}
