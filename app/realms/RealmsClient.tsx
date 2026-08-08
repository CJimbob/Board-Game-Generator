"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

type Language = "zh" | "en";
type Session = { code: string; playerId: string; token: string; recoveryCode?: string };
type Order = "raid" | "raid_star" | "march_minus" | "march" | "march_star" | "defend" | "defend_star" | "support" | "support_star" | "power" | "power_star";
type Unit = { id: string; faction: string; type: "footman" | "knight" | "ship" | "siege"; routed: boolean };
type AreaDefinition = { key: string; name: string; nameEn: string; kind: "land" | "sea" | "port"; x: number; y: number; adjacent: string[]; castle?: 1 | 2; supply?: number; power?: number; portOf?: string; seaOf?: string; homeOf?: string };
type Faction = { key: string; name: string; nameEn: string; motto: string; mottoEn: string; color: string; home: string; port: string };
type Leader = { key: string; faction: string; name: string; nameEn: string; strength: number; swords: number; forts: number; effect: string; text: string; textEn: string };
type Player = { id: string; name: string; isBot: boolean; isOnline: boolean; faction: string | null; power: number; supply: number; submitted: boolean; castles: number; leaderHand: string[]; leaderHandCount: number; leaderDiscard: string[]; privateNotes: string[] };
type MusterChoice = { sourceAreaId: string; type: Unit["type"]; targetAreaId?: string; upgradeUnitId?: string };
type Combat = {
  sourceAreaId: string;
  targetAreaId: string;
  attackerFaction: string;
  defenderFaction: string;
  attackingUnits: Unit[];
  supportQueue: string[];
  supportChoices: Record<string, "attacker" | "defender" | "none" | null>;
  leaderChoices: Record<string, string | "hidden" | null>;
  casualtiesRequired: number;
  retreatOptions: string[];
};
type Game = {
  code: string;
  phase: string;
  round: number;
  hostId: string;
  viewerId: string;
  currentPlayerId: string | null;
  players: Player[];
  areas: Record<string, { units: Unit[]; control: string | null; controlToken: boolean; order: Order | "hidden" | null; neutral: number | null; garrison: number | null }>;
  influence: { throne: string[]; fiefdom: string[]; court: string[] };
  bladeUsed: boolean;
  ravenUsed: boolean;
  ravenPeeked: boolean;
  wildlingThreat: number;
  currentEvent: string | null;
  eventChoice: string[];
  forbiddenOrderFamily: string | null;
  bid: { kind: "influence" | "wildling"; track?: string; bids: Record<string, number | "submitted" | null> } | null;
  tieBreak: { kind: "influence" | "wildling"; track?: string; choices: string[]; rankedFactions: string[] } | null;
  supplyQueue: string[];
  musterQueue: string[];
  pendingCombat: Combat | null;
  tidesOfBattle: boolean;
  winnerId: string | null;
  log: string[];
  version: number;
  factions: Faction[];
  areaDefinitions: AreaDefinition[];
  leaders: Leader[];
  orderCounts: Record<Order, number>;
};

const SESSION_KEY = "six-realms-session-v1";
const LANGUAGE_KEY = "six-realms-language";
const ORDER_LABELS: Record<Order, [string, string]> = {
  raid: ["突袭", "Raid"], raid_star: ["★突袭", "★ Raid"],
  march_minus: ["行军 −1", "March −1"], march: ["行军 +0", "March +0"], march_star: ["★行军 +1", "★ March +1"],
  defend: ["防御 +1", "Defense +1"], defend_star: ["★防御 +2", "★ Defense +2"],
  support: ["支援", "Support"], support_star: ["★支援 +1", "★ Support +1"],
  power: ["集权", "Consolidate"], power_star: ["★集权/征召", "★ Consolidate/Muster"],
};
const PHASE_LABELS: Record<string, [string, string]> = {
  lobby: ["战争议会", "War council"], events: ["王国事件", "Realm events"], event_choice: ["裁决事件", "Choose event"],
  supply: ["补给调整", "Supply adjustment"], mustering: ["全国征召", "Mustering"], influence_bid: ["影响力竞价", "Influence bidding"], wildling_bid: ["荒境入侵", "Frontier attack"],
  bid_tiebreak: ["王座裁决平手", "Throne tie-break"],
  planning: ["秘密下令", "Secret planning"], raven: ["信鸦调整", "Raven adjustment"], raid: ["结算突袭", "Resolve raids"], march: ["结算行军", "Resolve marches"],
  combat_support: ["宣布支援", "Declare support"], combat_cards: ["选择领袖", "Choose leader"], combat_blade: ["钢剑裁决", "Steel blade"], combat_casualties: ["选择伤亡", "Choose casualties"], combat_retreat: ["败军撤退", "Retreat"],
  consolidate: ["结算集权", "Resolve consolidation"], finished: ["六境归一", "Realm united"],
};
const UNIT_LABELS: Record<Unit["type"], [string, string, string]> = {
  footman: ["步", "步兵", "Footman"], knight: ["骑", "骑兵", "Knight"], ship: ["舰", "舰船", "Ship"], siege: ["砲", "攻城器", "Siege engine"],
};
const EVENT_LABELS: Record<string, [string, string]> = {
  supply: ["调整补给", "Adjust Supply"], mustering: ["全国征召", "Mustering"], clash: ["诸王之争", "Clash of Kings"], power: ["权力游戏", "Game of Thrones"], quiet: ["不发生事件", "No event"],
  no_raid: ["本轮禁用突袭命令", "No Raid orders"], no_march_plus: ["本轮禁用 +1 行军", "No +1 March order"], no_power: ["本轮禁用集权命令", "No Consolidate orders"], no_support: ["本轮禁用支援命令", "No Support orders"], no_defend: ["本轮禁用防御命令", "No Defense orders"],
};

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as Session | null; } catch { return null; }
}

function playTone(kind: "click" | "battle" | "turn") {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = kind === "battle" ? "sawtooth" : "sine";
    oscillator.frequency.value = kind === "battle" ? 116 : kind === "turn" ? 440 : 260;
    gain.gain.setValueAtTime(.06, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + (kind === "battle" ? .38 : .12));
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + (kind === "battle" ? .4 : .14));
  } catch { /* sound is optional */ }
}

