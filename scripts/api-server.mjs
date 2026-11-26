import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { AnalysisLimitError, createAnalysisJobs } from "./lib/analysis-jobs.mjs";
import { createNvidiaNimClient } from "./lib/nvidia-nim.mjs";
import { createParseClient, createPdfPipeline, maxPdfBytes, PdfError, validatePdf } from "./lib/pdf-pipeline.mjs";
import {
  createGithubRadarStore,
  GitHubRadarError,
  InvalidRadarPayloadError,
  RevisionConflictError,
  validateRadarSavePayload,
} from "./lib/github-radar-store.mjs";

const defaultAllowedOrigins = ["https://joaopaulorm700.github.io", "http://localhost:4173"];
const maxJsonBytes = 1024 * 1024;

function parseAllowedOrigins(env) {
  const configured = env.ALLOWED_ORIGINS?.split(",").map((item) => item.trim()).filter(Boolean);
  return new Set(configured?.length ? configured : defaultAllowedOrigins);
}

function sha256(value) {
  return createHash("sha256").update(value).digest();
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readBody(request, limit, tooLarge) {
  if (Number(request.headers["content-length"]) > limit) throw tooLarge;

  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > limit) throw tooLarge;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}

async function readJson(request) {
  const bytes = await readBody(request, maxJsonBytes, new InvalidRadarPayloadError());
  try {
    const json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(json);
  } catch {
    throw new InvalidRadarPayloadError();
  }
}

export function createApiServer({ env = process.env, store, fetch, now, createId, jobs, runner } = {}) {
  const adminToken = env.ADMIN_TOKEN;
  if (typeof adminToken !== "string" || [...adminToken].length < 32) {
    throw new Error("ADMIN_TOKEN must contain at least 32 characters.");
  }
  const allowedOrigins = parseAllowedOrigins(env);
  const adminDigest = sha256(adminToken);
  const radarStore = store ?? createGithubRadarStore({ env, fetch, now, createId });
  const analysisJobs = jobs ?? createAnalysisJobs({ now, createId, runner: runner ?? (async (input) => {
    const analyze = createPdfPipeline({
      nim: createNvidiaNimClient({ env, fetch }),
      parse: createParseClient({
        apiKey: env.NVIDIA_API_KEY?.trim() || "",
        endpoint: env.NVIDIA_PARSE_URL?.trim() || undefined,
        fetch,
      }),
    });
    const { radar } = await radarStore.readRadar(input.signal);
    return analyze({ ...input, radar });
  }) });
  let uploading = false;

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
        "Access-Control-Allow-Headers": "Authorization, Content-Type, X-File-Name",
      });
      return response.end();
    }

    const pathname = request.url.split("?")[0];
    if (method === "GET" && pathname === "/healthz") return sendJson(response, 200, { ok: true });

    const verify = method === "POST" && pathname === "/api/v1/admin/verify";
    const save = method === "PUT" && pathname === "/api/v1/radar";
    const upload = method === "POST" && pathname === "/api/v1/analysis-jobs";
    const jobId = method === "GET" && pathname.match(/^\/api\/v1\/analysis-jobs\/([^/]+)$/)?.[1];
    if (!verify && !save && !upload && !jobId) return sendJson(response, 404, { ok: false, error: "not_found" });

    const providedToken = authorization?.match(/^Bearer (\S+)$/i)?.[1];
    if (!providedToken || !timingSafeEqual(adminDigest, sha256(providedToken))) {
      return sendJson(response, 401, { ok: false, error: "unauthorized" });
    }
    if (verify) return sendJson(response, 200, { ok: true });

    try {
      if (upload) {
        const type = request.headers["content-type"]?.split(";")[0].trim().toLowerCase();
        if (type !== "application/pdf") throw new PdfError("unsupported_media_type", 415);
        if (uploading) throw new AnalysisLimitError("analysis_busy");
        analysisJobs.assertAvailable();
        uploading = true;
        try {
          const bytes = await readBody(request, maxPdfBytes, new PdfError("pdf_too_large", 413));
          validatePdf(bytes);
          const job = analysisJobs.create({ bytes, fileName: request.headers["x-file-name"] });
          return sendJson(response, 202, { ok: true, job });
        } finally {
          uploading = false;
        }
      }
      if (jobId) {
        const job = analysisJobs.get(jobId);
        if (!job) return sendJson(response, 404, { ok: false, error: "not_found" });
        return sendJson(response, 200, { ok: true, job });
      }
      const payload = await readJson(request);
      if (!validateRadarSavePayload(payload)) throw new InvalidRadarPayloadError();
      const { radar, commit } = await radarStore.saveRadar(payload);
      return sendJson(response, 200, { ok: true, radar, commit });
    } catch (error) {
      if (error instanceof PdfError || error instanceof AnalysisLimitError) {
        if (!request.complete) response.setHeader("Connection", "close");
        return sendJson(response, error.status, { ok: false, error: error.code });
      }
      if (error instanceof InvalidRadarPayloadError) {
        if (!request.complete) response.setHeader("Connection", "close");
        return sendJson(response, 400, { ok: false, error: "invalid_payload" });
      }
      if (error instanceof RevisionConflictError) {
        return sendJson(response, 409, {
          ok: false,
          error: "revision_conflict",
          currentRevision: error.currentRevision,
          currentRadar: error.currentRadar,
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
