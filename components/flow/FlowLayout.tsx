'use client';
/**
 * 모든 단계 화면의 공통 틀: 상단 바(뒤로가기·제목·진행 배지·GPU 진행 막대) / 내용 / 하단 고정 버튼 영역.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconBrandPin } from '@/app/components/Icons';
import styles from './FlowLayout.module.css';

type Props = {
  title: string;
  brand?: boolean;              // 홈 화면에서 로고 아이콘과 함께 강조 표시
  backHref?: string;            // 없으면 뒤로가기 버튼을 숨긴다
  backLabel?: string;
  step?: { current: number; total: number };
  action?: ReactNode;           // 상단 바 오른쪽 버튼
  bottom?: ReactNode;           // 하단 고정 영역 (주 버튼 등)
  children: ReactNode;
};

export default function FlowLayout({
  title,
  brand = false,
  backHref,
  backLabel = '이전 화면',
  step,
  action,
  bottom,
  children,
}: Props) {
  const ratio = step ? Math.max(0, Math.min(1, step.current / step.total)) : 0;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerSide}>
            {backHref ? (
              <Link href={backHref} className={styles.iconButton} aria-label={backLabel}>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </Link>
            ) : brand ? (
              <span className={styles.brandMark}>
                <IconBrandPin size={22} color="#2563eb" />
                <span>{title}</span>
              </span>
            ) : null}
          </div>

          {!brand && <h1 className={styles.title}>{title}</h1>}
          {brand && <span className={styles.srOnly}>{title}</span>}

          <div className={`${styles.headerSide} ${styles.headerRight}`}>
            {action}
            {!action && step && (
              <span className={styles.stepPill} aria-hidden="true">
                {step.current}/{step.total}
              </span>
            )}
          </div>
        </div>

        {step && (
          <div
            className={styles.progress}
            role="progressbar"
            aria-label="진행 단계"
            aria-valuemin={1}
            aria-valuemax={step.total}
            aria-valuenow={step.current}
            aria-valuetext={`${step.total}단계 중 ${step.current}단계`}
          >
            <span style={{ transform: `scaleX(${ratio})` }} />
          </div>
        )}
      </header>

      <main className={styles.content}>{children}</main>

      {bottom && <footer className={styles.bottom}>{bottom}</footer>}
    </div>
  );
}

/** 약속을 불러오거나 다른 단계로 이동하는 동안 보여주는 로딩 화면 */
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

export { styles as flowStyles };
