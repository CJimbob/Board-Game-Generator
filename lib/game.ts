import {
  BASIC_DISTRICTS,
  ROLES,
  UNIQUE_DISTRICTS,
  castForRuleset,
  getRole,
  getRuleset,
  type DistrictColor,
  type DistrictDefinition,
  type RoleDefinition,
} from "./rules.ts";

export type { DistrictColor, RoleDefinition } from "./rules.ts";

export type GameStatus = "lobby" | "draft" | "theater" | "turns" | "finished";

export type DistrictCard = DistrictDefinition & {
  uid: string;
  beautified?: boolean;
  storedCards?: DistrictCard[];
};

export type PendingChoice =
  | { type: "blackmail"; actorId: string; blackmailerId: string; signed: boolean }
  | { type: "wizard"; actorId: string; targetPlayerId: string }
  | { type: "seer"; actorId: string; remainingPlayerIds: string[] };

export type PlayerState = {
  id: string;
  token: string;
  name: string;
  isBot: boolean;
  gold: number;
  hand: DistrictCard[];
  city: DistrictCard[];
  roleKeys: string[];
  revealedRoleKeys: string[];
  resourceTaken: boolean;
  pendingDraw: DistrictCard[];
  pendingDrawMode: "resource" | "scholar" | null;
  buildsThisTurn: number;
  abilityUsed: boolean;
  abilityCount: number;
  incomeTaken: boolean;
  districtAbilitiesUsed: string[];
  goldSpentBuilding: number;
};

