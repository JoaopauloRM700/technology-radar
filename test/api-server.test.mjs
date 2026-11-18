import assert from "node:assert/strict";
import { once } from "node:events";
import { request } from "node:http";
import { test } from "node:test";

const adminToken = "a".repeat(32);
const authorized = { Authorization: "Bearer " + adminToken };
const localOrigin = "http://localhost:4173";
const pagesOrigin = "https://joapaulorm700.github.io";
const draft = {
  baseRevision: "614f8cf2-f7f8-4b81-b060-989f7bc35529",
  changeNote: "Revisão de fontes",
  radar: {
    blips: [],
    sources: [{
      id: "fonte",
      name: "Fonte de referência",
      initials: "FR",
      strength: "Alta",
      cadence: "Mensal",
      signal: "Sinal",
      agentUse: "Monitorar",
      url: "https://example.test/radar",
    }],
  },
};

async function start(t, options = {}) {
  const { createApiServer } = await import("../scripts/api-server.mjs");
  const server = createApiServer({
    env: { ADMIN_TOKEN: adminToken, GITHUB_TOKEN: "fake-github-token" },
    ...options,
  });
  assert.equal(server.listening, false);
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return "http://127.0.0.1:" + server.address().port;
}

function put(base, body, headers = {}) {
  return fetch(base + "/api/v1/radar", {
    method: "PUT",
    headers: { ...authorized, "Content-Type": "application/json", ...headers },
    body,
  });
}

test("rejects missing and short admin tokens during configuration", async () => {
  const { createApiServer } = await import("../scripts/api-server.mjs");
  const store = {};
  assert.throws(() => createApiServer({ env: {}, store }), /ADMIN_TOKEN.*32/);
  assert.throws(() => createApiServer({ env: { ADMIN_TOKEN: "private" }, store }), /ADMIN_TOKEN.*32/);
});

test("serves health publicly and responds to unknown routes with JSON 404", async (t) => {
  const base = await start(t);
  const health = await fetch(base + "/healthz");
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("content-type"), "application/json; charset=utf-8");
  assert.deepEqual(await health.json(), { ok: true });

  const unknown = await fetch(base + "/unknown");
  assert.equal(unknown.status, 404);
  assert.deepEqual(await unknown.json(), { ok: false, error: "not_found" });
});

test("accepts preflight from the exact GitHub Pages and local origins", async (t) => {
  const base = await start(t);
  for (const origin of [pagesOrigin, localOrigin]) {
    const response = await fetch(base + "/api/v1/radar", {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("vary"), "Origin");
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(response.headers.get("access-control-allow-methods"), "GET, POST, PUT, OPTIONS");
    assert.equal(response.headers.get("access-control-allow-headers"), "Authorization, Content-Type");
    assert.equal(await response.text(), "");
  }
});

test("blocks an unlisted origin before reading the unfinished request body", { timeout: 3000 }, async (t) => {
  const base = await start(t);
  const pending = request(base + "/api/v1/radar", {
    method: "PUT",
    headers: { ...authorized, Origin: "https://joapaulorm700.github.io.example.test" },
  });
  t.after(() => pending.destroy());
  pending.flushHeaders();
  const [response] = await once(pending, "response");
  pending.end();
  assert.equal(response.statusCode, 403);
  assert.equal(response.headers["access-control-allow-origin"], undefined);
  const chunks = [];
  for await (const chunk of response) chunks.push(chunk);
  assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString("utf8")), { ok: false, error: "origin_forbidden" });
});

test("requires the admin token for verification and saves", async (t) => {
  const base = await start(t);
  const endpoint = base + "/api/v1/admin/verify";
  for (const response of [
    await fetch(endpoint, { method: "POST" }),
    await fetch(endpoint, { method: "POST", headers: { Authorization: "Bearer wrong", Origin: localOrigin } }),
    await put(base, "not JSON", { Authorization: "Bearer " + "b".repeat(32) }),
  ]) {
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, error: "unauthorized" });
  }
});

test("verifies the admin with and without a browser origin", async (t) => {
  const base = await start(t);
  for (const headers of [authorized, { ...authorized, Origin: pagesOrigin }]) {
    const response = await fetch(base + "/api/v1/admin/verify", { method: "POST", headers });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), headers.Origin ?? null);
    assert.equal(response.headers.get("vary"), "Origin");
    assert.deepEqual(await response.json(), { ok: true });
  }
});

