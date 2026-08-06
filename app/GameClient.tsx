"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  COLOR_NAMES,
  ROLES,
  RULESETS,
  UNIQUE_DISTRICTS,
  type DistrictColor,
  type RoleDefinition,
} from "@/lib/rules";
import {
  COLOR_NAMES_EN,
  localizedDistrict,
  localizedRole,
  localizedRuleset,
  translatedError,
  translatedGameMessage,
  type Language,
} from "@/lib/i18n";

type District = {
  uid: string;
  key: string;
  name: string;
  color: DistrictColor;
  cost: number;
  text?: string;
  beautified?: boolean;
  storedCards?: District[];
};

type ScoreBreakdown = { total: number; base: number; variety: number; completion: number; unique: number };

type Player = {
  id: string;
  name: string;
  isBot: boolean;
  isOnline: boolean;
  lastSeenAt: string | null;
  gold: number;
  handCount: number;
  hand: District[];
  city: District[];
  roleKeys: string[];
  revealedRoleKeys: string[];
  activeRoleKey: string | null;
  resourceTaken: boolean;
  pendingDraw: District[];
  pendingDrawMode: "resource" | "scholar" | null;
  buildsThisTurn: number;
  abilityUsed: boolean;
  abilityCount: number;
  incomeTaken: boolean;
  districtAbilitiesUsed: string[];
  score: number;
  scoreBreakdown?: ScoreBreakdown;
};

type PendingChoice =
  | { type: "blackmail"; actorId: string }
  | { type: "wizard"; actorId: string; targetPlayerId: string; targetName: string; cards: District[] }
  | { type: "seer"; actorId: string; remainingPlayerIds: string[]; targetName: string }
  | { type: "waiting"; actorId: string; actorName: string; choiceType: string }
  | {
      type: "warrant";
      actorId: string;
      builderId: string;
      builderName: string;
      card: District;
      signed: boolean;
      canConfiscate: boolean;
    };

type Game = {
  code: string;
  status: "lobby" | "draft" | "theater" | "turns" | "finished";
  round: number;
  hostId: string;
  ruleset: { key: string; name: string; tagline: string };
  includeRankNine: boolean;
  rulesetUniqueKeys: string[];
  crownPlayerId: string;
  currentPickerId: string | null;
  currentPlayerId: string | null;
  currentRank: number | null;
  currentRoleKey: string | null;
  firstCompletedPlayerId: string | null;
  completionTarget: number;
  availableRoleKeys: string[];
  faceupDiscardedRoleKeys: string[];
  roles: RoleDefinition[];
  allRoles: RoleDefinition[];
  allUniqueDistricts: District[];
  taxPool: number;
  warrantRoleKeys: string[];
  threatenedRoleKeys: string[];
  pendingChoice: PendingChoice | null;
  assassinatedRoleKey: string | null;
  robbedRoleKey: string | null;
  bewitchedRoleKey: string | null;
  privateNotes: string[];
  players: Player[];
  roundLog: string[];
  log: string[];
  version: number;
  viewerId: string;
};

type MatchHistorySummary = {
  id: string;
  code: string;
  rulesetKey: string;
  round: number;
  completedAt: string;
  winnerId: string;
  players: Array<{
    id: string;
    name: string;
    isBot: boolean;
    score: number;
    roleKeys: string[];
    city: Array<Pick<District, "key" | "name" | "color" | "cost" | "beautified">>;
  }>;
};

type Session = { code: string; playerId: string; token: string; recoveryCode?: string };
type Act = (action: string, payload?: Record<string, unknown>) => Promise<void>;
type SoundEffect = "soft" | "coin" | "card" | "role" | "build" | "turn" | "finish";

const STORAGE_KEY = "crown-city-session-v2";
const LANGUAGE_KEY = "crown-city-language";
const LAST_RECOVERY_KEY = "crown-city-last-recovery";
const HISTORY_KEY = "crown-city-history-key-v1";
const SOUND_KEY = "crown-city-sound-v1";
const INCOME_ROLES = new Set(["king", "patrician", "bishop", "cardinal", "merchant", "trader", "warlord", "diplomat", "marshal"]);

let gameAudioContext: AudioContext | null = null;

function getOrCreateHistoryKey() {
  const saved = window.localStorage.getItem(HISTORY_KEY);
  if (saved && saved.length >= 32) return saved;
  const key = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
  window.localStorage.setItem(HISTORY_KEY, key);
  return key;
}

function audioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  gameAudioContext ??= new AudioContextClass();
  return gameAudioContext;
}

function playGameSound(effect: SoundEffect, enabled = true) {
  if (!enabled) return;
  const context = audioContext();
  if (!context) return;
  void context.resume();
  const patterns: Record<SoundEffect, Array<[number, number, OscillatorType]>> = {
    soft: [[330, 0, "sine"]],
    coin: [[660, 0, "sine"], [880, 0.08, "sine"]],
    card: [[260, 0, "triangle"], [390, 0.055, "triangle"]],
    role: [[330, 0, "triangle"], [494, 0.09, "triangle"]],
    build: [[220, 0, "triangle"], [330, 0.065, "triangle"], [440, 0.13, "triangle"]],
    turn: [[523, 0, "sine"], [659, 0.09, "sine"], [784, 0.18, "sine"]],
    finish: [[523, 0, "triangle"], [659, 0.1, "triangle"], [784, 0.2, "triangle"], [1047, 0.32, "sine"]],
  };
  const start = context.currentTime + 0.01;
  for (const [frequency, offset, type] of patterns[effect]) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start + offset);
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(effect === "soft" ? 0.035 : 0.075, start + offset + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.13);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + 0.14);
  }
}

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
}>({ language: "zh", setLanguage: () => undefined });

function useLanguage() {
  const context = useContext(LanguageContext);
  const text = useCallback((zh: string, en: string) => context.language === "en" ? en : zh, [context.language]);
  return {
    ...context,
    text,
  };
}

function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return <button className="language-toggle" onClick={() => setLanguage(language === "zh" ? "en" : "zh")} aria-label={language === "zh" ? "Switch to English" : "切换到中文"}>{language === "zh" ? "EN" : "中文"}</button>;
}

function roleFor(game: Game, key: string | null | undefined, language: Language = "zh") {
  const role = game.allRoles.find((candidate) => candidate.key === key) ?? ROLES.find((candidate) => candidate.key === key) ?? null;
  return role ? localizedRole(role, language) : null;
}

function citySize(player: Player) {
  return player.city.reduce((sum, district) => sum + (district.key === "monument" ? 2 : 1), 0);
}

type ReferencePosition = { left: number; top: number; above: boolean };

function ReferenceLink({ label, heading, meta, description, className = "" }: {
  label: ReactNode;
  heading: string;
  meta?: string;
  description: string;
  className?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<ReferencePosition | null>(null);
  const show = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(304, window.innerWidth - 24);
    const left = Math.min(window.innerWidth - width / 2 - 12, Math.max(width / 2 + 12, rect.left + rect.width / 2));
    const above = window.innerHeight - rect.bottom < 190 && rect.top > window.innerHeight - rect.bottom;
    setPosition({ left, top: above ? rect.top - 8 : rect.bottom + 8, above });
  }, []);
  const hide = useCallback(() => setPosition(null), []);
  return <>
    <button
      ref={triggerRef}
      type="button"
      className={`reference-link ${className}`}
      title={`${heading}${meta ? ` · ${meta}` : ""}\n${description}`}
      aria-expanded={Boolean(position)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={(event) => { event.stopPropagation(); if (position) hide(); else show(); }}
    >{label}</button>
    {position && typeof document !== "undefined" && createPortal(
      <aside className={`reference-floating ${position.above ? "above" : "below"}`} style={{ left: position.left, top: position.top }} role="tooltip">
        <strong>{heading}</strong>{meta && <small>{meta}</small>}<p>{description}</p>
      </aside>,
      document.body,
    )}
  </>;
}

function RoleReferenceLink({ role, label, className }: { role: RoleDefinition; label?: ReactNode; className?: string }) {
  const { language, text } = useLanguage();
  const shown = localizedRole(role, language);
  return <ReferenceLink
    label={label ?? shown.name}
    heading={`${shown.rank} · ${shown.name}`}
    meta={shown.short}
    description={shown.description || text("此角色没有额外能力。", "This character has no additional power.")}
    className={className}
  />;
}

function DistrictReferenceLink({ district, label, className }: { district: District; label?: ReactNode; className?: string }) {
  const { language, text } = useLanguage();
  const shown = localizedDistrict(district, language);
  const colorNames = language === "en" ? COLOR_NAMES_EN : COLOR_NAMES;
  return <ReferenceLink
    label={label ?? shown.name}
    heading={shown.name}
    meta={text(`${shown.cost} 金币 · ${colorNames[shown.color]}`, `${shown.cost} gold · ${colorNames[shown.color]}`)}
    description={shown.text ?? text("基础城区：建造费用也是它的基础终局分数。", "Basic district: its building cost is also its base endgame score.")}
    className={className}
  />;
}

