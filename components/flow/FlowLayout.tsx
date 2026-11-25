'use client';
/**
 * 모든 단계 화면의 공통 틀: 상단 바(뒤로가기·제목·진행 막대) / 내용 / 하단 고정 버튼 영역.
 * 앱으로 옮길 때 이 구조가 그대로 네이티브 화면(헤더 + 본문 + 하단 버튼)에 대응된다.
 *
 * 사용 예:
 *   <FlowLayout title="참가자" backHref="/..." step={{ current: 2, total: 6 }} bottom={<button>다음</button>}>
 *     ...내용
 *   </FlowLayout>
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './FlowLayout.module.css';

type Props = {
  title: string;
  backHref?: string;            // 없으면 뒤로가기 버튼을 숨긴다
  backLabel?: string;
  step?: { current: number; total: number };
  action?: ReactNode;           // 상단 바 오른쪽 버튼
  bottom?: ReactNode;           // 하단 고정 영역 (주 버튼 등)
  children: ReactNode;
};

/** 단계 화면 틀. 뒤로가기는 브라우저 기록이 아니라 backHref(앞 단계 주소)로 이동한다. */
export default function FlowLayout({ title, backHref, backLabel = '이전 화면', step, action, bottom, children }: Props) {
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.headerSide}>
          {backHref && (
            <Link href={backHref} className={styles.iconButton} aria-label={backLabel}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
          )}
        </div>
        <h1 className={styles.title}>{title}</h1>
        <div className={`${styles.headerSide} ${styles.headerRight}`}>{action}</div>
        {step && (
          <div className={styles.progress} role="progressbar" aria-label="진행 단계"
            aria-valuemin={1} aria-valuemax={step.total} aria-valuenow={step.current}
            aria-valuetext={`${step.total}단계 중 ${step.current}단계`}>
            <span style={{ width: `${(step.current / step.total) * 100}%` }} />
          </div>
        )}
      </header>
      <main className={styles.content}>{children}</main>
      {bottom && <footer className={styles.bottom}>{bottom}</footer>}
    </div>
  );
}

/** 약속을 불러오거나 다른 단계로 이동하는 동안 보여주는 빈 화면 */
export function FlowLoading({ title = '불러오는 중' }: { title?: string }) {
  return (
    <FlowLayout title={title}>
      <div className={styles.loading} role="status">
        <span className={styles.spinner} aria-hidden="true" />
        <p>잠시만 기다려 주세요…</p>
      </div>
    </FlowLayout>
  );
}

/** 공통 버튼 스타일(primary·secondary·ghost)과 notice 를 다른 화면에서도 쓰도록 내보낸다. */
export { styles as flowStyles };
