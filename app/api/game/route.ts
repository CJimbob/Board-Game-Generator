import { NextRequest, NextResponse } from "next/server";
import {
  activateDistrictAbility,
  activateRankEightAbility,
  activateRoleAbility,
  addBotPlayer,
  buildDistrict,
  chooseRole,
  claimHost,
  createMatchHistorySummary,
  createGameState,
  destroyDistrict,
  drawDistrictChoices,
  endTurn,
  entrustPlayerToBot,
  joinGame,
  keepDistrictCard,
  leaveGame,
  processBots,
  publicGameView,
  removeLobbyPlayer,
  resolveBlackmail,
  resolveTheater,
  restartGame,
  restorePlayerSeat,
  startGame,
  takeGold,
  takeRoleIncome,
  transferHost,
  type GameState,
  type PlayerState,
} from "@/lib/game";
import {
  archiveFinishedMatch,
  cleanupExpiredRooms,
  deletePlayerMetadata,
  enforceRateLimit,
  insertRoom,
  isPlayerOffline,
  listMatchHistory,
  loadPresence,
  loadRoomRecord,
  saveRoom,
  touchPresence,
} from "@/db/rooms";

export const dynamic = "force-dynamic";

type ActionBody = {
  action?: string;
  code?: string;
  name?: string;
  botCount?: number;
  rulesetKey?: string;
  includeRankNine?: boolean;
  playerId?: string;
  token?: string;
  recoveryCode?: string;
  historyKey?: string;
  roleId?: number;
  roleKey?: string;
  targetRole?: number;
  targetRoleKey?: string;
  cardUid?: string;
  cardUids?: string[];
  targetPlayerId?: string;
  districtUid?: string;
  targetDistrictUid?: string;
  ownDistrictUid?: string;
  districtColor?: "yellow" | "blue" | "green" | "red" | "purple";
  mode?: string;
  amountCards?: number;
  bribe?: boolean;
  sacrificeUid?: string;
  paymentCardUids?: string[];
};

function cleanCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

function cleanRecoveryCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

