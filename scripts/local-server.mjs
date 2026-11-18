import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { generateProposalFile, loadEnvFile } from "./nim-proposals.mjs";
import { saveRadarHtmlSnapshot } from "./html-export.mjs";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const uploadsDir = path.join(root, "data", "uploads");

await loadEnvFile(path.join(root, ".env"));
await mkdir(uploadsDir, { recursive: true });

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/api/pdf-proposals") {
      await handlePdfUpload(request, response);
      return;
    }

    if (request.method === "POST" && request.url === "/api/export-html") {
      await handleHtmlExport(request, response);
      return;
    }

    if (request.method === "GET" || request.method === "HEAD") {
      await serveStatic(request, response);
      return;
    }

    sendJson(response, 405, { ok: false, error: "method-not-allowed" });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { ok: false, error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Radar local aberto em http://localhost:${port}`);
  console.log("Use Ctrl+C para encerrar.");
});

async function handleHtmlExport(request, response) {
  const body = await readRequestBody(request, 20 * 1024 * 1024);
  const payload = JSON.parse(body.toString("utf8"));
  const result = await saveRadarHtmlSnapshot(payload, { root });
  sendJson(response, 200, {
    ok: true,
    path: result.relativePath,
    html: result.html,
  });
}

async function handlePdfUpload(request, response) {
  const contentType = request.headers["content-type"] || "";
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1] ?? contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];
  if (!boundary) {
    sendJson(response, 400, { ok: false, error: "multipart-boundary-ausente" });
    return;
  }

  const body = await readRequestBody(request, 80 * 1024 * 1024);
  const parts = parseMultipart(body, boundary);
  const filePart = parts.find((part) => part.filename && part.name === "pdf") ?? parts.find((part) => part.filename);

  if (!filePart) {
    sendJson(response, 400, { ok: false, error: "pdf-nao-encontrado" });
    return;
  }

  if (!filePart.filename.toLowerCase().endsWith(".pdf")) {
    sendJson(response, 400, { ok: false, error: "arquivo-nao-pdf" });
    return;
  }

  const uploadName = `${timestampSlug()}-${safeFilename(filePart.filename)}`;
  const uploadPath = path.join(uploadsDir, uploadName);
  await writeFile(uploadPath, filePart.data);

  const analysis = await runAnalyzer(uploadPath);
  if (!analysis.ok) {
    sendJson(response, 500, {
      ok: false,
      error: "analise-pdf-falhou",
      uploadPath: relative(uploadPath),
      analysis,
    });
    return;
  }

  const proposalPath = path.join(root, analysis.proposalsPath);
  const ai = await generateProposalFile(proposalPath, { root, overwrite: true });
  if (!ai.ok) {
    sendJson(response, 502, {
      ok: false,
      error: ai.reason,
      uploadPath: relative(uploadPath),
      analysis,
      ai,
    });
    return;
  }

  sendJson(response, 200, {
    ok: true,
    uploadPath: relative(uploadPath),
    analysis,
    proposalPath: ai.proposalPath,
    proposals: ai.payload?.proposals ?? [],
    payload: ai.payload,
  });
}

function runAnalyzer(pdfPath) {
  return new Promise((resolve) => {
    const analyzerPath = path.join(root, "scripts", "analyze-pdf.mjs");
    const child = spawn(process.execPath, [analyzerPath, pdfPath], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      const base = safeName(path.basename(pdfPath, ".pdf"));
      resolve({
        ok: code === 0,
        exitCode: code,
        textPath: relative(path.join(root, "data", "pdf", `${base}.txt`)),
        signalsPath: relative(path.join(root, "data", "pdf", `${base}-signals.json`)),
        briefPath: relative(path.join(root, "docs", `${base}-brief.md`)),
        proposalsPath: relative(path.join(root, "data", "pdf", `${base}-proposals.json`)),
        stdout: stdout.trim().slice(-800),
        stderr: stderr.trim().slice(-800),
      });
    });
  });
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://localhost:${port}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(root, decodeURIComponent(requested)));

  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("404");
    return;
  }

  const body = request.method === "HEAD" ? null : await readFile(filePath);
  response.writeHead(200, {
    "Content-Type": mimeType(filePath),
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function readRequestBody(request, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("upload-maior-que-limite"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function parseMultipart(buffer, boundary) {
  const body = buffer.toString("latin1");
  const delimiter = `--${boundary}`;
  return body
    .split(delimiter)
    .slice(1, -1)
    .map((part) => {
      const cleaned = part.replace(/^\r?\n/, "").replace(/\r?\n$/, "");
      const headerEnd = cleaned.indexOf("\r\n\r\n");
      if (headerEnd === -1) return null;
      const headerText = cleaned.slice(0, headerEnd);
      const content = cleaned.slice(headerEnd + 4);
      const disposition = headerText.match(/content-disposition:\s*([^\r\n]+)/i)?.[1] ?? "";
      const name = disposition.match(/name="([^"]+)"/i)?.[1] ?? "";
      const filename = disposition.match(/filename="([^"]*)"/i)?.[1] ?? "";
      const type = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1] ?? "";
      return {
        name,
        filename,
        type,
        data: Buffer.from(content, "latin1"),
      };
    })
    .filter(Boolean);
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".mjs": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".pdf": "application/pdf",
    }[ext] || "application/octet-stream"
  );
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function safeName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function safeFilename(value) {
  const parsed = path.parse(value || "upload.pdf");
  const name = safeName(parsed.name || "upload").slice(0, 110) || "upload";
  return `${name}.pdf`;
}

function relative(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}
