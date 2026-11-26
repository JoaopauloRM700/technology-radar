import {
  applySelectedProposals,
  blipLabel,
  buildRadarHtmlSnapshot,
  hasDraftChanges,
  isHttpUrl,
  MAX_PROPOSALS,
  nextBlipId,
  normalizeRadar,
  pollAnalysisJob,
  prepareProposalsForReview,
  resolveApiBaseUrl,
  sanitizeHeaderFilename,
  wakeBackend,
} from "./app-core.mjs";

const DEFAULT_DETAIL_URLS = {
  "ES-01": "https://github.blog/ai-and-ml/github-copilot/whats-new-with-github-copilot-coding-agent/",
  "ES-02": "https://martinfowler.com/articles/harness-engineering.html",
  "ES-03": "https://www.thoughtworks.com/radar",
  "ES-04": "https://langchain-ai.github.io/langgraph/",
  "ES-05": "https://github.com/github/spec-kit",
  "ES-06": "https://www.thoughtworks.com/radar",
  "ES-07": "https://mutants.rs/",
  "ES-08": "https://hypothesis.readthedocs.io/",
  "ES-09": "https://playwright.dev/",
  "ES-10": "https://dora.dev/research/",
  "ES-11": "https://www.thoughtworks.com/radar",
  "ES-12": "https://genai.owasp.org/",
  "ES-13": "https://genai.owasp.org/",
  "ES-14": "https://github.blog/changelog/",
  "ES-15": "https://www.thoughtworks.com/radar",
  "ES-16": "https://www.nist.gov/itl/ai-risk-management-framework",
  "ES-17": "https://owasp.org/www-project-mcp-top-10/",
  "ES-18": "https://genai.owasp.org/",
  "ES-19": "https://openssf.org/",
  "ES-20": "https://www.openpolicyagent.org/",
  "ES-21": "https://tag-app-delivery.cncf.io/whitepapers/platform-eng-v1/",
  "ES-22": "https://opentelemetry.io/",
  "ES-23": "https://www.typescriptlang.org/",
  "ES-24": "https://docs.pydantic.dev/",
  "ES-25": "https://www.thoughtworks.com/radar",
};

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const configuredSaveTimeout = Number(globalThis.RADAR_SAVE_TIMEOUT_MS);
const SAVE_TIMEOUT_MS = Number.isFinite(configuredSaveTimeout) && configuredSaveTimeout > 0
  ? configuredSaveTimeout
  : 60_000;
const FIELD_LABELS = {
  name: "Nome",
  quadrant: "Quadrante",
  ring: "Anel",
  horizon: "Horizonte",
  maturity: "Maturidade",
  risk: "Risco",
  effort: "Esforço",
  status: "Status",
  source: "Fonte",
  theme: "Tema",
  detailsUrl: "Link",
  strategic: "Justificativa",
  constraints: "Gargalos",
};
const ACTION_LABELS = {
  add: "Adicionar",
  update: "Atualizar",
  move: "Mover",
};
const STAGE_LABELS = {
  queued: "Na fila para análise...",
  preparing: "Preparando ambiente seguro...",
  extracting: "Extraindo texto do PDF...",
  ocr: "Executando OCR em páginas escaneadas...",
  proposals: "Gerando propostas com NVIDIA NIM...",
  succeeded: "Análise concluída.",
};

const quadrantColors = {
  "Técnicas": "#007f92",
  "Plataformas": "#c47a00",
  "Ferramentas": "#2e7d52",
  "Linguagens e Frameworks": "#b83549",
};

let canonicalState;
let state;
let selectedId = null;
let adminMode = false;
let adminToken = "";
let pendingReviewItems = [];
let activePdfAbort = null;
let activeAdminLoginAbort = null;
let suspendedDraft = null;
let pendingConflictRadar = null;
let savePending = false;
let toastTimer = null;

const elements = {
  sourceList: document.getElementById("sourceList"),
  sourceGrid: document.getElementById("sourceGrid"),
  radarSvg: document.getElementById("radarSvg"),
  matrixBody: document.getElementById("matrixBody"),
  pilotStrip: document.getElementById("pilotStrip"),
  blipForm: document.getElementById("blipForm"),
  detailCard: document.getElementById("detailCard"),
  selectedBlipLabel: document.getElementById("selectedBlipLabel"),
  editorPanelTitle: document.getElementById("editorPanelTitle"),
  radarViewHeading: document.getElementById("radarViewHeading"),
  radarViewSubtitle: document.getElementById("radarViewSubtitle"),
  totalBlips: document.getElementById("totalBlips"),
  pilotCount: document.getElementById("pilotCount"),
  radarUpdatedAt: document.getElementById("radarUpdatedAt"),
  radarRevision: document.getElementById("radarRevision"),
  historyLink: document.getElementById("historyLink"),
  markdownOutput: document.getElementById("markdownOutput"),
  toast: document.getElementById("toast"),
  ringFilter: document.getElementById("ringFilter"),
  proposalFileInput: document.getElementById("proposalFileInput"),
  draftIndicator: document.getElementById("draftIndicator"),
  publishBanner: document.getElementById("publishBanner"),
  adminModeButton: document.getElementById("adminModeButton"),
  resetDataButton: document.getElementById("resetDataButton"),
  saveVersionButton: document.getElementById("saveVersionButton"),
  analyzePdfButton: document.getElementById("analyzePdfButton"),
  adminDialog: document.getElementById("adminDialog"),
  adminLoginForm: document.getElementById("adminLoginForm"),
  adminTokenInput: document.getElementById("adminTokenInput"),
  adminDialogStatus: document.getElementById("adminDialogStatus"),
  adminSubmitButton: document.getElementById("adminSubmitButton"),
  saveDialog: document.getElementById("saveDialog"),
  saveVersionForm: document.getElementById("saveVersionForm"),
  changeNoteInput: document.getElementById("changeNoteInput"),
  saveDialogStatus: document.getElementById("saveDialogStatus"),
  saveConflictBox: document.getElementById("saveConflictBox"),
  saveConflictMessage: document.getElementById("saveConflictMessage"),
  saveSuccessBox: document.getElementById("saveSuccessBox"),
  saveSuccessMessage: document.getElementById("saveSuccessMessage"),
  saveConfirmButton: document.getElementById("saveConfirmButton"),
  saveCloseButton: document.getElementById("saveCloseButton"),
  downloadDraftButton: document.getElementById("downloadDraftButton"),
  reloadCanonicalButton: document.getElementById("reloadCanonicalButton"),
  pdfDialog: document.getElementById("pdfDialog"),
  pdfAnalyzeForm: document.getElementById("pdfAnalyzeForm"),
  pdfFileInput: document.getElementById("pdfFileInput"),
  publicPdfCheckbox: document.getElementById("publicPdfCheckbox"),
  pdfDialogStatus: document.getElementById("pdfDialogStatus"),
  pdfStartButton: document.getElementById("pdfStartButton"),
  pdfCancelButton: document.getElementById("pdfCancelButton"),
  reviewDialog: document.getElementById("reviewDialog"),
  reviewSummary: document.getElementById("reviewSummary"),
  reviewSelectionCount: document.getElementById("reviewSelectionCount"),
  reviewList: document.getElementById("reviewList"),
  reviewDialogStatus: document.getElementById("reviewDialogStatus"),
  applyProposalsButton: document.getElementById("applyProposalsButton"),
};

