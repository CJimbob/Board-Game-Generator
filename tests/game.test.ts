import assert from "node:assert/strict";
import test from "node:test";
import {
  addBotPlayer,
  buildDistrict,
  claimHost,
  chooseRole,
  createDistrictDeck,
  createGameState,
  createMatchHistorySummary,
  currentPickerId,
  endTurn,
  entrustPlayerToBot,
  joinGame,
  leaveGame,
  playerScoreBreakdown,
  processBots,
  publicGameView,
  removeLobbyPlayer,
  restartGame,
  restorePlayerSeat,
  startGame,
  takeGold,
  transferHost,
  activateRoleAbility,
  type DistrictCard,
  type GameState,
} from "../lib/game.ts";
import { BASIC_DISTRICTS, ROLES, RULESETS, UNIQUE_DISTRICTS } from "../lib/rules.ts";
import { DISTRICT_EN, ROLE_EN, RULESET_EN, localizedDistrict, localizedRole } from "../lib/i18n.ts";

function twoPlayerGame(rulesetKey = "first_game") {
  const { state, host } = createGameState("TEST", "甲", 0, rulesetKey);
  const second = joinGame(state, "乙");
  startGame(state, host.id);
  return { state, host, second };
}

function finishDraft(state: GameState) {
  let guard = 0;
  while (state.status === "draft" && guard < 20) {
    guard += 1;
    const picker = currentPickerId(state)!;
    const view = publicGameView(state, picker);
    chooseRole(state, picker, view.availableRoleKeys[0]);
  }
  assert.ok(guard < 20);
}

test("ships the official 54 basic districts, 30 unique options, and 27 characters", () => {
  assert.equal(BASIC_DISTRICTS.reduce((sum, district) => sum + (district.count ?? 1), 0), 54);
  assert.equal(UNIQUE_DISTRICTS.length, 30);
  assert.equal(ROLES.length, 27);
  assert.equal(new Set(ROLES.map((role) => role.key)).size, 27);
  assert.equal(RULESETS.length, 7);
  assert.equal(new Set(RULESETS.flatMap((ruleset) => ruleset.roleKeys)).size, 27);
  for (const ruleset of RULESETS) {
    assert.equal(ruleset.uniqueKeys.length, 14);
    assert.equal(createDistrictDeck(ruleset.key).length, 68);
  }
});

test("uses the complete two-player draft: two secret characters per player", () => {
  const { state, host, second } = twoPlayerGame();
  finishDraft(state);
  assert.equal(state.status, "turns");
  assert.equal(host.roleKeys.length, 2);
  assert.equal(second.roleKeys.length, 2);
  assert.equal(new Set([...host.roleKeys, ...second.roleKeys]).size, 4);
  assert.equal(state.currentRank, Math.min(...[...host.roleKeys, ...second.roleKeys].map((key) => state.cast.find((role) => role.key === key)!.rank)));
});

test("keeps unrevealed opponent identities private", () => {
  const { state, host, second } = twoPlayerGame();
  finishDraft(state);
  const hostView = publicGameView(state, host.id);
  const opponentView = hostView.players.find((player) => player.id === second.id)!;
  assert.ok(opponentView.roleKeys.length <= 1);
  assert.equal(hostView.players.find((player) => player.id === host.id)?.roleKeys.length, 2);
  assert.match(hostView.roundLog[0], /第 1 轮开始/);
  assert.ok(hostView.roundLog.some((entry) => entry.includes("秘密选好角色")));
  assert.equal(hostView.assassinatedRoleKey, null);
  assert.equal(hostView.robbedRoleKey, null);
  assert.equal(hostView.bewitchedRoleKey, null);
});

test("supports gathering resources and building with server-side validation", () => {
  const { state } = twoPlayerGame();
  finishDraft(state);
  const active = state.players.find((player) => player.id === state.activePlayerId)!;
  const affordable: DistrictCard = {
    uid: "test-build",
    key: "test_build",
    name: "测试城区",
    color: "purple",
    cost: 1,
  };
  active.hand.push(affordable);
  takeGold(state, active.id);
  const before = active.gold;
  buildDistrict(state, active.id, affordable.uid);
  assert.equal(active.gold, before - 1);
  assert.equal(active.city.at(-1)?.name, "测试城区");
});

test("Gold Mine changes the mandatory resource choice to three gold", () => {
  const { state } = twoPlayerGame();
  finishDraft(state);
  const active = state.players.find((player) => player.id === state.activePlayerId)!;
  active.city.push({ uid: "mine", key: "gold_mine", name: "金矿", color: "purple", cost: 6 });
  const before = active.gold;
  takeGold(state, active.id);
  assert.equal(active.gold, before + 3);
});

