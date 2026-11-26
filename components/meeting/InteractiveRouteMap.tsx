'use client';

import React, { useEffect, useRef } from 'react';
import { COLOR_THEMES } from '@/components/meeting/ParticipantBits';
import { minutesText } from '@/features/meeting/display';
import type { MeetingParticipant } from '@/features/meeting/model';
import type { CandidateResult, Coordinates, Location, RouteResult } from '@/lib/meetpoint/types';

interface InteractiveRouteMapProps {
  people: MeetingParticipant[];
  /** 현재 선택된 목적지 (추천 지역 or 최종 장소). 없으면 참가자 분포 미리보기 모드로 동작한다. */
  destination?: Location;
  /** 선택된 목적지까지의 참가자별 실제 경로 결과 */
  routes?: RouteResult[];
  /** 추천 지역 후보 목록 (있으면 캔버스 위에 1~6순위 마커를 띄우고 직접 클릭해 전환 가능) */
  candidates?: CandidateResult[];
  /** 캔버스에서 다른 후보 마커를 탭했을 때 호출 */
  onSelectCandidate?: (candidateId: string) => void;
  /** 캔버스 높이 (기본 210px) */
  height?: number;
  /** 하단 캡션 숨김 여부 */
  caption?: string;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  scaleX: number;
}

interface HitMarker {
  id: string;
  x: number;
  y: number;
  radius: number;
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function colorFor(colorId?: string) {
  return COLOR_THEMES.find((c) => c.id === colorId) ?? COLOR_THEMES[0];
}

function computeBounds(points: Coordinates[]): Bounds {
  if (!points.length) {
    return { minX: 100, maxX: 101, minY: 37.4, maxY: 37.6, scaleX: 0.79 };
  }
  const meanLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const scaleX = Math.cos((meanLat * Math.PI) / 180);
  const xs = points.map((p) => p.lng * scaleX);
  const ys = points.map((p) => p.lat);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);

  const spanX = Math.max(maxX - minX, 0.008);
  const spanY = Math.max(maxY - minY, 0.008);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  minX = midX - spanX * 0.68;
  maxX = midX + spanX * 0.68;
  minY = midY - spanY * 0.72;
  maxY = midY + spanY * 0.72;

  return { minX, maxX, minY, maxY, scaleX };
}

/**
 * 60fps HiDPI 인터랙티브 위치·경로 시각화 Canvas.
 * - 위도 기반 경도 축소(cos(lat))를 반영해 실제 지리적 비율을 유지
 * - 후보 전환 시 Damped Spring 보간으로 부드럽게 포커스 이동
 * - 실제 카카오 경로 시간(durationMinutes)에 비례한 펄스 흐름 시각화
 * - 캔버스 위 다른 후보 번호를 직접 탭해 즉시 비교 가능
 * - 탭 비활성화(visibilitychange) 시 자동으로 rAF 루프를 정지해 배터리/CPU 절약
 */
