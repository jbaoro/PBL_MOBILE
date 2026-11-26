'use client';
/**
 * 4단계. 주변 장소 (`/meetings/[id]/places`)
 *
 * - GPU 슬라이딩 세그먼트(음식점/카페) + 원탭 추천 키워드 칩 + 0ms 클라이언트 캐시
 * - 로딩 시 Shimmer Skeleton으로 CLS(레이아웃 흔들림) 제거
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconCoffee, IconPhone, IconPin, IconUtensils } from '@/app/components/Icons';
import FlowLayout, { FlowLoading, flowStyles } from '@/components/flow/FlowLayout';
import { PlaceSkeletonList } from '@/components/ui/Skeleton';
import styles from '@/components/meeting/meeting.module.css';
import { categoryText, distanceText } from '@/features/meeting/display';
import { TOTAL_STEPS, meetingPath, selectedCandidate, stepNumber } from '@/features/meeting/model';
import { meetingActions } from '@/features/meeting/store';
import { useMeetingStep } from '@/features/meeting/useMeetingStep';
import { ApiError, isAbort, meetpointApi } from '@/lib/api/client';
import type { Place, PlaceCategory } from '@/lib/meetpoint/types';

const RADII = [500, 1000, 2000] as const;
const QUICK_KEYWORDS: Record<PlaceCategory, string[]> = {
  restaurant: ['한식', '파스타', '고기', '일식', '브런치', '술집'],
  cafe: ['디저트', '조용한', '대형', '베이커리', '스터디'],
};

type Filters = { category: PlaceCategory; radius: number; keyword: string };

export default function PlacesPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { meeting } = useMeetingStep(params.id, 'places');
  const area = meeting ? selectedCandidate(meeting)?.candidate : undefined;

  const [filters, setFilters] = useState<Filters>({
    category: 'restaurant',
    radius: 1000,
    keyword: '',
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController>();

  const load = useCallback(
    async (nextPage: number, current: Filters) => {
      if (!area) return;
      controller.current?.abort();
      const request = new AbortController();
      controller.current = request;
      setBusy(true);
      setError(null);
      try {
        const data = await meetpointApi.nearbyPlaces(
          {
            lat: area.lat,
            lng: area.lng,
            category: current.category,
            radius: current.radius,
            query: current.keyword,
            page: nextPage,
          },
          request.signal
        );
        if (request.signal.aborted) return;
        setPlaces((previous) => {
          if (nextPage === 1) return data.places;
          const known = new Set(previous.map((place) => place.id));
          return [...previous, ...data.places.filter((place) => !known.has(place.id))];
        });
        setPage(nextPage);
        setHasNext(data.hasNext);
      } catch (cause) {
        if (isAbort(cause) || request.signal.aborted) return;
        setError(cause instanceof ApiError ? cause.message : '장소를 불러오지 못했어요.');
      } finally {
        if (controller.current === request) setBusy(false);
      }
    },
    [area]
  );

  useEffect(() => {
    if (!area) return;
    const timer = setTimeout(() => void load(1, filters), 0);
    return () => clearTimeout(timer);
  }, [area, filters, load]);

  useEffect(() => () => controller.current?.abort(), []);

  if (!meeting || !area) return <FlowLoading title="주변 장소" />;

  function change(next: Partial<Filters>) {
    setPlaces([]);
    setHasNext(false);
    setFilters((previous) => ({ ...previous, ...next }));
  }

  function applyQuickKeyword(word: string) {
    const nextWord = filters.keyword === word ? '' : word;
    setKeywordInput(nextWord);
    change({ keyword: nextWord });
  }

  function choose(place: Place) {
    if (!meeting) return;
    meetingActions.selectPlace(meeting.id, place);
    router.push(meetingPath(meeting.id, 'place'));
  }

  const chosen = meeting.selectedPlace;
  const label = filters.category === 'restaurant' ? '음식점' : '카페';

  return (
    <FlowLayout
      title={`${area.name} 주변`}
      backHref={meetingPath(meeting.id, 'recommend')}
      backLabel="추천 지역으로"
      step={{ current: stepNumber('places'), total: TOTAL_STEPS }}
      bottom={
        chosen ? (
          <Link href={meetingPath(meeting.id, 'place')} className={flowStyles.primary}>
            고른 장소 보기: {chosen.name}
          </Link>
        ) : undefined
      }
    >
      <div className={styles.lead}>
        <h2>어디서 만날까요?</h2>
        <p>장소를 고르면 그곳 문 앞까지 모두의 이동시간을 다시 확인해요.</p>
      </div>

      <div className={styles.filterCard}>
        <div className="places-category-toggle" role="group" aria-label="장소 종류">
          <span
            className="places-category-indicator"
            aria-hidden="true"
            style={{
              transform: filters.category === 'cafe' ? 'translateX(100%)' : 'translateX(0%)',
            }}
          />
          {(
            [
              ['restaurant', '음식점', IconUtensils],
              ['cafe', '카페', IconCoffee],
            ] as const
          ).map(([value, text, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.category === value}
              className={`places-category-btn ${filters.category === value ? 'active' : ''}`}
              onClick={() => {
                if (filters.category !== value) {
                  setKeywordInput('');
                  change({ category: value, keyword: '' });
                }
              }}
            >
              <Icon size={15} />
              <span>{text}</span>
            </button>
          ))}
        </div>

        <div className={styles.radiusRow} role="group" aria-label="검색 반경">
          {RADII.map((radius) => (
            <button
              key={radius}
              type="button"
              aria-pressed={filters.radius === radius}
              className={styles.chip}
              onClick={() => filters.radius !== radius && change({ radius })}
            >
              {distanceText(radius)}
            </button>
          ))}
        </div>

        <form
          className={styles.keywordRow}
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            if (keywordInput.trim() !== filters.keyword) {
              change({ keyword: keywordInput.trim() });
            }
          }}
        >
          <label htmlFor="place-keyword" className={styles.srOnly}>
            {label} 검색어
          </label>
          <input
            id="place-keyword"
            className="form-input"
            value={keywordInput}
            maxLength={80}
            inputMode="search"
            placeholder={
              filters.category === 'restaurant'
                ? '예: 파스타, 한식, 매장 이름'
                : '예: 디저트, 스터디, 매장 이름'
            }
            onChange={(event) => setKeywordInput(event.target.value)}
          />
          <button type="submit" className={flowStyles.secondary}>
            검색
          </button>
        </form>

        <div className={styles.quickChips} role="group" aria-label="추천 키워드">
          {QUICK_KEYWORDS[filters.category].map((word) => (
            <button
              key={word}
              type="button"
              className={styles.quickChip}
              aria-pressed={filters.keyword === word}
              onClick={() => applyQuickKeyword(word)}
            >
              {word}
            </button>
          ))}
        </div>

        {filters.keyword && (
          <button
            type="button"
            className={styles.clearKeyword}
            onClick={() => {
              setKeywordInput('');
              change({ keyword: '' });
            }}
          >
            &lsquo;{filters.keyword}&rsquo; 필터 지우기
          </button>
        )}
      </div>

      {error && (
        <div className={flowStyles.notice} role="alert">
          {error}{' '}
          <button
            type="button"
            className={styles.inlineRetry}
            onClick={() => void load(page === 1 ? 1 : page + 1, filters)}
          >
            다시 시도
          </button>
        </div>
      )}

      {places.length > 0 && (
        <ul className={styles.placeList} aria-label={`${area.name} 주변 ${label}`}>
          {places.map((place) => {
            const isChosen = chosen?.id === place.id;
            return (
              <li key={place.id}>
                <button
                  type="button"
                  className={`place-card-item ${styles.placeButton} ${isChosen ? styles.placeChosen : ''}`}
                  onClick={() => choose(place)}
                  aria-label={`${place.name} 고르기`}
                >
                  <span className="place-top-row">
                    <span className="place-card-name">{place.name}</span>
                    {distanceText(place.distanceMeters) && (
                      <span className="place-card-dist">{distanceText(place.distanceMeters)}</span>
                    )}
                  </span>
                  <span className="place-card-meta">
                    <span>{categoryText(place.category)}</span>
                    <span className={styles.placeMetaLine}>
                      <IconPin size={12} color="#94a3b8" />
                      {place.address}
                    </span>
                    {place.phone && (
                      <span className={styles.placeMetaLine}>
                        <IconPhone size={12} color="#94a3b8" />
                        {place.phone}
                      </span>
                    )}
                  </span>
                  {isChosen && <span className={styles.chosenTag}>지금 고른 장소</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {busy && <PlaceSkeletonList count={places.length > 0 ? 2 : 5} />}

      {!busy && !error && places.length === 0 && (
        <div className={styles.emptyBox}>
          <p>
            <b>{distanceText(filters.radius)}</b> 안에서{' '}
            {filters.keyword ? `‘${filters.keyword}’ ` : ''}
            {label}을 찾지 못했어요.
          </p>
          {filters.radius < 2000 && (
            <button
              type="button"
              className={flowStyles.secondary}
              onClick={() => change({ radius: 2000 })}
            >
              2km까지 넓혀 보기
            </button>
          )}
        </div>
      )}

      {!busy && hasNext && (
        <button
          type="button"
          className={`${flowStyles.secondary} ${styles.moreButton}`}
          onClick={() => void load(page + 1, filters)}
        >
          장소 더 보기
        </button>
      )}

      <p className={styles.sourceNote}>
        카카오맵 검색 결과 기준이며, 영업 여부·가격·평점은 제공되지 않아요.
      </p>
    </FlowLayout>
  );
}
