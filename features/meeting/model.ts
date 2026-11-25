/**
 * 약속 하나(MeetingDraft)의 데이터 구조와 단계 규칙.
 * 화면·브라우저 API에 의존하지 않는 순수 함수만 둔다. (나중에 앱에서도 그대로 재사용)
 *
 * 핵심 규칙
 * 1. 단계는 info → participants → recommend → places → place → done 순서로 진행한다.
 *    앞 단계가 끝나지 않으면 뒤 단계에 들어갈 수 없다. (blockingStep)
 * 2. 앞 단계 값이 바뀌면 그 뒤 단계 결과를 지운다. (clearFrom)
 *    예) 출발지를 바꾸면 추천·지역 선택·장소·장소까지 시간·확정이 모두 지워진다.
 * 3. 변경 함수는 원래 객체를 고치지 않고 새 객체를 돌려준다. 바뀐 게 없으면 원래 객체를 그대로 돌려준다.
 */
import type { CandidateResult, Location, Participant, Place, RecommendationResult } from '../../lib/meetpoint/types';
import { MAX_PARTICIPANTS } from '../../lib/meetpoint/validation';

/** 추천을 받으려면 최소 2명 (최대 인원은 서버 검증과 같은 값을 쓴다) */
export const MIN_PARTICIPANTS = 2;
export { MAX_PARTICIPANTS };
/** 기기 저장소 키와 저장 형식 버전. 형식이 바뀌면 버전을 올리고 parseStoredMeetings 에서 변환한다. */
export const STORAGE_KEY = 'meetpoint.meetings';
export const STORAGE_VERSION = 1;

/** 약속 안의 참가자. API로 보낼 때는 color가 빠지고 Participant 필드만 사용된다. */
export type MeetingParticipant = Participant & { color?: string };

/** 약속 하나. 입력값(제목·일시·참가자)과 단계별 결과(추천·선택·장소까지 시간·확정)를 모두 담는다. */
export type MeetingDraft = {
  id: string;
  title: string;
  scheduledAt?: string;                 // 'YYYY-MM-DDTHH:mm' (로컬 시각)
  participants: MeetingParticipant[];
  recommendation?: RecommendationResult; // 3. 추천 지역 결과
  selectedCandidateId?: string;          // 3 → 4
  selectedPlace?: Place;                 // 4 → 5
  placeRoutes?: CandidateResult;         // 5. 선택 장소까지 재조회 결과
  confirmedAt?: string;                  // 6. 확정 시각
  createdAt: string;
  updatedAt: string;
};

/** 흐름 단계. 순서가 곧 진행 순서다. */
export const FLOW_STEPS = ['info', 'participants', 'recommend', 'places', 'place', 'done'] as const;
export type FlowStep = (typeof FLOW_STEPS)[number];
export const TOTAL_STEPS = FLOW_STEPS.length;
/** 진행 막대에 쓰는 단계 번호 (1부터) */
export const stepNumber = (step: FlowStep) => FLOW_STEPS.indexOf(step) + 1;

/** 단계별 화면 주소. step 이 없으면 약속 주소(이어서 할 단계로 보내는 페이지) */
export function meetingPath(id: string, step?: FlowStep): string {
  const base = `/meetings/${encodeURIComponent(id)}`;
  if (!step) return base;
  if (step === 'place') return `${base}/places/selected`;
  return `${base}/${step}`;
}

/** 빈 약속 (제목·참가자 없음) */
export function createMeeting(id: string, now: string): MeetingDraft {
  return { id, title: '', participants: [], createdAt: now, updatedAt: now };
}

// ── 단계 진입 조건 ─────────────────────────────────────────────

/** 해당 단계에 들어가기 위해 먼저 끝내야 하는 단계. 들어갈 수 있으면 null. */
export function blockingStep(meeting: MeetingDraft, step: FlowStep): FlowStep | null {
  const requirements: Record<FlowStep, () => FlowStep | null> = {
    info: () => null,
    participants: () => (meeting.title.trim() ? null : 'info'),
    recommend: () => requirements.participants() ?? (meeting.participants.length >= MIN_PARTICIPANTS ? null : 'participants'),
    places: () => requirements.recommend() ?? (selectedCandidate(meeting) ? null : 'recommend'),
    place: () => requirements.places() ?? (meeting.selectedPlace ? null : 'places'),
    done: () => requirements.place() ?? (meeting.confirmedAt && meeting.placeRoutes ? null : 'place'),
  };
  return requirements[step]();
}

