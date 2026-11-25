import { redirect } from 'next/navigation';

// 약속 목록은 기본 주소(/)에 있다.
export default function MeetingsIndex() {
  redirect('/');
}
