import {
  REALM_AREAS,
  REALM_EVENT_DECKS,
  REALM_FACTIONS,
  REALM_LEADERS,
  REALM_ORDER_COUNTS,
  REALM_PLAYER_SETUPS,
  REALM_STARTING_UNITS,
  REALM_SUPPLY_LIMITS,
  REALM_UNIT_MUSTER_COST,
  REALM_UNIT_STRENGTH,
  orderFamily,
  orderIsStar,
  orderModifier,
  realmArea,
  realmFaction,
  realmLeader,
  type RealmAreaDefinition,
  type RealmEventKey,
  type RealmOrderType,
  type RealmUnitType,
} from "./realms-data.ts";

export type RealmPhase =
  | "lobby" | "events" | "event_choice" | "supply" | "mustering"
  | "influence_bid" | "wildling_bid" | "bid_tiebreak" | "planning" | "raven"
  | "raid" | "march" | "combat_support" | "combat_cards" | "combat_blade"
  | "combat_effect" | "combat_casualties" | "combat_retreat" | "consolidate" | "finished";

export type RealmCombatEffect = {
  actorFaction: string;
  targetFaction: string;
  type: "remove_adjacent_order" | "move_influence_bottom" | "discard_enemy_card" | "remove_order" | "upgrade_unit";
  options: string[];
  optional: boolean;
};

export type RealmUnit = {
  id: string;
  faction: string;
  type: RealmUnitType;
  routed: boolean;
};

export type RealmAreaState = {
  units: RealmUnit[];
  control: string | null;
  controlToken: boolean;
  order: RealmOrderType | null;
  neutral: number | null;
  garrison: number | null;
  blocked: boolean;
};

export type RealmPlayerState = {
  id: string;
  token: string;
  recoveryHash?: string;
  name: string;
  isBot: boolean;
  faction: string | null;
  power: number;
  supply: number;
  submitted: boolean;
  leaderHand: string[];
  leaderDiscard: string[];
  privateNotes: string[];
};

type RealmBidState = {
  kind: "influence" | "wildling";
  track?: "throne" | "fiefdom" | "court";
  bids: Record<string, number | null>;
  excludedPlayerIds?: string[];
};

type RealmTieBreakState = {
  kind: "influence" | "wildling";
  track?: "throne" | "fiefdom" | "court";
  groups: string[][];
  groupIndex: number;
  rankedFactions: string[];
};

export type RealmMarchMove = { to: string; unitIds: string[] };
export type RealmMusterChoice = {
  sourceAreaId: string;
  type: RealmUnitType;
  targetAreaId?: string;
  upgradeUnitId?: string;
};

type CombatSide = "attacker" | "defender" | "none";

export type RealmCombat = {
  sourceAreaId: string;
  targetAreaId: string;
  attackerFaction: string;
  defenderFaction: string;
  attackingUnits: RealmUnit[];
  marchOrder: RealmOrderType;
  supportQueue: string[];
  supportChoices: Record<string, CombatSide | null>;
  leaderChoices: Record<string, string | null>;
  leaderConfirmed: string[];
  blockedLeaderKeys: Record<string, string[]>;
  cancelResolved: boolean;
  immediateEffectsResolved: boolean;
  bladeFaction: string | null;
  bladeUsed: boolean;
  tide: Record<string, { strength: number; sword: number; skull: boolean }>;
  winnerFaction: string | null;
  loserFaction: string | null;
  casualtiesRequired: number;
  retreatOptions: string[];
  preventAdvance: boolean;
  keepMarchOrder: boolean;
};