const apiBase = resolveApiBaseUrl({
  configuredBase:
    globalThis.RADAR_API_BASE ||
    document.querySelector('meta[name="radar-api-base"]')?.content ||
    "",
  location: window.location,
});

const historyUrl = document.querySelector('meta[name="radar-history-url"]')?.content;
if (historyUrl && elements.historyLink) elements.historyLink.href = historyUrl;

try {
  canonicalState = await loadState();
  state = structuredClone(canonicalState);
  renderAll();
  bindEvents();
} catch (error) {
  elements.toast.textContent = "Não foi possível carregar o radar. " + error.message;
  elements.toast.classList.add("show");
}

async function loadState() {
  const response = await fetch("./data/radar.json", { cache: "no-store" });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return normalizeRadar(await response.json());
}

async function runWithDeadline(operation, timeoutMs) {
  const controller = new AbortController();
  const error = new Error("Não foi possível confirmar a publicação dentro do prazo.");
  error.code = "publish_timeout";
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = globalThis.setTimeout(() => {
      reject(error);
      controller.abort(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      deadline,
    ]);
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function bindEvents() {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      const dialog = document.getElementById(button.dataset.closeDialog);
      if (dialog === elements.saveDialog && savePending) return;
      if (dialog === elements.adminDialog) cancelAdminLogin();
      dialog?.close();
    });
  });

  elements.adminModeButton.addEventListener("click", handleAdminModeButton);
  elements.adminLoginForm.addEventListener("submit", handleAdminLogin);
  elements.adminDialog.addEventListener("cancel", cancelAdminLogin);
  elements.adminDialog.addEventListener("close", () => {
    if (activeAdminLoginAbort) cancelAdminLogin();
  });

  document.getElementById("addBlipButton").addEventListener("click", addBlip);
  document.getElementById("deleteBlipButton").addEventListener("click", deleteSelectedBlip);
  elements.resetDataButton.addEventListener("click", discardDraft);
  elements.saveVersionButton.addEventListener("click", openSaveDialog);
  elements.saveVersionForm.addEventListener("submit", handleSaveVersion);
  elements.saveDialog.addEventListener("cancel", (event) => {
    if (savePending) event.preventDefault();
  });
  elements.downloadDraftButton.addEventListener("click", downloadDraftJson);
  elements.reloadCanonicalButton.addEventListener("click", reloadCanonicalVersion);

  document
    .getElementById("importProposalsButton")
    .addEventListener("click", () => {
      if (!adminMode) return;
      elements.proposalFileInput.click();
    });
  elements.proposalFileInput.addEventListener("change", importProposalFile);

  elements.analyzePdfButton.addEventListener("click", openPdfDialog);
  elements.pdfAnalyzeForm.addEventListener("submit", handlePdfAnalyzeSubmit);
  elements.pdfCancelButton.addEventListener("click", cancelPdfDialog);
  elements.pdfDialog.addEventListener("cancel", () => {
    activePdfAbort?.abort();
  });

  elements.applyProposalsButton.addEventListener("click", applySelectedReviewProposals);

  document.getElementById("exportButton").addEventListener("click", () => {
    switchView("export");
    copyMarkdown();
  });
  document.getElementById("downloadMarkdownButton").addEventListener("click", downloadMarkdown);
  document.getElementById("saveHtmlButton").addEventListener("click", downloadHtmlSnapshot);
  document.getElementById("addSourceButton").addEventListener("click", addSource);
  elements.ringFilter.addEventListener("change", renderRadar);

  elements.blipForm.addEventListener("input", (event) => {
    if (!adminMode) return;
    const blip = selectedBlip();
    if (!blip || !event.target.name) return;
    blip[event.target.name] = event.target.value;
    renderAll({ keepForm: true });
  });
}

function setAdminSession(active, token = "") {
  adminMode = active;
  adminToken = active ? token : "";
  if (active && suspendedDraft) {
    state = suspendedDraft;
    suspendedDraft = null;
  }
  syncAdminUi();
  renderAll();
}

function suspendAdminSession() {
  if (hasDraftChanges(canonicalState, state)) suspendedDraft = structuredClone(state);
  state = structuredClone(canonicalState);
  setAdminSession(false, "");
}

function cancelAdminLogin() {
  activeAdminLoginAbort?.abort();
  activeAdminLoginAbort = null;
  elements.adminSubmitButton.disabled = false;
}

function syncAdminUi() {
  document.querySelectorAll("[data-admin-only]").forEach((node) => {
    node.classList.toggle("hidden", !adminMode);
  });
  elements.adminModeButton.querySelector("span").textContent = adminMode
    ? "Sair do admin"
    : "Modo administrador";
  elements.editorPanelTitle.textContent = adminMode ? "Editor de Blip" : "Detalhes do Blip";
  elements.radarViewHeading.textContent = adminMode ? "Radar Editável" : "Radar Tecnológico";
  elements.radarViewSubtitle.textContent = adminMode
    ? "Edite blips ou analise PDFs públicos. Alterações ficam em rascunho até Salvar versão."
    : "Clique em um blip para consultar detalhes estratégicos e recomendações.";
  syncDraftUi();
}

