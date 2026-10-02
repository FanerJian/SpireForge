/** 游戏怪物目录（114 项）——由 tools/extract-monster-catalog.mjs 生成，勿手改。
 *  数据源：反编译 v0.111.0 全部具体 MonsterModel 子类 + spire-codex zhs/eng 官方图鉴。
 *  name = 类名（Runtime SfMonsterResolver 同时匹配类名与 Id.Entry）。 */
export interface MonsterEntry {
  /** 类名（如 DampCultist），召唤效果的 params.monster 值 */
  name: string;
  /** 官方英文名 */
  en: string;
  /** 官方中文名（如 潮湿邪教徒） */
  zh: string;
  /** 分类：Normal / Elite / Boss / …（可能为空） */
  type: string;
  /** 原生生命区间文本（如 "51-53"，可能为空） */
  hp: string;
}

export const MONSTERS: MonsterEntry[] = [
  {
    "name": "Osty",
    "en": "Osty",
    "zh": "奥斯提",
    "type": "Normal",
    "hp": "1"
  },
  {
    "name": "SneakyGremlin",
    "en": "Sneaky Gremlin",
    "zh": "卑鄙地精",
    "type": "Normal",
    "hp": "10-14"
  },
  {
    "name": "Toadpole",
    "en": "Toadpole",
    "zh": "蟾蜍蝌蚪",
    "type": "Normal",
    "hp": "21-25"
  },
  {
    "name": "DampCultist",
    "en": "Damp Cultist",
    "zh": "潮湿邪教徒",
    "type": "Normal",
    "hp": "51-53"
  },
  {
    "name": "Stabbot",
    "en": "Stabbot",
    "zh": "戳刺机器人",
    "type": "Normal",
    "hp": "18-23"
  },
  {
    "name": "Tunneler",
    "en": "Tunneler",
    "zh": "地道虫",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "GremlinMerc",
    "en": "Gremlin Merc",
    "zh": "地精佣兵",
    "type": "Normal",
    "hp": "47-49"
  },
  {
    "name": "Zapbot",
    "en": "Zapbot",
    "zh": "电击机器人",
    "type": "Normal",
    "hp": "18-23"
  },
  {
    "name": "GlobeHead",
    "en": "Globe Head",
    "zh": "电球头",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "TheAdversaryMkOne",
    "en": "The Adversary Mk 1",
    "zh": "对手1型",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "TheAdversaryMkTwo",
    "en": "The Adversary Mk 2",
    "zh": "对手2型",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "TheAdversaryMkThree",
    "en": "The Adversary Mk 3",
    "zh": "对手3型",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "Byrdonis",
    "en": "Byrdonis",
    "zh": "多尼斯异鸟",
    "type": "Elite",
    "hp": "81-84"
  },
  {
    "name": "Flyconid",
    "en": "Flyconid",
    "zh": "飞蝇菌子",
    "type": "Normal",
    "hp": "47-49"
  },
  {
    "name": "Entomancer",
    "en": "Entomancer",
    "zh": "蜂群术士",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "CalcifiedCultist",
    "en": "Calcified Cultist",
    "zh": "钙化邪教徒",
    "type": "Normal",
    "hp": "38-41"
  },
  {
    "name": "InfestedPrism",
    "en": "Infested Prism",
    "zh": "感染棱柱",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "TurretOperator",
    "en": "Turret Operator",
    "zh": "高塔炮手",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "SkulkingColony",
    "en": "Skulking Colony",
    "zh": "鬼祟珊瑚群",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "Seapunk",
    "en": "Seapunk",
    "zh": "海洋混混",
    "type": "Normal",
    "hp": "44-46"
  },
  {
    "name": "TerrorEel",
    "en": "Terror Eel",
    "zh": "骇鳗",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "PhantasmalGardener",
    "en": "Phantasmal Gardener",
    "zh": "花园幽灵鳗",
    "type": "Elite",
    "hp": "26-31"
  },
  {
    "name": "FossilStalker",
    "en": "Fossil Stalker",
    "zh": "化石追踪者",
    "type": "Normal",
    "hp": "51-53"
  },
  {
    "name": "LivingShield",
    "en": "Living Shield",
    "zh": "活体盾",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "LivingFog",
    "en": "Living Fog",
    "zh": "活雾",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "Rocket",
    "en": "Rocket",
    "zh": "火箭",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "TorchHeadAmalgam",
    "en": "Torch Head Amalgam",
    "zh": "火炬头聚合体",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "MechaKnight",
    "en": "Mecha Knight",
    "zh": "机甲骑士",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "SpinyToad",
    "en": "Spiny Toad",
    "zh": "棘刺蟾蜍",
    "type": "Normal",
    "hp": "116-119"
  },
  {
    "name": "Parafright",
    "en": "Parafright",
    "zh": "寄生惧魔",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "Architect",
    "en": "The Architect",
    "zh": "建筑师",
    "type": "Normal",
    "hp": "9999"
  },
  {
    "name": "BruteRubyRaider",
    "en": "Brute Raider",
    "zh": "劫掠者暴徒",
    "type": "Normal",
    "hp": "30-33"
  },
  {
    "name": "AssassinRubyRaider",
    "en": "Assassin Raider",
    "zh": "劫掠者刺客",
    "type": "Normal",
    "hp": "18-23"
  },
  {
    "name": "AxeRubyRaider",
    "en": "Axe Raider",
    "zh": "劫掠者斧手",
    "type": "Normal",
    "hp": "20-22"
  },
  {
    "name": "CrossbowRubyRaider",
    "en": "Crossbow Raider",
    "zh": "劫掠者弩手",
    "type": "Normal",
    "hp": "18-21"
  },
  {
    "name": "TrackerRubyRaider",
    "en": "Tracker Raider",
    "zh": "劫掠者追踪手",
    "type": "Normal",
    "hp": "21-25"
  },
  {
    "name": "ToughEgg",
    "en": "Tough Egg",
    "zh": "结实的卵",
    "type": "Normal",
    "hp": "14-18"
  },
  {
    "name": "BygoneEffigy",
    "en": "Bygone Effigy",
    "zh": "旧日雕像",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "Axebot",
    "en": "Axebot",
    "zh": "巨斧机器人",
    "type": "Normal",
    "hp": "70-78"
  },
  {
    "name": "Chomper",
    "en": "Chomper",
    "zh": "啃咬机",
    "type": "Normal",
    "hp": "60-64"
  },
  {
    "name": "LagavulinMatriarch",
    "en": "Lagavulin Matriarch",
    "zh": "乐加维林族母",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "CubexConstruct",
    "en": "Cubex Construct",
    "zh": "立柱构造体",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "EyeWithTeeth",
    "en": "Eye with Teeth",
    "zh": "利齿之眼",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "FlailKnight",
    "en": "Flail Knight",
    "zh": "连枷骑士",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "HunterKiller",
    "en": "Hunter Killer",
    "zh": "猎人杀手",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "SoulNexus",
    "en": "Soul Nexus",
    "zh": "灵魂枢纽",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "SoulFysh",
    "en": "Soul Fysh",
    "zh": "灵魂异鱼",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "TheObscura",
    "en": "The Obscura",
    "zh": "胧光怪",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "Mawler",
    "en": "Mawler",
    "zh": "蛮兽",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "OwlMagistrate",
    "en": "Owl Magistrate",
    "zh": "猫头鹰法官",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "FuzzyWurmCrawler",
    "en": "Fuzzy Wurm Crawler",
    "zh": "毛绒伏地虫",
    "type": "Normal",
    "hp": "55-57"
  },
  {
    "name": "MagiKnight",
    "en": "Magi Knight",
    "zh": "魔法骑士",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "Inklet",
    "en": "Inklet",
    "zh": "墨宝",
    "type": "Normal",
    "hp": "11-17"
  },
  {
    "name": "Vantom",
    "en": "Vantom",
    "zh": "墨影幻灵",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "Crusher",
    "en": "Crusher",
    "zh": "碾碎爪",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "Wriggler",
    "en": "Wriggler",
    "zh": "扭动虫",
    "type": "Elite",
    "hp": "17-21"
  },
  {
    "name": "Queen",
    "en": "Queen",
    "zh": "女王",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "FatGremlin",
    "en": "Fat Gremlin",
    "zh": "胖地精",
    "type": "Normal",
    "hp": "13-17"
  },
  {
    "name": "PaelsLegion",
    "en": "Pael's Legion",
    "zh": "佩尔的士兵",
    "type": "Normal",
    "hp": "9999"
  },
  {
    "name": "WaterfallGiant",
    "en": "Waterfall Giant",
    "zh": "瀑布巨兽",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "GasBomb",
    "en": "Gas Bomb",
    "zh": "气态炸弹",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "DevotedSculptor",
    "en": "Devoted Sculptor",
    "zh": "虔诚雕刻师",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "FrogKnight",
    "en": "Frog Knight",
    "zh": "青蛙骑士",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "PunchConstruct",
    "en": "Punch Construct",
    "zh": "拳击构装体",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "SnappingJaxfruit",
    "en": "Snapping Jaxfruit",
    "zh": "闪光贾克斯果",
    "type": "Normal",
    "hp": "31-33"
  },
  {
    "name": "FakeMerchantMonster",
    "en": "The Merchant???",
    "zh": "商人？？？",
    "type": "Normal",
    "hp": "165"
  },
  {
    "name": "SlitheringStrangler",
    "en": "Slithering Strangler",
    "zh": "蛇行扼杀者",
    "type": "Normal",
    "hp": "53-55"
  },
  {
    "name": "MysteriousKnight",
    "en": "Mysterious Knight",
    "zh": "神秘骑士",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "BowlbugEgg",
    "en": "Bowlbug (Egg)",
    "zh": "盛碗虫（卵）",
    "type": "Normal",
    "hp": "21-22"
  },
  {
    "name": "BowlbugNectar",
    "en": "Bowlbug (Nectar)",
    "zh": "盛碗虫（蜜）",
    "type": "Normal",
    "hp": "35-38"
  },
  {
    "name": "BowlbugRock",
    "en": "Bowlbug (Rock)",
    "zh": "盛碗虫（石）",
    "type": "Normal",
    "hp": "45-48"
  },
  {
    "name": "BowlbugSilk",
    "en": "Bowlbug (Silk)",
    "zh": "盛碗虫（丝）",
    "type": "Normal",
    "hp": "40-43"
  },
  {
    "name": "TheLost",
    "en": "The Lost",
    "zh": "失落之物",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "LouseProgenitor",
    "en": "Louse Progenitor",
    "zh": "虱虫之祖",
    "type": "Normal",
    "hp": "134-136"
  },
  {
    "name": "TestSubject",
    "en": "Test Subject #C14",
    "zh": "实验体 #C14",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "SlimedBerserker",
    "en": "Slimed Berserker",
    "zh": "史莱姆狂战士",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "CorpseSlug",
    "en": "Corpse Slug",
    "zh": "噬尸蛞蝓",
    "type": "Normal",
    "hp": "25-27"
  },
  {
    "name": "Guardbot",
    "en": "Guardbot",
    "zh": "守护机器人",
    "type": "Normal",
    "hp": "16-20"
  },
  {
    "name": "SlumberingBeetle",
    "en": "Slumbering Beetle",
    "zh": "熟睡甲虫",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "LeafSlimeS",
    "en": "Leaf Slime (S)",
    "zh": "树叶史莱姆（小）",
    "type": "Normal",
    "hp": "11-15"
  },
  {
    "name": "LeafSlimeM",
    "en": "Leaf Slime (M)",
    "zh": "树叶史莱姆（中）",
    "type": "Normal",
    "hp": "32-35"
  },
  {
    "name": "TwigSlimeS",
    "en": "Twig Slime (S)",
    "zh": "树枝史莱姆（小）",
    "type": "Normal",
    "hp": "7-11"
  },
  {
    "name": "TwigSlimeM",
    "en": "Twig Slime (M)",
    "zh": "树枝史莱姆（中）",
    "type": "Normal",
    "hp": "26-28"
  },
  {
    "name": "TwoTailedRat",
    "en": "Two-Tailed Rat",
    "zh": "双尾鼠",
    "type": "Normal",
    "hp": "17-21"
  },
  {
    "name": "ShrinkerBeetle",
    "en": "Shrinker Beetle",
    "zh": "缩小甲虫",
    "type": "Normal",
    "hp": "38-40"
  },
  {
    "name": "VineShambler",
    "en": "Vine Shambler",
    "zh": "藤蔓蹒跚者",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "KinPriest",
    "en": "Kin Priest",
    "zh": "同族神官",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "KinFollower",
    "en": "Kin Follower",
    "zh": "同族信徒",
    "type": "Boss",
    "hp": "58-59"
  },
  {
    "name": "ThievingHopper",
    "en": "Thieving Hopper",
    "zh": "偷窃草蜢",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "Exoskeleton",
    "en": "Exoskeleton",
    "zh": "外骨骼虫",
    "type": "Normal",
    "hp": "24-28"
  },
  {
    "name": "TheInsatiable",
    "en": "The Insatiable",
    "zh": "无厌沙虫",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "Fogmog",
    "en": "Fogmog",
    "zh": "雾菇",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "SewerClam",
    "en": "Sewer Clam",
    "zh": "下水道蚌",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "Nibbit",
    "en": "Nibbit",
    "zh": "小啃兽",
    "type": "Normal",
    "hp": "42-46"
  },
  {
    "name": "ScrollOfBiting",
    "en": "Scroll of Biting",
    "zh": "咬人卷轴",
    "type": "Normal",
    "hp": "30-37"
  },
  {
    "name": "CeremonialBeast",
    "en": "Ceremonial Beast",
    "zh": "仪式兽",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "TheForgotten",
    "en": "The Forgotten",
    "zh": "遗忘之物",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "Myte",
    "en": "Myte",
    "zh": "异螨",
    "type": "Normal",
    "hp": "61-67"
  },
  {
    "name": "Byrdpip",
    "en": "Byrdpip",
    "zh": "异鸟宝宝",
    "type": "Normal",
    "hp": "9999"
  },
  {
    "name": "PhrogParasite",
    "en": "Phrog Parasite",
    "zh": "异蛙寄生虫",
    "type": "Elite",
    "hp": "61-64"
  },
  {
    "name": "Aeonglass",
    "en": "Aeonglass",
    "zh": "永世沙漏",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "HauntedShip",
    "en": "Haunted Ship",
    "zh": "幽灵船",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "SpectralKnight",
    "en": "Spectral Knight",
    "zh": "幽灵骑士",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "SludgeSpinner",
    "en": "Sludge Spinner",
    "zh": "淤泥旋螺",
    "type": "Normal",
    "hp": "37-39"
  },
  {
    "name": "Noisebot",
    "en": "Noisebot",
    "zh": "噪音机器人",
    "type": "Normal",
    "hp": "18-23"
  },
  {
    "name": "BattleFriendV1",
    "en": "Battle Friend V1.0",
    "zh": "战斗好伙伴V1.0",
    "type": "Normal",
    "hp": "75"
  },
  {
    "name": "BattleFriendV2",
    "en": "Battle Friend V2.0",
    "zh": "战斗好伙伴V2.0",
    "type": "Normal",
    "hp": "150"
  },
  {
    "name": "BattleFriendV3",
    "en": "Battle Friend V3.0",
    "zh": "战斗好伙伴V3.0",
    "type": "Normal",
    "hp": "300"
  },
  {
    "name": "KnowledgeDemon",
    "en": "Knowledge Demon",
    "zh": "知识恶魔",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "Ovicopter",
    "en": "Ovicopter",
    "zh": "直飞产卵虫",
    "type": "Normal",
    "hp": "124-130"
  },
  {
    "name": "Fabricator",
    "en": "Fabricator",
    "zh": "组装师",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "DecimillipedeSegmentBack",
    "en": "Decimillipede Segment (Back)",
    "zh": "Decimillipede Segment (Back)",
    "type": "Elite",
    "hp": "40-46"
  },
  {
    "name": "DecimillipedeSegmentFront",
    "en": "Decimillipede Segment (Front)",
    "zh": "Decimillipede Segment (Front)",
    "type": "Elite",
    "hp": "40-46"
  },
  {
    "name": "DecimillipedeSegmentMiddle",
    "en": "Decimillipede Segment (Middle)",
    "zh": "Decimillipede Segment (Middle)",
    "type": "Elite",
    "hp": "40-46"
  }
];

