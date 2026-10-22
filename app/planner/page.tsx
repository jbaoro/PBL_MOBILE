import type { Metadata } from 'next';
import Planner from './planner';

export const metadata: Metadata = {
  title: '모두의 중간을 찾는 시간 · MeetPoint',
  description: '출발지와 이동 수단을 입력하고, 실제 예상 이동시간으로 만남 후보를 비교하세요.',
};

export default function PlannerPage() { return <Planner />; }
