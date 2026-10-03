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
  // 工具栏（App.tsx）
  'app.undo': { zh: '↶ 撤销', en: '↶ Undo' },
  'app.undoTitle': { zh: '撤销最近一次卡牌修改（Ctrl+Z；输入框内 Ctrl+Z 仍是文字撤销）', en: 'Undo the last card edit (Ctrl+Z; inside text fields Ctrl+Z still edits text)' },
  'app.redo': { zh: '↷ 重做', en: '↷ Redo' },
  'app.redoTitle': { zh: '重做被撤销的修改（Ctrl+Y）', en: 'Redo an undone edit (Ctrl+Y)' },
  'app.saveDirty': { zh: '保存 ●（{n}）', en: 'Save ● ({n})' },
  'app.saved': { zh: '已保存', en: 'Saved' },
  'app.publish': { zh: '发布 / 安装', en: 'Publish / Install' },
  'app.settings': { zh: '项目设置', en: 'Project Settings' },
  'app.settingsTitle': { zh: '项目名称 / 作者 / 简介（简介会发布到工坊）', en: 'Project name / author / description (description goes to the Workshop page)' },
  'app.switchProject': { zh: '切换项目', en: 'Switch Project' },
  'app.switchTitle': { zh: '关闭当前项目，回到欢迎页（未保存修改会先落盘）', en: 'Close the current project and return to the welcome screen (unsaved edits are saved first)' },
  'app.toEnglish': { zh: 'EN', en: '中文' },
  'app.langTitle': { zh: '切换到英文界面', en: 'Switch to Chinese UI' },

  // 预览区（App.tsx PreviewPane + CardPreview）
  'pv.upgraded': { zh: '预览升级数值', en: 'Preview upgraded values' },
  'pv.grant': { zh: '在游戏中获得', en: 'Get in game' },
  'pv.grantTitle': { zh: '把这张卡永久加入当前一局的主牌组（跨战斗持久、随存档保存），下一场战斗开始时入组。需要游戏正在运行；游戏没开时不会登记', en: 'Permanently adds this card to your current run\'s deck (persists across combats, saved with the run); it joins at the start of the next combat. The game must be running — nothing is queued while it is closed' },
  'pv.grantQueued': { zh: '已登记 {total} 张（本次新增 {added}）：下一场战斗开始时永久入组', en: 'Queued {total} card(s) ({added} new): they permanently join your run deck at the start of the next combat' },
  'pv.grantNoGame': { zh: '游戏未运行：请先启动游戏并进入一局，再点「在游戏中获得」', en: 'The game is not running — start the game and enter a run before using "Get in game"' },
  'pv.grantFailed': { zh: '登记失败：{e}', en: 'Failed to queue: {e}' },
  'pv.export': { zh: '导出 JSON', en: 'Export JSON' },
  'pv.exported': { zh: '已导出卡牌 JSON', en: 'Card JSON exported' },
  'pv.exportFailed': { zh: '导出失败：{e}', en: 'Export failed: {e}' },
  'pv.empty': { zh: '选择或创建一张卡牌开始编辑', en: 'Select or create a card to start editing' },
  'pv.entry': { zh: '游戏内 Entry', en: 'In-game Entry' },
  'pv.idInvalid': { zh: 'id 无效', en: 'invalid id' },

  // 欢迎页（Welcome.tsx）
  'w.subtitle': { zh: '杀戮尖塔 2 · 现代化卡牌编辑器', en: 'Slay the Spire 2 · modern card editor' },
  'w.guide': { zh: '三步上手：① 新建卡包项目 → ② 「+ 新卡牌」挑个模板改数值 → ③ 顶栏「发布 / 安装」一键装进游戏。想改原版卡就点「原版卡」。', en: 'Three steps: 1) create a pack project, 2) "+ New Card" — pick a template and tweak the numbers, 3) "Publish / Install" in the toolbar to install into the game. To modify a vanilla card, click "Vanilla".' },
  'w.gameOk': { zh: '游戏目录已就绪', en: 'Game directory ready' },
  'w.gameMissing': { zh: '未配置游戏目录', en: 'Game directory not set' },
  'w.clickConfig': { zh: '点击配置', en: 'Click to configure' },
  'w.clickRedetect': { zh: '点击重新检测', en: 'Click to re-detect' },
  'w.gameNotFound': { zh: '未找到，请手动选择游戏根目录', en: 'Not found — select the game root folder manually' },
  'w.newProject': { zh: '新建卡包项目', en: 'New Pack Project' },
  'w.demo': { zh: '创建示例卡包（先看看能做什么）', en: 'Create sample pack (see what it can do)' },
  'w.demoTitle': { zh: '创建一个内置示例项目：打击/防御/力量/咔咔(自定义效果)/回响(钩子) 5 张演示卡 + 占位立绘', en: 'Creates a built-in sample project: Strike / Defend / Strength / Kaka (custom effect) / Echo (hook) demo cards + placeholder art' },
  'w.openProject': { zh: '打开已有项目', en: 'Open Existing Project' },
  'w.packId': { zh: '包 id（工坊标识，驼峰）', en: 'Pack id (Workshop id, camelCase)' },
  'w.packIdErr': { zh: '需以字母开头，仅字母/数字/下划线（2–64 位）；它会成为目录名与工坊 id', en: 'Must start with a letter; letters/digits/underscore only (2–64 chars). It becomes the folder name and Workshop id' },
  'w.name': { zh: '项目名称', en: 'Project name' },
  'w.author': { zh: '作者', en: 'Author' },
  'w.authorPh': { zh: 'Steam 昵称', en: 'Steam nickname' },
  'w.create': { zh: '选择目录并创建', en: 'Choose folder & create' },
  'w.back': { zh: '返回', en: 'Back' },
  'w.demoFailed': { zh: '创建示例卡包失败：{e}', en: 'Failed to create the sample pack: {e}' },
  'w.openFailed': { zh: '打开项目失败：{e}', en: 'Failed to open project: {e}' },

  // 卡牌库（CardLibrary.tsx）
  'lib.title': { zh: '卡牌库', en: 'Cards' },
  'lib.count': { zh: '{n} 张', en: '{n}' },
  'lib.vanilla': { zh: '原版卡', en: 'Vanilla' },
  'lib.vanillaTitle': { zh: '从游戏原版 577 张卡中选一张，作为覆盖卡载入编辑', en: 'Pick one of the game\'s 577 vanilla cards and load it as an override for editing' },
  'lib.pack': { zh: '卡包', en: 'Pack' },
  'lib.packTitle': { zh: '导入 .pck 卡包（其他 SpireForge 用户分享的卡包）', en: 'Import a .pck pack shared by other SpireForge users' },
  'lib.import': { zh: '导入', en: 'Import' },
  'lib.importTitle': { zh: '导入卡牌 JSON（支持 SpireForge 及常见第三方格式，多卡文件整批导入）', en: 'Import card JSON (SpireForge and common third-party formats; multi-card files import in batch)' },
  'lib.search': { zh: '搜索名称 / id…', en: 'Search name / id…' },
  'lib.newCard': { zh: '+ 新卡牌', en: '+ New Card' },
  'lib.newCardTitle': { zh: '从模板新建：两三下点击得到一张能进游戏的卡', en: 'Create from a template — a couple of clicks for a working card' },
  'lib.all': { zh: '全部', en: 'All' },
  'lib.emptyLine1': { zh: '还没有卡牌。挑一个模板开始，', en: 'No cards yet. Pick a template to start —' },
  'lib.emptyLine2': { zh: '数值和描述都能再改。', en: 'values and text can be edited afterwards.' },
  'lib.vanillaCta': { zh: '改一张原版卡', en: 'Start from a vanilla card' },
  'lib.vanillaCtaSub': { zh: '从游戏 577 张卡里选', en: 'Pick from the game\'s 577 cards' },
  'lib.noMatch': { zh: '没有符合筛选的卡牌', en: 'No cards match the filter' },
  'lib.tplTitle': { zh: '新建卡牌', en: 'New Card' },
  'lib.vanillaTag': { zh: '原版', en: 'vanilla' },
  'lib.imported': { zh: '已导入 {n} 张：{names}', en: 'Imported {n}: {names}' },
  'lib.importForeign': { zh: '\n\n外来格式 {n} 张，请核对字段：\n', en: '\n\n{n} card(s) in foreign formats — please check their fields:\n' },
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
  'pp.copyTitle': { zh: '以这张卡为底复制一张新卡（id 自动加 _copy）', en: 'Duplicate this card as a new card (id gets _copy)' },
  'pp.delete': { zh: '删除', en: 'Delete' },
  'pp.deleteConfirm': { zh: '删除「{name}」？此操作不可恢复。', en: 'Delete "{name}"? This cannot be undone.' },
  'pp.deleted': { zh: '已删除', en: 'Deleted' },
  'pp.copied': { zh: '已复制，新卡在副本上改', en: 'Duplicated — edit the copy' },
  'pp.pickFromLeft': { zh: '从左侧选择一张卡牌', en: 'Select a card on the left' },
  'pp.vanillaCover': { zh: '覆盖原版卡', en: 'Override vanilla card' },
  'pp.vanillaHint': { zh: '想修改游戏原版卡（改费用/数值/文案）？', en: 'Want to modify a vanilla card (cost/numbers/text)?' },
  'pp.vanillaActive': { zh: '覆盖原版卡 {id}', en: 'Overriding vanilla {id}' },
  'pp.vanillaActiveHint': { zh: '发布后游戏内原版卡被本卡设定替换', en: 'In game, the vanilla card is replaced by this card\'s settings after publishing' },
  'pp.vanillaCancel': { zh: '取消覆盖', en: 'Stop overriding' },
  'pp.vanillaEntryPh': { zh: '原版 Entry，如 BASH（左侧「原版卡」按钮可直接选）', en: 'Vanilla Entry, e.g. BASH (or pick via the "Vanilla" button on the left)' },
  'pp.statsCover': { zh: '数值覆盖（覆盖后数值；effects 为空时原版行为不变）', en: 'Stat overrides (absolute values; vanilla behavior stays while effects is empty)' },
  'pp.upgCover': { zh: '升级增量（替换原版升级逻辑）', en: 'Upgrade deltas (replaces the vanilla upgrade logic)' },
  'pp.addStat': { zh: '+ 数值', en: '+ Stat' },
  'pp.addDelta': { zh: '+ 升级增量', en: '+ Upgrade delta' },
  'pp.varPh': { zh: '变量名，如 Damage', en: 'Variable name, e.g. Damage' },
  'pp.vanillaInfo': { zh: '原版：{name}', en: 'Vanilla: {name}' },
  'pp.dirtyBadge': { zh: '待保存 {n}', en: '{n} unsaved' },
  'pp.prefill': { zh: '预填原版效果', en: 'Prefill effects' },
  'pp.prefillTitle': { zh: '按原版数值生成效果清单（会整体替换原版打出行为）', en: 'Build the effect list from vanilla values (replaces the vanilla play behavior entirely)' },
  'pp.prefillConfirm': { zh: '按原版数据预填 {n} 条效果？\n\n效果清单非空 = 整体替换原版打出行为（原版效果不再执行）。\n数值型变量（伤害/格挡/抽牌/能量/效果）可映射；计算型行为无法静态还原，需手动补。', en: 'Prefill {n} effects from vanilla data?\n\nA non-empty effect list REPLACES the vanilla play behavior (vanilla effects no longer run).\nNumeric variables (damage/block/draw/energy/power) map over; computed behavior can\'t be restored statically — add those by hand.' },
  'pp.prefillFail': { zh: '原版数据无法映射出效果清单（行为多为硬编码），请手动编辑', en: 'Vanilla data can\'t be mapped to effects (mostly hardcoded behavior) — edit manually' },
  'pp.upgradeSummary': { zh: '升级：{list}', en: 'Upgrades: {list}' },
  'pp.idLabel': { zh: '卡牌 ID', en: 'Card id' },
  'pp.idHint': { zh: '小写字母/数字/下划线；改名需确认（影响游戏内标识）', en: 'lowercase letters/digits/underscore; renaming needs confirmation (changes the in-game Entry)' },
  'pp.idRenameConfirm': { zh: '把卡牌 id 从「{a}」改为「{b}」？\n\n卡牌的游戏内标识（Entry）会随之改变：\n· 尚未安装/发布过：无影响\n· 已安装或发布过：玩家存档里的这张卡会失效，需要重新发布', en: 'Change card id from "{a}" to "{b}"?\n\nThe in-game Entry changes with it:\n· Not installed/published yet: no impact\n· Already installed/published: the card in player saves breaks and must be republished' },
  'pp.renamed': { zh: '已改名', en: 'Renamed' },
  'pp.renameFailed': { zh: '改名失败：{e}', en: 'Rename failed: {e}' },
  'pp.poolLabel': { zh: '卡池（可多选）', en: 'Card pool (multi-select)' },
  'pp.poolHint': { zh: '勾选多个 = 一张卡进多个角色的卡池', en: 'tick several to put one card in multiple characters\' pools' },
  'pp.typeLabel': { zh: '卡牌类型', en: 'Card Type' },
  'pp.rarityLabel': { zh: '稀有度', en: 'Rarity' },
  'pp.targetLabel': { zh: '目标', en: 'Target' },
  'pp.costLabel': { zh: '能量费用', en: 'Energy Cost' },
  'pp.costHint': { zh: '-1 不可打出', en: '-1 = unplayable' },
  'pp.costHintCurse': { zh: '诅咒/状态惯例为 -1', en: 'Curse/Status convention: -1' },
  'pp.xCost': { zh: 'X 费卡（消耗全部能量）', en: 'X-cost card (spends all energy)' },
  'pp.keywordLabel': { zh: '关键词', en: 'Keywords' },
  'pp.keywordHint': { zh: '点选常用项；其余关键词直接在输入框里加', en: 'Click the common ones; type any other keyword into the box' },
  'pp.showLib': { zh: '显示在卡牌图鉴', en: 'Show in card library' },
  'pp.portraitLabel': { zh: '卡牌立绘（PNG）', en: 'Card art (PNG)' },
  'pp.portraitUnset': { zh: '未设置', en: 'not set' },
  'pp.portraitSuggest': { zh: '· 建议官方 250×190 或高清 1000×760', en: ' · official 250×190 or hi-res 1000×760 recommended' },
  'pp.changeImage': { zh: '更换图片', en: 'Replace image' },
  'pp.uploadImage': { zh: '上传图片', en: 'Upload image' },
  'pp.remove': { zh: '移除', en: 'Remove' },
  'pp.portraitSaved': { zh: '立绘已保存', en: 'Art saved' },
  'pp.portraitSaveFailed': { zh: '立绘保存失败：{e}', en: 'Failed to save art: {e}' },
  'pp.recrop': { zh: '重新裁剪', en: 'Re-crop' },
  'pp.cropTitle': { zh: '选取立绘范围', en: 'Select art region' },
  'pp.cropHint': { zh: '拖动画框选区、四角调整大小；比例按卡型锁定（普通 250:190 / 先古 250:351），输出保持所选区域的原生分辨率，不再整图拉伸', en: 'Drag the box and use corner handles to resize; the ratio is locked to the card type (normal 250:190 / Ancient 250:351). Output keeps the region\'s native resolution instead of stretching the whole image' },
  'pp.cropConfirm': { zh: '裁剪并保存', en: 'Crop & save' },
  'pp.cropCancel': { zh: '取消', en: 'Cancel' },
  'pp.cropOutput': { zh: '输出 {w}×{h}', en: 'Output {w}×{h}' },
  'pp.portraitNote': { zh: '上传后在原图上自由框选立绘范围（按卡型比例裁剪：普通 250×190 横幅；先古卡 250×351 整卡满幅，游戏会在其上叠加名称与描述）。原图会另存一份，随时可「重新裁剪」。任意尺寸均可，游戏内按比例缩放显示。', en: 'After upload, pick the art region freely (cropped to the card type\'s ratio: normal 250×190 landscape; Ancient cards 250×351 full-bleed with name and description overlaid in game). The original is kept so you can re-crop anytime. Any size works — the game scales it.' },
  'pp.portraitLoadFail': { zh: '立绘加载失败', en: 'Failed to load art' },
  'pp.portraitEmpty': { zh: '暂无立绘（游戏内显示官方占位图）', en: 'No art yet (the game shows a placeholder)' },
  'pp.locName': { zh: '卡牌名称', en: 'Card name' },
  'pp.locDesc': { zh: '描述', en: 'Description' },
  'pp.locFlavor': { zh: '风味文本（可选）', en: 'Flavor text (optional)' },
  'pp.genDesc': { zh: '✨ 从效果生成', en: '✨ Generate from effects' },
  'pp.genDescBtn': { zh: '✨ 按效果生成描述', en: '✨ Generate description from effects' },
  'pp.genDescTitle': { zh: '按打出效果生成中/英描述，占位符自动对应数值变量', en: 'Generate zh/en description from play effects; placeholders map to value variables automatically' },
  'pp.genDescBtnTitle': { zh: '按当前打出效果生成中/英描述文本', en: 'Generate zh/en description text from the current play effects' },
  'pp.genDescOverwrite': { zh: '描述已有内容，用按效果生成的文本覆盖（中/英都会覆盖）？', en: 'The description already has content — overwrite it with generated text (both languages)?' },
  'pp.genDescDone': { zh: '已按效果生成描述', en: 'Description generated from effects' },
  'pp.genDescEmpty': { zh: '当前卡牌没有可生成描述的打出效果', en: 'This card has no play effects to generate a description from' },
  'pp.triggerLabel': { zh: '触发时机', en: 'Trigger' },
  'pp.enterCombatWarn': { zh: '战斗开始钩子不带玩家选择上下文：伤害/抽牌/弃牌/消耗/施加效果/失去生命无法执行，保存后会被 Runtime 跳过。', en: 'The combat-start hook has no player-choice context: damage / draw / discard / exhaust / power / lose-hp can\'t run and will be skipped by the Runtime.' },
  'pp.noEffects': { zh: '尚无效果。从下方目录添加；描述文本里用 {Damage} {Block} 引用数值。', en: 'No effects yet. Add them from the catalog below; reference values in the text with {Damage} {Block}.' },
  'pp.handler': { zh: '处理器', en: 'Handler' },
  'pp.handlerPh': { zh: '处理器名，如 my_pack_storm', en: 'handler name, e.g. my_pack_storm' },
  'pp.handlerMissing': { zh: '需要处理器 mod 注册此名', en: 'a handler mod must register this name' },
  'pp.amount': { zh: '数值', en: 'Amount' },
  'pp.amountOpt': { zh: '可选 · 含义由处理器定义', en: 'optional · meaning defined by the handler' },
  'pp.params': { zh: 'params（JSON）', en: 'params (JSON)' },
  'pp.tplSummary': { zh: '处理器 mod 模板（点开复制）', en: 'Handler mod template (click to copy)' },
  'pp.exampleSummary': { zh: '真实示例：示例·咔咔 就是这样做出来的（点开看实现）', en: 'Real example: how the built-in "Kaka" demo card was made' },
  'pp.exampleIntro': { zh: '内置示例卡包的「示例·咔咔」就是用这个框完成的：框里只填处理器名 demo_kaka（数值/params 留空），行为全部由下面这段随 Runtime 常驻注册的真实处理器实现——在对面召唤一只改名「咔咔」的邪教徒（13 点生命），并给自己 1 层仪式（每回合结束 +1 力量）：', en: 'The built-in demo card "Kaka" was made with this very box: it only fills the handler name demo_kaka (amount/params empty). All behavior comes from this real handler shipped with the Runtime — it spawns a Cultist renamed "Kaka" (13 HP) on the enemy side and applies 1 Ritual to yourself (+1 Strength at each turn end):' },
  'pp.exampleSaved': { zh: '框里填的内容保存为卡牌 JSON（cards/*.json）：', en: 'What you fill in is saved as card JSON (cards/*.json):' },
  'pp.exampleHandler': { zh: 'Runtime 里的真实处理器源码（RuntimeEntry.cs / SfKaka.cs 节选）：', en: 'The real handler source inside the Runtime (excerpt from RuntimeEntry.cs / SfKaka.cs):' },
  'pp.powerLabel': { zh: '效果', en: 'Power' },
  'pp.playTargetDefault': { zh: '打出目标 / 随机敌人', en: 'Play target / random enemy' },
  'pp.targetSelf': { zh: '自身（增益用）', en: 'Self (for buffs)' },
  'pp.targetAllEnemies': { zh: '全体敌人', en: 'All enemies' },
  'pp.buffHint': { zh: '增益（力量/敏捷）选「自身」', en: 'For buffs (Strength/Dexterity) pick "Self"' },
  'pp.spawnEntry': { zh: '卡牌 Entry', en: 'Card Entry' },
  'pp.spawnEntryPh': { zh: '如 SF_MY_PACK_MY_STRIKE 或 BASH', en: 'e.g. SF_MY_PACK_MY_STRIKE or BASH' },
  'pp.monster': { zh: '怪物', en: 'Monster' },
  'pp.monsterPh': { zh: '如 DampCultist 或 JAW_WORM', en: 'e.g. DampCultist or JAW_WORM' },
  'pp.summonHp': { zh: '生命', en: 'HP' },
  'pp.summonHpOpt': { zh: '可选 · 留空用原生生命', en: 'optional · empty = native HP' },
  'pp.powerSearch': { zh: '搜索效果（中英文名均可）', en: 'Search powers (either language)' },
  'pp.monsterSearch': { zh: '搜索怪物（中英文名均可）', en: 'Search monsters (either language)' },
  'pp.cardSearch': { zh: '搜索卡牌（项目卡与原版卡）', en: 'Search cards (project & vanilla)' },
  'pp.useRaw': { zh: '使用原始值 "{v}"', en: 'Use raw value "{v}"' },
  'pp.unpowered': { zh: '不受 buff 影响', en: 'Unaffected by buffs' },
  'pp.unpoweredTitle': { zh: '勾选后不吃属性 buff 加成（伤害的力量 / 格挡的敏捷）', en: 'When checked, Strength/Dexterity buffs don\'t modify it' },
  'pp.goldNegative': { zh: '负数 = 失去金币', en: 'negative = lose gold' },
  'pp.upgradeDelta': { zh: '升级 +', en: 'Upgrade +' },
  'pp.coreKinds': { zh: '常用', en: 'Common' },
  'pp.extraKinds': { zh: '进阶与扩展', en: 'Advanced & extra' },
  'pp.maxUpgrade': { zh: '最高升级等级', en: 'Max upgrade level' },
  'pp.maxUpgradeHint': { zh: '诅咒/状态通常为 0', en: 'usually 0 for Curse/Status' },
  'pp.hookLiteralNote': { zh: '钩子效果使用字面数值（不参与升级变量），数值变化请同步手写进描述文本。', en: 'Hook effects use literal values (not upgrade variables) — update the description text manually when values change.' },

  // 发布面板（PublishPanel.tsx）
  'pub.title': { zh: '发布卡包', en: 'Publish Pack' },
  'pub.cards': { zh: '{n} 张卡', en: '{n} cards' },
  'pub.workshopId': { zh: '工坊 id {id}', en: 'Workshop id {id}' },
  'pub.unpublished': { zh: '未发布', en: 'unpublished' },
  'pub.issues': { zh: '发布预检发现 {n} 个问题（不阻断，建议先处理）：', en: 'Pre-check found {n} issue(s) (not blocking, but worth fixing):' },
  'pub.local': { zh: '本地使用', en: 'Local use' },
  'pub.version': { zh: '版本号', en: 'Version' },
  'pub.gameReady': { zh: '已就绪', en: 'ready' },
  'pub.gameNotSet': { zh: '未配置', en: 'not set' },
  'pub.gameDirLine': { zh: '游戏目录{state} · 上传器{up}', en: 'Game directory {state} · uploader {up}' },
  'pub.upExtracting': { zh: '释放中…', en: 'extracting…' },
  'pub.install': { zh: '一键安装到游戏', en: 'Install to game' },
  'pub.grantAll': { zh: '在游戏中获得全部卡（测试）', en: 'Grant all cards in game (test)' },
  'pub.grantAllTitle': { zh: '把本卡包全部卡永久加入本局牌组：下一场战斗开始时入组（需要游戏正在运行）', en: 'Permanently adds every card in this pack to your run deck at the start of the next combat (the game must be running)' },
  'pub.exportPack': { zh: '导出卡包（.pck + 清单）', en: 'Export pack (.pck + manifest)' },
  'pub.workshop': { zh: 'Steam 工坊发布（点开展开）', en: 'Steam Workshop publish (click to expand)' },
  'pub.publishedTag': { zh: '· 已发布 #{id}', en: '· published #{id}' },
  'pub.runtimeDep': { zh: 'SpireForge Runtime 工坊 id（写入依赖，玩家订阅时自动安装）', en: 'SpireForge Runtime Workshop id (written into dependencies; subscribers auto-install it)' },
  'pub.runtimeDepPh': { zh: '发布 Runtime 后，把其工坊数字 id 填到这里', en: 'After publishing the Runtime, paste its numeric Workshop id here' },
  'pub.runtimeDepWarn': { zh: '未设置：订阅玩家不会自动安装 SpireForge Runtime，卡包将无法加载。建议先发布 Runtime mod，再把它的工坊 id 填入。', en: 'Not set: subscribers won\'t auto-install the SpireForge Runtime and the pack won\'t load. Publish the Runtime mod first, then fill in its Workshop id.' },
  'pub.visibility': { zh: '可见性', en: 'Visibility' },
  'pub.visPrivate': { zh: '私有（仅自己，推荐先私测）', en: 'Private (only you — recommended first)' },
  'pub.visPublic': { zh: '公开', en: 'Public' },
  'pub.visUnlisted': { zh: '不列出（链接可见）', en: 'Unlisted (link visible)' },
  'pub.visFriends': { zh: '仅好友', en: 'Friends only' },
  'pub.changeNote': { zh: '变更说明（更新时填）', en: 'Change notes (for updates)' },
  'pub.changeNotePh': { zh: '例如：新增 3 张卡牌，平衡性调整', en: 'e.g. 3 new cards, balance tweaks' },
  'pub.prepare': { zh: '生成工坊工作区', en: 'Create workshop workspace' },
  'pub.upload': { zh: '上传到 Steam 工坊', en: 'Upload to Steam Workshop' },
  'pub.uploaderLine': { zh: '上传器：{up}', en: 'Uploader: {up}' },
  'pub.uploaderReady': { zh: '内置 ModUploader（已就绪）', en: 'built-in ModUploader (ready)' },
  'pub.useExternal': { zh: '换用外部 ModUploader.exe', en: 'Use external ModUploader.exe' },
  'pub.workshopNote': { zh: '需 Steam 客户端在线；工坊 id 已持久化到项目，换导出目录复用同一条目；tags 上传后无法修改。', en: 'Requires Steam running; the Workshop id is stored in the project and reused across export folders; tags can\'t change after first upload.' },
  'pub.installedTo': { zh: '已安装到：{dir}\n\n启动游戏即可在卡牌图鉴（无色卡池）中看到本卡包卡牌。\n提示：首次使用需确保 SpireForge Runtime 已随编辑器安装（见文档）。', en: 'Installed to: {dir}\n\nStart the game and the pack\'s cards appear in the card library (colorless pool).\nNote: first-time use requires the SpireForge Runtime, which the editor installs (see docs).' },
  'pub.installOk': { zh: '安装成功', en: 'Installed' },
  'pub.installFailed': { zh: '安装失败：{e}', en: 'Install failed: {e}' },
  'pub.exportedTo': { zh: '卡包已导出到：{dir}', en: 'Pack exported to: {dir}' },
  'pub.exportOk': { zh: '导出成功', en: 'Exported' },
  'pub.exportFailed': { zh: '导出失败：{e}', en: 'Export failed: {e}' },
  'pub.wsGenerated': { zh: '上传工作区已生成：{ws}\n\n内容：content/（卡包文件）+ workshop.json + image.png\n下一步：{next}\n\n注意：工坊 tags 上传后无法修改；预览图需 <1MB（已自动校验）。', en: 'Workshop workspace created: {ws}\n\nContents: content/ (pack files) + workshop.json + image.png\nNext: {next}\n\nNote: Workshop tags can\'t change after first upload; preview image must be <1MB (validated automatically).' },
  'pub.wsNextReady': { zh: '点击「上传到工坊」', en: 'click "Upload to Steam Workshop"' },
  'pub.wsNextConfig': { zh: '在下方设置 ModUploader.exe 路径后上传', en: 'set the ModUploader.exe path below, then upload' },
  'pub.wsOk': { zh: '工作区已生成', en: 'Workspace created' },
  'pub.wsFailed': { zh: '生成失败：{e}', en: 'Failed: {e}' },
  'pub.wsNeed': { zh: '请先生成上传工作区', en: 'Generate the workspace first' },
  'pub.uploaded': { zh: '上传完成：\n{out}\n\n首次上传后 workspace 内会生成 mod_id.txt（工坊 id），已自动记入项目——\n后续更新换任何导出目录都会复用同一工坊条目。', en: 'Upload finished:\n{out}\n\nAfter the first upload the workspace contains mod_id.txt (Workshop id), recorded into the project automatically —\nfuture updates reuse the same Workshop entry from any export folder.' },
  'pub.uploadDone': { zh: '上传完成', en: 'Uploaded' },
  'pub.uploadFailed': { zh: '上传失败：{e}', en: 'Upload failed: {e}' },
  'pub.uploaderSaved': { zh: '上传器路径已保存', en: 'Uploader path saved' },

  // 项目设置（ProjectSettingsModal.tsx）
  'ps.title': { zh: '项目设置', en: 'Project Settings' },
  'ps.metaLine': { zh: '包 id {id}（发布后不可改）· 工坊 id {ws}', en: 'Pack id {id} (fixed after publishing) · Workshop id {ws}' },
  'ps.name': { zh: '项目名称（工具栏与工坊标题）', en: 'Project name (toolbar & workshop title)' },
  'ps.author': { zh: '作者（署名进卡包清单）', en: 'Author (credited in the pack manifest)' },
  'ps.desc': { zh: '简介（发布到工坊时的介绍文本）', en: 'Description (workshop page text)' },
  'ps.descPh': { zh: '这个卡包里有什么？玩法/主题/卡牌数量…', en: 'What\'s in this pack? Theme/mechanics/card count…' },
  'ps.cancel': { zh: '取消', en: 'Cancel' },
  'ps.save': { zh: '保存', en: 'Save' },
  'ps.saved': { zh: '项目信息已保存', en: 'Project info saved' },

  // 原版导入（VanillaImportModal.tsx）
  'vi.title': { zh: '导入原版卡', en: 'Import vanilla card' },
  'vi.metaLine': { zh: '{n} 张 · 游戏 v{v} 数据，作为"覆盖卡"载入：改费用/数值/文案/行为，发布后游戏内原版卡被替换', en: '{n} cards · game v{v} data — loaded as an override: change cost/numbers/text/behavior; replaces the vanilla card in game after publishing' },
  'vi.loading': { zh: '加载目录…', en: 'Loading catalog…' },
  'vi.search': { zh: '搜索卡名（中/英）或 Entry，如 痛击 / bash', en: 'Search name (zh/en) or Entry, e.g. bash' },
  'vi.noMatch': { zh: '没有匹配的卡牌', en: 'No matching cards' },
  'vi.imported': { zh: '已导入原版卡「{name}」（覆盖 {entry}）', en: 'Imported vanilla "{name}" (overriding {entry})' },
  'vi.importFailed': { zh: '导入失败：{e}', en: 'Import failed: {e}' },

  // store 提示
  'st.partialSaveFail': { zh: '部分修改保存失败，请重试', en: 'Some edits failed to save — please retry' },
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
  None: { zh: '无', en: 'None' },
  Self: { zh: '自身', en: 'Self' },
  AnyEnemy: { zh: '单一敌人', en: 'One enemy' },
  AllEnemies: { zh: '全体敌人', en: 'All enemies' },
  RandomEnemy: { zh: '随机敌人', en: 'Random enemy' },
  AnyPlayer: { zh: '任一玩家', en: 'Any player' },
  AnyAlly: { zh: '单一友方', en: 'One ally' },
  AllAllies: { zh: '全体友方', en: 'All allies' },
  TargetedNoCreature: { zh: '无目标指向', en: 'No creature' },
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