export function RealmsClient() {
  const [language, setLanguage] = useState<Language>("zh");
  const [session, setSession] = useState<Session | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [botCount, setBotCount] = useState(2);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const previousPhase = useRef("");
  const text = useCallback((zh: string, en: string) => language === "zh" ? zh : en, [language]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLanguage((localStorage.getItem(LANGUAGE_KEY) as Language) || "zh");
      const saved = readSession();
      if (saved) { setSession(saved); setCode(saved.code); }
      const room = new URLSearchParams(window.location.search).get("room");
      if (room) setCode(room.toUpperCase().slice(0, 4));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const applyResponse = useCallback((data: { game?: Game; session?: Session; error?: string }) => {
    if (data.session) { setSession(data.session); localStorage.setItem(SESSION_KEY, JSON.stringify(data.session)); }
    if (data.game) {
      setGame(data.game);
      if (previousPhase.current && previousPhase.current !== data.game.phase) playTone(data.game.phase.startsWith("combat") ? "battle" : "turn");
      previousPhase.current = data.game.phase;
    }
  }, []);

  const refresh = useCallback(async () => {
    const current = session ?? readSession();
    if (!current) return;
    const response = await fetch(`/api/realms?code=${current.code}&playerId=${current.playerId}`, { headers: { Authorization: `Bearer ${current.token}`, "x-player-id": current.playerId }, cache: "no-store" });
    const data = await response.json() as { game?: Game; error?: string };
    if (response.ok) applyResponse(data); else setError(data.error ?? text("同步失败。", "Sync failed."));
  }, [session, applyResponse, text]);

  useEffect(() => {
    if (!session) return;
    const initial = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, game?.phase === "planning" ? 1000 : 1500);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [session, refresh, game?.phase]);

  const act = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    const current = session ?? readSession();
    if (!current) return;
    setBusy(true); setError(""); playTone("click");
    try {
      const response = await fetch("/api/realms", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${current.token}`, "x-player-id": current.playerId }, body: JSON.stringify({ action, code: current.code, ...payload }) });
      const data = await response.json() as { game?: Game; error?: string };
      if (!response.ok) throw new Error(data.error ?? text("操作失败。", "Action failed."));
      applyResponse(data);
    } catch (caught) { setError(caught instanceof Error ? caught.message : text("操作失败。", "Action failed.")); }
    finally { setBusy(false); }
  }, [session, applyResponse, text]);

  const enter = async (action: "create" | "join" | "recover") => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/realms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, name, code, recoveryCode: recovery, botCount }) });
      const data = await response.json() as { game?: Game; session?: Session; error?: string };
      if (!response.ok) throw new Error(data.error ?? text("无法进入房间。", "Unable to enter room."));
      applyResponse(data);
    } catch (caught) { setError(caught instanceof Error ? caught.message : text("无法进入房间。", "Unable to enter room.")); }
    finally { setBusy(false); }
  };

  const changeLanguage = () => {
    const next = language === "zh" ? "en" : "zh";
    setLanguage(next); localStorage.setItem(LANGUAGE_KEY, next);
  };

  if (!game) return <main className="realms-landing">
    <nav className="realm-nav"><Link href="/">← {text("王冠之城", "Crown City")}</Link><button onClick={changeLanguage}>{language === "zh" ? "EN" : "中文"}</button><button onClick={() => setRulesOpen(true)}>{text("完整规则", "Full rules")}</button></nav>
    <section className="realm-hero"><div className="realm-kicker">THE SIX REALMS</div><div className="realm-sigil">✦</div><h1>{text("六境争霸", "The Six Realms")}</h1><p>{text("秘密下令，公开结盟，在十轮战争中夺取七座城堡。", "Issue secret orders, forge public alliances, and claim seven castles before the tenth round ends.")}</p><div className="realm-pill-row"><span>{text("3–6 人", "3–6 players")}</span><span>{text("完整命令系统", "Complete order system")}</span><span>{text("联网保存", "Persistent online rooms")}</span><span>{text("策略电脑", "Strategic AI")}</span></div></section>
    <section className="realm-entry"><h2>{text("召集战争议会", "Convene the war council")}</h2><label>{text("领主姓名", "Your name")}<input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} /></label><div className="realm-entry-grid"><label>{text("电脑势力", "AI factions")}<select value={botCount} onChange={(event) => setBotCount(Number(event.target.value))}>{[2,3,4,5].map((count) => <option key={count} value={count}>{count}</option>)}</select></label><p>{text("基础游戏完整规则 · 无需模型 API", "Complete base-game rules · no model API")}</p></div><button className="realm-primary" disabled={busy} onClick={() => enter("create")}>{text("创建新战局", "Create campaign")}</button><div className="realm-divider">{text("或加入朋友", "or join friends")}</div><div className="realm-join"><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,4))} placeholder="AB12" /><button disabled={busy || code.length !== 4} onClick={() => enter("join")}>{text("加入", "Join")}</button></div><details><summary>{text("使用恢复码返回座位", "Recover a seat")}</summary><input value={recovery} onChange={(event) => setRecovery(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,10))} placeholder="10 位恢复码" /><button onClick={() => enter("recover")} disabled={recovery.length !== 10}>{text("恢复", "Recover")}</button></details>{error && <p className="realm-error">{error}</p>}</section>
    {rulesOpen && <RulesModal language={language} onClose={() => setRulesOpen(false)} />}
  </main>;

  return <RealmTable game={game} session={session!} language={language} act={act} busy={busy} error={error} onRules={() => setRulesOpen(true)} onLanguage={changeLanguage} rulesOpen={rulesOpen} closeRules={() => setRulesOpen(false)} />;
}

function RealmTable({ game, session, language, act, busy, error, onRules, onLanguage, rulesOpen, closeRules }: { game: Game; session: Session; language: Language; act: (action: string, payload?: Record<string, unknown>) => void; busy: boolean; error: string; onRules: () => void; onLanguage: () => void; rulesOpen: boolean; closeRules: () => void }) {
  const text = (zh: string, en: string) => language === "zh" ? zh : en;
  const me = game.players.find((player) => player.id === game.viewerId)!;
  const ownAreas = ownUnitAreas(game, me.faction);
  const [selectedAreaId, setSelectedAreaId] = useState(ownAreas[0]?.key ?? "throne_city");
  const faction = game.factions.find((item) => item.key === me.faction);
  const current = game.players.find((player) => player.id === game.currentPlayerId);
  const host = game.players.find((player) => player.id === game.hostId);
  const selectableAreaIds = game.phase === "planning" ? ownAreas.map((area) => area.key) : [];
  return <main className="realm-table" style={{ "--my-faction": faction?.color ?? "#b69655" } as CSSProperties}>
    <header className="realm-header"><div><Link href="/realms" className="realm-brand">✦ {text("六境争霸", "The Six Realms")}</Link><span>{text(`房间 ${game.code}`, `Room ${game.code}`)}</span><span>{text(`第 ${game.round}/10 轮`, `Round ${game.round}/10`)}</span></div><div>{game.viewerId !== game.hostId && host && !host.isBot && !host.isOnline && <button onClick={() => act("claimHost")}>{text("接任房主", "Take host")}</button>}<button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/realms?room=${game.code}`)}>{text("复制邀请", "Copy invite")}</button>{session.recoveryCode && <button onClick={() => navigator.clipboard.writeText(session.recoveryCode!)}>{text(`恢复码 ${session.recoveryCode}`, `Recovery ${session.recoveryCode}`)}</button>}<button onClick={onLanguage}>{language === "zh" ? "EN" : "中文"}</button><button onClick={onRules}>{text("规则书", "Rules")}</button></div></header>
    <section className="realm-phase"><div><small>{text("当前阶段", "Current phase")}</small><strong>{(PHASE_LABELS[game.phase] ?? [game.phase, game.phase])[language === "zh" ? 0 : 1]}</strong></div><p>{current ? text(`等待 ${current.name} 决定`, `Waiting for ${current.name}`) : game.phase === "planning" ? text("所有势力同时秘密下令", "All factions assign orders simultaneously") : text("服务器正在结算", "Resolving on the server")}</p><div className="wildling-meter"><span>{text("荒境威胁", "Frontier threat")}</span><b>{game.wildlingThreat}/12</b></div></section>
    <PlayerRibbon game={game} language={language} act={act} />
    <div className="realm-main-grid"><section className="realm-map-wrap"><RealmMap game={game} language={language} selectedKey={selectedAreaId} onSelect={setSelectedAreaId} selectableAreaIds={selectableAreaIds} /></section><aside className="realm-command"><ActionPanel game={game} me={me} language={language} act={act} busy={busy} selectedAreaId={selectedAreaId} onSelectArea={setSelectedAreaId} /><InfluenceTracks game={game} language={language} />{error && <p className="realm-error">{error}</p>}<Chronicle game={game} language={language} /></aside></div>
    {rulesOpen && <RulesModal language={language} onClose={closeRules} />}
  </main>;
}

function PlayerRibbon({ game, language, act }: { game: Game; language: Language; act: (action: string, payload?: Record<string, unknown>) => void }) {
  const text = (zh: string, en: string) => language === "zh" ? zh : en;
  const isHost = game.viewerId === game.hostId;
  return <div className="realm-players">{game.players.map((player) => { const faction = game.factions.find((item) => item.key === player.faction); const active = game.currentPlayerId === player.id; return <article key={player.id} className={active ? "active" : ""} style={{ "--faction": faction?.color ?? "#777" } as CSSProperties}><i /><div><strong>{player.name}{player.isBot ? " · AI" : !player.isOnline ? text(" · 断线", " · offline") : ""}</strong><small>{faction ? (language === "zh" ? faction.name : faction.nameEn) : text("等待分配", "Unassigned")}</small></div><b>♜ {player.castles}/7</b><span>◆ {player.power} · ▰ {player.supply}</span>{game.phase === "planning" && <em>{player.submitted ? text("已封存", "Locked") : text("下令中", "Planning")}</em>}{isHost && game.phase !== "lobby" && game.phase !== "finished" && player.id !== game.viewerId && !player.isBot && !player.isOnline && <button className="realm-entrust" onClick={() => act("entrust", { targetPlayerId: player.id })}>{text("交给 AI", "Entrust to AI")}</button>}</article>; })}</div>;
}

const REGION_PATHS: Record<string, string> = {
  northhold: "38% 3%,55% 3%,64% 11%,57% 18%,42% 17%,34% 10%",
  frozen_pass: "20% 4%,38% 3%,34% 10%,38% 17%,29% 21%,18% 14%",
  high_peaks: "12% 13%,20% 4%,18% 14%,29% 21%,22% 29%,10% 25%",
  ice_coast: "29% 21%,38% 17%,43% 27%,35% 34%,22% 29%",
  wolfwood: "38% 17%,57% 18%,55% 28%,43% 27%",
  crown_road: "57% 18%,64% 11%,73% 20%,69% 30%,55% 28%",
  shadow_fort: "10% 25%,22% 29%,24% 40%,15% 48%,7% 40%",
  riverwatch: "22% 29%,35% 34%,43% 27%,49% 38%,39% 45%,24% 40%",
  west_hills: "15% 48%,24% 40%,39% 45%,35% 55%,19% 59%,10% 53%",
  moon_gate: "69% 30%,73% 20%,83% 25%,88% 34%,82% 38%,76% 39%,67% 40%",
  goldhaven: "10% 53%,19% 59%,18% 69%,10% 72%,4% 64%",
  central_plains: "39% 45%,49% 38%,55% 28%,67% 40%,64% 52%,51% 57%,35% 55%",
  throne_city: "64% 52%,67% 40%,76% 39%,74% 48%,75% 54%,73% 60%",
  sunfield: "19% 59%,35% 55%,51% 57%,45% 67%,28% 69%,18% 69%",
  highgarden: "28% 69%,45% 67%,52% 76%,43% 84%,27% 80%",
  red_desert: "18% 69%,28% 69%,27% 80%,20% 90%,9% 85%,10% 72%",
  lower_river: "45% 67%,51% 57%,64% 52%,73% 60%,66% 72%,52% 76%",
  stormlands: "73% 60%,75% 54%,82% 52%,88% 58%,86% 70%,75% 74%,66% 72%",
  east_hills: "82% 52%,81% 46%,82% 38%,88% 34%,94% 41%,93% 52%,88% 58%",
  ember_keep: "52% 76%,66% 72%,75% 74%,76% 86%,63% 93%,43% 84%",
  red_steppe: "75% 74%,86% 70%,94% 73%,94% 86%,80% 92%,76% 86%",
  tidewatch: "88% 34%,93% 27%,98% 32%,99% 44%,93% 52%,94% 41%",
  salt_marsh: "86% 70%,88% 58%,93% 52%,99% 57%,99% 72%,94% 73%",
  glass_isle: "3% 72%,11% 70%,17% 75%,15% 86%,7% 90%,2% 83%",
  frozen_sea: "0% 0%,100% 0%,100% 22%,83% 25%,73% 20%,64% 11%,55% 3%,38% 3%,20% 4%,12% 13%,0% 20%",
  western_sea: "0% 20%,12% 13%,10% 25%,7% 40%,10% 53%,4% 64%,0% 64%",
  golden_bay: "0% 55%,10% 53%,4% 64%,10% 72%,3% 72%,0% 74%",
  southern_sea: "0% 74%,3% 72%,2% 83%,7% 90%,20% 90%,27% 80%,43% 84%,63% 93%,66% 100%,0% 100%",
  ember_sea: "66% 100%,63% 93%,80% 92%,94% 86%,100% 87%,100% 100%",
  eastern_sea: "100% 22%,83% 25%,93% 27%,98% 32%,99% 44%,93% 52%,99% 57%,99% 72%,94% 73%,94% 86%,100% 87%",
  central_strait: "76% 39%,82% 38%,81% 46%,82% 52%,75% 54%,74% 48%",
};

const AREA_TERRAIN: Record<string, string> = {
  high_peaks: "mountain", frozen_pass: "mountain", east_hills: "mountain", ember_keep: "mountain",
  wolfwood: "forest", shadow_fort: "forest", riverwatch: "river", lower_river: "river",
  red_desert: "desert", red_steppe: "desert", salt_marsh: "marsh", sunfield: "field",
};

function RealmMap({ game, language, selectedKey, onSelect, selectableAreaIds }: { game: Game; language: Language; selectedKey: string; onSelect: (areaId: string) => void; selectableAreaIds: string[] }) {
  const factionMap = new Map(game.factions.map((faction) => [faction.key, faction]));
  const chooseArea = (areaId: string) => { if (!selectableAreaIds.length || selectableAreaIds.includes(areaId)) onSelect(areaId); };
  const selectedDefinition = game.areaDefinitions.find((area) => area.key === selectedKey) ?? game.areaDefinitions[0];
  const selectedState = selectedDefinition ? game.areas[selectedDefinition.key] : null;
  const selectedOwnerKey = selectedState?.units[0]?.faction ?? selectedState?.control;
  const selectedOwner = selectedOwnerKey ? factionMap.get(selectedOwnerKey) : null;
  const kindLabel = selectedDefinition?.kind === "sea" ? (language === "zh" ? "海域" : "Sea") : selectedDefinition?.kind === "port" ? (language === "zh" ? "港口" : "Port") : (language === "zh" ? "陆地" : "Land");

  const renderContents = (definition: AreaDefinition, inPort = false) => {
    const state = game.areas[definition.key];
    const units = state.units;
    const selectable = !selectableAreaIds.length || selectableAreaIds.includes(definition.key);
    return <span className="area-content" style={{ left: `${definition.x}%`, top: `${definition.y}%` }} role={inPort || !selectable ? undefined : "button"} tabIndex={inPort || !selectable ? undefined : 0} onClick={inPort || !selectable ? undefined : (event) => { event.stopPropagation(); chooseArea(definition.key); }} onKeyDown={inPort || !selectable ? undefined : (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseArea(definition.key); } }}>
      <strong>{language === "zh" ? definition.name : definition.nameEn}</strong>
      <span className="area-icons">{definition.castle && <i>♜{definition.castle}</i>}{definition.supply && <i>▰{definition.supply}</i>}{definition.power && <i>◆{definition.power}</i>}{state.neutral && <i className="neutral">⚔{state.neutral >= 99 ? "∞" : state.neutral}</i>}{state.garrison && <i className="garrison">▣{state.garrison}</i>}</span>
      {units.length > 0 && <span className="area-units">{units.map((unit) => <i key={unit.id} className={unit.routed ? "routed" : ""} style={{ background: factionMap.get(unit.faction)?.color }}>{UNIT_LABELS[unit.type][0]}</i>)}</span>}
      {state.order && <i className={`map-order ${state.order === "hidden" ? "hidden" : ""}`}>{state.order === "hidden" ? "?" : ORDER_LABELS[state.order as Order][language === "zh" ? 0 : 1]}</i>}
    </span>;
  };

  const regions = game.areaDefinitions.filter((definition) => definition.kind !== "port");
  const ports = game.areaDefinitions.filter((definition) => definition.kind === "port");
  return <div className="realm-map" aria-label={language === "zh" ? "六境战争版图" : "Map of the Six Realms"}>
    <div className="map-compass" aria-hidden="true">✦<small>N</small></div>
    <div className="map-legend"><b>{language === "zh" ? "点击区域名称选择" : "Select by clicking a name"}</b><span>♜ {language === "zh" ? "城堡" : "Castle"}</span><span>▰ {language === "zh" ? "补给" : "Supply"}</span><span>◆ {language === "zh" ? "威望" : "Power"}</span></div>
    <div className="map-relief" aria-hidden="true"><span className="ridge ridge-north">▲ ▲ ▲ ▲</span><span className="ridge ridge-east">▲ ▲ ▲</span><span className="forest-mark">♠ ♠ ♠</span><span className="river-mark river-one" /><span className="river-mark river-two" /></div>
    {regions.map((definition) => {
      const state = game.areas[definition.key];
      const owner = state.units[0]?.faction ?? state.control;
      const faction = owner ? factionMap.get(owner) : null;
      return <article key={definition.key} className={`realm-area ${definition.kind} terrain-${AREA_TERRAIN[definition.key] ?? "plain"} ${state.order ? "has-order" : ""} ${selectableAreaIds.includes(definition.key) ? "selectable" : ""} ${selectedKey === definition.key ? "selected" : ""}`} style={{ "--owner": faction?.color ?? (definition.kind === "sea" ? "#3d7380" : "#9a8d70") } as CSSProperties}>
        <button className="region-hit" style={{ clipPath: `polygon(${REGION_PATHS[definition.key]})` }} onClick={() => chooseArea(definition.key)} disabled={Boolean(selectableAreaIds.length && !selectableAreaIds.includes(definition.key))} aria-label={language === "zh" ? definition.name : definition.nameEn} title={language === "zh" ? definition.name : definition.nameEn} />
        {renderContents(definition)}
      </article>;
    })}
    {ports.map((definition) => {
      const state = game.areas[definition.key];
      const owner = state.units[0]?.faction ?? state.control;
      const faction = owner ? factionMap.get(owner) : null;
      return <button key={definition.key} className={`realm-port ${selectableAreaIds.includes(definition.key) ? "selectable" : ""} ${selectedKey === definition.key ? "selected" : ""}`} style={{ left: `${definition.x}%`, top: `${definition.y}%`, "--owner": faction?.color ?? "#806c4e" } as CSSProperties} onClick={() => chooseArea(definition.key)} disabled={Boolean(selectableAreaIds.length && !selectableAreaIds.includes(definition.key))}>{renderContents(definition, true)}</button>;
    })}
    {selectedDefinition && selectedState && <aside className="map-inspector" style={{ "--owner": selectedOwner?.color ?? "#9a8d70" } as CSSProperties}>
      <span>{kindLabel} · {selectedOwner ? (language === "zh" ? selectedOwner.name : selectedOwner.nameEn) : (language === "zh" ? "未控制" : "Uncontrolled")}</span>
      <strong>{language === "zh" ? selectedDefinition.name : selectedDefinition.nameEn}</strong>
      <small>{language === "zh" ? "相邻" : "Adjacent"}: {selectedDefinition.adjacent.map((id) => areaName(game, id, language)).join(" · ")}</small>
    </aside>}
  </div>;
}

