export type RealmLanguage = "zh" | "en";
export type RealmUnitType = "footman" | "knight" | "ship" | "siege";
export type RealmAreaKind = "land" | "sea" | "port";
export type RealmOrderType =
  | "raid" | "raid_star"
  | "march_minus" | "march" | "march_star"
  | "defend" | "defend_star"
  | "support" | "support_star"
  | "power" | "power_star";

export type RealmFactionDefinition = {
  key: string;
  name: string;
  nameEn: string;
  motto: string;
  mottoEn: string;
  color: string;
  home: string;
  port: string;
  startingSupply: number;
  startingInfluence: [number, number, number];
};

export type RealmAreaDefinition = {
  key: string;
  name: string;
  nameEn: string;
  kind: RealmAreaKind;
  x: number;
  y: number;
  w?: number;
  h?: number;
  adjacent: string[];
  castle?: 1 | 2;
  supply?: number;
  power?: number;
  portOf?: string;
  seaOf?: string;
  homeOf?: string;
  garrison?: number;
  neutral?: number;
};

export type RealmLeaderEffect =
  | "none" | "win_power" | "retreat_choice" | "recover_cards" | "no_casualties"
  | "double_defense" | "cancel_card" | "remove_order" | "footman_attack"
  | "upgrade_after_win" | "discard_enemy_card" | "cancel_ship_support"
  | "enemy_card_zero" | "ship_attack" | "home_defense" | "solo_icons"
  | "destroy_footman" | "march_again" | "remove_defense" | "no_attacker_advance"
  | "move_influence_bottom" | "reselect_card";

export type RealmLeaderCard = {
  key: string;
  faction: string;
  name: string;
  nameEn: string;
  strength: number;
  swords: number;
  forts: number;
  effect: RealmLeaderEffect;
  text: string;
  textEn: string;
};

export const REALM_FACTIONS: RealmFactionDefinition[] = [
  { key: "frost", name: "北辰盟约", nameEn: "Frostbound Pact", motto: "群峰记得每一次誓言", mottoEn: "The peaks remember every oath", color: "#6f91b7", home: "northhold", port: "north_port", startingSupply: 1, startingInfluence: [3, 4, 2] },
  { key: "umbral", name: "玄羽议会", nameEn: "Umbral Conclave", motto: "真相藏在最后一封信里", mottoEn: "Truth waits in the final letter", color: "#67547d", home: "shadow_fort", port: "shadow_port", startingSupply: 2, startingInfluence: [5, 1, 3] },
  { key: "sunward", name: "曜金议庭", nameEn: "Sunward Council", motto: "财富只服从耐心", mottoEn: "Fortune bends to patience", color: "#c59a42", home: "goldhaven", port: "gold_port", startingSupply: 2, startingInfluence: [1, 5, 4] },
  { key: "verdant", name: "绿冠王庭", nameEn: "Verdant Court", motto: "花开之后仍有利刃", mottoEn: "A blade remains after the bloom", color: "#5e8a62", home: "highgarden", port: "green_port", startingSupply: 2, startingInfluence: [4, 3, 1] },
  { key: "redmarch", name: "赤岭军府", nameEn: "Redmarch Host", motto: "城墙终会向火焰低头", mottoEn: "Every wall bows to flame", color: "#a84f47", home: "ember_keep", port: "ember_port", startingSupply: 1, startingInfluence: [2, 2, 6] },
  { key: "tide", name: "苍潮联邦", nameEn: "Tideborne League", motto: "潮汐不承认边界", mottoEn: "The tide recognizes no border", color: "#3f8792", home: "tidewatch", port: "tide_port", startingSupply: 1, startingInfluence: [6, 6, 5] },
];