test("rejects invalid JSON, invalid schema, and unsafe document URLs before GitHub", async (t) => {
  const base = await start(t, { fetch: async () => assert.fail("unexpected GitHub request") });
  const invalidSource = { ...draft.radar.sources[0], url: "file:///radar.json" };
  const unsafeDraft = { ...draft, radar: { blips: [], sources: [invalidSource] } };
  for (const body of [
    "{",
    JSON.stringify({ ...draft, changeNote: "" }),
    JSON.stringify({ ...draft, changeNote: "a".repeat(121) }),
    JSON.stringify(unsafeDraft),
  ]) {
    const response = await put(base, body, { Origin: localOrigin });
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("access-control-allow-origin"), localOrigin);
    assert.deepEqual(await response.json(), { ok: false, error: "invalid_payload" });
  }
});

test("rejects JSON above one MiB for both fixed-length and streamed requests", async (t) => {
  const base = await start(t, { fetch: async () => assert.fail("unexpected GitHub request") });
  const oversized = JSON.stringify({ ...draft, radar: { ...draft.radar, padding: "x".repeat(1024 * 1024) } });
  const streamed = new ReadableStream({
    start(controller) {
      controller.enqueue(Buffer.from(oversized));
      controller.close();
    },
  });
  const streamingResponse = await fetch(base + "/api/v1/radar", {
    method: "PUT",
    duplex: "half",
    headers: { ...authorized, "Content-Type": "application/json" },
    body: streamed,
  });
  for (const response of [await put(base, oversized), streamingResponse]) {
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { ok: false, error: "invalid_payload" });
  }
});

test("returns the saved radar and commit through the HTTP route", async (t) => {
  const base = await start(t, {
    now: () => new Date("2026-11-18T18:00:00.000Z"),
    createId: () => "0b1b5597-c86b-4816-b293-85b386a25a34",
    fetch: async (_url, { method, body }) => {
      if (method === "GET") return fakeContents();
      if (method === "PUT") {
        const { sha, message } = JSON.parse(body);
        if (sha === "blob-sha" && message === "chore(radar): Revisão de fontes") {
          return Response.json({
            commit: { sha: "commit-sha", html_url: "https://github.com/example/radar/commit/commit-sha" },
          });
        }
      }
      return Response.json({ message: "Unexpected request" }, { status: 400 });
    },
  });
  const response = await put(base, JSON.stringify(draft), { Origin: localOrigin });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), localOrigin);
  assert.deepEqual(await response.json(), {
    ok: true,
    radar: {
      schemaVersion: 1,
      revision: "0b1b5597-c86b-4816-b293-85b386a25a34",
      updatedAt: "2026-11-18T18:00:00.000Z",
      changeNote: "Revisão de fontes",
      blips: [],
      sources: [{
        id: "fonte",
        name: "Fonte de referência",
        initials: "FR",
        strength: "Alta",
        cadence: "Mensal",
        signal: "Sinal",
        agentUse: "Monitorar",
        url: "https://example.test/radar",
      }],
    },
    commit: { sha: "commit-sha", url: "https://github.com/example/radar/commit/commit-sha" },
  });
});

test("returns the current revision on save conflicts", async (t) => {
  const base = await start(t, {
    fetch: async (_url, { method }) => {
      assert.equal(method, "GET");
      return fakeContents();
    },
  });
  const response = await put(base, JSON.stringify({ ...draft, baseRevision: "stale" }));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "revision_conflict",
    currentRevision: "614f8cf2-f7f8-4b81-b060-989f7bc35529",
  });
});

test("returns generic errors for upstream and internal failures", async (t) => {
  const upstream = await start(t, {
    fetch: async () => Response.json({ message: "private-github-information" }, { status: 403 }),
  });
  const rejected = await put(upstream, JSON.stringify(draft));
  assert.equal(rejected.status, 502);
  assert.deepEqual(await rejected.json(), { ok: false, error: "github_upstream" });

  const base = await start(t, {
    store: { saveRadar: async () => { throw new Error("internal details"); } },
  });
  const failed = await put(base, JSON.stringify(draft));
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), { ok: false, error: "internal_error" });
});

function fakeContents() {
  const radar = {
    schemaVersion: 1,
    revision: "614f8cf2-f7f8-4b81-b060-989f7bc35529",
    updatedAt: "2026-11-18T15:00:00.000Z",
    changeNote: "Versão inicial",
    blips: [],
    sources: [],
  };
  return Response.json({
    type: "file",
    name: "radar.json",
    path: "data/radar.json",
    sha: "blob-sha",
    encoding: "base64",
    content: Buffer.from(JSON.stringify(radar)).toString("base64"),
  });
}