function InfluenceTracks({ game, language }: { game: Game; language: Language }) {
  const names = language === "zh" ? { throne: "王座 · 行动顺序", fiefdom: "封臣 · 战斗平局/钢剑", court: "王庭 · 星级命令/信鸦" } : { throne: "Throne · turn order", fiefdom: "Fiefdom · ties/blade", court: "Court · stars/raven" };
  return <section className="influence-card"><h3>{language === "zh" ? "三条影响力轨道" : "Influence tracks"}</h3>{(["throne", "fiefdom", "court"] as const).map((track) => <div key={track}><strong>{names[track]}</strong><ol>{game.influence[track].map((factionKey, index) => { const faction = game.factions.find((item) => item.key === factionKey)!; return <li key={factionKey} style={{ "--faction": faction.color } as CSSProperties}><i />{index + 1}. {language === "zh" ? faction.name : faction.nameEn}</li>; })}</ol></div>)}</section>;
}

function ActionPanel({ game, me, language, act, busy, selectedAreaId, onSelectArea }: { game: Game; me: Player; language: Language; act: (action: string, payload?: Record<string, unknown>) => void; busy: boolean; selectedAreaId: string; onSelectArea: (areaId: string) => void }) {
  const text = (zh: string, en: string) => language === "zh" ? zh : en;
  if (game.phase === "lobby") return <LobbyPanel game={game} me={me} language={language} act={act} />;
  if (game.phase === "finished") { const winner = game.players.find((player) => player.id === game.winnerId); return <section className="action-card victory"><span>♛</span><h2>{text(`${winner?.name} 统一六境`, `${winner?.name} unites the realms`)}</h2><p>{text("依次比较城堡、补给、威望与王座顺位。", "Ties are resolved by castles, supply, power, then Throne position.")}</p></section>; }
  if (game.phase === "planning") return <PlanningPanel game={game} me={me} language={language} act={act} selectedAreaId={selectedAreaId} onSelectArea={onSelectArea} />;
  if (game.phase === "raven" && game.currentPlayerId === me.id) return <RavenPanel game={game} language={language} act={act} />;
  if (game.phase === "influence_bid" || game.phase === "wildling_bid") return <BidPanel game={game} me={me} language={language} act={act} />;
  if (game.phase === "bid_tiebreak" && game.currentPlayerId === me.id) return <TieBreakPanel game={game} language={language} act={act} />;
  if (game.phase === "event_choice" && game.currentPlayerId === me.id) return <section className="action-card"><h3>{text("权力标记持有者裁决事件", "The relevant dominance holder chooses")}</h3><div className="choice-grid">{game.eventChoice.map((event) => <button key={event} onClick={() => act("eventChoice", { event })}>{(EVENT_LABELS[event] ?? [event, event])[language === "zh" ? 0 : 1]}</button>)}</div></section>;
  if (game.phase === "supply" && game.currentPlayerId === me.id) return <SupplyPanel game={game} me={me} language={language} act={act} />;
  if (game.phase === "mustering" && game.currentPlayerId === me.id) return <MusterPanel game={game} me={me} language={language} act={act} global />;
  if (game.phase === "raid" && game.currentPlayerId === me.id) return <RaidPanel game={game} me={me} language={language} act={act} />;
  if (game.phase === "march" && game.currentPlayerId === me.id) return <MarchPanel game={game} me={me} language={language} act={act} />;
  if (game.phase === "consolidate" && game.currentPlayerId === me.id) return <ConsolidatePanel game={game} me={me} language={language} act={act} />;
  if (game.phase === "combat_support" && game.currentPlayerId === me.id) return <SupportPanel game={game} me={me} language={language} act={act} />;
  if (game.phase === "combat_cards" && game.currentPlayerId === me.id) return <LeaderPanel game={game} me={me} language={language} act={act} />;
  if (game.phase === "combat_blade" && game.currentPlayerId === me.id) return <section className="action-card"><h3>{text("是否发动钢剑？", "Use the steel blade?")}</h3><p>{text("本场战斗总战力 +1；每轮只能使用一次。", "+1 final combat strength; once per round.")}</p><div className="choice-grid"><button onClick={() => act("blade", { use: true })}>{text("发动 +1", "Use +1")}</button><button onClick={() => act("blade", { use: false })}>{text("保留", "Save it")}</button></div></section>;
  if (game.phase === "combat_casualties" && game.currentPlayerId === me.id) return <CasualtyPanel game={game} me={me} language={language} act={act} />;
  if (game.phase === "combat_retreat" && game.currentPlayerId === me.id) return <section className="action-card"><h3>{text("选择撤退区域", "Choose a retreat area")}</h3><div className="choice-grid">{game.pendingCombat?.retreatOptions.map((areaId) => <button key={areaId} onClick={() => act("retreat", { areaId })}>{areaName(game, areaId, language)}</button>)}</div></section>;
  return <section className="action-card waiting"><span>⌛</span><h3>{text("等待其他势力", "Waiting for another faction")}</h3><p>{text("牌桌会自动同步；你可以查看版图、影响力和战争记录。", "The table syncs automatically. You can inspect the map, tracks, and war chronicle.")}</p>{busy && <small>{text("正在结算…", "Resolving…")}</small>}</section>;
}

