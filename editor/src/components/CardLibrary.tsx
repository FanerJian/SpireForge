import { useState } from 'react';
import { useStore } from '../lib/store';
import { api, pickJsonRaw, pickPckFile } from '../lib/tauri';
import { CARD_TYPE_LABEL, type CardDef } from '../lib/types';
import VanillaImportModal from './VanillaImportModal';

const TYPE_DOT: Record<string, string> = {
  Attack: 'bg-red-500', Skill: 'bg-emerald-500', Power: 'bg-sky-500',
  Status: 'bg-slate-400', Curse: 'bg-purple-500', Quest: 'bg-amber-500',
};

function CardTile({ card, active, onClick }: { card: CardDef; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group w-full rounded-lg border p-2.5 text-left transition-all ${
        active
          ? 'border-amber-400/70 bg-amber-400/10 shadow-[0_0_12px_rgba(251,191,36,0.15)]'
          : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[card.card_type] ?? 'bg-slate-500'}`} />
        <span className="truncate text-sm font-medium text-slate-200">
          {card.name.zhs || card.name.eng || card.id}
        </span>
        {card.vanilla_id && (
          <span className="shrink-0 rounded bg-sky-500/15 px-1 text-[10px] font-medium text-sky-300">原版</span>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
        <span>{CARD_TYPE_LABEL[card.card_type]} · {card.rarity}</span>
        <span className="font-mono">{card.costs_x ? 'X' : card.cost < 0 ? '—' : card.cost}费</span>
      </div>
    </button>
  );
}

export default function CardLibrary() {
  const { cards, selectedId, select, createCard, meta, openProject, projectRoot, showToast } = useStore();
  const [showVanilla, setShowVanilla] = useState(false);

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-200">卡牌库</div>
          <div className="text-[11px] text-slate-500">{meta?.pack_id ?? ''} · {cards.length} 张</div>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setShowVanilla(true)}
            title="从游戏原版 577 张卡中选一张，作为覆盖卡载入编辑"
            className="rounded-md border border-sky-400/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20"
          >
            原版卡
          </button>
          <button
            onClick={doImportPck}
            title="导入 .pck 卡包（其他 SpireForge 用户分享的卡包）"
            className="rounded-md border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-white/30"
          >
            卡包
          </button>
          <button
            onClick={doImport}
            title="导入卡牌 JSON（支持 SpireForge 及常见第三方格式，多卡文件整批导入）"
            className="rounded-md border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-white/30"
          >
            导入
          </button>
          <button
            onClick={() => createCard()}
            className="rounded-md bg-amber-500/90 px-2.5 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-400"
          >
            + 新卡牌
          </button>
        </div>
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {cards.length === 0 && (
          <div className="mt-8 text-center text-xs text-slate-600">
            还没有卡牌
            <br />
            点击「+ 新卡牌」开始
          </div>
        )}
        {cards.map((c) => (
          <CardTile key={c.id} card={c} active={c.id === selectedId} onClick={() => select(c.id)} />
        ))}
      </div>
      {showVanilla && <VanillaImportModal onClose={() => setShowVanilla(false)} />}
    </div>
  );
}
