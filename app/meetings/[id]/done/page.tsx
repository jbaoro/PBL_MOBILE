'use client';
// 6. 확정 완료 — 다음 작업 단계에서 구현한다. 그 전까지는 확정 내용만 간단히 보여준다.
import Link from 'next/link';
import FlowLayout, { FlowLoading, flowStyles } from '@/components/flow/FlowLayout';
import styles from '@/components/meeting/meeting.module.css';
import { TOTAL_STEPS, meetingPath, stepNumber } from '@/features/meeting/model';
import { useMeetingStep } from '@/features/meeting/useMeetingStep';

export default function DonePage({ params }: { params: { id: string } }) {
  const { meeting } = useMeetingStep(params.id, 'done');
  if (!meeting?.selectedPlace) return <FlowLoading title="확정" />;
  return (
    <FlowLayout title="확정" backHref={meetingPath(meeting.id, 'place')} backLabel="장소 확인으로"
      step={{ current: stepNumber('done'), total: TOTAL_STEPS }}
      bottom={<Link href="/" className={flowStyles.primary}>약속 목록으로</Link>}>
      <div className={styles.lead}>
        <h2>{meeting.selectedPlace.name}(으)로 확정했어요</h2>
        <p>약속은 이 기기에 저장됐어요. 공유·요약 복사 화면은 다음 작업 단계에서 연결돼요.</p>
      </div>
    </FlowLayout>
  );
}
