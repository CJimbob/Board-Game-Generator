"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COLOR_NAMES,
  ROLES,
  RULESETS,
  UNIQUE_DISTRICTS,
  type DistrictColor,
  type RoleDefinition,
} from "@/lib/rules";

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
  | { type: "seer"; actorId: string; remainingPlayerIds: string[]; targetName: string };

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
  pendingChoice: PendingChoice | null;
  privateNotes: string[];
  players: Player[];
  log: string[];
  version: number;
  viewerId: string;
};

type Session = { code: string; playerId: string; token: string };
type Act = (action: string, payload?: Record<string, unknown>) => Promise<void>;

const STORAGE_KEY = "crown-city-session-v2";
const INCOME_ROLES = new Set(["king", "patrician", "bishop", "cardinal", "merchant", "trader", "warlord", "diplomat", "marshal"]);

function roleFor(game: Game, key: string | null | undefined) {
  return game.allRoles.find((role) => role.key === key) ?? ROLES.find((role) => role.key === key) ?? null;
}

function citySize(player: Player) {
  return player.city.reduce((sum, district) => sum + (district.key === "monument" ? 2 : 1), 0);
}

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop rules-backdrop" role="presentation" onMouseDown={onClose}>
      <article className="rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="rules-header">
          <div><span className="eyebrow">完整规则 · 2016 修订体系</span><h2 id="rules-title">王冠之城规则书</h2></div>
          <button className="close-rules" onClick={onClose} aria-label="关闭规则书">×</button>
        </header>

        <nav className="rules-nav" aria-label="规则章节">
          <a href="#rules-goal">目标</a><a href="#rules-round">回合</a><a href="#rules-draft">选角</a><a href="#rules-roles">角色</a><a href="#rules-districts">城区</a><a href="#rules-score">计分</a>
        </nav>

        <section id="rules-goal" className="rule-section">
          <span className="rule-index">01</span><div><h3>目标与准备</h3><p>支持 2–8 人。每人从 2 金币、4 张城区牌开始；每局选用每个编号各一名角色，并把 14 张独特城区与 54 张基础城区洗成牌库。你要用金币建造城市，在终局取得最高分。</p></div>
        </section>
        <section id="rules-round" className="rule-section">
          <span className="rule-index">02</span><div><h3>一轮怎样进行</h3><p>先秘密选角，再从小到大叫号。角色被叫到时公开身份并行动：必须选择“取 2 金币”或“抽 2 留 1”，然后可发动角色/城区能力，并按上限建造城区。相同名称的城区通常不能重复。</p><p>能力如未写明时点，可在自己回合的任意时点发动；城区能力通常可选择是否发动。页面会拦截非法目标、费用和建造上限。</p></div>
        </section>
        <section id="rules-draft" className="rule-section">
          <span className="rule-index">03</span><div><h3>不同人数的秘密选角</h3>
            <div className="rule-table-wrap"><table><thead><tr><th>人数</th><th>角色数</th><th>每人角色</th><th>明置弃牌</th><th>暗置弃牌</th></tr></thead><tbody>
              <tr><td>2</td><td>8</td><td>2</td><td>轮流额外暗弃</td><td>开局 1</td></tr>
              <tr><td>3</td><td>9</td><td>2</td><td>第一轮选完再暗弃 1</td><td>开局 1</td></tr>
              <tr><td>4</td><td>8</td><td>1</td><td>2</td><td>1</td></tr>
              <tr><td>5</td><td>8</td><td>1</td><td>1</td><td>1</td></tr>
              <tr><td>6</td><td>8</td><td>1</td><td>0</td><td>1</td></tr>
              <tr><td>7</td><td>8</td><td>1</td><td>0</td><td>1；末家二选一</td></tr>
              <tr><td>8</td><td>9</td><td>1</td><td>0</td><td>1；末家二选一</td></tr>
            </tbody></table></div>
            <p>4 号角色不能明置弃掉。3 人与 8 人必须加入 9 号角色；4–7 人可在建房时选择加入。2 人不能使用皇帝；王后只用于 5 人以上。2–3 人每轮各行动两次，但共享同一城市、金币与手牌。</p>
          </div>
        </section>
        <section id="rules-roles" className="rule-section stacked">
          <span className="rule-index">04</span><div><h3>27 名角色</h3><div className="rule-card-grid roles-reference">
            {ROLES.map((role) => <article key={role.key} className={`reference-card color-${role.color}`}><b>{role.rank}</b><h4>{role.name}</h4><p>{role.description}</p></article>)}
          </div></div>
        </section>
        <section id="rules-districts" className="rule-section stacked">
          <span className="rule-index">05</span><div><h3>城区与 30 张独特城区</h3><p>黄色贵族、蓝色宗教、绿色商业、红色军事、紫色独特。牌面费用既是建造价，也是基础分。每局规则套组只混入下列独特城区中的 14 张。</p><div className="unique-reference">
            {UNIQUE_DISTRICTS.map((district) => <article key={district.key}><span>{district.cost}</span><div><h4>{district.name}</h4><p>{district.text}</p></div></article>)}
          </div></div>
        </section>
        <section id="rules-score" className="rule-section">
          <span className="rule-index">06</span><div><h3>终局与计分</h3><p>4–8 人中，任一城市达到 7 座便触发终局；2–3 人需达到 8 座。纪念碑按两座计算。当前轮仍要完整打完。</p><ul><li>城区费用（含艺术家美化）总和；</li><li>五种类型齐全：+3；</li><li>首位完成城市：+4；其他完成者：+2；</li><li>再加独特城区的终局分。</li></ul><p>最高分获胜；同分时，以最后一轮公开过的最高编号角色判定先后。</p></div>
        </section>
        <footer className="rules-footer"><p>本规则书为便于在线游玩的中文转述。规则依据 Z-Man Games 的修订版体系；牌桌中的每项选择由服务器校验。</p><a href="https://images.zmangames.com/filer_public/82/aa/82aac2d6-2a19-4143-9690-eb16b82bd9af/citadels_deluxe_rulebook.pdf" target="_blank" rel="noreferrer">查看官方英文规则 PDF ↗</a></footer>
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
  return (
    <article className={`district-card color-${district.color} ${compact ? "compact" : ""}`}>
      <div className="district-cost" aria-label={`${district.cost} 金币`}>{district.cost + (district.beautified ? 1 : 0)}</div>
      <div className="district-type">{COLOR_NAMES[district.color]}{district.beautified ? " · 已美化" : ""}</div>
      <h4>{district.name}</h4>
      {!compact && <p>{district.text ?? "基础城区：建造费用就是它的基础终局分数。"}</p>}
      {district.storedCards?.length ? <small className="stored-count">馆藏 {district.storedCards.length} 张</small> : null}
      {action && <button className="card-action" onClick={action.onClick} disabled={disabled}>{action.label}</button>}
      {secondaryAction && <button className="card-action secondary-card-action" onClick={secondaryAction.onClick} disabled={secondaryDisabled}>{secondaryAction.label}</button>}
    </article>
  );
}

