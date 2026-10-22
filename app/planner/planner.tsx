'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ApiResponse, CandidateResult, Location, Participant, Place, PlaceCategory, PlacePage, RecommendationResult, Transport } from '@/lib/meetpoint/types';
import LocationSearch from './location-search';
import styles from './planner.module.css';

type Draft = Omit<Participant, 'origin'> & { origin?: Location };
const modes: { value: Transport; label: string; icon: string }[] = [
  { value: 'transit', label: '대중교통', icon: '▤' }, { value: 'car', label: '자동차', icon: '↗' }, { value: 'walk', label: '도보', icon: '↟' },
];
const minutes = (value: number) => value === 0 ? '0분' : `${Math.ceil(value)}분`;
const time = (value: string) => new Date(value).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

async function api<T>(url: string, signal: AbortSignal, body?: unknown): Promise<T> {
  const response = await fetch(url, body === undefined ? { signal } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
  });
  const payload: ApiResponse<T> = await response.json();
  if ('error' in payload) throw new Error(payload.error.message);
  if (!response.ok) throw new Error('요청을 완료하지 못했어요. 다시 시도해 주세요.');
  return payload.data;
}

function TravelTimes({ result, people }: { result: CandidateResult; people: Draft[] }) {
  const longest = Math.max(1, ...result.routes.map((route) => route.status === 'ok' ? route.durationMinutes : 0));
  return <ul className={styles.travelTimes}>
    {result.routes.map((route) => <li key={route.participantId}>
      <div><strong>{people.find((person) => person.id === route.participantId)?.name}</strong>
        <span>{route.status === 'ok' ? `${modes.find((mode) => mode.value === route.transport)?.label} · ${minutes(route.durationMinutes)}` : '조회 실패'}</span></div>
      {route.status === 'ok' ? <><div className={styles.track}><span style={{ width: `${Math.max(2, route.durationMinutes / longest * 100)}%` }} /></div>
        {route.url && <a href={route.url} target="_blank" rel="noreferrer">상세 경로 ↗</a>}</> : <p className={styles.routeError}>{route.error.message}</p>}
    </li>)}
  </ul>;
}

