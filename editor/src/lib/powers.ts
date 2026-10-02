/** 游戏力量目录（265 项）——由 tools/extract-power-catalog.mjs 生成，勿手改。
 *  数据源：反编译 v0.111.0 全部具体 PowerModel 子类 + spire-codex zhs 官方译名。
 *  name = SfPowerResolver 可解析名（类名去 Power 后缀）；zh 官方中文名（无译名的回落原名）。 */
export interface PowerEntry {
  /** SfPowerResolver 解析名（如 Vulnerable） */
  name: string;
  /** 官方中文名（如 易伤） */
  zh: string;
  /** 官方中文描述 */
  desc: string;
  /** 是否减益（默认施加给敌人） */
  debuff: boolean;
}

export const POWERS: PowerEntry[] = [
  {
    "name": "PaleBlueDot",
    "zh": "暗淡蓝点",
    "desc": "如果你在一回合内打出至少[blue]5[/blue]张牌，则在你的下一回合开始时额外抽[blue][Amount][/blue]张牌。",
    "debuff": false
  },
  {
    "name": "ShadowStep",
    "zh": "暗影步",
    "desc": "在下个回合，攻击造成双倍伤害。",
    "debuff": false
  },
  {
    "name": "Soar",
    "zh": "翱翔",
    "desc": "在落地之前受到的伤害减少[blue]50%[/blue]。",
    "debuff": false
  },
  {
    "name": "RetainHand",
    "zh": "保留手牌",
    "desc": "在[blue]2[/blue]回合内[gold]保留[/gold]你的[gold]手牌[/gold]。",
    "debuff": false
  },
  {
    "name": "Tyranny",
    "zh": "暴政",
    "desc": "在你的回合开始时，抽一张牌然后[gold]消耗[/gold]你的一张[gold]手牌[/gold]。",
    "debuff": false
  },
  {
    "name": "Burst",
    "zh": "爆发",
    "desc": "本回合，你的下一张技能牌会多打出一次。",
    "debuff": false
  },
  {
    "name": "ToolsOfTheTrade",
    "zh": "必备工具",
    "desc": "在你的回合开始时，抽[blue]1[/blue]张牌并丢弃[blue]1[/blue]张牌。",
    "debuff": false
  },
  {
    "name": "Barricade",
    "zh": "壁垒",
    "desc": "[gold]格挡[/gold]不会在你的回合开始时被移除。",
    "debuff": false
  },
  {
    "name": "Hailstorm",
    "zh": "冰雹风暴",
    "desc": "在你的回合结束时，如果你有[gold]冰霜[/gold]充能球，则对所有敌人造成[blue]6[/blue]点伤害。",
    "debuff": false
  },
  {
    "name": "Unmovable",
    "zh": "不动",
    "desc": "每个回合你第一次从卡牌中获得[gold]格挡[/gold]时，将数值翻倍。",
    "debuff": false
  },
  {
    "name": "NoDraw",
    "zh": "不可抽牌",
    "desc": "你在本回合无法再抽更多牌。",
    "debuff": true
  },
  {
    "name": "NoBlock",
    "zh": "不可格挡",
    "desc": "你无法从卡牌中获得[gold]格挡[/gold]。",
    "debuff": true
  },
  {
    "name": "Cruelty",
    "zh": "残酷",
    "desc": "以上敌人受到额外伤害。",
    "debuff": false
  },
  {
    "name": "Blur",
    "zh": "残影",
    "desc": "你的下一回合开始时[gold]格挡[/gold]不会消失。",
    "debuff": false
  },
  {
    "name": "Tangled",
    "zh": "缠结",
    "desc": "本回合，攻击牌的[gold]能量[/gold]费用增加[blue]1[/blue]。",
    "debuff": true
  },
  {
    "name": "Gigantification",
    "zh": "超巨化",
    "desc": "你打出的下一张攻击牌造成三倍伤害。",
    "debuff": false
  },
  {
    "name": "Asleep",
    "zh": "沉睡",
    "desc": "在失去生命时或在[blue][Amount][/blue]回合后苏醒。",
    "debuff": false
  },
  {
    "name": "Accelerant",
    "zh": "触媒",
    "desc": "[gold]中毒[/gold]会多触发一次。",
    "debuff": false
  },
  {
    "name": "Genesis",
    "zh": "创世纪",
    "desc": "在你的回合开始时，获得[star:1]。",
    "debuff": false
  },
  {
    "name": "PillarOfCreation",
    "zh": "创世之柱",
    "desc": "每当你创造一张牌时，获得[blue]5[/blue]点[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "CreativeAi",
    "zh": "创造性AI",
    "desc": "在你的回合开始时，将一张随机能力牌添加到你的[gold]手牌[/gold]。",
    "debuff": false
  },
  {
    "name": "HammerTime",
    "zh": "锤子时间",
    "desc": "每当你[gold]铸造[/gold]时，所有盟友也[gold]铸造[/gold]相同数值。",
    "debuff": false
  },
  {
    "name": "Veilpiercer",
    "zh": "刺破帷幕",
    "desc": "你打出的下一张[gold]虚无[/gold]牌耗能为[blue]0[/blue]。",
    "debuff": false
  },
  {
    "name": "Debilitate",
    "zh": "摧残",
    "desc": "[blue]2[/blue]回合内，[gold]易伤[/gold]和[gold]虚弱[/gold]的效果变为两倍。",
    "debuff": true
  },
  {
    "name": "Frail",
    "zh": "脆弱",
    "desc": "脆弱时，从卡牌中获得的[gold]格挡[/gold]值减少[blue]25%[/blue]。",
    "debuff": true
  },
  {
    "name": "Skittish",
    "zh": "胆小",
    "desc": "[gold]This creature[/gold]每回合第一次被命中时，获得[blue][Amount][/blue]点[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "Rebound",
    "zh": "弹回",
    "desc": "将你在本回合打出的下一张牌放置到你的[gold]抽牌堆[/gold]顶部。",
    "debuff": false
  },
  {
    "name": "FanOfKnives",
    "zh": "刀扇",
    "desc": "[gold]小刀[/gold]会命中所有敌人。",
    "debuff": false
  },
  {
    "name": "Countdown",
    "zh": "倒数计时",
    "desc": "在你的回合开始时，给予随机敌人[blue]6[/blue]层[gold]灾厄[/gold]。",
    "debuff": false
  },
  {
    "name": "Reflect",
    "zh": "倒映",
    "desc": "被格挡的伤害会反弹到攻击者身上。",
    "debuff": false
  },
  {
    "name": "Heist",
    "zh": "盗窃",
    "desc": "被击杀时，返还所有偷走的[gold]金币[/gold]。",
    "debuff": false
  },
  {
    "name": "Hellraiser",
    "zh": "地狱狂徒",
    "desc": "每当你抽到名字中有“打击”的牌时，对一名随机敌人打出这张牌。",
    "debuff": false
  },
  {
    "name": "WitheringPresence",
    "zh": "凋萎存在",
    "desc": "你每打出[blue]6[/blue]张牌，将一张[gold]凋萎[/gold]加入你的[gold]手牌[/gold]。",
    "debuff": false
  },
  {
    "name": "Hang",
    "zh": "吊杀",
    "desc": "所有[gold]吊杀[/gold]牌对这名敌人造成[blue]2[/blue]倍伤害。",
    "debuff": true
  },
  {
    "name": "Iteration",
    "zh": "迭代",
    "desc": "每回合你第一次抽到状态牌时，抽更多牌。",
    "debuff": false
  },
  {
    "name": "NoxiousFumes",
    "zh": "毒雾",
    "desc": "在你的回合开始时，给予所有敌人[blue]2[/blue]层[gold]中毒[/gold]。",
    "debuff": false
  },
  {
    "name": "Monologue",
    "zh": "独白",
    "desc": "每当你在本回合打出卡牌时，在本回合获得[blue]1[/blue]点[gold]力量[/gold]。\n当前已经获得[blue]0[/blue]点[gold]力量[/gold]。",
    "debuff": false
  },
  {
    "name": "Rampart",
    "zh": "盾墙",
    "desc": "在玩家回合开始时，高塔炮手获得[blue]25[/blue]点[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "TagTeam",
    "zh": "多人组队",
    "desc": "另一名玩家对该敌人的下一张攻击牌会多打出一次。",
    "debuff": true
  },
  {
    "name": "Shroud",
    "zh": "厄运之衣",
    "desc": "你每次给予[gold]灾厄[/gold]时，获得[blue]3[/blue]点[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "DemonForm",
    "zh": "恶魔形态",
    "desc": "在你的回合开始时，获得[blue]2[/blue]点[gold]力量[/gold]。",
    "debuff": false
  },
  {
    "name": "Hex",
    "zh": "恶咒",
    "desc": "幽灵骑士存活时，你的所有卡牌都拥有[gold]虚无[/gold]。",
    "debuff": true
  },
  {
    "name": "CrimsonMantle",
    "zh": "绯红披风",
    "desc": "在你的回合开始时，失去[blue]0[/blue]点生命并获得[blue][Amount][/blue]点[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "TheSealedThrone",
    "zh": "封印王座",
    "desc": "你每打出一张牌，获得[star:1]。",
    "debuff": false
  },
  {
    "name": "Hatch",
    "zh": "孵化",
    "desc": "[blue]X[/blue]回合后孵化。",
    "debuff": false
  },
  {
    "name": "Corruption",
    "zh": "腐化",
    "desc": "所有技能牌耗能变为[blue]0[/blue]。\n所有技能牌在打出时被[gold]消耗[/gold]。",
    "debuff": false
  },
  {
    "name": "CorrosiveWave",
    "zh": "腐蚀波",
    "desc": "你在本回合每抽到一张牌，就给予所有敌人[blue]2[/blue]点[gold]中毒[/gold]。",
    "debuff": false
  },
  {
    "name": "Duplication",
    "zh": "复制",
    "desc": "你下一张打出的牌会多打出一次。",
    "debuff": false
  },
  {
    "name": "Plating",
    "zh": "覆甲",
    "desc": "在你的回合结束时获得[blue][Amount][/blue]点[gold]格挡[/gold]。[gold]覆甲[/gold]会在你的回合开始时减少[blue]1[/blue]层。",
    "debuff": false
  },
  {
    "name": "Improvement",
    "zh": "改善",
    "desc": "在战斗结束时，随机[gold]升级[/gold]一张牌。",
    "debuff": false
  },
  {
    "name": "Calcify",
    "zh": "钙化",
    "desc": "[gold]奥斯提[/gold]的攻击造成额外伤害。",
    "debuff": false
  },
  {
    "name": "HighVoltage",
    "zh": "高电压",
    "desc": "[gold]This creature[/gold]的回合结束时，会获得[blue][Amount][/blue]点[gold]力量[/gold]。",
    "debuff": false
  },
  {
    "name": "Tracking",
    "zh": "跟踪",
    "desc": "[gold]虚弱[/gold]的敌人从攻击牌中受到[blue]2[/blue]倍伤害。",
    "debuff": false
  },
  {
    "name": "TheGambit",
    "zh": "孤注一掷",
    "desc": "如果你在这场战斗中受到未被格挡的攻击伤害，则立即死亡。",
    "debuff": true
  },
  {
    "name": "SpectrumShift",
    "zh": "光谱偏移",
    "desc": "在你的回合开始时，将[blue]1[/blue]张随机无色牌添加到你的[gold]手牌[/gold]中。",
    "debuff": false
  },
  {
    "name": "Sneaky",
    "zh": "鬼祟",
    "desc": "每当另一名玩家攻击敌人时，获得[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "RollingBoulder",
    "zh": "滚石",
    "desc": "在你的回合开始时，对所有敌人造成[blue][Amount][/blue]点伤害，然后将此伤害增加[blue]5[/blue]。",
    "debuff": false
  },
  {
    "name": "Curious",
    "zh": "好奇",
    "desc": "能力牌的耗能减少[blue]1[/blue][energy:1]。",
    "debuff": false
  },
  {
    "name": "Aggression",
    "zh": "好勇斗狠",
    "desc": "在你的回合开始时，将你[gold]弃牌堆[/gold]的一张随机攻击牌放入你的[gold]手牌[/gold]并将其在本场战斗中[gold]升级[/gold]。",
    "debuff": false
  },
  {
    "name": "DarkEmbrace",
    "zh": "黑暗之拥",
    "desc": "每当有一张牌被[gold]消耗[/gold]时，抽[blue]1[/blue]张牌。",
    "debuff": false
  },
  {
    "name": "BlackHole",
    "zh": "黑洞",
    "desc": "每当你花费或获得[star:1]时，对所有敌人造成[blue]3[/blue]点伤害。",
    "debuff": false
  },
  {
    "name": "Plow",
    "zh": "横冲直撞",
    "desc": "[gold]This creature[/gold]的生命值第一次下降到[blue][Amount][/blue]或更低时，将其[gold]击晕[/gold]并使其失去所有[gold]力量[/gold]。",
    "debuff": true
  },
  {
    "name": "BackAttackLeft",
    "zh": "后方攻击",
    "desc": "从后方对你攻击时，造成的伤害增加[blue]50%[/blue]。",
    "debuff": false
  },
  {
    "name": "BackAttackRight",
    "zh": "后方攻击",
    "desc": "从后方对你攻击时，造成的伤害增加[blue]50%[/blue]。",
    "debuff": false
  },
  {
    "name": "Guarded",
    "zh": "护卫",
    "desc": "从敌人处受到的伤害减半。",
    "debuff": false
  },
  {
    "name": "Slippery",
    "zh": "滑溜",
    "desc": "[gold]This creature[/gold]下[blue][Amount][/blue]次要失去生命值时，只会失去[blue]1[/blue]点生命。",
    "debuff": false
  },
  {
    "name": "TrashToTreasure",
    "zh": "化废为宝",
    "desc": "每当你生成状态牌的时候，随机[gold]生成[/gold][blue]1[/blue]个充能球。",
    "debuff": false
  },
  {
    "name": "Nostalgia",
    "zh": "怀旧",
    "desc": "每回合被打出第一张攻击或技能牌，将其放置于你的[gold]抽牌堆[/gold]顶端。",
    "debuff": false
  },
  {
    "name": "Orbit",
    "zh": "环绕轨道",
    "desc": "你每花费[energy:4]，获得[energy:1]。",
    "debuff": false
  },
  {
    "name": "Buffer",
    "zh": "缓冲",
    "desc": "阻止下一次你受到的生命值损伤。",
    "debuff": false
  },
  {
    "name": "Slow",
    "zh": "缓慢",
    "desc": "你在本回合内每打出一张牌，该敌人本回合从攻击牌中受到的伤害增加[blue]10%[/blue]。",
    "debuff": true
  },
  {
    "name": "Illusion",
    "zh": "幻象",
    "desc": "死亡时，下回合会以完整生命值复活。",
    "debuff": false
  },
  {
    "name": "PhantomBlades",
    "zh": "幻影之刃",
    "desc": "[gold]小刀[/gold]获得[gold]保留[/gold]。\n你每回合打出的第一张[gold]小刀[/gold]伤害增加[blue]9[/blue]。",
    "debuff": false
  },
  {
    "name": "SpiritOfAsh",
    "zh": "灰烬之灵",
    "desc": "每当你打出一张[gold]虚无[/gold]牌时，获得[blue]4[/blue]点[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "EchoForm",
    "zh": "回响形态",
    "desc": "你每回合打出的第一张牌会多打出一次。",
    "debuff": false
  },
  {
    "name": "Ringing",
    "zh": "昏眩",
    "desc": "本回合你只能打出[blue]1[/blue]张牌。",
    "debuff": true
  },
  {
    "name": "ChainsOfBinding",
    "zh": "魂缚锁链",
    "desc": "每回合抽到的前[blue]3[/blue]张牌将会被侵蚀为[gold]魂缚[/gold]。",
    "debuff": true
  },
  {
    "name": "Confused",
    "zh": "混乱",
    "desc": "你的卡牌耗能会在抽取时变化，范围为[blue]0[/blue]到[blue]3[/blue]。",
    "debuff": true
  },
  {
    "name": "Vigor",
    "zh": "活力",
    "desc": "[gold]This creature的[/gold]下一张攻击牌伤害增加造成[blue][Amount][/blue]。",
    "debuff": false
  },
  {
    "name": "VitalSpark",
    "zh": "活力火花",
    "desc": "所有[gold]技能[/gold]牌都拥有[gold]污染[/gold][blue]2[/blue]。",
    "debuff": false
  },
  {
    "name": "FlameBarrier",
    "zh": "火焰屏障",
    "desc": "本回合你每次受到攻击时，反击造成[blue]4[/blue]点伤害。",
    "debuff": false
  },
  {
    "name": "Knockdown",
    "zh": "击倒",
    "desc": "该敌人在本回合受到的来自其他玩家的伤害变为[blue][Amount][/blue]倍。",
    "debuff": true
  },
  {
    "name": "Ravenous",
    "zh": "饥饿",
    "desc": "当有敌人死亡时，噬尸蛞蝓会立即吃下尸体，在本回合被[gold]击晕[/gold]然后获得[blue]1[/blue]点[gold]力量[/gold]。",
    "debuff": false
  },
  {
    "name": "MachineLearning",
    "zh": "机器学习",
    "desc": "在你的回合开始时，额外抽[blue]1[/blue]张牌。",
    "debuff": false
  },
  {
    "name": "Enrage",
    "zh": "激怒",
    "desc": "每当你打出一张技能牌时，获得[blue]2[/blue]点[gold]力量[/gold]。",
    "debuff": false
  },
  {
    "name": "Focus",
    "zh": "集中",
    "desc": "提升充能球的效力[blue][/blue]点。",
    "debuff": false
  },
  {
    "name": "Stratagem",
    "zh": "计策",
    "desc": "你每次洗牌[gold]抽牌堆[/gold]时，从中选择[blue]1[/blue]张牌放入你的[gold]手牌[/gold]。",
    "debuff": false
  },
  {
    "name": "WellLaidPlans",
    "zh": "计划妥当",
    "desc": "在你的回合结束时，[gold]保留[/gold]最多[blue]1[/blue]张手牌。",
    "debuff": false
  },
  {
    "name": "ForegoneConclusion",
    "zh": "既定事项",
    "desc": "下回合，将你[gold]抽牌堆[/gold]中的[blue]3[/blue]张牌放入你的[gold]手牌[/gold]。",
    "debuff": false
  },
  {
    "name": "Infested",
    "zh": "寄生物",
    "desc": "死亡时，召唤……某种东西。",
    "debuff": false
  },
  {
    "name": "Flanking",
    "zh": "夹击",
    "desc": "其他盟友在本回合对这名敌人造成[blue]2倍[/blue]攻击伤害。",
    "debuff": true
  },
  {
    "name": "Shriek",
    "zh": "尖叫",
    "desc": "[gold]This creature[/gold]的生命值第一次降到[blue][Amount][/blue]或以下时，会被[gold]击晕[/gold]。",
    "debuff": true
  },
  {
    "name": "ToricToughness",
    "zh": "坚韧之环",
    "desc": "在下[blue]2[/blue]个回合开始时获得[blue]5[/blue]点[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "SwordSage",
    "zh": "剑圣",
    "desc": "[gold]君王之剑[/gold]获得[gold]重放[/gold][blue]1[/blue]。",
    "debuff": false
  },
  {
    "name": "Reattach",
    "zh": "接续",
    "desc": "如果身体还有存活的其他部分，则在[blue]2[/blue]回合后以[blue]25[/blue]点生命复活。",
    "debuff": false
  },
  {
    "name": "Calamity",
    "zh": "劫难",
    "desc": "每当你打出一张攻击牌时，将一张随机攻击牌添加到你的[gold]手牌[/gold]。",
    "debuff": false
  },
  {
    "name": "Constrict",
    "zh": "紧缠",
    "desc": "蛇行扼杀者存活时，在你的回合结束时受到[blue]1[/blue]点伤害。",
    "debuff": true
  },
  {
    "name": "Strangle",
    "zh": "紧勒",
    "desc": "本回合，你每次打出牌时，这名敌人失去[blue]2[/blue]点生命。",
    "debuff": true
  },
  {
    "name": "SicEm",
    "zh": "紧追不放",
    "desc": "本回合，每当[gold]奥斯提[/gold]命中这个敌人时，[gold]召唤[/gold][blue]3[/blue]。",
    "debuff": true
  },
  {
    "name": "ForbiddenGrimoire",
    "zh": "禁忌魔典",
    "desc": "在战斗结束时，从你的[gold]牌组[/gold]中移除一张牌。",
    "debuff": false
  },
  {
    "name": "Thorns",
    "zh": "荆棘",
    "desc": "当被攻击命中时，反击造成伤害。",
    "debuff": false
  },
  {
    "name": "Stampede",
    "zh": "惊逃",
    "desc": "在你的回合结束时，随机打出你[gold]手牌[/gold]中的[blue]1[/blue]张攻击牌攻击随机敌人。",
    "debuff": false
  },
  {
    "name": "Neurosurge",
    "zh": "精神过载",
    "desc": "在你的回合开始时，给予自身[blue]3[/blue]层[gold]灾厄[/gold]。",
    "debuff": true
  },
  {
    "name": "Accuracy",
    "zh": "精准",
    "desc": "[gold]小刀[/gold]造成额外伤害。",
    "debuff": false
  },
  {
    "name": "Haunt",
    "zh": "纠缠",
    "desc": "每当你打出一张[gold]灵魂[/gold]时，一个随机敌人失去[blue]3[/blue]点生命。",
    "debuff": false
  },
  {
    "name": "Colossus",
    "zh": "巨像",
    "desc": "[blue][Amount][/blue]回合内，你从[gold]易伤[/gold]敌人处受到的伤害减少[blue]50%[/blue]。",
    "debuff": false
  },
  {
    "name": "Stock",
    "zh": "库存",
    "desc": "被击杀时，召唤一个全新的巨斧机器人。",
    "debuff": false
  },
  {
    "name": "Rage",
    "zh": "狂怒",
    "desc": "本回合，你每打出一张攻击牌就获得[blue]3[/blue]点[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "Intercept",
    "zh": "拦截",
    "desc": "你正在掩护另一名玩家。本回合所有对其发起的攻击都会转移到你的身上。",
    "debuff": false
  },
  {
    "name": "Sloth",
    "zh": "懒惰",
    "desc": "你在每个回合不能打出超过[blue]3[/blue]张牌。",
    "debuff": true
  },
  {
    "name": "Fasten",
    "zh": "勒紧",
    "desc": "从“防御”牌中额外获得[blue]4[/blue]点[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "Storm",
    "zh": "雷暴",
    "desc": "你每打出一张能力牌，就[gold]生成[/gold][blue]1[/blue]个[gold]闪电充能球[/gold]。",
    "debuff": false
  },
  {
    "name": "Thunder",
    "zh": "雷霆",
    "desc": "每当你[gold]激发闪电充能球[/gold]时，对命中的敌人造成[blue]8[/blue]点伤害。",
    "debuff": false
  },
  {
    "name": "Coolant",
    "zh": "冷却剂",
    "desc": "在你的回合开始时，每有一种不同的充能球获得[blue]3[/blue]点[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "Strength",
    "zh": "力量",
    "desc": "增加攻击牌造成的伤害值[blue][/blue]点。",
    "debuff": false
  },
  {
    "name": "OneTwoPunch",
    "zh": "连环拳",
    "desc": "本回合，你的下一张攻击牌会多打出一次。",
    "debuff": false
  },
  {
    "name": "Territorial",
    "zh": "领地意识",
    "desc": "在[gold]this creature[/gold]的回合结束时，获得[blue][Amount][/blue]点[gold]力量[/gold]。",
    "debuff": false
  },
  {
    "name": "Leadership",
    "zh": "领袖气质",
    "desc": "所有其他盟友造成[blue]1[/blue]点额外伤害。",
    "debuff": false
  },
  {
    "name": "Demesne",
    "zh": "领域",
    "desc": "在你的回合开始时，获得[blue]1[/blue]点[gold]能量[/gold]并额外抽[blue]1[/blue]张牌。",
    "debuff": false
  },
  {
    "name": "Galvanic",
    "zh": "流电",
    "desc": "能力牌被侵蚀为[gold]流电[/gold]。",
    "debuff": false
  },
  {
    "name": "Mayhem",
    "zh": "乱战",
    "desc": "在你的回合开始时，打出你[gold]抽牌堆顶部的[/gold][blue]{}[/blue]张牌。",
    "debuff": false
  },
  {
    "name": "Burrowed",
    "zh": "埋地",
    "desc": "[gold]格挡[/gold]不会在[gold]this creature[/gold]的回合开始时移除。如果所有[gold]格挡[/gold]被移除，则将其[gold]击晕[/gold]。",
    "debuff": false
  },
  {
    "name": "FreeAttack",
    "zh": "免费攻击",
    "desc": "你的下一张攻击牌耗能为[blue]0[/blue][energy:1]。",
    "debuff": false
  },
  {
    "name": "FreeSkill",
    "zh": "免费技能",
    "desc": "你的下一张技能牌耗能为[blue]0[/blue][energy:1]。",
    "debuff": false
  },
  {
    "name": "FreePower",
    "zh": "免费能力",
    "desc": "你的下一张能力牌耗能为[blue]0[/blue] [energy:1]。",
    "debuff": false
  },
  {
    "name": "Dexterity",
    "zh": "敏捷",
    "desc": "增加从卡牌中获得的[gold]格挡[/gold]值[blue][/blue]点。",
    "debuff": false
  },
  {
    "name": "Clarity",
    "zh": "明晰",
    "desc": "在你的下一个回合开始时，额外抽[blue]1[/blue]张牌。",
    "debuff": false
  },
  {
    "name": "Radiance",
    "zh": "明耀",
    "desc": "在下[blue][Amount][/blue]个回合额外获得[energy:1]。",
    "debuff": false
  },
  {
    "name": "MagicBomb",
    "zh": "魔法炸弹",
    "desc": "在你的回合结束时受到[blue]20[/blue]点伤害。如果魔法骑士死亡，消除这一效果。",
    "debuff": true
  },
  {
    "name": "MasterPlanner",
    "zh": "谋划专家",
    "desc": "当你打出技能牌时，该牌获得[gold]奇巧[/gold]。",
    "debuff": false
  },
  {
    "name": "HardToKill",
    "zh": "难以杀灭",
    "desc": "[gold]This creature[/gold]受到的所有伤害和生命减少效果不会超过[blue][Amount][/blue]点。",
    "debuff": false
  },
  {
    "name": "HelloWorld",
    "zh": "你好世界",
    "desc": "在你的回合开始时，将[blue]1[/blue]张随机普通牌加入你的[gold]手牌[/gold]。",
    "debuff": false
  },
  {
    "name": "BiasedCognition",
    "zh": "偏差认知",
    "desc": "在你的回合开始时，失去[blue]1[/blue]点[gold]集中[/gold]。",
    "debuff": true
  },
  {
    "name": "PossessStrength",
    "zh": "抢夺力量",
    "desc": "被击杀时，将偷窃的所有[gold]力量[/gold]返还给玩家。",
    "debuff": false
  },
  {
    "name": "PossessSpeed",
    "zh": "抢夺速度",
    "desc": "被击杀时，将偷窃的所有[gold]敏捷[/gold]返还给玩家。",
    "debuff": false
  },
  {
    "name": "CurlUp",
    "zh": "蜷身",
    "desc": "受到伤害时，蜷起身子并获得格挡。（每场战斗一次）",
    "debuff": false
  },
  {
    "name": "SerpentForm",
    "zh": "群蛇形态",
    "desc": "你每打出一张牌，就对随机一名敌人造成[blue]4[/blue]点伤害。",
    "debuff": false
  },
  {
    "name": "ChildOfTheStars",
    "zh": "群星之子",
    "desc": "每花费一点[star:1]，获得[blue]1[/blue]点[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "Artifact",
    "zh": "人工制品",
    "desc": "[gold]免疫[/gold]负面效果。",
    "debuff": false
  },
  {
    "name": "PersonalHive",
    "zh": "人体蜂房",
    "desc": "每当这个敌人被攻击命中时，在你的[gold]抽牌堆[/gold]中加入[gold]晕眩[/gold]。",
    "debuff": false
  },
  {
    "name": "Furnace",
    "zh": "熔炉",
    "desc": "在你的回合开始时，[gold]铸造[/gold][blue]5[/blue]。",
    "debuff": false
  },
  {
    "name": "Shadowmeld",
    "zh": "融入暗影",
    "desc": "本回合你获得的[gold]格挡[/gold]值翻倍。",
    "debuff": false
  },
  {
    "name": "Tender",
    "zh": "柔嫩",
    "desc": "本回合，你每打出一张牌，就失去[blue]1[/blue]点[gold]力量[/gold]和[blue]1[/blue]点[gold]敏捷[/gold]。",
    "debuff": true
  },
  {
    "name": "Tank",
    "zh": "肉盾",
    "desc": "自身受到敌人伤害加倍。盟友受到敌人伤害减半。",
    "debuff": false
  },
  {
    "name": "Sandpit",
    "zh": "沙坑",
    "desc": "无厌沙虫的能力。",
    "debuff": false
  },
  {
    "name": "Entropy",
    "zh": "熵",
    "desc": "在你的回合开始时，[gold]变化[/gold]你[gold]手牌[/gold]中的[blue]1[/blue]张牌。",
    "debuff": false
  },
  {
    "name": "SentryMode",
    "zh": "哨卫模式",
    "desc": "在你的回合开始时，将[blue]1[/blue]张[gold]扫荡凝视[/gold]加入你的[gold]手牌[/gold]。",
    "debuff": false
  },
  {
    "name": "Panache",
    "zh": "神气制胜",
    "desc": "如果你在本回合再打出[blue]5[/blue]张牌，就对所有敌人造成[blue][Amount][/blue]点伤害。",
    "debuff": false
  },
  {
    "name": "Imbalanced",
    "zh": "失衡",
    "desc": "如果[gold]this creature[/gold]的攻击被完全格挡，则它将被[gold]击晕[/gold]。",
    "debuff": true
  },
  {
    "name": "BattlewornDummyTimeLimit",
    "zh": "时间限制",
    "desc": "你还有[blue]3[/blue]个回合来击败战斗好伙伴。",
    "debuff": false
  },
  {
    "name": "Juggernaut",
    "zh": "势不可当",
    "desc": "每当你获得[gold]格挡[/gold]时，对随机敌人造成[blue]6[/blue]点伤害。",
    "debuff": false
  },
  {
    "name": "Adaptable",
    "zh": "适者生存",
    "desc": "当[gold]this creature[/gold]将要被击败时，它会复活变得更加强大。",
    "debuff": false
  },
  {
    "name": "TheHunt",
    "zh": "狩猎",
    "desc": "在战斗结束时额外获得[blue]1[/blue]份卡牌奖励。",
    "debuff": false
  },
  {
    "name": "Pagestorm",
    "zh": "书页风暴",
    "desc": "每当你抽到一张[gold]虚无[/gold]牌时，抽[blue]1[/blue]张牌。",
    "debuff": false
  },
  {
    "name": "Slumber",
    "zh": "熟睡",
    "desc": "在一定回合经过后或失去生命3次后苏醒。",
    "debuff": false
  },
  {
    "name": "WasteAway",
    "zh": "衰朽",
    "desc": "每回合获得的[gold]能量[/gold]减少[blue]1[/blue]点。",
    "debuff": true
  },
  {
    "name": "DoubleDamage",
    "zh": "双倍伤害",
    "desc": "本回合，攻击造成双倍伤害。",
    "debuff": false
  },
  {
    "name": "Suck",
    "zh": "吮吸",
    "desc": "[gold]This creature[/gold]每次造成未被格挡的伤害时，都会获得[blue][Amount][/blue]点[gold]力量[/gold]。",
    "debuff": false
  },
  {
    "name": "Swipe",
    "zh": "顺走",
    "desc": "击杀这名敌人时，会取回被偷走的卡牌。",
    "debuff": false
  },
  {
    "name": "Rupture",
    "zh": "撕裂",
    "desc": "每当你在自身回合失去生命时，获得[blue]1[/blue]点[gold]力量[/gold]。",
    "debuff": false
  },
  {
    "name": "ReaperForm",
    "zh": "死神形态",
    "desc": "每当你的攻击造成伤害时，同时给予[blue]其{}[/blue]倍的[gold]灾厄[/gold]。",
    "debuff": false
  },
  {
    "name": "DanseMacabre",
    "zh": "死亡之舞",
    "desc": "每当你打出一张耗能为[energy:2]或更高的牌时，获得[blue][Amount][/blue]点[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "Speedster",
    "zh": "速行者",
    "desc": "每当你在回合中抽到一张牌时，对所有敌人造成[blue]1[/blue]点伤害。",
    "debuff": false
  },
  {
    "name": "Shrink",
    "zh": "缩小",
    "desc": "[gold]This creature的[/gold]攻击伤害减少[blue]30%[/blue]。",
    "debuff": true
  },
  {
    "name": "EscapeArtist",
    "zh": "逃脱大师",
    "desc": "在4回合后离开战斗。",
    "debuff": false
  },
  {
    "name": "PainfulStabs",
    "zh": "疼痛戳刺",
    "desc": "每次你受到未被格挡的伤害时，将[blue]1[/blue]张[gold]伤口[/gold]洗入你的[gold]弃牌堆[/gold]。",
    "debuff": false
  },
  {
    "name": "Nemesis",
    "zh": "天罚",
    "desc": "每两个回合结束时，获得[blue]1[/blue]层[gold]无实体[/gold]。",
    "debuff": false
  },
  {
    "name": "Thievery",
    "zh": "偷窃",
    "desc": "攻击时偷走[gold]金币[/gold]。",
    "debuff": false
  },
  {
    "name": "Envenom",
    "zh": "涂毒",
    "desc": "每当你造成未被格挡的伤害时，给予[blue]1[/blue]层[gold]中毒[/gold]。",
    "debuff": false
  },
  {
    "name": "ConsumingShadow",
    "zh": "吞噬暗影",
    "desc": "在你的回合结束时，[gold]激发[/gold]你最左侧的充能球。",
    "debuff": false
  },
  {
    "name": "DevourLife",
    "zh": "吞噬生命",
    "desc": "每当你打出一张[gold]灵魂[/gold]时，[gold]召唤[/gold][blue]1[/blue]。",
    "debuff": false
  },
  {
    "name": "Disintegration",
    "zh": "瓦解",
    "desc": "在你的回合结束时，受到[blue]5[/blue]点伤害。",
    "debuff": true
  },
  {
    "name": "NecroMastery",
    "zh": "亡灵精通",
    "desc": "每当[gold]奥斯提[/gold]失去生命值时，所有敌人失去等量生命值。",
    "debuff": false
  },
  {
    "name": "Royalties",
    "zh": "王国资产",
    "desc": "在战斗结束时，获得[blue]25[/blue][gold]金币[/gold]。",
    "debuff": false
  },
  {
    "name": "MonarchsGaze",
    "zh": "王之凝视",
    "desc": "每当你攻击敌人时，这名敌人在本回合失去[blue]1[/blue]点[gold]力量[/gold]。",
    "debuff": false
  },
  {
    "name": "DieForYou",
    "zh": "为你而死",
    "desc": "[gold]奥斯提[/gold]会吸收所有未被格挡的攻击伤害。",
    "debuff": false
  },
  {
    "name": "Tainted",
    "zh": "污染",
    "desc": "在本回合受到额外的攻击伤害。",
    "debuff": true
  },
  {
    "name": "NoEnergyGain",
    "zh": "无法获得能量",
    "desc": "你在本回合无法再获得更多[energy:1]。",
    "debuff": true
  },
  {
    "name": "InfiniteBlades",
    "zh": "无尽刀刃",
    "desc": "在你的回合开始时，在你的[gold]手牌[/gold]中加入一张[gold]小刀[/gold]。",
    "debuff": false
  },
  {
    "name": "FeelNoPain",
    "zh": "无惧疼痛",
    "desc": "每当有一张牌被消耗时，获得[blue]3[/blue]点[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "Intangible",
    "zh": "无实体",
    "desc": "将本回合受到的所有伤害和生命减少效果降低为[blue]1[/blue]。",
    "debuff": false
  },
  {
    "name": "Arsenal",
    "zh": "武器库",
    "desc": "每当你生成一张牌，就获得[blue]1[/blue]点[gold]力量[/gold]。",
    "debuff": false
  },
  {
    "name": "BeaconOfHope",
    "zh": "希望灯塔",
    "desc": "每当你在你的回合获得[gold]格挡[/gold]时，其他玩家获得相应一半的[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "DrawCardsNextTurn",
    "zh": "下回合抽牌",
    "desc": "在你的下回合开始时，额外抽[blue]1[/blue]张牌。",
    "debuff": false
  },
  {
    "name": "BlockNextTurn",
    "zh": "下回合格挡",
    "desc": "在你的下个回合开始时，获得[blue]4[/blue]点[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "StarNextTurn",
    "zh": "下回合辉星",
    "desc": "在下回合获得1[star:1]。",
    "debuff": false
  },
  {
    "name": "EnergyNextTurn",
    "zh": "下回合能量",
    "desc": "在下回合额外获得[gold]能量[/gold]。",
    "debuff": false
  },
  {
    "name": "SummonNextTurn",
    "zh": "下回合召唤",
    "desc": "在你的下回合开始时，[gold]召唤[/gold][blue]2[/blue]。",
    "debuff": false
  },
  {
    "name": "Demise",
    "zh": "消亡",
    "desc": "[gold]This creature[/gold]的回合结束时，[gold]this creature[/gold]失去[blue][Amount][/blue]点生命。",
    "debuff": true
  },
  {
    "name": "CrabRage",
    "zh": "蟹之怒",
    "desc": "当有盟友死亡时，[gold]this creature[/gold]获得[blue]6[/blue]点[gold]力量[/gold]和[blue]99[/blue]点[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "MindRot",
    "zh": "心灵腐化",
    "desc": "每回合少抽[blue]1[/blue]张牌。",
    "debuff": true
  },
  {
    "name": "Pyre",
    "zh": "薪火之源",
    "desc": "在每回合开始时获得[energy:1]。",
    "debuff": false
  },
  {
    "name": "SignalBoost",
    "zh": "信号增强",
    "desc": "你的下一张能力牌会额外打出一次。",
    "debuff": false
  },
  {
    "name": "Vicious",
    "zh": "凶恶",
    "desc": "每当你给予[gold]易伤[/gold], 抽[blue]1[/blue]张牌。",
    "debuff": false
  },
  {
    "name": "VoidForm",
    "zh": "虚空形态",
    "desc": "每回合你打出的前[blue]2[/blue]张牌会免费打出。",
    "debuff": false
  },
  {
    "name": "CallOfTheVoid",
    "zh": "虚空之唤",
    "desc": "在你的回合开始时，将[blue]1[/blue]张随机牌添加到你的[gold]手牌[/gold]并给予其[gold]虚无[/gold]。",
    "debuff": false
  },
  {
    "name": "Weak",
    "zh": "虚弱",
    "desc": "虚弱的生物造成的攻击伤害减少[blue]25%[/blue]。",
    "debuff": true
  },
  {
    "name": "Spinner",
    "zh": "旋转工艺",
    "desc": "在你的回合开始时，[gold]生成[/gold][blue]1[/blue]个[gold]玻璃充能球[/gold]。",
    "debuff": false
  },
  {
    "name": "SleightOfFlesh",
    "zh": "血肉戏法",
    "desc": "每当你给予一个敌人负面状态时，使其受到[blue]13[/blue]点伤害。",
    "debuff": false
  },
  {
    "name": "Loop",
    "zh": "循环",
    "desc": "在你的回合开始时，触发你最右侧充能球的被动能力。",
    "debuff": false
  },
  {
    "name": "Smokestack",
    "zh": "烟囱",
    "desc": "每当你生成一张状态牌时，对所有敌人造成伤害。",
    "debuff": false
  },
  {
    "name": "Smoggy",
    "zh": "烟雾弥漫",
    "desc": "每回合你只能打出[blue]1[/blue]张技能牌。",
    "debuff": true
  },
  {
    "name": "Oblivion",
    "zh": "湮灭",
    "desc": "你在本回合内每打出一张牌，就给予该敌人[blue]1[/blue]层[gold]灾厄[/gold]。",
    "debuff": true
  },
  {
    "name": "Covered",
    "zh": "掩护",
    "desc": "有盟友在掩护你。所有朝向你的攻击会被改为瞄准对方。",
    "debuff": false
  },
  {
    "name": "Feral",
    "zh": "野性",
    "desc": "每回合你第一次打出0[energy:1]攻击牌时，将其放回你的[gold]手牌[/gold]中。",
    "debuff": false
  },
  {
    "name": "Nightmare",
    "zh": "夜魇",
    "desc": "在下个回合，将所选牌的[blue]3[/blue]张复制品加入你的[gold]手牌[/gold]。",
    "debuff": false
  },
  {
    "name": "Ritual",
    "zh": "仪式",
    "desc": "在你的回合结束时获得[gold]力量[/gold]。",
    "debuff": false
  },
  {
    "name": "Dampen",
    "zh": "抑制",
    "desc": "魔法骑士存活时，你的所有卡牌被[gold]降级[/gold]。",
    "debuff": true
  },
  {
    "name": "Vulnerable",
    "zh": "易伤",
    "desc": "[blue][Amount][/blue]回合内，受到的攻击伤害增加[blue]50%[/blue]。",
    "debuff": true
  },
  {
    "name": "Surprise",
    "zh": "意外",
    "desc": "这个生物有点不太对劲……",
    "debuff": false
  },
  {
    "name": "LightningRod",
    "zh": "引雷针",
    "desc": "在下[blue]2[/blue]个回合开始时，[gold]生成[/gold][blue]1[/blue]个[gold]闪电[/gold]充能球。",
    "debuff": false
  },
  {
    "name": "Gravity",
    "zh": "引力",
    "desc": "本回合，你每打出一张牌，对所有敌人造成[blue]2[/blue]点伤害。",
    "debuff": false
  },
  {
    "name": "HardenedShell",
    "zh": "硬化外壳",
    "desc": "[gold]This creature[/gold]每回合失去的生命值不会超过[blue][Amount][/blue]点。",
    "debuff": false
  },
  {
    "name": "WraithForm",
    "zh": "幽魂形态",
    "desc": "在你的回合开始时，失去[blue]1[/blue]点[gold]敏捷[/gold]。",
    "debuff": true
  },
  {
    "name": "Friendship",
    "zh": "友谊",
    "desc": "每回合开始时获得[energy:1]。",
    "debuff": false
  },
  {
    "name": "Afterimage",
    "zh": "余像",
    "desc": "你每打出一张牌，都获得[blue]1[/blue]点[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "Inferno",
    "zh": "狱火",
    "desc": "在你的回合开始时，失去[blue]0[/blue]点生命。每当你在自己的回合中失去生命时，对所有敌人造成[blue][Amount][/blue]点伤害。",
    "debuff": false
  },
  {
    "name": "BorrowedTime",
    "zh": "预借时间",
    "desc": "卡牌在本回合耗能增加[energy:1]。",
    "debuff": true
  },
  {
    "name": "Juggling",
    "zh": "杂耍",
    "desc": "将你在每回合打出的第三张攻击牌的复制品加入你的[gold]手牌[/gold]。",
    "debuff": false
  },
  {
    "name": "Doom",
    "zh": "灾厄",
    "desc": "在敌人的回合结束时，如果[gold]this creature[/gold]的生命值不高于[blue][Amount][/blue]，则[gold]this creature[/gold]立即死亡。",
    "debuff": true
  },
  {
    "name": "Regen",
    "zh": "再生",
    "desc": "[gold]再生[/gold]会在你的回合结束时回复相应生命。每回合[gold]再生[/gold]的数值会减少[blue]1[/blue]。",
    "debuff": false
  },
  {
    "name": "Surrounded",
    "zh": "遭到包围",
    "desc": "被从后方攻击时受到的伤害增加[blue]50%[/blue]。使用有目标的卡牌或药水来改变你的朝向。",
    "debuff": true
  },
  {
    "name": "TheBomb",
    "zh": "炸弹",
    "desc": "在第[blue]{}[/blue]回合结束时，对所有敌人造成[blue]40[/blue]点伤害。",
    "debuff": false
  },
  {
    "name": "Parry",
    "zh": "招架",
    "desc": "[gold]君王之剑[/gold]现在能让你获得[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "Minion",
    "zh": "爪牙",
    "desc": "爪牙会在他们的领导者死亡时放弃战斗。",
    "debuff": false
  },
  {
    "name": "Flutter",
    "zh": "振翅",
    "desc": "从攻击牌中受到的伤害减少[gold]50%[/gold]。对其造成[blue][Amount][/blue]次攻击伤害可以将其[gold]击晕[/gold]。",
    "debuff": false
  },
  {
    "name": "Conqueror",
    "zh": "征服者",
    "desc": "[gold]君王之剑[/gold]在[blue][Amount][/blue]回合内对[gold]this creature[/gold]造成双倍伤害。",
    "debuff": true
  },
  {
    "name": "SteamEruption",
    "zh": "蒸汽喷发",
    "desc": "被击杀时，在你的下一回合结束时造成伤害。",
    "debuff": false
  },
  {
    "name": "PaperCuts",
    "zh": "纸伤难愈",
    "desc": "每当[gold]this creature[/gold]对你造成未被格挡的伤害时，你失去[blue][Amount][/blue]点[gold]最大生命[/gold]。",
    "debuff": false
  },
  {
    "name": "Lethality",
    "zh": "致死性",
    "desc": "每回合的第一张攻击牌会造成50%额外伤害。",
    "debuff": false
  },
  {
    "name": "Poison",
    "zh": "中毒",
    "desc": "中毒的生物会在自身回合开始时失去生命。中毒层数每回合减少[blue]1[/blue]。",
    "debuff": true
  },
  {
    "name": "SeekingEdge",
    "zh": "追踪之刃",
    "desc": "[gold]君王之剑[/gold]现在会对所有敌人造成伤害。",
    "debuff": false
  },
  {
    "name": "PrepTime",
    "zh": "准备时间",
    "desc": "在你的回合开始时，获得[blue]4[/blue]点[gold]活力[/gold]。",
    "debuff": false
  },
  {
    "name": "Subroutine",
    "zh": "子程序",
    "desc": "你每次打出能力牌时，都获得[blue]1[/blue][energy:1]。",
    "debuff": false
  },
  {
    "name": "SelfFormingClay",
    "zh": "自成型黏土",
    "desc": "在下回合获得[blue]3[/blue]点[gold]格挡[/gold]。",
    "debuff": false
  },
  {
    "name": "Automation",
    "zh": "自动化",
    "desc": "你每抽[blue]10[/blue]张牌时，获得[energy:1]。",
    "debuff": false
  },
  {
    "name": "Ambergris",
    "zh": "Ambergris",
    "desc": "",
    "debuff": false
  },
  {
    "name": "Cacophony",
    "zh": "Cacophony",
    "desc": "",
    "debuff": false
  },
  {
    "name": "Concoct",
    "zh": "Concoct",
    "desc": "",
    "debuff": false
  },
  {
    "name": "Fade",
    "zh": "Fade",
    "desc": "",
    "debuff": false
  },
  {
    "name": "Hibernate",
    "zh": "Hibernate",
    "desc": "",
    "debuff": false
  },
  {
    "name": "HyperbeamFocusDown",
    "zh": "HyperbeamFocusDown",
    "desc": "",
    "debuff": false
  },
  {
    "name": "ImitationLearning",
    "zh": "ImitationLearning",
    "desc": "",
    "debuff": false
  },
  {
    "name": "OneForAll",
    "zh": "OneForAll",
    "desc": "",
    "debuff": false
  },
  {
    "name": "Soulbound",
    "zh": "Soulbound",
    "desc": "",
    "debuff": false
  },
  {
    "name": "Anticipate",
    "zh": "Temporary Dexterity",
    "desc": "在本回合结束前获得[gold]敏捷[/gold]。",
    "debuff": false
  },
  {
    "name": "HelicalDart",
    "zh": "Temporary Dexterity",
    "desc": "在本回合结束前获得[gold]敏捷[/gold]。",
    "debuff": false
  },
  {
    "name": "SpeedPotion",
    "zh": "Temporary Dexterity",
    "desc": "在本回合结束前获得[gold]敏捷[/gold]。",
    "debuff": false
  },
  {
    "name": "FocusedStrike",
    "zh": "Temporary Focus",
    "desc": "在本回合结束前获得[gold]集中[/gold]。",
    "debuff": false
  },
  {
    "name": "Hotfix",
    "zh": "Temporary Focus",
    "desc": "在本回合结束前获得[gold]集中[/gold]。",
    "debuff": false
  },
  {
    "name": "Synchronize",
    "zh": "Temporary Focus",
    "desc": "在本回合结束前获得[gold]集中[/gold]。",
    "debuff": false
  },
  {
    "name": "Coordinate",
    "zh": "Temporary Strength",
    "desc": "在本回合结束前获得[gold]力量[/gold]。",
    "debuff": false
  },
  {
    "name": "FeedingFrenzy",
    "zh": "Temporary Strength",
    "desc": "在本回合结束前获得[gold]力量[/gold]。",
    "debuff": false
  },
  {
    "name": "FlexPotion",
    "zh": "Temporary Strength",
    "desc": "在本回合结束前获得[gold]力量[/gold]。",
    "debuff": false
  },
  {
    "name": "ReptileTrinket",
    "zh": "Temporary Strength",
    "desc": "在本回合结束前获得[gold]力量[/gold]。",
    "debuff": false
  },
  {
    "name": "SetupStrike",
    "zh": "Temporary Strength",
    "desc": "在本回合结束前获得[gold]力量[/gold]。",
    "debuff": false
  },
  {
    "name": "CrushUnder",
    "zh": "Temporary Strength Down",
    "desc": "在本回合结束前失去[gold]力量[/gold]。",
    "debuff": true
  },
  {
    "name": "DarkShackles",
    "zh": "Temporary Strength Down",
    "desc": "在本回合结束前失去[gold]力量[/gold]。",
    "debuff": true
  },
  {
    "name": "DyingStar",
    "zh": "Temporary Strength Down",
    "desc": "在本回合结束前失去[gold]力量[/gold]。",
    "debuff": true
  },
  {
    "name": "EnfeeblingTouch",
    "zh": "Temporary Strength Down",
    "desc": "在本回合结束前失去[gold]力量[/gold]。",
    "debuff": true
  },
  {
    "name": "Mangle",
    "zh": "Temporary Strength Down",
    "desc": "在本回合结束前失去[gold]力量[/gold]。",
    "debuff": true
  },
  {
    "name": "MonarchsGazeStrengthDown",
    "zh": "Temporary Strength Down",
    "desc": "在本回合结束前失去[gold]力量[/gold]。",
    "debuff": true
  },
  {
    "name": "PiercingWail",
    "zh": "Temporary Strength Down",
    "desc": "在本回合结束前失去[gold]力量[/gold]。",
    "debuff": true
  },
  {
    "name": "ShacklingPotion",
    "zh": "Temporary Strength Down",
    "desc": "在本回合结束前失去[gold]力量[/gold]。",
    "debuff": true
  },
  {
    "name": "Underworld",
    "zh": "Underworld",
    "desc": "",
    "debuff": false
  }
];

