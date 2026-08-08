import assert from "node:assert/strict";
import test from "node:test";
import {
  createRealmState,
  entrustRealmPlayer,
  processRealmBots,
  publicRealmView,
  resolveRealmRaven,
  startRealmGame,
  submitRealmBid,
  submitRealmOrders,
  type RealmState,
} from "../lib/realms.ts";
import { REALM_AREAS, REALM_EVENT_DECKS, REALM_FACTIONS, REALM_LEADERS, REALM_ORDER_COUNTS, REALM_PLAYER_SETUPS, REALM_STARTING_UNITS, type RealmOrderType } from "../lib/realms-data.ts";

test("ships six factions, a full leader deck, fifteen orders, and a connected realm map", () => {
  assert.equal(REALM_FACTIONS.length, 6);
  assert.equal(REALM_LEADERS.length, 42);
  assert.equal(Object.values(REALM_ORDER_COUNTS).reduce((sum, count) => sum + count, 0), 15);
  assert.equal(REALM_AREAS.filter((area) => area.kind === "land").length, 38);
  assert.equal(REALM_AREAS.filter((area) => area.kind === "sea").length, 12);
  assert.equal(REALM_AREAS.filter((area) => area.kind === "port").length, 8);
  for (const area of REALM_AREAS) {
    assert.ok(area.adjacent.length > 0, `${area.key} needs an adjacent area`);
    for (const adjacent of area.adjacent) assert.ok(REALM_AREAS.some((candidate) => candidate.key === adjacent), `${area.key} points to missing ${adjacent}`);
  }
  assert.deepEqual(Object.values(REALM_EVENT_DECKS).map((deck) => deck.length), [10, 10, 10]);
});

test("starts every supported player count with factions, forces, tracks, and seven leaders", () => {
  for (let playerCount = 3; playerCount <= 6; playerCount += 1) {
    const { state, host } = createRealmState(`R${playerCount}AA`, "人类领主", playerCount - 1);
    startRealmGame(state, host.id);
    assert.equal(state.players.length, playerCount);
    assert.equal(new Set(state.players.map((player) => player.faction)).size, playerCount);
    assert.deepEqual(state.players.map((player) => player.faction), REALM_PLAYER_SETUPS[playerCount].factions);
    assert.equal(state.influence.throne.length, playerCount);
    for (const player of state.players) {
      assert.equal(player.leaderHand.length, 7);
      const units = Object.values(state.areas).flatMap((area) => area.units).filter((unit) => unit.faction === player.faction);
      const expected = REALM_STARTING_UNITS.filter((placement) => placement.faction === player.faction && !REALM_PLAYER_SETUPS[playerCount].removedStartingAreas.includes(placement.area)).reduce((sum, placement) => sum + (placement.quantity ?? 1), 0);
      assert.equal(units.length, expected);
    }
    for (const areaId of REALM_PLAYER_SETUPS[playerCount].blocked) assert.equal(state.areas[areaId].blocked, true);
    for (const [areaId, strength] of Object.entries(REALM_PLAYER_SETUPS[playerCount].neutralForces)) assert.equal(state.areas[areaId].neutral, strength);
  }
});

test("keeps opposing orders and leader hands secret during planning", () => {
  const { state, host } = createRealmState("HIDE", "北方玩家", 2);
  startRealmGame(state, host.id);
  const rival = state.players[1];
  const rivalArea = REALM_AREAS.find((area) => state.areas[area.key].units.some((unit) => unit.faction === rival.faction))!;
  state.areas[rivalArea.key].order = "march";
  const view = publicRealmView(state, host.id);
  assert.equal(view.areas[rivalArea.key].order, "hidden");
  assert.deepEqual(view.players.find((player) => player.id === rival.id)?.leaderHand, []);
  assert.equal(view.players.find((player) => player.id === host.id)?.leaderHand.length, 7);
});

test("all human factions plan simultaneously and reveal only after the final lock", () => {
  const { state, host } = createRealmState("SYNC", "同时规划者", 2);
  state.players.forEach((player) => { player.isBot = false; });
  startRealmGame(state, host.id);
  assert.equal(state.phase, "planning");
  assert.equal(state.currentPlayerId, null);

  const ordersFor = (faction: string | null) => {
    const occupied = REALM_AREAS.filter((area) => state.areas[area.key].units.some((unit) => unit.faction === faction));
    const orders: RealmOrderType[] = ["raid", "march_minus", "defend", "support", "power"];
    return Object.fromEntries(occupied.map((area, index) => [area.key, orders[index]])) as Record<string, RealmOrderType>;
  };

  submitRealmOrders(state, state.players[0].id, ordersFor(state.players[0].faction));
  submitRealmOrders(state, state.players[1].id, ordersFor(state.players[1].faction));
  assert.equal(state.phase, "planning");
  assert.equal(state.currentPlayerId, null);
  assert.equal(state.players.filter((player) => player.submitted).length, 2);
  const hiddenView = publicRealmView(state, state.players[0].id);
  const rivalArea = REALM_AREAS.find((area) => state.areas[area.key].units.some((unit) => unit.faction === state.players[1].faction))!;
  assert.equal(hiddenView.areas[rivalArea.key].order, "hidden");

  submitRealmOrders(state, state.players[2].id, ordersFor(state.players[2].faction));
  assert.notEqual(state.phase, "planning");
});

