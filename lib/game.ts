export type GameStatus = "lobby" | "draft" | "turns" | "finished";
export type DistrictColor = "yellow" | "blue" | "green" | "red" | "purple";

export type DistrictCard = {
  uid: string;
  name: string;
  color: DistrictColor;
  cost: number;
  text?: string;
};

export type RoleDefinition = {
  id: number;
  name: string;
  short: string;
  color: DistrictColor | "neutral";
  description: string;
};

export type PlayerState = {
  id: string;
  token: string;
  name: string;
  isBot: boolean;
  gold: number;
  hand: DistrictCard[];
  city: DistrictCard[];
  roleId: number | null;
  revealed: boolean;
  resourceTaken: boolean;
  pendingDraw: DistrictCard[];
  buildsThisTurn: number;
  abilityUsed: boolean;
};

export type GameState = {
  code: string;
  hostId: string;
  status: GameStatus;
  round: number;
  crownPlayerId: string;
  draftOrder: string[];
  draftIndex: number;
  availableRoleIds: number[];
  currentRole: number | null;
  players: PlayerState[];
  deck: DistrictCard[];
  discard: DistrictCard[];
  assassinatedRole: number | null;
  robbedRole: number | null;
  firstCompletedPlayerId: string | null;
  log: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

export const ROLES: RoleDefinition[] = [
  {
    id: 1,
    name: "刺客",
    short: "匕首藏在斗篷下",
    color: "neutral",
    description: "点名一名角色；该角色本轮跳过行动。",
  },
  {
    id: 2,
    name: "盗贼",
    short: "在钟声响起前下手",
    color: "neutral",
    description: "点名一名角色；对方出场时，夺取其全部金币。",
  },
  {
    id: 3,
    name: "魔术师",
    short: "让坏手牌重新洗牌",
    color: "neutral",
    description: "可弃掉全部手牌，再抽取相同数量的牌。",
  },
  {
    id: 4,
    name: "国王",
    short: "王冠选择下一轮的起点",
    color: "yellow",
    description: "每座黄色城区获得 1 金币，并取得皇冠。",
  },
  {
    id: 5,
    name: "主教",
    short: "圣堂庇护你的城市",
    color: "blue",
    description: "每座蓝色城区获得 1 金币；城区免受军阀破坏。",
  },
  {
    id: 6,
    name: "商人",
    short: "每条街道都流通金币",
    color: "green",
    description: "每座绿色城区获得 1 金币，并额外获得 1 金币。",
  },
  {
    id: 7,
    name: "建筑师",
    short: "一夜之间让天际线改变",
    color: "neutral",
    description: "出场时额外抽 2 张牌，本回合最多建造 3 座城区。",
  },
  {
    id: 8,
    name: "军阀",
    short: "城墙也有价格",
    color: "red",
    description: "每座红色城区获得 1 金币；可付费用摧毁一座敌方城区。",
  },
];

const DISTRICT_SPECS: Array<
  Omit<DistrictCard, "uid"> & { count?: number }
> = [
  { name: "庄园", color: "yellow", cost: 3, count: 4 },
  { name: "城堡", color: "yellow", cost: 4, count: 3 },
  { name: "宫殿", color: "yellow", cost: 5, count: 2 },
  { name: "神殿", color: "blue", cost: 1, count: 3 },
  { name: "教堂", color: "blue", cost: 2, count: 3 },
  { name: "大教堂", color: "blue", cost: 5, count: 3 },
  { name: "酒馆", color: "green", cost: 1, count: 3 },
  { name: "市场", color: "green", cost: 2, count: 3 },
  { name: "商站", color: "green", cost: 2, count: 2 },
  { name: "港口", color: "green", cost: 4, count: 3 },
  { name: "市政厅", color: "green", cost: 5, count: 2 },
  { name: "瞭望塔", color: "red", cost: 1, count: 3 },
  { name: "监狱", color: "red", cost: 2, count: 3 },
  { name: "要塞", color: "red", cost: 5, count: 3 },
  {
    name: "天文台",
    color: "purple",
    cost: 3,
    text: "城市里最安静、也最接近星空的地方。",
  },
  {
    name: "图书馆",
    color: "purple",
    cost: 4,
    text: "把每一个秘密都锁进书脊。",
  },
  {
    name: "龙门",
    color: "purple",
    cost: 6,
    text: "昂贵，但足以让旅人记住这座城。",
  },
  {
    name: "魔法学院",
    color: "purple",
    cost: 6,
    text: "没有人能解释塔顶的天气。",
  },
  {
    name: "铸币厂",
    color: "purple",
    cost: 5,
    text: "每一枚金币都从这里开始旅程。",
  },
  {
    name: "大剧院",
    color: "purple",
    cost: 5,
    text: "今夜，所有人都戴着面具。",
  },
  {
    name: "纪念碑",
    color: "purple",
    cost: 4,
    text: "名字会消失，石头不会。",
  },
  {
    name: "藏宝库",
    color: "purple",
    cost: 5,
    text: "守卫只知道门，却不知道钥匙。",
  },
];

const BOT_NAMES = ["铜雀", "夜鸦", "白塔", "银狐", "旧钟"];

function randomId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function roleById(roleId: number | null) {
  return ROLES.find((role) => role.id === roleId) ?? null;
}

export function createDistrictDeck(): DistrictCard[] {
  const cards: DistrictCard[] = [];
  for (const spec of DISTRICT_SPECS) {
    const count = spec.count ?? 1;
    for (let copy = 0; copy < count; copy += 1) {
      cards.push({
        uid: randomId("district"),
        name: spec.name,
        color: spec.color,
        cost: spec.cost,
        text: spec.text,
      });
    }
  }
  return shuffle(cards);
}

function newPlayer(name: string, isBot = false): PlayerState {
  return {
    id: randomId(isBot ? "bot" : "player"),
    token: isBot ? "" : randomId("secret"),
    name: name.trim().slice(0, 16) || "无名旅人",
    isBot,
    gold: 2,
    hand: [],
    city: [],
    roleId: null,
    revealed: false,
    resourceTaken: false,
    pendingDraw: [],
    buildsThisTurn: 0,
    abilityUsed: false,
  };
}

export function createGameState(code: string, hostName: string, botCount = 1) {
  const host = newPlayer(hostName);
  const players = [host];
  const safeBotCount = Math.max(0, Math.min(4, Math.floor(botCount)));
  for (let index = 0; index < safeBotCount; index += 1) {
    players.push(newPlayer(BOT_NAMES[index], true));
  }
  const now = new Date().toISOString();
  const state: GameState = {
    code,
    hostId: host.id,
    status: "lobby",
    round: 0,
    crownPlayerId: host.id,
    draftOrder: [],
    draftIndex: 0,
    availableRoleIds: [],
    currentRole: null,
    players,
    deck: [],
    discard: [],
    assassinatedRole: null,
    robbedRole: null,
    firstCompletedPlayerId: null,
    log: [`${host.name} 建立了房间。`],
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  return { state, host };
}

export function joinGame(state: GameState, name: string) {
  if (state.status !== "lobby") {
    throw new Error("游戏已经开始，不能再加入这局。 ");
  }
  if (state.players.length >= 6) {
    throw new Error("房间已满，最多 6 位玩家。 ");
  }
  const normalized = name.trim().slice(0, 16);
  if (!normalized) throw new Error("请先输入昵称。 ");
  if (state.players.some((player) => player.name === normalized)) {
    throw new Error("这个昵称已经有人使用。 ");
  }
  const player = newPlayer(normalized);
  state.players.push(player);
  addLog(state, `${player.name} 加入了房间。`);
  touch(state);
  return player;
}

function touch(state: GameState) {
  state.version += 1;
  state.updatedAt = new Date().toISOString();
}

function addLog(state: GameState, message: string) {
  state.log.push(message);
  if (state.log.length > 80) state.log = state.log.slice(-80);
}

function drawOne(state: GameState): DistrictCard | null {
  if (state.deck.length === 0 && state.discard.length > 0) {
    state.deck = shuffle(state.discard);
    state.discard = [];
  }
  return state.deck.pop() ?? null;
}

function drawMany(state: GameState, count: number) {
  const cards: DistrictCard[] = [];
  for (let index = 0; index < count; index += 1) {
    const card = drawOne(state);
    if (card) cards.push(card);
  }
  return cards;
}

function orderedFromCrown(state: GameState) {
  const crownIndex = Math.max(
    0,
    state.players.findIndex((player) => player.id === state.crownPlayerId),
  );
  return [
    ...state.players.slice(crownIndex),
    ...state.players.slice(0, crownIndex),
  ].map((player) => player.id);
}

function beginDraft(state: GameState) {
  state.status = "draft";
  state.currentRole = null;
  state.draftOrder = orderedFromCrown(state);
  state.draftIndex = 0;
  state.availableRoleIds = ROLES.map((role) => role.id);
  state.assassinatedRole = null;
  state.robbedRole = null;
  for (const player of state.players) {
    player.roleId = null;
    player.revealed = false;
    player.resourceTaken = false;
    player.pendingDraw = [];
    player.buildsThisTurn = 0;
    player.abilityUsed = false;
  }
  addLog(state, `第 ${state.round} 轮开始，皇冠持有者先选角色。`);
}

export function startGame(state: GameState, playerId: string) {
  if (state.status !== "lobby") throw new Error("这局已经开始了。 ");
  if (state.hostId !== playerId) throw new Error("只有房主可以开始游戏。 ");
  if (state.players.length < 2) throw new Error("至少需要两位玩家。 ");
  state.deck = createDistrictDeck();
  state.discard = [];
  state.round = 1;
  state.firstCompletedPlayerId = null;
  for (const player of state.players) {
    player.gold = 2;
    player.hand = drawMany(state, 4);
    player.city = [];
  }
  beginDraft(state);
  touch(state);
}

export function restartGame(state: GameState, playerId: string) {
  if (state.hostId !== playerId) throw new Error("只有房主可以重新开局。 ");
  if (state.status !== "finished") throw new Error("当前游戏尚未结束。 ");
  state.status = "lobby";
  state.round = 0;
  state.currentRole = null;
  state.deck = [];
  state.discard = [];
  state.firstCompletedPlayerId = null;
  for (const player of state.players) {
    player.gold = 2;
    player.hand = [];
    player.city = [];
    player.roleId = null;
    player.revealed = false;
    player.pendingDraw = [];
  }
  state.log = ["新的一局已经准备好。"];
  touch(state);
}

export function currentPickerId(state: GameState) {
  return state.status === "draft"
    ? (state.draftOrder[state.draftIndex] ?? null)
    : null;
}

export function chooseRole(
  state: GameState,
  playerId: string,
  roleId: number,
) {
  if (state.status !== "draft") throw new Error("现在不是选角阶段。 ");
  if (currentPickerId(state) !== playerId) throw new Error("还没轮到你选角。 ");
  if (!state.availableRoleIds.includes(roleId)) throw new Error("这个角色已经被选走了。 ");
  const player = requirePlayer(state, playerId);
  player.roleId = roleId;
  state.availableRoleIds = state.availableRoleIds.filter((id) => id !== roleId);
  state.draftIndex += 1;
  addLog(state, `${player.name} 已秘密选好角色。`);
  if (state.draftIndex >= state.draftOrder.length) {
    state.status = "turns";
    state.currentRole = 0;
    addLog(state, "角色全部选定，开始依次叫号。 ");
    advanceTurn(state);
  }
  touch(state);
}

function applyRoleOpening(state: GameState, player: PlayerState) {
  const role = roleById(player.roleId);
  if (!role) return;
  const income =
    role.color === "neutral"
      ? 0
      : player.city.filter((district) => district.color === role.color).length;
  if (income > 0) {
    player.gold += income;
    addLog(state, `${player.name} 从城区收入中获得 ${income} 金币。`);
  }
  if (role.id === 4) {
    state.crownPlayerId = player.id;
    addLog(state, `${player.name} 接过了皇冠。`);
  }
  if (role.id === 6) {
    player.gold += 1;
    addLog(state, `${player.name} 因商路畅通额外获得 1 金币。`);
  }
  if (role.id === 7) {
    const cards = drawMany(state, 2);
    player.hand.push(...cards);
    if (cards.length) addLog(state, `${player.name} 额外获得 ${cards.length} 张城区牌。`);
  }
}

function completeRound(state: GameState) {
  if (state.firstCompletedPlayerId) {
    state.status = "finished";
    state.currentRole = null;
    addLog(state, "最后一个角色的回合结束，城市计分开始。 ");
    return;
  }
  state.round += 1;
  beginDraft(state);
}

function advanceTurn(state: GameState) {
  let roleNumber = (state.currentRole ?? 0) + 1;
  while (roleNumber <= 8) {
    const player = state.players.find((candidate) => candidate.roleId === roleNumber);
    state.currentRole = roleNumber;
    if (!player) {
      roleNumber += 1;
      continue;
    }
    const role = roleById(roleNumber)!;
    if (state.assassinatedRole === roleNumber) {
      player.revealed = true;
      addLog(state, `${role.name} 没有回应叫号，本轮被刺杀。`);
      roleNumber += 1;
      continue;
    }
    player.revealed = true;
    player.resourceTaken = false;
    player.pendingDraw = [];
    player.buildsThisTurn = 0;
    player.abilityUsed = false;
    addLog(state, `${player.name} 公开身份：${role.name}。`);
    if (state.robbedRole === roleNumber) {
      const thief = state.players.find((candidate) => candidate.roleId === 2);
      if (thief && thief.id !== player.id) {
        const stolen = player.gold;
        player.gold = 0;
        thief.gold += stolen;
        addLog(state, `盗贼从 ${player.name} 手中夺走 ${stolen} 金币。`);
      }
    }
    applyRoleOpening(state, player);
    return;
  }
  completeRound(state);
}

export function currentPlayerId(state: GameState) {
  if (state.status !== "turns") return null;
  return (
    state.players.find((player) => player.roleId === state.currentRole)?.id ?? null
  );
}

function requirePlayer(state: GameState, playerId: string) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error("玩家不存在。 ");
  return player;
}

function requireActivePlayer(state: GameState, playerId: string) {
  if (state.status !== "turns") throw new Error("现在不是行动阶段。 ");
  if (currentPlayerId(state) !== playerId) throw new Error("现在不是你的回合。 ");
  return requirePlayer(state, playerId);
}

export function takeGold(state: GameState, playerId: string) {
  const player = requireActivePlayer(state, playerId);
  if (player.resourceTaken) throw new Error("本回合已经选择过资源。 ");
  player.gold += 2;
  player.resourceTaken = true;
  addLog(state, `${player.name} 从国库取走 2 金币。`);
  touch(state);
}

export function drawDistrictChoices(state: GameState, playerId: string) {
  const player = requireActivePlayer(state, playerId);
  if (player.resourceTaken) throw new Error("本回合已经选择过资源。 ");
  player.pendingDraw = drawMany(state, 2);
  player.resourceTaken = true;
  if (player.pendingDraw.length === 0) {
    addLog(state, `${player.name} 查看牌库，但已经没有牌了。`);
  }
  touch(state);
}

export function keepDistrictCard(
  state: GameState,
  playerId: string,
  cardUid: string,
) {
  const player = requireActivePlayer(state, playerId);
  const selected = player.pendingDraw.find((card) => card.uid === cardUid);
  if (!selected) throw new Error("请选择刚刚抽到的城区牌。 ");
  const returned = player.pendingDraw.filter((card) => card.uid !== cardUid);
  player.hand.push(selected);
  state.deck.unshift(...returned);
  player.pendingDraw = [];
  addLog(state, `${player.name} 保留了 1 张城区牌。`);
  touch(state);
}

function buildLimit(player: PlayerState) {
  return player.roleId === 7 ? 3 : 1;
}

export function buildDistrict(
  state: GameState,
  playerId: string,
  cardUid: string,
) {
  const player = requireActivePlayer(state, playerId);
  if (!player.resourceTaken) throw new Error("请先选择金币或抽牌。 ");
  if (player.pendingDraw.length) throw new Error("请先从抽到的牌中保留一张。 ");
  if (player.buildsThisTurn >= buildLimit(player)) {
    throw new Error("本回合的建造次数已经用完。 ");
  }
  const card = player.hand.find((candidate) => candidate.uid === cardUid);
  if (!card) throw new Error("这张牌不在你的手牌中。 ");
  if (player.gold < card.cost) throw new Error("金币不足。 ");
  if (player.city.some((district) => district.name === card.name)) {
    throw new Error("你的城市里已经有同名城区。 ");
  }
  player.gold -= card.cost;
  player.hand = player.hand.filter((candidate) => candidate.uid !== cardUid);
  player.city.push(card);
  player.buildsThisTurn += 1;
  addLog(state, `${player.name} 建造了${card.name}。`);
  if (player.city.length >= 7 && !state.firstCompletedPlayerId) {
    state.firstCompletedPlayerId = player.id;
    addLog(state, `${player.name} 首先完成七座城区，本轮结束后结算。`);
  }
  touch(state);
}

export function useRoleAbility(
  state: GameState,
  playerId: string,
  targetRole?: number,
) {
  const player = requireActivePlayer(state, playerId);
  if (player.abilityUsed) throw new Error("本回合已经使用过角色能力。 ");
  if (player.roleId === 1) {
    if (!targetRole || targetRole <= 1 || targetRole > 8) {
      throw new Error("请选择 2 至 8 号角色。 ");
    }
    state.assassinatedRole = targetRole;
    addLog(state, `刺客悄悄点名了 ${targetRole} 号角色。`);
  } else if (player.roleId === 2) {
    if (!targetRole || targetRole <= 2 || targetRole > 8) {
      throw new Error("请选择 3 至 8 号角色。 ");
    }
    if (state.assassinatedRole === targetRole) {
      throw new Error("不能偷窃被刺客点名的角色。 ");
    }
    state.robbedRole = targetRole;
    addLog(state, `盗贼盯上了 ${targetRole} 号角色。`);
  } else if (player.roleId === 3) {
    const count = player.hand.length;
    state.discard.push(...player.hand);
    player.hand = drawMany(state, count);
    addLog(state, `${player.name} 用魔术换掉 ${count} 张手牌。`);
  } else {
    throw new Error("这个角色的能力会自动生效。 ");
  }
  player.abilityUsed = true;
  touch(state);
}

export function destroyDistrict(
  state: GameState,
  playerId: string,
  targetPlayerId: string,
  districtUid: string,
) {
  const player = requireActivePlayer(state, playerId);
  if (player.roleId !== 8) throw new Error("只有军阀可以破坏城区。 ");
  if (player.abilityUsed) throw new Error("本回合已经使用过角色能力。 ");
  const target = requirePlayer(state, targetPlayerId);
  if (target.id === player.id) throw new Error("不能破坏自己的城区。 ");
  if (target.roleId === 5) throw new Error("主教庇护着这座城市。 ");
  if (target.city.length >= 7) throw new Error("已经完成的城市不能被破坏。 ");
  const district = target.city.find((candidate) => candidate.uid === districtUid);
  if (!district) throw new Error("找不到这座城区。 ");
  const price = Math.max(0, district.cost - 1);
  if (player.gold < price) throw new Error("支付破坏费用所需的金币不足。 ");
  player.gold -= price;
  target.city = target.city.filter((candidate) => candidate.uid !== districtUid);
  state.discard.push(district);
  player.abilityUsed = true;
  addLog(state, `${player.name} 摧毁了 ${target.name} 的${district.name}。`);
  touch(state);
}

export function endTurn(state: GameState, playerId: string) {
  const player = requireActivePlayer(state, playerId);
  if (!player.resourceTaken) throw new Error("结束回合前必须选择一种资源。 ");
  if (player.pendingDraw.length) throw new Error("请先保留一张抽到的城区牌。 ");
  addLog(state, `${player.name} 结束回合。`);
  advanceTurn(state);
  touch(state);
}

function chooseBotTargetRole(state: GameState, minimum: number) {
  const candidates = ROLES.map((role) => role.id).filter(
    (id) => id >= minimum && id !== state.assassinatedRole,
  );
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function botTurn(state: GameState, bot: PlayerState) {
  if (bot.roleId === 1 && !bot.abilityUsed) {
    useRoleAbility(state, bot.id, chooseBotTargetRole(state, 2));
  }
  if (bot.roleId === 2 && !bot.abilityUsed) {
    useRoleAbility(state, bot.id, chooseBotTargetRole(state, 3));
  }
  if (bot.roleId === 3 && !bot.abilityUsed && bot.hand.length >= 3) {
    useRoleAbility(state, bot.id);
  }

  const affordable = bot.hand.some(
    (card) =>
      card.cost <= bot.gold &&
      !bot.city.some((district) => district.name === card.name),
  );
  if (!bot.resourceTaken) {
    if (affordable || bot.gold < 3) takeGold(state, bot.id);
    else drawDistrictChoices(state, bot.id);
  }
  if (bot.pendingDraw.length) {
    const choice = [...bot.pendingDraw].sort((a, b) => a.cost - b.cost)[0];
    keepDistrictCard(state, bot.id, choice.uid);
  }

  while (bot.buildsThisTurn < buildLimit(bot)) {
    const card = [...bot.hand]
      .filter(
        (candidate) =>
          candidate.cost <= bot.gold &&
          !bot.city.some((district) => district.name === candidate.name),
      )
      .sort((a, b) => b.cost - a.cost)[0];
    if (!card) break;
    buildDistrict(state, bot.id, card.uid);
  }
  endTurn(state, bot.id);
}

export function processBots(state: GameState) {
  let guard = 0;
  while (guard < 40) {
    guard += 1;
    if (state.status === "draft") {
      const picker = state.players.find((player) => player.id === currentPickerId(state));
      if (!picker?.isBot) break;
      const role =
        state.availableRoleIds[
          Math.floor(Math.random() * state.availableRoleIds.length)
        ];
      chooseRole(state, picker.id, role);
      continue;
    }
    if (state.status === "turns") {
      const active = state.players.find((player) => player.id === currentPlayerId(state));
      if (!active?.isBot) break;
      botTurn(state, active);
      continue;
    }
    break;
  }
  touch(state);
}

export function playerScore(state: GameState, player: PlayerState) {
  const base = player.city.reduce((sum, district) => sum + district.cost, 0);
  const colors = new Set(player.city.map((district) => district.color));
  const variety = colors.size === 5 ? 3 : 0;
  const completion =
    player.city.length >= 7
      ? state.firstCompletedPlayerId === player.id
        ? 4
        : 2
      : 0;
  return base + variety + completion;
}

export function publicGameView(state: GameState, viewerId: string) {
  const viewer = requirePlayer(state, viewerId);
  const picker = currentPickerId(state);
  const active = currentPlayerId(state);
  return {
    code: state.code,
    status: state.status,
    round: state.round,
    hostId: state.hostId,
    crownPlayerId: state.crownPlayerId,
    currentPickerId: picker,
    currentPlayerId: active,
    currentRole: state.currentRole,
    firstCompletedPlayerId: state.firstCompletedPlayerId,
    availableRoleIds: picker === viewerId ? state.availableRoleIds : [],
    roles: ROLES,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      isBot: player.isBot,
      gold: player.gold,
      handCount: player.hand.length,
      hand: player.id === viewerId ? player.hand : [],
      city: player.city,
      roleId:
        player.id === viewerId || player.revealed || state.status === "finished"
          ? player.roleId
          : null,
      revealed: player.revealed,
      resourceTaken: player.id === viewerId ? player.resourceTaken : false,
      pendingDraw: player.id === viewerId ? player.pendingDraw : [],
      buildsThisTurn: player.id === viewerId ? player.buildsThisTurn : 0,
      abilityUsed: player.id === viewerId ? player.abilityUsed : false,
      score: playerScore(state, player),
    })),
    log: state.log.slice(-24),
    version: state.version,
    viewerId: viewer.id,
  };
}

