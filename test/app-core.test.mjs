import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const loadCanonical = async () => JSON.parse(await readFile(new URL("../data/radar.json", import.meta.url), "utf8"));

test("loads the canonical radar and normalizes a detached copy", async () => {
  const radar = await loadCanonical();
  const { normalizeRadar } = await import("../app-core.mjs");
  assert.equal(radar.blips.length, 25);
  assert.equal(radar.sources.length, 12);
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