function Landing({ onCreated, onOpenRules }: { onCreated: (session: Session, game: Game) => void; onOpenRules: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [botCount, setBotCount] = useState(1);
  const [rulesetKey, setRulesetKey] = useState("first_game");
  const [includeRankNine, setIncludeRankNine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const inviteCode = new URLSearchParams(window.location.search).get("room")?.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    if (inviteCode?.length === 4) {
      const timer = window.setTimeout(() => setCode(inviteCode), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  async function submit(action: "create" | "join") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/game", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, name, code, botCount, rulesetKey, includeRankNine }) });
      const data = await response.json() as { error?: string; session?: Session; game?: Game };
      if (!response.ok || !data.session || !data.game) throw new Error(data.error ?? "暂时无法进入房间。 ");
      onCreated(data.session, data.game);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "暂时无法进入房间。 ");
    } finally { setBusy(false); }
  }

  return (
    <main className="landing-shell">
      <section className="landing-copy">
        <div className="eyebrow">完整修订规则 · 2–8 人在线</div><div className="crown-mark" aria-hidden="true">♛</div><h1>王冠之城</h1>
        <p className="hero-line">27 名角色、84 张城区牌与七套官方组合。秘密选择身份，读懂朋友的野心，建成最耀眼的城市。</p>
        <div className="rules-ribbon"><span><b>01</b> 秘密选角</span><span><b>02</b> 获取资源</span><span><b>03</b> 发动能力</span><span><b>04</b> 建造计分</span></div>
        <button className="ghost-rules-button" onClick={onOpenRules}>打开完整规则书 →</button>
      </section>
      <section className="entry-panel" aria-label="进入游戏">
        <div className="panel-heading"><span>今晚的城门已经开启</span><h2>加入牌桌</h2></div>
        <label>你的昵称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：陈船长" maxLength={16} autoComplete="nickname" /></label>
        <div className="setup-grid">
          <label>规则套组<select value={rulesetKey} onChange={(event) => setRulesetKey(event.target.value)}>{RULESETS.map((set) => <option key={set.key} value={set.key}>{set.name} · {set.tagline}</option>)}</select></label>
          <label>电脑对手<select value={botCount} onChange={(event) => setBotCount(Number(event.target.value))}>{Array.from({ length: 8 }, (_, count) => <option key={count} value={count}>{count === 0 ? "不添加" : `${count} 位${count === 1 ? "（推荐）" : ""}`}</option>)}</select></label>
        </div>
        <label className="rank-nine-toggle"><input type="checkbox" checked={includeRankNine} onChange={(event) => setIncludeRankNine(event.target.checked)} /><span>4–7 人也加入 9 号角色（3 人与 8 人会按规则自动加入）</span></label>
        <button className="primary-button create-button" onClick={() => submit("create")} disabled={busy}>创建房间</button>
        <div className="divider"><span>或者输入朋友的房间码</span></div>
        <div className="join-row"><input className="code-input" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))} placeholder="AB12" maxLength={4} aria-label="四位房间码" /><button className="secondary-button" onClick={() => submit("join")} disabled={busy}>加入房间</button></div>
        {error && <p className="form-error" role="alert">{error}</p>}<p className="fine-print">无需注册。房间会跨设备同步，刷新后仍可返回牌桌。</p>
      </section>
    </main>
  );
}

