import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

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

async function preload(root, source) {
  const file = path.join(root, "fixture-preload.mjs");
  await writeFile(file, source);
  return pathToFileURL(file).href;
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

test("gerador CLI rejeita o destino histórico antes de ler ou chamar NVIDIA NIM", async (t) => {
  const root = await fakeWorkspace(t);
  const script = fileURLToPath(new URL("../scripts/nim-proposals.mjs", import.meta.url));
  const hook = await preload(root, `
    import fs from "node:fs/promises";
    import { appendFileSync } from "node:fs";
    import { syncBuiltinESMExports } from "node:module";
    import path from "node:path";

    const readFile = fs.readFile;
    fs.readFile = (file, ...options) => {
      if (typeof file === "string" && path.resolve(file) === path.resolve(process.argv[3])) {
        appendFileSync("events.txt", "read\\n");
      }
      return readFile(file, ...options);
    };
    syncBuiltinESMExports();

    globalThis.fetch = async () => {
      appendFileSync("events.txt", "fetch\\n");
      return Response.json({ choices: [{ message: { content: '{"proposals":[]}' } }] });
    };
  `);
  for (const destination of ["docs/radar-full-run-summary.md", "docs/archive-proposals.json", "data/pdf/sample-signals.json"]) {
    const existing = Buffer.from("Conteúdo histórico Gemini.\r\n");
    await writeFile(path.join(root, destination), existing);
    const result = spawnSync(process.execPath, ["--import", hook, script, "--proposal", destination], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, NVIDIA_API_KEY: apiKey },
    });
    assert.deepEqual(await readFile(path.join(root, destination)), existing);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stdout, /destino-propostas-invalido/);
  }
  await assert.rejects(readFile(path.join(root, "events.txt")), { code: "ENOENT" });
});

async function discoveryFixture(t, sources) {
  const root = await fakeWorkspace(t);
  await mkdir(path.join(root, "scripts", "lib"), { recursive: true });
  for (const script of ["discover-sources.mjs", "analyze-pdf.mjs", "lib/run-pdf-analyzer.mjs"]) {
    await copyFile(new URL(`../scripts/${script}`, import.meta.url), path.join(root, "scripts", script));
  }
  const monitored = sources.map(({ name, url }) => ({ name, url, strategy: "fetch" }));
  await writeFile(path.join(root, "data", "monitored-sources.json"), JSON.stringify(monitored));
  const hook = await preload(root, `
    const sources = ${JSON.stringify(sources)};
    globalThis.fetch = async (url) => {
      for (const source of sources) {
        if (url === source.url) return new Response('<a href="/' + source.filename + '">PDF</a>');
        if (url === source.url + source.filename) {
          const pdf = "%PDF-1.4\\n<<>>\\nstream\\nBT /F1 12 Tf (" + source.text + ") Tj ET\\nendstream\\n%%EOF\\n";
          return new Response(pdf, { headers: { "Content-Type": "application/pdf" } });
        }
      }
      throw new Error("URL inesperada");
    };
  `);
  const runPipeline = async (...args) => {
    const result = runCli(root, { NODE_OPTIONS: `--import=${hook}` }, "--fetch-only", ...args);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(await readFile(path.join(root, "data/discovery/radar-discovery.json"), "utf8"));
    const { downloads: [download] } = report.sources[0];
    assert.equal(download.analysis.ok, true, download.analysis.stderr);
    return download;
  };
  return { root, runPipeline };
}