function syncDraftUi() {
  const dirty = adminMode && hasDraftChanges(canonicalState, state);
  elements.draftIndicator.classList.toggle("hidden", !dirty);
  elements.resetDataButton.disabled = !dirty;
  elements.saveVersionButton.disabled = !dirty;
}

function handleAdminModeButton() {
  if (adminMode) {
    if (hasDraftChanges(canonicalState, state)) {
      const confirmed = window.confirm(
        "Sair do modo administrador e descartar as alterações não publicadas do rascunho?",
      );
      if (!confirmed) return;
      state = structuredClone(canonicalState);
    }
    suspendedDraft = null;
    setAdminSession(false, "");
    showToast("Modo somente leitura restaurado.");
    return;
  }

  elements.adminTokenInput.value = "";
  setStatus(elements.adminDialogStatus, "");
  if (!apiBase) {
    setStatus(
      elements.adminDialogStatus,
      "URL da API não configurada. Defina a meta tag radar-api-base em index.html.",
      true,
    );
  }
  elements.adminDialog.showModal();
  elements.adminTokenInput.focus();
}

async function handleAdminLogin(event) {
  event.preventDefault();
  if (!apiBase) {
    setStatus(
      elements.adminDialogStatus,
      "Configure a meta tag radar-api-base em index.html com a URL pública da API.",
      true,
    );
    return;
  }

  const token = elements.adminTokenInput.value.trim();
  if ([...token].length < 32) {
    setStatus(elements.adminDialogStatus, "O token administrativo deve ter ao menos 32 caracteres.", true);
    return;
  }

  cancelAdminLogin();
  const abortController = new AbortController();
  activeAdminLoginAbort = abortController;
  elements.adminSubmitButton.disabled = true;
  setStatus(elements.adminDialogStatus, "Conectando à API administrativa...");
  try {
    await wakeBackend({
      apiBase,
      signal: abortController.signal,
      onRetry: ({ elapsedMs }) => {
        const seconds = Math.max(1, Math.round(elapsedMs / 1000));
        setStatus(
          elements.adminDialogStatus,
          `Acordando servidor Render (${seconds}s / 90s)...`,
        );
      },
    });
    const response = await fetch(apiBase + "/api/v1/admin/verify", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      cache: "no-store",
      signal: abortController.signal,
    });
    if (activeAdminLoginAbort !== abortController || !elements.adminDialog.open) return;
    if (response.status === 401) {
      setStatus(elements.adminDialogStatus, "Token administrativo inválido.", true);
      return;
    }
    if (!response.ok) {
      setStatus(elements.adminDialogStatus, "Não foi possível validar o acesso agora.", true);
      return;
    }
    elements.adminTokenInput.value = "";
    activeAdminLoginAbort = null;
    elements.adminSubmitButton.disabled = false;
    elements.adminDialog.close();
    setAdminSession(true, token);
    showToast("Modo administrador ativado.");
  } catch (error) {
    if (abortController.signal.aborted) return;
    setStatus(
      elements.adminDialogStatus,
      error?.message || "Falha de comunicação com o servidor administrativo.",
      true,
    );
  } finally {
    if (activeAdminLoginAbort === abortController) {
      activeAdminLoginAbort = null;
      elements.adminSubmitButton.disabled = false;
    }
  }
}

function openSaveDialog() {
  if (!adminMode || savePending) return;
  pendingConflictRadar = null;
  elements.changeNoteInput.value = "";
  setStatus(elements.saveDialogStatus, "");
  elements.saveConflictBox.classList.add("hidden");
  elements.saveSuccessBox.classList.add("hidden");
  elements.saveConfirmButton.disabled = false;
  elements.reloadCanonicalButton.disabled = true;
  elements.saveDialog.showModal();
  elements.changeNoteInput.focus();
}

