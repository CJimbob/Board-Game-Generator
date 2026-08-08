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

export type RealmStartingUnit = {
  faction: string;
  area: string;
  type: RealmUnitType;
  quantity?: number;
};

export type RealmSetupDefinition = {
  factions: string[];
  blocked: string[];
  neutralForces: Record<string, number>;
  removedStartingAreas: string[];
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
  | "move_influence_bottom" | "reselect_card" | "throne_rival" | "discard_synergy"
  | "castle_defense" | "stance_icon" | "remove_adjacent_order";

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
  { key: "umbral", name: "玄羽议会", nameEn: "Umbral Conclave", motto: "真相藏在最后一封信里", mottoEn: "Truth waits in the final letter", color: "#67547d", home: "shadow_fort", port: "shadow_port", startingSupply: 2, startingInfluence: [2, 6, 1] },
  { key: "sunward", name: "曜金议庭", nameEn: "Sunward Council", motto: "财富只服从耐心", mottoEn: "Fortune bends to patience", color: "#c59a42", home: "goldhaven", port: "gold_port", startingSupply: 2, startingInfluence: [1, 5, 4] },
  { key: "verdant", name: "绿冠王庭", nameEn: "Verdant Court", motto: "花开之后仍有利刃", mottoEn: "A blade remains after the bloom", color: "#5e8a62", home: "highgarden", port: "old_port", startingSupply: 2, startingInfluence: [6, 2, 5] },
  { key: "redmarch", name: "赤岭军府", nameEn: "Redmarch Host", motto: "城墙终会向火焰低头", mottoEn: "Every wall bows to flame", color: "#a84f47", home: "ember_keep", port: "ember_port", startingSupply: 2, startingInfluence: [4, 3, 3] },
  { key: "tide", name: "苍潮联邦", nameEn: "Tideborne League", motto: "潮汐不承认边界", mottoEn: "The tide recognizes no border", color: "#3f8792", home: "tidewatch", port: "tide_port", startingSupply: 2, startingInfluence: [5, 1, 6] },
];

