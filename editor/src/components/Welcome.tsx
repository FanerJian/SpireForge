import { useEffect, useState } from 'react';
import { api, pickDirectory } from '../lib/tauri';
import { useStore } from '../lib/store';

// 与后端 project::validate_pack_id 一致：字母开头，字母/数字/下划线，2–64 位
const PACK_ID_RE = /^[A-Za-z][A-Za-z0-9_]{1,63}$/;

export default function Welcome() {
  const { newProject, openProject, settings, refreshSettings } = useStore();
  const [mode, setMode] = useState<'none' | 'create'>('none');
  const [packId, setPackId] = useState('MyPack');
  const [name, setName] = useState('我的卡包');
  const [author, setAuthor] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [gameDirHint, setGameDirHint] = useState(settings.game_dir ? '' : '未配置游戏目录');
  const packIdOk = PACK_ID_RE.test(packId.trim());

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
        } catch {
          /* 检测到但校验失败：保留手动配置路径 */
        }
      }
    })();
  }, []);

  const detectGame = async () => {
    const found = await api.detectGameDir();
    if (found) {
      await api.setGameDir(found);
      await refreshSettings();
      setGameDirHint('');
    } else {
      const dir = await pickDirectory();
      if (dir) {
        try {
          await api.setGameDir(dir);
          await refreshSettings();
          setGameDirHint('');
        } catch (e) {
          setGameDirHint(String(e));
        }
      } else {
        setGameDirHint('未找到，请手动选择游戏根目录');
      }
    }
  };

  const doCreate = async () => {
    const dir = await pickDirectory();
    if (!dir) return;
    setBusy(true);
    try {
      await newProject(dir, packId.trim(), name.trim(), author.trim());
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
      alert('打开项目失败：' + String(e));
    } finally {
      setBusy(false);
    }
  };

  /** 创建内置示例卡包并直接打开（新人推荐路径） */
  const doDemo = async () => {
    const dir = await pickDirectory();
    if (!dir) return;
    setDemoBusy(true);
    try {
      await api.createDemoProject(dir);
      await openProject(dir);
    } catch (e) {
      alert('创建示例卡包失败：' + String(e));
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-b from-[#12121c] to-[#0a0a10]">
      <div className="w-[440px] rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl">
        <div className="mb-1 text-2xl font-black tracking-wide text-amber-300">SpireForge 尖塔锻炉</div>
        <div className="mb-3 text-sm text-slate-500">杀戮尖塔 2 · 现代化卡牌编辑器</div>
        <div className="mb-5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-slate-500">
          三步上手：① 新建卡包项目 → ② 「+ 新卡牌」挑个模板改数值 →
          ③ 顶栏「发布 / 安装」一键装进游戏。想改原版卡就点「原版卡」。
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
            {gameDirHint || `游戏目录已就绪`}
            {!gameDirHint && <div className="mt-0.5 font-mono text-[10px] text-emerald-500/70">{settings.game_dir}</div>}
          </span>
          <span className="text-xs opacity-70">{gameDirHint ? '点击配置' : '点击重新检测'}</span>
        </button>

        {mode === 'none' ? (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full rounded-lg bg-amber-500/90 py-3 text-sm font-bold text-black transition hover:bg-amber-400"
            >
              新建卡包项目
            </button>
            <button
              onClick={doDemo}
              disabled={demoBusy}
              title="创建一个内置示例项目：打击/防御/力量/咔咔(自定义效果)/回响(钩子) 5 张演示卡 + 占位立绘"
              className="w-full rounded-lg border border-emerald-400/30 bg-emerald-500/10 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-40"
            >
              创建示例卡包（先看看能做什么）
            </button>
            <button
              onClick={doOpen}
              disabled={busy}
              className="w-full rounded-lg border border-white/15 bg-white/[0.04] py-3 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/[0.08]"
            >
              打开已有项目
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">包 id（工坊标识，驼峰）</span>
              <input value={packId} onChange={(e) => setPackId(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-400/60" />
              {!packIdOk && (
                <span className="mt-1 block text-[11px] text-rose-400/80">
                  需以字母开头，仅字母/数字/下划线（2–64 位）；它会成为目录名与工坊 id
                </span>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">项目名称</span>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-400/60" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">作者</span>
              <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Steam 昵称"
                className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-400/60" />
            </label>
            <button
              onClick={doCreate}
              disabled={busy || !packIdOk}
              className="w-full rounded-lg bg-amber-500/90 py-3 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-40"
            >
              选择目录并创建
            </button>
            <button onClick={() => setMode('none')} className="w-full text-xs text-slate-500 hover:text-slate-300">
              返回
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
