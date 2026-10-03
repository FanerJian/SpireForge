import React from 'react';
import type { CardDef } from '../lib/types';
import { cardEntry, HOOK_FIELDS, pascalToSnake } from '../lib/types';
import { HOOK_LABEL, pick, RARITY_LABEL, TYPE_LABEL, useLang, useT } from '../lib/i18n';

/** 卡牌类型 → 框体配色 */
const TYPE_STYLE: Record<string, { frame: string; glow: string; typeColor: string; orb: string }> = {
  Attack: { frame: '#7a2b23', glow: '#c0392b', typeColor: '#ff6b5e', orb: '#e74c3c' },
  Skill: { frame: '#1d5c46', glow: '#27ae60', typeColor: '#5cffb1', orb: '#2ecc71' },
  Power: { frame: '#1f3f6e', glow: '#2980d9', typeColor: '#6db9ff', orb: '#3498db' },
  Status: { frame: '#3d3d55', glow: '#7f7fa6', typeColor: '#c8c8e6', orb: '#95a5a6' },
  Curse: { frame: '#40264e', glow: '#8e44ad', typeColor: '#d2a6f2', orb: '#9b59b6' },
  Quest: { frame: '#5c4a1d', glow: '#c9a227', typeColor: '#ffd868', orb: '#f1c40f' },
};

const RARITY_GLOW: Record<string, string> = {
  Basic: '#cfd8dc', Common: '#b0bec5', Uncommon: '#58d6c9', Rare: '#f5c542',
  Ancient: '#ff9ff3', Event: '#a29bfe', Token: '#95a5a6', Status: '#95a5a6',
  Curse: '#9b59b6', Quest: '#f1c40f',
};

/** 官方规格：普通卡 250×190（本组件 2.2 倍渲染保清晰）；先古卡 = 满幅立绘 250×351 */
const W = 550;
const H_NORMAL = 418;
const H_ANCIENT = Math.round((W * 852) / 606); // 先古原图 606×852 ≈ 250×351，等比 → 550×773

type Node = React.ReactNode;

const TAG_CLASS: Record<string, string> = {
  gold: 'text-amber-300 font-semibold',
  red: 'text-red-400 font-semibold',
  green: 'text-emerald-400 font-semibold',
  blue: 'text-sky-400 font-semibold',
  unplayable: 'text-slate-400',
};

/** 手写标记解析（无正则）：
 *  - {Damage} / {Damage:diff()} → 动态变量（高亮下划线）
 *  - [gold]…[/gold] 等着色标签（支持嵌套，按标签名配对） */
function parseRich(text: string, vars: Record<string, string>, keyBase = 0): Node[] {
  const out: Node[] = [];
  let key = keyBase;
  let plain = '';
  let i = 0;
  const flush = () => {
    if (plain) {
      out.push(plain);
      plain = '';
    }
  };
  while (i < text.length) {
    const ch = text[i];
    if (ch === '{') {
      const close = text.indexOf('}', i + 1);
      if (close > i) {
        const inner = text.slice(i + 1, close);
        const colon = inner.indexOf(':');
        const name = colon === -1 ? inner : inner.slice(0, colon);
        if (/^\w+$/.test(name)) {
          flush();
          out.push(
            <span
              key={key++}
              className="font-bold text-rose-300 underline decoration-rose-400/60 decoration-2 underline-offset-2"
            >
              {vars[name] ?? `{${name}}`}
            </span>,
          );
          i = close + 1;
          continue;
        }
      }
    } else if (ch === '[') {
      const close = text.indexOf(']', i + 1);
      if (close > i) {
        const inner = text.slice(i + 1, close);
        const isClose = inner.startsWith('/');
        const tag = isClose ? inner.slice(1) : inner;
        if (/^[a-z]+$/.test(tag)) {
          if (isClose) {
            // 无匹配的闭合标签：按原文输出
            plain += text.slice(i, close + 1);
            i = close + 1;
            continue;
          }
          const endTag = `[/${tag}]`;
          const end = text.indexOf(endTag, close + 1);
          if (end !== -1) {
            flush();
            out.push(
              <span key={key++} className={TAG_CLASS[tag] ?? ''}>
                {parseRich(text.slice(close + 1, end), vars, key * 100 + 7)}
              </span>,
            );
            i = end + endTag.length;
            continue;
          }
        }
      }
    }
    plain += ch;
    i += 1;
  }
  flush();
  return out;
}

