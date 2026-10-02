import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';

/** 项目设置：包名 / 作者 / 简介。这三项此前只能手改 project.json；
 *  名称与简介会进入工坊条目，作者署名也会写进卡包清单。 */
export default function ProjectSettingsModal({ onClose }: { onClose: () => void }) {
  const { meta, updateMeta, showToast } = useStore();
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

  const inputCls =
    'w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-amber-400/60';

  const save = async () => {
    await updateMeta({
      name: name.trim() || meta.name,
      author: author.trim(),
      description: description.trim(),
    });
    showToast('项目信息已保存');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[440px] rounded-2xl border border-white/10 bg-[#14141c] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-lg font-bold text-slate-100">项目设置</div>
        <div className="mb-4 text-xs text-slate-500">
          包 id <span className="font-mono text-slate-400">{meta.pack_id}</span>（发布后不可改）
          · 工坊 id {meta.workshop_id ?? '未发布'}
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">项目名称（工具栏与工坊标题）</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">作者（署名进卡包清单）</span>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Steam 昵称" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">简介（发布到工坊时的介绍文本）</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="这个卡包里有什么？玩法/主题/卡牌数量…"
              className={inputCls + ' resize-none'}
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-white/30"
          >
            取消
          </button>
          <button
            onClick={() => { void save(); }}
            className="rounded-lg bg-amber-500/90 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-400"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
