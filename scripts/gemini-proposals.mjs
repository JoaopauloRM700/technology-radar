import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function generateProposalFile(proposalPath, options = {}) {
  const root = options.root ?? process.cwd();
  const absoluteProposalPath = path.resolve(root, proposalPath);
  const briefPath = options.briefPath
    ? path.resolve(root, options.briefPath)
    : briefPathForProposalPath(absoluteProposalPath, root);
  const rawDir = path.join(root, "data", "ai-raw");

  await loadEnvFile(path.join(root, ".env"));
  await mkdir(path.dirname(absoluteProposalPath), { recursive: true });
  await mkdir(rawDir, { recursive: true });

  const existing = await readJson(absoluteProposalPath, null);
  const existingCount = Array.isArray(existing?.proposals) ? existing.proposals.length : 0;
  if (existingCount > 0 && !options.overwrite) {
    return {
      ok: true,
      skipped: true,
      reason: "propostas-existentes",
      proposalPath: relative(root, absoluteProposalPath),
      briefPath: relative(root, briefPath),
      proposals: existingCount,
      payload: existing,
    };
  }

  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) {
    return {
      ok: false,
      reason: "gemini-api-key-ausente",
      proposalPath: relative(root, absoluteProposalPath),
      briefPath: relative(root, briefPath),
      proposals: 0,
    };
  }

  if (!existsSync(briefPath)) {
    return {
      ok: false,
      reason: "brief-nao-encontrado",
      proposalPath: relative(root, absoluteProposalPath),
      briefPath: relative(root, briefPath),
      proposals: 0,
    };
  }

  const brief = await readFile(briefPath, "utf8");
  const response = await callGeminiForProposals(brief, {
    root,
    proposalPath: absoluteProposalPath,
    briefPath,
  });
  const rawPath = path.join(rawDir, `${path.basename(absoluteProposalPath, ".json")}-gemini-raw.txt`);
  await writeFile(rawPath, response.rawText, "utf8");

  if (!response.payload) {
    return {
      ok: false,
      reason: response.error ?? "resposta-json-invalida",
      proposalPath: relative(root, absoluteProposalPath),
      briefPath: relative(root, briefPath),
      rawPath: relative(root, rawPath),
      proposals: 0,
    };
  }

  const payload = {
    generatedAt: response.payload.generatedAt ?? new Date().toISOString(),
    generatedBy: "gemini",
    sourceBrief: relative(root, briefPath),
    proposals: Array.isArray(response.payload.proposals) ? response.payload.proposals : [],
  };
  await writeFile(absoluteProposalPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return {
    ok: true,
    proposalPath: relative(root, absoluteProposalPath),
    briefPath: relative(root, briefPath),
    rawPath: relative(root, rawPath),
    proposals: payload.proposals.length,
    payload,
  };
}

export async function loadEnvFile(filePath) {
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

export function briefPathForProposalPath(proposalPath, root = process.cwd()) {
  const absolute = path.resolve(root, proposalPath);
  return absolute
    .replace(`${path.sep}data${path.sep}pdf${path.sep}`, `${path.sep}docs${path.sep}`)
    .replace(/-proposals\.json$/, "-brief.md");
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
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch (error) {
    return { rawText: error.message, payload: null, error: "gemini-network-error" };
  }

  const bodyText = await response.text();
  if (!response.ok) {
    return { rawText: bodyText, payload: null, error: `gemini-http-${response.status}` };
  }

  const body = safeJsonParse(bodyText);
  const rawText = extractGeminiText(body) || bodyText;
  return { rawText, payload: parseJsonFromModelText(rawText) };
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

Arquivo de destino: ${relative(context.root, context.proposalPath)}
Brief de origem: ${relative(context.root, context.briefPath)}

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

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function relative(root, filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  const proposalArg = process.argv.find((arg) => arg.startsWith("--proposal="))?.slice("--proposal=".length);
  if (!proposalArg) {
    console.error("Uso: node scripts/gemini-proposals.mjs --proposal data/pdf/arquivo-proposals.json");
    process.exit(1);
  }
  const result = await generateProposalFile(proposalArg, { overwrite: process.argv.includes("--overwrite") });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 2);
}
