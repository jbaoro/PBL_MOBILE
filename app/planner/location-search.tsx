'use client';

import { useEffect, useRef, useState } from 'react';
import type { ApiResponse, Location } from '@/lib/meetpoint/types';
import styles from './planner.module.css';

export default function LocationSearch({ id, value, disabled, onChange }: {
  id: string; value?: Location; disabled: boolean; onChange: (location?: Location) => void;
}) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [results, setResults] = useState<Location[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController>();
  const version = useRef(0);
  useEffect(() => () => controller.current?.abort(), []);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    controller.current?.abort();
    const currentVersion = ++version.current;
    const request = new AbortController();
    controller.current = request;
    setResults([]);
    if (!query.trim()) { setMessage('주소나 역 이름을 입력해 주세요.'); return; }
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/locations/search?query=${encodeURIComponent(query.trim())}`, { signal: request.signal });
      const body: ApiResponse<{ locations: Location[]; notices: string[] }> = await response.json();
      if ('error' in body) throw new Error(body.error.message);
      if (!response.ok) throw new Error('검색하지 못했어요. 다시 시도해 주세요.');
      if (version.current !== currentVersion) return;
      setResults(body.data.locations);
      setMessage(body.data.locations.length ? body.data.notices.join(' ') : '검색 결과가 없어요. 지역명이나 도로명 주소를 함께 입력해 보세요.');
    } catch (error) {
      if (!request.signal.aborted && version.current === currentVersion) setMessage(error instanceof Error ? error.message : '검색하지 못했어요.');
    } finally { if (version.current === currentVersion) setBusy(false); }
  }

  return <div className={styles.locationSearch}>
    <form onSubmit={search}>
      <label htmlFor={`${id}-origin`}>출발지</label>
      <div className={styles.searchRow}>
        <input id={`${id}-origin`} value={query} maxLength={80} disabled={disabled} autoComplete="off"
          placeholder="예: 수원역, 부산시청, 도로명 주소" aria-describedby={`${id}-location-message`}
          onChange={(event) => {
            controller.current?.abort(); version.current++; setBusy(false); setQuery(event.target.value);
            setResults([]); setMessage(''); onChange(undefined);
          }} />
        <button type="submit" disabled={disabled || busy || !query.trim()} className={styles.secondary}>{busy ? '검색 중' : '검색'}</button>
      </div>
    </form>
    {value && <div className={styles.chosenLocation}><span aria-hidden="true">✓</span><div><strong>{value.name}</strong><p>{value.address}</p></div></div>}
    <div id={`${id}-location-message`} role="status" className={styles.fieldMessage}>{message}</div>
    {results.length > 0 && <ul className={styles.searchResults} aria-label="출발지 검색 결과">
      {results.map((item) => <li key={item.id}><button type="button" disabled={disabled} onClick={() => {
        controller.current?.abort(); version.current++; setQuery(item.name); onChange(item); setResults([]); setMessage('출발지를 선택했어요.');
      }}><strong>{item.name}</strong><span>{item.address}</span>{item.category && <small>{item.category}</small>}</button></li>)}
    </ul>}
  </div>;
}
