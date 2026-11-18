import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import {
  createGithubRadarStore,
  GitHubRadarError,
  InvalidRadarPayloadError,
  RevisionConflictError,
  validateRadarSavePayload,
} from "./lib/github-radar-store.mjs";

const allowedOrigins = new Set(["https://joapaulorm700.github.io", "http://localhost:4173"]);
const maxJsonBytes = 1024 * 1024;

function sha256(value) {
  return createHash("sha256").update(value).digest();
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  if (Number(request.headers["content-length"]) > maxJsonBytes) throw new InvalidRadarPayloadError();

  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maxJsonBytes) throw new InvalidRadarPayloadError();
    chunks.push(chunk);
  }

  try {
    const json = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, size));
    return JSON.parse(json);
  } catch {
    throw new InvalidRadarPayloadError();
  }
}

export function createApiServer({ env = process.env, store, fetch, now, createId } = {}) {
  const adminToken = env.ADMIN_TOKEN;
  if (typeof adminToken !== "string" || [...adminToken].length < 32) {
    throw new Error("ADMIN_TOKEN must contain at least 32 characters.");
  }
  const adminDigest = sha256(adminToken);
  const radarStore = store ?? createGithubRadarStore({ env, fetch, now, createId });

  return createServer(async (request, response) => {
    const { method, headers: { origin, authorization } } = request;
    response.setHeader("Vary", "Origin");
    if (origin !== undefined) {
      if (!allowedOrigins.has(origin)) {
        return sendJson(response, 403, { ok: false, error: "origin_forbidden" });
      }
      response.setHeader("Access-Control-Allow-Origin", origin);
    }

    if (method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      });
      return response.end();
    }

    const pathname = request.url.split("?")[0];
    if (method === "GET" && pathname === "/healthz") return sendJson(response, 200, { ok: true });

    const verify = method === "POST" && pathname === "/api/v1/admin/verify";
    const save = method === "PUT" && pathname === "/api/v1/radar";
    if (!verify && !save) return sendJson(response, 404, { ok: false, error: "not_found" });

    const providedToken = authorization?.match(/^Bearer (\S+)$/i)?.[1];
    if (!providedToken || !timingSafeEqual(adminDigest, sha256(providedToken))) {
      return sendJson(response, 401, { ok: false, error: "unauthorized" });
    }
    if (verify) return sendJson(response, 200, { ok: true });

    try {
      const payload = await readJson(request);
      if (!validateRadarSavePayload(payload)) throw new InvalidRadarPayloadError();
      const { radar, commit } = await radarStore.saveRadar(payload);
      return sendJson(response, 200, { ok: true, radar, commit });
    } catch (error) {
      if (error instanceof InvalidRadarPayloadError) {
        if (!request.complete) response.setHeader("Connection", "close");
        return sendJson(response, 400, { ok: false, error: "invalid_payload" });
      }
      if (error instanceof RevisionConflictError) {
        return sendJson(response, 409, {
          ok: false,
          error: "revision_conflict",
          currentRevision: error.currentRevision,
        });
      }
      if (error instanceof GitHubRadarError) {
        return sendJson(response, 502, { ok: false, error: "github_upstream" });
      }
      return sendJson(response, 500, { ok: false, error: "internal_error" });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 8787);
  const server = createApiServer();
  server.listen(port, () => console.log("Radar API listening on port " + server.address().port));
}
