// 原版卡覆盖区（基础页签）：vanilla_id 指向原版 Entry 时不新建卡牌，改写游戏内置卡牌本身。
// 数值/升级增量按原版变量名（Damage/Block/Vulnerable…）覆盖，行为可用右侧效果页整体替换。
// 同时展示原版卡信息（描述/数值/关键词），支持一键按原版数据预填效果清单。
import { useStore } from '../../lib/store';
import { useT, useLang } from '../../lib/i18n';
import { effectsFromVanillaVars } from '../../lib/effects';
import type { CardDef, VanillaEntry } from '../../lib/types';
import { useVanillaEntry } from './catalogs';

export default function VanillaSection({ card }: { card: CardDef }) {
  const { updateCard, showToast } = useStore();
  const t = useT();
  const stats = card.stats ?? {};
  const upStats = card.upgrade_stats ?? {};
  const vanilla = useVanillaEntry(card.vanilla_id);

  const prefillEffects = () => {
    if (!vanilla) return;
    const fx = effectsFromVanillaVars(vanilla.vars ?? {});
    if (fx.length === 0) {
      showToast(t('pp.prefillFail'));
      return;
    }
    const ok = confirm(t('pp.prefillConfirm', { n: fx.length }));
    if (ok) updateCard({ effects: fx });
  };

  const setStats = (next: Record<string, number>) =>
    updateCard({ stats: Object.keys(next).length ? next : null });
  const setUpStats = (next: Record<string, number>) =>
    updateCard({ upgrade_stats: Object.keys(next).length ? next : null });
  const renameKey = (rec: Record<string, number>, oldK: string, newK: string) => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(rec)) out[k === oldK ? newK : k] = v;
    return out;
  };

  const rows = (rec: Record<string, number>, onChange: (r: Record<string, number>) => void, delta: boolean) => (
    <div className="space-y-1.5">
      {Object.entries(rec).map(([k, v], i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            value={k}
            onChange={(e) => onChange(renameKey(rec, k, e.target.value))}
            placeholder={t('pp.varPh')}
            className="w-28 rounded-md border border-white/10 bg-black/40 px-2 py-1 font-mono text-xs text-slate-200 outline-none focus:border-amber-400/60"
          />
          <input
            type="number"
            step="any"
            value={v}
            onChange={(e) => onChange({ ...rec, [k]: parseFloat(e.target.value) || 0 })}
            className="w-20 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-slate-200 outline-none focus:border-amber-400/60"
          />
          <button
            onClick={() => {
              const rest: Record<string, number> = {};
              for (const [k2, v2] of Object.entries(rec)) {
                if (k2 !== k) rest[k2] = v2;
              }
              onChange(rest);
            }}
            className="rounded px-1.5 py-0.5 text-xs text-slate-600 hover:bg-rose-500/15 hover:text-rose-300"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange({ ...rec, [`变量${Object.keys(rec).length + 1}`]: delta ? 1 : 0 })}
        className="rounded-md border border-dashed border-white/15 px-2 py-1 text-[11px] text-slate-500 hover:border-white/30 hover:text-slate-300"
      >
        {delta ? t('pp.addDelta') : t('pp.addStat')}
      </button>
    </div>
  );

  return (
    <div className="rounded-lg border border-sky-400/20 bg-sky-500/[0.06] p-3">
      {card.vanilla_id ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
          <div className="min-w-0 text-xs">
            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-[11px] text-sky-200">
              {t('pp.vanillaActive', { id: card.vanilla_id })}
            </span>
            <span className="ml-2 text-slate-500">{t('pp.vanillaActiveHint')}</span>
          </div>
          <button
            onClick={() => updateCard({ vanilla_id: null, stats: null, upgrade_stats: null })}
            className="shrink-0 text-[11px] text-slate-500 underline hover:text-slate-300"
          >
            {t('pp.vanillaCancel')}
          </button>
        </div>
      ) : (
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">{t('pp.vanillaHint')}</span>
          <button
            onClick={() => updateCard({ vanilla_id: '' })}
            className="shrink-0 whitespace-nowrap rounded-md border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/20"
          >
            {t('pp.vanillaCover')}
          </button>
        </div>
      )}
      {card.vanilla_id != null && (
        <div className="space-y-2">
          {card.vanilla_id === '' && (
            <input
              value={card.vanilla_id === '' ? '' : card.vanilla_id}
              onChange={(e) => updateCard({ vanilla_id: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
              placeholder={t('pp.vanillaEntryPh')}
              className="w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-amber-400/60"
            />
          )}
          <div>
            <div className="mb-1 text-[11px] font-medium text-slate-400">{t('pp.statsCover')}</div>
            {rows(stats, setStats, false)}
          </div>
          <div>
            <div className="mb-1 text-[11px] font-medium text-slate-400">{t('pp.upgCover')}</div>
            {rows(upStats, setUpStats, true)}
          </div>
          {vanilla && <VanillaInfo vanilla={vanilla} onPrefill={prefillEffects} />}
        </div>
      )}
    </div>
  );
}

/** 原版卡信息展示（目录数据）：名称/费用/关键词/数值/升级/原版描述 */
function VanillaInfo({ vanilla, onPrefill }: { vanilla: VanillaEntry; onPrefill: () => void }) {
  const t = useT();
  const lang = useLang();
  const varEntries = Object.entries(vanilla.vars ?? {});
  const upEntries = Object.entries(vanilla.upgrade ?? {});
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-2.5 text-[11px] leading-relaxed">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="min-w-0 font-semibold text-slate-300">
          {t('pp.vanillaInfo', { name: vanilla.name || vanilla.name_en })}
          <span className="ml-1.5 text-slate-600">{vanilla.name_en}</span>
        </span>
        <button
          onClick={onPrefill}
          title={t('pp.prefillTitle')}
          className="shrink-0 whitespace-nowrap rounded border border-sky-400/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-200 hover:bg-sky-500/20"
        >
          {t('pp.prefill')}
        </button>
      </div>
      <div className="text-slate-500">
        {vanilla.x_cost ? (lang === 'en' ? 'X⚡' : 'X费') : `${vanilla.cost ?? '?'}${lang === 'en' ? '⚡' : '费'}`}
        {vanilla.keywords?.length ? ' · ' + vanilla.keywords.join(' / ') : ''}
      </div>
      {varEntries.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {varEntries.map(([k, v]) => (
            <span key={k} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
              {k}={v}
            </span>
          ))}
        </div>
      )}
      {upEntries.length > 0 && (
        <div className="mt-1 text-[10px] text-slate-600">
          {t('pp.upgradeSummary', { list: upEntries.map(([k, v]) => `${k}${v}`).join(', ') })}
        </div>
      )}
      <div className="mt-1.5 whitespace-pre-wrap text-slate-400">{vanilla.desc}</div>
      {vanilla.desc_en && vanilla.desc_en !== vanilla.desc && (
        <div className="mt-0.5 whitespace-pre-wrap text-[10px] text-slate-600">{vanilla.desc_en}</div>
      )}
    </div>
  );
}
