import { NextRequest, NextResponse } from "next/server";
import {
  addRealmBot,
  chooseRealmCasualties,
  chooseRealmBidTie,
  chooseRealmEvent,
  chooseRealmLeader,
  chooseRealmRetreat,
  chooseRealmSupport,
  createRealmState,
  entrustRealmPlayer,
  joinRealm,
  processRealmBots,
  publicRealmView,
  removeRealmPlayer,
  resolveRealmConsolidate,
  resolveRealmCombatEffect,
  resolveRealmMarch,
  resolveRealmRaid,
  startRealmGame,
  submitRealmBid,
  submitRealmMuster,
  submitRealmOrders,
  submitRealmSupplyLosses,
  resolveRealmBlade,
  resolveRealmRaven,
  type RealmMarchMove,
  type RealmMusterChoice,
  type RealmState,
} from "@/lib/realms";
import type { RealmEventKey, RealmOrderType } from "@/lib/realms-data";
import {
  cleanupExpiredRooms,
  enforceRateLimit,
  insertRoom,
  loadPresence,
  loadRoomRecord,
  saveRoom,
  touchPresence,
} from "@/db/rooms";

export const dynamic = "force-dynamic";

type Body = {
  action?: string;
  code?: string;
  name?: string;
  botCount?: number;
  tidesOfBattle?: boolean;
  playerId?: string;
  token?: string;
  recoveryCode?: string;
  targetPlayerId?: string;
  orders?: Record<string, RealmOrderType>;
  mode?: string;
  areaId?: string;
  sourceAreaId?: string;
  targetAreaId?: string;
  order?: RealmOrderType;
  moves?: RealmMarchMove[];
  leavePower?: boolean;
  side?: "attacker" | "defender" | "none";
  leaderKey?: string;
  use?: boolean;
  unitIds?: string[];
  musterChoices?: RealmMusterChoice[];
  event?: RealmEventKey;
  option?: string;
  amount?: number;
  faction?: string;
};

function cleanCode(value?: string | null) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

function cleanRecovery(value?: string | null) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

function randomCode(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function clientKey(request: NextRequest) {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function credentials(request: NextRequest, body?: Body) {
  const authorization = request.headers.get("authorization") ?? "";
  return {
    playerId: request.headers.get("x-player-id") ?? body?.playerId ?? "",
    token: authorization.startsWith("Bearer ") ? authorization.slice(7) : body?.token ?? "",
  };
}

function requireRealm(record: Awaited<ReturnType<typeof loadRoomRecord<RealmState>>>) {
  if (!record) throw new Error("没有找到这个六境房间，房间可能已超过七天未活动。 ");
  if (record.state.kind !== "realms") throw new Error("这个房间属于另一款游戏。 ");
  if (record.state.rulesVersion !== 2) throw new Error("这局使用旧版测试地图，无法混用新版规则；请创建一局新的六境战争。 ");
  return record;
}

function authenticate(state: RealmState, playerId: string, token: string) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player || player.isBot || !token || player.token !== token) throw new Error("房间身份已经失效，请使用恢复码返回座位。 ");
  return player;
}

async function responseFor(state: RealmState, playerId: string, session?: { token: string; recoveryCode?: string }) {
  await touchPresence(state.code, playerId);
  const presence = await loadPresence(state.code);
  return NextResponse.json({
    game: publicRealmView(state, playerId, presence),
    session: session ? { code: state.code, playerId, token: session.token, recoveryCode: session.recoveryCode } : undefined,
  });
}

function failure(error: unknown, status = 400) {
  return NextResponse.json({ error: error instanceof Error ? error.message.trim() : "操作失败，请重试。" }, { status });
}

async function saveOrConflict(state: RealmState, revision: number) {
  if (!await saveRoom(state, revision)) throw new Error("牌桌刚刚被另一项操作更新，请同步后重试。 ");
}

