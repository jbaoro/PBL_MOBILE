'use client';

import { useState } from 'react';

type Participant = {
  id: number;
  name: string;
  avatar: string;
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
  reason: string;
};

const initialCandidates: Candidate[] = [
  { name: '강남역', subwayLines: ['2호선', '신분당선'], eta: 23, fairness: 94, score: 96, reason: '신분당선 및 2호선 환승 용이, 중심축 위치' },
  { name: '건대입구역', subwayLines: ['2호선', '7호선'], eta: 27, fairness: 89, score: 93, reason: '동부권 인접, 2/7호선 더블 역세권' },
  { name: '사당역', subwayLines: ['2호선', '4호선'], eta: 28, fairness: 86, score: 90, reason: '경기 남부/인천 방면 환승 최적지' },
  { name: '서울역', subwayLines: ['1호선', '4호선', '공항철도'], eta: 32, fairness: 82, score: 85, reason: '광역 교통망 허브' },
];

const initialParticipants: Participant[] = [
  { id: 1, name: '민지', avatar: '👩🏻', location: '인천', transport: '대중교통', time: 42 },
  { id: 2, name: '준호', avatar: '👦🏻', location: '수원', transport: '자동차', time: 36 },
  { id: 3, name: '서연', avatar: '👩🏻‍🦰', location: '강남', transport: '도보', time: 18 },
  { id: 4, name: '현우', avatar: '🧑🏻', location: '건대', transport: '대중교통', time: 29 },
];

const transportIcons: Record<Participant['transport'], string> = {
  '도보': '🚶',
  '대중교통': '🚇',
  '자동차': '🚗',
};

