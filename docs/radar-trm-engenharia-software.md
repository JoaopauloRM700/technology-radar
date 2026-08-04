# Radar Tecnológico e TRM - Engenharia de Software

## 1. Sumário Executivo

Este documento apresenta a versão 0.1 do Radar Tecnológico e Technology Roadmap para Engenharia de Software, englobando desenvolvimento, qualidade, segurança, DevOps, engenharia com IA e governança técnica.

A meta institucional é criar uma primeira versão em até 6 meses e estabelecer um protocolo de atualização mensal contínua. A postura desta versão é inovadora para P&D: tecnologias promissoras são priorizadas em pilotos controlados, com guardrails, métricas e revisão humana.

## 2. Visão Geral da Trilha

Temas prioritários:

- Engenharia com IA: agentes de código, engenharia de contexto, skills e harnesses.
- Qualidade e Testes: sensores de feedback, testes de mutação, fuzzing, testes com IA e analytics.
- Segurança e Governança: Zero Trust, least privilege, red teaming, OWASP para LLMs/agentes e governança de ferramentas.
- DevOps e Plataforma: platform engineering, golden paths, observabilidade e policy as code.
- Supply Chain e Sustentabilidade Técnica: SBOM, SLSA, proveniência, débito cognitivo e controle de custo.

## 3. Tabela Matriz de Roadmap e Radar

| Tecnologia/Técnica | Quadrante | Anel (Recomendação) | Horizonte | Maturidade | Risco | Esforço |
|---|---|---|---|---|---|---|
| Coding Agents | Ferramentas | Trial | Curto | Emergente | Médio | Médio |
| Harnesses para agentes de código | Técnicas | Trial | Curto | Emergente | Médio | Alto |
| Engenharia de Contexto | Técnicas | Trial | Curto | Emergente | Médio | Médio |
| Frameworks de agentes (LangGraph/Semantic Kernel) | Linguagens e Frameworks | Trial | Curto | Emergente | Médio | Médio |
| Spec-driven development | Técnicas | Trial | Curto | Emergente | Médio | Médio |
| Feedback sensors + quality gates determinísticos | Técnicas | Trial | Curto | Emergente | Médio | Médio |
| Teste de mutação | Técnicas | Trial | Curto | Madura | Baixo | Médio |
| Fuzz testing e property-based testing | Técnicas | Trial | Curto | Madura | Médio | Médio |
| Playwright para testes E2E e agentes | Linguagens e Frameworks | Trial | Curto | Madura | Baixo | Médio |
| Engineering Intelligence: DORA + QE Analytics | Técnicas | Adopt | Curto | Madura | Baixo | Médio |
| Gestão de débito cognitivo em código gerado por IA | Técnicas | Trial | Curto | Emergente | Médio | Médio |
| Revisão humana por classe de risco | Técnicas | Adopt | Curto | Madura | Baixo | Baixo |
| Zero Trust no SDLC agentic | Técnicas | Adopt | Curto | Madura | Médio | Alto |
| Least privilege e Agentic IAM | Plataformas | Trial | Médio | Emergente | Alto | Alto |
| Sandboxes de execução para agentes | Plataformas | Trial | Curto | Emergente | Médio | Alto |
| AI Gateways | Plataformas | Assess | Médio | Emergente | Médio | Alto |
| Governança de MCP e ferramentas conectadas | Plataformas | Assess | Médio | Experimental | Alto | Alto |
| Red teaming para LLMs e agentes | Técnicas | Trial | Curto | Emergente | Médio | Médio |
| SBOM, SLSA e proveniência de supply chain | Ferramentas | Adopt | Curto | Madura | Baixo | Médio |
| Policy as Code | Ferramentas | Adopt | Curto | Madura | Baixo | Médio |
| Platform Engineering + Golden Paths | Plataformas | Trial | Médio | Madura | Médio | Alto |
| Observability as Code + OpenTelemetry | Ferramentas | Trial | Curto | Madura | Baixo | Médio |
| TypeScript como linguagem padrão de frontend e ferramentas | Linguagens e Frameworks | Adopt | Curto | Madura | Baixo | Baixo |
| Bibliotecas de validação (Pydantic/Zod) | Linguagens e Frameworks | Trial | Curto | Madura | Baixo | Médio |
| Frameworks LLM sem manutenção ou proveniência | Linguagens e Frameworks | Caution | Longo | Experimental | Alto | Alto |