test("two-player turns continue until both identities have acted", () => {
  const { state } = twoPlayerGame();
  finishDraft(state);
  const firstRound = state.round;
  let guard = 0;
  while (state.round === firstRound && state.status === "turns" && guard < 12) {
    guard += 1;
    const active = state.players.find((player) => player.id === state.activePlayerId)!;
    takeGold(state, active.id);
    if (state.currentRoleKey === "witch") {
      const target = state.cast.find((role) => role.rank > 1)!;
      activateRoleAbility(state, active.id, { targetRoleKey: target.key });
    } else if (state.currentRoleKey === "emperor") {
      const other = state.players.find((player) => player.id !== active.id)!;
      activateRoleAbility(state, active.id, { targetPlayerId: other.id, mode: "gold" });
    }
    if (state.status === "turns" && state.activePlayerId === active.id) endTurn(state, active.id);
  }
  assert.ok(guard <= 4);
  assert.equal(state.round, firstRound + 1);
});

test("scoring includes completion and unique district bonuses", () => {
  const { state, host } = createGameState("SCORE", "计分者", 3);
  state.cast = [];
  state.firstCompletedPlayerId = host.id;
  host.city = [
    { uid: "a", key: "manor", name: "庄园", color: "yellow", cost: 3 },
    { uid: "b", key: "temple", name: "神殿", color: "blue", cost: 1 },
    { uid: "c", key: "market", name: "市场", color: "green", cost: 2 },
    { uid: "d", key: "barracks", name: "兵营", color: "red", cost: 3 },
    { uid: "e", key: "dragon_gate", name: "龙门", color: "purple", cost: 6 },
    { uid: "f", key: "castle", name: "城堡", color: "yellow", cost: 4 },
    { uid: "g", key: "church", name: "教堂", color: "blue", cost: 2 },
  ];
  const score = playerScoreBreakdown(state, host);
  assert.equal(score.base, 21);
  assert.equal(score.variety, 3);
  assert.equal(score.completion, 4);
  assert.equal(score.unique, 2);
  assert.equal(score.total, 30);
});

test("completed matches produce a durable public history summary without seat secrets", () => {
  const { state, host } = createGameState("ARCH", "档案城主", 1);
  state.status = "finished";
  state.round = 6;
  host.recoveryHash = "private-recovery-hash";
  host.historyKeyHash = "private-history-hash";
  host.city = [{ uid: "archive-city", key: "palace", name: "宫殿", color: "yellow", cost: 5 }];
  const summary = createMatchHistorySummary(state);
  assert.equal(summary.code, "ARCH");
  assert.equal(summary.round, 6);
  assert.equal(summary.players[0].city[0].name, "宫殿");
  assert.equal("token" in summary.players[0], false);
  assert.equal("recoveryHash" in summary.players[0], false);
  assert.equal("historyKeyHash" in summary.players[0], false);
  const firstMatchId = summary.id;
  restartGame(state, host.id);
  state.status = "finished";
  assert.notEqual(createMatchHistorySummary(state).id, firstMatchId);
});

test("computer players can advance every official ruleset without a stalled turn", () => {
  for (const ruleset of RULESETS) {
    const { state, host } = createGameState(`B${ruleset.key.slice(0, 3)}`, "自动城主", 3, ruleset.key);
    host.isBot = true;
    host.token = "";
    startGame(state, host.id);
    for (let pass = 0; pass < 80 && state.status !== "finished"; pass += 1) {
      processBots(state);
    }
    assert.equal(state.status, "finished", `${ruleset.name} should finish`);
    assert.ok(state.round >= 2);
  }
});

test("computer players draft roles that match their built district economy", () => {
  const { state, host } = createGameState("WISE", "策略电脑", 0);
  const human = joinGame(state, "观察者");
  host.isBot = true;
  host.token = "";
  startGame(state, host.id);
  host.city = [
    { uid: "green-a", key: "market", name: "市场", color: "green", cost: 2 },
    { uid: "green-b", key: "harbor", name: "港口", color: "green", cost: 4 },
  ];
  state.draftOrder = [host.id, human.id];
  state.draftIndex = 0;
  state.availableRoleKeys = ["bishop", "merchant"];
  state.facedownRoleKey = null;
  processBots(state);
  assert.deepEqual(host.roleKeys, ["merchant"]);
  assert.equal(state.draftIndex, 1);
});

test("computer players keep the strongest card from a pending draw", () => {
  const { state, host } = createGameState("DRAW", "选牌电脑", 0);
  joinGame(state, "观察者");
  host.isBot = true;
  host.token = "";
  const merchant = ROLES.find((role) => role.key === "merchant")!;
  state.status = "turns";
  state.cast = [merchant];
  state.currentRank = merchant.rank;
  state.currentRoleKey = merchant.key;
  state.activePlayerId = host.id;
  host.roleKeys = [merchant.key];
  host.resourceTaken = true;
  host.gold = 0;
  host.hand = [];
  host.pendingDraw = [
    { uid: "plain", key: "temple", name: "神殿", color: "blue", cost: 1 },
    { uid: "valuable", key: "dragon_gate", name: "龙门", color: "purple", cost: 6 },
  ];
  host.pendingDrawMode = "scholar";
  state.deck = [];
  processBots(state);
  assert.ok(host.hand.some((card) => card.uid === "valuable"));
  assert.ok(!host.hand.some((card) => card.uid === "plain"));
});

