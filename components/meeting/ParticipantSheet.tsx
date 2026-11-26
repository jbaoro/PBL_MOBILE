'use client';
/**
 * 2단계 참가자 목록 위에서 바로 여는 슬라이드 바텀시트.
 * 페이지 이동 없이 빠르게 여러 명을 연속 추가('저장 후 계속 추가')하거나 즉시 수정할 수 있다.
 */
import { useEffect, useState } from 'react';
import { IconCheck, IconClose } from '@/app/components/Icons';
import LocationSearch from '@/components/meeting/LocationSearch';
import {
  COLOR_THEMES,
  TRANSPORT_OPTIONS,
  TransportIcon,
  nextColor,
} from '@/components/meeting/ParticipantBits';
import { flowStyles } from '@/components/flow/FlowLayout';
import styles from '@/components/meeting/meeting.module.css';
import { MAX_PARTICIPANTS, type MeetingDraft, type MeetingParticipant } from '@/features/meeting/model';
import { meetingActions } from '@/features/meeting/store';
import { createId } from '@/lib/platform/id';
import type { Location, Transport } from '@/lib/meetpoint/types';

const NAME_MAX = 12;

interface ParticipantSheetProps {
  meeting: MeetingDraft;
  editing?: MeetingParticipant;
  onClose: () => void;
  onSaved?: (message: string) => void;
}

export function ParticipantSheet({
  meeting,
  editing,
  onClose,
  onSaved,
}: ParticipantSheetProps) {
  const isNew = !editing;
  const [formKey, setFormKey] = useState(0);
  const [name, setName] = useState(
    editing ? editing.name : meeting.participants.length === 0 ? '나' : ''
  );
  const [color, setColor] = useState<string>(
    editing?.color ?? nextColor(meeting.participants.map((p) => p.color))
  );
  const [origin, setOrigin] = useState<Location | undefined>(editing?.origin);
  const [transport, setTransport] = useState<Transport>(editing?.transport ?? 'transit');
  const [touched, setTouched] = useState(false);

  // Escape 키 닫기 + 배경 스크롤 잠금
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const trimmed = name.trim();
  const nameError = !trimmed
    ? '이름을 입력해 주세요.'
    : meeting.participants.some((p) => p.id !== editing?.id && p.name === trimmed)
      ? '같은 이름의 참가자가 있어요.'
      : null;
  const originError = !origin ? '출발지를 검색해서 골라 주세요.' : null;
  const routeChanged =
    Boolean(editing && meeting.recommendation && origin) &&
    (editing!.origin.id !== origin!.id || editing!.transport !== transport);

  function commit(keepAdding: boolean) {
    setTouched(true);
    if (nameError || originError || !origin) return;

    const nextPerson: MeetingParticipant = {
      id: editing?.id ?? createId('p_'),
      name: trimmed,
      color,
      origin,
      transport,
    };
    meetingActions.upsertParticipant(meeting.id, nextPerson);

    if (keepAdding && meeting.participants.length + 1 < MAX_PARTICIPANTS) {
      const nextUsed = [...meeting.participants.map((p) => p.color), color];
      setName('');
      setColor(nextColor(nextUsed));
      setOrigin(undefined);
      setTransport('transit');
      setTouched(false);
      setFormKey((k) => k + 1);
      onSaved?.(`${trimmed}님을 추가했어요. 이어서 다음 사람을 입력해 주세요.`);
    } else {
      onSaved?.(isNew ? `${trimmed}님을 추가했어요.` : `${trimmed}님 정보를 저장했어요.`);
      onClose();
    }
  }

  const canAddMore = isNew && meeting.participants.length + 1 < MAX_PARTICIPANTS;

  return (
    <div
      className={styles.sheetOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-title"
      onClick={onClose}
    >
      <div className={styles.sheetPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.sheetHeader}>
          <h2 id="sheet-title">{isNew ? '참가자 추가' : '참가자 수정'}</h2>
          <button
            type="button"
            className={styles.sheetClose}
            onClick={onClose}
            aria-label="닫기"
          >
            <IconClose size={18} />
          </button>
        </div>

        <form
          key={formKey}
          className={styles.sheetBody}
          onSubmit={(e) => {
            e.preventDefault();
            commit(false);
          }}
          noValidate
        >
          <div className={styles.field}>
            <label className={styles.label} htmlFor="sheet-name">
              이름
            </label>
            <input
              id="sheet-name"
              className="form-input"
              value={name}
              maxLength={NAME_MAX}
              autoFocus={isNew}
              placeholder="예: 지민, 준호, 서연"
              aria-invalid={touched && Boolean(nameError)}
              onChange={(e) => setName(e.target.value)}
            />
            {touched && nameError && <p className={styles.error}>{nameError}</p>}
          </div>

          <div className={styles.field}>
            <span className={styles.label}>프로필 색상</span>
            <div className={styles.colors} role="group" aria-label="프로필 색상">
              {COLOR_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  className={styles.colorChip}
                  aria-pressed={color === theme.id}
                  aria-label={`${theme.label} 색상`}
                  onClick={() => setColor(theme.id)}
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                >
                  {color === theme.id ? (
                    <IconCheck size={15} color={theme.text} />
                  ) : (
                    <span className={styles.colorDot} style={{ backgroundColor: theme.text }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="sheet-origin">
              출발지
            </label>
            <LocationSearch
              key={formKey}
              id="sheet-origin"
              value={origin}
              invalid={touched && Boolean(originError)}
              onChange={setOrigin}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>이동 수단</span>
            <div className={styles.segment} role="group" aria-label="이동 수단">
              {TRANSPORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={styles.segmentOption}
                  aria-pressed={transport === option.value}
                  onClick={() => setTransport(option.value)}
                >
                  <TransportIcon transport={option.value} size={19} />
                  <span>{option.label}</span>
                  <small>{option.hint}</small>
                </button>
              ))}
            </div>
          </div>

          {routeChanged && (
            <p className={flowStyles.notice}>
              출발지나 이동 수단이 바뀌어 기존 추천 결과가 초기화돼요.
            </p>
          )}

          <div className={styles.sheetActions}>
            {canAddMore && (
              <button
                type="button"
                className={flowStyles.secondary}
                onClick={() => commit(true)}
              >
                저장 후 계속 추가
              </button>
            )}
            <button type="submit" className={flowStyles.primary}>
              {isNew ? '추가하기' : '저장하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
