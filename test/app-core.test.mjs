import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const loadCanonical = async () => JSON.parse(await readFile(new URL("./fixtures/radar.json", import.meta.url), "utf8"));

test("the shipped production radar still satisfies the canonical schema", async () => {
  const production = JSON.parse(await readFile(new URL("../data/radar.json", import.meta.url), "utf8"));
  const { normalizeRadar } = await import("../app-core.mjs");
  const normalized = normalizeRadar(production);
  assert.equal(normalized.schemaVersion, 1);
  assert.equal(normalized.revision, production.revision);
});

test("loads the canonical radar and normalizes a detached copy", async () => {
  const radar = await loadCanonical();
  const { normalizeRadar } = await import("../app-core.mjs");
  assert.equal(radar.blips.length, 3);
  assert.equal(radar.sources.length, 1);
  radar.blips[0].name = " Coding Agents ";

  const normalized = normalizeRadar(radar);
  assert.equal(normalized.revision, radar.revision);
  assert.equal(normalized.blips[0].name, "Coding Agents");
  assert.equal(normalized.blips[0].detailsUrl, "");
  normalized.sources[0].name = "Edited";
  assert.equal(radar.sources[0].name, "Thoughtworks Technology Radar");
  assert.equal(radar.blips[0].name, " Coding Agents ");
});

test("rejects invalid canonical metadata, fields, and duplicate identities", async () => {
  const radar = await loadCanonical();
  const { normalizeRadar } = await import("../app-core.mjs");
  const [blip] = radar.blips;
  const [source] = radar.sources;

  for (const [invalid, field] of [
    [{ schemaVersion: 2 }, /schemaVersion/],
    [{ revision: "current" }, /revision/],
    [{ updatedAt: "2026-02-30T00:00:00Z" }, /updatedAt/],
    [{ changeNote: " " }, /changeNote/],
    [{ blips: [{ ...blip, ring: "Wait" }] }, /ring/],
    [{ blips: [{ ...blip, name: 42 }] }, /name/],
    [{ blips: [blip, blip] }, /id/],
    [{ sources: [{ ...source, url: "javascript:alert(1)" }] }, /url/],
    [{ sources: [source, source] }, /id/],
  ]) {
    assert.throws(() => normalizeRadar({ ...radar, ...invalid }), field);
  }
});

const desiredBlip = ({ id, ...blip }) => ({ ...blip, detailsUrl: "" });

function proposal(action, targetId, blip) {
  return {
    action,
    targetId,
    reason: "Evidência recente de adoção.",
    confidence: 0.8,
    evidence: [{ page: 2, note: "Resumo dos resultados." }],
    blip,
  };
}

test("applies full add, update and move proposals to a draft", async () => {
  const radar = await loadCanonical();
  const { applyProposals } = await import("../app-core.mjs");
  const before = structuredClone(radar);
  const [first, second] = radar.blips;
  const added = { ...desiredBlip(first), name: "Nova técnica" };
  const updated = { ...desiredBlip(first), strategic: "Justificativa revisada." };
  const moved = { ...desiredBlip(second), ring: "Caution", theme: "Riscos de adoção" };

  const draft = applyProposals(radar, [
    proposal("add", null, added),
    proposal("update", first.id, updated),
    proposal("move", second.id, moved),
  ], { createId: () => "new-id" });

  assert.deepEqual(draft.blips[0], { id: first.id, ...updated });
  assert.deepEqual(draft.blips[1], { id: second.id, ...moved });
  assert.deepEqual(draft.blips.at(-1), { id: "new-id", ...added });
  assert.equal(draft.revision, before.revision);
  assert.deepEqual(draft.sources, before.sources);
  assert.deepEqual(radar, before);
});

test("rejects a conflicting proposal batch without modifying the input", async () => {
  const radar = await loadCanonical();
  const { applyProposals } = await import("../app-core.mjs");
  const before = structuredClone(radar);
  const [blip] = radar.blips;
  const added = proposal("add", null, desiredBlip(blip));
  const updated = proposal("update", blip.id, { ...desiredBlip(blip), name: "Revisado" });

  assert.throws(() => applyProposals(radar, [updated, { ...updated, targetId: "missing" }]), /missing/);
  assert.throws(() => applyProposals(radar, [updated, { ...updated, action: "move" }]), /ES-01/);
  assert.throws(() => applyProposals(radar, [updated, added], { createId: () => blip.id }), /ES-01/);
  assert.deepEqual(radar, before);
});