function RulesModal({ onClose }: { onClose: () => void }) {
  const { language, text } = useLanguage();
  const rows = language === "en"
    ? [["2", "8", "2", "Alternating hidden discards", "1 initially"], ["3", "9", "2", "One hidden discard after first picks", "1 initially"], ["4", "8", "1", "2", "1"], ["5", "8", "1", "1", "1"], ["6", "8", "1", "0", "1"], ["7", "8", "1", "0", "1; last player chooses between two"], ["8", "9", "1", "0", "1; last player chooses between two"]]
    : [["2", "8", "2", "轮流额外暗弃", "开局 1"], ["3", "9", "2", "第一轮选完再暗弃 1", "开局 1"], ["4", "8", "1", "2", "1"], ["5", "8", "1", "1", "1"], ["6", "8", "1", "0", "1"], ["7", "8", "1", "0", "1；末家二选一"], ["8", "9", "1", "0", "1；末家二选一"]];
  return (
    <div className="modal-backdrop rules-backdrop" role="presentation" onMouseDown={onClose}>
      <article className="rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="rules-header">
          <div><span className="eyebrow">{text("完整规则 · 2016 修订体系", "Complete rules · 2016 revised system")}</span><h2 id="rules-title">{text("王冠之城规则书", "Crown City Rulebook")}</h2></div>
          <button className="close-rules" onClick={onClose} aria-label={text("关闭规则书", "Close rulebook")}>×</button>
        </header>

        <nav className="rules-nav" aria-label={text("规则章节", "Rulebook sections")}>
          <a href="#rules-goal">{text("目标", "Goal")}</a><a href="#rules-round">{text("回合", "Turns")}</a><a href="#rules-draft">{text("选角", "Draft")}</a><a href="#rules-roles">{text("角色", "Characters")}</a><a href="#rules-districts">{text("城区", "Districts")}</a><a href="#rules-score">{text("计分", "Scoring")}</a>
        </nav>

        <section id="rules-goal" className="rule-section">
          <span className="rule-index">01</span><div><h3>{text("目标与准备", "Goal and setup")}</h3><p>{text("支持 2–8 人。每人从 2 金币、4 张城区牌开始；每局选用每个编号各一名角色，并把 14 张独特城区与 54 张基础城区洗成牌库。你要用金币建造城市，在终局取得最高分。", "For 2–8 players. Each starts with 2 gold and 4 district cards. Use one character of each rank and shuffle 14 unique districts with the 54 basic districts. Build the highest-scoring city to win.")}</p></div>
        </section>
        <section id="rules-round" className="rule-section">
          <span className="rule-index">02</span><div><h3>{text("一轮怎样进行", "How a round works")}</h3><p>{text("先秘密选角，再从小到大叫号。角色被叫到时公开身份并行动：必须选择“取 2 金币”或“抽 2 留 1”，然后可发动角色/城区能力，并按上限建造城区。相同名称的城区通常不能重复。", "Draft characters in secret, then call ranks from low to high. When called, reveal your character and take a turn: choose 2 gold or draw 2 and keep 1, use character or district powers, and build within your limit. Duplicate district names are normally forbidden.")}</p><p>{text("能力如未写明时点，可在自己回合的任意时点发动；城区能力通常可选择是否发动。页面会拦截非法目标、费用和建造上限。", "Unless a timing is specified, powers may be used at any point during your turn. District powers are normally optional. The server rejects illegal targets, payments, and builds.")}</p></div>
        </section>
        <section id="rules-draft" className="rule-section">
          <span className="rule-index">03</span><div><h3>{text("不同人数的秘密选角", "Secret drafting by player count")}</h3>
            <div className="rule-table-wrap"><table><thead><tr><th>{text("人数", "Players")}</th><th>{text("角色数", "Cast")}</th><th>{text("每人角色", "Each")}</th><th>{text("明置弃牌", "Face-up")}</th><th>{text("暗置弃牌", "Face-down")}</th></tr></thead><tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table></div>
            <p>{text("4 号角色不能明置弃掉。3 人与 8 人必须加入 9 号角色；4–7 人可在建房时选择加入。2 人不能使用皇帝；王后只用于 5 人以上。2–3 人每轮各行动两次，但共享同一城市、金币与手牌。", "Rank 4 can never be discarded face-up. Three- and eight-player games require rank 9; rooms with 4–7 players may add it. The Emperor is not used with two players, and the Queen requires at least five. With 2–3 players, each player takes two character turns while sharing one city, hand, and gold supply.")}</p>
          </div>
        </section>
        <section id="rules-roles" className="rule-section stacked">
          <span className="rule-index">04</span><div><h3>{text("27 名角色", "27 characters")}</h3><div className="rule-card-grid roles-reference">
            {ROLES.map((source) => { const role = localizedRole(source, language); return <article key={role.key} className={`reference-card color-${role.color}`}><b>{role.rank}</b><h4><RoleReferenceLink role={source} /></h4><p>{role.description}</p></article>; })}
          </div></div>
        </section>
        <section id="rules-districts" className="rule-section stacked">
          <span className="rule-index">05</span><div><h3>{text("城区与 30 张独特城区", "Districts and 30 unique districts")}</h3><p>{text("黄色贵族、蓝色宗教、绿色商业、红色军事、紫色独特。牌面费用既是建造价，也是基础分。每局规则套组只混入下列独特城区中的 14 张。", "Yellow is noble, blue religious, green trade, red military, and purple unique. A card's cost is both its building cost and base score. Each ruleset uses 14 of the unique districts below.")}</p><div className="unique-reference">
            {UNIQUE_DISTRICTS.map((source) => { const district = localizedDistrict(source, language); return <article key={district.key}><span>{district.cost}</span><div><h4><DistrictReferenceLink district={{ ...source, uid: `rules-${source.key}` }} /></h4><p>{district.text}</p></div></article>; })}
          </div></div>
        </section>
        <section id="rules-score" className="rule-section">
          <span className="rule-index">06</span><div><h3>{text("终局与计分", "Endgame and scoring")}</h3><p>{text("4–8 人中，任一城市达到 7 座便触发终局；2–3 人需达到 8 座。纪念碑按两座计算。当前轮仍要完整打完。", "With 4–8 players, a city of seven districts triggers the endgame; with 2–3 players, eight are required. The Monument counts as two. Finish the current round.")}</p><ul><li>{text("城区费用（含艺术家美化）总和；", "Total district costs, including beautification;")}</li><li>{text("五种类型齐全：+3；", "All five district types: +3;")}</li><li>{text("首位完成城市：+4；其他完成者：+2；", "First completed city: +4; other completed cities: +2;")}</li><li>{text("再加独特城区的终局分。", "Then add unique district endgame points.")}</li></ul><p>{text("最高分获胜；同分时，以最后一轮公开过的最高编号角色判定先后。", "Highest score wins. Ties are broken by the highest-ranked character revealed in the final round.")}</p></div>
        </section>
        <footer className="rules-footer"><p>{text("本规则书为便于在线游玩的中文转述。规则依据 Z-Man Games 的修订版体系；牌桌中的每项选择由服务器校验。", "This in-game summary follows Z-Man Games' revised rules system. Every table action is validated by the server.")}</p><a href="https://images.zmangames.com/filer_public/82/aa/82aac2d6-2a19-4143-9690-eb16b82bd9af/citadels_deluxe_rulebook.pdf" target="_blank" rel="noreferrer">{text("查看官方英文规则 PDF ↗", "Open the official rules PDF ↗")}</a></footer>
      </article>
    </div>
  );
}

function DistrictCard({ district, action, secondaryAction, disabled, secondaryDisabled, compact = false }: {
  district: District;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  disabled?: boolean;
  secondaryDisabled?: boolean;
  compact?: boolean;
}) {
  const { language, text } = useLanguage();
  const shown = localizedDistrict(district, language);
  const colorNames = language === "en" ? COLOR_NAMES_EN : COLOR_NAMES;
  return (
    <article className={`district-card color-${district.color} ${compact ? "compact" : ""}`}>
      <div className="district-cost" aria-label={text(`${district.cost} 金币`, `${district.cost} gold`)}>{district.cost + (district.beautified ? 1 : 0)}</div>
      <div className="district-type">{colorNames[district.color]}{district.beautified ? text(" · 已美化", " · Beautified") : ""}</div>
      <h4><DistrictReferenceLink district={district} /></h4>
      {!compact && <p>{shown.text ?? text("基础城区：建造费用就是它的基础终局分数。", "Basic district: its building cost is also its base endgame score.")}</p>}
      {district.storedCards?.length ? <small className="stored-count">{text(`馆藏 ${district.storedCards.length} 张`, `${district.storedCards.length} stored`)}</small> : null}
      {action && <button className="card-action" onClick={action.onClick} disabled={disabled}>{action.label}</button>}
      {secondaryAction && <button className="card-action secondary-card-action" onClick={secondaryAction.onClick} disabled={secondaryDisabled}>{secondaryAction.label}</button>}
    </article>
  );
}

function HistoryModal({ historyKey, onClose }: { historyKey: string; onClose: () => void }) {
  const { language, text } = useLanguage();
  const [history, setHistory] = useState<MatchHistorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!historyKey) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/game", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "listHistory", historyKey }),
          signal: controller.signal,
        });
        const data = await response.json() as { history?: MatchHistorySummary[]; error?: string };
        if (!response.ok || !data.history) throw new Error(data.error ?? text("无法读取历史对局。", "Unable to load match history."));
        setHistory(data.history);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? translatedError(caught.message, language) : text("无法读取历史对局。", "Unable to load match history."));
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [historyKey, language, text]);

  return <div className="modal-backdrop history-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="history-modal" role="dialog" aria-modal="true" aria-labelledby="history-title"><header><div><div className="eyebrow">{text("服务器保存 · 本设备身份", "Saved on server · this device")}</div><h2 id="history-title">{text("历史对局", "Match history")}</h2></div><button onClick={onClose} aria-label={text("关闭历史对局", "Close match history")}>×</button></header>
    <p className="history-explainer">{text("完成后的比分、角色和城市会保存在服务器。历史记录与这台设备的匿名身份关联，不需要注册账号。", "Final scores, characters, and cities are saved on the server. History is linked to an anonymous identity on this device; no account is required.")}</p>
    {loading && <div className="history-empty">{text("正在翻阅王城档案…", "Opening the city archives…")}</div>}
    {error && <div className="history-error" role="alert">{error}</div>}
    {!loading && !error && !history.length && <div className="history-empty"><span>♜</span><strong>{text("还没有完成的对局", "No completed matches yet")}</strong><p>{text("完成一局后，结算结果会自动出现在这里。", "Finish a game and its result will appear here automatically.")}</p></div>}
    <div className="history-list">{history.map((match) => {
      const highestRank = (player: MatchHistorySummary["players"][number]) => Math.max(0, ...player.roleKeys.map((key) => ROLES.find((role) => role.key === key)?.rank ?? 0));
      const ranking = [...match.players].sort((a, b) => b.score - a.score || highestRank(b) - highestRank(a));
      const winner = match.players.find((player) => player.id === match.winnerId) ?? ranking[0];
      const rulesetSource = RULESETS.find((ruleset) => ruleset.key === match.rulesetKey) ?? RULESETS[0];
      const ruleset = localizedRuleset(rulesetSource, language);
      const date = new Intl.DateTimeFormat(language === "en" ? "en-GB" : "zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(match.completedAt));
      return <article className="history-match" key={match.id}><div className="history-match-summary"><div><span>{date} · {text(`房间 ${match.code}`, `Room ${match.code}`)}</span><h3>♛ {winner?.name ?? text("未知城主", "Unknown leader")}</h3><small>{ruleset.name} · {text(`${match.round} 轮`, `${match.round} rounds`)}</small></div><strong>{text(`${winner?.score ?? 0} 分`, `${winner?.score ?? 0} pts`)}</strong></div><div className="history-ranking">{ranking.map((player, index) => <div key={player.id}><b>{index + 1}</b><span>{player.name}{player.isBot ? " · AI" : ""}</span><strong>{player.score}</strong></div>)}</div><details><summary>{text("查看角色与城市", "View characters and cities")}</summary><div className="history-player-details">{ranking.map((player) => <section key={player.id}><h4>{player.name}</h4><p>{player.roleKeys.length ? player.roleKeys.map((key, index) => { const role = ROLES.find((candidate) => candidate.key === key); return role ? <span key={key}>{index > 0 && (language === "en" ? ", " : "、")}<RoleReferenceLink role={role} /></span> : key; }) : text("无公开角色", "No revealed characters")}</p><div>{player.city.map((district, index) => <span key={`${district.key}-${index}`} className={`color-${district.color}`}><DistrictReferenceLink district={{ ...district, uid: `history-${match.id}-${player.id}-${index}` }} label={`${localizedDistrict(district, language).name} · ${district.cost + (district.beautified ? 1 : 0)}`} /></span>)}</div></section>)}</div></details></article>;
    })}</div>
  </section></div>;
}

