import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("ships the separate game hub, city game, and social preview", async () => {
  const [page, hub, crownPage, client, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/HomeClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/crown-city/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/GameClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    access(new URL("../public/og.png", import.meta.url)),
  ]);

  assert.match(page, /<HomeClient\s*\/>/);
  assert.match(hub, /href="\/crown-city"/);
  assert.match(hub, /href="\/realms"/);
  assert.match(hub, /王冠之城/);
  assert.match(hub, /六境争霸/);
  assert.match(hub, /window\.location\.replace/);
  assert.match(crownPage, /<GameClient\s*\/>/);
  assert.match(client, /王冠之城/);
  assert.match(client, /创建房间/);
  assert.match(client, /加入房间/);
  assert.match(client, /完整规则书/);
  assert.match(client, /27 名角色/);
  assert.match(client, /2–8 人/);
  assert.match(client, /chooseRole/);
  assert.match(client, /返回牌桌，查看资源与历史/);
  assert.match(client, /继续选角色/);
  assert.match(client, /本轮角色行动/);
  assert.match(client, /本轮行动/);
  assert.match(client, /历史对局/);
  assert.match(client, /playGameSound/);
  assert.match(client, /音效/);
  assert.match(client, /endTurn/);
  assert.match(client, /在线同步/);
  assert.match(client, /navigator\.share/);
  assert.match(client, /\?room=/);
  assert.match(layout, /\/og\.png/);
  assert.doesNotMatch(page + hub + crownPage + client + layout + packageJson, /codex-preview|react-loading-skeleton/i);
});

test("ships the complete online realm-war surface and bilingual rulebook", async () => {
  const [page, client, styles, route] = await Promise.all([
    readFile(new URL("../app/realms/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/realms/RealmsClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/realms/realms.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/realms/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /<RealmsClient\s*\/>/);
  assert.match(client, /六境争霸/);
  assert.match(client, /秘密下令/);
  assert.match(client, /影响力竞价/);
  assert.match(client, /完整规则/);
  assert.match(client, /The Six Realms/);
  assert.match(client, /战争纪事/);
  assert.match(client, /realm-below-map/);
  assert.match(client, /战局总览/);
  assert.match(client, /realm-track-overview/);
  assert.doesNotMatch(client, /tracksOpen/);
  assert.match(client, /rotateMapPoint/);
  assert.match(client, /退出战局/);
  assert.match(client, /LAST_RECOVERY_KEY/);
  assert.match(client, /saved\?\.code === invitedRoom/);
  assert.match(client, /playTone/);
  assert.match(styles, /\.realm-map/);
  assert.match(styles, /aspect-ratio:\s*3 \/ 2/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(24rem, 30rem\)/);
  assert.match(styles, /realms-board-v3-hidpi/);
  assert.match(styles, /@media/);
  assert.match(route, /loadRoomRecord<RealmState>/);
  assert.match(route, /saveOrConflict/);
});
