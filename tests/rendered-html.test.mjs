import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("ships the game surface and social preview", async () => {
  const [page, client, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/GameClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    access(new URL("../public/og.png", import.meta.url)),
  ]);

  assert.match(page, /<GameClient\s*\/>/);
  assert.match(client, /王冠之城/);
  assert.match(client, /创建房间/);
  assert.match(client, /加入房间/);
  assert.match(client, /完整规则书/);
  assert.match(client, /27 名角色/);
  assert.match(client, /2–8 人/);
  assert.match(client, /chooseRole/);
  assert.match(client, /返回牌桌，查看资源与历史/);
  assert.match(client, /继续选角色/);
  assert.match(client, /历史对局/);
  assert.match(client, /playGameSound/);
  assert.match(client, /音效/);
  assert.match(client, /endTurn/);
  assert.match(client, /在线同步/);
  assert.match(client, /navigator\.share/);
  assert.match(client, /\?room=/);
  assert.match(layout, /\/og\.png/);
  assert.doesNotMatch(page + client + layout + packageJson, /codex-preview|react-loading-skeleton/i);
});
