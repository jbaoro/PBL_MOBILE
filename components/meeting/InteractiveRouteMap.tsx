'use client';

import React, { useEffect, useRef, useState } from 'react';
import { COLOR_THEMES, TRANSPORT_OPTIONS } from '@/components/meeting/ParticipantBits';
import { resolveCurrentTheme, type ThemeMode } from '@/components/ui/ThemeToggle';
import { distanceText, minutesText } from '@/features/meeting/display';
import type { MeetingParticipant } from '@/features/meeting/model';
import { haptic } from '@/lib/platform/haptics';
import type { CandidateResult, Coordinates, Location, RouteResult } from '@/lib/meetpoint/types';

interface InteractiveRouteMapProps {
  people: MeetingParticipant[];
  destination?: Location;
  routes?: RouteResult[];
  candidates?: CandidateResult[];
  onSelectCandidate?: (candidateId: string) => void;
  height?: number;
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
  kind: 'candidate' | 'person';
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
 * - 참가자 핀 탭 시 해당 사람의 경로만 선명하게 강조 + 출발지·수단·거리·소요시간 말풍선 표시
 * - 후보 번호 핀 탭 시 즉시 해당 후보 비교 전환
 * - 목적지 기준 등시간대(Fairness Zone) 동심원 시각화
 * - 라이트/다크 테마 전환 시 야간 카토그래피 팔레트 자동 동기화
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
  const [focusedPersonId, setFocusedPersonId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>('light');

  const latestRef = useRef({
    people,
    destination,
    routes,
    candidates,
    focusedPersonId,
    theme,
  });
  latestRef.current = { people, destination, routes, candidates, focusedPersonId, theme };

  useEffect(() => {
    setTheme(resolveCurrentTheme());
    const onTheme = () => setTheme(resolveCurrentTheme());
    window.addEventListener('meetpoint:theme-change', onTheme);
    return () => window.removeEventListener('meetpoint:theme-change', onTheme);
  }, []);

  // 참가자가 삭제되면 포커스 해제
  useEffect(() => {
    if (focusedPersonId && !people.some((p) => p.id === focusedPersonId)) {
      setFocusedPersonId(null);
    }
  }, [people, focusedPersonId]);

  const stateRef = useRef<{
    width: number;
    height: number;
    bounds: Bounds | null;
    targetLat: number | null;
    targetLng: number | null;
    hits: HitMarker[];
    hoveredKey: string | null;
  }>({
    width: 380,
    height,
    bounds: null,
    targetLat: destination?.lat ?? null,
    targetLng: destination?.lng ?? null,
    hits: [],
    hoveredKey: null,
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
      if (!hidden) rafId = requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const draw = (now: number) => {
      if (hidden) return;
      const st = stateRef.current;
      const {
        people: ps,
        destination: dest,
        routes: rts,
        candidates: cands,
        focusedPersonId: focusId,
        theme: mode,
      } = latestRef.current;
      const dark = mode === 'dark';
      const w = st.width;
      const h = st.height;

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

      // 1. Background surface (Light vs Dark Cartography)
      const bg = ctx.createLinearGradient(0, 0, w, h);
      if (dark) {
        bg.addColorStop(0, '#0f182c');
        bg.addColorStop(0.55, '#111b31');
        bg.addColorStop(1, '#0d1528');
      } else {
        bg.addColorStop(0, '#f3f7ff');
        bg.addColorStop(0.55, '#f8fafc');
        bg.addColorStop(1, '#eef4ff');
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // 2. Subtle dot matrix grid
      ctx.fillStyle = dark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.25)';
      const step = 24;
      for (let gx = 16; gx < w; gx += step) {
        for (let gy = 16; gy < h; gy += step) {
          ctx.beginPath();
          ctx.arc(gx, gy, 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 3. Target focus fairness concentric rings + animated pulse
      const focusPt = project({ lat: st.targetLat, lng: st.targetLng });

      // Subtle static fairness zone rings (Isochrone-inspired visual anchor)
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = dark ? 'rgba(96, 165, 250, 0.16)' : 'rgba(37, 99, 235, 0.14)';
      ctx.lineWidth = 1;
      for (const r of [38, 72]) {
        ctx.beginPath();
        ctx.arc(focusPt.x, focusPt.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();

      const pulse = reducedMotion ? 0.45 : (now % 2600) / 2600;
      const waveR = 16 + pulse * 40;
      const waveA = (1 - pulse) * 0.26;
      ctx.beginPath();
      ctx.arc(focusPt.x, focusPt.y, waveR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(59, 130, 246, ${waveA * 0.42})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(59, 130, 246, ${waveA})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // 4. Curved participant trajectories
      const routeByPerson = new Map((rts ?? []).map((r) => [r.participantId, r]));

      ps.forEach((person, idx) => {
        const themeCol = colorFor(person.color);
        const pt = project(person.origin);
        const isFocused = focusId === person.id;
        const dimmed = Boolean(focusId) && !isFocused;

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
        ctx.strokeStyle = themeCol.text;
        ctx.globalAlpha = isFocused ? 0.92 : dimmed ? 0.12 : dest ? 0.4 : 0.26;
        ctx.lineWidth = isFocused ? 3 : dest ? 2 : 1.5;
        if (person.transport === 'walk' || !dest) {
          ctx.setLineDash([4, 4]);
        } else if (person.transport === 'car') {
          ctx.setLineDash([8, 4]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        if (!reducedMotion && !dimmed && dist > 18) {
          const r = routeByPerson.get(person.id);
          const mins = r && r.status === 'ok' ? r.durationMinutes : 30;
          const period = Math.max(1250, Math.min(3400, mins * 55));
          const t = ((now + idx * 380) % period) / period;
          const inv = 1 - t;
          const px = inv * inv * pt.x + 2 * inv * t * cx + t * t * focusPt.x;
          const py = inv * inv * pt.y + 2 * inv * t * cy + t * t * focusPt.y;

          ctx.globalAlpha = Math.sin(t * Math.PI) * 0.95;
          ctx.beginPath();
          ctx.arc(px, py, isFocused ? 3.8 : 3, 0, Math.PI * 2);
          ctx.fillStyle = themeCol.text;
          ctx.fill();
        }
        ctx.restore();
      });

      // 5. Secondary candidate markers
      const nextHits: HitMarker[] = [];
      if (cands && cands.length > 1) {
        cands.forEach((cand, idx) => {
          if (dest && cand.candidate.id === dest.id) return;
          const cp = project(cand.candidate);
          nextHits.push({ id: cand.candidate.id, kind: 'candidate', x: cp.x, y: cp.y, radius: 17 });
          const hovered = st.hoveredKey === `candidate:${cand.candidate.id}`;

          ctx.save();
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, hovered ? 10.5 : 8.8, 0, Math.PI * 2);
          ctx.fillStyle = dark ? '#1e293b' : '#ffffff';
          ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
          ctx.shadowBlur = 6;
          ctx.shadowOffsetY = 2;
          ctx.fill();
          ctx.shadowColor = 'transparent';
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = hovered ? '#3b82f6' : dark ? '#64748b' : '#94a3b8';
          ctx.stroke();

          ctx.font = '800 9.5px sans-serif';
          ctx.fillStyle = hovered ? '#3b82f6' : dark ? '#e2e8f0' : '#475569';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(idx + 1), cp.x, cp.y + 0.5);
          ctx.restore();
        });
      }

      // 6. Participant pins (clickable for focus highlight!)
      ps.forEach((person) => {
        const themeCol = colorFor(person.color);
        const pt = project(person.origin);
        nextHits.push({ id: person.id, kind: 'person', x: pt.x, y: pt.y, radius: 18 });

        const route = routeByPerson.get(person.id);
        const isFocused = focusId === person.id;
        const dimmed = Boolean(focusId) && !isFocused;
        const hovered = st.hoveredKey === `person:${person.id}`;

        ctx.save();
        ctx.globalAlpha = dimmed ? 0.35 : 1;

        if (isFocused) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 17, 0, Math.PI * 2);
          ctx.fillStyle = `${themeCol.text}33`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isFocused ? 12 : hovered ? 11.2 : 10.2, 0, Math.PI * 2);
        ctx.fillStyle = themeCol.text;
        ctx.shadowColor = 'rgba(15, 23, 42, 0.24)';
        ctx.shadowBlur = isFocused ? 10 : 6;
        ctx.shadowOffsetY = 2;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = dark ? '#0f172a' : '#ffffff';
        ctx.stroke();

        ctx.font = '800 9.5px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(person.name.trim().charAt(0) || '참', pt.x, pt.y + 0.5);

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
        ctx.fillStyle = isFocused
          ? themeCol.text
          : dark
            ? 'rgba(19, 28, 49, 0.94)'
            : 'rgba(255, 255, 255, 0.94)';
        ctx.shadowColor = 'rgba(15, 23, 42, 0.14)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 1.5;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.lineWidth = 1;
        ctx.strokeStyle = isFocused
          ? themeCol.text
          : dark
            ? 'rgba(148, 163, 184, 0.22)'
            : 'rgba(226, 232, 240, 0.95)';
        ctx.stroke();

        ctx.fillStyle = isFocused ? '#ffffff' : dark ? '#f1f5f9' : '#1e293b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, lx, ly + 0.5);
        ctx.restore();
      });

      st.hits = nextHits;

      // 7. Focal Destination Pin
      ctx.save();
      if (dest) {
        ctx.beginPath();
        ctx.ellipse(focusPt.x, focusPt.y + 3, 8, 3, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(37, 99, 235, 0.25)';
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
        ctx.shadowColor = 'rgba(37, 99, 235, 0.45)';
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
        ctx.shadowColor = 'rgba(37, 99, 235, 0.34)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;
        ctx.fill();
        ctx.shadowColor = 'transparent';

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(destText, dxClamped, dyPos + 0.5);
      } else {
        ctx.beginPath();
        ctx.arc(focusPt.x, focusPt.y, 7.5, 0, Math.PI * 2);
        ctx.fillStyle = '#3b82f6';
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = dark ? '#0f172a' : '#ffffff';
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
  }, [height, people, destination, routes, candidates, focusedPersonId, theme]);

  const handlePointer = (event: React.PointerEvent<HTMLCanvasElement>, mode: 'move' | 'down') => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check participant pins first, then candidate markers
    const hit = [...stateRef.current.hits]
      .reverse()
      .find((m) => Math.hypot(x - m.x, y - m.y) <= m.radius);

    if (mode === 'move') {
      const usable = hit && (hit.kind === 'person' || Boolean(onSelectCandidate));
      stateRef.current.hoveredKey = usable ? `${hit.kind}:${hit.id}` : null;
      event.currentTarget.style.cursor = usable ? 'pointer' : 'default';
      return;
    }

    if (!hit) {
      if (focusedPersonId) setFocusedPersonId(null);
      return;
    }

    if (hit.kind === 'person') {
      haptic('light');
      setFocusedPersonId((prev) => (prev === hit.id ? null : hit.id));
    } else if (hit.kind === 'candidate' && onSelectCandidate) {
      haptic('light');
      setFocusedPersonId(null);
      onSelectCandidate(hit.id);
    }
  };

  const focusedPerson = focusedPersonId ? people.find((p) => p.id === focusedPersonId) : undefined;
  const focusedRoute = focusedPerson
    ? (routes ?? []).find((r) => r.participantId === focusedPerson.id)
    : undefined;
  const focusedTransportLabel = focusedPerson
    ? TRANSPORT_OPTIONS.find((t) => t.value === focusedPerson.transport)?.label ?? ''
    : '';

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
          border: '1px solid var(--border)',
          background: theme === 'dark' ? '#0f182c' : '#f3f7ff',
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

        {focusedPerson ? (
          <button
            type="button"
            onClick={() => setFocusedPersonId(null)}
            style={{
              position: 'absolute',
              left: 10,
              right: 10,
              bottom: 9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '6px 11px',
              borderRadius: 11,
              background: 'rgba(15, 23, 42, 0.88)',
              color: '#ffffff',
              fontSize: 11.5,
              fontWeight: 600,
              backdropFilter: 'blur(8px)',
              textAlign: 'left',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <b>{focusedPerson.name}</b> · {focusedPerson.origin.name} ({focusedTransportLabel})
              {focusedRoute?.status === 'ok'
                ? ` · ${minutesText(focusedRoute.durationMinutes)}${
                    distanceText(focusedRoute.distanceMeters)
                      ? ` (${distanceText(focusedRoute.distanceMeters)})`
                      : ''
                  }`
                : ''}
            </span>
            <span style={{ opacity: 0.72, flexShrink: 0 }}>해제</span>
          </button>
        ) : (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 10,
              bottom: 9,
              padding: '3px 9px',
              borderRadius: 999,
              background: 'rgba(15, 23, 42, 0.72)',
              color: '#ffffff',
              fontSize: 10.5,
              fontWeight: 600,
              backdropFilter: 'blur(6px)',
              pointerEvents: 'none',
            }}
          >
            {hasMultipleCandidates ? '핀을 눌러 경로·후보 비교' : '참가자 핀을 눌러 출발지 확인'}
          </span>
        )}
      </div>
      {caption && (
        <figcaption
          style={{
            marginTop: 7,
            fontSize: 11.5,
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
});
