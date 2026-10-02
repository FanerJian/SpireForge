import { useEffect, useState } from 'react';
import { api, pickDirectory, pickUploaderExe } from '../lib/tauri';
import { useStore } from '../lib/store';

/** 发布面板：导出卡包 / 一键安装到游戏 / Steam 工坊发布 */
export default function PublishPanel({ onClose }: { onClose: () => void }) {
  const { meta, cards, settings, showToast, refreshSettings } = useStore();
  const [version, setVersion] = useState('0.1.0');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>('');
  const [visibility, setVisibility] = useState('private');
  const [changeNote, setChangeNote] = useState('');
  const [workspace, setWorkspace] = useState('');

  // 内置 ModUploader（v0.2.0，MIT）：首次打开发布面板时自动释放，无需用户下载
  useEffect(() => {
    api.ensureBundledUploader()
      .then(() => refreshSettings())
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doInstall = async () => {
    setBusy(true);
    setLog('');
    try {
      const dir = await api.installToGame(version);
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
      const dir = await api.buildPack(out, version);
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
      const ws = await api.prepareWorkshop(out, version, visibility, changeNote);
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
      setLog(`上传完成：\n${out}\n\n首次上传后 workspase 内会生成 mod_id.txt（工坊 id），\n后续更新直接重跑本流程即可（条目不变）。`);
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

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[88vh] w-[600px] overflow-y-auto rounded-2xl border border-white/10 bg-[#14141c] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-slate-100">发布卡包</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {meta?.pack_id} · {cards.length} 张卡
            </div>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-slate-500 hover:bg-white/10 hover:text-slate-200">
            ✕
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">版本号</span>
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-amber-400/60"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">工坊可见性</span>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-amber-400/60"
            >
              <option value="private">私有（仅自己，推荐先私测）</option>
              <option value="public">公开</option>
              <option value="unlisted">不列出（链接可见）</option>
              <option value="friends_only">仅好友</option>
            </select>
          </label>
        </div>

        <div className="mb-4 rounded-lg border border-white/10 bg-black/30 p-3 text-[11px] leading-relaxed text-slate-500">
          游戏目录：<span className="font-mono text-slate-400">{settings.game_dir || '未配置'}</span>
          <br />
          上传器：<span className="font-mono text-slate-400">
            {settings.uploader_path ? '内置 ModUploader（已就绪）' : '释放中…'}
          </span>
          <button onClick={pickUploader} className="ml-2 text-amber-400/80 underline hover:text-amber-300">
            换用外部 ModUploader.exe
          </button>
          <br />
          <span className="text-slate-600">上传时需 Steam 客户端在线；更新已发布条目会复用 workspace 内 mod_id.txt</span>
        </div>

        <div className="space-y-2">
          <button
            onClick={doInstall}
            disabled={busy || !settings.game_dir || cards.length === 0}
            className="w-full rounded-lg bg-amber-500/90 py-2.5 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-40"
          >
            一键安装到游戏
          </button>
          <button
            onClick={doExport}
            disabled={busy || cards.length === 0}
            className="w-full rounded-lg border border-white/15 bg-white/[0.04] py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/30 disabled:opacity-40"
          >
            导出卡包（.pck + 清单）
          </button>
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
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">变更说明（更新时填）</span>
            <input
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="例如：新增 3 张卡牌，平衡性调整"
              className="w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-amber-400/60"
            />
          </label>
        </div>

        {log && (
          <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed text-emerald-300/90">
            {log}
          </pre>
        )}
      </div>
    </div>
  );
}
