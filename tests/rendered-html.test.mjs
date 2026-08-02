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
  assert.match(client, /chooseRole/);
  assert.match(client, /endTurn/);
  assert.match(layout, /\/og\.png/);
  assert.doesNotMatch(page + client + layout + packageJson, /codex-preview|react-loading-skeleton/i);
});

