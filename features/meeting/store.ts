'use client';
/**
 * 약속 저장소. 모든 화면이 이 저장소 하나를 공유하고, 변경 사항은 기기 저장소에 자동 저장된다.
 * 외부 라이브러리 없이 useSyncExternalStore 로 구현해서 웹/앱 어디서나 같은 방식으로 쓸 수 있다.
 *
 * 사용법
 * - 읽기: useMeeting(id), useMeetingList()  → 값이 바뀌면 화면이 다시 그려진다.
 * - 쓰기: meetingActions.xxx(id, ...)        → 규칙은 model.ts 의 순수 함수가 적용하고, 여기서는 저장만 한다.
 * - 처음 읽을 때 기기 저장소에서 불러온다(hydrated). 불러오기 전에는 화면에서 로딩을 보여준다.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { deviceStorage, type KeyValueStorage } from '@/lib/platform/storage';
import { createId } from '@/lib/platform/id';
import type { CandidateResult, Place, RecommendationResult } from '@/lib/meetpoint/types';
import * as model from './model';
import type { MeetingDraft, MeetingParticipant } from './model';

type State = {
  hydrated: boolean;           // 기기 저장소에서 불러오기를 마쳤는지
  meetings: Record<string, MeetingDraft>;
  saveError: string | null;    // 마지막 저장 실패 사유
};

const initialState: State = { hydrated: false, meetings: {}, saveError: null };
let state: State = initialState;
const listeners = new Set<() => void>();
let storage: KeyValueStorage = deviceStorage;
let hydrating: Promise<void> | null = null;
let saveQueue: Promise<void> = Promise.resolve();

/** 구독 중인 화면들에 상태가 바뀌었다고 알린다. */
function emit() { listeners.forEach((listener) => listener()); }

function setState(next: State) {
  state = next;
  emit();
}

/** 현재 약속 전체를 기기 저장소에 저장한다. 저장은 순서대로 한 번에 하나씩 처리한다. */
function persist() {
  saveQueue = saveQueue.then(async () => {
    // 불러오기 전에 저장하면 기존 약속을 덮어쓰므로, 항상 불러오기를 마친 뒤 최신 상태를 저장한다.
    await hydrateMeetings();
    try {
      await storage.setItem(model.STORAGE_KEY, model.serializeMeetings(Object.values(state.meetings)));
      if (state.saveError) setState({ ...state, saveError: null });
    } catch {
      setState({ ...state, saveError: '기기에 저장하지 못했어요. 저장 공간을 확인해 주세요.' });
    }
  });
}

/** 기기 저장소에서 약속을 한 번만 불러온다. 여러 화면이 동시에 불러도 실제 읽기는 한 번이다. */
export function hydrateMeetings(): Promise<void> {
  if (state.hydrated) return Promise.resolve();
  hydrating ??= (async () => {
    let meetings: MeetingDraft[] = [];
    try {
      const raw = await storage.getItem(model.STORAGE_KEY);
      meetings = raw ? model.parseStoredMeetings(JSON.parse(raw)) : [];
    } catch {
      meetings = []; // 손상된 저장 데이터는 무시하고 빈 목록으로 시작
    }
    // 불러오는 사이에 만들어진 약속이 있으면 보존한다.
    setState({ ...state, hydrated: true, meetings: { ...Object.fromEntries(meetings.map((m) => [m.id, m])), ...state.meetings } });
  })();
  return hydrating;
}

/** 약속 하나를 model 함수로 바꾸고, 실제로 바뀌었을 때만 화면 갱신·저장한다. */
function update(id: string, change: (meeting: MeetingDraft, now: string) => MeetingDraft): void {
  const current = state.meetings[id];
  if (!current) return;
  const next = change(current, new Date().toISOString());
  if (next === current) return;
  setState({ ...state, meetings: { ...state.meetings, [id]: next } });
  persist();
}

/** 화면에서 약속을 바꾸는 유일한 통로. 각 동작의 규칙은 model.ts 함수 설명 참고. */
export const meetingActions = {
  create(): string {
    const id = createId('m_');
    setState({ ...state, meetings: { ...state.meetings, [id]: model.createMeeting(id, new Date().toISOString()) } });
    persist();
    return id;
  },
  remove(id: string) {
    if (!state.meetings[id]) return;
    const meetings = { ...state.meetings };
    delete meetings[id];
    setState({ ...state, meetings });
    persist();
  },
  /** 삭제 직후 실행 취소(Undo)로 약속을 원상 복구한다. */
  restore(draft: MeetingDraft) {
    setState({ ...state, meetings: { ...state.meetings, [draft.id]: draft } });
    persist();
  },
  /** 기존 약속의 참가자 구성만 그대로 가져와 새 약속을 만든다. (자주 만나는 모임 재사용) */
  duplicateWithMembers(sourceId: string): string | null {
    const source = state.meetings[sourceId];
    if (!source) return null;
    const id = createId('m_');
    const now = new Date().toISOString();
    const cloned: MeetingDraft = {
      id,
      title: source.title ? `${source.title}`.slice(0, 40) : '',
      participants: source.participants.map((p) => ({
        ...p,
        id: createId('p_'),
        origin: { ...p.origin },
      })),
      createdAt: now,
      updatedAt: now,
    };
    setState({ ...state, meetings: { ...state.meetings, [id]: cloned } });
    persist();
    return id;
  },
  updateInfo: (id: string, info: { title: string; scheduledAt?: string }) =>
    update(id, (m, now) => model.updateInfo(m, info, now)),
  upsertParticipant: (id: string, person: MeetingParticipant) =>
    update(id, (m, now) => model.upsertParticipant(m, person, now)),
  removeParticipant: (id: string, participantId: string) =>
    update(id, (m, now) => model.removeParticipant(m, participantId, now)),
  setRecommendation: (id: string, result: RecommendationResult) =>
    update(id, (m, now) => model.setRecommendation(m, result, now)),
  selectCandidate: (id: string, candidateId: string) =>
    update(id, (m, now) => model.selectCandidateId(m, candidateId, now)),
  selectPlace: (id: string, place: Place) =>
    update(id, (m, now) => model.selectPlace(m, place, now)),
  setPlaceRoutes: (id: string, result: CandidateResult) =>
    update(id, (m, now) => model.setPlaceRoutes(m, result, now)),
  confirm: (id: string) => update(id, (m, now) => model.confirmMeeting(m, now)),
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** 저장소 전체 상태. 처음 사용할 때 기기 저장소에서 불러온다. */
export function useMeetingStore(): State {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => initialState);
  useEffect(() => { void hydrateMeetings(); }, []);
  return snapshot;
}

/** 최근 수정 순 약속 목록 */
export function useMeetingList(): { hydrated: boolean; meetings: MeetingDraft[] } {
  const { hydrated, meetings } = useMeetingStore();
  return { hydrated, meetings: Object.values(meetings).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
}

/** 약속 하나. 없으면 meeting 이 undefined (hydrated 가 true 일 때만 '없음'으로 판단할 것) */
export function useMeeting(id: string): { hydrated: boolean; meeting: MeetingDraft | undefined } {
  const { hydrated, meetings } = useMeetingStore();
  return { hydrated, meeting: meetings[id] };
}

/** 테스트용: 저장소 구현을 바꾸고 상태를 초기화한다. */
export function __resetMeetingStore(nextStorage: KeyValueStorage = deviceStorage) {
  storage = nextStorage;
  hydrating = null;
  saveQueue = Promise.resolve();
  state = initialState;
  emit();
}