/** 저장된 약속을 다시 열 때 이어서 할 단계. */
export function resumeStep(meeting: MeetingDraft): FlowStep {
  for (let index = FLOW_STEPS.length - 1; index >= 0; index--) {
    if (blockingStep(meeting, FLOW_STEPS[index]) === null) return FLOW_STEPS[index];
  }
  return 'info';
}

/** 약속 목록 뱃지용 상태: 작성 중 / 추천 준비 완료 / 추천 완료 / 확정 */
export type MeetingStatus = 'draft' | 'ready' | 'recommended' | 'confirmed';
export function meetingStatus(meeting: MeetingDraft): MeetingStatus {
  if (meeting.confirmedAt) return 'confirmed';
  if (meeting.recommendation) return 'recommended';
  if (blockingStep(meeting, 'recommend') === null) return 'ready';
  return 'draft';
}

/** 3단계에서 고른 추천 지역(순위 목록 안의 후보). 추천이 다시 실행되면 사라진다. */
export function selectedCandidate(meeting: MeetingDraft): CandidateResult | undefined {
  if (!meeting.recommendation || !meeting.selectedCandidateId) return undefined;
  return meeting.recommendation.ranked.find((item) => item.candidate.id === meeting.selectedCandidateId);
}

// ── 변경 함수 (앞 단계가 바뀌면 뒤 단계 결과를 지운다) ─────────────

type Downstream = 'recommendation' | 'candidate' | 'place' | 'placeRoutes';
/** from 단계부터 그 뒤 결과를 모두 지운다. 확정도 항상 해제한다. */
function clearFrom(meeting: MeetingDraft, from: Downstream): MeetingDraft {
  const next = { ...meeting };
  const order: Downstream[] = ['recommendation', 'candidate', 'place', 'placeRoutes'];
  for (const key of order.slice(order.indexOf(from))) {
    if (key === 'recommendation') delete next.recommendation;
    if (key === 'candidate') delete next.selectedCandidateId;
    if (key === 'place') delete next.selectedPlace;
    if (key === 'placeRoutes') delete next.placeRoutes;
  }
  delete next.confirmedAt;
  return next;
}

/** 수정 시각 갱신 (약속 목록을 최근 수정 순으로 정렬할 때 사용) */
const touch = (meeting: MeetingDraft, now: string): MeetingDraft => ({ ...meeting, updatedAt: now });

/** 1단계 저장. 제목·일시는 이동시간과 무관하므로 뒤 단계 결과를 지우지 않는다. */
export function updateInfo(meeting: MeetingDraft, info: { title: string; scheduledAt?: string }, now: string): MeetingDraft {
  const next: MeetingDraft = { ...meeting, title: info.title.trim().slice(0, 40) };
  if (info.scheduledAt) next.scheduledAt = info.scheduledAt; else delete next.scheduledAt;
  return touch(next, now);
}

/** 경로 계산에 영향을 주는 값(출발지·이동수단)이 달라졌는지. 이름만 바뀌면 결과를 유지한다. */
function affectsRoutes(before: Participant, after: Participant): boolean {
  return before.transport !== after.transport || before.origin.id !== after.origin.id ||
    before.origin.lat !== after.origin.lat || before.origin.lng !== after.origin.lng;
}

/** 참가자 추가 또는 수정. 출발지·이동수단이 바뀌거나 사람이 늘면 추천부터 다시 받아야 한다. 최대 인원이면 추가하지 않는다. */
export function upsertParticipant(meeting: MeetingDraft, person: MeetingParticipant, now: string): MeetingDraft {
  const index = meeting.participants.findIndex((item) => item.id === person.id);
  if (index < 0) {
    if (meeting.participants.length >= MAX_PARTICIPANTS) return meeting;
    return touch(clearFrom({ ...meeting, participants: [...meeting.participants, person] }, 'recommendation'), now);
  }
  const participants = meeting.participants.map((item) => (item.id === person.id ? person : item));
  const changed = affectsRoutes(meeting.participants[index], person);
  return touch(changed ? clearFrom({ ...meeting, participants }, 'recommendation') : { ...meeting, participants }, now);
}

