'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  IconEdit,
  IconRefresh,
  IconUtensils,
  IconCoffee,
  IconStar,
  IconThumbUp,
  IconPhone,
  IconInfo,
  IconAlert,
  IconLightbulb,
} from './components/Icons';
import {
  calculateDynamicMidpoint,
  PRESET_HUBS,
  type DynamicCandidate,
} from '@/lib/meetpoint/calculator';
import type { Location, Transport, RecommendationResult, Place, CandidateResult } from '@/lib/meetpoint/types';

export type AppParticipant = {
  id: string;
  name: string;
  colorTheme: string;
  locationName: string;
  address?: string;
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

const MAX_ALLOWED_PARTICIPANTS = 8;

const DEFAULT_STARTER_PARTICIPANTS: AppParticipant[] = [
  { id: 'p1', name: '나', colorTheme: 'blue', locationName: '강남역', address: '서울 강남구 강남대로 396', lat: 37.4979, lng: 127.0276, transport: 'transit' },
  { id: 'p2', name: '친구 1', colorTheme: 'rose', locationName: '홍대입구역', address: '서울 마포구 양화로 160', lat: 37.5575, lng: 126.9244, transport: 'transit' },
];

// 오프라인 / 카카오 키 미등록 시 데모용 추천 장소 사전 데이터 (실제 좌표 기준)
const SAMPLE_OFFLINE_PLACES: Record<string, Place[]> = {
  default: [
    { id: 'p-cafe-1', name: '스타벅스 리저브', address: '역 1번 출구 도보 2분', lat: 37.5, lng: 127.0, category: '카페 > 커피전문점', phone: '1522-3232', distanceMeters: 140 },
    { id: 'p-rest-1', name: '만족오향족발', address: '역 4번 출구 골목길', lat: 37.5, lng: 127.0, category: '음식점 > 한식', phone: '02-555-1234', distanceMeters: 230 },
    { id: 'p-cafe-2', name: '투썸플레이스', address: '역 맞은편 타워 1층', lat: 37.5, lng: 127.0, category: '카페 > 디저트카페', phone: '02-345-6789', distanceMeters: 310 },
    { id: 'p-rest-2', name: '을지다락 파스타', address: '역 2번 출구 메인스트리트 2층', lat: 37.5, lng: 127.0, category: '음식점 > 양식', phone: '02-777-8888', distanceMeters: 420 },
  ],
};

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
  if (line.includes('KTX')) return '#0033A0';
  if (line.includes('대전') || line.includes('대구') || line.includes('부산') || line.includes('광주')) return '#0284c7';
  return '#64748B';
}

function toBase64Utf8(str: string): string {
  try {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin);
  } catch {
    return '';
  }
}