## 4. Fichas Detalhadas das Tendências

### Curto Prazo

#### Coding Agents

- **Quadrante:** Ferramentas
- **Anel:** Trial
- **Maturidade | Risco | Esforço:** Emergente | Médio | Médio
- **Justificativa Estratégica:** acelera protótipos, refatorações, geração de testes e exploração técnica em P&D.
- **Gargalos e Contraindicações:** risco de alucinação, código não compreendido, vulnerabilidades e excesso de confiança.

#### Harnesses para agentes de código

- **Quadrante:** Técnicas
- **Anel:** Trial
- **Maturidade | Risco | Esforço:** Emergente | Médio | Alto
- **Justificativa Estratégica:** cria controles de feedforward e feedback para aumentar confiança em agentes.
- **Gargalos e Contraindicações:** depende de testes confiáveis, regras estruturais e maturidade de engenharia.

#### Engenharia de Contexto

- **Quadrante:** Técnicas
- **Anel:** Trial
- **Maturidade | Risco | Esforço:** Emergente | Médio | Médio
- **Justificativa Estratégica:** padroniza como contexto, decisões e restrições são fornecidos a agentes.
- **Gargalos e Contraindicações:** contexto excessivo, obsoleto ou contraditório gera débito cognitivo e resultados frágeis.

#### Frameworks de agentes (LangGraph/Semantic Kernel)

- **Quadrante:** Linguagens e Frameworks
- **Anel:** Trial
- **Maturidade | Risco | Esforço:** Emergente | Médio | Médio
- **Justificativa Estratégica:** estrutura agentes, fluxos, memória, ferramentas e supervisão em aplicações de P&D.
- **Gargalos e Contraindicações:** ecossistema ainda muda rápido; risco de lock-in conceitual, sobreengenharia e lacunas de observabilidade.

#### Spec-driven development

- **Quadrante:** Técnicas
- **Anel:** Trial
- **Maturidade | Risco | Esforço:** Emergente | Médio | Médio
- **Justificativa Estratégica:** conecta hipótese, especificação, teste e implementação assistida por IA.
- **Gargalos e Contraindicações:** sem disciplina de produto e arquitetura, vira documentação não verificável.

#### Feedback sensors + quality gates determinísticos

- **Quadrante:** Técnicas
- **Anel:** Trial
- **Maturidade | Risco | Esforço:** Emergente | Médio | Médio
- **Justificativa Estratégica:** usa compiladores, testes, linters, tipos e regras arquiteturais como sensores de autocorreção.
- **Gargalos e Contraindicações:** gates fracos dão falsa confiança; gates ruidosos travam fluxo.

#### Teste de mutação

- **Quadrante:** Técnicas
- **Anel:** Trial
- **Maturidade | Risco | Esforço:** Madura | Baixo | Médio
- **Justificativa Estratégica:** mede força real dos testes e identifica suites superficiais.
- **Gargalos e Contraindicações:** custo computacional e tempo de pipeline.

#### Fuzz testing e property-based testing

- **Quadrante:** Técnicas
- **Anel:** Trial
- **Maturidade | Risco | Esforço:** Madura | Médio | Médio
- **Justificativa Estratégica:** encontra falhas em APIs, parsers e regras complexas.
- **Gargalos e Contraindicações:** curva de modelagem e triagem de achados.

#### Playwright para testes E2E e agentes

- **Quadrante:** Linguagens e Frameworks
- **Anel:** Trial
- **Maturidade | Risco | Esforço:** Madura | Baixo | Médio
- **Justificativa Estratégica:** automatiza fluxos reais de usuário e oferece sensor determinístico para agentes.
- **Gargalos e Contraindicações:** testes E2E frágeis e ambientes instáveis podem gerar ruído.

