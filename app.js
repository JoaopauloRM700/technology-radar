const STORAGE_KEY = "tech-radar-software-v02";

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

const DEFAULT_BLIPS = [
  {
    id: "ES-01",
    name: "Coding Agents",
    quadrant: "Ferramentas",
    ring: "Trial",
    horizon: "Curto",
    maturity: "Emergente",
    risk: "Médio",
    effort: "Médio",
    status: "Piloto recomendado",
    source: "Thoughtworks, GitHub",
    theme: "Engenharia com IA",
    strategic:
      "Acelerar protótipos, refatorações e geração de testes em ciclos de P&D, mantendo revisão humana e rastreabilidade.",
    constraints:
      "Pode introduzir alucinação, código pouco compreendido, vulnerabilidades e decisões arquiteturais não intencionais.",
  },
  {
    id: "ES-02",
    name: "Harnesses para agentes de código",
    quadrant: "Técnicas",
    ring: "Trial",
    horizon: "Curto",
    maturity: "Emergente",
    risk: "Médio",
    effort: "Alto",
    status: "Piloto recomendado",
    source: "Thoughtworks, Martin Fowler",
    theme: "Engenharia com IA",
    strategic:
      "Criar controles de feedforward e feedback para aumentar confiança em agentes e reduzir supervisão manual repetitiva.",
    constraints:
      "Exige arquitetura de qualidade, testes confiáveis, regras estruturais e maturidade de engenharia para funcionar bem.",
  },
  {
    id: "ES-03",
    name: "Engenharia de Contexto",
    quadrant: "Técnicas",
    ring: "Trial",
    horizon: "Curto",
    maturity: "Emergente",
    risk: "Médio",
    effort: "Médio",
    status: "Piloto recomendado",
    source: "Thoughtworks, Anthropic",
    theme: "Engenharia com IA",
    strategic:
      "Padronizar como contexto, restrições, exemplos e decisões são fornecidos a agentes para melhorar consistência de entrega.",
    constraints:
      "Contexto excessivo cria instruction bloat, ruído e decisões baseadas em informações desatualizadas.",
  },
  {
    id: "ES-04",
    name: "Frameworks de agentes (LangGraph/Semantic Kernel)",
    quadrant: "Linguagens e Frameworks",
    ring: "Trial",
    horizon: "Curto",
    maturity: "Emergente",
    risk: "Médio",
    effort: "Médio",
    status: "Monitorar",
    source: "Thoughtworks, LangGraph, Microsoft",
    theme: "Linguagens e Frameworks",
    strategic:
      "Estruturar agentes, fluxos, memória, ferramentas e supervisão em aplicações de P&D com menor esforço de orquestração.",
    constraints:
      "Ecossistema ainda muda rápido; risco de lock-in conceitual, sobreengenharia e lacunas de observabilidade.",
  },
  {
    id: "ES-05",
    name: "Spec-driven development",
    quadrant: "Técnicas",
    ring: "Trial",
    horizon: "Curto",
    maturity: "Emergente",
    risk: "Médio",
    effort: "Médio",
    status: "Monitorar",
    source: "Thoughtworks",
    theme: "Engenharia com IA",
    strategic:
      "Converter hipóteses de P&D em especificações verificáveis antes da implementação assistida por IA.",
    constraints:
      "Sem disciplina de produto e arquitetura, especificações viram documentação frágil e não testável.",
  },
  {
    id: "ES-06",
    name: "Feedback sensors + quality gates determinísticos",
    quadrant: "Técnicas",
    ring: "Trial",
    horizon: "Curto",
    maturity: "Emergente",
    risk: "Médio",
    effort: "Médio",
    status: "Piloto recomendado",
    source: "Thoughtworks",
    theme: "Qualidade e Testes",
    strategic:
      "Conectar compiladores, testes, linters, análise estática e regras arquiteturais ao loop de autocorreção dos agentes.",
    constraints:
      "Gates fracos dão falsa confiança; gates ruidosos criam lentidão e rejeição pelos times.",
  },
  {
    id: "ES-07",
    name: "Teste de mutação",
    quadrant: "Técnicas",
    ring: "Trial",
    horizon: "Curto",
    maturity: "Madura",
    risk: "Baixo",
    effort: "Médio",
    status: "Monitorar",
    source: "Thoughtworks",
    theme: "Qualidade e Testes",
    strategic:
      "Medir força real dos testes e revelar suites que passam sem proteger comportamento crítico.",
    constraints:
      "Pode aumentar custo de pipeline; exige seleção cuidadosa de módulos e metas de cobertura.",
  },
  {
    id: "ES-08",
    name: "Fuzz testing e property-based testing",
    quadrant: "Técnicas",
    ring: "Trial",
    horizon: "Curto",
    maturity: "Madura",
    risk: "Médio",
    effort: "Médio",
    status: "Monitorar",
    source: "Thoughtworks, OWASP",
    theme: "Qualidade e Testes",
    strategic:
      "Encontrar falhas em APIs, parsers, regras complexas e integrações com entrada imprevisível.",
    constraints:
      "A curva de modelagem é maior que testes exemplo-a-exemplo e pode produzir falsos positivos.",
  },
  {
    id: "ES-09",
    name: "Playwright para testes E2E e agentes",
    quadrant: "Linguagens e Frameworks",
    ring: "Trial",
    horizon: "Curto",
    maturity: "Madura",
    risk: "Baixo",
    effort: "Médio",
    status: "Piloto recomendado",
    source: "Playwright, DORA",
    theme: "Qualidade e Testes",
    strategic:
      "Automatizar fluxos reais de usuário e dar aos agentes um sensor determinístico de regressão visual e funcional.",
    constraints:
      "Testes E2E frágeis e ambientes instáveis podem gerar ruído; exige dados e seletores bem governados.",
  },
  {
    id: "ES-10",
    name: "Engineering Intelligence: DORA + QE Analytics",
    quadrant: "Técnicas",
    ring: "Adopt",
    horizon: "Curto",
    maturity: "Madura",
    risk: "Baixo",
    effort: "Médio",
    status: "Padronizar",
    source: "DORA, Perforce",
    theme: "Medição e Fluxo",
    strategic:
      "Medir fluxo, estabilidade, qualidade e impacto da IA com indicadores que orientam decisão executiva.",
    constraints:
      "Métricas mal desenhadas viram vaidade ou pressão comportamental sem melhoria sistêmica.",
  },
  {
    id: "ES-11",
    name: "Gestão de débito cognitivo em código gerado por IA",
    quadrant: "Técnicas",
    ring: "Trial",
    horizon: "Curto",
    maturity: "Emergente",
    risk: "Médio",
    effort: "Médio",
    status: "Monitorar",
    source: "Thoughtworks, SIG",
    theme: "Sustentabilidade Técnica",
    strategic:
      "Evitar que velocidade de geração resulte em sistemas que o time não consegue explicar, evoluir ou depurar.",
    constraints:
      "Difícil medir entendimento; requer revisões, ADRs, documentação viva e ownership explícito.",
  },
  {
    id: "ES-12",
    name: "Revisão humana por classe de risco",
    quadrant: "Técnicas",
    ring: "Adopt",
    horizon: "Curto",
    maturity: "Madura",
    risk: "Baixo",
    effort: "Baixo",
    status: "Padronizar",
    source: "OWASP, GitHub",
    theme: "Governança",
    strategic:
      "Definir quando PRs, prompts, mudanças de infraestrutura e ações de agentes exigem aprovação humana.",
    constraints:
      "Processo burocrático demais reduz adoção; processo vago demais não reduz risco.",
  },
  {
    id: "ES-13",
    name: "Zero Trust no SDLC agentic",
    quadrant: "Técnicas",
    ring: "Adopt",
    horizon: "Curto",
    maturity: "Madura",
    risk: "Médio",
    effort: "Alto",
    status: "Padronizar",
    source: "Thoughtworks, OWASP",
    theme: "Segurança e Governança",
    strategic:
      "Tratar agentes, plugins, pipelines e ferramentas como identidades não confiáveis por padrão.",
    constraints:
      "Integração com IAM, segredos, repositórios e ambientes de execução pode ser trabalhosa.",
  },
  {
    id: "ES-14",
    name: "Least privilege e Agentic IAM",
    quadrant: "Plataformas",
    ring: "Trial",
    horizon: "Médio",
    maturity: "Emergente",
    risk: "Alto",
    effort: "Alto",
    status: "Monitorar",
    source: "OWASP, GitHub",
    theme: "Segurança e Governança",
    strategic:
      "Reduzir raio de impacto de agentes com permissões temporárias, escopo mínimo e trilha de auditoria.",
    constraints:
      "Ferramentas e provedores ainda estão amadurecendo modelos de identidade para agentes.",
  },
  {
    id: "ES-15",
    name: "Sandboxes de execução para agentes",
    quadrant: "Plataformas",
    ring: "Trial",
    horizon: "Curto",
    maturity: "Emergente",
    risk: "Médio",
    effort: "Alto",
    status: "Monitorar",
    source: "Thoughtworks, GitHub",
    theme: "Segurança e Governança",
    strategic:
      "Permitir experimentação com menor risco isolando filesystem, rede, credenciais e comandos de agentes.",
    constraints:
      "Isolamento incompleto, custo computacional e exceções de rede podem limitar utilidade.",
  },
  {
    id: "ES-16",
    name: "AI Gateways",
    quadrant: "Plataformas",
    ring: "Assess",
    horizon: "Médio",
    maturity: "Emergente",
    risk: "Médio",
    effort: "Alto",
    status: "Monitorar",
    source: "DORA, NIST",
    theme: "Plataforma de IA",
    strategic:
      "Centralizar política, logs, roteamento de modelos, custo, proteção de dados e observabilidade de uso de IA.",
    constraints:
      "Pode criar lock-in, latência e sensação falsa de governança se não houver controles reais.",
  },
  {
    id: "ES-17",
    name: "Governança de MCP e ferramentas conectadas",
    quadrant: "Plataformas",
    ring: "Assess",
    horizon: "Médio",
    maturity: "Experimental",
    risk: "Alto",
    effort: "Alto",
    status: "Monitorar",
    source: "OWASP MCP, Thoughtworks",
    theme: "Plataforma de IA",
    strategic:
      "Controlar tool sprawl, contexto, escopos e confiabilidade de servidores conectados a agentes.",
    constraints:
      "Padrões, ameaças e ecossistema ainda mudam rapidamente; precisa de catálogo e avaliação contínua.",
  },
  {
    id: "ES-18",
    name: "Red teaming para LLMs e agentes",
    quadrant: "Técnicas",
    ring: "Trial",
    horizon: "Curto",
    maturity: "Emergente",
    risk: "Médio",
    effort: "Médio",
    status: "Piloto recomendado",
    source: "OWASP, NIST",
    theme: "Segurança e Governança",
    strategic:
      "Encontrar prompt injection, tool misuse, vazamento de dados, overreliance e ações indevidas antes de produção.",
    constraints:
      "Exige conhecimento adversarial, documentação de ameaças e integração com processos de aceite.",
  },
  {
    id: "ES-19",
    name: "SBOM, SLSA e proveniência de supply chain",
    quadrant: "Ferramentas",
    ring: "Adopt",
    horizon: "Curto",
    maturity: "Madura",
    risk: "Baixo",
    effort: "Médio",
    status: "Padronizar",
    source: "OpenSSF, OWASP",
    theme: "Supply Chain",
    strategic:
      "Rastrear dependências, artefatos, builds e assinaturas para reduzir risco de componentes comprometidos.",
    constraints:
      "Cobertura parcial e baixa ação sobre achados reduzem valor executivo.",
  },
  {
    id: "ES-20",
    name: "Policy as Code",
    quadrant: "Ferramentas",
    ring: "Adopt",
    horizon: "Curto",
    maturity: "Madura",
    risk: "Baixo",
    effort: "Médio",
    status: "Padronizar",
    source: "OpenSSF, CNCF",
    theme: "Governança",
    strategic:
      "Automatizar compliance, segurança e padrões arquiteturais em pipelines e plataformas.",
    constraints:
      "Políticas ruidosas ou não versionadas travam entrega e criam bypass informal.",
  },
  {
    id: "ES-21",
    name: "Platform Engineering + Golden Paths",
    quadrant: "Plataformas",
    ring: "Trial",
    horizon: "Médio",
    maturity: "Madura",
    risk: "Médio",
    effort: "Alto",
    status: "Monitorar",
    source: "CNCF, GitLab",
    theme: "DevOps e Plataforma",
    strategic:
      "Oferecer caminhos padronizados para criação, entrega, observabilidade e segurança de serviços.",
    constraints:
      "Pode virar plataforma pesada sem adoção real se não resolver dores práticas dos times.",
  },
  {
    id: "ES-22",
    name: "Observability as Code + OpenTelemetry",
    quadrant: "Ferramentas",
    ring: "Trial",
    horizon: "Curto",
    maturity: "Madura",
    risk: "Baixo",
    effort: "Médio",
    status: "Monitorar",
    source: "CNCF, DORA",
    theme: "DevOps e Plataforma",
    strategic:
      "Padronizar telemetria, SLOs e rastreabilidade como parte do ciclo de vida da aplicação.",
    constraints:
      "Excesso de sinais, custo de armazenamento e baixa higiene de cardinalidade atrapalham adoção.",
  },
  {
    id: "ES-23",
    name: "TypeScript como linguagem padrão de frontend e ferramentas",
    quadrant: "Linguagens e Frameworks",
    ring: "Adopt",
    horizon: "Curto",
    maturity: "Madura",
    risk: "Baixo",
    effort: "Baixo",
    status: "Monitorar",
    source: "TypeScript, GitHub Octoverse",
    theme: "Linguagens e Frameworks",
    strategic:
      "Reduzir defeitos em interfaces, CLIs e ferramentas internas com tipagem estática e ecossistema amplo.",
    constraints:
      "Pode aumentar atrito em scripts simples; exige padrões de build, lint e versionamento coerentes.",
  },
  {
    id: "ES-24",
    name: "Bibliotecas de validação (Pydantic/Zod)",
    quadrant: "Linguagens e Frameworks",
    ring: "Trial",
    horizon: "Curto",
    maturity: "Madura",
    risk: "Baixo",
    effort: "Médio",
    status: "Monitorar",
    source: "Pydantic, Zod, OWASP",
    theme: "Qualidade e Contratos",
    strategic:
      "Fortalecer contratos de entrada/saída em APIs, pipelines e respostas estruturadas de IA.",
    constraints:
      "Validação de schema não substitui validação semântica, autorização nem testes de comportamento.",
  },
  {
    id: "ES-25",
    name: "Frameworks LLM sem manutenção ou proveniência",
    quadrant: "Linguagens e Frameworks",
    ring: "Caution",
    horizon: "Longo",
    maturity: "Experimental",
    risk: "Alto",
    effort: "Alto",
    status: "Segurar",
    source: "Thoughtworks, OWASP, OpenSSF",
    theme: "Riscos de Adoção",
    strategic:
      "Evitar dependência de wrappers, SDKs e frameworks de IA criados rapidamente sem comunidade, manutenção ou postura de segurança.",
    constraints:
      "Alto risco de abandono, vulnerabilidades, mudanças incompatíveis e semântica instável em componentes críticos.",
  },
];

