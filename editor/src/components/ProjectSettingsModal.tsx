import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { useT } from '../lib/i18n';
import { inputCls } from './ui';

/** 项目设置：包名 / 作者 / 简介。这三项此前只能手改 project.json；
 *  名称与简介会进入工坊条目，作者署名也会写进卡包清单。 */
export default function ProjectSettingsModal({ onClose }: { onClose: () => void }) {
  const { meta, updateMeta, showToast } = useStore();
  const t = useT();
  const [name, setName] = useState(meta?.name ?? '');
  const [author, setAuthor] = useState(meta?.author ?? '');
  const [description, setDescription] = useState(meta?.description ?? '');

  // Esc 关闭
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!meta) return null;

  const save = async () => {
    await updateMeta({
      name: name.trim() || meta.name,
      author: author.trim(),
      description: description.trim(),
    });
    showToast(t('ps.saved'));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[440px] rounded-2xl border border-white/10 bg-[#14141c] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-lg font-bold text-slate-100">{t('ps.title')}</div>
        <div className="mb-4 text-xs text-slate-500">
          {t('ps.metaLine', { id: meta.pack_id, ws: meta.workshop_id ?? t('pub.unpublished') })}
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">{t('ps.name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">{t('ps.author')}</span>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder={t('w.authorPh')} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">{t('ps.desc')}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t('ps.descPh')}
              className={inputCls + ' resize-none'}
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-white/30"
          >
            {t('ps.cancel')}
          </button>
          <button
            onClick={() => { void save(); }}
            className="rounded-lg bg-amber-500/90 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-400"
          >
            {t('ps.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