async function handleSaveVersion(event) {
  event.preventDefault();
  if (!adminMode || savePending) return;
  const changeNote = elements.changeNoteInput.value.trim();
  if (!changeNote) {
    setStatus(elements.saveDialogStatus, "Informe uma descrição para a versão.", true);
    return;
  }
  const submittedRadar = structuredClone({ blips: state.blips, sources: state.sources });
  const submittedRevision = canonicalState.revision;

  savePending = true;
  elements.saveConfirmButton.disabled = true;
  elements.saveCloseButton.disabled = true;
  elements.saveConflictBox.classList.add("hidden");
  elements.saveSuccessBox.classList.add("hidden");
  setStatus(elements.saveDialogStatus, "Validando conexão com o servidor...");

  try {
    await wakeBackend({
      apiBase,
      onRetry: ({ elapsedMs }) => {
        const seconds = Math.max(1, Math.round(elapsedMs / 1000));
        setStatus(elements.saveDialogStatus, `Acordando servidor Render (${seconds}s / 90s)...`);
      },
    });
    setStatus(elements.saveDialogStatus, "Criando commit versionado no GitHub...");
    const { response, payload } = await runWithDeadline(async (signal) => {
      const response = await fetch(apiBase + "/api/v1/radar", {
        method: "PUT",
        headers: {
          Authorization: "Bearer " + adminToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          baseRevision: submittedRevision,
          changeNote,
          radar: submittedRadar,
        }),
        signal,
      });
      if (response.status === 401) {
        response.body?.cancel().catch(() => {});
        return { response, payload: null };
      }
      const payload = await response.json().catch((error) => {
        if (signal.aborted) throw signal.reason || error;
        return null;
      });
      return { response, payload };
    }, SAVE_TIMEOUT_MS);

    if (response.status === 409) {
      try {
        pendingConflictRadar = normalizeRadar(payload?.currentRadar);
      } catch {
        pendingConflictRadar = null;
      }
      const currentRev = payload?.currentRevision
        ? ` (${String(payload.currentRevision).slice(0, 8)})`
        : "";
      elements.saveConflictMessage.textContent = pendingConflictRadar
        ? `Outra versão já foi publicada no GitHub${currentRev}. Seu rascunho foi preservado nesta aba. Baixe-o como JSON ou recarregue a versão oficial retornada pelo GitHub.`
        : `Outra versão já foi publicada no GitHub${currentRev}. Seu rascunho foi preservado nesta aba, mas a versão oficial não pôde ser validada. Baixe-o como JSON antes de tentar novamente.`;
      elements.reloadCanonicalButton.disabled = !pendingConflictRadar;
      elements.saveConflictBox.classList.remove("hidden");
      setStatus(elements.saveDialogStatus, "");
      return;
    }

    if (response.status === 401) {
      suspendAdminSession();
      setStatus(
        elements.saveDialogStatus,
        "Sessão administrativa expirada. Seu rascunho continua em memória; entre novamente para salvar.",
        true,
      );
      return;
    }

    if (!response.ok || !payload?.ok) {
      const reason = payload?.error === "invalid_payload"
        ? "Verifique se todos os campos obrigatórios e URLs HTTP/HTTPS estão preenchidos."
        : "Não foi possível publicar a versão no GitHub.";
      setStatus(elements.saveDialogStatus, reason, true);
      return;
    }

    const currentDraft = structuredClone({ blips: state.blips, sources: state.sources });
    const changedDuringPublish = JSON.stringify(currentDraft) !== JSON.stringify(submittedRadar);
    canonicalState = normalizeRadar(payload.radar);
    state = changedDuringPublish
      ? { ...structuredClone(canonicalState), ...currentDraft }
      : structuredClone(canonicalState);
    renderAll();

    const shortSha = String(payload.commit?.sha || "").slice(0, 7);
    const safeCommitUrl =
      isHttpUrl(payload.commit?.url)
        ? payload.commit.url
        : "";
    const commitLinkHtml = safeCommitUrl
      ? `<a href="${escapeHtml(safeCommitUrl)}" target="_blank" rel="noreferrer">commit ${escapeHtml(shortSha || "criado")}</a>`
      : `commit ${escapeHtml(shortSha || "criado")}`;
    const draftNote = changedDuringPublish
      ? " Alterações feitas durante a publicação continuam no rascunho."
      : "";
    const noteHtml = `Versão salva (${commitLinkHtml}). O GitHub Pages pode levar alguns minutos para atualizar a página pública.${draftNote}`;
    elements.saveSuccessMessage.innerHTML = noteHtml;
    elements.saveSuccessBox.classList.remove("hidden");
    elements.publishBanner.innerHTML = `<span>${noteHtml}</span>`;
    elements.publishBanner.classList.remove("hidden");
    setStatus(elements.saveDialogStatus, "");
    showToast("Versão publicada no GitHub.");
  } catch (error) {
    setStatus(
      elements.saveDialogStatus,
      error?.code === "publish_timeout"
        ? "Não foi possível confirmar a publicação dentro do prazo. O rascunho foi preservado; confira o histórico do GitHub antes de tentar novamente."
        : error?.message || "Erro ao comunicar com o servidor de publicação.",
      true,
    );
  } finally {
    savePending = false;
    elements.saveConfirmButton.disabled = false;
    elements.saveCloseButton.disabled = false;
  }
}