const DEFAULT_SOURCES = [
  {
    id: "SRC-01",
    name: "Thoughtworks Technology Radar",
    initials: "TW",
    url: "https://www.thoughtworks.com/radar",
    strength: "Alta",
    cadence: "Semestral + insights",
    signal: "Blips, anéis, temas macro e práticas emergentes de engenharia.",
    agentUse: "Comparar mudanças por volume e sugerir alterações de anel.",
  },
  {
    id: "SRC-02",
    name: "DORA / Google Cloud Research",
    initials: "DR",
    url: "https://dora.dev/research/",
    strength: "Alta",
    cadence: "Anual + guias",
    signal: "Métricas, capacidades organizacionais, IA assistida e desempenho de entrega.",
    agentUse: "Atualizar critérios de sucesso, métricas e hipóteses de pilotos.",
  },
  {
    id: "SRC-03",
    name: "OWASP GenAI Security",
    initials: "OA",
    url: "https://genai.owasp.org/",
    strength: "Alta",
    cadence: "Contínua",
    signal: "Top 10 LLM, Agentic AI, MCP, threat modeling e mitigação.",
    agentUse: "Rebaixar/promover blips conforme risco de agentes e LLMs.",
  },
  {
    id: "SRC-04",
    name: "GitHub Blog, Changelog e Octoverse",
    initials: "GH",
    url: "https://github.blog/",
    strength: "Média",
    cadence: "Semanal",
    signal: "Adoção de linguagens, agentes, Copilot, supply chain e workflows.",
    agentUse: "Detectar adoção de ferramentas, mudanças de produto e sinais de ecossistema.",
  },
  {
    id: "SRC-05",
    name: "GitLab DevSecOps Reports",
    initials: "GL",
    url: "https://about.gitlab.com/resources/",
    strength: "Média",
    cadence: "Anual + pesquisas",
    signal: "DevSecOps, platform engineering, toolchain, governança e AI accountability.",
    agentUse: "Coletar sinais de gargalos organizacionais e adoção de plataforma.",
  },
  {
    id: "SRC-06",
    name: "Stack Overflow Developer Survey",
    initials: "SO",
    url: "https://survey.stackoverflow.co/",
    strength: "Média",
    cadence: "Anual",
    signal: "Adoção por desenvolvedores, confiança em IA, linguagens e ferramentas.",
    agentUse: "Validar tração comunitária e percepção de risco.",
  },
  {
    id: "SRC-07",
    name: "CNCF Landscape",
    initials: "CF",
    url: "https://landscape.cncf.io/",
    strength: "Alta",
    cadence: "Contínua",
    signal: "Cloud native, observabilidade, segurança, runtime, plataforma e maturidade de projetos.",
    agentUse: "Monitorar tecnologias de plataforma e projetos graduados/incubados.",
  },
  {
    id: "SRC-08",
    name: "OpenSSF",
    initials: "OS",
    url: "https://openssf.org/",
    strength: "Alta",
    cadence: "Contínua",
    signal: "Supply chain, Scorecard, SLSA, Sigstore, segurança open source.",
    agentUse: "Atualizar práticas de proveniência, assinatura e avaliação de dependências.",
  },
  {
    id: "SRC-09",
    name: "NIST AI RMF e SSDF",
    initials: "NI",
    url: "https://www.nist.gov/itl/ai-risk-management-framework",
    strength: "Alta",
    cadence: "Conforme publicação",
    signal: "Gestão de risco de IA, avaliação, governança e desenvolvimento seguro.",
    agentUse: "Calibrar critérios de risco, governança e controles mínimos.",
  },
  {
    id: "SRC-10",
    name: "Martin Fowler",
    initials: "MF",
    url: "https://martinfowler.com/",
    strength: "Média",
    cadence: "Contínua",
    signal: "Arquitetura, engenharia com agentes, práticas e linguagem conceitual.",
    agentUse: "Identificar técnicas emergentes com explicação conceitual sólida.",
  },
  {
    id: "SRC-11",
    name: "InfoQ Trends Reports",
    initials: "IQ",
    url: "https://www.infoq.com/infoq-trends-report/",
    strength: "Complementar",
    cadence: "Periódica",
    signal: "Tendências para arquitetura, dados, IA, cultura e métodos.",
    agentUse: "Comparar leitura de mercado com fontes primárias.",
  },
  {
    id: "SRC-12",
    name: "SIG State of Software",
    initials: "SG",
    url: "https://www.softwareimprovementgroup.com/",
    strength: "Média",
    cadence: "Anual",
    signal: "Qualidade estrutural, débito técnico, riscos de IA e sustentabilidade.",
    agentUse: "Refinar blips de qualidade, débito cognitivo e governança de código.",
  },
];

