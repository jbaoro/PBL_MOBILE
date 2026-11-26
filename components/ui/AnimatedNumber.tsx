'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  format?: (val: number) => string;
  duration?: number;
  className?: string;
}

/**
 * 60fps requestAnimationFrame 숫자 보간 컴포넌트.
 * tabular-nums를 강제해 숫자 전환 시 가로 폭 흔들림(CLS)이 발생하지 않는다.
 */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  duration = 280,
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const startVal = prevRef.current;
    if (startVal === value) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      prevRef.current = value;
      setDisplay(value);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - (1 - t) * (1 - t) * (1 - t);
      setDisplay(startVal + (value - startVal) * eased);

      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        prevRef.current = value;
        setDisplay(value);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      prevRef.current = value;
    };
  }, [value, duration]);

  return (
    <span className={className ? `tabular-nums ${className}` : 'tabular-nums'}>
      {format(display)}
    </span>
  );
}
