import { useSyncExternalStore } from 'react';

// ---- 界面语言（中/英切换）----
// 持久化在 localStorage；默认中文。字典 key 扁平化，值 = 双语对象；en 缺失时回退 zh。

export type Lang = 'zh' | 'en';

/** 双语文本 */
export interface L {
  zh: string;
  en: string;
}

const LANG_KEY = 'spireforge.lang';

let lang: Lang = localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'zh';
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return lang;
}

export function setLang(l: Lang): void {
  if (l === lang) return;
  lang = l;
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch { /* 隐私模式等存不进去就算了，本次会话仍生效 */ }
  listeners.forEach((f) => f());
}

function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** 当前语言下取双语对象的文本 */
export function pick(x: L, lg: Lang = lang): string {
  return x[lg] || x.zh;
}

function format(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  let out = text;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

/** 非 React 环境（store 等）取文案 */
export function tr(key: string, vars?: Record<string, string | number>): string {
  const s = STRINGS[key];
  return format(s ? (s[lang] ?? s.zh) : key, vars);
}

/** 组件内取文案：语言切换时触发重渲染 */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang);
}

export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const lg = useLang();
  return (key, vars) => {
    const s = STRINGS[key];
    return format(s ? (s[lg] ?? s.zh) : key, vars);
  };
}

// ---- 界面文案字典 ----

