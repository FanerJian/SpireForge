// 立绘页签：上传/重新裁剪/移除立绘，尺寸合格性提示（比例锁卡型）。
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/tauri';
import { useStore } from '../../lib/store';
import { Disclosure } from '../ui';
import PortraitCropper from '../PortraitCropper';
import { bytesToDataUrl, extOf } from '../../lib/img';
import { useT } from '../../lib/i18n';
import type { CardDef } from '../../lib/types';

export default function LookTab({ card }: { card: CardDef }) {
  const { projectRoot, portraitRevision } = useStore();
  const { updateCard, showToast } = useStore();
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dim, setDim] = useState<string>('');
  // 裁剪弹窗数据源：url 给 <img>，bytes 用于另存原图；isRecrop 区分新上传/重裁剪
  const [crop, setCrop] = useState<{ url: string; bytes: Uint8Array; ext: string; isRecrop: boolean } | null>(null);
  // 卡型比例：先古卡 = 整卡满幅 250:351，其余 = 立绘窗 250:190
  const aspect = card.rarity === 'Ancient' ? 250 / 351 : 250 / 190;
  useEffect(() => {
    if (!card.portrait) { setDim(''); return; }
    let cancelled = false;
    api.readPortrait(card.portrait).then((bytes) => {
      if (cancelled) return;
      const url = bytesToDataUrl(new Uint8Array(bytes), extOf(card.portrait));
      const img = new Image();
      img.onload = () => { if (!cancelled) setDim(`${img.naturalWidth}×${img.naturalHeight}`); };
      img.onerror = () => { if (!cancelled) setDim(''); };
      img.src = url;
    }).catch(() => { if (!cancelled) setDim(''); });
    return () => { cancelled = true; };
  }, [card.portrait, projectRoot, portraitRevision]);

  const onFile = async (f: File) => {
    const buf = new Uint8Array(await f.arrayBuffer());
    const ext = extOf(f.name);
    setCrop({ url: bytesToDataUrl(buf, ext), bytes: buf, ext, isRecrop: false });
  };

  const openRecrop = async () => {
    const rel = card.portrait_original;
    if (!rel) return;
    try {
      const bytes = new Uint8Array(await api.readPortrait(rel));
      setCrop({ url: bytesToDataUrl(bytes, extOf(rel)), bytes, ext: extOf(rel), isRecrop: true });
    } catch {
      showToast(t('pp.portraitLoadFail'));
    }
  };

  const closeCrop = () => setCrop(null);

  const onCropConfirm = async (png: Uint8Array) => {
    if (!crop) return;
    const src = crop;
    setCrop(null);
    try {
      // 裁剪结果统一存 PNG；原图另存一份供「重新裁剪」（重裁剪时原图不变）
      const rel = await api.savePortrait(card.id, 'png', png);
      if (src.isRecrop) {
        updateCard({ portrait: rel });
      } else {
        const origRel = await api.savePortrait(`${card.id}_original`, src.ext, src.bytes);
        updateCard({ portrait: rel, portrait_original: origRel });
      }
      showToast(t('pp.portraitSaved'));
    } catch (e) {
      showToast(t('pp.portraitSaveFailed', { e: String(e) }));
    }
  };

  return (
    <div className="space-y-4">
      <Disclosure title={<>{t('pp.portraitLabel')} <span className="ml-2 font-normal text-slate-500">{dim || t('pp.portraitUnset')}</span></>}
        storageKey="look.art" defaultOpen field="portrait">
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 transition hover:border-amber-400/50 hover:text-amber-300"
          >
            {card.portrait ? t('pp.changeImage') : t('pp.uploadImage')}
          </button>
          {card.portrait_original && (
            <button
              onClick={openRecrop}
              className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 transition hover:border-sky-400/50 hover:text-sky-300"
            >
              {t('pp.recrop')}
            </button>
          )}
          {card.portrait && (
            <button
              onClick={() => updateCard({ portrait: '' })}
              className="text-xs text-rose-400/80 hover:text-rose-300"
            >
              {t('pp.remove')}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
          />
        </div>
      </Disclosure>
      {projectRoot && card.portrait && (
        <Disclosure title={t('ui.fileInfo')} storageKey="look.file">
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[10px] text-slate-600">
          {card.portrait}
        </div>
        </Disclosure>
      )}
      {crop && (
        <PortraitCropper
          srcUrl={crop.url}
          aspect={aspect}
          onConfirm={onCropConfirm}
          onCancel={closeCrop}
        />
      )}
    </div>
  );
}
