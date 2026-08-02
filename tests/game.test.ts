import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDistrict,
  chooseRole,
  createDistrictDeck,
  createGameState,
  currentPickerId,
  endTurn,
  joinGame,
  playerScoreBreakdown,
  processBots,
  publicGameView,
  startGame,
  takeGold,
  activateRoleAbility,
  type DistrictCard,
  type GameState,
} from "../lib/game.ts";
import { BASIC_DISTRICTS, ROLES, RULESETS, UNIQUE_DISTRICTS } from "../lib/rules.ts";

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