export const InteractiveRouteMap = React.memo(function InteractiveRouteMap({
  people,
  destination,
  routes,
  candidates,
  onSelectCandidate,
  height = 208,
  caption,
}: InteractiveRouteMapProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const latestRef = useRef({
    people,
    destination,
    routes,
    candidates,
  });
  latestRef.current = { people, destination, routes, candidates };

  const stateRef = useRef<{
    width: number;
    height: number;
    bounds: Bounds | null;
    targetLat: number | null;
    targetLng: number | null;
    hitMarkers: HitMarker[];
    hoveredId: string | null;
  }>({
    width: 380,
    height,
    bounds: null,
    targetLat: destination?.lat ?? null,
    targetLng: destination?.lng ?? null,
    hitMarkers: [],
    hoveredId: null,
  });

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(240, Math.round(rect.width));
      const h = height;
      stateRef.current.width = w;
      stateRef.current.height = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = 0;
    let hidden = document.hidden;

    const handleVisibility = () => {
      hidden = document.hidden;
      if (!hidden) {
        rafId = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const draw = (now: number) => {
      if (hidden) return;
      const st = stateRef.current;
      const { people: ps, destination: dest, routes: rts, candidates: cands } = latestRef.current;
      const w = st.width;
      const h = st.height;

      // Compute all visible geographic points
      const allPts: Coordinates[] = ps.map((p) => p.origin);
      if (dest) allPts.push(dest);
      if (cands) {
        for (const c of cands) allPts.push(c.candidate);
      }

      const goalBounds = computeBounds(allPts);
      if (!st.bounds || reducedMotion) {
        st.bounds = { ...goalBounds };
      } else {
        const k = 0.14;
        st.bounds.minX += (goalBounds.minX - st.bounds.minX) * k;
        st.bounds.maxX += (goalBounds.maxX - st.bounds.maxX) * k;
        st.bounds.minY += (goalBounds.minY - st.bounds.minY) * k;
        st.bounds.maxY += (goalBounds.maxY - st.bounds.maxY) * k;
        st.bounds.scaleX = goalBounds.scaleX;
      }

      // Focus target (either destination or geometric centroid in preview mode)
      const centroid: Coordinates =
        ps.length > 0
          ? {
              lat: ps.reduce((s, p) => s + p.origin.lat, 0) / ps.length,
              lng: ps.reduce((s, p) => s + p.origin.lng, 0) / ps.length,
            }
          : { lat: 37.55, lng: 126.98 };

      const goalTarget = dest ?? centroid;
      if (st.targetLat === null || st.targetLng === null || reducedMotion) {
        st.targetLat = goalTarget.lat;
        st.targetLng = goalTarget.lng;
      } else {
        st.targetLat += (goalTarget.lat - st.targetLat) * 0.18;
        st.targetLng += (goalTarget.lng - st.targetLng) * 0.18;
      }

      const b = st.bounds;
      const padX = 32;
      const padY = 28;
      const spanX = Math.max(b.maxX - b.minX, 1e-6);
      const spanY = Math.max(b.maxY - b.minY, 1e-6);
      const scale = Math.min((w - padX * 2) / spanX, (h - padY * 2) / spanY);
      const offX = (w - spanX * scale) / 2;
      const offY = (h - spanY * scale) / 2;

      const project = (pt: Coordinates) => ({
        x: offX + (pt.lng * b.scaleX - b.minX) * scale,
        y: h - offY - (pt.lat - b.minY) * scale,
      });

      // 1. Clean topographic-tinted surface
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#f3f7ff');
      bg.addColorStop(0.55, '#f8fafc');
      bg.addColorStop(1, '#eef4ff');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // 2. Subtle dot matrix grid (clean, modern Apple Maps / Toss aesthetic)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.26)';
      const step = 24;
      for (let gx = 16; gx < w; gx += step) {
        for (let gy = 16; gy < h; gy += step) {
          ctx.beginPath();
          ctx.arc(gx, gy, 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 3. Target focus radar wave
      const focusPt = project({ lat: st.targetLat, lng: st.targetLng });
      const pulse = reducedMotion ? 0.45 : (now % 2500) / 2500;
      const waveR = 16 + pulse * 40;
      const waveA = (1 - pulse) * 0.24;

      ctx.beginPath();
      ctx.arc(focusPt.x, focusPt.y, waveR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(37, 99, 235, ${waveA * 0.45})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(37, 99, 235, ${waveA})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(focusPt.x, focusPt.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
      ctx.fill();

      // 4. Curved participant trajectories + live speed-proportional pulses
      const routeByPerson = new Map((rts ?? []).map((r) => [r.participantId, r]));

      ps.forEach((person, idx) => {
        const theme = colorFor(person.color);
        const pt = project(person.origin);
        const dx = focusPt.x - pt.x;
        const dy = focusPt.y - pt.y;
        const dist = Math.hypot(dx, dy);
        const mx = (pt.x + focusPt.x) / 2;
        const my = (pt.y + focusPt.y) / 2;
        const bend = (idx % 2 === 0 ? 1 : -1) * Math.min(20, dist * 0.14);
        const cx = mx - (dy / (dist || 1)) * bend;
        const cy = my + (dx / (dist || 1)) * bend;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.quadraticCurveTo(cx, cy, focusPt.x, focusPt.y);
        ctx.strokeStyle = theme.text;
        ctx.globalAlpha = dest ? 0.36 : 0.24;
        ctx.lineWidth = dest ? 2 : 1.5;
        if (person.transport === 'walk' || !dest) {
          ctx.setLineDash([4, 4]);
        } else if (person.transport === 'car') {
          ctx.setLineDash([8, 4]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        if (!reducedMotion && dist > 18) {
          const r = routeByPerson.get(person.id);
          const mins = r && r.status === 'ok' ? r.durationMinutes : 30;
          const period = Math.max(1250, Math.min(3400, mins * 55));
          const t = ((now + idx * 380) % period) / period;
          const inv = 1 - t;
          const px = inv * inv * pt.x + 2 * inv * t * cx + t * t * focusPt.x;
          const py = inv * inv * pt.y + 2 * inv * t * cy + t * t * focusPt.y;

          ctx.globalAlpha = Math.sin(t * Math.PI) * 0.92;
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = theme.text;
          ctx.fill();
        }
        ctx.restore();
      });

      // 5. Secondary candidate markers (clickable!)
      const nextHits: HitMarker[] = [];
      if (cands && cands.length > 1) {
        cands.forEach((cand, idx) => {
          if (dest && cand.candidate.id === dest.id) return;
          const cp = project(cand.candidate);
          nextHits.push({ id: cand.candidate.id, x: cp.x, y: cp.y, radius: 17 });
          const hovered = st.hoveredId === cand.candidate.id;

          ctx.save();
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, hovered ? 10.5 : 8.8, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = 'rgba(15, 23, 42, 0.14)';
          ctx.shadowBlur = 6;
          ctx.shadowOffsetY = 2;
          ctx.fill();
          ctx.shadowColor = 'transparent';
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = hovered ? '#2563eb' : '#94a3b8';
          ctx.stroke();

          ctx.font = '800 9.5px sans-serif';
          ctx.fillStyle = hovered ? '#2563eb' : '#475569';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(idx + 1), cp.x, cp.y + 0.5);
          ctx.restore();
        });
      }
      st.hitMarkers = nextHits;

      // 6. Participant pins + crisp name/ETA pills
      ps.forEach((person) => {
        const theme = colorFor(person.color);
        const pt = project(person.origin);
        const route = routeByPerson.get(person.id);

        ctx.save();
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 10.5, 0, Math.PI * 2);
        ctx.fillStyle = theme.text;
        ctx.shadowColor = 'rgba(15, 23, 42, 0.2)';
        ctx.shadowBlur = 7;
        ctx.shadowOffsetY = 2;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.font = '800 9.5px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(person.name.trim().charAt(0) || '참', pt.x, pt.y + 0.5);

        // Name + ETA floating chip
        const etaStr =
          route && route.status === 'ok' ? ` ${minutesText(route.durationMinutes)}` : '';
        const text = `${person.name.slice(0, 5)}${etaStr}`;
        ctx.font = '700 10px sans-serif';
        const tw = ctx.measureText(text).width;
        const pillW = tw + 11;
        const pillH = 17;
        const placeAbove = pt.y > h - 34;
        const ly = placeAbove ? pt.y - 21 : pt.y + 20;
        const lx = Math.max(pillW / 2 + 6, Math.min(w - pillW / 2 - 6, pt.x));

        drawPill(ctx, lx - pillW / 2, ly - pillH / 2, pillW, pillH, 8.5);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
        ctx.shadowColor = 'rgba(15, 23, 42, 0.1)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 1.5;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.95)';
        ctx.stroke();

        ctx.fillStyle = '#1e293b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, lx, ly + 0.5);
        ctx.restore();
      });

      // 7. Focal Destination Pin (or Centroid marker in preview mode)
      ctx.save();
      if (dest) {
        // Teardrop hub pin
        ctx.beginPath();
        ctx.ellipse(focusPt.x, focusPt.y + 3, 8, 3, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(37, 99, 235, 0.22)';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(focusPt.x, focusPt.y + 2);
        ctx.bezierCurveTo(
          focusPt.x - 12,
          focusPt.y - 9,
          focusPt.x - 12,
          focusPt.y - 24,
          focusPt.x,
          focusPt.y - 24
        );
        ctx.bezierCurveTo(
          focusPt.x + 12,
          focusPt.y - 24,
          focusPt.x + 12,
          focusPt.y - 9,
          focusPt.x,
          focusPt.y + 2
        );
        ctx.closePath();
        ctx.fillStyle = '#2563eb';
        ctx.shadowColor = 'rgba(37, 99, 235, 0.4)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(focusPt.x, focusPt.y - 14, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        const destText = dest.name.length > 14 ? `${dest.name.slice(0, 13)}…` : dest.name;
        ctx.font = '800 11px sans-serif';
        const dtw = ctx.measureText(destText).width;
        const dpW = dtw + 15;
        const dpH = 21;
        const dxClamped = Math.max(dpW / 2 + 8, Math.min(w - dpW / 2 - 8, focusPt.x));
        const dyPos = Math.min(h - 14, focusPt.y + 17);

        drawPill(ctx, dxClamped - dpW / 2, dyPos - dpH / 2, dpW, dpH, 10.5);
        ctx.fillStyle = '#1d4ed8';
        ctx.shadowColor = 'rgba(37, 99, 235, 0.3)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;
        ctx.fill();
        ctx.shadowColor = 'transparent';

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(destText, dxClamped, dyPos + 0.5);
      } else {
        // Preview mode center crosshair
        ctx.beginPath();
        ctx.arc(focusPt.x, focusPt.y, 7.5, 0, Math.PI * 2);
        ctx.fillStyle = '#2563eb';
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.fill();
        ctx.stroke();

        const label = '예상 중심';
        ctx.font = '700 10px sans-serif';
        const lw = ctx.measureText(label).width + 12;
        drawPill(ctx, focusPt.x - lw / 2, focusPt.y + 11, lw, 18, 9);
        ctx.fillStyle = 'rgba(37, 99, 235, 0.92)';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, focusPt.x, focusPt.y + 20.5);
      }
      ctx.restore();

      if (!reducedMotion) {
        rafId = requestAnimationFrame(draw);
      }
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [height, people, destination, routes, candidates]);

  const handlePointer = (
    event: React.PointerEvent<HTMLCanvasElement>,
    mode: 'move' | 'down'
  ) => {
    if (!onSelectCandidate) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = stateRef.current.hitMarkers.find(
      (m) => Math.hypot(x - m.x, y - m.y) <= m.radius
    );

    if (mode === 'move') {
      stateRef.current.hoveredId = hit?.id ?? null;
      event.currentTarget.style.cursor = hit ? 'pointer' : 'default';
    } else if (hit) {
      onSelectCandidate(hit.id);
    }
  };

  const hasMultipleCandidates = (candidates?.length ?? 0) > 1 && Boolean(onSelectCandidate);

  return (
    <figure style={{ margin: '12px 0 0' }}>
      <div
        ref={wrapRef}
        style={{
          position: 'relative',
          width: '100%',
          height,
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid rgba(37, 99, 235, 0.14)',
          background: '#f3f7ff',
        }}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={
            destination
              ? `${people.map((p) => p.name).join(', ')} 출발지와 ${destination.name} 위치 관계`
              : `${people.map((p) => p.name).join(', ')} 출발지 분포 미리보기`
          }
          onPointerMove={(e) => handlePointer(e, 'move')}
          onPointerDown={(e) => handlePointer(e, 'down')}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
        {hasMultipleCandidates && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 10,
              bottom: 9,
              padding: '3px 8px',
              borderRadius: 999,
              background: 'rgba(15, 23, 42, 0.72)',
              color: '#ffffff',
              fontSize: 10.5,
              fontWeight: 600,
              backdropFilter: 'blur(6px)',
              pointerEvents: 'none',
            }}
          >
            번호 핀을 눌러 후보 비교
          </span>
        )}
      </div>
      {caption && (
        <figcaption
          style={{
            marginTop: 7,
            fontSize: 11.5,
            color: '#94a3b8',
            textAlign: 'center',
          }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
});
