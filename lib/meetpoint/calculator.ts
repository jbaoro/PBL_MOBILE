import type { Location, Transport } from './types';

// 전국 주요 교통 거점 역 데이터 (오프라인/API 미설정 시 스마트 지오코딩 및 기본 허브 목록)
export const PRESET_HUBS: (Location & { subwayLines: string[]; features: string[] })[] = [
  // 수도권 거점
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
  {
    id: 'hub-suwon',
    name: '수원역',
    address: '경기 수원시 팔달구 덕영대로 924',
    lat: 37.2657,
    lng: 127.0000,
    subwayLines: ['1호선', '수인분당선', 'KTX'],
    features: ['경기 남부 최대 교통 요충지', '광역 철도 연계'],
  },
  {
    id: 'hub-bupyeong',
    name: '부평역',
    address: '인천 부평구 광장로 16',
    lat: 37.4895,
    lng: 126.7248,
    subwayLines: ['1호선', '인천1호선'],
    features: ['인천 최대 환승 거점', '지하상가·상권 밀집'],
  },
  {
    id: 'hub-ilsan',
    name: '정발산역',
    address: '경기 고양시 일산동구 중앙로 1270',
    lat: 37.6583,
    lng: 126.7735,
    subwayLines: ['3호선', '일산문화광장'],
    features: ['고양·일산 중심 문화 상권', '라페스타·웨스턴돔'],
  },
  // 전국 주요 광역 거점
  {
    id: 'hub-daejeon',
    name: '대전역',
    address: '대전 동구 중앙로 215',
    lat: 36.3323,
    lng: 127.4342,
    subwayLines: ['KTX', '대전1호선'],
    features: ['국토 중심 광역 철도망', '중부권 최대 환승'],
  },
  {
    id: 'hub-dongdaegu',
    name: '동대구역',
    address: '대구 동구 동대구로 550',
    lat: 35.8797,
    lng: 128.6285,
    subwayLines: ['KTX', '대구1호선', '복합환승센터'],
    features: ['영남권 광역 교통 중심', '신세계백화점 인접'],
  },
  {
    id: 'hub-busan',
    name: '부산역',
    address: '부산 동구 중앙대로 206',
    lat: 35.1152,
    lng: 129.0422,
    subwayLines: ['KTX', '부산1호선'],
    features: ['경부선 종착역', '해양·원도심 관문'],
  },
  {
    id: 'hub-seomyeon',
    name: '서면역',
    address: '부산 부산진구 중앙대로 730',
    lat: 35.1582,
    lng: 129.0594,
    subwayLines: ['부산1호선', '부산2호선'],
    features: ['부산 최대 핵심 상권', '트윈 환승 허브'],
  },
  {
    id: 'hub-gwangju-songjeong',
    name: '광주송정역',
    address: '광주 광산구 상무대로 201',
    lat: 35.1378,
    lng: 126.7915,
    subwayLines: ['KTX', '광주1호선'],
    features: ['호남고속철도 핵심 관문', '송정역시장 인접'],
  },
  {
    id: 'hub-cheonan-asan',
    name: '천안아산역',
    address: '충남 아산시 배방읍 희망로 100',
    lat: 36.7946,
    lng: 127.1044,
    subwayLines: ['KTX', '1호선'],
    features: ['수도권 전철-KTX 환승', '충남 북부 허브'],
  },
  {
    id: 'hub-gangneung',
    name: '강릉역',
    address: '강원 강릉시 용지로 160',
    lat: 37.7638,
    lng: 128.8996,
    subwayLines: ['KTX(강릉선)'],
    features: ['강원 동해안 교통 허브', '관광·약속 명소'],
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

// 교통수단별 예상 이동시간 산출 모델 (수도권/광역 교통망 보정치 적용)
export function estimateTravelTimeMinutes(distanceKm: number, transport: Transport): number {
  if (distanceKm < 0.2) return 2;

  if (transport === 'walk') {
    // 도보 평균 시속 4.2 km/h
    return Math.max(3, Math.round((distanceKm / 4.2) * 60));
  }

  if (transport === 'car') {
    // 도심 자동차: 도로 우회율 1.35x, 평균 속도 28~35 km/h
    const roadDist = distanceKm * 1.35;
    const minutes = 5 + (roadDist / 32) * 60;
    return Math.max(5, Math.round(minutes));
  }

  // 대중교통 (transit): 기본 대기/도보 7분 + 평균 시속 28km/h + 거리별 환승 패널티
  const transitDist = distanceKm * 1.25;
  const transferPenalty = distanceKm > 25 ? 12 : distanceKm > 10 ? 7 : 3;
  const minutes = 7 + (transitDist / 28) * 60 + transferPenalty;
  return Math.max(6, Math.round(minutes));
}

export type DynamicCandidate = {
  id?: string;
  name: string;
  subwayLines: string[];
  features: string[];
  eta: number; // 평균 이동 시간
  fairness: number; // 공정성 점수 (100점 만점)
  score: number; // 종합 추천 점수
  maxMinutes: number;
  gapMinutes: number; // 최대-최소 시간차
  participantTimes: {
    id: string;
    name: string;
    time: number;
    transport?: Transport;
    status?: 'ok' | 'error';
    url?: string;
  }[];
  lat: number;
  lng: number;
  reason: string;
  isLiveApi?: boolean;
};

// 동적 중간 지점 및 공정성 계산 엔진 (오프라인 또는 API Fallback)
export function calculateDynamicMidpoint(
  participants: { id: string; name: string; lat: number; lng: number; transport: Transport }[]
): DynamicCandidate[] {
  if (!participants.length) return [];

  // 1. 참여자들의 기하학적 중심점(Centroid) 계산
  const centerLat = participants.reduce((sum, p) => sum + p.lat, 0) / participants.length;
  const centerLng = participants.reduce((sum, p) => sum + p.lng, 0) / participants.length;

  // 2. 가상 중심점 허브를 후보군 풀에 추가 (어느 지역이든 참여자 중심 좌표가 후보에 포함됨)
  const centroidHub = {
    id: 'hub-centroid-center',
    name: '참여자 중심 권역',
    address: '참여자 분포 기하학적 중간 지점',
    lat: centerLat,
    lng: centerLng,
    subwayLines: ['중심 권역'],
    features: ['이동거리 균형 최적화', '전체 이동시간 최소화'],
  };

  const pool = [centroidHub, ...PRESET_HUBS];

  // 3. 각 후보별로 모든 참가자의 이동 시간 계산
  const candidateScores = pool.map((hub) => {
    const times = participants.map((p) => {
      const dist = calculateDistanceKm(p.lat, p.lng, hub.lat, hub.lng);
      const time = estimateTravelTimeMinutes(dist, p.transport);
      return { id: p.id, name: p.name, time, transport: p.transport, status: 'ok' as const };
    });

    const timeValues = times.map((t) => t.time);
    const maxMinutes = Math.max(...timeValues);
    const minMinutes = Math.min(...timeValues);
    const gapMinutes = maxMinutes - minMinutes;
    const averageMinutes = Math.round(timeValues.reduce((a, b) => a + b, 0) / timeValues.length);

    // 공정성 점수: 편차가 적을수록 100점에 수렴
    const fairness = Math.max(50, Math.min(99, Math.round(100 - gapMinutes * 1.3)));

    // 종합 추천 점수: (최대 이동시간 패널티) + (편차 패널티)
    const score = Math.max(50, Math.min(99, Math.round(100 - (maxMinutes * 0.45 + gapMinutes * 0.45))));

    let reason = hub.subwayLines.length ? `${hub.subwayLines.join('·')} 환승 연계` : '중간 권역';
    if (gapMinutes <= 10) {
      reason += ' 및 참가자 간 편차 최소화';
    } else {
      reason += ' 및 도심 접근성 우수';
    }

    return {
      id: hub.id,
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
      isLiveApi: false,
    };
  });

  // 4. 공정성 랭킹 알고리즘: maxMinutes 오름차순 -> gapMinutes 오름차순 -> averageMinutes 오름차순
  candidateScores.sort((a, b) => {
    if (a.maxMinutes !== b.maxMinutes) return a.maxMinutes - b.maxMinutes;
    if (a.gapMinutes !== b.gapMinutes) return a.gapMinutes - b.gapMinutes;
    return a.eta - b.eta;
  });

  return candidateScores.slice(0, 6);
}