export const REALM_AREAS: RealmAreaDefinition[] = [
  { key: "crown_lowlands", name: "王畿泽", nameEn: "Crown Lowlands", kind: "land", x: 35.1, y: 64.1, supply: 2, adjacent: ["claw_point", "ashen_hall", "throne_city", "coastroad", "stone_sept", "central_plains"] },
  { key: "throne_city", name: "苍穹王城", nameEn: "Skyhold", kind: "land", x: 52.5, y: 65.2, castle: 2, power: 2, garrison: 5, neutral: 5, adjacent: ["crown_lowlands", "crown_bay", "claw_point", "crownwood", "central_plains"] },
  { key: "central_plains", name: "群王原", nameEn: "Kingsplain", kind: "land", x: 38.8, y: 72.5, castle: 1, adjacent: ["crown_lowlands", "ember_march", "highgarden", "throne_city", "crownwood", "coastroad", "bone_road"] },
  { key: "crownwood", name: "王冠林", nameEn: "Crownwood", kind: "land", x: 61.5, y: 67.8, supply: 1, power: 1, adjacent: ["crown_bay", "throne_city", "storm_bay", "stormhold", "bone_road", "central_plains"] },
  { key: "crown_bay", name: "王城湾", nameEn: "Crown Bay", kind: "sea", x: 61.3, y: 61.2, adjacent: ["claw_point", "throne_city", "crownwood", "storm_bay"] },
  { key: "claw_point", name: "鹰爪岬", nameEn: "Claw Point", kind: "land", x: 52.4, y: 57.9, castle: 1, adjacent: ["crown_lowlands", "crown_bay", "ashen_hall", "throne_city", "storm_bay", "moon_mountains", "narrow_sea"] },
  { key: "ashen_hall", name: "灰烬厅", nameEn: "Ashen Hall", kind: "land", x: 42.6, y: 54.5, castle: 1, power: 1, adjacent: ["crown_lowlands", "claw_point", "riverwatch", "stone_sept"] },
  { key: "stone_sept", name: "石堂镇", nameEn: "Stone Sept", kind: "land", x: 32.7, y: 56.6, power: 1, adjacent: ["crown_lowlands", "ashen_hall", "shadow_fort", "riverwatch", "coastroad"] },
  { key: "riverwatch", name: "河望城", nameEn: "Riverwatch", kind: "land", x: 33.4, y: 50.2, castle: 2, supply: 1, power: 1, adjacent: ["ashen_hall", "iron_bay", "shadow_fort", "seagate", "stone_sept", "gilded_sound"] },
  { key: "shadow_fort", name: "玄羽堡", nameEn: "Shadow Fort", kind: "land", x: 23, y: 52.2, castle: 2, supply: 2, homeOf: "umbral", garrison: 2, adjacent: ["shadow_port", "riverwatch", "coastroad", "stone_sept", "gilded_sound"] },
  { key: "tidewatch", name: "苍潮城", nameEn: "Tidewatch", kind: "land", x: 9.6, y: 42.4, castle: 2, supply: 1, power: 1, homeOf: "tide", garrison: 2, adjacent: ["iron_bay", "tide_port"] },
  { key: "iron_bay", name: "铁民湾", nameEn: "Iron Bay", kind: "sea", x: 14, y: 39.4, adjacent: ["flint_cape", "greyfen", "tide_port", "tidewatch", "riverwatch", "seagate", "sunset_sea", "gilded_sound"] },
  { key: "gilded_sound", name: "鎏金海峡", nameEn: "Gilded Sound", kind: "sea", x: 6, y: 60.8, adjacent: ["iron_bay", "shadow_fort", "shadow_port", "riverwatch", "coastroad", "sunset_sea"] },
  { key: "tide_port", name: "苍潮港", nameEn: "Tidewatch Port", kind: "port", x: 19.2, y: 42.3, portOf: "tidewatch", seaOf: "iron_bay", adjacent: ["iron_bay", "tidewatch"] },
  { key: "shadow_port", name: "玄羽港", nameEn: "Shadow Port", kind: "port", x: 15.4, y: 55.7, portOf: "shadow_fort", seaOf: "gilded_sound", adjacent: ["shadow_fort", "gilded_sound"] },
  { key: "seagate", name: "海门城", nameEn: "Seagate", kind: "land", x: 26.8, y: 39.6, castle: 2, supply: 1, power: 1, adjacent: ["greyfen", "iron_bay", "reedgate", "riverwatch", "twin_ford"] },
  { key: "sunset_sea", name: "落日海", nameEn: "Sunset Sea", kind: "sea", x: 4.4, y: 33.9, adjacent: ["ice_bay", "flint_cape", "iron_bay", "coastroad", "gilded_sound", "southern_sea"] },
  { key: "flint_cape", name: "燧石岬", nameEn: "Flint Cape", kind: "land", x: 18.3, y: 34.5, castle: 1, adjacent: ["ice_bay", "greyfen", "iron_bay", "sunset_sea"] },
  { key: "greyfen", name: "灰水泽", nameEn: "Greyfen", kind: "land", x: 27.1, y: 33.1, supply: 1, adjacent: ["ice_bay", "flint_cape", "iron_bay", "reedgate", "seagate"] },
  { key: "coastroad", name: "海岸行军道", nameEn: "Coastroad March", kind: "land", x: 19.6, y: 63.5, supply: 1, adjacent: ["crown_lowlands", "highgarden", "shadow_fort", "stone_sept", "sunset_sea", "gilded_sound", "central_plains", "southern_sea"] },
  { key: "ice_bay", name: "冰霜湾", nameEn: "Bay of Frost", kind: "sea", x: 4.3, y: 6.8, adjacent: ["frostwall", "flint_cape", "greyfen", "north_port", "sunset_sea", "stone_coast", "northhold"] },
  { key: "frostwall", name: "霜墙", nameEn: "Frostwall", kind: "land", x: 47.8, y: 1.7, power: 1, adjacent: ["ice_bay", "karpeak", "shivering_sea", "northhold"] },
  { key: "karpeak", name: "卡尔峰", nameEn: "Karpeak", kind: "land", x: 58.8, y: 7.8, power: 1, adjacent: ["frostwall", "shivering_sea", "northhold"] },
  { key: "northhold", name: "北辰堡", nameEn: "Northhold", kind: "land", x: 32.2, y: 16.8, castle: 2, supply: 1, power: 1, homeOf: "frost", garrison: 2, adjacent: ["ice_bay", "frostwall", "karpeak", "reedgate", "north_port", "shivering_sea", "stone_coast", "white_harbor"] },
  { key: "north_port", name: "北辰港", nameEn: "Northhold Port", kind: "port", x: 22.2, y: 10.7, portOf: "northhold", seaOf: "ice_bay", adjacent: ["ice_bay", "northhold"] },
  { key: "stone_coast", name: "岩砾海岸", nameEn: "Stony Coast", kind: "land", x: 18.7, y: 20.5, supply: 1, adjacent: ["ice_bay", "northhold"] },
  { key: "white_harbor", name: "白帆港", nameEn: "White Harbor", kind: "land", x: 48.8, y: 20.2, castle: 1, adjacent: ["reedgate", "white_port", "narrow_sea", "shivering_sea", "widow_watch", "northhold"] },
  { key: "widow_watch", name: "寡妇望", nameEn: "Widow Watch", kind: "land", x: 57.8, y: 23.3, supply: 1, adjacent: ["narrow_sea", "shivering_sea", "white_harbor"] },
  { key: "shivering_sea", name: "战栗海", nameEn: "Shivering Sea", kind: "sea", x: 74.2, y: 20, adjacent: ["frostwall", "karpeak", "narrow_sea", "white_harbor", "widow_watch", "northhold"] },
  { key: "reedgate", name: "苇泽关", nameEn: "Reedgate", kind: "land", x: 36, y: 34.5, castle: 1, adjacent: ["greyfen", "seagate", "narrow_sea", "twin_ford", "white_harbor", "northhold"] },
  { key: "white_port", name: "白帆外港", nameEn: "White Harbor Port", kind: "port", x: 49.2, y: 31.3, portOf: "white_harbor", seaOf: "narrow_sea", adjacent: ["narrow_sea", "white_harbor"] },
  { key: "narrow_sea", name: "狭长海", nameEn: "Narrow Sea", kind: "sea", x: 74.4, y: 31.3, adjacent: ["claw_point", "reedgate", "white_port", "storm_bay", "eagle_nest", "east_fingers", "moon_mountains", "shivering_sea", "twin_ford", "white_harbor", "widow_watch"] },
  { key: "east_fingers", name: "东指半岛", nameEn: "Eastern Fingers", kind: "land", x: 55, y: 38.8, supply: 1, adjacent: ["moon_mountains", "narrow_sea", "twin_ford"] },
  { key: "twin_ford", name: "双子渡", nameEn: "Twin Ford", kind: "land", x: 40.5, y: 41.3, power: 1, adjacent: ["reedgate", "seagate", "east_fingers", "moon_mountains", "narrow_sea"] },
  { key: "moon_mountains", name: "月脊群山", nameEn: "Moon Mountains", kind: "land", x: 49.6, y: 45.3, supply: 1, adjacent: ["claw_point", "eagle_nest", "east_fingers", "narrow_sea", "twin_ford"] },
  { key: "eagle_nest", name: "鹰巢天险", nameEn: "Eagle's Eyrie", kind: "land", x: 60.4, y: 50.2, castle: 1, supply: 1, power: 1, garrison: 6, neutral: 6, adjacent: ["moon_mountains", "narrow_sea"] },
  { key: "storm_bay", name: "碎舰湾", nameEn: "Stormbreak Bay", kind: "sea", x: 74.3, y: 67.9, adjacent: ["crown_bay", "claw_point", "goldhaven", "eastern_summer", "crownwood", "gold_port", "storm_port", "stormhold", "narrow_sea"] },
  { key: "goldhaven", name: "曜金岛", nameEn: "Goldhaven", kind: "land", x: 74.7, y: 54.5, castle: 2, supply: 1, power: 1, homeOf: "sunward", garrison: 2, adjacent: ["gold_port", "storm_bay"] },
  { key: "gold_port", name: "曜金港", nameEn: "Goldhaven Port", kind: "port", x: 75, y: 62.4, portOf: "goldhaven", seaOf: "storm_bay", adjacent: ["goldhaven", "storm_bay"] },
  { key: "ember_port", name: "赤岭港", nameEn: "Ember Port", kind: "port", x: 72.1, y: 88.9, portOf: "ember_keep", seaOf: "eastern_summer", adjacent: ["eastern_summer", "ember_keep"] },
  { key: "ember_keep", name: "赤岭堡", nameEn: "Ember Keep", kind: "land", x: 62.1, y: 86.1, castle: 2, supply: 1, power: 1, homeOf: "redmarch", garrison: 2, adjacent: ["eastern_summer", "ember_port", "salt_shore", "ember_sea", "ironwood"] },
  { key: "ember_sea", name: "余烬海", nameEn: "Ember Sea", kind: "sea", x: 55.3, y: 82.8, adjacent: ["eastern_summer", "stormhold", "ember_keep", "bone_road", "ironwood"] },
  { key: "eastern_summer", name: "东暖海", nameEn: "Eastern Summer Sea", kind: "sea", x: 59.5, y: 97.3, adjacent: ["ember_port", "salt_shore", "ember_sea", "storm_bay", "duskfall", "stormhold", "ember_keep", "southern_sea"] },
  { key: "salt_shore", name: "盐岸", nameEn: "Salt Shore", kind: "land", x: 51.1, y: 90.1, supply: 1, adjacent: ["eastern_summer", "duskfall", "ember_keep", "ironwood"] },
  { key: "stormhold", name: "风暴堡", nameEn: "Stormhold", kind: "land", x: 57.5, y: 77.2, castle: 1, adjacent: ["eastern_summer", "crownwood", "storm_port", "ember_sea", "storm_bay", "bone_road"] },
  { key: "storm_port", name: "风暴港", nameEn: "Stormhold Port", kind: "port", x: 63.4, y: 75.1, portOf: "stormhold", seaOf: "storm_bay", adjacent: ["storm_bay", "stormhold"] },
  { key: "bone_road", name: "白骨道", nameEn: "Bone Road", kind: "land", x: 48.5, y: 77.8, power: 1, adjacent: ["ember_march", "crownwood", "red_pass", "ember_sea", "stormhold", "central_plains", "ironwood"] },
  { key: "red_pass", name: "赤焰隘", nameEn: "Red Pass", kind: "land", x: 34.1, y: 81, supply: 1, power: 1, adjacent: ["ember_march", "duskfall", "bone_road", "triarch_towers", "ironwood"] },
  { key: "ironwood", name: "铁木谷", nameEn: "Ironwood", kind: "land", x: 39.4, y: 86.7, castle: 1, adjacent: ["red_pass", "salt_shore", "ember_sea", "duskfall", "ember_keep", "bone_road"] },
  { key: "triarch_towers", name: "三贤塔", nameEn: "Triarch Towers", kind: "land", x: 24, y: 84.9, supply: 1, adjacent: ["ember_march", "old_tower", "red_pass", "green_straits", "southern_sea"] },
  { key: "duskfall", name: "暮星城", nameEn: "Duskfall", kind: "land", x: 31.4, y: 92, castle: 1, supply: 1, adjacent: ["eastern_summer", "red_pass", "salt_shore", "southern_sea", "ironwood"] },
  { key: "glass_isle", name: "琉璃岛", nameEn: "Glass Isle", kind: "land", x: 7.2, y: 92.8, power: 1, adjacent: ["green_straits", "southern_sea"] },
  { key: "southern_sea", name: "西暖海", nameEn: "Western Summer Sea", kind: "sea", x: 24, y: 97.2, adjacent: ["eastern_summer", "highgarden", "green_straits", "coastroad", "duskfall", "sunset_sea", "glass_isle", "triarch_towers"] },
  { key: "green_straits", name: "青藤海峡", nameEn: "Verdant Straits", kind: "sea", x: 8.9, y: 88.5, adjacent: ["highgarden", "old_tower", "old_port", "glass_isle", "triarch_towers", "southern_sea"] },
  { key: "old_port", name: "古塔港", nameEn: "Old Tower Port", kind: "port", x: 10.6, y: 80.2, portOf: "old_tower", seaOf: "green_straits", adjacent: ["old_tower", "green_straits"] },
  { key: "old_tower", name: "古塔城", nameEn: "Old Tower", kind: "land", x: 18.4, y: 80.4, castle: 2, adjacent: ["ember_march", "highgarden", "old_port", "green_straits", "triarch_towers"] },
  { key: "highgarden", name: "绿冠庭", nameEn: "Green Crown", kind: "land", x: 17.8, y: 70.9, castle: 2, supply: 2, homeOf: "verdant", garrison: 2, adjacent: ["ember_march", "old_tower", "green_straits", "coastroad", "central_plains", "southern_sea"] },
  { key: "ember_march", name: "焰边行省", nameEn: "Ember Marches", kind: "land", x: 33.4, y: 76.8, power: 1, adjacent: ["highgarden", "old_tower", "red_pass", "bone_road", "central_plains", "triarch_towers"] },
];