test("validates the physical order inventory on the server", () => {
  const { state, host } = createRealmState("ORDR", "下令者", 2);
  startRealmGame(state, host.id);
  const areas = REALM_AREAS.filter((area) => state.areas[area.key].units.some((unit) => unit.faction === host.faction));
  const invalid = Object.fromEntries(areas.map((area) => [area.key, "march"])) as Record<string, RealmOrderType>;
  assert.throws(() => submitRealmOrders(state, host.id, invalid), /命令标记超过/);
  const legalOrders: RealmOrderType[] = ["march", "defend", "power", "support", "raid"];
  const legal = Object.fromEntries(areas.map((area, index) => [area.key, legalOrders[index]])) as Record<string, RealmOrderType>;
  submitRealmOrders(state, host.id, legal);
  assert.equal(host.submitted, true);
});

test("server AI can play a complete ten-round campaign without stalling", () => {
  for (let run = 0; run < 3; run += 1) {
    const { state, host } = createRealmState(`BOT${run}`, "自动统帅", 5);
    host.isBot = true;
    host.token = "";
    startRealmGame(state, host.id);
    for (let pass = 0; pass < 60 && state.phase !== "finished"; pass += 1) processRealmBots(state);
    assert.equal(state.phase, "finished", stalledState(state));
    assert.ok(state.winnerId);
    assert.ok(state.round <= 10);
  }
});

test("bidding ties are explicitly decided by the Throne holder", () => {
  const { state, host } = createRealmState("TIES", "王座裁决者", 2);
  startRealmGame(state, host.id);
  state.players.forEach((player) => { player.isBot = false; });
  state.phase = "influence_bid";
  state.bid = { kind: "influence", track: "throne", bids: Object.fromEntries(state.players.map((player) => [player.id, null])) };
  for (const player of state.players) submitRealmBid(state, player.id, 0);
  assert.equal(state.phase, "bid_tiebreak");
  assert.equal(state.currentPlayerId, state.players.find((player) => player.faction === state.influence.throne[0])?.id);
  assert.equal(state.tieBreak?.groups[state.tieBreak.groupIndex].length, 3);
});

test("the Raven can inspect the frontier deck and move its top card to the bottom", () => {
  const { state, host } = createRealmState("RAVN", "信鸦持有者", 2);
  state.players.forEach((player) => { player.isBot = false; });
  startRealmGame(state, host.id);
  state.influence.court = [host.faction!, ...state.influence.court.filter((faction) => faction !== host.faction)];
  state.phase = "raven";
  state.currentPlayerId = host.id;
  const top = state.wildlingDeck[0];
  resolveRealmRaven(state, host.id, { mode: "peek" });
  assert.equal(state.phase, "raven");
  assert.match(host.privateNotes.at(-1) ?? "", new RegExp(top));
  resolveRealmRaven(state, host.id, { mode: "bottom" });
  assert.equal(state.wildlingDeck.at(-1), top);
  assert.equal(state.ravenPeekedBy, null);
  assert.notEqual(state.phase, "raven");
});

test("an offline seat can be entrusted to AI and recovered later", () => {
  const { state, host } = createRealmState("DROP", "房主", 2);
  state.players.forEach((player) => { player.isBot = false; });
  startRealmGame(state, host.id);
  const target = state.players[1];
  entrustRealmPlayer(state, host.id, target.id);
  assert.equal(target.isBot, true);
  assert.match(state.log.at(-1) ?? "", /恢复码/);
});

test("a failed frontier defense applies the Wildling card to every participating faction", () => {
  const { state, host } = createRealmState("WILD", "守境者", 2);
  state.players.forEach((player) => { player.isBot = false; });
  startRealmGame(state, host.id);
  state.phase = "wildling_bid";
  state.wildlingThreat = 12;
  state.wildlingDeck = ["mammoths", ...state.wildlingDeck.filter((card) => card !== "mammoths")];
  state.bid = { kind: "wildling", bids: Object.fromEntries(state.players.map((player) => [player.id, null])) };
  const before = Object.fromEntries(state.players.map((player) => [player.id, Object.values(state.areas).flatMap((area) => area.units).filter((unit) => unit.faction === player.faction).length]));
  submitRealmBid(state, state.players[0].id, 3);
  submitRealmBid(state, state.players[1].id, 2);
  submitRealmBid(state, state.players[2].id, 1);
  const after = Object.fromEntries(state.players.map((player) => [player.id, Object.values(state.areas).flatMap((area) => area.units).filter((unit) => unit.faction === player.faction).length]));
  assert.equal(after[state.players[0].id], before[state.players[0].id] - 2);
  assert.equal(after[state.players[1].id], before[state.players[1].id] - 2);
  assert.equal(after[state.players[2].id], before[state.players[2].id] - 3);
  assert.equal(state.wildlingThreat, 10);
});

function stalledState(state: RealmState) {
  return `AI stalled in ${state.phase}, round ${state.round}, current ${state.currentPlayerId ?? "none"}`;
}
