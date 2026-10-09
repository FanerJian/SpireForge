// 效果行的编辑器主体，按种类分发：delayed / custom / 其余标准种类。
// 从 EffectsTab 的巨型 JSX 中拆出——每种效果一个组件，行头（标签/排序/删除）仍在 EffectsTab。
import { useEffect, useMemo, useRef, useState } from 'react';
import { Combobox, type ComboItem } from '../Combobox';
import { Disclosure, NumInput, Segmented, inputCls, selectCls } from '../ui';
import { EFFECT_META, HOOK_TARGET_OPTIONS, ORB_OPTIONS, pick, useLang, useT } from '../../lib/i18n';
import { AMOUNT_KINDS, DELAYED_INNER_KINDS, defaultEffect, LEGACY_UPGRADE } from '../../lib/effects';
import { buildHandlerCombo, starterParamsFor, useRuntimeCatalog } from './catalogs';
import EffectParameterFields from './EffectParameterFields';
import { api } from '../../lib/tauri';
import { bytesToDataUrl, extOf } from '../../lib/img';
import { useStore } from '../../lib/store';
import { composeDelayedBuffText } from '../../lib/description';
import type { CardDef, EffectDef, UpgradeDef } from '../../lib/types';

type DelayedDef = Extract<EffectDef, { kind: 'delayed' }>;
type CustomDef = Extract<EffectDef, { kind: 'custom' }>;

/** 已绑定行号的补丁函数（EffectsTab 里 patch(i, p) 柯里化后的形态） */
export type RowPatch = (p: Partial<EffectDef>) => void;

/** 未知 kind 兜底元数据（手改 JSON / 新版本数据：不兜底会整树崩溃黑屏） */
export function effectMetaOf(kind: string) {
  return EFFECT_META[kind]
    ?? { label: { zh: kind, en: kind }, varName: '', desc: { zh: '未知效果种类（可能来自更新版本的数据）', en: 'Unknown effect kind (data from a newer version?)' } };
}

/** 参数 JSON 编辑器：合法时提交，非法时标红挂起 */
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

/** 钩子/延迟里不带玩家选择的目标下拉（随机敌人默认） */
function HookTargetSelect({ value, onChange, width = 'w-36' }: {
  value: string; onChange: (v: string) => void; width?: string;
}) {
  const lang = useLang();
  return (
    <select
      className={selectCls + ' ' + width}
      value={value}
      onChange={(ev) => onChange(ev.target.value)}
    >
      {HOOK_TARGET_OPTIONS.map((o) => (
        <option key={o.v} value={o.v}>{pick(o.label, lang)}</option>
      ))}
    </select>
  );
}

