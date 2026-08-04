import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const quadrantColors = {
  "Técnicas": "#007f92",
  "Plataformas": "#c47a00",
  "Ferramentas": "#2e7d52",
  "Linguagens e Frameworks": "#b83549",
};

export async function saveRadarHtmlSnapshot(payload, options = {}) {
  const root = options.root ?? process.cwd();
  const exportDir = path.join(root, "exports");
  await mkdir(exportDir, { recursive: true });

  const title = payload.title || "Radar Tecnologico e TRM - Engenharia de Software";
  const date = payload.generatedAt ? new Date(payload.generatedAt) : new Date();
  const fileName = `${date.toISOString().slice(0, 10)}-radar-tecnologico-engenharia-software.html`;
  const filePath = path.join(exportDir, fileName);
  const html = buildRadarHtmlSnapshot({
    title,
    generatedAt: date.toISOString(),
    blips: Array.isArray(payload.blips) ? payload.blips : [],
    sources: Array.isArray(payload.sources) ? payload.sources : [],
  });

  await writeFile(filePath, html, "utf8");
  return {
    filePath,
    relativePath: path.relative(root, filePath).replace(/\\/g, "/"),
    html,
  };
}

export function buildRadarHtmlSnapshot({ title, generatedAt, blips, sources }) {
  const safeBlips = blips.map(normalizeBlipForExport);
  const safeSources = sources.map(normalizeSourceForExport);
  const radarSvg = buildRadarSvg(safeBlips);
  const matrixRows = safeBlips.map(matrixRow).join("");
  const details = ["Curto", "Médio", "Longo"]
    .map((horizon) => {
      const items = safeBlips.filter((blip) => blip.horizon === horizon).map(detailCard).join("");
      return `<section class="section"><h2>${horizon} Prazo</h2><div class="cards">${items || "<p>Nenhum blip neste horizonte.</p>"}</div></section>`;
    })
    .join("");
  const sourceRows = safeSources.map(sourceRow).join("");
  const pilots = safeBlips
    .filter((blip) => String(blip.status).includes("Piloto"))
    .map((blip) => `<li><strong>${escapeHtml(blip.name)}</strong>: piloto controlado com metricas de valor, qualidade e risco.</li>`)
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        --ink: #17212b;
        --muted: #5f6f7b;
        --line: #d7e0e5;
        --shell: #f6f9fa;
        --nav: #071724;
        --panel: #ffffff;
        --teal: #008a8a;
        --green: #25985a;
        --amber: #c47a00;
        --red: #b83549;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      body { margin: 0; color: var(--ink); background: var(--shell); }
      header { padding: 28px 36px; background: var(--nav); color: white; }
      header h1 { margin: 0; font-size: 28px; line-height: 1.1; }
      header p { margin: 8px 0 0; color: #b8cbd4; }
      main { max-width: 1180px; margin: 0 auto; padding: 28px; }
      .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--line); }
      .summary div { background: white; padding: 18px; }
      .summary span { display: block; color: var(--muted); font-size: 12px; font-weight: 700; text-transform: uppercase; }
      .summary strong { display: block; margin-top: 8px; font-size: 24px; }
      .section { margin-top: 28px; }
      .section h2 { margin: 0 0 12px; font-size: 21px; }
      .panel { background: white; border: 1px solid var(--line); border-radius: 8px; padding: 20px; }
      .radar-wrap { display: grid; grid-template-columns: minmax(360px, 640px) 1fr; gap: 20px; align-items: start; }
      .legend { display: grid; gap: 10px; font-size: 13px; }
      .legend span { display: flex; gap: 8px; align-items: center; }
      .swatch { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
      table { width: 100%; border-collapse: collapse; background: white; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
      th, td { border-bottom: 1px solid var(--line); padding: 10px 12px; text-align: left; vertical-align: top; font-size: 13px; }
      th { background: #eef3f5; color: #465967; font-size: 12px; text-transform: uppercase; }
      .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
      .card { background: white; border: 1px solid var(--line); border-radius: 8px; padding: 16px; }
      .card h3 { margin: 0 0 8px; font-size: 16px; }
      .card p { margin: 8px 0 0; color: var(--muted); font-size: 13px; line-height: 1.45; }
      .tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
      .tag { border: 1px solid var(--line); border-radius: 999px; padding: 3px 8px; font-size: 11px; font-weight: 700; color: #465967; }
      a { color: #006b6f; }
      footer { margin-top: 32px; padding: 18px 0 30px; color: var(--muted); font-size: 12px; }
      @media print {
        body { background: white; }
        main { max-width: none; padding: 18px; }
        .card, table, .panel { break-inside: avoid; }
      }
      @media (max-width: 860px) {
        main { padding: 18px; }
        .summary, .radar-wrap { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <header>
      <h1>${escapeHtml(title)}</h1>
      <p>Snapshot mensal gerado em ${formatDate(generatedAt)}. Arquivo autônomo para avaliação da gestão.</p>
    </header>
    <main>
      <section class="summary">
        <div><span>Blips</span><strong>${safeBlips.length}</strong></div>
        <div><span>Pilotos P&D</span><strong>${safeBlips.filter((item) => String(item.status).includes("Piloto")).length}</strong></div>
        <div><span>Atualização</span><strong>Mensal</strong></div>
        <div><span>Versão</span><strong>${escapeHtml(new Date(generatedAt).toISOString().slice(0, 7))}</strong></div>
      </section>

      <section class="section">
        <h2>Sumário Executivo</h2>
        <div class="panel">
          <p>Este Radar Tecnológico e TRM consolida tendências, ferramentas, plataformas, técnicas, linguagens e frameworks relevantes para Engenharia de Software. O objetivo é apoiar decisões de P&D, pilotos controlados e atualização mensal contínua.</p>
        </div>
      </section>

      <section class="section">
        <h2>Radar</h2>
        <div class="panel radar-wrap">
          ${radarSvg}
          <div class="legend">
            <span><i class="swatch" style="background:#007f92"></i>Técnicas</span>
            <span><i class="swatch" style="background:#2e7d52"></i>Ferramentas</span>
            <span><i class="swatch" style="background:#c47a00"></i>Plataformas</span>
            <span><i class="swatch" style="background:#b83549"></i>Linguagens e Frameworks</span>
            <p><strong>Anéis:</strong> Adopt no centro; Trial, Assess e Caution progressivamente para fora.</p>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Matriz Radar + TRM</h2>
        <table>
          <thead><tr><th>Tecnologia/Técnica</th><th>Quadrante</th><th>Anel</th><th>Horizonte</th><th>Maturidade</th><th>Risco</th><th>Esforço</th></tr></thead>
          <tbody>${matrixRows}</tbody>
        </table>
      </section>

      ${details}

      <section class="section">
        <h2>Plano de Ação</h2>
        <div class="panel"><ul>${pilots || "<li>Sem pilotos marcados nesta versão.</li>"}</ul></div>
      </section>

      <section class="section">
        <h2>Fontes Monitoradas</h2>
        <table>
          <thead><tr><th>Fonte</th><th>Força</th><th>Cadência</th><th>Sinal</th><th>URL</th></tr></thead>
          <tbody>${sourceRows}</tbody>
        </table>
      </section>

      <footer>Radar gerado pelo sistema local Technology-Radar. Recomenda-se manter revisão humana antes de adoção institucional.</footer>
    </main>
  </body>
</html>`;
}

function buildRadarSvg(blips) {
  const circles = [90, 170, 250, 330].map((radius) => `<circle cx="380" cy="380" r="${radius}" fill="none" stroke="#a8bac4" stroke-dasharray="${radius === 330 ? "0" : "4 6"}"/>`).join("");
  const axes = `<path d="M380 50V710M50 380H710" stroke="#b6c5cc"/>`;
  const labels = `
    <text x="178" y="112" text-anchor="middle" font-size="16" font-weight="700">Técnicas</text>
    <text x="582" y="112" text-anchor="middle" font-size="16" font-weight="700">Ferramentas</text>
    <text x="178" y="668" text-anchor="middle" font-size="16" font-weight="700">Plataformas</text>
    <text x="582" y="668" text-anchor="middle" font-size="16" font-weight="700">Linguagens</text>
    <text x="380" y="376" text-anchor="middle" font-size="13" fill="#5f6f7b">Adopt</text>
    <text x="380" y="286" text-anchor="middle" font-size="13" fill="#5f6f7b">Trial</text>
    <text x="380" y="206" text-anchor="middle" font-size="13" fill="#5f6f7b">Assess</text>
    <text x="380" y="126" text-anchor="middle" font-size="13" fill="#5f6f7b">Caution</text>`;
  const points = blips.map((blip, index) => {
    const point = coordinatesFor(blip, index);
    const color = quadrantColors[blip.quadrant] || "#007f92";
    return `<g><circle cx="${point.x}" cy="${point.y}" r="13" fill="${color}" stroke="white" stroke-width="3"/><text x="${point.x}" y="${point.y + 4}" text-anchor="middle" font-size="10" font-weight="800" fill="white">${escapeHtml(String(index + 1))}</text><title>${escapeHtml(blip.name)}</title></g>`;
  }).join("");
  return `<svg viewBox="0 0 760 760" role="img" aria-label="Radar tecnológico">${circles}${axes}${labels}${points}</svg>`;
}

function coordinatesFor(blip, index) {
  const ranges = {
    "Técnicas": [185, 265],
    "Ferramentas": [275, 355],
    "Plataformas": [95, 175],
    "Linguagens e Frameworks": [5, 85],
  };
  const [minDeg, maxDeg] = ranges[blip.quadrant] ?? [185, 265];
  const spread = maxDeg - minDeg;
  const h = hash(`${blip.id}-${blip.name}-${blip.quadrant}`);
  const angleDeg = minDeg + ((h + index * 19) % spread);
  const angle = (angleDeg * Math.PI) / 180;
  const ringRadius = {
    Adopt: [58, 120],
    Trial: [145, 205],
    Assess: [230, 285],
    Caution: [305, 344],
  }[blip.ring] ?? [230, 285];
  const radius = ringRadius[0] + (hash(`${blip.id}-${blip.ring}`) % (ringRadius[1] - ringRadius[0]));
  return {
    x: Math.round(380 + Math.cos(angle) * radius),
    y: Math.round(380 + Math.sin(angle) * radius),
  };
}

function matrixRow(blip) {
  return `<tr><td>${escapeHtml(blip.name)}</td><td>${escapeHtml(blip.quadrant)}</td><td>${escapeHtml(blip.ring)}</td><td>${escapeHtml(blip.horizon)}</td><td>${escapeHtml(blip.maturity)}</td><td>${escapeHtml(blip.risk)}</td><td>${escapeHtml(blip.effort)}</td></tr>`;
}

function detailCard(blip) {
  const detailsUrl = blip.detailsUrl || "";
  return `<article class="card">
    <h3>${escapeHtml(blip.id)} - ${escapeHtml(blip.name)}</h3>
    <div class="tags">
      <span class="tag">${escapeHtml(blip.quadrant)}</span>
      <span class="tag">${escapeHtml(blip.ring)}</span>
      <span class="tag">${escapeHtml(blip.maturity)}</span>
      <span class="tag">${escapeHtml(blip.risk)}</span>
    </div>
    <p><strong>Justificativa:</strong> ${escapeHtml(blip.strategic)}</p>
    <p><strong>Gargalos:</strong> ${escapeHtml(blip.constraints)}</p>
    ${detailsUrl ? `<p><a href="${escapeAttribute(detailsUrl)}">Mais detalhes</a></p>` : ""}
  </article>`;
}

function sourceRow(source) {
  return `<tr><td>${escapeHtml(source.name)}</td><td>${escapeHtml(source.strength)}</td><td>${escapeHtml(source.cadence)}</td><td>${escapeHtml(source.signal)}</td><td><a href="${escapeAttribute(source.url)}">${escapeHtml(source.url)}</a></td></tr>`;
}

function normalizeBlipForExport(blip) {
  return {
    id: blip.id || "",
    name: blip.name || "",
    quadrant: blip.quadrant || "",
    ring: blip.ring || "",
    horizon: blip.horizon || "",
    maturity: blip.maturity || "",
    risk: blip.risk || "",
    effort: blip.effort || "",
    status: blip.status || "",
    strategic: blip.strategic || "",
    constraints: blip.constraints || "",
    detailsUrl: blip.detailsUrl || "",
  };
}

function normalizeSourceForExport(source) {
  return {
    name: source.name || "",
    strength: source.strength || "",
    cadence: source.cadence || "",
    signal: source.signal || "",
    url: source.url || "",
  };
}

function hash(input) {
  return [...String(input)].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 9973, 7);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
