import { BASIC_DISTRICTS, RULESETS, UNIQUE_DISTRICTS, type DistrictDefinition, type RoleDefinition, type RulesetDefinition } from "./rules.ts";

export type Language = "zh" | "en";

type RoleCopy = Pick<RoleDefinition, "name" | "short" | "description">;
type DistrictCopy = Pick<DistrictDefinition, "name" | "text">;
type RulesetCopy = Pick<RulesetDefinition, "name" | "tagline">;

export const ROLE_EN: Record<string, RoleCopy> = {
  assassin: { name: "Assassin", short: "Silence one identity for the night", description: "Name another character. That character stays hidden and skips their entire turn this round." },
  witch: { name: "Witch", short: "Borrow another character's turn", description: "After gathering resources, bewitch a character. They only gather resources; then you resume and finish the turn with their character power." },
  magistrate: { name: "Magistrate", short: "Seize a newly built district", description: "Place one signed warrant and two decoys beside three different characters. After the signed target first pays to build, you may reveal it, refund the cost, and build that district in your city for free. You cannot confiscate a duplicate; the build still counts toward the target's limit." },
  thief: { name: "Thief", short: "Steal before the bells ring", description: "Name another character. When they are called, take all their gold." },
  spy: { name: "Spy", short: "Read wealth from hand colors", description: "Look at a player's hand and name a district type. Draw one card per match and take up to that much gold from them." },
  blackmailer: { name: "Blackmailer", short: "A threat is powerful even when false", description: "Secretly threaten two characters. After gathering resources, they may pay half their gold or risk losing it all." },
  magician: { name: "Magician", short: "Turn a poor hand into a new plan", description: "Swap your entire hand with another player, or discard any number of cards and draw the same number." },
  wizard: { name: "Wizard", short: "Cast from another player's plans", description: "Look at a player's hand and take one card, or pay to build it immediately. You may build duplicate districts this turn." },
  seer: { name: "Seer", short: "Foresee every player's city", description: "Take one random card from each opponent, then return one to each. You may build up to two districts." },
  king: { name: "King", short: "The crown decides next round's first pick", description: "You must take the crown. You may gain one gold for each noble district." },
  emperor: { name: "Emperor", short: "Grant the crown where it serves you", description: "Give the crown to another player and take one gold or one random card from them. You may gain noble income." },
  patrician: { name: "Patrician", short: "Let the great houses rule next round", description: "You must take the crown. You may draw one card for each noble district." },
  bishop: { name: "Bishop", short: "Sanctuary protects the whole city", description: "Your districts cannot be affected by rank 8 powers. You may gain one gold for each religious district." },
  abbot: { name: "Abbot", short: "Faith becomes either kind of resource", description: "For each religious district, gain one gold or draw one card. The richest player must also give you one gold when possible." },
  cardinal: { name: "Cardinal", short: "Trade plans for building funds", description: "Draw cards for religious districts. If short of gold when building, trade hand cards to another player one-for-one for gold." },
  merchant: { name: "Merchant", short: "Gold flows through every street", description: "You may gain one gold for each trade district, plus one additional gold." },
  alchemist: { name: "Alchemist", short: "Building costs return at turn end", description: "At the end of your turn, recover all gold paid to the bank for building this turn." },
  trader: { name: "Trader", short: "Trade districts do not use build slots", description: "You may gain trade income. Trade districts do not count toward your build limit this turn." },
  architect: { name: "Architect", short: "Change the skyline in one night", description: "Draw two extra district cards. You may build up to three districts this turn." },
  navigator: { name: "Navigator", short: "A full cargo leaves no time to build", description: "Gain four extra gold or four extra cards. You cannot build this turn." },
  scholar: { name: "Scholar", short: "Find one answer among seven plans", description: "Look at seven deck cards and keep one, then shuffle the rest back. You may build up to two districts." },
  warlord: { name: "Warlord", short: "Every wall has a price", description: "You may gain military income. Pay one less than a district's cost to destroy it in an unfinished city." },
  diplomat: { name: "Diplomat", short: "Redraw borders with a treaty", description: "You may gain military income. Exchange one of your districts with an opponent's and pay any cost difference." },
  marshal: { name: "Marshal", short: "Take command of a low-cost district", description: "You may gain military income. Pay an opponent to take one of their districts costing three or less." },
  queen: { name: "Queen", short: "Prosper beside the ruler", description: "Gain three gold if seated next to this round's rank 4 character. Used only with five or more players." },
  artist: { name: "Artist", short: "Add lasting value to the city", description: "Pay gold to beautify up to two districts. Each permanently gains one cost and one endgame point." },
  tax_collector: { name: "Tax Collector", short: "Every build leaves a tax behind", description: "While in the cast, other characters pay one gold after building when able. Collect all accumulated tax on your turn." },
};

