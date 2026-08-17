"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Language = "zh" | "en";

export function HomeClient() {
  const [language, setLanguage] = useState<Language>("zh");
  const text = (zh: string, en: string) => language === "zh" ? zh : en;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("room")) {
      window.location.replace(`/crown-city${window.location.search}${window.location.hash}`);
      return;
    }
    const saved = window.localStorage.getItem("crown-city-language") ?? window.localStorage.getItem("six-realms-language");
    if (saved === "en") {
      const timer = window.setTimeout(() => setLanguage("en"), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  function changeLanguage() {
    const next: Language = language === "zh" ? "en" : "zh";
    setLanguage(next);
    window.localStorage.setItem("crown-city-language", next);
    window.localStorage.setItem("six-realms-language", next);
  }

  return (
    <main className="hub-shell">
      <header className="hub-header">
        <a className="hub-brand" href="#games" aria-label={text("前往游戏选择", "Go to game selection")}>
          <span aria-hidden="true">♛</span>
          <b>{text("王冠游戏厅", "Crown Game Hall")}</b>
        </a>
        <button className="hub-language" onClick={changeLanguage} aria-label={text("切换为英文", "Switch to Chinese")}>
          {language === "zh" ? "EN" : "中文"}
        </button>
      </header>

      <section className="hub-intro">
        <p className="hub-kicker">TWO TABLES · TWO WORLDS</p>
        <h1>{text("选择你的战场", "Choose your battlefield")}</h1>
        <p>{text("两款游戏现已完全分开。每一款都有自己的入口、房间和规则，不再需要从另一款游戏中跳转。", "The two games now have independent entrances, rooms, and rules—no more crossing through one game to reach the other.")}</p>
      </section>

      <section className="hub-games" id="games" aria-label={text("选择游戏", "Choose a game")}>
        <Link className="hub-card hub-city" href="/crown-city">
          <div className="hub-card-art" aria-hidden="true">
            <span className="hub-card-sigil">♛</span>
            <i className="city-skyline city-skyline-one" />
            <i className="city-skyline city-skyline-two" />
            <i className="city-skyline city-skyline-three" />
          </div>
          <div className="hub-card-copy">
            <div className="hub-card-number">GAME 01</div>
            <h2>{text("王冠之城", "Crown City")}</h2>
            <p>{text("秘密选择身份，发动角色能力，建造价值最高的城市。", "Draft secret identities, wield character powers, and build the most valuable city.")}</p>
            <ul>
              <li>{text("2–8 人", "2–8 players")}</li>
              <li>{text("选角与城市建造", "Drafting & city building")}</li>
              <li>{text("支持策略电脑", "Strategy AI included")}</li>
            </ul>
            <span className="hub-enter">{text("进入王城", "Enter Crown City")} <b>→</b></span>
          </div>
        </Link>

        <Link className="hub-card hub-realms" href="/realms">
          <div className="hub-card-art" aria-hidden="true">
            <span className="hub-card-sigil">✦</span>
            <i className="realm-contour realm-contour-one" />
            <i className="realm-contour realm-contour-two" />
            <i className="realm-contour realm-contour-three" />
          </div>
          <div className="hub-card-copy">
            <div className="hub-card-number">GAME 02</div>
            <h2>{text("六境争霸", "The Six Realms")}</h2>
            <p>{text("秘密下令、调动军队、争夺城堡，在十轮内统一六境。", "Issue secret orders, move armies, seize strongholds, and unite the realms within ten rounds.")}</p>
            <ul>
              <li>{text("3–6 人", "3–6 players")}</li>
              <li>{text("版图战争与外交", "Realm war & diplomacy")}</li>
              <li>{text("完整在线版图", "Complete online board")}</li>
            </ul>
            <span className="hub-enter">{text("进入六境", "Enter the Six Realms")} <b>→</b></span>
          </div>
        </Link>
      </section>

      <footer className="hub-footer">
        <span>{text("无需注册", "No registration")}</span>
        <i aria-hidden="true" />
        <span>{text("各自独立房间", "Independent rooms")}</span>
        <i aria-hidden="true" />
        <span>{text("朋友与电脑均可加入", "Friends and AI welcome")}</span>
      </footer>
    </main>
  );
}
