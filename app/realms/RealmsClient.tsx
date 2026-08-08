"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";

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
  areas: Record<string, { units: Unit[]; control: string | null; controlToken: boolean; order: Order | "hidden" | null; neutral: number | null; garrison: number | null; blocked: boolean }>;
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
  combatEffect: { actorFaction: string; targetFaction: string; type: "remove_adjacent_order" | "move_influence_bottom" | "discard_enemy_card" | "remove_order" | "upgrade_unit"; options: string[]; optional: boolean } | null;
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
const LAST_RECOVERY_KEY = "six-realms-last-recovery-v1";
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
  combat_support: ["宣布支援", "Declare support"], combat_cards: ["选择领袖", "Choose leader"], combat_blade: ["钢剑裁决", "Steel blade"], combat_effect: ["结算领袖能力", "Resolve leader ability"], combat_casualties: ["选择伤亡", "Choose casualties"], combat_retreat: ["败军撤退", "Retreat"],
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

function readLastRecovery() {
  try { return JSON.parse(localStorage.getItem(LAST_RECOVERY_KEY) ?? "null") as Pick<Session, "code" | "recoveryCode"> | null; } catch { return null; }
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
      const invitedRoom = new URLSearchParams(window.location.search).get("room")?.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
      if (invitedRoom) {
        setCode(invitedRoom);
        if (saved?.code === invitedRoom) setSession(saved);
        else if (saved?.recoveryCode) localStorage.setItem(LAST_RECOVERY_KEY, JSON.stringify({ code: saved.code, recoveryCode: saved.recoveryCode }));
      } else if (saved) {
        setSession(saved); setCode(saved.code);
      } else {
        const remembered = readLastRecovery();
        if (remembered) { setCode(remembered.code); setRecovery(remembered.recoveryCode ?? ""); }
      }
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

  const exitToLobby = useCallback(() => {
    if (!session) return;
    const message = game?.phase === "finished"
      ? text("开始一场新战局？当前战局的恢复码会为你保留。", "Start a new campaign? This campaign's recovery code will be kept for you.")
      : text("退出当前战局并返回创建页面？你的席位仍会保留，可用恢复码回来。", "Leave this campaign and return to setup? Your seat will remain recoverable with its recovery code.");
    if (!window.confirm(message)) return;
    if (session.recoveryCode) {
      localStorage.setItem(LAST_RECOVERY_KEY, JSON.stringify({ code: session.code, recoveryCode: session.recoveryCode }));
      setRecovery(session.recoveryCode);
    }
    localStorage.removeItem(SESSION_KEY);
    setCode(session.code);
    setSession(null);
    setGame(null);
    setError("");
    previousPhase.current = "";
    window.history.replaceState({}, "", "/realms");
  }, [session, game?.phase, text]);

  if (!game) return <main className="realms-landing">
    <nav className="realm-nav"><Link href="/">← {text("双游戏大厅", "Game hall")}</Link><button onClick={changeLanguage}>{language === "zh" ? "EN" : "中文"}</button><button onClick={() => setRulesOpen(true)}>{text("完整规则", "Full rules")}</button></nav>
    <section className="realm-hero"><div className="realm-kicker">THE SIX REALMS</div><div className="realm-sigil">✦</div><h1>{text("六境争霸", "The Six Realms")}</h1><p>{text("秘密下令，公开结盟，在十轮战争中夺取七座城堡。", "Issue secret orders, forge public alliances, and claim seven castles before the tenth round ends.")}</p><div className="realm-pill-row"><span>{text("3–6 人", "3–6 players")}</span><span>{text("完整命令系统", "Complete order system")}</span><span>{text("联网保存", "Persistent online rooms")}</span><span>{text("策略电脑", "Strategic AI")}</span></div></section>
    <section className="realm-entry"><h2>{text("召集战争议会", "Convene the war council")}</h2><label>{text("领主姓名", "Your name")}<input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} /></label><div className="realm-entry-grid"><label>{text("电脑势力", "AI factions")}<select value={botCount} onChange={(event) => setBotCount(Number(event.target.value))}>{[2,3,4,5].map((count) => <option key={count} value={count}>{count}</option>)}</select></label><p>{text("基础游戏完整规则 · 无需模型 API", "Complete base-game rules · no model API")}</p></div><button className="realm-primary" disabled={busy} onClick={() => enter("create")}>{text("创建新战局", "Create campaign")}</button><div className="realm-divider">{text("或加入朋友", "or join friends")}</div><div className="realm-join"><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,4))} placeholder="AB12" /><button disabled={busy || code.length !== 4} onClick={() => enter("join")}>{text("加入", "Join")}</button></div><details><summary>{text("使用恢复码返回座位", "Recover a seat")}</summary><input value={recovery} onChange={(event) => setRecovery(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,10))} placeholder="10 位恢复码" /><button onClick={() => enter("recover")} disabled={recovery.length !== 10}>{text("恢复", "Recover")}</button></details>{error && <p className="realm-error">{error}</p>}</section>
    {rulesOpen && <RulesModal language={language} onClose={() => setRulesOpen(false)} />}
  </main>;

  return <RealmTable game={game} session={session!} language={language} act={act} busy={busy} error={error} onRules={() => setRulesOpen(true)} onLanguage={changeLanguage} onExit={exitToLobby} rulesOpen={rulesOpen} closeRules={() => setRulesOpen(false)} />;
}