export const DISTRICT_EN: Record<string, DistrictCopy> = {
  manor: { name: "Manor" }, castle: { name: "Castle" }, palace: { name: "Palace" },
  temple: { name: "Temple" }, church: { name: "Church" }, monastery: { name: "Monastery" }, cathedral: { name: "Cathedral" },
  tavern: { name: "Tavern" }, market: { name: "Market" }, trading_post: { name: "Trading Post" }, docks: { name: "Docks" }, harbor: { name: "Harbor" }, town_hall: { name: "Town Hall" },
  watchtower: { name: "Watchtower" }, prison: { name: "Prison" }, barracks: { name: "Barracks" }, fortress: { name: "Fortress" },
  armory: { name: "Armory", text: "During your turn, destroy the Armory to destroy one district in an unfinished city for free." },
  basilica: { name: "Basilica", text: "At game end, score one extra point for each odd-cost district in your city." },
  capitol: { name: "Capitol", text: "At game end, score three extra points if your city has at least three districts of one type." },
  dragon_gate: { name: "Dragon Gate", text: "Score two extra points at game end." },
  factory: { name: "Factory", text: "Pay one less gold when building other unique districts." },
  framework: { name: "Framework", text: "Destroy the Framework instead of paying the cost of your next district." },
  gold_mine: { name: "Gold Mine", text: "Gain one extra gold when you choose gold as your resource." },
  great_wall: { name: "Great Wall", text: "Rank 8 characters pay one extra gold to affect your other districts." },
  haunted_quarter: { name: "Haunted Quarter", text: "At game end, it may count as any district type." },
  imperial_treasury: { name: "Imperial Treasury", text: "At game end, score one extra point for each gold you still have." },
  ivory_tower: { name: "Ivory Tower", text: "Score five extra points if this is your only unique district at game end." },
  keep: { name: "Keep", text: "Rank 8 character powers cannot affect it." },
  laboratory: { name: "Laboratory", text: "Once per turn, discard one hand card to gain two gold." },
  library: { name: "Library", text: "When drawing cards for resources, keep every card drawn." },
  map_room: { name: "Map Room", text: "At game end, score one extra point for each card in your hand." },
  monument: { name: "Monument", text: "Cannot be built when you already have five districts; counts as two toward city completion." },
  museum: { name: "Museum", text: "Once per turn, store a hand card underneath it. Each stored card scores one point." },
  necropolis: { name: "Necropolis", text: "Destroy one of your districts instead of paying this district's building cost." },
  observatory: { name: "Observatory", text: "Draw three cards instead of two when choosing cards as your resource." },
  park: { name: "Park", text: "If your hand is empty at turn end, draw two cards." },
  poor_house: { name: "Poor House", text: "If you have no gold at turn end, gain one gold." },
  quarry: { name: "Quarry", text: "You may build districts with the same name." },
  school_of_magic: { name: "School of Magic", text: "When gaining character income, it may count as the required district type." },
  secret_vault: { name: "Secret Vault", text: "Cannot be built. If still in your hand at game end, score three extra points." },
  smithy: { name: "Smithy", text: "Once per turn, pay two gold to draw three cards." },
  stables: { name: "Stables", text: "Building it does not count toward your turn's build limit." },
  statue: { name: "Statue", text: "Score five extra points at game end if you hold the crown." },
  theater: { name: "Theater", text: "After drafting, you may blindly exchange a character with an opponent." },
  thieves_den: { name: "Thieves' Den", text: "When building, discard hand cards for one gold each toward its cost." },
  wishing_well: { name: "Wishing Well", text: "At game end, score one point for each unique district in your city, including this one." },
};

