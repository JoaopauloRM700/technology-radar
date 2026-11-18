import { buildRadarHtmlSnapshot, normalizeRadar } from "./app-core.mjs";

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

const quadrantColors = {
  "Técnicas": "#007f92",
  "Plataformas": "#c47a00",
  "Ferramentas": "#2e7d52",
  "Linguagens e Frameworks": "#b83549",
};

let canonicalState;
let state;
let selectedId = null;

const elements = {
  sourceList: document.getElementById("sourceList"),
  sourceGrid: document.getElementById("sourceGrid"),
  radarSvg: document.getElementById("radarSvg"),
  matrixBody: document.getElementById("matrixBody"),
  pilotStrip: document.getElementById("pilotStrip"),
  blipForm: document.getElementById("blipForm"),
  detailCard: document.getElementById("detailCard"),
  selectedBlipLabel: document.getElementById("selectedBlipLabel"),
  totalBlips: document.getElementById("totalBlips"),
  pilotCount: document.getElementById("pilotCount"),
  radarRevision: document.getElementById("radarRevision"),
  markdownOutput: document.getElementById("markdownOutput"),
  toast: document.getElementById("toast"),
  ringFilter: document.getElementById("ringFilter"),
  proposalFileInput: document.getElementById("proposalFileInput"),
  pdfFileInput: document.getElementById("pdfFileInput"),
  analyzePdfButton: document.getElementById("analyzePdfButton"),
};

try {
  canonicalState = await loadState();
  state = structuredClone(canonicalState);
  elements.radarRevision.title = state.revision;
  elements.radarRevision.textContent = state.revision.split("-")[0];
  renderAll();
  bindEvents();
} catch (error) {
  elements.toast.textContent = "Não foi possível carregar o radar. " + error.message;
  elements.toast.classList.add("show");
}

async function loadState() {
  const response = await fetch("./data/radar.json");
  if (!response.ok) throw new Error("HTTP " + response.status);
  return normalizeRadar(await response.json());
}

