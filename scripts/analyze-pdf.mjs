import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const inputPath = process.argv.slice(2).join(" ").trim();

if (!inputPath) {
  console.error('Uso: npm.cmd run radar:pdf -- "D:\\Downloads\\arquivo.pdf"');
  process.exit(1);
}

const resolvedPdf = path.resolve(inputPath);
const outputDir = path.join(root, "data", "pdf");
const briefDir = path.join(root, "docs");
const textPath = path.join(outputDir, `${safeName(path.basename(resolvedPdf, ".pdf"))}.txt`);
const signalsPath = path.join(outputDir, `${safeName(path.basename(resolvedPdf, ".pdf"))}-signals.json`);
const briefPath = path.join(briefDir, `${safeName(path.basename(resolvedPdf, ".pdf"))}-brief.md`);
const proposalsPath = path.join(outputDir, `${safeName(path.basename(resolvedPdf, ".pdf"))}-proposals.json`);

await mkdir(outputDir, { recursive: true });
await mkdir(briefDir, { recursive: true });

const pdfBytes = await readFile(resolvedPdf);
const extractedText = extractPdfText(pdfBytes);
const normalizedText = normalize(extractedText);
const signals = buildPdfSignals(normalizedText);
const payload = {
  generatedAt: new Date().toISOString(),
  source: resolvedPdf,
  textLength: normalizedText.length,
  extractionMode: "local-pdf-text-layer",
  signals,
};