export const REALM_AREAS: RealmAreaDefinition[] = [
  { key: "northhold", name: "北辰堡", nameEn: "Northhold", kind: "land", x: 48, y: 7, castle: 2, supply: 1, homeOf: "frost", garrison: 2, adjacent: ["frozen_pass", "wolfwood", "crown_road", "north_port"] },
  { key: "frozen_pass", name: "霜隘", nameEn: "Frost Pass", kind: "land", x: 28, y: 10, supply: 1, adjacent: ["northhold", "ice_coast", "high_peaks"] },
  { key: "high_peaks", name: "高峰谷", nameEn: "High Peaks", kind: "land", x: 15, y: 18, power: 1, adjacent: ["frozen_pass", "ice_coast", "shadow_fort"] },
  { key: "ice_coast", name: "冰湾岸", nameEn: "Icebay Coast", kind: "land", x: 30, y: 22, castle: 1, adjacent: ["frozen_pass", "high_peaks", "wolfwood", "shadow_fort", "frozen_sea"] },
  { key: "wolfwood", name: "狼林", nameEn: "Wolfwood", kind: "land", x: 49, y: 21, supply: 1, adjacent: ["northhold", "ice_coast", "crown_road", "riverwatch"] },
  { key: "crown_road", name: "王冠大道", nameEn: "Crown Road", kind: "land", x: 64, y: 19, power: 1, adjacent: ["northhold", "wolfwood", "riverwatch", "central_plains", "moon_gate"] },
  { key: "shadow_fort", name: "玄羽堡", nameEn: "Shadow Fort", kind: "land", x: 10, y: 31, castle: 2, supply: 1, homeOf: "umbral", garrison: 2, adjacent: ["high_peaks", "ice_coast", "riverwatch", "west_hills", "shadow_port"] },
  { key: "riverwatch", name: "河望城", nameEn: "Riverwatch", kind: "land", x: 37, y: 34, castle: 1, supply: 1, adjacent: ["ice_coast", "wolfwood", "crown_road", "shadow_fort", "west_hills", "central_plains"] },
  { key: "west_hills", name: "西丘", nameEn: "Western Hills", kind: "land", x: 20, y: 43, supply: 1, adjacent: ["shadow_fort", "riverwatch", "goldhaven", "central_plains"] },
  { key: "moon_gate", name: "月门", nameEn: "Moon Gate", kind: "land", x: 81, y: 31, castle: 1, supply: 1, adjacent: ["crown_road", "central_plains", "throne_city", "east_hills", "tidewatch"] },
  { key: "goldhaven", name: "曜金港", nameEn: "Goldhaven", kind: "land", x: 9, y: 57, castle: 2, supply: 1, homeOf: "sunward", garrison: 2, adjacent: ["west_hills", "central_plains", "sunfield", "gold_port"] },
  { key: "central_plains", name: "群王原", nameEn: "Kingsplain", kind: "land", x: 48, y: 48, castle: 1, power: 1, adjacent: ["crown_road", "riverwatch", "west_hills", "goldhaven", "sunfield", "highgarden", "throne_city", "moon_gate"] },
  { key: "throne_city", name: "苍穹王城", nameEn: "Skyhold", kind: "land", x: 64, y: 49, castle: 2, power: 2, garrison: 5, neutral: 6, adjacent: ["central_plains", "moon_gate", "lower_river", "stormlands", "central_strait"] },
  { key: "sunfield", name: "日照原", nameEn: "Sunfield", kind: "land", x: 25, y: 62, supply: 1, adjacent: ["goldhaven", "central_plains", "highgarden", "red_desert"] },
  { key: "highgarden", name: "绿冠庭", nameEn: "Green Crown", kind: "land", x: 40, y: 73, castle: 2, supply: 1, homeOf: "verdant", garrison: 2, adjacent: ["central_plains", "sunfield", "red_desert", "lower_river", "green_port"] },
  { key: "red_desert", name: "赤沙庭", nameEn: "Red Sands", kind: "land", x: 24, y: 83, supply: 1, power: 1, adjacent: ["sunfield", "highgarden", "lower_river", "southern_sea"] },
  { key: "lower_river", name: "下河口", nameEn: "Lower River", kind: "land", x: 55, y: 70, castle: 1, adjacent: ["highgarden", "red_desert", "throne_city", "stormlands", "ember_keep"] },
  { key: "stormlands", name: "风暴原", nameEn: "Stormlands", kind: "land", x: 71, y: 62, castle: 1, power: 1, adjacent: ["throne_city", "lower_river", "moon_gate", "east_hills", "ember_keep", "tidewatch"] },
  { key: "east_hills", name: "东岭", nameEn: "Eastern Ridges", kind: "land", x: 87, y: 52, supply: 1, adjacent: ["moon_gate", "stormlands", "ember_keep", "tidewatch"] },
  { key: "ember_keep", name: "赤岭堡", nameEn: "Ember Keep", kind: "land", x: 70, y: 80, castle: 2, supply: 1, homeOf: "redmarch", garrison: 2, adjacent: ["lower_river", "stormlands", "east_hills", "red_steppe", "ember_port"] },
  { key: "red_steppe", name: "红石荒原", nameEn: "Red Steppe", kind: "land", x: 88, y: 82, supply: 1, adjacent: ["ember_keep", "east_hills", "salt_marsh", "ember_sea"] },
  { key: "tidewatch", name: "苍潮城", nameEn: "Tidewatch", kind: "land", x: 93, y: 37, castle: 2, supply: 1, homeOf: "tide", garrison: 2, adjacent: ["moon_gate", "east_hills", "stormlands", "salt_marsh", "tide_port"] },
  { key: "salt_marsh", name: "盐泽", nameEn: "Salt Marsh", kind: "land", x: 96, y: 66, supply: 1, power: 1, adjacent: ["tidewatch", "red_steppe", "eastern_sea"] },
  { key: "glass_isle", name: "琉璃岛", nameEn: "Glass Isle", kind: "land", x: 8, y: 79, castle: 1, supply: 1, neutral: 3, adjacent: ["western_sea", "golden_bay", "southern_sea"] },

  { key: "frozen_sea", name: "冻海", nameEn: "Frozen Sea", kind: "sea", x: 48, y: 1, adjacent: ["ice_coast", "north_port", "western_sea", "central_strait", "eastern_sea"] },
  { key: "western_sea", name: "西境海", nameEn: "Western Sea", kind: "sea", x: 1, y: 42, adjacent: ["frozen_sea", "shadow_port", "gold_port", "golden_bay", "glass_isle"] },
  { key: "golden_bay", name: "金色海湾", nameEn: "Golden Bay", kind: "sea", x: 5, y: 65, adjacent: ["western_sea", "gold_port", "glass_isle", "southern_sea"] },
  { key: "southern_sea", name: "南境海", nameEn: "Southern Sea", kind: "sea", x: 36, y: 94, adjacent: ["golden_bay", "glass_isle", "red_desert", "green_port", "ember_sea"] },
  { key: "ember_sea", name: "余烬海", nameEn: "Ember Sea", kind: "sea", x: 70, y: 95, adjacent: ["southern_sea", "green_port", "ember_port", "red_steppe", "eastern_sea", "central_strait"] },
  { key: "eastern_sea", name: "东境海", nameEn: "Eastern Sea", kind: "sea", x: 99, y: 52, adjacent: ["frozen_sea", "tide_port", "salt_marsh", "ember_sea", "central_strait"] },
  { key: "central_strait", name: "王城海峡", nameEn: "Crown Strait", kind: "sea", x: 76, y: 43, adjacent: ["frozen_sea", "eastern_sea", "ember_sea", "throne_city"] },

  { key: "north_port", name: "北辰港", nameEn: "Northhold Port", kind: "port", x: 55, y: 10, portOf: "northhold", seaOf: "frozen_sea", adjacent: ["northhold", "frozen_sea"] },
  { key: "shadow_port", name: "玄羽港", nameEn: "Shadow Port", kind: "port", x: 4, y: 29, portOf: "shadow_fort", seaOf: "western_sea", adjacent: ["shadow_fort", "western_sea"] },
  { key: "gold_port", name: "曜金港湾", nameEn: "Goldhaven Port", kind: "port", x: 3, y: 57, portOf: "goldhaven", seaOf: "golden_bay", adjacent: ["goldhaven", "golden_bay"] },
  { key: "green_port", name: "绿冠港", nameEn: "Green Crown Port", kind: "port", x: 42, y: 87, portOf: "highgarden", seaOf: "southern_sea", adjacent: ["highgarden", "southern_sea"] },
  { key: "ember_port", name: "赤岭港", nameEn: "Ember Port", kind: "port", x: 75, y: 91, portOf: "ember_keep", seaOf: "ember_sea", adjacent: ["ember_keep", "ember_sea"] },
  { key: "tide_port", name: "苍潮港", nameEn: "Tidewatch Port", kind: "port", x: 98, y: 31, portOf: "tidewatch", seaOf: "eastern_sea", adjacent: ["tidewatch", "eastern_sea"] },
];

