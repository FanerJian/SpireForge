import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/tauri';
import { useStore } from '../lib/store';
import { newCard, type CardDef, type CardType, type VanillaCatalog, type VanillaEntry } from '../lib/types';

const COLOR_LABEL: Record<string, string> = {
  colorless: '无色', ironclad: '铁甲战士', silent: '沉默猎手', defect: '故障机器人',
  regent: '摄政者', necrobinder: '缚灵师', curse: '诅咒', status: '状态',
  event: '事件', quest: '任务', token: '衍生',
};

const KNOWN_POOLS = ['colorless', 'curse', 'status', 'ironclad', 'silent', 'regent', 'necrobinder', 'defect'];

/** 由原版目录条目构造编辑器卡牌（覆盖模式：vanilla_id 指向原版 Entry） */
export function cardFromVanilla(v: VanillaEntry, existingIds: Set<string>): CardDef {
  let id = v.entry.toLowerCase();
  if (existingIds.has(id)) {
    let n = 2;
    while (existingIds.has(`${id}_${n}`)) n++;
    id = `${id}_${n}`;
  }
  // 覆盖卡不预填 effects：effects 空 = 保留原版打出行为（只改数值/文案/费用）。
  // 想替换行为时在属性面板用「预填原版效果」按钮显式生成效果清单。
  const upgradeStats: Record<string, number> = {};
  for (const [k, raw] of Object.entries(v.upgrade ?? {})) {
    const n = typeof raw === 'string' ? parseFloat(raw.replace('+', '')) : Number(raw);
    if (Number.isFinite(n) && n !== 0) upgradeStats[k] = n;
  }
  const card = newCard(id);
  card.card_type = v.type as CardType;
  card.rarity = (v.rarity || 'Common') as CardDef['rarity'];
  card.target = (v.target || 'None') as CardDef['target'];
  card.cost = v.cost ?? 0;
  card.costs_x = v.x_cost;
  if (card.costs_x) card.cost = 0;
  card.keywords = v.keywords ?? [];
  card.pool = (KNOWN_POOLS.includes(v.color) ? v.color : 'colorless') as CardDef['pool'];
  card.name = { zhs: v.name, eng: v.name_en };
  card.description = { zhs: v.desc, eng: v.desc_en };
  card.stats = Object.keys(v.vars ?? {}).length ? { ...v.vars } : null;
  card.upgrade_stats = Object.keys(upgradeStats).length ? upgradeStats : null;
  card.vanilla_id = v.entry;
  return card;
}

/** 导入原版卡：从内嵌目录（577 张，v0.111.0 数据）选择并作为可编辑覆盖卡载入 */
export default function VanillaImportModal({ onClose }: { onClose: () => void }) {
  const { cards, openProject, projectRoot, select, showToast } = useStore();
  const [catalog, setCatalog] = useState<VanillaCatalog | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.vanillaCatalog().then(setCatalog).catch(() => setCatalog(null));
  }, []);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    if (!q) return catalog.cards;
    return catalog.cards.filter(
      (c) => c.entry.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.name_en.toLowerCase().includes(q),
    );
  }, [catalog, query]);

  const doImport = async (v: VanillaEntry) => {
    setBusy(true);
    try {
      const card = cardFromVanilla(v, new Set(cards.map((c) => c.id)));
      await api.saveCard(card);
      if (projectRoot) {
        await openProject(projectRoot);
        select(card.id);
      }
      showToast(`已导入原版卡「${v.name || v.name_en}」（覆盖 ${v.entry}）`);
      onClose();
    } catch (e) {
      alert('导入失败：' + String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-[560px] flex-col rounded-2xl border border-white/10 bg-[#14141c] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3">
          <div className="text-lg font-bold text-slate-100">导入原版卡</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {catalog ? `${catalog.count} 张 · 游戏 v${catalog.game_version} 数据` : '加载目录…'}
            ，作为"覆盖卡"载入：改费用/数值/文案/行为，发布后游戏内原版卡被替换
          </div>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索卡名（中/英）或 Entry，如 痛击 / bash"
          className="mb-3 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-400/60"
        />
        <div className="flex-1 space-y-1 overflow-y-auto pr-1">
          {filtered.map((v) => (
            <button
              key={v.entry}
              disabled={busy}
              onClick={() => doImport(v)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:border-amber-400/50 hover:bg-amber-400/5 disabled:opacity-40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-200">
                  {v.name || v.name_en}
                  <span className="ml-2 text-xs text-slate-500">{v.name_en}</span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-slate-500">
                  {v.x_cost ? 'X费' : `${v.cost ?? '?'}费`} · {COLOR_LABEL[v.color] ?? v.color}
                </span>
              </div>
              <div className="mt-0.5 truncate text-[11px] text-slate-600">{v.entry} · {v.desc}</div>
            </button>
          ))}
          {catalog && filtered.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-600">没有匹配的卡牌</div>
          )}
        </div>
      </div>
    </div>
  );
}
