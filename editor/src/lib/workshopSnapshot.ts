import type { CardDef, ProjectMeta } from './types';

export function workshopSnapshot(projectRoot: string | null, meta: ProjectMeta | null, cards: CardDef[],
  version: string, visibility: string, changeNote: string, runtimeDependency: number | null): string {
  return JSON.stringify({ projectRoot, meta: meta && { ...meta, last_version: null }, cards,
    version, visibility, changeNote, runtimeDependency });
}