export const REALM_PLAYER_SETUPS: Record<number, RealmSetupDefinition> = {
  3: {
    factions: ["sunward", "umbral", "frost"],
    blocked: ["tidewatch", "tide_port", "highgarden", "old_tower", "old_port", "ember_keep", "ember_port", "salt_shore", "ironwood", "duskfall", "triarch_towers", "ember_march", "red_pass", "bone_road", "stormhold", "storm_port"],
    neutralForces: {},
    removedStartingAreas: ["shadow_port"],
  },
  4: {
    factions: ["sunward", "umbral", "frost", "tide"],
    blocked: [],
    neutralForces: { old_tower: 3, triarch_towers: 3, ember_march: 3, red_pass: 3, duskfall: 3, ironwood: 3, bone_road: 3, stormhold: 4, salt_shore: 3, ember_keep: 5 },
    removedStartingAreas: [],
  },
  5: {
    factions: ["sunward", "umbral", "frost", "tide", "verdant"],
    blocked: [],
    neutralForces: { triarch_towers: 3, red_pass: 3, bone_road: 3, duskfall: 3, ironwood: 3, salt_shore: 3, ember_keep: 5 },
    removedStartingAreas: [],
  },
  6: { factions: ["frost", "tide", "umbral", "sunward", "verdant", "redmarch"], blocked: [], neutralForces: {}, removedStartingAreas: [] },
};

