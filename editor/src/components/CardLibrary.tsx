import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { api, pickJsonRaw, pickPckFile } from '../lib/tauri';
import { CARD_TEMPLATES, CARD_TYPE_LABEL, type CardDef, type CardType } from '../lib/types';
import VanillaImportModal from './VanillaImportModal';

const TYPE_DOT: Record<string, string> = {
  Attack: 'bg-red-500', Skill: 'bg-emerald-500', Power: 'bg-sky-500',
  Status: 'bg-slate-400', Curse: 'bg-purple-500', Quest: 'bg-amber-500',
};

// 立绘缩略图：downscale 到 96px 的 dataURL 模块级缓存（避免高清原图常驻内存）
const thumbCache = new Map<string, string>();

async function loadThumb(rel: string): Promise<string> {
  const hit = thumbCache.get(rel);
  if (hit) return hit;
  const bytes = await api.readPortrait(rel);
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
  const scale = Math.min(1, 96 / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const url = canvas.toDataURL('image/webp', 0.75);
  thumbCache.set(rel, url);
  return url;
}

function CardThumb({ portrait }: { portrait: string }) {
  const [url, setUrl] = useState<string | null>(() => thumbCache.get(portrait) ?? null);
  useEffect(() => {
    if (!portrait) {
      setUrl(null);
      return;
    }
    const cached = thumbCache.get(portrait);
    if (cached) {
      setUrl(cached);
      return;
    }
    let cancelled = false;
    loadThumb(portrait).then((u) => { if (!cancelled) setUrl(u); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [portrait]);
  if (!url) return <div className="h-9 w-12 shrink-0 rounded bg-white/5" />;
  return <img src={url} alt="" draggable={false} className="h-9 w-12 shrink-0 rounded object-cover" />;
}

function CardTile({ card, active, onClick }: { card: CardDef; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 rounded-lg border p-2 text-left transition-all ${
        active
          ? 'border-amber-400/70 bg-amber-400/10 shadow-[0_0_12px_rgba(251,191,36,0.15)]'
          : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
      }`}
    >
      {card.portrait ? <CardThumb portrait={card.portrait} /> : <div className="h-9 w-12 shrink-0 rounded bg-white/5" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[card.card_type] ?? 'bg-slate-500'}`} />
          <span className="truncate text-sm font-medium text-slate-200">
            {card.name.zhs || card.name.eng || card.id}
          </span>
          {card.vanilla_id && (
            <span className="shrink-0 rounded bg-sky-500/15 px-1 text-[10px] font-medium text-sky-300">原版</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-500">
          <span className="truncate">{CARD_TYPE_LABEL[card.card_type]} · {card.rarity}</span>
          <span className="shrink-0 font-mono">{card.costs_x ? 'X' : card.cost < 0 ? '—' : card.cost}费</span>
        </div>
      </div>
    </button>
  );
}

const TYPE_FILTERS: (CardType | 'all')[] = ['all', 'Attack', 'Skill', 'Power', 'Curse', 'Status'];

export default function CardLibrary() {
  const { cards, selectedId, select, createCard, openProject, projectRoot, showToast } = useStore();
  const [showVanilla, setShowVanilla] = useState(false);
  const [showTpl, setShowTpl] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<CardType | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => {
      if (typeFilter !== 'all' && c.card_type !== typeFilter) return false;
      if (!q) return true;
      return (
        c.id.toLowerCase().includes(q)
        || (c.name.zhs ?? '').toLowerCase().includes(q)
        || (c.name.eng ?? '').toLowerCase().includes(q)
      );
    });
  }, [cards, query, typeFilter]);

  const reload = async (selectId?: string) => {
    if (projectRoot) {
      await openProject(projectRoot);
      if (selectId) select(selectId);
    }
  };

  const doImport = async () => {
    const raw = await pickJsonRaw();
    if (!raw) return;
    try {
      const reports = await api.importCardsAny(raw);
      await reload(reports[0]?.card.id);
      const names = reports.map((r) => r.card.name.zhs || r.card.id).join('、');
      const foreign = reports.filter((r) => !r.native);
      let msg = `已导入 ${reports.length} 张：${names}`;
      if (foreign.length > 0) {
        msg += `\n\n外来格式 ${foreign.length} 张，请核对字段：\n` + foreign.flatMap((r) => r.notes).join('\n');
        setTimeout(() => alert(`导入说明：\n\n${foreign.flatMap((r) => r.notes).join('\n')}`), 100);
      }
      showToast(msg);
    } catch (e) {
      alert('导入失败：' + String(e));
    }
  };

  const doImportPck = async () => {
    const path = await pickPckFile();
    if (!path) return;
    try {
      const result = await api.importPackPck(path);
      await reload(result.imported[0]?.card.id);
      let msg = `已从卡包导入 ${result.imported.length} 张卡牌`;
      if (result.errors.length > 0) {
        msg += `，${result.errors.length} 个文件失败`;
        setTimeout(() => alert(`部分文件导入失败：\n\n${result.errors.join('\n')}`), 100);
      }
      showToast(msg);
    } catch (e) {
      alert('导入失败：' + String(e));
    }
  };

  const newFromTpl = (tplId: string) => {
    setShowTpl(false);
    void createCard(tplId === 'blank' ? undefined : tplId);
  };

  return (
    <div className="relative flex h-full flex-col">
      <div className="border-b border-white/10 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-200">
            卡牌库
            <span className="ml-1.5 text-[11px] font-normal text-slate-500">{cards.length} 张</span>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setShowVanilla(true)}
              title="从游戏原版 577 张卡中选一张，作为覆盖卡载入编辑"
              className="rounded-md border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-200 transition hover:bg-sky-500/20"
            >
              原版卡
            </button>
            <button
              onClick={doImportPck}
              title="导入 .pck 卡包（其他 SpireForge 用户分享的卡包）"
              className="rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-white/30"
            >
              卡包
            </button>
            <button
              onClick={doImport}
              title="导入卡牌 JSON（支持 SpireForge 及常见第三方格式，多卡文件整批导入）"
              className="rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-white/30"
            >
              导入
            </button>
          </div>
        </div>
        <div className="mt-2 flex gap-1.5">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索名称 / id…"
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-amber-400/60"
          />
          <button
            onClick={() => setShowTpl((v) => !v)}
            title="从模板新建：两三下点击得到一张能进游戏的卡"
            className="shrink-0 rounded-md bg-amber-500/90 px-2.5 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-400"
          >
            + 新卡牌
          </button>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition ${
                typeFilter === t
                  ? 'bg-white/15 text-amber-300'
                  : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
              }`}
            >
              {t === 'all' ? '全部' : CARD_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {cards.length === 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-white/10 p-4 text-center">
            <div className="mb-3 text-xs text-slate-500">
              还没有卡牌。挑一个模板开始，
              <br />
              数值和描述都能再改。
            </div>
            <div className="space-y-1.5">
              {CARD_TEMPLATES.filter((t) => t.id !== 'blank').map((t) => (
                <button
                  key={t.id}
                  onClick={() => newFromTpl(t.id)}
                  className="block w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition hover:border-amber-400/50"
                >
                  <div className="text-xs font-semibold text-slate-200">{t.label}</div>
                  <div className="text-[10px] text-slate-500">{t.desc}</div>
                </button>
              ))}
              <button
                onClick={() => setShowVanilla(true)}
                className="block w-full rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-left transition hover:bg-sky-500/20"
              >
                <div className="text-xs font-semibold text-sky-200">改一张原版卡</div>
                <div className="text-[10px] text-slate-500">从游戏 577 张卡里选</div>
              </button>
            </div>
          </div>
        )}
        {cards.length > 0 && filtered.length === 0 && (
          <div className="mt-8 text-center text-xs text-slate-600">没有符合筛选的卡牌</div>
        )}
        {filtered.map((c) => (
          <CardTile key={c.id} card={c} active={c.id === selectedId} onClick={() => select(c.id)} />
        ))}
      </div>

      {showTpl && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowTpl(false)} />
          <div className="absolute right-3 top-[104px] z-40 w-64 rounded-xl border border-white/10 bg-[#17171f] p-1.5 shadow-2xl">
            <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              新建卡牌
            </div>
            {CARD_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => newFromTpl(t.id)}
                className="block w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.06]"
              >
                <div className="text-xs font-semibold text-slate-200">{t.label}</div>
                <div className="text-[10px] text-slate-500">{t.desc}</div>
              </button>
            ))}
          </div>
        </>
      )}
      {showVanilla && <VanillaImportModal onClose={() => setShowVanilla(false)} />}
    </div>
  );
}