function cleanHistoryKey(value: string | null | undefined) {
  return (value ?? "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 128);
}

function randomCode(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

async function hashRecoveryCode(code: string) {
  const bytes = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function historyKeyHash(value: string | null | undefined) {
  const key = cleanHistoryKey(value);
  if (key.length < 32) return null;
  return hashRecoveryCode(key);
}

async function archiveIfFinished(state: GameState) {
  if (state.status === "finished") {
    await archiveFinishedMatch(state, createMatchHistorySummary(state));
  }
}

function clientKey(request: NextRequest) {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

function credentials(request: NextRequest, body?: ActionBody) {
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return {
    playerId: request.headers.get("x-player-id") ?? body?.playerId ?? "",
    token: bearer || body?.token || "",
  };
}

function authenticate(state: GameState, playerId?: string, token?: string) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player || player.isBot || !token || player.token !== token) {
    throw new Error("房间身份已经失效，请使用恢复码返回座位。 ");
  }
  return player;
}

async function responseFor(
  state: GameState,
  playerId: string,
  session?: { token: string; recoveryCode?: string },
) {
  await touchPresence(state.code, playerId);
  const presence = await loadPresence(state.code);
  return NextResponse.json({
    game: publicGameView(state, playerId, presence),
    session: session ? {
      code: state.code,
      playerId,
      token: session.token,
      recoveryCode: session.recoveryCode,
    } : undefined,
  });
}

function failure(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message.trim() : "操作失败，请稍后重试。";
  return NextResponse.json({ error: message }, { status });
}

function requireCurrentRoom(record: Awaited<ReturnType<typeof loadRoomRecord>>) {
  if (!record) throw new Error("没有找到这个房间，房间可能已超过 7 天未活动。 ");
  if (!record.state.rulesetKey) throw new Error("这个房间来自旧版本，请回到首页创建新房间。 ");
  return record;
}

async function saveOrConflict(state: GameState, revision: number) {
  if (!await saveRoom(state, revision)) {
    throw new Error("牌桌刚刚被另一项操作更新，请同步后重试。 ");
  }
}

export async function GET(request: NextRequest) {
  try {
    const code = cleanCode(request.nextUrl.searchParams.get("code"));
    if (code.length !== 4) throw new Error("请输入四位房间码。 ");
    const { state } = requireCurrentRoom(await loadRoomRecord(code));
    const session = credentials(request, {
      playerId: request.nextUrl.searchParams.get("playerId") ?? undefined,
      token: request.nextUrl.searchParams.get("token") ?? undefined,
    });
    authenticate(state, session.playerId, session.token);
    await archiveIfFinished(state);
    return await responseFor(state, session.playerId);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ActionBody;
    const ip = clientKey(request);

    if (body.action === "listHistory") {
      await enforceRateLimit(`history:${ip}`, 30);
      const keyHash = await historyKeyHash(body.historyKey);
      if (!keyHash) throw new Error("这台设备的历史记录密钥无效，请刷新页面重试。 ");
      return NextResponse.json({ history: await listMatchHistory(keyHash) });
    }

    if (body.action === "create") {
      await enforceRateLimit(`entry:${ip}`, 20);
      await cleanupExpiredRooms();
      const name = (body.name ?? "").trim();
      if (!name) throw new Error("请先输入昵称。 ");
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const code = randomCode(4);
        const recoveryCode = randomCode(10);
        const { state, host } = createGameState(
          code,
          name,
          body.botCount ?? 1,
          body.rulesetKey ?? "first_game",
          Boolean(body.includeRankNine),
        );
        host.recoveryHash = await hashRecoveryCode(recoveryCode);
        host.historyKeyHash = await historyKeyHash(body.historyKey) ?? undefined;
        if (await insertRoom(state)) {
          return await responseFor(state, host.id, { token: host.token, recoveryCode });
        }
      }
      throw new Error("暂时无法生成房间码，请重试。 ");
    }

    const code = cleanCode(body.code);
    if (code.length !== 4) throw new Error("请输入四位房间码。 ");

    if (body.action === "join") {
      await enforceRateLimit(`entry:${ip}`, 20);
      const recoveryCode = randomCode(10);
      const recoveryHash = await hashRecoveryCode(recoveryCode);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { state, revision } = requireCurrentRoom(await loadRoomRecord(code));
        const player = joinGame(state, body.name ?? "");
        player.recoveryHash = recoveryHash;
        player.historyKeyHash = await historyKeyHash(body.historyKey) ?? undefined;
        if (await saveRoom(state, revision)) {
          return await responseFor(state, player.id, { token: player.token, recoveryCode });
        }
      }
      return failure(new Error("刚好有多人同时入座，请再点一次加入。"), 409);
    }

    if (body.action === "recover") {
      await enforceRateLimit(`recovery:${ip}`, 12);
      const recoveryCode = cleanRecoveryCode(body.recoveryCode);
      if (recoveryCode.length !== 10) throw new Error("请输入 10 位恢复码。 ");
      const recoveryHash = await hashRecoveryCode(recoveryCode);
      const { state, revision } = requireCurrentRoom(await loadRoomRecord(code));
      const seat = state.players.find((player) => player.recoveryHash === recoveryHash);
      if (!seat) throw new Error("恢复码不正确，或这个座位已经被移除。 ");
      seat.historyKeyHash = await historyKeyHash(body.historyKey) ?? seat.historyKeyHash;
      const player = restorePlayerSeat(state, seat.id);
      await saveOrConflict(state, revision);
      await archiveIfFinished(state);
      return await responseFor(state, player.id, { token: player.token, recoveryCode });
    }

    const record = requireCurrentRoom(await loadRoomRecord(code));
    const { state, revision } = record;
    const session = credentials(request, body);
    const player = authenticate(state, session.playerId, session.token);
    await enforceRateLimit(`action:${ip}:${player.id}`, 120);
    await touchPresence(state.code, player.id);
    const keyHash = await historyKeyHash(body.historyKey);
    if (keyHash && player.historyKeyHash !== keyHash) {
      player.historyKeyHash = keyHash;
      state.version += 1;
      state.updatedAt = new Date().toISOString();
    }

    if (body.action === "refreshRecovery") {
      const recoveryCode = randomCode(10);
      player.recoveryHash = await hashRecoveryCode(recoveryCode);
      state.version += 1;
      state.updatedAt = new Date().toISOString();
      await saveOrConflict(state, revision);
      await archiveIfFinished(state);
      return await responseFor(state, player.id, { token: player.token, recoveryCode });
    }

    let removedPlayer: PlayerState | null = null;
    switch (body.action) {
      case "start":
        startGame(state, player.id);
        break;
      case "addBot":
        addBotPlayer(state, player.id);
        break;
      case "removePlayer":
        removedPlayer = removeLobbyPlayer(state, player.id, body.targetPlayerId ?? "");
        break;
      case "transferHost":
        transferHost(state, player.id, body.targetPlayerId ?? "");
        break;
      case "claimHost": {
        if (state.hostId === player.id) throw new Error("你已经是房主。 ");
        if (!await isPlayerOffline(state.code, state.hostId, 45)) {
          throw new Error("房主尚未离线满 45 秒。 ");
        }
        claimHost(state, player.id);
        break;
      }
      case "entrust": {
        const targetPlayerId = body.targetPlayerId ?? "";
        if (!await isPlayerOffline(state.code, targetPlayerId, 45)) {
          throw new Error("这位玩家尚未离线满 45 秒。 ");
        }
        entrustPlayerToBot(state, player.id, targetPlayerId);
        break;
      }
      case "leaveRoom": {
        const result = leaveGame(state, player.id);
        processBots(state);
        await saveOrConflict(state, revision);
        await archiveIfFinished(state);
        await deletePlayerMetadata(state.code, player.id);
        return NextResponse.json({ left: true, seatPreserved: !result.removed });
      }
      case "chooseRole":
        chooseRole(state, player.id, body.roleKey ?? Number(body.roleId));
        break;
      case "theater":
        resolveTheater(state, player.id, body.targetPlayerId, body.roleKey);
        break;
      case "takeGold":
        takeGold(state, player.id);
        break;
      case "drawCards":
        drawDistrictChoices(state, player.id);
        break;
      case "keepCard":
        keepDistrictCard(state, player.id, body.cardUid ?? "");
        break;
      case "build":
        buildDistrict(state, player.id, body.cardUid ?? "", {
          mode: body.mode as "normal" | "framework" | "necropolis" | undefined,
          sacrificeUid: body.sacrificeUid,
          paymentCardUids: body.paymentCardUids,
        });
        break;
      case "ability":
        activateRoleAbility(state, player.id, {
          mode: body.mode,
          targetRoleKey: body.targetRoleKey ?? (
            body.targetRole
              ? state.cast.find((role) => role.rank === body.targetRole)?.key
              : undefined
          ),
          targetPlayerId: body.targetPlayerId,
          districtColor: body.districtColor,
          cardUid: body.cardUid,
          cardUids: body.cardUids,
          targetDistrictUid: body.targetDistrictUid,
          ownDistrictUid: body.ownDistrictUid,
          amountCards: body.amountCards,
        });
        break;
      case "roleIncome":
        takeRoleIncome(state, player.id);
        break;
      case "blackmail":
        resolveBlackmail(state, player.id, Boolean(body.bribe));
        break;
      case "rankEight":
        activateRankEightAbility(
          state,
          player.id,
          body.targetPlayerId ?? "",
          body.targetDistrictUid ?? body.districtUid ?? "",
          body.ownDistrictUid,
        );
        break;
      case "districtAbility":
        activateDistrictAbility(state, player.id, body.districtUid ?? "", {
          cardUid: body.cardUid,
          targetPlayerId: body.targetPlayerId,
          targetDistrictUid: body.targetDistrictUid,
        });
        break;
      case "destroy":
        destroyDistrict(state, player.id, body.targetPlayerId ?? "", body.districtUid ?? "");
        break;
      case "endTurn":
        endTurn(state, player.id);
        break;
      case "restart":
        restartGame(state, player.id);
        break;
      default:
        throw new Error("未知操作。 ");
    }

    processBots(state);
    await saveOrConflict(state, revision);
    await archiveIfFinished(state);
    if (removedPlayer) await deletePlayerMetadata(state.code, removedPlayer.id);
    return await responseFor(state, player.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return failure(error, message.includes("另一项操作") ? 409 : 400);
  }
}
