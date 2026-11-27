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
const publicationNavigationSegments = new Set([
  "archive",
  "archives",
  "author",
  "authors",
  "categories",
  "category",
  "filter",
  "page",
  "pages",
  "search",
  "tag",
  "tags",
  "topic",
  "topics",
  "year",
  "years",
]);

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
  .filter((source) => source.discoverPdfs !== false || source.strategy === "publications")
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
const publicationIndex = new Map();

try {
  for (const source of selectedSources) {
    const result = source.strategy === "publications"
      ? await discoverPublications(source, engine.context)
      : source.strategy === "fetch"
        ? await discoverWithFetch(source)
        : await engine.discover(source);
    if (source.strategy === "publications") {
      const publicationCandidates = [...result.publications];
      deduplicatePublications(result, publicationIndex);
      result.pdfCandidates = rankPdfCandidates(
        publicationCandidates
          .filter((publication) => isHttpUrl(publication.pdfUrl))
          .map((publication) => ({
            href: publication.pdfUrl,
            text: `PDF paper ${publication.title}`,
            title: publication.title,
            download: "",
            explicitPdf: true,
          })),
        source.url,
        source
      );
    }
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
const publications = report.sources.flatMap((source) => source.publications ?? []);

console.log("Descoberta de fontes concluida.");
console.log(`Motor: ${report.engine} (${report.engineNote})`);
console.log(`Fontes verificadas: ${report.sources.length}`);
console.log(`Publicacoes encontradas: ${publications.length}`);
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
      serviceWorkers: "block",
      userAgent: "TechnologyRadarDiscovery/0.1 (+local P&D radar; human-reviewed proposals)",
    });
    return { browser, context, note: "Chromium headless via Playwright." };
  } catch (error) {
    try {
      const browser = await playwright.chromium.launch({ channel: "chrome", headless: true });
      const context = await browser.newContext({
        acceptDownloads: true,
        serviceWorkers: "block",
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

async function discoverPublications(source, context) {
  const checkedAt = new Date().toISOString();
  try {
    const index = await loadPublicationPage(source.url, context);
    if (!index.ok) {
      return {
        ...source,
        strategyUsed: context ? "publications-playwright" : "publications-fetch",
        ok: false,
        status: index.status,
        checkedAt,
        finalUrl: index.finalUrl,
        title: index.title,
        error: `HTTP ${index.status ?? "desconhecido"}`,
        publications: [],
        publicationErrors: [],
        duplicatePublications: 0,
        pdfCandidates: [],
        downloads: [],
      };
    }

    const indexUrl = new URL(index.finalUrl);
    const indexPath = canonicalPath(indexUrl.pathname);
    const patterns = source.publicationLinkPatterns ?? [];
    const externalPdfOrigins = allowedPublicationPdfOrigins(source.publicationPdfOrigins);
    const maxPublications = Math.min(5, Math.max(1, Number(source.maxPublications) || 5));
    const detailTargets = [];
    const seenDetails = new Set();

    for (const link of index.links) {
      const url = normalizeUrl(link.href, index.finalUrl);
      if (!url) continue;
      const parsed = new URL(url);
      let target;
      if (parsed.origin === indexUrl.origin) {
        if (canonicalPath(parsed.pathname) === indexPath) continue;
        if (!patterns.some((pattern) => matchesPublicationPath(parsed.pathname, pattern))) continue;
        if (isPublicationNavigationPath(parsed.pathname, patterns)) continue;
        parsed.hash = "";
        target = {
          url: parsed.href,
          expectedOrigin: indexUrl.origin,
          patterns,
          indexPath,
          arxivId: "",
          pdfUrl: "",
          render: true,
        };
      } else {
        target = externalArxivPublicationTarget(parsed, externalPdfOrigins);
        if (!target) continue;
      }
      const targetUrl = new URL(target.url);
      const detailIdentity = target.arxivId
        ? `arxiv:${normalizeArxivIdentity(target.arxivId)}`
        : `${target.expectedOrigin}${canonicalPath(targetUrl.pathname).toLowerCase()}`;
      if (seenDetails.has(detailIdentity)) continue;
      seenDetails.add(detailIdentity);
      detailTargets.push(target);
      if (detailTargets.length >= maxPublications) break;
    }

    const publications = [];
    const publicationErrors = [];
    for (const target of detailTargets) {
      const { url } = target;
      try {
        const detail = await loadPublicationDetailPage(
          url,
          target.render ? context : null,
          target.expectedOrigin
        );
        if (detail.blockedRedirectUrl) {
          publicationErrors.push({
            url,
            status: detail.status,
            error: "unexpected_origin",
            finalUrl: detail.blockedRedirectUrl,
          });
          continue;
        }
        if (!hasOrigin(detail.finalUrl, target.expectedOrigin)) {
          publicationErrors.push({
            url,
            status: detail.status,
            error: "unexpected_origin",
            finalUrl: detail.finalUrl,
          });
          continue;
        }
        const detailUrl = new URL(detail.finalUrl);
        if (
          (target.indexPath && canonicalPath(detailUrl.pathname) === target.indexPath) ||
          !target.patterns.some((pattern) => matchesPublicationPath(detailUrl.pathname, pattern)) ||
          isPublicationNavigationPath(detailUrl.pathname, target.patterns) ||
          (target.arxivId &&
            arxivIdFromAbsPath(detailUrl.pathname) !== target.arxivId.toLowerCase())
        ) {
          publicationErrors.push({
            url,
            status: detail.status,
            error: "unexpected_detail_url",
            finalUrl: detail.finalUrl,
          });
          continue;
        }
        if (!detail.ok) {
          publicationErrors.push({ url, status: detail.status, error: `HTTP ${detail.status}` });
          continue;
        }
        const publication = extractPublication(detail);
        if (publication) {
          if (target.arxivId) applyExternalArxivIdentity(publication, target);
          publications.push(publication);
        }
        else publicationErrors.push({ url, status: detail.status, error: "publication_metadata_missing" });
      } catch (error) {
        publicationErrors.push({ url, status: null, error: error.message });
      }
    }

    return {
      ...source,
      strategyUsed: context ? "publications-playwright" : "publications-fetch",
      ok: true,
      status: index.status,
      checkedAt,
      finalUrl: index.finalUrl,
      title: index.title,
      publications,
      publicationErrors,
      duplicatePublications: 0,
      pdfCandidates: [],
      downloads: [],
    };
  } catch (error) {
    return {
      ...source,
      strategyUsed: context ? "publications-playwright" : "publications-fetch",
      ok: false,
      checkedAt,
      error: error.message,
      publications: [],
      publicationErrors: [],
      duplicatePublications: 0,
      pdfCandidates: [],
      downloads: [],
    };
  }
}

async function loadPublicationPage(url, context) {
  return context
    ? loadPublicationPageWithPlaywright(url, context)
    : loadPublicationPageWithFetch(url);
}

async function loadPublicationPageWithPlaywright(url, context) {
  const page = await context.newPage();
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    const html = await page.content();
    return {
      ok: response?.ok() ?? true,
      status: response?.status() ?? null,
      finalUrl: page.url(),
      title: await page.title(),
      html,
      links: parseLinks(html, page.url()),
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function loadPublicationPageWithFetch(url, allowedOrigin, redirectCount = 0) {
  const response = await fetch(url, {
    redirect: "manual",
    headers: {
      "user-agent": "TechnologyRadarDiscovery/0.1 (+local P&D radar; human-reviewed proposals)",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8",
    },
  });
  if (isRedirectStatus(response.status)) {
    const location = response.headers?.get("location");
    const redirectUrl = location ? normalizeUrl(location, url) : "";
    if (redirectUrl) {
      if (allowedOrigin && !hasOrigin(redirectUrl, allowedOrigin)) {
        return {
          ok: false,
          status: response.status,
          finalUrl: url,
          blockedRedirectUrl: redirectUrl,
          title: "",
          html: "",
          links: [],
        };
      }
      if (redirectCount >= 5) {
        return {
          ok: false,
          status: response.status,
          finalUrl: url,
          title: "",
          html: "",
          links: [],
        };
      }
      return loadPublicationPageWithFetch(redirectUrl, allowedOrigin, redirectCount + 1);
    }
  }
  const html = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    finalUrl: response.url || url,
    title: extractTitle(html),
    html,
    links: parseLinks(html, response.url || url),
  };
}

async function loadPublicationDetailPage(url, context, allowedOrigin) {
  const fetched = await loadPublicationPageWithFetch(url, allowedOrigin);
  if (!context || !fetched.ok || fetched.blockedRedirectUrl) return fetched;

  const page = await context.newPage();
  let documentServed = false;
  try {
    await page.route("**/*", async (route) => {
      const request = route.request();
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        if (!documentServed && sameRequestUrl(request.url(), fetched.finalUrl)) {
          documentServed = true;
          await route.fulfill({
            status: 200,
            contentType: "text/html; charset=utf-8",
            body: fetched.html,
          });
        } else {
          await route.abort("blockedbyclient");
        }
        return;
      }
      await route.continue();
    });
    await page.goto(fetched.finalUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    const html = await page.content();
    return {
      ...fetched,
      title: await page.title() || fetched.title,
      html,
      links: parseLinks(html, fetched.finalUrl),
    };
  } catch {
    return fetched;
  } finally {
    await page.close().catch(() => {});
  }
}

function sameRequestUrl(left, right) {
  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);
    leftUrl.hash = "";
    rightUrl.hash = "";
    return leftUrl.href === rightUrl.href;
  } catch {
    return false;
  }
}

function isRedirectStatus(status) {
  return [301, 302, 303, 307, 308].includes(status);
}

function parseLinks(html, baseUrl) {
  const links = [];
  const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const attributes = parseAttributes(match[1]);
    const rawHref = attributes.get("href");
    if (!rawHref) continue;
    const href = normalizeUrl(rawHref, baseUrl);
    if (!href) continue;
    links.push({
      href,
      text: stripHtml(match[2]),
      title: attributes.get("title") ?? "",
      download: attributes.get("download") ?? "",
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
    const isPdf = /\.pdf$/i.test(urlPath);
    const hasDownloadIntent = /\b(download|pdf|report|whitepaper|research|survey|radar|ebook|guide|paper)\b/i.test(haystack);
    if (!isPdf && !hasDownloadIntent) continue;

    let score = 0;
    const reasons = [];
    if (link.explicitPdf) {
      score += 100;
      reasons.push("PDF indicado pela publicacao");
    }
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

function canonicalPath(pathname) {
  return String(pathname || "/").replace(/\/+$/, "") || "/";
}

function matchesPublicationPath(pathname, pattern) {
  const rawPattern = String(pattern ?? "").trim();
  if (!rawPattern) return false;
  const pathPrefix = canonicalPath(rawPattern).toLowerCase();
  const candidate = canonicalPath(pathname).toLowerCase();
  if (!pathPrefix.startsWith("/")) return false;
  return candidate.startsWith(`${pathPrefix}/`);
}

function isPublicationNavigationPath(pathname, patterns) {
  const candidate = canonicalPath(pathname).toLowerCase();
  const prefix = patterns
    .map((pattern) => canonicalPath(String(pattern ?? "").trim()).toLowerCase())
    .find((pattern) => pattern !== "/" && matchesPublicationPath(candidate, pattern));
  if (!prefix) return false;
  const firstSegment = candidate.slice(prefix.length).replace(/^\/+/, "").split("/")[0];
  return publicationNavigationSegments.has(firstSegment);
}

function allowedPublicationPdfOrigins(values) {
  const origins = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    try {
      const url = new URL(value);
      if (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash
      ) {
        origins.add(url.origin);
      }
    } catch {
      // Invalid allowlist entries are ignored.
    }
  }
  return origins;
}

function externalArxivPublicationTarget(url, allowedOrigins) {
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hostname !== "arxiv.org" ||
    !allowedOrigins.has(url.origin)
  ) {
    return null;
  }
  const arxivId = arxivIdFromPdfPath(url.pathname);
  if (!arxivId) return null;
  return {
    url: `${url.origin}/abs/${arxivId}`,
    expectedOrigin: url.origin,
    patterns: ["/abs/"],
    indexPath: "",
    arxivId,
    pdfUrl: `${url.origin}/pdf/${arxivId}`,
    render: false,
  };
}

function arxivIdFromPdfPath(pathname) {
  return decodePath(pathname).match(
    /^\/pdf\/(\d{4}\.\d{4,5}(?:v\d+)?)(?:\.pdf)?\/?$/i
  )?.[1] ?? "";
}

function arxivIdFromAbsPath(pathname) {
  const id = decodePath(pathname).match(
    /^\/abs\/(\d{4}\.\d{4,5}(?:v\d+)?)\/?$/i
  )?.[1];
  return id?.toLowerCase() ?? "";
}

function decodePath(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return "";
  }
}

function applyExternalArxivIdentity(publication, target) {
  publication.arxivId = target.arxivId;
  publication.detailUrl = target.url;
  publication.paperUrl = target.url;
  publication.pdfUrl = target.pdfUrl;
  if (publication.evidenceLevel === "corporate-research") {
    publication.evidenceLevel = "preprint";
  }
}

function hasOrigin(value, expectedOrigin) {
  try {
    return new URL(value).origin === expectedOrigin;
  } catch {
    return false;
  }
}

function extractPublication(page) {
  const article = extractScholarlyJsonLd(page.html);
  const title = firstValue(
    metaValues(page.html, "citation_title"),
    article?.headline,
    article?.name,
    metaValues(page.html, "og:title"),
    extractHeading(page.html),
    page.title
  );
  if (!title) return null;

  const authors = uniqueStrings(
    metaValues(page.html, "citation_author").length
      ? metaValues(page.html, "citation_author")
      : jsonLdAuthors(article?.author)
  );
  const publishedAt = firstValue(
    metaValues(page.html, "citation_publication_date"),
    metaValues(page.html, "citation_date"),
    metaValues(page.html, "citation_online_date"),
    metaValues(page.html, "article:published_time"),
    article?.datePublished
  );
  const areas = uniqueStrings([
    ...jsonLdKeywords(article?.keywords),
    ...metaValues(page.html, "keywords").flatMap(splitKeywords),
  ]);
  const abstract = firstValue(
    metaValues(page.html, "citation_abstract"),
    article?.abstract,
    article?.description,
    metaValues(page.html, "description"),
    metaValues(page.html, "og:description")
  );
  const conferenceVenue = firstValue(metaValues(page.html, "citation_conference_title"));
  const journalVenue = firstValue(metaValues(page.html, "citation_journal_title"));
  const structuredVenue = firstValue(article?.isPartOf?.name);
  const venue = firstValue(conferenceVenue, journalVenue, structuredVenue);
  const peerReviewed = [
    conferenceVenue,
    journalVenue,
    isAcademicVenue(article?.isPartOf) ? structuredVenue : "",
  ].some((candidate) => candidate && !/\barxiv\b/i.test(candidate));
  const doiLink = page.links.find((link) => /doi\.org\//i.test(link.href))?.href;
  const doi = normalizeDoi(firstValue(metaValues(page.html, "citation_doi"), doiLink));
  const arxiv = findArxiv(page.links);
  const citationPdf = normalizeHttpUrl(
    firstValue(metaValues(page.html, "citation_pdf_url")),
    page.finalUrl
  );
  const structuredPdf = normalizeHttpUrl(firstValue(article?.contentUrl), page.finalUrl);
  const structuredPdfType = firstValue(article?.encodingFormat);
  const directPdf = page.links.find((link) => isHttpPdf(link.href))?.href;
  const labeledPdf = page.links
    .filter((link) => /\bpdf\b/i.test(`${link.text} ${link.title} ${link.download}`))
    .map((link) => normalizeHttpUrl(link.href, page.finalUrl))
    .find((url) => url && !sameRequestUrl(url, page.finalUrl));
  const pdfUrl =
    citationPdf ||
    (structuredPdf && (/application\/pdf/i.test(structuredPdfType) || isHttpPdf(structuredPdf))
      ? structuredPdf
      : "") ||
    (isHttpPdf(directPdf) ? directPdf : "") ||
    labeledPdf ||
    arxiv?.pdfUrl ||
    "";
  const paperUrl = arxiv?.url || pdfUrl || doiLink || page.finalUrl;
  if (!authors.length && !publishedAt && !doi && !arxiv && !pdfUrl) return null;

  return {
    title,
    authors,
    publishedAt,
    year: publicationYear(publishedAt),
    areas,
    abstract,
    venue,
    doi,
    arxivId: arxiv?.id ?? "",
    detailUrl: page.finalUrl,
    paperUrl,
    pdfUrl,
    evidenceLevel: evidenceLevel({ title, venue, arxivId: arxiv?.id, peerReviewed }),
  };
}

function isAcademicVenue(value) {
  const types = Array.isArray(value?.["@type"]) ? value["@type"] : [value?.["@type"]];
  return types.some((type) =>
    /^(conferenceevent|periodical|publicationissue|publicationvolume)$/i.test(type)
  );
}

function extractScholarlyJsonLd(html) {
  const scripts = html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi);
  for (const [, attrs, body] of scripts) {
    if (attrValue(attrs, "type").toLowerCase() !== "application/ld+json") continue;
    try {
      const candidates = [];
      collectJsonLd(JSON.parse(body), candidates);
      const article = candidates.find((item) => {
        const types = Array.isArray(item?.["@type"]) ? item["@type"] : [item?.["@type"]];
        return types.some((type) => /^(scholarlyarticle|article|techarticle|report)$/i.test(type));
      });
      if (article) return article;
    } catch {
      // Ignore invalid structured data and continue with citation metadata.
    }
  }
  return null;
}

function collectJsonLd(value, output) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonLd(item, output));
    return;
  }
  if (!value || typeof value !== "object") return;
  output.push(value);
  if (value["@graph"]) collectJsonLd(value["@graph"], output);
}