test("rejects proposals outside the accepted shape and count", async () => {
  const radar = await loadCanonical();
  const { applyProposals } = await import("../app-core.mjs");
  const [blip] = radar.blips;
  const added = proposal("add", null, desiredBlip(blip));

  for (const [invalid, field] of [
    [{ action: "delete" }, /action/],
    [{ action: "remove" }, /action/],
    [{ targetId: blip.id }, /targetId/],
    [{ action: "update" }, /targetId/],
    [{ reason: "" }, /reason/],
    [{ confidence: 1.01 }, /confidence/],
    [{ evidence: [{ page: 0, note: "Zero" }] }, /page/],
    [{ evidence: [{ page: 1, note: "" }] }, /note/],
    [{ blip: { name: "Incomplete" } }, /quadrant/],
    [{ blip }, /id/],
  ]) {
    assert.throws(() => applyProposals(radar, [{ ...added, ...invalid }]), field);
  }
  assert.throws(() => applyProposals(radar, Array(6).fill(added)), /5/);
});

test("diff lists changed fields and before and after records by identity", async () => {
  const radar = await loadCanonical();
  const { diffBlips } = await import("../app-core.mjs");
  const [blip, removed, unchanged] = radar.blips;
  const updated = { ...blip, ring: "Adopt", strategic: "Estratégia revisada." };
  const added = { ...blip, id: "new-id", name: "Nova técnica" };

  const changes = diffBlips([blip, removed, unchanged], [added, unchanged, updated]);
  assert.equal(changes.length, 3);
  assert.deepEqual(changes.find(({ id }) => id === blip.id), {
    id: blip.id,
    before: blip,
    after: updated,
    fields: {
      ring: { before: "Trial", after: "Adopt" },
      strategic: { before: blip.strategic, after: "Estratégia revisada." },
    },
  });
  assert.deepEqual(changes.find(({ id }) => id === removed.id).fields.name, { before: removed.name, after: null });
  assert.deepEqual(changes.find(({ id }) => id === added.id).fields.name, { before: null, after: "Nova técnica" });
});

test("builds a standalone HTML snapshot with escaped text and safe links", async () => {
  const radar = await loadCanonical();
  const { buildRadarHtmlSnapshot } = await import("../app-core.mjs");
  const [blip] = radar.blips;
  const [source] = radar.sources;
  const payload = {
    title: "Radar <2026>",
    generatedAt: "2026-11-18T00:00:00.000Z",
    blips: [{ ...blip, name: '<script>alert("test")</script>', detailsUrl: "javascript:alert(1)" }],
    sources: [source, { ...source, url: "javascript:alert(2)" }],
  };
  const before = structuredClone(payload);

  const html = buildRadarHtmlSnapshot(payload);
  assert.match(html, /^<!doctype html>/);
  assert.ok(html.includes("<title>Radar &lt;2026&gt;</title>"));
  assert.ok(html.includes("<svg viewBox="));
  assert.ok(html.includes("Matriz Radar + TRM"));
  assert.ok(html.includes("&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;"));
  assert.ok(html.includes('href="https://www.thoughtworks.com/radar"'));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes('href="javascript:'));
  assert.equal(buildRadarHtmlSnapshot(payload), html);
  assert.deepEqual(payload, before);
});