function downloadDraftJson() {
  const payload = {
    ...state,
    exportedDraftAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `radar-rascunho-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Rascunho baixado em JSON.");
}

function reloadCanonicalVersion() {
  if (!pendingConflictRadar || savePending) return;
  try {
    canonicalState = structuredClone(pendingConflictRadar);
    state = structuredClone(canonicalState);
    pendingConflictRadar = null;
    selectedId = state.blips[0]?.id ?? null;
    elements.saveDialog.close();
    renderAll();
    showToast("Última versão oficial recarregada.");
  } catch (error) {
    setStatus(elements.saveDialogStatus, "Falha ao recarregar: " + error.message, true);
  }
}

function openPdfDialog() {
  if (!adminMode) return;
  elements.pdfAnalyzeForm.reset();
  setStatus(elements.pdfDialogStatus, "");
  elements.pdfStartButton.disabled = false;
  elements.pdfDialog.showModal();
}

function cancelPdfDialog() {
  activePdfAbort?.abort();
  elements.pdfDialog.close();
}

async function handlePdfAnalyzeSubmit(event) {
  event.preventDefault();
  if (!adminMode) return;
  const [file] = elements.pdfFileInput.files;
  if (!file) {
    setStatus(elements.pdfDialogStatus, "Selecione um arquivo PDF público.", true);
    return;
  }
  if (!elements.publicPdfCheckbox.checked) {
    setStatus(elements.pdfDialogStatus, "Confirme que o PDF é um documento público.", true);
    return;
  }
  if (file.size > MAX_PDF_BYTES) {
    setStatus(elements.pdfDialogStatus, "O PDF excede o limite de 10 MiB.", true);
    return;
  }

  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const signature = String.fromCharCode(...header);
  if (signature !== "%PDF-") {
    setStatus(elements.pdfDialogStatus, "O arquivo selecionado não possui assinatura %PDF- válida.", true);
    return;
  }

  const abortController = new AbortController();
  activePdfAbort = abortController;
  elements.pdfStartButton.disabled = true;
  elements.analyzePdfButton.disabled = true;
  elements.analyzePdfButton.classList.add("loading");
  setStatus(elements.pdfDialogStatus, "Verificando disponibilidade do servidor...");

  try {
    await wakeBackend({
      apiBase,
      signal: abortController.signal,
      onRetry: ({ elapsedMs }) => {
        const seconds = Math.max(1, Math.round(elapsedMs / 1000));
        setStatus(
          elements.pdfDialogStatus,
          `Acordando servidor Render (${seconds}s / 90s)...`,
        );
      },
    });

    setStatus(elements.pdfDialogStatus, "Enviando PDF para análise temporária...");
    const uploadResponse = await fetch(apiBase + "/api/v1/analysis-jobs", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + adminToken,
        "Content-Type": "application/pdf",
        "X-File-Name": sanitizeHeaderFilename(file.name),
      },
      body: file,
      signal: abortController.signal,
    });
    const uploadPayload = await uploadResponse.json().catch(() => null);

    if (uploadResponse.status === 401) {
      suspendAdminSession();
      throw new Error("Sessão administrativa expirada. Entre novamente no modo administrador.");
    }
    if (uploadResponse.status === 429) {
      throw new Error(
        uploadPayload?.error === "daily_limit"
          ? "Limite diário de 10 análises atingido. Tente novamente após 00:00 UTC."
          : "Já existe uma análise em andamento. Aguarde a conclusão antes de enviar outro PDF.",
      );
    }
    if (!uploadResponse.ok || !uploadPayload?.ok || !uploadPayload.job?.id) {
      throw new Error(mapUploadError(uploadResponse.status, uploadPayload?.error));
    }

    const job = await pollAnalysisJob({
      apiBase,
      jobId: uploadPayload.job.id,
      token: adminToken,
      signal: abortController.signal,
      onUpdate: (snapshot) => {
        const stageText = STAGE_LABELS[snapshot.progress?.stage] || "Analisando PDF...";
        const total = snapshot.progress?.totalPages || 0;
        const done = snapshot.progress?.processedPages || 0;
        const suffix = total > 0 ? ` (${done}/${total} páginas)` : "";
        setStatus(elements.pdfDialogStatus, stageText + suffix);
      },
    });

    elements.pdfDialog.close();
    const proposals = job.result?.proposals ?? [];
    if (!proposals.length) {
      showToast("PDF analisado sem propostas de alteração aplicáveis.");
      return;
    }
    openReviewDialog(
      proposals,
      `Análise concluída (${job.result.totalPages} páginas, ${job.result.ocrPages} com OCR). Selecione até ${MAX_PROPOSALS} propostas para aplicar ao rascunho.`,
    );
  } catch (error) {
    if (abortController.signal.aborted) {
      setStatus(elements.pdfDialogStatus, "Análise cancelada.");
      return;
    }
    if (error?.code === "unauthorized") suspendAdminSession();
    setStatus(elements.pdfDialogStatus, error?.message || "Não foi possível concluir a análise do PDF.", true);
  } finally {
    activePdfAbort = null;
    elements.pdfStartButton.disabled = false;
    elements.analyzePdfButton.disabled = false;
    elements.analyzePdfButton.classList.remove("loading");
  }
}

function mapUploadError(status, code) {
  if (status === 413 || code === "pdf_too_large") return "O PDF excede o limite de 10 MiB.";
  if (status === 415 || code === "unsupported_media_type") return "Envie um arquivo com tipo application/pdf.";
  if (status === 400 || code === "invalid_pdf") return "O conteúdo do PDF é inválido.";
  return "Não foi possível iniciar a análise do PDF.";
}

async function importProposalFile(event) {
  const [file] = event.target.files;
  event.target.value = "";
  if (!file || !adminMode) return;

  try {
    const payload = JSON.parse(await file.text());
    const proposals = Array.isArray(payload.proposals) ? payload.proposals : [];
    if (!proposals.length) {
      showToast("Arquivo sem propostas aplicáveis.");
      return;
    }
    openReviewDialog(
      proposals,
      `${proposals.length} proposta(s) carregadas do arquivo. Todas começam desmarcadas; selecione até ${MAX_PROPOSALS} para aplicar ao rascunho.`,
    );
  } catch (error) {
    showToast("Não foi possível importar o JSON de propostas.");
    console.error(error);
  }
}

function openReviewDialog(rawProposals, summaryText) {
  pendingReviewItems = prepareProposalsForReview(state, rawProposals);
  elements.reviewSummary.textContent = summaryText;
  setStatus(elements.reviewDialogStatus, "");
  elements.reviewList.innerHTML = "";

  pendingReviewItems.forEach((item) => {
    const card = document.createElement("article");
    card.className = "proposal-card" + (item.valid ? "" : " invalid");
    const proposal = item.proposal || {};
    const action = String(proposal.action || "inválida");
    const actionLabel = ACTION_LABELS[action] || action;
    const confidence = Number.isFinite(proposal.confidence)
      ? Math.round(proposal.confidence * 100) + "%"
      : "—";
    const title = item.valid
      ? `${proposal.targetId ? proposal.targetId + " — " : ""}${proposal.blip.name}`
      : `Proposta #${item.index + 1} (${actionLabel})`;

    const evidenceHtml = item.valid && Array.isArray(proposal.evidence) && proposal.evidence.length
      ? `<ul class="proposal-evidence">${proposal.evidence
          .map((ev) => `<li><strong>Pág. ${escapeHtml(ev.page)}:</strong> ${escapeHtml(ev.note)}</li>`)
          .join("")}</ul>`
      : "";

    const diffHtml = item.valid && item.diff.changes.length
      ? `<div class="proposal-diff">${item.diff.changes
          .map(
            (change) => `<div class="diff-row">
              <span class="diff-field">${escapeHtml(FIELD_LABELS[change.field] || change.field)}</span>
              <span>
                ${change.before !== null ? `<span class="diff-before">${escapeHtml(change.before || "—")}</span>` : ""}
                <span class="diff-after">${escapeHtml(change.after || "—")}</span>
              </span>
            </div>`,
          )
          .join("")}</div>`
      : "";

    card.innerHTML = `
      <div class="proposal-card-header">
        <input
          type="checkbox"
          data-proposal-index="${item.index}"
          aria-label="Selecionar proposta: ${escapeHtml(title)}"
          ${item.valid ? "" : "disabled"}
        />
        <div>
          <div class="proposal-badges">
            <span class="proposal-action ${escapeHtml(action)}">${escapeHtml(actionLabel)}</span>
            <strong>${escapeHtml(title)}</strong>
            <span class="tag">Confiança ${escapeHtml(confidence)}</span>
          </div>
          ${proposal.reason ? `<p class="proposal-reason">${escapeHtml(proposal.reason)}</p>` : ""}
        </div>
      </div>
      ${item.valid ? "" : `<p class="proposal-error">${escapeHtml(item.error)}</p>`}
      ${evidenceHtml}
      ${diffHtml}
    `;

    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox.addEventListener("change", updateReviewSelection);
    elements.reviewList.appendChild(card);
  });

  updateReviewSelection();
  elements.reviewDialog.showModal();
}