export type RealmState = {
  kind: "realms";
  rulesVersion: 2;
  code: string;
  phase: RealmPhase;
  round: number;
  hostId: string;
  players: RealmPlayerState[];
  areas: Record<string, RealmAreaState>;
  influence: {
    throne: string[];
    fiefdom: string[];
    court: string[];
  };
  bladeUsed: boolean;
  ravenUsed: boolean;
  ravenPeekedBy: string | null;
  wildlingThreat: number;
  wildlingDeck: string[];
  wildlingDiscard: string[];
  eventDecks: Record<1 | 2 | 3, RealmEventKey[]>;
  eventDiscards: Record<1 | 2 | 3, RealmEventKey[]>;
  eventQueue: RealmEventKey[];
  eventChoice: RealmEventKey[];
  currentEvent: RealmEventKey | null;
  forbiddenOrderFamily: string | null;
  currentPlayerId: string | null;
  resolverCursor: number;
  pendingCombat: RealmCombat | null;
  combatEffects: RealmCombatEffect[];
  combatEffectResume: "combat_strength" | "march" | null;
  bid: RealmBidState | null;
  tieBreak: RealmTieBreakState | null;
  supplyQueue: string[];
  musterQueue: string[];
  tidesOfBattle: boolean;
  winnerId: string | null;
  log: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

const UNIT_LIMITS: Record<RealmUnitType, number> = { footman: 10, knight: 5, ship: 6, siege: 2 };
const STAR_SLOTS = [3, 3, 2, 1, 0, 0];
const FEWER_PLAYER_STAR_SLOTS = [3, 2, 1, 0];
const EVENT_WILDLING_ICONS: Partial<Record<RealmEventKey, number>> = {
  quiet: 2,
  throne_choice: 2,
  raven_choice: 2,
  no_raid: 2,
  no_march_plus: 2,
  no_power: 2,
  no_support: 2,
  no_defend: 2,
};
const WILDLING_CARDS = ["mammoths", "climbers", "raiders", "king", "silence", "horde", "scouts", "cold", "giants"];
const BOT_PROCESSING = new WeakSet<RealmState>();

function randomId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function touch(state: RealmState) {
  state.version += 1;
  state.updatedAt = new Date().toISOString();
}

function addLog(state: RealmState, message: string) {
  state.log.push(message);
  if (state.log.length > 240) state.log.splice(0, state.log.length - 240);
}

function makePlayer(name: string, isBot = false): RealmPlayerState {
  return {
    id: randomId(isBot ? "bot" : "player"),
    token: randomId("token"),
    name: name.trim().slice(0, 16) || (isBot ? "战略电脑" : "无名领主"),
    isBot,
    faction: null,
    power: 5,
    supply: 0,
    submitted: false,
    leaderHand: [],
    leaderDiscard: [],
    privateNotes: [],
  };
}

function initialAreaState(area: RealmAreaDefinition): RealmAreaState {
  return {
    units: [],
    control: area.homeOf ?? null,
    controlToken: false,
    order: null,
    neutral: area.neutral ?? null,
    garrison: area.garrison ?? null,
    blocked: false,
  };
}

export function createRealmState(code: string, hostName: string, botCount = 2, tidesOfBattle = false) {
  const host = makePlayer(hostName);
  const now = new Date().toISOString();
  const state: RealmState = {
    kind: "realms",
    rulesVersion: 2,
    code,
    phase: "lobby",
    round: 1,
    hostId: host.id,
    players: [host],
    areas: Object.fromEntries(REALM_AREAS.map((area) => [area.key, initialAreaState(area)])),
    influence: { throne: [], fiefdom: [], court: [] },
    bladeUsed: false,
    ravenUsed: false,
    ravenPeekedBy: null,
    wildlingThreat: 2,
    wildlingDeck: shuffle(WILDLING_CARDS),
    wildlingDiscard: [],
    eventDecks: {
      1: shuffle([...REALM_EVENT_DECKS[1]]),
      2: shuffle([...REALM_EVENT_DECKS[2]]),
      3: shuffle([...REALM_EVENT_DECKS[3]]),
    },
    eventDiscards: { 1: [], 2: [], 3: [] },
    eventQueue: [],
    eventChoice: [],
    currentEvent: null,
    forbiddenOrderFamily: null,
    currentPlayerId: null,
    resolverCursor: 0,
    pendingCombat: null,
    combatEffects: [],
    combatEffectResume: null,
    bid: null,
    tieBreak: null,
    supplyQueue: [],
    musterQueue: [],
    tidesOfBattle,
    winnerId: null,
    log: [`${host.name} 建立了《六境争霸》房间。`],
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  for (let index = 0; index < Math.max(0, Math.min(5, botCount)); index += 1) {
    state.players.push(makePlayer(`军师 ${index + 1}`, true));
  }
  return { state, host };
}

function requirePlayer(state: RealmState, playerId: string) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error("找不到这个座位。 ");
  return player;
}

function requireFaction(player: RealmPlayerState) {
  if (!player.faction) throw new Error("这名玩家还没有势力。 ");
  return player.faction;
}

function requireHost(state: RealmState, playerId: string) {
  if (state.hostId !== playerId) throw new Error("只有房主可以这样做。 ");
  return requirePlayer(state, playerId);
}

export function joinRealm(state: RealmState, name: string) {
  if (state.phase !== "lobby") throw new Error("这局已经开始。 ");
  if (state.players.length >= 6) throw new Error("房间已满，最多六人。 ");
  if (!name.trim()) throw new Error("请先输入昵称。 ");
  const player = makePlayer(name);
  state.players.push(player);
  addLog(state, `${player.name} 加入了战争议会。`);
  touch(state);
  return player;
}

export function addRealmBot(state: RealmState, playerId: string) {
  requireHost(state, playerId);
  if (state.phase !== "lobby") throw new Error("只能在开局前添加电脑玩家。 ");
  if (state.players.length >= 6) throw new Error("房间已满。 ");
  const bot = makePlayer(`军师 ${state.players.filter((player) => player.isBot).length + 1}`, true);
  state.players.push(bot);
  touch(state);
  return bot;
}

export function removeRealmPlayer(state: RealmState, playerId: string, targetPlayerId: string) {
  requireHost(state, playerId);
  if (state.phase !== "lobby") throw new Error("开局后不能移除座位。 ");
  if (targetPlayerId === playerId) throw new Error("房主不能移除自己。 ");
  const index = state.players.findIndex((player) => player.id === targetPlayerId);
  if (index < 0) throw new Error("找不到这个座位。 ");
  const [removed] = state.players.splice(index, 1);
  touch(state);
  return removed;
}

export function entrustRealmPlayer(state: RealmState, playerId: string, targetPlayerId: string) {
  requireHost(state, playerId);
  if (state.phase === "lobby" || state.phase === "finished") throw new Error("只能在进行中的战局托管座位。 ");
  const target = requirePlayer(state, targetPlayerId);
  if (target.id === playerId) throw new Error("房主不能在当前设备上托管自己。 ");
  if (target.isBot) throw new Error("这个座位已经由电脑接管。 ");
  target.isBot = true;
  addLog(state, `${target.name} 的座位已交给战略电脑；原玩家仍可用恢复码返回。`);
  touch(state);
  processRealmBots(state);
}

function placeUnit(state: RealmState, faction: string, areaId: string, type: RealmUnitType) {
  const area = state.areas[areaId];
  if (!area) throw new Error("找不到部署区域。 ");
  area.units.push({ id: randomId("unit"), faction, type, routed: false });
  const definition = realmArea(areaId);
  if (definition?.kind === "land") {
    area.control = faction;
    area.controlToken = false;
  }
}

function activeFactionKeys(state: RealmState) {
  return state.players.map((player) => player.faction).filter((key): key is string => Boolean(key));
}

function factionPlayer(state: RealmState, faction: string) {
  return state.players.find((player) => player.faction === faction);
}

function initialInfluence(state: RealmState, track: 0 | 1 | 2) {
  return [...state.players]
    .sort((a, b) => {
      const first = realmFaction(requireFaction(a))?.startingInfluence[track] ?? 99;
      const second = realmFaction(requireFaction(b))?.startingInfluence[track] ?? 99;
      return first - second;
    })
    .map((player) => requireFaction(player));
}

export function startRealmGame(state: RealmState, playerId: string) {
  requireHost(state, playerId);
  if (state.phase !== "lobby") throw new Error("这局已经开始。 ");
  if (state.players.length < 3 || state.players.length > 6) throw new Error("完整规则需要三至六位玩家。 ");
  const setup = REALM_PLAYER_SETUPS[state.players.length];
  const factions = setup.factions;
  state.players.forEach((player, index) => {
    const faction = factions[index];
    const definition = realmFaction(faction)!;
    player.faction = faction;
    player.power = 5;
    player.supply = definition.startingSupply;
    player.leaderHand = REALM_LEADERS.filter((leader) => leader.faction === faction).map((leader) => leader.key);
    player.leaderDiscard = [];
    for (const placement of REALM_STARTING_UNITS.filter((item) => item.faction === faction && !setup.removedStartingAreas.includes(item.area))) {
      for (let quantity = 0; quantity < (placement.quantity ?? 1); quantity += 1) placeUnit(state, faction, placement.area, placement.type);
    }
  });
  const active = new Set(activeFactionKeys(state));
  for (const definition of REALM_FACTIONS) {
    if (!active.has(definition.key)) {
      state.areas[definition.home].neutral = state.players.length === 3 ? 99 : 6;
      state.areas[definition.home].control = null;
      state.areas[definition.port].control = null;
    }
  }
  for (const areaId of setup.blocked) {
    state.areas[areaId].blocked = true;
    state.areas[areaId].neutral = 99;
    state.areas[areaId].control = null;
  }
  for (const [areaId, strength] of Object.entries(setup.neutralForces)) {
    state.areas[areaId].neutral = strength;
    state.areas[areaId].control = null;
  }
  state.influence = {
    throne: initialInfluence(state, 0),
    fiefdom: initialInfluence(state, 1),
    court: initialInfluence(state, 2),
  };
  state.phase = "planning";
  state.currentPlayerId = null;
  addLog(state, "第一轮开始：各势力秘密下达命令。 ");
  touch(state);
  processRealmBots(state);
}

export function realmAreaOwner(state: RealmState, areaId: string) {
  const area = state.areas[areaId];
  if (!area || area.blocked) return null;
  const unitFaction = area.units[0]?.faction;
  if (unitFaction) return unitFaction;
  const definition = realmArea(areaId);
  if (definition?.kind === "port" && definition.portOf) return realmAreaOwner(state, definition.portOf);
  return area.control;
}

function orderForbidden(state: RealmState, order: RealmOrderType) {
  return state.forbiddenOrderFamily === "march_star"
    ? order === "march_star"
    : Boolean(state.forbiddenOrderFamily && orderFamily(order) === state.forbiddenOrderFamily);
}

function factionAreasWithUnits(state: RealmState, faction: string) {
  return REALM_AREAS.filter((area) => state.areas[area.key].units.some((unit) => unit.faction === faction));
}

function starAllowance(state: RealmState, faction: string) {
  const position = state.influence.court.indexOf(faction);
  const slots = state.players.length <= 4 ? FEWER_PLAYER_STAR_SLOTS : STAR_SLOTS;
  return slots[Math.max(0, position)] ?? 0;
}

function orderInventoryValid(orders: RealmOrderType[]) {
  return Object.entries(REALM_ORDER_COUNTS).every(([order, maximum]) => orders.filter((candidate) => candidate === order).length <= maximum);
}

function eligibleOrderCapacity(state: RealmState, faction: string) {
  const allowed = (Object.entries(REALM_ORDER_COUNTS) as [RealmOrderType, number][]).filter(([order]) => !orderForbidden(state, order));
  const regular = allowed.filter(([order]) => !orderIsStar(order)).reduce((sum, [, count]) => sum + count, 0);
  const special = allowed.filter(([order]) => orderIsStar(order)).reduce((sum, [, count]) => sum + count, 0);
  return regular + Math.min(starAllowance(state, faction), special);
}

export function submitRealmOrders(state: RealmState, playerId: string, orders: Record<string, RealmOrderType>) {
  if (state.phase !== "planning") throw new Error("现在不是秘密下令阶段。 ");
  const player = requirePlayer(state, playerId);
  const faction = requireFaction(player);
  const areas = factionAreasWithUnits(state, faction);
  const areaKeys = new Set(areas.map((area) => area.key));
  const required = Math.min(areas.length, eligibleOrderCapacity(state, faction));
  if (Object.keys(orders).length !== required || Object.keys(orders).some((key) => !areaKeys.has(key))) {
    throw new Error(areas.length > required ? `命令不足时必须放置全部 ${required} 枚可用命令。 ` : "每个有部队的区域都必须放置一枚命令。 ");
  }
  const submittedOrders = Object.values(orders);
  if (!orderInventoryValid(submittedOrders)) throw new Error("使用的命令标记超过了拥有数量。 ");
  if (submittedOrders.filter(orderIsStar).length > starAllowance(state, faction)) throw new Error("星级命令数量超过王庭轨道许可。 ");
  if (submittedOrders.some((order) => orderForbidden(state, order))) {
    throw new Error("本轮事件禁止使用这种命令。 ");
  }
  for (const area of areas) state.areas[area.key].order = orders[area.key];
  player.submitted = true;
  addLog(state, `${player.name} 已封存全部命令。`);
  touch(state);
  processRealmBots(state);
}

function allSubmitted(state: RealmState) {
  return state.players.every((player) => player.submitted);
}

function ravenHolder(state: RealmState) {
  return factionPlayer(state, state.influence.court[0]);
}

function ensureWildlingDeck(state: RealmState) {
  if (!state.wildlingDeck.length) state.wildlingDeck = shuffle(state.wildlingDiscard.splice(0));
}

function revealOrders(state: RealmState) {
  const raven = ravenHolder(state);
  if (raven && !state.ravenUsed) {
    state.phase = "raven";
    state.currentPlayerId = raven.id;
    return;
  }
  beginOrderPhase(state, "raid");
}

export function resolveRealmRaven(
  state: RealmState,
  playerId: string,
  payload: { mode: "replace" | "peek" | "top" | "bottom" | "skip"; areaId?: string; order?: RealmOrderType },
) {
  if (state.phase !== "raven" || state.currentPlayerId !== playerId) throw new Error("现在不能使用信鸦。 ");
  const player = requirePlayer(state, playerId);
  const faction = requireFaction(player);
  if (payload.mode === "peek") {
    ensureWildlingDeck(state);
    player.privateNotes.push(`野人牌堆顶：${state.wildlingDeck[0] ?? "未知"}`);
    state.ravenPeekedBy = playerId;
    touch(state);
    return;
  } else if (payload.mode === "top" || payload.mode === "bottom") {
    if (state.ravenPeekedBy !== playerId) throw new Error("请先查看荒境牌堆顶。 ");
    if (payload.mode === "bottom") state.wildlingDeck.push(state.wildlingDeck.shift()!);
  } else if (payload.mode === "replace") {
    const area = payload.areaId ? state.areas[payload.areaId] : null;
    if (!area || realmAreaOwner(state, payload.areaId!) !== faction || !area.order || !payload.order) throw new Error("请选择自己的有效命令。 ");
    const existing = factionAreasWithUnits(state, faction).map((definition) => definition.key === payload.areaId ? payload.order! : state.areas[definition.key].order!).filter(Boolean);
    if (!orderInventoryValid(existing)) throw new Error("替换后会超过命令标记数量。 ");
    if (existing.filter(orderIsStar).length > starAllowance(state, faction)) throw new Error("替换后星级命令过多。 ");
    if (orderForbidden(state, payload.order)) throw new Error("本轮禁止该类命令。 ");
    area.order = payload.order;
  }
  state.ravenUsed = true;
  state.ravenPeekedBy = null;
  state.currentPlayerId = null;
  addLog(state, `${player.name} 完成了信鸦调整。`);
  beginOrderPhase(state, "raid");
  touch(state);
  processRealmBots(state);
}

function thronePlayers(state: RealmState) {
  return state.influence.throne.map((faction) => factionPlayer(state, faction)).filter((player): player is RealmPlayerState => Boolean(player));
}

function phaseFamily(phase: RealmPhase) {
  if (phase === "raid" || phase === "march" || phase === "consolidate") return phase === "consolidate" ? "power" : phase;
  return null;
}

function factionHasOrder(state: RealmState, faction: string, family: string) {
  return REALM_AREAS.some((area) => realmAreaOwner(state, area.key) === faction && state.areas[area.key].order && orderFamily(state.areas[area.key].order!) === family);
}

function selectNextResolver(state: RealmState) {
  const family = phaseFamily(state.phase);
  if (!family) return;
  const players = thronePlayers(state);
  for (let offset = 0; offset < players.length; offset += 1) {
    const index = (state.resolverCursor + offset) % players.length;
    const faction = requireFaction(players[index]);
    if (factionHasOrder(state, faction, family)) {
      state.currentPlayerId = players[index].id;
      state.resolverCursor = (index + 1) % players.length;
      return;
    }
  }
  state.currentPlayerId = null;
  if (state.phase === "raid") beginOrderPhase(state, "march");
  else if (state.phase === "march") beginOrderPhase(state, "consolidate");
  else finishActionPhase(state);
}

function beginOrderPhase(state: RealmState, phase: "raid" | "march" | "consolidate") {
  state.phase = phase;
  state.resolverCursor = 0;
  state.currentPlayerId = null;
  selectNextResolver(state);
}

function orderAreaForPlayer(state: RealmState, player: RealmPlayerState, areaId: string, family: string) {
  const faction = requireFaction(player);
  const area = state.areas[areaId];
  if (!area || realmAreaOwner(state, areaId) !== faction || !area.order || orderFamily(area.order) !== family) {
    throw new Error("请选择自己尚未结算的正确命令。 ");
  }
  return area;
}

function raidCanTarget(source: RealmAreaDefinition, target: RealmAreaDefinition, sourceOrder: RealmOrderType, targetOrder: RealmOrderType) {
  if (!source.adjacent.includes(target.key)) return false;
  if (source.kind === "land" && target.kind !== "land") return false;
  if (source.kind === "port" && target.kind !== "sea") return false;
  const family = orderFamily(targetOrder);
  if (["raid", "support", "power"].includes(family)) return true;
  return sourceOrder === "raid_star" && family === "defend";
}

export function resolveRealmRaid(state: RealmState, playerId: string, sourceAreaId: string, targetAreaId?: string) {
  if (state.phase !== "raid" || state.currentPlayerId !== playerId) throw new Error("现在轮不到你结算突袭。 ");
  const player = requirePlayer(state, playerId);
  const source = orderAreaForPlayer(state, player, sourceAreaId, "raid");
  const sourceDefinition = realmArea(sourceAreaId)!;
  if (targetAreaId) {
    const target = state.areas[targetAreaId];
    const targetDefinition = realmArea(targetAreaId);
    if (!target || !targetDefinition || !target.order || realmAreaOwner(state, targetAreaId) === requireFaction(player) || !raidCanTarget(sourceDefinition, targetDefinition, source.order!, target.order)) {
      throw new Error("这个命令不能被当前突袭取消。 ");
    }
    if (orderFamily(target.order) === "power") {
      const victimFaction = realmAreaOwner(state, targetAreaId);
      const victim = victimFaction ? factionPlayer(state, victimFaction) : null;
      player.power = Math.min(20, player.power + 1);
      if (victim) victim.power = Math.max(0, victim.power - 1);
      addLog(state, `${player.name} 洗劫${targetDefinition.name}：获得 1 威望${victim ? "，守方失去 1 威望" : ""}。`);
    }
    target.order = null;
    addLog(state, `${player.name} 从${sourceDefinition.name}发动突袭，取消了${targetDefinition.name}的命令。`);
  } else {
    addLog(state, `${player.name} 放弃了${sourceDefinition.name}的突袭。`);
  }
  source.order = null;
  selectNextResolver(state);
  touch(state);
  processRealmBots(state);
}

function unitCanEnter(unit: RealmUnit, target: RealmAreaDefinition) {
  return unit.type === "ship" ? target.kind === "sea" || target.kind === "port" : target.kind === "land";
}

function seaControlledBy(state: RealmState, seaId: string, faction: string) {
  const definition = realmArea(seaId);
  return definition?.kind === "sea" && state.areas[seaId].units.some((unit) => unit.faction === faction && unit.type === "ship");
}

function canShipTransport(state: RealmState, source: RealmAreaDefinition, target: RealmAreaDefinition, faction: string) {
  if (source.kind !== "land" || target.kind !== "land") return false;
  const starts = source.adjacent.filter((key) => seaControlledBy(state, key, faction));
  const destinationSeas = new Set(target.adjacent.filter((key) => realmArea(key)?.kind === "sea"));
  const queue = [...starts];
  const seen = new Set(queue);
  while (queue.length) {
    const sea = queue.shift()!;
    if (destinationSeas.has(sea)) return true;
    for (const adjacent of realmArea(sea)?.adjacent ?? []) {
      if (!seen.has(adjacent) && seaControlledBy(state, adjacent, faction)) {
        seen.add(adjacent);
        queue.push(adjacent);
      }
    }
  }
  return false;
}

function moveIsAdjacent(state: RealmState, source: RealmAreaDefinition, target: RealmAreaDefinition, faction: string, unit: RealmUnit) {
  if (source.adjacent.includes(target.key)) return unitCanEnter(unit, target);
  return unit.type !== "ship" && canShipTransport(state, source, target, faction);
}

function unitStrength(unit: RealmUnit, attackingCastle: boolean, leaderEffect?: string, attacking = false) {
  if (unit.routed) return 0;
  if (unit.type === "siege") return attacking && attackingCastle ? 4 : 0;
  let strength = REALM_UNIT_STRENGTH[unit.type];
  if (leaderEffect === "footman_attack" && attacking && unit.type === "footman") strength = 2;
  if (leaderEffect === "ship_attack" && attacking && unit.type === "ship") strength += 1;
  return strength;
}

function areaArmySizes(state: RealmState, faction: string, virtual?: { areaId: string; units: RealmUnit[] }[]) {
  const virtualMap = new Map(virtual?.map((entry) => [entry.areaId, entry.units]));
  return REALM_AREAS.map((definition) => {
    const units = virtualMap.get(definition.key) ?? state.areas[definition.key].units;
    return units.filter((unit) => unit.faction === faction).length;
  }).filter((size) => size >= 2).sort((a, b) => b - a);
}

function supplyValid(state: RealmState, faction: string, virtual?: { areaId: string; units: RealmUnit[] }[]) {
  const player = factionPlayer(state, faction)!;
  const limits = REALM_SUPPLY_LIMITS[Math.max(0, Math.min(6, player.supply))];
  const armies = areaArmySizes(state, faction, virtual);
  if (armies.length > limits.length) return false;
  return armies.every((size, index) => size <= limits[index]);
}

function leaveAreaControl(state: RealmState, player: RealmPlayerState, areaId: string, leavePower: boolean) {
  const definition = realmArea(areaId)!;
  const area = state.areas[areaId];
  if (definition.kind !== "land" || area.units.length) return;
  if (leavePower && player.power > 0) {
    player.power -= 1;
    area.control = requireFaction(player);
    area.controlToken = true;
  } else {
    area.control = definition.homeOf ?? null;
    area.controlToken = false;
  }
  const port = REALM_AREAS.find((candidate) => candidate.kind === "port" && candidate.portOf === areaId);
  if (port && state.areas[port.key].units.length) {
    if (area.control) replacePortShips(state, areaId, area.control);
    else state.areas[port.key].units = [];
  }
}

function takeAreaControl(state: RealmState, faction: string, areaId: string) {
  const definition = realmArea(areaId)!;
  const area = state.areas[areaId];
  if (definition.kind !== "land") return;
  area.control = faction;
  area.controlToken = false;
  if (definition.portOf) return;
}

function supportingAreas(state: RealmState, targetAreaId: string) {
  const target = realmArea(targetAreaId)!;
  return REALM_AREAS.filter((source) => {
    const order = state.areas[source.key].order;
    if (!order || orderFamily(order) !== "support" || !source.adjacent.includes(targetAreaId)) return false;
    if (source.kind === "land" && target.kind !== "land") return false;
    if (source.kind === "port" && target.kind !== "sea") return false;
    return state.areas[source.key].units.some((unit) => !unit.routed);
  });
}

function neutralAttackStrength(state: RealmState, faction: string, targetAreaId: string, units: RealmUnit[], marchOrder: RealmOrderType) {
  const target = realmArea(targetAreaId)!;
  let strength = units.reduce((sum, unit) => sum + unitStrength(unit, Boolean(target.castle), undefined, true), 0) + orderModifier(marchOrder);
  for (const support of supportingAreas(state, targetAreaId)) {
    if (realmAreaOwner(state, support.key) !== faction) continue;
    const modifier = orderModifier(state.areas[support.key].order!);
    strength += state.areas[support.key].units.reduce((sum, unit) => sum + unitStrength(unit, Boolean(target.castle)), 0) + modifier;
  }
  return strength;
}

function replacePortShips(state: RealmState, landAreaId: string, faction: string) {
  const port = REALM_AREAS.find((area) => area.kind === "port" && area.portOf === landAreaId);
  if (!port) return;
  const portState = state.areas[port.key];
  if (!portState.units.length || portState.units.every((unit) => unit.faction === faction)) return;
  const count = Math.min(3, portState.units.length, UNIT_LIMITS.ship - unitsOnBoard(state, faction, "ship"));
  portState.units = Array.from({ length: count }, () => ({ id: randomId("unit"), faction, type: "ship" as const, routed: false }));
}

function areaHasHostileForces(state: RealmState, areaId: string, faction: string) {
  const area = state.areas[areaId];
  if (!area || area.blocked) return false;
  return area.units.some((unit) => unit.faction !== faction)
    || Boolean(area.garrison && realmAreaOwner(state, areaId) && realmAreaOwner(state, areaId) !== faction);
}

function unitsOnBoard(state: RealmState, faction: string, type: RealmUnitType) {
  return Object.values(state.areas).flatMap((area) => area.units).filter((unit) => unit.faction === faction && unit.type === type).length
    + (state.pendingCombat?.attackingUnits.filter((unit) => unit.faction === faction && unit.type === type).length ?? 0);
}

function createCombat(state: RealmState, sourceAreaId: string, targetAreaId: string, attackerFaction: string, units: RealmUnit[], marchOrder: RealmOrderType) {
  const defenderFaction = realmAreaOwner(state, targetAreaId);
  if (!defenderFaction || defenderFaction === attackerFaction) throw new Error("目标区域没有敌军。 ");
  const supports = supportingAreas(state, targetAreaId);
  const supportQueue = supports.map((area) => area.key).sort((a, b) => {
    const first = state.influence.throne.indexOf(realmAreaOwner(state, a) ?? "");
    const second = state.influence.throne.indexOf(realmAreaOwner(state, b) ?? "");
    return first - second;
  });
  const tideCard = () => {
    if (!state.tidesOfBattle) return { strength: 0, sword: 0, skull: false };
    const roll = Math.floor(Math.random() * 12);
    return { strength: [-1, 0, 0, 0, 1, 1, 1, 2, 2, 3, 0, 1][roll], sword: roll === 9 ? 1 : 0, skull: roll === 10 };
  };
  state.pendingCombat = {
    sourceAreaId,
    targetAreaId,
    attackerFaction,
    defenderFaction,
    attackingUnits: units,
    marchOrder,
    supportQueue,
    supportChoices: Object.fromEntries(supportQueue.map((areaId) => [areaId, null])),
    leaderChoices: { [attackerFaction]: null, [defenderFaction]: null },
    leaderConfirmed: [],
    blockedLeaderKeys: { [attackerFaction]: [], [defenderFaction]: [] },
    cancelResolved: false,
    immediateEffectsResolved: false,
    bladeFaction: null,
    bladeUsed: false,
    tide: { [attackerFaction]: tideCard(), [defenderFaction]: tideCard() },
    winnerFaction: null,
    loserFaction: null,
    casualtiesRequired: 0,
    retreatOptions: [],
    preventAdvance: false,
    keepMarchOrder: false,
  };
  if (supportQueue.length) beginCombatSupport(state);
  else beginCombatCards(state);
}

function beginCombatSupport(state: RealmState) {
  const combat = state.pendingCombat!;
  const nextAreaId = combat.supportQueue.find((areaId) => combat.supportChoices[areaId] === null);
  if (!nextAreaId) return beginCombatCards(state);
  const owner = realmAreaOwner(state, nextAreaId)!;
  const player = factionPlayer(state, owner)!;
  state.phase = "combat_support";
  state.currentPlayerId = player.id;
}

function beginCombatCards(state: RealmState) {
  const combat = state.pendingCombat!;
  state.phase = "combat_cards";
  const unresolved = [combat.attackerFaction, combat.defenderFaction].find((faction) => !combat.leaderChoices[faction]);
  state.currentPlayerId = unresolved ? factionPlayer(state, unresolved)!.id : null;
  if (!unresolved) prepareCombatRevealEffects(state);
}

export function resolveRealmMarch(
  state: RealmState,
  playerId: string,
  sourceAreaId: string,
  moves: RealmMarchMove[],
  leavePower = false,
) {
  if (state.phase !== "march" || state.currentPlayerId !== playerId) throw new Error("现在轮不到你结算行军。 ");
  const player = requirePlayer(state, playerId);
  const faction = requireFaction(player);
  const source = orderAreaForPlayer(state, player, sourceAreaId, "march");
  const sourceDefinition = realmArea(sourceAreaId)!;
  const order = source.order!;
  const unitIds = moves.flatMap((move) => move.unitIds);
  if (new Set(unitIds).size !== unitIds.length) throw new Error("同一支部队不能被移动两次。 ");
  const selected = new Map(source.units.filter((unit) => unitIds.includes(unit.id)).map((unit) => [unit.id, unit]));
  if (selected.size !== unitIds.length || [...selected.values()].some((unit) => unit.faction !== faction || unit.routed)) throw new Error("行军中包含无效部队。 ");
  const hostileMoves = moves.filter((move) => areaHasHostileForces(state, move.to, faction) || Boolean(state.areas[move.to]?.neutral));
  if (hostileMoves.length > 1) throw new Error("每枚行军命令最多发起一场战斗。 ");
  for (const move of moves) {
    const targetDefinition = realmArea(move.to);
    if (!targetDefinition || state.areas[move.to]?.blocked || !move.unitIds.length) throw new Error("请选择有效的行军目的地。 ");
    for (const id of move.unitIds) {
      const unit = selected.get(id)!;
      if (!moveIsAdjacent(state, sourceDefinition, targetDefinition, faction, unit)) throw new Error("部队不能通过这条路线移动。 ");
    }
    if (targetDefinition.kind === "port" && realmAreaOwner(state, targetDefinition.portOf!) !== faction) throw new Error("不能直接进入敌方港口。 ");
  }
  source.units = source.units.filter((unit) => !unitIds.includes(unit.id));
  let pendingHostile: { move: RealmMarchMove; units: RealmUnit[] } | null = null;
  for (const move of moves) {
    const movingUnits = move.unitIds.map((id) => selected.get(id)!);
    const target = state.areas[move.to];
    if (areaHasHostileForces(state, move.to, faction) || target.neutral) {
      pendingHostile = { move, units: movingUnits };
      continue;
    }
    target.units.push(...movingUnits);
    takeAreaControl(state, faction, move.to);
    replacePortShips(state, move.to, faction);
    if (!supplyValid(state, faction)) throw new Error("这次行军会超过补给允许的军团规模。 ");
  }
  leaveAreaControl(state, player, sourceAreaId, leavePower);
  if (!pendingHostile) {
    source.order = null;
    addLog(state, `${player.name} 从${sourceDefinition.name}完成行军。`);
    selectNextResolver(state);
  } else {
    const { move, units } = pendingHostile;
    const target = state.areas[move.to];
    const targetDefinition = realmArea(move.to)!;
    if (target.neutral) {
      const strength = neutralAttackStrength(state, faction, move.to, units, order);
      if (target.neutral >= 99 || strength < target.neutral) throw new Error("进军战力不足以击败中立势力。 ");
      target.neutral = null;
      target.units.push(...units);
      takeAreaControl(state, faction, move.to);
      replacePortShips(state, move.to, faction);
      source.order = null;
      addLog(state, `${player.name} 击溃${targetDefinition.name}的中立守军。`);
      if (!supplyValid(state, faction)) throw new Error("占领后会超过补给限制。 ");
      checkRealmVictory(state);
      if (!state.winnerId) selectNextResolver(state);
    } else {
      addLog(state, `${player.name} 从${sourceDefinition.name}进攻${targetDefinition.name}。`);
      createCombat(state, sourceAreaId, move.to, faction, units, order);
    }
  }
  touch(state);
  processRealmBots(state);
}

export function chooseRealmSupport(state: RealmState, playerId: string, supportAreaId: string, side: CombatSide) {
  if (state.phase !== "combat_support" || state.currentPlayerId !== playerId || !state.pendingCombat) throw new Error("现在不能决定支援。 ");
  const combat = state.pendingCombat;
  const supportingFaction = requireFaction(requirePlayer(state, playerId));
  if (combat.supportChoices[supportAreaId] !== null || realmAreaOwner(state, supportAreaId) !== supportingFaction) throw new Error("这不是你的待决支援。 ");
  if (side !== "none" && ![combat.attackerFaction, combat.defenderFaction].includes(side === "attacker" ? combat.attackerFaction : combat.defenderFaction)) throw new Error("请选择战斗一方。 ");
  if (supportingFaction === combat.attackerFaction && side === "defender" || supportingFaction === combat.defenderFaction && side === "attacker") throw new Error("不能用自己的支援命令帮助敌人对抗自己。 ");
  const houseSupportAreas = combat.supportQueue.filter((areaId) => realmAreaOwner(state, areaId) === supportingFaction && combat.supportChoices[areaId] === null);
  for (const areaId of houseSupportAreas) combat.supportChoices[areaId] = side;
  addLog(state, `${requirePlayer(state, playerId).name} 以全部 ${houseSupportAreas.length} 枚支援命令宣布${side === "none" ? "不提供支援" : side === "attacker" ? "支援进攻方" : "支援防守方"}。`);
  beginCombatSupport(state);
  touch(state);
  processRealmBots(state);
}

export function chooseRealmLeader(state: RealmState, playerId: string, leaderKey: string) {
  if (state.phase !== "combat_cards" || state.currentPlayerId !== playerId || !state.pendingCombat) throw new Error("现在不能打出领袖牌。 ");
  const player = requirePlayer(state, playerId);
  const faction = requireFaction(player);
  const combat = state.pendingCombat;
  if (![combat.attackerFaction, combat.defenderFaction].includes(faction)) throw new Error("你不在这场战斗中。 ");
  if (!player.leaderHand.includes(leaderKey) || combat.blockedLeaderKeys[faction].includes(leaderKey)) throw new Error("这张领袖牌当前不能使用。 ");
  const previousChoice = combat.leaderChoices[faction];
  if (previousChoice) {
    const previousLeader = realmLeader(previousChoice)!;
    if (previousLeader.effect !== "reselect_card" || combat.leaderConfirmed.includes(faction)) throw new Error("你已经选好领袖牌。 ");
    if (leaderKey === previousChoice) {
      combat.leaderConfirmed.push(faction);
    } else {
      if (player.power < 2) throw new Error("改选领袖需要支付 2 威望。 ");
      player.power -= 2;
      discardLeader(player, previousChoice);
      combat.leaderChoices[faction] = leaderKey;
      combat.leaderConfirmed.push(faction);
    }
  } else {
    combat.leaderChoices[faction] = leaderKey;
    const leader = realmLeader(leaderKey)!;
    const canReselect = leader.effect === "reselect_card" && player.power >= 2 && player.leaderHand.some((key) => key !== leaderKey && !combat.blockedLeaderKeys[faction].includes(key));
    if (!canReselect) combat.leaderConfirmed.push(faction);
  }
  if (Object.values(combat.leaderChoices).every(Boolean) && combat.leaderConfirmed.length === 2 && !combat.cancelResolved) {
    const cancelFaction = [combat.attackerFaction, combat.defenderFaction].find((candidate) => realmLeader(combat.leaderChoices[candidate]!)?.effect === "cancel_card");
    if (cancelFaction) {
      combat.cancelResolved = true;
      const opponentFaction = cancelFaction === combat.attackerFaction ? combat.defenderFaction : combat.attackerFaction;
      const opponentChoice = combat.leaderChoices[opponentFaction]!;
      const opponent = factionPlayer(state, opponentFaction)!;
      const hasAlternative = opponent.leaderHand.some((key) => key !== opponentChoice && !combat.blockedLeaderKeys[opponentFaction].includes(key));
      if (hasAlternative) {
        combat.blockedLeaderKeys[opponentFaction].push(opponentChoice);
        combat.leaderChoices[opponentFaction] = null;
        combat.leaderConfirmed = combat.leaderConfirmed.filter((candidate) => candidate !== opponentFaction);
      }
    }
  }
  const unresolved = [combat.attackerFaction, combat.defenderFaction].find((candidate) => !combat.leaderChoices[candidate] || !combat.leaderConfirmed.includes(candidate));
  state.currentPlayerId = unresolved ? factionPlayer(state, unresolved)!.id : null;
  if (!unresolved) prepareCombatRevealEffects(state);
  touch(state);
  processRealmBots(state);
}

function startCombatEffects(state: RealmState, effects: RealmCombatEffect[], resume: "combat_strength" | "march") {
  if (!effects.length) {
    if (resume === "combat_strength") prepareBladeDecision(state);
    else completeCombatAndResume(state);
    return;
  }
  effects.sort((first, second) => state.influence.throne.indexOf(first.actorFaction) - state.influence.throne.indexOf(second.actorFaction));
  state.combatEffects = effects;
  state.combatEffectResume = resume;
  state.phase = "combat_effect";
  state.currentPlayerId = factionPlayer(state, effects[0].actorFaction)!.id;
}

function prepareCombatRevealEffects(state: RealmState) {
  const combat = state.pendingCombat!;
  const effects: RealmCombatEffect[] = [];
  for (const faction of [combat.attackerFaction, combat.defenderFaction]) {
    const leader = realmLeader(combat.leaderChoices[faction]!)!;
    if (leader.effect !== "remove_adjacent_order") continue;
    const opponent = faction === combat.attackerFaction ? combat.defenderFaction : combat.attackerFaction;
    const options = REALM_AREAS.filter((area) => area.key !== combat.sourceAreaId && realmArea(combat.targetAreaId)?.adjacent.includes(area.key) && realmAreaOwner(state, area.key) === opponent && state.areas[area.key].order).map((area) => area.key);
    if (options.length) effects.push({ actorFaction: faction, targetFaction: opponent, type: "remove_adjacent_order", options, optional: false });
  }
  startCombatEffects(state, effects, "combat_strength");
}

export function resolveRealmCombatEffect(state: RealmState, playerId: string, option?: string) {
  if (state.phase !== "combat_effect" || state.currentPlayerId !== playerId || !state.combatEffects.length) throw new Error("现在不能结算领袖能力。 ");
  const effect = state.combatEffects[0];
  if (requireFaction(requirePlayer(state, playerId)) !== effect.actorFaction) throw new Error("这不是你的领袖能力。 ");
  if (!option) {
    if (!effect.optional) throw new Error("这个能力必须选择一个目标。 ");
  } else {
    if (!effect.options.includes(option)) throw new Error("这不是有效的能力目标。 ");
    if (effect.type === "remove_adjacent_order" || effect.type === "remove_order") state.areas[option].order = null;
    else if (effect.type === "move_influence_bottom") moveFactionToTrackEnd(state, effect.targetFaction, option as "throne" | "fiefdom" | "court");
    else if (effect.type === "discard_enemy_card") {
      const opponent = factionPlayer(state, effect.targetFaction)!;
      if (opponent.leaderHand.includes(option)) discardLeader(opponent, option);
    } else if (effect.type === "upgrade_unit") {
      const unit = Object.values(state.areas).flatMap((area) => area.units).find((candidate) => candidate.id === option && candidate.faction === effect.actorFaction && candidate.type === "footman");
      if (unit && unitsOnBoard(state, effect.actorFaction, "knight") < UNIT_LIMITS.knight) unit.type = "knight";
    }
  }
  state.combatEffects.shift();
  if (state.combatEffects.length) state.currentPlayerId = factionPlayer(state, state.combatEffects[0].actorFaction)!.id;
  else {
    const resume = state.combatEffectResume;
    state.combatEffectResume = null;
    state.currentPlayerId = null;
    if (resume === "combat_strength") prepareBladeDecision(state);
    else completeCombatAndResume(state);
  }
  touch(state);
  processRealmBots(state);
}

function prepareBladeDecision(state: RealmState) {
  const combat = state.pendingCombat!;
  const holder = state.influence.fiefdom[0];
  if (!state.bladeUsed && [combat.attackerFaction, combat.defenderFaction].includes(holder)) {
    combat.bladeFaction = holder;
    state.phase = "combat_blade";
    state.currentPlayerId = factionPlayer(state, holder)!.id;
  } else {
    resolveCombatStrength(state);
  }
}

export function resolveRealmBlade(state: RealmState, playerId: string, use: boolean) {
  if (state.phase !== "combat_blade" || state.currentPlayerId !== playerId || !state.pendingCombat) throw new Error("现在不能决定钢剑。 ");
  const faction = requireFaction(requirePlayer(state, playerId));
  if (state.pendingCombat.bladeFaction !== faction) throw new Error("你没有钢剑。 ");
  if (use) {
    state.pendingCombat.bladeUsed = true;
    state.bladeUsed = true;
  }
  resolveCombatStrength(state);
  touch(state);
  processRealmBots(state);
}

function supportStrength(state: RealmState, combat: RealmCombat, side: "attacker" | "defender", leaderEffect: string, opposingLeaderEffect: string) {
  const cancelFaction = [combat.attackerFaction, combat.defenderFaction].find((faction) => realmLeader(combat.leaderChoices[faction]!)?.effect === "cancel_ship_support");
  const supportedFaction = side === "attacker" ? combat.attackerFaction : combat.defenderFaction;
  return Object.entries(combat.supportChoices).reduce((sum, [areaId, choice]) => {
    if (choice !== side) return sum;
    const order = state.areas[areaId].order;
    if (!order || orderFamily(order) !== "support") return sum;
    const units = state.areas[areaId].units.filter((unit) => !(unit.type === "ship" && (opposingLeaderEffect === "cancel_ship_support" || cancelFaction && unit.faction !== cancelFaction)));
    return sum + units.reduce((total, unit) => total + unitStrength(unit, Boolean(realmArea(combat.targetAreaId)?.castle), unit.faction === supportedFaction ? leaderEffect : undefined, side === "attacker"), 0) + orderModifier(order);
  }, 0);
}

function leaderIcons(state: RealmState, combat: RealmCombat, faction: string) {
  const leader = realmLeader(combat.leaderChoices[faction]!)!;
  let swords = leader.swords;
  let forts = leader.forts;
  if (leader.effect === "solo_icons") {
    const side = faction === combat.attackerFaction ? "attacker" : "defender";
    if (!Object.values(combat.supportChoices).includes(side)) { swords += 2; forts += 1; }
  }
  if (leader.effect === "home_defense" && faction === combat.defenderFaction && realmArea(combat.targetAreaId)?.homeOf === faction) forts += 1;
  if (leader.effect === "castle_defense" && faction === combat.defenderFaction && realmArea(combat.targetAreaId)?.castle) swords += 1;
  if (leader.effect === "stance_icon") {
    if (faction === combat.attackerFaction) swords += 1;
    else forts += 1;
  }
  if (leader.effect === "discard_synergy" && factionPlayer(state, faction)?.leaderDiscard.includes(`${faction}_4`)) swords += 1;
  return { swords, forts };
}

function combatStrength(state: RealmState, combat: RealmCombat, faction: string) {
  const attacking = faction === combat.attackerFaction;
  const leader = realmLeader(combat.leaderChoices[faction]!)!;
  const opponentFaction = attacking ? combat.defenderFaction : combat.attackerFaction;
  const opponentLeader = realmLeader(combat.leaderChoices[opponentFaction]!)!;
  const targetDefinition = realmArea(combat.targetAreaId)!;
  const cancelFaction = [combat.attackerFaction, combat.defenderFaction].find((candidate) => realmLeader(combat.leaderChoices[candidate]!)?.effect === "cancel_ship_support");
  const units = (attacking ? combat.attackingUnits : state.areas[combat.targetAreaId].units.filter((unit) => unit.faction === faction))
    .filter((unit) => !(unit.type === "ship" && cancelFaction && unit.faction !== cancelFaction));
  let total = units.reduce((sum, unit) => sum + unitStrength(unit, Boolean(targetDefinition.castle), leader.effect, attacking), 0);
  if (attacking) total += orderModifier(combat.marchOrder);
  else {
    const defenseOrder = state.areas[combat.targetAreaId].order;
    if (defenseOrder && orderFamily(defenseOrder) === "defend") {
      const modifier = orderModifier(defenseOrder);
      total += leader.effect === "double_defense" ? modifier * 2 : modifier;
    }
    total += state.areas[combat.targetAreaId].garrison ?? 0;
  }
  total += supportStrength(state, combat, attacking ? "attacker" : "defender", leader.effect, opponentLeader.effect);
  total += opponentLeader.effect === "enemy_card_zero" ? 0 : leader.strength;
  total += combat.tide[faction]?.strength ?? 0;
  if (combat.bladeUsed && combat.bladeFaction === faction) total += 1;
  if (leader.effect === "throne_rival" && state.influence.throne.indexOf(opponentFaction) < state.influence.throne.indexOf(faction)) total += 1;
  if (leader.effect === "discard_synergy" && factionPlayer(state, faction)?.leaderDiscard.includes(`${faction}_4`)) total += 1;
  if (leader.effect === "castle_defense" && !attacking && targetDefinition.castle) total += 1;
  return total;
}

function destroyImmediateFootman(combat: RealmCombat, state: RealmState, faction: string) {
  const target = faction === combat.attackerFaction ? combat.attackingUnits : state.areas[combat.targetAreaId].units;
  const footman = target.find((unit) => unit.faction === faction && unit.type === "footman");
  if (!footman) return;
  if (faction === combat.attackerFaction) combat.attackingUnits = combat.attackingUnits.filter((unit) => unit.id !== footman.id);
  else state.areas[combat.targetAreaId].units = state.areas[combat.targetAreaId].units.filter((unit) => unit.id !== footman.id);
}

function resolveCombatStrength(state: RealmState) {
  const combat = state.pendingCombat!;
  const attackerLeader = realmLeader(combat.leaderChoices[combat.attackerFaction]!)!;
  const defenderLeader = realmLeader(combat.leaderChoices[combat.defenderFaction]!)!;
  if (!combat.immediateEffectsResolved) {
    combat.immediateEffectsResolved = true;
    if (attackerLeader.effect === "destroy_footman" && defenderLeader.effect !== "no_casualties") destroyImmediateFootman(combat, state, combat.defenderFaction);
    if (defenderLeader.effect === "destroy_footman" && attackerLeader.effect !== "no_casualties") destroyImmediateFootman(combat, state, combat.attackerFaction);
  }
  if (attackerLeader.effect === "remove_defense" || defenderLeader.effect === "remove_defense") {
    if (state.areas[combat.targetAreaId].order && orderFamily(state.areas[combat.targetAreaId].order!) === "defend") state.areas[combat.targetAreaId].order = null;
  }
  const attackerStrength = combatStrength(state, combat, combat.attackerFaction);
  const defenderStrength = combatStrength(state, combat, combat.defenderFaction);
  const winner = attackerStrength > defenderStrength
    ? combat.attackerFaction
    : defenderStrength > attackerStrength
      ? combat.defenderFaction
      : state.influence.fiefdom.indexOf(combat.attackerFaction) < state.influence.fiefdom.indexOf(combat.defenderFaction)
        ? combat.attackerFaction
        : combat.defenderFaction;
  const loser = winner === combat.attackerFaction ? combat.defenderFaction : combat.attackerFaction;
  combat.winnerFaction = winner;
  combat.loserFaction = loser;
  const winnerIcons = leaderIcons(state, combat, winner);
  const loserIcons = leaderIcons(state, combat, loser);
  const leaderSwordCasualties = realmLeader(combat.leaderChoices[loser]!)?.effect === "no_casualties" ? 0 : winnerIcons.swords;
  combat.casualtiesRequired = Math.max(0, leaderSwordCasualties + (combat.tide[winner]?.sword ?? 0) - loserIcons.forts);
  if (combat.tide[loser]?.skull) combat.casualtiesRequired += 1;
  const loserUnits = loser === combat.attackerFaction ? combat.attackingUnits : state.areas[combat.targetAreaId].units.filter((unit) => unit.faction === loser);
  const forced = loserUnits.filter((unit) => unit.type === "siege" || unit.routed);
  combat.casualtiesRequired = Math.min(loserUnits.length, Math.max(combat.casualtiesRequired, forced.length));
  combat.preventAdvance = defenderLeader.effect === "no_attacker_advance" && winner === combat.attackerFaction;
  combat.keepMarchOrder = attackerLeader.effect === "march_again" && winner === combat.attackerFaction;
  if (combat.casualtiesRequired > 0 && loserUnits.length > 0) {
    state.phase = "combat_casualties";
    state.currentPlayerId = factionPlayer(state, loser)!.id;
  } else {
    beginRetreat(state);
  }
}

export function chooseRealmCasualties(state: RealmState, playerId: string, unitIds: string[]) {
  if (state.phase !== "combat_casualties" || state.currentPlayerId !== playerId || !state.pendingCombat) throw new Error("现在不能选择伤亡。 ");
  const combat = state.pendingCombat;
  const loser = combat.loserFaction!;
  if (requireFaction(requirePlayer(state, playerId)) !== loser) throw new Error("这不是你的伤亡。 ");
  const units = loser === combat.attackerFaction ? combat.attackingUnits : state.areas[combat.targetAreaId].units.filter((unit) => unit.faction === loser);
  const forcedIds = units.filter((unit) => unit.type === "siege" || unit.routed).map((unit) => unit.id);
  const chosen = [...new Set([...unitIds, ...forcedIds])];
  if (chosen.length !== Math.min(units.length, combat.casualtiesRequired) || chosen.some((id) => !units.some((unit) => unit.id === id))) throw new Error("请选择正确数量的伤亡部队。 ");
  if (loser === combat.attackerFaction) combat.attackingUnits = combat.attackingUnits.filter((unit) => !chosen.includes(unit.id));
  else state.areas[combat.targetAreaId].units = state.areas[combat.targetAreaId].units.filter((unit) => !chosen.includes(unit.id));
  beginRetreat(state);
  touch(state);
  processRealmBots(state);
}

function retreatOptions(state: RealmState, combat: RealmCombat) {
  if (combat.loserFaction === combat.attackerFaction) {
    const owner = realmAreaOwner(state, combat.sourceAreaId);
    return !owner || owner === combat.attackerFaction ? [combat.sourceAreaId] : [];
  }
  const source = realmArea(combat.targetAreaId)!;
  const units = state.areas[combat.targetAreaId].units.filter((unit) => unit.faction === combat.defenderFaction);
  return REALM_AREAS.filter((target) => {
    if (target.key === combat.sourceAreaId || target.kind !== source.kind || state.areas[target.key].blocked) return false;
    const owner = realmAreaOwner(state, target.key);
    if (owner && owner !== combat.defenderFaction) return false;
    if (!units.every((unit) => moveIsAdjacent(state, source, target, combat.defenderFaction, unit))) return false;
    return true;
  }).map((area) => area.key);
}

function addRetreatingUnits(state: RealmState, faction: string, areaId: string, units: RealmUnit[]) {
  const routed = units.map((unit) => ({ ...unit, routed: true }));
  const existing = state.areas[areaId].units;
  const survivors = [...routed];
  while (survivors.length && !supplyValid(state, faction, [{ areaId, units: [...existing, ...survivors] }])) {
    survivors.sort((first, second) => REALM_UNIT_STRENGTH[first.type] - REALM_UNIT_STRENGTH[second.type]);
    survivors.shift();
  }
  state.areas[areaId].units.push(...survivors);
  const destroyed = routed.length - survivors.length;
  if (destroyed) addLog(state, `败军为符合补给在撤退途中移除了 ${destroyed} 支部队。`);
}

function beginRetreat(state: RealmState) {
  const combat = state.pendingCombat!;
  const loserUnits = combat.loserFaction === combat.attackerFaction
    ? combat.attackingUnits
    : state.areas[combat.targetAreaId].units.filter((unit) => unit.faction === combat.loserFaction);
  if (!loserUnits.length) return finishCombat(state, null);
  combat.retreatOptions = retreatOptions(state, combat);
  if (combat.loserFaction === combat.attackerFaction) return finishCombat(state, combat.retreatOptions[0] ?? null);
  if (!combat.retreatOptions.length) return finishCombat(state, null);
  state.phase = "combat_retreat";
  const winnerLeader = realmLeader(combat.leaderChoices[combat.winnerFaction!]!)!;
  state.currentPlayerId = factionPlayer(state, winnerLeader.effect === "retreat_choice" ? combat.winnerFaction! : combat.loserFaction!)!.id;
}

export function chooseRealmRetreat(state: RealmState, playerId: string, areaId: string) {
  if (state.phase !== "combat_retreat" || state.currentPlayerId !== playerId || !state.pendingCombat) throw new Error("现在不能选择撤退。 ");
  if (!state.pendingCombat.retreatOptions.includes(areaId)) throw new Error("不能撤退到该区域。 ");
  finishCombat(state, areaId);
  touch(state);
  processRealmBots(state);
}

function discardLeader(player: RealmPlayerState, leaderKey: string) {
  player.leaderHand = player.leaderHand.filter((key) => key !== leaderKey);
  player.leaderDiscard.push(leaderKey);
  if (!player.leaderHand.length) {
    const current = player.leaderDiscard.at(-1)!;
    player.leaderHand = player.leaderDiscard.filter((key) => key !== current);
    player.leaderDiscard = [current];
  }
}

function finishCombat(state: RealmState, retreatAreaId: string | null) {
  const combat = state.pendingCombat!;
  const attacker = factionPlayer(state, combat.attackerFaction)!;
  const defender = factionPlayer(state, combat.defenderFaction)!;
  const attackerWon = combat.winnerFaction === combat.attackerFaction;
  const defenderUnits = state.areas[combat.targetAreaId].units.filter((unit) => unit.faction === combat.defenderFaction);
  if (attackerWon) {
    state.areas[combat.targetAreaId].garrison = null;
    state.areas[combat.targetAreaId].units = state.areas[combat.targetAreaId].units.filter((unit) => unit.faction !== combat.defenderFaction);
    if (retreatAreaId) addRetreatingUnits(state, combat.defenderFaction, retreatAreaId, defenderUnits);
    if (combat.preventAdvance) {
      state.areas[combat.sourceAreaId].units.push(...combat.attackingUnits);
    } else {
      state.areas[combat.targetAreaId].units.push(...combat.attackingUnits);
      takeAreaControl(state, combat.attackerFaction, combat.targetAreaId);
      replacePortShips(state, combat.targetAreaId, combat.attackerFaction);
    }
  } else {
    if (retreatAreaId) addRetreatingUnits(state, combat.attackerFaction, retreatAreaId, combat.attackingUnits);
  }
  const attackerLeader = realmLeader(combat.leaderChoices[combat.attackerFaction]!)!;
  const defenderLeader = realmLeader(combat.leaderChoices[combat.defenderFaction]!)!;
  discardLeader(attacker, attackerLeader.key);
  discardLeader(defender, defenderLeader.key);
  const winnerPlayer = factionPlayer(state, combat.winnerFaction!)!;
  const winnerLeader = combat.winnerFaction === combat.attackerFaction ? attackerLeader : defenderLeader;
  if (winnerLeader.effect === "win_power") winnerPlayer.power = Math.min(20, winnerPlayer.power + (winnerLeader.strength >= 4 ? 2 : 1));
  const loserPlayer = factionPlayer(state, combat.loserFaction!)!;
  const loserLeader = combat.loserFaction === combat.attackerFaction ? attackerLeader : defenderLeader;
  if (loserLeader.effect === "recover_cards") {
    loserPlayer.leaderHand.push(...loserPlayer.leaderDiscard);
    loserPlayer.leaderDiscard = [];
  }
  if (!combat.keepMarchOrder || !state.areas[combat.sourceAreaId].units.some((unit) => unit.faction === combat.attackerFaction)) {
    state.areas[combat.sourceAreaId].order = null;
  }
  state.areas[combat.targetAreaId].order = null;
  addLog(state, `${winnerPlayer.name} 赢得${realmArea(combat.targetAreaId)?.name}之战。`);
  const effects: RealmCombatEffect[] = [];
  for (const [faction, leader] of [[combat.attackerFaction, attackerLeader], [combat.defenderFaction, defenderLeader]] as const) {
    const opponent = faction === combat.attackerFaction ? combat.defenderFaction : combat.attackerFaction;
    if (leader.effect === "move_influence_bottom") effects.push({ actorFaction: faction, targetFaction: opponent, type: "move_influence_bottom", options: ["throne", "fiefdom", "court"], optional: false });
    if (leader.effect === "discard_enemy_card") {
      const options = [...factionPlayer(state, opponent)!.leaderHand];
      if (options.length) effects.push({ actorFaction: faction, targetFaction: opponent, type: "discard_enemy_card", options, optional: false });
    }
  }
  if (winnerLeader.effect === "remove_order") {
    const options = REALM_AREAS.filter((area) => realmAreaOwner(state, area.key) === combat.loserFaction && state.areas[area.key].order).map((area) => area.key);
    if (options.length) effects.push({ actorFaction: combat.winnerFaction!, targetFaction: combat.loserFaction!, type: "remove_order", options, optional: true });
  }
  if (winnerLeader.effect === "upgrade_after_win" && unitsOnBoard(state, combat.winnerFaction!, "knight") < UNIT_LIMITS.knight) {
    const supportAreaIds = Object.entries(combat.supportChoices).filter(([, side]) => side === (combat.winnerFaction === combat.attackerFaction ? "attacker" : "defender")).map(([areaId]) => areaId);
    const allowedAreas = new Set([combat.sourceAreaId, combat.targetAreaId, ...supportAreaIds]);
    const options = REALM_AREAS.filter((definition) => allowedAreas.has(definition.key)).flatMap((definition) => state.areas[definition.key].units.filter((unit) => unit.faction === combat.winnerFaction && unit.type === "footman").map((unit) => unit.id));
    if (options.length) effects.push({ actorFaction: combat.winnerFaction!, targetFaction: combat.winnerFaction!, type: "upgrade_unit", options, optional: true });
  }
  state.pendingCombat = null;
  state.currentPlayerId = null;
  startCombatEffects(state, effects, "march");
}

function completeCombatAndResume(state: RealmState) {
  checkRealmVictory(state);
  if (state.phase !== "finished") {
    state.phase = "march";
    selectNextResolver(state);
  }
}

function controlledCastles(state: RealmState, faction: string) {
  return REALM_AREAS.reduce((sum, area) => sum + (area.castle && realmAreaOwner(state, area.key) === faction ? 1 : 0), 0);
}

function controlledSupply(state: RealmState, faction: string) {
  return REALM_AREAS.reduce((sum, area) => sum + (area.supply && realmAreaOwner(state, area.key) === faction ? area.supply : 0), 0);
}

function controlledLandAreas(state: RealmState, faction: string) {
  return REALM_AREAS.filter((area) => area.kind === "land" && realmAreaOwner(state, area.key) === faction).length;
}

function checkRealmVictory(state: RealmState) {
  const winner = state.players.find((player) => player.faction && controlledCastles(state, player.faction) >= 7);
  if (winner) finishRealmGame(state, winner.id);
}

function finishRealmGame(state: RealmState, winnerId?: string) {
  const ranking = [...state.players].sort((a, b) => {
    const firstFaction = requireFaction(a);
    const secondFaction = requireFaction(b);
    return controlledCastles(state, secondFaction) - controlledCastles(state, firstFaction)
      || controlledLandAreas(state, secondFaction) - controlledLandAreas(state, firstFaction)
      || controlledSupply(state, secondFaction) - controlledSupply(state, firstFaction)
      || state.influence.throne.indexOf(firstFaction) - state.influence.throne.indexOf(secondFaction);
  });
  state.phase = "finished";
  state.currentPlayerId = null;
  state.winnerId = winnerId ?? ranking[0]?.id ?? null;
  addLog(state, `${requirePlayer(state, state.winnerId!).name} 统一六境。`);
}

function musterPointsByArea(state: RealmState, faction: string) {
  return Object.fromEntries(REALM_AREAS.filter((area) => area.castle && realmAreaOwner(state, area.key) === faction).map((area) => [area.key, area.castle ?? 0]));
}

function applyMusterChoices(state: RealmState, player: RealmPlayerState, choices: RealmMusterChoice[], limitedToArea?: string) {
  const faction = requireFaction(player);
  const points = musterPointsByArea(state, faction);
  if (limitedToArea) {
    for (const key of Object.keys(points)) if (key !== limitedToArea) delete points[key];
  }
  for (const choice of choices) {
    if (!points[choice.sourceAreaId]) throw new Error("该区域没有可用征召点。 ");
    const source = realmArea(choice.sourceAreaId)!;
    let cost = REALM_UNIT_MUSTER_COST[choice.type];
    if (choice.upgradeUnitId) {
      const unit = state.areas[choice.sourceAreaId].units.find((candidate) => candidate.id === choice.upgradeUnitId && candidate.faction === faction && candidate.type === "footman");
      if (!unit || !["knight", "siege"].includes(choice.type)) throw new Error("只能将本地步兵升级为骑兵或攻城器。 ");
      cost = 1;
      if (points[choice.sourceAreaId] < cost) throw new Error("征召点不足。 ");
      if (unitsOnBoard(state, faction, choice.type) >= UNIT_LIMITS[choice.type]) throw new Error("该类型部队已经全部在版图上。 ");
      unit.type = choice.type;
    } else {
      const targetAreaId = choice.targetAreaId ?? choice.sourceAreaId;
      const targetDefinition = realmArea(targetAreaId);
      if (!targetDefinition) throw new Error("找不到征召目的地。 ");
      if (choice.type === "ship") {
        const legal = targetDefinition.kind === "port" && targetDefinition.portOf === source.key
          || targetDefinition.kind === "sea" && source.adjacent.includes(targetAreaId) && !state.areas[targetAreaId].units.some((unit) => unit.faction !== faction);
        if (!legal) throw new Error("舰船只能征召到相连港口或无敌舰的邻海。 ");
        if (targetDefinition.kind === "port" && state.areas[targetAreaId].units.length >= 3) throw new Error("港口最多容纳三艘舰船。 ");
      } else if (targetAreaId !== choice.sourceAreaId) throw new Error("陆军必须征召在提供征召点的城堡区域。 ");
      if (unitsOnBoard(state, faction, choice.type) >= UNIT_LIMITS[choice.type]) throw new Error("该类型部队已经全部在版图上。 ");
      placeUnit(state, faction, targetAreaId, choice.type);
      if (!supplyValid(state, faction)) {
        state.areas[targetAreaId].units.pop();
        throw new Error("征召会超过补给限制。 ");
      }
    }
    points[choice.sourceAreaId] -= cost;
    if (points[choice.sourceAreaId] < 0) throw new Error("征召点不足。 ");
  }
}

export function resolveRealmConsolidate(
  state: RealmState,
  playerId: string,
  areaId: string,
  mode: "power" | "muster",
  choices: RealmMusterChoice[] = [],
) {
  if (state.phase !== "consolidate" || state.currentPlayerId !== playerId) throw new Error("现在轮不到你结算集权命令。 ");
  const player = requirePlayer(state, playerId);
  const areaState = orderAreaForPlayer(state, player, areaId, "power");
  const definition = realmArea(areaId)!;
  if (mode === "muster") {
    if (areaState.order !== "power_star" || !definition.castle || definition.kind === "port") throw new Error("只有城堡区域的星级集权命令可以征召。 ");
    applyMusterChoices(state, player, choices, areaId);
    addLog(state, `${player.name} 在${definition.name}进行地方征召。`);
  } else {
    let gain = definition.kind === "sea" ? 0 : 1 + (definition.power ?? 0);
    if (definition.kind === "port" && definition.seaOf && state.areas[definition.seaOf].units.some((unit) => unit.faction !== requireFaction(player))) gain = 0;
    player.power = Math.min(20, player.power + gain);
    addLog(state, `${player.name} 从${definition.name}获得 ${gain} 威望。`);
  }
  areaState.order = null;
  selectNextResolver(state);
  touch(state);
  processRealmBots(state);
}

function finishActionPhase(state: RealmState) {
  for (const area of Object.values(state.areas)) {
    area.order = null;
    area.units.forEach((unit) => { unit.routed = false; });
  }
  state.players.forEach((player) => { player.submitted = false; });
  state.bladeUsed = false;
  state.ravenUsed = false;
  state.ravenPeekedBy = null;
  state.forbiddenOrderFamily = null;
  if (state.round >= 10) {
    finishRealmGame(state);
    return;
  }
  state.round += 1;
  beginWesterosPhase(state);
}

function drawEvent(state: RealmState, deck: 1 | 2 | 3) {
  let card = state.eventDecks[deck].shift();
  if (!card) {
    state.eventDecks[deck] = shuffle(state.eventDiscards[deck].splice(0));
    card = state.eventDecks[deck].shift()!;
  }
  while (card === "winter") {
    state.eventDecks[deck] = shuffle([...state.eventDecks[deck], ...state.eventDiscards[deck], card]);
    state.eventDiscards[deck] = [];
    card = state.eventDecks[deck].shift()!;
  }
  state.eventDiscards[deck].push(card);
  return card;
}

function beginWesterosPhase(state: RealmState) {
  state.phase = "events";
  const drawn = [drawEvent(state, 1), drawEvent(state, 2), drawEvent(state, 3)];
  state.eventQueue = drawn;
  const icons = drawn.reduce((sum, event) => sum + (EVENT_WILDLING_ICONS[event] ?? 0), 0);
  state.wildlingThreat = Math.min(12, state.wildlingThreat + icons);
  addLog(state, `第 ${state.round} 轮事件：${drawn.join(" / ")}。`);
  if (state.wildlingThreat >= 12) startWildlingBid(state, true);
  else continueEvents(state);
}

function continueEvents(state: RealmState) {
  while (state.eventQueue.length) {
    const event = state.eventQueue.shift()!;
    state.currentEvent = event;
    if (event === "supply") {
      for (const player of thronePlayers(state)) player.supply = Math.min(6, controlledSupply(state, requireFaction(player)));
      state.supplyQueue = thronePlayers(state).filter((player) => !supplyValid(state, requireFaction(player))).map((player) => player.id);
      if (state.supplyQueue.length) {
        state.phase = "supply";
        state.currentPlayerId = state.supplyQueue[0];
        return;
      }
      continue;
    }
    if (event === "mustering") {
      state.musterQueue = thronePlayers(state).map((player) => player.id);
      state.phase = "mustering";
      state.currentPlayerId = state.musterQueue[0] ?? null;
      return;
    }
    if (event === "clash") return startInfluenceBid(state, "throne");
    if (event === "power") {
      for (const player of state.players) {
        const faction = requireFaction(player);
        let gain = REALM_AREAS.reduce((sum, area) => sum + (realmAreaOwner(state, area.key) === faction ? area.power ?? 0 : 0), 0);
        gain += REALM_AREAS.filter((area) => area.kind === "port" && realmAreaOwner(state, area.key) === faction && state.areas[area.key].units.length && area.seaOf && !state.areas[area.seaOf].units.some((unit) => unit.faction !== faction)).length;
        player.power = Math.min(20, player.power + gain);
      }
      continue;
    }
    if (event === "throne_choice") {
      state.phase = "event_choice";
      state.eventChoice = ["supply", "mustering", "quiet"];
      state.currentPlayerId = factionPlayer(state, state.influence.throne[0])!.id;
      return;
    }
    if (event === "raven_choice") {
      state.phase = "event_choice";
      state.eventChoice = ["power", "clash", "quiet"];
      state.currentPlayerId = factionPlayer(state, state.influence.court[0])!.id;
      return;
    }
    if (event === "blade_choice") {
      state.phase = "event_choice";
      state.eventChoice = ["no_defend", "no_raid", "quiet"];
      state.currentPlayerId = factionPlayer(state, state.influence.fiefdom[0])!.id;
      return;
    }
    if (event === "wildling") return startWildlingBid(state, false);
    if (event === "no_raid") state.forbiddenOrderFamily = "raid";
    if (event === "no_support") state.forbiddenOrderFamily = "support";
    if (event === "no_power") state.forbiddenOrderFamily = "power";
    if (event === "no_defend") state.forbiddenOrderFamily = "defend";
    if (event === "no_march_plus") state.forbiddenOrderFamily = "march_star";
  }
  state.currentEvent = null;
  state.phase = "planning";
  state.currentPlayerId = null;
  state.players.forEach((player) => { player.submitted = false; });
  addLog(state, `第 ${state.round} 轮秘密下令开始。`);
}

export function chooseRealmEvent(state: RealmState, playerId: string, event: RealmEventKey) {
  if (state.phase !== "event_choice" || state.currentPlayerId !== playerId || !state.eventChoice.includes(event)) throw new Error("现在不能选择该事件。 ");
  state.eventQueue.unshift(event);
  state.eventChoice = [];
  state.currentPlayerId = null;
  continueEvents(state);
  touch(state);
  processRealmBots(state);
}

export function submitRealmSupplyLosses(state: RealmState, playerId: string, unitIds: string[]) {
  if (state.phase !== "supply" || state.currentPlayerId !== playerId) throw new Error("现在不能调整补给。 ");
  const player = requirePlayer(state, playerId);
  const faction = requireFaction(player);
  const owned = Object.values(state.areas).flatMap((area) => area.units).filter((unit) => unit.faction === faction);
  if (unitIds.some((id) => !owned.some((unit) => unit.id === id))) throw new Error("伤亡列表包含无效部队。 ");
  for (const area of Object.values(state.areas)) area.units = area.units.filter((unit) => !unitIds.includes(unit.id));
  if (!supplyValid(state, faction)) throw new Error("移除这些部队后仍然超过补给限制。 ");
  state.supplyQueue.shift();
  state.currentPlayerId = state.supplyQueue[0] ?? null;
  if (!state.currentPlayerId) continueEvents(state);
  touch(state);
  processRealmBots(state);
}

export function submitRealmMuster(state: RealmState, playerId: string, choices: RealmMusterChoice[]) {
  if (state.phase !== "mustering" || state.currentPlayerId !== playerId) throw new Error("现在轮不到你征召。 ");
  applyMusterChoices(state, requirePlayer(state, playerId), choices);
  state.musterQueue.shift();
  state.currentPlayerId = state.musterQueue[0] ?? null;
  if (!state.currentPlayerId) continueEvents(state);
  touch(state);
  processRealmBots(state);
}

function startInfluenceBid(state: RealmState, track: "throne" | "fiefdom" | "court") {
  state.phase = "influence_bid";
  state.bid = { kind: "influence", track, bids: Object.fromEntries(state.players.map((player) => [player.id, null])) };
  state.currentPlayerId = null;
}

function startWildlingBid(state: RealmState, _fromThreat: boolean, excludedPlayerIds: string[] = []) {
  state.phase = "wildling_bid";
  state.bid = { kind: "wildling", excludedPlayerIds, bids: Object.fromEntries(state.players.map((player) => [player.id, excludedPlayerIds.includes(player.id) ? 0 : null])) };
  state.currentPlayerId = null;
}

function finishInfluenceBid(state: RealmState, rankedFactions: string[]) {
  const bid = state.bid!;
  const track = bid.track!;
  for (const player of state.players) player.power -= bid.bids[player.id] ?? 0;
  state.influence[track] = rankedFactions;
  const next = track === "throne" ? "fiefdom" : track === "fiefdom" ? "court" : null;
  state.bid = null;
  state.tieBreak = null;
  if (next) startInfluenceBid(state, next);
  else continueEvents(state);
}

function removeWildlingUnits(state: RealmState, player: RealmPlayerState, count: number) {
  const candidates = REALM_AREAS.flatMap((definition) => state.areas[definition.key].units.map((unit) => ({ definition, unit })))
    .filter(({ unit }) => unit.faction === player.faction)
    .sort((a, b) => REALM_UNIT_STRENGTH[a.unit.type] - REALM_UNIT_STRENGTH[b.unit.type]);
  const ids = candidates.slice(0, count).map(({ unit }) => unit.id);
  for (const area of Object.values(state.areas)) area.units = area.units.filter((unit) => !ids.includes(unit.id));
}

function changeWildlingUnits(state: RealmState, player: RealmPlayerState, from: RealmUnitType, to: RealmUnitType, count: number, destroyIfUnavailable = false) {
  const faction = requireFaction(player);
  const units = Object.values(state.areas).flatMap((area) => area.units).filter((unit) => unit.faction === faction && unit.type === from).slice(0, count);
  for (const unit of units) {
    if (unitsOnBoard(state, faction, to) < UNIT_LIMITS[to]) unit.type = to;
    else if (destroyIfUnavailable) for (const area of Object.values(state.areas)) area.units = area.units.filter((candidate) => candidate.id !== unit.id);
  }
}

function moveFactionToTrackEnd(state: RealmState, faction: string, track: "throne" | "fiefdom" | "court") {
  state.influence[track] = [...state.influence[track].filter((candidate) => candidate !== faction), faction];
}

function moveFactionToTrackTop(state: RealmState, faction: string, track: "throne" | "fiefdom" | "court") {
  state.influence[track] = [faction, ...state.influence[track].filter((candidate) => candidate !== faction)];
}

function discardWildlingLeaders(player: RealmPlayerState, allHighest: boolean) {
  if (player.leaderHand.length <= 1) return;
  const sorted = player.leaderHand.map((key) => realmLeader(key)!).sort((a, b) => b.strength - a.strength);
  const selected = allHighest ? sorted.filter((card) => card.strength === sorted[0].strength) : [sorted.at(-1)!];
  const keys = selected.map((card) => card.key);
  player.leaderHand = player.leaderHand.filter((key) => !keys.includes(key));
  player.leaderDiscard.push(...keys);
}

function applyWildlingOutcome(state: RealmState, rankedFactions: string[]) {
  const bid = state.bid!;
  const ranked = rankedFactions.map((faction) => factionPlayer(state, faction)!);
  const total = Object.values(bid.bids).reduce<number>((sum, value) => sum + (value ?? 0), 0);
  for (const player of state.players) if (!bid.excludedPlayerIds?.includes(player.id)) player.power -= bid.bids[player.id] ?? 0;
  ensureWildlingDeck(state);
  const card = state.wildlingDeck.shift() ?? "horde";
  state.wildlingDiscard.push(card);
  const watchWins = total >= state.wildlingThreat;
  const highest = ranked[0];
  const lowest = ranked.at(-1)!;
  if (watchWins) {
    if (card === "mammoths" && highest.leaderDiscard.length) {
      const recovered = highest.leaderDiscard.map((key) => realmLeader(key)!).sort((a, b) => b.strength - a.strength)[0];
      highest.leaderDiscard = highest.leaderDiscard.filter((key) => key !== recovered.key);
      highest.leaderHand.push(recovered.key);
    } else if (card === "climbers") changeWildlingUnits(state, highest, "footman", "knight", 2);
    else if (card === "raiders") highest.supply = Math.min(6, highest.supply + 1);
    else if (card === "king") moveFactionToTrackTop(state, requireFaction(highest), "throne");
    else if (card === "horde") {
      const castle = REALM_AREAS.find((area) => area.castle && realmAreaOwner(state, area.key) === highest.faction);
      if (castle) applyMusterChoices(state, highest, botMusterChoices(state, highest, castle.key), castle.key);
    } else if (card === "scouts") highest.power = Math.min(20, highest.power + (bid.bids[highest.id] ?? 0));
    else if (card === "cold") {
      highest.leaderHand.push(...highest.leaderDiscard);
      highest.leaderDiscard = [];
    }
    addLog(state, `众势力以 ${total} 威望击退荒境军势，${highest.name}获得最高贡献奖励。`);
  } else {
    if (card === "king") {
      for (const track of ["throne", "fiefdom", "court"] as const) moveFactionToTrackEnd(state, requireFaction(lowest), track);
      for (const player of ranked.slice(0, -1)) moveFactionToTrackEnd(state, requireFaction(player), "fiefdom");
    } else if (card === "mammoths") ranked.forEach((player) => removeWildlingUnits(state, player, player.id === lowest.id ? 3 : 2));
    else if (card === "horde") ranked.forEach((player) => removeWildlingUnits(state, player, player.id === lowest.id ? 2 : 1));
    else if (card === "climbers") ranked.forEach((player) => changeWildlingUnits(state, player, "knight", "footman", player.id === lowest.id ? Number.MAX_SAFE_INTEGER : 2, true));
    else if (card === "raiders") ranked.forEach((player) => { player.supply = Math.max(0, player.supply - (player.id === lowest.id ? 2 : 1)); });
    else if (card === "scouts") ranked.forEach((player) => { player.power = player.id === lowest.id ? 0 : Math.max(0, player.power - 2); });
    else if (card === "cold") ranked.forEach((player) => discardWildlingLeaders(player, player.id === lowest.id));
    else if (card === "giants") removeWildlingUnits(state, lowest, 2);
    addLog(state, `荒境军势突破防线；${lowest.name}承受最严重后果。`);
  }
  const repeatAttack = watchWins && card === "giants";
  state.wildlingThreat = repeatAttack ? 6 : watchWins ? 0 : Math.max(0, state.wildlingThreat - 2);
  state.bid = null;
  state.tieBreak = null;
  if (repeatAttack) {
    addLog(state, `荒境先遣被击退，但一支强度 6 的军势立即再度来袭；${highest.name}不参与本次防守。`);
    startWildlingBid(state, true, [highest.id]);
    return;
  }
  continueEvents(state);
}

function finishResolvedBid(state: RealmState, rankedFactions: string[]) {
  if (state.bid?.kind === "influence") finishInfluenceBid(state, rankedFactions);
  else applyWildlingOutcome(state, rankedFactions);
}

function beginBidResolution(state: RealmState) {
  const bid = state.bid!;
  const byAmount = new Map<number, string[]>();
  for (const player of state.players.filter((candidate) => !bid.excludedPlayerIds?.includes(candidate.id))) {
    const amount = bid.bids[player.id] ?? 0;
    byAmount.set(amount, [...(byAmount.get(amount) ?? []), requireFaction(player)]);
  }
  const groups = [...byAmount.entries()].sort((a, b) => b[0] - a[0]).map(([, factions]) => factions);
  if (!groups.some((group) => group.length > 1)) return finishResolvedBid(state, groups.flat());
  const firstTie = groups.findIndex((group) => group.length > 1);
  state.tieBreak = {
    kind: bid.kind,
    track: bid.track,
    groups,
    groupIndex: firstTie,
    rankedFactions: groups.slice(0, firstTie).flat(),
  };
  state.phase = "bid_tiebreak";
  state.currentPlayerId = factionPlayer(state, state.influence.throne[0])!.id;
}

export function chooseRealmBidTie(state: RealmState, playerId: string, faction: string) {
  if (state.phase !== "bid_tiebreak" || state.currentPlayerId !== playerId || !state.tieBreak || !state.bid) throw new Error("现在不能裁决竞价平手。 ");
  const tie = state.tieBreak;
  const group = tie.groups[tie.groupIndex];
  if (!group?.includes(faction)) throw new Error("请选择当前平手组中的势力。 ");
  tie.rankedFactions.push(faction);
  tie.groups[tie.groupIndex] = group.filter((candidate) => candidate !== faction);
  if (tie.groups[tie.groupIndex].length === 1) {
    tie.rankedFactions.push(tie.groups[tie.groupIndex][0]);
    tie.groupIndex += 1;
    while (tie.groupIndex < tie.groups.length && tie.groups[tie.groupIndex].length === 1) {
      tie.rankedFactions.push(tie.groups[tie.groupIndex][0]);
      tie.groupIndex += 1;
    }
  }
  if (tie.groupIndex >= tie.groups.length) {
    const ranking = [...tie.rankedFactions];
    finishResolvedBid(state, ranking);
  }
  touch(state);
  processRealmBots(state);
}

export function submitRealmBid(state: RealmState, playerId: string, amount: number) {
  if (!state.bid || !["influence_bid", "wildling_bid"].includes(state.phase)) throw new Error("现在没有秘密竞价。 ");
  const player = requirePlayer(state, playerId);
  if (state.bid.excludedPlayerIds?.includes(playerId)) throw new Error("你不参与本次荒境竞价。 ");
  const value = Math.max(0, Math.floor(amount));
  if (value > player.power) throw new Error("竞价不能超过可用威望。 ");
  state.bid.bids[playerId] = value;
  if (Object.values(state.bid.bids).every((bid) => bid !== null)) {
    beginBidResolution(state);
  }
  touch(state);
  processRealmBots(state);
}

function availableOrdersForBot(state: RealmState, faction: string) {
  const inventory = Object.entries(REALM_ORDER_COUNTS).flatMap(([order, count]) => Array.from({ length: count }, () => order as RealmOrderType));
  const stars = starAllowance(state, faction);
  return inventory.filter((order) => !orderForbidden(state, order))
    .sort((a, b) => Number(orderIsStar(a) && stars > 0) - Number(orderIsStar(b) && stars > 0));
}

function botOrders(state: RealmState, player: RealmPlayerState) {
  const faction = requireFaction(player);
  const areas = factionAreasWithUnits(state, faction);
  const available = availableOrdersForBot(state, faction);
  let starsLeft = starAllowance(state, faction);
  const result: Record<string, RealmOrderType> = {};
  for (const area of areas) {
    const hostile = area.adjacent.some((target) => {
      const owner = realmAreaOwner(state, target);
      return owner && owner !== faction || Boolean(state.areas[target]?.neutral && state.areas[target].neutral! < 99);
    });
    const castle = Boolean(area.castle);
    const preferences: RealmOrderType[] = hostile
      ? ["march_star", "march", "march_minus", "defend_star", "defend", "support_star", "support"]
      : castle ? ["power_star", "power", "support_star", "support", "defend"] : ["power", "support", "raid", "march_minus"];
    let picked = preferences.find((order) => available.includes(order) && (!orderIsStar(order) || starsLeft > 0));
    if (!picked) picked = available.find((order) => !orderIsStar(order) || starsLeft > 0)!;
    if (!picked) break;
    result[area.key] = picked;
    available.splice(available.indexOf(picked), 1);
    if (orderIsStar(picked)) starsLeft -= 1;
  }
  return result;
}

function legalRaidTargets(state: RealmState, faction: string, sourceAreaId: string) {
  const source = realmArea(sourceAreaId)!;
  const sourceOrder = state.areas[sourceAreaId].order!;
  return REALM_AREAS.filter((target) => target.key !== sourceAreaId && realmAreaOwner(state, target.key) !== faction && state.areas[target.key].order && raidCanTarget(source, target, sourceOrder, state.areas[target.key].order!));
}

function botMarch(state: RealmState, player: RealmPlayerState) {
  const faction = requireFaction(player);
  const source = REALM_AREAS.find((area) => realmAreaOwner(state, area.key) === faction && state.areas[area.key].order && orderFamily(state.areas[area.key].order!) === "march")!;
  const units = state.areas[source.key].units.filter((unit) => unit.faction === faction && !unit.routed);
  const targets = REALM_AREAS.filter((target) => {
    if (target.kind === "port" && realmAreaOwner(state, target.portOf!) !== faction) return false;
    if (!units.every((unit) => moveIsAdjacent(state, source, target, faction, unit))) return false;
    const remaining = state.areas[source.key].units.filter((unit) => !units.some((moving) => moving.id === unit.id));
    return supplyValid(state, faction, [
      { areaId: source.key, units: remaining },
      { areaId: target.key, units: [...state.areas[target.key].units, ...units] },
    ]);
  });
  const ranked = targets.sort((a, b) => {
    const score = (area: RealmAreaDefinition) => (area.castle ?? 0) * 8 + (area.supply ?? 0) * 3 + (realmAreaOwner(state, area.key) && realmAreaOwner(state, area.key) !== faction ? 5 : 0) + (state.areas[area.key].neutral && state.areas[area.key].neutral! < 99 ? 2 : 0);
    return score(b) - score(a);
  });
  const target = ranked.find((area) => {
    const owner = realmAreaOwner(state, area.key);
    if (owner === faction) return false;
    if (state.areas[area.key].neutral) return neutralAttackStrength(state, faction, area.key, units, state.areas[source.key].order!) >= state.areas[area.key].neutral!;
    return true;
  }) ?? ranked.find((area) => !realmAreaOwner(state, area.key));
  if (!target) resolveRealmMarch(state, player.id, source.key, []);
  else resolveRealmMarch(state, player.id, source.key, [{ to: target.key, unitIds: units.map((unit) => unit.id) }], player.power > 2);
}

function botMusterChoices(state: RealmState, player: RealmPlayerState, limitedArea?: string) {
  const faction = requireFaction(player);
  const choices: RealmMusterChoice[] = [];
  const castles = REALM_AREAS.filter((area) => area.castle && realmAreaOwner(state, area.key) === faction && (!limitedArea || area.key === limitedArea));
  for (const castle of castles) {
    let points = castle.castle ?? 0;
    const footman = state.areas[castle.key].units.find((unit) => unit.faction === faction && unit.type === "footman");
    if (points && footman && unitsOnBoard(state, faction, "knight") < UNIT_LIMITS.knight) {
      choices.push({ sourceAreaId: castle.key, type: "knight", upgradeUnitId: footman.id });
      points -= 1;
    }
    if (points && unitsOnBoard(state, faction, "footman") < UNIT_LIMITS.footman) choices.push({ sourceAreaId: castle.key, type: "footman" });
  }
  const accepted: RealmMusterChoice[] = [];
  for (const choice of choices) {
    const trial = structuredClone(state);
    const trialPlayer = requirePlayer(trial, player.id);
    try {
      applyMusterChoices(trial, trialPlayer, [...accepted, choice], limitedArea);
      accepted.push(choice);
    } catch {
      // Keep only legal musters; unused points are allowed by the rules.
    }
  }
  return accepted;
}

function botSupplyLosses(state: RealmState, player: RealmPlayerState) {
  const faction = requireFaction(player);
  const virtual = REALM_AREAS.map((area) => ({ areaId: area.key, units: [...state.areas[area.key].units] }));
  const units = virtual.flatMap((area) => area.units.filter((unit) => unit.faction === faction).map((unit) => ({ unit, areaId: area.areaId })))
    .sort((a, b) => REALM_UNIT_STRENGTH[a.unit.type] - REALM_UNIT_STRENGTH[b.unit.type]);
  const removed: string[] = [];
  for (const { unit, areaId } of units) {
    if (supplyValid(state, faction, virtual)) break;
    const area = virtual.find((candidate) => candidate.areaId === areaId)!;
    area.units = area.units.filter((candidate) => candidate.id !== unit.id);
    removed.push(unit.id);
  }
  return removed;
}

export function processRealmBots(state: RealmState) {
  if (BOT_PROCESSING.has(state)) return;
  BOT_PROCESSING.add(state);
  let guard = 0;
  try {
    while (state.phase !== "finished" && guard < 500) {
    guard += 1;
    if (state.phase === "planning") {
      let changed = false;
      for (const bot of state.players.filter((player) => player.isBot && !player.submitted)) {
        const orders = botOrders(state, bot);
        for (const [areaId, order] of Object.entries(orders)) state.areas[areaId].order = order;
        bot.submitted = true;
        changed = true;
      }
      if (allSubmitted(state)) { revealOrders(state); continue; }
      if (!changed) break;
      break;
    }
    if (state.phase === "raven") {
      const player = state.currentPlayerId ? requirePlayer(state, state.currentPlayerId) : null;
      if (!player?.isBot) break;
      state.ravenUsed = true;
      beginOrderPhase(state, "raid");
      continue;
    }
    if (["raid", "march", "consolidate"].includes(state.phase)) {
      const player = state.currentPlayerId ? requirePlayer(state, state.currentPlayerId) : null;
      if (!player?.isBot) break;
      const faction = requireFaction(player);
      if (state.phase === "raid") {
        const source = REALM_AREAS.find((area) => realmAreaOwner(state, area.key) === faction && state.areas[area.key].order && orderFamily(state.areas[area.key].order!) === "raid")!;
        resolveRealmRaid(state, player.id, source.key, legalRaidTargets(state, faction, source.key)[0]?.key);
      } else if (state.phase === "march") botMarch(state, player);
      else {
        const source = REALM_AREAS.find((area) => realmAreaOwner(state, area.key) === faction && state.areas[area.key].order && orderFamily(state.areas[area.key].order!) === "power")!;
        const muster = state.areas[source.key].order === "power_star" && source.castle;
        resolveRealmConsolidate(state, player.id, source.key, muster ? "muster" : "power", muster ? botMusterChoices(state, player, source.key) : []);
      }
      continue;
    }
    if (state.phase === "combat_support" && state.pendingCombat) {
      const player = state.currentPlayerId ? requirePlayer(state, state.currentPlayerId) : null;
      if (!player?.isBot) break;
      const areaId = state.pendingCombat.supportQueue.find((key) => state.pendingCombat!.supportChoices[key] === null)!;
      const faction = requireFaction(player);
      const side = faction === state.pendingCombat.attackerFaction ? "attacker" : faction === state.pendingCombat.defenderFaction ? "defender" : "none";
      chooseRealmSupport(state, player.id, areaId, side);
      continue;
    }
    if (state.phase === "combat_cards" && state.pendingCombat) {
      const player = state.currentPlayerId ? requirePlayer(state, state.currentPlayerId) : null;
      if (!player?.isBot) break;
      const faction = requireFaction(player);
      const blocked = state.pendingCombat.blockedLeaderKeys[faction];
      const leader = player.leaderHand.map((key) => realmLeader(key)!).filter((card) => !blocked.includes(card.key)).sort((a, b) => b.strength - a.strength || b.swords - a.swords)[0];
      chooseRealmLeader(state, player.id, leader.key);
      continue;
    }
    if (state.phase === "combat_blade") {
      const player = state.currentPlayerId ? requirePlayer(state, state.currentPlayerId) : null;
      if (!player?.isBot) break;
      resolveRealmBlade(state, player.id, true);
      continue;
    }
    if (state.phase === "combat_effect" && state.combatEffects.length) {
      const player = state.currentPlayerId ? requirePlayer(state, state.currentPlayerId) : null;
      if (!player?.isBot) break;
      resolveRealmCombatEffect(state, player.id, state.combatEffects[0].options[0]);
      continue;
    }
    if (state.phase === "combat_casualties" && state.pendingCombat) {
      const player = state.currentPlayerId ? requirePlayer(state, state.currentPlayerId) : null;
      if (!player?.isBot) break;
      const faction = requireFaction(player);
      const units = faction === state.pendingCombat.attackerFaction ? state.pendingCombat.attackingUnits : state.areas[state.pendingCombat.targetAreaId].units.filter((unit) => unit.faction === faction);
      const selected = [...units].sort((a, b) => Number(b.type === "siege" || b.routed) - Number(a.type === "siege" || a.routed) || REALM_UNIT_STRENGTH[a.type] - REALM_UNIT_STRENGTH[b.type]).slice(0, state.pendingCombat.casualtiesRequired).map((unit) => unit.id);
      chooseRealmCasualties(state, player.id, selected);
      continue;
    }
    if (state.phase === "combat_retreat" && state.pendingCombat) {
      const player = state.currentPlayerId ? requirePlayer(state, state.currentPlayerId) : null;
      if (!player?.isBot) break;
      chooseRealmRetreat(state, player.id, state.pendingCombat.retreatOptions[0]);
      continue;
    }
    if (state.phase === "event_choice") {
      const player = state.currentPlayerId ? requirePlayer(state, state.currentPlayerId) : null;
      if (!player?.isBot) break;
      chooseRealmEvent(state, player.id, state.eventChoice[0]);
      continue;
    }
    if (state.phase === "supply") {
      const player = state.currentPlayerId ? requirePlayer(state, state.currentPlayerId) : null;
      if (!player?.isBot) break;
      submitRealmSupplyLosses(state, player.id, botSupplyLosses(state, player));
      continue;
    }
    if (state.phase === "mustering") {
      const player = state.currentPlayerId ? requirePlayer(state, state.currentPlayerId) : null;
      if (!player?.isBot) break;
      submitRealmMuster(state, player.id, botMusterChoices(state, player));
      continue;
    }
    if (["influence_bid", "wildling_bid"].includes(state.phase) && state.bid) {
      let changed = false;
      for (const bot of state.players.filter((player) => player.isBot && state.bid!.bids[player.id] === null)) {
        state.bid.bids[bot.id] = Math.min(bot.power, Math.floor(Math.random() * Math.min(5, bot.power + 1)));
        changed = true;
      }
      if (Object.values(state.bid.bids).every((bid) => bid !== null)) {
        beginBidResolution(state);
        continue;
      }
      if (!changed) break;
      break;
    }
    if (state.phase === "bid_tiebreak" && state.tieBreak) {
      const player = state.currentPlayerId ? requirePlayer(state, state.currentPlayerId) : null;
      if (!player?.isBot) break;
      const group = state.tieBreak.groups[state.tieBreak.groupIndex];
      const ownFaction = requireFaction(player);
      chooseRealmBidTie(state, player.id, group.includes(ownFaction) ? ownFaction : group[0]);
      continue;
    }
      break;
    }
  } finally {
    BOT_PROCESSING.delete(state);
  }
  touch(state);
}

export function publicRealmView(state: RealmState, viewerId: string, presence: Record<string, { online: boolean; lastSeenAt: string }> = {}) {
  const viewer = requirePlayer(state, viewerId);
  const viewerFaction = viewer.faction;
  const ordersRevealed = state.phase !== "planning" || state.players.every((player) => player.submitted);
  const combat = state.pendingCombat;
  return {
    kind: state.kind,
    code: state.code,
    phase: state.phase,
    round: state.round,
    hostId: state.hostId,
    viewerId,
    currentPlayerId: state.currentPlayerId,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      isBot: player.isBot,
      isOnline: player.isBot || Boolean(presence[player.id]?.online),
      faction: player.faction,
      power: player.power,
      supply: player.supply,
      submitted: player.submitted,
      castles: player.faction ? controlledCastles(state, player.faction) : 0,
      leaderHand: player.id === viewerId ? player.leaderHand : [],
      leaderHandCount: player.leaderHand.length,
      leaderDiscard: player.leaderDiscard,
      privateNotes: player.id === viewerId ? player.privateNotes : [],
    })),
    areas: Object.fromEntries(REALM_AREAS.map((area) => [area.key, {
      ...state.areas[area.key],
      order: ordersRevealed || realmAreaOwner(state, area.key) === viewerFaction ? state.areas[area.key].order : state.areas[area.key].order ? "hidden" : null,
    }])),
    influence: state.influence,
    bladeUsed: state.bladeUsed,
    ravenUsed: state.ravenUsed,
    ravenPeeked: state.ravenPeekedBy === viewerId,
    wildlingThreat: state.wildlingThreat,
    currentEvent: state.currentEvent,
    eventChoice: state.currentPlayerId === viewerId ? state.eventChoice : [],
    forbiddenOrderFamily: state.forbiddenOrderFamily,
    bid: state.bid ? {
      kind: state.bid.kind,
      track: state.bid.track,
      bids: Object.fromEntries(Object.entries(state.bid.bids).map(([id, value]) => [id, id === viewerId || Object.values(state.bid!.bids).every((bid) => bid !== null) ? value : value === null ? null : "submitted"])),
    } : null,
    tieBreak: state.tieBreak ? {
      kind: state.tieBreak.kind,
      track: state.tieBreak.track,
      choices: state.tieBreak.groups[state.tieBreak.groupIndex],
      rankedFactions: state.tieBreak.rankedFactions,
    } : null,
    supplyQueue: state.supplyQueue,
    musterQueue: state.musterQueue,
    pendingCombat: combat ? {
      ...combat,
      leaderChoices: Object.fromEntries(Object.entries(combat.leaderChoices).map(([faction, key]) => [faction, Object.values(combat.leaderChoices).every(Boolean) || faction === viewerFaction ? key : key ? "hidden" : null])),
    } : null,
    combatEffect: state.combatEffects[0] ? {
      ...state.combatEffects[0],
      options: state.combatEffects[0].actorFaction === viewerFaction ? state.combatEffects[0].options : [],
    } : null,
    tidesOfBattle: state.tidesOfBattle,
    winnerId: state.winnerId,
    log: state.log,
    version: state.version,
    factions: REALM_FACTIONS,
    areaDefinitions: REALM_AREAS,
    leaders: REALM_LEADERS,
    orderCounts: REALM_ORDER_COUNTS,
  };
}