test("frontend adapter applies legacy and modern proposals in the same draft", async () => {
  const radar = await loadCanonical();
  const { applyProposalBatch } = await import("../app-core.mjs");
  const [first, second] = radar.blips;
  const before = structuredClone(radar);
  const proposals = [
    {
      action: "add",
      blip: { name: "Inclusão legada" },
      evidence: [{ source: "Exemplo", url: "https://example.com", note: "Evidência sem página" }],
    },
    { action: "update", id: first.id, changes: { name: "Atualização legada" } },
    proposal("move", second.id, { ...desiredBlip(second), ring: "Caution" }),
  ];

  const { draft, added, updated, selectedId } = applyProposalBatch(radar, proposals, {
    createId: () => "new-id",
  });

  assert.equal(added, 1);
  assert.equal(updated, 2);
  assert.equal(selectedId, second.id);
  assert.deepEqual(draft.blips[0], { id: first.id, ...desiredBlip(first), name: "Atualização legada" });
  assert.deepEqual(draft.blips[1], { id: second.id, ...desiredBlip(second), ring: "Caution" });
  assert.equal(draft.blips.at(-1).id, "new-id");
  assert.equal(draft.blips.at(-1).name, "Inclusão legada");
  assert.deepEqual(radar, before);
});

test("frontend adapter leaves the original draft intact for invalid legacy and modern targets", async () => {
  const radar = await loadCanonical();
  const { applyProposalBatch } = await import("../app-core.mjs");
  const before = structuredClone(radar);
  const added = { action: "add", blip: { name: "Inclusão legada" } };
  const invalidTargets = [
    { action: "update", id: "legacy-missing", changes: { name: "Atualização" } },
    proposal("move", "modern-missing", desiredBlip(radar.blips[0])),
  ];

  for (const invalid of invalidTargets) {
    assert.throws(() => applyProposalBatch(radar, [added, invalid], { createId: () => "new-id" }), /missing/);
    assert.deepEqual(radar, before);
  }
});

test("frontend adapter rejects more than five proposals", async () => {
  const radar = await loadCanonical();
  const { applyProposalBatch } = await import("../app-core.mjs");
  const before = structuredClone(radar);
  const proposals = Array.from({ length: 6 }, (_, index) => ({
    action: "add",
    blip: { name: "Inclusão " + index },
  }));
  let nextId = 0;

  assert.throws(() => applyProposalBatch(radar, proposals, { createId: () => "new-" + ++nextId }), /5/);
  assert.deepEqual(radar, before);
});

test("manual blip IDs use only the ES sequence in a mixed radar", async () => {
  const { nextBlipId } = await import("../app-core.mjs");
  const blips = ["ES-03", "ES-25", "12345678-abcd-4abc-8123-123456789abc", "100000", "ES-text"]
    .map((id) => ({ id }));
  const first = nextBlipId(blips);

  assert.equal(first, "ES-26");
  assert.equal(nextBlipId([...blips, { id: first }]), "ES-27");
});

test("radar labels distinguish ES sequence numbers from other IDs", async () => {
  const { blipLabel } = await import("../app-core.mjs");

  assert.equal(blipLabel("ES-07", 2), "7");
  assert.equal(blipLabel("12345678-abcd-4abc-8123-123456789abc", 6), "#7");
});

test("resolveApiBaseUrl uses a safe configured base, falls back locally, and rejects ambiguous URLs", async () => {
  const { isHttpUrl, resolveApiBaseUrl } = await import("../app-core.mjs");

  assert.equal(isHttpUrl("https://example.com/report"), true);
  assert.equal(isHttpUrl("https://[bad"), false);
  assert.equal(isHttpUrl("javascript:alert(1)"), false);

  assert.equal(
    resolveApiBaseUrl({ configuredBase: "https://radar-api.onrender.com/", location: { hostname: "joaopaulorm700.github.io" } }),
    "https://radar-api.onrender.com",
  );
  assert.equal(
    resolveApiBaseUrl({ configuredBase: "", location: { hostname: "localhost" } }),
    "http://localhost:8787",
  );
  assert.equal(
    resolveApiBaseUrl({ configuredBase: "", location: { hostname: "127.0.0.1" } }),
    "http://localhost:8787",
  );
  assert.equal(
    resolveApiBaseUrl({ configuredBase: "", location: { hostname: "joaopaulorm700.github.io" } }),
    "",
  );
  assert.equal(
    resolveApiBaseUrl({ configuredBase: "javascript:alert(1)", location: { hostname: "joaopaulorm700.github.io" } }),
    "",
  );
  assert.equal(
    resolveApiBaseUrl({ configuredBase: "http://localhost:9876/", location: { hostname: "localhost" } }),
    "http://localhost:9876",
  );
  for (const configuredBase of [
    "https://radar-api.onrender.com?target=/healthz",
    "https://radar-api.onrender.com/#fragment",
    "https://radar-api.onrender.com?",
    "https://radar-api.onrender.com#",
  ]) {
    assert.equal(resolveApiBaseUrl({ configuredBase, location: { hostname: "joaopaulorm700.github.io" } }), "");
  }
});

