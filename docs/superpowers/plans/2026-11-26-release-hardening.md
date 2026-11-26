# Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os bloqueadores e riscos confirmados na revisão de `e675588` antes do primeiro deploy público.

**Architecture:** Manter GitHub como estado canônico permanente e Render como API efêmera. Corrigir as fronteiras existentes — estado de sessão no navegador, concorrência de jobs, validação NVIDIA e configuração de deploy — sem banco ou dependências novas.

**Tech Stack:** JavaScript ESM em Node 22, `node:test`, Playwright/Edge, Ajv, GitHub Contents API, Render Blueprint e Poppler.

**Spec:** `docs/plans/2026-11-18-nvidia-nim-persistence-spec.md`

## Global Constraints

- Aplicar Ponytail full: menor mudança completa, legível e sem dependências novas.
- TDD estrito para todo comportamento; configuração e documentação acompanham o consumidor correspondente.
- `data/radar.json` continua sendo a única fonte canônica persistente.
- Segredos permanecem somente no backend e tokens administrativos somente na memória da aba.
- Jobs, PDFs e quota diária continuam efêmeros conforme a spec; não adicionar banco.

## Review Focus

- Um `fetch('/healthz')` que nunca resolve deve respeitar o prazo global e ser abortado.
- Uma resposta de publicação não pode apagar edições iniciadas depois do envio.
- Um `401` deve mostrar/exportar somente o canônico e restaurar o rascunho após novo login.
- Um PDF de página muito grande não pode gerar raster sem limite; job expirado não libera a vaga antes da limpeza.
- Uma publicação que altera apenas `data/radar.json` não deve redeployar a API.

---

### Task 1: Núcleo browser-safe e fixtures estáveis

**Files:**
- Create: `test/fixtures/radar.json`
- Modify: `app-core.mjs`
- Modify: `test/app-core.test.mjs`
- Modify: `test/app-browser.py`

**Interfaces:**
- Produces: `resolveApiBaseUrl()` aceita somente base HTTP(S) sem query/fragment e mantém fallback local; `wakeBackend()` aplica o prazo ao `fetch`.
- Produces: testes de comportamento usam `test/fixtures/radar.json`, sem depender do radar mutável de produção.

- [x] Escrever testes que falham para base com query/fragment, override local explícito, `fetch` pendente e fixture independente.
- [x] Executar os testes e confirmar as falhas esperadas.
- [x] Implementar validação mínima da base e abortar cada health check pelo tempo restante.
- [x] Migrar testes para a fixture fixa e executar testes Node/frontend.
- [x] Commitar a tarefa.

### Task 2: Publicação e sessão sem perda de rascunho

**Files:**
- Modify: `scripts/lib/github-radar-store.mjs`
- Modify: `scripts/api-server.mjs`
- Modify: `app.js`
- Modify: `index.html`
- Modify: `test/github-radar-store.test.mjs`
- Modify: `test/api-server.test.mjs`
- Modify: `test/app-browser.py`

**Interfaces:**
- Produces: `RevisionConflictError.currentRadar` e resposta `409.currentRadar` normalizada.
- Produces: `401` suspende o rascunho em memória e renderiza/exporta o canônico; login validado restaura o rascunho. A saída voluntária mantém a confirmação explícita para descartar o rascunho.
- Produces: publicação pendente bloqueia fechamento/reabertura; cancelamento invalida login pendente.

- [x] Escrever testes HTTP/browser que reproduzem conflito com Pages atrasado, fechamento durante PUT, `401`, cancelamento de login, evidência inválida e URL de fonte inválida.
- [x] Executar e confirmar RED.
- [x] Implementar o snapshot canônico no `409` e o menor controle explícito de publicação/login/rascunho.
- [x] Tornar renderização de evidência e validação de fonte tolerantes a entrada inválida.
- [x] Executar testes Node e Edge e commitar.

### Task 3: Limites de PDF, IA e concorrência de jobs

**Files:**
- Modify: `scripts/lib/pdf-pipeline.mjs`
- Modify: `scripts/lib/analysis-jobs.mjs`
- Modify: `scripts/lib/nvidia-nim.mjs`
- Modify: `scripts/api-server.mjs`
- Modify: `test/pdf-pipeline.test.mjs`
- Modify: `test/analysis-jobs.test.mjs`
- Modify: `test/nvidia-nim.test.mjs`
- Modify: `test/api-server.test.mjs`

**Interfaces:**
- Produces: raster Poppler limitado a 2048 px no maior lado.
- Produces: timeout publica falha imediatamente, mas conserva a vaga até o runner terminar sua limpeza.
- Produces: propostas `update/move` exigem `targetId` não vazio; alvo e páginas são validados contra radar/PDF.
- Produces: uploads ocupados/sem quota são recusados antes da leitura do corpo por `analysisJobs.assertAvailable()`.

- [x] Escrever testes RED para argumentos Poppler, lease após timeout, admissão antes do corpo e propostas fora do contexto.
- [x] Implementar cada correção mínima e executar o teste correspondente até GREEN.
- [x] Executar todas as suítes de backend e commitar.

### Task 4: Deploy e documentação coerentes

**Files:**
- Modify: `scripts/api-server.mjs`
- Modify: `render.yaml`
- Modify: `.env.example`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/plans/2026-11-18-nvidia-nim-persistence-spec.md`
- Modify: `test/api-server.test.mjs`

**Interfaces:**
- Produces: origem Pages `https://joaopaulorm700.github.io` em código/config/teste.
- Produces: `npm run radar:api` lê `.env` opcional no Node 22.
- Produces: commits exclusivos de `data/radar.json` são ignorados pelo auto-deploy do Render.

- [x] Corrigir o teste CORS primeiro e confirmar que falha contra a origem antiga.
- [x] Corrigir todos os consumidores da origem, script npm, Blueprint e documentação.
- [ ] Validar `npm test`, sintaxe, Compose, Edge e Docker quando o daemon estiver disponível.
- [x] Fazer revisão final independente do diff e commitar correções importantes encontradas.
