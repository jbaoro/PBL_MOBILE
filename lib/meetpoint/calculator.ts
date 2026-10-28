import type { Location, Transport } from './types';

// 수도권 및 전국 주요 교통 거점 역 데이터 (카카오 키가 없을 때의 스마트 지오코딩 및 기본 허브 목록)
export const PRESET_HUBS: (Location & { subwayLines: string[]; features: string[] })[] = [
  {
    id: 'hub-gangnam',
    name: '강남역',
    address: '서울 강남구 강남대로 396',
    lat: 37.4979,
    lng: 127.0276,
    subwayLines: ['2호선', '신분당선'],
    features: ['환승 편리', '맛집·카페 밀집', '강남 중심축'],
  },
  {
    id: 'hub-sadang',
    name: '사당역',
    address: '서울 동작구 남부순환로 2089',
    lat: 37.4765,
    lng: 126.9816,
    subwayLines: ['2호선', '4호선'],
    features: ['경기 남부·인천 환승 허브', '교통 요충지'],
  },
  {
    id: 'hub-hongdae',
    name: '홍대입구역',
    address: '서울 마포구 양화로 160',
    lat: 37.5575,
    lng: 126.9244,
    subwayLines: ['2호선', '공항철도', '경의중앙'],
    features: ['서부권 약속 명소', '다양한 복합 문화'],
  },
  {
    id: 'hub-seoul',
    name: '서울역',
    address: '서울 중구 한강대로 405',
    lat: 37.5547,
    lng: 126.9707,
    subwayLines: ['1호선', '4호선', '공항철도', 'KTX'],
    features: ['수도권 광역 철도망 허브', '전국 연결 중심'],
  },
  {
    id: 'hub-gundae',
    name: '건대입구역',
    address: '서울 광진구 아차산로 243',
    lat: 37.5404,
    lng: 127.0692,
    subwayLines: ['2호선', '7호선'],
    features: ['동부권 접근성', '약속 장소 다수', '2/7호선 환승'],
  },
  {
    id: 'hub-sindorim',
    name: '신도림역',
    address: '서울 구로구 경인로 688',
    lat: 37.5088,
    lng: 126.8912,
    subwayLines: ['1호선', '2호선'],
    features: ['인천·부천·서남부 환승 관문', '쇼핑몰 인접'],
  },
  {
    id: 'hub-yeouido',
    name: '여의도역',
    address: '서울 영등포구 여의나루로 40',
    lat: 37.5216,
    lng: 126.9242,
    subwayLines: ['5호선', '9호선'],
    features: ['금융 중심지', '9호선 급행 연결', '더현대 인접'],
  },
  {
    id: 'hub-express-bus',
    name: '고속터미널역',
    address: '서울 서초구 신반포로 188',
    lat: 37.5049,
    lng: 127.0049,
    subwayLines: ['3호선', '7호선', '9호선'],
    features: ['트리플 환승역', '광역 버스 및 백화점 인접'],
  },
  {
    id: 'hub-pangyo',
    name: '판교역',
    address: '경기 성남시 분당구 판교역로 160',
    lat: 37.3948,
    lng: 127.1112,
    subwayLines: ['신분당선', '경강선'],
    features: ['경기 남부 IT 허브', '강남 14분 연결'],
  },
  {
    id: 'hub-jongno3ga',
    name: '종로3가역',
    address: '서울 종로구 종로 129',
    lat: 37.5716,
    lng: 126.9918,
    subwayLines: ['1호선', '3호선', '5호선'],
    features: ['서울 사대문 중심', '트리플 환승'],
  },
];

// 위도/경도 간 하버사인(Haversine) 직선 거리 계산 (단위: km)
export function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // 지구 반경 (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 교통수단별 예상 이동시간 산출 모델 (수도권 교통망 보정치 적용)
export function estimateTravelTimeMinutes(distanceKm: number, transport: Transport): number {
  if (distanceKm < 0.3) return 3; // 매우 인접

  if (transport === 'walk') {
    // 도보 평균 시속 4.2 km/h
    return Math.round((distanceKm / 4.2) * 60);
  }

  if (transport === 'car') {
    // 도심 자동차: 도로 우회율 1.35x, 평균 속도 25~35 km/h
    const roadDist = distanceKm * 1.35;
    const minutes = 5 + (roadDist / 30) * 60;
    return Math.round(minutes);
  }

  // 대중교통 (transit): 기본 대기/도보 8분 + 평균 시속 28km/h + 환승 가산
  const transitDist = distanceKm * 1.25;
  const transferPenalty = distanceKm > 10 ? 8 : 4;
  const minutes = 8 + (transitDist / 28) * 60 + transferPenalty;
  return Math.round(minutes);
}

export type DynamicCandidate = {
  name: string;
  subwayLines: string[];
  features: string[];
  eta: number; // 평균 이동 시간
  fairness: number; // 공정성 점수 (100점 만점)
  score: number; // 종합 추천 점수
  maxMinutes: number;
  gapMinutes: number; // 최대-최소 시간차
  participantTimes: { id: string; name: string; time: number }[];
  lat: number;
  lng: number;
  reason: string;
};

// 동적 중간 지점 및 공정성 계산 엔진
export function calculateDynamicMidpoint(
  participants: { id: string; name: string; lat: number; lng: number; transport: Transport }[]
): DynamicCandidate[] {
  if (!participants.length) return [];

  // 1. 각 후보 허브별로 모든 참가자의 이동 시간 계산
  const candidateScores = PRESET_HUBS.map((hub) => {
    const times = participants.map((p) => {
      const dist = calculateDistanceKm(p.lat, p.lng, hub.lat, hub.lng);
      const time = estimateTravelTimeMinutes(dist, p.transport);
      return { id: p.id, name: p.name, time };
    });

    const timeValues = times.map((t) => t.time);
    const maxMinutes = Math.max(...timeValues);
    const minMinutes = Math.min(...timeValues);
    const gapMinutes = maxMinutes - minMinutes;
    const averageMinutes = Math.round(timeValues.reduce((a, b) => a + b, 0) / timeValues.length);

    // 공정성 점수: 편차가 적을수록 100점에 수렴 (1분 편차당 -1.5점 감점)
    const fairness = Math.max(50, Math.min(99, Math.round(100 - gapMinutes * 1.4)));

    // 종합 추천 점수: (최대 이동시간 패널티 0.5) + (편차 패널티 0.5)
    const score = Math.max(55, Math.min(99, Math.round(100 - (maxMinutes * 0.45 + gapMinutes * 0.45))));

    let reason = `${hub.subwayLines.join('·')} 환승 연계`;
    if (gapMinutes <= 10) {
      reason += ' 및 참가자 간 이동 편차 최소화';
    } else {
      reason += ' 및 주요 도심 접근성 우수';
    }

    return {
      name: hub.name,
      subwayLines: hub.subwayLines,
      features: hub.features,
      eta: averageMinutes,
      fairness,
      score,
      maxMinutes,
      gapMinutes,
      participantTimes: times,
      lat: hub.lat,
      lng: hub.lng,
      reason,
    };
  });

  // 2. JJY 랭킹 알고리즘 기준: maxMinutes 오름차순 -> gapMinutes 오름차순 -> averageMinutes 오름차순
  candidateScores.sort((a, b) => {
    if (a.maxMinutes !== b.maxMinutes) return a.maxMinutes - b.maxMinutes;
    if (a.gapMinutes !== b.gapMinutes) return a.gapMinutes - b.gapMinutes;
    return a.eta - b.eta;
  });

  return candidateScores.slice(0, 5);
}
