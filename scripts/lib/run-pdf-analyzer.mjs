import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";

const analyzerPath = fileURLToPath(new URL("../analyze-pdf.mjs", import.meta.url));

export function runPdfAnalyzer(root, pdfPath) {
  return new Promise((resolve) => {
    const child = fork(analyzerPath, [pdfPath], {
      cwd: root,
      execArgv: [],
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    let paths;
    let stdout = "";
    let stderr = "";
    child.once("message", (result) => { paths = result; });
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => { stderr += error.message; });
    child.on("close", (code) => {
      resolve({
        ok: code === 0 && Boolean(paths),
        exitCode: code,
        ...paths,
        stdout: stdout.trim().slice(-800),
        stderr: stderr.trim().slice(-800),
      });
    });
  });
}