const STRINGS: Record<string, L> = {
  'ui.more': { zh: '更多', en: 'More' },
  'ui.help': { zh: '说明', en: 'Help' },
  'ui.expandAll': { zh: '全部展开', en: 'Expand all' },
  'ui.collapseAll': { zh: '全部收起', en: 'Collapse all' },
  'ui.times': { zh: '次', en: ' times' },
  'ui.addEffect': { zh: '添加效果', en: 'Add effect' },
  'ui.upgrade': { zh: '升级', en: 'Upgrade' },
  'ui.timing': { zh: '触发', en: 'Trigger' },
  'ui.nestedEffects': { zh: '内嵌效果', en: 'Nested effects' },
  'ui.attack': { zh: '攻击设置', en: 'Attack settings' },
  'ui.format': { zh: '格式', en: 'Formatting' },
  'ui.fileInfo': { zh: '文件信息', en: 'File info' },
  'ui.log': { zh: '日志', en: 'Log' },
  'ui.packInfo': { zh: '卡包信息', en: 'Pack info' },
  'ui.appInfo': { zh: '应用信息', en: 'App info' },
  'ui.reference': { zh: '原版信息', en: 'Vanilla info' },
  'ui.previewTools': { zh: '预览操作', en: 'Preview actions' },
  // 工具栏（App.tsx）
  'app.undo': { zh: '↶ 撤销', en: '↶ Undo' },
  'app.redo': { zh: '↷ 重做', en: '↷ Redo' },
  'app.saveDirty': { zh: '保存 ●（{n}）', en: 'Save ● ({n})' },
  'app.saved': { zh: '已保存', en: 'Saved' },
  'app.publish': { zh: '发布 / 安装', en: 'Publish / Install' },
  'app.settings': { zh: '项目设置', en: 'Project Settings' },
  'app.switchProject': { zh: '切换项目', en: 'Switch Project' },
  'app.toEnglish': { zh: 'EN', en: '中文' },

  // 预览区（App.tsx PreviewPane + CardPreview）
  'pv.upgraded': { zh: '预览升级数值', en: 'Preview upgraded values' },
  'pv.grant': { zh: '添加至卡组', en: 'Add to Deck' },
  'pv.grantQueued': { zh: '已登记 {total} 张（新增 {added}）', en: 'Queued {total} card(s) ({added} new)' },
  'pv.grantNoGame': { zh: '游戏未运行，请先启动游戏并进入一局', en: 'The game is not running — start it and enter a run first' },
  'pv.grantNotInstalled': { zh: '卡包「{v}」尚未安装，请先执行「发布 / 安装」', en: 'Pack "{v}" is not installed — run "Publish / Install" first' },
  'pv.grantModDisabled': { zh: '卡包「{v}」已被禁用，请在游戏「模组」列表中启用后重启游戏', en: 'Pack "{v}" is disabled — enable it in the game\'s Mods screen and restart' },
  'pv.grantModNotDetected': { zh: '游戏尚未识别卡包「{v}」，请重启游戏', en: 'Pack "{v}" is not detected yet — restart the game' },
  'pv.grantFailed': { zh: '登记失败：{e}', en: 'Failed to queue: {e}' },
  'pv.export': { zh: '导出 JSON', en: 'Export JSON' },
  'pv.exported': { zh: '已导出卡牌 JSON', en: 'Card JSON exported' },
  'pv.exportFailed': { zh: '导出失败：{e}', en: 'Export failed: {e}' },
  'pv.empty': { zh: '请选择或创建一张卡牌', en: 'Select or create a card to start editing' },
  'pv.entry': { zh: '游戏内 Entry', en: 'In-game Entry' },
  'pv.idInvalid': { zh: 'id 无效', en: 'invalid id' },

  // 欢迎页（Welcome.tsx）
  'w.subtitle': { zh: '杀戮尖塔 2 · 卡牌编辑器', en: 'Slay the Spire 2 · card editor' },
  'w.guide': { zh: '新建卡包 → 编辑卡牌 → 安装到游戏。', en: 'Create a pack → edit cards → install to game.' },
  'w.gameOk': { zh: '游戏目录已就绪', en: 'Game directory ready' },
  'w.rtInstalled': { zh: '已安装运行时前置 SpireForgeRuntime', en: 'Runtime mod (SpireForgeRuntime) installed' },
  'w.rtUpdated': { zh: 'SpireForgeRuntime 已更新至 {v}', en: 'Runtime mod updated to {v}' },
  'w.rtLocked': { zh: '游戏运行中，SpireForgeRuntime 将在下次启动时更新', en: 'Game is running; the runtime mod will update on next launch' },
  'w.gameMissing': { zh: '未配置游戏目录', en: 'Game directory not set' },
  'w.clickConfig': { zh: '点击配置', en: 'Configure' },
  'w.clickRedetect': { zh: '点击重新检测', en: 'Re-detect' },
  'w.gameNotFound': { zh: '未检测到游戏，请手动选择游戏目录', en: 'Not found — select the game root folder manually' },
  'w.newProject': { zh: '新建卡包', en: 'New pack' },
  'w.demo': { zh: '示例卡包', en: 'Sample pack' },
  'w.openProject': { zh: '从其他位置打开卡包', en: 'Open Pack from Another Location' },
  'w.packId': { zh: '包 id（工坊标识）', en: 'Pack id (Workshop id)' },
  'w.packIdErr': { zh: '以字母开头，仅限字母、数字、下划线，长度 2–64 位', en: 'Must start with a letter; letters/digits/underscore only (2–64 chars)' },
  'w.name': { zh: '项目名称', en: 'Project name' },
  'w.author': { zh: '作者', en: 'Author' },
  'w.authorPh': { zh: 'Steam 昵称', en: 'Steam nickname' },
  'w.create': { zh: '创建', en: 'Create' },
  'w.autoDir': { zh: '项目将创建至：', en: 'The project will be created in:' },
  'w.back': { zh: '返回', en: 'Back' },
  'w.demoFailed': { zh: '创建示例卡包失败：{e}', en: 'Failed to create the sample pack: {e}' },
  'w.openFailed': { zh: '打开项目失败：{e}', en: 'Failed to open project: {e}' },
  'projects.title': { zh: '我的卡包', en: 'My Packs' },
  'projects.subtitle': { zh: '选择卡包继续编辑。默认目录中的卡包会自动显示，其他位置的卡包打开后会保留记录。', en: 'Choose a pack to continue editing. Packs in the default folder appear automatically; packs opened elsewhere are remembered.' },
  'projects.refresh': { zh: '刷新', en: 'Refresh' },
  'projects.search': { zh: '搜索卡包名称、标识、作者或路径', en: 'Search pack name, ID, author or path' },
  'projects.loading': { zh: '正在读取卡包列表…', en: 'Loading packs…' },
  'projects.failed': { zh: '读取卡包列表失败：{e}', en: 'Could not load packs: {e}' },
  'projects.retry': { zh: '请点击刷新重试，也可从其他位置打开卡包。', en: 'Refresh to retry, or open a pack from another location.' },
  'projects.empty': { zh: '还没有卡包。可以新建卡包、创建示例，或从其他位置打开已有卡包。', en: 'No packs yet. Create a pack or a sample, or open an existing pack from another location.' },
  'projects.noMatch': { zh: '没有找到符合搜索条件的卡包，请调整搜索内容。', en: 'No matching packs. Try another search.' },
  'projects.cards': { zh: '{n} 张卡牌', en: '{n} cards' },
  'projects.recent': { zh: '最近打开', en: 'Recently opened' },
  'projects.lastOpened': { zh: '上次打开：{date}', en: 'Last opened: {date}' },
  'projects.modified': { zh: '信息更新：{date}', en: 'Metadata updated: {date}' },
  'projects.open': { zh: '打开', en: 'Open' },
  'projects.opening': { zh: '正在打开…', en: 'Opening…' },
  'projects.unavailable': { zh: '暂不可用', en: 'Unavailable' },
  'projects.root': { zh: '默认卡包目录', en: 'Default pack folder' },

  // 卡牌库（CardLibrary.tsx）
  'lib.title': { zh: '卡牌库', en: 'Cards' },
  'lib.count': { zh: '{n} 张', en: '{n}' },
  'lib.vanilla': { zh: '原版卡', en: 'Vanilla' },
  'lib.pack': { zh: '卡包', en: 'Pack' },
  'lib.import': { zh: '导入', en: 'Import' },
  'lib.search': { zh: '搜索名称 / id…', en: 'Search name / id…' },
  'lib.newCard': { zh: '+ 新卡牌', en: '+ New Card' },
  'lib.all': { zh: '全部', en: 'All' },
  'lib.emptyLine1': { zh: '尚无卡牌', en: 'No cards yet.' },
  'lib.emptyLine2': { zh: '可从下方模板新建，或改写原版卡', en: 'Create one from a template below, or override a vanilla card.' },
  'lib.vanillaCta': { zh: '改写原版卡', en: 'Override a vanilla card' },
  'lib.vanillaCtaSub': { zh: '从游戏 577 张卡中选取', en: 'Pick from the game\'s 577 cards' },
  'lib.noMatch': { zh: '没有符合筛选条件的卡牌', en: 'No cards match the filter' },
  'lib.tplTitle': { zh: '新建卡牌', en: 'New Card' },
  'lib.vanillaTag': { zh: '原版', en: 'vanilla' },
  'lib.imported': { zh: '已导入 {n} 张：{names}', en: 'Imported {n}: {names}' },
  'lib.importForeign': { zh: '\n\n{n} 张卡为外部格式，请核对字段：\n', en: '\n\n{n} card(s) in foreign formats — please check their fields:\n' },
  'lib.importNote': { zh: '导入说明：', en: 'Import notes:' },
  'lib.importFailed': { zh: '导入失败：{e}', en: 'Import failed: {e}' },
  'lib.pckImported': { zh: '已从卡包导入 {n} 张卡牌', en: 'Imported {n} cards from pack' },
  'lib.pckErrors': { zh: '，{n} 个文件失败', en: ', {n} file(s) failed' },
  'lib.pckErrorTitle': { zh: '部分文件导入失败：', en: 'Some files failed to import:' },

  // 属性面板（PropertyPanel.tsx）
  'pp.tabBasic': { zh: '基础', en: 'Basic' },
  'pp.tabEffects': { zh: '效果', en: 'Effects' },
  'pp.tabLook': { zh: '外观', en: 'Art' },
  'pp.tabLoc': { zh: '文本', en: 'Text' },
  'pp.copy': { zh: '复制', en: 'Duplicate' },
  'pp.delete': { zh: '删除', en: 'Delete' },
  'pp.deleteConfirm': { zh: '删除「{name}」？删除后可通过工具栏撤销，也可在「备份恢复」中恢复。', en: 'Delete "{name}"? You can undo this from the toolbar or restore it from Backups.' },
  'pp.deleteFailed': { zh: '删除失败：{e}', en: 'Delete failed: {e}' },
  'pp.deleted': { zh: '已删除', en: 'Deleted' },
  'pp.copied': { zh: '已复制', en: 'Duplicated' },
  'pp.pickFromLeft': { zh: '请从左侧选择卡牌', en: 'Select a card on the left' },
  'pp.vanillaCover': { zh: '覆盖原版卡', en: 'Override vanilla card' },
  'pp.vanillaActive': { zh: '覆盖原版卡 {id}', en: 'Overriding vanilla {id}' },
  'pp.vanillaCancel': { zh: '取消覆盖', en: 'Stop overriding' },
  'pp.vanillaEntryPh': { zh: '原版 Entry，如 BASH', en: 'Vanilla Entry, e.g. BASH' },
  'pp.statsCover': { zh: '数值覆盖', en: 'Stat overrides' },
  'pp.upgCover': { zh: '升级增量', en: 'Upgrade deltas' },
  'pp.addStat': { zh: '+ 数值', en: '+ Stat' },
  'pp.addDelta': { zh: '+ 升级增量', en: '+ Upgrade delta' },
  'pp.varPh': { zh: '变量名，如 Damage', en: 'Variable name, e.g. Damage' },
  'pp.vanillaInfo': { zh: '原版：{name}', en: 'Vanilla: {name}' },
  'pp.dirtyBadge': { zh: '待保存 {n}', en: '{n} unsaved' },
  'pp.prefill': { zh: '预填原版效果', en: 'Prefill effects' },
  'pp.prefillConfirm': { zh: '按原版数据预填 {n} 条效果？效果清单非空时将整体替换原版打出行为。', en: 'Prefill {n} effects from vanilla data? A non-empty effect list replaces the vanilla play behavior.' },
  'pp.prefillFail': { zh: '原版数据无法映射为效果清单，请手动编辑', en: 'Vanilla data can\'t be mapped to effects — edit manually' },
  'pp.upgradeSummary': { zh: '升级：{list}', en: 'Upgrades: {list}' },
  'pp.idLabel': { zh: '卡牌 ID', en: 'Card id' },
  'pp.idRenameConfirm': { zh: '将卡牌 id 从「{a}」改为「{b}」？游戏内 Entry 将随之变更，已发布的卡牌需重新发布。', en: 'Change card id from "{a}" to "{b}"? The in-game Entry changes; republish already released packs.' },
  'pp.renamed': { zh: '已改名', en: 'Renamed' },
  'pp.renameFailed': { zh: '改名失败：{e}', en: 'Rename failed: {e}' },
  'pp.poolLabel': { zh: '卡池', en: 'Pools' },
  'pp.typeLabel': { zh: '卡牌类型', en: 'Card Type' },
  'pp.rarityLabel': { zh: '稀有度', en: 'Rarity' },
  'pp.targetLabel': { zh: '目标', en: 'Target' },
  'pp.costLabel': { zh: '费用', en: 'Cost' },
  'pp.xCost': { zh: 'X 费', en: 'X-cost' },
  'upd.title': { zh: '发现新版本', en: 'Update available' },
  'upd.noNotes': { zh: '（无更新说明）', en: '(No release notes)' },
  'upd.downloading': { zh: '下载中 {p}%', en: 'Downloading {p}%' },
  'upd.applying': { zh: '正在替换程序文件…', en: 'Applying update…' },
  'upd.doneRestart': { zh: '更新完成，正在重启编辑器…', en: 'Update complete — restarting…' },
  'upd.doneManual': { zh: '更新完成，请重新打开编辑器。', en: 'Update complete — please reopen the editor.' },
  'upd.failed': { zh: '更新失败：{e}', en: 'Update failed: {e}' },
  'upd.skip': { zh: '跳过此版本', en: 'Skip this version' },
  'upd.releasePage': { zh: '去发布页', en: 'Release page' },
  'upd.btn': { zh: '立即更新', en: 'Update now' },
  'upd.retry': { zh: '重试', en: 'Retry' },
  'upd.close': { zh: '关闭', en: 'Close' },
  'upd.check': { zh: '检查更新', en: 'Check for updates' },
  'upd.found': { zh: '发现新版本 v{v}', en: 'Update v{v} available' },
  'upd.upToDate': { zh: '已是最新版本', en: 'Already up to date' },
  'upd.checkFailed': { zh: '检查更新失败', en: 'Update check failed' },
  'pp.keywordLabel': { zh: '关键词', en: 'Keywords' },
  'pp.showLib': { zh: '显示于图鉴', en: 'Show in library' },
  'pp.portraitLabel': { zh: '立绘', en: 'Art' },
  'pp.portraitUnset': { zh: '未设置', en: 'not set' },
  'pp.changeImage': { zh: '更换图片', en: 'Replace image' },
  'pp.uploadImage': { zh: '上传图片', en: 'Upload image' },
  'pp.remove': { zh: '移除', en: 'Remove' },
  'pp.portraitSaved': { zh: '立绘已保存', en: 'Art saved' },
  'pp.portraitSaveFailed': { zh: '立绘保存失败：{e}', en: 'Failed to save art: {e}' },
  'pp.recrop': { zh: '重新裁剪', en: 'Re-crop' },
  'pp.cropTitle': { zh: '选取立绘范围', en: 'Select art region' },
  'pp.cropConfirm': { zh: '裁剪并保存', en: 'Crop & save' },
  'pp.cropCancel': { zh: '取消', en: 'Cancel' },
  'pp.cropOutput': { zh: '输出 {w}×{h}', en: 'Output {w}×{h}' },
  'pp.portraitLoadFail': { zh: '立绘加载失败', en: 'Failed to load art' },
  'pp.portraitEmpty': { zh: '暂无立绘', en: 'No art yet' },
  'pp.locName': { zh: '名称', en: 'Name' },
  'pp.locDesc': { zh: '描述', en: 'Description' },
  'pp.locFlavor': { zh: '风味文本', en: 'Flavor text' },
  'pp.genDesc': { zh: '生成描述', en: 'Generate' },
  'pp.genDescBtn': { zh: '生成描述', en: 'Generate' },
  'pp.genDescAllHint': { zh: '生成打出时及全部触发时机的描述', en: 'Generate text for play effects and every trigger' },
  'pp.genDescOverwrite': { zh: '描述已有内容，覆盖为按效果生成的文本（中/英）？', en: 'The description already has content — overwrite with generated text (both languages)?' },
  'pp.genDescDone': { zh: '已生成描述', en: 'Description generated' },
  'confirm.title': { zh: '确认操作', en: 'Confirm action' },
  'confirm.cancel': { zh: '取消', en: 'Cancel' },
  'confirm.approve': { zh: '确认', en: 'Confirm' },
  'pp.genDescUnchanged': { zh: '描述已与当前效果一致', en: 'Description already matches the current effects' },
  'pp.genDescEmpty': { zh: '该卡没有可生成描述的效果', en: 'This card has no effects to generate a description from' },
  'pp.moveEffectUp': { zh: '上移效果', en: 'Move effect up' },
  'pp.moveEffectDown': { zh: '下移效果', en: 'Move effect down' },
  'pp.removeEffect': { zh: '删除效果', en: 'Remove effect' },
  'pp.targetHint': { zh: '决定打出时是否选取对象；各效果可单独指定作用目标。', en: 'Controls target selection when played. Effects can override their own target.' },
  'pp.targetLegacyHint': { zh: '此选项用于药水指向商人等非生物对象。普通卡牌请选择其他目标。', en: 'This legacy option targets non-creature objects for potions. Choose another target for a card.' },
  'pp.triggerLabel': { zh: '触发时机', en: 'Trigger' },
  'pp.noEffects': { zh: '暂无效果', en: 'No effects' },
  'pp.handler': { zh: '处理器', en: 'Handler' },
  'pp.handlerPh': { zh: '搜索处理器或输入新名称', en: 'search handlers, or type a new name' },
  'pp.handlerUnregistered': { zh: '目录中没有此名', en: 'not in the catalog' },
  'pp.vfxLabel': { zh: '特效', en: 'VFX' },
  'pp.vfxSearch': { zh: '搜索特效，或输入 res:// 路径', en: 'search VFX, or type a res:// path' },
  'pp.vfxTargetRandom': { zh: '随机敌人', en: 'Random enemy' },
  'pp.vfxTargetAll': { zh: '每个敌人', en: 'Each enemy' },
  'pp.vfxTargetSideEnemy': { zh: '敌方阵营中心', en: 'Enemy side center' },
  'pp.vfxTargetSidePlayer': { zh: '我方阵营中心', en: 'Player side center' },
  'pp.vfxTargetScreen': { zh: '全屏', en: 'Full screen' },
  'pp.vfxSource': { zh: '出现位置', en: 'Shown at' },
  'pp.vfxSourceTarget': { zh: '跟随目标', en: 'At the target' },
  'pp.vfxSourceSelf': { zh: '自身', en: 'Self' },
  'pp.vfxSourceMonster': { zh: '指定怪物', en: 'Named monster' },
  'pp.hitVfx': { zh: '打击特效', en: 'Hit VFX' },
  'pp.hitCount': { zh: '段数', en: 'Hits' },
  'pp.hitSfx': { zh: '打击音效', en: 'Hit SFX' },
  'pp.sfxLabel': { zh: '音效', en: 'SFX' },
  'pp.damageTargetDefault': { zh: '跟随卡牌目标', en: 'Follow card target' },
  'pp.sfxSearch': { zh: '搜索音效，或输入 event:/… / 文件名', en: 'search SFX, or type event:/… / a file name' },
  'pp.amount': { zh: '数值', en: 'Amount' },
  'pp.params': { zh: '参数', en: 'Parameters' },
  'pp.tplSummary': { zh: '模板', en: 'Template' },
  'pp.exampleSummary': { zh: '示例', en: 'Example' },
  'pp.exampleIntro': { zh: '示例卡「示例·咔咔」仅填写处理器名 demo_kaka，行为由 Runtime 内置处理器实现：召唤一只改名「咔咔」的邪教徒（13 点生命），并赋予自身 1 层仪式（每回合结束 +1 力量）。', en: 'The demo card "Kaka" only fills the handler name demo_kaka; its behavior comes from a handler shipped with the Runtime — it spawns a Cultist renamed "Kaka" (13 HP) and applies 1 Ritual to yourself (+1 Strength at each turn end).' },
  'pp.exampleSaved': { zh: '卡牌 JSON（cards/*.json）：', en: 'Card JSON (cards/*.json):' },
  'pp.exampleHandler': { zh: 'Runtime 处理器源码（节选）：', en: 'Handler source in the Runtime (excerpt):' },
  'pp.powerLabel': { zh: '能力', en: 'Power' },
  'pp.playTargetDefault': { zh: '跟随卡牌目标', en: 'Follow card target' },
  'pp.targetSelf': { zh: '自身', en: 'Self' },
  'pp.targetAllEnemies': { zh: '全体敌人', en: 'All enemies' },
  'pp.spawnEntry': { zh: '卡牌 Entry', en: 'Card Entry' },
  'pp.orbType': { zh: '球类型', en: 'Orb type' },
  'pp.monster': { zh: '怪物', en: 'Monster' },
  'pp.summonHp': { zh: '生命', en: 'HP' },
  'pp.powerSearch': { zh: '搜索能力', en: 'Search powers' },
  'pp.monsterSearch': { zh: '搜索怪物', en: 'Search monsters' },
  'pp.cardSearch': { zh: '搜索卡牌', en: 'Search cards' },
  'pp.useRaw': { zh: '使用原始值 "{v}"', en: 'Use raw value "{v}"' },
  'pp.unpowered': { zh: '不受增益影响', en: 'Unaffected by buffs' },
  'pp.upgradeDelta': { zh: '升级 +', en: 'Upgrade +' },
  'pp.delayedTurns': { zh: '触发次数', en: 'Trigger count' },
  'pp.delayedCountHint': { zh: '包含施加当回合的结束时机；双方分别计数。', en: 'Includes the current turn end; each side counts separately.' },
  'pp.delayedUpgradeTurns': { zh: '次数增量', en: 'Count delta' },
  'pp.delayedBuffText': { zh: 'Buff 文本', en: 'Buff text' },
  'pp.delayedGenerateBuff': { zh: '生成', en: 'Generate' },
  'pp.delayedBuffZh': { zh: '中文', en: 'Chinese' },
  'pp.delayedBuffEn': { zh: '英文', en: 'English' },
  'pp.delayedBuffName': { zh: '名称（留空自动）', en: 'Name (blank: auto)' },
  'pp.delayedBuffDescription': { zh: '描述（留空自动）', en: 'Description (blank: auto)' },
  'pp.delayedBuffHint': { zh: '{Amount}：剩余次数\n{Effect1Amount}：首条效果数值\n生成将替换中英文文本。', en: '{Amount}: remaining count\n{Effect1Amount}: first effect value\nGeneration replaces both languages.' },
  'pp.delayedTiming': { zh: '触发时机', en: 'Timing' },
  'pp.delayedTurnEnd': { zh: '回合结束时', en: 'Turn end' },
  'pp.delayedTurnStart': { zh: '回合开始时', en: 'Turn start' },
  'pp.delayedSide': { zh: '触发方', en: 'Side' },
  'pp.sidePlayer': { zh: '我方回合', en: 'My turn' },
  'pp.sideEnemy': { zh: '敌方回合', en: 'Enemy turn' },
  'pp.sideBoth': { zh: '双方回合', en: 'Both sides' },
  'pp.delayedMode': { zh: '触发方式', en: 'Trigger mode' },
  'pp.delayedEvery': { zh: '每回合触发', en: 'Every turn' },
  'pp.delayedFinal': { zh: '仅最后一次', en: 'Final only' },
  'pp.iconLabel': { zh: '图标', en: 'Icon' },
  'pp.iconUpload': { zh: '上传图片', en: 'Upload image' },
  'pp.iconUploadFail': { zh: '图标保存失败：{e}', en: 'Failed to save icon: {e}' },
  'pp.turnEndInHandNote': {
    zh: '回合结束时自动打出，结算后弃置。',
    en: 'Plays at turn end, then discards.',
  },
  'pp.delayedEmpty': { zh: '尚无内嵌效果', en: 'No nested effects yet' },
  'pp.coreKinds': { zh: '常用', en: 'Common' },
  'pp.extraKinds': { zh: '扩展', en: 'Advanced' },
  'pp.maxUpgrade': { zh: '升级上限', en: 'Upgrade limit' },

  // 发布面板（PublishPanel.tsx）
  'pub.title': { zh: '发布卡包', en: 'Publish Pack' },
  'pub.cards': { zh: '{n} 张卡', en: '{n} cards' },
  'pub.workshopId': { zh: '工坊 id {id}', en: 'Workshop id {id}' },
  'pub.unpublished': { zh: '未发布', en: 'unpublished' },
  'pub.issues': { zh: '{n} 项问题', en: '{n} issues' },
  'pub.local': { zh: '本地使用', en: 'Local use' },
  'pub.version': { zh: '版本号', en: 'Version' },
  'pub.gameReady': { zh: '已就绪', en: 'ready' },
  'pub.gameNotSet': { zh: '未配置', en: 'not set' },
  'pub.gameDirLine': { zh: '游戏目录{state} · 上传器{up}', en: 'Game directory {state} · uploader {up}' },
  'pub.upExtracting': { zh: '释放中…', en: 'extracting…' },
  'pub.install': { zh: '安装到游戏', en: 'Install to game' },
  'pub.grantAll': { zh: '加入卡组', en: 'Add to deck' },
  'pub.exportPack': { zh: '导出卡包', en: 'Export pack' },
  'pub.workshop': { zh: 'Steam 工坊', en: 'Steam Workshop' },
  'pub.publishedTag': { zh: '· 已发布 #{id}', en: '· published #{id}' },
  'pub.runtimeDep': { zh: 'Runtime 依赖', en: 'Runtime dependency' },
  'pub.runtimeDepAuto': { zh: '已自动依赖官方 SpireForge Runtime', en: 'Official SpireForge Runtime dependency set automatically' },
  'pub.runtimeDepCustom': { zh: '使用自定义 Runtime 依赖', en: 'Using a custom Runtime dependency' },
  'pub.runtimeDepReset': { zh: '恢复官方默认', en: 'Restore official default' },
  'pub.runtimeDepPh': { zh: '官方 Runtime id', en: 'official Runtime id' },
  'pub.runtimeDepWarn': { zh: '未设置：订阅玩家不会自动安装 Runtime', en: 'Not set: subscribers won\'t auto-install the Runtime' },
  'pub.visibility': { zh: '可见性', en: 'Visibility' },
  'pub.visPrivate': { zh: '私有', en: 'Private' },
  'pub.visPublic': { zh: '公开', en: 'Public' },
  'pub.visUnlisted': { zh: '不列出', en: 'Unlisted' },
  'pub.visFriends': { zh: '仅好友', en: 'Friends only' },
  'pub.changeNote': { zh: '变更说明', en: 'Change notes' },
  'pub.changeNotePh': { zh: '例如：新增 3 张卡牌，平衡性调整', en: 'e.g. 3 new cards, balance tweaks' },
  'pub.prepare': { zh: '准备上传', en: 'Prepare' },
  'pub.upload': { zh: '上传', en: 'Upload' },
  'pub.uploaderLine': { zh: '上传器：{up}', en: 'Uploader: {up}' },
  'pub.uploaderReady': { zh: '内置 ModUploader（就绪）', en: 'built-in ModUploader (ready)' },
  'pub.useExternal': { zh: '换用外部 ModUploader.exe', en: 'Use external ModUploader.exe' },
  'pub.workshopNote': { zh: '需 Steam 客户端在线；tags 上传后不可修改。', en: 'Requires Steam running; tags can\'t change after first upload.' },
  'pub.installedTo': { zh: '已安装到：{dir}', en: 'Installed to: {dir}' },
  'pub.installOk': { zh: '安装成功', en: 'Installed' },
  'pub.installRestart': { zh: '已安装，重启游戏后生效', en: 'Installed — restart the game to load it' },
  'pub.installFailed': { zh: '安装失败：{e}', en: 'Install failed: {e}' },
  'pub.exportedTo': { zh: '卡包已导出到：{dir}', en: 'Pack exported to: {dir}' },
  'pub.exportOk': { zh: '导出成功', en: 'Exported' },
  'pub.exportFailed': { zh: '导出失败：{e}', en: 'Export failed: {e}' },
  'pub.wsGenerated': { zh: '上传工作区已生成：{ws}\n下一步：{next}', en: 'Workshop workspace created: {ws}\nNext: {next}' },
  'pub.wsNextReady': { zh: '点击「上传到 Steam 工坊」', en: 'click "Upload to Steam Workshop"' },
  'pub.wsNextConfig': { zh: '在下方设置 ModUploader.exe 路径后上传', en: 'set the ModUploader.exe path below, then upload' },
  'pub.wsOk': { zh: '工作区已生成', en: 'Workspace created' },
  'pub.wsFailed': { zh: '生成失败：{e}', en: 'Failed: {e}' },
  'pub.wsNeed': { zh: '请先生成上传工作区', en: 'Generate the workspace first' },
  'pub.uploaded': { zh: '上传完成：\n{out}', en: 'Upload finished:\n{out}' },
  'pub.uploadDone': { zh: '上传完成', en: 'Uploaded' },
  'pub.uploadFailed': { zh: '上传失败：{e}', en: 'Upload failed: {e}' },
  'pub.uploaderSaved': { zh: '上传器路径已保存', en: 'Uploader path saved' },

  // 项目设置（ProjectSettingsModal.tsx）
  'ps.title': { zh: '项目设置', en: 'Project Settings' },
  'ps.metaLine': { zh: '包 id {id} · 工坊 id {ws}', en: 'Pack id {id} · Workshop id {ws}' },
  'ps.name': { zh: '项目名称', en: 'Project name' },
  'ps.author': { zh: '作者', en: 'Author' },
  'ps.desc': { zh: '简介', en: 'Description' },
  'ps.descPh': { zh: '这个卡包里有什么？玩法/主题/卡牌数量…', en: 'What\'s in this pack? Theme/mechanics/card count…' },
  'ps.cancel': { zh: '取消', en: 'Cancel' },
  'ps.save': { zh: '保存', en: 'Save' },
  'ps.saved': { zh: '项目信息已保存', en: 'Project info saved' },

  // 原版导入（VanillaImportModal.tsx）
  'vi.title': { zh: '导入原版卡', en: 'Import vanilla card' },
  'vi.metaLine': { zh: '{n} 张 · 游戏 v{v} · 以覆盖卡载入', en: '{n} cards · game v{v} · loaded as an override' },
  'vi.search': { zh: '搜索卡名（中/英）或 Entry', en: 'Search name (zh/en) or Entry' },
  'vi.noMatch': { zh: '没有匹配的卡牌', en: 'No matching cards' },
  'vi.imported': { zh: '已导入原版卡「{name}」（覆盖 {entry}）', en: 'Imported vanilla "{name}" (overriding {entry})' },
  'vi.importFailed': { zh: '导入失败：{e}', en: 'Import failed: {e}' },

  // store 提示
  'st.partialSaveFail': { zh: '部分修改保存失败，请重试', en: 'Some edits failed to save — please retry' },
  'st.operationBusy': { zh: '正在处理卡牌，请完成后再操作', en: 'A card operation is in progress. Please wait.' },
  'st.historyCardMissing': { zh: '历史记录对应的卡牌不存在', en: 'The card referenced by this history entry is missing.' },
  'st.historyFailed': { zh: '撤销或重做失败：{e}', en: 'Undo or redo failed: {e}' },
  'pub.wsStale': { zh: '项目内容或发布配置已变化，请重新生成工坊工作区后上传。', en: 'Project content or publish settings changed. Create the workshop workspace again before uploading.' },
  'pub.checkFailed': { zh: '项目检查失败：{e}', en: 'Project validation failed: {e}' },
  'recovery.title': { zh: '备份恢复', en: 'Backups' },
  'recovery.note': { zh: '可恢复上次保存内容或删除快照。项目索引恢复卡包设置和卡牌清单，并补回缺失卡牌；已有卡牌不回退。恢复后清空撤销和重做记录。', en: 'Restore a previous save or a deleted card. Project index recovery restores pack settings and the card list, filling missing cards without reverting existing cards. Recovery clears undo and redo history.' },
  'recovery.saveFirst': { zh: '当前仍有未保存修改。请关闭此窗口，完成保存后重新打开，以读取最新备份。', en: 'There are unsaved edits. Close this window, save them, and reopen it to load the latest backups.' },
  'recovery.empty': { zh: '当前项目没有可恢复的备份。', en: 'This project has no backups.' },
  'recovery.confirm': { zh: '恢复「{name}」的备份？对应的当前内容将被替换，撤销与重做记录将清空。', en: 'Restore the backup of "{name}"? The corresponding current content will be replaced and undo/redo history cleared.' },
  'recovery.restore': { zh: '恢复', en: 'Restore' },
  'recovery.done': { zh: '备份已恢复', en: 'Backup restored' },
  'recovery.project': { zh: '项目索引备份', en: 'Project index backup' },
  'recovery.card': { zh: '上次保存备份', en: 'Previous save' },
  'recovery.deleted': { zh: '删除快照', en: 'Deleted card' },
};

