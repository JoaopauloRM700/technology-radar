import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { tmpdir } from "node:os";
import { setImmediate as tick } from "node:timers/promises";
import { validatePdf, parsePdfInfo, needsOcr, createParseClient, createPdfPipeline } from "../scripts/lib/pdf-pipeline.mjs";

test("validates the PDF signature and inclusive ten MiB limit", () => {
  const limit = Buffer.alloc(10 * 1024 * 1024);
  limit.write("%PDF-");
  assert.doesNotThrow(() => validatePdf(limit));
  assert.throws(() => validatePdf(Buffer.concat([limit, Buffer.of(0)])), { code: "pdf_too_large" });
  for (const bytes of [Buffer.alloc(0), Buffer.from(" %PDF-"), Buffer.from("%PDF")]) {
    assert.throws(() => validatePdf(bytes), { code: "invalid_pdf" });
  }
});

test("requires a positive page count up to 75 and unencrypted pdfinfo", () => {
  assert.equal(parsePdfInfo("Pages:          75\r\nEncrypted:       no\r\n"), 75);
  for (const info of ["Pages: 0\nEncrypted: no", "Pages: 76\nEncrypted: no",
    "Pages: 1\nEncrypted: yes (print:yes)", "Pages: 1"]) {
    assert.throws(() => parsePdfInfo(info));
  }
});

test("selects OCR below 80 non-whitespace characters", () => {
  assert.equal(needsOcr("a ".repeat(79) + "\t\n"), true);
  assert.equal(needsOcr("á\n".repeat(80)), false);
});

const jpeg = Buffer.from([255, 216, 255, 217]);
const success = { content: "texto OCR", finish_reason: "stop", usage: { output_tokens: 2 } };
const parseClient = (fetch, options) => createParseClient({ apiKey: "key", fetch, ...options });

test("posts one JPEG and JSON options to Parse, retrying 429/503 at 2s and 5s", async () => {
  const events = [];
  const responses = [new Response(null, { status: 429 }), new Response(null, { status: 503 }), Response.json(success)];
  const parse = parseClient(async (url, init) => {
    assert.equal(url, "https://ai.api.nvidia.com/v1/retrieval/nvidia/nemotron-3.5-parse/parse");
    assert.equal(init.method, "POST");
    assert.equal(init.redirect, "error");
    assert.deepEqual(init.headers, { Authorization: "Bearer key", Accept: "application/json" });
    assert.deepEqual([...init.body.keys()], ["document", "options"]);
    const document = init.body.get("document");
    assert.equal(document.type, "image/jpeg");
    assert.deepEqual(Buffer.from(await document.arrayBuffer()), jpeg);
    assert.equal(init.body.get("options"), '{"decoding":{"max_output_tokens":4096}}');
    const response = responses.shift();
    events.push(response.status);
    return response;
  }, { sleep: async (ms) => events.push(ms) });
  assert.equal(await parse(jpeg), "texto OCR");
  assert.deepEqual(events, [429, 2000, 503, 5000, 200]);
});

for (const [label, reply, attempts] of [
  ["third 503", () => new Response(null, { status: 503 }), 3],
  ["HTTP 500", () => new Response("private", { status: 500 }), 1],
  ["network error", () => { throw Error("private"); }, 1],
  ["invalid JSON", () => new Response("private"), 1],
  ["truncated content", () => Response.json({ ...success, finish_reason: "length" }), 1],
  ["missing finish_reason", () => Response.json({ content: "private" }), 1],
  ["blank content", () => Response.json({ ...success, content: " " }), 1],
]) {
  test("sanitizes Parse failure: " + label, async () => {
    let count = 0;
    const parse = parseClient(() => { count++; return reply(); }, { sleep: async () => {} });
    await assert.rejects(parse(jpeg), { code: "ocr_failed", message: "ocr_failed" });
    assert.equal(count, attempts);
  });
}

for (const trigger of ["timeout", "abort"]) {
  test("aborts the Parse body on " + trigger + " without retry", async () => {
    const job = new AbortController();
    const timeout = new AbortController();
    let calls = 0;
    const parse = parseClient(async (_url, { signal }) => {
      calls++;
      return { status: 200, json: () => new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(Error("private")), { once: true });
        (trigger === "timeout" ? timeout : job).abort();
      }) };
    }, { timeoutSignal: (ms) => { assert.equal(ms, 60000); return timeout.signal; } });
    await assert.rejects(parse(jpeg, job.signal), { code: trigger === "timeout" ? "ocr_timeout" : "analysis_aborted" });
    assert.equal(calls, 1);
  });
}

