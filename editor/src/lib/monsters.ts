/** 游戏怪物目录（114 项）——由 tools/extract-monster-catalog.mjs 生成，勿手改。
 *  数据源：反编译 v0.111.0 全部具体 MonsterModel 子类 + spire-codex zhs 官方译名。
 *  name = 类名（Runtime SfMonsterResolver 同时匹配类名与 Id.Entry）；zh 官方中文名。 */
export interface MonsterEntry {
  /** 类名（如 DampCultist），召唤效果的 params.monster 值 */
  name: string;
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
    "zh": "奥斯提",
    "type": "Normal",
    "hp": "1"
  },
  {
    "name": "SneakyGremlin",
    "zh": "卑鄙地精",
    "type": "Normal",
    "hp": "10-14"
  },
  {
    "name": "Toadpole",
    "zh": "蟾蜍蝌蚪",
    "type": "Normal",
    "hp": "21-25"
  },
  {
    "name": "DampCultist",
    "zh": "潮湿邪教徒",
    "type": "Normal",
    "hp": "51-53"
  },
  {
    "name": "Stabbot",
    "zh": "戳刺机器人",
    "type": "Normal",
    "hp": "18-23"
  },
  {
    "name": "Tunneler",
    "zh": "地道虫",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "GremlinMerc",
    "zh": "地精佣兵",
    "type": "Normal",
    "hp": "47-49"
  },
  {
    "name": "Zapbot",
    "zh": "电击机器人",
    "type": "Normal",
    "hp": "18-23"
  },
  {
    "name": "GlobeHead",
    "zh": "电球头",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "TheAdversaryMkOne",
    "zh": "对手1型",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "TheAdversaryMkTwo",
    "zh": "对手2型",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "TheAdversaryMkThree",
    "zh": "对手3型",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "Byrdonis",
    "zh": "多尼斯异鸟",
    "type": "Elite",
    "hp": "81-84"
  },
  {
    "name": "Flyconid",
    "zh": "飞蝇菌子",
    "type": "Normal",
    "hp": "47-49"
  },
  {
    "name": "Entomancer",
    "zh": "蜂群术士",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "CalcifiedCultist",
    "zh": "钙化邪教徒",
    "type": "Normal",
    "hp": "38-41"
  },
  {
    "name": "InfestedPrism",
    "zh": "感染棱柱",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "TurretOperator",
    "zh": "高塔炮手",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "SkulkingColony",
    "zh": "鬼祟珊瑚群",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "Seapunk",
    "zh": "海洋混混",
    "type": "Normal",
    "hp": "44-46"
  },
  {
    "name": "TerrorEel",
    "zh": "骇鳗",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "PhantasmalGardener",
    "zh": "花园幽灵鳗",
    "type": "Elite",
    "hp": "26-31"
  },
  {
    "name": "FossilStalker",
    "zh": "化石追踪者",
    "type": "Normal",
    "hp": "51-53"
  },
  {
    "name": "LivingShield",
    "zh": "活体盾",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "LivingFog",
    "zh": "活雾",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "Rocket",
    "zh": "火箭",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "TorchHeadAmalgam",
    "zh": "火炬头聚合体",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "MechaKnight",
    "zh": "机甲骑士",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "SpinyToad",
    "zh": "棘刺蟾蜍",
    "type": "Normal",
    "hp": "116-119"
  },
  {
    "name": "Parafright",
    "zh": "寄生惧魔",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "Architect",
    "zh": "建筑师",
    "type": "Normal",
    "hp": "9999"
  },
  {
    "name": "BruteRubyRaider",
    "zh": "劫掠者暴徒",
    "type": "Normal",
    "hp": "30-33"
  },
  {
    "name": "AssassinRubyRaider",
    "zh": "劫掠者刺客",
    "type": "Normal",
    "hp": "18-23"
  },
  {
    "name": "AxeRubyRaider",
    "zh": "劫掠者斧手",
    "type": "Normal",
    "hp": "20-22"
  },
  {
    "name": "CrossbowRubyRaider",
    "zh": "劫掠者弩手",
    "type": "Normal",
    "hp": "18-21"
  },
  {
    "name": "TrackerRubyRaider",
    "zh": "劫掠者追踪手",
    "type": "Normal",
    "hp": "21-25"
  },
  {
    "name": "ToughEgg",
    "zh": "结实的卵",
    "type": "Normal",
    "hp": "14-18"
  },
  {
    "name": "BygoneEffigy",
    "zh": "旧日雕像",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "Axebot",
    "zh": "巨斧机器人",
    "type": "Normal",
    "hp": "70-78"
  },
  {
    "name": "Chomper",
    "zh": "啃咬机",
    "type": "Normal",
    "hp": "60-64"
  },
  {
    "name": "LagavulinMatriarch",
    "zh": "乐加维林族母",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "CubexConstruct",
    "zh": "立柱构造体",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "EyeWithTeeth",
    "zh": "利齿之眼",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "FlailKnight",
    "zh": "连枷骑士",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "HunterKiller",
    "zh": "猎人杀手",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "SoulNexus",
    "zh": "灵魂枢纽",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "SoulFysh",
    "zh": "灵魂异鱼",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "TheObscura",
    "zh": "胧光怪",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "Mawler",
    "zh": "蛮兽",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "OwlMagistrate",
    "zh": "猫头鹰法官",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "FuzzyWurmCrawler",
    "zh": "毛绒伏地虫",
    "type": "Normal",
    "hp": "55-57"
  },
  {
    "name": "MagiKnight",
    "zh": "魔法骑士",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "Inklet",
    "zh": "墨宝",
    "type": "Normal",
    "hp": "11-17"
  },
  {
    "name": "Vantom",
    "zh": "墨影幻灵",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "Crusher",
    "zh": "碾碎爪",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "Wriggler",
    "zh": "扭动虫",
    "type": "Elite",
    "hp": "17-21"
  },
  {
    "name": "Queen",
    "zh": "女王",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "FatGremlin",
    "zh": "胖地精",
    "type": "Normal",
    "hp": "13-17"
  },
  {
    "name": "PaelsLegion",
    "zh": "佩尔的士兵",
    "type": "Normal",
    "hp": "9999"
  },
  {
    "name": "WaterfallGiant",
    "zh": "瀑布巨兽",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "GasBomb",
    "zh": "气态炸弹",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "DevotedSculptor",
    "zh": "虔诚雕刻师",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "FrogKnight",
    "zh": "青蛙骑士",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "PunchConstruct",
    "zh": "拳击构装体",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "SnappingJaxfruit",
    "zh": "闪光贾克斯果",
    "type": "Normal",
    "hp": "31-33"
  },
  {
    "name": "FakeMerchantMonster",
    "zh": "商人？？？",
    "type": "Normal",
    "hp": "165"
  },
  {
    "name": "SlitheringStrangler",
    "zh": "蛇行扼杀者",
    "type": "Normal",
    "hp": "53-55"
  },
  {
    "name": "MysteriousKnight",
    "zh": "神秘骑士",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "BowlbugEgg",
    "zh": "盛碗虫（卵）",
    "type": "Normal",
    "hp": "21-22"
  },
  {
    "name": "BowlbugNectar",
    "zh": "盛碗虫（蜜）",
    "type": "Normal",
    "hp": "35-38"
  },
  {
    "name": "BowlbugRock",
    "zh": "盛碗虫（石）",
    "type": "Normal",
    "hp": "45-48"
  },
  {
    "name": "BowlbugSilk",
    "zh": "盛碗虫（丝）",
    "type": "Normal",
    "hp": "40-43"
  },
  {
    "name": "TheLost",
    "zh": "失落之物",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "LouseProgenitor",
    "zh": "虱虫之祖",
    "type": "Normal",
    "hp": "134-136"
  },
  {
    "name": "TestSubject",
    "zh": "实验体 #C14",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "SlimedBerserker",
    "zh": "史莱姆狂战士",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "CorpseSlug",
    "zh": "噬尸蛞蝓",
    "type": "Normal",
    "hp": "25-27"
  },
  {
    "name": "Guardbot",
    "zh": "守护机器人",
    "type": "Normal",
    "hp": "16-20"
  },
  {
    "name": "SlumberingBeetle",
    "zh": "熟睡甲虫",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "LeafSlimeS",
    "zh": "树叶史莱姆（小）",
    "type": "Normal",
    "hp": "11-15"
  },
  {
    "name": "LeafSlimeM",
    "zh": "树叶史莱姆（中）",
    "type": "Normal",
    "hp": "32-35"
  },
  {
    "name": "TwigSlimeS",
    "zh": "树枝史莱姆（小）",
    "type": "Normal",
    "hp": "7-11"
  },
  {
    "name": "TwigSlimeM",
    "zh": "树枝史莱姆（中）",
    "type": "Normal",
    "hp": "26-28"
  },
  {
    "name": "TwoTailedRat",
    "zh": "双尾鼠",
    "type": "Normal",
    "hp": "17-21"
  },
  {
    "name": "ShrinkerBeetle",
    "zh": "缩小甲虫",
    "type": "Normal",
    "hp": "38-40"
  },
  {
    "name": "VineShambler",
    "zh": "藤蔓蹒跚者",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "KinPriest",
    "zh": "同族神官",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "KinFollower",
    "zh": "同族信徒",
    "type": "Boss",
    "hp": "58-59"
  },
  {
    "name": "ThievingHopper",
    "zh": "偷窃草蜢",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "Exoskeleton",
    "zh": "外骨骼虫",
    "type": "Normal",
    "hp": "24-28"
  },
  {
    "name": "TheInsatiable",
    "zh": "无厌沙虫",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "Fogmog",
    "zh": "雾菇",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "SewerClam",
    "zh": "下水道蚌",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "Nibbit",
    "zh": "小啃兽",
    "type": "Normal",
    "hp": "42-46"
  },
  {
    "name": "ScrollOfBiting",
    "zh": "咬人卷轴",
    "type": "Normal",
    "hp": "30-37"
  },
  {
    "name": "CeremonialBeast",
    "zh": "仪式兽",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "TheForgotten",
    "zh": "遗忘之物",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "Myte",
    "zh": "异螨",
    "type": "Normal",
    "hp": "61-67"
  },
  {
    "name": "Byrdpip",
    "zh": "异鸟宝宝",
    "type": "Normal",
    "hp": "9999"
  },
  {
    "name": "PhrogParasite",
    "zh": "异蛙寄生虫",
    "type": "Elite",
    "hp": "61-64"
  },
  {
    "name": "Aeonglass",
    "zh": "永世沙漏",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "HauntedShip",
    "zh": "幽灵船",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "SpectralKnight",
    "zh": "幽灵骑士",
    "type": "Elite",
    "hp": ""
  },
  {
    "name": "SludgeSpinner",
    "zh": "淤泥旋螺",
    "type": "Normal",
    "hp": "37-39"
  },
  {
    "name": "Noisebot",
    "zh": "噪音机器人",
    "type": "Normal",
    "hp": "18-23"
  },
  {
    "name": "BattleFriendV1",
    "zh": "战斗好伙伴V1.0",
    "type": "Normal",
    "hp": "75"
  },
  {
    "name": "BattleFriendV2",
    "zh": "战斗好伙伴V2.0",
    "type": "Normal",
    "hp": "150"
  },
  {
    "name": "BattleFriendV3",
    "zh": "战斗好伙伴V3.0",
    "type": "Normal",
    "hp": "300"
  },
  {
    "name": "KnowledgeDemon",
    "zh": "知识恶魔",
    "type": "Boss",
    "hp": ""
  },
  {
    "name": "Ovicopter",
    "zh": "直飞产卵虫",
    "type": "Normal",
    "hp": "124-130"
  },
  {
    "name": "Fabricator",
    "zh": "组装师",
    "type": "Normal",
    "hp": ""
  },
  {
    "name": "DecimillipedeSegmentBack",
    "zh": "Decimillipede Segment (Back)",
    "type": "Elite",
    "hp": "40-46"
  },
  {
    "name": "DecimillipedeSegmentFront",
    "zh": "Decimillipede Segment (Front)",
    "type": "Elite",
    "hp": "40-46"
  },
  {
    "name": "DecimillipedeSegmentMiddle",
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
