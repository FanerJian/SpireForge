import { useEffect, useState } from 'react';
import { api, pickDirectory, pickUploaderExe } from '../lib/tauri';
import { useStore } from '../lib/store';
import { cardEntry } from '../lib/types';

function SectionTitle({ text }: { text: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-wider text-slate-500">
      <span>{text}</span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}

/** 发布面板：导出卡包 / 一键安装到游戏 / Steam 工坊发布。
 *  常用路径（装进游戏试玩）在最上面；工坊发布整块折叠，避免一打开就是满屏表单。 */
export default function PublishPanel({ onClose }: { onClose: () => void }) {
  const { meta, cards, settings, showToast, refreshSettings, persistAll, updateMeta, reloadMeta } = useStore();
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
      const dir = await api.installToGame(version);
      await reloadMeta();
      setLog(`已安装到：${dir}\n\n启动游戏即可在卡牌图鉴（无色卡池）中看到本卡包卡牌。\n提示：首次使用需确保 SpireForge Runtime 已随编辑器安装（见文档）。`);
      showToast('安装成功');
    } catch (e) {
      setLog(`安装失败：${String(e)}`);
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
      setLog(`卡包已导出到：${dir}`);
      showToast('导出成功');
    } catch (e) {
      setLog(`导出失败：${String(e)}`);
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
      setLog(`上传工作区已生成：${ws}\n\n内容：content/（卡包文件）+ workshop.json + image.png\n` +
        `下一步：${settings.uploader_path ? '点击「上传到工坊」' : '在下方设置 ModUploader.exe 路径后上传'}\n\n` +
        `注意：工坊 tags 上传后无法修改；预览图需 <1MB（已自动校验）。`);
      showToast('工作区已生成');
    } catch (e) {
      setLog(`生成失败：${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const doUpload = async () => {
    if (!workspace) {
      setLog('请先生成上传工作区');
      return;
    }
    setBusy(true);
    try {
      const out = await api.publishWorkshop(workspace);
      await reloadMeta();
      setLog(`上传完成：\n${out}\n\n首次上传后 workspace 内会生成 mod_id.txt（工坊 id），已自动记入项目——\n后续更新换任何导出目录都会复用同一工坊条目。`);
      showToast('上传完成');
    } catch (e) {
      setLog(`上传失败：${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const pickUploader = async () => {
    const path = await pickUploaderExe();
    if (!path) return;
    await api.setUploaderPath(path);
    await refreshSettings();
    showToast('上传器路径已保存');
  };

  /** 「在游戏中获得卡」：整包登记进 Runtime 拿卡清单，下一场战斗开始时发放 */
  const doGrantAll = async () => {
    if (!meta) return;
    try {
      await persistAll();
      const entries = cards.map((c) => cardEntry(meta.pack_id, c.id));
      const msg = await api.queueCardGrant(entries);
      showToast(`${msg}；下一场战斗开始时加入抽牌堆（游戏未启动则启动后生效）`);
    } catch (e) {
      showToast('登记失败：' + String(e));
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
            <div className="text-lg font-bold text-slate-100">发布卡包</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {meta?.pack_id} · {cards.length} 张卡 · 工坊 id {meta?.workshop_id ?? '未发布'}
            </div>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-slate-500 hover:bg-white/10 hover:text-slate-200">
            ✕
          </button>
        </div>

        {issues.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="mb-1 text-xs font-semibold text-amber-300">发布预检发现 {issues.length} 个问题（不阻断，建议先处理）：</div>
            <ul className="list-inside list-disc space-y-0.5 text-[11px] leading-relaxed text-amber-200/80">
              {issues.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}

        {/* ---- 本地使用：最常用，放最上面 ---- */}
        <SectionTitle text="本地使用" />
        <div className="mb-4">
          <label className="mb-2 flex items-center gap-3">
            <span className="shrink-0 text-xs font-medium text-slate-400">版本号</span>
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className={inputCls + ' w-32'}
            />
            <span className="text-[11px] text-slate-600">
              游戏目录{settings.game_dir ? '已就绪' : '未配置'} · 上传器{settings.uploader_path ? '已就绪' : '释放中…'}
            </span>
          </label>
          <button
            onClick={doInstall}
            disabled={busy || !settings.game_dir || cards.length === 0}
            className="w-full rounded-lg bg-amber-500/90 py-2.5 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-40"
          >
            一键安装到游戏
          </button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={doGrantAll}
              disabled={busy || cards.length === 0}
              title="把本卡包全部卡登记进 Runtime 拿卡清单：下一场战斗开始时自动加入抽牌堆（游戏未启动则启动后生效）"
              className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-40"
            >
              在游戏中获得全部卡（测试）
            </button>
            <button
              onClick={doExport}
              disabled={busy || cards.length === 0}
              className="rounded-lg border border-white/15 bg-white/[0.04] py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/30 disabled:opacity-40"
            >
              导出卡包（.pck + 清单）
            </button>
          </div>
        </div>

        {/* ---- Steam 工坊：折叠，避免干扰只想本地试玩的用户 ---- */}
        <details className="mb-1 rounded-lg border border-white/10 bg-black/20 open:bg-black/30">
          <summary className="cursor-pointer select-none px-3 py-2.5 text-xs font-semibold text-sky-200 hover:text-sky-100">
            Steam 工坊发布（点开展开）{meta?.workshop_id ? ` · 已发布 #${meta.workshop_id}` : ''}
          </summary>
          <div className="space-y-3 px-3 pb-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">
                SpireForge Runtime 工坊 id（写入依赖，玩家订阅时自动安装）
              </span>
              <input
                value={runtimeDep}
                onChange={(e) => setRuntimeDep(e.target.value.replace(/\D/g, ''))}
                placeholder="发布 Runtime 后，把其工坊数字 id 填到这里"
                className={inputCls + ' font-mono'}
              />
              {!runtimeDepId && (
                <span className="mt-1 block text-[11px] text-amber-400/80">
                  未设置：订阅玩家不会自动安装 SpireForge Runtime，卡包将无法加载。
                  建议先发布 Runtime mod，再把它的工坊 id 填入。
                </span>
              )}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">可见性</span>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  className={inputCls}
                >
                  <option value="private">私有（仅自己，推荐先私测）</option>
                  <option value="public">公开</option>
                  <option value="unlisted">不列出（链接可见）</option>
                  <option value="friends_only">仅好友</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">变更说明（更新时填）</span>
                <input
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  placeholder="例如：新增 3 张卡牌，平衡性调整"
                  className={inputCls}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={doPrepareWorkshop}
                disabled={busy || cards.length === 0}
                className="rounded-lg border border-white/15 bg-white/[0.04] py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/30 disabled:opacity-40"
              >
                生成工坊工作区
              </button>
              <button
                onClick={doUpload}
                disabled={busy || !workspace || !settings.uploader_path}
                className="rounded-lg border border-sky-400/30 bg-sky-500/10 py-2.5 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20 disabled:opacity-40"
              >
                上传到 Steam 工坊
              </button>
            </div>
            <div className="text-[11px] leading-relaxed text-slate-500">
              上传器：<span className="font-mono text-slate-400">
                {settings.uploader_path ? '内置 ModUploader（已就绪）' : '释放中…'}
              </span>
              <button onClick={pickUploader} className="ml-2 text-amber-400/80 underline hover:text-amber-300">
                换用外部 ModUploader.exe
              </button>
              <br />
              需 Steam 客户端在线；工坊 id 已持久化到项目，换导出目录复用同一条目；tags 上传后无法修改。
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