test("hasDraftChanges detects modifications to blips or sources without false positives", async () => {
  const radar = await loadCanonical();
  const { hasDraftChanges } = await import("../app-core.mjs");
  const clone = structuredClone(radar);

  assert.equal(hasDraftChanges(radar, clone), false);
  clone.blips[0].ring = "Adopt";
  assert.equal(hasDraftChanges(radar, clone), true);
  clone.blips[0].ring = radar.blips[0].ring;
  assert.equal(hasDraftChanges(radar, clone), false);
  clone.sources.push({ ...radar.sources[0], id: "SRC-99" });
  assert.equal(hasDraftChanges(radar, clone), true);
});

test("buildProposalDiff computes field-level changes for add, update and move proposals", async () => {
  const radar = await loadCanonical();
  const { buildProposalDiff } = await import("../app-core.mjs");
  const [first] = radar.blips;
  const update = proposal("update", first.id, { ...desiredBlip(first), ring: "Adopt", name: "Coding Agents v2" });
  const added = proposal("add", null, { ...desiredBlip(first), name: "Novo Blip" });

  const updateDiff = buildProposalDiff(radar, update);
  assert.equal(updateDiff.target?.id, first.id);
  assert.deepEqual(updateDiff.changes.map((item) => item.field), ["name", "ring"]);
  assert.deepEqual(updateDiff.changes[1], { field: "ring", before: first.ring, after: "Adopt" });

  const addDiff = buildProposalDiff(radar, added);
  assert.equal(addDiff.target, null);
  assert.ok(addDiff.changes.some((item) => item.field === "name" && item.before === null && item.after === "Novo Blip"));
});

test("prepareProposalsForReview supports >5 legacy batches, flags invalid/delete items, and applySelectedProposals applies only chosen items", async () => {
  const radar = await loadCanonical();
  const { prepareProposalsForReview, applySelectedProposals } = await import("../app-core.mjs");
  const [first, second] = radar.blips;
  const raw = [
    { action: "delete", targetId: first.id, reason: "Remover", confidence: 0.9, evidence: [], blip: desiredBlip(first) },
    proposal("move", first.id, { ...desiredBlip(first), ring: "Adopt" }),
    proposal("add", null, { ...desiredBlip(second), name: "Blip Selecionado" }),
    { action: "update", id: "ES-999", changes: { ring: "Caution" } },
    proposal("add", null, { ...desiredBlip(second), name: "Extra 1" }),
    proposal("add", null, { ...desiredBlip(second), name: "Extra 2" }),
    proposal("add", null, { ...desiredBlip(second), name: "Extra 3" }),
  ];

  const items = prepareProposalsForReview(radar, raw);
  assert.equal(items.length, 7);
  assert.equal(items[0].valid, false);
  assert.equal(items[1].valid, true);
  assert.equal(items[2].valid, true);
  assert.equal(items[3].valid, false);
  assert.equal(items[4].valid, true);

  const before = structuredClone(radar);
  const result = applySelectedProposals(radar, items, [1, 2], { createId: () => "ES-26" });
  assert.equal(result.added, 1);
  assert.equal(result.updated, 1);
  assert.equal(result.draft.blips[0].ring, "Adopt");
  assert.equal(result.draft.blips.at(-1).id, "ES-26");
  assert.equal(result.draft.blips.at(-1).name, "Blip Selecionado");
  assert.deepEqual(radar, before);

  assert.throws(() => applySelectedProposals(radar, items, [1, 2, 4, 5, 6, 0]), /5/);
});