function selectedReviewIndices() {
  return [...elements.reviewList.querySelectorAll('input[type="checkbox"]:checked')].map((input) =>
    Number(input.dataset.proposalIndex),
  );
}

function updateReviewSelection() {
  const chosen = selectedReviewIndices();
  elements.reviewSelectionCount.textContent = `${chosen.length} / ${MAX_PROPOSALS} selecionadas`;
  const overLimit = chosen.length > MAX_PROPOSALS;
  elements.applyProposalsButton.disabled = chosen.length === 0 || overLimit;
  setStatus(
    elements.reviewDialogStatus,
    overLimit ? `Selecione no máximo ${MAX_PROPOSALS} propostas por aplicação.` : "",
    overLimit,
  );
}

function applySelectedReviewProposals() {
  if (!adminMode) return;
  const indices = selectedReviewIndices();
  try {
    let nextSequence = BigInt(nextBlipId(state.blips).slice(3));
    const result = applySelectedProposals(state, pendingReviewItems, indices, {
      createId: () => "ES-" + String(nextSequence++).padStart(2, "0"),
    });
    state = result.draft;
    selectedId = result.selectedId ?? selectedId;
    elements.reviewDialog.close();
    renderAll();
    showToast(
      `${result.added} adicionada(s), ${result.updated} atualizada(s) no rascunho. Clique em Salvar versão para publicar.`,
    );
  } catch (error) {
    setStatus(elements.reviewDialogStatus, error?.message || "Não foi possível aplicar as propostas.", true);
  }
}

function switchView(view) {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.viewPanel !== view);
  });
  if (view === "export") updateMarkdown();
}

function renderAll(options = {}) {
  if (!state.blips.find((item) => item.id === selectedId)) {
    selectedId = state.blips[0]?.id ?? null;
  }
  elements.totalBlips.textContent = state.blips.length;
  elements.pilotCount.textContent = state.blips.filter((item) =>
    item.status.includes("Piloto"),
  ).length;
  elements.radarRevision.title = canonicalState.revision;
  elements.radarRevision.textContent = canonicalState.revision.split("-")[0];
  elements.radarUpdatedAt.textContent = formatShortDate(canonicalState.updatedAt);
  renderSources();
  renderRadar();
  renderMatrix();
  renderPilots();
  if (!options.keepForm) renderForm();
  else renderDetailCard(selectedBlip());
  updateMarkdown();
  syncDraftUi();
}

function renderSources() {
  elements.sourceList.innerHTML = "";
  state.sources.slice(0, 8).forEach((source) => {
    const row = document.createElement("div");
    row.className = "source-row";
    row.innerHTML = `
      <span class="source-logo">${escapeHtml(source.initials)}</span>
      <div>
        <strong>${escapeHtml(source.name)}</strong>
        <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(cleanUrl(source.url))}</a>
      </div>
      <div class="source-meta">
        <span class="strength-${source.strength.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}">${escapeHtml(source.strength)}</span>
        <span>${escapeHtml(source.cadence)}</span>
      </div>
    `;
    elements.sourceList.appendChild(row);
  });

  elements.sourceGrid.innerHTML = "";
  state.sources.forEach((source) => {
    const detail = document.createElement("article");
    detail.className = "source-detail";
    detail.innerHTML = `
      <h3>${escapeHtml(source.name)}</h3>
      <p><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(cleanUrl(source.url))}</a></p>
      <p><strong>Força:</strong> ${escapeHtml(source.strength)} | <strong>Cadência:</strong> ${escapeHtml(source.cadence)}</p>
      <ul>
        <li>${escapeHtml(source.signal)}</li>
        <li>${escapeHtml(source.agentUse)}</li>
      </ul>
    `;
    elements.sourceGrid.appendChild(detail);
  });
}

function renderRadar() {
  const svg = elements.radarSvg;
  svg.innerHTML = `
    <defs>
      <filter id="blipShadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#143044" flood-opacity="0.18"/>
      </filter>
    </defs>
    <circle cx="380" cy="380" r="356" fill="#ffffff" stroke="#98a9b4" stroke-width="1.2"/>
    <path d="M380 380 L24 380 A356 356 0 0 1 380 24 Z" fill="#e9f7f8"/>
    <path d="M380 380 L380 24 A356 356 0 0 1 736 380 Z" fill="#eef8f0"/>
    <path d="M380 380 L24 380 A356 356 0 0 0 380 736 Z" fill="#fff8e9"/>
    <path d="M380 380 L380 736 A356 356 0 0 0 736 380 Z" fill="#fff0f2"/>
    <circle cx="380" cy="380" r="356" fill="none" stroke="#93a4ae" stroke-width="1.2"/>
    <circle cx="380" cy="380" r="286" fill="none" stroke="#aab8bf" stroke-dasharray="4 4"/>
    <circle cx="380" cy="380" r="206" fill="none" stroke="#aab8bf" stroke-dasharray="4 4"/>
    <circle cx="380" cy="380" r="126" fill="none" stroke="#aab8bf" stroke-dasharray="4 4"/>
    <line x1="24" y1="380" x2="736" y2="380" stroke="#8ea1ab" stroke-width="1"/>
    <line x1="380" y1="24" x2="380" y2="736" stroke="#8ea1ab" stroke-width="1"/>
    <text class="radar-label" x="118" y="80">Técnicas</text>
    <text class="radar-label" x="610" y="80">Ferramentas</text>
    <text class="radar-label" x="104" y="692">Plataformas</text>
    <text class="radar-label" x="575" y="692">Linguagens</text>
    <text class="radar-ring-label" x="380" y="363" text-anchor="middle">Adopt</text>
    <text class="radar-ring-label" x="380" y="264" text-anchor="middle">Trial</text>
    <text class="radar-ring-label" x="380" y="184" text-anchor="middle">Assess</text>
    <text class="radar-ring-label" x="380" y="104" text-anchor="middle">Caution</text>
  `;

  const filter = elements.ringFilter.value;
  const visible = state.blips.filter((blip) => filter === "Todos" || blip.ring === filter);
  visible.forEach((blip, index) => {
    const { x, y } = coordinatesFor(blip, index);
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.classList.add("blip");
    if (blip.id === selectedId) group.classList.add("selected");
    group.setAttribute("tabindex", "0");
    group.setAttribute("role", "button");
    group.setAttribute("aria-label", `${blip.id} ${blip.name}`);
    group.innerHTML = `
      <circle cx="${x}" cy="${y}" r="14" fill="${quadrantColors[blip.quadrant]}" stroke="#ffffff" stroke-width="2" filter="url(#blipShadow)"></circle>
      <text x="${x}" y="${y}">${blipLabel(blip.id, index)}</text>
      <title>${escapeHtml(blip.name)} | ${escapeHtml(blip.quadrant)} | ${escapeHtml(blip.ring)}</title>
    `;
    group.addEventListener("click", () => selectBlip(blip.id));
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectBlip(blip.id);
      }
    });
    svg.appendChild(group);
  });
}

