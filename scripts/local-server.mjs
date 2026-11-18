import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ALLOWLIST = new Map([
  ["/", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/index.html", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/styles.css", { file: "styles.css", type: "text/css; charset=utf-8" }],
  ["/app.js", { file: "app.js", type: "text/javascript; charset=utf-8" }],
  ["/app-core.mjs", { file: "app-core.mjs", type: "text/javascript; charset=utf-8" }],
  ["/data/radar.json", { file: path.join("data", "radar.json"), type: "application/json; charset=utf-8" }],
]);

export function createLocalServer({ root = process.cwd() } = {}) {
  return http.createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
      return;
    }

    const pathname = (request.url || "/").split("?")[0];
    const entry = ALLOWLIST.get(pathname);
    if (!entry) {
      response.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end("404");
      return;
    }

    try {
      const body = request.method === "HEAD" ? null : await readFile(path.join(root, entry.file));
      response.writeHead(200, {
        "Content-Type": entry.type,
        "Cache-Control": "no-store",
      });
      response.end(body);
    } catch {
      response.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end("404");
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 4173);
  const server = createLocalServer({ root: process.cwd() });
  server.listen(port, () => {
    console.log(`Radar local aberto em http://localhost:${port}`);
    console.log("Use Ctrl+C para encerrar.");
  });
}