const bytes = Buffer.from("%PDF-fixture");
const radar = { blips: [{ id: "ES-01", name: "Radar atual", ring: "Trial", strategic: "campo extenso" }] };
function pipelineFixture(pages, overrides = {}) {
  let directory;
  const rendered = [];
  const removed = [];
  const prompts = [];
  const fs = {
    async mkdtemp(prefix) {
      assert.equal(path.dirname(prefix), tmpdir());
      return directory = prefix + "unique";
    },
    async writeFile(file, contents) {
      assert.equal(path.dirname(file), directory);
      assert.deepEqual(contents, bytes);
    },
    async readFile(file) {
      assert.equal(path.dirname(file), directory);
      return Buffer.from(path.basename(file, ".jpg").split("-").at(-1));
    },
    async rm(file, options) {
      if (file === directory) {
        assert.deepEqual(options, { recursive: true, force: true });
        removed.push(file);
      }
    },
  };
  async function execute(command, args) {
    const pdf = path.join(directory, "input.pdf");
    if (command === "pdfinfo") {
      assert.deepEqual(args, [pdf]);
      return "Pages: " + pages.length + "\nEncrypted: no\n";
    }
    if (command === "pdftotext") {
      assert.deepEqual(args, ["-layout", pdf, "-"]);
      return pages.join("\f") + "\f";
    }
    assert.equal(command, "pdftoppm");
    const page = args[1];
    assert.deepEqual(args, ["-f", page, "-l", page, "-jpeg", "-scale-to", "2048", "-singlefile", pdf, path.join(directory, "page-" + page)]);
    rendered.push(Number(page));
  }
  const analyze = createPdfPipeline({
    fs, execute, parse: async (image) => "OCR-" + image,
    nim: { async generateProposals(prompt) { prompts.push(prompt); return { proposals: [] }; } },
    ...overrides,
  });
  return {
    run: (options) => analyze({ bytes, fileName: "../unsafe.pdf", radar, ...options }),
    rendered, prompts, removed, directory: () => directory,
  };
}

test("combines native/OCR pages in order, limits workers to two and removes the temporary directory", async () => {
  const pending = new Map();
  let peak = 0;
  const fixture = pipelineFixture(["", "á".repeat(80), "weak", "?"], {
    parse: (image) => new Promise((resolve) => {
      pending.set(String(image), resolve);
      peak = Math.max(peak, pending.size);
    }),
  });
  const done = fixture.run();
  await tick();
  assert.deepEqual(fixture.rendered, [1, 3]);
  function finish(page) { pending.get(page)("OCR-" + page); pending.delete(page); }
  finish("3");
  await tick();
  finish("4");
  finish("1");
  assert.deepEqual(await done, { proposals: [], totalPages: 4, ocrPages: 3 });
  assert.equal(peak, 2);
  assert.match(fixture.prompts[0], /Página 1\nOCR-1[\s\S]+Página 2\ná{80}[\s\S]+Página 3\nOCR-3[\s\S]+Página 4\nOCR-4/);
  assert.match(fixture.prompts[0], /ES-01.*Radar atual/);
  assert.doesNotMatch(fixture.prompts[0], /campo extenso/);
  assert.deepEqual(fixture.removed, [fixture.directory()]);
});

for (const [label, pages, overrides, code] of [
  ["native expansion", ["x".repeat(300001)], {}, "text_too_large"],
  ["combined OCR expansion", ["x".repeat(299999), ""], { parse: async () => "OCR" }, "text_too_large"],
  ["Poppler error", ["x"], { execute: async () => { throw Error("secret/path"); } }, "pdf_processing_failed"],
]) {
  test("removes temporary files on " + label, async () => {
    const fixture = pipelineFixture(pages, overrides);
    await assert.rejects(fixture.run(), { code });
    assert.deepEqual(fixture.removed, [fixture.directory()]);
    assert.deepEqual(fixture.prompts, []);
  });
}

test("validates PDF bytes again before creating temporary files", async () => {
  const fixture = pipelineFixture([""]);
  await assert.rejects(fixture.run({ bytes: Buffer.from("bad") }), { code: "invalid_pdf" });
  assert.equal(fixture.directory(), undefined);
});

test("rejects proposals whose target or evidence is outside the analyzed context", async () => {
  const fixture = pipelineFixture(["texto ".repeat(80)], {
    nim: { async generateProposals() {
      return { proposals: [{
        action: "update", targetId: "ES-02", reason: "Evidência", confidence: 0.8,
        evidence: [{ page: 2, note: "Página inexistente" }],
        blip: {
          name: "Radar atual", quadrant: "Ferramentas", ring: "Trial", horizon: "Médio",
          maturity: "Emergente", risk: "Baixo", effort: "Médio", status: "Monitorar",
          source: "Relatório", theme: "Qualidade", strategic: "Avaliar",
          constraints: "Validar", detailsUrl: "",
        },
      }] };
    } },
  });
  await assert.rejects(fixture.run(), { code: "pdf_processing_failed" });
  assert.deepEqual(fixture.removed, [fixture.directory()]);
});

test("waits for both aborted OCR workers before removing the job directory", async () => {
  const controller = new AbortController();
  let stopped = 0;
  const fixture = pipelineFixture(["", "", ""], {
    parse: (_image, signal) => new Promise((_, reject) => {
      signal.addEventListener("abort", async () => {
        await tick();
        stopped++;
        reject(Error("upstream details"));
      }, { once: true });
    }),
  });
  const done = fixture.run({ signal: controller.signal });
  await tick();
  controller.abort();
  await assert.rejects(done, { code: "analysis_aborted" });
  assert.equal(stopped, 2);
  assert.deepEqual(fixture.rendered, [1, 2]);
  assert.deepEqual(fixture.removed, [fixture.directory()]);
});