function renderMatrix() {
  elements.matrixBody.innerHTML = "";
  const order = { Curto: 1, Médio: 2, Longo: 3 };
  [...state.blips]
    .sort((a, b) => order[a.horizon] - order[b.horizon] || a.id.localeCompare(b.id))
    .forEach((blip) => {
      const row = document.createElement("tr");
      row.classList.toggle("selected", blip.id === selectedId);
      row.tabIndex = 0;
      row.innerHTML = `
        <td><strong>${escapeHtml(blip.id)}</strong> ${escapeHtml(blip.name)}</td>
        <td>${escapeHtml(blip.quadrant)}</td>
        <td><span class="tag ring-${escapeHtml(blip.ring.toLowerCase())}">${escapeHtml(blip.ring)}</span></td>
        <td>${escapeHtml(blip.horizon)}</td>
        <td>${escapeHtml(blip.maturity)}</td>
        <td>${escapeHtml(blip.risk)}</td>
        <td>${escapeHtml(blip.effort)}</td>
      `;
      row.addEventListener("click", () => selectBlip(blip.id));
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectBlip(blip.id);
        }
      });
      elements.matrixBody.appendChild(row);
    });
}

function renderPilots() {
  elements.pilotStrip.innerHTML = "";
  state.blips
    .filter((blip) => blip.status.includes("Piloto"))
    .forEach((blip) => {
      const chip = document.createElement("button");
      chip.className = "pilot-chip";
      chip.innerHTML = `<span>${escapeHtml(blip.id)}</span>${escapeHtml(blip.name)}`;
      chip.addEventListener("click", () => selectBlip(blip.id));
      elements.pilotStrip.appendChild(chip);
    });
}

function renderForm() {
  const blip = selectedBlip();
  elements.blipForm.querySelectorAll("input, select, textarea").forEach((field) => {
    field.disabled = !adminMode || !blip;
    field.value = field.name === "detailsUrl" && blip ? getDetailsUrl(blip) : (blip?.[field.name] ?? "");
  });
  elements.selectedBlipLabel.textContent = blip
    ? `${blip.id} | ${blip.ring} | ${blip.horizon} prazo`
    : "Nenhum blip selecionado.";
  renderDetailCard(blip);
}

function renderDetailCard(blip) {
  if (!blip) {
    elements.detailCard.innerHTML = "<p>Selecione um ponto no radar para ver a ficha resumida.</p>";
    return;
  }
  const url = getDetailsUrl(blip);
  elements.detailCard.innerHTML = `
    <div class="detail-kicker">${escapeHtml(blip.quadrant)} | ${escapeHtml(blip.ring)}</div>
    <h3>${escapeHtml(blip.name)}</h3>
    <span class="detail-section-label">Justificativa estratégica</span>
    <p>${escapeHtml(blip.strategic)}</p>
    <span class="detail-section-label">Gargalos e contraindicações</span>
    <p>${escapeHtml(blip.constraints)}</p>
    <div class="detail-meta">
      <span>${escapeHtml(blip.horizon)} prazo</span>
      <span>${escapeHtml(blip.maturity)}</span>
      <span>Risco ${escapeHtml(blip.risk)}</span>
      <span>Esforço ${escapeHtml(blip.effort)}</span>
      <span>${escapeHtml(blip.status)}</span>
    </div>
    <a class="detail-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">
      Ver detalhes
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>
    </a>
  `;
}

function selectBlip(id) {
  selectedId = id;
  renderAll();
}

function selectedBlip() {
  return state.blips.find((item) => item.id === selectedId);
}

function addBlip() {
  if (!adminMode) return;
  const id = nextBlipId(state.blips);
  state.blips.push({
    id,
    name: "Nova tecnologia",
    quadrant: "Técnicas",
    ring: "Assess",
    horizon: "Médio",
    maturity: "Experimental",
    risk: "Médio",
    effort: "Médio",
    status: "Monitorar",
    source: "A definir",
    theme: "A definir",
    detailsUrl: "",
    strategic: "Descrever hipótese estratégica, valor esperado e contexto de aplicação.",
    constraints: "Descrever riscos, dependências, lacunas e contraindicações.",
  });
  selectedId = id;
  renderAll();
  showToast("Blip adicionado ao rascunho.");
}

function deleteSelectedBlip() {
  if (!adminMode) return;
  const blip = selectedBlip();
  if (!blip) return;
  const confirmed = window.confirm(`Excluir ${blip.id} - ${blip.name} do rascunho?`);
  if (!confirmed) return;
  state.blips = state.blips.filter((item) => item.id !== selectedId);
  selectedId = state.blips[0]?.id ?? null;
  renderAll();
  showToast("Blip excluído do rascunho.");
}