#### Engineering Intelligence: DORA + QE Analytics

- **Quadrante:** Técnicas
- **Anel:** Adopt
- **Maturidade | Risco | Esforço:** Madura | Baixo | Médio
- **Justificativa Estratégica:** dá visibilidade executiva sobre fluxo, qualidade, estabilidade e impacto da IA.
- **Gargalos e Contraindicações:** métricas de vaidade ou pressão comportamental sem melhoria sistêmica.

#### Gestão de débito cognitivo em código gerado por IA

- **Quadrante:** Técnicas
- **Anel:** Trial
- **Maturidade | Risco | Esforço:** Emergente | Médio | Médio
- **Justificativa Estratégica:** impede que velocidade de geração resulte em sistemas incompreensíveis.
- **Gargalos e Contraindicações:** difícil medir entendimento; exige ownership, ADRs e revisão efetiva.

#### Revisão humana por classe de risco

- **Quadrante:** Técnicas
- **Anel:** Adopt
- **Maturidade | Risco | Esforço:** Madura | Baixo | Baixo
- **Justificativa Estratégica:** mantém responsabilidade técnica e reduz risco de autonomia excessiva.
- **Gargalos e Contraindicações:** burocracia sem critérios claros reduz adoção.

#### Zero Trust no SDLC agentic

- **Quadrante:** Técnicas
- **Anel:** Adopt
- **Maturidade | Risco | Esforço:** Madura | Médio | Alto
- **Justificativa Estratégica:** protege agentes, pipelines, segredos, repositórios e ambientes.
- **Gargalos e Contraindicações:** integração com IAM, segredos e rede exige coordenação de plataforma.

#### Sandboxes de execução para agentes

- **Quadrante:** Plataformas
- **Anel:** Trial
- **Maturidade | Risco | Esforço:** Emergente | Médio | Alto
- **Justificativa Estratégica:** permite experimentação com menor risco operacional.
- **Gargalos e Contraindicações:** isolamento incompleto, custo computacional e exceções de rede.

#### Red teaming para LLMs e agentes

- **Quadrante:** Técnicas
- **Anel:** Trial
- **Maturidade | Risco | Esforço:** Emergente | Médio | Médio
- **Justificativa Estratégica:** identifica prompt injection, tool misuse, vazamento e overreliance antes de produção.
- **Gargalos e Contraindicações:** exige conhecimento adversarial e integração com aceite técnico.

#### SBOM, SLSA e proveniência de supply chain

- **Quadrante:** Ferramentas
- **Anel:** Adopt
- **Maturidade | Risco | Esforço:** Madura | Baixo | Médio
- **Justificativa Estratégica:** aumenta rastreabilidade e confiança em dependências, builds e artefatos.
- **Gargalos e Contraindicações:** cobertura parcial e falta de ação sobre achados reduzem valor.

#### Policy as Code

- **Quadrante:** Ferramentas
- **Anel:** Adopt
- **Maturidade | Risco | Esforço:** Madura | Baixo | Médio
- **Justificativa Estratégica:** automatiza compliance, segurança e padrões arquiteturais.
- **Gargalos e Contraindicações:** políticas ruidosas podem criar bypass informal.

#### Observability as Code + OpenTelemetry

- **Quadrante:** Ferramentas
- **Anel:** Trial
- **Maturidade | Risco | Esforço:** Madura | Baixo | Médio
- **Justificativa Estratégica:** padroniza telemetria, SLOs e diagnóstico desde o ciclo de desenvolvimento.
- **Gargalos e Contraindicações:** custo e excesso de sinais.

#### TypeScript como linguagem padrão de frontend e ferramentas

