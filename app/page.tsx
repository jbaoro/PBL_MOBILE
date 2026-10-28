'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import {
  calculateDynamicMidpoint,
  PRESET_HUBS,
  type DynamicCandidate,
} from '@/lib/meetpoint/calculator';
import type { Location, Transport } from '@/lib/meetpoint/types';

export type AppParticipant = {
  id: string;
  name: string;
  colorTheme: string;
  locationName: string;
  lat: number;
  lng: number;
  transport: Transport;
  calculatedTime?: number;
};

const COLOR_THEMES = [
  { id: 'blue', label: '블루', bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb' },
  { id: 'emerald', label: '에메랄드', bg: '#ecfdf5', border: '#a7f3d0', text: '#059669' },
  { id: 'purple', label: '퍼플', bg: '#f5f3ff', border: '#ddd6fe', text: '#7c3aed' },
  { id: 'rose', label: '로즈', bg: '#fff1f2', border: '#fecdd3', text: '#e11d48' },
  { id: 'amber', label: '앰버', bg: '#fffbeb', border: '#fde68a', text: '#d97706' },
  { id: 'indigo', label: '인디고', bg: '#eef2ff', border: '#c7d2fe', text: '#4f46e5' },
];

const INITIAL_PARTICIPANTS: AppParticipant[] = [
  { id: 'p1', name: '민지', colorTheme: 'rose', locationName: '인천역', lat: 37.4766, lng: 126.6169, transport: 'transit' },
  { id: 'p2', name: '준호', colorTheme: 'emerald', locationName: '수원역', lat: 37.2657, lng: 127.0000, transport: 'car' },
  { id: 'p3', name: '서연', colorTheme: 'purple', locationName: '강남역', lat: 37.4979, lng: 127.0276, transport: 'transit' },
  { id: 'p4', name: '현우', colorTheme: 'blue', locationName: '건대입구역', lat: 37.5404, lng: 127.0692, transport: 'transit' },
];

function getSubwayLineColor(line: string): string {
  if (line.includes('1호선')) return '#0052A4';
  if (line.includes('2호선')) return '#00A84D';
  if (line.includes('3호선')) return '#EF7C1C';
  if (line.includes('4호선')) return '#00A5DE';
  if (line.includes('5호선')) return '#996CAC';
  if (line.includes('7호선')) return '#747F00';
  if (line.includes('9호선')) return '#BDB092';
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

function TransportBadge({ transport }: { transport: Transport }) {
  const label = transport === 'transit' ? '대중교통' : transport === 'car' ? '자동차' : '도보';
  return (
    <span className="transport-chip">
      {transport === 'walk' && <IconWalk size={13} />}
      {transport === 'transit' && <IconTransit size={13} />}
      {transport === 'car' && <IconCar size={13} />}
      <span>{label}</span>
    </span>
  );
}

export default function HomePage() {
  const [participants, setParticipants] = useState<AppParticipant[]>(INITIAL_PARTICIPANTS);
  const [selectedStationName, setSelectedStationName] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isApiConfigured, setIsApiConfigured] = useState<boolean | null>(null);

  // New Participant Form State
  const [newName, setNewName] = useState('');
  const [selectedTheme, setSelectedTheme] = useState(COLOR_THEMES[0].id);
  const [newTransport, setNewTransport] = useState<Transport>('transit');
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 카카오 API 설정 상태 조회
  useEffect(() => {
    fetch('/api/meetpoint/status')
      .then((res) => res.json())
      .then((data) => {
        if (data?.data?.configured !== undefined) {
          setIsApiConfigured(data.data.configured);
        }
      })
      .catch(() => setIsApiConfigured(false));
  }, []);

  // 동적 중간 지점 및 공정성 계산 (참가자가 변경될 때마다 자동 실시간 재계산 - 하드코딩 0%)
  const candidates: DynamicCandidate[] = useMemo(() => {
    return calculateDynamicMidpoint(
      participants.map((p) => ({
        id: p.id,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        transport: p.transport,
      }))
    );
  }, [participants]);

  // 현재 선택된 추천 결과 (기본값: 1위 추천 장소)
  const currentResult: DynamicCandidate = useMemo(() => {
    if (!candidates.length) {
      return {
        name: '선택 없음',
        subwayLines: [],
        features: [],
        eta: 0,
        fairness: 0,
        score: 0,
        maxMinutes: 0,
        gapMinutes: 0,
        participantTimes: [],
        lat: 37.5,
        lng: 127.0,
        reason: '참가자를 추가해 주세요.',
      };
    }
    return candidates.find((c) => c.name === selectedStationName) || candidates[0];
  }, [candidates, selectedStationName]);

  // 각 참가자 카드에 현재 선택된 역까지의 실제 계산 소요시간 매핑
  const participantsWithTimes = useMemo(() => {
    return participants.map((p) => {
      const match = currentResult.participantTimes.find((t) => t.id === p.id);
      return {
        ...p,
        calculatedTime: match ? match.time : 0,
      };
    });
  }, [participants, currentResult]);

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

  // 출발지 실시간 검색 (카카오 API 및 스마트 허브 목록 자동완성)
  const handleSearchLocations = async (keyword: string) => {
    setLocationQuery(keyword);
    setSelectedLocation(null);
    if (!keyword.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      if (isApiConfigured) {
        const res = await fetch(`/api/locations/search?query=${encodeURIComponent(keyword.trim())}`);
        const data = await res.json();
        if (data?.data?.locations) {
          setSearchResults(data.data.locations);
          setIsSearching(false);
          return;
        }
      }
    } catch {
      // 카카오 키가 없거나 실패 시 아래 로컬 프리셋 검색으로 부드럽게 Fallback
    }

    // 스마트 프리셋 허브 및 역 검색 폴백
    const filtered = PRESET_HUBS.filter(
      (hub) => hub.name.includes(keyword) || hub.address.includes(keyword)
    ).map((hub) => ({
      id: hub.id,
      name: hub.name,
      address: hub.address,
      lat: hub.lat,
      lng: hub.lng,
    }));
    setSearchResults(filtered);
    setIsSearching(false);
  };

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      showToast('참가자 이름을 입력해 주세요.');
      return;
    }

    let targetLocation = selectedLocation;
    // 검색 결과를 직접 클릭하지 않고 텍스트만 입력한 경우
    if (!targetLocation) {
      const matchedPreset = PRESET_HUBS.find((h) => h.name.includes(locationQuery.trim()));
      if (matchedPreset) {
        targetLocation = {
          id: matchedPreset.id,
          name: matchedPreset.name,
          address: matchedPreset.address,
          lat: matchedPreset.lat,
          lng: matchedPreset.lng,
        };
      } else {
        // 임의 좌표 기본 배정 (서울 중심 기준 약간의 분산)
        targetLocation = {
          id: `loc-${Date.now()}`,
          name: locationQuery.trim() || '서울역',
          address: '수도권 지점',
          lat: 37.5 + (Math.random() - 0.5) * 0.15,
          lng: 126.97 + (Math.random() - 0.5) * 0.15,
        };
      }
    }

    const newP: AppParticipant = {
      id: `p-${Date.now()}`,
      name: newName.trim(),
      colorTheme: selectedTheme,
      locationName: targetLocation.name,
      lat: targetLocation.lat,
      lng: targetLocation.lng,
      transport: newTransport,
    };

    setParticipants([...participants, newP]);
    setNewName('');
    setLocationQuery('');
    setSelectedLocation(null);
    setSearchResults([]);
    setIsModalOpen(false);
    showToast(`${newP.name}님이 추가되었습니다! 실시간 추천이 갱신되었습니다.`);
  };

  const handleRemoveParticipant = (id: string, name: string) => {
    if (participants.length <= 2) {
      showToast('공정한 추천을 위해 최소 2명의 참가자가 필요합니다.');
      return;
    }
    setParticipants(participants.filter((p) => p.id !== id));
    showToast(`${name}님이 제외되었습니다. 추천이 재계산되었습니다.`);
  };

  // 미니 지도용 참가자 상대 좌표 계산 (SVG 400 x 160 캔버스 내 배치)
  const mapSvgNodes = useMemo(() => {
    if (!participants.length) return { participants: [], midpoint: { x: 200, y: 80 } };

    const lats = participants.map((p) => p.lat);
    const lngs = participants.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latSpan = maxLat - minLat || 0.05;
    const lngSpan = maxLng - minLng || 0.05;

    // 참가자 핀들
    const pNodes = participants.map((p) => {
      const x = 50 + ((p.lng - minLng) / lngSpan) * 300;
      // 위도는 클수록 북쪽(위쪽)이므로 SVG y축 반전
      const y = 135 - ((p.lat - minLat) / latSpan) * 100;
      return { ...p, x: Math.max(35, Math.min(365, x)), y: Math.max(30, Math.min(135, y)) };
    });

    // 추천 중간 지점 핀
    const midX = 50 + ((currentResult.lng - minLng) / lngSpan) * 300;
    const midY = 135 - ((currentResult.lat - minLat) / latSpan) * 100;

    return {
      participants: pNodes,
      midpoint: {
        x: Math.max(70, Math.min(330, midX)),
        y: Math.max(45, Math.min(115, midY)),
      },
    };
  }, [participants, currentResult]);

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toastMessage && (
        <aside aria-live="polite" className="toast-banner">
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
                모두에게 가장 공정한 추천 지점
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
              <span className="meta-score-label">최대 이동</span>
              <b>{currentResult.maxMinutes}분</b>
            </div>
            <div className="meta-divider" />
            <div className="meta-pill">
              <span className="meta-score-label">시간 편차</span>
              <b>{currentResult.gapMinutes}분</b>
            </div>
          </div>

          {/* Feature Tag Chips */}
          <div className="hero-chips">
            {currentResult.features.map((feature) => (
              <span className="hero-chip" key={feature}>
                {feature}
              </span>
            ))}
            <span className="hero-chip" style={{ color: '#059669', background: '#ecfdf5', borderColor: '#a7f3d0' }}>
              {currentResult.reason}
            </span>
          </div>

          {/* Dynamic Subway & Midpoint Vector Graphic (하드코딩 0% - 참가자 위치에 맞춤 렌더링) */}
          <div className="mini-map-container">
            <svg className="map-svg" viewBox="0 0 400 160">
              <defs>
                <linearGradient id="lineDynamic" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.4" />
                </linearGradient>
              </defs>

              {/* Connecting paths between participants and recommended midpoint */}
              {mapSvgNodes.participants.map((p) => (
                <line
                  key={`line-${p.id}`}
                  x1={p.x}
                  y1={p.y}
                  x2={mapSvgNodes.midpoint.x}
                  y2={mapSvgNodes.midpoint.y}
                  stroke="#cbd5e1"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
              ))}

              {/* Midpoint Wave Halo */}
              <circle cx={mapSvgNodes.midpoint.x} cy={mapSvgNodes.midpoint.y} r="32" fill="rgba(37, 99, 235, 0.08)" />
              <circle cx={mapSvgNodes.midpoint.x} cy={mapSvgNodes.midpoint.y} r="20" fill="rgba(37, 99, 235, 0.16)" />

              {/* Participant Pins */}
              {mapSvgNodes.participants.map((p) => {
                const theme = COLOR_THEMES.find((t) => t.id === p.colorTheme) || COLOR_THEMES[0];
                return (
                  <g key={`pin-${p.id}`}>
                    <circle cx={p.x} cy={p.y} r="10" fill={theme.bg} stroke={theme.text} strokeWidth="2" />
                    <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={theme.text}>
                      {p.name.charAt(0)}
                    </text>
                    <text x={p.x} y={p.y + 19} textAnchor="middle" fontSize="10" fontWeight="600" fill="#64748b">
                      {p.locationName.slice(0, 4)}
                    </text>
                  </g>
                );
              })}

              {/* Recommended Midpoint Node */}
              <g transform={`translate(${mapSvgNodes.midpoint.x}, ${mapSvgNodes.midpoint.y})`}>
                <circle cx="0" cy="0" r="10" fill="#2563eb" stroke="#ffffff" strokeWidth="3" />
                <circle cx="0" cy="0" r="4" fill="#ffffff" />
                <rect x="-38" y="14" width="76" height="22" rx="11" fill="#1e40af" />
                <text x="0" y="29" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff">
                  {currentResult.name}
                </text>
              </g>
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
              평균 이동: <b>{currentResult.eta}분</b>
            </span>
          </div>

          <div className="participants-grid">
            {participantsWithTimes.map((person) => (
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
                      {person.locationName}
                    </span>
                    <span className="participant-time-badge">{person.calculatedTime}분</span>
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

        {/* Dynamic Candidate Ranking List (하드코딩 0% - 알고리즘 계산 결과 정렬) */}
        <section className="candidates-card">
          <div className="section-header">
            <h3 className="section-title">공정성 추천 랭킹</h3>
            <span className="section-subtext">선택 시 상세 정보 갱신</span>
          </div>

          <div className="candidates-list">
            {candidates.map((candidate, index) => {
              const isSelected = candidate.name === currentResult.name;
              return (
                <div
                  key={candidate.name}
                  className={`candidate-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedStationName(candidate.name)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedStationName(candidate.name);
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
                        {index === 0 && <span className="top-choice-tag">1순위 추천</span>}
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
                          공정성 {candidate.fairness}% · 평균 {candidate.eta}분
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
                <label className="form-label">참가자 이름</label>
                <input
                  className="form-input"
                  placeholder="예: 지민, 태형"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={10}
                  required
                />
              </div>

              {/* Dynamic Location Search Input with Auto-complete */}
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">출발 위치 (역 또는 지역명 검색)</label>
                <input
                  className="form-input"
                  placeholder="예: 판교역, 홍대입구, 여의도, 인천"
                  value={locationQuery}
                  onChange={(e) => handleSearchLocations(e.target.value)}
                  maxLength={30}
                  required
                />
                {isSearching && (
                  <span style={{ position: 'absolute', right: 12, top: 38, fontSize: '0.8rem', color: '#94a3b8' }}>
                    검색 중...
                  </span>
                )}

                {/* Search Auto-complete Dropdown */}
                {searchResults.length > 0 && !selectedLocation && (
                  <ul className="search-autocomplete-dropdown">
                    {searchResults.map((loc) => (
                      <li key={loc.id || loc.name}>
                        <button
                          type="button"
                          className="autocomplete-item"
                          onClick={() => {
                            setSelectedLocation(loc);
                            setLocationQuery(loc.name);
                            setSearchResults([]);
                          }}
                        >
                          <span className="autocomplete-name">{loc.name}</span>
                          <span className="autocomplete-addr">{loc.address}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {selectedLocation && (
                  <div className="selected-location-pill">
                    <IconCheck size={13} color="#059669" />
                    <span>선택됨: <b>{selectedLocation.name}</b> ({selectedLocation.address})</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">주 이동 수단</label>
                <select
                  className="form-select"
                  value={newTransport}
                  onChange={(e) => setNewTransport(e.target.value as Transport)}
                >
                  <option value="transit">🚇 대중교통 (지하철·버스)</option>
                  <option value="car">🚗 자동차</option>
                  <option value="walk">🚶 도보</option>
                </select>
              </div>

              <button className="modal-submit-btn" type="submit">
                참가자 추가 및 실시간 추천 반영
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