export const RULESET_EN: Record<string, RulesetCopy> = {
  first_game: { name: "Classic Introduction", tagline: "The original eight characters; ideal for a first game" },
  ambitious: { name: "Ambitious Nobles", tagline: "Build repeatedly and acquire districts" },
  cunning: { name: "Cunning Agents", tagline: "Bluffs, blackmail, and intense interaction" },
  emissaries: { name: "Illustrious Emissaries", tagline: "Steady defense and plentiful resources" },
  devious: { name: "Devious Dignitaries", tagline: "Read intentions and trade positions" },
  tenacious: { name: "Tenacious Delegates", tagline: "Rich character and district combinations" },
  vicious: { name: "Vicious Nobles", tagline: "Direct aggression and fierce conflict" },
};

export const COLOR_NAMES_EN = {
  yellow: "Noble", blue: "Religious", green: "Trade", red: "Military", purple: "Unique",
} as const;

export function localizedRole<T extends RoleDefinition>(role: T, language: Language): T {
  return language === "en" && ROLE_EN[role.key] ? { ...role, ...ROLE_EN[role.key] } : role;
}

export function localizedDistrict<T extends DistrictDefinition>(district: T, language: Language): T {
  return language === "en" && DISTRICT_EN[district.key] ? { ...district, ...DISTRICT_EN[district.key] } : district;
}

export function localizedRuleset<T extends RulesetDefinition>(ruleset: T, language: Language): T {
  return language === "en" && RULESET_EN[ruleset.key] ? { ...ruleset, ...RULESET_EN[ruleset.key] } : ruleset;
}

const ERROR_EN: Record<string, string> = {
  "这台设备的历史记录密钥无效，请刷新页面重试。": "This device's history key is invalid. Refresh the page and try again.",
  "请输入四位房间码。": "Enter the four-character room code.",
  "没有找到这个房间，房间可能已超过 7 天未活动。": "Room not found. It may have expired after seven inactive days.",
  "房间身份已经失效，请使用恢复码返回座位。": "Your seat session is no longer valid. Use the recovery code to return.",
  "请输入 10 位恢复码。": "Enter the 10-character recovery code.",
  "恢复码不正确，或这个座位已经被移除。": "That recovery code is incorrect, or the seat was removed.",
  "牌桌刚刚被另一项操作更新，请同步后重试。": "Another action just updated the table. Sync and try again.",
  "操作太频繁，请稍等一分钟再试。": "Too many actions. Wait a minute and try again.",
  "房主尚未离线满 45 秒。": "The host has not been offline for 45 seconds yet.",
  "这位玩家尚未离线满 45 秒。": "That player has not been offline for 45 seconds yet.",
  "请先输入昵称。": "Enter a nickname first.",
  "房间已满，最多 8 位玩家。": "The room is full; the maximum is eight players.",
  "游戏已经开始，不能再加入这局。": "This game has already started and no longer accepts new players.",
  "这局已经开始了。": "This game has already started.",
  "至少需要两位玩家。": "At least two players are required.",
  "只有房主可以开始游戏。": "Only the host can start the game.",
  "只有房主可以重新开局。": "Only the host can restart the game.",
  "只有房主可以添加电脑玩家。": "Only the host can add AI players.",
  "只有房主可以移除座位。": "Only the host can remove a seat.",
  "只有房主可以移交房主。": "Only the host can transfer host control.",
  "只有房主可以启用掉线托管。": "Only the host can enable AI takeover.",
  "还没轮到你选角。": "It is not your turn to draft.",
  "现在不是你的回合。": "It is not your turn.",
  "请先选择本回合的资源。": "Choose your resources first.",
  "你已经选择过本回合的资源。": "You already chose resources this turn.",
  "请先完成当前选择。": "Complete the current pending choice first.",
  "执法官必须选择三个不同的目标角色。": "The Magistrate must choose three different target characters.",
  "请在三个目标中指定真拘票。": "Choose which of the three targets receives the signed warrant.",
  "当前没有需要处理的拘票。": "There is no warrant decision to resolve.",
  "假拘票不能揭开并没收城区。": "A decoy warrant cannot be revealed to confiscate a district.",
  "未知操作。": "Unknown action.",
};