function PlayerStrip({ game }: { game: Game }) {
  return <div className="player-strip">{game.players.map((player) => {
    const active = game.currentPlayerId === player.id;
    return <article key={player.id} className={`player-chip ${active ? "active" : ""}`}><div className="avatar">{player.name.slice(0, 1)}</div><div><div className="player-name">{player.id === game.crownPlayerId && <span title="皇冠">♛</span>}{player.name}{player.isBot ? " · AI" : ""}</div><div className="player-facts"><span>● {player.gold}</span><span>▰ {player.handCount}</span><span>⌂ {citySize(player)}/{game.completionTarget}</span></div></div><div className="role-token">{player.roleKeys.length ? player.roleKeys.map((key) => { const role = roleFor(game, key); return role ? `${role.rank} · ${role.name}` : key; }).join(" / ") : "身份未公开"}</div></article>;
  })}</div>;
}

function Lobby({ game, act }: { game: Game; act: Act }) {
  const isHost = game.viewerId === game.hostId;
  const [copied, setCopied] = useState(false);
  async function shareInvite() {
    const url = `${window.location.origin}/?room=${game.code}`;
    const shareData = { title: "加入我的《王冠之城》房间", text: `房间码 ${game.code}，点击链接加入牌桌。`, url };
    if (navigator.share) await navigator.share(shareData); else await navigator.clipboard.writeText(`${shareData.text}\n${url}`);
    setCopied(true); window.setTimeout(() => setCopied(false), 1400);
  }
  return <section className="center-stage lobby-stage"><div className="eyebrow">等待其他城主 · {game.ruleset.name}</div><h2>房间 <button className="room-code" onClick={shareInvite}>{game.code}</button></h2><p>{copied ? "邀请链接已准备好" : `${game.ruleset.tagline}。发送链接，朋友输入昵称即可加入。`}</p>
    <div className="ruleset-preview"><div><span>本局角色{game.includeRankNine ? " · 含可选 9 号" : ""}</span><strong>{game.roles.map((role) => `${role.rank}.${role.name}`).join(" · ")}</strong></div><div><span>独特城区</span><strong>{game.rulesetUniqueKeys.map((key) => UNIQUE_DISTRICTS.find((district) => district.key === key)?.name).filter(Boolean).join(" · ")}</strong></div></div>
    <div className="seated-players">{game.players.map((player) => <div key={player.id} className="seat-card"><span className="seat-avatar">{player.name.slice(0, 1)}</span><strong>{player.name}</strong><small>{player.id === game.hostId ? "房主" : player.isBot ? "电脑对手" : "已就座"}</small></div>)}{Array.from({ length: Math.max(0, 8 - game.players.length) }).map((_, index) => <div key={index} className="seat-card empty"><span>＋</span><small>空座位</small></div>)}</div>
    <div className="invite-actions"><button className="secondary-button large" onClick={shareInvite}>{copied ? "邀请链接已复制" : "邀请朋友加入"}</button>{isHost ? <button className="primary-button large" onClick={() => act("start")} disabled={game.players.length < 2}>按此规则开始</button> : <div className="waiting-pulse">等待房主开始游戏…</div>}</div>
  </section>;
}