function RealmTable({ game, session, language, act, busy, error, onRules, onLanguage, onExit, rulesOpen, closeRules }: { game: Game; session: Session; language: Language; act: (action: string, payload?: Record<string, unknown>) => void; busy: boolean; error: string; onRules: () => void; onLanguage: () => void; onExit: () => void; rulesOpen: boolean; closeRules: () => void }) {
  const text = (zh: string, en: string) => language === "zh" ? zh : en;
  const me = game.players.find((player) => player.id === game.viewerId)!;
  const ownAreas = ownUnitAreas(game, me.faction);
  const [selectedAreaId, setSelectedAreaId] = useState(ownAreas[0]?.key ?? "throne_city");
  const [inspectedAreaId, setInspectedAreaId] = useState(ownAreas[0]?.key ?? "throne_city");
  const faction = game.factions.find((item) => item.key === me.faction);
  const current = game.players.find((player) => player.id === game.currentPlayerId);
  const host = game.players.find((player) => player.id === game.hostId);
  const selectableAreaIds = game.phase === "planning" ? ownAreas.map((area) => area.key) : [];
  const selectActionArea = (areaId: string) => { setSelectedAreaId(areaId); setInspectedAreaId(areaId); };
  const inspectArea = (areaId: string) => {
    setInspectedAreaId(areaId);
    if (!selectableAreaIds.length || selectableAreaIds.includes(areaId)) setSelectedAreaId(areaId);
  };
  return <main className="realm-table" style={{ "--my-faction": faction?.color ?? "#b69655" } as CSSProperties}>
    <header className="realm-header"><div><Link href="/realms" className="realm-brand">✦ {text("六境争霸", "The Six Realms")}</Link><span>{text(`房间 ${game.code}`, `Room ${game.code}`)}</span><span>{text(`第 ${game.round}/10 轮`, `Round ${game.round}/10`)}</span></div><div>{game.viewerId !== game.hostId && host && !host.isBot && !host.isOnline && <button onClick={() => act("claimHost")}>{text("接任房主", "Take host")}</button>}<Link className="realm-hub-link" href="/">{text("游戏大厅", "Game hall")}</Link><button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/realms?room=${game.code}`)}>{text("复制邀请", "Copy invite")}</button>{session.recoveryCode && <button onClick={() => navigator.clipboard.writeText(session.recoveryCode!)}>{text(`恢复码 ${session.recoveryCode}`, `Recovery ${session.recoveryCode}`)}</button>}<button onClick={onLanguage}>{language === "zh" ? "EN" : "中文"}</button><button onClick={onRules}>{text("规则书", "Rules")}</button><button className="realm-exit" onClick={onExit}>{text(game.phase === "finished" ? "新建战局" : "退出战局", game.phase === "finished" ? "New campaign" : "Leave campaign")}</button></div></header>
    <div className="realm-main-grid">
      <section className="realm-board-column">
        <section className="realm-track-overview" aria-label={text("战局总览", "Campaign overview")}>
          <header><span className="track-summary-mark" aria-hidden="true">♜</span><span className="track-summary-copy"><strong>{text("战局总览", "Campaign overview")}</strong><small>{text(`第 ${game.round}/10 轮 · 荒境 ${game.wildlingThreat}/12 · 领先 ${Math.max(0, ...game.players.map((player) => player.castles))}/7 城堡`, `Round ${game.round}/10 · Frontier ${game.wildlingThreat}/12 · Leader ${Math.max(0, ...game.players.map((player) => player.castles))}/7 castles`)}</small></span><em>{text("固定显示", "Always visible")}</em></header>
          <BoardTracks game={game} language={language} />
        </section>
        <section className="realm-map-wrap"><RealmMap game={game} language={language} inspectedKey={inspectedAreaId} actionKey={selectedAreaId} onInspect={inspectArea} selectableAreaIds={selectableAreaIds} /></section>
      </section>
      <section className="realm-below-map">
        <div className="realm-status-stack"><section className="realm-phase"><div><small>{text("当前阶段", "Current phase")}</small><strong>{(PHASE_LABELS[game.phase] ?? [game.phase, game.phase])[language === "zh" ? 0 : 1]}</strong></div><p>{current ? text(`等待 ${current.name} 决定`, `Waiting for ${current.name}`) : game.phase === "planning" ? text("所有势力同时秘密下令", "All factions assign orders simultaneously") : text("服务器正在结算", "Resolving on the server")}</p><div className="wildling-meter"><span>{text("荒境威胁", "Frontier threat")}</span><b>{game.wildlingThreat}/12</b></div></section><PlayerRibbon game={game} language={language} act={act} /></div>
        <aside className="realm-command"><ActionPanel game={game} me={me} language={language} act={act} busy={busy} selectedAreaId={selectedAreaId} onSelectArea={selectActionArea} />{error && <p className="realm-error">{error}</p>}<Chronicle game={game} language={language} /></aside>
      </section>
    </div>
    {rulesOpen && <RulesModal language={language} onClose={closeRules} />}
  </main>;
}

function PlayerRibbon({ game, language, act }: { game: Game; language: Language; act: (action: string, payload?: Record<string, unknown>) => void }) {
  const text = (zh: string, en: string) => language === "zh" ? zh : en;
  const isHost = game.viewerId === game.hostId;
  return <div className="realm-players">{game.players.map((player) => { const faction = game.factions.find((item) => item.key === player.faction); const active = game.currentPlayerId === player.id; return <article key={player.id} className={active ? "active" : ""} style={{ "--faction": faction?.color ?? "#777" } as CSSProperties}><i /><div><strong>{player.name}{player.isBot ? " · AI" : !player.isOnline ? text(" · 断线", " · offline") : ""}</strong><small>{faction ? (language === "zh" ? faction.name : faction.nameEn) : text("等待分配", "Unassigned")}</small></div><b>♜ {player.castles}/7</b><span>◆ {player.power} · ▰ {player.supply}</span>{game.phase === "planning" && <em>{player.submitted ? text("已封存", "Locked") : text("下令中", "Planning")}</em>}{isHost && game.phase !== "lobby" && game.phase !== "finished" && player.id !== game.viewerId && !player.isBot && !player.isOnline && <button className="realm-entrust" onClick={() => act("entrust", { targetPlayerId: player.id })}>{text("交给 AI", "Entrust to AI")}</button>}</article>; })}</div>;
}

type MapPoint = [number, number];

function rotateMapPoint([x, y]: MapPoint): MapPoint {
  return [100 - y, x];
}

function clipCell(polygon: MapPoint[], seed: MapPoint, rival: MapPoint) {
  const a = 2 * (rival[0] - seed[0]);
  const b = 2 * (rival[1] - seed[1]);
  const c = rival[0] ** 2 + rival[1] ** 2 - seed[0] ** 2 - seed[1] ** 2;
  const inside = ([x, y]: MapPoint) => a * x + b * y <= c + .0001;
  const crossing = (from: MapPoint, to: MapPoint): MapPoint => {
    const denominator = a * (to[0] - from[0]) + b * (to[1] - from[1]);
    const t = denominator === 0 ? 0 : (c - a * from[0] - b * from[1]) / denominator;
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  };
  const result: MapPoint[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    if (inside(current)) result.push(current);
    if (inside(current) !== inside(next)) result.push(crossing(current, next));
  }
  return result;
}

function buildRegionPolygons(regions: AreaDefinition[]) {
  return Object.fromEntries(regions.map((region) => {
    let polygon: MapPoint[] = [[.5, .5], [80.5, .5], [80.5, 99.5], [.5, 99.5]];
    for (const rival of regions) if (rival.key !== region.key) polygon = clipCell(polygon, [region.x, region.y], [rival.x, rival.y]);
    return [region.key, polygon];
  })) as Record<string, MapPoint[]>;
}

const AREA_TERRAIN: Record<string, string> = {
  karpeak: "mountain", moon_mountains: "mountain", ironwood: "mountain", red_pass: "mountain",
  crownwood: "forest", greyfen: "marsh", riverwatch: "river", crown_lowlands: "river",
  ember_march: "desert", salt_shore: "desert", central_plains: "field", highgarden: "field",
};

function MapUnitPiece({ unit, color, language }: { unit: Unit; color?: string; language: Language }) {
  const label = UNIT_LABELS[unit.type][language === "zh" ? 1 : 2];
  return <span className={`map-unit-piece ${unit.type} ${unit.routed ? "routed" : ""}`} style={{ "--unit-color": color ?? "#667" } as CSSProperties} title={label} aria-label={label}><i className="unit-shape" aria-hidden="true" /></span>;
}

function RealmMap({ game, language, inspectedKey, actionKey, onInspect, selectableAreaIds }: { game: Game; language: Language; inspectedKey: string; actionKey: string; onInspect: (areaId: string) => void; selectableAreaIds: string[] }) {
  const factionMap = new Map(game.factions.map((faction) => [faction.key, faction]));
  const viewportRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ pointerId: -1, x: 0, y: 0, left: 0, top: 0, moved: false });
  const suppressClick = useRef(false);
  const initialFocusDone = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [fitSize, setFitSize] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const selectedDefinition = game.areaDefinitions.find((area) => area.key === inspectedKey) ?? game.areaDefinitions[0];
  const selectedState = selectedDefinition ? game.areas[selectedDefinition.key] : null;
  const selectedOwnerKey = selectedState?.units[0]?.faction ?? selectedState?.control;
  const selectedOwner = selectedOwnerKey ? factionMap.get(selectedOwnerKey) : null;
  const kindLabel = selectedDefinition?.kind === "sea" ? (language === "zh" ? "海域" : "Sea") : selectedDefinition?.kind === "port" ? (language === "zh" ? "港口" : "Port") : (language === "zh" ? "陆地" : "Land");
  const regions = useMemo(() => game.areaDefinitions.filter((definition) => definition.kind !== "port"), [game.areaDefinitions]);
  const ports = useMemo(() => game.areaDefinitions.filter((definition) => definition.kind === "port"), [game.areaDefinitions]);
  const regionPolygons = useMemo(() => Object.fromEntries(Object.entries(buildRegionPolygons(regions)).map(([key, points]) => [key, points.map(rotateMapPoint)])) as Record<string, MapPoint[]>, [regions]);
  const navigableAreas = useMemo(() => game.areaDefinitions.filter((definition) => !game.areas[definition.key].blocked), [game.areaDefinitions, game.areas]);
  const actionRestricted = selectableAreaIds.length > 0;
  const selectedIsActionable = !actionRestricted || selectableAreaIds.includes(selectedDefinition?.key ?? "");

  const focusArea = useCallback((areaId: string, behavior: ScrollBehavior = "smooth") => {
    const definition = game.areaDefinitions.find((area) => area.key === areaId);
    const viewport = viewportRef.current;
    const map = mapRef.current;
    if (!definition || !viewport || !map) return;
    const [displayX, displayY] = rotateMapPoint([definition.x, definition.y]);
    viewport.scrollTo({
      left: map.offsetLeft + map.offsetWidth * displayX / 100 - viewport.clientWidth / 2,
      top: map.offsetTop + map.offsetHeight * displayY / 100 - viewport.clientHeight / 2,
      behavior,
    });
  }, [game.areaDefinitions]);

  const chooseArea = (areaId: string, focus = false) => {
    if (suppressClick.current) return;
    onInspect(areaId);
    if (focus) requestAnimationFrame(() => focusArea(areaId));
  };

  const changeZoom = (nextValue: number) => {
    const viewport = viewportRef.current;
    const oldWidth = viewport?.scrollWidth ?? 1;
    const oldHeight = viewport?.scrollHeight ?? 1;
    const centerX = viewport ? (viewport.scrollLeft + viewport.clientWidth / 2) / oldWidth : .5;
    const centerY = viewport ? (viewport.scrollTop + viewport.clientHeight / 2) / oldHeight : .5;
    const next = Math.max(1, Math.min(2.4, Math.round(nextValue * 10) / 10));
    setZoom(next);
    requestAnimationFrame(() => {
      if (!viewport) return;
      viewport.scrollTo({ left: centerX * viewport.scrollWidth - viewport.clientWidth / 2, top: centerY * viewport.scrollHeight - viewport.clientHeight / 2 });
    });
  };

  const showWholeMap = () => {
    setZoom(1);
    requestAnimationFrame(() => viewportRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" }));
  };

  const beginPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const panMap = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const viewport = viewportRef.current;
    if (!viewport || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    setDragging(true);
    viewport.scrollLeft = drag.left - dx;
    viewport.scrollTop = drag.top - dy;
    event.preventDefault();
  };

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    if (dragRef.current.moved) {
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 0);
    }
    dragRef.current.pointerId = -1;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const wheelZoom = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    changeZoom(zoom + (event.deltaY < 0 ? .1 : -.1));
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => {
      const usableWidth = Math.max(1, viewport.clientWidth - 16);
      const usableHeight = Math.max(1, viewport.clientHeight - 16);
      const width = Math.min(usableWidth, usableHeight * 3 / 2);
      setFitSize({ width, height: width * 2 / 3 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (initialFocusDone.current || !inspectedKey) return;
    initialFocusDone.current = true;
    const frame = requestAnimationFrame(() => focusArea(inspectedKey, "auto"));
    return () => cancelAnimationFrame(frame);
  }, [focusArea, inspectedKey]);

  useEffect(() => {
    if (!expanded) return;
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [expanded]);

  const renderContents = (definition: AreaDefinition, inPort = false) => {
    const state = game.areas[definition.key];
    const units = state.units;
    const [displayX, displayY] = rotateMapPoint([definition.x, definition.y]);
    return <span className="area-content" style={{ left: `${displayX}%`, top: `${displayY}%` }} role={inPort ? undefined : "button"} tabIndex={inPort ? undefined : 0} onClick={inPort ? undefined : (event) => { event.stopPropagation(); chooseArea(definition.key); }} onKeyDown={inPort ? undefined : (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseArea(definition.key); } }}>
      <strong>{language === "zh" ? definition.name : definition.nameEn}</strong>
      <span className="area-icons">{definition.castle && <i>♜{definition.castle}</i>}{definition.supply && <i>▰{definition.supply}</i>}{definition.power && <i>◆{definition.power}</i>}{state.blocked && <i className="blocked">⊘</i>}{state.neutral && !state.blocked && <i className="neutral">⚔{state.neutral}</i>}{state.garrison && !state.neutral && <i className="garrison">▣{state.garrison}</i>}</span>
      {units.length > 0 && <span className="area-units">{units.map((unit) => <MapUnitPiece key={unit.id} unit={unit} color={factionMap.get(unit.faction)?.color} language={language} />)}</span>}
      {state.order && <i className={`map-order ${state.order === "hidden" ? "hidden" : ""}`}>{state.order === "hidden" ? "?" : ORDER_LABELS[state.order as Order][language === "zh" ? 0 : 1]}</i>}
    </span>;
  };

  return <div className={`realm-map-shell ${expanded ? "expanded" : ""} ${showAllLabels ? "show-all-labels" : "compact-labels"}`}>
    <header className="map-toolbar">
      <div className="map-toolbar-copy"><strong>{language === "zh" ? "战争地图" : "War map"}</strong><span>{language === "zh" ? "默认显示全图 · 放大后拖动 · ⌘/Ctrl + 滚轮缩放" : "Full map by default · drag after zooming · ⌘/Ctrl + wheel to zoom"}</span></div>
      <label className="map-area-picker"><span>{language === "zh" ? "快速定位" : "Find area"}</span><select value={selectedDefinition?.key ?? ""} onChange={(event) => chooseArea(event.target.value, true)}>{navigableAreas.map((area) => <option key={area.key} value={area.key}>{language === "zh" ? area.name : area.nameEn}</option>)}</select></label>
      <div className="map-tools" aria-label={language === "zh" ? "地图工具" : "Map tools"}>
        <button className={zoom === 1 ? "active" : ""} onClick={showWholeMap}>{language === "zh" ? "全图" : "Fit"}</button>
        <button onClick={() => changeZoom(zoom - .1)} disabled={zoom <= 1} aria-label={language === "zh" ? "缩小地图" : "Zoom out"}>−</button><output>{Math.round(zoom * 100)}%</output><button onClick={() => changeZoom(zoom + .1)} disabled={zoom >= 2.4} aria-label={language === "zh" ? "放大地图" : "Zoom in"}>＋</button>
        <button onClick={() => focusArea(selectedDefinition.key)}>{language === "zh" ? "定位" : "Focus"}</button>
        <button className={showAllLabels ? "active" : ""} onClick={() => setShowAllLabels((value) => !value)}>{showAllLabels ? (language === "zh" ? "精简地名" : "Fewer labels") : (language === "zh" ? "全部地名" : "All labels")}</button>
        <button onClick={() => { setExpanded((value) => !value); requestAnimationFrame(() => focusArea(selectedDefinition.key, "auto")); }}>{expanded ? (language === "zh" ? "退出全屏" : "Exit full map") : (language === "zh" ? "全屏地图" : "Full map")}</button>
      </div>
    </header>
    <div ref={viewportRef} className={`realm-map-viewport ${dragging ? "dragging" : ""}`} onPointerDown={beginPan} onPointerMove={panMap} onPointerUp={endPan} onPointerCancel={endPan} onWheel={wheelZoom}>
      <div ref={mapRef} className="realm-map" style={fitSize.width ? { width: `${fitSize.width * zoom}px`, height: `${fitSize.height * zoom}px` } : undefined} aria-label={language === "zh" ? "六境战争版图" : "Map of the Six Realms"}>
        <div className="realm-map-art" aria-hidden="true" />
        <div className="map-compass" aria-hidden="true">✦<small>N</small></div>
        <svg className="realm-region-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{regions.map((definition) => {
      const state = game.areas[definition.key];
      const owner = state.units[0]?.faction ?? state.control;
      const faction = owner ? factionMap.get(owner) : null;
      return <polygon key={definition.key} className={`${definition.kind} ${state.blocked ? "blocked" : ""} ${selectableAreaIds.includes(definition.key) ? "actionable" : ""} ${actionKey === definition.key ? "action-selected" : ""} ${inspectedKey === definition.key ? "inspected" : ""}`} points={regionPolygons[definition.key].map((point) => point.join(",")).join(" ")} style={{ "--region-owner": faction?.color ?? (definition.kind === "sea" ? "#4e8190" : "#b7a67d") } as CSSProperties} />;
        })}</svg>
        {regions.map((definition) => {
      const state = game.areas[definition.key];
      const owner = state.units[0]?.faction ?? state.control;
      const faction = owner ? factionMap.get(owner) : null;
      const path = regionPolygons[definition.key].map(([x, y]) => `${x}% ${y}%`).join(",");
      const notable = Boolean(state.units.length || state.order || definition.castle || definition.supply || definition.power || state.neutral || state.garrison);
      return <article key={definition.key} className={`realm-area ${definition.kind} terrain-${AREA_TERRAIN[definition.key] ?? "plain"} ${state.blocked ? "blocked" : ""} ${state.order ? "has-order" : ""} ${notable ? "notable" : "quiet"} ${selectableAreaIds.includes(definition.key) ? "selectable" : ""} ${actionKey === definition.key ? "action-selected" : ""} ${inspectedKey === definition.key ? "inspected" : ""}`} style={{ "--owner": faction?.color ?? (definition.kind === "sea" ? "#3d7380" : "#9a8d70") } as CSSProperties}>
        <button className="region-hit" style={{ clipPath: `polygon(${path})` }} onClick={() => chooseArea(definition.key)} aria-label={language === "zh" ? `查看${definition.name}` : `Inspect ${definition.nameEn}`} title={language === "zh" ? definition.name : definition.nameEn} />
        {renderContents(definition)}
      </article>;
        })}
        {ports.map((definition) => {
      const state = game.areas[definition.key];
      const owner = state.units[0]?.faction ?? state.control;
      const faction = owner ? factionMap.get(owner) : null;
      const [displayX, displayY] = rotateMapPoint([definition.x, definition.y]);
      return <button key={definition.key} className={`realm-port ${state.blocked ? "blocked" : ""} ${selectableAreaIds.includes(definition.key) ? "selectable" : ""} ${actionKey === definition.key ? "action-selected" : ""} ${inspectedKey === definition.key ? "inspected" : ""}`} style={{ left: `${displayX}%`, top: `${displayY}%`, "--owner": faction?.color ?? "#806c4e" } as CSSProperties} onClick={() => chooseArea(definition.key)}>{renderContents(definition, true)}</button>;
        })}
      </div>
    </div>
    {selectedDefinition && selectedState && <section className="map-selection-dock" style={{ "--owner": selectedOwner?.color ?? "#9a8d70" } as CSSProperties}>
      <div className="map-selection-title"><span>{kindLabel} · {selectedOwner ? (language === "zh" ? selectedOwner.name : selectedOwner.nameEn) : (language === "zh" ? "未控制" : "Uncontrolled")}</span><strong>{language === "zh" ? selectedDefinition.name : selectedDefinition.nameEn}</strong></div>
      <div className="map-selection-status">{selectedState.units.length > 0 && <div className="map-inspector-units">{selectedState.units.map((unit) => <MapUnitPiece key={unit.id} unit={unit} color={factionMap.get(unit.faction)?.color} language={language} />)}</div>}<div className="map-resource-chips">{selectedDefinition.castle && <i>♜ {selectedDefinition.castle}</i>}{selectedDefinition.supply && <i>▰ {selectedDefinition.supply}</i>}{selectedDefinition.power && <i>◆ {selectedDefinition.power}</i>}{selectedState.neutral && <i>⚔ {selectedState.neutral}</i>}{selectedState.garrison && <i>▣ {selectedState.garrison}</i>}{selectedState.order && <i>{selectedState.order === "hidden" ? "?" : ORDER_LABELS[selectedState.order as Order][language === "zh" ? 0 : 1]}</i>}</div></div>
      <div className="map-adjacent"><small>{language === "zh" ? "相邻区域" : "Adjacent areas"}</small><div>{selectedDefinition.adjacent.map((id) => <button key={id} onClick={() => chooseArea(id, true)}>{areaName(game, id, language)}</button>)}</div></div>
      <div className={`map-action-state ${selectedIsActionable ? "ready" : "inspect-only"}`}>{selectedIsActionable ? (actionRestricted ? (language === "zh" ? "✓ 已设为当前下令区域" : "✓ Current order area") : (language === "zh" ? "可操作区域" : "Action available")) : (language === "zh" ? "仅查看 · 当前阶段不能在此行动" : "Inspect only · unavailable this phase")}</div>
    </section>}
  </div>;
}

function BoardTracks({ game, language }: { game: Game; language: Language }) {
  const names = language === "zh" ? { throne: "王座 · 行动顺序", fiefdom: "封臣 · 战斗平局/钢剑", court: "王庭 · 星级命令/信鸦" } : { throne: "Throne · turn order", fiefdom: "Fiefdom · ties/blade", court: "Court · stars/raven" };
  const maxCastles = Math.max(0, ...game.players.map((player) => player.castles));
  return <aside className="board-tracks"><section><h3>{language === "zh" ? "回合" : "Round"}</h3><ol className="number-track round-track">{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <li key={value} className={value === game.round ? "active" : ""}>{value}</li>)}</ol></section><section><h3>{language === "zh" ? "荒境威胁" : "Frontier threat"}</h3><ol className="number-track">{[0,2,4,6,8,10,12].map((value) => <li key={value} className={value === game.wildlingThreat ? "active danger" : ""}>{value}</li>)}</ol></section><section><h3>{language === "zh" ? "胜利城堡" : "Victory castles"}</h3><ol className="number-track">{[0,1,2,3,4,5,6,7].map((value) => <li key={value} className={value === maxCastles ? "active" : ""}>{value}</li>)}</ol></section>{(["throne", "fiefdom", "court"] as const).map((track) => <section className="board-influence" key={track}><h3>{names[track]}</h3><ol>{game.influence[track].map((factionKey, index) => { const faction = game.factions.find((item) => item.key === factionKey)!; return <li key={factionKey} style={{ "--faction": faction.color } as CSSProperties} title={language === "zh" ? faction.name : faction.nameEn}><i />{index + 1}</li>; })}</ol></section>)}</aside>;
}

function ActionPanel({ game, me, language, act, busy, selectedAreaId, onSelectArea }: { game: Game; me: Player; language: Language; act: (action: string, payload?: Record<string, unknown>) => void; busy: boolean; selectedAreaId: string; onSelectArea: (areaId: string) => void }) {
  const text = (zh: string, en: string) => language === "zh" ? zh : en;
  if (game.phase === "lobby") return <LobbyPanel game={game} me={me} language={language} act={act} />;
  if (game.phase === "finished") { const winner = game.players.find((player) => player.id === game.winnerId); return <section className="action-card victory"><span>♛</span><h2>{text(`${winner?.name} 统一六境`, `${winner?.name} unites the realms`)}</h2><p>{text("依次比较城堡、控制陆地区域、补给与王座顺位。", "Ties are resolved by castles, controlled land areas, supply, then Throne position.")}</p></section>; }
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
  if (game.phase === "combat_effect" && game.currentPlayerId === me.id) return <CombatEffectPanel game={game} language={language} act={act} />;
  if (game.phase === "combat_casualties" && game.currentPlayerId === me.id) return <CasualtyPanel game={game} me={me} language={language} act={act} />;
  if (game.phase === "combat_retreat" && game.currentPlayerId === me.id) return <section className="action-card"><h3>{text("选择撤退区域", "Choose a retreat area")}</h3><div className="choice-grid">{game.pendingCombat?.retreatOptions.map((areaId) => <button key={areaId} onClick={() => act("retreat", { areaId })}>{areaName(game, areaId, language)}</button>)}</div></section>;
  return <section className="action-card waiting"><span>⌛</span><h3>{text("等待其他势力", "Waiting for another faction")}</h3><p>{text("牌桌会自动同步；你可以查看版图、影响力和战争记录。", "The table syncs automatically. You can inspect the map, tracks, and war chronicle.")}</p>{busy && <small>{text("正在结算…", "Resolving…")}</small>}</section>;
}

function CombatEffectPanel({ game, language, act }: { game: Game; language: Language; act: (action: string, payload?: Record<string, unknown>) => void }) {
  const effect = game.combatEffect!;
  const text = (zh: string, en: string) => language === "zh" ? zh : en;
  const titles = {
    remove_adjacent_order: text("选择要移除的相邻敌方命令", "Choose an adjacent enemy order to remove"),
    move_influence_bottom: text("选择一条影响力轨道", "Choose an influence track"),
    discard_enemy_card: text("查看并弃掉一张敌方领袖牌", "Inspect and discard an enemy leader card"),
    remove_order: text("选择一枚尚未结算的敌方命令", "Choose an unresolved enemy order"),
    upgrade_unit: text("选择一名参战或本家支援步兵升级", "Choose a participating or friendly supporting Footman to upgrade"),
  };
  const optionLabel = (option: string) => {
    if (effect.type === "move_influence_bottom") return ({ throne: text("王座轨道", "Throne track"), fiefdom: text("封臣轨道", "Fiefdom track"), court: text("王庭轨道", "Court track") } as Record<string, string>)[option] ?? option;
    if (effect.type === "discard_enemy_card") { const leader = game.leaders.find((candidate) => candidate.key === option); return leader ? `${language === "zh" ? leader.name : leader.nameEn} · ${leader.strength}` : option; }
    if (effect.type === "upgrade_unit") { const entry = Object.entries(game.areas).find(([, area]) => area.units.some((unit) => unit.id === option)); return entry ? `${areaName(game, entry[0], language)} · ${text("步兵", "Footman")}` : option; }
    return areaName(game, option, language);
  };
  return <section className="action-card battle-card"><h3>{titles[effect.type]}</h3><p>{text("这是领袖牌的正式结算窗口；服务器会验证目标，其他玩家看不到你的秘密选项。", "This is the leader card's formal resolution window. The server validates the target; private choices remain hidden from other players.")}</p><div className="choice-grid">{effect.options.map((option) => <button key={option} onClick={() => act("combatEffect", { option })}>{optionLabel(option)}</button>)}{effect.optional && <button onClick={() => act("combatEffect")}>{text("不发动能力", "Skip ability")}</button>}</div></section>;
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
    ["目标与终局", "游戏进行至多十轮。任何势力一旦控制七个带城堡或要塞的陆地区域，立即获胜；否则第十轮后依次比较城堡数量、控制的陆地区域总数、补给等级与王座顺位。"],
    ["人数与开局", "仅支持官方基础游戏的 3–6 人配置。三人使用曜金、玄羽、北辰；四人加入苍潮；五人加入绿冠；六人加入赤岭。不同人数使用对应封锁区、中立军、初始部队和影响力顺位；玄羽在三人局依 FAQ 修订移除港内舰船。"],
    ["每轮结构", "第一轮跳过事件阶段。其余轮次依次揭示三张王国事件、推进荒境威胁并结算事件，然后进行同时秘密下令，最后依次结算突袭、行军和集权命令。"],
    ["补给与军团", "同一区域两支以上部队构成军团。补给轨道限制可拥有的军团数量和规模；征召、行军和撤退都不能制造超过补给的军团。补给只在补给事件或明确效果发生时重新计算。"],
    ["征召", "要塞提供 2 点，城堡提供 1 点。步兵与舰船各花 1 点，骑兵和攻城器各花 2 点；本地步兵可用 1 点升级。舰船只能进入相连港口或没有敌舰的邻海。港口最多三舰。"],
    ["秘密命令", "每个有部队的区域必须放一枚命令。每家拥有十五枚命令标记；王庭轨道决定本轮可使用的星级命令数。全部提交后同时揭晓。信鸦持有者可替换一枚自己的命令，或查看荒境牌堆顶并将它放回顶部或移到底部。"],
    ["突袭", "按王座顺序轮流结算一枚突袭。普通突袭可取消相邻的突袭、支援或集权；星级突袭还可取消防御。陆地不能突袭海域；海域可突袭陆地或海域，港口只能突袭相连海域。取消集权时，突袭方获得 1 威望，目标方若有则失去 1 威望。"],
    ["行军与控制", "按王座顺序轮流结算一枚行军。部队可拆分前往多个合法区域，但每枚行军最多发起一场战斗。完全撤离陆地时可花 1 威望留下控制标记。连续友方舰船可运输陆军跨海；舰船自身不能使用运输。"],
    ["战斗与支援", "战力来自参战部队、行军修正、防御命令、驻军、相邻支援、领袖牌与钢剑。一个势力的全部相关支援命令必须一起宣布支援同一方或全部拒绝，不能拆给交战双方，也不能支援敌人攻击自己的部队。攻城器仅在进攻带城堡或要塞的区域时提供 4 战力。平局由封臣轨道靠前者获胜。"],
    ["伤亡与撤退", "胜方领袖牌的剑图标减去败方城堡图标决定伤亡。败方选择被消灭部队；攻城器与已溃败部队无法撤退。防守败军可撤到合法相邻区域或经连续友方舰船运输到达的陆地，并横置为溃败；进攻败军退回出发地，若该地已不合法则被消灭。行动阶段结束时恢复。主城驻军一旦战败永久移除。"],
    ["领袖牌", "每家七张牌。双方秘密选择后同时公开并执行文字能力。已使用牌进入公开弃牌堆；当打出手中最后一张时，收回先前弃掉的六张，刚打出的牌仍留在弃牌堆。"],
    ["影响力与竞价", "王座轨道决定行动顺序并裁决竞价平手；封臣轨道裁决战斗平手，首位持有每轮一次的钢剑；王庭轨道决定星级命令数量，首位持有信鸦。诸王之争事件会依次秘密竞拍三条轨道，所有出价无论胜负都支付。"],
    ["荒境入侵", "每个事件牌上的荒境图标会令威胁沿 0、2、4…12 轨道前进一格；到达 12 或揭示入侵事件时，各家秘密投入威望。总和达到威胁值则守军获胜、威胁归零且最高贡献者获奖；否则荒境获胜、威胁后退一格（数值 −2），最低出价者承受最严重惩罚。"],
    ["港口、中立与联盟", "港口归连接陆地的控制者，只容纳舰船；敌人夺取陆地后可用自己的可用舰船替换港内敌舰。中立势力必须由行军战力加合法支援达到其数值才能击败，不使用领袖牌或钢剑。谈判与承诺随时允许，但不具约束力；不能展示秘密命令、秘密出价或转让组件。"],
  ] : [
    ["Objective", "The game lasts at most ten rounds. A faction immediately wins on controlling seven Castle or Stronghold areas; otherwise ties after round ten are broken by castles, total controlled land areas, supply, then Throne position."],
    ["Player-count setup", "Only the official 3–6 player base-game structures are supported. Sunward, Umbral, and Frost play at three; Tide joins at four; Verdant at five; Redmarch at six. Each count applies its matching blocked areas, neutral forces, starting units, and influence positions. The three-player Umbral port Ship follows the FAQ correction."],
    ["Round structure", "Round one skips Realm Events. Later rounds reveal three events and advance the frontier threat, then all factions assign secret orders before resolving Raids, Marches, and Consolidate Power orders."],
    ["Supply and armies", "Two or more units in one area form an army. Supply limits the number and size of armies. Mustering, marching, and retreating may never exceed the current limit; supply is recalculated only when instructed."],
    ["Mustering", "Strongholds provide 2 points and Castles 1. Footmen and Ships cost 1; Knights and Siege Engines cost 2. A local Footman upgrades for 1. Ships enter the connected port or an enemy-free adjacent sea; ports hold three Ships."],
    ["Secret orders", "Every occupied area receives one order from a faction's set of fifteen. Court position limits starred orders. Orders reveal together; the Raven holder may replace one own order or inspect the frontier deck and keep its top card or move it to the bottom."],
    ["Raids", "In Throne order, resolve one Raid at a time. Normal Raids cancel adjacent Raid, Support, or Consolidate orders; starred Raids can also cancel Defense. Land cannot raid sea; sea may raid land or sea; a port may raid only its connected sea. Pillaging Consolidate gains 1 power and makes the target lose 1 if able."],
    ["March and control", "A March may split units among several legal destinations but initiate only one battle. Pay 1 power to retain control of a fully vacated land area. Chains of friendly Ships transport land units; Ships cannot transport themselves."],
    ["Combat and support", "Strength comes from units, March and Defense modifiers, garrisons, adjacent Support, leader cards, and the blade. A House declares all of its relevant Support orders together for one side or neither; it cannot split them across both sides or support an enemy against its own units. Siege Engines provide 4 only while attacking a Castle or Stronghold. Fiefdom position breaks ties."],
    ["Casualties and retreat", "Winner swords minus loser fortifications determine casualties. The loser chooses losses; Siege Engines and already-routed units cannot retreat. Defenders may retreat to an adjacent legal area or use friendly ship transport; attackers return to origin and are destroyed if it is no longer legal. Survivors route until the Action phase ends. A defeated home garrison is permanently removed."],
    ["Leader cards", "Each faction has seven. Both sides choose secretly, reveal together, and resolve text. Used cards form an open discard pile. On playing the final card in hand, recover the previous six while the just-played card remains discarded."],
    ["Influence", "Throne controls order and bidding ties; Fiefdom breaks combat ties and grants the once-per-round blade; Court controls starred orders and grants the Raven. Influence events secretly auction the tracks in that order, and all bids are spent."],
    ["Frontier attack", "Each event icon advances the 0–12 track one space (two printed points). At 12 or on an attack event, factions secretly bid power. Meeting the threat resets it to 0 and rewards the highest bidder; failure moves it back one space (−2) and applies the card's punishment, with the lowest bidder suffering most."],
    ["Ports, neutrals, alliances", "Ports belong to their connected land and hold only Ships. Conquering the land replaces enemy port Ships with available friendly Ships. Neutral forces require equal or greater March strength plus legal Support, without leader cards or the blade. Promises are allowed but never binding; secret components cannot be shown or traded."],
  ];
  return <div className="realm-modal" role="dialog" aria-modal="true"><article><header><div><span>✦</span><h2>{zh ? "《六境争霸》完整规则" : "The Six Realms · Complete Rules"}</h2></div><button onClick={onClose}>×</button></header><p className="rules-note">{zh ? "规则实现依据 Fantasy Flight Games 官方第二版规则书及 FAQ v2；世界观、地图名称与美术为原创。" : "Rules are implemented from Fantasy Flight Games' official Second Edition rulebook and FAQ v2; setting, map names, and artwork are original."} <a href="https://images-cdn.fantasyflightgames.com/filer_public/30/4f/304f72e3-4fe4-4f91-bfbe-75133161b092/va65_agot2_rulebook_web.pdf" target="_blank" rel="noreferrer">{zh ? "官方规则书" : "Official rulebook"}</a> · <a href="https://images-cdn.fantasyflightgames.com/filer_public/cf/06/cf06eb26-48e3-46b9-b57c-f053beb2518d/agotbg_faq_v2_forweb.pdf" target="_blank" rel="noreferrer">FAQ v2</a></p>{sections.map(([title, body], index) => <section key={title}><b>{String(index + 1).padStart(2,"0")}</b><div><h3>{title}</h3><p>{body}</p></div></section>)}</article></div>;
}
