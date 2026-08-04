import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const args = process.argv.slice(2);

const discoveryScript = path.join(root, "scripts", "discover-sources.mjs");
const discoveryReportPath = path.join(root, "data", "discovery", "radar-discovery.json");
const pdfDataDir = path.join(root, "data", "pdf");
const consolidatedPath = path.join(root, "data", "radar-update-proposals.json");
const summaryPath = path.join(root, "docs", "radar-full-run-summary.md");
const rawAiDir = path.join(root, "data", "ai-raw");

const options = {
  skipDiscover: hasArg("--skip-discover"),
  failOnEmpty: hasArg("--fail-on-empty"),
  aiProvider: stringArg("--ai", ""),
  aiOverwrite: hasArg("--ai-overwrite"),
  aiLimit: numberArg("--ai-limit", Number.POSITIVE_INFINITY),
};

await loadEnvFile(path.join(root, ".env"));
await mkdir(path.dirname(consolidatedPath), { recursive: true });
await mkdir(path.dirname(summaryPath), { recursive: true });
await mkdir(rawAiDir, { recursive: true });

if (!options.skipDiscover) {
  const discoverArgs = filterOwnArgs(args);
  await runNode(discoveryScript, discoverArgs);
}

const discovery = await readJson(discoveryReportPath, null);
const aiResults = options.aiProvider
  ? await generateProposalsWithAi(options.aiProvider, { overwrite: options.aiOverwrite, limit: options.aiLimit })
  : [];
const proposalFiles = await findProposalFiles(pdfDataDir);
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
if (options.aiProvider) {
  console.log(`Arquivos processados por IA: ${aiResults.length}`);
  console.log(`Propostas geradas por IA: ${aiResults.reduce((total, item) => total + (item.proposals ?? 0), 0)}`);
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

async function generateProposalsWithAi(provider, config) {
  if (provider !== "gemini") {
    throw new Error(`Provedor de IA nao suportado: ${provider}. Use --ai gemini.`);
  }

  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY nao encontrada. Preencha o arquivo .env antes de usar --ai gemini.");
  }

  const files = await findProposalFiles(pdfDataDir);
  const results = [];
  let processed = 0;

  for (const proposalPath of files) {
    if (processed >= config.limit) break;

    const existing = await readJson(proposalPath, null);
    const existingCount = Array.isArray(existing?.proposals) ? existing.proposals.length : 0;
    if (existingCount > 0 && !config.overwrite) {
      results.push({
        proposalPath: relative(proposalPath),
        skipped: true,
        reason: "propostas-existentes",
        proposals: existingCount,
      });
      continue;
    }

    const briefPath = proposalPath.replace(new RegExp(`${escapeRegExp(`${path.sep}data${path.sep}pdf${path.sep}`)}`), `${path.sep}docs${path.sep}`).replace(/-proposals\.json$/, "-brief.md");
    if (!existsSync(briefPath)) {
      results.push({
        proposalPath: relative(proposalPath),
        skipped: true,
        reason: "brief-nao-encontrado",
        proposals: 0,
      });
      continue;
    }

    const brief = await readFile(briefPath, "utf8");
    const response = await callGeminiForProposals(brief, { proposalPath, briefPath });
    const rawPath = path.join(rawAiDir, `${path.basename(proposalPath, ".json")}-gemini-raw.txt`);
    await writeFile(rawPath, response.rawText, "utf8");

    if (!response.payload) {
      results.push({
        proposalPath: relative(proposalPath),
        briefPath: relative(briefPath),
        rawPath: relative(rawPath),
        ok: false,
        reason: response.error ?? "resposta-json-invalida",
        proposals: 0,
      });
      processed += 1;
      continue;
    }

    const normalized = {
      generatedAt: response.payload.generatedAt ?? new Date().toISOString(),
      generatedBy: "gemini",
      sourceBrief: relative(briefPath),
      proposals: Array.isArray(response.payload.proposals) ? response.payload.proposals : [],
    };

    await writeFile(proposalPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    results.push({
      proposalPath: relative(proposalPath),
      briefPath: relative(briefPath),
      rawPath: relative(rawPath),
      ok: true,
      proposals: normalized.proposals.length,
    });
    processed += 1;
  }

  return results;
}

async function callGeminiForProposals(brief, context) {
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const apiVersion = process.env.GEMINI_API_VERSION || "v1beta";
  const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(model)}:generateContent`;
  const prompt = buildGeminiPrompt(brief, context);

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": (process.env.GEMINI_API_KEY ?? "").trim(),
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: "Voce e um arquiteto estrategico de tecnologia. Retorne somente JSON valido, sem Markdown.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch (error) {
    return {
      rawText: error.message,
      payload: null,
      error: "gemini-network-error",
    };
  }

  const bodyText = await response.text();
  if (!response.ok) {
    return {
      rawText: bodyText,
      payload: null,
      error: `gemini-http-${response.status}`,
    };
  }

  const body = safeJsonParse(bodyText);
  const rawText = extractGeminiText(body) || bodyText;
  return {
    rawText,
    payload: parseJsonFromModelText(rawText),
  };
}

function buildGeminiPrompt(brief, context) {
  return `Analise o brief abaixo e gere propostas para o Radar Tecnologico de Engenharia de Software.

Regras adicionais:
- Retorne somente JSON valido.
- Se o brief nao tiver evidencia suficiente, retorne {"generatedAt":"${new Date().toISOString()}","proposals":[]}.
- Nao gere blips duplicados por sinonimo.
- Prefira 1 a 5 propostas de alta qualidade por PDF.
- Cada proposta deve conter action, reason, confidence, evidence e blip.
- Use exatamente os valores permitidos pelo brief para quadrante, anel, horizonte, maturidade, risco e esforco.
- Em evidence.url, use a URL ou file:// do proprio brief quando disponivel.
- Em blip.detailsUrl, use uma URL publica quando existir; caso contrario, deixe string vazia.

Arquivo de destino: ${relative(context.proposalPath)}
Brief de origem: ${relative(context.briefPath)}

${brief}`;
}

function extractGeminiText(body) {
  const parts = body?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => part.text ?? "").join("").trim();
}

function parseJsonFromModelText(text) {
  const direct = safeJsonParse(text);
  if (direct) return direct;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const parsed = safeJsonParse(fenced[1]);
    if (parsed) return parsed;
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return safeJsonParse(text.slice(start, end + 1));
  }
  return null;
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
  if (proposal.id) return `${action}:id:${proposal.id}`;
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
          if (item.ok) return `- ${item.proposalPath}: ${item.proposals} proposta(s), raw: ${item.rawPath}`;
          return `- ${item.proposalPath}: falhou (${item.reason}), raw: ${item.rawPath ?? "n/a"}`;
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

## Execucao com IA

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

async function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = await readFile(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalize(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function relative(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}