await writeFile(textPath, `${normalizedText}\n`, "utf8");
await writeFile(signalsPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
await writeFile(briefPath, buildBrief(payload), "utf8");

if (!(await exists(proposalsPath))) {
  await writeFile(
    proposalsPath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), proposals: [] }, null, 2)}\n`,
    "utf8"
  );
}

console.log("Análise de PDF concluída.");
console.log(`Texto extraído: ${relative(textPath)}`);
console.log(`Sinais: ${relative(signalsPath)}`);
console.log(`Brief para IA: ${relative(briefPath)}`);
console.log(`Propostas para importar no app: ${relative(proposalsPath)}`);
console.log("Próximo passo: cole o brief em uma IA, salve o JSON de resposta no arquivo de propostas e importe no app.");

function extractPdfText(buffer) {
  const raw = buffer.toString("latin1");
  const chunks = [];
  const streamRegex = /<<(.*?)>>\s*stream/gms;
  let match;

  while ((match = streamRegex.exec(raw)) !== null) {
    const dict = match[1];
    let start = streamRegex.lastIndex;
    if (raw[start] === "\r" && raw[start + 1] === "\n") start += 2;
    else if (raw[start] === "\n") start += 1;

    const end = raw.indexOf("endstream", start);
    if (end === -1) break;

    let stream = buffer.subarray(start, end);
    while (stream.length && (stream[stream.length - 1] === 10 || stream[stream.length - 1] === 13)) {
      stream = stream.subarray(0, stream.length - 1);
    }

    if (/\/FlateDecode/.test(dict)) {
      try {
        stream = zlib.inflateSync(stream);
      } catch {
        streamRegex.lastIndex = end + "endstream".length;
        continue;
      }
    }

    const content = stream.toString("latin1");
    if (!shouldSkipPdfStream(dict) && isProbablyPdfTextStream(content)) {
      chunks.push(extractTextObjects(content));
    }
    streamRegex.lastIndex = end + "endstream".length;
  }

  const directStrings = extractDocumentInfo(raw);
  return [directStrings, ...chunks].filter(Boolean).join("\n");
}

function extractTextObjects(content) {
  const results = [];
  const blockRegex = /BT([\s\S]*?)ET/gm;
  let blockMatch;
  while ((blockMatch = blockRegex.exec(content)) !== null) {
    const block = blockMatch[1];
    const literals = extractLiteralStrings(block);
    const hexes = extractHexStrings(block);
    const line = joinPdfTokens([...literals, ...hexes]);
    if (looksHuman(line)) results.push(line);
  }
  return results.join("\n");
}

function extractLiteralStrings(text) {
  const values = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== "(") continue;
    let depth = 1;
    let value = "";
    i += 1;
    for (; i < text.length; i += 1) {
      const char = text[i];
      if (char === "\\") {
        const next = text[++i] ?? "";
        if (/[0-7]/.test(next)) {
          let octal = next;
          for (let j = 0; j < 2 && /[0-7]/.test(text[i + 1] ?? ""); j += 1) {
            octal += text[++i];
          }
          value += String.fromCharCode(parseInt(octal, 8));
        } else {
          value += decodeEscape(next);
        }
      } else if (char === "(") {
        depth += 1;
        value += char;
      } else if (char === ")") {
        depth -= 1;
        if (depth === 0) break;
        value += char;
      } else {
        value += char;
      }
    }
    const decoded = decodePdfString(Buffer.from(value, "latin1"));
    if (looksTextToken(decoded)) values.push(decoded);
  }
  return values;
}

function extractHexStrings(text) {
  const values = [];
  const hexRegex = /<([0-9A-Fa-f\s]{4,})>/g;
  let match;
  while ((match = hexRegex.exec(text)) !== null) {
    let hex = match[1].replace(/\s+/g, "");
    if (hex.length % 2 === 1) hex += "0";
    try {
      const decoded = decodePdfString(Buffer.from(hex, "hex"));
      if (looksTextToken(decoded)) values.push(decoded);
    } catch {
      // Ignore invalid hex text candidates.
    }
  }
  return values;
}

function shouldSkipPdfStream(dict) {
  return (
    /\/Subtype\s*\/Image/.test(dict) ||
    /\/Subtype\s*\/XML/.test(dict) ||
    /\/Type\s*\/ObjStm/.test(dict) ||
    /\/DCTDecode/.test(dict) ||
    /\/JPXDecode/.test(dict) ||
    /\/CCITTFaxDecode/.test(dict)
  );
}

function isProbablyPdfTextStream(content) {
  if (!content.includes("BT") || !content.includes("ET")) return false;
  if (!/\b(?:Tj|TJ|Tf|Td|Tm|TL|Tc|Tw)\b/.test(content)) return false;

  const sample = content.slice(0, 12000);
  const printable = [...sample].filter((char) => {
    const code = char.charCodeAt(0);
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126);
  }).length;
  return printable / Math.max(sample.length, 1) > 0.7;
}

function joinPdfTokens(tokens) {
  const clean = tokens.map((token) => normalize(token)).filter(Boolean);
  let output = "";

  for (const token of clean) {
    if (!output) {
      output = token;
      continue;
    }

    const previous = output.at(-1) ?? "";
    const first = token[0] ?? "";
    const shouldJoin =
      token.length === 1 ||
      previous.length === 1 ||
      /[-/([{"']$/.test(previous) ||
      /^[,.:;!?%/)\]}"']/.test(first);

    output += shouldJoin ? token : ` ${token}`;
  }

  return normalize(output);
}

function extractDocumentInfo(raw) {
  const info = [];
  for (const key of ["Title", "Subject", "Keywords"]) {
    const match = raw.match(new RegExp(`/${key}\\s*\\(([^)]{3,})\\)`));
    if (match) info.push(decodePdfString(Buffer.from(match[1], "latin1")));
  }
  return info.join("\n");
}

function decodeEscape(char) {
  const escapes = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };
  return escapes[char] ?? char;
}

function decodePdfString(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return out;
  }
  return bytes.toString("latin1").replace(/\0/g, "");
}

function buildPdfSignals(text) {
  const headings = extractHeadingCandidates(text);
  const snippets = extractRelevantSnippets(text);
  return {
    headingCandidates: headings,
    relevantSnippets: snippets,
    candidateTerms: rankTerms(text),
  };
}

function extractHeadingCandidates(text) {
  const lines = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => normalize(line))
    .filter((line) => line.length >= 4 && line.length <= 90);
  const seen = new Set();
  return lines
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return /[A-Za-z]/.test(line) && !/[.]{2,}/.test(line);
    })
    .slice(0, 80);
}

function extractRelevantSnippets(text) {
  const keywords = [
    "Adopt",
    "Trial",
    "Assess",
    "Caution",
    "AI",
    "agent",
    "coding",
    "testing",
    "security",
    "platform",
    "framework",
    "observability",
    "architecture",
    "supply chain",
    "MCP",
    "DORA",
    "Zero Trust",
    "mutation",
    "fuzz",
  ];
  const lower = text.toLowerCase();
  const snippets = [];
  const seen = new Set();
  for (const keyword of keywords) {
    let index = lower.indexOf(keyword.toLowerCase());
    while (index !== -1 && snippets.length < 40) {
      const start = Math.max(0, index - 220);
      const end = Math.min(text.length, index + keyword.length + 360);
      const snippet = normalize(text.slice(start, end));
      const key = snippet.slice(0, 120);
      if (!seen.has(key)) {
        seen.add(key);
        snippets.push({ keyword, snippet });
      }
      index = lower.indexOf(keyword.toLowerCase(), index + keyword.length);
    }
    if (snippets.length >= 40) break;
  }
  return snippets;
}

function rankTerms(text) {
  const termRegex = /\b([A-Z][A-Za-z0-9+/#.-]*(?:\s+[A-Z][A-Za-z0-9+/#.-]*){0,4})\b/g;
  const counts = new Map();
  let match;
  while ((match = termRegex.exec(text)) !== null) {
    const term = normalize(match[1]);
    if (term.length < 4 || /^\d+$/.test(term)) continue;
    if (["Technology Radar", "Thoughtworks", "Volume", "Page"].includes(term)) continue;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([term, count]) => ({ term, count }));
}

function buildBrief(payload) {
  return `# Brief para IA - Análise de PDF para Radar Tecnológico

