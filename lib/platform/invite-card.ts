/**
 * 확정된 약속을 단톡방에 올리기 좋은 고해상도(2x Retina) PNG 초대장 카드로 생성한다.
 * - 외부 라이브러리·서버 요청 없이 브라우저 Canvas에서 ~20ms 내 생성
 * - 참가자의 출발지 주소는 개인정보 보호를 위해 절대 포함하지 않는다.
 */
import { COLOR_THEMES } from '@/components/meeting/ParticipantBits';
import { balanceScore, categoryText, minutesText } from '@/features/meeting/display';
import type { MeetingDraft } from '@/features/meeting/model';
import { scheduleText } from '@/features/meeting/share';
import type { Transport } from '@/lib/meetpoint/types';

const TRANSPORT_LABEL: Record<Transport, string> = {
  transit: '대중교통',
  car: '자동차',
  walk: '도보',
};

function roundRect(
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

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

export async function generateInvitationPng(meeting: MeetingDraft): Promise<Blob | null> {
  if (typeof document === 'undefined' || !meeting.selectedPlace || !meeting.placeRoutes) {
    return null;
  }

  const place = meeting.selectedPlace;
  const routes = meeting.placeRoutes.routes;
  const metrics = meeting.placeRoutes.metrics;
  const when = scheduleText(meeting.scheduledAt);
  const participants = meeting.participants;

  const W = 440;
  const rowH = 44;
  const H = 310 + participants.length * rowH + 62;
  const scale = 2;

  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.scale(scale, scale);

  // Outer card background
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#eef4ff');
  bgGrad.addColorStop(1, '#f8fafc');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Ticket card container
  const pad = 20;
  const cardW = W - pad * 2;
  const cardH = H - pad * 2;
  roundRect(ctx, pad, pad, cardW, cardH, 24);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(15, 23, 42, 0.1)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Top hero header band
  ctx.save();
  roundRect(ctx, pad, pad, cardW, 134, 24);
  ctx.clip();
  const headerGrad = ctx.createLinearGradient(pad, pad, pad + cardW, pad + 134);
  headerGrad.addColorStop(0, '#2563eb');
  headerGrad.addColorStop(1, '#1d4ed8');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(pad, pad, cardW, 134);

  // Decorative subtle glow
  ctx.beginPath();
  ctx.arc(pad + cardW - 26, pad + 20, 74, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.fill();
  ctx.restore();

  // Brand badge
  roundRect(ctx, pad + 20, pad + 18, 108, 24, 12);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fill();
  ctx.font = '700 11px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText('MeetPoint 확정', pad + 32, pad + 30.5);

  // Title & Date
  ctx.font = '800 22px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(truncateText(ctx, meeting.title || '약속 초대장', cardW - 40), pad + 20, pad + 72);

  ctx.font = '600 13px sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.fillText(
    when ? truncateText(ctx, when, cardW - 40) : '일시 추후 협의',
    pad + 20,
    pad + 102
  );

  // Venue section
  let y = pad + 158;
  const cat = categoryText(place.category);
  if (cat) {
    ctx.font = '700 11px sans-serif';
    const cw = ctx.measureText(cat).width + 16;
    roundRect(ctx, pad + 20, y - 10, cw, 22, 11);
    ctx.fillStyle = '#eff6ff';
    ctx.fill();
    ctx.fillStyle = '#2563eb';
    ctx.fillText(cat, pad + 28, y + 1.5);
    y += 28;
  }

  ctx.font = '800 20px sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(truncateText(ctx, place.name, cardW - 40), pad + 20, y + 4);
  y += 26;

  ctx.font = '500 12.5px sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText(truncateText(ctx, place.address, cardW - 40), pad + 20, y);
  y += 24;

  // Metrics strip
  if (metrics) {
    const boxW = (cardW - 40 - 16) / 3;
    const stats = [
      { label: '최대 소요', val: minutesText(metrics.maxMinutes) },
      { label: '시간 편차', val: minutesText(metrics.gapMinutes) },
      { label: '균형도', val: `${balanceScore(metrics)}점` },
    ];
    stats.forEach((item, i) => {
      const bx = pad + 20 + i * (boxW + 8);
      roundRect(ctx, bx, y, boxW, 46, 12);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = '600 10.5px sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, bx + boxW / 2, y + 16);

      ctx.font = '800 14px sans-serif';
      ctx.fillStyle = i === 2 ? '#059669' : '#0f172a';
      ctx.fillText(item.val, bx + boxW / 2, y + 34);
    });
    ctx.textAlign = 'left';
    y += 62;
  }

  // Ticket dashed divider with side notches
  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad + 18, y);
  ctx.lineTo(pad + cardW - 18, y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#f2f6fd';
  ctx.beginPath();
  ctx.arc(pad, y, 9, 0, Math.PI * 2);
  ctx.arc(pad + cardW, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  y += 22;

  // Participants travel times (NO origin address for privacy!)
  ctx.font = '700 12.5px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('참가자 예상 이동시간', pad + 20, y);
  y += 20;

  const okMax = Math.max(
    1,
    ...routes.map((r) => (r.status === 'ok' ? r.durationMinutes : 0))
  );

  participants.forEach((person) => {
    const theme = COLOR_THEMES.find((c) => c.id === person.color) ?? COLOR_THEMES[0];
    const route = routes.find((r) => r.participantId === person.id);
    const mins = route?.status === 'ok' ? route.durationMinutes : null;
    const ratio = mins !== null ? Math.max(0.08, Math.min(1, mins / okMax)) : 0;

    // Avatar circle
    ctx.beginPath();
    ctx.arc(pad + 33, y + 11, 13, 0, Math.PI * 2);
    ctx.fillStyle = theme.bg;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = theme.border;
    ctx.stroke();

    ctx.font = '800 11px sans-serif';
    ctx.fillStyle = theme.text;
    ctx.textAlign = 'center';
    ctx.fillText(person.name.trim().charAt(0) || '참', pad + 33, y + 11.5);
    ctx.textAlign = 'left';

    // Name + transport
    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`${person.name} · ${TRANSPORT_LABEL[person.transport]}`, pad + 56, y + 4);

    // Minutes right aligned
    ctx.font = '800 13px sans-serif';
    ctx.fillStyle = mins !== null && mins === okMax && participants.length > 1 ? '#d97706' : '#0f172a';
    ctx.textAlign = 'right';
    ctx.fillText(mins !== null ? minutesText(mins) : '확인 불가', pad + cardW - 20, y + 4);
    ctx.textAlign = 'left';

    // Bar
    const barX = pad + 56;
    const barW = cardW - 76;
    roundRect(ctx, barX, y + 17, barW, 6, 3);
    ctx.fillStyle = '#edf2f7';
    ctx.fill();

    if (mins !== null) {
      roundRect(ctx, barX, y + 17, barW * ratio, 6, 3);
      ctx.fillStyle = theme.text;
      ctx.fill();
    }

    y += rowH;
  });

  // Footer caption
  ctx.font = '500 11px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center';
  ctx.fillText(
    'MeetPoint · 조회 시점 기준 예상 이동시간 (출발지 주소 비공개)',
    W / 2,
    H - pad - 16
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 1);
  });
}

export async function shareOrDownloadInvitationPng(
  meeting: MeetingDraft
): Promise<'shared' | 'downloaded' | 'cancelled' | 'failed'> {
  const blob = await generateInvitationPng(meeting);
  if (!blob) return 'failed';

  const safeTitle = (meeting.title || '약속').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 24) || '약속';
  const fileName = `${safeTitle}_초대장.png`;

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof File !== 'undefined') {
      const file = new File([blob], fileName, { type: 'image/png' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `[MeetPoint] ${meeting.title || '약속 초대장'}`,
          files: [file],
        });
        return 'shared';
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
  }

  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