function LobbyPanel({ game, me, language, act }: { game: Game; me: Player; language: Language; act: (action: string, payload?: Record<string, unknown>) => void }) {
  const text = (zh: string, en: string) => language === "zh" ? zh : en;
  const share = async () => { const url = `${window.location.origin}/realms?room=${game.code}`; if (navigator.share) await navigator.share({ title: text("加入六境争霸", "Join The Six Realms"), text: text(`房间 ${game.code}`, `Room ${game.code}`), url }); else await navigator.clipboard.writeText(url); };
  return <section className="action-card lobby-card"><h2>{text("战争议会正在集结", "The war council gathers")}</h2><p>{text("完整规则需要 3–6 个势力。电脑玩家会按同一规则行动。", "The complete rules require 3–6 factions. AI follows the same rules.")}</p><button onClick={share}>{text("复制邀请链接", "Copy invite link")}</button>{me.id === game.hostId && <><button onClick={() => act("addBot")} disabled={game.players.length >= 6}>＋ {text("添加电脑势力", "Add AI faction")}</button><div className="lobby-remove">{game.players.filter((player) => player.id !== me.id).map((player) => <button key={player.id} onClick={() => act("removePlayer", { targetPlayerId: player.id })}>{text("移除", "Remove")} {player.name}</button>)}</div><button className="realm-primary" onClick={() => act("start")} disabled={game.players.length < 3}>{text("开始十轮战争", "Begin the ten-round war")}</button></>}</section>;
}