test("sanitizeHeaderFilename strips directories and non-ASCII characters safely", async () => {
  const { sanitizeHeaderFilename } = await import("../app-core.mjs");

  assert.equal(sanitizeHeaderFilename("C:\\docs\\Relatório Técnico 2026.pdf"), "Relatorio-Tecnico-2026.pdf");
  assert.equal(sanitizeHeaderFilename(""), "document.pdf");
});

test("wakeBackend retries /healthz until ready or 90s timeout", async () => {
  const { wakeBackend } = await import("../app-core.mjs");
  let nowMs = 0;
  let calls = 0;
  const waits = [];
  await wakeBackend({
    apiBase: "https://api.example.test",
    fetch: async (url) => {
      assert.equal(url, "https://api.example.test/healthz");
      calls++;
      if (calls < 3) throw new Error("cold start");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
    sleep: async (ms) => { waits.push(ms); nowMs += ms; },
    now: () => nowMs,
  });
  assert.equal(calls, 3);
  assert.equal(waits.length, 2);

  let expiredMs = 0;
  await assert.rejects(
    wakeBackend({
      apiBase: "https://api.example.test",
      timeoutMs: 90_000,
      fetch: async () => new Response(null, { status: 503 }),
      sleep: async (ms) => { expiredMs += ms; },
      now: () => expiredMs,
    }),
    /90/,
  );
});

test("wakeBackend aborts a health request that never settles at the global deadline", { timeout: 1000 }, async () => {
  const { wakeBackend } = await import("../app-core.mjs");
  let requestSignal;
  await assert.rejects(
    wakeBackend({
      apiBase: "https://api.example.test",
      timeoutMs: 20,
      intervalMs: 1,
      fetch: async (_url, init) => {
        requestSignal = init.signal;
        return new Promise(() => {});
      },
    }),
    { code: "backend_unavailable" },
  );
  assert.equal(requestSignal.aborted, true);
});

test("wakeBackend rejects an already-aborted caller before starting a request", async () => {
  const { wakeBackend } = await import("../app-core.mjs");
  const controller = new AbortController();
  const reason = new Error("cancelled before wake");
  controller.abort(reason);
  let calls = 0;
  await assert.rejects(
    wakeBackend({
      apiBase: "https://api.example.test",
      signal: controller.signal,
      fetch: async () => {
        calls++;
        return new Promise(() => {});
      },
    }),
    reason,
  );
  assert.equal(calls, 0);
});

test("pollAnalysisJob polls every 2s, reports progress, resolves on success and reports 404 restart", async () => {
  const { pollAnalysisJob } = await import("../app-core.mjs");
  const sleeps = [];
  const updates = [];
  const snapshots = [
    { status: 200, body: { ok: true, job: { id: "j1", status: "running", progress: { stage: "ocr", processedPages: 1, totalPages: 2 } } } },
    { status: 200, body: { ok: true, job: { id: "j1", status: "succeeded", progress: { stage: "succeeded", processedPages: 2, totalPages: 2 }, result: { proposals: [], totalPages: 2, ocrPages: 1 } } } },
  ];
  const job = await pollAnalysisJob({
    apiBase: "https://api.example.test",
    jobId: "j1",
    token: "secret-token",
    fetch: async (url, init) => {
      assert.equal(url, "https://api.example.test/api/v1/analysis-jobs/j1");
      assert.equal(init.headers.Authorization, "Bearer secret-token");
      const next = snapshots.shift();
      return Response.json(next.body, { status: next.status });
    },
    sleep: async (ms) => { sleeps.push(ms); },
    onUpdate: (snapshot) => updates.push(snapshot.status),
  });
  assert.equal(job.status, "succeeded");
  assert.deepEqual(sleeps, [2000]);
  assert.deepEqual(updates, ["running", "succeeded"]);

  await assert.rejects(
    pollAnalysisJob({
      apiBase: "https://api.example.test",
      jobId: "lost",
      token: "secret-token",
      fetch: async () => Response.json({ ok: false, error: "not_found" }, { status: 404 }),
      sleep: async () => {},
    }),
    { code: "job_lost" },
  );
});