const card = (
  faction: string,
  key: string,
  name: string,
  nameEn: string,
  strength: number,
  swords = 0,
  forts = 0,
  effect: RealmLeaderEffect = "none",
  text = "无额外效果。",
  textEn = "No additional effect.",
): RealmLeaderCard => ({ faction, key, name, nameEn, strength, swords, forts, effect, text, textEn });

export const REALM_LEADERS: RealmLeaderCard[] = [
  card("frost", "frost_4", "寒峰统帅", "High Warden", 4, 2),
  card("frost", "frost_3", "雪原继承人", "Heir of Snow", 3, 0, 0, "retreat_choice", "若你获胜，可决定败军撤退区域。", "If you win, you may choose the defeated army's retreat area."),
  card("frost", "frost_2a", "灰堡伯爵", "Grey Castellan", 2, 0, 0, "recover_cards", "战斗后收回弃牌堆中的全部领袖牌。", "After combat, return all discarded leader cards to your hand."),
  card("frost", "frost_2b", "荒原巨剑", "Greatsword of the Waste", 2, 1),
  card("frost", "frost_1a", "白塔骑士", "Knight of the White Tower", 1, 0, 2),
  card("frost", "frost_1b", "河湾游侠", "River Ranger", 1, 0, 0, "no_casualties", "你在本场战斗中不承受领袖牌造成的伤亡。", "You suffer no casualties from leader-card sword icons in this combat."),
  card("frost", "frost_0", "北境女侯", "Lady of the North", 0, 0, 0, "double_defense", "防守时，将防御命令的强度翻倍。", "When defending, double the strength of your Defense order."),

  card("umbral", "umbral_4", "黑印宰相", "Chancellor of Seals", 4, 0, 0, "win_power", "若获胜，获得 2 威望。", "If you win, gain 2 power."),
  card("umbral", "umbral_3", "山岳屠手", "Mountain Reaver", 3, 3),
  card("umbral", "umbral_2a", "铁犬卫士", "Iron Hound", 2, 0, 2),
  card("umbral", "umbral_2b", "金甲剑士", "Gilded Sword", 2, 1),
  card("umbral", "umbral_1a", "曲言谋士", "Twisted Counselor", 1, 0, 0, "cancel_card", "取消对手领袖牌并令其改选一张。", "Cancel the opposing leader card; that player chooses another."),
  card("umbral", "umbral_1b", "城门守备", "Gate Castellan", 1, 0, 0, "footman_attack", "你进攻时，参战与支援的步兵各提供 2 战力。", "When attacking, each participating and supporting Footman contributes 2 strength."),
  card("umbral", "umbral_0", "长夜密探", "Agent of the Long Night", 0, 0, 0, "remove_order", "若获胜，移除对手一个仍在版图上的命令。", "If you win, remove one unresolved opposing order."),

  card("sunward", "sunward_4", "曜日摄政", "Sun Regent", 4),
  card("sunward", "sunward_3", "金狮战侯", "Golden War-Lord", 3, 1),
  card("sunward", "sunward_2a", "海门提督", "Admiral of the Gate", 2, 0, 0, "cancel_ship_support", "取消对手所有舰船支援战力。", "Cancel all opposing Ship support strength."),
  card("sunward", "sunward_2b", "誓剑女爵", "Oathblade Lady", 2, 1, 1),
  card("sunward", "sunward_1a", "炉火先知", "Oracle of Embers", 1, 1),
  card("sunward", "sunward_1b", "港湾走私王", "Smuggler King", 1, 0, 0, "win_power", "若获胜，获得 1 威望。", "If you win, gain 1 power."),
  card("sunward", "sunward_0", "无面弄臣", "Faceless Fool", 0, 0, 0, "discard_enemy_card", "战斗后随机弃掉对手手中的一张领袖牌。", "After combat, discard one random leader card from the opponent's hand."),

  card("verdant", "verdant_4", "荆棘元帅", "Thorn Marshal", 4, 0, 0, "destroy_footman", "战斗开始时，摧毁敌军一名步兵。", "At combat start, destroy one opposing Footman."),
  card("verdant", "verdant_3", "百花骑士", "Knight of a Hundred Blooms", 3, 0, 0, "march_again", "作为进攻方获胜后，该行军命令可保留并再次结算。", "If you win as attacker, the March order may remain and be resolved again."),
  card("verdant", "verdant_2a", "青藤剑圣", "Vine Swordmaster", 2, 2),
  card("verdant", "verdant_2b", "古橡将军", "Old Oak General", 2, 1),
  card("verdant", "verdant_1a", "谷地守望", "Vale Sentinel", 1, 0, 2),
  card("verdant", "verdant_1b", "花冠继承人", "Heir of Flowers", 1, 0, 1),
  card("verdant", "verdant_0", "蔷薇太后", "Rose Dowager", 0, 0, 0, "remove_defense", "移除战斗区域中的防御命令。", "Remove the Defense order from the embattled area."),

  card("redmarch", "redmarch_4", "赤沙亲王", "Prince of Red Sands", 4, 2, 1),
  card("redmarch", "redmarch_3", "高塔卫长", "High Tower Captain", 3, 0, 1),
  card("redmarch", "redmarch_2a", "暮星剑客", "Duskstar", 2, 1),
  card("redmarch", "redmarch_2b", "烈矛女将", "Spear-Maiden", 2, 1),
  card("redmarch", "redmarch_1a", "沙海统领", "Commander of Sands", 1, 1, 1),
  card("redmarch", "redmarch_1b", "赤岭公主", "Princess of the March", 1, 0, 0, "no_attacker_advance", "你作为防守方败北时，进攻军不能进入该区域。", "If you lose as defender, the attacking army cannot advance into the area."),
  card("redmarch", "redmarch_0", "长枪谋主", "Spear Strategist", 0, 0, 0, "move_influence_bottom", "战斗后将对手在一个影响力轨道移到末位。", "After combat, move the opponent to the bottom of one influence track."),

  card("tide", "tide_4", "风暴海王", "Storm King", 4, 1),
  card("tide", "tide_3", "破浪船主", "Wavebreaker", 3, 0, 0, "ship_attack", "进攻时，参战与支援的舰船各额外提供 1 战力。", "When attacking, participating and supporting Ships gain +1 strength each."),
  card("tide", "tide_2a", "盐冠领主", "Lord of the Salt Crown", 2, 0, 0, "enemy_card_zero", "对手领袖牌的印刷战力视为 0。", "The printed strength of the opposing leader card is treated as 0."),
  card("tide", "tide_2b", "海崖守将", "Cliff Warden", 2, 1, 0, "home_defense", "在本家主城防守时额外获得 1 城堡图标。", "When defending your home area, gain 1 additional fortification."),
  card("tide", "tide_1a", "孤帆女王", "Queen of the Lone Sail", 1, 0, 0, "solo_icons", "若本方没有支援，获得 2 剑与 1 城堡。", "If you receive no support, gain 2 swords and 1 fortification."),
  card("tide", "tide_1b", "礁石猎手", "Reef Hunter", 1, 1),
  card("tide", "tide_0", "淹神祭司", "Drowned Oracle", 0, 0, 0, "reselect_card", "支付 2 威望，弃掉此牌并改选另一张领袖牌。", "Pay 2 power to discard this card and choose another leader card."),
];

