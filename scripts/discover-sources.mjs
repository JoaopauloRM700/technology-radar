import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { runPdfAnalyzer } from "./lib/run-pdf-analyzer.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();
const args = process.argv.slice(2);

const sourcePath = path.join(root, "data", "monitored-sources.json");
const discoveryDir = path.join(root, "data", "discovery");
const downloadsDir = path.join(root, "data", "downloads");
const reportPath = path.join(discoveryDir, "radar-discovery.json");
const cachePath = path.join(discoveryDir, "download-cache.json");
const briefPath = path.join(root, "docs", "radar-discovery-brief.md");

const options = {
  force: hasArg("--force"),
  noDownload: hasArg("--no-download"),
  noAnalyze: hasArg("--no-analyze"),
  maxSources: numberArg("--max-sources", Number.POSITIVE_INFINITY),
  maxPdfsPerSource: numberArg("--max-pdfs-per-source", 2),
  maxPdfsPerSourceExplicit: hasNamedArg("--max-pdfs-per-source"),
  sourceFilter: stringArg("--source", ""),
  preferFetch: hasArg("--fetch-only"),
};

await mkdir(discoveryDir, { recursive: true });
await mkdir(downloadsDir, { recursive: true });
await mkdir(path.dirname(briefPath), { recursive: true });

const sources = JSON.parse(await readFile(sourcePath, "utf8"));
const cache = await readJson(cachePath, { downloads: [] });
const selectedSources = sources
  .filter((source) => source.discoverPdfs !== false)
  .filter((source) => {
    if (!options.sourceFilter) return true;
    const needle = options.sourceFilter.toLowerCase();
    return `${source.name} ${source.url}`.toLowerCase().includes(needle);
  })
  .slice(0, options.maxSources);

const engine = await createDiscoveryEngine(options);
const report = {
  generatedAt: new Date().toISOString(),
  engine: engine.name,
  engineNote: engine.note,
  options: {
    force: options.force,
    noDownload: options.noDownload,
    noAnalyze: options.noAnalyze,
    maxPdfsPerSource: options.maxPdfsPerSource,
    sourceFilter: options.sourceFilter || null,
  },
  sources: [],
};

const analysisCache = new Map();

try {
  for (const source of selectedSources) {
    const result = source.strategy === "fetch" ? await discoverWithFetch(source) : await engine.discover(source);
    result.strategyRequested = source.strategy ?? "playwright";
    const sourceDownloadLimit = options.maxPdfsPerSourceExplicit
      ? options.maxPdfsPerSource
      : source.maxPdfDownloads ?? options.maxPdfsPerSource;
    const downloadable = result.pdfCandidates
      .filter((candidate) => candidate.score >= 85)
      .slice(0, sourceDownloadLimit);

    result.downloads = options.noDownload
      ? []
      : await downloadCandidates(downloadable, source, engine.context);

    if (!options.noAnalyze) {
      for (const download of result.downloads) {
        if (!download.path || !download.isPdf) continue;
        download.analysis = await analyzePdfOnce(download.path, analysisCache);
      }
    }

    report.sources.push(result);
  }
} finally {
  await engine.close?.();
}

await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(briefPath, buildDiscoveryBrief(report), "utf8");

const downloads = report.sources.flatMap((source) => source.downloads ?? []);
const analyzed = downloads.filter((download) => download.analysis?.ok).length;

console.log("Descoberta de fontes concluida.");
console.log(`Motor: ${report.engine} (${report.engineNote})`);
console.log(`Fontes verificadas: ${report.sources.length}`);
console.log(`Candidatos PDF: ${report.sources.reduce((total, source) => total + source.pdfCandidates.length, 0)}`);
console.log(`PDFs baixados ou em cache: ${downloads.filter((download) => download.path).length}`);
console.log(`PDFs analisados: ${analyzed}`);
console.log(`Relatorio: ${relative(reportPath)}`);
console.log(`Brief: ${relative(briefPath)}`);