export const REALM_STARTING_UNITS: RealmStartingUnit[] = [
  { faction: "frost", area: "northhold", type: "footman" }, { faction: "frost", area: "northhold", type: "knight" },
  { faction: "frost", area: "white_harbor", type: "footman" }, { faction: "frost", area: "shivering_sea", type: "ship" },
  { faction: "tide", area: "tidewatch", type: "footman" }, { faction: "tide", area: "tidewatch", type: "knight" },
  { faction: "tide", area: "tide_port", type: "ship" }, { faction: "tide", area: "iron_bay", type: "ship" }, { faction: "tide", area: "greyfen", type: "footman" },
  { faction: "umbral", area: "shadow_fort", type: "footman" }, { faction: "umbral", area: "shadow_fort", type: "knight" },
  { faction: "umbral", area: "shadow_port", type: "ship" }, { faction: "umbral", area: "gilded_sound", type: "ship" }, { faction: "umbral", area: "stone_sept", type: "footman" },
  { faction: "sunward", area: "goldhaven", type: "footman" }, { faction: "sunward", area: "goldhaven", type: "knight" },
  { faction: "sunward", area: "storm_bay", type: "ship", quantity: 2 }, { faction: "sunward", area: "crownwood", type: "footman" },
  { faction: "verdant", area: "highgarden", type: "footman" }, { faction: "verdant", area: "highgarden", type: "knight" },
  { faction: "verdant", area: "green_straits", type: "ship" }, { faction: "verdant", area: "ember_march", type: "footman" },
  { faction: "redmarch", area: "ember_keep", type: "footman" }, { faction: "redmarch", area: "ember_keep", type: "knight" },
  { faction: "redmarch", area: "ember_sea", type: "ship" }, { faction: "redmarch", area: "salt_shore", type: "footman" },
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
  card("frost", "frost_2a", "灰堡伯爵", "Grey Castellan", 2, 0, 0, "recover_cards", "若你战败，收回弃牌堆中的全部领袖牌（包括本牌）。", "If you lose, return every discarded leader card, including this card, to your hand."),
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

  card("sunward", "sunward_4", "曜日摄政", "Sun Regent", 4, 0, 0, "throne_rival", "若对手在王座轨道高于你，本牌战力 +1。", "If your opponent is higher on the Throne track, this card gains +1 strength."),
  card("sunward", "sunward_3", "金狮战侯", "Golden War-Lord", 3, 0, 0, "upgrade_after_win", "若获胜，可将一名参战或本家支援步兵升级为骑兵。", "If you win, upgrade one participating or friendly supporting Footman to a Knight."),
  card("sunward", "sunward_2a", "海门提督", "Admiral of the Gate", 2, 0, 0, "discard_synergy", "若曜日摄政在弃牌堆，本牌战力 +1 并获得 1 剑。", "If Sun Regent is discarded, this card gains +1 strength and 1 sword."),
  card("sunward", "sunward_2b", "誓剑女爵", "Oathblade Lady", 2, 1, 1),
  card("sunward", "sunward_1a", "炉火先知", "Oracle of Embers", 1, 1),
  card("sunward", "sunward_1b", "港湾走私王", "Smuggler King", 1, 0, 0, "cancel_ship_support", "本场战斗中所有非本家舰船的战力视为 0。", "All non-Sunward Ships contribute 0 strength in this combat."),
  card("sunward", "sunward_0", "无面弄臣", "Faceless Fool", 0, 0, 0, "discard_enemy_card", "战斗后查看并弃掉对手手中的一张领袖牌。", "After combat, discard one leader card from the opponent's hand."),

  card("verdant", "verdant_4", "荆棘元帅", "Thorn Marshal", 4, 0, 0, "destroy_footman", "战斗开始时，摧毁敌军一名步兵。", "At combat start, destroy one opposing Footman."),
  card("verdant", "verdant_3", "百花骑士", "Knight of a Hundred Blooms", 3, 0, 0, "march_again", "作为进攻方获胜后，该行军命令可保留并再次结算。", "If you win as attacker, the March order may remain and be resolved again."),
  card("verdant", "verdant_2a", "青藤剑圣", "Vine Swordmaster", 2, 2),
  card("verdant", "verdant_2b", "古橡将军", "Old Oak General", 2, 1),
  card("verdant", "verdant_1a", "谷地守望", "Vale Sentinel", 1, 0, 2),
  card("verdant", "verdant_1b", "花冠继承人", "Heir of Flowers", 1, 0, 1),
  card("verdant", "verdant_0", "蔷薇太后", "Rose Dowager", 0, 0, 0, "remove_adjacent_order", "立即移除战斗区域相邻的一枚敌方命令，但不能移除发起战斗的行军。", "Immediately remove an opposing order adjacent to the battle, except the initiating March."),

  card("redmarch", "redmarch_4", "赤沙亲王", "Prince of Red Sands", 4, 2, 1),
  card("redmarch", "redmarch_3", "高塔卫长", "High Tower Captain", 3, 0, 1),
  card("redmarch", "redmarch_2a", "暮星剑客", "Duskstar", 2, 1),
  card("redmarch", "redmarch_2b", "烈矛女将", "Spear-Maiden", 2, 1),
  card("redmarch", "redmarch_1a", "沙海统领", "Commander of Sands", 1, 0, 0, "stance_icon", "进攻时获得 1 剑；防守时获得 1 城堡。", "Gain 1 sword when attacking or 1 fortification when defending."),
  card("redmarch", "redmarch_1b", "赤岭公主", "Princess of the March", 1, 0, 0, "no_attacker_advance", "你作为防守方败北时，进攻军不能进入该区域。", "If you lose as defender, the attacking army cannot advance into the area."),
  card("redmarch", "redmarch_0", "长枪谋主", "Spear Strategist", 0, 0, 0, "move_influence_bottom", "战斗后将对手在一个影响力轨道移到末位。", "After combat, move the opponent to the bottom of one influence track."),

  card("tide", "tide_4", "风暴海王", "Storm King", 4, 1),
  card("tide", "tide_3", "破浪船主", "Wavebreaker", 3, 0, 0, "ship_attack", "进攻时，参战与支援的舰船各额外提供 1 战力。", "When attacking, participating and supporting Ships gain +1 strength each."),
  card("tide", "tide_2a", "盐冠领主", "Lord of the Salt Crown", 2, 0, 0, "enemy_card_zero", "对手领袖牌的印刷战力视为 0。", "The printed strength of the opposing leader card is treated as 0."),
  card("tide", "tide_2b", "海崖守将", "Cliff Warden", 2, 0, 0, "castle_defense", "在城堡或要塞防守时战力 +1 并获得 1 剑。", "When defending a Castle or Stronghold, gain +1 strength and 1 sword."),
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
