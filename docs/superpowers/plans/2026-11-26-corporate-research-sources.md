# Corporate Research Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Descobrir metadados e PDFs de publicações corporativas oficiais e cadastrar oito novas fontes no radar.

**Architecture:** `scripts/discover-sources.mjs` ganha a estratégia genérica `publications`, usando o motor já selecionado (Playwright ou fetch) e mantendo os contratos atuais de PDF. As fontes definem apenas padrões de links e limite; o relatório e o brief carregam metadados normalizados, classificados e deduplicados.

**Tech Stack:** Node.js 22, `node:test`, Playwright opcional já instalado, JSON.

**Spec:** `docs/superpowers/specs/2026-11-26-corporate-research-sources-design.md`

## Global Constraints

- Não adicionar dependências.
- Não alterar frontend, API administrativa ou schema público do radar.
- Limitar a cinco detalhes por fonte, salvo valor menor em `maxPublications`.
- Seguir somente páginas de detalhe da mesma origem e padrões explícitos.
- Preservar `pdfCandidates` e `downloads`; nenhuma publicação cria blip automaticamente.

## Review Focus

- Link de detalhe relativo deve ser resolvido contra a URL final do índice sem permitir outra origem.
- Página de detalhe 404 ou malformada não deve interromper as publicações válidas.
- DOI/arXiv repetido entre fontes deve aparecer uma vez no relatório.
- Venue explícita deve classificar `peer-reviewed`; arXiv sem venue deve classificar `preprint`.
- Um link arXiv `/abs/` deve gerar candidato PDF `/pdf/<id>.pdf` para o pipeline existente.

---

### Task 1: Estratégia de descoberta de publicações

**Files:**
- Create: `test/discover-sources.test.mjs`
- Modify: `scripts/discover-sources.mjs`

**Interfaces:**
- Consumes: configurações `strategy`, `publicationLinkPatterns` e `maxPublications` de cada fonte.
- Produces: `source.publications`, `source.publicationErrors`, `source.duplicatePublications` e candidatos PDF compatíveis com o pipeline atual.

- [ ] **Step 1: Write the failing integration test**

Criar um workspace temporário e um módulo `--import` que simula páginas oficiais. Executar o CLI real com `--fetch-only --no-download --no-analyze` e afirmar resolução relativa, isolamento de 404, metadados, níveis de evidência, arXiv para PDF e deduplicação entre duas fontes.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/discover-sources.test.mjs`
Expected: FAIL porque fontes `publications` com `discoverPdfs: false` ainda são ignoradas.

- [ ] **Step 3: Implement the minimal strategy**

Adicionar carregamento de índice/detalhe via Playwright ou fetch, extração por JSON-LD/metatags/fallbacks simples, classificação, deduplicação global e seção de publicações no brief.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/discover-sources.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: discover corporate research publications`

### Task 2: Cadastro das fontes e documentação

**Files:**
- Modify: `data/monitored-sources.json`
- Modify: `data/radar.json`
- Modify: `README.md`
- Test: `test/app-core.test.mjs`

**Interfaces:**
- Consumes: estratégia `publications` da Task 1.
- Produces: fontes `SRC-13` a `SRC-20` no radar público e configurações monitoradas com nomes e URLs correspondentes.

- [ ] **Step 1: Write the failing production-registry test**

Adicionar verificação comportamental de que toda fonte corporativa monitorada está presente no radar canônico com a mesma URL, sem duplicatas, e que usa limites/padrões válidos.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/app-core.test.mjs`
Expected: FAIL porque as oito fontes ainda não estão cadastradas.

- [ ] **Step 3: Add the eight sources and documentation**

Adicionar os registros monitorados, `SRC-13` a `SRC-20`, renovar metadados canônicos e documentar a estratégia e sincronização dos dois arquivos.

- [ ] **Step 4: Run focused and full verification**

Run: `node --test test/app-core.test.mjs test/discover-sources.test.mjs`
Expected: PASS.

Run: `npm.cmd test`
Expected: PASS, zero falhas.

- [ ] **Step 5: Commit**

Commit: `feat: add corporate research sources`

