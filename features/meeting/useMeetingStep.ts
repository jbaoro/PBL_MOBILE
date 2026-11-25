'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { blockingStep, meetingPath, type FlowStep, type MeetingDraft } from './model';
import { useMeeting } from './store';

/**
 * 각 단계 화면에서 사용한다.
 * - 약속이 없으면 목록으로, 앞 단계가 끝나지 않았으면 그 단계로 돌려보낸다.
 * - meeting이 undefined인 동안(불러오는 중·이동 중)에는 화면에 로딩만 보여주면 된다.
 */
export function useMeetingStep(id: string, step: FlowStep): { meeting: MeetingDraft | undefined } {
  const router = useRouter();
  const { hydrated, meeting } = useMeeting(id);
  const redirect = !hydrated ? null : !meeting ? '/' : (() => {
    const blocked = blockingStep(meeting, step);
    return blocked ? meetingPath(meeting.id, blocked) : null;
  })();

  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  return { meeting: hydrated && !redirect ? meeting : undefined };
}
