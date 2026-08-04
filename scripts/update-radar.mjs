import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const sourcePath = path.join(root, "data", "monitored-sources.json");
const signalsPath = path.join(root, "data", "radar-signals.json");
const briefPath = path.join(root, "docs", "radar-ai-update-brief.md");
const proposalsPath = path.join(root, "data", "radar-update-proposals.json");

const KEYWORDS = [
  "agent",
  "agentic",
  "coding agent",
  "AI-assisted",
  "AI generated",
  "LLM",
  "MCP",
  "prompt injection",
  "security",
  "governance",
  "testing",
  "mutation",
  "fuzz",
  "quality",
  "DORA",
  "DevOps",
  "platform engineering",
  "supply chain",
  "SBOM",
  "SLSA",
  "observability",
  "OpenTelemetry",
  "FinOps",
  "technical debt",
  "cognitive debt"
];

await mkdir(path.dirname(signalsPath), { recursive: true });
await mkdir(path.dirname(briefPath), { recursive: true });

const sources = JSON.parse(await readFile(sourcePath, "utf8"));
const signals = args.has("--offline") || args.has("--brief")
  ? await offlineSignals(sources)
  : await scanSources(sources);

await writeFile(signalsPath, `${JSON.stringify(signals, null, 2)}\n`, "utf8");
await writeFile(briefPath, buildBrief(signals), "utf8");

if (!(await exists(proposalsPath))) {
  await writeFile(
    proposalsPath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), proposals: [] }, null, 2)}\n`,
    "utf8"
  );
}

console.log("Radar update scan concluído.");
console.log(`Sinais: ${relative(signalsPath)}`);
console.log(`Brief para IA: ${relative(briefPath)}`);
console.log(`Propostas para importar no app: ${relative(proposalsPath)}`);
console.log(`Próximo passo: cole o brief em uma IA e salve a resposta JSON em ${relative(proposalsPath)}.`);

async function scanSources(items) {
  const settled = await Promise.allSettled(items.map(scanSource));
  return {
    generatedAt: new Date().toISOString(),
    mode: "scan",
    sources: settled.map((result, index) => {
      if (result.status === "fulfilled") return result.value;
      return {
        ...items[index],
        ok: false,
        error: result.reason?.message ?? String(result.reason),
        signals: []
      };
    })
  };
}

async function scanSource(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "user-agent": "TechnologyRadarUpdater/0.1 (+local P&D radar; human-reviewed proposals)",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8"
      }
    });
    const html = await response.text();
    const text = htmlToText(html);
    return {
      ...source,
      ok: response.ok,
      status: response.status,
      fetchedAt: new Date().toISOString(),
      title: extractTitle(html),
      signals: extractSignals(text)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function offlineSignals(items) {
  return {
    generatedAt: new Date().toISOString(),
    mode: "offline",
    sources: items.map((source) => ({
      ...source,
      ok: null,
      fetchedAt: null,
      title: source.name,
      signals: source.themes.map((theme) => ({
        keyword: theme,
        snippet: `Monitorar evidências sobre ${theme} em ${source.name}.`
      }))
    }))
  };
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return normalize(match?.[1] ?? "");
}

function htmlToText(html) {
  return normalize(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
  );
}

function extractSignals(text) {
  const lower = text.toLowerCase();
  const signals = [];
  for (const keyword of KEYWORDS) {
    const index = lower.indexOf(keyword.toLowerCase());
    if (index === -1) continue;
    const start = Math.max(0, index - 180);
    const end = Math.min(text.length, index + keyword.length + 280);
    signals.push({
      keyword,
      snippet: normalize(text.slice(start, end))
    });
    if (signals.length >= 10) break;
  }
  return signals;
}

function buildBrief(payload) {
  const sourceBlocks = payload.sources
    .map((source) => {
      const signalLines = source.signals.length
        ? source.signals.map((signal) => `- ${signal.keyword}: ${signal.snippet}`).join("\n")
        : "- Nenhum sinal relevante extraído automaticamente.";
      return `### ${source.name}

- URL: ${source.url}
- Força da fonte: ${source.strength}
- Status da coleta: ${source.ok === false ? `falha (${source.error ?? source.status})` : "ok"}
- Título detectado: ${source.title ?? "n/a"}

${signalLines}`;
    })
    .join("\n\n");

  return `# Brief para Atualização Assistida por IA do Radar Tecnológico

Data da coleta: ${payload.generatedAt}

Você é um arquiteto estratégico de tecnologia. Analise os sinais abaixo e proponha mudanças para o Radar Tecnológico de Engenharia de Software.

Regras obrigatórias:

- Não aplique mudanças automaticamente.
- Proponha apenas ações com evidência explícita nas fontes.
- Use "add" para novo blip, "update" para mudar um blip existente e "remove" apenas se houver forte justificativa.
- Preserve o modelo Thoughtworks Radar: quadrantes Técnicas, Plataformas, Ferramentas, Linguagens e Frameworks; anéis Adopt, Trial, Assess, Caution.
- Preserve o TRM: horizonte Curto, Médio, Longo; maturidade Experimental, Emergente, Madura; risco Baixo, Médio, Alto; esforço Baixo, Médio, Alto.
- Seja conservador para Adopt; para P&D, prefira Trial ou Assess quando houver incerteza.
- Para riscos agentic/LLM, considere OWASP e NIST antes de promoção.

Retorne somente JSON válido no seguinte formato:

\`\`\`json
{
  "generatedAt": "${new Date().toISOString()}",
  "proposals": [
    {
      "action": "update",
      "id": "ES-16",
      "reason": "Explique a razão da proposta.",
      "confidence": 0.72,
      "evidence": [
        {
          "source": "Nome da fonte",
          "url": "https://...",
          "note": "Evidência resumida"
        }
      ],
      "changes": {
        "ring": "Trial",
        "horizon": "Médio",
        "maturity": "Emergente",
        "risk": "Médio",
        "effort": "Alto",
        "status": "Monitorar",
        "strategic": "Justificativa estratégica atualizada.",
        "constraints": "Gargalos e contraindicações atualizados."
      }
    },
    {
      "action": "add",
      "reason": "Explique a razão da proposta.",
      "confidence": 0.64,
      "evidence": [
        {
          "source": "Nome da fonte",
          "url": "https://...",
          "note": "Evidência resumida"
        }
      ],
      "blip": {
        "name": "Nome do novo blip",
        "quadrant": "Técnicas",
        "ring": "Assess",
        "horizon": "Médio",
        "maturity": "Experimental",
        "risk": "Médio",
        "effort": "Médio",
        "status": "Monitorar",
        "source": "Fonte principal",
        "theme": "Tema",
        "strategic": "Por que avaliar nesta organização.",
        "constraints": "Gargalos e contraindicações."
      }
    }
  ]
}
\`\`\`

## Sinais coletados

${sourceBlocks}
`;
}

function normalize(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function relative(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

async function exists(filePath) {
  try {
    await readFile(filePath, "utf8");
    return true;
  } catch {
    return false;
  }
}
