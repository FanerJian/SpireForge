import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/tauri';
import { useStore } from '../lib/store';
import { Combobox, type ComboItem } from './Combobox';
import {
  EFFECT_META, HOOK_TARGET_OPTIONS, KEYWORD_CHIPS, POOL_LABEL, RARITY_LABEL,
  TARGET_LABEL, TRIGGER_OPTIONS, TYPE_LABEL,
  pick, useLang, useT, type TriggerKey,
} from '../lib/i18n';
import {
  cardEntry, composeDescription, effectsFromVanillaVars,
  type CardDef, type CardType, type EffectDef, type Pool, type TargetType,
  type VanillaCatalog, type VanillaEntry,
} from '../lib/types';
import { POWERS } from '../lib/powers';
import { MONSTERS } from '../lib/monsters';

// ---- 原版目录缓存（模块级：整个会话只拉一次）----
let vanillaCache: VanillaCatalog | null = null;

/** 原版卡覆盖时的目录条目（原版描述/数值/关键词展示用） */
function useVanillaEntry(vanillaId: string | null | undefined): VanillaEntry | null {
  const [entry, setEntry] = useState<VanillaEntry | null>(null);
  useEffect(() => {
    const id = (vanillaId ?? '').trim();
    if (!id) {
      setEntry(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (!vanillaCache) vanillaCache = await api.vanillaCatalog();
        if (!cancelled) setEntry(vanillaCache.cards.find((c) => c.entry === id) ?? null);
      } catch {
        if (!cancelled) setEntry(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vanillaId]);
  return entry;
}

/** 参与升级变量的效果种类（其余种类用字面数值） */
const UPGRADEABLE = ['damage', 'block', 'draw', 'energy', 'heal'];

/** 需要玩家选择上下文的效果种类（on_enter_combat 不可用） */
const NEEDS_CHOICE = ['damage', 'draw', 'lose_hp', 'power', 'discard', 'exhaust'];

/** 效果目录分组：常用 / 进阶与扩展 */
const CORE_KINDS = ['damage', 'block', 'draw', 'energy', 'heal'];
const EXTRA_KINDS = ['power', 'discard', 'exhaust', 'gold', 'lose_hp', 'max_hp', 'spawn', 'summon', 'custom'];

/** 「按效果生成描述」：composeDescription 的 UI 包装（有内容先确认） */
function useGenDescription() {
  const { updateCard, showToast } = useStore();
  const t = useT();
  return (card: CardDef) => {
    const composed = composeDescription(card);
    if (!composed) {
      showToast(t('pp.genDescEmpty'));
      return;
    }
    if (card.description.zhs.trim() || card.description.eng.trim()) {
      if (!confirm(t('pp.genDescOverwrite'))) return;
    }
    updateCard({ description: composed });
    showToast(t('pp.genDescDone'));
  };
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="shrink-0 whitespace-nowrap text-xs font-medium text-slate-400">{label}</span>
        {hint && <span title={hint} className="truncate text-right text-[10px] text-slate-600">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

const inputCls =
  'w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm text-slate-200 outline-none transition focus:border-amber-400/60 focus:bg-black/60';

const selectCls = inputCls + ' appearance-none';

/** 原版卡覆盖区：vanilla_id 指向原版 Entry 时不新建卡牌，改写游戏内置卡牌本身。
 *  数值/升级增量按原版变量名（Damage/Block/Vulnerable…）覆盖，行为可用右侧效果页整体替换。
 *  同时展示原版卡信息（描述/数值/关键词），支持一键按原版数据预填效果清单。 */
function VanillaSection({ card }: { card: CardDef }) {
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

function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: { v: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-black/30 p-1">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition ${
            value === o.v ? 'bg-amber-500/90 text-black' : 'text-slate-400 hover:bg-white/10 hover:text-slate-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 自定义效果 params 的 JSON 编辑器：合法时提交，非法时标红挂起 */
function ParamsEditor({ value, onChange }: {
  value?: Record<string, unknown>;
  onChange: (v: Record<string, unknown> | undefined) => void;
}) {
  const serialized = JSON.stringify(value ?? {});
  const [text, setText] = useState(serialized === '{}' ? '{\n  \n}' : JSON.stringify(value ?? {}, null, 2));
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setText(serialized === '{}' ? '{\n  \n}' : JSON.stringify(value ?? {}, null, 2));
    setBad(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);
  return (
    <textarea
      spellCheck={false}
      className={inputCls + ' h-20 resize-none font-mono text-xs' + (bad ? ' border-rose-500/70' : '')}
      value={text}
      onChange={(ev) => {
        const v = ev.target.value;
        setText(v);
        try {
          const parsed = v.trim() === '' ? {} : JSON.parse(v);
          if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
          setBad(false);
          onChange(Object.keys(parsed).length ? (parsed as Record<string, unknown>) : undefined);
        } catch {
          setBad(true);
        }
      }}
    />
  );
}

/** 去掉官方描述里的 BBCode 着色标记（[gold]xx[/gold] → xx） */
function stripBbcode(s: string): string {
  return s ? s.replace(/\[\/?[a-z_]+\]/gi, '') : '';
}

function EffectsTab({ card }: { card: CardDef }) {
  const { updateCard, cards, meta } = useStore();
  const t = useT();
  const lang = useLang();
  const genDesc = useGenDescription();
  const [trigger, setTrigger] = useState<TriggerKey>('play');
  const [vanilla, setVanilla] = useState<VanillaEntry[]>([]);
  const u = card.upgrades;

  // 原版目录（生成卡牌效果的可选项；模块级缓存，整个会话只拉一次）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!vanillaCache) vanillaCache = await api.vanillaCatalog();
        if (!cancelled) setVanilla(vanillaCache.cards);
      } catch {
        // 目录加载失败不阻断效果编辑
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 效果下拉：中文界面只显示中文（英文界面只显示英文），描述随语言，搜索词两种语言都匹配
  const powerCombo: ComboItem[] = useMemo(() => POWERS.map((p) => ({
    value: p.name,
    primary: lang === 'en' ? p.en : p.zh,
    secondary: stripBbcode(lang === 'en' ? p.desc_en : p.desc),
    icon: p.icon || undefined,
    badge: p.debuff ? (lang === 'en' ? 'Debuff' : '减益') : undefined,
    badgeTone: p.debuff ? ('danger' as const) : undefined,
    keywords: lang === 'en' ? p.zh : p.en,
  })), [lang]);

  // 怪物下拉：类型徽章 + 原生生命；图标太大不打包，用徽章代替
  const monsterCombo: ComboItem[] = useMemo(() => MONSTERS.map((m) => ({
    value: m.name,
    primary: lang === 'en' ? m.en : m.zh,
    secondary: m.hp ? (lang === 'en' ? `HP ${m.hp}` : `生命 ${m.hp}`) : undefined,
    badge: m.type || undefined,
    badgeTone: (m.type === 'Boss' || m.type === 'Elite') ? ('danger' as const) : ('neutral' as const),
    keywords: lang === 'en' ? m.zh : m.en,
  })), [lang]);

  // 生成卡牌下拉：本项目卡优先，其后原版卡；次要行显示 Entry（同名卡/变体靠它区分）
  const spawnCombo: ComboItem[] = useMemo(() => {
    const items: ComboItem[] = cards
      .filter((c) => c.id !== card.id)
      .map((c) => {
        const entry = cardEntry(meta?.pack_id ?? '', c.id);
        return {
          value: entry,
          primary: lang === 'en' ? (c.name.eng || c.name.zhs) : (c.name.zhs || c.name.eng),
          secondary: entry,
          badge: TYPE_LABEL[c.card_type] ? pick(TYPE_LABEL[c.card_type], lang) : c.card_type,
          badgeTone: 'neutral' as const,
          keywords: c.id,
        };
      });
    for (const v of vanilla) {
      if (items.some((i) => i.value === v.entry)) continue;
      items.push({
        value: v.entry,
        primary: lang === 'en' ? (v.name_en || v.name) : v.name,
        secondary: v.entry,
        badge: TYPE_LABEL[v.type] ? pick(TYPE_LABEL[v.type], lang) : v.type,
        badgeTone: 'neutral' as const,
        keywords: v.name_en,
      });
    }
    return items;
  }, [cards, vanilla, lang, meta?.pack_id, card.id]);

  const list: EffectDef[] = trigger === 'play' ? card.effects : (card[trigger] ?? []);
  const setList = (fx: EffectDef[]) => {
    if (trigger === 'play') updateCard({ effects: fx });
    else updateCard({ [trigger]: fx } as Partial<CardDef>);
  };

  const add = (kind: string) => {
    const def: EffectDef | null =
      kind === 'damage' ? { kind: 'damage', amount: 6, props: ['Move'] }
      : kind === 'block' ? { kind: 'block', amount: 5, props: ['Move'] }
      : kind === 'draw' ? { kind: 'draw', amount: 1 }
      : kind === 'energy' ? { kind: 'energy', amount: 1 }
      : kind === 'heal' ? { kind: 'heal', amount: 3 }
      : kind === 'discard' ? { kind: 'discard', amount: 1 }
      : kind === 'exhaust' ? { kind: 'exhaust', amount: 1 }
      : kind === 'gold' ? { kind: 'gold', amount: 10 }
      : kind === 'lose_hp' ? { kind: 'lose_hp', amount: 3 }
      : kind === 'max_hp' ? { kind: 'max_hp', amount: 3 }
      : kind === 'power' ? { kind: 'power', amount: 2, power: 'Vulnerable' }
      : kind === 'spawn' ? { kind: 'spawn', amount: 1, card_entry: '' }
      : kind === 'summon' ? { kind: 'summon', amount: 1, monster: 'DampCultist', hp: 13 }
      : kind === 'custom' ? { kind: 'custom', handler: '' }
      : null;
    if (def) setList([...list, def]);
  };

  const remove = (i: number) => setList(list.filter((_, idx) => idx !== i));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const fx = [...list];
    [fx[i], fx[j]] = [fx[j], fx[i]];
    setList(fx);
  };
  const patch = (i: number, p: Partial<EffectDef>) =>
    setList(list.map((e, idx) => (idx === i ? ({ ...e, ...p } as EffectDef) : e)));

  const triggerMeta = TRIGGER_OPTIONS.find((o) => o.v === trigger)!;
  const isPlay = trigger === 'play';
  const hookCtx = !isPlay; // 钩子上下文：无玩家指定目标，需要 target 字段的效果走钩子取敌
  const enterCombatUnsupported = trigger === 'on_enter_combat'
    && list.some((e) => NEEDS_CHOICE.includes(e.kind));

  return (
    <div className="space-y-3">
      <Field label={t('pp.triggerLabel')}>
        <Segmented
          value={trigger}
          options={TRIGGER_OPTIONS.map((o) => ({ v: o.v, label: pick(o.label, lang) }))}
          onChange={setTrigger}
        />
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
          <span className="text-[11px] text-slate-600">{pick(triggerMeta.hint, lang)}</span>
          {isPlay && (
            <button
              onClick={() => genDesc(card)}
              title={t('pp.genDescBtnTitle')}
              className="shrink-0 whitespace-nowrap text-[11px] text-sky-300/80 underline hover:text-sky-200"
            >
              {t('pp.genDescBtn')}
            </button>
          )}
        </div>
      </Field>

      {enterCombatUnsupported && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
          {t('pp.enterCombatWarn')}
        </div>
      )}

      {list.length === 0 && (
        <div className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-slate-600">
          {t('pp.noEffects')}
        </div>
      )}
      {list.map((e, i) => {
        const meta = EFFECT_META[e.kind];
        return (
          <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">{pick(meta.label, lang)}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => move(i, -1)} className="rounded px-1.5 text-slate-500 hover:bg-white/10 hover:text-slate-200">↑</button>
                <button onClick={() => move(i, 1)} className="rounded px-1.5 text-slate-500 hover:bg-white/10 hover:text-slate-200">↓</button>
                <button onClick={() => remove(i)} className="rounded px-1.5 text-rose-400/80 hover:bg-rose-500/20 hover:text-rose-300">✕</button>
              </div>
            </div>
            <div className="text-[11px] text-slate-600">
              {pick(meta.desc, lang)}{isPlay && meta.varName ? <> · {`{${meta.varName}}`}</> : null}
            </div>

            {e.kind === 'custom' ? (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.handler')}</span>
                  <input
                    className={inputCls + ' w-52 font-mono'}
                    placeholder={t('pp.handlerPh')}
                    value={e.handler}
                    onChange={(ev) => patch(i, { handler: ev.target.value.replace(/[^a-zA-Z0-9_]/g, '') } as Partial<EffectDef>)}
                  />
                  {!e.handler && <span className="text-[10px] text-rose-400/80">{t('pp.handlerMissing')}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.amount')}</span>
                  <input
                    type="number"
                    className={inputCls + ' w-24'}
                    value={e.amount ?? ''}
                    onChange={(ev) => {
                      const v = ev.target.value === '' ? undefined : Number(ev.target.value);
                      patch(i, { amount: v } as Partial<EffectDef>);
                    }}
                  />
                  <span className="text-[10px] text-slate-600">{t('pp.amountOpt')}</span>
                </div>
                {hookCtx && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.targetLabel')}</span>
                    <select
                      className={selectCls + ' w-36'}
                      value={e.target ?? 'random_enemy'}
                      onChange={(ev) => patch(i, { target: ev.target.value } as Partial<EffectDef>)}
                    >
                      {HOOK_TARGET_OPTIONS.map((o) => (
                        <option key={o.v} value={o.v}>{pick(o.label, lang)}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <span className="text-xs text-slate-400">{t('pp.params')}</span>
                  <ParamsEditor
                    value={e.params}
                    onChange={(v) => patch(i, { params: v } as Partial<EffectDef>)}
                  />
                </div>
                <details className="rounded-lg border border-white/10 bg-black/30 p-2 text-[11px] text-slate-500">
                  <summary className="cursor-pointer select-none text-slate-400">{t('pp.tplSummary')}</summary>
                  <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-slate-400">{`// 独立 mod 引用 SpireForgeRuntime.dll，初始化时注册：
SpireForge.Api.SfEffects.Register("${e.handler || 'my_effect'}", async ctx =>
{
    // ctx.Card / ctx.Effect.Amount / ctx.Target / ctx.Choice / ctx.Play
    await MegaCrit.Sts2.Core.Commands.CreatureCmd.Damage(
        ctx.Choice!, ctx.Target!, ctx.Effect.Amount,
        MegaCrit.Sts2.Core.ValueProps.ValueProp.Move, ctx.Card, ctx.Play);
});
// 卡牌 JSON 即可用 {"kind":"${e.handler || 'my_effect'}", "amount": 5} 调用`}</pre>
                </details>
                <details className="rounded-lg border border-sky-400/20 bg-sky-500/5 p-2 text-[11px] text-slate-500">
                  <summary className="cursor-pointer select-none text-sky-300/80">{t('pp.exampleSummary')}</summary>
                  <div className="mt-1.5 leading-relaxed text-slate-400">{t('pp.exampleIntro')}</div>
                  <div className="mt-2 text-slate-500">{t('pp.exampleSaved')}</div>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-slate-400">{'{\n  "kind": "custom",\n  "handler": "demo_kaka"\n}'}</pre>
                  <div className="mt-2 text-slate-500">{t('pp.exampleHandler')}</div>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-slate-400">{`// RuntimeEntry.cs —— 随 SpireForgeRuntime 常驻注册（真实源码，非示意）
SpireForge.Api.SfEffects.Register("demo_kaka", async ctx =>
{
    var player = ctx.Card.Owner;
    var combatState = player.Creature.CombatState
        ?? MegaCrit.Sts2.Core.Combat.CombatManager.Instance.DebugOnlyGetState()
        ?? throw new InvalidOperationException("combat state unavailable");
    await SfKaka.SpawnKaka(combatState);   // 召唤邪教徒并改名「咔咔」（13 HP）
    await PowerCmd.Apply<RitualPower>(     // 自身获得 1 层仪式（每回合结束 +1 力量）
        ctx.Choice ?? new MegaCrit.Sts2.Core.GameActions.Multiplayer.ThrowingPlayerChoiceContext(),
        player.Creature, 1m, null, ctx.Card, false);
});

// SfKaka.cs —— 召唤与改名（节选）
public static async Task<Creature> SpawnKaka(ICombatState combatState)
{
    var model = ModelDb.Monster<DampCultist>().ToMutable();
    Marked.Add(model, null);               // 标记实例 → Title getter 后缀把名字换成咔咔
    var creature = await CreatureCmd.Add(model, combatState);
    await CreatureCmd.SetMaxAndCurrentHp(creature, 13m);
    return creature;
}`}</pre>
                </details>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.amount')}</span>
                  <input
                    type="number"
                    className={inputCls + ' w-24'}
                    value={(e as { amount: number }).amount}
                    onChange={(ev) => patch(i, { amount: Number(ev.target.value) } as Partial<EffectDef>)}
                  />
                  {e.kind === 'gold' && (
                    <span className="text-[10px] text-slate-600">{t('pp.goldNegative')}</span>
                  )}
                  {e.kind === 'power' && (
                    <>
                      <span className="whitespace-nowrap text-xs text-slate-400">{t('pp.powerLabel')}</span>
                      <Combobox
                        value={(e as { power: string }).power}
                        items={powerCombo}
                        onChange={(v) => patch(i, { power: v } as Partial<EffectDef>)}
                        fallbackDisplay={(e as { power: string }).power}
                        searchPlaceholder={t('pp.powerSearch')}
                        allowRaw
                        rawLabel={(raw) => t('pp.useRaw', { v: raw })}
                      />
                    </>
                  )}
                  {e.kind === 'spawn' && (
                    <>
                      <span className="whitespace-nowrap text-xs text-slate-400">{t('pp.spawnEntry')}</span>
                      <Combobox
                        value={(e as { card_entry: string }).card_entry}
                        items={spawnCombo}
                        onChange={(v) => patch(i, { card_entry: v } as Partial<EffectDef>)}
                        fallbackDisplay={(e as { card_entry: string }).card_entry}
                        searchPlaceholder={t('pp.cardSearch')}
                        allowRaw
                        rawLabel={(raw) => t('pp.useRaw', { v: raw })}
                      />
                      <select
                        className={selectCls + ' w-24'}
                        value={(e as { pile?: string }).pile ?? 'draw'}
                        onChange={(ev) => patch(i, { pile: ev.target.value } as Partial<EffectDef>)}
                      >
                        <option value="draw">{lang === 'en' ? 'Draw pile' : '抽牌堆'}</option>
                        <option value="hand">{lang === 'en' ? 'Hand' : '手牌'}</option>
                        <option value="discard">{lang === 'en' ? 'Discard pile' : '弃牌堆'}</option>
                      </select>
                    </>
                  )}
                  {e.kind === 'summon' && (() => {
                    const me = e as { monster: string; hp?: number };
                    return (
                      <>
                        <span className="whitespace-nowrap text-xs text-slate-400">{t('pp.monster')}</span>
                        <Combobox
                          value={me.monster}
                          items={monsterCombo}
                          onChange={(v) => patch(i, { monster: v } as Partial<EffectDef>)}
                          fallbackDisplay={me.monster}
                          searchPlaceholder={t('pp.monsterSearch')}
                          allowRaw
                          rawLabel={(raw) => t('pp.useRaw', { v: raw })}
                        />
                        <span className="whitespace-nowrap text-xs text-slate-400">{t('pp.summonHp')}</span>
                        <input
                          type="number"
                          className={inputCls + ' w-20'}
                          value={me.hp ?? ''}
                          onChange={(ev) => {
                            const v = ev.target.value === '' ? undefined : Number(ev.target.value);
                            patch(i, { hp: v } as Partial<EffectDef>);
                          }}
                        />
                        <span className="text-[10px] text-slate-600">{t('pp.summonHpOpt')}</span>
                      </>
                    );
                  })()}
                  {('props' in e) && (
                    <label className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-slate-400" title={t('pp.unpoweredTitle')}>
                      <input
                        type="checkbox"
                        checked={(e as { props: string[] }).props.includes('Unpowered')}
                        onChange={(ev) => {
                          const props = (e as { props: string[] }).props.filter((p) => p !== 'Unpowered');
                          if (ev.target.checked) props.push('Unpowered');
                          patch(i, { props } as Partial<EffectDef>);
                        }}
                      />
                      {t('pp.unpowered')}
                    </label>
                  )}
                </div>
                {e.kind === 'power' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.targetLabel')}</span>
                    <select
                      className={selectCls + ' w-40'}
                      value={(e as { target?: string }).target ?? ''}
                      onChange={(ev) => patch(i, { target: ev.target.value || undefined } as Partial<EffectDef>)}
                    >
                      <option value="">{t('pp.playTargetDefault')}</option>
                      <option value="self">{t('pp.targetSelf')}</option>
                      <option value="all_enemies">{t('pp.targetAllEnemies')}</option>
                    </select>
                    <span className="text-[10px] text-slate-600">{t('pp.buffHint')}</span>
                  </div>
                )}
                {hookCtx && e.kind === 'damage' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.targetLabel')}</span>
                    <select
                      className={selectCls + ' w-36'}
                      value={(e as { target?: string }).target ?? 'random_enemy'}
                      onChange={(ev) => patch(i, { target: ev.target.value } as Partial<EffectDef>)}
                    >
                      {HOOK_TARGET_OPTIONS.map((o) => (
                        <option key={o.v} value={o.v}>{pick(o.label, lang)}</option>
                      ))}
                    </select>
                  </div>
                )}
                {isPlay && UPGRADEABLE.includes(e.kind) && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-500">{t('pp.upgradeDelta')}</span>
                    <input
                      type="number"
                      className={inputCls + ' w-24'}
                      value={
                        e.kind === 'draw' ? u.draw
                        : e.kind === 'damage' ? u.damage
                        : e.kind === 'block' ? u.block
                        : e.kind === 'heal' ? u.heal
                        : u.energy
                      }
                      onChange={(ev) => {
                        const v = Number(ev.target.value) || 0;
                        if (e.kind === 'draw') updateCard({ upgrades: { ...u, draw: v } });
                        else if (e.kind === 'damage') updateCard({ upgrades: { ...u, damage: v } });
                        else if (e.kind === 'block') updateCard({ upgrades: { ...u, block: v } });
                        else if (e.kind === 'heal') updateCard({ upgrades: { ...u, heal: v } });
                        else updateCard({ upgrades: { ...u, energy: v } });
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="space-y-2 border-t border-white/10 pt-3">
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{t('pp.coreKinds')}</div>
          <div className="flex flex-wrap gap-1.5">
            {CORE_KINDS.map((k) => (
              <button
                key={k}
                onClick={() => add(k)}
                className="whitespace-nowrap rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-amber-400/50 hover:text-amber-300"
              >
                + {pick(EFFECT_META[k].label, lang)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{t('pp.extraKinds')}</div>
          <div className="flex flex-wrap gap-1.5">
            {EXTRA_KINDS.map((k) => (
              <button
                key={k}
                onClick={() => add(k)}
                title={pick(EFFECT_META[k].desc, lang)}
                className="whitespace-nowrap rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-amber-400/50 hover:text-amber-300"
              >
                + {pick(EFFECT_META[k].label, lang)}
              </button>
            ))}
          </div>
        </div>
      </div>
      {isPlay && (
        <Field label={t('pp.maxUpgrade')} hint={t('pp.maxUpgradeHint')}>
          <input type="number" className={inputCls + ' w-24'} value={card.max_upgrade_level}
            onChange={(e) => updateCard({ max_upgrade_level: Number(e.target.value) || 0 })} />
        </Field>
      )}
      {!isPlay && (
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-[11px] leading-relaxed text-slate-500">
          {t('pp.hookLiteralNote')}
        </div>
      )}
    </div>
  );
}

/** 卡牌 id 编辑：失去焦点/回车才提交改名（走后端事务：meta 原位替换 + 立绘跟随）。
 *  改名会改变游戏内 Entry——已发布/安装过的卡会破坏玩家存档引用，必须确认。 */
function IdField({ card }: { card: CardDef }) {
  const { renameCard, showToast } = useStore();
  const t = useT();
  const [draft, setDraft] = useState(card.id);
  useEffect(() => setDraft(card.id), [card.id]);

  const commit = async () => {
    const v = draft.trim();
    if (v === card.id) return;
    if (!v) {
      setDraft(card.id);
      return;
    }
    const ok = confirm(t('pp.idRenameConfirm', { a: card.id, b: v }));
    if (!ok) {
      setDraft(card.id);
      return;
    }
    try {
      await renameCard(card.id, v);
      showToast(t('pp.renamed'));
    } catch (e) {
      setDraft(card.id);
      showToast(t('pp.renameFailed', { e: String(e) }));
    }
  };

  return (
    <input
      className={inputCls}
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/[^a-z0-9_]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function LookTab({ card }: { card: CardDef }) {
  const { projectRoot } = useStore();
  const { updateCard, showToast } = useStore();
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dim, setDim] = useState<string>('');

  useEffect(() => {
    if (!card.portrait) { setDim(''); return; }
    let cancelled = false;
    let url: string | null = null;
    api.readPortrait(card.portrait).then((bytes) => {
      if (cancelled) return;
      url = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
      const img = new Image();
      img.onload = () => { if (!cancelled) setDim(`${img.naturalWidth}×${img.naturalHeight}`); };
      img.onerror = () => { if (!cancelled) setDim(''); };
      img.src = url;
    }).catch(() => { if (!cancelled) setDim(''); });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [card.portrait]);

  const onFile = async (f: File) => {
    const buf = new Uint8Array(await f.arrayBuffer());
    const ext = f.name.includes('.') ? f.name.split('.').pop()! : 'png';
    const rel = await api.savePortrait(card.id, ext, buf);
    updateCard({ portrait: rel });
    showToast(t('pp.portraitSaved'));
  };

  // 只有官方基准尺寸（含远古卡 250×351）才算 good；其余提示建议尺寸
  const good = dim === '250×190' || dim === '1000×760' || dim === '250×351';

  return (
    <div className="space-y-4">
      <Field label={t('pp.portraitLabel')} hint={dim ? `${dim}${good ? '' : t('pp.portraitSuggest')}` : t('pp.portraitUnset')}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 transition hover:border-amber-400/50 hover:text-amber-300"
          >
            {card.portrait ? t('pp.changeImage') : t('pp.uploadImage')}
          </button>
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
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />
        </div>
      </Field>
      <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-[11px] leading-relaxed text-slate-500">
        {t('pp.portraitNote')}
        {projectRoot && card.portrait && (
          <div className="mt-1 font-mono text-[10px] text-slate-600">{card.portrait}</div>
        )}
      </div>
    </div>
  );
}

function LocTab({ card }: { card: CardDef }) {
  const { meta, updateCard } = useStore();
  const t = useT();
  const genDesc = useGenDescription();
  const [loc, setLoc] = useState<'zhs' | 'eng'>('zhs');
  const insert = (s: string) => {
    const cur = card.description[loc] ?? '';
    updateCard({ description: { ...card.description, [loc]: cur + s } });
  };
  return (
    <div className="space-y-3">
      <Segmented
        value={loc}
        options={[{ v: 'zhs' as const, label: '简体中文' }, { v: 'eng' as const, label: 'English' }]}
        onChange={setLoc}
      />
      <Field label={t('pp.locName')} hint={`${cardEntry(meta?.pack_id ?? '', card.id)}.title`}>
        <input className={inputCls} value={card.name[loc]}
          onChange={(e) => updateCard({ name: { ...card.name, [loc]: e.target.value } })} />
      </Field>
      <Field label={t('pp.locDesc')} hint={`${cardEntry(meta?.pack_id ?? '', card.id)}.description`}>
        <div className="mb-1.5 flex justify-end">
          <button
            onClick={() => genDesc(card)}
            title={t('pp.genDescTitle')}
            className="whitespace-nowrap text-[11px] text-sky-300/80 underline hover:text-sky-200"
          >
            {t('pp.genDesc')}
          </button>
        </div>
        <textarea
          className={inputCls + ' h-28 resize-none font-mono'}
          value={card.description[loc]}
          onChange={(e) => updateCard({ description: { ...card.description, [loc]: e.target.value } })}
        />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {['{Damage}', '{Block}', '{Cards}', '{Damage:diff()}', '{Block:diff()}', '[gold][/gold]', '[red][/red]', '[blue][/blue]'].map((s) => (
          <button
            key={s}
            onClick={() => insert(s)}
            className="rounded border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-slate-400 hover:border-amber-400/50 hover:text-amber-300"
          >
            {s}
          </button>
        ))}
      </div>
      <Field label={t('pp.locFlavor')}>
        <input className={inputCls} value={card.flavor[loc]}
          onChange={(e) => updateCard({ flavor: { ...card.flavor, [loc]: e.target.value } })} />
      </Field>
    </div>
  );
}

export default function PropertyPanel() {
  const { cards, selectedId, updateCard, removeCard, duplicateCard, dirtyIds, showToast } = useStore();
  const t = useT();
  const lang = useLang();
  const [tab, setTab] = useState<'basic' | 'effects' | 'look' | 'loc'>('basic');
  const card = cards.find((c) => c.id === selectedId);
  const dirty = dirtyIds.length > 0;

  if (!card) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-600">
        {t('pp.pickFromLeft')}
      </div>
    );
  }

  const isCurseLike = card.card_type === 'Curse' || card.card_type === 'Status';

  /** 卡池多选切换：pools 存全量，pool 保持主池（首个）——运行时按 pools 注册进全部池 */
  const togglePool = (p: Pool) => {
    const cur = card.pools?.length ? card.pools : [card.pool];
    const next = cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p];
    if (next.length === 0) return; // 至少保留一个卡池
    updateCard({
      pools: next,
      pool: (next.includes(card.pool) ? card.pool : next[0]) as Pool,
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-white/10 px-3 py-2">
        {([['basic', t('pp.tabBasic')], ['effects', t('pp.tabEffects')], ['look', t('pp.tabLook')], ['loc', t('pp.tabLoc')]] as [typeof tab, string][]).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
              tab === k ? 'bg-white/10 text-amber-300' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {l}
          </button>
        ))}
        {dirty && (
          <span title={t('app.undoTitle')}
            className="whitespace-nowrap rounded-md bg-amber-500/15 px-2 py-1 text-[10px] font-semibold text-amber-300">
            ● {t('pp.dirtyBadge', { n: dirtyIds.length })}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={async () => {
            await duplicateCard(card.id);
            showToast(t('pp.copied'));
          }}
          title={t('pp.copyTitle')}
          className="whitespace-nowrap rounded-md px-2 py-1.5 text-xs text-slate-400 transition hover:bg-white/10 hover:text-slate-200"
        >
          {t('pp.copy')}
        </button>
        <button
          onClick={async () => {
            const label = card.name.zhs || card.name.eng || card.id;
            if (!confirm(t('pp.deleteConfirm', { name: label }))) return;
            await removeCard(card.id);
            showToast(t('pp.deleted'));
          }}
          className="whitespace-nowrap rounded-md px-2 py-1.5 text-xs text-rose-400/70 transition hover:bg-rose-500/15 hover:text-rose-300"
        >
          {t('pp.delete')}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'basic' && (
          <div className="space-y-3">
            <VanillaSection card={card} />

            <Field label={t('pp.idLabel')} hint={t('pp.idHint')}>
              <IdField card={card} />
            </Field>

            <Field label={t('pp.poolLabel')} hint={t('pp.poolHint')}>
              <div className="flex flex-wrap gap-1">
                {(Object.entries(POOL_LABEL)).map(([v, l]) => {
                  const cur = card.pools?.length ? card.pools : [card.pool];
                  const on = cur.includes(v as Pool);
                  return (
                    <button
                      key={v}
                      onClick={() => togglePool(v as Pool)}
                      className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        on
                          ? 'bg-amber-500/90 text-black'
                          : 'border border-white/10 bg-black/30 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                      }`}
                    >
                      {pick(l, lang)}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label={t('pp.typeLabel')}>
              <Segmented
                value={card.card_type}
                options={(Object.keys(TYPE_LABEL) as CardType[]).map((v) => ({ v, label: pick(TYPE_LABEL[v], lang) }))}
                onChange={(v) => {
                  const patch: Partial<CardDef> = { card_type: v };
                  if (v === 'Curse' || v === 'Status') {
                    patch.cost = -1;
                    patch.target = 'None';
                    patch.pool = v === 'Curse' ? 'curse' : 'status';
                    if (!card.keywords.includes('Unplayable')) patch.keywords = [...card.keywords, 'Unplayable'];
                  }
                  updateCard(patch);
                }}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('pp.rarityLabel')}>
                <select className={selectCls} value={card.rarity}
                  onChange={(e) => updateCard({ rarity: e.target.value as CardDef['rarity'] })}>
                  {(Object.keys(RARITY_LABEL) as CardDef['rarity'][]).map((v) => (
                    <option key={v} value={v}>{pick(RARITY_LABEL[v], lang)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('pp.targetLabel')}>
                <select className={selectCls} value={card.target}
                  onChange={(e) => updateCard({ target: e.target.value as TargetType })}>
                  {(Object.keys(TARGET_LABEL) as TargetType[]).map((v) => (
                    <option key={v} value={v}>{pick(TARGET_LABEL[v], lang)}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('pp.costLabel')} hint={isCurseLike ? t('pp.costHintCurse') : t('pp.costHint')}>
                <input type="number" className={inputCls} value={card.cost}
                  onChange={(e) => updateCard({ cost: Number(e.target.value) })} />
              </Field>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 whitespace-nowrap text-xs text-slate-400">
                  <input type="checkbox" checked={card.costs_x}
                    onChange={(e) => updateCard({ costs_x: e.target.checked })} />
                  {t('pp.xCost')}
                </label>
              </div>
            </div>

            <Field label={t('pp.keywordLabel')} hint={t('pp.keywordHint')}>
              <div className="mb-1.5 flex flex-wrap gap-1">
                {KEYWORD_CHIPS.map(({ k, label, hint }) => {
                  const on = card.keywords.includes(k);
                  return (
                    <button
                      key={k}
                      title={pick(hint, lang)}
                      onClick={() =>
                        updateCard({
                          keywords: on
                            ? card.keywords.filter((x) => x !== k)
                            : [...card.keywords, k],
                        })
                      }
                      className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] transition ${
                        on
                          ? 'bg-amber-500/90 text-black'
                          : 'border border-white/10 bg-black/30 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                      }`}
                    >
                      {pick(label, lang)}
                    </button>
                  );
                })}
              </div>
              <input className={inputCls} value={card.keywords.join(', ')}
                onChange={(e) => updateCard({ keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
            </Field>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2 whitespace-nowrap text-xs text-slate-400">
                <input type="checkbox" checked={card.show_in_library}
                  onChange={(e) => updateCard({ show_in_library: e.target.checked })} />
                {t('pp.showLib')}
              </label>
            </div>
          </div>
        )}
        {tab === 'effects' && <EffectsTab card={card} />}
        {tab === 'look' && <LookTab card={card} />}
        {tab === 'loc' && <LocTab card={card} />}
      </div>
    </div>
  );
}