// ---- 游戏术语官方译名表（双语）----
// 中文取自游戏内置 zhs 本地化（spire-codex 提取，v0.111.0）；英文为原版枚举名。

export const TYPE_LABEL: Record<string, L> = {
  Attack: { zh: '攻击', en: 'Attack' },
  Skill: { zh: '技能', en: 'Skill' },
  Power: { zh: '能力', en: 'Power' },
  Status: { zh: '状态', en: 'Status' },
  Curse: { zh: '诅咒', en: 'Curse' },
  Quest: { zh: '任务', en: 'Quest' },
};

export const RARITY_LABEL: Record<string, L> = {
  Basic: { zh: '基础', en: 'Basic' },
  Common: { zh: '普通', en: 'Common' },
  Uncommon: { zh: '罕见', en: 'Uncommon' },
  Rare: { zh: '稀有', en: 'Rare' },
  Ancient: { zh: '先古', en: 'Ancient' },
  Event: { zh: '事件', en: 'Event' },
  Token: { zh: '衍生', en: 'Token' },
  Status: { zh: '状态', en: 'Status' },
  Curse: { zh: '诅咒', en: 'Curse' },
  Quest: { zh: '任务', en: 'Quest' },
};

export const TARGET_LABEL: Record<string, L> = {
  None: { zh: '无需指定目标', en: 'No target selection' },
  Self: { zh: '自身', en: 'Self' },
  AnyEnemy: { zh: '单一敌人', en: 'One enemy' },
  AllEnemies: { zh: '全体敌人', en: 'All enemies' },
  RandomEnemy: { zh: '随机敌人', en: 'Random enemy' },
  AnyPlayer: { zh: '任一玩家', en: 'Any player' },
  AnyAlly: { zh: '单一友方', en: 'One ally' },
  AllAllies: { zh: '全体友方', en: 'All allies' },
  TargetedNoCreature: { zh: '非生物目标（旧数据）', en: 'Non-creature target (legacy)' },
  Osty: { zh: '奥斯提', en: 'Osty' },
};