function Draft({ game, act }: { game: Game; act: Act }) {
  const myTurn = game.currentPickerId === game.viewerId;
  const me = game.players.find((player) => player.id === game.viewerId)!;
  return <section className="center-stage draft-stage"><div className="eyebrow">第 {game.round} 轮 · 秘密选角</div><h2>{myTurn ? `选择你的第 ${me.roleKeys.length + 1} 个身份` : "其他玩家正在选择身份"}</h2><p>{myTurn ? "只有你看得到当前可选角色。2–3 人每轮会各选两个角色。" : "角色会沿皇冠方向依次传递，请留在牌桌。"}</p>
    {game.faceupDiscardedRoleKeys.length > 0 && <div className="faceup-discards">本轮明置弃牌：{game.faceupDiscardedRoleKeys.map((key) => roleFor(game, key)?.name).join("、")}</div>}
    {myTurn ? <div className="role-grid">{game.roles.filter((role) => game.availableRoleKeys.includes(role.key)).map((role) => <button key={role.key} className={`role-card color-${role.color}`} onClick={() => act("chooseRole", { roleKey: role.key })}><span className="role-number">{role.rank}</span><span className="role-name">{role.name}</span><span className="role-short">{role.short}</span><span className="role-description">{role.description}</span><span className="choose-label">秘密选择 →</span></button>)}</div> : <div className="waiting-orbit" aria-label="等待其他玩家"><span>♛</span></div>}
  </section>;
}

function TheaterPhase({ game, act }: { game: Game; act: Act }) {
  const myTurn = game.currentPickerId === game.viewerId;
  const me = game.players.find((player) => player.id === game.viewerId)!;
  const [ownRoleKey, setOwnRoleKey] = useState(me.roleKeys[0] ?? "");
  return <section className="center-stage theater-stage"><div className="eyebrow">剧院 · 选角后的秘密插曲</div><h2>{myTurn ? "要与谁交换角色？" : "剧院主人正在考虑一场换角"}</h2><p>目标将盲选一个角色与你交换；双方交换后只能看到自己拿到的新角色。</p>{myTurn ? <><div className="theater-own-roles">{me.roleKeys.map((key) => <button key={key} className={ownRoleKey === key ? "selected" : ""} onClick={() => setOwnRoleKey(key)}>交出 {roleFor(game, key)?.name}</button>)}</div><div className="target-player-grid">{game.players.filter((player) => player.id !== me.id).map((player) => <button key={player.id} onClick={() => act("theater", { targetPlayerId: player.id, roleKey: ownRoleKey })}>与 {player.name} 盲换</button>)}</div><button className="secondary-button large" onClick={() => act("theater")}>不交换，继续叫号</button></> : <div className="waiting-orbit"><span>♜</span></div>}</section>;
}

function PendingChoicePanel({ game, me, act }: { game: Game; me: Player; act: Act }) {
  const choice = game.pendingChoice;
  if (!choice) return null;
  if (choice.type === "blackmail") return <div className="choice-panel danger-choice"><strong>你受到未揭晓的勒索</strong><p>交出当前金币的一半（向下取整）可安全移除标记；拒绝则可能失去全部金币。</p><div><button onClick={() => act("blackmail", { bribe: true })}>交出 {Math.floor(me.gold / 2)} 金币</button><button onClick={() => act("blackmail", { bribe: false })}>拒绝，要求揭晓</button></div></div>;
  if (choice.type === "wizard") return <div className="choice-panel"><strong>巫师正在查看 {choice.targetName} 的手牌</strong><div className="choice-card-list">{choice.cards.map((card) => <div key={card.uid}><span>{card.name} · {card.cost} 金</span><button onClick={() => act("ability", { cardUid: card.uid, mode: "take" })}>加入手牌</button><button onClick={() => act("ability", { cardUid: card.uid, mode: "build" })} disabled={me.gold < card.cost}>立即建造</button></div>)}</div></div>;
  return <div className="choice-panel"><strong>先知：归还一张牌给 {choice.targetName}</strong><div className="target-roles">{me.hand.map((card) => <button key={card.uid} onClick={() => act("ability", { cardUid: card.uid })}>{card.name}</button>)}</div></div>;
}

