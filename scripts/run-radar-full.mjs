import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createNvidiaNimClient, NvidiaNimError } from "./lib/nvidia-nim.mjs";
import { generateProposalFile, loadEnvFile } from "./nim-proposals.mjs";

const root = process.cwd();
const args = process.argv.slice(2);

const discoveryScript = path.join(root, "scripts", "discover-sources.mjs");
const discoveryReportPath = path.join(root, "data", "discovery", "radar-discovery.json");
const pdfDataDir = path.join(root, "data", "pdf");
const consolidatedPath = path.join(root, "data", "radar-update-proposals.json");
const summaryPath = path.join(root, "docs", "radar-full-run-summary-current.md");

const options = {
  skipDiscover: hasArg("--skip-discover"),
  failOnEmpty: hasArg("--fail-on-empty"),
  aiProvider: stringArg("--ai", ""),
  aiOverwrite: hasArg("--ai-overwrite"),
  aiLimit: numberArg("--ai-limit", Number.POSITIVE_INFINITY),
};

if (hasArg("--help") || hasArg("-h")) {
  console.log("Uso: node scripts/run-radar-full.mjs [--skip-discover] [--fail-on-empty] [--ai nim] [--ai-overwrite] [--ai-limit N]");
  process.exit(0);
}

const aiRequested = args.some((arg) => arg === "--ai" || arg.startsWith("--ai="));
if (aiRequested && options.aiProvider !== "nim") {
  console.error("Provedor de IA inválido. Use --ai nim.");
  process.exit(2);
}

await loadEnvFile(path.join(root, ".env"));
let nim;
if (aiRequested) {
  try {
    nim = createNvidiaNimClient();
  } catch (error) {
    if (!(error instanceof NvidiaNimError)) throw error;
    console.error(error.message);
    process.exit(2);
  }
}

await mkdir(path.dirname(consolidatedPath), { recursive: true });
await mkdir(path.dirname(summaryPath), { recursive: true });

if (!options.skipDiscover) {
  const discoverArgs = filterOwnArgs(args);
  await runNode(discoveryScript, discoverArgs);
}

const discovery = await readJson(discoveryReportPath, null);
const proposalFiles = await findProposalFiles(pdfDataDir);
const aiResults = nim
  ? await generateProposalsWithAi(nim, proposalFiles, { overwrite: options.aiOverwrite, limit: options.aiLimit })
  : [];
const proposalBatches = await readProposalBatches(proposalFiles);
const consolidated = consolidateProposalBatches(proposalBatches);
const summary = buildSummary({ discovery, proposalBatches, consolidated, aiResults });

await writeFile(consolidatedPath, `${JSON.stringify(consolidated, null, 2)}\n`, "utf8");
await writeFile(summaryPath, summary, "utf8");

if (options.failOnEmpty && consolidated.proposals.length === 0) {
  console.error("Nenhuma proposta encontrada para consolidar.");
  console.error(`Resumo: ${relative(summaryPath)}`);
  process.exit(2);
}

console.log("Pipeline completo do Radar concluido.");
if (discovery) {
  const downloads = discovery.sources.flatMap((source) => source.downloads ?? []);
  console.log(`Fontes verificadas: ${discovery.sources.length}`);
  console.log(`PDFs baixados ou em cache: ${downloads.filter((item) => item.path).length}`);
  console.log(`PDFs analisados: ${downloads.filter((item) => item.analysis?.ok).length}`);
}
console.log(`Arquivos de propostas encontrados: ${proposalBatches.length}`);
if (nim) {
  const processed = aiResults.filter((item) => !item.skipped);
  console.log(`Arquivos processados por NVIDIA NIM: ${processed.length}`);
  console.log(`Propostas geradas por NVIDIA NIM: ${processed.reduce((total, item) => total + item.proposals, 0)}`);
}
console.log(`Propostas consolidadas: ${consolidated.proposals.length}`);
console.log(`Arquivo para importar no app: ${relative(consolidatedPath)}`);
console.log(`Resumo executivo do run: ${relative(summaryPath)}`);