test("rank-eight computer players use legal attacks against a leading city", () => {
  const { state, host } = createGameState("SIEG", "军阀电脑", 0);
  const rival = joinGame(state, "领先者");
  host.isBot = true;
  host.token = "";
  const warlord = ROLES.find((role) => role.key === "warlord")!;
  state.status = "turns";
  state.cast = [warlord];
  state.currentRank = warlord.rank;
  state.currentRoleKey = warlord.key;
  state.activePlayerId = host.id;
  host.roleKeys = [warlord.key];
  host.resourceTaken = true;
  host.gold = 4;
  host.hand = [];
  rival.city = [
    { uid: "cheap", key: "temple", name: "神殿", color: "blue", cost: 1 },
    { uid: "valuable", key: "harbor", name: "港口", color: "green", cost: 4 },
  ];
  processBots(state);
  assert.ok(rival.city.some((card) => card.uid === "cheap"));
  assert.ok(!rival.city.some((card) => card.uid === "valuable"));
});

test("eight-player games add rank nine and still complete", () => {
  const { state, host } = createGameState("EIGHT", "八人城主", 7, "cunning");
  host.isBot = true;
  host.token = "";
  startGame(state, host.id);
  assert.equal(state.cast.length, 9);
  assert.equal(state.cast.at(-1)?.rank, 9);
  for (let pass = 0; pass < 100 && state.status !== "finished"; pass += 1) processBots(state);
  assert.equal(state.status, "finished");
});

test("four-to-seven player rooms can opt into rank nine", () => {
  const { state, host } = createGameState("NINE", "可选九号", 3, "first_game", true);
  startGame(state, host.id);
  assert.equal(state.players.length, 4);
  assert.equal(state.cast.length, 9);
  assert.equal(state.cast.at(-1)?.key, "artist");
});

test("host can manage lobby seats and transfer control", () => {
  const { state, host } = createGameState("HOST", "房主", 0);
  const guest = joinGame(state, "客人");
  const bot = addBotPlayer(state, host.id);
  assert.equal(state.players.length, 3);
  removeLobbyPlayer(state, host.id, bot.id);
  assert.equal(state.players.length, 2);
  transferHost(state, host.id, guest.id);
  assert.equal(state.hostId, guest.id);
  claimHost(state, host.id);
  assert.equal(state.hostId, host.id);
});

test("a departed player can be entrusted to AI and recover the same seat", () => {
  const { state, host } = createGameState("BACK", "房主", 1);
  startGame(state, host.id);
  const result = leaveGame(state, host.id);
  assert.equal(result.removed, false);
  assert.equal(host.isBot, true);
  const restored = restorePlayerSeat(state, host.id);
  assert.equal(restored.isBot, false);
  assert.match(restored.token, /^secret_/);
});

test("host departure transfers control and a later human can reclaim a bot-only lobby", () => {
  const { state, host } = createGameState("HAND", "房主", 1);
  const guest = joinGame(state, "客人");
  leaveGame(state, host.id);
  assert.equal(state.hostId, guest.id);

  const botLobby = createGameState("BOTS", "临时房主", 1).state;
  const departedHost = botLobby.players[0];
  leaveGame(botLobby, departedHost.id);
  assert.equal(botLobby.players.every((player) => player.isBot), true);
  const newcomer = joinGame(botLobby, "新房主");
  assert.equal(botLobby.hostId, newcomer.id);
  assert.equal(botLobby.crownPlayerId, newcomer.id);
});

test("host can entrust an offline seat without revealing private access data", () => {
  const { state, host } = createGameState("SAFE", "房主", 0);
  const guest = joinGame(state, "掉线者");
  guest.recoveryHash = "hashed-secret";
  startGame(state, host.id);
  entrustPlayerToBot(state, host.id, guest.id);
  const view = publicGameView(state, host.id, { [host.id]: { online: true, lastSeenAt: "now" } });
  const publicGuest = view.players.find((player) => player.id === guest.id)!;
  assert.equal(publicGuest.isBot, true);
  assert.equal(publicGuest.isOnline, true);
  assert.equal("token" in publicGuest, false);
  assert.equal("recoveryHash" in publicGuest, false);
});

test("English mode covers every role, district, and ruleset", () => {
  assert.deepEqual(Object.keys(ROLE_EN).sort(), ROLES.map((role) => role.key).sort());
  assert.deepEqual(Object.keys(DISTRICT_EN).sort(), [...BASIC_DISTRICTS, ...UNIQUE_DISTRICTS].map((district) => district.key).sort());
  assert.deepEqual(Object.keys(RULESET_EN).sort(), RULESETS.map((ruleset) => ruleset.key).sort());
  assert.equal(localizedRole(ROLES[0], "en").name, "Assassin");
  assert.equal(localizedDistrict(BASIC_DISTRICTS[0], "en").name, "Manor");
});