export type GameState = {
  code: string;
  hostId: string;
  rulesetKey: string;
  includeRankNine: boolean;
  status: GameStatus;
  round: number;
  crownPlayerId: string;
  cast: RoleDefinition[];
  draftOrder: string[];
  draftIndex: number;
  availableRoleKeys: string[];
  faceupDiscardedRoleKeys: string[];
  facedownRoleKey: string | null;
  theaterPlayerId: string | null;
  currentRank: number | null;
  currentRoleKey: string | null;
  activePlayerId: string | null;
  players: PlayerState[];
  deck: DistrictCard[];
  discard: DistrictCard[];
  assassinatedRoleKey: string | null;
  robbedRoleKey: string | null;
  bewitchedRoleKey: string | null;
  witchPlayerId: string | null;
  witchResuming: boolean;
  warrants: Record<string, boolean>;
  warrantResolved: boolean;
  threats: Record<string, boolean>;
  blackmailerPlayerId: string | null;
  pendingChoice: PendingChoice | null;
  taxPool: number;
  firstCompletedPlayerId: string | null;
  privateNotes: Record<string, string[]>;
  log: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AbilityPayload = {
  mode?: string;
  targetRoleKey?: string;
  targetPlayerId?: string;
  districtColor?: DistrictColor;
  cardUid?: string;
  cardUids?: string[];
  targetDistrictUid?: string;
  ownDistrictUid?: string;
  amountCards?: number;
};

export type BuildOptions = {
  mode?: "normal" | "framework" | "necropolis";
  sacrificeUid?: string;
  paymentCardUids?: string[];
};

const BOT_NAMES = ["铜雀", "夜鸦", "白塔", "银狐", "旧钟", "青鹿", "赤鸢"];

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

function removeRandom<T>(items: T[]) {
  if (!items.length) return null;
  return items.splice(Math.floor(Math.random() * items.length), 1)[0] ?? null;
}

function touch(state: GameState) {
  state.version += 1;
  state.updatedAt = new Date().toISOString();
}

function addLog(state: GameState, message: string) {
  state.log.push(message);
  if (state.log.length > 120) state.log = state.log.slice(-120);
}

function addPrivateNote(state: GameState, playerId: string, message: string) {
  state.privateNotes[playerId] ??= [];
  state.privateNotes[playerId].push(message);
  state.privateNotes[playerId] = state.privateNotes[playerId].slice(-8);
}

function makeCard(spec: DistrictDefinition): DistrictCard {
  return { ...spec, uid: randomId("district") };
}

export function createDistrictDeck(rulesetKey = "first_game"): DistrictCard[] {
  const ruleset = getRuleset(rulesetKey);
  const cards = BASIC_DISTRICTS.flatMap((spec) =>
    Array.from({ length: spec.count ?? 1 }, () => makeCard(spec)),
  );
  for (const key of ruleset.uniqueKeys) {
    const spec = UNIQUE_DISTRICTS.find((district) => district.key === key);
    if (spec) cards.push(makeCard(spec));
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
    roleKeys: [],
    revealedRoleKeys: [],
    resourceTaken: false,
    pendingDraw: [],
    pendingDrawMode: null,
    buildsThisTurn: 0,
    abilityUsed: false,
    abilityCount: 0,
    incomeTaken: false,
    districtAbilitiesUsed: [],
    goldSpentBuilding: 0,
  };
}

export function createGameState(
  code: string,
  hostName: string,
  botCount = 1,
  rulesetKey = "first_game",
  includeRankNine = false,
) {
  const host = newPlayer(hostName);
  const players = [host];
  const safeBotCount = Math.max(0, Math.min(7, Math.floor(botCount)));
  for (let index = 0; index < safeBotCount; index += 1) {
    players.push(newPlayer(BOT_NAMES[index], true));
  }
  const now = new Date().toISOString();
  const state: GameState = {
    code,
    hostId: host.id,
    rulesetKey: getRuleset(rulesetKey).key,
    includeRankNine,
    status: "lobby",
    round: 0,
    crownPlayerId: host.id,
    cast: [],
    draftOrder: [],
    draftIndex: 0,
    availableRoleKeys: [],
    faceupDiscardedRoleKeys: [],
    facedownRoleKey: null,
    theaterPlayerId: null,
    currentRank: null,
    currentRoleKey: null,
    activePlayerId: null,
    players,
    deck: [],
    discard: [],
    assassinatedRoleKey: null,
    robbedRoleKey: null,
    bewitchedRoleKey: null,
    witchPlayerId: null,
    witchResuming: false,
    warrants: {},
    warrantResolved: false,
    threats: {},
    blackmailerPlayerId: null,
    pendingChoice: null,
    taxPool: 0,
    firstCompletedPlayerId: null,
    privateNotes: {},
    log: [`${host.name} 建立了房间，规则套组为“${getRuleset(rulesetKey).name}”。`],
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  return { state, host };
}

export function joinGame(state: GameState, name: string) {
  if (state.status !== "lobby") throw new Error("游戏已经开始，不能再加入这局。 ");
  if (state.players.length >= 8) throw new Error("房间已满，最多 8 位玩家。 ");
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

function requirePlayer(state: GameState, playerId: string) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error("玩家不存在。 ");
  return player;
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

function resetTurn(player: PlayerState) {
  player.resourceTaken = false;
  player.pendingDraw = [];
  player.pendingDrawMode = null;
  player.buildsThisTurn = 0;
  player.abilityUsed = false;
  player.abilityCount = 0;
  player.incomeTaken = false;
  player.districtAbilitiesUsed = [];
  player.goldSpentBuilding = 0;
}

function beginDraft(state: GameState) {
  state.status = "draft";
  state.currentRank = null;
  state.currentRoleKey = null;
  state.activePlayerId = null;
  state.theaterPlayerId = null;
  state.assassinatedRoleKey = null;
  state.robbedRoleKey = null;
  state.bewitchedRoleKey = null;
  state.witchPlayerId = null;
  state.witchResuming = false;
  state.warrants = {};
  state.warrantResolved = false;
  state.threats = {};
  state.blackmailerPlayerId = null;
  state.pendingChoice = null;
  state.privateNotes = {};
  state.faceupDiscardedRoleKeys = [];
  state.facedownRoleKey = null;
  state.draftIndex = 0;
  const order = orderedFromCrown(state);
  const pool = shuffle(state.cast.map((role) => role.key));
  const playerCount = state.players.length;

  for (const player of state.players) {
    player.roleKeys = [];
    player.revealedRoleKeys = [];
    resetTurn(player);
  }

  if (playerCount === 2) {
    state.facedownRoleKey = removeRandom(pool);
    state.draftOrder = [order[0], order[1], order[0], order[1]];
  } else if (playerCount === 3) {
    state.facedownRoleKey = removeRandom(pool);
    state.draftOrder = [...order, ...order];
  } else {
    const nineCharacters = state.cast.length === 9;
    const faceupCount = nineCharacters
      ? ({ 4: 3, 5: 2, 6: 1, 7: 0, 8: 0 }[playerCount] ?? 0)
      : ({ 4: 2, 5: 1, 6: 0, 7: 0 }[playerCount] ?? 0);
    for (let index = 0; index < faceupCount; index += 1) {
      const eligible = pool.filter((key) => getRole(key)?.rank !== 4);
      const discarded = eligible[Math.floor(Math.random() * eligible.length)];
      pool.splice(pool.indexOf(discarded), 1);
      state.faceupDiscardedRoleKeys.push(discarded);
    }
    state.facedownRoleKey = removeRandom(pool);
    state.draftOrder = order;
  }
  state.availableRoleKeys = pool;
  addLog(state, `第 ${state.round} 轮开始，皇冠持有者先秘密选角。`);
}

export function startGame(state: GameState, playerId: string) {
  if (state.status !== "lobby") throw new Error("这局已经开始了。 ");
  if (state.hostId !== playerId) throw new Error("只有房主可以开始游戏。 ");
  if (state.players.length < 2) throw new Error("至少需要两位玩家。 ");
  state.cast = castForRuleset(state.rulesetKey, state.players.length, state.includeRankNine);
  state.deck = createDistrictDeck(state.rulesetKey);
  state.discard = [];
  state.round = 1;
  state.taxPool = 0;
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
  state.cast = [];
  state.deck = [];
  state.discard = [];
  state.currentRank = null;
  state.currentRoleKey = null;
  state.activePlayerId = null;
  state.firstCompletedPlayerId = null;
  state.taxPool = 0;
  for (const player of state.players) {
    player.gold = 2;
    player.hand = [];
    player.city = [];
    player.roleKeys = [];
    player.revealedRoleKeys = [];
    resetTurn(player);
  }
  state.log = ["新的一局已经准备好。"];
  touch(state);
}

export function currentPickerId(state: GameState) {
  if (state.status === "theater") return state.theaterPlayerId;
  return state.status === "draft" ? (state.draftOrder[state.draftIndex] ?? null) : null;
}

function availableForPicker(state: GameState) {
  const isLast = state.draftIndex === state.draftOrder.length - 1;
  const specialLast = state.players.length >= 7 && isLast && state.facedownRoleKey;
  return specialLast
    ? [...state.availableRoleKeys, state.facedownRoleKey!]
    : state.availableRoleKeys;
}

function beginTurns(state: GameState) {
  state.status = "turns";
  state.currentRank = 0;
  state.currentRoleKey = null;
  state.activePlayerId = null;
  addLog(state, "角色全部选定，开始按编号叫号。 ");
  advanceTurn(state);
}

function finishDraft(state: GameState) {
  state.availableRoleKeys = [];
  const theaterOwner = state.players.find((player) =>
    player.city.some((district) => district.key === "theater"),
  );
  if (theaterOwner) {
    state.status = "theater";
    state.theaterPlayerId = theaterOwner.id;
    addLog(state, "剧院主人正在考虑是否秘密交换角色。 ");
  } else {
    beginTurns(state);
  }
}

export function chooseRole(state: GameState, playerId: string, roleKeyOrRank: string | number) {
  if (state.status !== "draft") throw new Error("现在不是选角阶段。 ");
  if (currentPickerId(state) !== playerId) throw new Error("还没轮到你选角。 ");
  const roleKey = typeof roleKeyOrRank === "number"
    ? availableForPicker(state).find((key) => getRole(key)?.rank === roleKeyOrRank)
    : roleKeyOrRank;
  if (!roleKey || !availableForPicker(state).includes(roleKey)) {
    throw new Error("这个角色不可选或已经被选走了。 ");
  }
  const player = requirePlayer(state, playerId);
  player.roleKeys.push(roleKey);

  if (roleKey === state.facedownRoleKey) {
    const remaining = state.availableRoleKeys[0];
    if (remaining) state.facedownRoleKey = remaining;
    state.availableRoleKeys = [];
  } else {
    state.availableRoleKeys = state.availableRoleKeys.filter((key) => key !== roleKey);
  }

  const pickedAt = state.draftIndex;
  state.draftIndex += 1;
  addLog(state, `${player.name} 已秘密选好角色。`);

  if (state.players.length === 2 && pickedAt >= 1) {
    removeRandom(state.availableRoleKeys);
  }
  if (state.players.length === 3 && pickedAt === 2) {
    removeRandom(state.availableRoleKeys);
  }

  if (state.draftIndex >= state.draftOrder.length) {
    state.availableRoleKeys = [];
    finishDraft(state);
  }
  touch(state);
}

export function resolveTheater(
  state: GameState,
  playerId: string,
  targetPlayerId?: string,
  ownRoleKey?: string,
) {
  if (state.status !== "theater" || state.theaterPlayerId !== playerId) {
    throw new Error("现在不能使用剧院。 ");
  }
  const owner = requirePlayer(state, playerId);
  if (targetPlayerId) {
    const target = requirePlayer(state, targetPlayerId);
    if (target.id === owner.id) throw new Error("请选择另一名玩家。 ");
    const giving = owner.roleKeys.includes(ownRoleKey ?? "")
      ? ownRoleKey!
      : owner.roleKeys[0];
    const receiving = target.roleKeys[Math.floor(Math.random() * target.roleKeys.length)];
    owner.roleKeys = owner.roleKeys.map((key) => (key === giving ? receiving : key));
    target.roleKeys = target.roleKeys.map((key) => (key === receiving ? giving : key));
    addPrivateNote(state, owner.id, `剧院交换后，你得到：${getRole(receiving)?.name}。`);
    addPrivateNote(state, target.id, `剧院交换后，你得到：${getRole(giving)?.name}。`);
    addLog(state, `${owner.name} 借剧院与一名玩家秘密交换了角色。`);
  } else {
    addLog(state, `${owner.name} 放弃了剧院的角色交换。`);
  }
  state.theaterPlayerId = null;
  beginTurns(state);
  touch(state);
}

function citySize(player: PlayerState) {
  return player.city.reduce((sum, district) => sum + (district.key === "monument" ? 2 : 1), 0);
}

function completionTarget(state: GameState) {
  return state.players.length <= 3 ? 8 : 7;
}

function roleOwner(state: GameState, roleKey: string | null) {
  return roleKey
    ? state.players.find((player) => player.roleKeys.includes(roleKey)) ?? null
    : null;
}

function revealRole(player: PlayerState, roleKey: string) {
  if (!player.revealedRoleKeys.includes(roleKey)) player.revealedRoleKeys.push(roleKey);
}

function applyKilledCrownHeir(state: GameState, role: RoleDefinition, player: PlayerState) {
  if (role.rank !== 4) return;
  if (role.key === "king" || role.key === "patrician") {
    state.crownPlayerId = player.id;
  } else if (role.key === "emperor") {
    const order = orderedFromCrown(state).filter((id) => id !== player.id);
    if (order[0]) state.crownPlayerId = order[0];
  }
}

function completeRound(state: GameState) {
  const killedRole = getRole(state.assassinatedRoleKey);
  const killedOwner = roleOwner(state, state.assassinatedRoleKey);
  if (killedRole && killedOwner) {
    revealRole(killedOwner, killedRole.key);
    applyKilledCrownHeir(state, killedRole, killedOwner);
    addLog(state, `回合结束时揭晓：${killedOwner.name} 的${killedRole.name}本轮遭到刺杀。`);
  }
  if (state.firstCompletedPlayerId) {
    state.status = "finished";
    state.currentRank = null;
    state.currentRoleKey = null;
    state.activePlayerId = null;
    addLog(state, "最后一个角色的回合结束，城市计分开始。 ");
    return;
  }
  state.round += 1;
  beginDraft(state);
}

function startRoleTurn(state: GameState, player: PlayerState, role: RoleDefinition) {
  state.currentRoleKey = role.key;
  state.activePlayerId = player.id;
  state.witchResuming = false;
  resetTurn(player);
  revealRole(player, role.key);
  addLog(state, `${player.name} 公开身份：${role.rank} 号${role.name}。`);

  if (state.robbedRoleKey === role.key) {
    const thief = roleOwner(state, "thief");
    if (thief && thief.id !== player.id) {
      const stolen = player.gold;
      player.gold = 0;
      thief.gold += stolen;
      addLog(state, `盗贼从 ${player.name} 手中夺走 ${stolen} 金币。`);
    }
  }
  if (role.key === "king" || role.key === "patrician") {
    state.crownPlayerId = player.id;
    addLog(state, `${player.name} 接过了皇冠。`);
  }
}

function advanceTurn(state: GameState) {
  const maxRank = Math.max(...state.cast.map((role) => role.rank));
  let rank = (state.currentRank ?? 0) + 1;
  while (rank <= maxRank) {
    const role = state.cast.find((candidate) => candidate.rank === rank);
    state.currentRank = rank;
    if (!role) {
      rank += 1;
      continue;
    }
    state.currentRoleKey = role.key;
    const player = roleOwner(state, role.key);
    if (!player) {
      rank += 1;
      continue;
    }
    if (state.assassinatedRoleKey === role.key) {
      state.activePlayerId = null;
      addLog(state, `${rank} 号角色没有回应叫号。`);
      rank += 1;
      continue;
    }
    startRoleTurn(state, player, role);
    return;
  }
  completeRound(state);
}

export function currentPlayerId(state: GameState) {
  return state.status === "turns" ? state.activePlayerId : null;
}

function requireActivePlayer(state: GameState, playerId: string, allowPending = false) {
  if (state.status !== "turns") throw new Error("现在不是行动阶段。 ");
  if (state.activePlayerId !== playerId) throw new Error("现在不是你的回合。 ");
  if (!allowPending && state.pendingChoice) throw new Error("请先完成当前选择。 ");
  return requirePlayer(state, playerId);
}

function activeRole(state: GameState) {
  return getRole(state.currentRoleKey);
}

function hasDistrict(player: PlayerState, key: string) {
  return player.city.some((district) => district.key === key);
}

function resourceResolved(state: GameState, player: PlayerState) {
  if (!player.resourceTaken || player.pendingDraw.length) return;
  if (state.bewitchedRoleKey === state.currentRoleKey && !state.witchResuming) {
    const witch = state.witchPlayerId ? requirePlayer(state, state.witchPlayerId) : null;
    if (witch) {
      state.activePlayerId = witch.id;
      state.witchResuming = true;
      witch.resourceTaken = true;
      witch.pendingDraw = [];
      witch.pendingDrawMode = null;
      witch.abilityUsed = false;
      witch.abilityCount = 0;
      witch.incomeTaken = false;
      witch.districtAbilitiesUsed = [];
      addLog(state, `${player.name} 只取得资源；女巫随后借用${activeRole(state)?.name}的能力继续行动。`);
      return;
    }
  }
  const threat = state.currentRoleKey ? state.threats[state.currentRoleKey] : undefined;
  if (threat !== undefined && state.blackmailerPlayerId) {
    state.pendingChoice = {
      type: "blackmail",
      actorId: player.id,
      blackmailerId: state.blackmailerPlayerId,
      signed: threat,
    };
  }
}

export function takeGold(state: GameState, playerId: string) {
  const player = requireActivePlayer(state, playerId);
  if (player.resourceTaken) throw new Error("本回合已经选择过资源。 ");
  const amount = hasDistrict(player, "gold_mine") ? 3 : 2;
  player.gold += amount;
  player.resourceTaken = true;
  addLog(state, `${player.name} 从国库取走 ${amount} 金币。`);
  resourceResolved(state, player);
  touch(state);
}

export function drawDistrictChoices(state: GameState, playerId: string) {
  const player = requireActivePlayer(state, playerId);
  if (player.resourceTaken) throw new Error("本回合已经选择过资源。 ");
  const count = hasDistrict(player, "observatory") ? 3 : 2;
  const cards = drawMany(state, count);
  player.resourceTaken = true;
  if (hasDistrict(player, "library")) {
    player.hand.push(...cards);
    addLog(state, `${player.name} 借图书馆保留了抽到的 ${cards.length} 张牌。`);
    resourceResolved(state, player);
  } else {
    player.pendingDraw = cards;
    player.pendingDrawMode = "resource";
    if (!cards.length) resourceResolved(state, player);
  }
  touch(state);
}

export function keepDistrictCard(state: GameState, playerId: string, cardUid: string) {
  const player = requireActivePlayer(state, playerId);
  const selected = player.pendingDraw.find((card) => card.uid === cardUid);
  if (!selected) throw new Error("请选择刚刚抽到的城区牌。 ");
  const returned = player.pendingDraw.filter((card) => card.uid !== cardUid);
  player.hand.push(selected);
  if (player.pendingDrawMode === "scholar") {
    state.deck = shuffle([...state.deck, ...returned]);
  } else {
    state.deck.unshift(...returned);
  }
  player.pendingDraw = [];
  player.pendingDrawMode = null;
  addLog(state, `${player.name} 保留了 1 张城区牌。`);
  resourceResolved(state, player);
  touch(state);
}

export function resolveBlackmail(state: GameState, playerId: string, bribe: boolean) {
  const choice = state.pendingChoice;
  if (!choice || choice.type !== "blackmail" || choice.actorId !== playerId) {
    throw new Error("当前没有需要处理的勒索。 ");
  }
  const player = requireActivePlayer(state, playerId, true);
  const blackmailer = requirePlayer(state, choice.blackmailerId);
  if (bribe) {
    const payment = Math.floor(player.gold / 2);
    player.gold -= payment;
    blackmailer.gold += payment;
    addLog(state, `${player.name} 交出 ${payment} 金币，消除了未揭晓的威胁。`);
  } else if (choice.signed) {
    const payment = player.gold;
    player.gold = 0;
    blackmailer.gold += payment;
    addLog(state, `勒索者揭开真威胁，从 ${player.name} 处拿走 ${payment} 金币。`);
  } else {
    addLog(state, `${player.name} 拒绝交钱；被揭开的只是虚张声势。`);
  }
  if (state.currentRoleKey) delete state.threats[state.currentRoleKey];
  state.pendingChoice = null;
  touch(state);
}

function countIncomeDistricts(player: PlayerState, color: DistrictColor) {
  return player.city.filter((district) => district.color === color).length +
    (hasDistrict(player, "school_of_magic") ? 1 : 0);
}

export function takeRoleIncome(state: GameState, playerId: string) {
  const player = requireActivePlayer(state, playerId);
  if (player.incomeTaken) throw new Error("本回合已经取得过角色城区收入。 ");
  const role = activeRole(state);
  if (!role) throw new Error("没有有效角色。 ");
  const definitions: Record<string, { color: DistrictColor; cards?: boolean; bonus?: number }> = {
    king: { color: "yellow" },
    patrician: { color: "yellow", cards: true },
    bishop: { color: "blue" },
    cardinal: { color: "blue", cards: true },
    merchant: { color: "green", bonus: 1 },
    trader: { color: "green" },
    warlord: { color: "red" },
    diplomat: { color: "red" },
    marshal: { color: "red" },
  };
  const income = definitions[role.key];
  if (!income) throw new Error("这个角色没有按城区取得资源的能力。 ");
  const amount = countIncomeDistricts(player, income.color);
  if (income.cards) player.hand.push(...drawMany(state, amount));
  else player.gold += amount + (income.bonus ?? 0);
  player.incomeTaken = true;
  addLog(
    state,
    `${player.name} 取得角色收入：${amount + (income.bonus ?? 0)} ${income.cards ? "张牌" : "金币"}。`,
  );
  touch(state);
}

function validateTargetRole(state: GameState, key: string | undefined, minimumRank = 2) {
  const role = state.cast.find((candidate) => candidate.key === key);
  if (!role || role.rank < minimumRank) throw new Error("请选择有效的目标角色。 ");
  return role;
}

function randomOtherRole(state: GameState, excludedKeys: string[]) {
  const candidates = state.cast.filter((role) => !excludedKeys.includes(role.key));
  return candidates[Math.floor(Math.random() * candidates.length)]?.key;
}

function exchangeWholeHands(first: PlayerState, second: PlayerState) {
  [first.hand, second.hand] = [second.hand, first.hand];
}

function resolveWizardChoice(state: GameState, player: PlayerState, payload: AbilityPayload) {
  const choice = state.pendingChoice;
  if (!choice || choice.type !== "wizard" || choice.actorId !== player.id) return false;
  const target = requirePlayer(state, choice.targetPlayerId);
  const card = target.hand.find((candidate) => candidate.uid === payload.cardUid);
  if (!card) throw new Error("这张牌已不在目标手中。 ");
  target.hand = target.hand.filter((candidate) => candidate.uid !== card.uid);
  if (payload.mode === "build") {
    const price = effectiveBuildCost(player, card);
    if (player.gold < price) throw new Error("金币不足，无法立即建造。 ");
    player.gold -= price;
    player.goldSpentBuilding += price;
    commitBuild(state, player, card, { paid: true, paidAmount: price, countsLimit: false });
  } else {
    player.hand.push(card);
    addLog(state, `${player.name} 从一名玩家手中取走了一张城区牌。`);
  }
  player.abilityUsed = true;
  state.pendingChoice = null;
  return true;
}

function resolveSeerReturn(state: GameState, player: PlayerState, payload: AbilityPayload) {
  const choice = state.pendingChoice;
  if (!choice || choice.type !== "seer" || choice.actorId !== player.id) return false;
  const targetId = choice.remainingPlayerIds[0];
  const target = requirePlayer(state, targetId);
  const card = player.hand.find((candidate) => candidate.uid === payload.cardUid);
  if (!card) throw new Error("请选择一张要归还的手牌。 ");
  player.hand = player.hand.filter((candidate) => candidate.uid !== card.uid);
  target.hand.push(card);
  choice.remainingPlayerIds.shift();
  if (!choice.remainingPlayerIds.length) {
    state.pendingChoice = null;
    addLog(state, `${player.name} 完成了先知的手牌交换。`);
  }
  return true;
}

function eligibleAbilityTargetPlayers(state: GameState, player: PlayerState) {
  return state.players.filter((candidate) => candidate.id !== player.id);
}

export function activateRoleAbility(state: GameState, playerId: string, payload: AbilityPayload | number = {}) {
  const normalized: AbilityPayload = typeof payload === "number" ? { targetRoleKey: state.cast.find((role) => role.rank === payload)?.key } : payload;
  const player = requireActivePlayer(state, playerId, true);
  if (resolveWizardChoice(state, player, normalized) || resolveSeerReturn(state, player, normalized)) {
    touch(state);
    return;
  }
  if (state.pendingChoice) throw new Error("请先完成当前选择。 ");
  if (player.abilityUsed) throw new Error("本回合已经使用过角色能力。 ");
  const role = activeRole(state);
  if (!role) throw new Error("当前角色无效。 ");
  const targetPlayers = eligibleAbilityTargetPlayers(state, player);

  switch (role.key) {
    case "assassin": {
      const target = validateTargetRole(state, normalized.targetRoleKey, 2);
      state.assassinatedRoleKey = target.key;
      addLog(state, `刺客悄悄点名了 ${target.rank} 号角色。`);
      player.abilityUsed = true;
      break;
    }
    case "witch": {
      if (!player.resourceTaken || player.pendingDraw.length) throw new Error("女巫必须先取得资源。 ");
      const target = validateTargetRole(state, normalized.targetRoleKey, 2);
      state.bewitchedRoleKey = target.key;
      state.witchPlayerId = player.id;
      player.abilityUsed = true;
      state.activePlayerId = null;
      addLog(state, `女巫施法后暂停回合，等待 ${target.rank} 号角色。`);
      advanceTurn(state);
      break;
    }
    case "magistrate": {
      const target = validateTargetRole(state, normalized.targetRoleKey, 2);
      state.warrants = { [target.key]: true };
      const decoys = shuffle(state.cast.filter((candidate) => candidate.rank > 1 && candidate.key !== target.key)).slice(0, 2);
      for (const decoy of decoys) state.warrants[decoy.key] = false;
      player.abilityUsed = true;
      addLog(state, "执法官把三张拘票秘密放到角色标记旁。 ");
      break;
    }
    case "thief": {
      const target = validateTargetRole(state, normalized.targetRoleKey, 2);
      if (target.key === state.assassinatedRoleKey || target.key === state.bewitchedRoleKey) {
        throw new Error("不能偷窃被刺杀或被魅惑的角色。 ");
      }
      state.robbedRoleKey = target.key;
      player.abilityUsed = true;
      addLog(state, `盗贼盯上了 ${target.rank} 号角色。`);
      break;
    }
    case "spy": {
      const target = requirePlayer(state, normalized.targetPlayerId ?? "");
      if (target.id === player.id) throw new Error("请选择另一名玩家。 ");
      const color = normalized.districtColor;
      if (!color) throw new Error("请选择一种城区类型。 ");
      const matches = target.hand.filter((card) => card.color === color);
      const stolen = Math.min(matches.length, target.gold);
      target.gold -= stolen;
      player.gold += stolen;
      player.hand.push(...drawMany(state, matches.length));
      addPrivateNote(state, player.id, `你查看了 ${target.name} 的手牌：${target.hand.map((card) => card.name).join("、") || "空手"}。`);
      addLog(state, `${player.name} 的间谍行动获得 ${stolen} 金币与 ${matches.length} 张牌。`);
      player.abilityUsed = true;
      break;
    }
    case "blackmailer": {
      const target = validateTargetRole(state, normalized.targetRoleKey, 2);
      const forbidden = [state.assassinatedRoleKey, state.bewitchedRoleKey].filter(Boolean);
      if (forbidden.includes(target.key)) throw new Error("不能威胁被刺杀或被魅惑的角色。 ");
      const decoy = randomOtherRole(state, [role.key, target.key, ...forbidden] as string[]);
      state.threats = { [target.key]: true };
      if (decoy) state.threats[decoy] = false;
      state.blackmailerPlayerId = player.id;
      player.abilityUsed = true;
      addLog(state, "勒索者秘密放下了两枚威胁标记。 ");
      break;
    }
    case "magician": {
      if (normalized.mode === "swap") {
        const target = requirePlayer(state, normalized.targetPlayerId ?? "");
        if (target.id === player.id) throw new Error("请选择另一名玩家。 ");
        exchangeWholeHands(player, target);
        addLog(state, `${player.name} 与一名玩家交换了整手牌。`);
      } else {
        const selected = player.hand.filter((card) => (normalized.cardUids ?? []).includes(card.uid));
        if (!selected.length) throw new Error("请至少选择一张要更换的牌。 ");
        player.hand = player.hand.filter((card) => !selected.some((picked) => picked.uid === card.uid));
        state.discard.push(...selected);
        player.hand.push(...drawMany(state, selected.length));
        addLog(state, `${player.name} 用魔术换掉 ${selected.length} 张手牌。`);
      }
      player.abilityUsed = true;
      break;
    }
    case "wizard": {
      const target = requirePlayer(state, normalized.targetPlayerId ?? "");
      if (target.id === player.id) throw new Error("请选择另一名玩家。 ");
      if (!target.hand.length) throw new Error("这名玩家没有手牌。 ");
      state.pendingChoice = { type: "wizard", actorId: player.id, targetPlayerId: target.id };
      addPrivateNote(state, player.id, `你查看了 ${target.name} 的手牌。`);
      break;
    }
    case "seer": {
      const affected: string[] = [];
      for (const target of targetPlayers) {
        const card = removeRandom(target.hand);
        if (card) {
          player.hand.push(card);
          affected.push(target.id);
        }
      }
      player.abilityUsed = true;
      if (affected.length) state.pendingChoice = { type: "seer", actorId: player.id, remainingPlayerIds: affected };
      addLog(state, `${player.name} 从 ${affected.length} 名玩家手中各拿走一张牌。`);
      break;
    }
    case "emperor": {
      const target = requirePlayer(state, normalized.targetPlayerId ?? "");
      if (target.id === player.id) throw new Error("皇冠必须交给另一名玩家。 ");
      state.crownPlayerId = target.id;
      if (normalized.mode === "card" && target.hand.length) {
        const card = removeRandom(target.hand)!;
        player.hand.push(card);
      } else if (target.gold > 0) {
        target.gold -= 1;
        player.gold += 1;
      }
      player.abilityUsed = true;
      addLog(state, `${player.name} 把皇冠交给 ${target.name}，并索取一份资源。`);
      break;
    }
    case "abbot": {
      const count = countIncomeDistricts(player, "blue");
      const cards = Math.max(0, Math.min(count, Math.floor(normalized.amountCards ?? 0)));
      player.hand.push(...drawMany(state, cards));
      player.gold += count - cards;
      const richest = [...targetPlayers].sort((a, b) => b.gold - a.gold)[0];
      if (richest && richest.gold > player.gold && richest.gold > 0) {
        richest.gold -= 1;
        player.gold += 1;
      }
      player.abilityUsed = true;
      addLog(state, `${player.name} 以修道院长能力取得 ${cards} 张牌与 ${count - cards} 金币。`);
      break;
    }
    case "architect": {
      const cards = drawMany(state, 2);
      player.hand.push(...cards);
      player.abilityUsed = true;
      addLog(state, `${player.name} 以建筑师能力额外抽了 ${cards.length} 张牌。`);
      break;
    }
    case "navigator": {
      if (normalized.mode === "cards") player.hand.push(...drawMany(state, 4));
      else player.gold += 4;
      player.abilityUsed = true;
      addLog(state, `${player.name} 的航海家带回四份${normalized.mode === "cards" ? "城区牌" : "金币"}。`);
      break;
    }
    case "scholar": {
      player.pendingDraw = drawMany(state, 7);
      player.pendingDrawMode = "scholar";
      player.abilityUsed = true;
      addLog(state, `${player.name} 正从七张蓝图中选择一张。`);
      break;
    }
    case "queen": {
      const rankFourOwner = state.players.find((candidate) =>
        candidate.roleKeys.some((key) => getRole(key)?.rank === 4),
      );
      const myIndex = state.players.indexOf(player);
      const otherIndex = rankFourOwner ? state.players.indexOf(rankFourOwner) : -99;
      const distance = Math.abs(myIndex - otherIndex);
      const adjacent = distance === 1 || distance === state.players.length - 1;
      if (!adjacent) throw new Error("你没有与本轮 4 号角色相邻而坐。 ");
      player.gold += 3;
      player.abilityUsed = true;
      addLog(state, `${player.name} 因与 4 号角色相邻获得三金币。`);
      break;
    }
    case "artist": {
      const district = player.city.find((card) => card.uid === normalized.ownDistrictUid);
      if (!district || district.beautified) throw new Error("请选择一座尚未美化的城区。 ");
      if (player.gold < 1) throw new Error("美化需要一金币。 ");
      player.gold -= 1;
      district.beautified = true;
      player.abilityCount += 1;
      if (player.abilityCount >= 2) player.abilityUsed = true;
      addLog(state, `${player.name} 美化了${district.name}。`);
      break;
    }
    case "tax_collector": {
      player.gold += state.taxPool;
      addLog(state, `${player.name} 收走了税务标记上的 ${state.taxPool} 金币。`);
      state.taxPool = 0;
      player.abilityUsed = true;
      break;
    }
    default:
      throw new Error("这个角色没有需要主动点击的角色能力。 ");
  }
  touch(state);
}

function effectiveBuildCost(player: PlayerState, card: DistrictCard) {
  const factoryDiscount = card.color === "purple" && card.key !== "factory" && hasDistrict(player, "factory") ? 1 : 0;
  return Math.max(0, card.cost - factoryDiscount);
}

function adjustedCost(card: DistrictCard) {
  return card.cost + (card.beautified ? 1 : 0);
}

function canBuildDuplicate(state: GameState, player: PlayerState) {
  return hasDistrict(player, "quarry") || activeRole(state)?.key === "wizard";
}

function countedBuild(state: GameState, card: DistrictCard) {
  if (card.key === "stables") return false;
  if (activeRole(state)?.key === "trader" && card.color === "green") return false;
  return true;
}

function buildLimit(state: GameState) {
  const key = activeRole(state)?.key;
  if (key === "architect") return 3;
  if (key === "seer" || key === "scholar") return 2;
  return 1;
}

function taxBuilder(state: GameState, builder: PlayerState) {
  if (!state.cast.some((role) => role.key === "tax_collector")) return;
  if (state.currentRoleKey === "tax_collector" && builder.id === state.activePlayerId) return;
  if (builder.gold > 0) {
    builder.gold -= 1;
    state.taxPool += 1;
    addLog(state, `${builder.name} 为这次建造缴纳一金币城区税。`);
  }
}

function commitBuild(
  state: GameState,
  builder: PlayerState,
  card: DistrictCard,
  options: { paid: boolean; paidAmount: number; countsLimit: boolean },
) {
  let recipient = builder;
  const signed = state.currentRoleKey ? state.warrants[state.currentRoleKey] : undefined;
  if (options.paid && !state.warrantResolved && signed === true) {
    state.warrantResolved = true;
    delete state.warrants[state.currentRoleKey!];
    const magistrate = roleOwner(state, "magistrate");
    if (magistrate && !magistrate.city.some((district) => district.name === card.name)) {
      builder.gold += options.paidAmount;
      builder.goldSpentBuilding -= options.paidAmount;
      recipient = magistrate;
      addLog(state, `执法官揭开真拘票，没收了 ${builder.name} 刚建造的${card.name}；建造金币已退还。`);
    }
  }
  recipient.city.push(card);
  if (options.countsLimit) builder.buildsThisTurn += 1;
  taxBuilder(state, recipient);
  if (recipient === builder) addLog(state, `${builder.name} 建造了${card.name}。`);
  if (citySize(recipient) >= completionTarget(state) && !state.firstCompletedPlayerId) {
    state.firstCompletedPlayerId = recipient.id;
    addLog(state, `${recipient.name} 首先完成城市，本轮结束后结算。`);
  }
}

function cardinalTrade(state: GameState, player: PlayerState, buildingCard: DistrictCard, shortage: number) {
  if (activeRole(state)?.key !== "cardinal" || shortage <= 0) return 0;
  const tradable = player.hand.filter((card) => card.uid !== buildingCard.uid).slice(0, shortage);
  const target = state.players
    .filter((candidate) => candidate.id !== player.id && candidate.gold >= shortage)
    .sort((a, b) => b.gold - a.gold)[0];
  if (!target || tradable.length < shortage) return 0;
  target.gold -= shortage;
  player.gold += shortage;
  player.hand = player.hand.filter((card) => !tradable.some((given) => given.uid === card.uid));
  target.hand.push(...tradable);
  addLog(state, `${player.name} 用 ${shortage} 张牌向 ${target.name} 换取建造所需金币。`);
  return shortage;
}

export function buildDistrict(
  state: GameState,
  playerId: string,
  cardUid: string,
  options: BuildOptions = {},
) {
  const player = requireActivePlayer(state, playerId);
  if (!player.resourceTaken) throw new Error("请先选择金币或抽牌。 ");
  if (player.pendingDraw.length) throw new Error("请先完成抽牌选择。 ");
  const role = activeRole(state);
  if (role?.key === "navigator" || (role?.key === "witch" && !state.witchResuming)) {
    throw new Error("这个角色状态下不能建造城区。 ");
  }
  const card = player.hand.find((candidate) => candidate.uid === cardUid);
  if (!card) throw new Error("这张牌不在你的手牌中。 ");
  if (card.key === "secret_vault") throw new Error("秘密金库不能建造。 ");
  if (card.key === "monument" && player.city.length >= 5) throw new Error("城市已有五座城区，不能再建纪念碑。 ");
  if (player.city.some((district) => district.name === card.name) && !canBuildDuplicate(state, player)) {
    throw new Error("你的城市里已经有同名城区。 ");
  }
  const counts = countedBuild(state, card);
  if (counts && player.buildsThisTurn >= buildLimit(state)) throw new Error("本回合的建造次数已经用完。 ");

  let paid = true;
  let paidAmount = 0;
  if (options.mode === "framework") {
    const framework = player.city.find((district) => district.uid === options.sacrificeUid && district.key === "framework");
    if (!framework) throw new Error("请选择自己的脚手架。 ");
    player.city = player.city.filter((district) => district.uid !== framework.uid);
    state.discard.push(framework);
    paid = false;
  } else if (options.mode === "necropolis" && card.key === "necropolis") {
    const sacrifice = player.city.find((district) => district.uid === options.sacrificeUid);
    if (!sacrifice) throw new Error("请选择要牺牲的一座城区。 ");
    player.city = player.city.filter((district) => district.uid !== sacrifice.uid);
    state.discard.push(sacrifice);
    paid = false;
  } else {
    let price = effectiveBuildCost(player, card);
    if (card.key === "thieves_den") {
      const requested = options.paymentCardUids ?? [];
      const paymentCards = player.hand
        .filter((candidate) => candidate.uid !== card.uid && requested.includes(candidate.uid))
        .slice(0, price);
      if (!requested.length && player.gold < price) {
        paymentCards.push(...player.hand.filter((candidate) => candidate.uid !== card.uid).slice(0, price - player.gold));
      }
      if (paymentCards.length) {
        player.hand = player.hand.filter((candidate) => !paymentCards.some((paidCard) => paidCard.uid === candidate.uid));
        state.discard.push(...paymentCards);
        price -= paymentCards.length;
      }
    }
    if (player.gold < price) cardinalTrade(state, player, card, price - player.gold);
    if (player.gold < price) throw new Error("金币不足。 ");
    player.gold -= price;
    player.goldSpentBuilding += price;
    paidAmount = price;
  }
  player.hand = player.hand.filter((candidate) => candidate.uid !== card.uid);
  commitBuild(state, player, card, { paid, paidAmount, countsLimit: counts });
  touch(state);
}

function protectedFromRankEight(state: GameState, target: PlayerState, district: DistrictCard) {
  if (district.key === "keep") return true;
  if (state.bewitchedRoleKey === "bishop") {
    return target.id === state.witchPlayerId;
  }
  const bishopOwner = roleOwner(state, "bishop");
  return bishopOwner?.id === target.id && state.assassinatedRoleKey !== "bishop";
}

function rankEightPrice(target: PlayerState, district: DistrictCard, base: number) {
  const wall = hasDistrict(target, "great_wall") && district.key !== "great_wall" ? 1 : 0;
  return Math.max(0, base + wall + (district.beautified ? 1 : 0));
}

export function activateRankEightAbility(
  state: GameState,
  playerId: string,
  targetPlayerId: string,
  targetDistrictUid: string,
  ownDistrictUid?: string,
) {
  const player = requireActivePlayer(state, playerId);
  if (player.abilityUsed) throw new Error("本回合已经使用过角色能力。 ");
  const role = activeRole(state);
  if (!role || !["warlord", "diplomat", "marshal"].includes(role.key)) throw new Error("当前角色不能这样影响城区。 ");
  const target = requirePlayer(state, targetPlayerId);
  if (target.id === player.id && role.key !== "warlord") throw new Error("请选择另一名玩家。 ");
  if (citySize(target) >= completionTarget(state)) throw new Error("已经完成的城市不能成为目标。 ");
  const district = target.city.find((candidate) => candidate.uid === targetDistrictUid);
  if (!district) throw new Error("找不到这座城区。 ");
  if (protectedFromRankEight(state, target, district)) throw new Error("这座城区受到保护。 ");

  if (role.key === "warlord") {
    const price = rankEightPrice(target, district, district.cost - 1);
    if (player.gold < price) throw new Error("金币不足以摧毁这座城区。 ");
    player.gold -= price;
    target.city = target.city.filter((candidate) => candidate.uid !== district.uid);
    state.discard.push(district, ...(district.storedCards ?? []));
    addLog(state, `${player.name} 摧毁了 ${target.name} 的${district.name}。`);
  } else if (role.key === "marshal") {
    if (adjustedCost(district) > 3) throw new Error("统帅只能接管当前费用不高于三的城区。 ");
    if (player.city.some((candidate) => candidate.name === district.name)) throw new Error("不能接管同名城区。 ");
    const price = rankEightPrice(target, district, district.cost);
    if (player.gold < price) throw new Error("金币不足以接管这座城区。 ");
    player.gold -= price;
    target.gold += price;
    target.city = target.city.filter((candidate) => candidate.uid !== district.uid);
    player.city.push(district);
    addLog(state, `${player.name} 从 ${target.name} 的城市接管了${district.name}。`);
  } else {
    const own = player.city.find((candidate) => candidate.uid === ownDistrictUid);
    if (!own) throw new Error("请选择自己用于交换的城区。 ");
    if (target.city.some((candidate) => candidate.name === own.name) || player.city.some((candidate) => candidate.name === district.name)) {
      throw new Error("交换后不能形成同名城区。 ");
    }
    const difference = Math.max(0, adjustedCost(district) - adjustedCost(own));
    const price = rankEightPrice(target, district, difference);
    if (player.gold < price) throw new Error("金币不足以补足交换差价。 ");
    player.gold -= price;
    target.gold += price;
    player.city = player.city.filter((candidate) => candidate.uid !== own.uid);
    target.city = target.city.filter((candidate) => candidate.uid !== district.uid);
    player.city.push(district);
    target.city.push(own);
    addLog(state, `${player.name} 与 ${target.name} 交换了两座城区。`);
  }
  if (citySize(player) >= completionTarget(state) && !state.firstCompletedPlayerId) {
    state.firstCompletedPlayerId = player.id;
    addLog(state, `${player.name} 首先完成城市，本轮结束后结算。`);
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
  activateRankEightAbility(state, playerId, targetPlayerId, districtUid);
}

export function activateDistrictAbility(
  state: GameState,
  playerId: string,
  districtUid: string,
  payload: AbilityPayload = {},
) {
  const player = requireActivePlayer(state, playerId);
  const district = player.city.find((candidate) => candidate.uid === districtUid);
  if (!district) throw new Error("你的城市里没有这座城区。 ");
  if (player.districtAbilitiesUsed.includes(district.uid)) throw new Error("本回合已经使用过这座城区。 ");
  if (district.key === "laboratory") {
    const card = player.hand.find((candidate) => candidate.uid === payload.cardUid);
    if (!card) throw new Error("请选择一张要弃掉的手牌。 ");
    player.hand = player.hand.filter((candidate) => candidate.uid !== card.uid);
    state.discard.push(card);
    player.gold += 2;
  } else if (district.key === "smithy") {
    if (player.gold < 2) throw new Error("铁匠铺需要支付两金币。 ");
    player.gold -= 2;
    player.hand.push(...drawMany(state, 3));
  } else if (district.key === "museum") {
    const card = player.hand.find((candidate) => candidate.uid === payload.cardUid);
    if (!card) throw new Error("请选择一张藏入博物馆的手牌。 ");
    player.hand = player.hand.filter((candidate) => candidate.uid !== card.uid);
    district.storedCards ??= [];
    district.storedCards.push(card);
  } else if (district.key === "armory") {
    const target = requirePlayer(state, payload.targetPlayerId ?? "");
    const targetDistrict = target.city.find((candidate) => candidate.uid === payload.targetDistrictUid);
    if (!targetDistrict) throw new Error("请选择一座目标城区。 ");
    if (targetDistrict.uid === district.uid) throw new Error("军械库必须摧毁另一座城区。 ");
    if (citySize(target) >= completionTarget(state)) throw new Error("不能摧毁已完成城市中的城区。 ");
    player.city = player.city.filter((candidate) => candidate.uid !== district.uid);
    target.city = target.city.filter((candidate) => candidate.uid !== targetDistrict.uid);
    state.discard.push(district, targetDistrict, ...(targetDistrict.storedCards ?? []));
  } else {
    throw new Error("这座城区没有可点击发动的能力。 ");
  }
  player.districtAbilitiesUsed.push(district.uid);
  addLog(state, `${player.name} 使用了${district.name}的效果。`);
  touch(state);
}

function applyEndTurnEffects(state: GameState, player: PlayerState) {
  if (hasDistrict(player, "park") && player.hand.length === 0) {
    player.hand.push(...drawMany(state, 2));
    addLog(state, `${player.name} 从公园获得两张牌。`);
  }
  if (hasDistrict(player, "poor_house") && player.gold === 0) {
    player.gold += 1;
    addLog(state, `${player.name} 从救济院获得一金币。`);
  }
  if (activeRole(state)?.key === "alchemist" && player.goldSpentBuilding > 0) {
    player.gold += player.goldSpentBuilding;
    addLog(state, `${player.name} 以炼金术收回 ${player.goldSpentBuilding} 枚建造金币。`);
  }
}

export function endTurn(state: GameState, playerId: string) {
  const player = requireActivePlayer(state, playerId);
  if (!player.resourceTaken) throw new Error("结束回合前必须选择一种资源。 ");
  if (player.pendingDraw.length) throw new Error("请先完成抽牌选择。 ");
  const role = activeRole(state);
  if (role?.key === "witch" && !state.witchResuming && !player.abilityUsed) throw new Error("女巫取得资源后必须点名魅惑角色。 ");
  if (role?.key === "emperor" && !player.abilityUsed) throw new Error("皇帝必须先转交皇冠。 ");
  applyEndTurnEffects(state, player);
  addLog(state, `${player.name} 结束${state.witchResuming ? `借用${role?.name}的` : ""}回合。`);
  state.activePlayerId = null;
  state.witchResuming = false;
  advanceTurn(state);
  touch(state);
}

function botTargetPlayer(state: GameState, bot: PlayerState) {
  return state.players
    .filter((player) => player.id !== bot.id)
    .sort((a, b) => citySize(b) - citySize(a) || b.gold - a.gold)[0];
}

function botUseAbility(state: GameState, bot: PlayerState) {
  const role = activeRole(state);
  if (!role || bot.abilityUsed || state.pendingChoice) return;
  const target = botTargetPlayer(state, bot);
  const roleTarget = state.cast.find((candidate) => candidate.rank > role.rank && candidate.key !== state.assassinatedRoleKey);
  try {
    if (["assassin", "witch", "magistrate", "thief", "blackmailer"].includes(role.key)) {
      if (roleTarget) activateRoleAbility(state, bot.id, { targetRoleKey: roleTarget.key });
    } else if (role.key === "spy" && target) {
      activateRoleAbility(state, bot.id, { targetPlayerId: target.id, districtColor: "green" });
    } else if (role.key === "magician" && bot.hand.length) {
      activateRoleAbility(state, bot.id, { mode: "redraw", cardUids: bot.hand.slice(0, 2).map((card) => card.uid) });
    } else if (role.key === "wizard" && target?.hand.length) {
      activateRoleAbility(state, bot.id, { targetPlayerId: target.id });
    } else if (role.key === "seer") {
      activateRoleAbility(state, bot.id);
    } else if (role.key === "emperor" && target) {
      activateRoleAbility(state, bot.id, { targetPlayerId: target.id, mode: target.gold ? "gold" : "card" });
    } else if (role.key === "abbot") {
      activateRoleAbility(state, bot.id, { amountCards: Math.floor(countIncomeDistricts(bot, "blue") / 2) });
    } else if (role.key === "architect") {
      activateRoleAbility(state, bot.id);
    } else if (role.key === "navigator") {
      activateRoleAbility(state, bot.id, { mode: bot.gold < 4 ? "gold" : "cards" });
    } else if (role.key === "scholar") {
      activateRoleAbility(state, bot.id);
    } else if (role.key === "queen") {
      activateRoleAbility(state, bot.id);
    } else if (role.key === "artist" && bot.gold && bot.city.some((card) => !card.beautified)) {
      activateRoleAbility(state, bot.id, { ownDistrictUid: bot.city.find((card) => !card.beautified)!.uid });
    } else if (role.key === "tax_collector") {
      activateRoleAbility(state, bot.id);
    }
  } catch {
    // Optional abilities may have no legal target; bots simply pass them.
  }
}

function resolveBotPendingChoice(state: GameState, bot: PlayerState) {
  if (state.pendingChoice?.type === "blackmail" && state.pendingChoice.actorId === bot.id) {
    resolveBlackmail(state, bot.id, bot.gold >= 4);
  }
  if (state.pendingChoice?.type === "wizard" && state.pendingChoice.actorId === bot.id) {
    const target = requirePlayer(state, state.pendingChoice.targetPlayerId);
    activateRoleAbility(state, bot.id, { cardUid: target.hand[0]?.uid, mode: "take" });
  }
  while (state.pendingChoice?.type === "seer" && state.pendingChoice.actorId === bot.id) {
    activateRoleAbility(state, bot.id, { cardUid: bot.hand[0]?.uid });
  }
}

function botTurn(state: GameState, bot: PlayerState) {
  if (!bot.resourceTaken) {
    const affordable = bot.hand.some((card) => effectiveBuildCost(bot, card) <= bot.gold);
    if (affordable || bot.gold < 3) takeGold(state, bot.id);
    else drawDistrictChoices(state, bot.id);
  }
  if (bot.pendingDraw.length) keepDistrictCard(state, bot.id, bot.pendingDraw[0].uid);
  if (state.activePlayerId !== bot.id) return;
  resolveBotPendingChoice(state, bot);
  if (bot.pendingDraw.length) keepDistrictCard(state, bot.id, bot.pendingDraw[0].uid);
  if (state.activePlayerId !== bot.id) return;

  const role = activeRole(state);
  if (role && ["king", "patrician", "bishop", "cardinal", "merchant", "trader", "warlord", "diplomat", "marshal"].includes(role.key) && !bot.incomeTaken) {
    takeRoleIncome(state, bot.id);
  }
  botUseAbility(state, bot);
  resolveBotPendingChoice(state, bot);
  if (state.activePlayerId !== bot.id) return;
  if (bot.pendingDraw.length) keepDistrictCard(state, bot.id, bot.pendingDraw[0].uid);

  while (state.activePlayerId === bot.id && activeRole(state)?.key !== "navigator") {
    const card = [...bot.hand]
      .filter((candidate) => candidate.key !== "secret_vault")
      .filter((candidate) => !bot.city.some((built) => built.name === candidate.name) || canBuildDuplicate(state, bot))
      .filter((candidate) => effectiveBuildCost(bot, candidate) <= bot.gold)
      .sort((a, b) => b.cost - a.cost)[0];
    if (!card) break;
    try {
      buildDistrict(state, bot.id, card.uid);
    } catch {
      break;
    }
    if (countedBuild(state, card) && bot.buildsThisTurn >= buildLimit(state)) break;
  }
  if (state.activePlayerId === bot.id) endTurn(state, bot.id);
}

export function processBots(state: GameState) {
  let guard = 0;
  while (guard < 120) {
    guard += 1;
    if (state.status === "draft") {
      const picker = state.players.find((player) => player.id === currentPickerId(state));
      if (!picker?.isBot) break;
      const options = availableForPicker(state);
      chooseRole(state, picker.id, options[Math.floor(Math.random() * options.length)]);
      continue;
    }
    if (state.status === "theater") {
      const owner = state.players.find((player) => player.id === state.theaterPlayerId);
      if (!owner?.isBot) break;
      resolveTheater(state, owner.id);
      continue;
    }
    if (state.status === "turns") {
      const active = state.players.find((player) => player.id === state.activePlayerId);
      if (!active?.isBot) break;
      botTurn(state, active);
      continue;
    }
    break;
  }
  touch(state);
}

function scoreForHauntedType(state: GameState, player: PlayerState, hauntedAs: DistrictColor) {
  const types = player.city.map((district) => district.key === "haunted_quarter" ? hauntedAs : district.color);
  const base = player.city.reduce((sum, district) => sum + adjustedCost(district), 0);
  const variety = new Set(types).size === 5 ? 3 : 0;
  const completion = citySize(player) >= completionTarget(state)
    ? state.firstCompletedPlayerId === player.id ? 4 : 2
    : 0;
  let unique = 0;
  if (hasDistrict(player, "dragon_gate")) unique += 2;
  if (hasDistrict(player, "imperial_treasury")) unique += player.gold;
  const uniqueCount = types.filter((color) => color === "purple").length;
  if (hasDistrict(player, "ivory_tower") && uniqueCount === 1) unique += 5;
  if (hasDistrict(player, "map_room")) unique += player.hand.length;
  if (hasDistrict(player, "statue") && state.crownPlayerId === player.id) unique += 5;
  if (hasDistrict(player, "wishing_well")) unique += uniqueCount;
  if (hasDistrict(player, "basilica")) unique += player.city.filter((district) => adjustedCost(district) % 2 === 1).length;
  if (hasDistrict(player, "capitol")) {
    const counts = types.reduce<Record<string, number>>((result, color) => ({ ...result, [color]: (result[color] ?? 0) + 1 }), {});
    if (Object.values(counts).some((count) => count >= 3)) unique += 3;
  }
  const museum = player.city.find((district) => district.key === "museum");
  unique += museum?.storedCards?.length ?? 0;
  unique += player.hand.filter((card) => card.key === "secret_vault").length * 3;
  return { total: base + variety + completion + unique, base, variety, completion, unique };
}

export function playerScoreBreakdown(state: GameState, player: PlayerState) {
  const choices: DistrictColor[] = hasDistrict(player, "haunted_quarter")
    ? ["yellow", "blue", "green", "red", "purple"]
    : ["purple"];
  return choices
    .map((color) => scoreForHauntedType(state, player, color))
    .sort((a, b) => b.total - a.total)[0];
}

export function playerScore(state: GameState, player: PlayerState) {
  return playerScoreBreakdown(state, player).total;
}

function publicPendingChoice(state: GameState, viewerId: string) {
  const choice = state.pendingChoice;
  if (!choice || choice.actorId !== viewerId) return null;
  if (choice.type === "wizard") {
    const target = requirePlayer(state, choice.targetPlayerId);
    return { ...choice, targetName: target.name, cards: target.hand };
  }
  if (choice.type === "seer") {
    const target = requirePlayer(state, choice.remainingPlayerIds[0]);
    return { ...choice, targetName: target.name };
  }
  return { type: "blackmail", actorId: choice.actorId };
}

export function publicGameView(state: GameState, viewerId: string) {
  const viewer = requirePlayer(state, viewerId);
  const picker = currentPickerId(state);
  const active = currentPlayerId(state);
  const ruleset = getRuleset(state.rulesetKey);
  return {
    code: state.code,
    status: state.status,
    round: state.round,
    hostId: state.hostId,
    ruleset: { key: ruleset.key, name: ruleset.name, tagline: ruleset.tagline },
    crownPlayerId: state.crownPlayerId,
    currentPickerId: picker,
    currentPlayerId: active,
    currentRank: state.currentRank,
    currentRoleKey: state.currentRoleKey,
    firstCompletedPlayerId: state.firstCompletedPlayerId,
    completionTarget: completionTarget(state),
    availableRoleKeys: picker === viewerId ? availableForPicker(state) : [],
    faceupDiscardedRoleKeys: state.faceupDiscardedRoleKeys,
    roles: state.cast.length ? state.cast : castForRuleset(state.rulesetKey, state.players.length, state.includeRankNine),
    includeRankNine: state.includeRankNine,
    rulesetUniqueKeys: ruleset.uniqueKeys,
    allRoles: ROLES,
    allUniqueDistricts: UNIQUE_DISTRICTS,
    taxPool: state.taxPool,
    pendingChoice: publicPendingChoice(state, viewerId),
    privateNotes: state.privateNotes[viewerId] ?? [],
    players: state.players.map((player) => {
      const visibleRoles = player.id === viewerId || state.status === "finished"
        ? player.roleKeys
        : player.revealedRoleKeys;
      const breakdown = playerScoreBreakdown(state, player);
      return {
        id: player.id,
        name: player.name,
        isBot: player.isBot,
        gold: player.gold,
        handCount: player.hand.length,
        hand: player.id === viewerId ? player.hand : [],
        city: player.city,
        roleKeys: visibleRoles,
        revealedRoleKeys: player.revealedRoleKeys,
        activeRoleKey: player.id === active ? state.currentRoleKey : null,
        resourceTaken: player.id === viewerId ? player.resourceTaken : false,
        pendingDraw: player.id === viewerId ? player.pendingDraw : [],
        pendingDrawMode: player.id === viewerId ? player.pendingDrawMode : null,
        buildsThisTurn: player.id === viewerId ? player.buildsThisTurn : 0,
        abilityUsed: player.id === viewerId ? player.abilityUsed : false,
        abilityCount: player.id === viewerId ? player.abilityCount : 0,
        incomeTaken: player.id === viewerId ? player.incomeTaken : false,
        districtAbilitiesUsed: player.id === viewerId ? player.districtAbilitiesUsed : [],
        score: breakdown.total,
        scoreBreakdown: state.status === "finished" ? breakdown : undefined,
      };
    }),
    log: state.log.slice(-32),
    version: state.version,
    viewerId: viewer.id,
  };
}
