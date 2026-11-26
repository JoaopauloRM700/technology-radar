import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createLocalServer } from "../scripts/local-server.mjs";

async function start(t) {
  const server = createLocalServer({ root: process.cwd() });
  assert.equal(server.listening, false);
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return "http://127.0.0.1:" + server.address().port;
}

test("serves only allowlisted public frontend assets with no-store caching", async (t) => {
  const base = await start(t);
  for (const [route, expectedType] of [
    ["/", "text/html; charset=utf-8"],
    ["/index.html", "text/html; charset=utf-8"],
    ["/styles.css", "text/css; charset=utf-8"],
    ["/app.js", "text/javascript; charset=utf-8"],
    ["/app-core.mjs", "text/javascript; charset=utf-8"],
    ["/data/radar.json?v=123", "application/json; charset=utf-8"],
  ]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    assert.equal(response.headers.get("content-type"), expectedType, route);
    assert.equal(response.headers.get("cache-control"), "no-store", route);
    assert.ok((await response.text()).length > 0, route);
  }

  const head = await fetch(base + "/index.html", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("blocks secrets, git metadata, uploads, AI artifacts, and path traversal", async (t) => {
  const base = await start(t);
  for (const route of [
    "/.env",
    "/.env.example",
    "/.git/HEAD",
    "/package.json",
    "/scripts/api-server.mjs",
    "/data/uploads/2026-07-23T17-32-20-843Z-tr_technology_radar_vol_34_en_1.pdf",
    "/data/ai-raw/dora-core-v2.1.0-summary-proposals-gemini-raw.txt",
    "/data/pdf/dora-core-v2.1.0-summary.txt",
    "/../.env",
    "/%2e%2e/.env",
    "/data/../.env",
  ]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 404, route);
  }
});

test("removes legacy POST endpoints from the local static server", async (t) => {
  const base = await start(t);
  for (const route of ["/api/export-html", "/api/pdf-proposals"]) {
    const response = await fetch(base + route, { method: "POST" });
    assert.equal(response.status, 405, route);
  }
});
