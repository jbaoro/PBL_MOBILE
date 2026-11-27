'use client';
/**
 * 4단계. 주변 장소 (`/meetings/[id]/places`)
 *
 * 실사용 편의 기능:
 * - 후보 장소 찜하기(북마크) & '찜한 곳만 보기' 필터
 * - 선택 전 카카오맵에서 사진·후기·영업시간을 바로 확인할 수 있는 '카카오맵 ↗' 링크
 * - 180ms 지연 스켈레톤으로 빠른 캐시 응답 시 깜빡임 제거
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconCoffee,
  IconExternalLink,
  IconHeart,
  IconPhone,
  IconPin,
  IconUtensils,
} from '@/app/components/Icons';
import FlowLayout, { FlowLoading, flowStyles } from '@/components/flow/FlowLayout';
import { PlaceSkeletonList } from '@/components/ui/Skeleton';
import styles from '@/components/meeting/meeting.module.css';
import { categoryText, distanceText } from '@/features/meeting/display';
import { TOTAL_STEPS, meetingPath, selectedCandidate, stepNumber } from '@/features/meeting/model';
import { meetingActions } from '@/features/meeting/store';
import { useMeetingStep } from '@/features/meeting/useMeetingStep';
import { ApiError, isAbort, meetpointApi } from '@/lib/api/client';
import { useDelayedLoading } from '@/lib/hooks/useDelayedLoading';
import { haptic } from '@/lib/platform/haptics';
import { getBookmarkedPlaceIds, toggleBookmarkedPlace } from '@/lib/platform/recents';
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
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [onlySaved, setOnlySaved] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController>();

  const showSkeleton = useDelayedLoading(busy, 180);

  useEffect(() => {
    setSavedIds(getBookmarkedPlaceIds(params.id));
  }, [params.id]);

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

  const displayedPlaces = useMemo(() => {
    if (!onlySaved) return places;
    const set = new Set(savedIds);
    return places.filter((p) => set.has(p.id));
  }, [places, onlySaved, savedIds]);

  const savedInCurrentList = useMemo(() => {
    const set = new Set(savedIds);
    return places.filter((p) => set.has(p.id)).length;
  }, [places, savedIds]);

  if (!meeting || !area) return <FlowLoading title="주변 장소" />;

  function change(next: Partial<Filters>) {
    setPlaces([]);
    setHasNext(false);
    setOnlySaved(false);
    setFilters((previous) => ({ ...previous, ...next }));
  }

  function applyQuickKeyword(word: string) {
    haptic('light');
    const nextWord = filters.keyword === word ? '' : word;
    setKeywordInput(nextWord);
    change({ keyword: nextWord });
  }

  function toggleBookmark(placeId: string) {
    haptic('light');
    setSavedIds(toggleBookmarkedPlace(params.id, placeId));
  }

  function choose(place: Place) {
    if (!meeting) return;
    haptic('medium');
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
        <p>마음에 드는 곳을 찜해 비교하거나, 눌러서 문 앞까지 실제 이동시간을 확인하세요.</p>
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
                  haptic('light');
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

        <div className={styles.radiusRow} role="group" aria-label="검색 반경 및 찜 필터">
          {RADII.map((radius) => (
            <button
              key={radius}
              type="button"
              aria-pressed={filters.radius === radius}
              className={styles.chip}
              onClick={() => {
                if (filters.radius !== radius) {
                  haptic('light');
                  change({ radius });
                }
              }}
            >
              {distanceText(radius)}
            </button>
          ))}

          {savedInCurrentList > 0 && (
            <button
              type="button"
              aria-pressed={onlySaved}
              className={`${styles.chip} ${styles.savedFilterChip}`}
              onClick={() => {
                haptic('light');
                setOnlySaved((prev) => !prev);
              }}
            >
              <IconHeart size={12} filled={onlySaved} color={onlySaved ? '#e11d48' : 'currentColor'} />
              <span>찜 {savedInCurrentList}</span>
            </button>
          )}
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

      {displayedPlaces.length > 0 && (
        <ul className={styles.placeList} aria-label={`${area.name} 주변 ${label}`}>
          {displayedPlaces.map((place) => {
            const isChosen = chosen?.id === place.id;
            const isSaved = savedIds.includes(place.id);
            return (
              <li key={place.id} className={styles.placeCardWrap}>
                <button
                  type="button"
                  className={`place-card-item ${styles.placeButton} ${isChosen ? styles.placeChosen : ''}`}
                  onClick={() => choose(place)}
                  aria-label={`${place.name} 고르기`}
                >
                  <span className="place-top-row" style={{ paddingRight: 36 }}>
                    <span className="place-card-name">{place.name}</span>
                    {distanceText(place.distanceMeters) && (
                      <span className="place-card-dist">{distanceText(place.distanceMeters)}</span>
                    )}
                  </span>
                  <span className="place-card-meta">
                    <span>{categoryText(place.category)}</span>
                    <span className={styles.placeMetaLine}>
                      <IconPin size={12} color="var(--text-muted)" />
                      {place.address}
                    </span>
                    {place.phone && (
                      <span className={styles.placeMetaLine}>
                        <IconPhone size={12} color="var(--text-muted)" />
                        {place.phone}
                      </span>
                    )}
                  </span>
                  {isChosen && <span className={styles.chosenTag}>지금 고른 장소</span>}
                </button>

                <button
                  type="button"
                  className={`${styles.bookmarkBtn} ${isSaved ? styles.bookmarkSaved : ''}`}
                  onClick={() => toggleBookmark(place.id)}
                  aria-pressed={isSaved}
                  aria-label={isSaved ? `${place.name} 찜 해제` : `${place.name} 찜하기`}
                  title={isSaved ? '찜 해제' : '후보 찜하기'}
                >
                  <IconHeart
                    size={16}
                    filled={isSaved}
                    color={isSaved ? '#e11d48' : 'var(--text-muted)'}
                  />
                </button>

                {place.url && (
                  <a
                    href={place.url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.placePeekLink}
                    title="카카오맵에서 사진·후기 미리보기"
                  >
                    <span>후기·사진</span>
                    <IconExternalLink size={11} />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showSkeleton && <PlaceSkeletonList count={places.length > 0 ? 2 : 5} />}

      {!busy && !error && displayedPlaces.length === 0 && (
        <div className={styles.emptyBox}>
          {onlySaved ? (
            <>
              <p>현재 목록에서 찜한 장소가 없어요.</p>
              <button
                type="button"
                className={flowStyles.secondary}
                onClick={() => setOnlySaved(false)}
              >
                전체 결과 보기
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}

      {!busy && !onlySaved && hasNext && (
        <button
          type="button"
          className={`${flowStyles.secondary} ${styles.moreButton}`}
          onClick={() => void load(page + 1, filters)}
        >
          장소 더 보기
        </button>
      )}

      <p className={styles.sourceNote}>
        카카오맵 검색 결과 기준이며, 사진·후기·영업시간은 각 카드의 &lsquo;후기·사진&rsquo;에서 바로 확인할 수 있어요.
      </p>
    </FlowLayout>
  );
}