/** 关键词点选（k = 存储/游戏枚举名；中文取官方本地化，title 展示官方描述） */
export const KEYWORD_CHIPS: { k: string; label: L; hint: L }[] = [
  { k: 'Innate', label: { zh: '固有', en: 'Innate' }, hint: { zh: '每场战斗开始时这张牌会出现在你的手牌。', en: 'At the start of each combat, this card is in your hand.' } },
  { k: 'Retain', label: { zh: '保留', en: 'Retain' }, hint: { zh: '保留的牌不会在回合结束时被弃掉。', en: 'Retained cards are not discarded at the end of your turn.' } },
  { k: 'Ethereal', label: { zh: '虚无', en: 'Ethereal' }, hint: { zh: '如果这张牌在这个回合结束时留在你的手牌中，则将其消耗。', en: 'If this card is in your hand at the end of the turn, Exhaust it.' } },
  { k: 'Exhaust', label: { zh: '消耗', en: 'Exhaust' }, hint: { zh: '在战斗结束前移除。', en: 'Removed until the end of combat.' } },
  { k: 'Unplayable', label: { zh: '不能被打出', en: 'Unplayable' }, hint: { zh: '不能被打出的牌无法被打出。', en: 'Unplayable cards can\'t be played.' } },
  { k: 'Sly', label: { zh: '奇巧', en: 'Sly' }, hint: { zh: '如果这张牌在你的回合结束前从你的手牌中被丢弃，则免费将其打出。', en: 'If discarded from hand before your turn ends, play it for free.' } },
  { k: 'Eternal', label: { zh: '永恒', en: 'Eternal' }, hint: { zh: '无法从你的牌组中移除或变化。', en: 'Can\'t be removed or transformed from your deck.' } },
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
  discard: { label: { zh: '随机弃牌', en: 'Discard' }, varName: '', desc: { zh: '随机弃置 N 张手牌（无法指定哪张）', en: 'Discard N random cards from hand (can\'t pick which)' } },
  exhaust: { label: { zh: '随机消耗', en: 'Exhaust' }, varName: '', desc: { zh: '随机消耗 N 张手牌（无法指定哪张）', en: 'Exhaust N random cards from hand (can\'t pick which)' } },
  gold: { label: { zh: '获得金币', en: 'Gold' }, varName: '', desc: { zh: '获得金币；负数 = 失去金币', en: 'Gain gold; negative = lose gold' } },
  lose_hp: { label: { zh: '失去生命', en: 'Lose HP' }, varName: '', desc: { zh: '自身失去 N 点生命（无来源、不可格挡）', en: 'Lose N HP for self (sourceless, unblockable)' } },
  max_hp: { label: { zh: '生命上限', en: 'Max HP' }, varName: '', desc: { zh: '为自身增加 N 点生命上限', en: 'Gain N Max HP for self' } },
  power: { label: { zh: '施加增益/减益', en: 'Apply power' }, varName: '', desc: { zh: '给目标施加所选效果（下拉含全部游戏效果官方中文名，也可输入任意 PowerModel 名）', en: 'Apply a power to the target (the dropdown lists every game power with its official Chinese name — or type any PowerModel name)' } },
  spawn: { label: { zh: '生成卡牌', en: 'Spawn card' }, varName: '', desc: { zh: '把一张卡（自定义或原版 Entry）加入抽牌堆/手牌/弃牌堆', en: 'Put a card (custom or vanilla Entry) into draw/hand/discard pile' } },
  summon: { label: { zh: '召唤敌人', en: 'Summon enemy' }, varName: '', desc: { zh: '在对面召唤一只怪物（下拉含全部游戏怪物官方中文译名；不填生命用原生值）', en: 'Summon a monster on the enemy side (the dropdown lists every game monster with its official Chinese name; leave HP empty to use its native range)' } },
  custom: { label: { zh: '自定义', en: 'Custom' }, varName: '', desc: { zh: '行为由处理器 mod 定义（SfEffects 注册表）', en: 'Behavior defined by a handler mod (SfEffects registry)' } },
};

