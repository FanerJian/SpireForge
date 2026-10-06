import { useEffect, useState } from 'react';
import { api, pickDirectory } from '../lib/tauri';
import { useStore } from '../lib/store';
import { setLang, useLang, useT } from '../lib/i18n';

// 与后端 project::validate_pack_id 一致：字母开头，字母/数字/下划线，2–64 位
const PACK_ID_RE = /^[A-Za-z][A-Za-z0-9_]{1,63}$/;

export default function Welcome() {
  const { newProject, openProject, settings, refreshSettings } = useStore();
  const t = useT();
  const lang = useLang();
  const [mode, setMode] = useState<'none' | 'create'>('none');
  const [packId, setPackId] = useState('MyPack');
  const [name, setName] = useState('我的卡包');
  const [author, setAuthor] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [projectsRoot, setProjectsRoot] = useState('');
  const [gameDirHint, setGameDirHint] = useState(settings.game_dir ? '' : t('w.gameMissing'));
  const [rtNote, setRtNote] = useState('');
  const packIdOk = PACK_ID_RE.test(packId.trim());

  /** 游戏目录就绪后自动安装内置 Runtime 前置 mod（幂等；结果以小字提示） */
  const ensureRt = async () => {
    try {
      const r = await api.ensureRuntime();
      setRtNote(
        r.action === 'installed' ? t('w.rtInstalled')
        : r.action === 'updated' ? t('w.rtUpdated', { v: r.version })
        : r.action === 'locked' ? t('w.rtLocked')
        : '',
      );
    } catch {
      setRtNote('');
    }
  };

  // 语言切换时同步默认提示
  useEffect(() => {
    setGameDirHint((h) => (h === '未配置游戏目录' || h === 'Game directory not set' ? t('w.gameMissing') : h === '' ? '' : h));
    if (!name || name === '我的卡包' || name === 'My Pack') setName(lang === 'en' ? 'My Pack' : '我的卡包');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // 进入创建表单时取一次默认项目根（展示去向；失败静默——创建时后端会兜底回落）
  useEffect(() => {
    if (mode !== 'create' || projectsRoot) return;
    api.defaultProjectsRoot().then(setProjectsRoot).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // 挂载时自动检测一次游戏目录（首次运行的关键体验）
  useEffect(() => {
    if (settings.game_dir) return;
    (async () => {
      const found = await api.detectGameDir();
      if (found) {
        try {
          await api.setGameDir(found);
          await refreshSettings();
          setGameDirHint('');
          await ensureRt();
        } catch {
          /* 检测到但校验失败：保留手动配置路径 */
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detectGame = async () => {
    const found = await api.detectGameDir();
    if (found) {
      await api.setGameDir(found);
      await refreshSettings();
      setGameDirHint('');
      await ensureRt();
    } else {
      const dir = await pickDirectory();
      if (dir) {
        try {
          await api.setGameDir(dir);
          await refreshSettings();
          setGameDirHint('');
          await ensureRt();
        } catch (e) {
          setGameDirHint(String(e));
        }
      } else {
        setGameDirHint(t('w.gameNotFound'));
      }
    }
  };

  const doCreate = async () => {
    setBusy(true);
    try {
      // 不再选目录：后端自动放到编辑器 projects\ 下（与包 id 同名，重名自动加后缀）
      await newProject(packId.trim(), name.trim(), author.trim());
    } catch (e) {
      alert(String(e));
    } finally {
      setBusy(false);
    }
  };

  const doOpen = async () => {
    const dir = await pickDirectory();
    if (!dir) return;
    setBusy(true);
    try {
      await openProject(dir);
    } catch (e) {
      alert(t('w.openFailed', { e: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  /** 创建内置示例卡包并直接打开（新人推荐路径）；目录同样自动分配 */
  const doDemo = async () => {
    setDemoBusy(true);
    try {
      const dir = await api.createDemoProject();
      await openProject(dir);
    } catch (e) {
      alert(t('w.demoFailed', { e: String(e) }));
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-b from-[#12121c] to-[#0a0a10]">
      <div className="w-[440px] rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-2xl font-black tracking-wide text-amber-300">SpireForge 尖塔锻炉</div>
            <div className="mt-1 text-sm text-slate-500">{t('w.subtitle')}</div>
          </div>
          <button
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            className="shrink-0 rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-sky-300/80 transition hover:border-sky-400/40 hover:text-sky-200"
          >
            {t('app.toEnglish')}
          </button>
        </div>
        <div className="mb-5 mt-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-slate-500">
          {t('w.guide')}
        </div>

        <button
          onClick={detectGame}
          className={`mb-6 flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition ${
            gameDirHint
              ? 'border-rose-500/40 bg-rose-500/10 text-rose-200 hover:border-rose-400'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          <span>
            {gameDirHint || t('w.gameOk')}
            {!gameDirHint && <div className="mt-0.5 font-mono text-[10px] text-emerald-500/70">{settings.game_dir}</div>}
            {!gameDirHint && rtNote && <div className="mt-0.5 text-[11px] text-emerald-300">{rtNote}</div>}
          </span>
          <span className="shrink-0 pl-2 text-xs opacity-70">{gameDirHint ? t('w.clickConfig') : t('w.clickRedetect')}</span>
        </button>

        {mode === 'none' ? (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full rounded-lg bg-amber-500/90 py-3 text-sm font-bold text-black transition hover:bg-amber-400"
            >
              {t('w.newProject')}
            </button>
            <button
              onClick={doDemo}
              disabled={demoBusy}
              className="w-full rounded-lg border border-emerald-400/30 bg-emerald-500/10 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-40"
            >
              {t('w.demo')}
            </button>
            <button
              onClick={doOpen}
              disabled={busy}
              className="w-full rounded-lg border border-white/15 bg-white/[0.04] py-3 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/[0.08]"
            >
              {t('w.openProject')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">{t('w.packId')}</span>
              <input value={packId} onChange={(e) => setPackId(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-400/60" />
              {!packIdOk && (
                <span className="mt-1 block text-[11px] text-rose-400/80">
                  {t('w.packIdErr')}
                </span>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">{t('w.name')}</span>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-400/60" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">{t('w.author')}</span>
              <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder={t('w.authorPh')}
                className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-400/60" />
            </label>
            <button
              onClick={doCreate}
              disabled={busy || !packIdOk}
              className="w-full rounded-lg bg-amber-500/90 py-3 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-40"
            >
              {t('w.create')}
            </button>
            {projectsRoot && (
              <div className="text-center text-[11px] leading-relaxed text-slate-500">
                {t('w.autoDir')}
                <div className="mt-0.5 truncate font-mono text-[10px] text-slate-600" title={projectsRoot}>
                  {projectsRoot}
                </div>
              </div>
            )}
            <button onClick={() => setMode('none')} className="w-full text-xs text-slate-500 hover:text-slate-300">
              {t('w.back')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
