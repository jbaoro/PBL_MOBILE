'use client';
// 4. 주변 장소 — 다음 작업 단계에서 구현한다. 그 전까지는 준비 중 안내만 보여준다.
import Link from 'next/link';
import FlowLayout, { FlowLoading, flowStyles } from '@/components/flow/FlowLayout';
import styles from '@/components/meeting/meeting.module.css';
import { TOTAL_STEPS, meetingPath, selectedCandidate, stepNumber } from '@/features/meeting/model';
import { useMeetingStep } from '@/features/meeting/useMeetingStep';

export default function PlacesPage({ params }: { params: { id: string } }) {
  const { meeting } = useMeetingStep(params.id, 'places');
  if (!meeting) return <FlowLoading title="주변 장소" />;
  const area = selectedCandidate(meeting)?.candidate;
  return (
    <FlowLayout title="주변 장소" backHref={meetingPath(meeting.id, 'recommend')} backLabel="추천 지역으로"
      step={{ current: stepNumber('places'), total: TOTAL_STEPS }}
      bottom={<Link href={meetingPath(meeting.id, 'recommend')} className={flowStyles.primary}>추천 지역으로 돌아가기</Link>}>
      <div className={styles.lead}>
        <h2>{area?.name} 근처 장소 찾기는 준비 중이에요</h2>
        <p>선택한 지역은 저장됐어요. 음식점·카페 찾기와 장소 확정 화면은 다음 작업 단계에서 연결돼요.
          그 전까지는 <Link href="/classic">기존 메인 화면</Link>에서 주변 장소를 볼 수 있어요.</p>
      </div>
    </FlowLayout>
  );
}