- **Quadrante:** Linguagens e Frameworks
- **Anel:** Adopt
- **Maturidade | Risco | Esforço:** Madura | Baixo | Baixo
- **Justificativa Estratégica:** reduz defeitos em interfaces, CLIs e ferramentas internas com tipagem estática.
- **Gargalos e Contraindicações:** pode aumentar atrito em scripts simples; exige padrões de build e lint.

#### Bibliotecas de validação (Pydantic/Zod)

- **Quadrante:** Linguagens e Frameworks
- **Anel:** Trial
- **Maturidade | Risco | Esforço:** Madura | Baixo | Médio
- **Justificativa Estratégica:** fortalece contratos de entrada/saída em APIs, pipelines e respostas estruturadas de IA.
- **Gargalos e Contraindicações:** validação de schema não substitui validação semântica, autorização nem testes de comportamento.

### Médio Prazo

#### Least privilege e Agentic IAM

- **Quadrante:** Plataformas
- **Anel:** Trial
- **Maturidade | Risco | Esforço:** Emergente | Alto | Alto
- **Justificativa Estratégica:** reduz raio de impacto de agentes com permissões temporárias e escopo mínimo.
- **Gargalos e Contraindicações:** ferramentas de identidade para agentes ainda estão amadurecendo.

#### AI Gateways

- **Quadrante:** Plataformas
- **Anel:** Assess
- **Maturidade | Risco | Esforço:** Emergente | Médio | Alto
- **Justificativa Estratégica:** centraliza políticas, logs, roteamento de modelos, custo e proteção de dados.
- **Gargalos e Contraindicações:** lock-in, latência e falsa sensação de governança.

#### Governança de MCP e ferramentas conectadas

- **Quadrante:** Plataformas
- **Anel:** Assess
- **Maturidade | Risco | Esforço:** Experimental | Alto | Alto
- **Justificativa Estratégica:** controla tool sprawl e riscos de integrações entre agentes e ferramentas.
- **Gargalos e Contraindicações:** padrões e ameaças evoluem rápido.

#### Platform Engineering + Golden Paths

- **Quadrante:** Plataformas
- **Anel:** Trial
- **Maturidade | Risco | Esforço:** Madura | Médio | Alto
- **Justificativa Estratégica:** reduz atrito e padroniza entrega, segurança e observabilidade.
- **Gargalos e Contraindicações:** plataforma pesada sem adoção real.

### Longo Prazo

#### Frameworks LLM sem manutenção ou proveniência

- **Quadrante:** Linguagens e Frameworks
- **Anel:** Caution
- **Maturidade | Risco | Esforço:** Experimental | Alto | Alto
- **Justificativa Estratégica:** evitar dependência de wrappers, SDKs e frameworks de IA sem comunidade, manutenção ou postura de segurança.
- **Gargalos e Contraindicações:** alto risco de abandono, vulnerabilidades, mudanças incompatíveis e semântica instável.

## 5. Plano de Ação e Próximos Passos

Pilotos recomendados:

1. **Coding Agents:** executar em repositórios de baixo risco com tarefas de teste, documentação, refatoração segura e correções pequenas.
2. **Engenharia de Contexto:** criar padrões de contexto por tipo de tarefa, incluindo arquitetura, Definition of Done, comandos de verificação e restrições.
3. **Feedback sensors + quality gates determinísticos:** conectar testes, linters, type checks, SAST e regras arquiteturais ao loop de trabalho com agentes.
4. **Playwright para testes E2E e agentes:** medir impacto em cobertura útil, tempo de criação de testes e detecção de regressões.
5. **Red teaming para LLMs e agentes:** testar prompt injection, tool misuse, vazamento de dados, acesso indevido e overreliance.

Critérios mínimos para cada piloto:

- Hipótese clara de valor.
- Ambiente controlado.
- Métrica antes/depois.
- Registro de riscos e decisões.
- Revisão humana obrigatória.
- Critério de promoção, pausa ou descarte.

## 6. Protocolo de Atualização Mensal

