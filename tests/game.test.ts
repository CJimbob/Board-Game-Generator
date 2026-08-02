import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDistrict,
  chooseRole,
  createGameState,
  drawDistrictChoices,
  endTurn,
  joinGame,
  keepDistrictCard,
  publicGameView,
  startGame,
  takeGold,
  useRoleAbility,
  type DistrictCard,
} from "../lib/game.ts";

function twoPlayerGame() {
  const { state, host } = createGameState("TEST", "甲", 0);
  const second = joinGame(state, "乙");
  startGame(state, host.id);
  return { state, host, second };
}

test("keeps unrevealed opponent roles secret and advances by role number", () => {
  const { state, host, second } = twoPlayerGame();
  chooseRole(state, host.id, 4);
  chooseRole(state, second.id, 8);

  assert.equal(state.currentRole, 4);
  assert.equal(state.crownPlayerId, host.id);
  const hostView = publicGameView(state, host.id);
  assert.equal(hostView.players.find((player) => player.id === second.id)?.roleId, null);

  takeGold(state, host.id);
  endTurn(state, host.id);
  assert.equal(state.currentRole, 8);
  assert.equal(state.players.find((player) => player.id === second.id)?.revealed, true);
});

test("supports drawing, keeping and building a district", () => {
  const { state, host, second } = twoPlayerGame();
  chooseRole(state, host.id, 3);
  chooseRole(state, second.id, 8);

  drawDistrictChoices(state, host.id);
  assert.ok(host.pendingDraw.length > 0);
  const kept = host.pendingDraw[0];
  keepDistrictCard(state, host.id, kept.uid);
  assert.ok(host.hand.some((card) => card.uid === kept.uid));

  const affordable: DistrictCard = {
    uid: "test-build",
    name: "测试城区",
    color: "purple",
    cost: 1,
  };
  host.hand.push(affordable);
  buildDistrict(state, host.id, affordable.uid);
  assert.equal(host.gold, 1);
  assert.equal(host.city.at(-1)?.name, "测试城区");
});

test("assassin skips the named role and starts a new round", () => {
  const { state, host, second } = twoPlayerGame();
  chooseRole(state, host.id, 1);
  chooseRole(state, second.id, 2);
  useRoleAbility(state, host.id, 2);
  takeGold(state, host.id);
  endTurn(state, host.id);

  assert.equal(state.status, "draft");
  assert.equal(state.round, 2);
  assert.match(state.log.join("\n"), /本轮被刺杀/);
});

