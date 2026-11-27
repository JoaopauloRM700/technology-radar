import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const discoveryScript = path.join(projectRoot, "scripts", "discover-sources.mjs");

test("discovers, classifies and deduplicates publication details without leaving the official origin", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "radar-publications-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "data"), { recursive: true });

  const sources = [
    {
      name: "Example Research",
      url: "https://research.example/publications/",
      strategy: "publications",
      discoverPdfs: false,
      publicationLinkPatterns: ["/publications/"],
      maxPublications: 5,
      themes: ["agents"],
    },
    {
      name: "Example Deep Research",
      url: "https://deep.example/publications/",
      strategy: "publications",
      discoverPdfs: false,
      publicationLinkPatterns: ["/publications/"],
      maxPublications: 5,
      themes: ["agents"],
    },
    {
      name: "Example Alias Research",
      url: "https://alias.example/publications/",
      strategy: "publications",
      discoverPdfs: false,
      publicationLinkPatterns: ["/publications/"],
      maxPublications: 5,
      themes: ["agents"],
    },
    {
      name: "Example Paperless Research",
      url: "https://paperless.example/publications/",
      strategy: "publications",
      discoverPdfs: false,
      publicationLinkPatterns: ["/publications/"],
      maxPublications: 5,
      themes: ["security"],
    },
  ];
  await writeFile(
    path.join(root, "data", "monitored-sources.json"),
    JSON.stringify(sources),
    "utf8"
  );

  const pages = {
    "https://research.example/publications/": {
      body: `
        <html><head><title>Example Research</title></head><body>
          <a href="#numbers">Publication counts</a>
          <a href="?f[year]=2026">Filter publications</a>
          <a href="/publications/?page=2">Next publications page</a>
          <a href="/about">Learn about /publications/</a>
          <a href="/publications/reliable-agents">Reliable Agents</a>
          <a href="/publications/agent-memory">Agent Memory</a>
          <a href="/publications/system-card">System card</a>
          <a href="/publications/redirect">Redirect outside the official origin</a>
          <a href="/publications/missing">Missing paper</a>
          <a href="https://outside.example/publications/trap">External trap</a>
        </body></html>`,
    },
    "https://research.example/publications/reliable-agents": {
      body: `
        <html><head>
          <meta name="citation_title" content="Reliable Agents">
          <meta name="citation_author" content="Ada Lovelace">
          <meta name="citation_author" content="Grace Hopper">
          <meta name="citation_publication_date" content="2026-10-03">
          <meta name="citation_conference_title" content="ICSE 2026">
          <meta name="citation_doi" content="10.1000/reliable.agents">
          <meta name="citation_abstract" content="Evidence about reliable coding agents.">
          <meta name="keywords" content="agents, software engineering">
        </head><body><h1>Reliable Agents</h1></body></html>`,
    },
    "https://research.example/publications/agent-memory": {
      body: `
        <html><head>
          <meta name="citation_title" content="Agent Memory at Scale">
          <meta name="citation_author" content="Katherine Johnson">
          <meta name="citation_publication_date" content="2026-01-15">
          <meta name="description" content="A preprint about persistent agent memory.">
          <meta name="keywords" content="agents, memory">
        </head><body>
          <a href="https://arxiv.org/abs/2601.12345">Read paper</a>
        </body></html>`,
    },
    "https://research.example/publications/system-card": {
      body: `
        <html><head>
          <script type="application/ld+json">
            {
              "@type": "ScholarlyArticle",
              "headline": "Frontier Model System Card",
              "author": [{ "name": "Dorothy Vaughan" }],
              "datePublished": "2026-09-01",
              "description": "Technical evaluation of a frontier model.",
              "keywords": ["AI safety", "evaluation"],
              "isPartOf": { "name": "Technical Report" }
            }
          </script>
        </head><body>
          <a href="/papers/frontier-model-system-card.pdf">Download PDF</a>
        </body></html>`,
    },
    "https://research.example/publications/redirect": {
      status: 302,
      location: "https://outside.example/publications/trap",
    },
    "https://outside.example/publications/trap": {
      reject: true,
      body: `
        <meta name="citation_title" content="Outside Redirect Trap">
        <meta name="citation_publication_date" content="2026">
        <meta name="citation_pdf_url" content="https://outside.example/trap.pdf">`,
    },
    "https://research.example/publications/missing": { status: 404, body: "missing" },
    "https://deep.example/publications/": {
      body: `<a href="/publications/reliable-agents">Reliable Agents from another lab</a>`,
    },
    "https://deep.example/publications/reliable-agents": {
      body: `
        <meta name="citation_title" content="Reliable Agents">
        <meta name="citation_publication_date" content="2026-10-03">
        <meta name="citation_doi" content="10.1000/reliable.agents">
        <a href="https://arxiv.org/abs/2602.00001">Read on arXiv</a>`,
    },
    "https://alias.example/publications/": {
      body: `
        <a href="/publications/reliable-agents-alternate">Reliable Agents alternate listing</a>
        <a href="/publications/bridge-doi">Bridge DOI listing</a>
        <a href="/publications/bridge-arxiv">Bridge arXiv listing</a>
        <a href="/publications/bridge-combined">Bridge combined listing</a>`,
    },
    "https://alias.example/publications/reliable-agents-alternate": {
      body: `
        <meta name="citation_title" content="Reliable Agents Alternate">
        <meta name="citation_publication_date" content="2026">
        <a href="https://arxiv.org/abs/2602.00001">Same paper on arXiv</a>`,
    },
    "https://alias.example/publications/bridge-doi": {
      body: `
        <meta name="citation_title" content="Bridge DOI Record">
        <meta name="citation_publication_date" content="2026">
        <meta name="citation_doi" content="10.1000/bridge.record">`,
    },
    "https://alias.example/publications/bridge-arxiv": {
      body: `
        <meta name="citation_title" content="Bridge arXiv Record">
        <meta name="citation_publication_date" content="2026">
        <meta name="citation_journal_title" content="arXiv">
        <a href="https://arxiv.org/abs/2603.00001">Bridge preprint</a>`,
    },
    "https://alias.example/publications/bridge-combined": {
      body: `
        <meta name="citation_title" content="Bridge Combined Record">
        <meta name="citation_author" content="Annie Easley">
        <meta name="citation_publication_date" content="2026-11-10">
        <meta name="citation_conference_title" content="NeurIPS 2026">
        <meta name="citation_doi" content="10.1000/bridge.record">
        <a href="https://arxiv.org/abs/2603.00001">Published preprint</a>`,
    },
    "https://paperless.example/publications/": {
      body: `
        <title>Paperless Publications Index</title>
        <a href="/publications/secure-agents">Secure Agents</a>
        <a href="/publications/shared-study-a">Shared Study A</a>
        <a href="/publications/shared-study-b">Shared Study B</a>
        <a href="/publications/back-to-index">Back to index redirect</a>`,
    },
    "https://paperless.example/publications/secure-agents": {
      body: `
        <meta name="citation_title" content="Secure Agents">
        <meta name="citation_author" content="Margaret Hamilton">
        <meta name="citation_publication_date" content="2026-11-01">
        <meta name="description" content="Corporate research without a public PDF.">`,
    },
    "https://paperless.example/publications/shared-study-a": {
      body: `
        <meta name="citation_title" content="Shared Study">
        <meta name="citation_publication_date" content="2026">
        <meta name="citation_doi" content="10.1000/shared.a">`,
    },
    "https://paperless.example/publications/shared-study-b": {
      body: `
        <meta name="citation_title" content="Shared Study">
        <meta name="citation_publication_date" content="2026">
        <meta name="citation_doi" content="10.1000/shared.b">`,
    },
    "https://paperless.example/publications/back-to-index": {
      finalUrl: "https://paperless.example/publications/",
      body: `
        <title>Paperless Publications Index</title>
        <a href="/publications/secure-agents">Secure Agents</a>`,
    },
  };

  const mockModule = path.join(root, "mock-fetch.mjs");
  await writeFile(
    mockModule,
    `const pages = new Map(Object.entries(${JSON.stringify(pages)}));
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const page = pages.get(url) ?? { status: 404, body: "unexpected " + url };
  if (page.reject) throw new Error("external network traversal");
  if (page.location) {
    if (init.redirect !== "manual") {
      return globalThis.fetch(page.location, init);
    }
    return new Response("", {
      status: page.status,
      headers: { location: page.location },
    });
  }
  if (page.finalUrl) {
    return {
      ok: (page.status ?? 200) < 400,
      status: page.status ?? 200,
      url: page.finalUrl,
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      text: async () => page.body,
    };
  }
  return new Response(page.body, {
    status: page.status ?? 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
};\n`,
    "utf8"
  );

  const result = spawnSync(
    process.execPath,
    [
      "--import",
      pathToFileURL(mockModule).href,
      discoveryScript,
      "--fetch-only",
      "--no-download",
      "--no-analyze",
    ],
    { cwd: root, encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(
    await readFile(path.join(root, "data", "discovery", "radar-discovery.json"), "utf8")
  );
  assert.equal(report.sources.length, 4);

  const [research, deep, alias, paperless] = report.sources;
  assert.equal(research.publications.length, 3);
  assert.equal(research.duplicatePublications, 0);
  assert.deepEqual(
    research.publicationErrors.map((item) => item.error).sort(),
    ["HTTP 404", "unexpected_origin"]
  );

  const reviewed = research.publications.find((item) => item.title === "Reliable Agents");
  assert.deepEqual(reviewed.authors, ["Ada Lovelace", "Grace Hopper"]);
  assert.equal(reviewed.publishedAt, "2026-10-03");
  assert.equal(reviewed.year, 2026);
  assert.deepEqual(reviewed.areas, ["agents", "software engineering"]);
  assert.equal(reviewed.venue, "ICSE 2026");
  assert.equal(reviewed.doi, "10.1000/reliable.agents");
  assert.equal(reviewed.arxivId, "2602.00001");
  assert.equal(reviewed.evidenceLevel, "peer-reviewed");
  assert.equal(reviewed.paperUrl, "https://arxiv.org/abs/2602.00001");
  assert.equal(reviewed.pdfUrl, "https://arxiv.org/pdf/2602.00001.pdf");

  const preprint = research.publications.find((item) => item.title === "Agent Memory at Scale");
  assert.equal(preprint.arxivId, "2601.12345");
  assert.equal(preprint.evidenceLevel, "preprint");
  assert.equal(preprint.paperUrl, "https://arxiv.org/abs/2601.12345");
  assert.equal(preprint.pdfUrl, "https://arxiv.org/pdf/2601.12345.pdf");

  const reportCard = research.publications.find(
    (item) => item.title === "Frontier Model System Card"
  );
  assert.deepEqual(reportCard.authors, ["Dorothy Vaughan"]);
  assert.deepEqual(reportCard.areas, ["AI safety", "evaluation"]);
  assert.equal(reportCard.evidenceLevel, "technical-report");
  assert.equal(
    reportCard.pdfUrl,
    "https://research.example/papers/frontier-model-system-card.pdf"
  );

  assert.deepEqual(
    research.pdfCandidates.map((item) => item.url).sort(),
    [
      "https://arxiv.org/pdf/2601.12345.pdf",
      "https://research.example/papers/frontier-model-system-card.pdf",
    ]
  );
  assert.equal(deep.publications.length, 0);
  assert.equal(deep.duplicatePublications, 1);
  assert.deepEqual(deep.pdfCandidates.map((item) => item.url), [
    "https://arxiv.org/pdf/2602.00001.pdf",
  ]);
  assert.equal(alias.publications.length, 1);
  assert.equal(alias.duplicatePublications, 3);
  assert.equal(alias.publications[0].doi, "10.1000/bridge.record");
  assert.equal(alias.publications[0].arxivId, "2603.00001");
  assert.equal(alias.publications[0].venue, "NeurIPS 2026");
  assert.equal(alias.publications[0].evidenceLevel, "peer-reviewed");
  assert.deepEqual(alias.publications[0].authors, ["Annie Easley"]);
  assert.equal(paperless.publications.length, 3);
  assert.equal(paperless.publications[0].evidenceLevel, "corporate-research");
  assert.deepEqual(
    paperless.publications.filter((item) => item.title === "Shared Study").map((item) => item.doi),
    ["10.1000/shared.a", "10.1000/shared.b"]
  );
  assert.deepEqual(paperless.publicationErrors.map((item) => item.error), [
    "unexpected_detail_url",
  ]);
  assert.deepEqual(paperless.pdfCandidates, []);
  assert.match(result.stdout, /Publicacoes encontradas: 7/);

  const brief = await readFile(path.join(root, "docs", "radar-discovery-brief.md"), "utf8");
  assert.match(brief, /\[peer-reviewed\] Reliable Agents/);
  assert.match(brief, /\[preprint\] Agent Memory at Scale/);
  assert.match(brief, /\[technical-report\] Frontier Model System Card/);
  assert.doesNotMatch(brief, /External trap/);
  assert.doesNotMatch(brief, /Outside Redirect Trap/);
});
