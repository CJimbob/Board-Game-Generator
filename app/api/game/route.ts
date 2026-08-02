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
  resolveBlackmail,
  resolveTheater,
  restartGame,
  startGame,
  takeGold,
  takeRoleIncome,
  activateDistrictAbility,
  activateRankEightAbility,
  activateRoleAbility,
  type GameState,
} from "@/lib/game";
import { insertRoom, loadRoom, saveRoom } from "@/db/rooms";

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
    if (!state.rulesetKey) {
      return failure(new Error("这个房间来自旧版本，请回到首页创建新房间。"), 409);
    }
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
        const { state, host } = createGameState(
          code,
          name,
          body.botCount ?? 1,
          body.rulesetKey ?? "first_game",
          Boolean(body.includeRankNine),
        );
        if (await insertRoom(state)) return ok(state, host.id, host.token);
      }
      throw new Error("暂时无法生成房间码，请重试。 ");
    }

    const code = cleanCode(body.code);
    if (code.length !== 4) throw new Error("请输入四位房间码。 ");
    const state = await loadRoom(code);
    if (!state) return failure(new Error("没有找到这个房间。"), 404);
    if (!state.rulesetKey) {
      return failure(new Error("这个房间来自旧版本，请回到首页创建新房间。"), 409);
    }

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