1. O agente de IA coleta sinais nas fontes monitoradas.
2. O agente deduplica nomes, tecnologias semelhantes e variações terminológicas.
3. O agente classifica evidências por tema, quadrante, anel e horizonte.
4. O agente gera propostas de novos blips, remoções e mudanças de anel.
5. O comitê técnico revisa e aprova alterações.
6. A versão mensal é publicada com data, responsáveis e decisões registradas.

## 7. Fontes Monitoradas para Atualização Autônoma

| Fonte | Força | Cadência | Uso no Radar |
|---|---|---|---|
| Thoughtworks Technology Radar | Alta | Semestral + insights | Blips, anéis, temas macro e práticas emergentes |
| DORA / Google Cloud Research | Alta | Anual + guias | Métricas, capacidades e impacto de IA assistida |
| OWASP GenAI Security | Alta | Contínua | Riscos de LLMs, agentes, MCP e mitigação |
| GitHub Blog, Changelog e Octoverse | Média | Semanal/anual | Adoção de agentes, Copilot, linguagens e supply chain |
| GitLab DevSecOps Reports | Média | Anual + pesquisas | Platform engineering, governança e gargalos de IA |
| Stack Overflow Developer Survey | Média | Anual | Adoção, confiança e percepção da comunidade |
| CNCF Landscape | Alta | Contínua | Cloud native, observabilidade, plataforma e maturidade de projetos |
| OpenSSF | Alta | Contínua | Supply chain, Scorecard, SLSA, Sigstore e segurança OSS |
| NIST AI RMF e SSDF | Alta | Conforme publicação | Governança, risco de IA e desenvolvimento seguro |
| Martin Fowler | Média | Contínua | Conceitos emergentes de arquitetura e engenharia com agentes |
| InfoQ Trends Reports | Complementar | Periódica | Visão editorial de tendências de arquitetura, dados, IA e métodos |
| SIG State of Software | Média | Anual | Qualidade estrutural, débito técnico e impacto de IA |

## 8. Regras para o Agente de Atualização

- Fontes oficiais, padrões e relatórios têm maior peso que posts de opinião.
- Sinais de comunidades e redes sociais entram como alerta, não como decisão automática.
- Nenhum blip muda para Adopt sem evidência prática interna ou fonte madura externa.
- Tecnologias com risco de segurança agentic devem receber revisão OWASP/NIST antes de promoção.
- Toda mudança deve registrar fonte, data, justificativa, riscos e decisão humana.

### Comando Local de Atualização Assistida

O protótipo inclui um fluxo seguro para atualização por IA:

```bash
npm run radar:update
```

No PowerShell, se a política de execução bloquear `npm.ps1`, use:

```bash
npm.cmd run radar:update
```

O comando coleta sinais das fontes em `data/monitored-sources.json` e gera:

- `data/radar-signals.json`: sinais extraídos das fontes.
- `docs/radar-ai-update-brief.md`: briefing pronto para enviar a uma IA.
- `data/radar-update-proposals.json`: arquivo onde a resposta JSON da IA deve ser salva.

Depois de salvar as propostas em `data/radar-update-proposals.json`, abra `index.html` e use **Importar Propostas**. O radar só aplica mudanças após confirmação humana.

Para testar sem Internet:

```bash
npm run radar:update:offline
```

Ou, no PowerShell:

```bash
npm.cmd run radar:update:offline
```

## 9. Referências Iniciais

- Thoughtworks Technology Radar: https://www.thoughtworks.com/radar
- DORA Research: https://dora.dev/research/
- OWASP GenAI Security Project: https://genai.owasp.org/
- OWASP Top 10: https://owasp.org/Top10/
- GitHub Blog: https://github.blog/
- GitLab Resources: https://about.gitlab.com/resources/
- Stack Overflow Developer Survey: https://survey.stackoverflow.co/
- CNCF Landscape: https://landscape.cncf.io/
- OpenSSF: https://openssf.org/
- NIST AI RMF: https://www.nist.gov/itl/ai-risk-management-framework
- Martin Fowler: https://martinfowler.com/
- InfoQ Trends: https://www.infoq.com/infoq-trends-report/