function ownUnitAreas(game: Game, faction: string | null) { return game.areaDefinitions.filter((area) => game.areas[area.key].units.some((unit) => unit.faction === faction)); }
function areaName(game: Game, id: string, language: Language) { const area = game.areaDefinitions.find((item) => item.key === id); return area ? language === "zh" ? area.name : area.nameEn : id; }
function factionName(game: Game, id: string, language: Language) { const faction = game.factions.find((item) => item.key === id); return faction ? language === "zh" ? faction.name : faction.nameEn : id; }

function PlanningPanel({ game, me, language, act, selectedAreaId, onSelectArea }: { game: Game; me: Player; language: Language; act: (action: string, payload?: Record<string, unknown>) => void; selectedAreaId: string; onSelectArea: (areaId: string) => void }) {
  const text = (zh: string, en: string) => language === "zh" ? zh : en;
  const areas = ownUnitAreas(game, me.faction);
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const selected = areas.some((area) => area.key === selectedAreaId) ? selectedAreaId : areas[0]?.key ?? "";
  const starLimit = (game.players.length <= 4 ? [3,2,1,0] : [3,3,2,1,0,0])[Math.max(0, game.influence.court.indexOf(me.faction ?? ""))] ?? 0;
  const forbidden = (order: Order) => game.forbiddenOrderFamily === "march_star" ? order === "march_star" : game.forbiddenOrderFamily && order.startsWith(game.forbiddenOrderFamily);
  const allowedOrders = (Object.keys(game.orderCounts) as Order[]).filter((order) => !forbidden(order));
  const capacity = allowedOrders.filter((order) => !order.endsWith("_star")).reduce((sum, order) => sum + game.orderCounts[order], 0)
    + Math.min(starLimit, allowedOrders.filter((order) => order.endsWith("_star")).reduce((sum, order) => sum + game.orderCounts[order], 0));
  const required = Math.min(areas.length, capacity);
  const usedCounts = Object.values(orders).reduce<Record<string, number>>((counts, order) => ({ ...counts, [order]: (counts[order] ?? 0) + 1 }), {});
  const progress = <div className="planning-progress"><header><div><i /> <strong>{text("所有势力正在同时规划", "All factions are planning simultaneously")}</strong></div><span>{game.players.filter((player) => player.submitted).length}/{game.players.length} {text("已封存", "locked")}</span></header><p>{text("此阶段没有轮到谁；每位玩家都能同时操作，最后一人封存后命令一起翻开。电脑势力会立即完成规划。", "There is no active player in this phase. Everyone acts at once; all orders reveal when the final faction locks. AI factions plan immediately.")}</p><div>{game.players.map((player) => { const faction = game.factions.find((item) => item.key === player.faction); return <span key={player.id} className={player.submitted ? "locked" : "planning"} style={{ "--faction": faction?.color ?? "#777" } as CSSProperties}><i />{player.name}<b>{player.submitted ? text("已封存", "Locked") : text("规划中", "Planning")}</b></span>; })}</div></div>;
  if (me.submitted) return <section className="action-card waiting planning-wait">{progress}<span>✓</span><h3>{text("你的命令已秘密封存", "Your orders are locked in secret")}</h3><p>{text("其他玩家只能看见你已经完成，无法看到命令内容。", "Others can only see that you are ready, never the orders themselves.")}</p></section>;
  return <section className="action-card planning-card">{progress}<h3>{text("同时秘密下令", "Simultaneous secret planning")}</h3><p>{text(`王庭允许 ${starLimit} 枚星级命令；本轮须放置 ${required} 枚。点击地图上的己方区域名称也能切换。`, `Court position allows ${starLimit} starred orders; place ${required} orders. You can switch areas by clicking their names on the map.`)}</p><div className="planning-selection"><small>{text("当前选择", "Selected area")}</small><strong>{areaName(game, selected, language)}</strong><span>{orders[selected] ? ORDER_LABELS[orders[selected]][language === "zh" ? 0 : 1] : text("尚未下令", "No order yet")}</span></div><div className="order-area-tabs">{areas.map((area) => <button key={area.key} className={selected === area.key ? "selected" : ""} onClick={() => onSelectArea(area.key)}>{areaName(game, area.key, language)}{orders[area.key] ? ` · ${ORDER_LABELS[orders[area.key]][language === "zh" ? 0 : 1]}` : ""}</button>)}</div><div className="order-grid">{(Object.keys(game.orderCounts) as Order[]).map((order) => { const disabled = Boolean(forbidden(order)) || (usedCounts[order] ?? 0) >= game.orderCounts[order] && orders[selected] !== order || order.endsWith("_star") && Object.values(orders).filter((item) => item.endsWith("_star")).length >= starLimit && orders[selected] !== order; return <button key={order} className={orders[selected] === order ? "selected" : ""} disabled={disabled} onClick={() => setOrders((current) => { const next = { ...current }; if (!next[selected] && Object.keys(next).length >= required) delete next[Object.keys(next)[0]]; next[selected] = order; return next; })}>{ORDER_LABELS[order][language === "zh" ? 0 : 1]} <small>{usedCounts[order] ?? 0}/{game.orderCounts[order]}</small></button>; })}</div><button className="realm-primary" disabled={Object.keys(orders).length !== required} onClick={() => act("submitOrders", { orders })}>{text("秘密封存并等待其他玩家", "Lock secretly and wait for everyone")}</button></section>;
}

function RavenPanel({ game, language, act }: { game: Game; language: Language; act: (action: string, payload?: Record<string, unknown>) => void }) {
  const text = (zh: string, en: string) => language === "zh" ? zh : en;
  const me = game.players.find((player) => player.id === game.viewerId)!;
  const areas = ownUnitAreas(game, me.faction);
  const [areaId, setAreaId] = useState(areas[0]?.key ?? "");
  const [order, setOrder] = useState<Order>("march");
  if (game.ravenPeeked) return <section className="action-card"><h3>{text("信鸦已带回荒境情报", "The Raven has returned with frontier intelligence")}</h3><p>{me.privateNotes.at(-1)}</p><div className="choice-grid"><button onClick={() => act("raven", { mode: "top" })}>{text("放回牌堆顶", "Return it to the top")}</button><button onClick={() => act("raven", { mode: "bottom" })}>{text("移到牌堆底", "Move it to the bottom")}</button></div></section>;
  return <section className="action-card"><h3>{text("信鸦：揭令后的唯一调整", "Raven: one adjustment after reveal")}</h3><button onClick={() => act("raven", { mode: "peek" })}>{text("偷看荒境牌堆顶", "Peek at frontier deck")}</button><div className="raven-replace"><select value={areaId} onChange={(event) => setAreaId(event.target.value)}>{areas.map((area) => <option key={area.key} value={area.key}>{areaName(game, area.key, language)}</option>)}</select><select value={order} onChange={(event) => setOrder(event.target.value as Order)}>{Object.keys(game.orderCounts).map((key) => <option key={key} value={key}>{ORDER_LABELS[key as Order][language === "zh" ? 0 : 1]}</option>)}</select><button onClick={() => act("raven", { mode: "replace", areaId, order })}>{text("替换命令", "Replace order")}</button></div><button onClick={() => act("raven", { mode: "skip" })}>{text("不调整，开始突袭", "Skip and begin raids")}</button></section>;
}

