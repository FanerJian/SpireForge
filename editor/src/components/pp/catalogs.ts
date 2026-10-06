// 目录数据访问层：原版卡目录 + Runtime 游戏内容目录（含 mod 内容）的
// 会话级缓存、hooks 与三个效果下拉（力量/怪物/生成卡牌）的数据构建。
// 原来散在 PropertyPanel/VanillaSection 两处各自维护缓存，现集中于此。
import { useEffect, useState } from 'react';
import { api } from '../../lib/tauri';
import type {
  CardDef, CardType, RuntimeCatalog, RuntimeCustomEffect, RuntimeMonster, RuntimePower,
  VanillaCatalog, VanillaEntry,
} from '../../lib/types';
import type { ComboItem } from '../Combobox';
import { MONSTERS } from '../../lib/monsters';
import { POWERS } from '../../lib/powers';
import { cardEntry } from '../../lib/entry';
import { TYPE_LABEL, pick, type Lang } from '../../lib/i18n';

// ---- 会话级缓存（整个应用只拉一次；读取失败不缓存，下次挂载重试）----

let vanillaCache: VanillaCatalog | null = null;
let runtimeCatalogCache: RuntimeCatalog | null = null;

/** 原版卡覆盖时的目录条目（原版描述/数值/关键词展示用） */
export function useVanillaEntry(vanillaId: string | null | undefined): VanillaEntry | null {
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

/** 原版卡牌目录（生成卡牌效果的可选项） */
export function useVanillaCatalog(): VanillaEntry[] {
  const [cards, setCards] = useState<VanillaEntry[]>(vanillaCache?.cards ?? []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!vanillaCache) vanillaCache = await api.vanillaCatalog();
        if (!cancelled) setCards(vanillaCache.cards);
      } catch {
        // 目录加载失败不阻断效果编辑
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return cards;
}

/** 游戏内容目录（mod buff 等的来源）：挂载时读缓存，窗口重新聚焦时重读——
 *  用户先开编辑器、后进游戏拿到新目录，切回来即可生效；读失败保持现状不闪空 */
export function useRuntimeCatalog(): RuntimeCatalog | null {
  const [catalog, setCatalog] = useState<RuntimeCatalog | null>(runtimeCatalogCache);
  useEffect(() => {
    let cancelled = false;
    const load = async (force: boolean) => {
      try {
        if (force || !runtimeCatalogCache) {
          runtimeCatalogCache = await api.readGameCatalog();
        }
        if (!cancelled) setCatalog(runtimeCatalogCache);
      } catch {
        // 未装 Runtime / 游戏没重开 / 文件损坏：静默降级为内置目录
      }
    };
    void load(false);
    const onFocus = () => void load(true);
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, []);
  return catalog;
}

// ---- mod 目录条目过滤（只保留内置目录没有的）----

export function modPowers(runtime: RuntimeCatalog | null): RuntimePower[] {
  if (!runtime) return [];
  const known = new Set(POWERS.map((p) => p.name.toLowerCase()));
  return runtime.powers.filter((p) => !known.has(p.name.toLowerCase()));
}

export function modMonsters(runtime: RuntimeCatalog | null): RuntimeMonster[] {
  if (!runtime) return [];
  const known = new Set(MONSTERS.map((m) => m.name.toLowerCase()));
  return runtime.monsters.filter((m) => !known.has(m.name.toLowerCase()));
}

// ---- 自定义效果处理器（SfEffects 注册表）----

/** Runtime 内置处理器兜底表：游戏目录缺失（未装 Runtime / Runtime<0.1.7 的旧导出）时，
 *  编辑器仍能列出这些无需写 mod 的内置自定义特效；目录可用时以目录为准（去重合并）。 */
export const BUILTIN_CUSTOM_HANDLERS: RuntimeCustomEffect[] = [
  {
    name: 'sf_repeat', source: 'SpireForgeRuntime',
    desc_zh: '把内嵌效果清单重复执行 N 次（数值框 = 次数）',
    desc_en: 'Repeat the inner effect list N times (amount = times)',
  },
  {
    name: 'sf_random', source: 'SpireForgeRuntime',
    desc_zh: '从内嵌效果清单随机执行 pick 条（默认 1 条，互不重复）',
    desc_en: 'Randomly run pick entry(ies) from the inner effect list (default 1)',
  },
  {
    name: 'sf_cond', source: 'SpireForgeRuntime',
    desc_zh: 'when 条件全部成立时执行内嵌效果清单（hp/手牌/敌人数）',
    desc_en: "Run the inner effect list when every 'when' condition holds (hp/hand/enemies)",
  },
  {
    name: 'demo_kaka', source: 'SpireForgeRuntime',
    desc_zh: '示例：召唤改名「咔咔」的邪教徒，自身获得 1 层仪式',
    desc_en: 'Demo: spawn a Cultist renamed Kaka, gain 1 Ritual',
  },
];

/** 选中内置处理器时给 params 框预填的起始模板（已有 params 不覆盖） */
export function starterParamsFor(handler: string): Record<string, unknown> | undefined {
  switch (handler) {
    case 'sf_repeat':
      return { effects: [{ kind: 'damage', amount: 5, props: ['Move'] }] };
    case 'sf_random':
      return { pick: 1, effects: [{ kind: 'block', amount: 5, props: ['Move'] }, { kind: 'draw', amount: 1 }] };
    case 'sf_cond':
      return { when: [{ hp_pct_below: 50 }], effects: [{ kind: 'block', amount: 6, props: ['Move'] }] };
    default:
      return undefined;
  }
}

/** 自定义效果处理器下拉：目录快照（内置 + mod 注册）优先，内置兜底表去重合并 */
export function buildHandlerCombo(lang: Lang, runtime: RuntimeCatalog | null): ComboItem[] {
  const items: ComboItem[] = [];
  const seen = new Set<string>();
  const push = (h: RuntimeCustomEffect, badge: string) => {
    if (!h.name || seen.has(h.name.toLowerCase())) return;
    seen.add(h.name.toLowerCase());
    items.push({
      value: h.name,
      primary: h.name,
      secondary: (lang === 'en' ? h.desc_en : h.desc_zh) || h.source,
      badge,
      badgeTone: badge === 'MOD' ? ('neutral' as const) : ('safe' as const),
      keywords: [h.name, h.source].filter(Boolean).join(' '),
    });
  };
  for (const h of runtime?.custom_effects ?? []) {
    push(h, h.source === 'SpireForgeRuntime' ? (lang === 'en' ? 'Built-in' : '内置') : 'MOD');
  }
  for (const h of BUILTIN_CUSTOM_HANDLERS) {
    push(h, lang === 'en' ? 'Built-in' : '内置');
  }
  return items;
}


/** 去掉官方描述里的 BBCode 着色标记（[gold]xx[/gold] → xx） */
export function stripBbcode(s: string): string {
  return s ? s.replace(/\[\/?[a-z_]+\]/gi, '') : '';
}

// ---- 下拉数据构建（纯函数；语言切换 / 目录更新时由 useMemo 重算）----

/** 力量下拉：中文界面只显示中文（英文界面只显示英文），搜索词两种语言都匹配 */
export function buildPowerCombo(lang: Lang, mods: RuntimePower[]): ComboItem[] {
  const items: ComboItem[] = POWERS.map((p) => ({
    value: p.name,
    primary: lang === 'en' ? p.en : p.zh,
    secondary: stripBbcode(lang === 'en' ? p.desc_en : p.desc),
    icon: p.icon || undefined,
    badge: p.debuff ? (lang === 'en' ? 'Debuff' : '减益') : undefined,
    badgeTone: p.debuff ? ('danger' as const) : undefined,
    keywords: lang === 'en' ? p.zh : p.en,
  }));
  for (const p of mods) {
    items.push({
      value: p.name,
      primary: p.title || p.name,
      secondary: stripBbcode(p.description) || p.entry,
      badge: p.type === 'debuff' ? (lang === 'en' ? 'Debuff' : '减益') : 'MOD',
      badgeTone: p.type === 'debuff' ? ('danger' as const) : ('neutral' as const),
      keywords: [p.name, p.entry, p.class_name, p.source].filter(Boolean).join(' '),
    });
  }
  return items;
}

/** 怪物下拉：类型徽章 + 原生生命；图标太大不打包，用徽章代替 */
export function buildMonsterCombo(lang: Lang, mods: RuntimeMonster[]): ComboItem[] {
  const items: ComboItem[] = MONSTERS.map((m) => ({
    value: m.name,
    primary: lang === 'en' ? m.en : m.zh,
    secondary: m.hp ? (lang === 'en' ? `HP ${m.hp}` : `生命 ${m.hp}`) : undefined,
    badge: m.type || undefined,
    badgeTone: (m.type === 'Boss' || m.type === 'Elite') ? ('danger' as const) : ('neutral' as const),
    keywords: lang === 'en' ? m.zh : m.en,
  }));
  for (const m of mods) {
    items.push({
      value: m.name,
      primary: m.title || m.name,
      secondary: m.hp ? (lang === 'en' ? `HP ${m.hp}` : `生命 ${m.hp}`) : m.entry,
      badge: 'MOD',
      badgeTone: 'neutral' as const,
      keywords: [m.name, m.entry, m.source].filter(Boolean).join(' '),
    });
  }
  return items;
}

/** 生成卡牌下拉：本项目卡优先，其后原版卡，最后游戏内导出卡（mod 卡等）按 Entry 去重追加；
 *  次要行显示 Entry（同名卡/变体靠它区分） */
export function buildSpawnCombo(args: {
  cards: CardDef[];
  excludeId: string;
  packId: string;
  vanilla: VanillaEntry[];
  runtime: RuntimeCatalog | null;
  lang: Lang;
}): ComboItem[] {
  const { cards, excludeId, packId, vanilla, runtime, lang } = args;
  const items: ComboItem[] = cards
    .filter((c) => c.id !== excludeId)
    .map((c) => {
      const entry = cardEntry(packId, c.id);
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
      badge: TYPE_LABEL[v.type as CardType] ? pick(TYPE_LABEL[v.type as CardType], lang) : v.type,
      badgeTone: 'neutral' as const,
      keywords: v.name_en,
    });
  }
  if (runtime) {
    const seen = new Set(items.map((i) => i.value.toUpperCase()));
    for (const c of runtime.cards) {
      if (seen.has(c.entry.toUpperCase())) continue;
      seen.add(c.entry.toUpperCase());
      const typeLabel = c.type ? c.type.charAt(0).toUpperCase() + c.type.slice(1) : '';
      items.push({
        value: c.entry,
        primary: c.title || c.entry,
        secondary: c.entry,
        badge: TYPE_LABEL[typeLabel as CardType] ? pick(TYPE_LABEL[typeLabel as CardType], lang) : (typeLabel || undefined),
        badgeTone: 'neutral' as const,
        keywords: [c.entry, c.source, c.rarity].filter(Boolean).join(' '),
      });
    }
  }
  return items;
}