export const POOL_LABEL: Record<string, L> = {
  colorless: { zh: '无色', en: 'Colorless' },
  curse: { zh: '诅咒池', en: 'Curse pool' },
  status: { zh: '状态池', en: 'Status pool' },
  ironclad: { zh: '铁甲战士', en: 'Ironclad' },
  silent: { zh: '静默猎手', en: 'Silent' },
  regent: { zh: '储君', en: 'Regent' },
  necrobinder: { zh: '亡灵契约师', en: 'Necrobinder' },
  defect: { zh: '故障机器人', en: 'Defect' },
};

/** 原版目录 color 字段（含非卡池分类） */
export const VI_COLOR_LABEL: Record<string, L> = {
  ...POOL_LABEL,
  event: { zh: '事件', en: 'Event' },
  quest: { zh: '任务', en: 'Quest' },
  token: { zh: '衍生', en: 'Token' },
};

/** 关键词点选（k = 存储/游戏枚举名；中文取官方本地化） */
export const KEYWORD_CHIPS: { k: string; label: L }[] = [
  { k: 'Innate', label: { zh: '固有', en: 'Innate' } },
  { k: 'Retain', label: { zh: '保留', en: 'Retain' } },
  { k: 'Ethereal', label: { zh: '虚无', en: 'Ethereal' } },
  { k: 'Exhaust', label: { zh: '消耗', en: 'Exhaust' } },
  { k: 'Unplayable', label: { zh: '不能被打出', en: 'Unplayable' } },
  { k: 'Sly', label: { zh: '奇巧', en: 'Sly' } },
  { k: 'Eternal', label: { zh: '永恒', en: 'Eternal' } },
];

