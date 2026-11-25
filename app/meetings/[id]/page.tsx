'use client';
// /meetings/[id] 로 들어오면 이어서 할 단계로 보낸다.
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { FlowLoading } from '@/components/flow/FlowLayout';
import { meetingPath, resumeStep } from '@/features/meeting/model';
import { useMeeting } from '@/features/meeting/store';

export default function MeetingResumePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { hydrated, meeting } = useMeeting(params.id);
  useEffect(() => {
    if (!hydrated) return;
    router.replace(meeting ? meetingPath(meeting.id, resumeStep(meeting)) : '/');
  }, [hydrated, meeting, router]);
  return <FlowLoading />;
}
