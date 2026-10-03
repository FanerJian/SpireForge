import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { CardDef, EditorSettings, ProjectMeta, VanillaCatalog } from './types';

export const api = {
  detectGameDir: () => invoke<string | null>('detect_game_dir'),
  getSettings: () => invoke<EditorSettings>('get_settings'),
  setGameDir: (dir: string) => invoke<void>('set_game_dir', { dir }),

  newProject: (path: string, packId: string, name: string, author: string) =>
    invoke<void>('new_project', { path, packId, name, author }),
  /** 创建内置示例卡包（5 张演示卡：基础模板/力量/自定义效果咔咔/钩子 + 占位立绘） */
  createDemoProject: (path: string) => invoke<void>('create_demo_project', { path }),
  openProject: (path: string) =>
    invoke<[ProjectMeta, CardDef[]]>('open_project', { path }),

  saveCard: (card: CardDef) => invoke<void>('save_card', { card }),
  renameCard: (oldId: string, newId: string) =>
    invoke<void>('rename_card', { oldId, newId }),
  deleteCard: (id: string) => invoke<void>('delete_card', { id }),
  updateProjectMeta: (meta: ProjectMeta) => invoke<void>('update_project_meta', { meta }),
  getProjectMeta: () => invoke<ProjectMeta>('get_project_meta'),

  savePortrait: (id: string, ext: string, bytes: Uint8Array) =>
    invoke<string>('save_portrait', { id, ext, bytes: Array.from(bytes) }),
  readPortrait: (rel: string) =>
    invoke<number[]>('read_portrait', { rel }),

  importCardJson: (raw: string) => invoke<CardDef>('import_card_json', { raw }),
  importCardAny: (raw: string) => invoke<ImportReport>('import_card_any', { raw }),
  importCardsAny: (raw: string) => invoke<ImportReport[]>('import_cards_any', { raw }),
  importPackPck: (path: string) => invoke<PckImportResult>('import_pack_pck', { path }),
  vanillaCatalog: () => invoke<VanillaCatalog>('vanilla_catalog'),
  ensureBundledUploader: () => invoke<string>('ensure_bundled_uploader'),
  exportCardJson: (id: string) => invoke<string>('export_card_json', { id }),
  writeFile: (path: string, content: string) => invoke<void>('write_text_file', { path, content }),
  buildPack: (outDir: string, version: string) => invoke<string>('build_pack', { outDir, version }),
  installToGame: (version: string) => invoke<InstallResult>('install_to_game', { version }),
  /** 登记到 Runtime 拿卡清单：游戏内即时把卡永久加入本局卡组（战斗中额外塞一张到手牌）。游戏未运行时拒绝（GAME_NOT_RUNNING），登记不跨会话 */
  queueCardGrant: (entries: string[]) => invoke<GrantQueueResult>('queue_card_grant', { entries }),
  /** 发布预检：Entry 冲突 / vanilla_id 重复 / 空 handler / 缺失文案等问题清单 */
  validateProject: () => invoke<string[]>('validate_project'),
  setUploaderPath: (path: string) => invoke<void>('set_uploader_path', { path }),
  prepareWorkshop: (outDir: string, version: string, visibility: string, changeNote: string) =>
    invoke<string>('prepare_workshop', { outDir, version, visibility, changeNote }),
  publishWorkshop: (workspace: string) => invoke<string>('publish_workshop', { workspace }),
};

/** 外来卡牌导入结果（含字段映射说明） */
export interface ImportReport {
  card: CardDef;
  notes: string[];
  native: boolean;
}

/** .pck 卡包导入结果 */
export interface PckImportResult {
  imported: ImportReport[];
  errors: string[];
}

/** 拿卡清单登记结果（消息由前端按界面语言拼） */
export interface GrantQueueResult {
  total: number;
  added: number;
}

/** 安装到游戏结果：game_running=true 时提示需重启游戏生效（PCK 启动时挂载） */
export interface InstallResult {
  dir: string;
  game_running: boolean;
}

export async function pickPckFile(): Promise<string | null> {
  const path = await open({
    filters: [{ name: '卡包 PCK', extensions: ['pck'] }],
    title: '导入卡包（.pck）',
  });
  return typeof path === 'string' ? path : null;
}

export async function pickJsonRaw(): Promise<string | null> {
  const path = await open({
    filters: [{ name: '卡牌 JSON', extensions: ['json', 'sts2pack', 'txt'] }],
    title: '导入卡牌（SpireForge / 第三方格式）',
  });
  if (typeof path !== 'string') return null;
  return invoke<string>('read_text_file', { path });
}

export async function pickUploaderExe(): Promise<string | null> {
  const path = await open({
    filters: [{ name: 'ModUploader', extensions: ['exe'] }],
    title: '选择官方 ModUploader.exe',
  });
  return typeof path === 'string' ? path : null;
}

export async function pickDirectory(): Promise<string | null> {
  const dir = await open({ directory: true, title: '选择文件夹' });
  return typeof dir === 'string' ? dir : null;
}

export async function pickJsonFile(): Promise<{ path: string; content: string } | null> {
  const path = await open({
    filters: [{ name: '卡牌 JSON', extensions: ['json'] }],
    title: '导入卡牌',
  });
  if (typeof path !== 'string') return null;
  // 通过导出接口读文件内容：走后端 open 文本
  const raw = await invoke<string>('read_text_file', { path });
  return { path, content: raw };
}

export async function pickSaveJsonFile(defaultName: string): Promise<string | null> {
  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: '卡牌 JSON', extensions: ['json'] }],
    title: '导出卡牌',
  });
  return typeof path === 'string' ? path : null;
}