test("pipeline reusa as saídas de um PDF em cache e completa saídas ausentes", async (t) => {
  const { root, runPipeline } = await discoveryFixture(t, [
    { name: "Fonte de teste", url: "https://example.org/", filename: "sample.pdf", text: "Tecnologia piloto" },
  ]);
  const historicalSummaryPath = "docs/radar-full-run-summary.md";
  const historicalSummary = Buffer.from("Resumo histórico Gemini.\r\n");
  await writeFile(path.join(root, historicalSummaryPath), historicalSummary);
  const first = await runPipeline();
  assert.equal(first.downloaded, true);
  assert.match(await readFile(path.join(root, first.analysis.textPath), "utf8"), /Tecnologia piloto/);
  assert.equal(JSON.parse(await readFile(path.join(root, proposalPath), "utf8")).proposals.length, 0);

  const preserved = new Map([
    ["data/pdf/sample.txt", Buffer.from("Texto histórico Gemini.\r\n")],
    ["data/pdf/sample-signals.json", await readFile(path.join(root, first.analysis.signalsPath))],
    [briefPath, Buffer.from("# Brief histórico Gemini\r\n")],
    [proposalPath, Buffer.from('{"generatedBy":"gemini","proposals":[]}\r\n')],
  ]);
  for (const [file, content] of preserved) await writeFile(path.join(root, file), content);
  preserved.set(historicalSummaryPath, historicalSummary);

  const second = await runPipeline();
  assert.equal(second.reason, "cached-url");
  for (const [file, content] of preserved) {
    assert.deepEqual(await readFile(path.join(root, file)), content, file);
  }

  await rm(path.join(root, briefPath));
  preserved.delete(briefPath);
  const third = await runPipeline();
  assert.equal(third.reason, "cached-url");
  assert.match(await readFile(path.join(root, briefPath), "utf8"), /Brief para IA/);
  for (const [file, content] of preserved) {
    assert.deepEqual(await readFile(path.join(root, file)), content, file);
  }

  const legacySignals = Buffer.from('{"version":"histórico Gemini"}\r\n');
  await writeFile(path.join(root, first.analysis.signalsPath), legacySignals);
  preserved.set(first.analysis.signalsPath, legacySignals);
  preserved.set(briefPath, await readFile(path.join(root, briefPath)));
  const legacy = await runPipeline();
  assert.notEqual(legacy.analysis.textPath, first.analysis.textPath);
  assert.match(await readFile(path.join(root, legacy.analysis.textPath), "utf8"), /Tecnologia piloto/);
  assert.match(legacy.analysis.textPath, /^data\/pdf\/sample-[a-f\d]+\.txt$/);
  for (const [file, content] of preserved) {
    assert.deepEqual(await readFile(path.join(root, file)), content, file);
  }
});

test("PDFs homônimos de fontes distintas mantêm evidências e arquivos próprios", async (t) => {
  const { root, runPipeline } = await discoveryFixture(t, [
    { name: "Fonte Alfa", url: "https://alfa.example.org/", filename: "report.pdf", text: "Observability Tecnologia alfa" },
    { name: "Fonte Beta", url: "https://beta.example.org/", filename: "report.pdf", text: "Observability Tecnologia beta" },
  ]);
  async function readOutputs({ analysis }) {
    return Promise.all(["textPath", "signalsPath", "briefPath", "proposalsPath"]
      .map(async (key) => [analysis[key], await readFile(path.join(root, analysis[key]), "utf8")]));
  }

  const alfa = await runPipeline("--source", "Alfa");
  const alfaOutputs = await readOutputs(alfa);
  assert.match(alfaOutputs[0][1], /Tecnologia alfa/);

  const beta = await runPipeline("--source", "Beta");
  const betaOutputs = await readOutputs(beta);
  assert.notEqual(beta.sha256, alfa.sha256);
  assert.notEqual(beta.path, alfa.path);
  assert.equal(path.basename(beta.path), path.basename(alfa.path));
  assert.match(betaOutputs[0][1], /Tecnologia beta/);

  const cachedAlfa = await runPipeline("--source", "Alfa");
  assert.equal(cachedAlfa.reason, "cached-url");
  const cachedAlfaOutputs = await readOutputs(cachedAlfa);
  assert.match(cachedAlfaOutputs[0][1], /Tecnologia alfa/);
  assert.match(cachedAlfaOutputs[2][1], /Tecnologia alfa/);
  assert.deepEqual(cachedAlfaOutputs, alfaOutputs);
  const cachedBeta = await runPipeline("--source", "Beta");
  assert.equal(cachedBeta.reason, "cached-url");
  assert.deepEqual(await readOutputs(cachedBeta), betaOutputs);
  assert.equal(new Set([...alfaOutputs, ...betaOutputs].map(([file]) => file)).size, 8);
  for (const [download, outputs] of [[alfa, alfaOutputs], [beta, betaOutputs]]) {
    assert.equal(JSON.parse(outputs[1][1]).sourceSha256, download.sha256);
  }
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