async function createDiscoveryEngine(config) {
  if (!config.preferFetch) {
    const playwrightLoad = await loadPlaywright();
    if (playwrightLoad.module) {
      const launchResult = await launchPlaywright(playwrightLoad.module);
      if (launchResult.context) {
        return {
          name: "playwright",
          note: launchResult.note,
          context: launchResult.context,
          discover: (source) => discoverWithPlaywright(source, launchResult.context),
          close: async () => launchResult.browser.close(),
        };
      }
      return {
        name: "fetch",
        note: `Playwright disponivel, mas navegador nao iniciou: ${launchResult.error}`,
        discover: discoverWithFetch,
      };
    }
  }

  return {
    name: "fetch",
    note: config.preferFetch ? "Forcado por --fetch-only." : "Playwright nao encontrado; usando HTML estatico.",
    discover: discoverWithFetch,
  };
}

async function loadPlaywright() {
  try {
    return { module: await import("playwright"), note: "Pacote local." };
  } catch {
    // Try known Codex runtime locations before giving up.
  }

  const candidates = [
    process.env.PLAYWRIGHT_ENTRY,
    ...moduleSearchRoots().map((item) => path.join(item, "playwright", "index.js")),
    path.join(os.homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", "playwright", "index.js"),
    ...(await pnpmPlaywrightEntries()),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      const packageRequire = createRequire(candidate);
      return {
        module: packageRequire("playwright"),
        note: `Pacote em ${candidate}`,
      };
    } catch {
      // Try the next candidate.
    }
  }

  return { module: null, note: "Playwright nao encontrado." };
}

