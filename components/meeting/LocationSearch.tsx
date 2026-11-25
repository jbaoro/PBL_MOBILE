'use client';
/**
 * 출발지 검색 입력칸 (2단계-1 참가자 추가·수정에서 사용)
 *
 * - 2글자 이상 입력하고 0.35초 멈추면 /api/locations/search 로 자동 검색한다. (타자마다 호출하지 않음)
 * - 새로 입력하면 진행 중인 검색은 취소하고, 이전에 고른 출발지도 선택 해제한다.
 * - 결과에서 하나를 골라야 선택된다. Enter 를 누르면 첫 번째 결과를 고른다.
 * - 가짜 프리셋으로 대체하지 않고, 실패하면 이유를 그대로 보여준다.
 */
import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconPin } from '@/app/components/Icons';
import { ApiError, isAbort, meetpointApi } from '@/lib/api/client';
import type { Location } from '@/lib/meetpoint/types';
import styles from './meeting.module.css';

type Props = {
  id: string;
  value?: Location;
  invalid?: boolean;            // 저장을 눌렀는데 출발지를 고르지 않은 경우
  onChange: (value?: Location) => void;
};

export default function LocationSearch({ id, value, invalid, onChange }: Props) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [results, setResults] = useState<Location[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const controller = useRef<AbortController>();
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => { controller.current?.abort(); clearTimeout(timer.current); }, []);

  /** 검색 실행. 이전 요청을 취소하고, 늦게 도착한(취소된) 응답은 무시한다. */
  async function search(text: string) {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setMessage('');
    try {
      const data = await meetpointApi.searchLocations(text, request.signal);
      if (request.signal.aborted) return;
      setResults(data.locations);
      if (!data.locations.length) setMessage('검색 결과가 없어요. 역 이름이나 도로명 주소로 다시 찾아보세요.');
      else if (data.notices.length) setMessage(data.notices[0]);
    } catch (error) {
      if (isAbort(error) || request.signal.aborted) return;
      setResults([]);
      setMessage(error instanceof ApiError ? error.message : '검색을 완료하지 못했어요.');
    } finally {
      if (controller.current === request) setBusy(false);
    }
  }

  /** 입력이 바뀔 때마다: 선택 해제 → 진행 중 검색 취소 → 잠시 뒤 검색 예약 */
  function handleInput(text: string) {
    setQuery(text);
    if (value) onChange(undefined);
    clearTimeout(timer.current);
    controller.current?.abort();
    setResults([]);
    setMessage('');
    if (text.trim().length < 2) { setBusy(false); return; }
    timer.current = setTimeout(() => void search(text.trim()), 350);
  }

  /** 결과 선택: 예약·진행 중인 검색을 멈추고 선택값을 부모에게 알린다. */
  function choose(location: Location) {
    clearTimeout(timer.current);
    controller.current?.abort();
    setBusy(false);
    setQuery(location.name);
    setResults([]);
    setMessage('');
    onChange(location);
  }

  return (
    <div className={styles.search}>
      <div className={styles.searchInputWrap}>
        <input id={id} className="form-input" value={query} aria-invalid={invalid && !value} maxLength={80} autoComplete="off" inputMode="search"
          placeholder="예: 강남역, 판교역, 부산역, 도로명 주소" aria-describedby={`${id}-status`}
          onChange={(event) => handleInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (results[0]) choose(results[0]);
              else if (query.trim()) { clearTimeout(timer.current); void search(query.trim()); }
            }
          }} />
        {busy && <span className={styles.searchBusy}>검색 중…</span>}
      </div>

      {results.length > 0 && (
        <ul id={`${id}-results`} className={styles.searchResults} aria-label="출발지 검색 결과">
          {results.map((location) => (
            <li key={location.id}>
              <button type="button" className="autocomplete-item" onClick={() => choose(location)}>
                <span className="autocomplete-name">{location.name}</span>
                <span className="autocomplete-addr">{location.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {value && (
        <div className="selected-location-pill">
          <IconCheck size={13} color="#059669" />
          <span>선택됨: <b>{value.name}</b> ({value.address})</span>
        </div>
      )}
      <p id={`${id}-status`} role="status" className={invalid && !value && !message ? styles.error : styles.fieldHint}>
        {message || (!value && (invalid
          ? '출발지를 검색한 뒤 결과에서 하나를 골라 주세요.'
          : <><IconPin size={11} color="#94a3b8" /> 검색 결과에서 출발지를 골라야 추천에 사용할 수 있어요.</>))}
      </p>
    </div>
  );
}