/** 生命周期钩子标签 */
export const HOOK_LABEL: Record<string, L> = {
  on_draw: { zh: '抽到时', en: 'On draw' },
  on_discard: { zh: '被弃时', en: 'On discard' },
  on_exhaust: { zh: '被消耗时', en: 'On exhaust' },
  on_enter_combat: { zh: '战斗开始时', en: 'Combat start' },
  on_turn_end_in_hand: { zh: '回合末在手', en: 'Turn end in hand' },
};

/** 效果目录（label/desc 双语；varName = 描述占位符变量名） */
export const EFFECT_META: Record<string, { label: L; varName: string; desc: L }> = {
  damage: { label: { zh: '造成伤害', en: 'Deal damage' }, varName: 'Damage', desc: { zh: '对目标造成伤害（DamageVar）', en: 'Deal damage to the target (DamageVar)' } },
  block: { label: { zh: '获得格挡', en: 'Gain block' }, varName: 'Block', desc: { zh: '为自身获得格挡（BlockVar）', en: 'Gain Block for self (BlockVar)' } },
  draw: { label: { zh: '抽牌', en: 'Draw cards' }, varName: 'Cards', desc: { zh: '从抽牌堆抽牌（CardsVar）', en: 'Draw from the draw pile (CardsVar)' } },
  energy: { label: { zh: '获得能量', en: 'Gain energy' }, varName: 'Energy', desc: { zh: '获得能量（EnergyVar）', en: 'Gain Energy (EnergyVar)' } },
  heal: { label: { zh: '回复生命', en: 'Heal' }, varName: 'Heal', desc: { zh: '为自身回复生命（HealVar）', en: 'Heal self (HealVar)' } },
  discard: { label: { zh: '随机弃牌', en: 'Discard' }, varName: 'Discard', desc: { zh: '随机弃置 N 张手牌', en: 'Discard N random cards from hand' } },
  exhaust: { label: { zh: '随机消耗', en: 'Exhaust' }, varName: 'Exhaust', desc: { zh: '随机消耗 N 张手牌', en: 'Exhaust N random cards from hand' } },
  gold: { label: { zh: '获得金币', en: 'Gold' }, varName: 'Gold', desc: { zh: '获得金币，负数则失去金币', en: 'Gain gold; negative loses gold' } },
  lose_hp: { label: { zh: '失去生命', en: 'Lose HP' }, varName: 'LoseHp', desc: { zh: '自身失去 N 点生命，不可被格挡', en: 'Lose N HP for self, unblockable' } },
  max_hp: { label: { zh: '生命上限', en: 'Max HP' }, varName: 'MaxHp', desc: { zh: '增加 N 点生命上限', en: 'Gain N Max HP' } },
  power: { label: { zh: '施加能力', en: 'Apply power' }, varName: 'Power', desc: { zh: '对目标施加所选能力', en: 'Apply the chosen power to the target' } },
  spawn: { label: { zh: '生成卡牌', en: 'Spawn card' }, varName: 'Spawn', desc: { zh: '将卡牌加入抽牌堆 / 手牌 / 弃牌堆', en: 'Put a card into the draw pile, hand, or discard pile' } },
  summon: { label: { zh: '召唤敌人', en: 'Summon enemy' }, varName: 'Summon', desc: { zh: '在敌方召唤一只怪物，生命留空时使用原生值', en: 'Summon a monster on the enemy side; leave HP empty for its native value' } },
  orb: { label: { zh: '生成充能球', en: 'Channel orb' }, varName: 'Orbs', desc: { zh: '生成指定类型或随机的充能球（故障机器人）', en: 'Channel an orb of the chosen type, or a random one (Defect)' } },
  orb_slot: { label: { zh: '充能球栏位', en: 'Orb slots' }, varName: 'OrbSlots', desc: { zh: '获得 N 个充能球栏位，负数则移除', en: 'Gain N orb slots; negative removes them' } },
  delayed: { label: { zh: '延迟效果', en: 'Delayed effect' }, varName: '', desc: { zh: '在选定回合时机执行内嵌效果，也可改为倒计时结束后仅触发一次', en: 'Run nested effects at matching turn events, or once when the countdown ends' } },
  custom: { label: { zh: '自定义', en: 'Custom' }, varName: '', desc: { zh: '调用内置或 mod 注册的处理器', en: 'Invoke a built-in or mod-registered handler' } },
  vfx: { label: { zh: '播放特效', en: 'Play VFX' }, varName: '', desc: { zh: '播放视觉特效，不影响数值', en: 'Play a visual effect; no gameplay impact' } },
};

