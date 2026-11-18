import assert from "node:assert/strict";
import { test } from "node:test";

const currentRadar = {
  schemaVersion: 1,
  revision: "614f8cf2-f7f8-4b81-b060-989f7bc35529",
  updatedAt: "2026-11-18T15:13:02.341Z",
  changeNote: "Migração inicial.",
  blips: [],
  sources: [],
};
const fixtureToken = "fake-github-token";

function contentsResponse(radar = currentRadar, sha = "current-blob-sha") {
  const content = Buffer.from(JSON.stringify(radar), "utf8").toString("base64");
  return Response.json({
    type: "file",
    name: "radar.json",
    path: "data/radar.json",
    sha,
    encoding: "base64",
    content: content.match(/.{1,60}/g).join("\n"),
  });
}

function largeContentsResponse(sha, size) {
  return Response.json({ type: "file", name: "radar.json", path: "data/radar.json", sha, size, encoding: "none", content: "" });
}

function tooLargeResponse() {
  return Response.json({
    message: "Large blob rejected by the default Contents media type.",
    errors: [{ resource: "Blob", field: "data", code: "too_large" }],
  }, { status: 403 });
}

async function setup(responses, env = {}) {
  const { createGithubRadarStore } = await import("../scripts/lib/github-radar-store.mjs");
  const calls = [];
  const store = createGithubRadarStore({
    env: { GITHUB_TOKEN: fixtureToken, ...env },
    fetch: async (url, init) => {
      calls.push({ url: String(url), ...init });
      const response = responses[calls.length - 1];
      if (response instanceof Error) throw response;
      assert.ok(response, "unexpected GitHub request");
      return response;
    },
    now: () => new Date("2026-11-18T17:00:00.000Z"),
    createId: () => "0b1b5597-c86b-4816-b293-85b386a25a34",
  });
  return { store, calls };
}

const savePayload = {
  baseRevision: currentRadar.revision,
  changeNote: "  Revisão técnica  ",
  radar: {
    schemaVersion: 99,
    revision: "supplied-by-client",
    updatedAt: 0,
    changeNote: "Cliente",
    blips: [],
    sources: [],
  },
};

