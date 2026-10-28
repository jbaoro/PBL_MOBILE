'use client';

import { useRef, useState } from 'react';
import type { ApiResponse, Location } from '@/lib/meetpoint/types';
import styles from './planner.module.css';

type Props = {
  id: string;
  value?: Location;
  disabled?: boolean;
  onChange: (value?: Location) => void;
};

export default function LocationSearch({ id, value, disabled, onChange }: Props) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [results, setResults] = useState<Location[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const controller = useRef<AbortController>();
  const version = useRef(0);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) { setMessage('검색어를 입력해 주세요.'); return; }
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const current = ++version.current;
    setBusy(true); setMessage(''); setResults([]);
    try {
      const response = await fetch(`/api/locations/search?query=${encodeURIComponent(trimmed)}`, { signal: request.signal });
      const payload: ApiResponse<{ locations: Location[]; notices: string[] }> = await response.json();
      if (request.signal.aborted || current !== version.current) return;
      if ('error' in payload) throw new Error(payload.error.message);
      if (!response.ok) throw new Error('검색을 완료하지 못했어요.');
      setResults(payload.data.locations);
      if (!payload.data.locations.length) setMessage('검색 결과가 없어요. 다른 이름이나 도로명으로 다시 찾아보세요.');
      else if (payload.data.notices.length) setMessage(payload.data.notices[0]);
    } catch (cause) {
      if (!request.signal.aborted && current === version.current) {
        setMessage(cause instanceof Error ? cause.message : '검색을 완료하지 못했어요.');
      }
    } finally {
      if (current === version.current) setBusy(false);
    }
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
    {value && <div className={styles.chosenLocation}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <div><strong>{value.name}</strong><p>{value.address}</p></div>
    </div>}
    <div id={`${id}-location-message`} role="status" className={styles.fieldMessage}>{message}</div>
    {results.length > 0 && <ul className={styles.searchResults} aria-label="출발지 검색 결과">
      {results.map((item) => <li key={item.id}><button type="button" disabled={disabled} onClick={() => {
        controller.current?.abort(); version.current++; setQuery(item.name); onChange(item); setResults([]); setMessage('출발지를 선택했어요.');
      }}><strong>{item.name}</strong><span>{item.address}</span>{item.category && <small>{item.category}</small>}</button></li>)}
    </ul>}
  </div>;
}