function bindEvents() {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  document.getElementById("addBlipButton").addEventListener("click", addBlip);
  document.getElementById("deleteBlipButton").addEventListener("click", deleteSelectedBlip);
  document.getElementById("resetDataButton").addEventListener("click", resetData);
  document
    .getElementById("importProposalsButton")
    .addEventListener("click", () => elements.proposalFileInput.click());
  elements.proposalFileInput.addEventListener("change", importProposalFile);
  elements.analyzePdfButton.addEventListener("click", () => elements.pdfFileInput.click());
  elements.pdfFileInput.addEventListener("change", analyzePdfFile);
  document.getElementById("exportButton").addEventListener("click", () => {
    switchView("export");
    copyMarkdown();
  });
  document.getElementById("downloadMarkdownButton").addEventListener("click", downloadMarkdown);
  document.getElementById("downloadHtmlButton").addEventListener("click", downloadHtmlSnapshot);
  document.getElementById("saveHtmlButton").addEventListener("click", saveHtmlSnapshot);
  document.getElementById("addSourceButton").addEventListener("click", addSource);
  elements.ringFilter.addEventListener("change", renderRadar);

  elements.blipForm.addEventListener("input", (event) => {
    const blip = selectedBlip();
    if (!blip) return;
    blip[event.target.name] = event.target.value;
    renderAll({ keepForm: true });
  });
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
  renderSources();
  renderRadar();
  renderMatrix();
  renderPilots();
  if (!options.keepForm) renderForm();
  updateMarkdown();
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
        <span class="strength-${source.strength.toLowerCase()}">${source.strength}</span>
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
      <p><strong>Força:</strong> ${source.strength} | <strong>Cadência:</strong> ${escapeHtml(source.cadence)}</p>
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
      <text x="${x}" y="${y}">${Number(blip.id.split("-")[1])}</text>
      <title>${escapeHtml(blip.name)} | ${blip.quadrant} | ${blip.ring}</title>
    `;
    group.addEventListener("click", () => selectBlip(blip.id));
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") selectBlip(blip.id);
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
      row.innerHTML = `
        <td><strong>${escapeHtml(blip.id)}</strong> ${escapeHtml(blip.name)}</td>
        <td>${blip.quadrant}</td>
        <td><span class="tag ring-${blip.ring.toLowerCase()}">${blip.ring}</span></td>
        <td>${blip.horizon}</td>
        <td>${blip.maturity}</td>
        <td>${blip.risk}</td>
        <td>${blip.effort}</td>
      `;
      row.addEventListener("click", () => selectBlip(blip.id));
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
    field.disabled = !blip;
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
    <p>${escapeHtml(blip.strategic)}</p>
    <div class="detail-meta">
      <span>${escapeHtml(blip.horizon)} prazo</span>
      <span>${escapeHtml(blip.maturity)}</span>
      <span>Risco ${escapeHtml(blip.risk)}</span>
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
  const id = nextBlipId();
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
  showToast("Blip adicionado.");
}

function deleteSelectedBlip() {
  const blip = selectedBlip();
  if (!blip) return;
  const confirmed = window.confirm(`Excluir ${blip.id} - ${blip.name}?`);
  if (!confirmed) return;
  state.blips = state.blips.filter((item) => item.id !== selectedId);
  selectedId = state.blips[0]?.id ?? null;
  renderAll();
  showToast("Blip excluído.");
}

function addSource() {
  const name = window.prompt("Nome da fonte monitorada");
  if (!name) return;
  const url = window.prompt("URL da fonte");
  if (!url) return;
  const nextNumber =
    Math.max(0, ...state.sources.map((item) => Number(item.id.replace("SRC-", "")))) + 1;
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
  showToast("Fonte adicionada.");
}

async function importProposalFile(event) {
  const [file] = event.target.files;
  event.target.value = "";
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());
    const proposals = Array.isArray(payload.proposals) ? payload.proposals : [];
    if (!proposals.length) {
      showToast("Arquivo sem propostas aplicáveis.");
      return;
    }
    const confirmed = window.confirm(`Aplicar ${proposals.length} proposta(s) ao radar local?`);
    if (!confirmed) return;
    const result = applyProposals(proposals);
    renderAll();
    showToast(`${result.added} adicionadas, ${result.updated} atualizadas.`);
  } catch (error) {
    showToast("Não foi possível importar o JSON de propostas.");
    console.error(error);
  }
}

async function analyzePdfFile(event) {
  const [file] = event.target.files;
  event.target.value = "";
  if (!file) return;

  if (window.location.protocol === "file:") {
    showToast("Abra com npm.cmd run radar:app para analisar PDFs pela interface.");
    return;
  }

  elements.analyzePdfButton.disabled = true;
  elements.analyzePdfButton.classList.add("loading");
  showToast("Analisando PDF com IA...");

  try {
    const formData = new FormData();
    formData.append("pdf", file);
    const response = await fetch("/api/pdf-proposals", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Falha ao analisar PDF.");
    }

    const proposals = Array.isArray(payload.proposals) ? payload.proposals : [];
    if (!proposals.length) {
      showToast("PDF analisado, mas sem propostas aplicáveis.");
      return;
    }

    const confirmed = window.confirm(
      `O PDF gerou ${proposals.length} proposta(s). Aplicar ao radar local agora?`,
    );
    if (!confirmed) {
      showToast(`Propostas salvas em ${payload.proposalPath}.`);
      return;
    }

    const result = applyProposals(proposals);
    renderAll();
    showToast(`${result.added} adicionadas, ${result.updated} atualizadas.`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível analisar o PDF.");
  } finally {
    elements.analyzePdfButton.disabled = false;
    elements.analyzePdfButton.classList.remove("loading");
  }
}

function applyProposals(proposals) {
  if (proposals.some(({ action }) => ["remove", "delete"].includes(String(action).toLowerCase()))) {
    throw new Error("Propostas de remoção não são aceitas.");
  }
  const result = { added: 0, updated: 0 };
  proposals.forEach((proposal) => {
    const action = String(proposal.action ?? "").toLowerCase();
    if (action === "add" && proposal.blip) {
      const blip = normalizeBlip(proposal.blip);
      if (state.blips.some((item) => item.id === blip.id)) {
        blip.id = nextBlipId();
      }
      state.blips.push(blip);
      selectedId = blip.id;
      result.added += 1;
      return;
    }

    if ((action === "update" || action === "move") && proposal.id && proposal.changes) {
      const blip = state.blips.find((item) => item.id === proposal.id);
      if (!blip) return;
      Object.assign(blip, sanitizeBlipChanges(blip, proposal.changes));
      selectedId = blip.id;
      result.updated += 1;
      return;
    }

  });
  return result;
}

function normalizeBlip(input) {
  return {
    id: input.id || nextBlipId(),
    name: input.name || "Nova tecnologia",
    quadrant: validValue(input.quadrant, ["Técnicas", "Plataformas", "Ferramentas", "Linguagens e Frameworks"], "Técnicas"),
    ring: validValue(input.ring, ["Adopt", "Trial", "Assess", "Caution"], "Assess"),
    horizon: validValue(input.horizon, ["Curto", "Médio", "Longo"], "Médio"),
    maturity: validValue(input.maturity, ["Experimental", "Emergente", "Madura"], "Experimental"),
    risk: validValue(input.risk, ["Baixo", "Médio", "Alto"], "Médio"),
    effort: validValue(input.effort, ["Baixo", "Médio", "Alto"], "Médio"),
    status: input.status || "Monitorar",
    source: input.source || "Atualização por IA",
    theme: input.theme || "A definir",
    detailsUrl: input.detailsUrl || "",
    strategic: input.strategic || "Proposta gerada por atualização assistida por IA.",
    constraints: input.constraints || "Requer revisão humana antes de adoção.",
  };
}

function sanitizeBlipChanges(current, changes) {
  const base = normalizeBlip({ ...current, ...changes });
  delete base.id;
  return base;
}

function validValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function nextBlipId() {
  const nextNumber =
    Math.max(0, ...state.blips.map((item) => Number(item.id.replace("ES-", "")))) + 1;
  return `ES-${String(nextNumber).padStart(2, "0")}`;
}

function resetData() {
  const confirmed = window.confirm("Restaurar os dados iniciais do radar?");
  if (!confirmed) return;
  state = structuredClone(canonicalState);
  selectedId = state.blips[0]?.id ?? null;
  renderAll();
  showToast("Dados restaurados.");
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
  showToast("HTML gerado para download.");
}

async function saveHtmlSnapshot() {
  if (window.location.protocol === "file:") {
    downloadHtmlSnapshot();
    showToast("Sem servidor local: HTML baixado pelo navegador.");
    return;
  }

  try {
    const response = await fetch("/api/export-html", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshotPayload()),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || "Falha ao salvar HTML.");

    const blob = new Blob([payload.html], { type: "text/html;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = payload.path.split("/").at(-1) || monthlySnapshotFilename();
    link.click();
    URL.revokeObjectURL(link.href);
    showToast(`HTML salvo em ${payload.path}.`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível salvar HTML.");
  }
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

Este documento estrutura a primeira versão do Radar Tecnológico e Technology Roadmap para Engenharia de Software, com foco em desenvolvimento, qualidade, segurança, DevOps, engenharia com IA e governança técnica. A proposta institucional é acelerar inovação em propostas de projetos com um processo contínuo de curadoria, experimentação controlada e atualização mensal.

## Visão Geral da Trilha

Os temas prioritários são Engenharia com IA, Qualidade e Testes, Segurança e Governança, DevOps e Plataforma, Supply Chain, Medição e Sustentabilidade Técnica. A postura desta versão é inovadora para P&D: tecnologias em Trial e Assess devem ser exploradas com guardrails, métricas e revisão humana.

## Tabela Matriz de Roadmap e Radar

| Tecnologia/Técnica | Quadrante | Anel (Recomendação) | Horizonte | Maturidade | Risco | Esforço |
|---|---|---|---|---|---|---|
${rows}

## Fichas Detalhadas das Tendências

${details}

## Plano de Ação e Próximos Passos

${pilots}

Critérios mínimos dos pilotos: hipótese explícita, ambiente controlado, métricas antes/depois, política de revisão humana, evidências de segurança, plano de saída e apresentação mensal de aprendizado.

## Protocolo de Atualização Mensal

1. Coletar sinais nas fontes monitoradas.
2. Agrupar evidências por tema, quadrante e tecnologia.
3. Propor alterações de anel, horizonte, maturidade, risco e esforço.
4. Registrar justificativa, fontes e contraindicações.
5. Submeter a revisão humana do comitê técnico.
6. Publicar versão mensal do radar e atualizar o backlog de pilotos.

## Fontes Monitoradas pelo Agente de IA

| Fonte | Força | Cadência | Sinal Observado | URL |
|---|---|---|---|---|
${sources}
`;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 2200);
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