const state = loadState();
let selectedId = state.blips[0]?.id ?? null;

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
  markdownOutput: document.getElementById("markdownOutput"),
  toast: document.getElementById("toast"),
  ringFilter: document.getElementById("ringFilter"),
  proposalFileInput: document.getElementById("proposalFileInput"),
  pdfFileInput: document.getElementById("pdfFileInput"),
  analyzePdfButton: document.getElementById("analyzePdfButton"),
};

renderAll();
bindEvents();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.blips) && Array.isArray(parsed.sources)) {
        return parsed;
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return {
    blips: structuredClone(DEFAULT_BLIPS),
    sources: structuredClone(DEFAULT_SOURCES),
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
    saveState();
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
      <span class="source-logo">${source.initials}</span>
      <div>
        <strong>${escapeHtml(source.name)}</strong>
        <a href="${source.url}" target="_blank" rel="noreferrer">${cleanUrl(source.url)}</a>
      </div>
      <div class="source-meta">
        <span class="strength-${source.strength.toLowerCase()}">${source.strength}</span>
        <span>${source.cadence}</span>
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
      <p><a href="${source.url}" target="_blank" rel="noreferrer">${cleanUrl(source.url)}</a></p>
      <p><strong>Força:</strong> ${source.strength} | <strong>Cadência:</strong> ${source.cadence}</p>
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
        <td><strong>${blip.id}</strong> ${escapeHtml(blip.name)}</td>
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
      chip.innerHTML = `<span>${blip.id}</span>${escapeHtml(blip.name)}`;
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
    <a class="detail-link" href="${url}" target="_blank" rel="noreferrer">
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
  saveState();
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
  saveState();
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
  saveState();
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
    saveState();
    renderAll();
    showToast(`${result.added} adicionadas, ${result.updated} atualizadas, ${result.removed} removidas.`);
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
    saveState();
    renderAll();
    showToast(`${result.added} adicionadas, ${result.updated} atualizadas, ${result.removed} removidas.`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível analisar o PDF.");
  } finally {
    elements.analyzePdfButton.disabled = false;
    elements.analyzePdfButton.classList.remove("loading");
  }
}

function applyProposals(proposals) {
  const result = { added: 0, updated: 0, removed: 0 };
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

    if ((action === "remove" || action === "delete") && proposal.id) {
      const before = state.blips.length;
      state.blips = state.blips.filter((item) => item.id !== proposal.id);
      if (state.blips.length !== before) result.removed += 1;
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
  localStorage.removeItem(STORAGE_KEY);
  state.blips = structuredClone(DEFAULT_BLIPS);
  state.sources = structuredClone(DEFAULT_SOURCES);
  selectedId = state.blips[0].id;
  saveState();
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
  const html = generateHtmlSnapshot();
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = monthlySnapshotFilename();
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
    blips: state.blips,
    sources: state.sources,
  };
}

function monthlySnapshotFilename() {
  return `${new Date().toISOString().slice(0, 10)}-radar-tecnologico-engenharia-software.html`;
}

function generateHtmlSnapshot() {
  const rows = state.blips
    .map(
      (blip) =>
        `<tr><td>${escapeHtml(blip.name)}</td><td>${escapeHtml(blip.quadrant)}</td><td>${escapeHtml(blip.ring)}</td><td>${escapeHtml(blip.horizon)}</td><td>${escapeHtml(blip.maturity)}</td><td>${escapeHtml(blip.risk)}</td><td>${escapeHtml(blip.effort)}</td></tr>`,
    )
    .join("");
  const details = ["Curto", "Médio", "Longo"]
    .map((horizon) => {
      const cards = state.blips
        .filter((blip) => blip.horizon === horizon)
        .map(
          (blip) => `<article class="card">
            <h3>${escapeHtml(blip.id)} - ${escapeHtml(blip.name)}</h3>
            <p><strong>${escapeHtml(blip.quadrant)} | ${escapeHtml(blip.ring)} | ${escapeHtml(blip.maturity)}</strong></p>
            <p>${escapeHtml(blip.strategic)}</p>
            <p><strong>Gargalos:</strong> ${escapeHtml(blip.constraints)}</p>
            <p><a href="${escapeHtml(getDetailsUrl(blip))}">Mais detalhes</a></p>
          </article>`,
        )
        .join("");
      return `<section><h2>${horizon} Prazo</h2><div class="cards">${cards}</div></section>`;
    })
    .join("");
  const sources = state.sources
    .map(
      (source) =>
        `<tr><td>${escapeHtml(source.name)}</td><td>${escapeHtml(source.strength)}</td><td>${escapeHtml(source.cadence)}</td><td>${escapeHtml(source.signal)}</td><td><a href="${escapeHtml(source.url)}">${escapeHtml(source.url)}</a></td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Radar Tecnologico e TRM - Engenharia de Software</title>
  <style>
    body{margin:0;background:#f6f9fa;color:#17212b;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    header{padding:28px 36px;background:#071724;color:white} header h1{margin:0;font-size:28px} header p{color:#b8cbd4}
    main{max-width:1180px;margin:auto;padding:28px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#d7e0e5;border:1px solid #d7e0e5;border-radius:8px;overflow:hidden}
    .summary div,.panel,.card,table{background:white}.summary div{padding:18px}.summary span{display:block;color:#5f6f7b;font-size:12px;font-weight:700;text-transform:uppercase}.summary strong{font-size:24px}
    section{margin-top:28px}.panel,.card{border:1px solid #d7e0e5;border-radius:8px;padding:16px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
    table{width:100%;border-collapse:collapse;border:1px solid #d7e0e5}th,td{border-bottom:1px solid #d7e0e5;padding:10px 12px;text-align:left;vertical-align:top;font-size:13px}th{background:#eef3f5;color:#465967}
    a{color:#006b6f}@media print{body{background:white}.card,table,.panel{break-inside:avoid}}@media(max-width:800px){main{padding:18px}.summary{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <header><h1>Radar Tecnologico e TRM - Engenharia de Software</h1><p>Snapshot mensal gerado em ${new Date().toLocaleString("pt-BR")}.</p></header>
  <main>
    <section class="summary">
      <div><span>Blips</span><strong>${state.blips.length}</strong></div>
      <div><span>Pilotos P&D</span><strong>${state.blips.filter((blip) => blip.status.includes("Piloto")).length}</strong></div>
      <div><span>Atualização</span><strong>Mensal</strong></div>
      <div><span>Versão</span><strong>${new Date().toISOString().slice(0, 7)}</strong></div>
    </section>
    <section><h2>Sumário Executivo</h2><div class="panel"><p>Radar Tecnológico e Technology Roadmap para apoiar decisões de P&D, pilotos controlados e atualização mensal contínua em Engenharia de Software.</p></div></section>
    <section><h2>Matriz Radar + TRM</h2><table><thead><tr><th>Tecnologia/Técnica</th><th>Quadrante</th><th>Anel</th><th>Horizonte</th><th>Maturidade</th><th>Risco</th><th>Esforço</th></tr></thead><tbody>${rows}</tbody></table></section>
    ${details}
    <section><h2>Fontes Monitoradas</h2><table><thead><tr><th>Fonte</th><th>Força</th><th>Cadência</th><th>Sinal</th><th>URL</th></tr></thead><tbody>${sources}</tbody></table></section>
  </main>
</body>
</html>`;
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
