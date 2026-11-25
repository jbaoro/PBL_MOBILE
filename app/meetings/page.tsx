/**
 * `/meetings` → `/` 로 보낸다. 약속 목록은 기본 주소에 있다. (예전 주소로 들어온 경우 대비)
 */
import { redirect } from 'next/navigation';

export default function MeetingsIndex() {
  redirect('/');
}
