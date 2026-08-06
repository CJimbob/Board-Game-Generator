export type DistrictColor = "yellow" | "blue" | "green" | "red" | "purple";

export type RoleDefinition = {
  key: string;
  rank: number;
  name: string;
  short: string;
  color: DistrictColor | "neutral";
  description: string;
};

export type DistrictDefinition = {
  key: string;
  name: string;
  color: DistrictColor;
  cost: number;
  count?: number;
  text?: string;
};

export type RulesetDefinition = {
  key: string;
  name: string;
  tagline: string;
  roleKeys: string[];
  uniqueKeys: string[];
};

export const ROLES: RoleDefinition[] = [
  { key: "assassin", rank: 1, name: "刺客", short: "让一个身份从今夜消失", color: "neutral", description: "点名另一角色；该角色本轮不公开身份并跳过整个回合。" },
  { key: "witch", rank: 1, name: "女巫", short: "借走别人的身份与能力", color: "neutral", description: "取得资源后魅惑一名角色；对方只取得资源，你随后以该角色身份完成自己的回合。" },
  { key: "magistrate", rank: 1, name: "执法官", short: "一纸密令征收新城区", color: "neutral", description: "把一张真拘票与两张假票分别放到三个不同角色旁。真目标首次付费建造后，你可揭票：退还其费用，并把该城区免费建入自己的城市；你已有同名城区时不能没收。无论是否没收，该城区都计入目标的建造上限。" },
  { key: "thief", rank: 2, name: "盗贼", short: "在钟声响起前下手", color: "neutral", description: "点名另一角色；对方出场时，你夺取其全部金币。" },
  { key: "spy", rank: 2, name: "间谍", short: "从手牌颜色读出财富", color: "neutral", description: "查看一名玩家手牌并声明类型；每张匹配牌令你抽一张牌，并尽量从对方拿一金币。" },
  { key: "blackmailer", rank: 2, name: "勒索者", short: "真假威胁都足以令人犹豫", color: "neutral", description: "秘密威胁两名角色；被威胁者取得资源后可交出一半金币消除威胁，否则可能失去全部金币。" },
  { key: "magician", rank: 3, name: "魔术师", short: "把坏手牌变成新机会", color: "neutral", description: "与一名玩家交换整手牌，或弃掉任意数量手牌并等量补牌。" },
  { key: "wizard", rank: 3, name: "巫师", short: "从别人的蓝图中施法", color: "neutral", description: "查看一名玩家手牌并取一张，或立即付费建造该牌；本回合允许建造同名城区。" },
  { key: "seer", rank: 3, name: "先知", short: "预见每个人手中的城市", color: "neutral", description: "随机从每名对手手中拿一张，再各还一张；本回合最多建造两座。" },
  { key: "king", rank: 4, name: "国王", short: "王冠决定下一轮起点", color: "yellow", description: "必须取得皇冠；可按贵族城区数量获得金币。" },
  { key: "emperor", rank: 4, name: "皇帝", short: "把王冠赐给最合适的人", color: "yellow", description: "把皇冠交给另一名玩家，并从其处拿一金币或随机一张牌；可按贵族城区获得金币。" },
  { key: "patrician", rank: 4, name: "贵族", short: "让世家接管下一轮", color: "yellow", description: "必须取得皇冠；可按贵族城区数量获得城区牌。" },
  { key: "bishop", rank: 5, name: "主教", short: "圣堂庇护整座城市", color: "blue", description: "你的城区免受 8 号角色能力影响；可按宗教城区数量获得金币。" },
  { key: "abbot", rank: 5, name: "修道院长", short: "信仰可以化作两种资源", color: "blue", description: "每座宗教城区可获得一金币或一张牌；若你不是最富者，最富者还须给你一金币。" },
  { key: "cardinal", rank: 5, name: "枢机主教", short: "用蓝图换取建城资金", color: "blue", description: "按宗教城区抽牌；建造缺钱时，可用手牌向一名玩家按一比一强制换金币。" },
  { key: "merchant", rank: 6, name: "商人", short: "每条街道都流通金币", color: "green", description: "可按商业城区数量获得金币，并额外获得一金币。" },
  { key: "alchemist", rank: 6, name: "炼金术士", short: "建造费用在回合末回流", color: "neutral", description: "回合结束时，收回本回合支付给银行的全部建造金币。" },
  { key: "trader", rank: 6, name: "贸易商", short: "商业城区不占建造名额", color: "green", description: "可按商业城区获得金币；商业城区不计入本回合建造上限。" },
  { key: "architect", rank: 7, name: "建筑师", short: "一夜改变整片天际线", color: "neutral", description: "可额外抽两张城区牌；本回合最多建造三座城区。" },
  { key: "navigator", rank: 7, name: "航海家", short: "满载资源，却无暇动工", color: "neutral", description: "可额外获得四金币或四张牌；本回合不能建造任何城区。" },
  { key: "scholar", rank: 7, name: "学者", short: "从七张蓝图中选出答案", color: "neutral", description: "查看牌库七张并保留一张，其余洗回；本回合最多建造两座。" },
  { key: "warlord", rank: 8, name: "军阀", short: "城墙也有价格", color: "red", description: "可按军事城区获得金币；支付目标费用减一，摧毁一座未完工城市中的城区。" },
  { key: "diplomat", rank: 8, name: "外交官", short: "用条约重画城市边界", color: "red", description: "可按军事城区获得金币；用自己一座城区交换对手一座，并补足费用差。" },
  { key: "marshal", rank: 8, name: "统帅", short: "以原价接管低价城区", color: "red", description: "可按军事城区获得金币；向对手支付费用，接管其一座费用不高于三的城区。" },
  { key: "queen", rank: 9, name: "王后", short: "坐在王权身边获得馈赠", color: "neutral", description: "若座位与本轮 4 号角色相邻，可获得三金币；仅限五人以上。" },
  { key: "artist", rank: 9, name: "艺术家", short: "为城区增加永久价值", color: "neutral", description: "支付金币美化至多两座城区；每座美化城区的费用与终局分数永久加一。" },
  { key: "tax_collector", rank: 9, name: "税务官", short: "每次动工都留下税款", color: "neutral", description: "只要本局使用税务官，其他角色每次建造后若仍有金币便缴一金币；税务官可收走累计税款。" },
];

