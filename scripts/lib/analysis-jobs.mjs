import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { validateProposals } from "./nvidia-nim.mjs";
import { PdfError } from "./pdf-pipeline.mjs";

const messages = {
  analysis_timeout: "A análise excedeu o limite de dez minutos.",
  analysis_failed: "Não foi possível concluir a análise.",
  encrypted_pdf: "O PDF deve estar sem criptografia.",
  invalid_page_count: "O PDF deve ter entre 1 e 75 páginas.",
  invalid_pdf: "O conteúdo do PDF é inválido.",
  text_too_large: "O texto do PDF excedeu o limite de 300.000 caracteres.",
  ocr_failed: "Não foi possível reconhecer o texto de uma página.",
  ocr_timeout: "O reconhecimento de uma página excedeu o tempo limite.",
};

export class AnalysisLimitError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
    this.status = 429;
  }
}

export function createAnalysisJobs({ runner, now = () => new Date(), sleep = delay, createId = randomUUID }) {
  const jobs = new Map();
  let active, day, dailyCount = 0;

  function prune() {
    const cutoff = now().getTime() - 30 * 60_000;
    for (const [id, job] of jobs) {
      if (job !== active && Date.parse(job.updatedAt) <= cutoff) jobs.delete(id);
    }
  }

  async function run(job, input) {
    const controller = new AbortController();
    const { signal } = controller;
    const deadline = sleep(10 * 60_000, undefined, { signal }).then(() => {
      controller.abort();
      throw new PdfError("analysis_timeout");
    });
    function onProgress({ stage, processedPages, totalPages }) {
      if (active !== job || signal.aborted) return;
      job.progress = { stage, processedPages, totalPages };
      job.updatedAt = now().toISOString();
    }
    job.status = "running";
    onProgress({ stage: "preparing", processedPages: 0, totalPages: 0 });
    let work;
    try {
      work = Promise.resolve().then(() => runner({ ...input, signal, onProgress }));
      const { proposals, totalPages, ocrPages } = await Promise.race([deadline, work]);
      if (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > 75 ||
          !Number.isInteger(ocrPages) || ocrPages < 0 || ocrPages > totalPages) throw new Error();
      validateProposals({ proposals }, { totalPages });
      job.result = { proposals, totalPages, ocrPages };
      job.status = "succeeded";
      job.progress = { stage: "succeeded", processedPages: totalPages, totalPages };
    } catch (error) {
      const code = error instanceof PdfError && Object.hasOwn(messages, error.code) ? error.code : "analysis_failed";
      job.status = "failed";
      job.error = { code, message: messages[code] };
    } finally {
      controller.abort();
      job.updatedAt = now().toISOString();
      if (work) await Promise.allSettled([work]);
      if (active === job) active = undefined;
    }
  }

  function assertAvailable() {
    prune();
    if (active) throw new AnalysisLimitError("analysis_busy");
    const timestamp = now().toISOString();
    const today = timestamp.slice(0, 10);
    if (day !== today) {
      day = today;
      dailyCount = 0;
    }
    if (dailyCount >= 10) throw new AnalysisLimitError("daily_limit");
  }

  function create(input) {
    assertAvailable();
    const timestamp = now().toISOString();
    const job = {
      id: createId(), status: "queued", createdAt: timestamp, updatedAt: timestamp,
      progress: { stage: "queued", processedPages: 0, totalPages: 0 },
    };
    jobs.set(job.id, job);
    active = job;
    dailyCount++;
    queueMicrotask(() => run(job, input));
    return structuredClone(job);
  }

  return { assertAvailable, create, get(id) { prune(); return structuredClone(jobs.get(id)); } };
}