export const REALM_ORDER_COUNTS: Record<RealmOrderType, number> = {
  raid: 2, raid_star: 1,
  march_minus: 1, march: 1, march_star: 1,
  defend: 2, defend_star: 1,
  support: 2, support_star: 1,
  power: 2, power_star: 1,
};

export const REALM_SUPPLY_LIMITS: Record<number, number[]> = {
  0: [2, 2],
  1: [3, 2],
  2: [3, 2, 2],
  3: [3, 2, 2, 2],
  4: [3, 3, 2, 2],
  5: [4, 3, 2, 2],
  6: [4, 3, 2, 2, 2],
};

export const REALM_UNIT_STRENGTH: Record<RealmUnitType, number> = {
  footman: 1,
  knight: 2,
  ship: 1,
  siege: 4,
};

export const REALM_UNIT_MUSTER_COST: Record<RealmUnitType, number> = {
  footman: 1,
  knight: 2,
  ship: 1,
  siege: 2,
};

export const REALM_EVENT_DECKS = {
  1: ["quiet", "mustering", "mustering", "mustering", "supply", "supply", "supply", "throne_choice", "throne_choice", "winter"],
  2: ["clash", "clash", "clash", "raven_choice", "raven_choice", "power", "power", "power", "quiet", "winter"],
  3: ["no_power", "blade_choice", "blade_choice", "no_march_plus", "no_raid", "no_defend", "no_support", "wildling", "wildling", "wildling"],
} as const;

export type RealmEventKey = typeof REALM_EVENT_DECKS[keyof typeof REALM_EVENT_DECKS][number];

export function realmArea(key: string) {
  return REALM_AREAS.find((area) => area.key === key);
}

export function realmFaction(key: string) {
  return REALM_FACTIONS.find((faction) => faction.key === key);
}

export function realmLeader(key: string) {
  return REALM_LEADERS.find((leader) => leader.key === key);
}

export function orderIsStar(order: RealmOrderType) {
  return order.endsWith("_star");
}

export function orderFamily(order: RealmOrderType) {
  if (order.startsWith("raid")) return "raid";
  if (order.startsWith("march")) return "march";
  if (order.startsWith("defend")) return "defend";
  if (order.startsWith("support")) return "support";
  return "power";
}

export function orderModifier(order: RealmOrderType) {
  if (order === "march_minus") return -1;
  if (order === "march_star" || order === "support_star") return 1;
  if (order === "defend") return 1;
  if (order === "defend_star") return 2;
  return 0;
}