export const BASIC_DISTRICTS: DistrictDefinition[] = [
  { key: "manor", name: "庄园", color: "yellow", cost: 3, count: 5 },
  { key: "castle", name: "城堡", color: "yellow", cost: 4, count: 4 },
  { key: "palace", name: "宫殿", color: "yellow", cost: 5, count: 3 },
  { key: "temple", name: "神殿", color: "blue", cost: 1, count: 3 },
  { key: "church", name: "教堂", color: "blue", cost: 2, count: 3 },
  { key: "monastery", name: "修道院", color: "blue", cost: 3, count: 3 },
  { key: "cathedral", name: "大教堂", color: "blue", cost: 5, count: 2 },
  { key: "tavern", name: "酒馆", color: "green", cost: 1, count: 5 },
  { key: "market", name: "市场", color: "green", cost: 2, count: 4 },
  { key: "trading_post", name: "商站", color: "green", cost: 2, count: 3 },
  { key: "docks", name: "码头", color: "green", cost: 3, count: 3 },
  { key: "harbor", name: "港口", color: "green", cost: 4, count: 3 },
  { key: "town_hall", name: "市政厅", color: "green", cost: 5, count: 2 },
  { key: "watchtower", name: "瞭望塔", color: "red", cost: 1, count: 3 },
  { key: "prison", name: "监狱", color: "red", cost: 2, count: 3 },
  { key: "barracks", name: "兵营", color: "red", cost: 3, count: 3 },
  { key: "fortress", name: "要塞", color: "red", cost: 5, count: 2 },
];

