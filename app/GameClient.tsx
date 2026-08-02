"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Color = "yellow" | "blue" | "green" | "red" | "purple";
type District = {
  uid: string;
  name: string;
  color: Color;
  cost: number;
  text?: string;
};
type Role = {
  id: number;
  name: string;
  short: string;
  color: Color | "neutral";
  description: string;
};
type Player = {
  id: string;
  name: string;
  isBot: boolean;
  gold: number;
  handCount: number;
  hand: District[];
  city: District[];
  roleId: number | null;
  revealed: boolean;
  resourceTaken: boolean;
  pendingDraw: District[];
  buildsThisTurn: number;
  abilityUsed: boolean;
  score: number;
};
type Game = {
  code: string;
  status: "lobby" | "draft" | "turns" | "finished";
  round: number;
  hostId: string;
  crownPlayerId: string;
  currentPickerId: string | null;
  currentPlayerId: string | null;
  currentRole: number | null;
  firstCompletedPlayerId: string | null;
  availableRoleIds: number[];
  roles: Role[];
  players: Player[];
  log: string[];
  version: number;
  viewerId: string;
};
type Session = { code: string; playerId: string; token: string };

const STORAGE_KEY = "crown-city-session-v1";
const COLOR_NAMES: Record<Color, string> = {
  yellow: "贵族",
  blue: "宗教",
  green: "商业",
  red: "军事",
  purple: "奇观",
};

function roleFor(game: Game, id: number | null) {
  return game.roles.find((role) => role.id === id) ?? null;
}

function DistrictCard({
  district,
  action,
  disabled,
  compact = false,
}: {
  district: District;
  action?: { label: string; onClick: () => void };
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <article className={`district-card color-${district.color} ${compact ? "compact" : ""}`}>
      <div className="district-cost" aria-label={`${district.cost} 金币`}>
        {district.cost}
      </div>
      <div className="district-type">{COLOR_NAMES[district.color]}</div>
      <h4>{district.name}</h4>
      {!compact && <p>{district.text ?? "一座可靠的城区，会在终局带来同等于费用的分数。"}</p>}
      {action && (
        <button className="card-action" onClick={action.onClick} disabled={disabled}>
          {action.label}
        </button>
      )}
    </article>
  );
}

function Landing({
  onCreated,
}: {
  onCreated: (session: Session, game: Game) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [botCount, setBotCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const inviteCode = new URLSearchParams(window.location.search)
      .get("room")
      ?.toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4);
    if (inviteCode?.length === 4) setCode(inviteCode);
  }, []);

  async function submit(action: "create" | "join") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/game", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, name, code, botCount }),
      });
      const data = (await response.json()) as {
        error?: string;
        session?: Session;
        game?: Game;
      };
      if (!response.ok || !data.session || !data.game) {
        throw new Error(data.error ?? "暂时无法进入房间。 ");
      }
      onCreated(data.session, data.game);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "暂时无法进入房间。 ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="landing-shell">
      <section className="landing-copy">
        <div className="eyebrow">线上秘密选角 · 2–6 人</div>
        <div className="crown-mark" aria-hidden="true">♛</div>
        <h1>王冠之城</h1>
        <p className="hero-line">选择身份，积攒金币，抢在朋友之前建成最耀眼的城市。</p>
        <div className="rules-ribbon">
          <span><b>01</b> 秘密选角</span>
          <span><b>02</b> 获取资源</span>
          <span><b>03</b> 建造城区</span>
        </div>
      </section>

      <section className="entry-panel" aria-label="进入游戏">
        <div className="panel-heading">
          <span>今晚的城门已经开启</span>
          <h2>加入牌桌</h2>
        </div>
        <label>
          你的昵称
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：陈船长"
            maxLength={16}
            autoComplete="nickname"
          />
        </label>
        <div className="create-row">
          <label>
            电脑对手
            <select value={botCount} onChange={(event) => setBotCount(Number(event.target.value))}>
              <option value={0}>不添加</option>
              <option value={1}>1 位（推荐）</option>
              <option value={2}>2 位</option>
              <option value={3}>3 位</option>
            </select>
          </label>
          <button className="primary-button" onClick={() => submit("create")} disabled={busy}>
            创建房间
          </button>
        </div>
        <div className="divider"><span>或者输入朋友的房间码</span></div>
        <div className="join-row">
          <input
            className="code-input"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
            placeholder="AB12"
            maxLength={4}
            aria-label="四位房间码"
          />
          <button className="secondary-button" onClick={() => submit("join")} disabled={busy}>
            加入房间
          </button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="fine-print">不用注册。房间状态会自动同步，刷新页面也能回来。</p>
      </section>
    </main>
  );
}

