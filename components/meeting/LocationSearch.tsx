'use client';
/**
 * 출발지 검색 입력칸 (2단계 참가자 추가·수정 및 바텀시트에서 공용)
 *
 * - 2글자 이상 입력하고 300ms 멈추면 /api/locations/search 로 자동 검색 (클라이언트 LRU 캐시 적용)
 * - 방향키(↑/↓), Enter, Escape 키보드 탐색 지원 + 원탭 지우기 버튼
 * - 가짜 프리셋으로 대체하지 않고, 실패하면 이유를 그대로 보여준다.
 */
import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconClose, IconPin, IconSearch } from '@/app/components/Icons';
import { ApiError, isAbort, meetpointApi } from '@/lib/api/client';
import type { Location } from '@/lib/meetpoint/types';
import styles from './meeting.module.css';

type Props = {
  id: string;
  value?: Location;
  invalid?: boolean;
  onChange: (value?: Location) => void;
};

export default function LocationSearch({ id, value, invalid, onChange }: Props) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [results, setResults] = useState<Location[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const controller = useRef<AbortController>();
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      controller.current?.abort();
      clearTimeout(timer.current);
    };
  }, []);

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
      setActiveIndex(data.locations.length > 0 ? 0 : -1);
      if (!data.locations.length) {
        setMessage('검색 결과가 없어요. 역 이름이나 도로명 주소로 다시 찾아보세요.');
      } else if (data.notices.length) {
        setMessage(data.notices[0]);
      }
    } catch (error) {
      if (isAbort(error) || request.signal.aborted) return;
      setResults([]);
      setActiveIndex(-1);
      setMessage(error instanceof ApiError ? error.message : '검색을 완료하지 못했어요.');
    } finally {
      if (controller.current === request) setBusy(false);
    }
  }

  function handleInput(text: string) {
    setQuery(text);
    if (value) onChange(undefined);
    clearTimeout(timer.current);
    controller.current?.abort();
    setResults([]);
    setActiveIndex(-1);
    setMessage('');
    if (text.trim().length < 2) {
      setBusy(false);
      return;
    }
    timer.current = setTimeout(() => void search(text.trim()), 300);
  }

  function clearInput() {
    clearTimeout(timer.current);
    controller.current?.abort();
    setBusy(false);
    setQuery('');
    setResults([]);
    setActiveIndex(-1);
    setMessage('');
    onChange(undefined);
  }

  function choose(location: Location) {
    clearTimeout(timer.current);
    controller.current?.abort();
    setBusy(false);
    setQuery(location.name);
    setResults([]);
    setActiveIndex(-1);
    setMessage('');
    onChange(location);
  }

  return (
    <div className={styles.search}>
      <div className={styles.searchInputWrap}>
        <span className={styles.searchLeadIcon} aria-hidden="true">
          <IconSearch size={16} color="#94a3b8" />
        </span>

        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          className={`form-input ${styles.searchInput}`}
          value={query}
          aria-invalid={invalid && !value}
          maxLength={80}
          autoComplete="off"
          inputMode="search"
          placeholder="예: 강남역, 판교역, 부산역, 도로명 주소"
          aria-describedby={`${id}-status`}
          aria-expanded={results.length > 0}
          aria-controls={`${id}-results`}
          onChange={(event) => handleInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && results.length > 0) {
              event.preventDefault();
              setActiveIndex((prev) => (prev + 1) % results.length);
            } else if (event.key === 'ArrowUp' && results.length > 0) {
              event.preventDefault();
              setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
            } else if (event.key === 'Escape') {
              setResults([]);
              setActiveIndex(-1);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const picked = results[activeIndex >= 0 ? activeIndex : 0];
              if (picked) choose(picked);
              else if (query.trim().length >= 2) {
                clearTimeout(timer.current);
                void search(query.trim());
              }
            }
          }}
        />

        {busy ? (
          <span className={styles.searchBusy} aria-label="검색 중">
            <span className={styles.miniSpinner} aria-hidden="true" />
          </span>
        ) : query ? (
          <button
            type="button"
            className={styles.searchClearBtn}
            onClick={clearInput}
            aria-label="검색어 지우기"
          >
            <IconClose size={14} color="#64748b" />
          </button>
        ) : null}
      </div>

      {results.length > 0 && (
        <ul id={`${id}-results`} className={styles.searchResults} aria-label="출발지 검색 결과">
          {results.map((location, index) => (
            <li key={location.id}>
              <button
                type="button"
                className="autocomplete-item"
                data-active={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(location)}
              >
                <span className="autocomplete-name">{location.name}</span>
                <span className="autocomplete-addr">{location.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {value && (
        <div className="selected-location-pill">
          <IconCheck size={14} color="#059669" />
          <span>
            <b>{value.name}</b> · {value.address}
          </span>
        </div>
      )}

      <p
        id={`${id}-status`}
        role="status"
        className={invalid && !value && !message ? styles.error : styles.fieldHint}
      >
        {message ||
          (!value &&
            (invalid ? (
              '출발지를 검색한 뒤 결과에서 하나를 골라 주세요.'
            ) : (
              <>
                <IconPin size={11} color="#94a3b8" /> 2글자 이상 입력 후 결과에서 출발지를 선택해 주세요.
              </>
            )))}
      </p>
    </div>
  );
}
