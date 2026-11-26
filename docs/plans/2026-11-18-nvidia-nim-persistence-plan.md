# Plano de implementacao: NIM e persistencia

**Spec:** `docs/plans/2026-11-18-nvidia-nim-persistence-spec.md`

## Restricoes globais

- Aplicar `$ponytail` no modo full: menor solucao completa, legivel e sem dependencias desnecessarias.
- TDD estrito para cada comportamento novo; `node:test`; Ajv como unica dependencia de runtime nova.
- Segredos somente no backend; nenhuma chamada NVIDIA ou GitHub autenticada parte do navegador.
- `data/radar.json` e a fonte canonica; edicoes sao rascunhos ate `Salvar versao`.
- Nenhuma sobrescrita em conflito; nenhum PDF ou artefato intermediario persistente.
- Nao alterar artefatos historicos gerados por Gemini.

## Task 1: Estado canonico e nucleo browser-safe

Criar `data/radar.json` a partir dos defaults atuais de `app.js` e `app-core.mjs` com validacao/normalizacao, diff e aplicacao de propostas, e geracao do snapshot HTML browser-safe. Adicionar testes que falhem primeiro para esquema, conflitos de proposta e exportacao. Adaptar o carregamento do frontend para usar o arquivo canonico, deixando a integracao visual detalhada para Task 5.

## Task 2: Autenticacao e persistencia GitHub

Criar `scripts/lib/github-radar-store.mjs` e o esqueleto testavel de `scripts/api-server.mjs`. Implementar verificacao do admin, CORS, leitura/gravar via GitHub Contents API, validacao Ajv e conflito por `baseRevision`. Testar com servidor HTTP real e `fetch` injetado, incluindo 401, origem proibida, preflight, 409 e commit correto.

## Task 3: Cliente NVIDIA NIM e migracao CLI

Criar `scripts/lib/nvidia-nim.mjs` com chat JSON Schema, timeouts, erros e validacao de propostas. Substituir `scripts/gemini-proposals.mjs` e referencias executaveis Gemini por NIM; renomear scripts para `radar:full:nim` e `--ai nim`. Preservar artefatos historicos. Testar requests e respostas com transporte injetado.

## Task 4: Pipeline PDF e jobs

Criar `scripts/lib/pdf-pipeline.mjs` e `scripts/lib/analysis-jobs.mjs`; implementar limites, Poppler, OCR seletivo, concorrencia, retries, timeouts, limpeza e gerenciador de jobs. Completar as rotas de analise da API. Testar validacao, selecao OCR, transicoes de job, limite diario e limpeza usando executores/clock injetados.

## Task 5: Fluxo frontend administrativo

Atualizar `index.html`, `styles.css` e `app.js` para leitura publica, login admin em memoria, rascunho, edicao, salvar versao, conflito/download, link de historico, upload PDF, polling, revisao de propostas desmarcadas e aplicacao seletiva. Manter um unico download HTML client-side. Restringir o servidor estatico por allowlist. Adicionar testes unitarios das funcoes extraidas e smoke manual/browser.

## Task 6: Docker, Render e documentacao

Adicionar `Dockerfile`, `.dockerignore`, `compose.yaml` e `render.yaml`; completar `.env.example`, scripts npm e README com configuracao GitHub/NVIDIA/admin, execucao local, deploy Render, GitHub Pages, cold start e sincronizacao manual GitLab. Validar Compose e build Docker quando disponiveis.

## Task 7: Integracao e endurecimento

Executar toda a suite, verificacao de sintaxe, smoke da API e do frontend, busca de segredos, verificacao do build/deploy e correcao de falhas de integracao. Fazer revisao final do branch contra a spec.


