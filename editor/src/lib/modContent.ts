import { newCard, type CardDef, type CardRarity, type CardType, type RuntimeCard, type TargetType } from './types';

/** Import model data, never invent an effect list from descriptive text. */
export function cardFromRuntime(source: RuntimeCard, existing: Set<string>, language: string, mode: 'override' | 'copy'): CardDef {
  if (!source.key || source.cost == null || !source.capabilities?.includes('override_fields'))
    throw new Error('目录缺少可编辑数据。请更新 Runtime 并重启游戏。');
  const base = source.entry.toLowerCase().replace(/[^a-z0-9_]+/g, '_');
  let id = base || 'imported_card';
  for (let n = 2; existing.has(id); n++) id = `${base}_${n}`;
  const card = newCard(id);
  card.format_version = 2;
  card.card_type = source.type as CardType;
  card.rarity = source.rarity as CardRarity;
  card.target = source.target as TargetType;
  card.cost = source.cost;
  card.costs_x = !!source.costs_x;
  card.keywords = source.keywords ?? [];
  card.pool = source.pool || 'colorless';
  const slot = language === 'eng' ? 'eng' : 'zhs';
  card.name = { zhs: '', eng: '', [slot]: source.title || source.entry };
  card.description = { zhs: '', eng: '', [slot]: mode === 'override' ? source.description || '' : '' };
  if (mode === 'override') {
    card.vanilla_id = source.entry;
    card.source_ref = source.key;
    card.override_fields = [];
    card.stats = { ...source.vars };
  }
  if (source.mod_id && source.mod_id !== 'sts2') card.content_dependencies = [{
    mod_id: source.mod_id, version: source.mod_version, workshop_id: source.workshop_id,
  }];
  return card;
}
