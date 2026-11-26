import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createNvidiaNimClient, NvidiaNimError } from "./lib/nvidia-nim.mjs";

export async function generateProposalFile(proposalPath, options = {}) {
  const root = options.root ?? process.cwd();
  const absoluteProposalPath = path.resolve(root, proposalPath);
  const relativeProposalPath = relative(root, absoluteProposalPath);
  if (!/^data\/pdf\/[a-zA-Z0-9._-]+-proposals\.json$/.test(relativeProposalPath)) {
    return { ok: false, reason: "destino-propostas-invalido", proposalPath: relativeProposalPath, proposals: 0 };
  }
  const briefPath = options.briefPath
    ? path.resolve(root, options.briefPath)
    : briefPathForProposalPath(absoluteProposalPath, root);
  const paths = { proposalPath: relativeProposalPath, briefPath: relative(root, briefPath) };

  const existing = await readExisting(absoluteProposalPath);
  const existingCount = Array.isArray(existing?.proposals) ? existing.proposals.length : 0;
  const historical = existing?.generatedBy === "gemini";
  if (historical || (existingCount > 0 && !options.overwrite)) {
    return {
      ...paths,
      ok: true,
      skipped: true,
      reason: historical ? "artefato-historico" : "propostas-existentes",
      proposals: existingCount,
      payload: existing,
    };
  }

  let payload;
  try {
    let client = options.client;
    if (!client) {
      await loadEnvFile(path.join(root, ".env"));
      client = createNvidiaNimClient();
    }
    if (!existsSync(briefPath)) {
      return { ...paths, ok: false, skipped: true, reason: "brief-nao-encontrado", proposals: 0 };
    }
    const brief = await readFile(briefPath, "utf8");
    const { proposals } = await client.generateProposals(brief);
    payload = { generatedAt: new Date().toISOString(), generatedBy: "nvidia-nim", sourceBrief: paths.briefPath, proposals };
  } catch (error) {
    if (!(error instanceof NvidiaNimError)) throw error;
    const reason = error.code === "missing-key" ? error.message : "nvidia-nim-" + error.code;
    return { ...paths, ok: false, reason, proposals: 0 };
  }

  await mkdir(path.dirname(absoluteProposalPath), { recursive: true });
  const tempPath = absoluteProposalPath + "." + randomUUID() + ".tmp";
  try {
    await writeFile(tempPath, JSON.stringify(payload, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
    await rename(tempPath, absoluteProposalPath);
  } finally {
    await rm(tempPath, { force: true });
  }
  return { ...paths, ok: true, proposals: payload.proposals.length, payload };
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

function briefPathForProposalPath(absolutePath, root) {
  return path.join(root, relative(root, absolutePath)
    .replace(/^data\/pdf\//, "docs/")
    .replace(/-proposals\.json$/, "-brief.md"));
}

async function readExisting(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

function relative(root, filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith("--proposal="));
  const index = args.indexOf("--proposal");
  const proposalPath = inline?.slice("--proposal=".length) ?? (index >= 0 ? args[index + 1] : undefined);
  if (!proposalPath || proposalPath.startsWith("--")) {
    console.error("Uso: node scripts/nim-proposals.mjs --proposal data/pdf/arquivo-proposals.json [--overwrite]");
    process.exit(1);
  }
  const { payload, ...result } = await generateProposalFile(proposalPath, { overwrite: args.includes("--overwrite") });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 2;
}
