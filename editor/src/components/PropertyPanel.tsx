import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/tauri';
import { useStore } from '../lib/store';
import {
  CARD_TYPE_LABEL, HOOK_LABEL, POOL_LABEL, RARITY_LABEL, TARGET_LABEL,
  cardEntry, effectsFromVanillaVars,
  type CardDef, type CardType, type EffectDef, type HookField, type Pool, type TargetType,
  type VanillaCatalog, type VanillaEntry,
} from '../lib/types';

type Tab = 'basic' | 'effects' | 'look' | 'loc';

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

/** 施加增益/减益的常用力量（可自由输入其他 PowerModel 名） */
const COMMON_POWERS = [
  'Vulnerable', 'Weak', 'Frail', 'Poison', 'Doom',
  'Strength', 'Dexterity', 'Focus', 'Artifact', 'Intangible', 'Thorns', 'Barricade',
];

/** 参与升级变量的效果种类（其余种类用字面数值） */
const UPGRADEABLE = ['damage', 'block', 'draw', 'energy', 'heal'];

/** 需要玩家选择上下文的效果种类（on_enter_combat 不可用） */
const NEEDS_CHOICE = ['damage', 'draw', 'lose_hp', 'power', 'discard', 'exhaust'];

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        {hint && <span className="text-[10px] text-slate-600">{hint}</span>}
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
  const stats = card.stats ?? {};
  const upStats = card.upgrade_stats ?? {};
  const vanilla = useVanillaEntry(card.vanilla_id);

  const prefillEffects = () => {
    if (!vanilla) return;
    const fx = effectsFromVanillaVars(vanilla.vars ?? {});
    if (fx.length === 0) {
      showToast('原版数据无法映射出效果清单（行为多为硬编码），请手动编辑');
      return;
    }
    const ok = confirm(
      `按原版数据预填 ${fx.length} 条效果？\n\n` +
        '效果清单非空 = 整体替换原版打出行为（原版效果不再执行）。\n' +
        '数值型变量（伤害/格挡/抽牌/能量/施加）可映射；计算型行为无法静态还原，需手动补。',
    );
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
            placeholder="变量名，如 Damage"
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
        + {delta ? '升级增量' : '数值'}
      </button>
    </div>
  );

  return (
    <div className="rounded-lg border border-sky-400/20 bg-sky-500/[0.06] p-3">
      {card.vanilla_id ? (
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs">
            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-[11px] text-sky-200">
              覆盖原版卡 {card.vanilla_id}
            </span>
            <span className="ml-2 text-slate-500">发布后游戏内原版卡被本卡设定替换</span>
          </div>
          <button
            onClick={() => updateCard({ vanilla_id: null, stats: null, upgrade_stats: null })}
            className="text-[11px] text-slate-500 underline hover:text-slate-300"
          >
            取消覆盖
          </button>
        </div>
      ) : (
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">想修改游戏原版卡（改费用/数值/文案）？</span>
          <button
            onClick={() => updateCard({ vanilla_id: '' })}
            className="shrink-0 rounded-md border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/20"
          >
            覆盖原版卡
          </button>
        </div>
      )}
      {card.vanilla_id != null && (
        <div className="space-y-2">
          {card.vanilla_id === '' && (
            <input
              value={card.vanilla_id === '' ? '' : card.vanilla_id}
              onChange={(e) => updateCard({ vanilla_id: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
              placeholder="原版 Entry，如 BASH（左侧「原版卡」按钮可直接选）"
              className="w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-amber-400/60"
            />
          )}
          <div>
            <div className="mb-1 text-[11px] font-medium text-slate-400">数值覆盖（覆盖后数值；effects 为空时原版行为不变）</div>
            {rows(stats, setStats, false)}
          </div>
          <div>
            <div className="mb-1 text-[11px] font-medium text-slate-400">升级增量（替换原版升级逻辑）</div>
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
  const varEntries = Object.entries(vanilla.vars ?? {});
  const upEntries = Object.entries(vanilla.upgrade ?? {});
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-2.5 text-[11px] leading-relaxed">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-semibold text-slate-300">
          原版：{vanilla.name}
          <span className="ml-1.5 text-slate-600">{vanilla.name_en}</span>
        </span>
        <button
          onClick={onPrefill}
          title="按原版数值生成效果清单（会整体替换原版打出行为）"
          className="shrink-0 rounded border border-sky-400/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-200 hover:bg-sky-500/20"
        >
          预填原版效果
        </button>
      </div>
      <div className="text-slate-500">
        {vanilla.x_cost ? 'X费' : `${vanilla.cost ?? '?'}费`}
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
          升级：{upEntries.map(([k, v]) => `${k}${v}`).join('，')}
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
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            value === o.v ? 'bg-amber-500/90 text-black' : 'text-slate-400 hover:bg-white/10 hover:text-slate-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 数值变量抽出来，效果和升级共用；custom 走独立编辑器 */
const EFFECT_META: Record<string, { label: string; varName: string; desc: string }> = {
  damage: { label: '造成伤害', varName: 'Damage', desc: '对目标造成伤害（DamageVar）' },
  block: { label: '获得格挡', varName: 'Block', desc: '为自身获得格挡（BlockVar）' },
  draw: { label: '抽牌', varName: 'Cards', desc: '从抽牌堆抽牌（CardsVar）' },
  energy: { label: '获得能量', varName: 'Energy', desc: '获得能量（EnergyVar）' },
  heal: { label: '回复生命', varName: 'Heal', desc: '为自身回复生命（HealVar）' },
  discard: { label: '随机弃牌', varName: '', desc: '随机弃置 N 张手牌（无法指定哪张）' },
  exhaust: { label: '随机消耗', varName: '', desc: '随机消耗 N 张手牌（无法指定哪张）' },
  gold: { label: '获得金币', varName: '', desc: '获得金币；负数 = 失去金币' },
  lose_hp: { label: '失去生命', varName: '', desc: '自身失去 N 点生命（无来源、不可格挡）' },
  max_hp: { label: '生命上限', varName: '', desc: '为自身增加 N 点生命上限' },
  power: { label: '施加增益/减益', varName: '', desc: '对目标施加力量（易伤/中毒/力量等，可输入任意 PowerModel 名）' },
  spawn: { label: '生成卡牌', varName: '', desc: '把一张卡（自定义或原版 Entry）加入抽牌堆/手牌/弃牌堆' },
  custom: { label: '自定义', varName: '', desc: '行为由处理器 mod 定义（SfEffects 注册表）' },
};

/** 效果触发时机：打出 + 生命周期钩子 */
type Trigger = 'play' | HookField;

const TRIGGER_OPTIONS: { v: Trigger; label: string; hint: string }[] = [
  { v: 'play', label: '打出时', hint: '打出这张牌时依次执行（主效果，可升级）' },
  { v: 'on_draw', label: HOOK_LABEL.on_draw, hint: '此牌被抽到时（含开局起手）' },
  { v: 'on_discard', label: HOOK_LABEL.on_discard, hint: '此牌被弃置时' },
  { v: 'on_exhaust', label: HOOK_LABEL.on_exhaust, hint: '此牌被消耗时（含 Ethereal）' },
  { v: 'on_enter_combat', label: HOOK_LABEL.on_enter_combat, hint: '战斗开始时；仅支持格挡/回复/能量/自定义' },
  { v: 'on_turn_end_in_hand', label: HOOK_LABEL.on_turn_end_in_hand, hint: '回合结束时若在手中；常配合 Retain 关键词' },
];

/** 钩子上下文取敌方式 */
const HOOK_TARGET_OPTIONS = [
  { v: 'random_enemy', label: '随机敌人' },
  { v: 'self', label: '自身' },
  { v: 'all_enemies', label: '全体敌人' },
];

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
        const t = ev.target.value;
        setText(t);
        try {
          const parsed = t.trim() === '' ? {} : JSON.parse(t);
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

function EffectsTab({ card }: { card: CardDef }) {
  const { updateCard } = useStore();
  const [trigger, setTrigger] = useState<Trigger>('play');
  const u = card.upgrades;

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

  const triggerMeta = TRIGGER_OPTIONS.find((t) => t.v === trigger)!;
  const isPlay = trigger === 'play';
  const hookCtx = !isPlay; // 钩子上下文：无玩家指定目标，需要 target 字段的效果走钩子取敌
  const enterCombatUnsupported = trigger === 'on_enter_combat'
    && list.some((e) => NEEDS_CHOICE.includes(e.kind));

  return (
    <div className="space-y-3">
      <Field label="触发时机">
        <Segmented
          value={trigger}
          options={TRIGGER_OPTIONS.map((t) => ({ v: t.v, label: t.label }))}
          onChange={setTrigger}
        />
        <div className="mt-1 text-[11px] text-slate-600">{triggerMeta.hint}</div>
      </Field>

      {enterCombatUnsupported && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
          战斗开始钩子不带玩家选择上下文：伤害/抽牌/弃牌/消耗/施加/失去生命无法执行，保存后会被 Runtime 跳过。
        </div>
      )}

      {list.length === 0 && (
        <div className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-slate-600">
          尚无效果。从下方目录添加；描述文本里用 {'{Damage}'} {'{Block}'} 引用数值。
        </div>
      )}
      {list.map((e, i) => {
        const meta = EFFECT_META[e.kind];
        return (
          <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">{meta.label}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => move(i, -1)} className="rounded px-1.5 text-slate-500 hover:bg-white/10 hover:text-slate-200">↑</button>
                <button onClick={() => move(i, 1)} className="rounded px-1.5 text-slate-500 hover:bg-white/10 hover:text-slate-200">↓</button>
                <button onClick={() => remove(i)} className="rounded px-1.5 text-rose-400/80 hover:bg-rose-500/20 hover:text-rose-300">✕</button>
              </div>
            </div>
            <div className="text-[11px] text-slate-600">
              {meta.desc}{isPlay && meta.varName ? <> · 变量 {'{' + meta.varName + '}'}</> : null}
            </div>

            {e.kind === 'custom' ? (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-14 text-xs text-slate-400">处理器</span>
                  <input
                    className={inputCls + ' w-52 font-mono'}
                    placeholder="处理器名，如 my_pack_storm"
                    value={e.handler}
                    onChange={(ev) => patch(i, { handler: ev.target.value.replace(/[^a-zA-Z0-9_]/g, '') } as Partial<EffectDef>)}
                  />
                  {!e.handler && <span className="text-[10px] text-rose-400/80">需要处理器 mod 注册此名</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-14 text-xs text-slate-400">数值</span>
                  <input
                    type="number"
                    className={inputCls + ' w-24'}
                    value={e.amount ?? ''}
                    onChange={(ev) => {
                      const v = ev.target.value === '' ? undefined : Number(ev.target.value);
                      patch(i, { amount: v } as Partial<EffectDef>);
                    }}
                  />
                  <span className="text-[10px] text-slate-600">可选 · 含义由处理器定义</span>
                </div>
                {hookCtx && (
                  <div className="flex items-center gap-2">
                    <span className="w-14 text-xs text-slate-400">目标</span>
                    <select
                      className={selectCls + ' w-36'}
                      value={e.target ?? 'random_enemy'}
                      onChange={(ev) => patch(i, { target: ev.target.value } as Partial<EffectDef>)}
                    >
                      {HOOK_TARGET_OPTIONS.map((t) => (
                        <option key={t.v} value={t.v}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <span className="text-xs text-slate-400">params（JSON）</span>
                  <ParamsEditor
                    value={e.params}
                    onChange={(v) => patch(i, { params: v } as Partial<EffectDef>)}
                  />
                </div>
                <details className="rounded-lg border border-white/10 bg-black/30 p-2 text-[11px] text-slate-500">
                  <summary className="cursor-pointer select-none text-slate-400">处理器 mod 模板（点开复制）</summary>
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
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-14 text-xs text-slate-400">数值</span>
                  <input
                    type="number"
                    className={inputCls + ' w-24'}
                    value={(e as { amount: number }).amount}
                    onChange={(ev) => patch(i, { amount: Number(ev.target.value) } as Partial<EffectDef>)}
                  />
                  {e.kind === 'gold' && (
                    <span className="text-[10px] text-slate-600">负数 = 失去金币</span>
                  )}
                  {e.kind === 'power' && (
                    <>
                      <span className="ml-2 text-xs text-slate-400">力量</span>
                      <input
                        list="sf-common-powers"
                        className={inputCls + ' w-36 font-mono'}
                        placeholder="Vulnerable"
                        value={(e as { power: string }).power}
                        onChange={(ev) => patch(i, { power: ev.target.value.replace(/[^a-zA-Z0-9_]/g, '') } as Partial<EffectDef>)}
                      />
                      <datalist id="sf-common-powers">
                        {COMMON_POWERS.map((p) => <option key={p} value={p} />)}
                      </datalist>
                    </>
                  )}
                  {e.kind === 'spawn' && (
                    <>
                      <span className="ml-2 text-xs text-slate-400">卡牌 Entry</span>
                      <input
                        className={inputCls + ' w-40 font-mono'}
                        placeholder="如 SF_MY_PACK_MY_STRIKE 或 BASH"
                        value={(e as { card_entry: string }).card_entry}
                        onChange={(ev) => patch(i, { card_entry: ev.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') } as Partial<EffectDef>)}
                      />
                      <select
                        className={selectCls + ' w-24'}
                        value={(e as { pile?: string }).pile ?? 'draw'}
                        onChange={(ev) => patch(i, { pile: ev.target.value } as Partial<EffectDef>)}
                      >
                        <option value="draw">抽牌堆</option>
                        <option value="hand">手牌</option>
                        <option value="discard">弃牌堆</option>
                      </select>
                    </>
                  )}
                  {('props' in e) && (
                    <label className="ml-2 flex items-center gap-1.5 text-xs text-slate-400">
                      <input
                        type="checkbox"
                        checked={(e as { props: string[] }).props.includes('Unpowered')}
                        onChange={(ev) => {
                          const props = (e as { props: string[] }).props.filter((p) => p !== 'Unpowered');
                          if (ev.target.checked) props.push('Unpowered');
                          patch(i, { props } as Partial<EffectDef>);
                        }}
                      />
                      不受力量影响
                    </label>
                  )}
                </div>
                {e.kind === 'power' && (
                  <div className="flex items-center gap-2">
                    <span className="w-14 text-xs text-slate-400">目标</span>
                    <select
                      className={selectCls + ' w-40'}
                      value={(e as { target?: string }).target ?? ''}
                      onChange={(ev) => patch(i, { target: ev.target.value || undefined } as Partial<EffectDef>)}
                    >
                      <option value="">打出目标 / 随机敌人</option>
                      <option value="self">自身（增益用）</option>
                      <option value="all_enemies">全体敌人</option>
                    </select>
                    <span className="text-[10px] text-slate-600">增益（力量/敏捷）选「自身」</span>
                  </div>
                )}
                {hookCtx && e.kind === 'damage' && (
                  <div className="flex items-center gap-2">
                    <span className="w-14 text-xs text-slate-400">目标</span>
                    <select
                      className={selectCls + ' w-36'}
                      value={(e as { target?: string }).target ?? 'random_enemy'}
                      onChange={(ev) => patch(i, { target: ev.target.value } as Partial<EffectDef>)}
                    >
                      {HOOK_TARGET_OPTIONS.map((t) => (
                        <option key={t.v} value={t.v}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                {isPlay && UPGRADEABLE.includes(e.kind) && (
                  <div className="flex items-center gap-2">
                    <span className="w-14 text-xs text-slate-500">升级 +</span>
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
      <div className="flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
        {Object.entries(EFFECT_META).map(([k, m]) => (
          <button
            key={k}
            onClick={() => add(k)}
            className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-amber-400/50 hover:text-amber-300"
          >
            + {m.label}
          </button>
        ))}
      </div>
      {isPlay && (
        <Field label="最高升级等级" hint="诅咒/状态通常为 0">
          <input type="number" className={inputCls + ' w-24'} value={card.max_upgrade_level}
            onChange={(e) => updateCard({ max_upgrade_level: Number(e.target.value) || 0 })} />
        </Field>
      )}
      {!isPlay && (
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-[11px] leading-relaxed text-slate-500">
          钩子效果使用字面数值（不参与升级变量），数值变化请同步手写进描述文本。
        </div>
      )}
    </div>
  );
}

/** 卡牌 id 编辑：失去焦点/回车才提交改名（走后端事务：meta 原位替换 + 立绘跟随）。
 *  改名会改变游戏内 Entry——已发布/安装过的卡会破坏玩家存档引用，必须确认。 */
function IdField({ card }: { card: CardDef }) {
  const { renameCard, showToast } = useStore();
  const [draft, setDraft] = useState(card.id);
  useEffect(() => setDraft(card.id), [card.id]);

  const commit = async () => {
    const v = draft.trim();
    if (v === card.id) return;
    if (!v) {
      setDraft(card.id);
      return;
    }
    const ok = confirm(
      `把卡牌 id 从「${card.id}」改为「${v}」？\n\n` +
        `卡牌的游戏内标识（Entry）会随之改变：\n` +
        `· 尚未安装/发布过：无影响\n` +
        `· 已安装或发布过：玩家存档里的这张卡会失效，需要重新发布`,
    );
    if (!ok) {
      setDraft(card.id);
      return;
    }
    try {
      await renameCard(card.id, v);
      showToast('已改名');
    } catch (e) {
      setDraft(card.id);
      showToast('改名失败：' + String(e));
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
    showToast('立绘已保存');
  };

  // 只有官方基准尺寸（含远古卡 250×351）才算 good；其余提示建议尺寸
  const good = dim === '250×190' || dim === '1000×760' || dim === '250×351';

  return (
    <div className="space-y-4">
      <Field label="卡牌立绘（PNG）" hint={dim ? `${dim}${good ? '' : ' · 建议官方 250×190 或高清 1000×760'}` : '未设置'}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 transition hover:border-amber-400/50 hover:text-amber-300"
          >
            {card.portrait ? '更换图片' : '上传图片'}
          </button>
          {card.portrait && (
            <button
              onClick={() => updateCard({ portrait: '' })}
              className="text-xs text-rose-400/80 hover:text-rose-300"
            >
              移除
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
        官方立绘基准 250×190（远古卡 250×351）；社区高清口径 1000×760 以上。任意尺寸均可，游戏内按比例缩放显示。
        {projectRoot && card.portrait && (
          <div className="mt-1 font-mono text-[10px] text-slate-600">{card.portrait}</div>
        )}
      </div>
    </div>
  );
}

function LocTab({ card }: { card: CardDef }) {
  const { meta, updateCard } = useStore();
  const [lang, setLang] = useState<'zhs' | 'eng'>('zhs');
  const insert = (s: string) => {
    const cur = card.description[lang] ?? '';
    updateCard({ description: { ...card.description, [lang]: cur + s } });
  };
  return (
    <div className="space-y-3">
      <Segmented
        value={lang}
        options={[{ v: 'zhs' as const, label: '简体中文' }, { v: 'eng' as const, label: 'English' }]}
        onChange={setLang}
      />
      <Field label="卡牌名称" hint={`键 ${cardEntry(meta?.pack_id ?? '', card.id)}.title`}>
        <input className={inputCls} value={card.name[lang]}
          onChange={(e) => updateCard({ name: { ...card.name, [lang]: e.target.value } })} />
      </Field>
      <Field label="描述" hint={`键 …${'.description'}`}>
        <textarea
          className={inputCls + ' h-28 resize-none font-mono'}
          value={card.description[lang]}
          onChange={(e) => updateCard({ description: { ...card.description, [lang]: e.target.value } })}
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
      <Field label="风味文本（可选）">
        <input className={inputCls} value={card.flavor[lang]}
          onChange={(e) => updateCard({ flavor: { ...card.flavor, [lang]: e.target.value } })} />
      </Field>
    </div>
  );
}

export default function PropertyPanel() {
  const { cards, selectedId, updateCard, removeCard, persistAll, dirtyIds, showToast } = useStore();
  const [tab, setTab] = useState<Tab>('basic');
  const card = cards.find((c) => c.id === selectedId);
  const dirty = dirtyIds.length > 0;

  if (!card) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-600">
        从左侧选择一张卡牌
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
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        {([['basic', '基础'], ['effects', '效果'], ['look', '外观'], ['loc', '文本']] as [Tab, string][]).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              tab === k ? 'bg-white/10 text-amber-300' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {l}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={async () => { await persistAll(); showToast('已保存'); }}
          disabled={!dirty}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            dirty ? 'bg-amber-500/90 text-black hover:bg-amber-400' : 'bg-white/5 text-slate-600'
          }`}
        >
          {dirty ? `保存 ●（${dirtyIds.length}）` : '已保存'}
        </button>
        <button
          onClick={async () => {
            const label = card.name.zhs || card.name.eng || card.id;
            if (!confirm(`删除「${label}」？此操作不可恢复。`)) return;
            await removeCard(card.id);
            showToast('已删除');
          }}
          className="rounded-md px-2.5 py-1.5 text-xs text-rose-400/70 transition hover:bg-rose-500/15 hover:text-rose-300"
        >
          删除
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'basic' && (
          <div className="space-y-3">
            <VanillaSection card={card} />

            <div className="grid grid-cols-2 gap-3">
              <Field label="卡牌 id" hint="小写字母/数字/下划线；改名需确认（影响游戏内标识）">
                <IdField card={card} />
              </Field>
              <Field label="卡池（可多选）" hint="勾选多个 = 一张卡进多个角色的卡池">
                <div className="flex flex-wrap gap-1">
                  {(Object.entries(POOL_LABEL) as [Pool, string][]).map(([v, l]) => {
                    const cur = card.pools?.length ? card.pools : [card.pool];
                    const on = cur.includes(v);
                    return (
                      <button
                        key={v}
                        onClick={() => togglePool(v)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                          on
                            ? 'bg-amber-500/90 text-black'
                            : 'border border-white/10 bg-black/30 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                        }`}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>

            <Field label="卡牌类型">
              <Segmented
                value={card.card_type}
                options={(Object.keys(CARD_TYPE_LABEL) as CardType[]).map((v) => ({ v, label: CARD_TYPE_LABEL[v] }))}
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
              <Field label="稀有度">
                <select className={selectCls} value={card.rarity}
                  onChange={(e) => updateCard({ rarity: e.target.value as CardDef['rarity'] })}>
                  {(Object.keys(RARITY_LABEL) as CardDef['rarity'][]).map((v) => (
                    <option key={v} value={v}>{RARITY_LABEL[v]}</option>
                  ))}
                </select>
              </Field>
              <Field label="目标">
                <select className={selectCls} value={card.target}
                  onChange={(e) => updateCard({ target: e.target.value as TargetType })}>
                  {(Object.keys(TARGET_LABEL) as TargetType[]).map((v) => (
                    <option key={v} value={v}>{TARGET_LABEL[v]}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="能量费用" hint={isCurseLike ? '诅咒/状态惯例为 -1' : '-1 不可打出'}>
                <input type="number" className={inputCls} value={card.cost}
                  onChange={(e) => updateCard({ cost: Number(e.target.value) })} />
              </Field>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" checked={card.costs_x}
                    onChange={(e) => updateCard({ costs_x: e.target.checked })} />
                  X 费卡（消耗全部能量）
                </label>
              </div>
            </div>

            <Field label="关键词（逗号分隔，如 Innate, Exhaust）">
              <input className={inputCls} value={card.keywords.join(', ')}
                onChange={(e) => updateCard({ keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
            </Field>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input type="checkbox" checked={card.show_in_library}
                  onChange={(e) => updateCard({ show_in_library: e.target.checked })} />
                显示在卡牌图鉴
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
