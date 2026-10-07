// 文案页签：卡牌名称/描述/风味的双语文本编辑 + 占位符/BBCode 快捷插入 + 一键生成描述。
import { useState } from 'react';
import { useStore } from '../../lib/store';
import { Disclosure, Segmented, inputCls } from '../ui';
import { useT } from '../../lib/i18n';
import type { CardDef } from '../../lib/types';
import { useGenDescription } from './useDescription';

export default function LocTab({ card }: { card: CardDef }) {
  const { updateCard, fieldFocus } = useStore();
  const t = useT();
  const genDesc = useGenDescription();
  const [loc, setLoc] = useState<'zhs' | 'eng'>(() => fieldFocus?.field.endsWith('.eng') ? 'eng' : 'zhs');
  const insert = (s: string) => {
    const cur = card.description[loc] ?? '';
    updateCard({ description: { ...card.description, [loc]: cur + s } });
  };
  return (
    <div className="space-y-3">
      <Segmented
        value={loc}
        options={[{ v: 'zhs' as const, label: '中文' }, { v: 'eng' as const, label: 'English' }]}
        onChange={setLoc}
      />
      <Disclosure title={t('pp.locName')} storageKey="text.name" defaultOpen field={`name.${loc}`}>
        <input aria-label={t('pp.locName')} className={inputCls} value={card.name[loc]}
          onChange={(e) => updateCard({ name: { ...card.name, [loc]: e.target.value } })} />
      </Disclosure>
      <Disclosure title={t('pp.locDesc')} storageKey="text.description" defaultOpen field={`description.${loc}`}>
        <div className="mb-1.5 flex justify-end">
          <button
            onClick={() => genDesc(card)}
            className="whitespace-nowrap text-[11px] text-sky-300/80 underline hover:text-sky-200"
          >
            {t('pp.genDesc')}
          </button>
        </div>
        <textarea
          aria-label={t('pp.locDesc')}
          className={inputCls + ' h-28 resize-none font-mono'}
          value={card.description[loc]}
          onChange={(e) => updateCard({ description: { ...card.description, [loc]: e.target.value } })}
        />
      </Disclosure>
      <Disclosure title={t('ui.format')} storageKey="text.format">
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
      </Disclosure>
      <Disclosure title={t('pp.locFlavor')} storageKey="text.flavor" field={`flavor.${loc}`}>
        <input aria-label={t('pp.locFlavor')} className={inputCls} value={card.flavor[loc]}
          onChange={(e) => updateCard({ flavor: { ...card.flavor, [loc]: e.target.value } })} />
      </Disclosure>
    </div>
  );
}