export function translatedError(message: string, language: Language) {
  if (language === "zh") return message;
  return ERROR_EN[message.trim()] ?? "This action is not currently allowed. Check the current turn and rules.";
}

export function translatedGameMessage(message: string, language: Language) {
  if (language === "zh") return message;
  let output = message;
  for (const [key, copy] of Object.entries(ROLE_EN)) {
    const chinese = ({
      assassin: "刺客", witch: "女巫", magistrate: "执法官", thief: "盗贼", spy: "间谍", blackmailer: "勒索者",
      magician: "魔术师", wizard: "巫师", seer: "先知", king: "国王", emperor: "皇帝", patrician: "贵族",
      bishop: "主教", abbot: "修道院长", cardinal: "枢机主教", merchant: "商人", alchemist: "炼金术士", trader: "贸易商",
      architect: "建筑师", navigator: "航海家", scholar: "学者", warlord: "军阀", diplomat: "外交官", marshal: "统帅",
      queen: "王后", artist: "艺术家", tax_collector: "税务官",
    } as Record<string, string>)[key];
    if (chinese) output = output.replaceAll(chinese, copy.name);
  }
  for (const source of [...BASIC_DISTRICTS, ...UNIQUE_DISTRICTS]) {
    const english = DISTRICT_EN[source.key]?.name;
    if (english) output = output.replaceAll(source.name, english);
  }
  for (const source of RULESETS) {
    const english = RULESET_EN[source.key]?.name;
    if (english) output = output.replaceAll(source.name, english);
  }
  const phrases: Array<[string, string]> = [
    ["（电脑）", " (AI)"], ["加入了房间。", " joined the room."], ["离开了房间。", " left the room."],
    ["接任了房主。", " became the host."], ["的座位暂时交给电脑托管。", "'s seat is now controlled by AI."],
    ["使用恢复码回到了牌桌。", " returned to the table with a recovery code."], ["已离开，电脑接管了这个座位。", " left; AI took over the seat."],
    ["建立了房间，规则套组为“", " created a room using “"],
    ["角色全部选定，开始按编号叫号。", "All characters are chosen. Calling ranks in order."],
    ["已秘密选好角色。", " secretly chose a character."], ["公开身份：", " revealed: "],
    ["接过了皇冠。", " took the crown."], ["从国库取走", " took"], ["金币。", " gold."],
    ["保留了 1 张城区牌。", " kept one district card."], ["建造了", " built "], ["结束回合。", " ended the turn."],
    ["把三张拘票秘密放到角色标记旁。", " secretly placed three warrants beside character tokens."],
    ["支付建造", " paid to build "], ["，等待执法官处理其拘票。", "; the Magistrate is resolving the warrant."],
    ["揭开真拘票，没收了 ", " revealed the signed warrant and confiscated "], ["；建造金币已退还。", "; the building cost was refunded."],
    ["没有揭开拘票；", " did not reveal the warrant; "], ["揭开真拘票，但因已有同名城区而不能没收；", " revealed the signed warrant but could not confiscate a duplicate; "],
    ["首先完成城市，本轮结束后结算。", " completed a city first; scoring begins after the round."],
    ["最后一个角色的回合结束，城市计分开始。", "The final character finished; city scoring begins."],
    ["本轮遭到刺杀。", " was assassinated this round."], ["号角色没有回应叫号。", " did not answer the call."],
    ["正在考虑是否秘密交换角色。", " is considering a secret character exchange."],
    ["放弃了剧院的角色交换。", " declined the Theater exchange."], ["借剧院与一名玩家秘密交换了角色。", " secretly exchanged a character through the Theater."],
    ["摧毁了", " destroyed "], ["的效果。", "'s effect."], ["使用了", " used "],
  ];
  for (const [chinese, english] of phrases) output = output.replaceAll(chinese, english);
  output = output.replace(/^第 (\d+) 轮开始，皇冠持有者先秘密选角。$/, "Round $1 begins. The crown holder drafts first.");
  output = output.replace(/^第 (\d+) 轮/, "Round $1");
  return output;
}
