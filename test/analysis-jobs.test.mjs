import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as tick } from "node:timers/promises";
import { createAnalysisJobs } from "../scripts/lib/analysis-jobs.mjs";

const output = { proposals: [], totalPages: 2, ocrPages: 1 };
const input = { bytes: Buffer.from("%PDF-private"), fileName: "private.pdf" };
function fixture(runner) {
  let time = Date.parse("2026-11-18T23:59:59.000Z");
  let id = 0;
  let expire;
  const jobs = createAnalysisJobs({
    runner, now: () => new Date(time), createId: () => "job-" + ++id,
    sleep: (ms) => {
      assert.equal(ms, 600000);
      return new Promise((resolve) => { expire = resolve; });
    },
  });
  return { jobs, advance: (ms) => { time += ms; }, expire: () => expire() };
}

test("snapshots queued, running, progress, and sanitized success; rejects a second active job", async () => {
  let complete, progress;
  const { jobs, advance } = fixture(({ bytes, fileName, onProgress }) => {
    assert.deepEqual(bytes, Buffer.from("%PDF-private"));
    assert.equal(fileName, "private.pdf");
    progress = onProgress;
    return new Promise((resolve) => { complete = resolve; });
  });
  const first = jobs.create(input);
  assert.deepEqual(first, {
    id: "job-1", status: "queued", createdAt: "2026-11-18T23:59:59.000Z", updatedAt: "2026-11-18T23:59:59.000Z",
    progress: { stage: "queued", processedPages: 0, totalPages: 0 },
  });
  assert.throws(() => jobs.create(input), { code: "analysis_busy", status: 429 });
  await tick();
  assert.equal(jobs.get("job-1").status, "running");
  advance(100);
  progress({ stage: "ocr", processedPages: 1, totalPages: 2 });
  const running = jobs.get("job-1");
  assert.equal(running.updatedAt, "2026-11-18T23:59:59.100Z");
  assert.deepEqual(running.progress, { stage: "ocr", processedPages: 1, totalPages: 2 });
  running.progress.stage = "modified";
  assert.equal(jobs.get("job-1").progress.stage, "ocr");
  complete({ ...output, prompt: "private" });
  await tick();
  const done = jobs.get("job-1");
  assert.equal(done.status, "succeeded");
  assert.deepEqual(done.result, { proposals: [], totalPages: 2, ocrPages: 1 });
  assert.doesNotMatch(JSON.stringify(done), /private/);
  assert.equal(jobs.create(input).id, "job-2");
});

test("limits creation to ten per UTC day, independent of terminal job expiration", async () => {
  const { jobs, advance } = fixture(async () => output);
  for (let i = 0; i < 10; i++) {
    jobs.create(input);
    await tick();
  }
  assert.throws(() => jobs.create(input), { code: "daily_limit", status: 429 });
  advance(1000);
  assert.equal(jobs.create(input).id, "job-11");
});

test("expires a terminal job thirty minutes after completion", async () => {
  let complete;
  const { jobs, advance } = fixture(() => new Promise((resolve) => { complete = resolve; }));
  jobs.create(input);
  await tick();
  advance(10000);
  complete(output);
  await tick();
  advance(1799999);
  assert.equal(jobs.get("job-1").status, "succeeded");
  advance(1);
  assert.equal(jobs.get("job-1"), undefined);
  assert.equal(jobs.get("unknown"), undefined);
});

test("fails and aborts at ten minutes, ignoring late progress and result", async () => {
  let context, complete;
  const { jobs, expire } = fixture((options) => {
    context = options;
    return new Promise((resolve) => { complete = resolve; });
  });
  jobs.create(input);
  await tick();
  expire();
  await tick();
  assert.equal(context.signal.aborted, true);
  const snapshot = jobs.get("job-1");
  assert.equal(snapshot.status, "failed");
  assert.equal(snapshot.error.code, "analysis_timeout");
  assert.equal(typeof snapshot.error.message, "string");
  context.onProgress({ stage: "ocr", processedPages: 1, totalPages: 2 });
  complete(output);
  await tick();
  assert.deepEqual(jobs.get("job-1"), snapshot);
  assert.equal(jobs.create(input).id, "job-2");
});

for (const [label, runner] of [
  ["runner exception", () => { throw Object.assign(Error("private prompt"), { code: "private/path", stack: "secret stack" }); }],
  ["six proposals", () => ({ ...output, proposals: Array(6).fill({}) })],
  ["delete", () => ({ ...output, proposals: [{ action: "delete" }] })],
  ["remove", () => ({ ...output, proposals: [{ action: "remove" }] })],
]) {
  test("publishes only a safe error for " + label, async () => {
    const { jobs } = fixture(runner);
    jobs.create(input);
    await tick();
    const failed = jobs.get("job-1");
    assert.equal(failed.status, "failed");
    assert.deepEqual(failed.error, { code: "analysis_failed", message: "Não foi possível concluir a análise." });
    assert.equal(failed.result, undefined);
    assert.doesNotMatch(JSON.stringify(failed), /private|secret/);
  });
}
