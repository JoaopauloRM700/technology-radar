import assert from "node:assert/strict";
import { once } from "node:events";
import { request } from "node:http";
import { test } from "node:test";
import { AnalysisLimitError } from "../scripts/lib/analysis-jobs.mjs";

const adminToken = "a".repeat(32);
const authorized = { Authorization: "Bearer " + adminToken };
const localOrigin = "http://localhost:4173";
const pagesOrigin = "https://joaopaulorm700.github.io";
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
    assert.equal(response.headers.get("access-control-allow-headers"), "Authorization, Content-Type, X-File-Name");
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
  const fixedLength = request(base + "/api/v1/radar", {
    method: "PUT",
    headers: {
      ...authorized,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(oversized),
    },
  });
  t.after(() => fixedLength.destroy());
  fixedLength.flushHeaders();
  const [earlyResponse] = await once(fixedLength, "response");
  fixedLength.end();
  assert.equal(earlyResponse.statusCode, 400);
  const earlyChunks = [];
  for await (const chunk of earlyResponse) earlyChunks.push(chunk);
  assert.deepEqual(JSON.parse(Buffer.concat(earlyChunks).toString("utf8")), {
    ok: false,
    error: "invalid_payload",
  });

  assert.equal(streamingResponse.status, 400);
  assert.deepEqual(await streamingResponse.json(), { ok: false, error: "invalid_payload" });
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
    currentRadar: {
      schemaVersion: 1,
      revision: "614f8cf2-f7f8-4b81-b060-989f7bc35529",
      updatedAt: "2026-11-18T15:00:00.000Z",
      changeNote: "Versão inicial",
      blips: [],
      sources: [],
    },
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

const analysisPath = "/api/v1/analysis-jobs";
function upload(base, body, headers = {}, options = {}) {
  return fetch(base + analysisPath, {
    method: "POST", body, headers: { ...authorized, "Content-Type": "application/pdf", Origin: localOrigin, ...headers }, ...options,
  });
}

test("authenticates both job routes and allows the filename in preflight", async (t) => {
  const base = await start(t);
  for (const res of [
    await upload(base, "text", { Authorization: "" }),
    await fetch(base + analysisPath + "/missing"),
  ]) {
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { ok: false, error: "unauthorized" });
  }
  const cors = await fetch(base + analysisPath, {
    method: "OPTIONS", headers: { Origin: localOrigin, "Access-Control-Request-Headers": "authorization,content-type,x-file-name" },
  });
  assert.equal(cors.status, 204);
  assert.equal(cors.headers.get("access-control-allow-headers"), "Authorization, Content-Type, X-File-Name");
});

test("rejects invalid MIME, signature, Content-Length and streamed size before creating jobs", async (t) => {
  let created = 0;
  const base = await start(t, { jobs: { assertAvailable() {}, create() { created++; } } });
  const tooBig = Buffer.alloc(10 * 1024 * 1024 + 1);
  const pending = request(base + analysisPath, {
    method: "POST", headers: { ...authorized, "Content-Type": "application/pdf", "Content-Length": tooBig.length },
  });
  t.after(() => pending.destroy());
  pending.flushHeaders();
  const [early] = await once(pending, "response");
  pending.end();
  assert.equal(early.statusCode, 413);
  early.resume();
  const streamed = new ReadableStream({ start(controller) {
    controller.enqueue(tooBig.subarray(0, 100)); controller.enqueue(tooBig.subarray(100)); controller.close();
  } });
  for (const [res, status, error] of [
    [await upload(base, "%PDF-fixture", { "Content-Type": "text/plain" }), 415, "unsupported_media_type"],
    [await upload(base, "fake", { "X-File-Name": "file.pdf" }), 400, "invalid_pdf"],
    [await upload(base, streamed, {}, { duplex: "half" }), 413, "pdf_too_large"],
  ]) {
    assert.equal(res.status, status);
    assert.deepEqual(await res.json(), { ok: false, error });
    assert.equal(res.headers.get("access-control-allow-origin"), localOrigin);
  }
  assert.equal(created, 0);
});

