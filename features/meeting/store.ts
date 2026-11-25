'use client';
// 약속 저장소. 모든 화면이 이 저장소 하나를 공유하고, 변경 사항은 기기 저장소에 자동 저장된다.
// 외부 라이브러리 없이 useSyncExternalStore로 구현해서 웹/앱 어디서나 같은 방식으로 쓸 수 있다.
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

function emit() { listeners.forEach((listener) => listener()); }

function setState(next: State) {
  state = next;
  emit();
}

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

function update(id: string, change: (meeting: MeetingDraft, now: string) => MeetingDraft): void {
  const current = state.meetings[id];
  if (!current) return;
  const next = change(current, new Date().toISOString());
  if (next === current) return;
  setState({ ...state, meetings: { ...state.meetings, [id]: next } });
  persist();
}

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