function Landing({ historyKey, onCreated, onOpenRules, onOpenHistory }: { historyKey: string; onCreated: (session: Session, game: Game) => void; onOpenRules: () => void; onOpenHistory: () => void }) {
  const { language, text } = useLanguage();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [botCount, setBotCount] = useState(1);
  const [rulesetKey, setRulesetKey] = useState("first_game");
  const [includeRankNine, setIncludeRankNine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const inviteCode = new URLSearchParams(window.location.search).get("room")?.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    let remembered: Pick<Session, "code" | "recoveryCode"> | null = null;
    try { remembered = JSON.parse(window.localStorage.getItem(LAST_RECOVERY_KEY) ?? "null"); } catch { window.localStorage.removeItem(LAST_RECOVERY_KEY); }
    const nextCode = inviteCode?.length === 4 ? inviteCode : remembered?.code;
    if (nextCode?.length === 4) {
      const timer = window.setTimeout(() => {
        setCode(nextCode);
        if (remembered?.code === nextCode && remembered.recoveryCode?.length === 10) setRecoveryCode(remembered.recoveryCode);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  async function submit(action: "create" | "join" | "recover") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/game", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, name, code, recoveryCode, botCount, rulesetKey, includeRankNine, historyKey: historyKey || getOrCreateHistoryKey() }) });
      const data = await response.json() as { error?: string; session?: Session; game?: Game };
      if (!response.ok || !data.session || !data.game) throw new Error(translatedError(data.error ?? text("暂时无法进入房间。", "Unable to enter the room right now."), language));
      onCreated(data.session, data.game);
    } catch (caught) {
      setError(caught instanceof Error ? translatedError(caught.message, language) : text("暂时无法进入房间。", "Unable to enter the room right now."));
    } finally { setBusy(false); }
  }

  return (
    <main className="landing-shell">
      <LanguageToggle />
      <section className="landing-copy">
        <div className="eyebrow">{text("完整修订规则 · 2–8 人在线", "Complete revised rules · 2–8 players online")}</div><div className="crown-mark" aria-hidden="true">♛</div><h1>{text("王冠之城", "Crown City")}</h1>
        <p className="hero-line">{text("27 名角色、84 张城区牌与七套官方组合。秘密选择身份，读懂朋友的野心，建成最耀眼的城市。", "Twenty-seven characters, 84 district cards, and seven official combinations. Choose a secret identity, read your rivals, and build the most magnificent city.")}</p>
        <div className="rules-ribbon"><span><b>01</b> {text("秘密选角", "Secret draft")}</span><span><b>02</b> {text("获取资源", "Gather")}</span><span><b>03</b> {text("发动能力", "Use powers")}</span><span><b>04</b> {text("建造计分", "Build & score")}</span></div>
        <button className="ghost-rules-button" onClick={onOpenRules}>{text("打开完整规则书 →", "Open the complete rulebook →")}</button>
      </section>
      <section className="entry-panel" aria-label={text("进入游戏", "Enter game")}>
        <div className="panel-heading"><span>{text("今晚的城门已经开启", "The city gates are open")}</span><h2>{text("加入牌桌", "Join the table")}</h2></div>
        <label>{text("你的昵称", "Your nickname")}<input value={name} onChange={(event) => setName(event.target.value)} placeholder={text("例如：陈船长", "For example: Captain Chen")} maxLength={16} autoComplete="nickname" /></label>
        <div className="setup-grid">
          <label>{text("规则套组", "Ruleset")}<select value={rulesetKey} onChange={(event) => setRulesetKey(event.target.value)}>{RULESETS.map((source) => { const set = localizedRuleset(source, language); return <option key={set.key} value={set.key}>{set.name} · {set.tagline}</option>; })}</select></label>
          <label>{text("策略电脑（无需 API）", "Strategy AI (no API)")}<select value={botCount} onChange={(event) => setBotCount(Number(event.target.value))}>{Array.from({ length: 8 }, (_, count) => <option key={count} value={count}>{count === 0 ? text("不添加", "None") : text(`${count} 位${count === 1 ? "（推荐）" : ""}`, `${count}${count === 1 ? " (recommended)" : ""}`)}</option>)}</select></label>
        </div>
        <label className="rank-nine-toggle"><input type="checkbox" checked={includeRankNine} onChange={(event) => setIncludeRankNine(event.target.checked)} /><span>{text("4–7 人也加入 9 号角色（3 人与 8 人会按规则自动加入）", "Also use rank 9 with 4–7 players (automatic with 3 or 8 players)")}</span></label>
        <button className="primary-button create-button" onClick={() => submit("create")} disabled={busy}>{text("创建房间", "Create room")}</button>
        <div className="divider"><span>{text("或者输入朋友的房间码", "Or enter a friend's room code")}</span></div>
        <div className="join-row"><input className="code-input" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))} placeholder="AB12" maxLength={4} aria-label={text("四位房间码", "Four-character room code")} /><button className="secondary-button" onClick={() => submit("join")} disabled={busy}>{text("加入房间", "Join room")}</button></div>
        <details className="recovery-entry"><summary>{text("换设备？用恢复码返回座位", "Changed devices? Recover your seat")}</summary><label>{text("10 位恢复码", "10-character recovery code")}<input value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} placeholder="ABCD23WXYZ" maxLength={10} autoComplete="off" /></label><button className="secondary-button" onClick={() => submit("recover")} disabled={busy || code.length !== 4 || recoveryCode.length !== 10}>{text("恢复原座位", "Recover seat")}</button></details>
        {error && <p className="form-error" role="alert">{error}</p>}<button className="history-entry-button" onClick={onOpenHistory}>♜ {text("查看历史对局", "View match history")}</button><p className="fine-print">{text("无需注册或模型密钥。策略电脑由服务器按规则运行；完成的对局会保存到王城档案。", "No account or model key required. Strategy AI follows the rules on the server; completed matches are saved in the city archive.")}</p>
      </section>
    </main>
  );
}

function PlayerStrip({ game, act }: { game: Game; act: Act }) {
  const { language, text } = useLanguage();
  const isHost = game.viewerId === game.hostId;
  return <div className="player-strip">{game.players.map((player) => {
    const choosing = (game.status === "draft" || game.status === "theater") && game.currentPickerId === player.id;
    const active = choosing || game.currentPlayerId === player.id;
    const online = player.isBot || player.isOnline;
    return <article key={player.id} className={`player-chip ${active ? "active" : ""} ${online ? "" : "player-offline"}`}><div className="avatar">{player.name.slice(0, 1)}<i className={`presence-dot ${online ? "online" : "offline"}`} title={online ? text("在线", "Online") : text("已掉线", "Offline")} /></div><div><div className="player-name">{player.id === game.crownPlayerId && <span title={text("皇冠", "Crown")}>♛</span>}{player.name}{player.isBot ? " · AI" : ""}{choosing && <span className="picker-badge">{text("正在选角", "Choosing")}</span>}</div><div className="player-facts"><span>● {player.gold}</span><span>▰ {player.handCount}</span><span>⌂ {citySize(player)}/{game.completionTarget}</span></div></div><div className="role-token">{player.roleKeys.length ? player.roleKeys.map((key, index) => { const role = game.allRoles.find((candidate) => candidate.key === key); return role ? <span key={key}>{index > 0 && " / "}<RoleReferenceLink role={role} label={`${role.rank} · ${localizedRole(role, language).name}`} /></span> : key; }) : text("身份未公开", "Identity hidden")}</div>{isHost && !player.isBot && player.id !== game.viewerId && game.status !== "lobby" && <button className="inline-manage" onClick={() => act(player.isOnline ? "transferHost" : "entrust", { targetPlayerId: player.id })}>{player.isOnline ? text("移交房主", "Make host") : text("掉线托管", "AI takeover")}</button>}</article>;
  })}</div>;
}

