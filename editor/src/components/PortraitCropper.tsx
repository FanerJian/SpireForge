import { useEffect, useRef, useState } from 'react';
import { useT } from '../lib/i18n';

export interface CropRect { x: number; y: number; w: number; h: number }

interface Props {
  /** 原图 object URL */
  srcUrl: string;
  /** 选区宽高比（宽/高）：普通卡 250/190，先古卡 250/351 */
  aspect: number;
  onConfirm: (png: Uint8Array) => void;
  onCancel: () => void;
}

type Corner = 'nw' | 'ne' | 'sw' | 'se';

const MIN_SIZE = 48; // 选区最小边（自然像素）

/** 立绘裁剪弹窗：在原图上自由框选，比例按卡型锁定（拖动移动、四角缩放），
 *  确认后按选区自然分辨率输出 PNG（不再整图拉伸进卡框）。 */
export default function PortraitCropper({ srcUrl, aspect, onConfirm, onCancel }: Props) {
  const t = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [sel, setSel] = useState<CropRect | null>(null);
  const [busy, setBusy] = useState(false);
  // 拖拽会话：mode + 锚点（自然坐标），mousemove/mouseup 挂 window
  const dragRef = useRef<{ mode: 'move' | Corner; px: number; py: number; start: CropRect } | null>(null);

  // 载入图片：初始化为居中最大选区
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      setNat({ w: iw, h: ih });
      let w = iw;
      let h = w / aspect;
      if (h > ih) { h = ih; w = h * aspect; }
      w = Math.floor(w); h = Math.floor(h);
      setSel({ x: Math.floor((iw - w) / 2), y: Math.floor((ih - h) / 2), w, h });
    };
    img.src = srcUrl;
    return () => { cancelled = true; };
  }, [srcUrl, aspect]);

  const toNat = (e: MouseEvent | React.MouseEvent) => {
    const box = boxRef.current!;
    const r = box.getBoundingClientRect();
    const s = r.width / (nat?.w || 1);
    return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
  };

  // 选区用百分比定位：与图片实际显示尺寸解耦，任何布局下都精确对齐
  const pct = (v: number, total: number) => `${((v / total) * 100).toFixed(3)}%`;

  const clampSel = (s: CropRect): CropRect => {
    const w = Math.max(MIN_SIZE, Math.min(s.w, nat!.w));
    const h = Math.max(MIN_SIZE / aspect, Math.min(s.h, nat!.h));
    return {
      w,
      h,
      x: Math.max(0, Math.min(s.x, nat!.w - w)),
      y: Math.max(0, Math.min(s.y, nat!.h - h)),
    };
  };

  useEffect(() => {
    if (!nat) return;
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d || !sel) return;
      const p = toNat(e);
      if (d.mode === 'move') {
        setSel(clampSel({ ...d.start, x: d.start.x + (p.x - d.px), y: d.start.y + (p.y - d.py) }));
        return;
      }
      // 角缩放：锚点 = 对角；先按指针距离定宽，再按比例与边界收敛
      const ax = d.mode === 'nw' || d.mode === 'sw' ? d.start.x + d.start.w : d.start.x;
      const ay = d.mode === 'nw' || d.mode === 'ne' ? d.start.y + d.start.h : d.start.y;
      let w = Math.abs(p.x - ax);
      let h = Math.abs(p.y - ay);
      if (w / aspect < h) w = h * aspect; else h = w / aspect;
      const maxW = p.x >= ax ? nat.w - ax : ax;
      const maxH = p.y >= ay ? nat.h - ay : ay;
      if (w > maxW) { w = maxW; h = w / aspect; }
      if (h > maxH) { h = maxH; w = h * aspect; }
      if (w < MIN_SIZE) { w = MIN_SIZE; h = w / aspect; }
      setSel({
        x: p.x >= ax ? ax : ax - w,
        y: p.y >= ay ? ay : ay - h,
        w, h,
      });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  });

  const confirm = async () => {
    if (!sel || !imgRef.current || busy) return;
    setBusy(true);
    try {
      const w = Math.max(1, Math.round(sel.w));
      const h = Math.max(1, Math.round(sel.h));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d')!;
      ctx.drawImage(imgRef.current, Math.round(sel.x), Math.round(sel.y), w, h, 0, 0, w, h);
      const blob: Blob = await new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
      const png = new Uint8Array(await blob.arrayBuffer());
      onConfirm(png);
    } finally {
      setBusy(false);
    }
  };

  const startDrag = (mode: 'move' | Corner) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!sel) return;
    const p = toNat(e);
    dragRef.current = { mode, px: p.x, py: p.y, start: sel };
  };

  const outW = sel ? Math.round(sel.w) : 0;
  const outH = sel ? Math.round(sel.h) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="flex max-h-full w-[min(860px,92vw)] flex-col rounded-xl border border-white/15 bg-[#14141c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="text-sm font-semibold text-slate-200">{t('pp.cropTitle')}</span>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-200">✕</button>
        </div>
        <div className="overflow-auto p-4">
          <div ref={boxRef} className="relative mx-auto max-w-full cursor-move select-none overflow-hidden rounded-md"
            style={{ maxWidth: nat ? `min(100%, ${(nat.w * 520 / Math.max(nat.w, nat.h)).toFixed(0)}px)` : undefined }}
            onMouseDown={startDrag('move')}>
            {nat && <img src={srcUrl} alt="" className="block max-h-[62vh] w-auto max-w-full" draggable={false} />}
            {nat && sel && (
              <div className="absolute cursor-move border-2 border-amber-300/90"
                style={{
                  left: pct(sel.x, nat.w), top: pct(sel.y, nat.h),
                  width: pct(sel.w, nat.w), height: pct(sel.h, nat.h),
                  boxShadow: '0 0 0 9999px rgba(0,0,0,.55)',
                }}
                onMouseDown={startDrag('move')}>
                {(['nw', 'ne', 'sw', 'se'] as Corner[]).map((c) => (
                  <div key={c}
                    className={`absolute h-3.5 w-3.5 rounded-sm border border-black/60 bg-amber-300 ${
                      c === 'nw' ? '-left-1.5 -top-1.5 cursor-nwse-resize'
                      : c === 'ne' ? '-right-1.5 -top-1.5 cursor-nesw-resize'
                      : c === 'sw' ? '-bottom-1.5 -left-1.5 cursor-nesw-resize'
                      : '-bottom-1.5 -right-1.5 cursor-nwse-resize'}`}
                    onMouseDown={startDrag(c)} />
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
          <span className="text-[11px] text-slate-500">{t('pp.cropHint')}</span>
          <div className="flex items-center gap-2">
            {nat && <span className="font-mono text-[11px] text-slate-400">{t('pp.cropOutput', { w: outW, h: outH })}</span>}
            <button onClick={onCancel} className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:border-white/40">{t('pp.cropCancel')}</button>
            <button onClick={confirm} disabled={!sel || busy}
              className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-200 hover:border-emerald-300 disabled:opacity-40">
              {t('pp.cropConfirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