Arquivo analisado: ${payload.source}
Data: ${payload.generatedAt}
Tamanho do texto extraído: ${payload.textLength} caracteres

Você é um Arquiteto Estratégico de Tecnologia e Pesquisador de Inovação. Analise os sinais extraídos deste PDF e proponha novos blips ou mudanças para o Radar Tecnológico de Engenharia de Software.

Regras:

- Retorne somente JSON válido.
- Proponha apenas tecnologias, técnicas, plataformas, ferramentas, linguagens ou frameworks que tenham evidência no PDF.
- Não repita blips que já existem se a proposta for apenas sinônimo.
- Use os quadrantes: Técnicas, Plataformas, Ferramentas, Linguagens e Frameworks.
- Use os anéis: Adopt, Trial, Assess, Caution.
- Use horizonte: Curto, Médio, Longo.
- Use maturidade: Experimental, Emergente, Madura.
- Use risco e esforço: Baixo, Médio, Alto.
- Para cada proposta, inclua evidência textual curta, página se disponível, justificativa e contraindicação.

Formato obrigatório:

\`\`\`json
{
  "generatedAt": "${new Date().toISOString()}",
  "proposals": [
    {
      "action": "add",
      "reason": "Por que este blip deve entrar no radar.",
      "confidence": 0.7,
      "evidence": [
        {
          "source": "${path.basename(payload.source)}",
          "url": "file://${payload.source.replaceAll("\\", "/")}",
          "note": "Trecho ou evidência resumida do PDF."
        }
      ],
      "blip": {
        "name": "Nome do blip",
        "quadrant": "Técnicas",
        "ring": "Assess",
        "horizon": "Médio",
        "maturity": "Emergente",
        "risk": "Médio",
        "effort": "Médio",
        "status": "Monitorar",
        "source": "${path.basename(payload.source)}",
        "theme": "Tema",
        "detailsUrl": "",
        "strategic": "Justificativa estratégica.",
        "constraints": "Gargalos e contraindicações."
      }
    }
  ]
}
\`\`\`

## Termos candidatos

${payload.signals.candidateTerms.map((item) => `- ${item.term} (${item.count})`).join("\n")}

## Possíveis títulos e blips

${payload.signals.headingCandidates.map((item) => `- ${item}`).join("\n")}

## Trechos relevantes

${payload.signals.relevantSnippets
  .map((item) => `### ${item.keyword}\n\n${item.snippet}`)
  .join("\n\n")}
`;
}

function normalize(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function looksHuman(value) {
  const text = normalize(value);
  if (text.length < 2) return false;
  const printable = [...text].filter((char) => char >= " " && char !== "\u007f").length;
  const letters = (text.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
  return printable / text.length > 0.75 && letters >= Math.min(3, text.length);
}

function looksTextToken(value) {
  const text = normalize(value);
  if (!text) return false;
  const printable = [...text].filter((char) => char >= " " && char !== "\u007f").length;
  return printable / text.length > 0.85;
}

function safeName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
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