async function pnpmPlaywrightEntries() {
  const pnpmDir = path.join(os.homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", ".pnpm");
  try {
    const entries = await readdir(pnpmDir);
    return entries
      .filter((entry) => /^playwright@/.test(entry))
      .map((entry) => path.join(pnpmDir, entry, "node_modules", "playwright", "index.js"));
  } catch {
    return [];
  }
}

function moduleSearchRoots() {
  const roots = [];
  try {
    roots.push(path.dirname(require.resolve("playwright/package.json")));
  } catch {
    // Ignore.
  }
  if (process.env.NODE_PATH) {
    roots.push(...process.env.NODE_PATH.split(path.delimiter).filter(Boolean));
  }
  return roots;
}

async function launchPlaywright(playwright) {
  try {
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({
      acceptDownloads: true,
      userAgent: "TechnologyRadarDiscovery/0.1 (+local P&D radar; human-reviewed proposals)",
    });
    return { browser, context, note: "Chromium headless via Playwright." };
  } catch (error) {
    try {
      const browser = await playwright.chromium.launch({ channel: "chrome", headless: true });
      const context = await browser.newContext({
        acceptDownloads: true,
        userAgent: "TechnologyRadarDiscovery/0.1 (+local P&D radar; human-reviewed proposals)",
      });
      return { browser, context, note: "Chrome instalado via Playwright channel." };
    } catch (fallbackError) {
      return { error: `${error.message}; fallback: ${fallbackError.message}` };
    }
  }
}

async function discoverWithPlaywright(source, context) {
  const page = await context.newPage();
  const startedAt = new Date().toISOString();
  try {
    const response = await page.goto(source.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

    const links = await page.$$eval("a[href]", (anchors) =>
      anchors.map((anchor) => ({
        href: anchor.href,
        text: (anchor.innerText || anchor.textContent || "").replace(/\s+/g, " ").trim(),
        title: anchor.getAttribute("title") || "",
        download: anchor.getAttribute("download") || "",
      }))
    );

    return {
      ...source,
      strategyUsed: "playwright",
      ok: response?.ok() ?? true,
      status: response?.status() ?? null,
      checkedAt: startedAt,
      finalUrl: page.url(),
      title: await page.title(),
      pdfCandidates: rankPdfCandidates(links, page.url(), source),
      downloads: [],
    };
  } catch (error) {
    return {
      ...source,
      strategyUsed: "playwright",
      ok: false,
      checkedAt: startedAt,
      error: error.message,
      pdfCandidates: [],
      downloads: [],
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function discoverWithFetch(source) {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(source.url, {
      headers: {
        "user-agent": "TechnologyRadarDiscovery/0.1 (+local P&D radar; human-reviewed proposals)",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8",
      },
    });
    const html = await response.text();
    const links = parseLinks(html, source.url);
    return {
      ...source,
      strategyUsed: "fetch",
      ok: response.ok,
      status: response.status,
      checkedAt,
      finalUrl: response.url,
      title: extractTitle(html),
      pdfCandidates: rankPdfCandidates(links, response.url || source.url, source),
      downloads: [],
    };
  } catch (error) {
    return {
      ...source,
      strategyUsed: "fetch",
      ok: false,
      checkedAt,
      error: error.message,
      pdfCandidates: [],
      downloads: [],
    };
  }
}

function parseLinks(html, baseUrl) {
  const links = [];
  const anchorRegex = /<a\b([^>]*?)href\s*=\s*(["']?)([^"'\s>]+)\2([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = normalizeUrl(match[3], baseUrl);
    if (!href) continue;
    const attrs = `${match[1]} ${match[4]}`;
    links.push({
      href,
      text: stripHtml(match[5]),
      title: attrValue(attrs, "title"),
      download: attrValue(attrs, "download"),
    });
  }

  const pdfRegex = /https?:\/\/[^\s"'<>]+\.pdf(?:\?[^\s"'<>]*)?/gi;
  while ((match = pdfRegex.exec(html)) !== null) {
    links.push({ href: match[0], text: "PDF", title: "", download: "" });
  }

  return links;
}

function rankPdfCandidates(links, baseUrl, source) {
  const seen = new Map();
  for (const link of links) {
    const url = normalizeUrl(link.href, baseUrl);
    if (!url || !/^https?:\/\//i.test(url)) continue;

    const label = normalize(`${link.text} ${link.title} ${link.download}`);
    const haystack = `${url} ${label}`.toLowerCase();
    const urlPath = safeUrlPath(url);
    const isPdf = /\.pdf($|[?#])/i.test(urlPath) || /\.pdf($|[?#])/i.test(url);
    const hasDownloadIntent = /\b(download|pdf|report|whitepaper|research|survey|radar|ebook|guide|paper)\b/i.test(haystack);
    if (!isPdf && !hasDownloadIntent) continue;

    let score = 0;
    const reasons = [];
    if (isPdf) {
      score += 100;
      reasons.push("URL PDF");
    }
    if (/\bpdf\b/i.test(label)) {
      score += 35;
      reasons.push("rotulo PDF");
    }
    if (/\b(download|baixar)\b/i.test(label)) {
      score += 25;
      reasons.push("acao de download");
    }
    if (/\b(report|research|survey|radar|whitepaper|guide|ebook|paper)\b/i.test(haystack)) {
      score += 20;
      reasons.push("relatorio");
    }
    for (const pattern of source.preferredPdfPatterns ?? []) {
      if (matchesPattern(haystack, pattern)) {
        score += 40;
        reasons.push(`preferido: ${pattern}`);
      }
    }
    for (const pattern of source.excludedPdfPatterns ?? []) {
      if (matchesPattern(haystack, pattern)) {
        score -= 120;
        reasons.push(`excluido: ${pattern}`);
      }
    }
    for (const theme of source.themes ?? []) {
      if (haystack.includes(String(theme).toLowerCase())) {
        score += 6;
        reasons.push(`tema: ${theme}`);
      }
    }

    const current = seen.get(url);
    const candidate = {
      url,
      label: label.slice(0, 180),
      isPdf,
      score,
      reasons: [...new Set(reasons)],
    };
    if (!current || candidate.score > current.score) seen.set(url, candidate);
  }

  return [...seen.values()]
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
    .slice(0, 20);
}

function matchesPattern(value, pattern) {
  const normalizedPattern = String(pattern).toLowerCase();
  if (!normalizedPattern) return false;
  if (normalizedPattern.startsWith("/") && normalizedPattern.endsWith("/")) {
    try {
      return new RegExp(normalizedPattern.slice(1, -1), "i").test(value);
    } catch {
      return false;
    }
  }
  return value.includes(normalizedPattern);
}

async function downloadCandidates(candidates, source, context) {
  const downloads = [];
  for (const candidate of candidates) {
    downloads.push(await downloadCandidate(candidate, source, context));
  }
  return downloads;
}

async function downloadCandidate(candidate, source, context) {
  const cachedByUrl = cache.downloads.find((item) => item.url === candidate.url && item.path && existsSync(path.join(root, item.path)));
  if (cachedByUrl && !options.force) {
    return {
      ...candidate,
      path: cachedByUrl.path,
      sha256: cachedByUrl.sha256,
      bytes: cachedByUrl.bytes,
      isPdf: true,
      downloaded: false,
      skipped: true,
      reason: "cached-url",
    };
  }

  try {
    const response = await requestBytes(candidate.url, context);
    const contentType = String(response.headers["content-type"] ?? "");
    const isPdfPayload =
      /application\/pdf/i.test(contentType) ||
      response.body.subarray(0, 4).toString("utf8") === "%PDF" ||
      candidate.isPdf;

    if (!response.ok || !isPdfPayload) {
      return {
        ...candidate,
        downloaded: false,
        skipped: true,
        isPdf: false,
        status: response.status,
        contentType,
        reason: response.ok ? "not-pdf" : "http-error",
      };
    }

    const sha256 = createHash("sha256").update(response.body).digest("hex");
    const duplicate = cache.downloads.find((item) => item.sha256 === sha256 && item.path && existsSync(path.join(root, item.path)));
    if (duplicate && !options.force) {
      return {
        ...candidate,
        path: duplicate.path,
        sha256,
        bytes: response.body.length,
        contentType,
        isPdf: true,
        downloaded: false,
        skipped: true,
        reason: "duplicate-hash",
      };
    }

    const sourceDir = path.join(downloadsDir, safeName(source.name));
    await mkdir(sourceDir, { recursive: true });
    const filename = uniqueFilename(sourceDir, filenameFromHeadersOrUrl(response.headers, candidate.url, sha256));
    const filePath = path.join(sourceDir, filename);
    await writeFile(filePath, response.body);

    const entry = {
      source: source.name,
      url: candidate.url,
      path: relative(filePath),
      sha256,
      bytes: response.body.length,
      contentType,
      downloadedAt: new Date().toISOString(),
    };
    cache.downloads.push(entry);

    return {
      ...candidate,
      path: entry.path,
      sha256,
      bytes: entry.bytes,
      contentType,
      isPdf: true,
      downloaded: true,
      skipped: false,
    };
  } catch (error) {
    return {
      ...candidate,
      downloaded: false,
      skipped: true,
      isPdf: candidate.isPdf,
      reason: "download-error",
      error: error.message,
    };
  }
}

async function requestBytes(url, context) {
  if (context?.request) {
    const response = await context.request.get(url, {
      timeout: 30000,
      headers: {
        accept: "application/pdf,text/html;q=0.8,*/*;q=0.5",
      },
    });
    return {
      ok: response.ok(),
      status: response.status(),
      headers: lowerCaseHeaders(response.headers()),
      body: await response.body(),
      url: response.url(),
    };
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": "TechnologyRadarDiscovery/0.1 (+local P&D radar; human-reviewed proposals)",
      accept: "application/pdf,text/html;q=0.8,*/*;q=0.5",
    },
  });
  return {
    ok: response.ok,
    status: response.status,
    headers: lowerCaseHeaders(Object.fromEntries(response.headers.entries())),
    body: Buffer.from(await response.arrayBuffer()),
    url: response.url,
  };
}

async function analyzePdfOnce(relativePdfPath, memo) {
  const absolutePdfPath = path.join(root, relativePdfPath);
  if (memo.has(absolutePdfPath)) return memo.get(absolutePdfPath);

  const result = await runPdfAnalyzer(root, absolutePdfPath);
  memo.set(absolutePdfPath, result);
  return result;
}

function buildDiscoveryBrief(payload) {
  const sourceSections = payload.sources.map((source) => {
    const candidates = source.pdfCandidates.length
      ? source.pdfCandidates
          .slice(0, 10)
          .map((candidate) => `- ${candidate.score} pts | ${candidate.isPdf ? "PDF" : "possivel PDF"} | ${candidate.label || candidate.url}\n  ${candidate.url}`)
          .join("\n")
      : "- Nenhum candidato encontrado.";

    const downloads = source.downloads?.length
      ? source.downloads
          .map((download) => {
            const analysis = download.analysis?.ok
              ? `\n  Analise: ${download.analysis.briefPath}`
              : download.analysis
                ? `\n  Analise falhou: ${download.analysis.stderr || download.analysis.stdout || download.analysis.exitCode}`
                : "";
            return `- ${download.path ?? download.url} (${download.reason ?? (download.downloaded ? "baixado" : "verificado")})${analysis}`;
          })
          .join("\n")
      : "- Nenhum PDF baixado.";

    return `## ${source.name}

- URL: ${source.url}
- Estrategia usada: ${source.strategyUsed}
- Status: ${source.ok === false ? `falha (${source.error ?? source.status})` : "ok"}
- Titulo: ${source.title ?? "n/a"}

### Candidatos

${candidates}

### Downloads e analises

${downloads}`;
  });

  return `# Brief de Descoberta de Fontes e PDFs

Data: ${payload.generatedAt}
Motor: ${payload.engine}
Nota do motor: ${payload.engineNote}

Use este documento para auditar a coleta automatizada de fontes do Radar Tecnologico. PDFs baixados ja foram enviados ao analisador local; os briefs individuais ficam listados abaixo.

## Como usar

1. Revise os PDFs baixados em \`data/downloads/\`.
2. Abra os briefs individuais gerados em \`docs/*-brief.md\`.
3. Envie os briefs para uma IA e salve as respostas JSON nos arquivos \`data/pdf/*-proposals.json\`.
4. No app, clique em **Importar Propostas** e escolha o JSON revisado.

${sourceSections.join("\n\n")}
`;
}

function filenameFromHeadersOrUrl(headers, url, sha256) {
  const disposition = headers["content-disposition"] ?? "";
  const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  const headerName = filenameMatch ? decodeURIComponent(filenameMatch[1].replace(/^"|"$/g, "")) : "";
  const urlName = safeBasename(new URL(url).pathname);
  const raw = headerName || urlName || `download-${sha256.slice(0, 12)}.pdf`;
  const withExtension = /\.pdf$/i.test(raw) ? raw : `${raw}.pdf`;
  return safeFilename(withExtension);
}

function uniqueFilename(directory, filename) {
  const parsed = path.parse(filename);
  let candidate = filename;
  let index = 2;
  while (existsSync(path.join(directory, candidate))) {
    candidate = `${parsed.name}-${index}${parsed.ext}`;
    index += 1;
  }
  return candidate;
}

function normalizeUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return "";
  }
}

function extractTitle(html) {
  return normalize(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
}

function stripHtml(value) {
  return normalize(
    String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
  );
}

function attrValue(attrs, name) {
  const match = attrs.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] ?? "";
}

function safeUrlPath(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function lowerCaseHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}

function normalize(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function safeName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function safeBasename(value) {
  const basename = path.basename(decodeURIComponent(value || ""));
  return basename && basename !== "/" ? basename : "";
}

function safeFilename(value) {
  const parsed = path.parse(value);
  const name = safeName(parsed.name || "download").slice(0, 110) || "download";
  const ext = safeName(parsed.ext || ".pdf").replace(/^\.+/, ".");
  return `${name}${ext || ".pdf"}`;
}

function relative(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
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

function hasNamedArg(name) {
  return args.includes(name) || args.some((arg) => arg.startsWith(`${name}=`));
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