/** 效果触发时机 */
export type TriggerKey = 'play' | 'on_draw' | 'on_discard' | 'on_exhaust' | 'on_enter_combat' | 'on_turn_end_in_hand';

export const TRIGGER_OPTIONS: { v: TriggerKey; label: L }[] = [
  { v: 'play', label: { zh: '打出时', en: 'On play' } },
  { v: 'on_draw', label: { zh: '抽到时', en: 'On draw' } },
  { v: 'on_discard', label: { zh: '被弃时', en: 'On discard' } },
  { v: 'on_exhaust', label: { zh: '被消耗时', en: 'On exhaust' } },
  { v: 'on_enter_combat', label: { zh: '战斗开始时', en: 'Combat start' } },
  { v: 'on_turn_end_in_hand', label: { zh: '回合末在手', en: 'Turn end in hand' } },
];

/** 钩子上下文取敌方式 */
export const HOOK_TARGET_OPTIONS: { v: string; label: L }[] = [
  { v: 'random_enemy', label: { zh: '随机敌人', en: 'Random enemy' } },
  { v: 'self', label: { zh: '自身', en: 'Self' } },
  { v: 'all_enemies', label: { zh: '全体敌人', en: 'All enemies' } },
];

/** 充能球类型（orb 效果；random/缺省 = 随机） */
export const ORB_OPTIONS: { v: string; label: L }[] = [
  { v: 'random', label: { zh: '随机', en: 'Random' } },
  { v: 'lightning', label: { zh: '闪电', en: 'Lightning' } },
  { v: 'frost', label: { zh: '冰霜', en: 'Frost' } },
  { v: 'dark', label: { zh: '黑暗', en: 'Dark' } },
  { v: 'plasma', label: { zh: '等离子', en: 'Plasma' } },
  { v: 'glass', label: { zh: '玻璃', en: 'Glass' } },
];
