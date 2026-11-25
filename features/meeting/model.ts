// 약속 하나(MeetingDraft)의 데이터 구조와 단계 규칙.
// 화면·브라우저 API에 의존하지 않는 순수 함수만 둔다. (나중에 앱에서도 그대로 재사용)
import type { CandidateResult, Location, Participant, Place, RecommendationResult } from '../../lib/meetpoint/types';
import { MAX_PARTICIPANTS } from '../../lib/meetpoint/validation';

export const MIN_PARTICIPANTS = 2;
export { MAX_PARTICIPANTS };
export const STORAGE_KEY = 'meetpoint.meetings';
export const STORAGE_VERSION = 1;

export type MeetingDraft = {
  id: string;
  title: string;
  scheduledAt?: string;                 // 'YYYY-MM-DDTHH:mm' (로컬 시각)
  participants: Participant[];
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
export const stepNumber = (step: FlowStep) => FLOW_STEPS.indexOf(step) + 1;

export function meetingPath(id: string, step?: FlowStep): string {
  const base = `/meetings/${encodeURIComponent(id)}`;
  if (!step) return base;
  if (step === 'place') return `${base}/places/selected`;
  return `${base}/${step}`;
}

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

export type MeetingStatus = 'draft' | 'ready' | 'recommended' | 'confirmed';
export function meetingStatus(meeting: MeetingDraft): MeetingStatus {
  if (meeting.confirmedAt) return 'confirmed';
  if (meeting.recommendation) return 'recommended';
  if (blockingStep(meeting, 'recommend') === null) return 'ready';
  return 'draft';
}

export function selectedCandidate(meeting: MeetingDraft): CandidateResult | undefined {
  if (!meeting.recommendation || !meeting.selectedCandidateId) return undefined;
  return meeting.recommendation.ranked.find((item) => item.candidate.id === meeting.selectedCandidateId);
}

// ── 변경 함수 (앞 단계가 바뀌면 뒤 단계 결과를 지운다) ─────────────

type Downstream = 'recommendation' | 'candidate' | 'place' | 'placeRoutes';
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

const touch = (meeting: MeetingDraft, now: string): MeetingDraft => ({ ...meeting, updatedAt: now });

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

export function upsertParticipant(meeting: MeetingDraft, person: Participant, now: string): MeetingDraft {
  const index = meeting.participants.findIndex((item) => item.id === person.id);
  if (index < 0) {
    if (meeting.participants.length >= MAX_PARTICIPANTS) return meeting;
    return touch(clearFrom({ ...meeting, participants: [...meeting.participants, person] }, 'recommendation'), now);
  }
  const participants = meeting.participants.map((item) => (item.id === person.id ? person : item));
  const changed = affectsRoutes(meeting.participants[index], person);
  return touch(changed ? clearFrom({ ...meeting, participants }, 'recommendation') : { ...meeting, participants }, now);
}

export function removeParticipant(meeting: MeetingDraft, participantId: string, now: string): MeetingDraft {
  if (!meeting.participants.some((item) => item.id === participantId)) return meeting;
  const participants = meeting.participants.filter((item) => item.id !== participantId);
  return touch(clearFrom({ ...meeting, participants }, 'recommendation'), now);
}

export function setRecommendation(meeting: MeetingDraft, result: RecommendationResult, now: string): MeetingDraft {
  return touch({ ...clearFrom(meeting, 'recommendation'), recommendation: result }, now);
}

export function selectCandidateId(meeting: MeetingDraft, candidateId: string, now: string): MeetingDraft {
  if (meeting.selectedCandidateId === candidateId) return meeting;
  if (!meeting.recommendation?.ranked.some((item) => item.candidate.id === candidateId)) return meeting;
  return touch({ ...clearFrom(meeting, 'candidate'), selectedCandidateId: candidateId }, now);
}

export function selectPlace(meeting: MeetingDraft, place: Place, now: string): MeetingDraft {
  if (meeting.selectedPlace?.id === place.id) return meeting;
  return touch({ ...clearFrom(meeting, 'place'), selectedPlace: place }, now);
}

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
const isParticipant = (value: unknown): value is Participant => isObject(value) &&
  typeof value.id === 'string' && typeof value.name === 'string' && isLocation(value.origin) &&
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

export function serializeMeetings(meetings: MeetingDraft[]): string {
  return JSON.stringify({ version: STORAGE_VERSION, meetings });
}