function Lobby({ game, act }: { game: Game; act: Act }) {
  const { language, text } = useLanguage();
  const isHost = game.viewerId === game.hostId;
  const host = game.players.find((player) => player.id === game.hostId);
  const ruleset = localizedRuleset({ ...game.ruleset, roleKeys: [], uniqueKeys: [] }, language);
  const [copied, setCopied] = useState(false);
  async function shareInvite() {
    const url = `${window.location.origin}/?room=${game.code}`;
    const shareData = { title: text("加入我的《王冠之城》房间", "Join my Crown City room"), text: text(`房间码 ${game.code}，点击链接加入牌桌。`, `Room ${game.code}. Open the link to join the table.`), url };
    if (navigator.share) await navigator.share(shareData); else await navigator.clipboard.writeText(`${shareData.text}\n${url}`);
    setCopied(true); window.setTimeout(() => setCopied(false), 1400);
  }
  return <section className="center-stage lobby-stage"><div className="eyebrow">{text("等待其他城主", "Waiting for city leaders")} · {ruleset.name}</div><h2>{text("房间", "Room")} <button className="room-code" onClick={shareInvite}>{game.code}</button></h2><p>{copied ? text("邀请链接已准备好", "Invite link ready") : `${ruleset.tagline}${text("。发送链接，朋友输入昵称即可加入。", ". Share the link; friends only need a nickname to join.")}`}</p>
    <div className="ruleset-preview"><div><span>{text("本局角色", "Characters")}{game.includeRankNine ? text(" · 含可选 9 号", " · optional rank 9 enabled") : ""}</span><strong>{game.roles.map((source, index) => <span key={source.key}>{index > 0 && " · "}<RoleReferenceLink role={source} label={`${source.rank}.${localizedRole(source, language).name}`} /></span>)}</strong></div><div><span>{text("独特城区", "Unique districts")}</span><strong>{game.rulesetUniqueKeys.map((key, index) => { const source = UNIQUE_DISTRICTS.find((district) => district.key === key); return source ? <span key={key}>{index > 0 && " · "}<DistrictReferenceLink district={{ ...source, uid: `lobby-${source.key}` }} /></span> : null; })}</strong></div></div>
    <div className="seated-players">{game.players.map((player) => <div key={player.id} className={`seat-card ${!player.isBot && !player.isOnline ? "player-offline" : ""}`}><span className="seat-avatar">{player.name.slice(0, 1)}<i className={`presence-dot ${player.isBot || player.isOnline ? "online" : "offline"}`} /></span><strong>{player.name}</strong><small>{player.id === game.hostId ? text("房主", "Host") : player.isBot ? text("电脑对手", "AI player") : player.isOnline ? text("已就座", "Seated") : text("已掉线", "Offline")}</small>{isHost && player.id !== game.viewerId && <div className="seat-actions">{!player.isBot && <button onClick={() => act("transferHost", { targetPlayerId: player.id })}>{text("移交房主", "Make host")}</button>}<button onClick={() => act("removePlayer", { targetPlayerId: player.id })}>{text("移除", "Remove")}</button></div>}</div>)}{Array.from({ length: Math.max(0, 8 - game.players.length) }).map((_, index) => <div key={index} className="seat-card empty"><span>＋</span><small>{text("空座位", "Open seat")}</small></div>)}</div>
    {isHost && game.players.length < 8 && <button className="add-bot-button" onClick={() => act("addBot")}>＋ {text("添加电脑玩家", "Add AI player")}</button>}
    {!isHost && host && !host.isBot && !host.isOnline && <button className="claim-host-button" onClick={() => act("claimHost")}>{text("房主掉线满 45 秒后接任", "Take over after host is offline for 45 seconds")}</button>}
    <div className="invite-actions"><button className="secondary-button large" onClick={shareInvite}>{copied ? text("邀请链接已复制", "Invite link copied") : text("邀请朋友加入", "Invite friends")}</button>{isHost ? <button className="primary-button large" onClick={() => act("start")} disabled={game.players.length < 2}>{text("按此规则开始", "Start with these rules")}</button> : <div className="waiting-pulse">{text("等待房主开始游戏…", "Waiting for the host…")}</div>}</div>
  </section>;
}

function RoundRoleTrack({ game }: { game: Game }) {
  const { language, text } = useLanguage();
  const roles = [...game.roles].sort((a, b) => a.rank - b.rank);
  const picker = game.players.find((player) => player.id === game.currentPickerId);
  const resolvedCount = game.status === "finished"
    ? roles.length
    : game.status === "turns" && game.currentRank !== null
      ? roles.filter((role) => role.rank < game.currentRank!).length
      : 0;
  return <section className="round-role-tracker" aria-label={text("本轮角色行动顺序", "Character order this round")}><header><div><span>◆</span><strong>{text("本轮角色行动", "Characters this round")}</strong><small>{text(`第 ${game.round} 轮`, `Round ${game.round}`)}</small></div><b>{game.status === "draft" || game.status === "theater" ? picker ? text(`${picker.name} 正在选角`, `${picker.name} is choosing`) : text("秘密选角中", "Secret draft") : text(`已处理 ${resolvedCount}/${roles.length}`, `${resolvedCount}/${roles.length} resolved`)}</b></header><div className="round-role-scroll"><ol>{roles.map((source) => {
    const role = localizedRole(source, language);
    const owner = game.players.find((player) => player.roleKeys.includes(source.key));
    const isRevealed = Boolean(owner?.revealedRoleKeys.includes(source.key)) || game.status === "finished";
    const isCurrent = game.currentRoleKey === source.key;
    const isPassed = game.status === "finished" || (game.status === "turns" && game.currentRank !== null && source.rank < game.currentRank);
    const isDiscarded = game.faceupDiscardedRoleKeys.includes(source.key);
    const isAssassinated = game.assassinatedRoleKey === source.key;
    let status = "pending";
    let statusLabel = text("等待叫号", "Waiting");
    if (isCurrent) { status = "current"; statusLabel = text("正在行动", "Acting now"); }
    else if (isDiscarded) { status = "skipped"; statusLabel = text("明置弃牌", "Face-up discard"); }
    else if (isAssassinated) { status = "attacked"; statusLabel = text("被刺客点名", "Assassin target"); }
    else if (isPassed && owner) { status = "done"; statusLabel = text("已行动", "Acted"); }
    else if (isPassed) { status = "skipped"; statusLabel = text("无人回应", "No response"); }
    else if (game.status === "draft" || game.status === "theater") { statusLabel = text("身份隐藏", "Identity hidden"); }
    const ownerLabel = owner
      ? isRevealed ? owner.name : owner.id === game.viewerId ? text("你 · 仅你可见", "You · private") : text("身份未公开", "Identity hidden")
      : text("尚未揭晓", "Not revealed");
    return <li key={source.key} className={`round-role-step ${status} color-${role.color}`}><span className="round-role-rank">{role.rank}</span><div><strong><RoleReferenceLink role={source} /></strong><small>{ownerLabel}</small></div><em>{statusLabel}</em><div className="round-role-effects">{isAssassinated && <span className="effect-assassin">† {text("刺杀", "Assassin")}</span>}{game.robbedRoleKey === source.key && <span className="effect-robbed">● {text("盗窃目标", "Robbery target")}</span>}{game.bewitchedRoleKey === source.key && <span className="effect-bewitched">✦ {text("施法目标", "Bewitched")}</span>}{game.warrantRoleKeys.includes(source.key) && <span className="effect-warrant">▣ {text("覆面拘票", "Warrant")}</span>}{game.threatenedRoleKeys.includes(source.key) && <span className="effect-threat">◆ {text("覆面威胁", "Threat")}</span>}</div></li>;
  })}</ol></div></section>;
}

function Chronicle({ game }: { game: Game }) {
  const { language, text } = useLanguage();
  const currentRound = game.roundLog.length ? game.roundLog : [text("本轮尚无公开行动。", "No public actions this round yet.")];
  return <aside className="chronicle"><div className="chronicle-heading"><span>◆</span><div><h3>{text("本轮行动", "This round")}</h3><small>{text(`第 ${game.round} 轮 · 最新在前`, `Round ${game.round} · newest first`)}</small></div></div><ol className="round-chronicle">{[...currentRound].reverse().map((entry, index) => <li key={`${entry}-${index}`}>{translatedGameMessage(entry, language)}</li>)}</ol><details className="full-chronicle"><summary>{text("查看整局记录", "View full match log")}</summary><ol>{[...game.log].reverse().map((entry, index) => <li key={`${entry}-${index}`}>{translatedGameMessage(entry, language)}</li>)}</ol></details></aside>;
}

function DraftTableOverview({ game, onReturn }: { game: Game; onReturn: () => void }) {
  const { language, text } = useLanguage();
  const me = game.players.find((player) => player.id === game.viewerId)!;
  const myTurn = game.currentPickerId === game.viewerId;
  const picker = game.players.find((player) => player.id === game.currentPickerId);
  return <div className="turn-layout draft-table-overview"><section className="table-area"><div className="turn-banner draft-overview-banner"><div><span>{text(`第 ${game.round} 轮 · 秘密选角中`, `Round ${game.round} · Secret draft in progress`)}</span><h2>{myTurn ? text("现在轮到你选角色", "It is your turn to choose") : picker ? text(`${picker.name} 正在选角色`, `${picker.name} is choosing a character`) : text("选角期间的牌桌", "The table during the draft")}</h2></div><button className={myTurn ? "primary-button" : "secondary-button"} onClick={onReturn}>{myTurn ? text("继续选角色 →", "Choose a character →") : text("返回选角", "Back to draft")}</button></div>
    <div className="draft-resource-grid" aria-label={text("你的资源", "Your resources")}><article><span>●</span><div><small>{text("金币", "Gold")}</small><strong>{me.gold}</strong></div></article><article><span>▰</span><div><small>{text("手牌", "Cards")}</small><strong>{me.handCount}</strong></div></article><article><span>⌂</span><div><small>{text("城区", "Districts")}</small><strong>{citySize(me)} / {game.completionTarget}</strong></div></article><article><span>♜</span><div><small>{text("已选身份", "Chosen characters")}</small><strong>{me.roleKeys.length}</strong></div></article></div>
    {me.roleKeys.length > 0 && <div className="draft-private-roles"><span>{text("仅你可见的已选身份", "Your secret chosen characters")}</span><div>{me.roleKeys.map((key) => { const source = game.allRoles.find((role) => role.key === key); const role = roleFor(game, key, language); return source && role ? <strong key={key} className={`color-${role.color}`}><RoleReferenceLink role={source} label={`${role.rank} · ${role.name}`} /></strong> : null; })}</div></div>}
    <section className="hand-section readonly-hand"><div className="section-title"><h3>{text("你的城区牌", "Your district cards")}</h3><span>{text("选角时只能查看，行动阶段才能建造", "View only during the draft; build during your turn")}</span></div>{me.hand.length ? <div className="card-row">{me.hand.map((district) => <DistrictCard key={district.uid} district={district} />)}</div> : <div className="empty-hand">{text("你暂时没有城区牌。", "You have no district cards.")}</div>}</section>
    <section className="cities-section"><div className="section-title"><h3>{text("桌上的城市", "Cities on the table")}</h3><span>{text(`达到 ${game.completionTarget} 座触发终局`, `Reach ${game.completionTarget} districts to trigger the end`)}</span></div><div className="city-grid">{game.players.map((player) => <article className="city-panel" key={player.id}><header><strong>{player.name}</strong><span>{text(`${player.score} 当前分`, `${player.score} current points`)}</span></header><div className="mini-districts">{player.city.map((district) => <DistrictCard key={district.uid} district={district} compact />)}{!player.city.length && <span className="empty-city">{text("尚未建造", "No districts yet")}</span>}</div></article>)}</div></section>
  </section><Chronicle game={game} /></div>;
}

