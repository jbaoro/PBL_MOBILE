'use client';
// 추천 결과 표시 조각: 미니 지도, 참가자별 이동시간 막대
import { COLOR_THEMES, AvatarInitial, TransportIcon } from './ParticipantBits';
import { minutesText, projectPoints } from '@/features/meeting/display';
import type { MeetingParticipant } from '@/features/meeting/model';
import type { Location, RouteResult } from '@/lib/meetpoint/types';
import styles from './meeting.module.css';

/** 참가자 출발지와 후보 지점을 점선으로 잇는 간단한 위치 그림 (실제 지도 아님) */
export function MiniMap({ people, destination }: { people: MeetingParticipant[]; destination: Location }) {
  const width = 400;
  const height = 170;
  const points = projectPoints([...people.map((person) => person.origin), destination], width, height, 34);
  const target = points[points.length - 1];
  return (
    <figure className={styles.mapFigure}>
      <div className="mini-map-container">
      <svg className="map-svg" viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label={`${people.map((person) => person.name).join(', ')}의 출발지와 ${destination.name}의 위치 관계`}>
        {people.map((person, index) => (
          <line key={`line-${person.id}`} x1={points[index].x} y1={points[index].y} x2={target.x} y2={target.y}
            stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 3" />
        ))}
        <circle cx={target.x} cy={target.y} r="30" fill="rgba(37, 99, 235, 0.08)" />
        <circle cx={target.x} cy={target.y} r="18" fill="rgba(37, 99, 235, 0.16)" />
        {people.map((person, index) => {
          const theme = COLOR_THEMES.find((item) => item.id === person.color) ?? COLOR_THEMES[0];
          const { x, y } = points[index];
          return (
            <g key={`pin-${person.id}`}>
              <circle cx={x} cy={y} r="11" fill={theme.bg} stroke={theme.text} strokeWidth="2" />
              <text x={x} y={y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={theme.text}>{person.name.charAt(0)}</text>
            </g>
          );
        })}
        <g transform={`translate(${target.x}, ${target.y})`}>
          <circle r="9" fill="#2563eb" stroke="#ffffff" strokeWidth="3" />
          <circle r="3.5" fill="#ffffff" />
        </g>
      </svg>
      </div>
      <figcaption className={styles.mapCaption}>출발지와 후보의 위치 관계를 나타낸 그림이에요. 실제 지도 축척과 경로는 아니에요.</figcaption>
    </figure>
  );
}

/** 참가자별 이동시간: 가장 오래 걸리는 사람 기준 막대 + 실패 사유 + 상세 경로 링크 */
export function TravelTimeList({ people, routes }: { people: MeetingParticipant[]; routes: RouteResult[] }) {
  const longest = Math.max(1, ...routes.map((route) => (route.status === 'ok' ? route.durationMinutes : 0)));
  return (
    <ul className={styles.times}>
      {people.map((person) => {
        const route = routes.find((item) => item.participantId === person.id);
        const ok = route?.status === 'ok' ? route : undefined;
        const isLongest = ok && ok.durationMinutes === longest;
        return (
          <li key={person.id} className={styles.timeRow}>
            <AvatarInitial name={person.name} color={person.color} size={34} />
            <div className={styles.timeBody}>
              <div className={styles.timeHead}>
                <strong>{person.name}</strong>
                <span className={styles.timeMode}><TransportIcon transport={person.transport} size={12} /></span>
                {ok ? <b className={isLongest ? styles.timeLongest : undefined}>{minutesText(ok.durationMinutes)}</b>
                  : <b className={styles.timeFail}>조회 실패</b>}
              </div>
              {ok ? (
                <div className={styles.track} aria-hidden="true">
                  <span style={{ width: `${Math.max(3, (ok.durationMinutes / longest) * 100)}%` }} className={isLongest ? styles.trackLongest : undefined} />
                </div>
              ) : (
                <p className={styles.timeError}>{route?.status === 'error' ? route.error.message : '경로를 확인하지 못했어요.'}</p>
              )}
              {ok?.url && <a className={styles.routeLink} href={ok.url} target="_blank" rel="noreferrer">상세 경로 보기 ↗</a>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