export default function CardPreview({ card, packId, portraitUrl, upgraded }: {
  card: CardDef;
  packId: string;
  portraitUrl?: string | null;
  upgraded?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const style = TYPE_STYLE[card.card_type] ?? TYPE_STYLE.Skill;
  const vars: Record<string, string> = {};
  for (const e of card.effects) {
    const u = card.upgrades;
    if (e.kind === 'damage') vars.Damage = upgraded && u.damage ? `${e.amount}+${u.damage}` : String(e.amount);
    if (e.kind === 'block') vars.Block = upgraded && u.block ? `${e.amount}+${u.block}` : String(e.amount);
    if (e.kind === 'draw') vars.Cards = String(e.amount);
    if (e.kind === 'energy') vars.Energy = String(e.amount);
    if (e.kind === 'heal') vars.Heal = upgraded && u.heal ? `${e.amount}+${u.heal}` : String(e.amount);
  }
  const entry = cardEntry(packId, card.id);
  // 预览语言跟随界面语言（与游戏内所选语言一致时的显示效果）
  const name = (lang === 'en' ? card.name.eng || card.name.zhs : card.name.zhs || card.name.eng) || entry;
  const desc = (lang === 'en' ? card.description.eng || card.description.zhs : card.description.zhs || card.description.eng) || '';
  const cost = card.costs_x ? 'X' : card.cost < 0 ? '—' : String(card.cost);
  const costInvalid = !card.costs_x && card.cost < -1;
  const idBad = !card.id || pascalToSnake(card.id) === '';
  // 先古卡：整卡满幅立绘（游戏在其上叠加名称/描述），框体更修长
  const ancient = card.rarity === 'Ancient';
  const H = ancient ? H_ANCIENT : H_NORMAL;

  return (
    <div className="relative select-none" style={{ width: W, height: H }}>
      {/* 外发光（稀有度） */}
      <div
        className="absolute -inset-2 rounded-[28px] opacity-40 blur-lg"
        style={{ background: `radial-gradient(ellipse at center, ${RARITY_GLOW[card.rarity] ?? '#666'}55, transparent 70%)` }}
      />
      {/* 框体 */}
      <div
        className="absolute inset-0 rounded-2xl border-[3px]"
        style={{
          background: `linear-gradient(160deg, ${style.frame} 0%, #14141c 55%, #101018 100%)`,
          borderColor: style.glow,
          boxShadow: `0 0 24px ${style.glow}55, inset 0 0 32px #00000088`,
        }}
      >
        {/* 立绘区：普通卡=上部横窗；先古卡=整卡满幅 */}
        <div
          className={
            ancient
              ? 'absolute inset-0 overflow-hidden rounded-t-2xl border-b border-black/60 bg-[#0b0b12]'
              : 'absolute left-4 right-4 top-4 h-[58%] overflow-hidden rounded-lg border border-black/60 bg-[#0b0b12]'
          }
        >
          {portraitUrl ? (
            <img src={portraitUrl} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-600">
              {card.portrait ? t('pp.portraitLoadFail') : t('pp.portraitEmpty')}
            </div>
          )}
          {ancient ? (
            <div className="absolute inset-0 bg-gradient-to-b from-[#14141c]/70 via-transparent to-[#14141c]/85" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-t from-[#14141c]/80 via-transparent to-transparent" />
          )}
        </div>

        {/* 费用球 */}
        <div
          className="absolute -left-2 -top-2 flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl font-black text-white"
          style={{
            background: `radial-gradient(circle at 35% 30%, ${style.orb}cc, ${style.orb} 45%, #1a1a1a 100%)`,
            borderColor: '#ffffff55',
            boxShadow: '0 2px 10px #000a',
          }}
        >
          {costInvalid ? '!' : cost}
        </div>

        {/* 名称 */}
        <div className="absolute left-16 right-3 top-3 truncate text-center text-[22px] font-bold tracking-wide text-amber-100"
          style={{ textShadow: '0 1px 4px #000c' }}>
          {name}
        </div>

        {/* 描述 */}
        <div className="absolute bottom-9 left-5 right-5 min-h-[64px] rounded-md border border-white/10 bg-black/55 px-3 py-2 text-center text-[17px] leading-relaxed text-slate-100">
          {parseRich(desc, vars)}
          {HOOK_FIELDS.some((f) => (card[f]?.length ?? 0) > 0) && (
            <div className="mt-1 flex flex-wrap justify-center gap-1">
              {HOOK_FIELDS.filter((f) => (card[f]?.length ?? 0) > 0).map((f) => (
                <span key={f} className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300/90">
                  {pick(HOOK_LABEL[f], lang)} ×{card[f]!.length}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 类型条 */}
        <div className="absolute bottom-2 left-0 right-0 whitespace-nowrap text-center text-[13px] font-semibold tracking-widest"
          style={{ color: style.typeColor }}>
          {pick(TYPE_LABEL[card.card_type] ?? TYPE_LABEL.Skill, lang)} · {pick(RARITY_LABEL[card.rarity] ?? RARITY_LABEL.Common, lang)}
        </div>
      </div>

      {/* id 角标 */}
      {idBad && (
        <div className="absolute -bottom-7 left-0 right-0 text-center font-mono text-xs text-rose-500">
          {t('pv.idInvalid')}
        </div>
      )}
    </div>
  );
}
