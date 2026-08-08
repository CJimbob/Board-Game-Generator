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
import { REALM_AREAS, REALM_EVENT_DECKS, REALM_FACTIONS, REALM_LEADERS, REALM_ORDER_COUNTS, type RealmOrderType } from "../lib/realms-data.ts";

test("ships six factions, a full leader deck, fifteen orders, and a connected realm map", () => {
  assert.equal(REALM_FACTIONS.length, 6);
  assert.equal(REALM_LEADERS.length, 42);
  assert.equal(Object.values(REALM_ORDER_COUNTS).reduce((sum, count) => sum + count, 0), 15);
  assert.equal(REALM_AREAS.filter((area) => area.kind === "land").length, 24);
  assert.equal(REALM_AREAS.filter((area) => area.kind === "sea").length, 7);
  assert.equal(REALM_AREAS.filter((area) => area.kind === "port").length, 6);
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
    assert.equal(state.influence.throne.length, playerCount);
    for (const player of state.players) {
      assert.equal(player.leaderHand.length, 7);
      const units = Object.values(state.areas).flatMap((area) => area.units).filter((unit) => unit.faction === player.faction);
      assert.equal(units.length, 4);
    }
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

function stalledState(state: RealmState) {
  return `AI stalled in ${state.phase}, round ${state.round}, current ${state.currentPlayerId ?? "none"}`;
}
