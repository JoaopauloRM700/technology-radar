import { execFile } from "node:child_process";
import * as files from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { validateProposals } from "./nvidia-nim.mjs";

export const maxPdfBytes = 10 * 1024 * 1024;
const signature = Buffer.from("%PDF-");
const maxTextChars = 300_000;
const runFile = promisify(execFile);

export class PdfError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export function validatePdf(bytes) {
  if (bytes.byteLength > maxPdfBytes) throw new PdfError("pdf_too_large", 413);
  if (!Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).subarray(0, 5).equals(signature)) {
    throw new PdfError("invalid_pdf");
  }
}

export function parsePdfInfo(info) {
  if (!/^Encrypted:[ \t]+no[ \t]*\r?$/m.test(info)) throw new PdfError("encrypted_pdf");
  const pages = Number(info.match(/^Pages:[ \t]+(\d+)[ \t]*\r?$/m)?.[1]);
  if (!Number.isInteger(pages) || pages < 1 || pages > 75) throw new PdfError("invalid_page_count");
  return pages;
}

export function needsOcr(text) {
  return Array.from(text.replace(/\s/g, "")).length < 80;
}

const defaultParseUrl = "https://ai.api.nvidia.com/v1/retrieval/nvidia/nemotron-3.5-parse/parse";

export function createParseClient({
  apiKey, endpoint = defaultParseUrl, fetch = globalThis.fetch, sleep = delay, timeoutSignal = AbortSignal.timeout,
}) {
  return async function parse(jpeg, jobSignal) {
    const backoff = [2000, 5000];
    for (let attempt = 0; ; attempt++) {
      const body = new FormData();
      body.append("document", new Blob([jpeg], { type: "image/jpeg" }), "page.jpg");
      body.append("options", '{"decoding":{"max_output_tokens":4096}}');
      const timeout = timeoutSignal(60_000);
      const signal = jobSignal ? AbortSignal.any([jobSignal, timeout]) : timeout;
      try {
        signal.throwIfAborted();
        const response = await fetch(endpoint, {
          method: "POST", redirect: "error", signal, body,
          headers: { Authorization: "Bearer " + apiKey, Accept: "application/json" },
        });
        if (response.status === 200) {
          const reply = await response.json();
          if (reply?.finish_reason !== "stop" || typeof reply.content !== "string" || !reply.content.trim()) {
            throw new PdfError("ocr_failed");
          }
          return reply.content;
        }
        await response.body?.cancel();
        if (![429, 503].includes(response.status) || attempt >= backoff.length) throw new PdfError("ocr_failed");
        await sleep(backoff[attempt], undefined, { signal: jobSignal });
      } catch {
        if (jobSignal?.aborted) throw new PdfError("analysis_aborted");
        if (timeout.aborted) throw new PdfError("ocr_timeout");
        throw new PdfError("ocr_failed");
      }
    }
  };
}

async function runPoppler(command, args, signal) {
  signal?.throwIfAborted();
  const proc = runFile(command, args, {
    signal, killSignal: "SIGKILL", windowsHide: true, encoding: "utf8", maxBuffer: 4 * (maxTextChars + 75),
  });
  // Aborting execFile can reject before the child has released its files.
  let spawned = Boolean(proc.child.pid);
  const closed = new Promise((resolve) => {
    proc.child.once("spawn", () => { spawned = true; });
    proc.child.once("close", resolve);
    proc.child.once("error", () => { if (!spawned) resolve(); });
  });
  try {
    return (await proc).stdout;
  } finally {
    await closed;
  }
}

export async function processOcrPages(pages, processPage, parentSignal) {
  const controller = new AbortController();
  const signal = parentSignal ? AbortSignal.any([parentSignal, controller.signal]) : controller.signal;
  const remaining = pages.values();
  async function worker() {
    for (const page of remaining) {
      signal.throwIfAborted();
      await processPage(page, signal);
    }
  }
  const workers = [worker(), worker()];
  try {
    await Promise.all(workers);
  } catch (error) {
    controller.abort();
    await Promise.allSettled(workers);
    throw error;
  }
}

function checkLength(length) {
  if (length > maxTextChars) throw new PdfError("text_too_large");
}

export function createPdfPipeline({ fs = files, execute = runPoppler, parse, nim }) {
  return async function analyze({ bytes, fileName, radar, signal, onProgress = () => {} }) {
    validatePdf(bytes);
    signal?.throwIfAborted();
    const directory = await fs.mkdtemp(path.join(tmpdir(), "radar-pdf-"));
    try {
      const pdf = path.join(directory, "input.pdf");
      await fs.writeFile(pdf, bytes, { signal });
      const totalPages = parsePdfInfo(await execute("pdfinfo", [pdf], signal));
      onProgress({ stage: "extracting", processedPages: 0, totalPages });
      const text = await execute("pdftotext", ["-layout", pdf, "-"], signal);
      if (text.length > maxTextChars + totalPages) throw new PdfError("text_too_large");
      const pages = text.split("\f");
      if (pages.length === totalPages + 1 && pages.at(-1) === "") pages.pop();
      if (pages.length !== totalPages) throw new PdfError("invalid_pdf");
      let length = pages.reduce((sum, page) => sum + page.length, 0);
      checkLength(length);
      const scans = pages.map((_, i) => i).filter((i) => needsOcr(pages[i]));
      let processedPages = totalPages - scans.length;
      if (scans.length) onProgress({ stage: "ocr", processedPages, totalPages });
      await processOcrPages(scans, async (index, workerSignal) => {
        const page = String(index + 1);
        const prefix = path.join(directory, "page-" + page);
        await execute("pdftoppm", ["-f", page, "-l", page, "-jpeg", "-scale-to", "2048", "-singlefile", pdf, prefix], workerSignal);
        const image = await fs.readFile(prefix + ".jpg", { signal: workerSignal });
        await fs.rm(prefix + ".jpg");
        const content = await parse(image, workerSignal);
        length += content.length - pages[index].length;
        checkLength(length);
        pages[index] = content;
        onProgress({ stage: "ocr", processedPages: ++processedPages, totalPages });
      }, signal);

      signal?.throwIfAborted();
      onProgress({ stage: "proposals", processedPages, totalPages });
      const summary = radar.blips.map(({ id, name, quadrant, ring }) => ({ id, name, quadrant, ring }));
      const brief = [
        "Gere até cinco propostas no esquema do radar, com evidência por página.",
        "Radar atual: " + JSON.stringify(summary),
        "Documento: " + JSON.stringify(path.win32.basename(fileName || "document.pdf")),
        ...pages.map((content, i) => "Página " + (i + 1) + "\n" + content),
      ].join("\n\n");
      const output = await nim.generateProposals(brief, signal);
      validateProposals(output, { totalPages, targetIds: new Set(summary.map(({ id }) => id)) });
      const { proposals } = output;
      return { proposals, totalPages, ocrPages: scans.length };
    } catch (error) {
      if (signal?.aborted) throw new PdfError("analysis_aborted");
      if (error instanceof PdfError) throw error;
      throw new PdfError("pdf_processing_failed");
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  };
}