function addSource() {
  if (!adminMode) return;
  const name = window.prompt("Nome da fonte monitorada")?.trim();
  if (!name) return;
  const url = window.prompt("URL HTTP/HTTPS da fonte")?.trim();
  if (!isHttpUrl(url)) {
    showToast("Informe uma URL HTTP ou HTTPS válida.");
    return;
  }
  const nextNumber =
    Math.max(0, ...state.sources.map((item) => Number(item.id.replace("SRC-", "")) || 0)) + 1;
  state.sources.push({
    id: `SRC-${String(nextNumber).padStart(2, "0")}`,
    name,
    initials: name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase(),
    url,
    strength: "Complementar",
    cadence: "A definir",
    signal: "Fonte adicionada manualmente para avaliação.",
    agentUse: "Coletar sinais e aguardar classificação editorial.",
  });
  renderAll();
  showToast("Fonte adicionada ao rascunho.");
}

function discardDraft() {
  if (!adminMode) return;
  const confirmed = window.confirm(
    "Descartar alterações do rascunho e restaurar a última versão oficial carregada?",
  );
  if (!confirmed) return;
  state = structuredClone(canonicalState);
  selectedId = state.blips[0]?.id ?? null;
  renderAll();
  showToast("Rascunho descartado.");
}

function coordinatesFor(blip, index) {
  const ranges = {
    "Técnicas": [185, 265],
    "Ferramentas": [275, 355],
    "Plataformas": [95, 175],
    "Linguagens e Frameworks": [5, 85],
  };
  const [minDeg, maxDeg] = ranges[blip.quadrant];
  const spread = maxDeg - minDeg;
  const h = hash(`${blip.id}-${blip.name}-${blip.quadrant}`);
  const angleDeg = minDeg + ((h + index * 19) % spread);
  const angle = (angleDeg * Math.PI) / 180;
  const ringRadius = {
    Adopt: [58, 120],
    Trial: [145, 205],
    Assess: [230, 285],
    Caution: [305, 344],
  }[blip.ring];
  const radius = ringRadius[0] + (hash(`${blip.id}-${blip.ring}`) % (ringRadius[1] - ringRadius[0]));
  return {
    x: Math.round(380 + Math.cos(angle) * radius),
    y: Math.round(380 + Math.sin(angle) * radius),
  };
}

function hash(input) {
  return [...input].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 9973, 7);
}

function updateMarkdown() {
  elements.markdownOutput.value = generateMarkdown();
}

function getDetailsUrl(blip) {
  return blip.detailsUrl || DEFAULT_DETAIL_URLS[blip.id] || sourceUrlFor(blip.source);
}

function sourceUrlFor(sourceName = "") {
  const lower = sourceName.toLowerCase();
  const source = state.sources.find((item) => lower.includes(item.name.toLowerCase().split(" ")[0]));
  return source?.url || "https://www.thoughtworks.com/radar";
}

async function copyMarkdown() {
  updateMarkdown();
  try {
    await navigator.clipboard.writeText(elements.markdownOutput.value);
    showToast("Markdown copiado para a área de transferência.");
  } catch {
    showToast("Markdown atualizado para cópia manual.");
  }
}

function downloadMarkdown() {
  updateMarkdown();
  const blob = new Blob([elements.markdownOutput.value], { type: "text/markdown;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "radar-trm-engenharia-software.md";
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadHtmlSnapshot() {
  const payload = snapshotPayload();
  const html = buildRadarHtmlSnapshot(payload);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = monthlySnapshotFilename(payload.generatedAt);
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Snapshot HTML baixado pelo navegador.");
}

function snapshotPayload() {
  return {
    title: "Radar Tecnologico e TRM - Engenharia de Software",
    generatedAt: new Date().toISOString(),
    blips: state.blips.map((blip) => ({ ...blip, detailsUrl: getDetailsUrl(blip) })),
    sources: state.sources,
  };
}

function monthlySnapshotFilename(generatedAt = new Date().toISOString()) {
  return `${generatedAt.slice(0, 10)}-radar-tecnologico-engenharia-software.html`;
}

function generateMarkdown() {
  const rows = state.blips
    .map(
      (blip) =>
        `| ${blip.name} | ${blip.quadrant} | ${blip.ring} | ${blip.horizon} | ${blip.maturity} | ${blip.risk} | ${blip.effort} |`,
    )
    .join("\n");
  const details = ["Curto", "Médio", "Longo"]
    .map((horizon) => {
      const items = state.blips
        .filter((blip) => blip.horizon === horizon)
        .map(
          (blip) => `### ${blip.id} - ${blip.name}
- **Quadrante:** ${blip.quadrant}
- **Anel:** ${blip.ring}
- **Maturidade | Risco | Esforço:** ${blip.maturity} | ${blip.risk} | ${blip.effort}
- **Justificativa Estratégica:** ${blip.strategic}
- **Gargalos e Contraindicações:** ${blip.constraints}
- **Mais detalhes:** ${getDetailsUrl(blip)}`,
        )
        .join("\n\n");
      return `## ${horizon} Prazo\n\n${items}`;
    })
    .join("\n\n");
  const sources = state.sources
    .map(
      (source) =>
        `| ${source.name} | ${source.strength} | ${source.cadence} | ${source.signal} | ${source.url} |`,
    )
    .join("\n");
  const pilots = state.blips
    .filter((blip) => blip.status.includes("Piloto"))
    .map((blip) => `- ${blip.name}: piloto controlado com métricas de valor, qualidade e risco.`)
    .join("\n");

  return `# Radar Tecnológico e TRM - Engenharia de Software

## Sumário Executivo

Este documento estrutura a versão atual do Radar Tecnológico e Technology Roadmap para Engenharia de Software, com foco em desenvolvimento, qualidade, segurança, DevOps, engenharia com IA e governança técnica.

## Tabela Matriz de Roadmap e Radar

| Tecnologia/Técnica | Quadrante | Anel (Recomendação) | Horizonte | Maturidade | Risco | Esforço |
|---|---|---|---|---|---|---|
${rows}

## Fichas Detalhadas das Tendências

${details}

## Plano de Ação e Próximos Passos

${pilots}

## Fontes Monitoradas

| Fonte | Força | Cadência | Sinal Observado | URL |
|---|---|---|---|---|
${sources}
`;
}

function setStatus(element, text, isError = false) {
  element.textContent = text;
  element.classList.toggle("error", Boolean(isError && text));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 3200);
}

function formatShortDate(iso) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Mensal";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

function cleanUrl(url) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
