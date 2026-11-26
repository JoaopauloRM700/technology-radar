import { randomUUID } from "node:crypto";
import Ajv from "ajv";
import { normalizeRadar } from "../../app-core.mjs";

export const validateRadarSavePayload = new Ajv({ ownProperties: true }).compile({
  type: "object",
  additionalProperties: false,
  required: ["baseRevision", "changeNote", "radar"],
  properties: {
    baseRevision: { type: "string", pattern: "\\S" },
    changeNote: { type: "string", pattern: "\\S", maxLength: 120 },
    radar: {
      type: "object",
      required: ["blips", "sources"],
      properties: {
        blips: { type: "array" },
        sources: { type: "array" },
      },
    },
  },
});

export class GitHubRadarError extends Error {
  constructor(status) {
    super("GitHub radar request failed.");
    this.name = "GitHubRadarError";
    this.status = status;
  }
}

export class InvalidRadarPayloadError extends Error {}

export class RevisionConflictError extends Error {
  constructor(currentRadar) {
    super("Radar revision has changed.");
    this.currentRadar = structuredClone(currentRadar);
    this.currentRevision = currentRadar.revision;
  }
}

export function createGithubRadarStore({
  env = process.env,
  fetch = globalThis.fetch,
  now = () => new Date(),
  createId = randomUUID,
} = {}) {
  const {
    GITHUB_TOKEN: token,
    GITHUB_OWNER: owner = "JoaopauloRM700",
    GITHUB_REPO: repo = "technology-radar",
    GITHUB_BRANCH: branch = "main",
  } = env;
  if (!token) throw new Error("GITHUB_TOKEN is required.");

  const repoUrl = "https://api.github.com/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo);
  const endpoint = repoUrl + "/contents/data/radar.json";
  const readUrl = endpoint + "?" + new URLSearchParams({ ref: branch });
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: "Bearer " + token,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  async function request(url, options, { retryLargeContents = false } = {}) {
    let response;
    try {
      response = await fetch(url, { headers, redirect: "error", ...options });
      if (response.ok) return await response.json();
      if (retryLargeContents && response.status === 403) {
        const failure = await response.json().catch(() => null);
        if (Array.isArray(failure?.errors) && failure.errors.some((error) => error?.code === "too_large")) {
          return request(url, {
            ...options,
            headers: { ...headers, Accept: "application/vnd.github.object+json" },
          });
        }
      } else {
        await response.body?.cancel();
      }
    } catch {
      throw new GitHubRadarError();
    }
    throw new GitHubRadarError(response.status);
  }

  async function readRadar(signal) {
    const file = await request(readUrl, { method: "GET", signal }, { retryLargeContents: true });
    const sha = file?.sha;
    if (typeof sha !== "string" || !sha) throw new GitHubRadarError();

    // Large files have a SHA but no inline content in the Contents API's object response.
    const blob = file.encoding === "none" && file.content === ""
      ? await request(repoUrl + "/git/blobs/" + encodeURIComponent(sha), { method: "GET", signal })
      : file;
    if (blob?.encoding !== "base64" || typeof blob.content !== "string") throw new GitHubRadarError();

    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(blob.content, "base64"));
      return { radar: normalizeRadar(JSON.parse(text)), sha };
    } catch {
      throw new GitHubRadarError();
    }
  }

  async function saveRadar(payload) {
    if (!validateRadarSavePayload(payload)) throw new InvalidRadarPayloadError();
    const { baseRevision, changeNote, radar: { blips, sources } } = payload;
    const revision = createId();
    const updatedAt = now().toISOString();
    let radar;
    try {
      radar = normalizeRadar({ schemaVersion: 1, revision, updatedAt, changeNote, blips, sources });
    } catch (error) {
      if (error instanceof TypeError) throw new InvalidRadarPayloadError();
      throw error;
    }

    const current = await readRadar();
    if (baseRevision !== current.radar.revision) throw new RevisionConflictError(current.radar);

    let result;
    try {
      result = await request(endpoint, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "chore(radar): " + radar.changeNote,
          content: Buffer.from(JSON.stringify(radar, null, 2) + "\n", "utf8").toString("base64"),
          sha: current.sha,
          branch,
        }),
      });
    } catch (error) {
      if (error instanceof GitHubRadarError && error.status === 409) {
        const latest = await readRadar();
        if (baseRevision !== latest.radar.revision) throw new RevisionConflictError(latest.radar);
      }
      throw error;
    }

    const { sha, html_url: url } = result?.commit ?? {};
    if (typeof sha !== "string" || !sha) throw new GitHubRadarError();
    const commit = { sha };
    if (typeof url === "string" && url) commit.url = url;
    return { radar, commit };
  }

  return { readRadar, saveRadar };
}
