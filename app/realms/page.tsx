import type { Metadata } from "next";
import { RealmsClient } from "./RealmsClient";
import "./realms.css";

export const metadata: Metadata = {
  title: "六境争霸｜在线史诗版图桌游",
  description: "三至六人同时秘密下令、争夺城堡、竞拍影响力，并在十轮内统一六境。",
};

export default function RealmsPage() {
  return <RealmsClient />;
}