function BidPanel({ game, me, language, act }: { game: Game; me: Player; language: Language; act: (action: string, payload?: Record<string, unknown>) => void }) {
  const text = (zh: string, en: string) => language === "zh" ? zh : en;
  const [amount, setAmount] = useState(0);
  const submitted = game.bid?.bids[me.id] !== null;
  return <section className="action-card bid-card"><h3>{game.phase === "wildling_bid" ? text("秘密投入威望抵御荒境", "Secretly bid power against the frontier") : text(`秘密竞拍：${game.bid?.track}`, `Secret bid: ${game.bid?.track}`)}</h3><p>{text(`你有 ${me.power} 威望。所有投入都会支付。`, `You have ${me.power} power. Every bid is spent.`)}</p>{submitted ? <div className="locked-bid">✓ {text("出价已封存", "Bid locked")}</div> : <><input type="range" min={0} max={me.power} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /><strong>{amount}</strong><button className="realm-primary" onClick={() => act("bid", { amount })}>{text("秘密出价", "Submit secret bid")}</button></>}</section>;
}

function TieBreakPanel({ game, language, act }: { game: Game; language: Language; act: (action: string, payload?: Record<string, unknown>) => void }) {
  const text = (zh: string, en: string) => language === "zh" ? zh : en;
  return <section className="action-card bid-card"><h3>{text("王座持有者裁决竞价平手", "Throne holder breaks the bidding tie")}</h3><p>{text("从当前平手组中选择较高名次；若仍有其他平手，系统会继续询问。", "Choose the higher-ranked faction in this tied group. Further ties follow in turn.")}</p><div className="choice-grid">{game.tieBreak?.choices.map((faction) => <button key={faction} onClick={() => act("bidTie", { faction })}>{factionName(game, faction, language)}</button>)}</div></section>;
}

function RaidPanel({ game, me, language, act }: { game: Game; me: Player; language: Language; act: (action: string, payload?: Record<string, unknown>) => void }) {
  const text = (zh: string, en: string) => language === "zh" ? zh : en;
  const sources = game.areaDefinitions.filter((area) => game.areas[area.key].order?.startsWith("raid") && game.areas[area.key].units.some((unit) => unit.faction === me.faction));
  const [source, setSource] = useState(sources[0]?.key ?? "");
  const targets = game.areaDefinitions.filter((area) => game.areaDefinitions.find((item) => item.key === source)?.adjacent.includes(area.key) && game.areas[area.key].order && game.areas[area.key].control !== me.faction);
  return <section className="action-card"><h3>{text("结算一枚突袭命令", "Resolve one Raid order")}</h3><select value={source} onChange={(event) => setSource(event.target.value)}>{sources.map((area) => <option key={area.key} value={area.key}>{areaName(game, area.key, language)}</option>)}</select><div className="choice-grid">{targets.map((area) => <button key={area.key} onClick={() => act("raid", { sourceAreaId: source, targetAreaId: area.key })}>{text("取消", "Cancel")} {areaName(game, area.key, language)} · {String(game.areas[area.key].order)}</button>)}</div><button onClick={() => act("raid", { sourceAreaId: source })}>{text("放弃这次突袭", "Skip this raid")}</button></section>;
}