export default function Planner() {
  const [people, setPeople] = useState<Draft[]>([
    { id: 'p1', name: '나', transport: 'transit' }, { id: 'p2', name: '친구', transport: 'transit' },
  ]);
  const nextId = useRef(3);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState('');
  const [statusVersion, setStatusVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<RecommendationResult>();
  const [selected, setSelected] = useState<CandidateResult>();
  const [category, setCategory] = useState<PlaceCategory>('restaurant');
  const [radius, setRadius] = useState(1000);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [places, setPlaces] = useState<Place[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [placesBusy, setPlacesBusy] = useState(false);
  const [placesError, setPlacesError] = useState('');
  const [placesVersion, setPlacesVersion] = useState(0);
  const [selectedPlace, setSelectedPlace] = useState<Place>();
  const [detail, setDetail] = useState<CandidateResult>();
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const recommendationController = useRef<AbortController>();
  const detailController = useRef<AbortController>();
  const detailVersion = useRef(0);
  const resultsRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const request = new AbortController();
    setStatusError('');
    api<{ configured: boolean }>('/api/meetpoint/status', request.signal).then((data) => setConfigured(data.configured))
      .catch(() => { if (!request.signal.aborted) setStatusError('서버 연결 상태를 확인하지 못했어요.'); });
    return () => request.abort();
  }, [statusVersion]);
  useEffect(() => () => { recommendationController.current?.abort(); detailController.current?.abort(); }, []);

  useEffect(() => {
    if (!selected) { setPlaces([]); return; }
    const request = new AbortController();
    setPlacesBusy(true); setPlacesError('');
    if (page === 1) setPlaces([]);
    const query = new URLSearchParams({ lat: String(selected.candidate.lat), lng: String(selected.candidate.lng),
      category, radius: String(radius), query: keyword, page: String(page) });
    api<PlacePage>(`/api/places?${query}`, request.signal).then((data) => {
      if (request.signal.aborted) return;
      setPlaces((previous) => page === 1 ? data.places : Array.from(new Map([...previous, ...data.places].map((place) => [place.id, place])).values()));
      setHasNext(data.hasNext);
    }).catch((cause) => { if (!request.signal.aborted) setPlacesError(cause instanceof Error ? cause.message : '장소를 찾지 못했어요.'); })
      .finally(() => { if (!request.signal.aborted) setPlacesBusy(false); });
    return () => request.abort();
  }, [selected, category, radius, keyword, page, placesVersion]);

  function resetDetail() {
    detailController.current?.abort(); detailVersion.current++;
    setSelectedPlace(undefined); setDetail(undefined); setDetailBusy(false); setDetailError(''); setConfirmed(false); setCopyMessage('');
  }

  function invalidate() {
    recommendationController.current?.abort(); setBusy(false); setResults(undefined); setSelected(undefined);
    setPlaces([]); setHasNext(false); setPlacesError(''); setError(''); resetDetail();
  }

  function changePerson(id: string, updates: Partial<Draft>) {
    invalidate();
    setPeople((current) => current.map((person) => person.id === id ? { ...person, ...updates } : person));
  }

  function addPerson() {
    invalidate();
    const id = `p${nextId.current++}`;
    setPeople((current) => [...current, { id, name: `친구 ${current.length}`, transport: 'transit' }]);
  }

  function chooseCandidate(candidate: CandidateResult) {
    resetDetail(); setSelected(candidate); setPage(1); setPlaces([]); setHasNext(false);
    setPlacesVersion((value) => value + 1);
    setKeyword(''); setKeywordInput('');
  }

  async function calculate() {
    if (people.some((person) => !person.name.trim() || !person.origin)) { setError('모든 참가자의 이름을 입력하고 검색 결과에서 출발지를 선택해 주세요.'); return; }
    invalidate();
    const request = new AbortController(); recommendationController.current = request;
    setBusy(true);
    try {
      const data = await api<RecommendationResult>('/api/recommendations', request.signal, { participants: people });
      if (request.signal.aborted) return;
      setResults(data);
      if (data.ranked[0]) chooseCandidate(data.ranked[0]);
      requestAnimationFrame(() => resultsRef.current?.focus());
    } catch (cause) { if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : '추천을 완료하지 못했어요.'); }
    finally { if (!request.signal.aborted) setBusy(false); }
  }

  async function inspectPlace(place: Place) {
    resetDetail();
    const version = detailVersion.current;
    const request = new AbortController(); detailController.current = request;
    setSelectedPlace(place); setDetailBusy(true);
    requestAnimationFrame(() => detailRef.current?.focus());
    try {
      const data = await api<CandidateResult>('/api/routes', request.signal, { participants: people, destination: place });
      if (!request.signal.aborted && version === detailVersion.current) setDetail(data);
    } catch (cause) {
      if (!request.signal.aborted && version === detailVersion.current) setDetailError(cause instanceof Error ? cause.message : '이동시간을 확인하지 못했어요.');
    } finally { if (version === detailVersion.current) setDetailBusy(false); }
  }

  function changeFilter(action: () => void) { resetDetail(); setPlaces([]); setPage(1); setHasNext(false); setPlacesVersion((value) => value + 1); action(); }

  async function copyPlan() {
    if (!selectedPlace || !detail?.metrics) return;
    const summary = ['MeetPoint · 만날 장소', selectedPlace.name, selectedPlace.address,
      ...detail.routes.map((route) => route.status === 'ok' ? `${people.find((person) => person.id === route.participantId)?.name}: ${minutes(route.durationMinutes)}` : ''),
      '조회 시점 기준 예상 이동시간', selectedPlace.url ?? ''].filter(Boolean).join('\n');
    try { await navigator.clipboard.writeText(summary); setCopyMessage('장소와 이동시간을 복사했어요.'); }
    catch { setCopyMessage('복사 권한을 사용할 수 없어요. 아래 장소명과 주소를 직접 복사해 주세요.'); }
  }

  const ready = people.every((person) => person.name.trim() && person.origin) && people.length >= 2;
  return <main className={styles.planner}>
    <header className={styles.header}><Link href="/" className={styles.brand}><span className={styles.logo} aria-hidden="true">m<span>•</span></span>MeetPoint</Link>
      <span className={styles.headerNote}>우리 사이, 좋은 만남</span><span className={styles.beta}>기능 미리보기</span></header>
    <section className={styles.hero}>
      <div><span className={styles.eyebrow}>A LITTLE CLOSER, TOGETHER</span><h1>만나는 설렘은 크게.<br /><em>이동의 부담은 고르게.</em></h1>
        <p>각자의 출발지를 알려주세요.<br className={styles.mobileBreak} /> 모두의 이동시간을 살펴 만날 곳을 찾아요.</p></div>
      <div className={styles.heroArt} aria-hidden="true"><span className={styles.orbitOne} /><span className={styles.orbitTwo} /><i className={styles.dotOne}>나</i><i className={styles.dotTwo}>친구</i><strong>meet<br /><span>here.</span></strong><small>조금 더 가까워지는 우리</small></div>
    </section>
    <ol className={styles.steps} aria-label="진행 단계"><li className={styles.stepActive}><b>01</b>출발지 입력</li><li className={results ? styles.stepActive : ''}><b>02</b>지역 비교</li><li className={selectedPlace ? styles.stepActive : ''}><b>03</b>만날 장소 선택</li></ol>
    {configured === false && <aside className={styles.setup} aria-label="지도 연결 안내"><strong>실제 검색을 시작하려면 지도 서비스 연결이 필요해요.</strong>
      <p>아래 화면은 준비되어 있어요. 프로젝트의 <code>.env.local</code>에 카카오 REST API 키를 설정하고 개발 서버를 다시 시작해 주세요.</p>
      <details><summary>처음 연결하는 방법</summary><ol><li><a href="https://developers.kakao.com/docs/ko/kakaomap/common" target="_blank" rel="noreferrer">카카오디벨로퍼스 설정 안내 ↗</a>를 따라 앱을 만들고 카카오맵 API를 활성화해요.</li><li>무료 쿼터 적용 앱인지 확인하고, 자동차 길찾기 사용 설정도 확인해요.</li><li><code>KAKAO_REST_API_KEY=발급받은_REST_API_키</code>를 <code>.env.local</code>에 넣어요. 키는 GitHub에 올리지 않아요.</li><li>서버를 재시작한 뒤 아래 연결 확인 버튼을 눌러요. 키 입력 여부를 확인하며, 실제 권한은 검색할 때 확인해요.</li></ol></details>
      <button type="button" className={styles.secondary} onClick={() => setStatusVersion((value) => value + 1)}>연결 설정 다시 확인</button></aside>}
    {statusError && <p role="alert" className={styles.error}>{statusError}<button type="button" className={styles.textButton} onClick={() => setStatusVersion((value) => value + 1)}>다시 확인</button></p>}
    <section className={styles.panel} aria-labelledby="participants-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>01 / STARTING POINTS</span><h2 id="participants-title">어디에서 출발하나요?</h2><p>전국 주소·역 검색 · 2~8명 · 각자의 이동 수단</p></div><span className={styles.count}>{people.length}<span> / 8명</span></span></div>
      <div className={styles.participants}>{people.map((person, index) => <article key={person.id} className={styles.participant}>
        <div className={styles.personHeading}><span className={styles.avatar}>{String(index + 1).padStart(2, '0')}</span><label htmlFor={`${person.id}-name`} className={styles.srOnly}>참가자 {index + 1} 이름</label><input id={`${person.id}-name`} className={styles.nameInput} value={person.name} maxLength={30} disabled={busy} onChange={(event) => changePerson(person.id, { name: event.target.value })} />
          {people.length > 2 && <button type="button" className={styles.remove} disabled={busy} aria-label={`${person.name || index + 1} 참가자 삭제`} onClick={() => { invalidate(); setPeople((current) => current.filter((item) => item.id !== person.id)); }}>×</button>}</div>
        <LocationSearch id={person.id} value={person.origin} disabled={busy || configured === false} onChange={(origin?: Location) => changePerson(person.id, { origin })} />
        <fieldset className={styles.modePicker} disabled={busy}><legend>이동 수단</legend>{modes.map((mode) => <label key={mode.value}><input type="radio" name={`${person.id}-transport`} value={mode.value} checked={person.transport === mode.value} onChange={() => changePerson(person.id, { transport: mode.value })} /><span><i aria-hidden="true">{mode.icon}</i>{mode.label}</span></label>)}</fieldset>
      </article>)}</div>
      <button type="button" className={styles.addPerson} disabled={people.length >= 8 || busy} onClick={addPerson}>＋ 참가자 추가</button>
      <div className={styles.calculateRow}><p><span aria-hidden="true">◷</span> 조회 시점의 예상 이동시간을 비교해요.<br /><small>후보 6곳 · 가장 오래 이동하는 사람의 부담부터 줄여요.</small></p>
        {busy ? <button type="button" className={styles.secondary} onClick={() => { recommendationController.current?.abort(); setBusy(false); setError('조회를 취소했어요. 다시 비교할 수 있어요.'); }}>조회 취소</button> : <button type="button" className={styles.primary} disabled={!ready || configured === false} onClick={calculate}>우리의 만남 지점 찾기 <span aria-hidden="true">→</span></button>}</div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {busy && <div role="status" className={styles.loading}><span className={styles.spinner} />각자의 경로를 비교하고 있어요. 최대 약 1분 정도 걸릴 수 있어요.</div>}
    </section>
    {!results && !busy && <div className={styles.beforeResults}><span aria-hidden="true">↗ &nbsp; ↖</span><h2>우리에게 맞는 중간은 어디일까요?</h2><p>출발지를 선택하면 실제 경로로 비교를 시작할 수 있어요.</p></div>}
    {results && <section className={styles.panel} ref={resultsRef} tabIndex={-1} aria-labelledby="results-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>02 / A FAIRER MEETING</span><h2 id="results-title">함께 가기 좋은 만남 지점</h2><p>{results.searchedCandidateCount}곳 비교 · {time(results.generatedAt)} 조회</p></div></div>
      <div className={styles.rule}><b>추천 순서</b><span>최대 이동시간 <i>→</i> 시간 차이 <i>→</i> 평균 이동시간</span></div>
      {!results.ranked.length && <div className={styles.empty}><h3>모두의 경로가 확인된 후보가 없어요.</h3><p>아래 조회 실패 이유를 확인하고 출발지나 이동 수단을 바꿔 주세요.</p><button type="button" className={styles.secondary} onClick={calculate}>다시 비교</button></div>}
      <div className={styles.resultGrid}><div className={styles.candidates}>{results.ranked.map((item, index) => <button type="button" key={item.candidate.id} className={`${styles.candidate} ${selected?.candidate.id === item.candidate.id ? styles.candidateSelected : ''}`} aria-pressed={selected?.candidate.id === item.candidate.id} onClick={() => chooseCandidate(item)}>
        <span className={styles.rank}>{String(index + 1).padStart(2, '0')}</span><span className={styles.candidateText}>{index === 0 && <small>가장 먼저 살펴볼 곳</small>}<strong>{item.candidate.name}</strong><span>{item.candidate.address}</span></span><span className={styles.candidateTime}><strong>{Math.ceil(item.metrics!.maxMinutes)}<small>분</small></strong><span>최대 이동</span></span></button>)}</div>
        {selected && <aside className={styles.comparison}><h3>{selected.candidate.name}</h3><div className={styles.metrics}><div><span>최대</span><b>{minutes(selected.metrics!.maxMinutes)}</b></div><div><span>시간 차이</span><b>{minutes(selected.metrics!.gapMinutes)}</b></div><div><span>평균</span><b>{Math.round(selected.metrics!.averageMinutes)}분</b></div></div><TravelTimes result={selected} people={people} /><p className={styles.finePrint}>시간은 표시할 때만 반올림 또는 올림해요. 순위는 원래 값으로 계산해요.</p></aside>}</div>
      {results.excluded.length > 0 && <details className={styles.excluded}><summary>비교에서 제외된 후보 {results.excluded.length}곳 확인</summary>{results.excluded.map((item) => <article key={item.candidate.id}><h3>{item.candidate.name}</h3><TravelTimes result={item} people={people} /></article>)}</details>}
      <div className={styles.notices}>{results.notices.map((notice) => <p key={notice}>{notice}</p>)}</div>
    </section>}
    {selected && <section className={styles.panel} aria-labelledby="places-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>03 / FIND YOUR PLACE</span><h2 id="places-title">{selected.candidate.name} 근처에서 만나요</h2><p>마음에 드는 곳을 고르면 그 장소까지 이동시간을 다시 확인해요.</p></div></div>
      <div className={styles.filters}><div className={styles.tabs} aria-label="장소 종류">{(['restaurant', 'cafe'] as const).map((value) => <button type="button" key={value} aria-pressed={category === value} className={category === value ? styles.tabActive : ''} onClick={() => changeFilter(() => setCategory(value))}>{value === 'restaurant' ? '음식점' : '카페'}</button>)}</div><label className={styles.radius}>검색 범위<select value={radius} onChange={(event) => changeFilter(() => setRadius(Number(event.target.value)))}><option value={500}>500m</option><option value={1000}>1km</option><option value={2000}>2km</option><option value={5000}>5km</option></select></label></div>
      <form className={styles.placeSearch} onSubmit={(event) => { event.preventDefault(); changeFilter(() => setKeyword(keywordInput.trim())); }}><label htmlFor="place-keyword" className={styles.srOnly}>음식점 또는 카페 검색어</label><input id="place-keyword" value={keywordInput} maxLength={80} onChange={(event) => setKeywordInput(event.target.value)} placeholder={category === 'restaurant' ? '예: 파스타, 한식, 매장 이름' : '예: 커피, 디저트, 매장 이름'} /><button type="submit" className={styles.secondary}>검색</button></form>
      {placesError && <div role="alert" className={styles.error}>{placesError}<button type="button" className={styles.textButton} onClick={() => setPlacesVersion((value) => value + 1)}>다시 시도</button></div>}
      {!placesBusy && !placesError && !places.length && <div className={styles.empty}><h3>이 조건에 맞는 장소가 없어요.</h3><p>검색 범위를 넓히거나 다른 검색어를 입력해 보세요.</p></div>}
      <div className={styles.placeGrid}>{places.map((place) => <article className={styles.placeCard} key={place.id}><span className={styles.placeCategory}>{place.category.split(' > ').slice(-1)[0]}{place.distanceMeters !== undefined && ` · ${Math.round(place.distanceMeters)}m`}</span><h3>{place.name}</h3><p>{place.address}</p><div><button type="button" className={styles.secondary} onClick={() => inspectPlace(place)}>여기까지 시간 확인 <span aria-hidden="true">↗</span></button>{place.url && <a href={place.url} target="_blank" rel="noreferrer">지도 보기</a>}</div></article>)}</div>
      {placesBusy && <div role="status" className={styles.loading}><span className={styles.spinner} />주변 장소를 찾고 있어요.</div>}
      {hasNext && !placesBusy && !placesError && <button type="button" className={styles.addPerson} onClick={() => setPage((value) => value + 1)}>장소 더 보기</button>}
      <p className={styles.finePrint}>거리는 선택한 후보지 기준이에요. 가격·평점·영업 여부는 제공되지 않아 표시하지 않아요. 상세 정보는 지도에서 확인해 주세요.</p>
    </section>}
    {selectedPlace && <section ref={detailRef} tabIndex={-1} className={`${styles.panel} ${styles.finalPanel}`} aria-labelledby="final-title"><span className={styles.eyebrow}>MEET HERE</span><h2 id="final-title">{confirmed ? '여기에서 만나요.' : '실제 만날 장소까지 한 번 더.'}</h2><h3>{selectedPlace.name}</h3><p>{selectedPlace.address}{selectedPlace.phone && ` · ${selectedPlace.phone}`}</p>
      {detailBusy && <div role="status" className={styles.loading}><span className={styles.spinner} />선택한 장소까지 각자의 이동시간을 확인하고 있어요.</div>}
      {detailError && <p role="alert" className={styles.error}>{detailError}</p>}
      {detail && <TravelTimes result={detail} people={people} />}
      {detail && !detail.metrics && <p className={styles.error}>모든 참가자의 경로가 확인되어야 이 장소를 선택할 수 있어요.</p>}
      {!detailBusy && (detailError || (detail && !detail.metrics)) && <button type="button" className={styles.secondary} onClick={() => inspectPlace(selectedPlace)}>이 장소 다시 확인</button>}
      {detail?.metrics && <div className={styles.confirmRow}><span>최대 {minutes(detail.metrics.maxMinutes)} · 평균 {Math.round(detail.metrics.averageMinutes)}분</span><button type="button" className={styles.primary} onClick={() => confirmed ? void copyPlan() : setConfirmed(true)}>{confirmed ? '장소와 이동시간 복사' : '이 장소로 선택'}</button></div>}
      {confirmed && <p className={styles.finePrint}>현재 화면에서 선택했어요. 새로고침하면 선택이 초기화되니 필요한 정보는 복사해 두세요.</p>}
      <p role="status" className={styles.fieldMessage}>{copyMessage}</p>
    </section>}
    <footer className={styles.footer}><Link href="/">MeetPoint</Link><span>검색·경로 데이터: Kakao · 이동시간은 실제 상황에 따라 달라질 수 있어요.</span></footer>
  </main>;
}