/** 延迟效果编辑器：回合数/触发时机/触发方式/力量图标 + 内嵌效果清单 */
export function DelayedEffectBody({ e, patch, powerCombo, vfxCombo, cardId, path }: {
  e: DelayedDef; patch: RowPatch; powerCombo: ComboItem[]; vfxCombo: ComboItem[]; cardId: string; path?: string;
}) {
  const t = useT();
  const lang = useLang();
  const { showToast } = useStore();
  const [buffLanguage, setBuffLanguage] = useState<'zhs' | 'eng'>(lang === 'en' ? 'eng' : 'zhs');
  const sectionKey = `delayed.${cardId}.${path ?? 'root'}`;
  const iconFileRef = useRef<HTMLInputElement>(null);
  const [iconUrl, setIconUrl] = useState('');
  const isIconPath = !!e.icon && e.icon.includes('/');
  const innerList = e.effects ?? []; // 删空内嵌后 Rust 端不落 effects 字段，老卡包里就是没有
  const setInner = (j: number, p: Partial<EffectDef>) =>
    patch({ effects: innerList.map((x, idx) => (idx === j ? ({ ...x, ...p } as EffectDef) : x)) } as Partial<EffectDef>);
  const removeInner = (j: number) =>
    patch({ effects: innerList.filter((_, idx) => idx !== j) } as Partial<EffectDef>);
  const addInner = (k: string) => {
    const def = defaultEffect(k as EffectDef['kind']);
    if (def) patch({ effects: [...innerList, def] } as Partial<EffectDef>);
  };

  // 图标下拉 = （空白）+ 全部游戏力量图标（复用 powerCombo：value=解析名，item 自带图标预览）
  const iconCombo = useMemo(() => ([
    {
      value: '',
      primary: lang === 'en' ? '(blank)' : '（空白）',
      secondary: lang === 'en' ? 'No icon' : '不设置图标',
      keywords: lang === 'en' ? '无 none blank clear 空' : 'none blank 无 空白 清除',
    },
    ...powerCombo,
  ]), [powerCombo, lang]);

  // 自定义图标路径 → 预览（项目资产经 readPortrait 读取，与立绘同一条链）
  useEffect(() => {
    if (!e.icon || !e.icon.includes('/')) {
      setIconUrl('');
      return;
    }
    let cancelled = false;
    api.readPortrait(e.icon).then((bytes) => {
      if (!cancelled) setIconUrl(bytesToDataUrl(new Uint8Array(bytes), extOf(e.icon!)));
    }).catch(() => {
      if (!cancelled) setIconUrl('');
    });
    return () => { cancelled = true; };
  }, [e.icon]);

  const onIconFile = async (f: File) => {
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      const dot = f.name.lastIndexOf('.');
      const ext = dot >= 0 ? f.name.slice(dot + 1).toLowerCase() : 'png';
      const rel = await api.saveEffectIcon(`${cardId}_${Date.now()}`, ext, buf);
      patch({ icon: rel } as Partial<EffectDef>);
    } catch (err) {
      showToast(t('pp.iconUploadFail', { e: String(err) }));
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <Disclosure title={t('ui.timing')} storageKey={sectionKey + '.timing'} defaultOpen>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label data-effect-field="turns" className="flex items-center gap-2">
          <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.delayedTurns')}</span>
          <NumInput
            width="w-16"
            value={e.turns}
            onCommit={(n) => patch({ turns: Math.max(1, Math.round(n ?? 1)) } as Partial<EffectDef>)}
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.delayedTiming')}</span>
          <select
            className={selectCls + ' w-28'}
            value={e.timing ?? 'turn_end'}
            onChange={(ev) => patch({ timing: ev.target.value } as Partial<EffectDef>)}
          >
            <option value="turn_end">{t('pp.delayedTurnEnd')}</option>
            <option value="turn_start">{t('pp.delayedTurnStart')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.delayedSide')}</span>
          <select
            className={selectCls + ' w-28'}
            value={e.side ?? 'player'}
            onChange={(ev) => patch({ side: ev.target.value } as Partial<EffectDef>)}
          >
            <option value="player">{t('pp.sidePlayer')}</option>
            <option value="enemy">{t('pp.sideEnemy')}</option>
            <option value="both">{t('pp.sideBoth')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.delayedMode')}</span>
          <select
            className={selectCls + ' w-44'}
            value={e.every_turn === false ? 'final' : 'every'}
            onChange={(ev) => patch({ every_turn: ev.target.value === 'final' ? false : true } as Partial<EffectDef>)}
          >
            <option value="every">{t('pp.delayedEvery')}</option>
            <option value="final">{t('pp.delayedFinal')}</option>
          </select>
        </label>
      </div>
      </Disclosure>
      <Disclosure title={t('ui.upgrade')} storageKey={sectionKey + '.upgrade'}>
      <label data-effect-field="upgrade_turns" className="flex items-center gap-2">
        <span className="text-xs text-slate-500">{t('pp.delayedUpgradeTurns')}</span>
        <NumInput width="w-16" value={e.upgrade_turns ?? 0}
          onCommit={(n) => patch({ upgrade_turns: Math.round(n ?? 0) } as Partial<EffectDef>)} />
      </label>
      </Disclosure>
      <Disclosure title={t('pp.iconLabel')} effectField="icon" storageKey={sectionKey + '.icon'}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="flex items-center gap-2">
          <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.iconLabel')}</span>
          <Combobox
            field="icon"
            value={e.icon ?? ''}
            items={iconCombo}
            widthClass="w-44"
            onChange={(v) => patch({ icon: v || undefined } as Partial<EffectDef>)}
            fallbackDisplay={isIconPath ? e.icon : undefined}
            searchPlaceholder={t('pp.powerSearch')}
            allowRaw
            rawLabel={(raw) => t('pp.useRaw', { v: raw })}
          />
        </label>
        {isIconPath && iconUrl && (
          <img src={iconUrl} alt="" className="h-6 w-6 rounded align-middle" />
        )}
        <label className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => iconFileRef.current?.click()}
            className="whitespace-nowrap rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
          >
            {t('pp.iconUpload')}
          </button>
          <input
            ref={iconFileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(ev) => { const f = ev.target.files?.[0]; if (f) void onIconFile(f); ev.target.value = ''; }}
          />
        </label>
      </div>
      </Disclosure>
      <Disclosure title={t('pp.delayedBuffText')} effectField="buff_description" storageKey={sectionKey + '.text'}>
        <div className="flex items-center justify-between gap-2">
          <Segmented value={buffLanguage} onChange={setBuffLanguage} options={[
            { v: 'zhs', label: t('pp.delayedBuffZh') }, { v: 'eng', label: t('pp.delayedBuffEn') },
          ]} />
          <button type="button" className="rounded border border-white/15 px-2 py-1 text-xs text-slate-200 hover:bg-white/10"
            onClick={() => { const text = composeDelayedBuffText(e); patch({ buff_name: text.name, buff_description: text.description } as Partial<EffectDef>); }}>
            {t('pp.delayedGenerateBuff')}
          </button>
        </div>
        {[buffLanguage].map(language => (
          <div key={language} className="space-y-1">
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-14 shrink-0">{t('pp.locName')}</span>
              <input data-effect-field="buff_name" className={inputCls} placeholder={t('pp.delayedBuffName')}
                value={e.buff_name?.[language] ?? ''}
                onChange={ev => patch({ buff_name: { eng: '', zhs: '', ...e.buff_name, [language]: ev.target.value } } as Partial<EffectDef>)} />
            </label>
            <textarea aria-label={`${language} ${t('pp.delayedBuffDescription')}`} className={inputCls + ' min-h-16 resize-y text-xs'}
              placeholder={t('pp.delayedBuffDescription')} value={e.buff_description?.[language] ?? ''}
              onChange={ev => patch({ buff_description: { eng: '', zhs: '', ...e.buff_description, [language]: ev.target.value } } as Partial<EffectDef>)} />
          </div>
        ))}
        <Disclosure title={t('ui.help')} storageKey={sectionKey + '.text-help'}><p className="whitespace-pre-line text-[11px] text-slate-500">{t('pp.delayedBuffHint')}</p></Disclosure>
      </Disclosure>
      <Disclosure title={<>{t('ui.nestedEffects')} <span className="ml-1 text-slate-500">{innerList.length}</span></>}
        effectField="effects" storageKey={sectionKey + '.effects'} defaultOpen>
        <div className="space-y-1.5">
          {innerList.length === 0 && (
            <div className="py-1 text-center text-[10px] text-slate-600">{t('pp.delayedEmpty')}</div>
          )}
          {innerList.map((inner, j) => (
            <Disclosure key={j} field={path && `${path}.effects.${j}`} storageKey={sectionKey + `.inner.${j}.${inner.kind}`} defaultOpen={innerList.length === 1}
              title={<>{pick(EFFECT_META[inner.kind]?.label ?? { zh: inner.kind, en: inner.kind }, lang)} <span className="ml-2 text-slate-500">{'amount' in inner ? inner.amount : ''}</span></>}
              actions={<button aria-label={t('pp.removeEffect')} onClick={() => removeInner(j)} className="rounded px-1.5 text-rose-400/80 hover:bg-rose-500/20">✕</button>}>
              <div className="flex flex-wrap items-center gap-2">
              {inner.kind !== 'custom' && inner.kind !== 'delayed' && 'amount' in inner && (
                <>
                  <NumInput
                    width="w-16"
                    value={(inner as { amount: number }).amount}
                    onCommit={(n) => setInner(j, { amount: n ?? 0 } as Partial<EffectDef>)}
                  />
                  <label className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500">{t('pp.upgradeDelta')}</span>
                    <NumInput width="w-16" value={'upgrade_amount' in inner ? inner.upgrade_amount ?? 0 : 0}
                      onCommit={(n) => setInner(j, { upgrade_amount: n ?? 0 } as Partial<EffectDef>)} />
                  </label>
                </>
              )}
              {inner.kind === 'power' && (
                <>
                  <Combobox
                    field="power"
                    value={(inner as { power: string }).power}
                    items={powerCombo}
                    onChange={(v) => setInner(j, { power: v } as Partial<EffectDef>)}
                    fallbackDisplay={(inner as { power: string }).power}
                    searchPlaceholder={t('pp.powerSearch')}
                    allowRaw
                    rawLabel={(raw) => t('pp.useRaw', { v: raw })}
                  />
                  <HookTargetSelect
                    value={(inner as { target?: string }).target ?? 'random_enemy'}
                    onChange={(v) => setInner(j, { target: v } as Partial<EffectDef>)}
                    width="w-32"
                  />
                </>
              )}
              {inner.kind === 'orb' && (
                <select
                  aria-label={t('pp.orbType')}
                  className={selectCls + ' w-24'}
                  value={inner.orb ?? 'random'}
                  onChange={(ev) => setInner(j, { orb: ev.target.value } as Partial<EffectDef>)}
                >
                  {ORB_OPTIONS.map((o) => <option key={o.v} value={o.v}>{pick(o.label, lang)}</option>)}
                </select>
              )}
              {inner.kind === 'damage' && (
                <HookTargetSelect
                  value={(inner as { target?: string }).target ?? 'random_enemy'}
                  onChange={(v) => setInner(j, { target: v } as Partial<EffectDef>)}
                  width="w-32"
                />
              )}
              {inner.kind === 'vfx' && (
                <Combobox
                  field="vfx"
                  value={(inner as { vfx: string }).vfx}
                  items={vfxCombo}
                  onChange={(v) => setInner(j, { vfx: v } as Partial<EffectDef>)}
                  fallbackDisplay={(inner as { vfx: string }).vfx}
                  searchPlaceholder={t('pp.vfxSearch')}
                  allowRaw
                  rawLabel={(raw) => t('pp.useRaw', { v: raw })}
                />
              )}
              </div>
            </Disclosure>
          ))}
        </div>
        <Disclosure title={t('ui.addEffect')} storageKey={sectionKey + '.add'} defaultOpen={innerList.length === 0}>
        <div className="flex flex-wrap gap-1">
          {DELAYED_INNER_KINDS.map((k) => (
            <button
              key={k}
              onClick={() => addInner(k)}
              className="whitespace-nowrap rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-300 transition hover:border-amber-400/50 hover:text-amber-300"
            >
              + {pick(EFFECT_META[k].label, lang)}
            </button>
          ))}
        </div>
        </Disclosure>
      </Disclosure>
      <Disclosure title={t('ui.help')} storageKey={sectionKey + '.help'}><p className="text-[11px] text-slate-500">{t('pp.delayedCountHint')}</p></Disclosure>
    </div>
  );
}

/** 自定义效果编辑器：handler（目录下拉：内置/mod 注册 + 自由输入）+ 可选数值/目标
 *  + params JSON + 处理器模板/真实示例。选中内置处理器且 params 为空时预填起始模板。 */
export function CustomEffectBody({ e, patch, hookCtx, scope }: {
  e: CustomDef; patch: RowPatch; hookCtx: boolean; scope?: string;
}) {
  const t = useT();
  const lang = useLang();
  const runtime = useRuntimeCatalog();
  const handlerCombo = useMemo(() => buildHandlerCombo(lang, runtime), [lang, runtime]);
  const registered = useMemo(
    () => new Set(handlerCombo.map((i) => i.value.toLowerCase())),
    [handlerCombo],
  );
  const descriptor = runtime?.custom_effects?.find(h => h.name === e.handler);
  const unregistered = !!e.handler && !registered.has(e.handler.toLowerCase());

  const pickHandler = (name: string) => {
    if (!e.params && starterParamsFor(name)) {
      patch({ handler: name, params: starterParamsFor(name) } as Partial<EffectDef>);
      return;
    }
    const definition = runtime?.custom_effects?.find(h => h.name === name);
    const defaults = Object.fromEntries((definition?.parameters ?? []).filter(p => p.default != null).map(p => [p.name, p.default]));
    patch({ handler: name, ...(Object.keys(defaults).length ? { params: { ...defaults, ...e.params } } : {}) } as Partial<EffectDef>);
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.handler')}</span>
        <Combobox
          field="handler"
          value={e.handler}
          items={handlerCombo}
          onChange={pickHandler}
          fallbackDisplay={e.handler}
          searchPlaceholder={t('pp.handlerPh')}
          allowRaw
          rawLabel={(raw) => t('pp.useRaw', { v: raw })}
        />
        {unregistered && (
          <span className="text-[10px] text-rose-400/80">
            {t('pp.handlerUnregistered')}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.amount')}</span>
        <input
          type="number"
          className={inputCls + ' w-24'}
          value={e.amount ?? ''}
          onChange={(ev) => {
            const v = ev.target.value === '' ? undefined : Number(ev.target.value);
            patch({ amount: v } as Partial<EffectDef>);
          }}
        />
      </div>
      {hookCtx && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.targetLabel')}</span>
          <HookTargetSelect
            value={e.target ?? 'random_enemy'}
            onChange={(v) => patch({ target: v } as Partial<EffectDef>)}
          />
        </div>
      )}
      {descriptor?.desc_zh && <p className="text-xs text-slate-500">{lang === 'en' ? descriptor.desc_en || descriptor.desc_zh : descriptor.desc_zh}</p>}
      {!!descriptor?.parameters?.length && <EffectParameterFields parameters={descriptor.parameters} value={e} patch={patch} />}
      {descriptor?.required_character && <p className="text-[11px] text-amber-300">{lang === 'en' ? 'Requires the source character.' : '仅适用于来源角色。'}</p>}
      <Disclosure title={t('pp.params')} effectField="params" storageKey={`custom.${scope}.params`}>
        <ParamsEditor
          value={e.params}
          onChange={(v) => patch({ params: v } as Partial<EffectDef>)}
        />
      </Disclosure>
      <Disclosure title={t('pp.tplSummary')} storageKey={`custom.${scope}.template`}>
        <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-slate-400">{`// 独立 mod 引用 SpireForgeRuntime.dll，初始化时注册：
SpireForge.Api.SfEffects.Register("${e.handler || 'my_effect'}", async ctx =>
{
    // ctx.Card / ctx.Effect.Amount / ctx.Target / ctx.Choice / ctx.Play
    await MegaCrit.Sts2.Core.Commands.CreatureCmd.Damage(
        ctx.Choice!, ctx.Target!, ctx.Effect.Amount,
        MegaCrit.Sts2.Core.ValueProps.ValueProp.Move, ctx.Card, ctx.Play);
});
// 卡牌 JSON 即可用 {"kind":"${e.handler || 'my_effect'}", "amount": 5} 调用`}</pre>
      </Disclosure>
      <Disclosure title={t('pp.exampleSummary')} storageKey={`custom.${scope}.example`}>
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
      </Disclosure>
    </div>
  );
}

/** 标准效果（delayed/custom 以外全部）：数值/力量/生成/召唤/目标/不受 buff/升级增量 */
export function StandardEffectBody({ e, patch, updateCard, isPlay, hookCtx, upgrades, powerCombo, vfxCombo, hitVfxCombo, sfxCombo, monsterCombo, spawnCombo, scope }: {
  e: EffectDef;
  patch: RowPatch;
  updateCard: (patch: Partial<CardDef>) => void;
  isPlay: boolean;
  hookCtx: boolean;
  upgrades: UpgradeDef;
  powerCombo: ComboItem[];
  vfxCombo: ComboItem[];
  hitVfxCombo: ComboItem[];
  sfxCombo: ComboItem[];
  monsterCombo: ComboItem[];
  spawnCombo: ComboItem[];
  scope?: string;
}) {
  const t = useT();
  const lang = useLang();
  const u = upgrades;

  return (
    <div className="mt-2 space-y-2">
      {e.kind !== 'vfx' && (
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.amount')}</span>
        <NumInput
          value={(e as { amount: number }).amount}
          onCommit={(n) => { if (n != null) patch({ amount: n } as Partial<EffectDef>); }}
        />
        {e.kind === 'power' && (
          <>
            <span className="whitespace-nowrap text-xs text-slate-400">{t('pp.powerLabel')}</span>
            <Combobox
              field="power"
              value={(e as { power: string }).power}
              items={powerCombo}
              onChange={(v) => patch({ power: v } as Partial<EffectDef>)}
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
              field="card_entry"
              value={(e as { card_entry: string }).card_entry}
              items={spawnCombo}
              onChange={(v) => patch({ card_entry: v } as Partial<EffectDef>)}
              fallbackDisplay={(e as { card_entry: string }).card_entry}
              searchPlaceholder={t('pp.cardSearch')}
              allowRaw
              rawLabel={(raw) => t('pp.useRaw', { v: raw })}
            />
            <select
              className={selectCls + ' w-24'}
              value={(e as { pile?: string }).pile ?? 'draw'}
              onChange={(ev) => patch({ pile: ev.target.value } as Partial<EffectDef>)}
            >
              <option value="draw">{lang === 'en' ? 'Draw pile' : '抽牌堆'}</option>
              <option value="hand">{lang === 'en' ? 'Hand' : '手牌'}</option>
              <option value="discard">{lang === 'en' ? 'Discard pile' : '弃牌堆'}</option>
            </select>
          </>
        )}
        {e.kind === 'orb' && (
          <>
            <span className="whitespace-nowrap text-xs text-slate-400">{t('pp.orbType')}</span>
            <select
              className={selectCls + ' w-24'}
              value={(e as { orb?: string }).orb ?? 'random'}
              onChange={(ev) => patch({ orb: ev.target.value } as Partial<EffectDef>)}
            >
              {ORB_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>{pick(o.label, lang)}</option>
              ))}
            </select>
          </>
        )}
        {e.kind === 'summon' && (() => {
          const me = e as { monster: string; hp?: number };
          return (
            <>
              <span className="whitespace-nowrap text-xs text-slate-400">{t('pp.monster')}</span>
              <Combobox
                field="monster"
                value={me.monster}
                items={monsterCombo}
                onChange={(v) => patch({ monster: v } as Partial<EffectDef>)}
                fallbackDisplay={me.monster}
                searchPlaceholder={t('pp.monsterSearch')}
                allowRaw
                rawLabel={(raw) => t('pp.useRaw', { v: raw })}
              />
              <span className="whitespace-nowrap text-xs text-slate-400">{t('pp.summonHp')}</span>
              <NumInput
                width="w-20"
                allowEmpty
                value={me.hp}
                onCommit={(n) => patch({ hp: n } as Partial<EffectDef>)}
              />
            </>
          );
        })()}
        {('props' in e) && (
          <label className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-slate-400">
            <input
              type="checkbox"
              checked={(e as { props: string[] }).props.includes('Unpowered')}
              onChange={(ev) => {
                const props = (e as { props: string[] }).props.filter((p) => p !== 'Unpowered');
                if (ev.target.checked) props.push('Unpowered');
                patch({ props } as Partial<EffectDef>);
              }}
            />
            {t('pp.unpowered')}
          </label>
        )}
      </div>
      )}
      {e.kind === 'vfx' && (() => {
        const vf = e as { vfx: string; target?: string; sfx?: string; source?: string };
        const src = vf.source ?? '';
        const srcIsMonster = src !== '' && src !== 'self' && src !== 'target';
        // 标签与控件包成不可拆分的单元，flex-wrap 只在单元之间换行（标签不与控件分离）
        const unit = 'flex min-w-0 items-center gap-2';
        return (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <label className={unit}>
                <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.vfxLabel')}</span>
                <Combobox
                  field="vfx"
                  value={vf.vfx}
                  items={vfxCombo}
                  onChange={(v) => patch({ vfx: v } as Partial<EffectDef>)}
                  fallbackDisplay={vf.vfx}
                  searchPlaceholder={t('pp.vfxSearch')}
                  allowRaw
                  rawLabel={(raw) => t('pp.useRaw', { v: raw })}
                />
              </label>
              <label className={unit}>
                <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.targetLabel')}</span>
                <select
                  className={selectCls + ' w-40'}
                  value={vf.target ?? 'random_enemy'}
                  onChange={(ev) => patch({ target: ev.target.value } as Partial<EffectDef>)}
                >
                  <option value="random_enemy">{t('pp.vfxTargetRandom')}</option>
                  <option value="all_enemies">{t('pp.vfxTargetAll')}</option>
                  <option value="self">{t('pp.targetSelf')}</option>
                  <option value="side_enemy">{t('pp.vfxTargetSideEnemy')}</option>
                  <option value="side_player">{t('pp.vfxTargetSidePlayer')}</option>
                  <option value="screen">{t('pp.vfxTargetScreen')}</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <label className={unit}>
                <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.vfxSource')}</span>
                <select
                  className={selectCls + ' w-40'}
                  value={srcIsMonster ? '__monster' : (src || 'target')}
                  onChange={(ev) => {
                    const v = ev.target.value;
                    if (v === '__monster') {
                      // 「指定怪物」只是 UI 态（source 需存怪物名）：首次选中落默认怪，
                      // 让怪物下拉出现；已在怪物态则不动，避免把已填的名字抹掉
                      if (!srcIsMonster) patch({ source: 'DampCultist' } as Partial<EffectDef>);
                      return;
                    }
                    patch({ source: v === 'target' ? undefined : v } as Partial<EffectDef>);
                  }}
                >
                  <option value="target">{t('pp.vfxSourceTarget')}</option>
                  <option value="self">{t('pp.vfxSourceSelf')}</option>
                  <option value="__monster">{t('pp.vfxSourceMonster')}</option>
                </select>
              </label>
              {srcIsMonster && (
                <label className={unit}>
                  <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.monster')}</span>
                  <Combobox
                    value={src}
                    items={monsterCombo}
                    onChange={(v) => patch({ source: v } as Partial<EffectDef>)}
                    fallbackDisplay={src}
                    searchPlaceholder={t('pp.monsterSearch')}
                    allowRaw
                    rawLabel={(raw) => t('pp.useRaw', { v: raw })}
                  />
                </label>
              )}
              <label className={unit}>
                <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.sfxLabel')}</span>
                <Combobox
                  value={vf.sfx ?? ''}
                  items={sfxCombo}
                  onChange={(v) => patch({ sfx: v || undefined } as Partial<EffectDef>)}
                  fallbackDisplay={vf.sfx ?? ''}
                  searchPlaceholder={t('pp.sfxSearch')}
                  allowRaw
                  rawLabel={(raw) => t('pp.useRaw', { v: raw })}
                />
              </label>
            </div>
          </div>
        );
      })()}
      {e.kind === 'damage' && (
        <Disclosure title={t('ui.attack')} storageKey={`standard.${scope}.attack`}>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {isPlay && (
              <label className="flex items-center gap-2">
                <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.targetLabel')}</span>
                <select
                  className={selectCls + ' w-36'}
                  value={(e as { target?: string }).target ?? ''}
                  onChange={(ev) => patch({ target: ev.target.value || undefined } as Partial<EffectDef>)}
                >
                  <option value="">{t('pp.damageTargetDefault')}</option>
                  <option value="self">{t('pp.targetSelf')}</option>
                  <option value="random_enemy">{t('pp.vfxTargetRandom')}</option>
                  <option value="all_enemies">{t('pp.targetAllEnemies')}</option>
                </select>
              </label>
            )}
            <label className="flex min-w-0 items-center gap-2">
              <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.hitVfx')}</span>
              <Combobox
                value={(e as { vfx?: string }).vfx ?? ''}
                items={hitVfxCombo}
                onChange={(v) => patch({ vfx: v || undefined } as Partial<EffectDef>)}
                fallbackDisplay={(e as { vfx?: string }).vfx ?? ''}
                searchPlaceholder={t('pp.vfxSearch')}
                allowRaw
                rawLabel={(raw) => t('pp.useRaw', { v: raw })}
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.hitCount')}</span>
              <NumInput
                width="w-16"
                value={(e as { hit_count?: number }).hit_count ?? 1}
                onCommit={(n) => patch({ hit_count: (n ?? 1) > 1 ? Math.round(n!) : undefined } as Partial<EffectDef>)}
              />
            </label>
            <label className="flex min-w-0 items-center gap-2">
              <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.hitSfx')}</span>
              <Combobox
                value={(e as { sfx?: string }).sfx ?? ''}
                items={sfxCombo}
                onChange={(v) => patch({ sfx: v || undefined } as Partial<EffectDef>)}
                fallbackDisplay={(e as { sfx?: string }).sfx ?? ''}
                searchPlaceholder={t('pp.sfxSearch')}
                allowRaw
                rawLabel={(raw) => t('pp.useRaw', { v: raw })}
              />
            </label>
          </div>
        </Disclosure>
      )}
      {e.kind === 'power' && !hookCtx && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.targetLabel')}</span>
          <select
            className={selectCls + ' w-40'}
            value={(e as { target?: string }).target ?? ''}
            onChange={(ev) => patch({ target: ev.target.value || undefined } as Partial<EffectDef>)}
          >
            <option value="">{t('pp.playTargetDefault')}</option>
            <option value="self">{t('pp.targetSelf')}</option>
            <option value="random_enemy">{t('pp.vfxTargetRandom')}</option>
            <option value="all_enemies">{t('pp.targetAllEnemies')}</option>
          </select>
        </div>
      )}
      {hookCtx && (e.kind === 'damage' || e.kind === 'power') && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-400">{t('pp.targetLabel')}</span>
          <HookTargetSelect
            value={(e as { target?: string }).target ?? 'random_enemy'}
            onChange={(v) => patch({ target: v } as Partial<EffectDef>)}
          />
        </div>
      )}
      {isPlay && AMOUNT_KINDS.includes(e.kind) && (
        <Disclosure title={t('ui.upgrade')} storageKey={`standard.${scope}.upgrade`} effectField="upgrade_amount">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-14 shrink-0 whitespace-nowrap text-xs text-slate-500">{t('pp.upgradeDelta')}</span>
          <NumInput
            value={(e as { upgrade_amount?: number }).upgrade_amount
              ?? (LEGACY_UPGRADE[e.kind] != null ? u?.[LEGACY_UPGRADE[e.kind]!] ?? 0 : 0)}
            onCommit={(n) => {
              // 增量写在本效果上（升级时对绑定变量 UpgradeValueBy）；
              // 旧五通道种类同时清零通道值，避免两处来源互相覆盖
              if (n == null) return;
              patch({ upgrade_amount: n } as Partial<EffectDef>);
              const lk = LEGACY_UPGRADE[e.kind];
              if (lk && (u?.[lk] ?? 0) !== 0) updateCard({ upgrades: { ...u, [lk]: 0 } });
            }}
          />
        </div>
        </Disclosure>
      )}
    </div>
  );
}
