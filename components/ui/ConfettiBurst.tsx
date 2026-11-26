'use client';

import { useEffect, useRef } from 'react';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#0ea5e9'];

/**
 * 약속 확정 화면용 경량 60fps Canvas 컨페티 효과.
 * 외부 라이브러리 없이 1.9초 재생 후 자동 종료·정리되며, prefers-reduced-motion 시 생략한다.
 */
export function ConfettiBurst() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    const w = parent ? parent.clientWidth : 420;
    const h = 210;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = w / 2;
    const cy = 62;
    const particles = Array.from({ length: 34 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 34 + (Math.random() - 0.5) * 0.3;
      const speed = 2.2 + Math.random() * 4.2;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.4,
        size: 4 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.22,
        color: COLORS[i % COLORS.length],
        shape: i % 3,
      };
    });

    const start = performance.now();
    const duration = 1900;
    let rafId = 0;

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      ctx.clearRect(0, 0, w, h);

      const alpha = progress < 0.65 ? 1 : Math.max(0, 1 - (progress - 0.65) / 0.35);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.14; // gravity
        p.vx *= 0.985;
        p.rot += p.vrot;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        if (p.shape === 0) {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
        } else if (p.shape === 1) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.42, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -p.size / 2);
          ctx.lineTo(p.size / 2, p.size / 2);
          ctx.lineTo(-p.size / 2, p.size / 2);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}