function metaValues(html, expectedName) {
  const values = [];
  const tags = html.matchAll(/<meta\b([^>]*)>/gi);
  for (const [, attrs] of tags) {
    const name = firstValue(
      attrValue(attrs, "name"),
      attrValue(attrs, "property"),
      attrValue(attrs, "itemprop")
    ).toLowerCase();
    if (name !== expectedName.toLowerCase()) continue;
    const content = stripHtml(attrValue(attrs, "content"));
    if (content) values.push(content);
  }
  return values;
}

function jsonLdAuthors(value) {
  const authors = Array.isArray(value) ? value : value ? [value] : [];
  return authors.map((author) => typeof author === "string" ? author : author?.name).filter(Boolean);
}

function jsonLdKeywords(value) {
  if (Array.isArray(value)) return value.flatMap(jsonLdKeywords);
  return splitKeywords(value);
}

function splitKeywords(value) {
  return String(value ?? "")
    .split(/[,;|]/)
    .map(normalize)
    .filter(Boolean);
}

function findArxiv(links) {
  for (const link of links) {
    try {
      const url = new URL(link.href);
      if (url.hostname !== "arxiv.org" && url.hostname !== "www.arxiv.org") continue;
      const id = url.pathname.replace(/^\/(?:abs|pdf)\//, "").replace(/\.pdf$/i, "");
      if (!id || id === url.pathname) continue;
      return {
        id,
        url: `https://arxiv.org/abs/${id}`,
        pdfUrl: `https://arxiv.org/pdf/${id}.pdf`,
      };
    } catch {
      // Ignore malformed external links.
    }
  }
  return null;
}

function normalizeDoi(value) {
  const match = String(value ?? "").match(/10\.\d{4,9}\/[^\s"'<>]+/i);
  return (match?.[0] ?? "").replace(/[),.;]+$/, "").toLowerCase();
}

function publicationYear(value) {
  const year = Number(String(value ?? "").match(/(?:19|20)\d{2}/)?.[0]);
  return Number.isInteger(year) ? year : null;
}

function evidenceLevel({ title, venue, arxivId, peerReviewed }) {
  if (/\b(technical report|tech report|white ?paper|system card)\b/i.test(`${title} ${venue}`)) {
    return "technical-report";
  }
  if (peerReviewed) return "peer-reviewed";
  if (arxivId || /\barxiv\b/i.test(venue)) return "preprint";
  return "corporate-research";
}

function deduplicatePublications(result, index) {
  const publications = [];
  let duplicates = 0;
  for (const publication of result.publications) {
    const keys = publicationLookupKeys(publication);
    const strongKeys = publicationStrongKeys(publication);
    const strongMatches = uniquePublicationRecords(
      strongKeys.map((key) => index.get(key)),
      publication
    );
    const fallbackKey = publicationTitleKey(publication) ||
      (strongKeys.length ? "" : `url:${publication.detailUrl}`);
    const fallbackMatch = fallbackKey ? index.get(fallbackKey) : null;
    const matches = strongMatches.length
      ? strongMatches
      : uniquePublicationRecords([fallbackMatch], publication);
    if (matches.length) {
      const canonical = matches[0];
      for (const duplicate of matches.slice(1)) {
        if (!compatibleIdentifiers(canonical.publication, duplicate.publication)) continue;
        mergePublication(canonical.publication, duplicate.publication);
        const duplicatePosition = duplicate.collection.indexOf(duplicate.publication);
        if (duplicatePosition >= 0) duplicate.collection.splice(duplicatePosition, 1);
        duplicate.result.duplicatePublications += 1;
        for (const [key, record] of index) {
          if (record === duplicate) index.set(key, canonical);
        }
      }
      mergePublication(canonical.publication, publication);
      [...keys, ...publicationLookupKeys(canonical.publication)].forEach((key) => {
        const current = index.get(key);
        if (!current || compatibleIdentifiers(current.publication, canonical.publication)) {
          index.set(key, canonical);
        }
      });
      duplicates += 1;
      continue;
    }
    publications.push(publication);
    const record = { publication, result, collection: publications };
    keys.forEach((key) => {
      const current = index.get(key);
      if (!current || compatibleIdentifiers(current.publication, publication)) {
        index.set(key, record);
      }
    });
  }
  result.publications = publications;
  result.duplicatePublications += duplicates;
}

function publicationLookupKeys(publication) {
  const keys = publicationStrongKeys(publication);
  const titleKey = publicationTitleKey(publication);
  if (titleKey) keys.push(titleKey);
  if (!keys.length) keys.push(`url:${publication.detailUrl}`);
  return keys;
}

function publicationStrongKeys(publication) {
  const keys = [];
  if (publication.doi) keys.push(`doi:${publication.doi}`);
  if (publication.arxivId) keys.push(`arxiv:${normalizeArxivIdentity(publication.arxivId)}`);
  return keys;
}

function publicationTitleKey(publication) {
  return publication.title && publication.year
    ? `title:${normalize(publication.title).toLowerCase()}|${publication.year}`
    : "";
}

function uniquePublicationRecords(records, publication) {
  return [
    ...new Set(
      records.filter(
        (record) => record && compatibleIdentifiers(record.publication, publication)
      )
    ),
  ];
}

function normalizeArxivIdentity(value) {
  return String(value ?? "").toLowerCase().replace(/v\d+$/i, "");
}

function compatibleIdentifiers(left, right) {
  if (left.doi && right.doi && left.doi !== right.doi) return false;
  if (
    left.arxivId &&
    right.arxivId &&
    normalizeArxivIdentity(left.arxivId) !== normalizeArxivIdentity(right.arxivId)
  ) {
    return false;
  }
  return true;
}

function mergePublication(target, incoming) {
  target.authors = uniqueStrings([...target.authors, ...incoming.authors]);
  target.areas = uniqueStrings([...target.areas, ...incoming.areas]);
  for (const field of ["publishedAt", "year", "abstract", "doi", "arxivId", "pdfUrl"]) {
    if (!target[field] && incoming[field]) target[field] = incoming[field];
  }
  if (paperUrlPriority(incoming.paperUrl, incoming) > paperUrlPriority(target.paperUrl, target)) {
    target.paperUrl = incoming.paperUrl;
  }
  if (evidencePriority(incoming.evidenceLevel) > evidencePriority(target.evidenceLevel)) {
    target.evidenceLevel = incoming.evidenceLevel;
    if (incoming.venue) target.venue = incoming.venue;
  } else if (!target.venue && incoming.venue) {
    target.venue = incoming.venue;
  }
}

function paperUrlPriority(url, publication) {
  if (!url) return 0;
  if (/\b(?:arxiv\.org|doi\.org)\b/i.test(url)) return 3;
  if (url === publication.detailUrl) return 1;
  return 2;
}

function evidencePriority(level) {
  return {
    "corporate-research": 1,
    preprint: 2,
    "technical-report": 3,
    "peer-reviewed": 4,
  }[level] ?? 0;
}

function firstValue(...values) {
  for (const value of values.flat()) {
    const normalized = normalize(value ?? "");
    if (normalized) return normalized;
  }
  return "";
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => normalize(value)).filter(Boolean))];
}