export const UNIQUE_DISTRICTS: DistrictDefinition[] = [
  { key: "armory", name: "军械库", color: "purple", cost: 3, text: "你的回合中可摧毁军械库，以免费摧毁一座未完成城市中的城区。" },
  { key: "basilica", name: "圣殿", color: "purple", cost: 4, text: "终局时，你城市中每座奇数费用城区额外一分。" },
  { key: "capitol", name: "议政厅", color: "purple", cost: 5, text: "终局若至少三座城区同类型，额外三分（只计一次）。" },
  { key: "dragon_gate", name: "龙门", color: "purple", cost: 6, text: "终局额外两分。" },
  { key: "factory", name: "工坊", color: "purple", cost: 5, text: "建造其他独特城区时少付一金币。" },
  { key: "framework", name: "脚手架", color: "purple", cost: 3, text: "可摧毁脚手架，代替支付下一座城区的建造费用。" },
  { key: "gold_mine", name: "金矿", color: "purple", cost: 6, text: "选择金币资源时额外获得一金币。" },
  { key: "great_wall", name: "长城", color: "purple", cost: 6, text: "8 号角色影响你其他城区时需多付一金币。" },
  { key: "haunted_quarter", name: "幽灵区", color: "purple", cost: 2, text: "终局可把它视为任意一种城区类型。" },
  { key: "imperial_treasury", name: "皇家宝库", color: "purple", cost: 5, text: "终局时，你剩余的每枚金币额外一分。" },
  { key: "ivory_tower", name: "象牙塔", color: "purple", cost: 5, text: "若它是你终局唯一的独特城区，额外五分。" },
  { key: "keep", name: "城堡主楼", color: "purple", cost: 3, text: "8 号角色不能对它使用角色能力。" },
  { key: "laboratory", name: "实验室", color: "purple", cost: 5, text: "每回合一次：弃一张手牌，获得两金币。" },
  { key: "library", name: "图书馆", color: "purple", cost: 6, text: "选择抽牌资源时，保留抽到的全部牌。" },
  { key: "map_room", name: "地图室", color: "purple", cost: 5, text: "终局时，每张手牌额外一分。" },
  { key: "monument", name: "纪念碑", color: "purple", cost: 4, text: "城市已有五座城区时不能建造；计算完工时视为两座。" },
  { key: "museum", name: "博物馆", color: "purple", cost: 4, text: "每回合可把一张手牌藏于馆下；终局每张藏牌一分。" },
  { key: "necropolis", name: "亡者之城", color: "purple", cost: 5, text: "可摧毁自己一座城区，代替支付其建造费用。" },
  { key: "observatory", name: "天文台", color: "purple", cost: 4, text: "选择抽牌资源时改为抽三张。" },
  { key: "park", name: "公园", color: "purple", cost: 6, text: "回合结束时若没有手牌，抽两张牌。" },
  { key: "poor_house", name: "救济院", color: "purple", cost: 4, text: "回合结束时若没有金币，获得一金币。" },
  { key: "quarry", name: "采石场", color: "purple", cost: 5, text: "你可以建造同名城区。" },
  { key: "school_of_magic", name: "魔法学院", color: "purple", cost: 6, text: "角色按城区类型取得资源时，它可视为所需类型。" },
  { key: "secret_vault", name: "秘密金库", color: "purple", cost: 0, text: "不能建造；终局若仍在手中，额外三分。" },
  { key: "smithy", name: "铁匠铺", color: "purple", cost: 5, text: "每回合一次：支付两金币，抽三张牌。" },
  { key: "stables", name: "马厩", color: "purple", cost: 2, text: "建造它不计入本回合建造上限。" },
  { key: "statue", name: "王像", color: "purple", cost: 3, text: "终局时若持有皇冠，额外五分。" },
  { key: "theater", name: "剧院", color: "purple", cost: 6, text: "选角结束后，可盲选一名对手并与其交换角色。" },
  { key: "thieves_den", name: "盗贼巢穴", color: "purple", cost: 6, text: "建造时可按一张手牌抵一金币支付部分或全部费用。" },
  { key: "wishing_well", name: "许愿井", color: "purple", cost: 5, text: "终局时，每座独特城区（含许愿井）额外一分。" },
];

