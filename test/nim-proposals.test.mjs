import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

async function fakeWorkspace(t) {
  const root = await mkdtemp(path.join(process.cwd(), ".test-nim-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "data", "pdf"), { recursive: true });
  await mkdir(path.join(root, "docs"), { recursive: true });
  return root;
}

const proposalPath = "data/pdf/sample-proposals.json";
const briefPath = "docs/sample-brief.md";
const apiKey = "fixture-key-never-log-123";

test("gerador preserva propostas existentes e sobrescreve lotes atuais apenas quando solicitado", async (t) => {
  const { generateProposalFile } = await import("../scripts/nim-proposals.mjs");
  const { createNvidiaNimClient } = await import("../scripts/lib/nvidia-nim.mjs");
  const root = await fakeWorkspace(t);
  const filePath = path.join(root, proposalPath);
  const existing = '{"proposals":[{"action":"add"}]}\n';
  await writeFile(filePath, existing);
  await writeFile(path.join(root, briefPath), "Trecho do brief de teste.");

  let calls = 0;
  const client = createNvidiaNimClient({
    env: { NVIDIA_API_KEY: apiKey },
    async fetch(url, { body }) {
      calls++;
      assert.equal(JSON.parse(body).messages[1].content, "Trecho do brief de teste.");
      return Response.json({ choices: [{ message: { content: '{"proposals":[]}' } }] });
    },
  });

  const skipped = await generateProposalFile(proposalPath, { root, client });
  assert.deepEqual([skipped.ok, skipped.skipped, skipped.reason], [true, true, "propostas-existentes"]);
  assert.equal(await readFile(filePath, "utf8"), existing);
  assert.equal(calls, 0);

  const result = await generateProposalFile(proposalPath, { root, client, overwrite: true });
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
  const { generatedAt, ...payload } = JSON.parse(await readFile(filePath, "utf8"));
  assert.equal(new Date(generatedAt).toISOString(), generatedAt);
  assert.deepEqual(payload, { generatedBy: "nvidia-nim", sourceBrief: briefPath, proposals: [] });
});

test("gerador mantém os bytes do lote existente quando NIM falha", async (t) => {
  const { generateProposalFile } = await import("../scripts/nim-proposals.mjs");
  const { createNvidiaNimClient } = await import("../scripts/lib/nvidia-nim.mjs");
  const root = await fakeWorkspace(t);
  const filePath = path.join(root, proposalPath);
  const existing = '{"proposals":[{"action":"add"}]}\n';
  await writeFile(filePath, existing);
  await writeFile(path.join(root, briefPath), "Trecho do brief de teste.");

  const client = createNvidiaNimClient({
    env: { NVIDIA_API_KEY: apiKey },
    fetch: async () => new Response(apiKey, { status: 503 }),
  });
  const result = await generateProposalFile(proposalPath, { root, client, overwrite: true });
  assert.deepEqual([result.ok, result.reason], [false, "nvidia-nim-http"]);
  assert.ok(!JSON.stringify(result).includes(apiKey));
  assert.equal(await readFile(filePath, "utf8"), existing);
});

test("gerador mantém lote histórico Gemini inclusive com overwrite", async (t) => {
  const { generateProposalFile } = await import("../scripts/nim-proposals.mjs");
  const root = await fakeWorkspace(t);
  const filePath = path.join(root, proposalPath);
  const existing = '{"generatedBy":"gemini","proposals":[]}\n';
  await writeFile(filePath, existing);

  const result = await generateProposalFile(proposalPath, { root, overwrite: true });
  assert.deepEqual([result.ok, result.skipped, result.reason], [true, true, "artefato-historico"]);
  assert.equal(await readFile(filePath, "utf8"), existing);
});

function runCli(root, env, ...args) {
  const script = fileURLToPath(new URL("../scripts/run-radar-full.mjs", import.meta.url));
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NVIDIA_API_KEY: "", ...env },
  });
}

test("CLI aceita NIM e preserva o resumo histórico Gemini", async (t) => {
  const root = await fakeWorkspace(t);
  const oldPath = path.join(root, "docs", "radar-full-run-summary.md");
  const existing = "Resumo anterior com Gemini.\n";
  await writeFile(oldPath, existing);
  await writeFile(path.join(root, ".env"), `NVIDIA_API_KEY=${apiKey}\n`);

  const result = runCli(root, {}, "--skip-discover", "--ai", "nim");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Pipeline completo/);
  assert.equal(await readFile(oldPath, "utf8"), existing);
  assert.match(await readFile(path.join(root, "docs", "radar-full-run-summary-current.md"), "utf8"), /Resumo do Pipeline/);
});

test("CLI rejeita Gemini e flags de IA sem valor antes da descoberta", async (t) => {
  const root = await fakeWorkspace(t);
  for (const args of [["--ai", "gemini"], ["--ai"], ["--ai="]]) {
    const result = runCli(root, {}, ...args);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /Use --ai nim/);
  }
});

test("CLI exige NVIDIA_API_KEY antes da descoberta somente quando NIM está ativo", async (t) => {
  const root = await fakeWorkspace(t);
  const missingKey = runCli(root, {}, "--ai=nim");
  assert.equal(missingKey.status, 2, missingKey.stderr);
  assert.match(missingKey.stderr, /NVIDIA_API_KEY/);

  const noAi = runCli(root, {}, "--skip-discover");
  assert.equal(noAi.status, 0, noAi.stderr);
});

test("ajuda da CLI apresenta o provedor ativo sem iniciar a descoberta", async (t) => {
  const root = await fakeWorkspace(t);
  const result = runCli(root, {}, "--help");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--ai nim/);
});

test("gerador CLI aceita o caminho separado de --proposal e exige a chave antes do brief", async (t) => {
  const root = await fakeWorkspace(t);
  const script = fileURLToPath(new URL("../scripts/nim-proposals.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script, "--proposal", proposalPath], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NVIDIA_API_KEY: "" },
  });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stdout, /NVIDIA_API_KEY/);
});

test("consolidação distingue alvos NIM e mantém compatibilidade com alvos antigos", async (t) => {
  const root = await fakeWorkspace(t);
  const data = { proposals: [
    { action: "update", targetId: "ES-01", blip: { name: "Novo nome" }, confidence: 0.8 },
    { action: "update", targetId: "ES-02", blip: { name: "Novo nome" }, confidence: 0.7 },
    { action: "update", id: "ES-01", confidence: 0.6 },
  ] };
  await writeFile(path.join(root, proposalPath), JSON.stringify(data));

  const result = runCli(root, {}, "--skip-discover");
  assert.equal(result.status, 0, result.stderr);
  const { proposals } = JSON.parse(await readFile(path.join(root, "data", "radar-update-proposals.json"), "utf8"));
  assert.deepEqual(proposals.map(({ targetId }) => targetId).sort(), ["ES-01", "ES-02"]);
});