test("reads the default GitHub path and normalizes the Base64 UTF-8 document", async () => {
  const { store, calls } = await setup([
    contentsResponse({ ...currentRadar, changeNote: "  Migração inicial.  " }),
  ]);

  assert.deepEqual(await store.readRadar(), { radar: currentRadar, sha: "current-blob-sha" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.github.com/repos/JoaopauloRM700/technology-radar/contents/data/radar.json?ref=main");
  assert.equal(calls[0].method, "GET");
  const headers = new Headers(calls[0].headers);
  assert.equal(headers.get("accept"), "application/vnd.github+json");
  assert.equal(headers.get("authorization"), "Bearer fake-github-token");
  assert.equal(headers.get("x-github-api-version"), "2022-11-28");
});

test("commits the normalized draft with server metadata and the current blob SHA", async () => {
  const { store, calls } = await setup([
    contentsResponse(),
    Response.json({
      content: { sha: "new-blob-sha", path: "data/radar.json" },
      commit: { sha: "new-commit-sha", html_url: "https://github.com/custom/project/commit/new-commit-sha" },
    }, { status: 200 }),
  ], { GITHUB_OWNER: "custom", GITHUB_REPO: "project", GITHUB_BRANCH: "feature/radar" });

  const result = await store.saveRadar(savePayload);
  assert.deepEqual(result, {
    radar: {
      schemaVersion: 1,
      revision: "0b1b5597-c86b-4816-b293-85b386a25a34",
      updatedAt: "2026-11-18T17:00:00.000Z",
      changeNote: "Revisão técnica",
      blips: [],
      sources: [],
    },
    commit: { sha: "new-commit-sha", url: "https://github.com/custom/project/commit/new-commit-sha" },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://api.github.com/repos/custom/project/contents/data/radar.json?ref=feature%2Fradar");
  assert.equal(calls[1].url, "https://api.github.com/repos/custom/project/contents/data/radar.json");
  assert.equal(calls[1].method, "PUT");
  const headers = new Headers(calls[1].headers);
  assert.equal(headers.get("authorization"), "Bearer fake-github-token");
  assert.equal(headers.get("content-type"), "application/json");
  const { content, ...metadata } = JSON.parse(calls[1].body);
  assert.deepEqual(metadata, {
    sha: "current-blob-sha",
    branch: "feature/radar",
    message: "chore(radar): Revisão técnica",
  });
  assert.equal(Buffer.from(content, "base64").toString("utf8"), `{
  "schemaVersion": 1,
  "revision": "0b1b5597-c86b-4816-b293-85b386a25a34",
  "updatedAt": "2026-11-18T17:00:00.000Z",
  "changeNote": "Revisão técnica",
  "blips": [],
  "sources": []
}
`);
});

test("saves and rereads a large radar through the Git Blobs API", async () => {
  const sha = "3d21ec53a331a6f037a91c368710b99387d012c1";
  const responses = [
    contentsResponse(),
    Response.json({ content: { sha, path: "data/radar.json" }, commit: { sha: "new-commit-sha" } }),
  ];
  const { store, calls } = await setup(responses, { GITHUB_OWNER: "custom", GITHUB_REPO: "project" });
  const sources = Array.from({ length: 5000 }, (_, index) => ({
    id: "fonte-" + index,
    name: "Referência",
    initials: "R",
    strength: "Alta",
    cadence: "Mensal",
    signal: "Sinal",
    agentUse: "Monitorar",
    url: "https://example.test/radar",
  }));
  const payload = { ...savePayload, radar: { blips: [], sources } };
  assert.ok(Buffer.byteLength(JSON.stringify(payload)) < 1024 * 1024);

  const saved = await store.saveRadar(payload);
  assert.deepEqual(saved.radar.sources, sources);
  assert.deepEqual(saved.commit, { sha: "new-commit-sha" });
  const { content } = JSON.parse(calls[1].body);
  const size = Buffer.from(content, "base64").length;
  assert.ok(size > 1024 * 1024);
  responses.push(
    tooLargeResponse(),
    largeContentsResponse(sha, size),
    Response.json({ sha, size, encoding: "base64", content }),
  );

  assert.deepEqual(await store.readRadar(), { radar: saved.radar, sha });
  assert.deepEqual(calls.slice(2).map(({ url, method, headers }) => [url, method, new Headers(headers).get("accept")]), [
    ["https://api.github.com/repos/custom/project/contents/data/radar.json?ref=main", "GET", "application/vnd.github+json"],
    ["https://api.github.com/repos/custom/project/contents/data/radar.json?ref=main", "GET", "application/vnd.github.object+json"],
    ["https://api.github.com/repos/custom/project/git/blobs/3d21ec53a331a6f037a91c368710b99387d012c1", "GET", "application/vnd.github+json"],
  ]);
  const headers = new Headers(calls[4].headers);
  assert.equal(headers.get("authorization"), "Bearer fake-github-token");
  assert.equal(headers.get("x-github-api-version"), "2022-11-28");
});

test("maps failed or malformed blob responses to safe GitHub errors", async () => {
  const { GitHubRadarError } = await import("../scripts/lib/github-radar-store.mjs");
  const sha = "3d21ec53a331a6f037a91c368710b99387d012c1";
  for (const blob of [
    Response.json({ message: "private blob details" }, { status: 404 }),
    Response.json({ sha, encoding: "none", content: "private blob details" }),
  ]) {
    const { store, calls } = await setup([largeContentsResponse(sha, 1100000), blob]);
    await assert.rejects(store.readRadar(), { name: GitHubRadarError.name, message: "GitHub radar request failed." });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].url, "https://api.github.com/repos/JoaopauloRM700/technology-radar/git/blobs/3d21ec53a331a6f037a91c368710b99387d012c1");
  }
});

test("maps a second Contents 403 to a safe upstream error without retrying again", async () => {
  const { GitHubRadarError } = await import("../scripts/lib/github-radar-store.mjs");
  const { store, calls } = await setup([tooLargeResponse(), tooLargeResponse()]);

  await assert.rejects(store.readRadar(), {
    name: GitHubRadarError.name,
    message: "GitHub radar request failed.",
    status: 403,
  });
  assert.equal(calls.length, 2);
});

test("keeps the commit SHA when GitHub omits the commit URL", async () => {
  const { store } = await setup([
    contentsResponse(),
    Response.json({ commit: { sha: "new-commit-sha" } }),
  ]);

  assert.deepEqual((await store.saveRadar(savePayload)).commit, { sha: "new-commit-sha" });
});

test("rejects a stale base revision before any PUT", async () => {
  const { RevisionConflictError } = await import("../scripts/lib/github-radar-store.mjs");
  const { store, calls } = await setup([contentsResponse()]);

  await assert.rejects(store.saveRadar({ ...savePayload, baseRevision: "stale-revision" }), (error) =>
    error instanceof RevisionConflictError &&
    error.currentRevision === "614f8cf2-f7f8-4b81-b060-989f7bc35529");
  assert.deepEqual(calls.map(({ method }) => method), ["GET"]);
});

test("reports the new revision if another save wins between GET and PUT", async () => {
  const { RevisionConflictError } = await import("../scripts/lib/github-radar-store.mjs");
  const { store, calls } = await setup([
    contentsResponse(),
    Response.json({ message: "Stale blob SHA" }, { status: 409 }),
    contentsResponse({ ...currentRadar, revision: "e82de28e-d0f1-460a-8d89-be86be5e6521" }, "changed-blob-sha"),
  ]);

  await assert.rejects(store.saveRadar(savePayload), (error) =>
    error instanceof RevisionConflictError &&
    error.currentRevision === "e82de28e-d0f1-460a-8d89-be86be5e6521");
  assert.deepEqual(calls.map(({ method }) => method), ["GET", "PUT", "GET"]);
});

test("classifies transport and invalid Contents responses without exposing upstream details", async () => {
  const { GitHubRadarError } = await import("../scripts/lib/github-radar-store.mjs");
  for (const response of [
    new Error("private transport details"),
    Response.json({ message: "private response details" }, { status: 403 }),
    Response.json({ sha: "test", encoding: "base64", content: "!!!" }),
    contentsResponse({ ...currentRadar, schemaVersion: 2 }),
  ]) {
    const { store, calls } = await setup([response]);
    await assert.rejects(store.readRadar(), { name: GitHubRadarError.name, message: "GitHub radar request failed." });
    assert.equal(calls.length, 1);
  }
});

test("classifies rejected writes and malformed commit responses as GitHub errors", async () => {
  const { GitHubRadarError } = await import("../scripts/lib/github-radar-store.mjs");
  for (const responses of [
    [Response.json({ message: "private response details" }, { status: 422 })],
    [Response.json({ commit: {} })],
    [Response.json({ message: "private conflict details" }, { status: 409 }), contentsResponse()],
  ]) {
    const { store } = await setup([contentsResponse(), ...responses]);
    await assert.rejects(store.saveRadar(savePayload), { name: GitHubRadarError.name, message: "GitHub radar request failed." });
  }
});

test("rejects invalid save envelopes and drafts before making a GitHub request", async () => {
  const { InvalidRadarPayloadError } = await import("../scripts/lib/github-radar-store.mjs");
  const { store, calls } = await setup([]);
  for (const payload of [
    null,
    { ...savePayload, baseRevision: "" },
    { ...savePayload, changeNote: " " },
    { ...savePayload, changeNote: 123 },
    { ...savePayload, changeNote: "a".repeat(121) },
    { ...savePayload, radar: { blips: [] } },
    { ...savePayload, radar: { blips: [{ id: "incomplete" }], sources: [] } },
    {
      ...savePayload,
      radar: {
        blips: [],
        sources: [{
          id: "source-id",
          name: "Fonte",
          initials: "F",
          strength: "Alta",
          cadence: "Mensal",
          signal: "Sinal",
          agentUse: "Monitorar",
          url: "javascript:alert(1)",
        }],
      },
    },
  ]) {
    await assert.rejects(store.saveRadar(payload), InvalidRadarPayloadError);
  }
  assert.equal(calls.length, 0);
});