function fromBase64Utf8(base64: string): string {
  try {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Web API 오류 시 아래 폴백으로 진행
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
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
  const [meetingTitle, setMeetingTitle] = useState('우리들의 약속');
  const [participants, setParticipants] = useState<AppParticipant[]>(DEFAULT_STARTER_PARTICIPANTS);
  const [selectedStationName, setSelectedStationName] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isApiConfigured, setIsApiConfigured] = useState<boolean | null>(null);

  // Live API Recommendation State
  const [liveCandidates, setLiveCandidates] = useState<DynamicCandidate[] | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);

  // Participant Form State
  const [formName, setFormName] = useState('');
  const [formTheme, setFormTheme] = useState(COLOR_THEMES[0].id);
  const [formTransport, setFormTransport] = useState<Transport>('transit');
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Candidate Voting State (기기별 단일 투표 보장)
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [myVote, setMyVote] = useState<string | null>(null);

  // Nearby Places Explorer State
  const [placeCategory, setPlaceCategory] = useState<'restaurant' | 'cafe'>('restaurant');
  const [placeRadius, setPlaceRadius] = useState<number>(1000);
  const [placeKeyword, setPlaceKeyword] = useState<string>('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [isPlacesLoading, setIsPlacesLoading] = useState(false);
  const [inspectingPlace, setInspectingPlace] = useState<Place | null>(null);
  const [placeRouteDetail, setPlaceRouteDetail] = useState<CandidateResult | null>(null);
  const [isInspectingRoute, setIsInspectingRoute] = useState(false);
  const [showConfigHelp, setShowConfigHelp] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  // 1. 초기 로드: URL 파라미터 또는 localStorage 복원
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // A. URL 쿼리 파라미터 복원 (?data=...)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sharedData = urlParams.get('data');
      if (sharedData) {
        const decodedStr = fromBase64Utf8(sharedData);
        if (decodedStr) {
          const decoded = JSON.parse(decodedStr);
          if (decoded && Array.isArray(decoded.participants) && decoded.participants.length > 0) {
            setParticipants(decoded.participants);
            if (decoded.title) setMeetingTitle(decoded.title);
            if (decoded.votes) setVotes(decoded.votes);
            showToast('공유받은 약속 정보를 불러왔습니다!');
            return;
          }
        }
      }
    } catch {
      // 파싱 실패 시 무시
    }

    // B. localStorage 복원
    try {
      const saved = localStorage.getItem('meetpoint_session_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.participants && Array.isArray(parsed.participants) && parsed.participants.length > 0) {
          setParticipants(parsed.participants);
          if (parsed.title) setMeetingTitle(parsed.title);
          if (parsed.votes) setVotes(parsed.votes);
          if (parsed.myVote) setMyVote(parsed.myVote);
        }
      }
    } catch {
      // 로컬 스토리지 오류 무시
    }
  }, []);

  // 2. 상태 변경 시 localStorage 자동 보존
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        'meetpoint_session_data',
        JSON.stringify({
          title: meetingTitle,
          participants,
          votes,
          myVote,
        })
      );
    } catch {
      // 무시
    }
  }, [meetingTitle, participants, votes, myVote]);

  // 3. 카카오 API 설정 상태 확인
  useEffect(() => {
    fetch('/api/meetpoint/status')
      .then((res) => res.json())
      .then((payload) => {
        if (payload?.data?.configured !== undefined) {
          setIsApiConfigured(payload.data.configured);
        }
      })
      .catch(() => setIsApiConfigured(false));
  }, []);

  // 4. 로컬 휴리스틱 추천 계산 (오프라인 / Fallback)
  const fallbackCandidates: DynamicCandidate[] = useMemo(() => {
    if (participants.length < 2) return [];
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

  // 5. 실시간 카카오 API 추천 연동
  const fetchLiveRecommendations = useCallback(async () => {
    if (participants.length < 2) {
      setLiveCandidates(null);
      setApiErrorMessage(null);
      return;
    }

    if (isApiConfigured !== true) {
      setLiveCandidates(null);
      return;
    }

    setIsCalculating(true);
    setApiNotice(null);
    setApiErrorMessage(null);

    try {
      const requestPayload = {
        participants: participants.map((p) => ({
          id: p.id,
          name: p.name,
          transport: p.transport,
          origin: {
            id: p.id,
            name: p.locationName,
            address: p.address || p.locationName,
            lat: p.lat,
            lng: p.lng,
          },
        })),
      };

      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      const responseJson = await res.json();
      if (res.ok && responseJson?.data?.ranked?.length > 0) {
        const liveResult: RecommendationResult = responseJson.data;

        // 카카오 API 응답을 DynamicCandidate 모델로 매핑
        const mapped: DynamicCandidate[] = liveResult.ranked.map((item) => {
          const maxMinutes = Math.ceil(item.metrics?.maxMinutes ?? 0);
          const gapMinutes = Math.round(item.metrics?.gapMinutes ?? 0);
          const averageMinutes = Math.round(item.metrics?.averageMinutes ?? 0);

          const fairness = Math.max(45, Math.min(99, Math.round(100 - gapMinutes * 1.3)));
          const score = Math.max(50, Math.min(99, Math.round(100 - (maxMinutes * 0.45 + gapMinutes * 0.45))));

          const pTimes = item.routes.map((r) => {
            const matchedP = participants.find((p) => p.id === r.participantId);
            return {
              id: r.participantId,
              name: matchedP?.name || '참가자',
              time: r.status === 'ok' ? Math.round(r.durationMinutes) : 0,
              transport: matchedP?.transport || 'transit',
              status: r.status,
              url: r.status === 'ok' ? r.url : undefined,
            };
          });

          return {
            id: item.candidate.id,
            name: item.candidate.name,
            subwayLines: [item.candidate.category?.split(' > ').slice(-1)[0] || '교통거점'],
            features: [item.candidate.address, '실시간 경로 API 기반 검증'],
            eta: averageMinutes,
            fairness,
            score,
            maxMinutes,
            gapMinutes,
            participantTimes: pTimes,
            lat: item.candidate.lat,
            lng: item.candidate.lng,
            reason: gapMinutes <= 10 ? '참가자 간 이동 편차 최소화 거점' : '최대 이동 시간 최적화 지점',
            isLiveApi: true,
          };
        });

        setLiveCandidates(mapped);
        if (liveResult.notices?.length) {
          setApiNotice(liveResult.notices[0]);
        }
      } else {
        // API 에러 발생 시 사용자 피드백 표시 및 스마트 Fallback 전환
        if (responseJson?.error?.message) {
          setApiErrorMessage(responseJson.error.message);
        }
        setLiveCandidates(null);
      }
    } catch {
      setLiveCandidates(null);
    } finally {
      setIsCalculating(false);
    }
  }, [participants, isApiConfigured]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLiveRecommendations();
    }, 400);
    return () => clearTimeout(timer);
  }, [fetchLiveRecommendations]);

  // 최종 유효 후보 목록 (실시간 API가 있으면 우선 사용, 없으면 스마트 로컬 Fallback)
  const candidates: DynamicCandidate[] = useMemo(() => {
    if (liveCandidates && liveCandidates.length > 0) return liveCandidates;
    return fallbackCandidates;
  }, [liveCandidates, fallbackCandidates]);

  // 현재 선택된 추천 결과
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
        reason: '참가자를 2명 이상 추가해 주세요.',
        isLiveApi: false,
      };
    }
    return candidates.find((c) => c.name === selectedStationName) || candidates[0];
  }, [candidates, selectedStationName]);

  // 각 참가자 카드에 현재 선택된 지점까지의 계산 시간 매핑
  const participantsWithTimes = useMemo(() => {
    return participants.map((p) => {
      const match = currentResult.participantTimes.find((t) => t.id === p.id);
      return {
        ...p,
        calculatedTime: match ? match.time : 0,
      };
    });
  }, [participants, currentResult]);

  // 6. 주변 맛집/카페 목록 조회 (카카오 Places API 또는 오프라인 스마트 추천)
  useEffect(() => {
    if (!currentResult || currentResult.name === '선택 없음') {
      setPlaces([]);
      return;
    }

    let isSubscribed = true;
    setIsPlacesLoading(true);
    setInspectingPlace(null);
    setPlaceRouteDetail(null);

    if (isApiConfigured === true) {
      const queryParams = new URLSearchParams({
        lat: String(currentResult.lat),
        lng: String(currentResult.lng),
        category: placeCategory,
        radius: String(placeRadius),
        page: '1',
        ...(placeKeyword.trim() ? { query: placeKeyword.trim() } : {}),
      });

      fetch(`/api/places?${queryParams.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          if (!isSubscribed) return;
          if (data?.data?.places && Array.isArray(data.data.places)) {
            setPlaces(data.data.places);
          } else {
            setPlaces([]);
          }
        })
        .catch(() => {
          if (isSubscribed) setPlaces([]);
        })
        .finally(() => {
          if (isSubscribed) setIsPlacesLoading(false);
        });
    } else {
      // 카카오 키 미등록 시에도 테스트 가능한 스마트 오프라인 장소 제공
      const sampleList = (SAMPLE_OFFLINE_PLACES.default || []).filter((p) =>
        placeCategory === 'restaurant' ? p.category.includes('음식점') : p.category.includes('카페')
      );
      setPlaces(sampleList);
      setIsPlacesLoading(false);
    }

    return () => {
      isSubscribed = false;
    };
  }, [currentResult, placeCategory, placeRadius, placeKeyword, isApiConfigured]);

  // 특정 세부 장소(식당/카페)까지의 참가자별 이동시간 조회
  const handleInspectPlace = async (place: Place) => {
    if (participants.length < 2) return;
    setInspectingPlace(place);
    setIsInspectingRoute(true);

    if (isApiConfigured === true) {
      try {
        const res = await fetch('/api/routes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participants: participants.map((p) => ({
              id: p.id,
              name: p.name,
              transport: p.transport,
              origin: {
                id: p.id,
                name: p.locationName,
                address: p.address || p.locationName,
                lat: p.lat,
                lng: p.lng,
              },
            })),
            destination: place,
          }),
        });
        const data = await res.json();
        if (res.ok && data?.data) {
          setPlaceRouteDetail(data.data);
        }
      } catch {
        showToast('이 장소까지의 경로를 조회하지 못했습니다.');
      } finally {
        setIsInspectingRoute(false);
      }
    } else {
      // 오프라인 모드에서는 중심 거점 대비 추가 도보 시간(2~5분)을 반영해 시뮬레이션
      setTimeout(() => {
        const simulatedRoutes = participants.map((p) => {
          const baseTime = currentResult.participantTimes.find((t) => t.id === p.id)?.time || 20;
          return {
            status: 'ok' as const,
            participantId: p.id,
            destinationId: place.id,
            transport: p.transport,
            durationMinutes: baseTime + 3,
            distanceMeters: 250,
            fetchedAt: new Date().toISOString(),
            timeBasis: 'query-time' as const,
            provider: 'same-location' as const,
          };
        });

        const times = simulatedRoutes.map((r) => r.durationMinutes);
        setPlaceRouteDetail({
          candidate: place,
          routes: simulatedRoutes,
          metrics: {
            maxMinutes: Math.max(...times),
            gapMinutes: Math.max(...times) - Math.min(...times),
            averageMinutes: times.reduce((a, b) => a + b, 0) / times.length,
          },
        });
        setIsInspectingRoute(false);
      }, 300);
    }
  };

  // 7. 실시간 출발지 검색 (디바운스 적용 및 하드코딩 완전 배제)
  const handleSearchLocations = (keyword: string) => {
    setLocationQuery(keyword);
    setSelectedLocation(null);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!keyword.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        if (isApiConfigured) {
          const res = await fetch(`/api/locations/search?query=${encodeURIComponent(keyword.trim())}`);
          const data = await res.json();
          if (data?.data?.locations && data.data.locations.length > 0) {
            setSearchResults(data.data.locations);
            setIsSearching(false);
            return;
          }
        }
      } catch {
        // API 오류 시 로컬 프리셋 검색으로 부드럽게 Fallback
      }

      // 로컬 전국 프리셋 데이터 검색 Fallback
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
    }, 250);
  };

  // 모달 열기: 신규 추가 또는 기존 참가자 수정
  const openModal = (participant?: AppParticipant) => {
    if (!participant && participants.length >= MAX_ALLOWED_PARTICIPANTS) {
      showToast(`참가자는 최대 ${MAX_ALLOWED_PARTICIPANTS}명까지 등록할 수 있습니다.`);
      return;
    }

    if (participant) {
      setEditingParticipantId(participant.id);
      setFormName(participant.name);
      setFormTheme(participant.colorTheme);
      setFormTransport(participant.transport);
      setLocationQuery(participant.locationName);
      setSelectedLocation({
        id: `loc-${participant.id}`,
        name: participant.locationName,
        address: participant.address || participant.locationName,
        lat: participant.lat,
        lng: participant.lng,
      });
    } else {
      setEditingParticipantId(null);
      setFormName('');
      setFormTheme(COLOR_THEMES[participants.length % COLOR_THEMES.length].id);
      setFormTransport('transit');
      setLocationQuery('');
      setSelectedLocation(null);
    }
    setSearchResults([]);
    setIsModalOpen(true);
  };

  // 참가자 저장 (추가/수정) - 무작위 좌표 완전 제거 및 정밀 검증
  const handleSaveParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('참가자 이름을 입력해 주세요.');
      return;
    }

    let targetLocation = selectedLocation;
    // 목록에서 직접 클릭하지 않고 텍스트만 입력하고 제출한 경우
    if (!targetLocation) {
      if (searchResults.length > 0) {
        targetLocation = searchResults[0];
      } else {
        const matched = PRESET_HUBS.find((h) => h.name.includes(locationQuery.trim()));
        if (matched) {
          targetLocation = {
            id: matched.id,
            name: matched.name,
            address: matched.address,
            lat: matched.lat,
            lng: matched.lng,
          };
        }
      }
    }

    if (!targetLocation) {
      showToast('출발 장소를 검색 결과 목록에서 선택해 주세요.');
      return;
    }

    if (editingParticipantId) {
      // 수정
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === editingParticipantId
            ? {
                ...p,
                name: formName.trim(),
                colorTheme: formTheme,
                locationName: targetLocation!.name,
                address: targetLocation!.address || targetLocation!.name,
                lat: targetLocation!.lat,
                lng: targetLocation!.lng,
                transport: formTransport,
              }
            : p
        )
      );
      showToast(`${formName.trim()}님의 정보가 수정되었습니다.`);
    } else {
      // 신규 추가
      if (participants.length >= MAX_ALLOWED_PARTICIPANTS) {
        showToast(`참가자는 최대 ${MAX_ALLOWED_PARTICIPANTS}명까지 가능합니다.`);
        return;
      }
      const newP: AppParticipant = {
        id: `p-${Date.now()}`,
        name: formName.trim(),
        colorTheme: formTheme,
        locationName: targetLocation.name,
        address: targetLocation.address || targetLocation.name,
        lat: targetLocation.lat,
        lng: targetLocation.lng,
        transport: formTransport,
      };
      setParticipants((prev) => [...prev, newP]);
      showToast(`${newP.name}님이 추가되었습니다.`);
    }

    setIsModalOpen(false);
  };

  // 참가자 삭제
  const handleRemoveParticipant = (id: string, name: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    showToast(`${name}님이 제외되었습니다.`);
  };

  // 전체 초기화 (새 약속 시작)
  const handleResetMeeting = () => {
    if (confirm('현재 약속 정보를 초기화하고 새로 시작하시겠습니까?')) {
      setMeetingTitle('우리들의 약속');
      setParticipants([]);
      setVotes({});
      setMyVote(null);
      setLiveCandidates(null);
      setSelectedStationName('');
      try {
        localStorage.removeItem('meetpoint_session_data');
      } catch {
        // 무시
      }
      showToast('약속 정보가 초기화되었습니다. 참가자를 추가해 주세요.');
    }
  };

  // 단일 투표 토글 기능
  const handleVote = (candidateName: string, e: React.MouseEvent) => {
    e.stopPropagation();

    setVotes((prev) => {
      const nextVotes = { ...prev };
      if (myVote === candidateName) {
        // 투표 취소
        nextVotes[candidateName] = Math.max(0, (nextVotes[candidateName] || 1) - 1);
        setMyVote(null);
        showToast(`'${candidateName}' 투표를 취소했습니다.`);
      } else {
        // 이전 투표가 있었다면 이전 투표 차감
        if (myVote && nextVotes[myVote]) {
          nextVotes[myVote] = Math.max(0, nextVotes[myVote] - 1);
        }
        nextVotes[candidateName] = (nextVotes[candidateName] || 0) + 1;
        setMyVote(candidateName);
        showToast(`'${candidateName}'에 투표하셨습니다!`);
      }
      return nextVotes;
    });
  };

  // 약속 URL 공유 (참가자 및 제목 정보 인코딩 포함)
  const handleShare = async () => {
    if (participants.length === 0) {
      showToast('공유할 참가자 정보가 없습니다.');
      return;
    }

    const payload = {
      title: meetingTitle,
      participants: participants.map((p) => ({
        id: p.id,
        name: p.name,
        colorTheme: p.colorTheme,
        locationName: p.locationName,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        transport: p.transport,
      })),
      votes,
    };

    const encoded = toBase64Utf8(JSON.stringify(payload));
    const shareUrl = `${window.location.origin}${window.location.pathname}?data=${encoded}`;

    const copied = await copyToClipboard(shareUrl);
    if (copied) {
      showToast('약속 링크가 복사되었습니다! 친구에게 전달하면 동일한 정보로 열립니다.');
    } else {
      prompt('아래 공유 링크를 복사하여 친구들에게 전달하세요:', shareUrl);
    }
  };

  // 약속 텍스트 요약 복사
  const handleCopySummary = async () => {
    if (!currentResult || currentResult.name === '선택 없음') {
      showToast('추천 결과가 생성된 후 복사할 수 있습니다.');
      return;
    }

    const lines = [
      `[MeetPoint 약속 안내]`,
      `- 모임명: ${meetingTitle}`,
      `- 추천 중간 장소: ${currentResult.name}`,
      `- 평균 이동시간: 약 ${currentResult.eta}분 (공정성 지수: ${currentResult.fairness}%)`,
      `\n[참가자별 소요 시간]`,
      ...participantsWithTimes.map(
        (p) =>
          `• ${p.name} (${p.locationName} 출발 / ${p.transport === 'transit' ? '대중교통' : p.transport === 'car' ? '자동차' : '도보'}): 약 ${p.calculatedTime}분`
      ),
      `\n- 약속 링크: ${window.location.href}`,
    ];

    const copied = await copyToClipboard(lines.join('\n'));
    if (copied) {
      showToast('약속 상세 요약 텍스트가 복사되었습니다. 메신저에 붙여넣으세요!');
    } else {
      prompt('아래 요약 텍스트를 복사하세요:', lines.join('\n'));
    }
  };

  // 미니 SVG 지도 좌표 계산
  const mapSvgNodes = useMemo(() => {
    if (!participants.length) return { participants: [], midpoint: { x: 200, y: 80 } };

    const lats = participants.map((p) => p.lat);
    const lngs = participants.map((p) => p.lng);
    const minLat = Math.min(...lats, currentResult.lat);
    const maxLat = Math.max(...lats, currentResult.lat);
    const minLng = Math.min(...lngs, currentResult.lng);
    const maxLng = Math.max(...lngs, currentResult.lng);

    const latSpan = maxLat - minLat || 0.05;
    const lngSpan = maxLng - minLng || 0.05;

    const pNodes = participants.map((p, idx) => {
      // 핀 겹침 방지 오프셋
      const jitterX = (idx % 2 === 0 ? 1 : -1) * (idx * 2);
      const jitterY = (idx % 2 === 0 ? -1 : 1) * (idx * 2);

      const x = 50 + ((p.lng - minLng) / lngSpan) * 300 + jitterX;
      const y = 135 - ((p.lat - minLat) / latSpan) * 100 + jitterY;
      return { ...p, x: Math.max(35, Math.min(365, x)), y: Math.max(30, Math.min(135, y)) };
    });

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

  // 최다 득표 장소 산출
  const mostVotedStation = useMemo(() => {
    let topName = '';
    let topCount = 0;
    Object.entries(votes).forEach(([name, count]) => {
      if (count > topCount) {
        topCount = count;
        topName = name;
      }
    });
    return topCount > 0 ? topName : null;
  }, [votes]);

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
          {/* API 상태 뱃지 & 안내 토글 */}
          {isApiConfigured === true ? (
            <span className="api-status-badge live" title="카카오 실시간 경로 및 장소 API 연동 중">
              <span className="status-dot" />
              실시간 API
            </span>
          ) : (
            <button
              type="button"
              className="api-status-badge fallback"
              onClick={() => setShowConfigHelp(!showConfigHelp)}
              title="카카오 키 미설정: 스마트 추정 모드 (클릭하여 설정 안내 보기)"
            >
              <span className="status-dot" />
              스마트 추정
            </button>
          )}

          <Link href="/planner" className="planner-link-btn" title="전체 플래너 화면으로 이동">
            <span>플래너</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </Link>
          <button className="icon-btn" type="button" onClick={handleShare} aria-label="약속 공유하기" title="약속 공유 링크 복사">
            <IconShare size={19} />
          </button>
        </div>
      </header>

      {/* API Key Guide Collapsible Box (키 미설정 시) */}
      {showConfigHelp && isApiConfigured === false && (
        <aside style={{ margin: '10px 16px', padding: '14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', fontSize: '0.82rem', color: '#92400e' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <IconLightbulb size={15} color="#b45309" />
              카카오 실시간 경로 API 활성화 방법
            </strong>
            <button
              type="button"
              onClick={() => setShowConfigHelp(false)}
              style={{ background: 'transparent', color: '#b45309', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '2px' }}
              aria-label="안내 닫기"
            >
              <IconClose size={14} color="#b45309" />
            </button>
          </div>
          <p style={{ marginBottom: '6px' }}>
            프로젝트 루트의 <code>.env.local</code> 파일에 아래와 같이 카카오 REST API 키를 등록하면 실시간 지하철·버스 및 자동차 경로가 연동됩니다:
          </p>
          <pre style={{ background: '#fef3c7', padding: '6px 10px', borderRadius: '6px', fontSize: '0.78rem', overflowX: 'auto', userSelect: 'all' }}>
            KAKAO_REST_API_KEY=발급받은_REST_API_키
          </pre>
        </aside>
      )}

      {/* Meeting Title Bar */}
      <div className="meeting-title-bar">
        <div className="meeting-title-input-wrap">
          <input
            className="meeting-title-input"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            maxLength={25}
            title="약속 모임명 수정"
          />
        </div>
        <button
          className="btn-meeting-reset"
          type="button"
          onClick={handleResetMeeting}
          title="새 약속 시작 (전체 초기화)"
        >
          <IconRefresh size={12} />
          <span>초기화</span>
        </button>
      </div>

      {/* Main Content */}
      <main className="main-content">
        {/* API 알림 및 에러 안내 */}
        {apiErrorMessage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: '#fef2f2', border: '1px solid #fecdd3', borderRadius: '10px', fontSize: '0.8rem', color: '#dc2626', marginBottom: '12px' }}>
            <IconAlert size={14} color="#dc2626" />
            <span>{apiErrorMessage} (스마트 추정 모드로 전환되었습니다)</span>
          </div>
        )}
        {apiNotice && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: '#eff6ff', borderRadius: '8px', fontSize: '0.78rem', color: '#1d4ed8', marginBottom: '10px' }}>
            <IconInfo size={14} color="#1d4ed8" />
            <span>{apiNotice}</span>
          </div>
        )}

        {/* Recommendation Hero Card */}
        {participants.length >= 2 ? (
          <section className="hero-card">
            <div className="hero-header">
              <div className="hero-title-group">
                <span className="hero-eyebrow">
                  <IconSparkles size={13} color="#2563eb" />
                  {currentResult.isLiveApi ? '카카오 실시간 경로 검증 완료' : '공정성 최적 추천 지점'}
                </span>
                <h2>{currentResult.name}</h2>
              </div>
              <div className="badge-fairness">
                <span className="badge-label">공정성 지수</span>
                <span className="badge-value">{currentResult.fairness}%</span>
              </div>
            </div>

            {/* Fairness Progress Meter */}
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
              {currentResult.subwayLines.map((line) => (
                <span
                  key={line}
                  className="hero-chip"
                  style={{
                    borderColor: getSubwayLineColor(line),
                    color: getSubwayLineColor(line),
                    fontWeight: 700,
                  }}
                >
                  {line}
                </span>
              ))}
              {currentResult.features.map((feature) => (
                <span className="hero-chip" key={feature}>
                  {feature}
                </span>
              ))}
              <span className="hero-chip" style={{ color: '#059669', background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                {currentResult.reason}
              </span>
            </div>

            {/* Dynamic Vector Map */}
            <div className="mini-map-container">
              <svg className="map-svg" viewBox="0 0 400 160">
                {/* Connecting lines between participants and recommended midpoint */}
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
        ) : null}

        {/* Participants Section */}
        <section style={{ marginTop: '20px' }}>
          <div className="section-header">
            <h3 className="section-title">
              참여자 <span className="participant-count">{participants.length}명</span>
            </h3>
            {participants.length >= 2 && (
              <span className="section-subtext">
                {isCalculating ? '경로 계산 중...' : `평균 이동: ${currentResult.eta}분`}
              </span>
            )}
          </div>

          <div className="participants-grid">
            {participants.length === 0 ? (
              <div className="empty-participants-card">
                <p>아직 등록된 참가자가 없습니다.</p>
                <button
                  className="btn-add-first-participant"
                  type="button"
                  onClick={() => openModal()}
                >
                  <IconPlus size={16} color="#ffffff" />
                  <span>첫 번째 참가자 추가하기</span>
                </button>
              </div>
            ) : (
              <>
                {participantsWithTimes.map((person) => (
                  <div className="participant-card" key={person.id}>
                    <AvatarInitial name={person.name} themeId={person.colorTheme} />
                    <div className="participant-info">
                      <div className="participant-name-row">
                        <span className="participant-name">{person.name}</span>
                        <div className="participant-actions">
                          <button
                            className="participant-edit-btn"
                            type="button"
                            onClick={() => openModal(person)}
                            title="참여자 정보 수정"
                            aria-label={`${person.name} 수정`}
                          >
                            <IconEdit size={13} />
                          </button>
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
                      </div>
                      <div className="participant-meta-row">
                        <span className="participant-location" title={person.address || person.locationName}>
                          <IconPin size={11} color="#94a3b8" />
                          {person.locationName}
                        </span>
                        {participants.length >= 2 && (
                          <span className="participant-time-badge">{person.calculatedTime}분</span>
                        )}
                      </div>
                      <div className="participant-transport-row">
                        <TransportBadge transport={person.transport} />
                      </div>
                    </div>
                  </div>
                ))}

                {participants.length < MAX_ALLOWED_PARTICIPANTS && (
                  <button
                    className="add-participant-card"
                    type="button"
                    onClick={() => openModal()}
                    aria-label="새 참가자 추가"
                  >
                    <div className="add-icon-circle">
                      <IconPlus size={16} color="#2563eb" />
                    </div>
                    <span>참가자 추가</span>
                  </button>
                )}
              </>
            )}
          </div>

          {participants.length === 1 && (
            <div style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', borderRadius: '10px', fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>
              공정한 중간 지점 계산을 위해 <b>친구 1명 이상</b>을 더 추가해 주세요.
            </div>
          )}
        </section>

        {/* Dynamic Candidate Ranking List */}
        {candidates.length > 0 && (
          <section className="candidates-card">
            <div className="section-header">
              <h3 className="section-title">공정성 추천 랭킹</h3>
              <span className="section-subtext">선택 시 상세 정보 갱신</span>
            </div>

            <div className="candidates-list">
              {candidates.map((candidate, index) => {
                const isSelected = candidate.name === currentResult.name;
                const voteCount = votes[candidate.name] || 0;
                const isTopVoted = mostVotedStation === candidate.name;
                const isMyVote = myVote === candidate.name;

                return (
                  <div
                    key={candidate.name}
                    className={`candidate-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedStationName(candidate.name)}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedStationName(candidate.name);
                      }
                    }}
                  >
                    <div className="candidate-rank-info">
                      <div className="rank-badge">{index + 1}</div>
                      <div>
                        <div className="candidate-name-row">
                          <span className="candidate-name">{candidate.name}</span>
                          {index === 0 && <span className="top-choice-tag">1순위 추천</span>}
                          {isTopVoted && (
                            <span className="top-voted-badge">
                              <IconStar size={11} color="#b45309" />
                              <span>최다 득표</span>
                            </span>
                          )}
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
                            공정성 {candidate.fairness}% · 평균 {candidate.eta}분 (최대 {candidate.maxMinutes}분)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="candidate-stats">
                      <div className="candidate-voting-wrap">
                        <button
                          type="button"
                          className={`btn-candidate-vote ${isMyVote ? 'has-voted' : ''}`}
                          onClick={(e) => handleVote(candidate.name, e)}
                          title={isMyVote ? '투표 취소' : `${candidate.name}에 투표`}
                        >
                          <IconThumbUp size={12} color={isMyVote ? '#1d4ed8' : '#64748b'} />
                          <span>{voteCount > 0 ? `${voteCount}표` : '투표'}</span>
                        </button>
                      </div>
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
        )}

        {/* Nearby Places (Restaurants / Cafes) Explorer */}
        {candidates.length > 0 && currentResult.name !== '선택 없음' && (
          <section className="places-explorer-section">
            <div className="places-header">
              <h3 className="places-title">
                <IconUtensils size={16} color="#2563eb" />
                {currentResult.name} 주변 장소 탐색
              </h3>
              <div className="places-category-toggle">
                <button
                  type="button"
                  className={`places-category-btn ${placeCategory === 'restaurant' ? 'active' : ''}`}
                  onClick={() => setPlaceCategory('restaurant')}
                >
                  <IconUtensils size={13} />
                  <span>맛집</span>
                </button>
                <button
                  type="button"
                  className={`places-category-btn ${placeCategory === 'cafe' ? 'active' : ''}`}
                  onClick={() => setPlaceCategory('cafe')}
                >
                  <IconCoffee size={13} />
                  <span>카페</span>
                </button>
              </div>
            </div>

            <div className="places-filter-bar">
              <input
                className="places-keyword-input"
                placeholder={placeCategory === 'restaurant' ? '예: 삼겹살, 파스타, 초밥' : '예: 베이커리, 디저트'}
                value={placeKeyword}
                onChange={(e) => setPlaceKeyword(e.target.value)}
                maxLength={40}
              />
              <select
                className="places-radius-select"
                value={placeRadius}
                onChange={(e) => setPlaceRadius(Number(e.target.value))}
              >
                <option value={500}>500m</option>
                <option value={1000}>1km</option>
                <option value={2000}>2km</option>
              </select>
            </div>

            {isPlacesLoading ? (
              <div className="loading-indicator-row">
                <span className="loading-spinner-circle" />
                <span>주변 {placeCategory === 'restaurant' ? '맛집' : '카페'}을 검색하고 있습니다...</span>
              </div>
            ) : places.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                이 조건에 맞는 장소가 없습니다. 검색어를 바꾸거나 반경을 넓혀보세요.
              </div>
            ) : (
              <div className="places-list">
                {places.slice(0, 8).map((place) => {
                  const isInspected = inspectingPlace?.id === place.id;
                  return (
                    <article className="place-card-item" key={place.id}>
                      <div className="place-top-row">
                        <span className="place-card-name">{place.name}</span>
                        {place.distanceMeters !== undefined && (
                          <span className="place-card-dist">{Math.round(place.distanceMeters)}m</span>
                        )}
                      </div>
                      <div className="place-card-meta">
                        <span>{place.address}</span>
                        {place.phone && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <IconPhone size={11} color="#64748b" />
                            <span>{place.phone}</span>
                          </span>
                        )}
                      </div>

                      <div className="place-action-row">
                        <button
                          type="button"
                          className="btn-inspect-place"
                          onClick={() => handleInspectPlace(place)}
                        >
                          <span>여기까지 이동시간 확인</span>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </button>
                        {place.url && (
                          <a href={place.url} target="_blank" rel="noreferrer" className="place-map-link">
                            카카오 지도 ↗
                          </a>
                        )}
                      </div>

                      {/* Detail Route Time Breakdown for this specific place */}
                      {isInspected && (
                        <div className="place-routes-detail-box">
                          {isInspectingRoute ? (
                            <div className="loading-indicator-row" style={{ padding: '6px' }}>
                              <span className="loading-spinner-circle" />
                              <span>각 참가자별 이동 시간 산출 중...</span>
                            </div>
                          ) : placeRouteDetail ? (
                            <div>
                              <div className="place-routes-title" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <IconPin size={13} color="#2563eb" />
                                <span>{place.name}까지 예상 이동시간</span>
                                {placeRouteDetail.metrics && (
                                  <span style={{ marginLeft: '8px', color: '#2563eb' }}>
                                    (최대 {Math.ceil(placeRouteDetail.metrics.maxMinutes)}분 / 평균 {Math.round(placeRouteDetail.metrics.averageMinutes)}분)
                                  </span>
                                )}
                              </div>
                              {placeRouteDetail.routes.map((r) => {
                                const matched = participants.find((p) => p.id === r.participantId);
                                const pTransport = matched?.transport || 'transit';
                                return (
                                  <div className="place-participant-route" key={r.participantId}>
                                    <span><b>{matched?.name || '참가자'}</b> ({pTransport === 'transit' ? '대중교통' : pTransport === 'car' ? '자동차' : '도보'})</span>
                                    <span>{r.status === 'ok' ? `약 ${Math.ceil(r.durationMinutes)}분` : '경로 확인 불가'}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Floating Bottom Action Bar */}
      <footer className="bottom-bar">
        <button
          className="primary-cta-btn"
          type="button"
          onClick={handleCopySummary}
          title="카카오톡 및 메신저 공유용 요약 복사"
        >
          <IconShare size={18} color="#ffffff" />
          <span>약속 장소 및 이동시간 요약 복사</span>
        </button>
      </footer>

      {/* Add / Edit Participant Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingParticipantId ? '참가자 정보 수정' : '새 참가자 추가'}
              </h3>
              <button
                className="modal-close-btn"
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="닫기"
              >
                <IconClose size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveParticipant}>
              {/* Profile Color Theme Picker */}
              <div className="form-group">
                <label className="form-label">프로필 테마 컬러</label>
                <div className="theme-picker-row">
                  {COLOR_THEMES.map((theme) => {
                    const isSelected = formTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        className={`theme-chip-btn ${isSelected ? 'selected' : ''}`}
                        style={{
                          backgroundColor: theme.bg,
                          borderColor: isSelected ? theme.text : theme.border,
                        }}
                        onClick={() => setFormTheme(theme.id)}
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
                  placeholder="예: 지민, 준호, 서연"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  maxLength={12}
                  required
                />
              </div>

              {/* Dynamic Location Search Input */}
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">출발 위치 (전국 역명, 도로명, 지역 검색)</label>
                <input
                  className="form-input"
                  placeholder="예: 강남역, 판교역, 부산역, 대전역, 수원"
                  value={locationQuery}
                  onChange={(e) => handleSearchLocations(e.target.value)}
                  maxLength={40}
                  required
                />
                {isSearching && (
                  <span style={{ position: 'absolute', right: 12, top: 38, fontSize: '0.8rem', color: '#94a3b8' }}>
                    검색 중...
                  </span>
                )}

                {/* Auto-complete Dropdown */}
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
                  value={formTransport}
                  onChange={(e) => setFormTransport(e.target.value as Transport)}
                >
                  <option value="transit">대중교통 (지하철·버스)</option>
                  <option value="car">자동차</option>
                  <option value="walk">도보</option>
                </select>
              </div>

              <button className="modal-submit-btn" type="submit">
                {editingParticipantId ? '참가자 정보 저장' : '참가자 추가 및 추천 반영'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
