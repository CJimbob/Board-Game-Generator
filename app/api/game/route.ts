import { NextRequest, NextResponse } from "next/server";
import {
  buildDistrict,
  chooseRole,
  createGameState,
  destroyDistrict,
  drawDistrictChoices,
  endTurn,
  joinGame,
  keepDistrictCard,
  processBots,
  publicGameView,
  restartGame,
  startGame,
  takeGold,
  useRoleAbility,
  type GameState,
} from "@/lib/game";
import { insertRoom, loadRoom, saveRoom } from "@/db/rooms";

export const dynamic = "force-dynamic";

type ActionBody = {
  action?: string;
  code?: string;
  name?: string;
  botCount?: number;
  playerId?: string;
  token?: string;
  roleId?: number;
  targetRole?: number;
  cardUid?: string;
  targetPlayerId?: string;
  districtUid?: string;
};

function cleanCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

function randomRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 4; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function authenticate(state: GameState, playerId?: string, token?: string) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player || player.isBot || !token || player.token !== token) {
    throw new Error("房间身份已经失效，请重新加入。 ");
  }
  return player;
}

function ok(state: GameState, playerId: string, token?: string) {
  return NextResponse.json({
    game: publicGameView(state, playerId),
    session: token ? { code: state.code, playerId, token } : undefined,
  });
}

function failure(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message.trim() : "操作失败，请稍后重试。";
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const code = cleanCode(request.nextUrl.searchParams.get("code"));
    const playerId = request.nextUrl.searchParams.get("playerId") ?? "";
    const token = request.nextUrl.searchParams.get("token") ?? "";
    if (code.length !== 4) throw new Error("请输入四位房间码。 ");
    const state = await loadRoom(code);
    if (!state) return failure(new Error("没有找到这个房间。"), 404);
    authenticate(state, playerId, token);
    return ok(state, playerId);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ActionBody;
    if (body.action === "create") {
      const name = (body.name ?? "").trim();
      if (!name) throw new Error("请先输入昵称。 ");
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const code = randomRoomCode();
        const { state, host } = createGameState(code, name, body.botCount ?? 1);
        if (await insertRoom(state)) return ok(state, host.id, host.token);
      }
      throw new Error("暂时无法生成房间码，请重试。 ");
    }

    const code = cleanCode(body.code);
    if (code.length !== 4) throw new Error("请输入四位房间码。 ");
    const state = await loadRoom(code);
    if (!state) return failure(new Error("没有找到这个房间。"), 404);

    if (body.action === "join") {
      const player = joinGame(state, body.name ?? "");
      await saveRoom(state);
      return ok(state, player.id, player.token);
    }

    const player = authenticate(state, body.playerId, body.token);
    switch (body.action) {
      case "start":
        startGame(state, player.id);
        break;
      case "chooseRole":
        chooseRole(state, player.id, Number(body.roleId));
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
        buildDistrict(state, player.id, body.cardUid ?? "");
        break;
      case "ability":
        useRoleAbility(state, player.id, body.targetRole);
        break;
      case "destroy":
        destroyDistrict(
          state,
          player.id,
          body.targetPlayerId ?? "",
          body.districtUid ?? "",
        );
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
    await saveRoom(state);
    return ok(state, player.id);
  } catch (error) {
    return failure(error);
  }
}

