'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  IconTransit,
  IconWalk,
  IconCar,
  IconClock,
  IconPin,
  IconCheck,
  IconClose,
  IconPlus,
  IconVote,
  IconShare,
  IconSparkles,
} from './components/Icons';

type Participant = {
  id: number;
  name: string;
  colorTheme: string;
  location: string;
  transport: '도보' | '대중교통' | '자동차';
  time: number;
};

type Candidate = {
  name: string;
  subwayLines: string[];
  eta: number;
  fairness: number;
  score: number;
  features: string[];
  reason: string;
};

const COLOR_THEMES = [
  { id: 'blue', label: '블루', bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb' },
  { id: 'emerald', label: '에메랄드', bg: '#ecfdf5', border: '#a7f3d0', text: '#059669' },
  { id: 'purple', label: '퍼플', bg: '#f5f3ff', border: '#ddd6fe', text: '#7c3aed' },
  { id: 'rose', label: '로즈', bg: '#fff1f2', border: '#fecdd3', text: '#e11d48' },
  { id: 'amber', label: '앰버', bg: '#fffbeb', border: '#fde68a', text: '#d97706' },
  { id: 'indigo', label: '인디고', bg: '#eef2ff', border: '#c7d2fe', text: '#4f46e5' },
];

const initialCandidates: Candidate[] = [
  {
    name: '강남역',
    subwayLines: ['2호선', '신분당선'],
    eta: 23,
    fairness: 94,
    score: 96,
    features: ['환승 편리', '맛집·카페 밀집', '중심축 위치'],
    reason: '신분당선 및 2호선 더블 역세권으로 이동 편차 최소화',
  },
  {
    name: '건대입구역',
    subwayLines: ['2호선', '7호선'],
    eta: 27,
    fairness: 89,
    score: 93,
    features: ['동부권 접근성', '약속 장소 다수'],
    reason: '동부권 인접 및 2/7호선 환승 용이',
  },
  {
    name: '사당역',
    subwayLines: ['2호선', '4호선'],
    eta: 28,
    fairness: 86,
    score: 90,
    features: ['경기 남부권 최적', '교통 요충지'],
    reason: '인천·수원 방면 광역 이동 최적지',
  },
  {
    name: '서울역',
    subwayLines: ['1호선', '4호선', '공항철도'],
    eta: 32,
    fairness: 82,
    score: 85,
    features: ['광역 철도 허브', '다양한 노선망'],
    reason: '수도권 전 지역을 잇는 광역 교통망 중심',
  },
];

const initialParticipants: Participant[] = [
  { id: 1, name: '민지', colorTheme: 'rose', location: '인천', transport: '대중교통', time: 42 },
  { id: 2, name: '준호', colorTheme: 'emerald', location: '수원', transport: '자동차', time: 36 },
  { id: 3, name: '서연', colorTheme: 'purple', location: '강남', transport: '도보', time: 18 },
  { id: 4, name: '현우', colorTheme: 'blue', location: '건대', transport: '대중교통', time: 29 },
];

function getSubwayLineColor(line: string): string {
  if (line.includes('1호선')) return '#0052A4';
  if (line.includes('2호선')) return '#00A84D';
  if (line.includes('4호선')) return '#00A5DE';
  if (line.includes('7호선')) return '#747F00';
  if (line.includes('신분당')) return '#D4003B';
  if (line.includes('공항')) return '#0090D2';
  return '#64748B';
}

function AvatarInitial({ name, themeId }: { name: string; themeId?: string }) {
  const theme = COLOR_THEMES.find((t) => t.id === themeId) || COLOR_THEMES[0];
  const initial = name.trim().charAt(0) || '참';
  return (
    <div
      className="avatar-initial-circle"
      style={{
        backgroundColor: theme.bg,
        color: theme.text,
        border: `1.5px solid ${theme.border}`,
      }}
    >
      <span>{initial}</span>
    </div>
  );
}

function TransportBadge({ transport }: { transport: Participant['transport'] }) {
  return (
    <span className="transport-chip">
      {transport === '도보' && <IconWalk size={13} />}
      {transport === '대중교통' && <IconTransit size={13} />}
      {transport === '자동차' && <IconCar size={13} />}
      <span>{transport}</span>
    </span>
  );
}

export default function HomePage() {
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants);
  const [selectedLocation, setSelectedLocation] = useState<string>(initialCandidates[0].name);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New participant form state
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newTransport, setNewTransport] = useState<Participant['transport']>('대중교통');
  const [newTime, setNewTime] = useState<number>(30);
  const [selectedTheme, setSelectedTheme] = useState(COLOR_THEMES[0].id);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast('약속 링크가 클립보드에 복사되었습니다.');
    } else {
      showToast('약속 링크가 복사되었습니다.');
    }
  };

  const currentResult = initialCandidates.find((c) => c.name === selectedLocation) ?? initialCandidates[0];

  const averageTime = participants.length
    ? Math.round(participants.reduce((sum, p) => sum + p.time, 0) / participants.length)
    : 0;

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newLocation.trim()) {
      showToast('이름과 출발 위치를 입력해주세요.');
      return;
    }

    const newP: Participant = {
      id: Date.now(),
      name: newName.trim(),
      colorTheme: selectedTheme,
      location: newLocation.trim(),
      transport: newTransport,
      time: Number(newTime) || 30,
    };

    setParticipants([...participants, newP]);
    setNewName('');
    setNewLocation('');
    setNewTime(30);
    setIsModalOpen(false);
    showToast(`${newP.name}님이 추가되었습니다.`);
  };

  const handleRemoveParticipant = (id: number, name: string) => {
    if (participants.length <= 2) {
      showToast('최소 2명의 참가자가 필요합니다.');
      return;
    }
    setParticipants(participants.filter((p) => p.id !== id));
    showToast(`${name}님이 제외되었습니다.`);
  };

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toastMessage && (
        <aside
          aria-live="polite"
          className="toast-banner"
        >
          <div className="toast-icon-wrap">
            <IconCheck size={14} color="#ffffff" />
          </div>
          <span>{toastMessage}</span>
        </aside>
      )}

      {/* Top App Bar */}
      <header className="top-bar">
        <div className="brand-logo">
          <svg className="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
          MeetPoint
        </div>
        <div className="top-bar-actions">
          <Link href="/planner" className="planner-link-btn" title="실제 카카오 경로 플래너로 이동">
            <span>실시간 플래너</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </Link>
          <button className="icon-btn" type="button" onClick={handleShare} aria-label="약속 공유하기">
            <IconShare size={19} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="main-content">
        {/* Recommendation Hero Card */}
        <section className="hero-card">
          <div className="hero-header">
            <div className="hero-title-group">
              <span className="hero-eyebrow">
                <IconSparkles size={13} color="#2563eb" />
                최적의 중간 지점
              </span>
              <h2>{currentResult.name}</h2>
            </div>
            <div className="badge-fairness">
              <span className="badge-label">공정성 지수</span>
              <span className="badge-value">{currentResult.fairness}%</span>
            </div>
          </div>

          {/* Progress / Fairness Bar */}
          <div className="fairness-meter">
            <div className="fairness-meter-bar" style={{ width: `${currentResult.fairness}%` }} />
          </div>

          <div className="hero-meta">
            <div className="meta-pill">
              <IconClock size={14} color="#64748b" />
              <span>평균 <b>{currentResult.eta}분</b> 소요</span>
            </div>
            <div className="meta-divider" />
            <div className="meta-pill">
              <span className="meta-score-label">추천도</span>
              <b className="meta-score-val">{currentResult.score}점</b>
            </div>
          </div>

          {/* Feature Tag Chips */}
          <div className="hero-chips">
            {currentResult.features.map((feature) => (
              <span className="hero-chip" key={feature}>
                {feature}
              </span>
            ))}
          </div>

          {/* Subway & Midpoint Vector Graphic */}
          <div className="mini-map-container">
            <svg className="map-svg" viewBox="0 0 400 160">
              <defs>
                <linearGradient id="lineGreen" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00A84D" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#86efac" stopOpacity="0.4" />
                </linearGradient>
                <linearGradient id="lineRed" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#D4003B" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#fca5a5" stopOpacity="0.4" />
                </linearGradient>
              </defs>

              {/* Transit Route Paths */}
              <path d="M 35,125 Q 120,110 200,80 T 365,35" fill="none" stroke="url(#lineGreen)" strokeWidth="4" />
              <path d="M 45,35 Q 120,50 200,80 T 355,125" fill="none" stroke="url(#lineRed)" strokeWidth="4" />
              <path d="M 200,15 L 200,145" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="3 3" />

              {/* Midpoint Halo Wave */}
              <circle cx="200" cy="80" r="34" fill="rgba(37, 99, 235, 0.08)" />
              <circle cx="200" cy="80" r="22" fill="rgba(37, 99, 235, 0.15)" />

              {/* Participant Pins (Vector Dots with initials) */}
              {/* 인천 (민지) */}
              <circle cx="45" cy="120" r="10" fill="#fff1f2" stroke="#e11d48" strokeWidth="2" />
              <text x="45" y="124" textAnchor="middle" fontSize="10" fontWeight="700" fill="#e11d48">민</text>
              <text x="45" y="142" textAnchor="middle" fontSize="11" fontWeight="600" fill="#64748b">인천</text>

              {/* 강남 (서연) */}
              <circle cx="55" cy="38" r="10" fill="#f5f3ff" stroke="#7c3aed" strokeWidth="2" />
              <text x="55" y="42" textAnchor="middle" fontSize="10" fontWeight="700" fill="#7c3aed">서</text>
              <text x="55" y="24" textAnchor="middle" fontSize="11" fontWeight="600" fill="#64748b">강남</text>

              {/* 수원 (준호) */}
              <circle cx="350" cy="120" r="10" fill="#ecfdf5" stroke="#059669" strokeWidth="2" />
              <text x="350" y="124" textAnchor="middle" fontSize="10" fontWeight="700" fill="#059669">준</text>
              <text x="350" y="142" textAnchor="middle" fontSize="11" fontWeight="600" fill="#64748b">수원</text>

              {/* 건대 (현우) */}
              <circle cx="345" cy="38" r="10" fill="#eff6ff" stroke="#2563eb" strokeWidth="2" />
              <text x="345" y="42" textAnchor="middle" fontSize="10" fontWeight="700" fill="#2563eb">현</text>
              <text x="345" y="24" textAnchor="middle" fontSize="11" fontWeight="600" fill="#64748b">건대</text>

              {/* Midpoint Target Station Node */}
              <circle cx="200" cy="80" r="10" fill="#2563eb" stroke="#ffffff" strokeWidth="3" />
              <circle cx="200" cy="80" r="4" fill="#ffffff" />
              <rect x="165" y="98" width="70" height="22" rx="11" fill="#1e40af" />
              <text x="200" y="113" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff">
                {currentResult.name}
              </text>
            </svg>
          </div>
        </section>

        {/* Participants Section */}
        <section>
          <div className="section-header">
            <h3 className="section-title">
              참여자 <span className="participant-count">{participants.length}명</span>
            </h3>
            <span className="section-subtext">
              평균 이동: <b>{averageTime}분</b>
            </span>
          </div>

          <div className="participants-grid">
            {participants.map((person) => (
              <div className="participant-card" key={person.id}>
                <AvatarInitial name={person.name} themeId={person.colorTheme} />
                <div className="participant-info">
                  <div className="participant-name-row">
                    <span className="participant-name">{person.name}</span>
                    <button
                      className="participant-remove-btn"
                      type="button"
                      onClick={() => handleRemoveParticipant(person.id, person.name)}
                      title="참여자 제외"
                      aria-label={`${person.name} 제외`}
                    >
                      <IconClose size={13} />
                    </button>
                  </div>
                  <div className="participant-meta-row">
                    <span className="participant-location">
                      <IconPin size={11} color="#94a3b8" />
                      {person.location}
                    </span>
                    <span className="participant-time-badge">{person.time}분</span>
                  </div>
                  <div className="participant-transport-row">
                    <TransportBadge transport={person.transport} />
                  </div>
                </div>
              </div>
            ))}

            <button
              className="add-participant-card"
              type="button"
              onClick={() => setIsModalOpen(true)}
              aria-label="새 참가자 추가"
            >
              <div className="add-icon-circle">
                <IconPlus size={16} color="#2563eb" />
              </div>
              <span>참가자 추가</span>
            </button>
          </div>
        </section>

        {/* Candidate Ranking List */}
        <section className="candidates-card">
          <div className="section-header">
            <h3 className="section-title">후보 장소 랭킹</h3>
            <span className="section-subtext">선택 시 상세 추천 변경</span>
          </div>

          <div className="candidates-list">
            {initialCandidates.map((candidate, index) => {
              const isSelected = candidate.name === selectedLocation;
              return (
                <div
                  key={candidate.name}
                  className={`candidate-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedLocation(candidate.name)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedLocation(candidate.name);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                >
                  <div className="candidate-rank-info">
                    <div className="rank-badge">{index + 1}</div>
                    <div>
                      <div className="candidate-name-row">
                        <span className="candidate-name">{candidate.name}</span>
                        {index === 0 && <span className="top-choice-tag">최적 추천</span>}
                      </div>
                      <div className="candidate-subway-tags">
                        {candidate.subwayLines.map((line) => (
                          <span
                            key={line}
                            className="subway-tag"
                            style={{
                              borderColor: getSubwayLineColor(line),
                              color: getSubwayLineColor(line),
                            }}
                          >
                            {line}
                          </span>
                        ))}
                        <span className="candidate-fairness-text">
                          공정성 {candidate.fairness}% · {candidate.eta}분
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="candidate-stats">
                    <span className="candidate-score">{candidate.score}점</span>
                    {isSelected && (
                      <div className="selected-check-icon">
                        <IconCheck size={14} color="#ffffff" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Floating Bottom Action Bar */}
      <footer className="bottom-bar">
        <button
          className="primary-cta-btn"
          type="button"
          onClick={() => showToast(`'${currentResult.name}' 약속 투표가 시작되었습니다.`)}
        >
          <IconVote size={18} color="#ffffff" />
          <span>약속 장소 투표 시작하기</span>
        </button>
      </footer>

      {/* Add Participant Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">새 참가자 추가</h3>
              <button
                className="modal-close-btn"
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="닫기"
              >
                <IconClose size={20} />
              </button>
            </div>

            <form onSubmit={handleAddParticipant}>
              {/* Profile Color Theme Picker */}
              <div className="form-group">
                <label className="form-label">프로필 테마 컬러</label>
                <div className="theme-picker-row">
                  {COLOR_THEMES.map((theme) => {
                    const isSelected = selectedTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        className={`theme-chip-btn ${isSelected ? 'selected' : ''}`}
                        style={{
                          backgroundColor: theme.bg,
                          borderColor: isSelected ? theme.text : theme.border,
                        }}
                        onClick={() => setSelectedTheme(theme.id)}
                        aria-label={`${theme.label} 테마 선택`}
                      >
                        <span
                          className="theme-circle-dot"
                          style={{ backgroundColor: theme.text }}
                        />
                        {isSelected && (
                          <div className="theme-check-mark">
                            <IconCheck size={12} color="#ffffff" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">이름</label>
                <input
                  className="form-input"
                  placeholder="예: 지민"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={10}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">출발 위치 (역 또는 지역명)</label>
                <input
                  className="form-input"
                  placeholder="예: 홍대입구역, 판교"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  maxLength={20}
                  required
                />
              </div>

              <div className="form-group-split">
                <div>
                  <label className="form-label">이동 수단</label>
                  <select
                    className="form-select"
                    value={newTransport}
                    onChange={(e) => setNewTransport(e.target.value as Participant['transport'])}
                  >
                    <option value="대중교통">대중교통 (지하철·버스)</option>
                    <option value="도보">도보</option>
                    <option value="자동차">자동차</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">예상 소요시간 (분)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="5"
                    max="180"
                    value={newTime}
                    onChange={(e) => setNewTime(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <button className="modal-submit-btn" type="submit">
                참가자 추가하기
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
