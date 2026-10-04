import { useEffect, useState } from 'react';
import { api, pickDirectory, pickUploaderExe } from '../lib/tauri';
import { useStore } from '../lib/store';
import { useT } from '../lib/i18n';
import { grantEntry } from '../lib/types';

function SectionTitle({ text }: { text: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-wider text-slate-500">
      <span className="whitespace-nowrap">{text}</span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}

/** 发布面板：导出卡包 / 一键安装到游戏 / Steam 工坊发布。
 *  常用路径（装进游戏试玩）在最上面；工坊发布整块折叠，避免一打开就是满屏表单。 */
export default function PublishPanel({ onClose }: { onClose: () => void }) {
  const { meta, cards, settings, showToast, refreshSettings, persistAll, updateMeta, reloadMeta } = useStore();
  const t = useT();
  const [version, setVersion] = useState(meta?.last_version ?? '0.1.0');
  const [runtimeDep, setRuntimeDep] = useState(meta?.runtime_workshop_id?.toString() ?? '');
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>('');
  const [visibility, setVisibility] = useState('private');
  const [changeNote, setChangeNote] = useState('');
  const [workspace, setWorkspace] = useState('');

  const runtimeDepId = /^\d+$/.test(runtimeDep.trim()) ? Number(runtimeDep.trim()) : null;

  // Esc 关闭
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // 打开面板：先落盘未保存修改，再跑发布预检；同时自动释放内置 ModUploader
  useEffect(() => {
    (async () => {
      try {
        await persistAll();
        setIssues(await api.validateProject());
      } catch { /* 预检失败不阻塞面板 */ }
      api.ensureBundledUploader().then(() => refreshSettings()).catch(() => undefined);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doInstall = async () => {
    setBusy(true);
    setLog('');
    try {
      await persistAll();
      const r = await api.installToGame(version);
      await reloadMeta();
      setLog(t('pub.installedTo', { dir: r.dir }));
      showToast(r.game_running ? t('pub.installRestart') : t('pub.installOk'));
    } catch (e) {
      setLog(t('pub.installFailed', { e: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const doExport = async () => {
    const out = await pickDirectory();
    if (!out) return;
    setBusy(true);
    try {
      await persistAll();
      const dir = await api.buildPack(out, version);
      await reloadMeta();
      setLog(t('pub.exportedTo', { dir }));
      showToast(t('pub.exportOk'));
    } catch (e) {
      setLog(t('pub.exportFailed', { e: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const doPrepareWorkshop = async () => {
    const out = await pickDirectory();
    if (!out) return;
    setBusy(true);
    try {
      await persistAll();
      // Runtime 依赖 id 持久化进项目（workshop.json dependencies 从 meta 读取）
      if (meta && meta.runtime_workshop_id !== runtimeDepId) {
        await updateMeta({ runtime_workshop_id: runtimeDepId });
      }
      const ws = await api.prepareWorkshop(out, version, visibility, changeNote);
      await reloadMeta();
      setWorkspace(ws);
      setLog(t('pub.wsGenerated', {
        ws,
        next: settings.uploader_path ? t('pub.wsNextReady') : t('pub.wsNextConfig'),
      }));
      showToast(t('pub.wsOk'));
    } catch (e) {
      setLog(t('pub.wsFailed', { e: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const doUpload = async () => {
    if (!workspace) {
      setLog(t('pub.wsNeed'));
      return;
    }
    setBusy(true);
    try {
      const out = await api.publishWorkshop(workspace);
      await reloadMeta();
      setLog(t('pub.uploaded', { out }));
      showToast(t('pub.uploadDone'));
    } catch (e) {
      setLog(t('pub.uploadFailed', { e: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const pickUploader = async () => {
    const path = await pickUploaderExe();
    if (!path) return;
    await api.setUploaderPath(path);
    await refreshSettings();
    showToast(t('pub.uploaderSaved'));
  };

  /** 「添加至卡组」：整包登记进 Runtime 拿卡清单，游戏内即时入组（战斗中额外塞手牌） */
  const doGrantAll = async () => {
    if (!meta) return;
    try {
      await persistAll();
      const entries = [...new Set(cards.map((c) => grantEntry(c, meta.pack_id)))];
      const r = await api.queueCardGrant(entries);
      showToast(t('pv.grantQueued', { total: r.total, added: r.added }));
    } catch (e) {
      const msg = String(e);
      const ni = msg.indexOf('CARD_NOT_INSTALLED:');
      const di = msg.indexOf('GAME_MOD_DISABLED:');
      const nd = msg.indexOf('GAME_MOD_NOT_DETECTED:');
      showToast(
        msg.includes('GAME_NOT_RUNNING') ? t('pv.grantNoGame')
        : di >= 0 ? t('pv.grantModDisabled', { v: msg.slice(di + 'GAME_MOD_DISABLED:'.length) })
        : nd >= 0 ? t('pv.grantModNotDetected', { v: msg.slice(nd + 'GAME_MOD_NOT_DETECTED:'.length) })
        : ni >= 0 ? t('pv.grantNotInstalled', { v: msg.slice(ni + 'CARD_NOT_INSTALLED:'.length) })
        : t('pv.grantFailed', { e: msg }),
      );
    }
  };

  const inputCls =
    'w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-amber-400/60';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[88vh] w-[600px] overflow-y-auto rounded-2xl border border-white/10 bg-[#14141c] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-slate-100">{t('pub.title')}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {meta?.pack_id} · {t('pub.cards', { n: cards.length })} ·{' '}
              {t('pub.workshopId', { id: meta?.workshop_id ?? t('pub.unpublished') })}
            </div>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-slate-500 hover:bg-white/10 hover:text-slate-200">
            ✕
          </button>
        </div>

        {issues.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="mb-1 text-xs font-semibold text-amber-300">{t('pub.issues', { n: issues.length })}</div>
            <ul className="list-inside list-disc space-y-0.5 text-[11px] leading-relaxed text-amber-200/80">
              {issues.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}

        {/* ---- 本地使用：最常用，放最上面 ---- */}
        <SectionTitle text={t('pub.local')} />
        <div className="mb-4">
          <label className="mb-2 flex flex-wrap items-center gap-3">
            <span className="shrink-0 whitespace-nowrap text-xs font-medium text-slate-400">{t('pub.version')}</span>
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className={inputCls + ' w-32'}
            />
            <span className="text-[11px] text-slate-600">
              {t('pub.gameDirLine', {
                state: settings.game_dir ? t('pub.gameReady') : t('pub.gameNotSet'),
                up: settings.uploader_path ? t('pub.gameReady') : t('pub.upExtracting'),
              })}
            </span>
          </label>
          <button
            onClick={doInstall}
            disabled={busy || !settings.game_dir || cards.length === 0}
            className="w-full whitespace-nowrap rounded-lg bg-amber-500/90 py-2.5 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-40"
          >
            {t('pub.install')}
          </button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={doGrantAll}
              disabled={busy || cards.length === 0}
              className="whitespace-nowrap rounded-lg border border-emerald-400/30 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-40"
            >
              {t('pub.grantAll')}
            </button>
            <button
              onClick={doExport}
              disabled={busy || cards.length === 0}
              className="whitespace-nowrap rounded-lg border border-white/15 bg-white/[0.04] py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/30 disabled:opacity-40"
            >
              {t('pub.exportPack')}
            </button>
          </div>
        </div>

        {/* ---- Steam 工坊：折叠，避免干扰只想本地试玩的用户 ---- */}
        <details className="mb-1 rounded-lg border border-white/10 bg-black/20 open:bg-black/30">
          <summary className="cursor-pointer select-none px-3 py-2.5 text-xs font-semibold text-sky-200 hover:text-sky-100">
            {t('pub.workshop')}{meta?.workshop_id ? t('pub.publishedTag', { id: meta.workshop_id }) : ''}
          </summary>
          <div className="space-y-3 px-3 pb-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">
                {t('pub.runtimeDep')}
              </span>
              <input
                value={runtimeDep}
                onChange={(e) => setRuntimeDep(e.target.value.replace(/\D/g, ''))}
                placeholder={t('pub.runtimeDepPh')}
                className={inputCls + ' font-mono'}
              />
              {!runtimeDepId && (
                <span className="mt-1 block text-[11px] text-amber-400/80">
                  {t('pub.runtimeDepWarn')}
                </span>
              )}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">{t('pub.visibility')}</span>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  className={inputCls}
                >
                  <option value="private">{t('pub.visPrivate')}</option>
                  <option value="public">{t('pub.visPublic')}</option>
                  <option value="unlisted">{t('pub.visUnlisted')}</option>
                  <option value="friends_only">{t('pub.visFriends')}</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">{t('pub.changeNote')}</span>
                <input
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  placeholder={t('pub.changeNotePh')}
                  className={inputCls}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={doPrepareWorkshop}
                disabled={busy || cards.length === 0}
                className="whitespace-nowrap rounded-lg border border-white/15 bg-white/[0.04] py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/30 disabled:opacity-40"
              >
                {t('pub.prepare')}
              </button>
              <button
                onClick={doUpload}
                disabled={busy || !workspace || !settings.uploader_path}
                className="whitespace-nowrap rounded-lg border border-sky-400/30 bg-sky-500/10 py-2.5 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20 disabled:opacity-40"
              >
                {t('pub.upload')}
              </button>
            </div>
            <div className="text-[11px] leading-relaxed text-slate-500">
              {t('pub.uploaderLine', {
                up: settings.uploader_path ? t('pub.uploaderReady') : t('pub.upExtracting'),
              })}
              <button onClick={pickUploader} className="ml-2 text-amber-400/80 underline hover:text-amber-300">
                {t('pub.useExternal')}
              </button>
              <br />
              {t('pub.workshopNote')}
            </div>
          </div>
        </details>

        {log && (
          <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed text-emerald-300/90">
            {log}
          </pre>
        )}
      </div>
    </div>
  );
}
