import type { RuleStatus } from './rules';

export interface StatusDraft {
  readonly status: RuleStatus;
  readonly creating: boolean;
}

export interface StatusDraftSnapshot {
  readonly drafts: Readonly<Record<string, StatusDraft>>;
  readonly activeId: string | null;
}

export interface StatusDraftSession {
  getSnapshot(): StatusDraftSnapshot;
  subscribe(listener: () => void): () => void;
  open(status: RuleStatus, creating?: boolean): void;
  patch(id: string, patch: Partial<RuleStatus>): void;
  activate(id: string | null): void;
  discard(id: string): void;
  finishSave(id: string, savedStatus: RuleStatus): void;
}

const sessions = new Map<string, StatusDraftSession>();

/** Project sessions survive editor unmounts and retain stable external-store APIs. */
export function statusDraftSession(projectRoot: string): StatusDraftSession {
  const existing = sessions.get(projectRoot);
  if (existing) return existing;

  let snapshot: StatusDraftSnapshot = Object.freeze({ drafts: Object.freeze({}), activeId: null });
  const listeners = new Set<() => void>();
  const draftFor = (id: string): StatusDraft | undefined =>
    Object.prototype.hasOwnProperty.call(snapshot.drafts, id) ? snapshot.drafts[id] : undefined;
  const publish = (drafts: StatusDraftSnapshot['drafts'], activeId: string | null): void => {
    snapshot = Object.freeze({ drafts: Object.freeze(drafts), activeId });
    listeners.forEach(listener => listener());
  };
  const discard = (id: string): void => {
    if (!draftFor(id)) return;
    const drafts = { ...snapshot.drafts };
    delete drafts[id];
    publish(drafts, snapshot.activeId === id ? null : snapshot.activeId);
  };
  const session: StatusDraftSession = {
    getSnapshot: () => snapshot,
    subscribe: listener => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    open: (status, creating = false) => {
      if (draftFor(status.id)) {
        session.activate(status.id);
        return;
      }
      const draft = Object.freeze({ status: Object.freeze(structuredClone(status)), creating });
      publish({ ...snapshot.drafts, [status.id]: draft }, status.id);
    },
    patch: (id, patch) => {
      const draft = draftFor(id);
      if (!draft) return;
      // Shallow replacement keeps existing RuleNode references usable as UI keys.
      const status = Object.freeze({ ...draft.status, ...patch });
      publish({ ...snapshot.drafts, [id]: Object.freeze({ ...draft, status }) }, snapshot.activeId);
    },
    activate: id => {
      if (snapshot.activeId === id || (id !== null && !draftFor(id))) return;
      publish(snapshot.drafts, id);
    },
    discard,
    finishSave: (id, savedStatus) => {
      if (draftFor(id)?.status === savedStatus) discard(id);
    },
  };
  sessions.set(projectRoot, session);
  return session;
}