/** 效果触发时机 */
export type TriggerKey = 'play' | 'on_draw' | 'on_discard' | 'on_exhaust' | 'on_enter_combat' | 'on_turn_end_in_hand';

export const TRIGGER_OPTIONS: { v: TriggerKey; label: L; hint: L }[] = [
  { v: 'play', label: { zh: '打出时', en: 'On play' }, hint: { zh: '打出这张牌时依次执行（主效果，可升级）', en: 'Run in order when the card is played (main effects, upgradeable)' } },
  { v: 'on_draw', label: { zh: '抽到时', en: 'On draw' }, hint: { zh: '此牌被抽到时（含开局起手）', en: 'When this card is drawn (including the opening hand)' } },
  { v: 'on_discard', label: { zh: '被弃时', en: 'On discard' }, hint: { zh: '此牌被弃置时', en: 'When this card is discarded' } },
  { v: 'on_exhaust', label: { zh: '被消耗时', en: 'On exhaust' }, hint: { zh: '此牌被消耗时（含虚无）', en: 'When this card is exhausted (including Ethereal)' } },
  { v: 'on_enter_combat', label: { zh: '战斗开始时', en: 'Combat start' }, hint: { zh: '战斗开始时；仅支持格挡/回复/能量/自定义', en: 'At combat start; only block/heal/energy/custom' } },
  { v: 'on_turn_end_in_hand', label: { zh: '回合末在手', en: 'Turn end in hand' }, hint: { zh: '回合结束时若在手中；常配合保留关键词', en: 'At turn end while in hand; usually paired with Retain' } },
];

/** 钩子上下文取敌方式 */
export const HOOK_TARGET_OPTIONS: { v: string; label: L }[] = [
  { v: 'random_enemy', label: { zh: '随机敌人', en: 'Random enemy' } },
  { v: 'self', label: { zh: '自身', en: 'Self' } },
  { v: 'all_enemies', label: { zh: '全体敌人', en: 'All enemies' } },
];