function extractHeading(html) {
  return stripHtml(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
}

function isHttpPdf(value) {
  if (!isHttpUrl(value)) return false;
  try {
    return /\.pdf$/i.test(new URL(value).pathname);
  } catch {
    return false;
  }
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value ?? "");
}

function normalizeHttpUrl(value, baseUrl) {
  if (!normalize(value ?? "")) return "";
  const url = normalizeUrl(value, baseUrl);
  return isHttpUrl(url) ? url : "";
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
    const publications = source.publications?.length
      ? source.publications
          .slice(0, 10)
          .map((publication) => {
            const year = publication.year ? ` (${publication.year})` : "";
            const authors = publication.authors.length ? ` — ${publication.authors.join(", ")}` : "";
            const venue = publication.venue ? `\n  Venue: ${publication.venue}` : "";
            const link = publication.paperUrl ? `\n  Paper: ${publication.paperUrl}` : "";
            return `- [${publication.evidenceLevel}] ${publication.title}${year}${authors}${venue}${link}`;
          })
          .join("\n")
      : "- Nenhuma publicacao encontrada.";

    const publicationErrors = source.publicationErrors?.length
      ? `\n\nFalhas isoladas: ${source.publicationErrors.length}.`
      : "";
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

${source.strategyRequested === "publications" || source.publications ? `### Publicacoes

${publications}${publicationErrors}

Duplicatas ignoradas: ${source.duplicatePublications ?? 0}.
` : ""}

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
  return parseAttributes(attrs).get(name.toLowerCase()) ?? "";
}

function parseAttributes(attrs) {
  const attributes = new Map();
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = pattern.exec(attrs)) !== null) {
    const name = match[1].toLowerCase();
    if (!attributes.has(name)) {
      attributes.set(name, match[2] ?? match[3] ?? match[4] ?? "");
    }
  }
  return attributes;
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
