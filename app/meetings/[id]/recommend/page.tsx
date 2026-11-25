'use client';
// 3. 추천 지역 — 다음 작업 단계에서 구현한다. 그 전까지는 준비 중 안내만 보여준다.
import Link from 'next/link';
import FlowLayout, { FlowLoading, flowStyles } from '@/components/flow/FlowLayout';
import styles from '@/components/meeting/meeting.module.css';
import { TOTAL_STEPS, meetingPath, stepNumber } from '@/features/meeting/model';
import { useMeetingStep } from '@/features/meeting/useMeetingStep';

export default function RecommendPage({ params }: { params: { id: string } }) {
  const { meeting } = useMeetingStep(params.id, 'recommend');
  if (!meeting) return <FlowLoading title="추천 지역" />;
  return (
    <FlowLayout title="추천 지역" backHref={meetingPath(meeting.id, 'participants')} backLabel="참가자 목록으로"
      step={{ current: stepNumber('recommend'), total: TOTAL_STEPS }}
      bottom={<Link href={meetingPath(meeting.id, 'participants')} className={flowStyles.primary}>참가자 목록으로</Link>}>
      <div className={styles.lead}>
        <h2>추천 화면은 준비 중이에요</h2>
        <p>참가자 {meeting.participants.length}명의 정보는 저장됐어요. 추천·장소·확정 화면은 다음 작업 단계에서 연결돼요.
          그 전까지는 <Link href="/classic">기존 메인 화면</Link>에서 추천을 확인할 수 있어요.</p>
      </div>
    </FlowLayout>
  );
}