function MarchPanel({ game, me, language, act }: { game: Game; me: Player; language: Language; act: (action: string, payload?: Record<string, unknown>) => void }) {
  const text = (zh: string, en: string) => language === "zh" ? zh : en;
  const sources = game.areaDefinitions.filter((area) => String(game.areas[area.key].order).startsWith("march") && game.areas[area.key].units.some((unit) => unit.faction === me.faction));
  const [source, setSource] = useState(sources[0]?.key ?? "");
  const [target, setTarget] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [moves, setMoves] = useState<Array<{ to: string; unitIds: string[] }>>([]);
  const [leavePower, setLeavePower] = useState(false);
  const sourceDef = game.areaDefinitions.find((area) => area.key === source);
  const units = game.areas[source]?.units.filter((unit) => unit.faction === me.faction && !moves.some((move) => move.unitIds.includes(unit.id))) ?? [];
  const destinations = game.areaDefinitions.filter((area) => area.key !== source && (sourceDef?.adjacent.includes(area.key) || sourceDef?.kind === "land" && area.kind === "land"));
  const addMove = () => { if (!target || !chosen.length) return; setMoves((current) => [...current, { to: target, unitIds: chosen }]); setChosen([]); };
  const switchSource = (value: string) => { setSource(value); setMoves([]); setChosen([]); setTarget(""); };
  return <section className="action-card march-card"><h3>{text("拆分并执行一枚行军命令", "Split and resolve one March order")}</h3><select value={source} onChange={(event) => switchSource(event.target.value)}>{sources.map((area) => <option key={area.key} value={area.key}>{areaName(game, area.key, language)} · {game.areas[area.key].order}</option>)}</select><div className="unit-checks">{units.map((unit) => <label key={unit.id}><input type="checkbox" checked={chosen.includes(unit.id)} onChange={() => setChosen((current) => current.includes(unit.id) ? current.filter((id) => id !== unit.id) : [...current, unit.id])} />{UNIT_LABELS[unit.type][language === "zh" ? 1 : 2]}</label>)}</div><select value={target} onChange={(event) => setTarget(event.target.value)}><option value="">{text("选择目的地", "Choose destination")}</option>{destinations.map((area) => <option key={area.key} value={area.key}>{areaName(game, area.key, language)}</option>)}</select><button onClick={addMove} disabled={!chosen.length || !target}>{text("加入这支分队", "Add detachment")}</button>{moves.length > 0 && <ol className="move-list">{moves.map((move, index) => <li key={`${move.to}-${index}`}>{move.unitIds.length} → {areaName(game, move.to, language)} <button onClick={() => setMoves((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></li>)}</ol>}<label className="inline-check"><input type="checkbox" checked={leavePower} onChange={(event) => setLeavePower(event.target.checked)} />{text("若完全撤离，留下 1 威望控制标记", "Leave 1 power token if the area is vacated")}</label><button className="realm-primary" onClick={() => act("march", { sourceAreaId: source, moves, leavePower })}>{moves.length ? text("执行全部行军", "Execute all movements") : text("移除命令，不移动", "Remove order without moving")}</button></section>;
}

function ConsolidatePanel({ game, me, language, act }: { game: Game; me: Player; language: Language; act: (action: string, payload?: Record<string, unknown>) => void }) {
  const text = (zh: string, en: string) => language === "zh" ? zh : en;
  const sources = game.areaDefinitions.filter((area) => String(game.areas[area.key].order).startsWith("power") && game.areas[area.key].units.some((unit) => unit.faction === me.faction));
  const [areaId, setAreaId] = useState(sources[0]?.key ?? "");
  const source = sources.find((area) => area.key === areaId);
  return <section className="action-card"><h3>{text("结算一枚集权命令", "Resolve one Consolidate Power order")}</h3><select value={areaId} onChange={(event) => setAreaId(event.target.value)}>{sources.map((area) => <option key={area.key} value={area.key}>{areaName(game, area.key, language)} · {game.areas[area.key].order}</option>)}</select><button onClick={() => act("consolidate", { areaId, mode: "power" })}>{text("获取 1 + 区域王冠威望", "Gain 1 + printed power")}</button>{game.areas[areaId]?.order === "power_star" && source?.castle && <MusterEditor game={game} me={me} language={language} sourceOnly={areaId} onSubmit={(choices) => act("consolidate", { areaId, mode: "muster", musterChoices: choices })} />}</section>;
}

function MusterPanel({ game, me, language, act }: { game: Game; me: Player; language: Language; act: (action: string, payload?: Record<string, unknown>) => void; global?: boolean }) {
  const text = (zh: string, en: string) => language === "zh" ? zh : en;
  return <section className="action-card"><h3>{text("全国征召", "Realm-wide mustering")}</h3><p>{text("要塞提供 2 点，城堡提供 1 点；可以放弃未使用点数。", "Strongholds provide 2 points and castles 1; unused points may be forfeited.")}</p><MusterEditor game={game} me={me} language={language} onSubmit={(choices) => act("muster", { musterChoices: choices })} /></section>;
}

function MusterEditor({ game, me, language, sourceOnly, onSubmit }: { game: Game; me: Player; language: Language; sourceOnly?: string; onSubmit: (choices: MusterChoice[]) => void }) {
  const text = (zh: string, en: string) => language === "zh" ? zh : en;
  const castles = game.areaDefinitions.filter((area) => area.castle && (game.areas[area.key].units.some((unit) => unit.faction === me.faction) || game.areas[area.key].control === me.faction) && (!sourceOnly || area.key === sourceOnly));
  const [source, setSource] = useState(castles[0]?.key ?? "");
  const [choices, setChoices] = useState<MusterChoice[]>([]);
  const footman = game.areas[source]?.units.find((unit) => unit.faction === me.faction && unit.type === "footman" && !choices.some((choice) => choice.upgradeUnitId === unit.id));
  const definition = game.areaDefinitions.find((area) => area.key === source);
  const port = game.areaDefinitions.find((area) => area.portOf === source);
  const add = (choice: MusterChoice) => setChoices((current) => [...current, choice]);
  return <div className="muster-editor"><select value={source} onChange={(event) => setSource(event.target.value)}>{castles.map((area) => <option key={area.key} value={area.key}>{areaName(game, area.key, language)} · {area.castle} {text("点", "pts")}</option>)}</select><div className="choice-grid"><button onClick={() => add({ sourceAreaId: source, type: "footman" })}>{text("征召步兵 · 1", "Muster Footman · 1")}</button>{footman && <><button onClick={() => add({ sourceAreaId: source, type: "knight", upgradeUnitId: footman.id })}>{text("步兵升级骑兵 · 1", "Upgrade to Knight · 1")}</button><button onClick={() => add({ sourceAreaId: source, type: "siege", upgradeUnitId: footman.id })}>{text("步兵升级攻城器 · 1", "Upgrade to Siege · 1")}</button></>}{port && <button onClick={() => add({ sourceAreaId: source, type: "ship", targetAreaId: port.key })}>{text("港口征舰 · 1", "Muster Ship in port · 1")}</button>}{definition?.adjacent.filter((id) => game.areaDefinitions.find((area) => area.key === id)?.kind === "sea").map((sea) => <button key={sea} onClick={() => add({ sourceAreaId: source, type: "ship", targetAreaId: sea })}>{text("邻海征舰", "Muster Ship")} · {areaName(game, sea, language)}</button>)}</div>{choices.length > 0 && <ol className="move-list">{choices.map((choice, index) => <li key={index}>{areaName(game, choice.sourceAreaId, language)} · {UNIT_LABELS[choice.type][language === "zh" ? 1 : 2]} <button onClick={() => setChoices((current) => current.filter((_, item) => item !== index))}>×</button></li>)}</ol>}<button className="realm-primary" onClick={() => onSubmit(choices)}>{text("确认征召（可空过）", "Confirm mustering (may pass)")}</button></div>;
}

function SupportPanel({ game, me, language, act }: { game: Game; me: Player; language: Language; act: (action: string, payload?: Record<string, unknown>) => void }) {
  const combat = game.pendingCombat!;
  const areaId = combat.supportQueue.find((id) => combat.supportChoices[id] === null && game.areas[id].units.some((unit) => unit.faction === me.faction))!;
  return <section className="action-card battle-card"><h3>{language === "zh" ? `${areaName(game, areaId, language)} 支援哪一方？` : `Who does ${areaName(game, areaId, language)} support?`}</h3><p>{factionName(game, combat.attackerFaction, language)} → {areaName(game, combat.targetAreaId, language)} ← {factionName(game, combat.defenderFaction, language)}</p><div className="choice-grid"><button onClick={() => act("support", { areaId, side: "attacker" })}>{language === "zh" ? "支援进攻方" : "Support attacker"}</button><button onClick={() => act("support", { areaId, side: "defender" })}>{language === "zh" ? "支援防守方" : "Support defender"}</button><button onClick={() => act("support", { areaId, side: "none" })}>{language === "zh" ? "拒绝支援" : "Support neither"}</button></div></section>;
}

function LeaderPanel({ game, me, language, act }: { game: Game; me: Player; language: Language; act: (action: string, payload?: Record<string, unknown>) => void }) {
  const leaders = me.leaderHand.map((key) => game.leaders.find((leader) => leader.key === key)!).filter(Boolean);
  const currentChoice = me.faction ? game.pendingCombat?.leaderChoices[me.faction] : null;
  const reselecting = typeof currentChoice === "string" && game.leaders.find((leader) => leader.key === currentChoice)?.effect === "reselect_card";
  return <section className="action-card battle-card"><h3>{reselecting ? language === "zh" ? "支付 2 威望改选，或保留当前领袖" : "Pay 2 power to reselect, or keep this leader" : language === "zh" ? "秘密选择一张领袖牌" : "Secretly choose a leader"}</h3><div className="leader-grid">{leaders.map((leader) => <button key={leader.key} onClick={() => act("leader", { leaderKey: leader.key })}><b>{leader.strength}</b><strong>{language === "zh" ? leader.name : leader.nameEn}{reselecting && leader.key === currentChoice ? language === "zh" ? " · 保留" : " · Keep" : ""}</strong><span>⚔ {leader.swords} · ▣ {leader.forts}</span><small>{language === "zh" ? leader.text : leader.textEn}</small></button>)}</div></section>;
}

function CasualtyPanel({ game, me, language, act }: { game: Game; me: Player; language: Language; act: (action: string, payload?: Record<string, unknown>) => void }) {
  const combat = game.pendingCombat!;
  const units = me.faction === combat.attackerFaction ? combat.attackingUnits : game.areas[combat.targetAreaId].units.filter((unit) => unit.faction === me.faction);
  const forcedIds = units.filter((unit) => unit.type === "siege" || unit.routed).map((unit) => unit.id);
  const [chosen, setChosen] = useState<string[]>(forcedIds);
  const required = combat.casualtiesRequired;
  return <section className="action-card battle-card"><h3>{language === "zh" ? `选择 ${required} 个伤亡` : `Choose ${required} casualties`}</h3><div className="unit-checks">{units.map((unit) => { const forced = forcedIds.includes(unit.id); return <label key={unit.id} className={forced ? "forced" : ""}><input type="checkbox" checked={chosen.includes(unit.id)} disabled={forced} onChange={() => setChosen((current) => current.includes(unit.id) ? current.filter((id) => id !== unit.id) : [...current, unit.id])} />{UNIT_LABELS[unit.type][language === "zh" ? 1 : 2]}{forced ? language === "zh" ? " · 必须移除" : " · forced" : ""}</label>; })}</div><button className="realm-primary" disabled={chosen.length !== required} onClick={() => act("casualties", { unitIds: chosen })}>{language === "zh" ? "确认伤亡" : "Confirm casualties"}</button></section>;
}

function SupplyPanel({ game, me, language, act }: { game: Game; me: Player; language: Language; act: (action: string, payload?: Record<string, unknown>) => void }) {
  const units = Object.entries(game.areas).flatMap(([areaId, area]) => area.units.filter((unit) => unit.faction === me.faction).map((unit) => ({ ...unit, areaId })));
  const [chosen, setChosen] = useState<string[]>([]);
  return <section className="action-card"><h3>{language === "zh" ? "移除部队直到符合补给" : "Remove units until armies fit supply"}</h3><p>{language === "zh" ? "服务器会检查最终军团数量与每支军团规模。" : "The server validates the final number and size of every army."}</p><div className="unit-checks">{units.map((unit) => <label key={unit.id}><input type="checkbox" checked={chosen.includes(unit.id)} onChange={() => setChosen((current) => current.includes(unit.id) ? current.filter((id) => id !== unit.id) : [...current, unit.id])} />{areaName(game, unit.areaId, language)} · {UNIT_LABELS[unit.type][language === "zh" ? 1 : 2]}</label>)}</div><button className="realm-primary" onClick={() => act("supply", { unitIds: chosen })}>{language === "zh" ? "提交补给调整" : "Submit supply adjustment"}</button></section>;
}

function Chronicle({ game, language }: { game: Game; language: Language }) {
  return <section className="realm-log"><h3>{language === "zh" ? "战争纪事" : "War chronicle"}</h3><ol>{[...game.log].reverse().slice(0, 24).map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}</ol></section>;
}

function RulesModal({ language, onClose }: { language: Language; onClose: () => void }) {
  const zh = language === "zh";
  const sections = zh ? [
    ["目标与终局", "游戏进行至多十轮。任何势力一旦控制七个带城堡或要塞的陆地区域，立即获胜；否则第十轮后依次比较城堡数量、补给、可用威望与王座顺位。"],
    ["每轮结构", "第一轮跳过事件阶段。其余轮次依次揭示三张王国事件、推进荒境威胁并结算事件，然后进行同时秘密下令，最后依次结算突袭、行军和集权命令。"],
    ["补给与军团", "同一区域两支以上部队构成军团。补给轨道限制可拥有的军团数量和规模；征召、行军和撤退都不能制造超过补给的军团。补给只在补给事件或明确效果发生时重新计算。"],
    ["征召", "要塞提供 2 点，城堡提供 1 点。步兵与舰船各花 1 点，骑兵和攻城器各花 2 点；本地步兵可用 1 点升级。舰船只能进入相连港口或没有敌舰的邻海。港口最多三舰。"],
    ["秘密命令", "每个有部队的区域必须放一枚命令。每家拥有十五枚命令标记；王庭轨道决定本轮可使用的星级命令数。全部提交后同时揭晓。信鸦持有者可替换一枚自己的命令，或查看荒境牌堆顶并将它放回顶部或移到底部。"],
    ["突袭", "按王座顺序轮流结算一枚突袭。普通突袭可取消相邻的突袭、支援或集权；星级突袭还可取消防御。陆地不能突袭海域；港口与相连海域可以互相突袭。突袭突袭时两枚同时移除。"],
    ["行军与控制", "按王座顺序轮流结算一枚行军。部队可拆分前往多个合法区域，但每枚行军最多发起一场战斗。完全撤离陆地时可花 1 威望留下控制标记。连续友方舰船可运输陆军跨海；舰船自身不能使用运输。"],
    ["战斗与支援", "战力来自参战部队、行军修正、防御命令、驻军、相邻支援、领袖牌与钢剑。第三方可以公开支援任一方或拒绝支援，但不能支援敌人攻击自己的部队。攻城器仅在进攻带城堡或要塞的区域时提供 4 战力。平局由封臣轨道靠前者获胜。"],
    ["伤亡与撤退", "胜方领袖牌的剑图标减去败方城堡图标决定伤亡。败方选择被消灭部队；攻城器与已溃败部队无法再次撤退。幸存败军撤到一个合法相邻区域并横置为溃败，行动阶段结束时恢复。主城驻军一旦战败永久移除。"],
    ["领袖牌", "每家七张牌。双方秘密选择后同时公开并执行文字能力。已使用牌进入公开弃牌堆；当打出手中最后一张时，收回先前弃掉的六张，刚打出的牌仍留在弃牌堆。"],
    ["影响力与竞价", "王座轨道决定行动顺序并裁决竞价平手；封臣轨道裁决战斗平手，首位持有每轮一次的钢剑；王庭轨道决定星级命令数量，首位持有信鸦。诸王之争事件会依次秘密竞拍三条轨道，所有出价无论胜负都支付。"],
    ["荒境入侵", "三张事件上的荒境图标会推进威胁；到达 12 或揭示入侵事件时，各家秘密投入威望。总和达到威胁值则守军获胜且最高贡献者获奖；否则荒境获胜，最低出价者承受最严重惩罚。"],
    ["港口、中立与联盟", "港口归连接陆地的控制者，只容纳舰船；敌人夺取陆地后可用自己的可用舰船替换港内敌舰。中立势力必须由行军战力加合法支援达到其数值才能击败，不使用领袖牌或钢剑。谈判与承诺随时允许，但不具约束力；不能展示秘密命令、秘密出价或转让组件。"],
  ] : [
    ["Objective", "The game lasts at most ten rounds. A faction immediately wins on controlling seven Castle or Stronghold areas; otherwise ties after round ten are broken by castles, supply, available power, then Throne position."],
    ["Round structure", "Round one skips Realm Events. Later rounds reveal three events and advance the frontier threat, then all factions assign secret orders before resolving Raids, Marches, and Consolidate Power orders."],
    ["Supply and armies", "Two or more units in one area form an army. Supply limits the number and size of armies. Mustering, marching, and retreating may never exceed the current limit; supply is recalculated only when instructed."],
    ["Mustering", "Strongholds provide 2 points and Castles 1. Footmen and Ships cost 1; Knights and Siege Engines cost 2. A local Footman upgrades for 1. Ships enter the connected port or an enemy-free adjacent sea; ports hold three Ships."],
    ["Secret orders", "Every occupied area receives one order from a faction's set of fifteen. Court position limits starred orders. Orders reveal together; the Raven holder may replace one own order or inspect the frontier deck and keep its top card or move it to the bottom."],
    ["Raids", "In Throne order, resolve one Raid at a time. Normal Raids cancel adjacent Raid, Support, or Consolidate orders; starred Raids can also cancel Defense. Land cannot raid sea. Ports and their connected sea can raid one another."],
    ["March and control", "A March may split units among several legal destinations but initiate only one battle. Pay 1 power to retain control of a fully vacated land area. Chains of friendly Ships transport land units; Ships cannot transport themselves."],
    ["Combat and support", "Strength comes from units, March and Defense modifiers, garrisons, adjacent Support, leader cards, and the blade. Third parties openly support either side or neither, but cannot support an enemy against their own units. Siege Engines provide 4 only while attacking a Castle or Stronghold. Fiefdom position breaks ties."],
    ["Casualties and retreat", "Winner swords minus loser fortifications determine casualties. The loser chooses losses; Siege Engines and already-routed units cannot retreat again. Survivors retreat to one legal area and become routed until the Action phase ends. A defeated home garrison is permanently removed."],
    ["Leader cards", "Each faction has seven. Both sides choose secretly, reveal together, and resolve text. Used cards form an open discard pile. On playing the final card in hand, recover the previous six while the just-played card remains discarded."],
    ["Influence", "Throne controls order and bidding ties; Fiefdom breaks combat ties and grants the once-per-round blade; Court controls starred orders and grants the Raven. Influence events secretly auction the tracks in that order, and all bids are spent."],
    ["Frontier attack", "Event icons raise threat. At 12 or on an attack event, factions secretly bid power. Meeting the threat wins and rewards the highest bidder; failure applies the card's punishment, with the lowest bidder suffering most."],
    ["Ports, neutrals, alliances", "Ports belong to their connected land and hold only Ships. Conquering the land replaces enemy port Ships with available friendly Ships. Neutral forces require equal or greater March strength plus legal Support, without leader cards or the blade. Promises are allowed but never binding; secret components cannot be shown or traded."],
  ];
  return <div className="realm-modal" role="dialog" aria-modal="true"><article><header><div><span>✦</span><h2>{zh ? "《六境争霸》完整规则" : "The Six Realms · Complete Rules"}</h2></div><button onClick={onClose}>×</button></header><p className="rules-note">{zh ? "本游戏使用原创世界观与文字，按经典第二版基础游戏规则运行；牌名、地图与美术均为原创。" : "This game uses original names, map, and artwork while running on the classic second-edition base-game rules."}</p>{sections.map(([title, body], index) => <section key={title}><b>{String(index + 1).padStart(2,"0")}</b><div><h3>{title}</h3><p>{body}</p></div></section>)}</article></div>;
}