function Draft({ game, act }: { game: Game; act: Act }) {
  const { language, text } = useLanguage();
  const [showTable, setShowTable] = useState(false);
  const myTurn = game.currentPickerId === game.viewerId;
  const me = game.players.find((player) => player.id === game.viewerId)!;
  const picker = game.players.find((player) => player.id === game.currentPickerId);
  if (showTable) return <DraftTableOverview game={game} onReturn={() => setShowTable(false)} />;
  return <section className="center-stage draft-stage"><div className="eyebrow">{text(`第 ${game.round} 轮 · 秘密选角`, `Round ${game.round} · Secret draft`)}</div><h2>{myTurn ? text(`选择你的第 ${me.roleKeys.length + 1} 个身份`, `Choose character ${me.roleKeys.length + 1}`) : picker ? text(`${picker.name} 正在选择身份`, `${picker.name} is choosing a character`) : text("其他玩家正在选择身份", "Another player is choosing")}</h2><p>{myTurn ? text("只有你看得到当前可选角色。2–3 人每轮会各选两个角色。", "Only you can see these choices. With 2–3 players, everyone chooses two characters.") : text("角色会沿皇冠方向依次传递，请留在牌桌。", "The draft passes around the table from the crown holder.")}</p>
    <button className="draft-table-toggle" onClick={() => setShowTable(true)}>← {text("返回牌桌，查看资源与历史", "Return to the table · resources and history")}</button>
    {game.faceupDiscardedRoleKeys.length > 0 && <div className="faceup-discards"><strong>{text("本轮明置弃牌", "Face-up discards")}</strong><div className="faceup-discard-list">{game.faceupDiscardedRoleKeys.map((key) => { const source = game.roles.find((candidate) => candidate.key === key); if (!source) return null; const role = localizedRole(source, language); return <article key={key} className={`color-${role.color}`}><b>{role.rank}</b><div><RoleReferenceLink role={source} /><small>{role.short}</small></div></article>; })}</div></div>}
    {myTurn ? <div className="role-grid">{game.roles.filter((role) => game.availableRoleKeys.includes(role.key)).map((source) => { const role = localizedRole(source, language); return <article key={role.key} className={`role-card color-${role.color}`}><span className="role-number">{role.rank}</span><span className="role-name"><RoleReferenceLink role={source} /></span><span className="role-short">{role.short}</span><span className="role-description">{role.description}</span><button className="choose-label" onClick={() => act("chooseRole", { roleKey: role.key })}>{text("秘密选择 →", "Choose secretly →")}</button></article>; })}</div> : <div className="waiting-orbit" aria-label={text("等待其他玩家", "Waiting for another player")}><span>♛</span></div>}
  </section>;
}

function TheaterPhase({ game, act }: { game: Game; act: Act }) {
  const { language, text } = useLanguage();
  const myTurn = game.currentPickerId === game.viewerId;
  const me = game.players.find((player) => player.id === game.viewerId)!;
  const [ownRoleKey, setOwnRoleKey] = useState(me.roleKeys[0] ?? "");
  return <section className="center-stage theater-stage"><div className="eyebrow">{text("剧院 · 选角后的秘密插曲", "Theater · A secret post-draft exchange")}</div><h2>{myTurn ? text("要与谁交换角色？", "Whose character will you exchange?") : text("剧院主人正在考虑一场换角", "The Theater owner is considering an exchange")}</h2><p>{text("目标将盲选一个角色与你交换；双方交换后只能看到自己拿到的新角色。", "The target blindly exchanges one character with you. Each player sees only the character they receive.")}</p>{myTurn ? <><div className="theater-own-roles">{me.roleKeys.map((key) => <button key={key} className={ownRoleKey === key ? "selected" : ""} onClick={() => setOwnRoleKey(key)}>{text("交出", "Give")} {roleFor(game, key, language)?.name}</button>)}</div><div className="target-player-grid">{game.players.filter((player) => player.id !== me.id).map((player) => <button key={player.id} onClick={() => act("theater", { targetPlayerId: player.id, roleKey: ownRoleKey })}>{text(`与 ${player.name} 盲换`, `Blind exchange with ${player.name}`)}</button>)}</div><button className="secondary-button large" onClick={() => act("theater")}>{text("不交换，继续叫号", "Skip exchange and continue")}</button></> : <div className="waiting-orbit"><span>♜</span></div>}</section>;
}

function PendingChoicePanel({ game, me, act }: { game: Game; me: Player; act: Act }) {
  const { language, text } = useLanguage();
  const choice = game.pendingChoice;
  if (!choice) return null;
  if (choice.type === "waiting") return <div className="choice-panel waiting-choice"><strong>{text(`等待 ${choice.actorName} 完成决定`, `Waiting for ${choice.actorName} to decide`)}</strong><p>{choice.choiceType === "warrant" ? text("执法官正在处理本次建造旁的覆面拘票。决定完成前，牌桌会暂停其他操作。", "The Magistrate is resolving the face-down warrant beside this character. Other table actions pause until the decision is complete.") : text("这项秘密选择完成后，牌局会自动继续。", "The game will continue automatically after this private choice.")}</p></div>;
  if (choice.type === "blackmail") return <div className="choice-panel danger-choice"><strong>{text("你受到未揭晓的勒索", "You received a hidden blackmail threat")}</strong><p>{text("交出当前金币的一半（向下取整）可安全移除标记；拒绝则可能失去全部金币。", "Pay half your gold, rounded down, to remove the threat safely. Refuse and you may lose all your gold.")}</p><div><button onClick={() => act("blackmail", { bribe: true })}>{text(`交出 ${Math.floor(me.gold / 2)} 金币`, `Pay ${Math.floor(me.gold / 2)} gold`)}</button><button onClick={() => act("blackmail", { bribe: false })}>{text("拒绝，要求揭晓", "Refuse and reveal")}</button></div></div>;
  if (choice.type === "warrant") {
    const shown = localizedDistrict(choice.card, language);
    return <div className={`choice-panel warrant-choice ${choice.signed ? "signed" : "decoy"}`}><strong>{choice.signed ? text("你掌握的是真拘票", "This is the signed warrant") : text("这里放的是假拘票", "This warrant is a decoy")}</strong><p>{text(`${choice.builderName} 已支付建造`, `${choice.builderName} paid to build `)} <DistrictReferenceLink district={choice.card} label={shown.name} />。{choice.signed ? choice.canConfiscate ? text("你可以现在揭票，把城区免费建入自己的城市，并退还对方建造费用。", "You may reveal it now, build the district in your city for free, and refund the builder.") : text("你已有同名城区，规则禁止没收；请放行。", "You already have a district with this name, so it cannot be confiscated.") : text("假拘票不能没收城区，请放行。", "A decoy cannot confiscate the district; let the build continue.")}</p><div>{choice.signed && choice.canConfiscate && <button onClick={() => act("warrant", { reveal: true })}>{text("揭开真票并没收", "Reveal and confiscate")}</button>}<button onClick={() => act("warrant", { reveal: false })}>{text("不揭票，放行建造", "Do not reveal; allow build")}</button></div></div>;
  }
  if (choice.type === "wizard") return <div className="choice-panel"><strong>{text(`巫师正在查看 ${choice.targetName} 的手牌`, `Wizard is viewing ${choice.targetName}'s hand`)}</strong><div className="choice-card-list">{choice.cards.map((source) => { const card = localizedDistrict(source, language); return <div key={card.uid}><span><DistrictReferenceLink district={source} label={`${card.name} · ${text(`${card.cost} 金`, `${card.cost} gold`)}`} /></span><button onClick={() => act("ability", { cardUid: card.uid, mode: "take" })}>{text("加入手牌", "Take into hand")}</button><button onClick={() => act("ability", { cardUid: card.uid, mode: "build" })} disabled={me.gold < card.cost}>{text("立即建造", "Build now")}</button></div>; })}</div></div>;
  return <div className="choice-panel"><strong>{text(`先知：归还一张牌给 ${choice.targetName}`, `Seer: return one card to ${choice.targetName}`)}</strong><div className="target-roles">{me.hand.map((card) => <button key={card.uid} onClick={() => act("ability", { cardUid: card.uid })}>{localizedDistrict(card, language).name}</button>)}</div></div>;
}