function runNode(scriptPath, scriptArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...scriptArgs], {
      cwd: root,
      stdio: "inherit",
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(scriptPath)} terminou com codigo ${code}`));
    });
  });
}

async function findProposalFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = await readdir(directory, { withFileTypes: true });
  return files
    .filter((entry) => entry.isFile() && entry.name.endsWith("-proposals.json"))
    .map((entry) => path.join(directory, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

async function readProposalBatches(files) {
  const batches = [];
  for (const file of files) {
    const payload = await readJson(file, null);
    if (!payload) {
      batches.push({ file, ok: false, proposals: [], error: "JSON invalido" });
      continue;
    }
    const proposals = Array.isArray(payload.proposals) ? payload.proposals : [];
    batches.push({
      file,
      ok: true,
      generatedAt: payload.generatedAt ?? null,
      source: payload.source ?? null,
      proposals,
    });
  }
  return batches;
}

async function generateProposalsWithAi(client, files, { overwrite, limit }) {
  const results = [];
  let processed = 0;

  for (const proposalPath of files) {
    if (processed >= limit) break;
    const result = await generateProposalFile(proposalPath, { root, client, overwrite });
    results.push(result);
    if (!result.skipped) processed += 1;
  }
  return results;
}

function consolidateProposalBatches(batches) {
  const byKey = new Map();
  const sourceFiles = [];

  for (const batch of batches) {
    sourceFiles.push({
      file: relative(batch.file),
      ok: batch.ok,
      proposals: batch.proposals.length,
    });

    for (const proposal of batch.proposals) {
      const normalized = normalizeProposal(proposal, batch.file);
      const key = proposalKey(normalized);
      const current = byKey.get(key);
      if (!current || confidence(normalized) > confidence(current)) {
        byKey.set(key, normalized);
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/run-radar-full.mjs",
    sourceFiles,
    proposals: [...byKey.values()].sort((a, b) => proposalSortKey(a).localeCompare(proposalSortKey(b))),
  };
}

function normalizeProposal(proposal, sourceFile) {
  const copy = structuredClone(proposal);
  copy.sourceProposalFile = relative(sourceFile);
  if (copy.blip) {
    copy.blip.name = normalize(copy.blip.name);
  }
  return copy;
}

function proposalKey(proposal) {
  const action = String(proposal.action ?? "add").toLowerCase();
  const target = proposal.targetId ?? proposal.id;
  if (target) return `${action}:id:${target}`;
  const name = normalize(proposal.blip?.name ?? proposal.name ?? "");
  return `${action}:name:${name.toLowerCase()}`;
}

function proposalSortKey(proposal) {
  return `${String(proposal.action ?? "add").toLowerCase()} ${proposal.blip?.quadrant ?? ""} ${proposal.blip?.ring ?? ""} ${proposal.blip?.name ?? proposal.id ?? ""}`;
}

function confidence(proposal) {
  const value = Number(proposal.confidence);
  return Number.isFinite(value) ? value : 0;
}

function buildSummary({ discovery, proposalBatches, consolidated, aiResults }) {
  const discoveryLines = discovery
    ? [
        `- Motor: ${discovery.engine} (${discovery.engineNote})`,
        `- Fontes verificadas: ${discovery.sources.length}`,
        `- Candidatos PDF: ${discovery.sources.reduce((total, source) => total + source.pdfCandidates.length, 0)}`,
        `- PDFs baixados ou em cache: ${discovery.sources.flatMap((source) => source.downloads ?? []).filter((item) => item.path).length}`,
        `- PDFs analisados: ${discovery.sources.flatMap((source) => source.downloads ?? []).filter((item) => item.analysis?.ok).length}`,
      ].join("\n")
    : "- Descoberta nao executada neste run.";

  const filled = proposalBatches.filter((batch) => batch.proposals.length > 0);
  const empty = proposalBatches.filter((batch) => batch.ok && batch.proposals.length === 0);
  const invalid = proposalBatches.filter((batch) => !batch.ok);

  const filledLines = filled.length
    ? filled.map((batch) => `- ${relative(batch.file)}: ${batch.proposals.length} proposta(s)`).join("\n")
    : "- Nenhum arquivo com propostas preenchidas.";

  const emptyLines = empty.length
    ? empty.map((batch) => `- ${relative(batch.file)}`).join("\n")
    : "- Nenhum arquivo vazio.";

  const invalidLines = invalid.length
    ? invalid.map((batch) => `- ${relative(batch.file)}: ${batch.error}`).join("\n")
    : "- Nenhum JSON invalido.";

  const aiLines = aiResults.length
    ? aiResults
        .map((item) => {
          if (item.skipped) return `- ${item.proposalPath}: ignorado (${item.reason}), ${item.proposals} proposta(s) existentes`;
          if (item.ok) return `- ${item.proposalPath}: ${item.proposals} proposta(s)`;
          return `- ${item.proposalPath}: falhou (${item.reason})`;
        })
        .join("\n")
    : "- IA nao executada neste run.";

  return `# Resumo do Pipeline Completo do Radar

Data: ${new Date().toISOString()}

## Descoberta

${discoveryLines}

## Propostas Consolidadas

- Arquivo para importar no app: \`${relative(consolidatedPath)}\`
- Total consolidado: ${consolidated.proposals.length}

## Execucao com NVIDIA NIM

${aiLines}

### Arquivos preenchidos

${filledLines}

### Arquivos ainda vazios

${emptyLines}

### Arquivos invalidos

${invalidLines}

## Proximo passo

1. Abra \`index.html\`.
2. Clique em **Importar Propostas**.
3. Selecione \`${relative(consolidatedPath)}\`.
4. Revise os blips no editor lateral.
5. Exporte o Markdown final.

Observacao: este comando nao aplica mudancas automaticamente ao radar visual. A aprovacao humana continua sendo a trava de governanca antes da alteracao do radar.
`;
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function hasArg(name) {
  return args.includes(name);
}

function stringArg(name, fallback) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  if (index !== -1 && args[index + 1]) return args[index + 1];
  return fallback;
}

function numberArg(name, fallback) {
  const value = Number(stringArg(name, ""));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function filterOwnArgs(values) {
  const skipNextFor = new Set(["--ai", "--ai-limit"]);
  const passthrough = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (["--skip-discover", "--fail-on-empty", "--ai-overwrite"].includes(value)) continue;
    if (skipNextFor.has(value)) {
      index += 1;
      continue;
    }
    if (value.startsWith("--ai=") || value.startsWith("--ai-limit=")) continue;
    passthrough.push(value);
  }
  return passthrough;
}

function normalize(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function relative(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}