function AbilityPanel({ game, me, act }: { game: Game; me: Player; act: Act }) {
  const role = roleFor(game, game.currentRoleKey);
  const [targetPlayerId, setTargetPlayerId] = useState(game.players.find((player) => player.id !== me.id)?.id ?? "");
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [ownDistrictUid, setOwnDistrictUid] = useState(me.city[0]?.uid ?? "");
  if (!role) return null;
  const others = game.players.filter((player) => player.id !== me.id);
  const targetRoles = game.roles.filter((candidate) => candidate.rank > 1);
  const target = others.find((player) => player.id === targetPlayerId) ?? others[0];
  const toggleCard = (uid: string) => setSelectedCards((current) => current.includes(uid) ? current.filter((id) => id !== uid) : [...current, uid]);

  return <div className="ability-stack">
    <PendingChoicePanel game={game} me={me} act={act} />
    {INCOME_ROLES.has(role.key) && <div className="ability-panel inline"><span>角色城区收入可在建造前或后取得。</span><button onClick={() => act("roleIncome")} disabled={me.incomeTaken}>取得{role.key === "patrician" || role.key === "cardinal" ? "城区牌" : "金币"}收入</button></div>}
    {!game.pendingChoice && !me.abilityUsed && ["assassin", "witch", "magistrate", "thief", "blackmailer"].includes(role.key) && <div className="ability-panel"><strong>{role.name}：秘密点名角色</strong><div className="target-roles">{targetRoles.map((candidate) => <button key={candidate.key} onClick={() => act("ability", { targetRoleKey: candidate.key })}>{candidate.rank} · {candidate.name}</button>)}</div></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "spy" && <div className="ability-panel column-panel"><strong>间谍：选择玩家与城区类型</strong><select value={targetPlayerId} onChange={(event) => setTargetPlayerId(event.target.value)}>{others.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select><div className="target-roles">{Object.entries(COLOR_NAMES).map(([color, label]) => <button key={color} onClick={() => act("ability", { targetPlayerId: target?.id, districtColor: color })}>{label}</button>)}</div></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "magician" && <div className="ability-panel column-panel"><strong>魔术师：交换整手或重抽选中的牌</strong><div className="target-roles">{others.map((player) => <button key={player.id} onClick={() => act("ability", { mode: "swap", targetPlayerId: player.id })}>与 {player.name} 换整手</button>)}</div><div className="check-cards">{me.hand.map((card) => <label key={card.uid}><input type="checkbox" checked={selectedCards.includes(card.uid)} onChange={() => toggleCard(card.uid)} />{card.name}</label>)}</div><button onClick={() => act("ability", { mode: "redraw", cardUids: selectedCards })} disabled={!selectedCards.length}>弃掉并等量重抽</button></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "wizard" && <div className="ability-panel"><strong>巫师：查看一名玩家手牌</strong><div className="target-roles">{others.map((player) => <button key={player.id} onClick={() => act("ability", { targetPlayerId: player.id })} disabled={!player.handCount}>查看 {player.name}</button>)}</div></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "seer" && <div className="ability-panel inline"><span>从每名有手牌的对手处随机拿一张，再逐一归还。</span><button onClick={() => act("ability")}>发动先知</button></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "emperor" && <div className="ability-panel"><strong>皇帝：必须把皇冠交给另一人</strong><div className="target-roles">{others.map((player) => <span key={player.id} className="paired-actions"><button onClick={() => act("ability", { targetPlayerId: player.id, mode: "gold" })}>给 {player.name} · 拿金币</button><button onClick={() => act("ability", { targetPlayerId: player.id, mode: "card" })}>拿手牌</button></span>)}</div></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "abbot" && <div className="ability-panel"><strong>修道院长：决定宗教收入中抽牌数量</strong><div className="target-roles">{Array.from({ length: me.city.filter((district) => district.color === "blue" || district.key === "school_of_magic").length + 1 }, (_, count) => <button key={count} onClick={() => act("ability", { amountCards: count })}>{count} 张牌，其余金币</button>)}</div></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "architect" && <div className="ability-panel inline"><span>额外抽两张牌；本回合建造上限为三。</span><button onClick={() => act("ability")}>抽 2 张牌</button></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "navigator" && <div className="ability-panel inline"><span>本回合不能建造。</span><button onClick={() => act("ability", { mode: "gold" })}>额外 4 金币</button><button onClick={() => act("ability", { mode: "cards" })}>额外 4 张牌</button></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "scholar" && <div className="ability-panel inline"><span>查看七张，保留一张；本回合最多建造两座。</span><button onClick={() => act("ability")}>查看 7 张牌</button></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "queen" && <div className="ability-panel inline"><span>若你与本轮 4 号角色相邻，领取三金币。</span><button onClick={() => act("ability")}>检查并领取</button></div>}
    {!game.pendingChoice && role.key === "artist" && me.abilityCount < 2 && <div className="ability-panel"><strong>艺术家：支付一金币美化至多两座城区</strong><div className="target-roles">{me.city.filter((district) => !district.beautified).map((district) => <button key={district.uid} onClick={() => act("ability", { ownDistrictUid: district.uid })} disabled={!me.gold}>美化 {district.name}</button>)}</div></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "tax_collector" && <div className="ability-panel inline"><span>税务标记上现有 {game.taxPool} 金币。</span><button onClick={() => act("ability")}>收税</button></div>}
    {!game.pendingChoice && !me.abilityUsed && ["warlord", "marshal"].includes(role.key) && <div className="ability-panel column-panel"><strong>{role.name}：选择目标城区</strong><div className="destroy-list">{(role.key === "warlord" ? game.players : others).flatMap((player) => player.city.map((district) => <button key={district.uid} onClick={() => act("rankEight", { targetPlayerId: player.id, targetDistrictUid: district.uid })} disabled={role.key === "marshal" && district.cost + (district.beautified ? 1 : 0) > 3}>{player.id === me.id ? "自己的" : `${player.name} · `}{district.name}{role.key === "warlord" ? `（约 ${Math.max(0, district.cost - 1)} 金）` : `（${district.cost + (district.beautified ? 1 : 0)} 金）`}</button>))}</div></div>}
    {!game.pendingChoice && !me.abilityUsed && role.key === "diplomat" && <div className="ability-panel column-panel"><strong>外交官：先选自己的城区，再选对手城区</strong><select value={ownDistrictUid} onChange={(event) => setOwnDistrictUid(event.target.value)}>{me.city.map((district) => <option key={district.uid} value={district.uid}>{district.name} · {district.cost}</option>)}</select><div className="destroy-list">{others.flatMap((player) => player.city.map((district) => <button key={district.uid} onClick={() => act("rankEight", { targetPlayerId: player.id, targetDistrictUid: district.uid, ownDistrictUid })}>{me.city.find((card) => card.uid === ownDistrictUid)?.name ?? "己方城区"} ⇄ {player.name}的{district.name}</button>))}</div></div>}
  </div>;
}

function DistrictAbilitiesPanel({ game, me, act }: { game: Game; me: Player; act: Act }) {
  const usable = me.city.filter((district) => ["laboratory", "smithy", "museum", "armory"].includes(district.key) && !me.districtAbilitiesUsed.includes(district.uid));
  if (!usable.length) return null;
  const others = game.players.filter((player) => player.id !== me.id);
  return <div className="district-ability-panel"><h3>独特城区能力</h3>{usable.map((district) => <div key={district.uid} className="district-effect-row"><strong>{district.name}</strong>{district.key === "smithy" && <button onClick={() => act("districtAbility", { districtUid: district.uid })} disabled={me.gold < 2}>付 2 金币抽 3 张</button>}{["laboratory", "museum"].includes(district.key) && me.hand.map((card) => <button key={card.uid} onClick={() => act("districtAbility", { districtUid: district.uid, cardUid: card.uid })}>{district.key === "laboratory" ? "弃" : "收藏"} {card.name}</button>)}{district.key === "armory" && others.flatMap((player) => player.city.map((target) => <button key={target.uid} onClick={() => act("districtAbility", { districtUid: district.uid, targetPlayerId: player.id, targetDistrictUid: target.uid })}>摧毁 {player.name}的{target.name}</button>))}</div>)}</div>;
}

function Turns({ game, act }: { game: Game; act: Act }) {
  const me = game.players.find((player) => player.id === game.viewerId)!;
  const active = game.players.find((player) => player.id === game.currentPlayerId);
  const myTurn = game.currentPlayerId === game.viewerId;
  const role = roleFor(game, game.currentRoleKey);
  const maxBuilds = role?.key === "architect" ? 3 : role?.key === "seer" || role?.key === "scholar" ? 2 : 1;
  const hasQuarry = me.city.some((district) => district.key === "quarry");
  const hasFramework = me.city.find((district) => district.key === "framework");
  return <div className="turn-layout"><section className="table-area"><div className="turn-banner"><div><span>第 {game.round} 轮 · 正在叫号 {game.currentRank}</span><h2>{myTurn ? "轮到你行动" : `${active?.name ?? "玩家"} 正在行动`}</h2></div>{myTurn && role && <div className={`my-role color-${role.color}`}><b>{role.rank}</b><span>{role.name}<small>{role.description}</small></span></div>}</div>
    {game.privateNotes.length > 0 && <div className="private-notes"><strong>仅你可见</strong>{game.privateNotes.map((note, index) => <span key={index}>{note}</span>)}</div>}
    {!myTurn && <div className="spectator-message"><span>♜</span><p>观察城市变化，等待你的角色被叫到。</p></div>}
    {myTurn && <div className="action-board"><div className="resource-actions"><div><span className="step-number">1</span><h3>选择资源</h3></div><button onClick={() => act("takeGold")} disabled={me.resourceTaken}>● 取金币</button><button onClick={() => act("drawCards")} disabled={me.resourceTaken}>▰ 抽牌</button>{me.resourceTaken && <span className="done-mark">已完成</span>}</div>
      <AbilityPanel game={game} me={me} act={act} /><DistrictAbilitiesPanel game={game} me={me} act={act} />
      <div className="hand-section"><div className="section-title"><div><span className="step-number">2</span><h3>建造城区</h3></div><span>计入上限 {me.buildsThisTurn}/{maxBuilds}</span></div>{me.hand.length ? <div className="card-row">{me.hand.map((district) => {
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
        return <DistrictCard key={district.uid} district={district} action={{ label: district.key === "secret_vault" ? "只能留到终局" : duplicate ? "已有同名" : price > me.gold && !canSubsidize && !canCardsPay ? "金币不足" : `建造 · ${price} 金`, onClick: () => act("build", { cardUid: district.uid }) }} secondaryAction={sacrifice ? { label: district.key === "necropolis" ? `牺牲 ${sacrifice.name} 建造` : "摧毁脚手架免费建造", onClick: () => act("build", { cardUid: district.uid, mode: district.key === "necropolis" ? "necropolis" : "framework", sacrificeUid: sacrifice.uid }) } : undefined} disabled={disabled} secondaryDisabled={secondaryDisabled} />;
      })}</div> : <div className="empty-hand">你暂时没有城区牌。</div>}</div>
      <button className="end-turn" onClick={() => act("endTurn")} disabled={!me.resourceTaken || me.pendingDraw.length > 0 || Boolean(game.pendingChoice)}>结束回合 →</button>
    </div>}
    <section className="cities-section"><div className="section-title"><h3>桌上的城市</h3><span>达到 {game.completionTarget} 座触发终局；纪念碑按两座</span></div><div className="city-grid">{game.players.map((player) => <article className="city-panel" key={player.id}><header><strong>{player.name}</strong><span>{player.score} 当前分</span></header><div className="mini-districts">{player.city.map((district) => <DistrictCard key={district.uid} district={district} compact />)}{!player.city.length && <span className="empty-city">尚未建造</span>}</div></article>)}</div></section>
  </section><aside className="chronicle"><div className="chronicle-heading"><span>◆</span><h3>王城纪事</h3></div><ol>{[...game.log].reverse().map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}</ol></aside>
    {me.pendingDraw.length > 0 && <div className="modal-backdrop"><div className="draw-modal" role="dialog" aria-modal="true" aria-labelledby="draw-title"><div className="eyebrow">{me.pendingDrawMode === "scholar" ? "学者翻阅七份蓝图" : "来自牌库的道路"}</div><h2 id="draw-title">保留一张城区牌</h2><div className="draw-choices many-choices">{me.pendingDraw.map((district) => <DistrictCard key={district.uid} district={district} action={{ label: "保留这张", onClick: () => act("keepCard", { cardUid: district.uid }) }} />)}</div></div></div>}
  </div>;
}

function Finished({ game, act }: { game: Game; act: Act }) {
  const highestRank = (player: Player) => Math.max(0, ...player.roleKeys.map((key) => roleFor(game, key)?.rank ?? 0));
  const ranking = [...game.players].sort((a, b) => b.score - a.score || highestRank(b) - highestRank(a));
  const winner = ranking[0];
  return <section className="center-stage finished-stage"><div className="victory-crown">♛</div><div className="eyebrow">城市纪元落幕</div><h2>{winner.name} 赢得王冠</h2><p>计分包含城区费用、五色奖励、完成顺序与所有独特城区效果。</p><div className="ranking">{ranking.map((player, index) => <div key={player.id} className={index === 0 ? "winner" : ""}><span>{index + 1}</span><strong>{player.name}</strong><small>城区 {player.scoreBreakdown?.base ?? 0} · 五色 {player.scoreBreakdown?.variety ?? 0} · 完成 {player.scoreBreakdown?.completion ?? 0} · 特效 {player.scoreBreakdown?.unique ?? 0}</small><b>{player.score} 分</b></div>)}</div>{game.viewerId === game.hostId && <button className="primary-button large" onClick={() => act("restart")}>再来一局</button>}</section>;
}

export function GameClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [connection, setConnection] = useState<"connecting" | "online" | "offline">("connecting");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const invitedRoom = new URLSearchParams(window.location.search).get("room")?.toUpperCase();
    if (saved) try {
      const savedSession = JSON.parse(saved) as Session;
      if (!invitedRoom || invitedRoom === savedSession.code) {
        const timer = window.setTimeout(() => setSession(savedSession), 0);
        return () => window.clearTimeout(timer);
      }
      window.localStorage.removeItem(STORAGE_KEY);
    } catch { window.localStorage.removeItem(STORAGE_KEY); }
  }, []);
  useEffect(() => { const online = () => setConnection("connecting"); const offline = () => setConnection("offline"); window.addEventListener("online", online); window.addEventListener("offline", offline); if (!navigator.onLine) offline(); return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); }; }, []);

  const refresh = useCallback(async (quiet = false) => {
    if (!session) return;
    let reachedServer = false;
    try { const response = await fetch(`/api/game?${new URLSearchParams(session)}`, { cache: "no-store" }); reachedServer = true; setConnection("online"); const data = await response.json() as { game?: Game; error?: string }; if (!response.ok || !data.game) throw new Error(data.error ?? "同步失败。 "); setGame(data.game); if (!quiet) setError(""); }
    catch (caught) { if (!reachedServer) setConnection("offline"); if (!quiet) setError(caught instanceof Error ? caught.message : "同步失败。 "); }
  }, [session]);
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => { if (!session) return; const timer = window.setInterval(() => void refresh(true), 1000); return () => window.clearInterval(timer); }, [session, refresh]);

  function enter(nextSession: Session, nextGame: Game) { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession)); setSession(nextSession); setGame(nextGame); setConnection("online"); setError(""); }
  const act = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    if (!session || busy) return; setBusy(true); setError(""); let reachedServer = false;
    try { const response = await fetch("/api/game", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...session, ...payload }) }); reachedServer = true; setConnection("online"); const data = await response.json() as { game?: Game; error?: string }; if (!response.ok || !data.game) throw new Error(data.error ?? "操作失败。 "); setGame(data.game); }
    catch (caught) { if (!reachedServer) setConnection("offline"); setError(caught instanceof Error ? caught.message : "操作失败。 "); }
    finally { setBusy(false); }
  }, [session, busy]);
  const phaseLabel = useMemo(() => game ? ({ lobby: "候场", draft: "选角", theater: "剧院", turns: "行动", finished: "结算" }[game.status]) : "", [game]);
  function leave() { window.localStorage.removeItem(STORAGE_KEY); setSession(null); setGame(null); setError(""); setConnection("connecting"); }

  if (!session) return <>{rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}<Landing onCreated={enter} onOpenRules={() => setRulesOpen(true)} /></>;
  if (!game) return <main className="loading-screen"><span>♛</span><p>{error || "正在返回牌桌…"}</p><button onClick={leave}>回到首页</button></main>;
  return <main className={`game-shell ${busy ? "is-busy" : ""}`}>{rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}<header className="game-header"><a className="brand" href="#" onClick={(event) => { event.preventDefault(); leave(); }}><span>♛</span> 王冠之城</a><div className="round-status"><span>{phaseLabel}</span>{game.round > 0 && `第 ${game.round} 轮`}</div><div className={`network-status ${connection}`}><i aria-hidden="true" />{connection === "online" ? "在线同步" : connection === "offline" ? "网络中断" : "正在连接"}</div><button className="header-rules" onClick={() => setRulesOpen(true)}>规则书</button><button className="header-room" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/?room=${game.code}`)}>房间 {game.code} · 复制邀请</button></header><PlayerStrip game={game} />{error && <div className="toast" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}{game.status === "lobby" && <Lobby game={game} act={act} />}{game.status === "draft" && <Draft game={game} act={act} />}{game.status === "theater" && <TheaterPhase game={game} act={act} />}{game.status === "turns" && <Turns game={game} act={act} />}{game.status === "finished" && <Finished game={game} act={act} />}</main>;
}
