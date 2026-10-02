/** 游戏力量目录（265 项）——由 tools/extract-power-catalog.mjs 生成，勿手改。
 *  数据源：反编译 v0.111.0 全部具体 PowerModel 子类 + spire-codex zhs/eng 官方数据与图标。
 *  name = SfPowerResolver 可解析名（类名去 Power 后缀）；icon 为 /catalog/powers/ 下的文件名（可空）。 */
export interface PowerEntry {
  /** SfPowerResolver 解析名（如 Vulnerable） */
  name: string;
  /** 官方英文名 */
  en: string;
  /** 官方中文名（如 易伤） */
  zh: string;
  /** 官方中文描述 */
  desc: string;
  /** 官方英文描述 */
  desc_en: string;
  /** 是否减益（默认施加给敌人） */
  debuff: boolean;
  /** 图标文件名（/catalog/powers/<icon>；空 = 无图标） */
  icon: string;
}

export const POWERS: PowerEntry[] = [
  {
    "name": "PaleBlueDot",
    "en": "Pale Blue Dot",
    "zh": "暗淡蓝点",
    "desc": "如果你在一回合内打出至少[blue]5[/blue]张牌，则在你的下一回合开始时额外抽[blue][Amount][/blue]张牌。",
    "desc_en": "If you play [blue]5[/blue] or more cards in a turn, draw [blue][Amount][/blue] additional cards at the start of your next turn.",
    "debuff": false,
    "icon": "pale_blue_dot_power.png"
  },
  {
    "name": "ShadowStep",
    "en": "Shadow Step",
    "zh": "暗影步",
    "desc": "在下个回合，攻击造成双倍伤害。",
    "desc_en": "For the next [blue]2[/blue] turns after this one, Attacks deal double damage.",
    "debuff": false,
    "icon": "shadow_step_power.png"
  },
  {
    "name": "Soar",
    "en": "Soar",
    "zh": "翱翔",
    "desc": "在落地之前受到的伤害减少[blue]50%[/blue]。",
    "desc_en": "Receives [blue]50%[/blue] less attack damage until it lands.",
    "debuff": false,
    "icon": "soar_power.png"
  },
  {
    "name": "RetainHand",
    "en": "Retain Hand",
    "zh": "保留手牌",
    "desc": "在[blue]2[/blue]回合内[gold]保留[/gold]你的[gold]手牌[/gold]。",
    "desc_en": "[gold]Retain[/gold] your [gold]Hand[/gold] for the next [blue]2[/blue] turns.",
    "debuff": false,
    "icon": "retain_hand_power.png"
  },
  {
    "name": "Tyranny",
    "en": "Tyranny",
    "zh": "暴政",
    "desc": "在你的回合开始时，抽一张牌然后[gold]消耗[/gold]你的一张[gold]手牌[/gold]。",
    "desc_en": "At the start of your turn, draw [blue]2[/blue] cards and [gold]Exhaust[/gold] [blue]2[/blue] cards from your [gold]Hand[/gold].",
    "debuff": false,
    "icon": "tyranny_power.png"
  },
  {
    "name": "Burst",
    "en": "Burst",
    "zh": "爆发",
    "desc": "本回合，你的下一张技能牌会多打出一次。",
    "desc_en": "Your next [blue]2[/blue] Skills are played an extra time this turn.",
    "debuff": false,
    "icon": "burst_power.png"
  },
  {
    "name": "ToolsOfTheTrade",
    "en": "Tools of the Trade",
    "zh": "必备工具",
    "desc": "在你的回合开始时，抽[blue]1[/blue]张牌并丢弃[blue]1[/blue]张牌。",
    "desc_en": "At the start of your turn, draw [blue]1[/blue] card and discard [blue]1[/blue] card.",
    "debuff": false,
    "icon": "tools_of_the_trade_power.png"
  },
  {
    "name": "Barricade",
    "en": "Barricade",
    "zh": "壁垒",
    "desc": "[gold]格挡[/gold]不会在你的回合开始时被移除。",
    "desc_en": "[gold]Block[/gold] is not removed at the start of your turn.",
    "debuff": false,
    "icon": "barricade_power.png"
  },
  {
    "name": "Hailstorm",
    "en": "Hailstorm",
    "zh": "冰雹风暴",
    "desc": "在你的回合结束时，如果你有[gold]冰霜[/gold]充能球，则对所有敌人造成[blue]6[/blue]点伤害。",
    "desc_en": "At the end of your turn, if you have [gold]Frost[/gold], deal [blue]6[/blue] damage to ALL enemies.",
    "debuff": false,
    "icon": "hailstorm_power.png"
  },
  {
    "name": "Unmovable",
    "en": "Unmovable",
    "zh": "不动",
    "desc": "每个回合你第一次从卡牌中获得[gold]格挡[/gold]时，将数值翻倍。",
    "desc_en": "The first [blue]2[/blue] times you gain [gold]Block[/gold] from a card each turn, double the amount gained.",
    "debuff": false,
    "icon": "unmovable_power.png"
  },
  {
    "name": "NoDraw",
    "en": "No Draw",
    "zh": "不可抽牌",
    "desc": "你在本回合无法再抽更多牌。",
    "desc_en": "You may not draw any more cards this turn.",
    "debuff": true,
    "icon": "no_draw_power.png"
  },
  {
    "name": "NoBlock",
    "en": "No Block",
    "zh": "不可格挡",
    "desc": "你无法从卡牌中获得[gold]格挡[/gold]。",
    "desc_en": "You cannot gain [gold]Block[/gold] from cards for [blue]2[/blue] turns.",
    "debuff": true,
    "icon": "no_block_power.png"
  },
  {
    "name": "Cruelty",
    "en": "Cruelty",
    "zh": "残酷",
    "desc": "以上敌人受到额外伤害。",
    "desc_en": "Vulnerable enemies take additional damage.",
    "debuff": false,
    "icon": "cruelty_power.png"
  },
  {
    "name": "Blur",
    "en": "Blur",
    "zh": "残影",
    "desc": "你的下一回合开始时[gold]格挡[/gold]不会消失。",
    "desc_en": "[gold]Block[/gold] is not removed at the start of your next 2 turns.",
    "debuff": false,
    "icon": "blur_power.png"
  },
  {
    "name": "Tangled",
    "en": "Tangled",
    "zh": "缠结",
    "desc": "本回合，攻击牌的[gold]能量[/gold]费用增加[blue]1[/blue]。",
    "desc_en": "Attacks cost an additional [energy:1] for 2 turns.",
    "debuff": true,
    "icon": "tangled_power.png"
  },
  {
    "name": "Gigantification",
    "en": "Gigantification",
    "zh": "超巨化",
    "desc": "你打出的下一张攻击牌造成三倍伤害。",
    "desc_en": "The next [blue]2[/blue] Attacks you play deal triple damage.",
    "debuff": false,
    "icon": "gigantification_power.png"
  },
  {
    "name": "Asleep",
    "en": "Asleep",
    "zh": "沉睡",
    "desc": "在失去生命时或在[blue][Amount][/blue]回合后苏醒。",
    "desc_en": "Awakens upon losing HP or after [blue]2[/blue] turns.",
    "debuff": false,
    "icon": "asleep_power.png"
  },
  {
    "name": "Accelerant",
    "en": "Accelerant",
    "zh": "触媒",
    "desc": "[gold]中毒[/gold]会多触发一次。",
    "desc_en": "[gold]Poison[/gold] is triggered an additional time.",
    "debuff": false,
    "icon": "accelerant_power.png"
  },
  {
    "name": "Genesis",
    "en": "Genesis",
    "zh": "创世纪",
    "desc": "在你的回合开始时，获得[star:1]。",
    "desc_en": "At the start of your turn, gain [star:1].",
    "debuff": false,
    "icon": "genesis_power.png"
  },
  {
    "name": "PillarOfCreation",
    "en": "Pillar of Creation",
    "zh": "创世之柱",
    "desc": "每当你创造一张牌时，获得[blue]5[/blue]点[gold]格挡[/gold]。",
    "desc_en": "Whenever you create a card, gain [blue]5[/blue] [gold]Block[/gold].",
    "debuff": false,
    "icon": "pillar_of_creation_power.png"
  },
  {
    "name": "CreativeAi",
    "en": "Creative AI",
    "zh": "创造性AI",
    "desc": "在你的回合开始时，将一张随机能力牌添加到你的[gold]手牌[/gold]。",
    "desc_en": "At the start of your turn, add [blue]2[/blue] random Powers into your [gold]Hand[/gold].",
    "debuff": false,
    "icon": "creative_ai_power.png"
  },
  {
    "name": "HammerTime",
    "en": "Hammer Time",
    "zh": "锤子时间",
    "desc": "每当你[gold]铸造[/gold]时，所有盟友也[gold]铸造[/gold]相同数值。",
    "desc_en": "Whenever you [gold]Forge[/gold], all allies [gold]Forge[/gold] as well.",
    "debuff": false,
    "icon": "hammer_time_power.png"
  },
  {
    "name": "Veilpiercer",
    "en": "Veilpiercer",
    "zh": "刺破帷幕",
    "desc": "你打出的下一张[gold]虚无[/gold]牌耗能为[blue]0[/blue]。",
    "desc_en": "The next [gold]Ethereal card[/gold] you play costs [blue]0[/blue].",
    "debuff": false,
    "icon": "veilpiercer_power.png"
  },
  {
    "name": "Debilitate",
    "en": "Debilitate",
    "zh": "摧残",
    "desc": "[blue]2[/blue]回合内，[gold]易伤[/gold]和[gold]虚弱[/gold]的效果变为两倍。",
    "desc_en": "[gold]Vulnerable[/gold] and [gold]Weak[/gold] are twice as effective for the next [blue]2[/blue] turns.",
    "debuff": true,
    "icon": "debilitate_power.png"
  },
  {
    "name": "Frail",
    "en": "Frail",
    "zh": "脆弱",
    "desc": "脆弱时，从卡牌中获得的[gold]格挡[/gold]值减少[blue]25%[/blue]。",
    "desc_en": "While Frail, gain [blue]25%[/blue] less [gold]Block[/gold] from cards.",
    "debuff": true,
    "icon": "frail_power.png"
  },
  {
    "name": "Skittish",
    "en": "Skittish",
    "zh": "胆小",
    "desc": "[gold]This creature[/gold]每回合第一次被命中时，获得[blue][Amount][/blue]点[gold]格挡[/gold]。",
    "desc_en": "The first time [gold]this creature[/gold] is hit each turn, it gains [blue][Amount][/blue] [gold]Block[/gold].",
    "debuff": false,
    "icon": "skittish_power.png"
  },
  {
    "name": "Rebound",
    "en": "Rebound",
    "zh": "弹回",
    "desc": "将你在本回合打出的下一张牌放置到你的[gold]抽牌堆[/gold]顶部。",
    "desc_en": "The next [blue]2[/blue] cards you play this turn are placed on the top of your [gold]Draw Pile[/gold].",
    "debuff": false,
    "icon": "rebound_power.png"
  },
  {
    "name": "FanOfKnives",
    "en": "Fan of Knives",
    "zh": "刀扇",
    "desc": "[gold]小刀[/gold]会命中所有敌人。",
    "desc_en": "[gold]Shivs[/gold] hit ALL enemies.",
    "debuff": false,
    "icon": "fan_of_knives_power.png"
  },
  {
    "name": "Countdown",
    "en": "Countdown",
    "zh": "倒数计时",
    "desc": "在你的回合开始时，给予随机敌人[blue]6[/blue]层[gold]灾厄[/gold]。",
    "desc_en": "At the start of your turn, apply [blue]6[/blue] [gold]Doom[/gold] to a random enemy.",
    "debuff": false,
    "icon": "countdown_power.png"
  },
  {
    "name": "Reflect",
    "en": "Reflect",
    "zh": "倒映",
    "desc": "被格挡的伤害会反弹到攻击者身上。",
    "desc_en": "Blocked damage is reflected to your attacker.",
    "debuff": false,
    "icon": "reflect_power.png"
  },
  {
    "name": "Heist",
    "en": "Heist",
    "zh": "盗窃",
    "desc": "被击杀时，返还所有偷走的[gold]金币[/gold]。",
    "desc_en": "When killed, returns all the stolen [gold]Gold[/gold].",
    "debuff": false,
    "icon": "heist_power.png"
  },
  {
    "name": "Hellraiser",
    "en": "Hellraiser",
    "zh": "地狱狂徒",
    "desc": "每当你抽到名字中有“打击”的牌时，对一名随机敌人打出这张牌。",
    "desc_en": "Whenever you draw a card containing \"Strike\", it is played against a random enemy.",
    "debuff": false,
    "icon": "hellraiser_power.png"
  },
  {
    "name": "WitheringPresence",
    "en": "Withering Presence",
    "zh": "凋萎存在",
    "desc": "你每打出[blue]6[/blue]张牌，将一张[gold]凋萎[/gold]加入你的[gold]手牌[/gold]。",
    "desc_en": "Every [blue]6[/blue] cards you play, add a [gold]Wither[/gold] to your [gold]Hand[/gold].",
    "debuff": false,
    "icon": "withering_presence_power.png"
  },
  {
    "name": "Hang",
    "en": "Hang",
    "zh": "吊杀",
    "desc": "所有[gold]吊杀[/gold]牌对这名敌人造成[blue]2[/blue]倍伤害。",
    "desc_en": "All [gold]Hangs[/gold] deal [blue]2[/blue] times more damage to this enemy.",
    "debuff": true,
    "icon": "hang_power.png"
  },
  {
    "name": "Iteration",
    "en": "Iteration",
    "zh": "迭代",
    "desc": "每回合你第一次抽到状态牌时，抽更多牌。",
    "desc_en": "The first time you draw a Status each turn, draw more cards.",
    "debuff": false,
    "icon": "iteration_power.png"
  },
  {
    "name": "NoxiousFumes",
    "en": "Noxious Fumes",
    "zh": "毒雾",
    "desc": "在你的回合开始时，给予所有敌人[blue]2[/blue]层[gold]中毒[/gold]。",
    "desc_en": "At the start of your turn, apply [blue]2[/blue] [gold]Poison[/gold] to ALL enemies.",
    "debuff": false,
    "icon": "noxious_fumes_power.png"
  },
  {
    "name": "Monologue",
    "en": "Monologue",
    "zh": "独白",
    "desc": "每当你在本回合打出卡牌时，在本回合获得[blue]1[/blue]点[gold]力量[/gold]。\n当前已经获得[blue]0[/blue]点[gold]力量[/gold]。",
    "desc_en": "Whenever you play a card this turn, gain [blue]1[/blue] [gold]Strength[/gold] this turn.\nCurrently granting [blue]0[/blue] [gold]Strength[/gold].",
    "debuff": false,
    "icon": "monologue_power.png"
  },
  {
    "name": "Rampart",
    "en": "Rampart",
    "zh": "盾墙",
    "desc": "在玩家回合开始时，高塔炮手获得[blue]25[/blue]点[gold]格挡[/gold]。",
    "desc_en": "At the start of the player's turn, Turret Operator gains [blue]25[/blue] [gold]Block[/gold].",
    "debuff": false,
    "icon": "rampart_power.png"
  },
  {
    "name": "TagTeam",
    "en": "Tag Team",
    "zh": "多人组队",
    "desc": "另一名玩家对该敌人的下一张攻击牌会多打出一次。",
    "desc_en": "The next Attack another player plays on the enemy is played an extra time.",
    "debuff": true,
    "icon": "tag_team_power.png"
  },
  {
    "name": "Shroud",
    "en": "Shroud",
    "zh": "厄运之衣",
    "desc": "你每次给予[gold]灾厄[/gold]时，获得[blue]3[/blue]点[gold]格挡[/gold]。",
    "desc_en": "Whenever you apply [gold]Doom[/gold], gain [blue]3[/blue] [gold]Block[/gold].",
    "debuff": false,
    "icon": "shroud_power.png"
  },
  {
    "name": "DemonForm",
    "en": "Demon Form",
    "zh": "恶魔形态",
    "desc": "在你的回合开始时，获得[blue]2[/blue]点[gold]力量[/gold]。",
    "desc_en": "At the start of your turn, gain [blue]2[/blue] [gold]Strength[/gold].",
    "debuff": false,
    "icon": "demon_form_power.png"
  },
  {
    "name": "Hex",
    "en": "Hex",
    "zh": "恶咒",
    "desc": "幽灵骑士存活时，你的所有卡牌都拥有[gold]虚无[/gold]。",
    "desc_en": "While Spectral Knight is alive, ALL your cards are [gold]Ethereal[/gold].",
    "debuff": true,
    "icon": "hex_power.png"
  },
  {
    "name": "CrimsonMantle",
    "en": "Crimson Mantle",
    "zh": "绯红披风",
    "desc": "在你的回合开始时，失去[blue]0[/blue]点生命并获得[blue][Amount][/blue]点[gold]格挡[/gold]。",
    "desc_en": "At the start of your turn, lose [blue]0[/blue] HP and gain [blue][Amount][/blue] [gold]Block[/gold].",
    "debuff": false,
    "icon": "crimson_mantle_power.png"
  },
  {
    "name": "TheSealedThrone",
    "en": "The Sealed Throne",
    "zh": "封印王座",
    "desc": "你每打出一张牌，获得[star:1]。",
    "desc_en": "Whenever you play a card, gain [star:1].",
    "debuff": false,
    "icon": "the_sealed_throne_power.png"
  },
  {
    "name": "Hatch",
    "en": "Hatch",
    "zh": "孵化",
    "desc": "[blue]X[/blue]回合后孵化。",
    "desc_en": "Hatches after [blue]X[/blue] turns.",
    "debuff": false,
    "icon": "hatch_power.png"
  },
  {
    "name": "Corruption",
    "en": "Corruption",
    "zh": "腐化",
    "desc": "所有技能牌耗能变为[blue]0[/blue]。\n所有技能牌在打出时被[gold]消耗[/gold]。",
    "desc_en": "Skills cost [blue]0[/blue].\nWhenever you play a Skill, [gold]Exhaust[/gold] it.",
    "debuff": false,
    "icon": "corruption_power.png"
  },
  {
    "name": "CorrosiveWave",
    "en": "Corrosive Wave",
    "zh": "腐蚀波",
    "desc": "你在本回合每抽到一张牌，就给予所有敌人[blue]2[/blue]点[gold]中毒[/gold]。",
    "desc_en": "Whenever you draw a card this turn, apply [blue]2[/blue] [gold]Poison[/gold] to ALL enemies.",
    "debuff": false,
    "icon": "corrosive_wave_power.png"
  },
  {
    "name": "Duplication",
    "en": "Duplication",
    "zh": "复制",
    "desc": "你下一张打出的牌会多打出一次。",
    "desc_en": "Your next [blue]2[/blue] cards are played an extra time.",
    "debuff": false,
    "icon": "duplication_power.png"
  },
  {
    "name": "Plating",
    "en": "Plating",
    "zh": "覆甲",
    "desc": "在你的回合结束时获得[blue][Amount][/blue]点[gold]格挡[/gold]。[gold]覆甲[/gold]会在你的回合开始时减少[blue]1[/blue]层。",
    "desc_en": "At the end of your turn, gain [blue][Amount][/blue] [gold]Block[/gold]. [gold]Plating[/gold] is reduced by [blue]1[/blue] at the start of your turn.",
    "debuff": false,
    "icon": "plating_power.png"
  },
  {
    "name": "Improvement",
    "en": "Improvement",
    "zh": "改善",
    "desc": "在战斗结束时，随机[gold]升级[/gold]一张牌。",
    "desc_en": "At the end of combat, [gold]Upgrade[/gold] a random card.",
    "debuff": false,
    "icon": "improvement_power.png"
  },
  {
    "name": "Calcify",
    "en": "Calcify",
    "zh": "钙化",
    "desc": "[gold]奥斯提[/gold]的攻击造成额外伤害。",
    "desc_en": "[gold]Osty's[/gold] attacks deal additional damage.",
    "debuff": false,
    "icon": "calcify_power.png"
  },
  {
    "name": "HighVoltage",
    "en": "High Voltage",
    "zh": "高电压",
    "desc": "[gold]This creature[/gold]的回合结束时，会获得[blue][Amount][/blue]点[gold]力量[/gold]。",
    "desc_en": "At the end of [gold]this creature's[/gold] turn, it gains [blue][Amount][/blue] [gold]Strength[/gold].",
    "debuff": false,
    "icon": "high_voltage_power.png"
  },
  {
    "name": "Tracking",
    "en": "Tracking",
    "zh": "跟踪",
    "desc": "[gold]虚弱[/gold]的敌人从攻击牌中受到[blue]2[/blue]倍伤害。",
    "desc_en": "[gold]Weak[/gold] enemies take [blue]2[/blue] times more damage from Attacks.",
    "debuff": false,
    "icon": "tracking_power.png"
  },
  {
    "name": "TheGambit",
    "en": "The Gambit",
    "zh": "孤注一掷",
    "desc": "如果你在这场战斗中受到未被格挡的攻击伤害，则立即死亡。",
    "desc_en": "If you take unblocked attack damage this combat, die.",
    "debuff": true,
    "icon": "the_gambit_power.png"
  },
  {
    "name": "SpectrumShift",
    "en": "Spectrum Shift",
    "zh": "光谱偏移",
    "desc": "在你的回合开始时，将[blue]1[/blue]张随机无色牌添加到你的[gold]手牌[/gold]中。",
    "desc_en": "At the start of your turn, add [blue]1[/blue] random Colorless card into your [gold]Hand[/gold].",
    "debuff": false,
    "icon": "spectrum_shift_power.png"
  },
  {
    "name": "Sneaky",
    "en": "Sneaky",
    "zh": "鬼祟",
    "desc": "每当另一名玩家攻击敌人时，获得[gold]格挡[/gold]。",
    "desc_en": "Whenever another player attacks an enemy, gain [gold]Block[/gold].",
    "debuff": false,
    "icon": "sneaky_power.png"
  },
  {
    "name": "RollingBoulder",
    "en": "Rolling Boulder",
    "zh": "滚石",
    "desc": "在你的回合开始时，对所有敌人造成[blue][Amount][/blue]点伤害，然后将此伤害增加[blue]5[/blue]。",
    "desc_en": "At the start of your turn, deal [blue][Amount][/blue] damage to ALL enemies and increase this damage by [blue]5[/blue].",
    "debuff": false,
    "icon": "rolling_boulder_power.png"
  },
  {
    "name": "Curious",
    "en": "Curious",
    "zh": "好奇",
    "desc": "能力牌的耗能减少[blue]1[/blue][energy:1]。",
    "desc_en": "Powers cost [blue]1[/blue] [energy:1] less.",
    "debuff": false,
    "icon": "curious_power.png"
  },
  {
    "name": "Aggression",
    "en": "Aggression",
    "zh": "好勇斗狠",
    "desc": "在你的回合开始时，将你[gold]弃牌堆[/gold]的一张随机攻击牌放入你的[gold]手牌[/gold]并将其在本场战斗中[gold]升级[/gold]。",
    "desc_en": "At the start of your turn, put a random Attack from your [gold]Discard Pile[/gold] into your [gold]Hand[/gold] and [gold]Upgrade[/gold] it for the rest of combat.",
    "debuff": false,
    "icon": "aggression_power.png"
  },
  {
    "name": "DarkEmbrace",
    "en": "Dark Embrace",
    "zh": "黑暗之拥",
    "desc": "每当有一张牌被[gold]消耗[/gold]时，抽[blue]1[/blue]张牌。",
    "desc_en": "Whenever a card is [gold]Exhausted[/gold], draw [blue]1[/blue] card.",
    "debuff": false,
    "icon": "dark_embrace_power.png"
  },
  {
    "name": "BlackHole",
    "en": "Black Hole",
    "zh": "黑洞",
    "desc": "每当你花费或获得[star:1]时，对所有敌人造成[blue]3[/blue]点伤害。",
    "desc_en": "Whenever you spend or gain [star:1], deal [blue]3[/blue] damage to ALL enemies.",
    "debuff": false,
    "icon": "black_hole_power.png"
  },
  {
    "name": "Plow",
    "en": "Plow",
    "zh": "横冲直撞",
    "desc": "[gold]This creature[/gold]的生命值第一次下降到[blue][Amount][/blue]或更低时，将其[gold]击晕[/gold]并使其失去所有[gold]力量[/gold]。",
    "desc_en": "The first time [gold]this creature's[/gold] HP reaches [blue][Amount][/blue] or below, it becomes [gold]Stunned[/gold] and loses all its [gold]Strength[/gold].",
    "debuff": true,
    "icon": "plow_power.png"
  },
  {
    "name": "BackAttackLeft",
    "en": "Back Attack",
    "zh": "后方攻击",
    "desc": "从后方对你攻击时，造成的伤害增加[blue]50%[/blue]。",
    "desc_en": "Deals [blue]50%[/blue] more damage when it is attacking you from behind.",
    "debuff": false,
    "icon": "back_attack_left_power.png"
  },
  {
    "name": "BackAttackRight",
    "en": "Back Attack",
    "zh": "后方攻击",
    "desc": "从后方对你攻击时，造成的伤害增加[blue]50%[/blue]。",
    "desc_en": "Deals [blue]50%[/blue] more damage when it is attacking you from behind.",
    "debuff": false,
    "icon": "back_attack_right_power.png"
  },
  {
    "name": "Guarded",
    "en": "Guarded",
    "zh": "护卫",
    "desc": "从敌人处受到的伤害减半。",
    "desc_en": "Take half damage from enemies.",
    "debuff": false,
    "icon": "guarded_power.png"
  },
  {
    "name": "Slippery",
    "en": "Slippery",
    "zh": "滑溜",
    "desc": "[gold]This creature[/gold]下[blue][Amount][/blue]次要失去生命值时，只会失去[blue]1[/blue]点生命。",
    "desc_en": "The next [blue]2[/blue] times [gold]this creature[/gold] loses HP, it only loses [blue]1[/blue] HP instead.",
    "debuff": false,
    "icon": "slippery_power.png"
  },
  {
    "name": "TrashToTreasure",
    "en": "Trash to Treasure",
    "zh": "化废为宝",
    "desc": "每当你生成状态牌的时候，随机[gold]生成[/gold][blue]1[/blue]个充能球。",
    "desc_en": "Whenever you create a Status, [gold]Channel[/gold] [blue]2[/blue] random Orbs.",
    "debuff": false,
    "icon": "trash_to_treasure_power.png"
  },
  {
    "name": "Nostalgia",
    "en": "Nostalgia",
    "zh": "怀旧",
    "desc": "每回合被打出第一张攻击或技能牌，将其放置于你的[gold]抽牌堆[/gold]顶端。",
    "desc_en": "The first 2 Attacks or Skills you play each turn are placed on top of your [gold]Draw Pile[/gold].",
    "debuff": false,
    "icon": "nostalgia_power.png"
  },
  {
    "name": "Orbit",
    "en": "Orbit",
    "zh": "环绕轨道",
    "desc": "你每花费[energy:4]，获得[energy:1]。",
    "desc_en": "Every [energy:4] you spend, gain [energy:1].",
    "debuff": false,
    "icon": "orbit_power.png"
  },
  {
    "name": "Buffer",
    "en": "Buffer",
    "zh": "缓冲",
    "desc": "阻止下一次你受到的生命值损伤。",
    "desc_en": "Prevent the next [blue]2[/blue] times you would lose HP.",
    "debuff": false,
    "icon": "buffer_power.png"
  },
  {
    "name": "Slow",
    "en": "Slow",
    "zh": "缓慢",
    "desc": "你在本回合内每打出一张牌，该敌人本回合从攻击牌中受到的伤害增加[blue]10%[/blue]。",
    "desc_en": "Whenever you play a card, this enemy receives [blue]10%[/blue] more damage from Attacks this turn.",
    "debuff": true,
    "icon": "slow_power.png"
  },
  {
    "name": "Illusion",
    "en": "Illusion",
    "zh": "幻象",
    "desc": "死亡时，下回合会以完整生命值复活。",
    "desc_en": "When this dies, it revives next turn at full HP.",
    "debuff": false,
    "icon": "illusion_power.png"
  },
  {
    "name": "PhantomBlades",
    "en": "Phantom Blades",
    "zh": "幻影之刃",
    "desc": "[gold]小刀[/gold]获得[gold]保留[/gold]。\n你每回合打出的第一张[gold]小刀[/gold]伤害增加[blue]9[/blue]。",
    "desc_en": "[gold]Shivs[/gold] gain [gold]Retain[/gold].\nThe first [gold]Shiv[/gold] you play each turn deals [blue]9[/blue] additional damage.",
    "debuff": false,
    "icon": "phantom_blades_power.png"
  },
  {
    "name": "SpiritOfAsh",
    "en": "Spirit of Ash",
    "zh": "灰烬之灵",
    "desc": "每当你打出一张[gold]虚无[/gold]牌时，获得[blue]4[/blue]点[gold]格挡[/gold]。",
    "desc_en": "Whenever you play an [gold]Ethereal[/gold] card, gain [blue]4[/blue] [gold]Block[/gold].",
    "debuff": false,
    "icon": "spirit_of_ash_power.png"
  },
  {
    "name": "EchoForm",
    "en": "Echo Form",
    "zh": "回响形态",
    "desc": "你每回合打出的第一张牌会多打出一次。",
    "desc_en": "The first [blue]2[/blue] cards you play each turn are played an extra time.",
    "debuff": false,
    "icon": "echo_form_power.png"
  },
  {
    "name": "Ringing",
    "en": "Ringing",
    "zh": "昏眩",
    "desc": "本回合你只能打出[blue]1[/blue]张牌。",
    "desc_en": "You can only play [blue]1[/blue] card this turn.",
    "debuff": true,
    "icon": "ringing_power.png"
  },
  {
    "name": "ChainsOfBinding",
    "en": "Chains of Binding",
    "zh": "魂缚锁链",
    "desc": "每回合抽到的前[blue]3[/blue]张牌将会被侵蚀为[gold]魂缚[/gold]。",
    "desc_en": "The first [blue]3[/blue] cards drawn each turn are Afflicted with [gold]Bound[/gold].",
    "debuff": true,
    "icon": "chains_of_binding_power.png"
  },
  {
    "name": "Confused",
    "en": "Confused",
    "zh": "混乱",
    "desc": "你的卡牌耗能会在抽取时变化，范围为[blue]0[/blue]到[blue]3[/blue]。",
    "desc_en": "The costs of your cards are randomized on draw, from [blue]0[/blue] to [blue]3[/blue].",
    "debuff": true,
    "icon": "confused_power.png"
  },
  {
    "name": "Vigor",
    "en": "Vigor",
    "zh": "活力",
    "desc": "[gold]This creature的[/gold]下一张攻击牌伤害增加造成[blue][Amount][/blue]。",
    "desc_en": "[gold]This creature's[/gold] next Attack deals [blue][Amount][/blue] additional damage.",
    "debuff": false,
    "icon": "vigor_power.png"
  },
  {
    "name": "VitalSpark",
    "en": "Vital Spark",
    "zh": "活力火花",
    "desc": "所有[gold]技能[/gold]牌都拥有[gold]污染[/gold][blue]2[/blue]。",
    "desc_en": "ALL [gold]Skills[/gold] are [gold]Tainted[/gold] [blue]2[/blue].",
    "debuff": false,
    "icon": "vital_spark_power.png"
  },
  {
    "name": "FlameBarrier",
    "en": "Flame Barrier",
    "zh": "火焰屏障",
    "desc": "本回合你每次受到攻击时，反击造成[blue]4[/blue]点伤害。",
    "desc_en": "Whenever you are attacked this turn, deal [blue]4[/blue] damage back.",
    "debuff": false,
    "icon": "flame_barrier_power.png"
  },
  {
    "name": "Knockdown",
    "en": "Knockdown",
    "zh": "击倒",
    "desc": "该敌人在本回合受到的来自其他玩家的伤害变为[blue][Amount][/blue]倍。",
    "desc_en": "This creature takes [blue][Amount][/blue] times the damage from other players this turn.",
    "debuff": true,
    "icon": "knockdown_power.png"
  },
  {
    "name": "Ravenous",
    "en": "Ravenous",
    "zh": "饥饿",
    "desc": "当有敌人死亡时，噬尸蛞蝓会立即吃下尸体，在本回合被[gold]击晕[/gold]然后获得[blue]1[/blue]点[gold]力量[/gold]。",
    "desc_en": "When an enemy dies, Corpse Slug immediately eats it, becoming [gold]Stunned[/gold] and gaining [blue]1[/blue] [gold]Strength[/gold].",
    "debuff": false,
    "icon": "ravenous_power.png"
  },
  {
    "name": "MachineLearning",
    "en": "Machine Learning",
    "zh": "机器学习",
    "desc": "在你的回合开始时，额外抽[blue]1[/blue]张牌。",
    "desc_en": "At the start of your turn, draw [blue]1[/blue] additional card.",
    "debuff": false,
    "icon": "machine_learning_power.png"
  },
  {
    "name": "Enrage",
    "en": "Enrage",
    "zh": "激怒",
    "desc": "每当你打出一张技能牌时，获得[blue]2[/blue]点[gold]力量[/gold]。",
    "desc_en": "Whenever you play a Skill, gains [blue]2[/blue] [gold]Strength[/gold].",
    "debuff": false,
    "icon": "enrage_power.png"
  },
  {
    "name": "Focus",
    "en": "Focus",
    "zh": "集中",
    "desc": "提升充能球的效力[blue][/blue]点。",
    "desc_en": "Increases the effectiveness of Orbs by [blue][/blue].",
    "debuff": false,
    "icon": "focus_power.png"
  },
  {
    "name": "Stratagem",
    "en": "Stratagem",
    "zh": "计策",
    "desc": "你每次洗牌[gold]抽牌堆[/gold]时，从中选择[blue]1[/blue]张牌放入你的[gold]手牌[/gold]。",
    "desc_en": "Whenever you shuffle your [gold]Draw Pile[/gold], choose [blue]1[/blue] card from it to put into your [gold]Hand[/gold].",
    "debuff": false,
    "icon": "stratagem_power.png"
  },
  {
    "name": "WellLaidPlans",
    "en": "Well-Laid Plans",
    "zh": "计划妥当",
    "desc": "在你的回合结束时，[gold]保留[/gold]最多[blue]1[/blue]张手牌。",
    "desc_en": "At the end of your turn, [gold]Retain[/gold] up to [blue]1[/blue] card.",
    "debuff": false,
    "icon": "well_laid_plans_power.png"
  },
  {
    "name": "ForegoneConclusion",
    "en": "Foregone Conclusion",
    "zh": "既定事项",
    "desc": "下回合，将你[gold]抽牌堆[/gold]中的[blue]3[/blue]张牌放入你的[gold]手牌[/gold]。",
    "desc_en": "Next turn, put [blue]3[/blue] cards from your [gold]Draw Pile[/gold] into your [gold]Hand[/gold].",
    "debuff": false,
    "icon": "foregone_conclusion_power.png"
  },
  {
    "name": "Infested",
    "en": "Infested",
    "zh": "寄生物",
    "desc": "死亡时，召唤……某种东西。",
    "desc_en": "Upon dying, summons... something.",
    "debuff": false,
    "icon": "infested_power.png"
  },
  {
    "name": "Flanking",
    "en": "Flanking",
    "zh": "夹击",
    "desc": "其他盟友在本回合对这名敌人造成[blue]2倍[/blue]攻击伤害。",
    "desc_en": "Other allies deal [blue]2x[/blue] the attack damage to this enemy this turn.",
    "debuff": true,
    "icon": "flanking_power.png"
  },
  {
    "name": "Shriek",
    "en": "Shriek",
    "zh": "尖叫",
    "desc": "[gold]This creature[/gold]的生命值第一次降到[blue][Amount][/blue]或以下时，会被[gold]击晕[/gold]。",
    "desc_en": "The first time [gold]this creature's[/gold] HP reaches [blue][Amount][/blue] or below, it becomes [gold]Stunned[/gold].",
    "debuff": true,
    "icon": "shriek_power.png"
  },
  {
    "name": "ToricToughness",
    "en": "Toric Toughness",
    "zh": "坚韧之环",
    "desc": "在下[blue]2[/blue]个回合开始时获得[blue]5[/blue]点[gold]格挡[/gold]。",
    "desc_en": "Gain [blue]5[/blue] [gold]Block[/gold] at the start of the next [blue]2[/blue] turns.",
    "debuff": false,
    "icon": "toric_toughness_power.png"
  },
  {
    "name": "SwordSage",
    "en": "Sword Sage",
    "zh": "剑圣",
    "desc": "[gold]君王之剑[/gold]获得[gold]重放[/gold][blue]1[/blue]。",
    "desc_en": "[gold]Sovereign Blade[/gold] gains [gold]Replay[/gold] [blue]1[/blue].",
    "debuff": false,
    "icon": "sword_sage_power.png"
  },
  {
    "name": "Reattach",
    "en": "Reattach",
    "zh": "接续",
    "desc": "如果身体还有存活的其他部分，则在[blue]2[/blue]回合后以[blue]25[/blue]点生命复活。",
    "desc_en": "If other segments are still alive, revives in [blue]2[/blue] turns with [blue]25[/blue] HP.",
    "debuff": false,
    "icon": "reattach_power.png"
  },
  {
    "name": "Calamity",
    "en": "Calamity",
    "zh": "劫难",
    "desc": "每当你打出一张攻击牌时，将一张随机攻击牌添加到你的[gold]手牌[/gold]。",
    "desc_en": "Whenever you play an Attack, add [blue]2[/blue] random Attacks into your [gold]Hand[/gold].",
    "debuff": false,
    "icon": "calamity_power.png"
  },
  {
    "name": "Constrict",
    "en": "Constrict",
    "zh": "紧缠",
    "desc": "蛇行扼杀者存活时，在你的回合结束时受到[blue]1[/blue]点伤害。",
    "desc_en": "While the Slithering Strangler is alive, at the end of your turn, take [blue]1[/blue] damage.",
    "debuff": true,
    "icon": "constrict_power.png"
  },
  {
    "name": "Strangle",
    "en": "Strangle",
    "zh": "紧勒",
    "desc": "本回合，你每次打出牌时，这名敌人失去[blue]2[/blue]点生命。",
    "desc_en": "Whenever you play a card this turn, this enemy loses [blue]2[/blue] HP.",
    "debuff": true,
    "icon": "strangle_power.png"
  },
  {
    "name": "SicEm",
    "en": "Sic 'Em",
    "zh": "紧追不放",
    "desc": "本回合，每当[gold]奥斯提[/gold]命中这个敌人时，[gold]召唤[/gold][blue]3[/blue]。",
    "desc_en": "Whenever [gold]Osty[/gold] hits this enemy this turn, [gold]Summon[/gold] [blue]3[/blue].",
    "debuff": true,
    "icon": "sic_em_power.png"
  },
  {
    "name": "ForbiddenGrimoire",
    "en": "Forbidden Grimoire",
    "zh": "禁忌魔典",
    "desc": "在战斗结束时，从你的[gold]牌组[/gold]中移除一张牌。",
    "desc_en": "At the end of combat, remove a card from your [gold]Deck[/gold].",
    "debuff": false,
    "icon": "forbidden_grimoire_power.png"
  },
  {
    "name": "Thorns",
    "en": "Thorns",
    "zh": "荆棘",
    "desc": "当被攻击命中时，反击造成伤害。",
    "desc_en": "When hit by an attack, deal damage back.",
    "debuff": false,
    "icon": "thorns_power.png"
  },
  {
    "name": "Stampede",
    "en": "Stampede",
    "zh": "惊逃",
    "desc": "在你的回合结束时，随机打出你[gold]手牌[/gold]中的[blue]1[/blue]张攻击牌攻击随机敌人。",
    "desc_en": "At the end of your turn, [blue]1[/blue] random Attack in your [gold]Hand[/gold] is played against a random enemy.",
    "debuff": false,
    "icon": "stampede_power.png"
  },
  {
    "name": "Neurosurge",
    "en": "Neurosurge",
    "zh": "精神过载",
    "desc": "在你的回合开始时，给予自身[blue]3[/blue]层[gold]灾厄[/gold]。",
    "desc_en": "At the start of your turn, apply [blue]3[/blue] [gold]Doom[/gold] to yourself.",
    "debuff": true,
    "icon": "neurosurge_power.png"
  },
  {
    "name": "Accuracy",
    "en": "Accuracy",
    "zh": "精准",
    "desc": "[gold]小刀[/gold]造成额外伤害。",
    "desc_en": "[gold]Shivs[/gold] deal additional damage.",
    "debuff": false,
    "icon": "accuracy_power.png"
  },
  {
    "name": "Haunt",
    "en": "Haunt",
    "zh": "纠缠",
    "desc": "每当你打出一张[gold]灵魂[/gold]时，一个随机敌人失去[blue]3[/blue]点生命。",
    "desc_en": "Whenever you play a [gold]Soul[/gold], a random enemy loses [blue]3[/blue] HP.",
    "debuff": false,
    "icon": "haunt_power.png"
  },
  {
    "name": "Colossus",
    "en": "Colossus",
    "zh": "巨像",
    "desc": "[blue][Amount][/blue]回合内，你从[gold]易伤[/gold]敌人处受到的伤害减少[blue]50%[/blue]。",
    "desc_en": "You receive [blue]50%[/blue] less damage from [gold]Vulnerable[/gold] enemies for [blue]2[/blue] turns.",
    "debuff": false,
    "icon": "colossus_power.png"
  },
  {
    "name": "Stock",
    "en": "Stock",
    "zh": "库存",
    "desc": "被击杀时，召唤一个全新的巨斧机器人。",
    "desc_en": "When killed, a new Axebot is summoned in its place.",
    "debuff": false,
    "icon": "stock_power.png"
  },
  {
    "name": "Rage",
    "en": "Rage",
    "zh": "狂怒",
    "desc": "本回合，你每打出一张攻击牌就获得[blue]3[/blue]点[gold]格挡[/gold]。",
    "desc_en": "Whenever you play an Attack this turn, gain [blue]3[/blue] [gold]Block[/gold].",
    "debuff": false,
    "icon": "rage_power.png"
  },
  {
    "name": "Intercept",
    "en": "Intercept",
    "zh": "拦截",
    "desc": "你正在掩护另一名玩家。本回合所有对其发起的攻击都会转移到你的身上。",
    "desc_en": "You are covering another player. All attacks that would be directed towards them are redirected towards you.",
    "debuff": false,
    "icon": "intercept_power.png"
  },
  {
    "name": "Sloth",
    "en": "Sloth",
    "zh": "懒惰",
    "desc": "你在每个回合不能打出超过[blue]3[/blue]张牌。",
    "desc_en": "You cannot play more than [blue]3[/blue] cards each turn.",
    "debuff": true,
    "icon": "sloth_power.png"
  },
  {
    "name": "Fasten",
    "en": "Fasten",
    "zh": "勒紧",
    "desc": "从“防御”牌中额外获得[blue]4[/blue]点[gold]格挡[/gold]。",
    "desc_en": "Gain an additional [blue]4[/blue] [gold]Block[/gold] from Defend cards.",
    "debuff": false,
    "icon": "fasten_power.png"
  },
  {
    "name": "Storm",
    "en": "Storm",
    "zh": "雷暴",
    "desc": "你每打出一张能力牌，就[gold]生成[/gold][blue]1[/blue]个[gold]闪电充能球[/gold]。",
    "desc_en": "Whenever you play a Power, [gold]Channel[/gold] [blue]1[/blue] [gold]Lightning[/gold].",
    "debuff": false,
    "icon": "storm_power.png"
  },
  {
    "name": "Thunder",
    "en": "Thunder",
    "zh": "雷霆",
    "desc": "每当你[gold]激发闪电充能球[/gold]时，对命中的敌人造成[blue]8[/blue]点伤害。",
    "desc_en": "Whenever you [gold]Evoke Lightning[/gold], deal [blue]8[/blue] damage to each enemy hit.",
    "debuff": false,
    "icon": "thunder_power.png"
  },
  {
    "name": "Coolant",
    "en": "Coolant",
    "zh": "冷却剂",
    "desc": "在你的回合开始时，每有一种不同的充能球获得[blue]3[/blue]点[gold]格挡[/gold]。",
    "desc_en": "At the start of your turn, gain [blue]3[/blue] [gold]Block[/gold] for each unique Orb you have.",
    "debuff": false,
    "icon": "coolant_power.png"
  },
  {
    "name": "Strength",
    "en": "Strength",
    "zh": "力量",
    "desc": "增加攻击牌造成的伤害值[blue][/blue]点。",
    "desc_en": "Increases attack damage by [blue][/blue].",
    "debuff": false,
    "icon": "strength_power.png"
  },
  {
    "name": "OneTwoPunch",
    "en": "One-Two Punch",
    "zh": "连环拳",
    "desc": "本回合，你的下一张攻击牌会多打出一次。",
    "desc_en": "Your next [blue]2[/blue] Attacks are played an extra time this turn.",
    "debuff": false,
    "icon": "one_two_punch_power.png"
  },
  {
    "name": "Territorial",
    "en": "Territorial",
    "zh": "领地意识",
    "desc": "在[gold]this creature[/gold]的回合结束时，获得[blue][Amount][/blue]点[gold]力量[/gold]。",
    "desc_en": "At the end of [gold]this creature's[/gold] turn, it gains [blue][Amount][/blue] [gold]Strength[/gold].",
    "debuff": false,
    "icon": "territorial_power.png"
  },
  {
    "name": "Leadership",
    "en": "Leadership",
    "zh": "领袖气质",
    "desc": "所有其他盟友造成[blue]1[/blue]点额外伤害。",
    "desc_en": "All other allies deal [blue]1[/blue] additional damage.",
    "debuff": false,
    "icon": "leadership_power.png"
  },
  {
    "name": "Demesne",
    "en": "Demesne",
    "zh": "领域",
    "desc": "在你的回合开始时，获得[blue]1[/blue]点[gold]能量[/gold]并额外抽[blue]1[/blue]张牌。",
    "desc_en": "At the start of your turn, gain [blue]1[/blue] [gold]Energy[/gold] and draw [blue]1[/blue] additional card.",
    "debuff": false,
    "icon": "demesne_power.png"
  },
  {
    "name": "Galvanic",
    "en": "Galvanic",
    "zh": "流电",
    "desc": "能力牌被侵蚀为[gold]流电[/gold]。",
    "desc_en": "Powers are afflicted with [gold]Galvanized[/gold].",
    "debuff": false,
    "icon": "galvanic_power.png"
  },
  {
    "name": "Mayhem",
    "en": "Mayhem",
    "zh": "乱战",
    "desc": "在你的回合开始时，打出你[gold]抽牌堆顶部的[/gold][blue]{}[/blue]张牌。",
    "desc_en": "At the start of your turn, play the next [blue]2[/blue] top cards of your [gold]Draw Pile[/gold].",
    "debuff": false,
    "icon": "mayhem_power.png"
  },
  {
    "name": "Burrowed",
    "en": "Burrowed",
    "zh": "埋地",
    "desc": "[gold]格挡[/gold]不会在[gold]this creature[/gold]的回合开始时移除。如果所有[gold]格挡[/gold]被移除，则将其[gold]击晕[/gold]。",
    "desc_en": "[gold]Block[/gold] is not removed at the start of [gold]this creature[/gold]'s turn. [gold]Stunned[/gold] if all [gold]Block[/gold] is removed.",
    "debuff": false,
    "icon": "burrowed_power.png"
  },
  {
    "name": "FreeAttack",
    "en": "Free Attack",
    "zh": "免费攻击",
    "desc": "你的下一张攻击牌耗能为[blue]0[/blue][energy:1]。",
    "desc_en": "Your next [blue]2[/blue] Attacks cost [blue]0[/blue] [energy:1].",
    "debuff": false,
    "icon": "free_attack_power.png"
  },
  {
    "name": "FreeSkill",
    "en": "Free Skill",
    "zh": "免费技能",
    "desc": "你的下一张技能牌耗能为[blue]0[/blue][energy:1]。",
    "desc_en": "The next [blue]2[/blue] Skills you play cost [blue]0[/blue] [energy:1].",
    "debuff": false,
    "icon": "free_skill_power.png"
  },
  {
    "name": "FreePower",
    "en": "Free Power",
    "zh": "免费能力",
    "desc": "你的下一张能力牌耗能为[blue]0[/blue] [energy:1]。",
    "desc_en": "The next [blue]2[/blue] Powers you play cost [blue]0[/blue] [energy:1].",
    "debuff": false,
    "icon": "free_power_power.png"
  },
  {
    "name": "Dexterity",
    "en": "Dexterity",
    "zh": "敏捷",
    "desc": "增加从卡牌中获得的[gold]格挡[/gold]值[blue][/blue]点。",
    "desc_en": "Increases [gold]Block[/gold] gained from cards by [blue][/blue].",
    "debuff": false,
    "icon": "dexterity_power.png"
  },
  {
    "name": "Clarity",
    "en": "Clarity",
    "zh": "明晰",
    "desc": "在你的下一个回合开始时，额外抽[blue]1[/blue]张牌。",
    "desc_en": "At the start of your next [blue]2[/blue] turns, draw [blue]1[/blue] additional card.",
    "debuff": false,
    "icon": "clarity_power.png"
  },
  {
    "name": "Radiance",
    "en": "Radiance",
    "zh": "明耀",
    "desc": "在下[blue][Amount][/blue]个回合额外获得[energy:1]。",
    "desc_en": "Gain additional [energy:1] for the next [blue]2[/blue] turns.",
    "debuff": false,
    "icon": "radiance_power.png"
  },
  {
    "name": "MagicBomb",
    "en": "Magic Bomb",
    "zh": "魔法炸弹",
    "desc": "在你的回合结束时受到[blue]20[/blue]点伤害。如果魔法骑士死亡，消除这一效果。",
    "desc_en": "Take [blue]20[/blue] damage at the end of your turn. Is cleared if the Magi Knight dies.",
    "debuff": true,
    "icon": "magic_bomb_power.png"
  },
  {
    "name": "MasterPlanner",
    "en": "Master Planner",
    "zh": "谋划专家",
    "desc": "当你打出技能牌时，该牌获得[gold]奇巧[/gold]。",
    "desc_en": "When you play a Skill, it gains [gold]Sly[/gold].",
    "debuff": false,
    "icon": "master_planner_power.png"
  },
  {
    "name": "HardToKill",
    "en": "Hard to Kill",
    "zh": "难以杀灭",
    "desc": "[gold]This creature[/gold]受到的所有伤害和生命减少效果不会超过[blue][Amount][/blue]点。",
    "desc_en": "Reduce all damage taken and HP lost by [gold]this creature[/gold] to [blue][Amount][/blue].",
    "debuff": false,
    "icon": "hard_to_kill_power.png"
  },
  {
    "name": "HelloWorld",
    "en": "Hello World",
    "zh": "你好世界",
    "desc": "在你的回合开始时，将[blue]1[/blue]张随机普通牌加入你的[gold]手牌[/gold]。",
    "desc_en": "At the start of your turn, add [blue]1[/blue] random Common card into your [gold]Hand[/gold].",
    "debuff": false,
    "icon": "hello_world_power.png"
  },
  {
    "name": "BiasedCognition",
    "en": "Biased Cognition",
    "zh": "偏差认知",
    "desc": "在你的回合开始时，失去[blue]1[/blue]点[gold]集中[/gold]。",
    "desc_en": "At the start of your turn, lose [blue]1[/blue] [gold]Focus[/gold].",
    "debuff": true,
    "icon": "biased_cognition_power.png"
  },
  {
    "name": "PossessStrength",
    "en": "Possess Strength",
    "zh": "抢夺力量",
    "desc": "被击杀时，将偷窃的所有[gold]力量[/gold]返还给玩家。",
    "desc_en": "When killed, return all stolen [gold]Strength[/gold] to the player.",
    "debuff": false,
    "icon": "possess_strength_power.png"
  },
  {
    "name": "PossessSpeed",
    "en": "Possess Speed",
    "zh": "抢夺速度",
    "desc": "被击杀时，将偷窃的所有[gold]敏捷[/gold]返还给玩家。",
    "desc_en": "When killed, return all stolen [gold]Dexterity[/gold] to the player.",
    "debuff": false,
    "icon": "possess_speed_power.png"
  },
  {
    "name": "CurlUp",
    "en": "Curl Up",
    "zh": "蜷身",
    "desc": "受到伤害时，蜷起身子并获得格挡。（每场战斗一次）",
    "desc_en": "When damaged, rolls up and gains block. (Once per combat)",
    "debuff": false,
    "icon": "curl_up_power.png"
  },
  {
    "name": "SerpentForm",
    "en": "Serpent Form",
    "zh": "群蛇形态",
    "desc": "你每打出一张牌，就对随机一名敌人造成[blue]4[/blue]点伤害。",
    "desc_en": "Whenever you play a card, deal [blue]4[/blue] damage to a random enemy.",
    "debuff": false,
    "icon": "serpent_form_power.png"
  },
  {
    "name": "ChildOfTheStars",
    "en": "Child of the Stars",
    "zh": "群星之子",
    "desc": "每花费一点[star:1]，获得[blue]1[/blue]点[gold]格挡[/gold]。",
    "desc_en": "Gain [blue]1[/blue] [gold]Block[/gold] for each [star:1] spent.",
    "debuff": false,
    "icon": "child_of_the_stars_power.png"
  },
  {
    "name": "Artifact",
    "en": "Artifact",
    "zh": "人工制品",
    "desc": "[gold]免疫[/gold]负面效果。",
    "desc_en": "[gold]Negates[/gold] debuffs.",
    "debuff": false,
    "icon": "artifact_power.png"
  },
  {
    "name": "PersonalHive",
    "en": "Personal Hive",
    "zh": "人体蜂房",
    "desc": "每当这个敌人被攻击命中时，在你的[gold]抽牌堆[/gold]中加入[gold]晕眩[/gold]。",
    "desc_en": "Whenever this enemy is hit by an Attack, add [gold]Dazed[/gold] into your [gold]Draw Pile[/gold].",
    "debuff": false,
    "icon": "personal_hive_power.png"
  },
  {
    "name": "Furnace",
    "en": "Furnace",
    "zh": "熔炉",
    "desc": "在你的回合开始时，[gold]铸造[/gold][blue]5[/blue]。",
    "desc_en": "At the start of your turn, [gold]Forge[/gold] [blue]5[/blue].",
    "debuff": false,
    "icon": "furnace_power.png"
  },
  {
    "name": "Shadowmeld",
    "en": "Shadowmeld",
    "zh": "融入暗影",
    "desc": "本回合你获得的[gold]格挡[/gold]值翻倍。",
    "desc_en": "Double your [gold]Block[/gold] gain this turn [blue]2[/blue] times.",
    "debuff": false,
    "icon": "shadowmeld_power.png"
  },
  {
    "name": "Tender",
    "en": "Tender",
    "zh": "柔嫩",
    "desc": "本回合，你每打出一张牌，就失去[blue]1[/blue]点[gold]力量[/gold]和[blue]1[/blue]点[gold]敏捷[/gold]。",
    "desc_en": "Whenever you play a card, lose [blue]1[/blue] [gold]Strength[/gold] and [blue]1[/blue] [gold]Dexterity[/gold] this turn.",
    "debuff": true,
    "icon": "tender_power.png"
  },
  {
    "name": "Tank",
    "en": "Tank",
    "zh": "肉盾",
    "desc": "自身受到敌人伤害加倍。盟友受到敌人伤害减半。",
    "desc_en": "Take double damage from enemies. Allies take half damage from enemies.",
    "debuff": false,
    "icon": "tank_power.png"
  },
  {
    "name": "Sandpit",
    "en": "Sandpit",
    "zh": "沙坑",
    "desc": "无厌沙虫的能力。",
    "desc_en": "In [blue]2[/blue] turns, you will be eaten and die.",
    "debuff": false,
    "icon": "sandpit_power.png"
  },
  {
    "name": "Entropy",
    "en": "Entropy",
    "zh": "熵",
    "desc": "在你的回合开始时，[gold]变化[/gold]你[gold]手牌[/gold]中的[blue]1[/blue]张牌。",
    "desc_en": "At the start of your turn, [gold]Transform[/gold] [blue]1[/blue] card in your [gold]Hand[/gold].",
    "debuff": false,
    "icon": "entropy_power.png"
  },
  {
    "name": "SentryMode",
    "en": "Sentry Mode",
    "zh": "哨卫模式",
    "desc": "在你的回合开始时，将[blue]1[/blue]张[gold]扫荡凝视[/gold]加入你的[gold]手牌[/gold]。",
    "desc_en": "At the start of your turn, add [blue]1[/blue] [gold]Sweeping Gaze[/gold] into your [gold]Hand[/gold].",
    "debuff": false,
    "icon": "sentry_mode_power.png"
  },
  {
    "name": "Panache",
    "en": "Panache",
    "zh": "神气制胜",
    "desc": "如果你在本回合再打出[blue]5[/blue]张牌，就对所有敌人造成[blue][Amount][/blue]点伤害。",
    "desc_en": "If you play [blue]5[/blue] more cards this turn, deal [blue][Amount][/blue] damage to ALL enemies.",
    "debuff": false,
    "icon": "panache_power.png"
  },
  {
    "name": "Imbalanced",
    "en": "Imbalanced",
    "zh": "失衡",
    "desc": "如果[gold]this creature[/gold]的攻击被完全格挡，则它将被[gold]击晕[/gold]。",
    "desc_en": "If [gold]this creature's[/gold] attacks are fully blocked, it becomes [gold]Stunned[/gold].",
    "debuff": true,
    "icon": "imbalanced_power.png"
  },
  {
    "name": "BattlewornDummyTimeLimit",
    "en": "Time Limit",
    "zh": "时间限制",
    "desc": "你还有[blue]3[/blue]个回合来击败战斗好伙伴。",
    "desc_en": "You have [blue]3[/blue] more turns to defeat the Battleworn Dummy.",
    "debuff": false,
    "icon": "battleworn_dummy_time_limit_power.png"
  },
  {
    "name": "Juggernaut",
    "en": "Juggernaut",
    "zh": "势不可当",
    "desc": "每当你获得[gold]格挡[/gold]时，对随机敌人造成[blue]6[/blue]点伤害。",
    "desc_en": "Whenever you gain [gold]Block[/gold], deal [blue]6[/blue] damage to a random enemy.",
    "debuff": false,
    "icon": "juggernaut_power.png"
  },
  {
    "name": "Adaptable",
    "en": "Adaptable",
    "zh": "适者生存",
    "desc": "当[gold]this creature[/gold]将要被击败时，它会复活变得更加强大。",
    "desc_en": "When [gold]this creature[/gold] would be defeated, it instead revives even stronger.",
    "debuff": false,
    "icon": "adaptable_power.png"
  },
  {
    "name": "TheHunt",
    "en": "The Hunt",
    "zh": "狩猎",
    "desc": "在战斗结束时额外获得[blue]1[/blue]份卡牌奖励。",
    "desc_en": "Gain [blue]1[/blue] additional card reward at the end of combat.",
    "debuff": false,
    "icon": "the_hunt_power.png"
  },
  {
    "name": "Pagestorm",
    "en": "Pagestorm",
    "zh": "书页风暴",
    "desc": "每当你抽到一张[gold]虚无[/gold]牌时，抽[blue]1[/blue]张牌。",
    "desc_en": "Whenever you draw an [gold]Ethereal[/gold] card, draw [blue]1[/blue] card.",
    "debuff": false,
    "icon": "pagestorm_power.png"
  },
  {
    "name": "Slumber",
    "en": "Slumber",
    "zh": "熟睡",
    "desc": "在一定回合经过后或失去生命3次后苏醒。",
    "desc_en": "Awakens upon taking turns or losing HP 3 times.",
    "debuff": false,
    "icon": "slumber_power.png"
  },
  {
    "name": "WasteAway",
    "en": "Waste Away",
    "zh": "衰朽",
    "desc": "每回合获得的[gold]能量[/gold]减少[blue]1[/blue]点。",
    "desc_en": "Gain [blue]1[/blue] less [gold]Energy[/gold] per turn.",
    "debuff": true,
    "icon": "waste_away_power.png"
  },
  {
    "name": "DoubleDamage",
    "en": "Double Damage",
    "zh": "双倍伤害",
    "desc": "本回合，攻击造成双倍伤害。",
    "desc_en": "For the next [blue]2[/blue] turns, Attacks deal double damage.",
    "debuff": false,
    "icon": "double_damage_power.png"
  },
  {
    "name": "Suck",
    "en": "Suck",
    "zh": "吮吸",
    "desc": "[gold]This creature[/gold]每次造成未被格挡的伤害时，都会获得[blue][Amount][/blue]点[gold]力量[/gold]。",
    "desc_en": "Whenever [gold]this creature[/gold] deals unblocked attack damage, it gains [blue][Amount][/blue] [gold]Strength[/gold].",
    "debuff": false,
    "icon": "suck_power.png"
  },
  {
    "name": "Swipe",
    "en": "Swipe",
    "zh": "顺走",
    "desc": "击杀这名敌人时，会取回被偷走的卡牌。",
    "desc_en": "Upon killing this enemy, the stolen card is returned.",
    "debuff": false,
    "icon": "swipe_power.png"
  },
  {
    "name": "Rupture",
    "en": "Rupture",
    "zh": "撕裂",
    "desc": "每当你在自身回合失去生命时，获得[blue]1[/blue]点[gold]力量[/gold]。",
    "desc_en": "Whenever you lose HP on your turn, gain [blue]1[/blue] [gold]Strength[/gold].",
    "debuff": false,
    "icon": "rupture_power.png"
  },
  {
    "name": "ReaperForm",
    "en": "Reaper Form",
    "zh": "死神形态",
    "desc": "每当你的攻击造成伤害时，同时给予[blue]其{}[/blue]倍的[gold]灾厄[/gold]。",
    "desc_en": "Whenever Attacks deal damage, apply [blue]2[/blue] times that much [gold]Doom[/gold].",
    "debuff": false,
    "icon": "reaper_form_power.png"
  },
  {
    "name": "DanseMacabre",
    "en": "Danse Macabre",
    "zh": "死亡之舞",
    "desc": "每当你打出一张耗能为[energy:2]或更高的牌时，获得[blue][Amount][/blue]点[gold]格挡[/gold]。",
    "desc_en": "Whenever you play a card that costs [energy:2] or more, gain [blue][Amount][/blue] [gold]Block[/gold].",
    "debuff": false,
    "icon": "danse_macabre_power.png"
  },
  {
    "name": "Speedster",
    "en": "Speedster",
    "zh": "速行者",
    "desc": "每当你在回合中抽到一张牌时，对所有敌人造成[blue]1[/blue]点伤害。",
    "desc_en": "Whenever you draw a card during your turn, deal [blue]1[/blue] damage to ALL enemies.",
    "debuff": false,
    "icon": "speedster_power.png"
  },
  {
    "name": "Shrink",
    "en": "Shrink",
    "zh": "缩小",
    "desc": "[gold]This creature的[/gold]攻击伤害减少[blue]30%[/blue]。",
    "desc_en": "[gold]This creature's[/gold] Attacks deal [blue]30%[/blue] less damage.",
    "debuff": true,
    "icon": "shrink_power.png"
  },
  {
    "name": "EscapeArtist",
    "en": "Escape Artist",
    "zh": "逃脱大师",
    "desc": "在4回合后离开战斗。",
    "desc_en": "Tries to escape the combat after [blue]2[/blue] turns.",
    "debuff": false,
    "icon": "escape_artist_power.png"
  },
  {
    "name": "PainfulStabs",
    "en": "Painful Stabs",
    "zh": "疼痛戳刺",
    "desc": "每次你受到未被格挡的伤害时，将[blue]1[/blue]张[gold]伤口[/gold]洗入你的[gold]弃牌堆[/gold]。",
    "desc_en": "Shuffle [blue]1[/blue] [gold]Wound[/gold] into your [gold]Discard Pile[/gold] each time you receive unblocked attack damage.",
    "debuff": false,
    "icon": "painful_stabs_power.png"
  },
  {
    "name": "Nemesis",
    "en": "Nemesis",
    "zh": "天罚",
    "desc": "每两个回合结束时，获得[blue]1[/blue]层[gold]无实体[/gold]。",
    "desc_en": "At the end of every other turn, gains [gold]Intangible[/gold] [blue]1[/blue].",
    "debuff": false,
    "icon": "nemesis_power.png"
  },
  {
    "name": "Thievery",
    "en": "Thievery",
    "zh": "偷窃",
    "desc": "攻击时偷走[gold]金币[/gold]。",
    "desc_en": "Steals [gold]Gold[/gold] when Attacking.",
    "debuff": false,
    "icon": "thievery_power.png"
  },
  {
    "name": "Envenom",
    "en": "Envenom",
    "zh": "涂毒",
    "desc": "每当你造成未被格挡的伤害时，给予[blue]1[/blue]层[gold]中毒[/gold]。",
    "desc_en": "Whenever you deal unblocked attack damage, apply [blue]1[/blue] [gold]Poison[/gold].",
    "debuff": false,
    "icon": "envenom_power.png"
  },
  {
    "name": "ConsumingShadow",
    "en": "Consuming Shadow",
    "zh": "吞噬暗影",
    "desc": "在你的回合结束时，[gold]激发[/gold]你最左侧的充能球。",
    "desc_en": "At the end of your turn, [gold]Evoke[/gold] your [blue]2[/blue] leftmost Orbs.",
    "debuff": false,
    "icon": "consuming_shadow_power.png"
  },
  {
    "name": "DevourLife",
    "en": "Devour Life",
    "zh": "吞噬生命",
    "desc": "每当你打出一张[gold]灵魂[/gold]时，[gold]召唤[/gold][blue]1[/blue]。",
    "desc_en": "Whenever you play a [gold]Soul[/gold], [gold]Summon[/gold] [blue]1[/blue].",
    "debuff": false,
    "icon": "devour_life_power.png"
  },
  {
    "name": "Disintegration",
    "en": "Disintegration",
    "zh": "瓦解",
    "desc": "在你的回合结束时，受到[blue]5[/blue]点伤害。",
    "desc_en": "At the end of your turn, take [blue]5[/blue] damage.",
    "debuff": true,
    "icon": "disintegration_power.png"
  },
  {
    "name": "NecroMastery",
    "en": "Necro Mastery",
    "zh": "亡灵精通",
    "desc": "每当[gold]奥斯提[/gold]失去生命值时，所有敌人失去等量生命值。",
    "desc_en": "Whenever [gold]Osty[/gold] loses HP, ALL enemies lose that much HP as well.",
    "debuff": false,
    "icon": "necro_mastery_power.png"
  },
  {
    "name": "Royalties",
    "en": "Royalties",
    "zh": "王国资产",
    "desc": "在战斗结束时，获得[blue]25[/blue][gold]金币[/gold]。",
    "desc_en": "At the end of combat, gain [blue]25[/blue] [gold]Gold[/gold].",
    "debuff": false,
    "icon": "royalties_power.png"
  },
  {
    "name": "MonarchsGaze",
    "en": "Monarch's Gaze",
    "zh": "王之凝视",
    "desc": "每当你攻击敌人时，这名敌人在本回合失去[blue]1[/blue]点[gold]力量[/gold]。",
    "desc_en": "Whenever you attack an enemy, it loses [blue]1[/blue] [gold]Strength[/gold] this turn.",
    "debuff": false,
    "icon": "monarchs_gaze_power.png"
  },
  {
    "name": "DieForYou",
    "en": "Die for You",
    "zh": "为你而死",
    "desc": "[gold]奥斯提[/gold]会吸收所有未被格挡的攻击伤害。",
    "desc_en": "[gold]Osty[/gold] absorbs all unblocked attack damage.",
    "debuff": false,
    "icon": "die_for_you_power.png"
  },
  {
    "name": "Tainted",
    "en": "Tainted",
    "zh": "污染",
    "desc": "在本回合受到额外的攻击伤害。",
    "desc_en": "Take additional damage from Attacks this turn.",
    "debuff": true,
    "icon": "tainted_power.png"
  },
  {
    "name": "NoEnergyGain",
    "en": "No Energy Gain",
    "zh": "无法获得能量",
    "desc": "你在本回合无法再获得更多[energy:1]。",
    "desc_en": "You cannot gain additional [energy:1] this turn.",
    "debuff": true,
    "icon": "no_energy_gain_power.png"
  },
  {
    "name": "InfiniteBlades",
    "en": "Infinite Blades",
    "zh": "无尽刀刃",
    "desc": "在你的回合开始时，在你的[gold]手牌[/gold]中加入一张[gold]小刀[/gold]。",
    "desc_en": "At the start of your turn, add [blue]2[/blue] [gold]Shivs[/gold] into your [gold]Hand[/gold].",
    "debuff": false,
    "icon": "infinite_blades_power.png"
  },
  {
    "name": "FeelNoPain",
    "en": "Feel No Pain",
    "zh": "无惧疼痛",
    "desc": "每当有一张牌被消耗时，获得[blue]3[/blue]点[gold]格挡[/gold]。",
    "desc_en": "Whenever a card is Exhausted, gain [blue]3[/blue] [gold]Block[/gold].",
    "debuff": false,
    "icon": "feel_no_pain_power.png"
  },
  {
    "name": "Intangible",
    "en": "Intangible",
    "zh": "无实体",
    "desc": "将本回合受到的所有伤害和生命减少效果降低为[blue]1[/blue]。",
    "desc_en": "Reduce all damage taken and HP loss to [blue]1[/blue] this turn.",
    "debuff": false,
    "icon": "intangible_power.png"
  },
  {
    "name": "Arsenal",
    "en": "Arsenal",
    "zh": "武器库",
    "desc": "每当你生成一张牌，就获得[blue]1[/blue]点[gold]力量[/gold]。",
    "desc_en": "Whenever you create a card, gain [blue]1[/blue] [gold]Strength[/gold].",
    "debuff": false,
    "icon": "arsenal_power.png"
  },
  {
    "name": "BeaconOfHope",
    "en": "Beacon of Hope",
    "zh": "希望灯塔",
    "desc": "每当你在你的回合获得[gold]格挡[/gold]时，其他玩家获得相应一半的[gold]格挡[/gold]。",
    "desc_en": "Whenever you gain [gold]Block[/gold] on your turn, other players gain half that much [gold]Block[/gold].",
    "debuff": false,
    "icon": "beacon_of_hope_power.png"
  },
  {
    "name": "DrawCardsNextTurn",
    "en": "Draw Cards Next Turn",
    "zh": "下回合抽牌",
    "desc": "在你的下回合开始时，额外抽[blue]1[/blue]张牌。",
    "desc_en": "At the start of your next turn, draw [blue]1[/blue] additional card.",
    "debuff": false,
    "icon": "draw_cards_next_turn_power.png"
  },
  {
    "name": "BlockNextTurn",
    "en": "Block Next Turn",
    "zh": "下回合格挡",
    "desc": "在你的下个回合开始时，获得[blue]4[/blue]点[gold]格挡[/gold]。",
    "desc_en": "At the start of your next turn, gain [blue]4[/blue] [gold]Block[/gold].",
    "debuff": false,
    "icon": "block_next_turn_power.png"
  },
  {
    "name": "StarNextTurn",
    "en": "Star Next Turn",
    "zh": "下回合辉星",
    "desc": "在下回合获得1[star:1]。",
    "desc_en": "Gain 1 [star:1] next turn.",
    "debuff": false,
    "icon": "star_next_turn_power.png"
  },
  {
    "name": "EnergyNextTurn",
    "en": "Energy Next Turn",
    "zh": "下回合能量",
    "desc": "在下回合额外获得[gold]能量[/gold]。",
    "desc_en": "Gain additional [gold]Energy[/gold] next turn.",
    "debuff": false,
    "icon": "energy_next_turn_power.png"
  },
  {
    "name": "SummonNextTurn",
    "en": "Summon Next Turn",
    "zh": "下回合召唤",
    "desc": "在你的下回合开始时，[gold]召唤[/gold][blue]2[/blue]。",
    "desc_en": "At the start of your next turn, [gold]Summon[/gold] [blue]2[/blue].",
    "debuff": false,
    "icon": "summon_next_turn_power.png"
  },
  {
    "name": "Demise",
    "en": "Demise",
    "zh": "消亡",
    "desc": "[gold]This creature[/gold]的回合结束时，[gold]this creature[/gold]失去[blue][Amount][/blue]点生命。",
    "desc_en": "At the end of [gold]this creature[/gold]'s turn, it loses [blue][Amount][/blue] HP.",
    "debuff": true,
    "icon": "demise_power.png"
  },
  {
    "name": "CrabRage",
    "en": "Crab Rage",
    "zh": "蟹之怒",
    "desc": "当有盟友死亡时，[gold]this creature[/gold]获得[blue]6[/blue]点[gold]力量[/gold]和[blue]99[/blue]点[gold]格挡[/gold]。",
    "desc_en": "When an ally dies, [gold]this creature[/gold] gains [blue]6[/blue] [gold]Strength[/gold] and [blue]99[/blue] [gold]Block[/gold].",
    "debuff": false,
    "icon": "crab_rage_power.png"
  },
  {
    "name": "MindRot",
    "en": "Mind Rot",
    "zh": "心灵腐化",
    "desc": "每回合少抽[blue]1[/blue]张牌。",
    "desc_en": "Draw [blue]1[/blue] fewer card each turn.",
    "debuff": true,
    "icon": "mind_rot_power.png"
  },
  {
    "name": "Pyre",
    "en": "Pyre",
    "zh": "薪火之源",
    "desc": "在每回合开始时获得[energy:1]。",
    "desc_en": "Gain [energy:1] at the start of each turn.",
    "debuff": false,
    "icon": "pyre_power.png"
  },
  {
    "name": "SignalBoost",
    "en": "Signal Boost",
    "zh": "信号增强",
    "desc": "你的下一张能力牌会额外打出一次。",
    "desc_en": "Your next [blue]2[/blue] Powers are played an extra time.",
    "debuff": false,
    "icon": "signal_boost_power.png"
  },
  {
    "name": "Vicious",
    "en": "Vicious",
    "zh": "凶恶",
    "desc": "每当你给予[gold]易伤[/gold], 抽[blue]1[/blue]张牌。",
    "desc_en": "Whenever you apply [gold]Vulnerable[/gold], draw [blue]1[/blue] card.",
    "debuff": false,
    "icon": "vicious_power.png"
  },
  {
    "name": "VoidForm",
    "en": "Void Form",
    "zh": "虚空形态",
    "desc": "每回合你打出的前[blue]2[/blue]张牌会免费打出。",
    "desc_en": "The first [blue]2[/blue] cards you play each turn are free to play.",
    "debuff": false,
    "icon": "void_form_power.png"
  },
  {
    "name": "CallOfTheVoid",
    "en": "Call of the Void",
    "zh": "虚空之唤",
    "desc": "在你的回合开始时，将[blue]1[/blue]张随机牌添加到你的[gold]手牌[/gold]并给予其[gold]虚无[/gold]。",
    "desc_en": "At the start of your turn, add [blue]1[/blue] random card into your [gold]Hand[/gold] and apply [gold]Ethereal[/gold] to it.",
    "debuff": false,
    "icon": "call_of_the_void_power.png"
  },
  {
    "name": "Weak",
    "en": "Weak",
    "zh": "虚弱",
    "desc": "虚弱的生物造成的攻击伤害减少[blue]25%[/blue]。",
    "desc_en": "Weakened creatures deal [blue]25%[/blue] less damage with Attacks.",
    "debuff": true,
    "icon": "weak_power.png"
  },
  {
    "name": "Spinner",
    "en": "Spinner",
    "zh": "旋转工艺",
    "desc": "在你的回合开始时，[gold]生成[/gold][blue]1[/blue]个[gold]玻璃充能球[/gold]。",
    "desc_en": "At the start of your turn, [gold]Channel[/gold] [blue]1[/blue] [gold]Glass[/gold].",
    "debuff": false,
    "icon": "spinner_power.png"
  },
  {
    "name": "SleightOfFlesh",
    "en": "Sleight of Flesh",
    "zh": "血肉戏法",
    "desc": "每当你给予一个敌人负面状态时，使其受到[blue]13[/blue]点伤害。",
    "desc_en": "Whenever you apply a debuff to an enemy, they take [blue]13[/blue] damage.",
    "debuff": false,
    "icon": "sleight_of_flesh_power.png"
  },
  {
    "name": "Loop",
    "en": "Loop",
    "zh": "循环",
    "desc": "在你的回合开始时，触发你最右侧充能球的被动能力。",
    "desc_en": "At the start of your turn, trigger the passive ability of your next Orb.",
    "debuff": false,
    "icon": "loop_power.png"
  },
  {
    "name": "Smokestack",
    "en": "Smokestack",
    "zh": "烟囱",
    "desc": "每当你生成一张状态牌时，对所有敌人造成伤害。",
    "desc_en": "Whenever you create a Status, deal damage to ALL enemies.",
    "debuff": false,
    "icon": "smokestack_power.png"
  },
  {
    "name": "Smoggy",
    "en": "Smoggy",
    "zh": "烟雾弥漫",
    "desc": "每回合你只能打出[blue]1[/blue]张技能牌。",
    "desc_en": "You can only play [blue]1[/blue] Skill per turn.",
    "debuff": true,
    "icon": "smoggy_power.png"
  },
  {
    "name": "Oblivion",
    "en": "Oblivion",
    "zh": "湮灭",
    "desc": "你在本回合内每打出一张牌，就给予该敌人[blue]1[/blue]层[gold]灾厄[/gold]。",
    "desc_en": "Whenever you play a card, this enemy gains [blue]1[/blue] [gold]Doom[/gold].",
    "debuff": true,
    "icon": "oblivion_power.png"
  },
  {
    "name": "Covered",
    "en": "Covered",
    "zh": "掩护",
    "desc": "有盟友在掩护你。所有朝向你的攻击会被改为瞄准对方。",
    "desc_en": "An ally is covering you. All attacks that would be directed to you are redirected to them instead.",
    "debuff": false,
    "icon": "covered_power.png"
  },
  {
    "name": "Feral",
    "en": "Feral",
    "zh": "野性",
    "desc": "每回合你第一次打出0[energy:1]攻击牌时，将其放回你的[gold]手牌[/gold]中。",
    "desc_en": "The first [blue]2[/blue] times you play a 0[energy:1] Attack each turn, return it to your [gold]Hand[/gold].",
    "debuff": false,
    "icon": "feral_power.png"
  },
  {
    "name": "Nightmare",
    "en": "Nightmare",
    "zh": "夜魇",
    "desc": "在下个回合，将所选牌的[blue]3[/blue]张复制品加入你的[gold]手牌[/gold]。",
    "desc_en": "Add [blue]2[/blue] [gold][Card][/gold] cards into your [gold]Hand[/gold] next turn.",
    "debuff": false,
    "icon": "nightmare_power.png"
  },
  {
    "name": "Ritual",
    "en": "Ritual",
    "zh": "仪式",
    "desc": "在你的回合结束时获得[gold]力量[/gold]。",
    "desc_en": "Gain [gold]Strength[/gold] at the end of your turn.",
    "debuff": false,
    "icon": "ritual_power.png"
  },
  {
    "name": "Dampen",
    "en": "Dampen",
    "zh": "抑制",
    "desc": "魔法骑士存活时，你的所有卡牌被[gold]降级[/gold]。",
    "desc_en": "While Magi Knight is alive, ALL your cards are [gold]Downgraded[/gold].",
    "debuff": true,
    "icon": "dampen_power.png"
  },
  {
    "name": "Vulnerable",
    "en": "Vulnerable",
    "zh": "易伤",
    "desc": "[blue][Amount][/blue]回合内，受到的攻击伤害增加[blue]50%[/blue]。",
    "desc_en": "Receive [blue]50%[/blue] more damage from Attacks for [blue][Amount][/blue] turns.",
    "debuff": true,
    "icon": "vulnerable_power.png"
  },
  {
    "name": "Surprise",
    "en": "Surprise",
    "zh": "意外",
    "desc": "这个生物有点不太对劲……",
    "desc_en": "Something is off about this creature...",
    "debuff": false,
    "icon": "surprise_power.png"
  },
  {
    "name": "LightningRod",
    "en": "Lightning Rod",
    "zh": "引雷针",
    "desc": "在下[blue]2[/blue]个回合开始时，[gold]生成[/gold][blue]1[/blue]个[gold]闪电[/gold]充能球。",
    "desc_en": "At the start of the next [blue]2[/blue] turns, [gold]Channel[/gold] [blue]1[/blue] [gold]Lightning[/gold].",
    "debuff": false,
    "icon": "lightning_rod_power.png"
  },
  {
    "name": "Gravity",
    "en": "Gravity",
    "zh": "引力",
    "desc": "本回合，你每打出一张牌，对所有敌人造成[blue]2[/blue]点伤害。",
    "desc_en": "Whenever you play a card this turn, deal [blue]2[/blue] damage to ALL enemies.",
    "debuff": false,
    "icon": "gravity_power.png"
  },
  {
    "name": "HardenedShell",
    "en": "Hardened Shell",
    "zh": "硬化外壳",
    "desc": "[gold]This creature[/gold]每回合失去的生命值不会超过[blue][Amount][/blue]点。",
    "desc_en": "[gold]This creature[/gold] cannot lose more than [blue][Amount][/blue] HP each turn.",
    "debuff": false,
    "icon": "hardened_shell_power.png"
  },
  {
    "name": "WraithForm",
    "en": "Wraith Form",
    "zh": "幽魂形态",
    "desc": "在你的回合开始时，失去[blue]1[/blue]点[gold]敏捷[/gold]。",
    "desc_en": "At the start of your turn, lose [blue]1[/blue] [gold]Dexterity[/gold].",
    "debuff": true,
    "icon": "wraith_form_power.png"
  },
  {
    "name": "Friendship",
    "en": "Friendship",
    "zh": "友谊",
    "desc": "每回合开始时获得[energy:1]。",
    "desc_en": "Gain [energy:1] at the start of each turn.",
    "debuff": false,
    "icon": "friendship_power.png"
  },
  {
    "name": "Afterimage",
    "en": "Afterimage",
    "zh": "余像",
    "desc": "你每打出一张牌，都获得[blue]1[/blue]点[gold]格挡[/gold]。",
    "desc_en": "Whenever you play a card, gain [blue]1[/blue] [gold]Block[/gold].",
    "debuff": false,
    "icon": "afterimage_power.png"
  },
  {
    "name": "Inferno",
    "en": "Inferno",
    "zh": "狱火",
    "desc": "在你的回合开始时，失去[blue]0[/blue]点生命。每当你在自己的回合中失去生命时，对所有敌人造成[blue][Amount][/blue]点伤害。",
    "desc_en": "At the start of your turn, lose [blue]0[/blue] HP. Whenever you lose HP on your turn, deal [blue][Amount][/blue] damage to ALL enemies.",
    "debuff": false,
    "icon": "inferno_power.png"
  },
  {
    "name": "BorrowedTime",
    "en": "Borrowed Time",
    "zh": "预借时间",
    "desc": "卡牌在本回合耗能增加[energy:1]。",
    "desc_en": "Cards cost an additional [energy:1] this turn.",
    "debuff": true,
    "icon": "borrowed_time_power.png"
  },
  {
    "name": "Juggling",
    "en": "Juggling",
    "zh": "杂耍",
    "desc": "将你在每回合打出的第三张攻击牌的复制品加入你的[gold]手牌[/gold]。",
    "desc_en": "Add a copy of the third Attack you play each turn into your [gold]Hand[/gold].",
    "debuff": false,
    "icon": "juggling_power.png"
  },
  {
    "name": "Doom",
    "en": "Doom",
    "zh": "灾厄",
    "desc": "在敌人的回合结束时，如果[gold]this creature[/gold]的生命值不高于[blue][Amount][/blue]，则[gold]this creature[/gold]立即死亡。",
    "desc_en": "At the end of the enemy turn, if [gold]this creature[/gold] has [blue][Amount][/blue] or less HP, it dies.",
    "debuff": true,
    "icon": "doom_power.png"
  },
  {
    "name": "Regen",
    "en": "Regen",
    "zh": "再生",
    "desc": "[gold]再生[/gold]会在你的回合结束时回复相应生命。每回合[gold]再生[/gold]的数值会减少[blue]1[/blue]。",
    "desc_en": "[gold]Regen[/gold] heals HP at the end of your turn. Each turn, [gold]Regen[/gold] is reduced by [blue]1[/blue].",
    "debuff": false,
    "icon": "regen_power.png"
  },
  {
    "name": "Surrounded",
    "en": "Surrounded",
    "zh": "遭到包围",
    "desc": "被从后方攻击时受到的伤害增加[blue]50%[/blue]。使用有目标的卡牌或药水来改变你的朝向。",
    "desc_en": "Receive [blue]50%[/blue] more damage if attacked from behind. Use targeting cards or potions to change your orientation.",
    "debuff": true,
    "icon": "surrounded_power.png"
  },
  {
    "name": "TheBomb",
    "en": "The Bomb",
    "zh": "炸弹",
    "desc": "在第[blue]{}[/blue]回合结束时，对所有敌人造成[blue]40[/blue]点伤害。",
    "desc_en": "At the end of [blue]3[/blue] turns, deal [blue]40[/blue] damage to ALL enemies.",
    "debuff": false,
    "icon": "the_bomb_power.png"
  },
  {
    "name": "Parry",
    "en": "Parry",
    "zh": "招架",
    "desc": "[gold]君王之剑[/gold]现在能让你获得[gold]格挡[/gold]。",
    "desc_en": "[gold]Sovereign Blade[/gold] now gains [gold]Block[/gold].",
    "debuff": false,
    "icon": "parry_power.png"
  },
  {
    "name": "Minion",
    "en": "Minion",
    "zh": "爪牙",
    "desc": "爪牙会在他们的领导者死亡时放弃战斗。",
    "desc_en": "Minions abandon combat without their leader.",
    "debuff": false,
    "icon": "minion_power.png"
  },
  {
    "name": "Flutter",
    "en": "Flutter",
    "zh": "振翅",
    "desc": "从攻击牌中受到的伤害减少[gold]50%[/gold]。对其造成[blue][Amount][/blue]次攻击伤害可以将其[gold]击晕[/gold]。",
    "desc_en": "Receives [blue]50%[/blue] less damage from Attacks. Deal attack damage [blue][Amount][/blue] times to [gold]Stun[/gold] it.",
    "debuff": false,
    "icon": "flutter_power.png"
  },
  {
    "name": "Conqueror",
    "en": "Conqueror",
    "zh": "征服者",
    "desc": "[gold]君王之剑[/gold]在[blue][Amount][/blue]回合内对[gold]this creature[/gold]造成双倍伤害。",
    "desc_en": "[gold]Sovereign Blade[/gold] deals double damage to [gold]this creature[/gold] for the next [blue]2[/blue] turns.",
    "debuff": true,
    "icon": "conqueror_power.png"
  },
  {
    "name": "SteamEruption",
    "en": "Steam Eruption",
    "zh": "蒸汽喷发",
    "desc": "被击杀时，在你的下一回合结束时造成伤害。",
    "desc_en": "When killed, deals damage at the end of your next turn.",
    "debuff": false,
    "icon": "steam_eruption_power.png"
  },
  {
    "name": "PaperCuts",
    "en": "Paper Cuts",
    "zh": "纸伤难愈",
    "desc": "每当[gold]this creature[/gold]对你造成未被格挡的伤害时，你失去[blue][Amount][/blue]点[gold]最大生命[/gold]。",
    "desc_en": "Whenever [gold]this creature[/gold] deals unblocked attack damage to you, you lose [blue][Amount][/blue] [gold]Max HP[/gold].",
    "debuff": false,
    "icon": "paper_cuts_power.png"
  },
  {
    "name": "Lethality",
    "en": "Lethality",
    "zh": "致死性",
    "desc": "每回合的第一张攻击牌会造成50%额外伤害。",
    "desc_en": "The first Attack each turn deals 50% additional damage.",
    "debuff": false,
    "icon": "lethality_power.png"
  },
  {
    "name": "Poison",
    "en": "Poison",
    "zh": "中毒",
    "desc": "中毒的生物会在自身回合开始时失去生命。中毒层数每回合减少[blue]1[/blue]。",
    "desc_en": "Poisoned creatures lose HP at the start of their turn. Each turn, Poison is reduced by [blue]1[/blue].",
    "debuff": true,
    "icon": "poison_power.png"
  },
  {
    "name": "SeekingEdge",
    "en": "Seeking Edge",
    "zh": "追踪之刃",
    "desc": "[gold]君王之剑[/gold]现在会对所有敌人造成伤害。",
    "desc_en": "[gold]Sovereign Blade[/gold] now hits ALL enemies.",
    "debuff": false,
    "icon": "seeking_edge_power.png"
  },
  {
    "name": "PrepTime",
    "en": "Prep Time",
    "zh": "准备时间",
    "desc": "在你的回合开始时，获得[blue]4[/blue]点[gold]活力[/gold]。",
    "desc_en": "At the start of your turn, gain [blue]4[/blue] [gold]Vigor[/gold].",
    "debuff": false,
    "icon": "prep_time_power.png"
  },
  {
    "name": "Subroutine",
    "en": "Subroutine",
    "zh": "子程序",
    "desc": "你每次打出能力牌时，都获得[blue]1[/blue][energy:1]。",
    "desc_en": "Whenever you play a Power, gain [blue]1[/blue] [energy:1].",
    "debuff": false,
    "icon": "subroutine_power.png"
  },
  {
    "name": "SelfFormingClay",
    "en": "Self-Forming Clay",
    "zh": "自成型黏土",
    "desc": "在下回合获得[blue]3[/blue]点[gold]格挡[/gold]。",
    "desc_en": "Gain [blue]3[/blue] [gold]Block[/gold] next turn.",
    "debuff": false,
    "icon": "self_forming_clay_power.png"
  },
  {
    "name": "Automation",
    "en": "Automation",
    "zh": "自动化",
    "desc": "你每抽[blue]10[/blue]张牌时，获得[energy:1]。",
    "desc_en": "Every [blue]10[/blue] cards you draw, gain [energy:1].",
    "debuff": false,
    "icon": "automation_power.png"
  },
  {
    "name": "Ambergris",
    "en": "Ambergris",
    "zh": "Ambergris",
    "desc": "",
    "desc_en": "",
    "debuff": false,
    "icon": ""
  },
  {
    "name": "Cacophony",
    "en": "Cacophony",
    "zh": "Cacophony",
    "desc": "",
    "desc_en": "",
    "debuff": false,
    "icon": ""
  },
  {
    "name": "Concoct",
    "en": "Concoct",
    "zh": "Concoct",
    "desc": "",
    "desc_en": "",
    "debuff": false,
    "icon": ""
  },
  {
    "name": "Fade",
    "en": "Fade",
    "zh": "Fade",
    "desc": "",
    "desc_en": "",
    "debuff": false,
    "icon": ""
  },
  {
    "name": "Hibernate",
    "en": "Hibernate",
    "zh": "Hibernate",
    "desc": "",
    "desc_en": "",
    "debuff": false,
    "icon": ""
  },
  {
    "name": "HyperbeamFocusDown",
    "en": "HyperbeamFocusDown",
    "zh": "HyperbeamFocusDown",
    "desc": "",
    "desc_en": "",
    "debuff": false,
    "icon": ""
  },
  {
    "name": "ImitationLearning",
    "en": "ImitationLearning",
    "zh": "ImitationLearning",
    "desc": "",
    "desc_en": "",
    "debuff": false,
    "icon": ""
  },
  {
    "name": "OneForAll",
    "en": "OneForAll",
    "zh": "OneForAll",
    "desc": "",
    "desc_en": "",
    "debuff": false,
    "icon": ""
  },
  {
    "name": "Soulbound",
    "en": "Soulbound",
    "zh": "Soulbound",
    "desc": "",
    "desc_en": "",
    "debuff": false,
    "icon": ""
  },
  {
    "name": "Anticipate",
    "en": "Temporary Dexterity",
    "zh": "Temporary Dexterity",
    "desc": "在本回合结束前获得[gold]敏捷[/gold]。",
    "desc_en": "Gain [gold]Dexterity[/gold] until the end of this turn.",
    "debuff": false,
    "icon": "anticipate_power.png"
  },
  {
    "name": "HelicalDart",
    "en": "Temporary Dexterity",
    "zh": "Temporary Dexterity",
    "desc": "在本回合结束前获得[gold]敏捷[/gold]。",
    "desc_en": "Gain [gold]Dexterity[/gold] until the end of this turn.",
    "debuff": false,
    "icon": "helical_dart_power.png"
  },
  {
    "name": "SpeedPotion",
    "en": "Temporary Dexterity",
    "zh": "Temporary Dexterity",
    "desc": "在本回合结束前获得[gold]敏捷[/gold]。",
    "desc_en": "Gain [gold]Dexterity[/gold] until the end of this turn.",
    "debuff": false,
    "icon": "speed_potion_power.png"
  },
  {
    "name": "FocusedStrike",
    "en": "Temporary Focus",
    "zh": "Temporary Focus",
    "desc": "在本回合结束前获得[gold]集中[/gold]。",
    "desc_en": "Gain [gold]Focus[/gold] until the end of this turn.",
    "debuff": false,
    "icon": "focused_strike_power.png"
  },
  {
    "name": "Hotfix",
    "en": "Temporary Focus",
    "zh": "Temporary Focus",
    "desc": "在本回合结束前获得[gold]集中[/gold]。",
    "desc_en": "Gain [gold]Focus[/gold] until the end of this turn.",
    "debuff": false,
    "icon": "hotfix_power.png"
  },
  {
    "name": "Synchronize",
    "en": "Temporary Focus",
    "zh": "Temporary Focus",
    "desc": "在本回合结束前获得[gold]集中[/gold]。",
    "desc_en": "Gain [gold]Focus[/gold] until the end of this turn.",
    "debuff": false,
    "icon": "synchronize_power.png"
  },
  {
    "name": "Coordinate",
    "en": "Temporary Strength",
    "zh": "Temporary Strength",
    "desc": "在本回合结束前获得[gold]力量[/gold]。",
    "desc_en": "Gain [gold]Strength[/gold] until the end of this turn.",
    "debuff": false,
    "icon": "coordinate_power.png"
  },
  {
    "name": "FeedingFrenzy",
    "en": "Temporary Strength",
    "zh": "Temporary Strength",
    "desc": "在本回合结束前获得[gold]力量[/gold]。",
    "desc_en": "Gain [gold]Strength[/gold] until the end of this turn.",
    "debuff": false,
    "icon": "feeding_frenzy_power.png"
  },
  {
    "name": "FlexPotion",
    "en": "Temporary Strength",
    "zh": "Temporary Strength",
    "desc": "在本回合结束前获得[gold]力量[/gold]。",
    "desc_en": "Gain [gold]Strength[/gold] until the end of this turn.",
    "debuff": false,
    "icon": "flex_potion_power.png"
  },
  {
    "name": "ReptileTrinket",
    "en": "Temporary Strength",
    "zh": "Temporary Strength",
    "desc": "在本回合结束前获得[gold]力量[/gold]。",
    "desc_en": "Gain [gold]Strength[/gold] until the end of this turn.",
    "debuff": false,
    "icon": "reptile_trinket_power.png"
  },
  {
    "name": "SetupStrike",
    "en": "Temporary Strength",
    "zh": "Temporary Strength",
    "desc": "在本回合结束前获得[gold]力量[/gold]。",
    "desc_en": "Gain [gold]Strength[/gold] until the end of this turn.",
    "debuff": false,
    "icon": "setup_strike_power.png"
  },
  {
    "name": "CrushUnder",
    "en": "Temporary Strength Down",
    "zh": "Temporary Strength Down",
    "desc": "在本回合结束前失去[gold]力量[/gold]。",
    "desc_en": "Lose [gold]Strength[/gold] until the end of this turn.",
    "debuff": true,
    "icon": "crush_under_power.png"
  },
  {
    "name": "DarkShackles",
    "en": "Temporary Strength Down",
    "zh": "Temporary Strength Down",
    "desc": "在本回合结束前失去[gold]力量[/gold]。",
    "desc_en": "Lose [gold]Strength[/gold] until the end of this turn.",
    "debuff": true,
    "icon": "dark_shackles_power.png"
  },
  {
    "name": "DyingStar",
    "en": "Temporary Strength Down",
    "zh": "Temporary Strength Down",
    "desc": "在本回合结束前失去[gold]力量[/gold]。",
    "desc_en": "Lose [gold]Strength[/gold] until the end of this turn.",
    "debuff": true,
    "icon": "dying_star_power.png"
  },
  {
    "name": "EnfeeblingTouch",
    "en": "Temporary Strength Down",
    "zh": "Temporary Strength Down",
    "desc": "在本回合结束前失去[gold]力量[/gold]。",
    "desc_en": "Lose [gold]Strength[/gold] until the end of this turn.",
    "debuff": true,
    "icon": "enfeebling_touch_power.png"
  },
  {
    "name": "Mangle",
    "en": "Temporary Strength Down",
    "zh": "Temporary Strength Down",
    "desc": "在本回合结束前失去[gold]力量[/gold]。",
    "desc_en": "Lose [gold]Strength[/gold] until the end of this turn.",
    "debuff": true,
    "icon": "mangle_power.png"
  },
  {
    "name": "MonarchsGazeStrengthDown",
    "en": "Temporary Strength Down",
    "zh": "Temporary Strength Down",
    "desc": "在本回合结束前失去[gold]力量[/gold]。",
    "desc_en": "Lose [gold]Strength[/gold] until the end of this turn.",
    "debuff": true,
    "icon": "monarchs_gaze_strength_down_power.png"
  },
  {
    "name": "PiercingWail",
    "en": "Temporary Strength Down",
    "zh": "Temporary Strength Down",
    "desc": "在本回合结束前失去[gold]力量[/gold]。",
    "desc_en": "Lose [gold]Strength[/gold] until the end of this turn.",
    "debuff": true,
    "icon": "piercing_wail_power.png"
  },
  {
    "name": "ShacklingPotion",
    "en": "Temporary Strength Down",
    "zh": "Temporary Strength Down",
    "desc": "在本回合结束前失去[gold]力量[/gold]。",
    "desc_en": "Lose [gold]Strength[/gold] until the end of this turn.",
    "debuff": true,
    "icon": "shackling_potion_power.png"
  },
  {
    "name": "Underworld",
    "en": "Underworld",
    "zh": "Underworld",
    "desc": "",
    "desc_en": "",
    "debuff": false,
    "icon": ""
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