/** 참가자 빼기 → 추천부터 다시 */
export function removeParticipant(meeting: MeetingDraft, participantId: string, now: string): MeetingDraft {
  if (!meeting.participants.some((item) => item.id === participantId)) return meeting;
  const participants = meeting.participants.filter((item) => item.id !== participantId);
  return touch(clearFrom({ ...meeting, participants }, 'recommendation'), now);
}

/** 3단계 추천 결과 저장. 새 결과이므로 이전 지역 선택·장소·확정은 지운다. */
export function setRecommendation(meeting: MeetingDraft, result: RecommendationResult, now: string): MeetingDraft {
  return touch({ ...clearFrom(meeting, 'recommendation'), recommendation: result }, now);
}

/** 3단계에서 지역 선택. 추천 결과에 없는 후보는 무시한다. 다른 지역을 고르면 장소부터 다시. */
export function selectCandidateId(meeting: MeetingDraft, candidateId: string, now: string): MeetingDraft {
  if (meeting.selectedCandidateId === candidateId) return meeting;
  if (!meeting.recommendation?.ranked.some((item) => item.candidate.id === candidateId)) return meeting;
  return touch({ ...clearFrom(meeting, 'candidate'), selectedCandidateId: candidateId }, now);
}

/** 4단계에서 장소 선택. 다른 장소를 고르면 장소까지 시간·확정은 지운다. */
export function selectPlace(meeting: MeetingDraft, place: Place, now: string): MeetingDraft {
  if (meeting.selectedPlace?.id === place.id) return meeting;
  return touch({ ...clearFrom(meeting, 'place'), selectedPlace: place }, now);
}

/** 5단계 재조회 결과 저장. 지금 고른 장소의 결과가 아니면 무시한다(늦게 도착한 응답 대비). */
export function setPlaceRoutes(meeting: MeetingDraft, result: CandidateResult, now: string): MeetingDraft {
  if (!meeting.selectedPlace || result.candidate.id !== meeting.selectedPlace.id) return meeting;
  return touch({ ...clearFrom(meeting, 'placeRoutes'), placeRoutes: result }, now);
}

/** 모든 참가자의 경로가 조회된 장소만 확정할 수 있다. */
export function confirmMeeting(meeting: MeetingDraft, now: string): MeetingDraft {
  if (!meeting.placeRoutes?.metrics) return meeting;
  return { ...meeting, confirmedAt: now, updatedAt: now };
}

// ── 저장 데이터 검사 ───────────────────────────────────────────

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isLocation = (value: unknown): value is Location => isObject(value) &&
  typeof value.id === 'string' && typeof value.name === 'string' && typeof value.address === 'string' &&
  typeof value.lat === 'number' && Number.isFinite(value.lat) && typeof value.lng === 'number' && Number.isFinite(value.lng);
const isParticipant = (value: unknown): value is MeetingParticipant => isObject(value) &&
  typeof value.id === 'string' && typeof value.name === 'string' && isLocation(value.origin) &&
  (value.color === undefined || typeof value.color === 'string') &&
  (value.transport === 'transit' || value.transport === 'car' || value.transport === 'walk');

/** 손상되었거나 형식이 다른 약속은 버리고 사용할 수 있는 것만 돌려준다. */
export function parseStoredMeetings(raw: unknown): MeetingDraft[] {
  if (!isObject(raw) || raw.version !== STORAGE_VERSION || !Array.isArray(raw.meetings)) return [];
  return raw.meetings.flatMap((item): MeetingDraft[] => {
    if (!isObject(item) || typeof item.id !== 'string' || typeof item.title !== 'string' ||
        typeof item.createdAt !== 'string' || typeof item.updatedAt !== 'string' ||
        !Array.isArray(item.participants) || !item.participants.every(isParticipant)) return [];
    const meeting = item as unknown as MeetingDraft;
    // 하위 결과가 깨져 있으면 결과만 지우고 입력값은 살린다.
    if (meeting.recommendation && (!isObject(meeting.recommendation) || !Array.isArray(meeting.recommendation.ranked))) {
      return [clearFrom(meeting, 'recommendation')];
    }
    if (meeting.selectedPlace && !isLocation(meeting.selectedPlace)) return [clearFrom(meeting, 'place')];
    return [meeting];
  });
}

/** 기기 저장소에 넣을 문자열 (버전 포함) */
export function serializeMeetings(meetings: MeetingDraft[]): string {
  return JSON.stringify({ version: STORAGE_VERSION, meetings });
}
