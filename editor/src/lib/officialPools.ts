import type { CustomPoolDef } from './types';

/** Official pools added after the legacy short keys. Display and persistence share this registry. */
const additions = [
  { typeName: 'MegaCrit.Sts2.Core.Models.CardPools.FoolCardPool', zh: '愚者', en: 'The Fool' },
] as const;

export const OFFICIAL_POOL_ADDITIONS = additions.map(pool => ({
  key: `mod:sts2:${pool.typeName}`,
  label: { zh: pool.zh, en: pool.en },
  definition: {
    key: `mod:sts2:${pool.typeName}`, label: pool.zh,
    mod_id: 'sts2', type_name: pool.typeName, workshop_id: null,
  } satisfies CustomPoolDef,
}));

export function officialPoolDefinition(key: string): CustomPoolDef | undefined {
  return OFFICIAL_POOL_ADDITIONS.find(pool => pool.key === key)?.definition;
}
