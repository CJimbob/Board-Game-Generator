import type { Metadata } from "next";
import { GameClient } from "../GameClient";

export const metadata: Metadata = {
  title: "王冠之城｜线上秘密选角桌游",
  description: "邀请朋友进入同一房间，秘密选择角色、获取金币并建造属于你们的城市。",
};

export default function CrownCityPage() {
  return <GameClient />;
}
