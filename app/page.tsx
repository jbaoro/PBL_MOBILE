'use client';

import { useState } from 'react';

type Participant = {
  id: number;
  name: string;
  location: string;
  transport: '도보' | '대중교통' | '자동차';
  time: number;
};

const candidates = [
  { name: '강남역', eta: 18, fairness: 92, score: 96 },
  { name: '건대입구', eta: 22, fairness: 89, score: 93 },
  { name: '서울역', eta: 26, fairness: 84, score: 88 },
  { name: '홍대입구', eta: 31, fairness: 80, score: 82 },
];

const initialParticipants: Participant[] = [
  { id: 1, name: '민지', location: '인천', transport: '대중교통', time: 42 },
  { id: 2, name: '준호', location: '수원', transport: '자동차', time: 36 },
  { id: 3, name: '서연', location: '강남', transport: '도보', time: 18 },
  { id: 4, name: '현우', location: '건대', transport: '대중교통', time: 29 },
];

export default function HomePage() {
  const [people, setPeople] = useState(initialParticipants);
  const [location, setLocation] = useState(candidates[0].name);
  const average = people.length
    ? Math.round(people.reduce((sum, person) => sum + person.time, 0) / people.length)
    : 0;
  const result = candidates.find((candidate) => candidate.name === location) ?? candidates[0];

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  const change = (id: number, field: keyof Participant, value: string | number) =>
    setPeople((current) => current.map((person) => (person.id === id ? { ...person, [field]: value } : person)));

  return (
    <main className="shell">
      <header>
        <strong>MeetPoint</strong>
        <button className="link-button" type="button" onClick={() => jump('match')}>입력하기</button>
      </header>

      <section className="intro">
        <small>약속 장소 추천</small>
        <h1>모두가 덜 이동하는 장소를 찾아요.</h1>
        <p>참가자의 출발 위치와 예상 시간을 입력하고 가장 균형 잡힌 장소를 확인하세요.</p>
        <button type="button" onClick={() => jump('match')}>참가자 입력</button>
      </section>

      <section className="card" id="match">
        <small>01 · 참가자</small>
        <h2>출발 정보를 입력하세요.</h2>
        <div className="people">
          {people.map((person) => (
            <div className="person" key={person.id}>
              <input aria-label="이름" value={person.name} onChange={(event) => change(person.id, 'name', event.target.value)} />
              <input aria-label="출발 위치" value={person.location} onChange={(event) => change(person.id, 'location', event.target.value)} />
              <select aria-label="이동 수단" value={person.transport} onChange={(event) => change(person.id, 'transport', event.target.value as Participant['transport'])}>
                <option>도보</option>
                <option>대중교통</option>
                <option>자동차</option>
              </select>
              <input aria-label="예상 시간(분)" type="number" min="0" value={person.time} onChange={(event) => change(person.id, 'time', Number(event.target.value))} />
            </div>
          ))}
        </div>
        <div className="action">
          <span>평균 이동시간 <b>{average}분</b></span>
          <button type="button" onClick={() => jump('result')}>결과 보기</button>
        </div>
      </section>

      <section className="card" id="result">
        <small>02 · 추천 결과</small>
        <h2>가장 균형 잡힌 장소</h2>
        <div className="result">
          <div className="summary">
            <small>추천 장소</small>
            <h3>{result.name}</h3>
            <p>평균 {average}분 · 공정성 {result.fairness}%</p>
            <b>{result.score}점</b>
          </div>
          <div className="choices">
            {candidates.map((candidate) => (
              <button className={candidate.name === location ? 'selected' : ''} type="button" key={candidate.name} onClick={() => setLocation(candidate.name)}>
                <span>{candidate.name}</span><b>{candidate.score}점</b>
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
