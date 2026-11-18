import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildRadarHtmlSnapshot } from "../app-core.mjs";

export { buildRadarHtmlSnapshot };

export async function saveRadarHtmlSnapshot(payload, options = {}) {
  const root = options.root ?? process.cwd();
  const exportDir = path.join(root, "exports");
  await mkdir(exportDir, { recursive: true });

  const title = payload.title || "Radar Tecnologico e TRM - Engenharia de Software";
  const date = payload.generatedAt ? new Date(payload.generatedAt) : new Date();
  const fileName = `${date.toISOString().slice(0, 10)}-radar-tecnologico-engenharia-software.html`;
  const filePath = path.join(exportDir, fileName);
  const html = buildRadarHtmlSnapshot({
    title,
    generatedAt: date.toISOString(),
    blips: Array.isArray(payload.blips) ? payload.blips : [],
    sources: Array.isArray(payload.sources) ? payload.sources : [],
  });

  await writeFile(filePath, html, "utf8");
  return {
    filePath,
    relativePath: path.relative(root, filePath).replace(/\\/g, "/"),
    html,
  };
}