const sets: RulesetDefinition[] = [
  {
    key: "first_game", name: "经典入门", tagline: "原版八角色，适合第一次游玩",
    roleKeys: ["assassin", "thief", "magician", "king", "bishop", "merchant", "architect", "warlord", "queen"],
    uniqueKeys: ["dragon_gate", "factory", "haunted_quarter", "imperial_treasury", "keep", "laboratory", "library", "map_room", "quarry", "school_of_magic", "smithy", "statue", "thieves_den", "wishing_well"],
  },
  {
    key: "ambitious", name: "雄心贵族", tagline: "强调连续建造与取得城区",
    roleKeys: ["magistrate", "thief", "wizard", "patrician", "bishop", "trader", "architect", "marshal", "queen"],
    uniqueKeys: ["capitol", "factory", "framework", "great_wall", "haunted_quarter", "keep", "necropolis", "park", "poor_house", "quarry", "school_of_magic", "stables", "statue", "thieves_den"],
  },
  {
    key: "cunning", name: "狡黠密探", tagline: "欺诈、勒索与高强度互动",
    roleKeys: ["witch", "blackmailer", "magician", "emperor", "abbot", "alchemist", "architect", "warlord", "tax_collector"],
    uniqueKeys: ["armory", "basilica", "dragon_gate", "gold_mine", "keep", "monument", "museum", "necropolis", "park", "poor_house", "quarry", "secret_vault", "smithy", "theater"],
  },
  {
    key: "emissaries", name: "显赫使节", tagline: "防守稳健，资源来源丰富",
    roleKeys: ["witch", "spy", "seer", "emperor", "bishop", "merchant", "scholar", "diplomat", "artist"],
    uniqueKeys: ["factory", "framework", "great_wall", "haunted_quarter", "ivory_tower", "keep", "library", "museum", "observatory", "park", "poor_house", "quarry", "school_of_magic", "smithy"],
  },
  {
    key: "devious", name: "诡计权贵", tagline: "虚实交错，重在读心与换位",
    roleKeys: ["magistrate", "blackmailer", "wizard", "king", "abbot", "alchemist", "navigator", "marshal", "queen"],
    uniqueKeys: ["dragon_gate", "factory", "framework", "haunted_quarter", "laboratory", "necropolis", "park", "poor_house", "secret_vault", "smithy", "stables", "theater", "thieves_den", "wishing_well"],
  },
  {
    key: "tenacious", name: "坚韧代表", tagline: "组合能力与城区协同最丰富",
    roleKeys: ["assassin", "spy", "seer", "king", "cardinal", "trader", "scholar", "diplomat", "artist"],
    uniqueKeys: ["basilica", "capitol", "haunted_quarter", "imperial_treasury", "laboratory", "library", "map_room", "observatory", "school_of_magic", "secret_vault", "smithy", "stables", "statue", "wishing_well"],
  },
  {
    key: "vicious", name: "无情贵胄", tagline: "进攻最直接，冲突最激烈",
    roleKeys: ["assassin", "thief", "magician", "patrician", "cardinal", "merchant", "navigator", "warlord", "tax_collector"],
    uniqueKeys: ["armory", "basilica", "dragon_gate", "gold_mine", "imperial_treasury", "ivory_tower", "laboratory", "map_room", "monument", "museum", "school_of_magic", "statue", "thieves_den", "wishing_well"],
  },
];

export const RULESETS = sets;

export function getRole(key: string | null | undefined) {
  return ROLES.find((role) => role.key === key) ?? null;
}

export function getRuleset(key: string | null | undefined) {
  return RULESETS.find((ruleset) => ruleset.key === key) ?? RULESETS[0];
}

export function castForRuleset(rulesetKey: string, playerCount: number, includeOptionalRankNine = false) {
  const ruleset = getRuleset(rulesetKey);
  const keys = ruleset.roleKeys.slice(0, 8);
  if (playerCount === 3 || playerCount === 8 || (includeOptionalRankNine && playerCount >= 4 && playerCount <= 7)) {
    let ninth = ruleset.roleKeys[8] ?? "artist";
    if (ninth === "queen" && playerCount < 5) ninth = "artist";
    keys.push(ninth);
  }
  if (playerCount === 2) {
    const emperorIndex = keys.indexOf("emperor");
    if (emperorIndex >= 0) keys[emperorIndex] = "king";
  }
  return keys.map((key) => getRole(key)!).filter(Boolean);
}

export const COLOR_NAMES: Record<DistrictColor, string> = {
  yellow: "贵族",
  blue: "宗教",
  green: "商业",
  red: "军事",
  purple: "独特",
};