function PlayerStrip({ game }: { game: Game }) {
  return (
    <div className="player-strip">
      {game.players.map((player) => {
        const role = roleFor(game, player.roleId);
        const active = game.currentPlayerId === player.id;
        return (
          <article key={player.id} className={`player-chip ${active ? "active" : ""}`}>
            <div className="avatar">{player.name.slice(0, 1)}</div>
            <div>
              <div className="player-name">
                {player.id === game.crownPlayerId && <span title="皇冠">♛</span>}
                {player.name}{player.isBot ? " · AI" : ""}
              </div>
              <div className="player-facts">
                <span>● {player.gold}</span>
                <span>▰ {player.handCount}</span>
                <span>⌂ {player.city.length}/7</span>
              </div>
            </div>
            <div className={`role-token ${role ? `color-${role.color}` : ""}`}>
              {role ? `${role.id} · ${role.name}` : "身份未公开"}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Lobby({
  game,
  act,
}: {
  game: Game;
  act: (action: string, payload?: object) => Promise<void>;
}) {
  const isHost = game.viewerId === game.hostId;
  const [copied, setCopied] = useState(false);
  async function shareInvite() {
    const url = `${window.location.origin}/?room=${game.code}`;
    const shareData = {
      title: "加入我的《王冠之城》房间",
      text: `房间码 ${game.code}，点击链接加入牌桌。`,
      url,
    };
    if (navigator.share) await navigator.share(shareData);
    else await navigator.clipboard.writeText(`${shareData.text}\n${url}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }
  return (
    <section className="center-stage lobby-stage">
      <div className="eyebrow">等待其他城主</div>
      <h2>房间 <button className="room-code" onClick={shareInvite}>{game.code}</button></h2>
      <p>{copied ? "邀请链接已准备好" : "发送邀请链接，朋友打开后只需输入昵称即可加入。"}</p>
      <div className="seated-players">
        {game.players.map((player) => (
          <div key={player.id} className="seat-card">
            <span className="seat-avatar">{player.name.slice(0, 1)}</span>
            <strong>{player.name}</strong>
            <small>{player.id === game.hostId ? "房主" : player.isBot ? "电脑对手" : "已就座"}</small>
          </div>
        ))}
        {Array.from({ length: Math.max(0, 6 - game.players.length) }).map((_, index) => (
          <div key={index} className="seat-card empty"><span>＋</span><small>空座位</small></div>
        ))}
      </div>
      <div className="invite-actions">
        <button className="secondary-button large" onClick={shareInvite}>
          {copied ? "邀请链接已复制" : "邀请朋友加入"}
        </button>
        {isHost ? (
          <button className="primary-button large" onClick={() => act("start")} disabled={game.players.length < 2}>
            开始游戏
          </button>
        ) : (
          <div className="waiting-pulse">等待房主开始游戏…</div>
        )}
      </div>
    </section>
  );
}

function Draft({ game, act }: { game: Game; act: (action: string, payload?: object) => Promise<void> }) {
  const myTurn = game.currentPickerId === game.viewerId;
  return (
    <section className="center-stage draft-stage">
      <div className="eyebrow">第 {game.round} 轮 · 秘密选角</div>
      <h2>{myTurn ? "选择你今晚的身份" : "其他玩家正在选择身份"}</h2>
      <p>{myTurn ? "只有你能看见可选角色。选定后，本轮不能更换。" : "不要离开牌桌，很快就会轮到你。"}</p>
      {myTurn ? (
        <div className="role-grid">
          {game.roles
            .filter((role) => game.availableRoleIds.includes(role.id))
            .map((role) => (
              <button key={role.id} className={`role-card color-${role.color}`} onClick={() => act("chooseRole", { roleId: role.id })}>
                <span className="role-number">{role.id}</span>
                <span className="role-name">{role.name}</span>
                <span className="role-short">{role.short}</span>
                <span className="role-description">{role.description}</span>
                <span className="choose-label">选择此角色 →</span>
              </button>
            ))}
        </div>
      ) : (
        <div className="waiting-orbit" aria-label="等待其他玩家"><span>♛</span></div>
      )}
    </section>
  );
}

function AbilityPanel({ game, me, act }: { game: Game; me: Player; act: (action: string, payload?: object) => Promise<void> }) {
  if (me.abilityUsed || !me.roleId) return null;
  if (me.roleId === 1 || me.roleId === 2) {
    const minimum = me.roleId === 1 ? 2 : 3;
    return (
      <div className="ability-panel">
        <strong>{me.roleId === 1 ? "刺客：点名角色" : "盗贼：选择目标"}</strong>
        <div className="target-roles">
          {game.roles.filter((role) => role.id >= minimum).map((role) => (
            <button key={role.id} onClick={() => act("ability", { targetRole: role.id })}>
              {role.id} · {role.name}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (me.roleId === 3) {
    return (
      <div className="ability-panel inline">
        <span>对当前手牌不满意？</span>
        <button onClick={() => act("ability")} disabled={me.hand.length === 0}>发动魔术</button>
      </div>
    );
  }
  if (me.roleId === 8) {
    const targets = game.players.filter((player) => player.id !== me.id && player.city.length < 7);
    return (
      <div className="ability-panel warlord-panel">
        <strong>军阀：摧毁一座城区（支付费用 −1）</strong>
        <div className="destroy-list">
          {targets.flatMap((player) => player.city.map((district) => (
            <button
              key={district.uid}
              onClick={() => act("destroy", { targetPlayerId: player.id, districtUid: district.uid })}
              disabled={me.gold < Math.max(0, district.cost - 1) || player.roleId === 5}
            >
              {player.name} · {district.name}（{Math.max(0, district.cost - 1)} 金）
            </button>
          )))}
          {targets.every((player) => player.city.length === 0) && <span>目前没有可以破坏的城区。</span>}
        </div>
      </div>
    );
  }
  return null;
}

function Turns({ game, act }: { game: Game; act: (action: string, payload?: object) => Promise<void> }) {
  const me = game.players.find((player) => player.id === game.viewerId)!;
  const active = game.players.find((player) => player.id === game.currentPlayerId);
  const myTurn = game.currentPlayerId === game.viewerId;
  const myRole = roleFor(game, me.roleId);
  const maxBuilds = me.roleId === 7 ? 3 : 1;
  return (
    <div className="turn-layout">
      <section className="table-area">
        <div className="turn-banner">
          <div>
            <span>第 {game.round} 轮 · 正在叫号 {game.currentRole}</span>
            <h2>{myTurn ? "轮到你行动" : `${active?.name ?? "玩家"} 正在行动`}</h2>
          </div>
          {myRole && <div className={`my-role color-${myRole.color}`}><b>{myRole.id}</b><span>{myRole.name}<small>{myRole.description}</small></span></div>}
        </div>

        {!myTurn && <div className="spectator-message"><span>♜</span><p>观察城市变化，等待你的角色被叫到。</p></div>}

        {myTurn && (
          <div className="action-board">
            <div className="resource-actions">
              <div><span className="step-number">1</span><h3>选择资源</h3></div>
              <button onClick={() => act("takeGold")} disabled={me.resourceTaken}>● 取 2 金币</button>
              <button onClick={() => act("drawCards")} disabled={me.resourceTaken}>▰ 抽 2 留 1</button>
              {me.resourceTaken && <span className="done-mark">已完成</span>}
            </div>

            <AbilityPanel game={game} me={me} act={act} />

            <div className="hand-section">
              <div className="section-title">
                <div><span className="step-number">2</span><h3>建造城区</h3></div>
                <span>本回合 {me.buildsThisTurn}/{maxBuilds}</span>
              </div>
              {me.hand.length ? (
                <div className="card-row">
                  {me.hand.map((district) => {
                    const duplicate = me.city.some((built) => built.name === district.name);
                    const disabled = !me.resourceTaken || me.pendingDraw.length > 0 || district.cost > me.gold || duplicate || me.buildsThisTurn >= maxBuilds;
                    return (
                      <DistrictCard
                        key={district.uid}
                        district={district}
                        action={{ label: duplicate ? "已有同名" : district.cost > me.gold ? "金币不足" : "建造", onClick: () => act("build", { cardUid: district.uid }) }}
                        disabled={disabled}
                      />
                    );
                  })}
                </div>
              ) : <div className="empty-hand">你暂时没有城区牌。</div>}
            </div>

            <button className="end-turn" onClick={() => act("endTurn")} disabled={!me.resourceTaken || me.pendingDraw.length > 0}>
              结束回合 →
            </button>
          </div>
        )}

        <section className="cities-section">
          <div className="section-title"><h3>桌上的城市</h3><span>率先建成 7 座城区会触发终局</span></div>
          <div className="city-grid">
            {game.players.map((player) => (
              <article className="city-panel" key={player.id}>
                <header><strong>{player.name}</strong><span>{player.score} 分</span></header>
                <div className="mini-districts">
                  {player.city.map((district) => <DistrictCard key={district.uid} district={district} compact />)}
                  {player.city.length === 0 && <span className="empty-city">尚未建造</span>}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <aside className="chronicle">
        <div className="chronicle-heading"><span>◆</span><h3>王城纪事</h3></div>
        <ol>{[...game.log].reverse().map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}</ol>
      </aside>

      {me.pendingDraw.length > 0 && (
        <div className="modal-backdrop">
          <div className="draw-modal" role="dialog" aria-modal="true" aria-labelledby="draw-title">
            <div className="eyebrow">来自牌库的两条道路</div>
            <h2 id="draw-title">保留一张城区牌</h2>
            <div className="draw-choices">
              {me.pendingDraw.map((district) => (
                <DistrictCard key={district.uid} district={district} action={{ label: "保留这张", onClick: () => act("keepCard", { cardUid: district.uid }) }} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Finished({ game, act }: { game: Game; act: (action: string) => Promise<void> }) {
  const ranking = [...game.players].sort((a, b) => b.score - a.score);
  const winner = ranking[0];
  return (
    <section className="center-stage finished-stage">
      <div className="victory-crown">♛</div>
      <div className="eyebrow">城市纪元落幕</div>
      <h2>{winner.name} 赢得王冠</h2>
      <p>每座城区获得等同于费用的分数；集齐五种颜色加 3 分，首先完成城市再加 4 分。</p>
      <div className="ranking">
        {ranking.map((player, index) => (
          <div key={player.id} className={index === 0 ? "winner" : ""}>
            <span>{index + 1}</span><strong>{player.name}</strong><small>{player.city.length} 座城区</small><b>{player.score} 分</b>
          </div>
        ))}
      </div>
      {game.viewerId === game.hostId && <button className="primary-button large" onClick={() => act("restart")}>再来一局</button>}
    </section>
  );
}

export function GameClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<"connecting" | "online" | "offline">("connecting");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const invitedRoom = new URLSearchParams(window.location.search)
      .get("room")
      ?.toUpperCase();
    if (saved) {
      try {
        const savedSession = JSON.parse(saved) as Session;
        if (!invitedRoom || invitedRoom === savedSession.code) setSession(savedSession);
        else window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    const markOnline = () => setConnection("connecting");
    const markOffline = () => setConnection("offline");
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    if (!navigator.onLine) markOffline();
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  const refresh = useCallback(async (quiet = false) => {
    if (!session) return;
    let reachedServer = false;
    try {
      const query = new URLSearchParams(session);
      const response = await fetch(`/api/game?${query}`, { cache: "no-store" });
      reachedServer = true;
      setConnection("online");
      const data = (await response.json()) as { game?: Game; error?: string };
      if (!response.ok || !data.game) throw new Error(data.error ?? "同步失败。 ");
      setGame(data.game);
      if (!quiet) setError("");
    } catch (caught) {
      if (!reachedServer) setConnection("offline");
      if (!quiet) setError(caught instanceof Error ? caught.message : "同步失败。 ");
    }
  }, [session]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => void refresh(true), 1100);
    return () => window.clearInterval(timer);
  }, [session, refresh]);

  function enter(nextSession: Session, nextGame: Game) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
    setGame(nextGame);
    setConnection("online");
    setError("");
  }

  const act = useCallback(async (action: string, payload: object = {}) => {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    let reachedServer = false;
    try {
      const response = await fetch("/api/game", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...session, ...payload }),
      });
      reachedServer = true;
      setConnection("online");
      const data = (await response.json()) as { game?: Game; error?: string };
      if (!response.ok || !data.game) throw new Error(data.error ?? "操作失败。 ");
      setGame(data.game);
    } catch (caught) {
      if (!reachedServer) setConnection("offline");
      setError(caught instanceof Error ? caught.message : "操作失败。 ");
    } finally {
      setBusy(false);
    }
  }, [session, busy]);

  const phaseLabel = useMemo(() => {
    if (!game) return "";
    return { lobby: "候场", draft: "选角", turns: "行动", finished: "结算" }[game.status];
  }, [game]);

  function leave() {
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setGame(null);
    setError("");
    setConnection("connecting");
  }

  if (!session) return <Landing onCreated={enter} />;
  if (!game) return <main className="loading-screen"><span>♛</span><p>{error || "正在返回牌桌…"}</p><button onClick={leave}>回到首页</button></main>;

  return (
    <main className={`game-shell ${busy ? "is-busy" : ""}`}>
      <header className="game-header">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); leave(); }}><span>♛</span> 王冠之城</a>
        <div className="round-status"><span>{phaseLabel}</span>{game.round > 0 && `第 ${game.round} 轮`}</div>
        <div className={`network-status ${connection}`}>
          <i aria-hidden="true" />
          {connection === "online" ? "在线同步" : connection === "offline" ? "网络中断" : "正在连接"}
        </div>
        <button
          className="header-room"
          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/?room=${game.code}`)}
        >
          房间 {game.code} · 复制邀请
        </button>
      </header>
      <PlayerStrip game={game} />
      {error && <div className="toast" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}
      {game.status === "lobby" && <Lobby game={game} act={act} />}
      {game.status === "draft" && <Draft game={game} act={act} />}
      {game.status === "turns" && <Turns game={game} act={act} />}
      {game.status === "finished" && <Finished game={game} act={act} />}
    </main>
  );
}