const avatarOptions = ['👩🏻', '👦🏻', '👩🏻‍🦰', '🧑🏻', '👱🏻‍♀️', '🧑🏻‍💻', '👧🏻', '👨🏻‍🦱'];

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
  const [newAvatar, setNewAvatar] = useState(avatarOptions[0]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast('링크가 클립보드에 복사되었습니다! 🎉');
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
      avatar: newAvatar,
      location: newLocation.trim(),
      transport: newTransport,
      time: Number(newTime) || 30,
    };

    setParticipants([...participants, newP]);
    setNewName('');
    setNewLocation('');
    setNewTime(30);
    setIsModalOpen(false);
    showToast(`${newP.name}님이 추가되었습니다!`);
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
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.92)',
          color: 'white',
          padding: '10px 18px',
          borderRadius: '24px',
          fontSize: '0.88rem',
          fontWeight: 600,
          zIndex: 200,
          backdropFilter: 'blur(8px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          transition: 'all 0.2s ease',
        }}>
          {toastMessage}
        </div>
      )}

      {/* Top App Bar */}
      <header className="top-bar">
        <div className="brand-logo">
          <svg className="brand-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          MeetPoint
        </div>
        <div className="top-bar-actions">
          <button className="icon-btn" type="button" onClick={handleShare} aria-label="공유하기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="main-content">
        {/* Recommendation Hero Card */}
        <section className="hero-card">
          <div className="hero-header">
            <div className="hero-title-group">
              <small>최적의 중간 장소 추천</small>
              <h2>추천 장소: {currentResult.name}</h2>
            </div>
            <div className="badge-fairness">
              <span className="badge-label">공정성</span>
              <span className="badge-value">{currentResult.fairness}점</span>
            </div>
          </div>

          <div className="hero-meta">
            <span>평균 <b>{currentResult.eta}분 소요</b></span>
            <span>·</span>
            <span>추천도 <b>{currentResult.score}점</b></span>
          </div>

          {/* Mini Subway / Midpoint Map Graphic */}
          <div className="mini-map-container">
            <svg className="map-svg" viewBox="0 0 400 150">
              {/* Background transit lines */}
              <path d="M 30,120 Q 150,110 200,75 T 370,30" fill="none" stroke="#93c5fd" strokeWidth="4" strokeDasharray="4 2" />
              <path d="M 40,30 Q 120,40 200,75 T 360,120" fill="none" stroke="#86efac" strokeWidth="4" />
              <path d="M 200,10 L 200,140" fill="none" stroke="#fcd34d" strokeWidth="3" />
              <circle cx="200" cy="75" r="30" fill="rgba(37, 99, 235, 0.08)" />

              {/* Pin 1: 인천 (민지) */}
              <circle cx="45" cy="115" r="7" fill="#8b5cf6" stroke="#ffffff" strokeWidth="2.5" />
              <text x="45" y="136" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">인천</text>

              {/* Pin 2: 강남 (서연) */}
              <circle cx="55" cy="35" r="7" fill="#ec4899" stroke="#ffffff" strokeWidth="2.5" />
              <text x="55" y="24" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">강남</text>

              {/* Pin 3: 수원 (준호) */}
              <circle cx="350" cy="118" r="7" fill="#10b981" stroke="#ffffff" strokeWidth="2.5" />
              <text x="350" y="138" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">수원</text>

              {/* Pin 4: 건대 (현우) */}
              <circle cx="345" cy="35" r="7" fill="#3b82f6" stroke="#ffffff" strokeWidth="2.5" />
              <text x="345" y="24" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">건대</text>

              {/* Midpoint Main Pin */}
              <g transform="translate(185, 45)">
                <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25c0-8.3-6.7-15-15-15z" fill="#2563eb" />
                <circle cx="15" cy="14" r="5.5" fill="#ffffff" />
              </g>
              <text x="200" y="98" textAnchor="middle" fontSize="12" fontWeight="800" fill="#1e40af">
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
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>평균 이동: {averageTime}분</span>
          </div>

          <div className="participants-grid">
            {participants.map((person) => (
              <div className="participant-card" key={person.id}>
                <div className="avatar-circle">{person.avatar}</div>
                <div className="participant-info">
                  <div className="participant-name-row">
                    <span className="participant-name">{person.name}</span>
                    <button
                      className="participant-remove-btn"
                      type="button"
                      onClick={() => handleRemoveParticipant(person.id, person.name)}
                      title="참여자 삭제"
                    >
                      ×
                    </button>
                  </div>
                  <div className="participant-details">
                    <span>{person.location}</span>
                    <span>{transportIcons[person.transport]}</span>
                    <span>{person.time}분</span>
                  </div>
                </div>
              </div>
            ))}

            <button className="add-participant-card" type="button" onClick={() => setIsModalOpen(true)}>
              <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>+</span>
              <span>참가자 추가</span>
            </button>
          </div>
        </section>

        {/* Candidate Ranking List */}
        <section className="candidates-card">
          <div className="section-header">
            <h3 className="section-title">후보 장소 랭킹</h3>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>선택 시 추천 장소 변경</span>
          </div>

          <div className="candidates-list">
            {initialCandidates.map((candidate, index) => {
              const isSelected = candidate.name === selectedLocation;
              return (
                <div
                  key={candidate.name}
                  className={`candidate-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedLocation(candidate.name)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="candidate-rank-info">
                    <div className="rank-badge">{index + 1}위</div>
                    <div>
                      <div className="candidate-name">{candidate.name}</div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                        {candidate.subwayLines.join(', ')} · 공정성 {candidate.fairness}%
                      </div>
                    </div>
                  </div>
                  <div className="candidate-stats">
                    <span className="candidate-score">{candidate.score}점</span>
                    {isSelected && (
                      <span style={{ color: '#2563eb', fontSize: '0.9rem' }}>✓</span>
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
          onClick={() => showToast(`'${currentResult.name}' 약속 장소 투표가 시작되었습니다! 🗳️`)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          약속 장소 투표 시작하기
        </button>
      </footer>

      {/* Add Participant Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">새 참가자 추가</h3>
              <button
                style={{ background: 'none', fontSize: '1.4rem', color: '#64748b' }}
                type="button"
                onClick={() => setIsModalOpen(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddParticipant}>
              <div className="form-group">
                <label className="form-label">아바타 선택</label>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '4px 0' }}>
                  {avatarOptions.map((av) => (
                    <button
                      key={av}
                      type="button"
                      onClick={() => setNewAvatar(av)}
                      style={{
                        fontSize: '1.4rem',
                        padding: '6px',
                        borderRadius: '50%',
                        background: newAvatar === av ? '#eff6ff' : '#f8fafc',
                        border: newAvatar === av ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      }}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">이름</label>
                <input
                  className="form-input"
                  placeholder="예: 지민"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">출발 위치 (역 또는 지역)</label>
                <input
                  className="form-input"
                  placeholder="예: 홍대입구, 판교"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">이동 수단</label>
                  <select
                    className="form-select"
                    value={newTransport}
                    onChange={(e) => setNewTransport(e.target.value as Participant['transport'])}
                  >
                    <option value="대중교통">🚇 대중교통</option>
                    <option value="도보">🚶 도보</option>
                    <option value="자동차">🚗 자동차</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">예상 소요 시간(분)</label>
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