function AbilityPanel({ game, me, act }: { game: Game; me: Player; act: Act }) {
  const { language, text } = useLanguage();
  const role = roleFor(game, game.currentRoleKey, language);
  const colorNames = language === "en" ? COLOR_NAMES_EN : COLOR_NAMES;
  const [targetPlayerId, setTargetPlayerId] = useState(game.players.find((player) => player.id !== me.id)?.id ?? "");
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [ownDistrictUid, setOwnDistrictUid] = useState(me.city[0]?.uid ?? "");
  const [warrantRoleKeys, setWarrantRoleKeys] = useState<string[]>([]);
  const [signedWarrantRoleKey, setSignedWarrantRoleKey] = useState("");
  const [threatRoleKeys, setThreatRoleKeys] = useState<string[]>([]);
  const [signedThreatRoleKey, setSignedThreatRoleKey] = useState("");
  if (!role) return null;
  const others = game.players.filter((player) => player.id !== me.id);
  const targetRoles = game.roles.filter((candidate) => candidate.rank > 1).map((candidate) => localizedRole(candidate, language));
  const simpleTargetRoles = targetRoles.filter((candidate) => role.key !== "thief" || candidate.key !== role.key);
  const threatTargetRoles = targetRoles.filter((candidate) => candidate.key !== role.key && candidate.key !== game.assassinatedRoleKey && candidate.key !== game.bewitchedRoleKey);
  const target = others.find((player) => player.id === targetPlayerId) ?? others[0];
  const ownDistrict = me.city.find((card) => card.uid === ownDistrictUid);
  const toggleCard = (uid: string) => setSelectedCards((current) => current.includes(uid) ? current.filter((id) => id !== uid) : [...current, uid]);
  const toggleWarrantRole = (key: string) => setWarrantRoleKeys((current) => {
    if (current.includes(key)) {
      if (signedWarrantRoleKey === key) setSignedWarrantRoleKey("");
      return current.filter((candidate) => candidate !== key);
    }
    return current.length < 3 ? [...current, key] : current;
  });
  const toggleThreatRole = (key: string) => setThreatRoleKeys((current) => {
    if (current.includes(key)) {
      if (signedThreatRoleKey === key) setSignedThreatRoleKey("");
      return current.filter((candidate) => candidate !== key);
    }
    return current.length < 2 ? [...current, key] : current;
  });

  return <div className="ability-stack">
    {INCOME_ROLES.has(role.key) && <div className="ability-panel inline"><span>{text("角色城区收入可在建造前或后取得。", "Character district income may be taken before or after building.")}</span><button onClick={() => act("roleIncome")} disabled={me.incomeTaken}>{text(`取得${role.key === "patrician" || role.key === "cardinal" ? "城区牌" : "金币"}收入`, `Take ${role.key === "patrician" || role.key === "cardinal" ? "card" : "gold"} income`)}</button></div>}
    {!game.pendingChoice && !me.abilityUsed && ["assassin", "witch", "thief"].includes(role.key) && <div className="ability-panel"><strong>{role.name}: {text("秘密点名角色", "secretly name a character")}</strong><div className="target-roles">{simpleTargetRoles.map((candidate) => <button key={candidate.key} title={`${candidate.short}\n${candidate.description}`} onClick={() => act("ability", { targetRoleKey: candidate.key })}>{candidate.rank} · {candidate.name}</button>)}</div></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "blackmailer" && <div className="ability-panel column-panel warrant-assignment"><strong>{text("勒索者：选择两个不同角色放置威胁", "Blackmailer: place threats beside two different characters")}</strong><p>{text(`已选择 ${threatRoleKeys.length}/2。不能选择勒索者自己、1 号、被刺杀或被魅惑的角色。`, `${threatRoleKeys.length}/2 selected. You cannot choose the Blackmailer, rank 1, assassinated, or bewitched characters.`)}</p><div className="target-roles">{threatTargetRoles.map((candidate) => { const selected = threatRoleKeys.includes(candidate.key); return <button key={candidate.key} className={selected ? "selected" : ""} title={`${candidate.short}\n${candidate.description}`} onClick={() => toggleThreatRole(candidate.key)} disabled={!selected && threatRoleKeys.length >= 2}>{selected ? "✓ " : ""}{candidate.rank} · {candidate.name}</button>; })}</div>{threatRoleKeys.length > 0 && <fieldset><legend>{text("指定真威胁（仅你可见）", "Choose the real threat (private)")}</legend>{threatRoleKeys.map((key) => { const candidate = threatTargetRoles.find((targetRole) => targetRole.key === key)!; return <label key={key}><input type="radio" name="signed-threat" value={key} checked={signedThreatRoleKey === key} onChange={() => setSignedThreatRoleKey(key)} />{candidate.rank} · {candidate.name}</label>; })}</fieldset>}<button className="confirm-warrants" onClick={() => act("ability", { targetRoleKey: signedThreatRoleKey, targetRoleKeys: threatRoleKeys })} disabled={threatRoleKeys.length !== 2 || !signedThreatRoleKey}>{text("秘密放置两枚威胁", "Place the two threats")}</button></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "magistrate" && <div className="ability-panel column-panel warrant-assignment"><strong>{text("执法官：选择三个不同角色放置拘票", "Magistrate: place warrants beside three different characters")}</strong><p>{text(`已选择 ${warrantRoleKeys.length}/3。所有人会看到哪些角色旁有覆面拘票，只有你知道哪张是真的。`, `${warrantRoleKeys.length}/3 selected. Everyone sees the face-down warrants; only you know which one is signed.`)}</p><div className="target-roles">{targetRoles.map((candidate) => { const selected = warrantRoleKeys.includes(candidate.key); return <button key={candidate.key} className={selected ? "selected" : ""} title={`${candidate.short}\n${candidate.description}`} onClick={() => toggleWarrantRole(candidate.key)} disabled={!selected && warrantRoleKeys.length >= 3}>{selected ? "✓ " : ""}{candidate.rank} · {candidate.name}</button>; })}</div>{warrantRoleKeys.length > 0 && <fieldset><legend>{text("指定真拘票（仅你可见）", "Choose the signed warrant (private)")}</legend>{warrantRoleKeys.map((key) => { const candidate = targetRoles.find((targetRole) => targetRole.key === key)!; return <label key={key}><input type="radio" name="signed-warrant" value={key} checked={signedWarrantRoleKey === key} onChange={() => setSignedWarrantRoleKey(key)} />{candidate.rank} · {candidate.name}</label>; })}</fieldset>}<button className="confirm-warrants" onClick={() => act("ability", { targetRoleKey: signedWarrantRoleKey, targetRoleKeys: warrantRoleKeys })} disabled={warrantRoleKeys.length !== 3 || !signedWarrantRoleKey}>{text("秘密放置三张拘票", "Place the three warrants")}</button></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "spy" && <div className="ability-panel column-panel"><strong>{text("间谍：选择玩家与城区类型", "Spy: choose a player and district type")}</strong><select value={targetPlayerId} onChange={(event) => setTargetPlayerId(event.target.value)}>{others.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select><div className="target-roles">{Object.entries(colorNames).map(([color, label]) => <button key={color} onClick={() => act("ability", { targetPlayerId: target?.id, districtColor: color })}>{label}</button>)}</div></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "magician" && <div className="ability-panel column-panel"><strong>{text("魔术师：交换整手或重抽选中的牌", "Magician: swap hands or redraw selected cards")}</strong><div className="target-roles">{others.map((player) => <button key={player.id} onClick={() => act("ability", { mode: "swap", targetPlayerId: player.id })}>{text(`与 ${player.name} 换整手`, `Swap hands with ${player.name}`)}</button>)}</div><div className="check-cards">{me.hand.map((card) => <label key={card.uid}><input type="checkbox" checked={selectedCards.includes(card.uid)} onChange={() => toggleCard(card.uid)} />{localizedDistrict(card, language).name}</label>)}</div><button onClick={() => act("ability", { mode: "redraw", cardUids: selectedCards })} disabled={!selectedCards.length}>{text("弃掉并等量重抽", "Discard and redraw")}</button></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "wizard" && <div className="ability-panel"><strong>{text("巫师：查看一名玩家手牌", "Wizard: view another player's hand")}</strong><div className="target-roles">{others.map((player) => <button key={player.id} onClick={() => act("ability", { targetPlayerId: player.id })} disabled={!player.handCount}>{text("查看", "View")} {player.name}</button>)}</div></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "seer" && <div className="ability-panel inline"><span>{text("从每名有手牌的对手处随机拿一张，再逐一归还。", "Take a random card from each opponent with cards, then return one to each.")}</span><button onClick={() => act("ability")}>{text("发动先知", "Use Seer")}</button></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "emperor" && <div className="ability-panel"><strong>{text("皇帝：必须把皇冠交给另一人", "Emperor: give the crown to another player")}</strong><div className="target-roles">{others.map((player) => <span key={player.id} className="paired-actions"><button onClick={() => act("ability", { targetPlayerId: player.id, mode: "gold" })}>{text(`给 ${player.name} · 拿金币`, `Give to ${player.name} · take gold`)}</button><button onClick={() => act("ability", { targetPlayerId: player.id, mode: "card" })}>{text("拿手牌", "Take a card")}</button></span>)}</div></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "abbot" && <div className="ability-panel"><strong>{text("修道院长：决定宗教收入中抽牌数量", "Abbot: choose how much religious income becomes cards")}</strong><div className="target-roles">{Array.from({ length: me.city.filter((district) => district.color === "blue" || district.key === "school_of_magic").length + 1 }, (_, count) => <button key={count} onClick={() => act("ability", { amountCards: count })}>{text(`${count} 张牌，其余金币`, `${count} cards; the rest gold`)}</button>)}</div></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "architect" && <div className="ability-panel inline"><span>{text("额外抽两张牌；本回合建造上限为三。", "Draw two extra cards; you may build three districts this turn.")}</span><button onClick={() => act("ability")}>{text("抽 2 张牌", "Draw 2 cards")}</button></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "navigator" && <div className="ability-panel inline"><span>{text("本回合不能建造。", "You cannot build this turn.")}</span><button onClick={() => act("ability", { mode: "gold" })}>{text("额外 4 金币", "+4 gold")}</button><button onClick={() => act("ability", { mode: "cards" })}>{text("额外 4 张牌", "+4 cards")}</button></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "scholar" && <div className="ability-panel inline"><span>{text("查看七张，保留一张；本回合最多建造两座。", "View seven cards and keep one; build up to two districts.")}</span><button onClick={() => act("ability")}>{text("查看 7 张牌", "View 7 cards")}</button></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "queen" && <div className="ability-panel inline"><span>{text("若你与本轮 4 号角色相邻，领取三金币。", "Gain three gold if seated next to this round's rank 4 character.")}</span><button onClick={() => act("ability")}>{text("检查并领取", "Check and collect")}</button></div>}
    {!game.pendingChoice && role.key === "artist" && me.abilityCount < 2 && <div className="ability-panel"><strong>{text("艺术家：支付一金币美化至多两座城区", "Artist: pay one gold to beautify up to two districts")}</strong><div className="target-roles">{me.city.filter((district) => !district.beautified).map((district) => <button key={district.uid} onClick={() => act("ability", { ownDistrictUid: district.uid })} disabled={!me.gold}>{text("美化", "Beautify")} {localizedDistrict(district, language).name}</button>)}</div></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "tax_collector" && <div className="ability-panel inline"><span>{text(`税务标记上现有 ${game.taxPool} 金币。`, `The tax pool holds ${game.taxPool} gold.`)}</span><button onClick={() => act("ability")}>{text("收税", "Collect tax")}</button></div>}
    {!game.pendingChoice && !me.abilityUsed && ["warlord", "marshal"].includes(role.key) && <div className="ability-panel column-panel"><strong>{role.name}: {text("选择目标城区", "choose a target district")}</strong><div className="destroy-list">{(role.key === "warlord" ? game.players : others).flatMap((player) => player.city.map((district) => { const shown = localizedDistrict(district, language); return <button key={district.uid} onClick={() => act("rankEight", { targetPlayerId: player.id, targetDistrictUid: district.uid })} disabled={role.key === "marshal" && district.cost + (district.beautified ? 1 : 0) > 3}>{player.id === me.id ? text("自己的", "Your ") : `${player.name} · `}{shown.name}{role.key === "warlord" ? text(`（约 ${Math.max(0, district.cost - 1)} 金）`, ` (~${Math.max(0, district.cost - 1)} gold)`) : text(`（${district.cost + (district.beautified ? 1 : 0)} 金）`, ` (${district.cost + (district.beautified ? 1 : 0)} gold)`)}</button>; }))}</div></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "diplomat" && <div className="ability-panel column-panel"><strong>{text("外交官：先选自己的城区，再选对手城区", "Diplomat: choose your district, then an opponent's")}</strong><select value={ownDistrictUid} onChange={(event) => setOwnDistrictUid(event.target.value)}>{me.city.map((district) => <option key={district.uid} value={district.uid}>{localizedDistrict(district, language).name} · {district.cost}</option>)}</select><div className="destroy-list">{others.flatMap((player) => player.city.map((district) => <button key={district.uid} onClick={() => act("rankEight", { targetPlayerId: player.id, targetDistrictUid: district.uid, ownDistrictUid })}>{ownDistrict ? localizedDistrict(ownDistrict, language).name : text("己方城区", "Your district")} ⇄ {player.name} · {localizedDistrict(district, language).name}</button>))}</div></div>}
  </div>;
}

function DistrictAbilitiesPanel({ game, me, act }: { game: Game; me: Player; act: Act }) {
  const { language, text } = useLanguage();
  const usable = me.city.filter((district) => ["laboratory", "smithy", "museum", "armory"].includes(district.key) && !me.districtAbilitiesUsed.includes(district.uid));
  if (!usable.length) return null;
  const others = game.players.filter((player) => player.id !== me.id);
  return <div className="district-ability-panel"><h3>{text("独特城区能力", "Unique district powers")}</h3>{usable.map((district) => <div key={district.uid} className="district-effect-row"><strong>{localizedDistrict(district, language).name}</strong>{district.key === "smithy" && <button onClick={() => act("districtAbility", { districtUid: district.uid })} disabled={me.gold < 2}>{text("付 2 金币抽 3 张", "Pay 2 gold, draw 3")}</button>}{["laboratory", "museum"].includes(district.key) && me.hand.map((card) => <button key={card.uid} onClick={() => act("districtAbility", { districtUid: district.uid, cardUid: card.uid })}>{district.key === "laboratory" ? text("弃", "Discard") : text("收藏", "Store")} {localizedDistrict(card, language).name}</button>)}{district.key === "armory" && others.flatMap((player) => player.city.map((target) => <button key={target.uid} onClick={() => act("districtAbility", { districtUid: district.uid, targetPlayerId: player.id, targetDistrictUid: target.uid })}>{text("摧毁", "Destroy")} {player.name} · {localizedDistrict(target, language).name}</button>))}</div>)}</div>;
}

function Turns({ game, act }: { game: Game; act: Act }) {
  const { language, text } = useLanguage();
  const me = game.players.find((player) => player.id === game.viewerId)!;
  const active = game.players.find((player) => player.id === game.currentPlayerId);
  const myTurn = game.currentPlayerId === game.viewerId;
  const role = roleFor(game, game.currentRoleKey, language);
  const maxBuilds = role?.key === "architect" ? 3 : role?.key === "seer" || role?.key === "scholar" ? 2 : 1;
  const hasQuarry = me.city.some((district) => district.key === "quarry");
  const hasFramework = me.city.find((district) => district.key === "framework");
  return <div className="turn-layout"><section className="table-area"><div className="turn-banner"><div><span>{text(`第 ${game.round} 轮 · 正在叫号 ${game.currentRank}`, `Round ${game.round} · Calling rank ${game.currentRank}`)}</span><h2>{myTurn ? text("轮到你行动", "Your turn") : text(`${active?.name ?? "玩家"} 正在行动`, `${active?.name ?? "Player"} is taking a turn`)}</h2></div>{myTurn && role && <div className={`my-role color-${role.color}`}><b>{role.rank}</b><span>{role.name}<small>{role.description}</small></span></div>}</div>
    {game.privateNotes.length > 0 && <div className="private-notes"><strong>{text("仅你可见", "Only you can see this")}</strong>{game.privateNotes.map((note, index) => <span key={index}>{translatedGameMessage(note, language)}</span>)}</div>}
    {game.pendingChoice && <PendingChoicePanel game={game} me={me} act={act} />}
    {!myTurn && <div className="spectator-message"><span>♜</span><p>{text("观察城市变化，等待你的角色被叫到。", "Watch the cities change while waiting for your character to be called.")}</p></div>}
    {myTurn && <div className="action-board"><div className="resource-actions"><div><span className="step-number">1</span><h3>{text("选择资源", "Choose resources")}</h3></div><button onClick={() => act("takeGold")} disabled={me.resourceTaken}>● {text("取金币", "Take gold")}</button><button onClick={() => act("drawCards")} disabled={me.resourceTaken}>▰ {text("抽牌", "Draw cards")}</button>{me.resourceTaken && <span className="done-mark">{text("已完成", "Done")}</span>}</div>
      <AbilityPanel game={game} me={me} act={act} /><DistrictAbilitiesPanel game={game} me={me} act={act} />
      <div className="hand-section"><div className="section-title"><div><span className="step-number">2</span><h3>{text("建造城区", "Build districts")}</h3></div><span>{text(`计入上限 ${me.buildsThisTurn}/${maxBuilds}`, `Build limit ${me.buildsThisTurn}/${maxBuilds}`)}</span></div>{me.hand.length ? <div className="card-row">{me.hand.map((district) => {
        const duplicate = me.city.some((built) => built.name === district.name) && !hasQuarry && role?.key !== "wizard";
        const freeBuild = district.key === "stables" || (role?.key === "trader" && district.color === "green");
        const atLimit = !freeBuild && me.buildsThisTurn >= maxBuilds;
        const factoryDiscount = district.color === "purple" && district.key !== "factory" && me.city.some((card) => card.key === "factory") ? 1 : 0;
        const price = Math.max(0, district.cost - factoryDiscount);
        const canSubsidize = role?.key === "cardinal" && me.hand.length - 1 >= price - me.gold;
        const canCardsPay = district.key === "thieves_den" && me.gold + me.hand.length - 1 >= price;
        const disabled = !me.resourceTaken || Boolean(game.pendingChoice) || me.pendingDraw.length > 0 || role?.key === "navigator" || duplicate || atLimit || (price > me.gold && !canSubsidize && !canCardsPay) || district.key === "secret_vault";
        const sacrifice = district.key === "necropolis" ? me.city[0] : hasFramework;
        const secondaryDisabled = !me.resourceTaken || Boolean(game.pendingChoice) || me.pendingDraw.length > 0 || role?.key === "navigator" || duplicate || atLimit || district.key === "secret_vault";
        return <DistrictCard key={district.uid} district={district} action={{ label: district.key === "secret_vault" ? text("只能留到终局", "Keep for endgame only") : duplicate ? text("已有同名", "Duplicate name") : price > me.gold && !canSubsidize && !canCardsPay ? text("金币不足", "Not enough gold") : text(`建造 · ${price} 金`, `Build · ${price} gold`), onClick: () => act("build", { cardUid: district.uid }) }} secondaryAction={sacrifice ? { label: district.key === "necropolis" ? text(`牺牲 ${localizedDistrict(sacrifice, language).name} 建造`, `Sacrifice ${localizedDistrict(sacrifice, language).name} to build`) : text("摧毁脚手架免费建造", "Destroy Framework to build free"), onClick: () => act("build", { cardUid: district.uid, mode: district.key === "necropolis" ? "necropolis" : "framework", sacrificeUid: sacrifice.uid }) } : undefined} disabled={disabled} secondaryDisabled={secondaryDisabled} />;
      })}</div> : <div className="empty-hand">{text("你暂时没有城区牌。", "You have no district cards.")}</div>}</div>
      <button className="end-turn" onClick={() => act("endTurn")} disabled={!me.resourceTaken || me.pendingDraw.length > 0 || Boolean(game.pendingChoice)}>{text("结束回合 →", "End turn →")}</button>
    </div>}
    <section className="cities-section"><div className="section-title"><h3>{text("桌上的城市", "Cities on the table")}</h3><span>{text(`达到 ${game.completionTarget} 座触发终局；纪念碑按两座`, `Reach ${game.completionTarget} districts to trigger the end; Monument counts as two`)}</span></div><div className="city-grid">{game.players.map((player) => <article className="city-panel" key={player.id}><header><strong>{player.name}</strong><span>{text(`${player.score} 当前分`, `${player.score} current points`)}</span></header><div className="mini-districts">{player.city.map((district) => <DistrictCard key={district.uid} district={district} compact />)}{!player.city.length && <span className="empty-city">{text("尚未建造", "No districts yet")}</span>}</div></article>)}</div></section>
  </section><Chronicle game={game} />
    {me.pendingDraw.length > 0 && <div className="modal-backdrop"><div className="draw-modal" role="dialog" aria-modal="true" aria-labelledby="draw-title"><div className="eyebrow">{me.pendingDrawMode === "scholar" ? text("学者翻阅七份蓝图", "Scholar examines seven plans") : text("来自牌库的道路", "Drawn from the deck")}</div><h2 id="draw-title">{text("保留一张城区牌", "Keep a district card")}</h2><div className="draw-choices many-choices">{me.pendingDraw.map((district) => <DistrictCard key={district.uid} district={district} action={{ label: text("保留这张", "Keep this card"), onClick: () => act("keepCard", { cardUid: district.uid }) }} />)}</div></div></div>}
  </div>;
}

function Finished({ game, act }: { game: Game; act: Act }) {
  const { language, text } = useLanguage();
  const highestRank = (player: Player) => Math.max(0, ...player.roleKeys.map((key) => roleFor(game, key, language)?.rank ?? 0));
  const ranking = [...game.players].sort((a, b) => b.score - a.score || highestRank(b) - highestRank(a));
  const winner = ranking[0];
  return <section className="center-stage finished-stage"><div className="victory-crown">♛</div><div className="eyebrow">{text("城市纪元落幕", "The city age is complete")}</div><h2>{text(`${winner.name} 赢得王冠`, `${winner.name} wins the crown`)}</h2><p>{text("计分包含城区费用、五色奖励、完成顺序与所有独特城区效果。", "Scoring includes district costs, type variety, completion order, and every unique district effect.")}</p><div className="ranking">{ranking.map((player, index) => <div key={player.id} className={index === 0 ? "winner" : ""}><span>{index + 1}</span><strong>{player.name}</strong><small>{text(`城区 ${player.scoreBreakdown?.base ?? 0} · 五色 ${player.scoreBreakdown?.variety ?? 0} · 完成 ${player.scoreBreakdown?.completion ?? 0} · 特效 ${player.scoreBreakdown?.unique ?? 0}`, `Districts ${player.scoreBreakdown?.base ?? 0} · Variety ${player.scoreBreakdown?.variety ?? 0} · Completion ${player.scoreBreakdown?.completion ?? 0} · Powers ${player.scoreBreakdown?.unique ?? 0}`)}</small><b>{text(`${player.score} 分`, `${player.score} pts`)}</b></div>)}</div>{game.viewerId === game.hostId && <button className="primary-button large" onClick={() => act("restart")}>{text("再来一局", "Play again")}</button>}</section>;
}

function GameTable() {
  const { language, text } = useLanguage();
  const [session, setSession] = useState<Session | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyKey] = useState(() => typeof window === "undefined" ? "" : getOrCreateHistoryKey());
  const [soundEnabled, setSoundEnabled] = useState(() => typeof window === "undefined" || window.localStorage.getItem(SOUND_KEY) !== "off");
  const [connection, setConnection] = useState<"connecting" | "online" | "offline">("connecting");
  const refreshAbortRef = useRef<AbortController | null>(null);
  const leavingRef = useRef(false);
  const previousGameRef = useRef<Pick<Game, "status" | "currentPlayerId" | "currentPickerId" | "viewerId"> | null>(null);

  useEffect(() => {
    if (!soundEnabled) return;
    const unlock = () => { const context = audioContext(); if (context) void context.resume(); };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [soundEnabled]);
  useEffect(() => {
    if (!game) { previousGameRef.current = null; return; }
    const previous = previousGameRef.current;
    if (previous) {
      if (game.status === "finished" && previous.status !== "finished") {
        playGameSound("finish", soundEnabled);
      } else if (game.status === "turns" && game.currentPlayerId === game.viewerId && previous.currentPlayerId !== game.viewerId) {
        playGameSound("turn", soundEnabled);
      } else if (game.status === "draft" && game.currentPickerId === game.viewerId && previous.currentPickerId !== game.viewerId) {
        playGameSound("turn", soundEnabled);
      }
    }
    previousGameRef.current = {
      status: game.status,
      currentPlayerId: game.currentPlayerId,
      currentPickerId: game.currentPickerId,
      viewerId: game.viewerId,
    };
  }, [game, soundEnabled]);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const invitedRoom = new URLSearchParams(window.location.search).get("room")?.toUpperCase();
    if (saved) try {
      const savedSession = JSON.parse(saved) as Session;
      if (!invitedRoom || invitedRoom === savedSession.code) {
        if (savedSession.recoveryCode) window.localStorage.setItem(LAST_RECOVERY_KEY, JSON.stringify({ code: savedSession.code, recoveryCode: savedSession.recoveryCode }));
        const timer = window.setTimeout(() => setSession(savedSession), 0);
        return () => window.clearTimeout(timer);
      }
      window.localStorage.removeItem(STORAGE_KEY);
    } catch { window.localStorage.removeItem(STORAGE_KEY); }
  }, []);
  useEffect(() => { const online = () => setConnection("connecting"); const offline = () => setConnection("offline"); window.addEventListener("online", online); window.addEventListener("offline", offline); if (!navigator.onLine) offline(); return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); }; }, []);

  const refresh = useCallback(async (quiet = false) => {
    if (!session || leavingRef.current) return;
    let reachedServer = false;
    const controller = new AbortController();
    refreshAbortRef.current = controller;
    try {
      const response = await fetch(`/api/game?code=${encodeURIComponent(session.code)}`, { cache: "no-store", signal: controller.signal, headers: { authorization: `Bearer ${session.token}`, "x-player-id": session.playerId } });
      reachedServer = true; setConnection("online");
      const data = await response.json() as { game?: Game; error?: string };
      if (leavingRef.current) return;
      if (!response.ok || !data.game) throw new Error(data.error ?? text("同步失败。", "Sync failed."));
      setGame(data.game); if (!quiet) setError("");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      if (!reachedServer) setConnection("offline");
      const message = caught instanceof Error ? translatedError(caught.message, language) : text("同步失败。", "Sync failed.");
      if (!quiet || reachedServer) setError(message);
    } finally { if (refreshAbortRef.current === controller) refreshAbortRef.current = null; }
  }, [session, language, text]);
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => { if (!session) return; const timer = window.setInterval(() => void refresh(true), 1000); return () => window.clearInterval(timer); }, [session, refresh]);

  const saveSession = useCallback((nextSession: Session) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    if (nextSession.recoveryCode) window.localStorage.setItem(LAST_RECOVERY_KEY, JSON.stringify({ code: nextSession.code, recoveryCode: nextSession.recoveryCode }));
    setSession(nextSession);
  }, []);
  function enter(nextSession: Session, nextGame: Game) { leavingRef.current = false; playGameSound("soft", soundEnabled); saveSession(nextSession); setGame(nextGame); setConnection("online"); setError(""); }
  const act = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    if (!session || busy) return; setBusy(true); setError(""); let reachedServer = false;
    const actionSounds: Partial<Record<string, SoundEffect>> = { chooseRole: "role", takeGold: "coin", drawCards: "card", keepCard: "card", build: "build", roleIncome: "coin", ability: "role", districtAbility: "build", endTurn: "soft", start: "role" };
    if (actionSounds[action]) playGameSound(actionSounds[action]!, soundEnabled);
    try {
      const response = await fetch("/api/game", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session.token}`, "x-player-id": session.playerId }, body: JSON.stringify({ action, code: session.code, historyKey: historyKey || getOrCreateHistoryKey(), ...payload }) });
      reachedServer = true; setConnection("online");
      const data = await response.json() as { game?: Game; session?: Session; error?: string };
      if (!response.ok || !data.game) throw new Error(data.error ?? text("操作失败。", "Action failed."));
      if (data.session) saveSession(data.session);
      setGame(data.game);
    }
    catch (caught) { if (!reachedServer) setConnection("offline"); setError(caught instanceof Error ? translatedError(caught.message, language) : text("操作失败。", "Action failed.")); if (reachedServer) void refresh(true); }
    finally { setBusy(false); }
  }, [session, busy, language, text, refresh, saveSession, historyKey, soundEnabled]);
  const phaseLabel = useMemo(() => game ? (language === "en" ? ({ lobby: "Lobby", draft: "Draft", theater: "Theater", turns: "Turns", finished: "Scoring" }[game.status]) : ({ lobby: "候场", draft: "选角", theater: "剧院", turns: "行动", finished: "结算" }[game.status])) : "", [game, language]);
  function hideTable() { setSession(null); setGame(null); setError(""); setConnection("connecting"); }
  async function leaveSeat() {
    if (!session || !window.confirm(text("确定退出？候场时会释放座位；游戏中会由电脑接管，你仍可用恢复码回来。", "Leave the table? In the lobby your seat is removed. During a game AI takes over, and you can still return with your recovery code."))) return;
    leavingRef.current = true;
    refreshAbortRef.current?.abort();
    setBusy(true);
    try {
      const response = await fetch("/api/game", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session.token}`, "x-player-id": session.playerId }, body: JSON.stringify({ action: "leaveRoom", code: session.code, historyKey: historyKey || getOrCreateHistoryKey() }) });
      const data = await response.json() as { left?: boolean; error?: string };
      if (!response.ok || !data.left) throw new Error(data.error ?? text("退出失败。", "Unable to leave."));
      if (session.recoveryCode) window.localStorage.setItem(LAST_RECOVERY_KEY, JSON.stringify({ code: session.code, recoveryCode: session.recoveryCode }));
      window.localStorage.removeItem(STORAGE_KEY); hideTable();
    } catch (caught) { leavingRef.current = false; setError(caught instanceof Error ? translatedError(caught.message, language) : text("退出失败。", "Unable to leave.")); }
    finally { setBusy(false); }
  }
  async function copyRecoveryCode() {
    if (!session?.recoveryCode) { await act("refreshRecovery"); return; }
    await navigator.clipboard.writeText(`${session.code} ${session.recoveryCode}`);
    setError(text("恢复码已复制；请像密码一样妥善保存。", "Recovery code copied. Store it like a password."));
  }
  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    window.localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    if (next) playGameSound("turn", true);
  }

  if (!session) return <>{rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}{historyOpen && <HistoryModal historyKey={historyKey} onClose={() => setHistoryOpen(false)} />}<Landing historyKey={historyKey} onCreated={enter} onOpenRules={() => setRulesOpen(true)} onOpenHistory={() => setHistoryOpen(true)} /></>;
  if (!game) return <main className="loading-screen"><LanguageToggle /><span>♛</span><p>{error || text("正在返回牌桌…", "Returning to the table…")}</p><button onClick={hideTable}>{text("回到首页", "Back to home")}</button></main>;
  const host = game.players.find((player) => player.id === game.hostId);
  return <main className={`game-shell ${busy ? "is-busy" : ""}`}>{rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}{historyOpen && <HistoryModal historyKey={historyKey} onClose={() => setHistoryOpen(false)} />}<header className="game-header"><button className="brand" onClick={hideTable}><span>♛</span> {text("王冠之城", "Crown City")}</button><div className="round-status"><span>{phaseLabel}</span>{game.round > 0 && text(`第 ${game.round} 轮`, `Round ${game.round}`)}</div><div className={`network-status ${connection}`}><i aria-hidden="true" />{connection === "online" ? text("在线同步", "Synced") : connection === "offline" ? text("网络中断", "Offline") : text("正在连接", "Connecting")}</div><button className="header-history" onClick={() => setHistoryOpen(true)}>♜ {text("历史", "History")}</button><button className={`header-sound ${soundEnabled ? "enabled" : "muted"}`} onClick={toggleSound} aria-pressed={soundEnabled}>{soundEnabled ? "♪ " : "× "}{text(soundEnabled ? "音效" : "静音", soundEnabled ? "Sound" : "Muted")}</button><button className="header-rules" onClick={() => setRulesOpen(true)}>{text("规则书", "Rules")}</button><LanguageToggle /><button className="header-room" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/?room=${game.code}`)}>{text(`房间 ${game.code} · 复制邀请`, `Room ${game.code} · Copy invite`)}</button><button className="header-recovery" onClick={copyRecoveryCode}>{session.recoveryCode ? text(`恢复码 ${session.recoveryCode} · 复制`, `Recovery ${session.recoveryCode} · Copy`) : text("生成恢复码", "Create recovery code")}</button><button className="header-leave" onClick={leaveSeat}>{text("退出牌局", "Leave table")}</button>{game.viewerId !== game.hostId && host && !host.isBot && !host.isOnline && <button className="header-claim" onClick={() => act("claimHost")}>{text("接任房主", "Take host")}</button>}</header><PlayerStrip game={game} act={act} />{game.status !== "lobby" && <RoundRoleTrack game={game} />}{error && <div className="toast" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}{game.status === "lobby" && <Lobby game={game} act={act} />}{game.status === "draft" && <Draft game={game} act={act} />}{game.status === "theater" && <TheaterPhase game={game} act={act} />}{game.status === "turns" && <Turns game={game} act={act} />}{game.status === "finished" && <Finished game={game} act={act} />}</main>;
}

export function GameClient() {
  const [language, setLanguageState] = useState<Language>("zh");
  useEffect(() => {
    const saved = window.localStorage.getItem(LANGUAGE_KEY);
    const preferred: Language = saved === "en" || saved === "zh" ? saved : navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    document.documentElement.lang = preferred === "en" ? "en" : "zh-CN";
    const timer = window.setTimeout(() => setLanguageState(preferred), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const setLanguage = useCallback((next: Language) => {
    window.localStorage.setItem(LANGUAGE_KEY, next);
    document.documentElement.lang = next === "en" ? "en" : "zh-CN";
    setLanguageState(next);
  }, []);
  return <LanguageContext.Provider value={{ language, setLanguage }}><GameTable /></LanguageContext.Provider>;
}