/** 解析名 → 官方中文名 */
export const POWER_ZH: Record<string, string> = {
  "PaleBlueDot": "暗淡蓝点",
  "ShadowStep": "暗影步",
  "Soar": "翱翔",
  "RetainHand": "保留手牌",
  "Tyranny": "暴政",
  "Burst": "爆发",
  "ToolsOfTheTrade": "必备工具",
  "Barricade": "壁垒",
  "Hailstorm": "冰雹风暴",
  "Unmovable": "不动",
  "NoDraw": "不可抽牌",
  "NoBlock": "不可格挡",
  "Cruelty": "残酷",
  "Blur": "残影",
  "Tangled": "缠结",
  "Gigantification": "超巨化",
  "Asleep": "沉睡",
  "Accelerant": "触媒",
  "Genesis": "创世纪",
  "PillarOfCreation": "创世之柱",
  "CreativeAi": "创造性AI",
  "HammerTime": "锤子时间",
  "Veilpiercer": "刺破帷幕",
  "Debilitate": "摧残",
  "Frail": "脆弱",
  "Skittish": "胆小",
  "Rebound": "弹回",
  "FanOfKnives": "刀扇",
  "Countdown": "倒数计时",
  "Reflect": "倒映",
  "Heist": "盗窃",
  "Hellraiser": "地狱狂徒",
  "WitheringPresence": "凋萎存在",
  "Hang": "吊杀",
  "Iteration": "迭代",
  "NoxiousFumes": "毒雾",
  "Monologue": "独白",
  "Rampart": "盾墙",
  "TagTeam": "多人组队",
  "Shroud": "厄运之衣",
  "DemonForm": "恶魔形态",
  "Hex": "恶咒",
  "CrimsonMantle": "绯红披风",
  "TheSealedThrone": "封印王座",
  "Hatch": "孵化",
  "Corruption": "腐化",
  "CorrosiveWave": "腐蚀波",
  "Duplication": "复制",
  "Plating": "覆甲",
  "Improvement": "改善",
  "Calcify": "钙化",
  "HighVoltage": "高电压",
  "Tracking": "跟踪",
  "TheGambit": "孤注一掷",
  "SpectrumShift": "光谱偏移",
  "Sneaky": "鬼祟",
  "RollingBoulder": "滚石",
  "Curious": "好奇",
  "Aggression": "好勇斗狠",
  "DarkEmbrace": "黑暗之拥",
  "BlackHole": "黑洞",
  "Plow": "横冲直撞",
  "BackAttackLeft": "后方攻击",
  "BackAttackRight": "后方攻击",
  "Guarded": "护卫",
  "Slippery": "滑溜",
  "TrashToTreasure": "化废为宝",
  "Nostalgia": "怀旧",
  "Orbit": "环绕轨道",
  "Buffer": "缓冲",
  "Slow": "缓慢",
  "Illusion": "幻象",
  "PhantomBlades": "幻影之刃",
  "SpiritOfAsh": "灰烬之灵",
  "EchoForm": "回响形态",
  "Ringing": "昏眩",
  "ChainsOfBinding": "魂缚锁链",
  "Confused": "混乱",
  "Vigor": "活力",
  "VitalSpark": "活力火花",
  "FlameBarrier": "火焰屏障",
  "Knockdown": "击倒",
  "Ravenous": "饥饿",
  "MachineLearning": "机器学习",
  "Enrage": "激怒",
  "Focus": "集中",
  "Stratagem": "计策",
  "WellLaidPlans": "计划妥当",
  "ForegoneConclusion": "既定事项",
  "Infested": "寄生物",
  "Flanking": "夹击",
  "Shriek": "尖叫",
  "ToricToughness": "坚韧之环",
  "SwordSage": "剑圣",
  "Reattach": "接续",
  "Calamity": "劫难",
  "Constrict": "紧缠",
  "Strangle": "紧勒",
  "SicEm": "紧追不放",
  "ForbiddenGrimoire": "禁忌魔典",
  "Thorns": "荆棘",
  "Stampede": "惊逃",
  "Neurosurge": "精神过载",
  "Accuracy": "精准",
  "Haunt": "纠缠",
  "Colossus": "巨像",
  "Stock": "库存",
  "Rage": "狂怒",
  "Intercept": "拦截",
  "Sloth": "懒惰",
  "Fasten": "勒紧",
  "Storm": "雷暴",
  "Thunder": "雷霆",
  "Coolant": "冷却剂",
  "Strength": "力量",
  "OneTwoPunch": "连环拳",
  "Territorial": "领地意识",
  "Leadership": "领袖气质",
  "Demesne": "领域",
  "Galvanic": "流电",
  "Mayhem": "乱战",
  "Burrowed": "埋地",
  "FreeAttack": "免费攻击",
  "FreeSkill": "免费技能",
  "FreePower": "免费能力",
  "Dexterity": "敏捷",
  "Clarity": "明晰",
  "Radiance": "明耀",
  "MagicBomb": "魔法炸弹",
  "MasterPlanner": "谋划专家",
  "HardToKill": "难以杀灭",
  "HelloWorld": "你好世界",
  "BiasedCognition": "偏差认知",
  "PossessStrength": "抢夺力量",
  "PossessSpeed": "抢夺速度",
  "CurlUp": "蜷身",
  "SerpentForm": "群蛇形态",
  "ChildOfTheStars": "群星之子",
  "Artifact": "人工制品",
  "PersonalHive": "人体蜂房",
  "Furnace": "熔炉",
  "Shadowmeld": "融入暗影",
  "Tender": "柔嫩",
  "Tank": "肉盾",
  "Sandpit": "沙坑",
  "Entropy": "熵",
  "SentryMode": "哨卫模式",
  "Panache": "神气制胜",
  "Imbalanced": "失衡",
  "BattlewornDummyTimeLimit": "时间限制",
  "Juggernaut": "势不可当",
  "Adaptable": "适者生存",
  "TheHunt": "狩猎",
  "Pagestorm": "书页风暴",
  "Slumber": "熟睡",
  "WasteAway": "衰朽",
  "DoubleDamage": "双倍伤害",
  "Suck": "吮吸",
  "Swipe": "顺走",
  "Rupture": "撕裂",
  "ReaperForm": "死神形态",
  "DanseMacabre": "死亡之舞",
  "Speedster": "速行者",
  "Shrink": "缩小",
  "EscapeArtist": "逃脱大师",
  "PainfulStabs": "疼痛戳刺",
  "Nemesis": "天罚",
  "Thievery": "偷窃",
  "Envenom": "涂毒",
  "ConsumingShadow": "吞噬暗影",
  "DevourLife": "吞噬生命",
  "Disintegration": "瓦解",
  "NecroMastery": "亡灵精通",
  "Royalties": "王国资产",
  "MonarchsGaze": "王之凝视",
  "DieForYou": "为你而死",
  "Tainted": "污染",
  "NoEnergyGain": "无法获得能量",
  "InfiniteBlades": "无尽刀刃",
  "FeelNoPain": "无惧疼痛",
  "Intangible": "无实体",
  "Arsenal": "武器库",
  "BeaconOfHope": "希望灯塔",
  "DrawCardsNextTurn": "下回合抽牌",
  "BlockNextTurn": "下回合格挡",
  "StarNextTurn": "下回合辉星",
  "EnergyNextTurn": "下回合能量",
  "SummonNextTurn": "下回合召唤",
  "Demise": "消亡",
  "CrabRage": "蟹之怒",
  "MindRot": "心灵腐化",
  "Pyre": "薪火之源",
  "SignalBoost": "信号增强",
  "Vicious": "凶恶",
  "VoidForm": "虚空形态",
  "CallOfTheVoid": "虚空之唤",
  "Weak": "虚弱",
  "Spinner": "旋转工艺",
  "SleightOfFlesh": "血肉戏法",
  "Loop": "循环",
  "Smokestack": "烟囱",
  "Smoggy": "烟雾弥漫",
  "Oblivion": "湮灭",
  "Covered": "掩护",
  "Feral": "野性",
  "Nightmare": "夜魇",
  "Ritual": "仪式",
  "Dampen": "抑制",
  "Vulnerable": "易伤",
  "Surprise": "意外",
  "LightningRod": "引雷针",
  "Gravity": "引力",
  "HardenedShell": "硬化外壳",
  "WraithForm": "幽魂形态",
  "Friendship": "友谊",
  "Afterimage": "余像",
  "Inferno": "狱火",
  "BorrowedTime": "预借时间",
  "Juggling": "杂耍",
  "Doom": "灾厄",
  "Regen": "再生",
  "Surrounded": "遭到包围",
  "TheBomb": "炸弹",
  "Parry": "招架",
  "Minion": "爪牙",
  "Flutter": "振翅",
  "Conqueror": "征服者",
  "SteamEruption": "蒸汽喷发",
  "PaperCuts": "纸伤难愈",
  "Lethality": "致死性",
  "Poison": "中毒",
  "SeekingEdge": "追踪之刃",
  "PrepTime": "准备时间",
  "Subroutine": "子程序",
  "SelfFormingClay": "自成型黏土",
  "Automation": "自动化",
  "Ambergris": "Ambergris",
  "Cacophony": "Cacophony",
  "Concoct": "Concoct",
  "Fade": "Fade",
  "Hibernate": "Hibernate",
  "HyperbeamFocusDown": "HyperbeamFocusDown",
  "ImitationLearning": "ImitationLearning",
  "OneForAll": "OneForAll",
  "Soulbound": "Soulbound",
  "Anticipate": "Temporary Dexterity",
  "HelicalDart": "Temporary Dexterity",
  "SpeedPotion": "Temporary Dexterity",
  "FocusedStrike": "Temporary Focus",
  "Hotfix": "Temporary Focus",
  "Synchronize": "Temporary Focus",
  "Coordinate": "Temporary Strength",
  "FeedingFrenzy": "Temporary Strength",
  "FlexPotion": "Temporary Strength",
  "ReptileTrinket": "Temporary Strength",
  "SetupStrike": "Temporary Strength",
  "CrushUnder": "Temporary Strength Down",
  "DarkShackles": "Temporary Strength Down",
  "DyingStar": "Temporary Strength Down",
  "EnfeeblingTouch": "Temporary Strength Down",
  "Mangle": "Temporary Strength Down",
  "MonarchsGazeStrengthDown": "Temporary Strength Down",
  "PiercingWail": "Temporary Strength Down",
  "ShacklingPotion": "Temporary Strength Down",
  "Underworld": "Underworld"
};