for (const code of ["analysis_busy", "daily_limit"]) {
  test(`rejects ${code} before reading an unfinished PDF body`, { timeout: 3000 }, async (t) => {
    const base = await start(t, { jobs: {
      assertAvailable() { throw new AnalysisLimitError(code); },
      create() { assert.fail("job must not be created"); },
    } });
    const pending = request(base + analysisPath, {
      method: "POST",
      headers: { ...authorized, "Content-Type": "application/pdf" },
    });
    t.after(() => pending.destroy());
    pending.flushHeaders();
    const [response] = await once(pending, "response");
    pending.end();
    assert.equal(response.statusCode, 429);
    const chunks = [];
    for await (const chunk of response) chunks.push(chunk);
    assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString("utf8")), { ok: false, error: code });
  });
}

test("allows only one request body to be buffered at a time", { timeout: 3000 }, async (t) => {
  let created = 0;
  const base = await start(t, { jobs: {
    assertAvailable() {},
    create() { created++; return { id: "buffered-job" }; },
  } });
  const headers = { ...authorized, "Content-Type": "application/pdf" };
  const first = request(base + analysisPath, { method: "POST", headers });
  const second = request(base + analysisPath, { method: "POST", headers });
  t.after(() => { first.destroy(); second.destroy(); });
  first.flushHeaders();
  await new Promise((resolve) => setImmediate(resolve));
  second.flushHeaders();
  const [response] = await once(second, "response");
  second.end();
  assert.equal(response.statusCode, 429);
  const chunks = [];
  for await (const chunk of response) chunks.push(chunk);
  assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString("utf8")), { ok: false, error: "analysis_busy" });
  const accepted = once(first, "response");
  first.end("%PDF-fixture");
  const [firstResponse] = await accepted;
  firstResponse.resume();
  await once(firstResponse, "end");
  assert.equal(firstResponse.statusCode, 202);
  assert.equal(created, 1);
});

test("returns queued 202, running progress, busy, success and unknown job over HTTP", async (t) => {
  let complete;
  const base = await start(t, {
    createId: () => "test-job", now: () => new Date("2026-11-18T12:00:00Z"),
    runner: ({ bytes, fileName, onProgress }) => {
      assert.equal(bytes.toString(), "%PDF-fixture");
      assert.equal(fileName, "source.pdf");
      onProgress({ stage: "ocr", processedPages: 1, totalPages: 2 });
      return new Promise((resolve) => { complete = resolve; });
    },
  });
  const res = await upload(base, "%PDF-fixture", { "X-File-Name": "source.pdf" });
  assert.equal(res.status, 202);
  assert.deepEqual(await res.json(), { ok: true, job: {
    id: "test-job", status: "queued", createdAt: "2026-11-18T12:00:00.000Z", updatedAt: "2026-11-18T12:00:00.000Z",
    progress: { stage: "queued", processedPages: 0, totalPages: 0 },
  } });
  const get = (id) => fetch(base + analysisPath + "/" + id, { headers: authorized });
  const running = (await (await get("test-job")).json()).job;
  assert.equal(running.status, "running");
  assert.deepEqual(running.progress, { stage: "ocr", processedPages: 1, totalPages: 2 });
  const busy = await upload(base, "%PDF-new");
  assert.equal(busy.status, 429);
  assert.deepEqual(await busy.json(), { ok: false, error: "analysis_busy" });
  complete({ proposals: [], totalPages: 2, ocrPages: 1 });
  const done = (await (await get("test-job")).json()).job;
  assert.equal(done.status, "succeeded");
  assert.deepEqual(done.result, { proposals: [], totalPages: 2, ocrPages: 1 });
  const unknown = await get("unknown");
  assert.equal(unknown.status, 404);
  assert.deepEqual(await unknown.json(), { ok: false, error: "not_found" });
});