export async function GET(request: NextRequest) {
  try {
    const code = cleanCode(request.nextUrl.searchParams.get("code"));
    if (code.length !== 4) throw new Error("请输入四位房间码。 ");
    const { state } = requireRealm(await loadRoomRecord<RealmState>(code));
    const session = credentials(request, {
      playerId: request.nextUrl.searchParams.get("playerId") ?? undefined,
      token: request.nextUrl.searchParams.get("token") ?? undefined,
    });
    authenticate(state, session.playerId, session.token);
    return responseFor(state, session.playerId);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Body;
    const ip = clientKey(request);
    if (body.action === "create") {
      await enforceRateLimit(`realms-entry:${ip}`, 20);
      await cleanupExpiredRooms();
      if (!body.name?.trim()) throw new Error("请先输入昵称。 ");
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const recoveryCode = randomCode(10);
        const { state, host } = createRealmState(randomCode(4), body.name, body.botCount ?? 2, Boolean(body.tidesOfBattle));
        host.recoveryHash = await hash(recoveryCode);
        if (await insertRoom(state)) return responseFor(state, host.id, { token: host.token, recoveryCode });
      }
      throw new Error("暂时无法生成房间码，请重试。 ");
    }

    const code = cleanCode(body.code);
    if (code.length !== 4) throw new Error("请输入四位房间码。 ");
    if (body.action === "join") {
      await enforceRateLimit(`realms-entry:${ip}`, 20);
      const recoveryCode = randomCode(10);
      const recoveryHash = await hash(recoveryCode);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { state, revision } = requireRealm(await loadRoomRecord<RealmState>(code));
        const player = joinRealm(state, body.name ?? "");
        player.recoveryHash = recoveryHash;
        if (await saveRoom(state, revision)) return responseFor(state, player.id, { token: player.token, recoveryCode });
      }
      return failure(new Error("刚好有多人同时入座，请再试一次。"), 409);
    }
    if (body.action === "recover") {
      const recoveryCode = cleanRecovery(body.recoveryCode);
      if (recoveryCode.length !== 10) throw new Error("请输入十位恢复码。 ");
      const recoveryHash = await hash(recoveryCode);
      const { state, revision } = requireRealm(await loadRoomRecord<RealmState>(code));
      const player = state.players.find((candidate) => candidate.recoveryHash === recoveryHash);
      if (!player) throw new Error("恢复码不正确。 ");
      player.isBot = false;
      player.token = `token_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
      await saveOrConflict(state, revision);
      return responseFor(state, player.id, { token: player.token, recoveryCode });
    }

    const { state, revision } = requireRealm(await loadRoomRecord<RealmState>(code));
    const session = credentials(request, body);
    const player = authenticate(state, session.playerId, session.token);
    await enforceRateLimit(`realms-action:${ip}:${player.id}`, 180);
    await touchPresence(state.code, player.id);
    switch (body.action) {
      case "start": startRealmGame(state, player.id); break;
      case "addBot": addRealmBot(state, player.id); break;
      case "removePlayer": removeRealmPlayer(state, player.id, body.targetPlayerId ?? ""); break;
      case "entrust": entrustRealmPlayer(state, player.id, body.targetPlayerId ?? ""); break;
      case "claimHost": {
        const presence = await loadPresence(state.code);
        const host = state.players.find((candidate) => candidate.id === state.hostId);
        if (host && !host.isBot && presence[host.id]?.online) throw new Error("当前房主仍然在线。 ");
        state.hostId = player.id;
        state.log.push(`${player.name} 接任了房主。`);
        break;
      }
      case "submitOrders": submitRealmOrders(state, player.id, body.orders ?? {}); break;
      case "raven": resolveRealmRaven(state, player.id, { mode: body.mode as "replace" | "peek" | "top" | "bottom" | "skip", areaId: body.areaId, order: body.order }); break;
      case "raid": resolveRealmRaid(state, player.id, body.sourceAreaId ?? "", body.targetAreaId); break;
      case "march": resolveRealmMarch(state, player.id, body.sourceAreaId ?? "", body.moves ?? [], Boolean(body.leavePower)); break;
      case "support": chooseRealmSupport(state, player.id, body.areaId ?? "", body.side ?? "none"); break;
      case "leader": chooseRealmLeader(state, player.id, body.leaderKey ?? ""); break;
      case "blade": resolveRealmBlade(state, player.id, Boolean(body.use)); break;
      case "casualties": chooseRealmCasualties(state, player.id, body.unitIds ?? []); break;
      case "retreat": chooseRealmRetreat(state, player.id, body.areaId ?? ""); break;
      case "consolidate": resolveRealmConsolidate(state, player.id, body.areaId ?? "", body.mode === "muster" ? "muster" : "power", body.musterChoices ?? []); break;
      case "combatEffect": resolveRealmCombatEffect(state, player.id, body.option); break;
      case "eventChoice": chooseRealmEvent(state, player.id, body.event!); break;
      case "supply": submitRealmSupplyLosses(state, player.id, body.unitIds ?? []); break;
      case "muster": submitRealmMuster(state, player.id, body.musterChoices ?? []); break;
      case "bid": submitRealmBid(state, player.id, body.amount ?? 0); break;
      case "bidTie": chooseRealmBidTie(state, player.id, body.faction ?? ""); break;
      default: throw new Error("未知操作。 ");
    }
    processRealmBots(state);
    await saveOrConflict(state, revision);
    return responseFor(state, player.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return failure(error, message.includes("另一项操作") ? 409 : 400);
  }
}