/** 全部减益类力量（预填原版效果时默认施加给敌人） */
export const POWER_DEBUFFS: string[] = [
  "NoDraw",
  "NoBlock",
  "Tangled",
  "Debilitate",
  "Frail",
  "Hang",
  "TagTeam",
  "Hex",
  "TheGambit",
  "Plow",
  "Slow",
  "Ringing",
  "ChainsOfBinding",
  "Confused",
  "Knockdown",
  "Flanking",
  "Shriek",
  "Constrict",
  "Strangle",
  "SicEm",
  "Neurosurge",
  "Sloth",
  "MagicBomb",
  "BiasedCognition",
  "Tender",
  "Imbalanced",
  "WasteAway",
  "Shrink",
  "Disintegration",
  "Tainted",
  "NoEnergyGain",
  "Demise",
  "MindRot",
  "Weak",
  "Smoggy",
  "Oblivion",
  "Dampen",
  "Vulnerable",
  "WraithForm",
  "BorrowedTime",
  "Doom",
  "Surrounded",
  "Conqueror",
  "Poison",
  "CrushUnder",
  "DarkShackles",
  "DyingStar",
  "EnfeeblingTouch",
  "Mangle",
  "MonarchsGazeStrengthDown",
  "PiercingWail",
  "ShacklingPotion"
];