/** 类名 → 官方中文名 */
export const MONSTER_ZH: Record<string, string> = {
  "Osty": "奥斯提",
  "SneakyGremlin": "卑鄙地精",
  "Toadpole": "蟾蜍蝌蚪",
  "DampCultist": "潮湿邪教徒",
  "Stabbot": "戳刺机器人",
  "Tunneler": "地道虫",
  "GremlinMerc": "地精佣兵",
  "Zapbot": "电击机器人",
  "GlobeHead": "电球头",
  "TheAdversaryMkOne": "对手1型",
  "TheAdversaryMkTwo": "对手2型",
  "TheAdversaryMkThree": "对手3型",
  "Byrdonis": "多尼斯异鸟",
  "Flyconid": "飞蝇菌子",
  "Entomancer": "蜂群术士",
  "CalcifiedCultist": "钙化邪教徒",
  "InfestedPrism": "感染棱柱",
  "TurretOperator": "高塔炮手",
  "SkulkingColony": "鬼祟珊瑚群",
  "Seapunk": "海洋混混",
  "TerrorEel": "骇鳗",
  "PhantasmalGardener": "花园幽灵鳗",
  "FossilStalker": "化石追踪者",
  "LivingShield": "活体盾",
  "LivingFog": "活雾",
  "Rocket": "火箭",
  "TorchHeadAmalgam": "火炬头聚合体",
  "MechaKnight": "机甲骑士",
  "SpinyToad": "棘刺蟾蜍",
  "Parafright": "寄生惧魔",
  "Architect": "建筑师",
  "BruteRubyRaider": "劫掠者暴徒",
  "AssassinRubyRaider": "劫掠者刺客",
  "AxeRubyRaider": "劫掠者斧手",
  "CrossbowRubyRaider": "劫掠者弩手",
  "TrackerRubyRaider": "劫掠者追踪手",
  "ToughEgg": "结实的卵",
  "BygoneEffigy": "旧日雕像",
  "Axebot": "巨斧机器人",
  "Chomper": "啃咬机",
  "LagavulinMatriarch": "乐加维林族母",
  "CubexConstruct": "立柱构造体",
  "EyeWithTeeth": "利齿之眼",
  "FlailKnight": "连枷骑士",
  "HunterKiller": "猎人杀手",
  "SoulNexus": "灵魂枢纽",
  "SoulFysh": "灵魂异鱼",
  "TheObscura": "胧光怪",
  "Mawler": "蛮兽",
  "OwlMagistrate": "猫头鹰法官",
  "FuzzyWurmCrawler": "毛绒伏地虫",
  "MagiKnight": "魔法骑士",
  "Inklet": "墨宝",
  "Vantom": "墨影幻灵",
  "Crusher": "碾碎爪",
  "Wriggler": "扭动虫",
  "Queen": "女王",
  "FatGremlin": "胖地精",
  "PaelsLegion": "佩尔的士兵",
  "WaterfallGiant": "瀑布巨兽",
  "GasBomb": "气态炸弹",
  "DevotedSculptor": "虔诚雕刻师",
  "FrogKnight": "青蛙骑士",
  "PunchConstruct": "拳击构装体",
  "SnappingJaxfruit": "闪光贾克斯果",
  "FakeMerchantMonster": "商人？？？",
  "SlitheringStrangler": "蛇行扼杀者",
  "MysteriousKnight": "神秘骑士",
  "BowlbugEgg": "盛碗虫（卵）",
  "BowlbugNectar": "盛碗虫（蜜）",
  "BowlbugRock": "盛碗虫（石）",
  "BowlbugSilk": "盛碗虫（丝）",
  "TheLost": "失落之物",
  "LouseProgenitor": "虱虫之祖",
  "TestSubject": "实验体 #C14",
  "SlimedBerserker": "史莱姆狂战士",
  "CorpseSlug": "噬尸蛞蝓",
  "Guardbot": "守护机器人",
  "SlumberingBeetle": "熟睡甲虫",
  "LeafSlimeS": "树叶史莱姆（小）",
  "LeafSlimeM": "树叶史莱姆（中）",
  "TwigSlimeS": "树枝史莱姆（小）",
  "TwigSlimeM": "树枝史莱姆（中）",
  "TwoTailedRat": "双尾鼠",
  "ShrinkerBeetle": "缩小甲虫",
  "VineShambler": "藤蔓蹒跚者",
  "KinPriest": "同族神官",
  "KinFollower": "同族信徒",
  "ThievingHopper": "偷窃草蜢",
  "Exoskeleton": "外骨骼虫",
  "TheInsatiable": "无厌沙虫",
  "Fogmog": "雾菇",
  "SewerClam": "下水道蚌",
  "Nibbit": "小啃兽",
  "ScrollOfBiting": "咬人卷轴",
  "CeremonialBeast": "仪式兽",
  "TheForgotten": "遗忘之物",
  "Myte": "异螨",
  "Byrdpip": "异鸟宝宝",
  "PhrogParasite": "异蛙寄生虫",
  "Aeonglass": "永世沙漏",
  "HauntedShip": "幽灵船",
  "SpectralKnight": "幽灵骑士",
  "SludgeSpinner": "淤泥旋螺",
  "Noisebot": "噪音机器人",
  "BattleFriendV1": "战斗好伙伴V1.0",
  "BattleFriendV2": "战斗好伙伴V2.0",
  "BattleFriendV3": "战斗好伙伴V3.0",
  "KnowledgeDemon": "知识恶魔",
  "Ovicopter": "直飞产卵虫",
  "Fabricator": "组装师",
  "DecimillipedeSegmentBack": "Decimillipede Segment (Back)",
  "DecimillipedeSegmentFront": "Decimillipede Segment (Front)",
  "DecimillipedeSegmentMiddle": "Decimillipede Segment (Middle)"
};
