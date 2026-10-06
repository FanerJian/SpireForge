// 效果页签：触发时机切换 + 效果清单行（行头/排序/删除 + 按种类分发的编辑器）
// + 底部「添加效果」按钮组 + 升级上限。
import { useMemo, useState } from 'react';
import { useStore } from '../../lib/store';
import { Field, NumInput, Segmented } from '../ui';
import { EFFECT_META, TRIGGER_OPTIONS, pick, useLang, useT, type TriggerKey } from '../../lib/i18n';
import type { CardDef, EffectDef } from '../../lib/types';
import {
  CORE_KINDS, EXTRA_KINDS, defaultEffect,
} from '../../lib/effects';
import { buildMonsterCombo, buildPowerCombo, buildHitVfxCombo, buildSfxCombo, buildSpawnCombo, buildVfxCombo, modMonsters, modPowers, useRuntimeCatalog, useVanillaCatalog } from './catalogs';
import { useAppendHookDescription, useGenDescription } from './useDescription';
import { CustomEffectBody, DelayedEffectBody, StandardEffectBody, effectMetaOf } from './effectEditors';

export default function EffectsTab({ card }: { card: CardDef }) {
  const { updateCard, cards, meta } = useStore();
  const t = useT();
  const lang = useLang();
  const genDesc = useGenDescription();
  const appendHookDesc = useAppendHookDescription();
  const [trigger, setTrigger] = useState<TriggerKey>('play');
  const vanilla = useVanillaCatalog();
  const runtime = useRuntimeCatalog();
  const u = card.upgrades;

  // 下拉数据：内置目录 + mod 目录（Runtime 游戏内导出）合并构建
  const mPowers = useMemo(() => modPowers(runtime), [runtime]);
  const mMonsters = useMemo(() => modMonsters(runtime), [runtime]);
  const powerCombo = useMemo(() => buildPowerCombo(lang, mPowers), [lang, mPowers]);
  const monsterCombo = useMemo(() => buildMonsterCombo(lang, mMonsters), [lang, mMonsters]);
  const spawnCombo = useMemo(
    () => buildSpawnCombo({ cards, excludeId: card.id, packId: meta?.pack_id ?? '', vanilla, runtime, lang }),
    [cards, vanilla, runtime, lang, meta?.pack_id, card.id],
  );
  const vfxCombo = useMemo(() => buildVfxCombo(lang, runtime), [lang, runtime]);
  const sfxCombo = useMemo(() => buildSfxCombo(lang), [lang]);
  const hitVfxCombo = useMemo(() => buildHitVfxCombo(lang, vfxCombo), [lang, vfxCombo]);

  const list: EffectDef[] = trigger === 'play' ? card.effects : (card[trigger] ?? []);
  const setList = (fx: EffectDef[]) => {
    if (trigger === 'play') updateCard({ effects: fx });
    else updateCard({ [trigger]: fx } as Partial<CardDef>);
  };

  const add = (kind: string) => {
    const def = defaultEffect(kind as EffectDef['kind']);
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

  const isPlay = trigger === 'play';
  const hookCtx = !isPlay; // 钩子上下文：无玩家指定目标，需要 target 字段的效果走钩子取敌

  return (
    <div className="space-y-3">
      <Field label={t('pp.triggerLabel')}>
        <Segmented
          value={trigger}
          options={TRIGGER_OPTIONS.map((o) => ({ v: o.v, label: pick(o.label, lang) }))}
          onChange={setTrigger}
        />
        <div className="mt-1 flex justify-end">
          <button
            onClick={() => (isPlay ? genDesc(card) : appendHookDesc(card, trigger, list))}
            className="shrink-0 whitespace-nowrap text-[11px] text-sky-300/80 underline hover:text-sky-200"
          >
            {t(isPlay ? 'pp.genDescBtn' : 'pp.genDescBtnHook')}
          </button>
        </div>
      </Field>

      {list.length === 0 && (
        <div className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-slate-600">
          {t('pp.noEffects')}
        </div>
      )}
      {list.map((e, i) => {
        const meta = effectMetaOf(e.kind);
        const rowPatch = (p: Partial<EffectDef>) => patch(i, p);
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

            {e.kind === 'delayed' ? (
              <DelayedEffectBody
                e={e as Extract<EffectDef, { kind: 'delayed' }>}
                patch={rowPatch}
                powerCombo={powerCombo}
                vfxCombo={vfxCombo}
              />
            ) : e.kind === 'custom' ? (
              <CustomEffectBody
                e={e as Extract<EffectDef, { kind: 'custom' }>}
                patch={rowPatch}
                hookCtx={hookCtx}
              />
            ) : (
              <StandardEffectBody
                e={e}
                patch={rowPatch}
                updateCard={updateCard}
                isPlay={isPlay}
                hookCtx={hookCtx}
                upgrades={u}
                powerCombo={powerCombo}
                vfxCombo={vfxCombo}
                hitVfxCombo={hitVfxCombo}
                sfxCombo={sfxCombo}
                monsterCombo={monsterCombo}
                spawnCombo={spawnCombo}
              />
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
                className="whitespace-nowrap rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-amber-400/50 hover:text-amber-300"
              >
                + {pick(EFFECT_META[k].label, lang)}
              </button>
            ))}
          </div>
        </div>
      </div>
      {isPlay && (
        <Field label={t('pp.maxUpgrade')}>
          <NumInput
            width="w-24"
            value={card.max_upgrade_level}
            onCommit={(n) => updateCard({ max_upgrade_level: Math.max(0, Math.round(n ?? 0)) })}
          />
        </Field>
      )}
    </div>
  );
}
