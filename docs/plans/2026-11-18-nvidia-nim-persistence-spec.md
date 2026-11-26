# Technology Radar: NIM, persistencia e publicacao

## Objetivo

Publicar o radar como site estatico no GitHub Pages, mantendo leitura publica e edicao restrita ao administrador. O estado canonico fica versionado em `data/radar.json`; analise de PDF usa NVIDIA NIM em uma API Node hospedada no Render; exportacao HTML acontece inteiramente no navegador.

## Estado canonico

- `data/radar.json` e a fonte de verdade e contem `schemaVersion`, `revision`, `updatedAt`, `changeNote`, `blips` e `sources`.
- A primeira versao deve extrair os blips e fontes padrao atualmente embutidos em `app.js`.
- O site carrega esse arquivo e inicia somente leitura. `localStorage` nao e fonte autoritativa.
- A edicao cria um rascunho em memoria. Aplicar propostas altera somente o rascunho.
- `Salvar versao` exige uma descricao, envia `baseRevision` e grava um commit no GitHub.
- Em conflito de revisao, nunca sobrescrever silenciosamente; preservar o rascunho e oferecer download.
- O historico aponta para os commits de `data/radar.json` no GitHub.

## Autenticacao e persistencia

- O administrador informa `ADMIN_TOKEN`; o frontend o guarda apenas em memoria.
- O backend compara o token com SHA-256 e `timingSafeEqual`; a configuracao deve exigir ao menos 32 caracteres.
- `GITHUB_TOKEN` e fine-grained, restrito ao repositorio e a Contents write. O backend le conteudo e SHA atuais, compara `baseRevision` e usa a GitHub Contents API para criar um commit `chore(radar): <nota>`.
- GitHub `main` e o repositorio primario; sincronizacao com GitLab e manual.

## API publica

- `GET /healthz`
- `POST /api/v1/admin/verify`
- `PUT /api/v1/radar`
- `POST /api/v1/analysis-jobs`
- `GET /api/v1/analysis-jobs/:id`
- CORS aceita exatamente `https://joaopaulorm700.github.io` e `http://localhost:4173`; preflight responde 204 e inclui `Vary: Origin`.
- Validar payloads, enums, tamanhos de campos e URLs HTTP/HTTPS.

## NVIDIA NIM e propostas

- Chat: `https://integrate.api.nvidia.com/v1/chat/completions`, modelo padrao `nvidia/nemotron-3.5-super-vl-120b-a12b`, com `response_format` JSON Schema estrito.
- OCR: `https://ai.api.nvidia.com/v1/retrieval/nvidia/nemotron-3.5-parse/parse`, modelo `nvidia/nemotron-3.5-parse`.
- A chave fica somente no backend como `NVIDIA_API_KEY`.
- Substituir o fluxo Gemini de web e CLI por NIM; artefatos historicos com `generatedBy: "gemini"` permanecem intactos.
- Cada proposta tem `action` (`add`, `update` ou `move`), `targetId`, `reason`, `confidence`, `evidence` e o estado completo desejado em `blip`, sem `id`. Maximo de cinco; nunca remover automaticamente; todas iniciam desmarcadas.

## Pipeline PDF

- Aceitar apenas PDF publico com no maximo 10 MiB e 75 paginas; verificar `%PDF-` e rejeitar criptografado.
- Usar Poppler `pdfinfo` e `pdftotext -layout`.
- Paginas com menos de 80 caracteres nao espaciais sao renderizadas em JPEG com a maior dimensao limitada a 2048 px e enviadas ao Nemotron Parse.
- OCR tem concorrencia 2, timeout 60 s por chamada e novas tentativas somente para 429/503 (2 s e 5 s).
- Job total tem timeout de 10 minutos, um job ativo, TTL de 30 minutos e limite de 10 analises por dia.
- Jobs ficam em memoria. Arquivos temporarios sao unicos por job e removidos em `finally`; PDF, imagem, texto, prompt e resposta bruta nunca sao persistidos nem logados.

## Frontend

- Informar e aguardar o despertar do Render por ate 90 segundos.
- Fazer polling de job a cada 2 segundos e mostrar progresso/erro.
- Revisar diff, justificativa e evidencias por pagina; aplicar somente propostas selecionadas ao rascunho.
- Exportar HTML em um unico botao usando `Blob`, sem endpoint de backend.
- O servidor estatico local deve usar allowlist para nunca servir `.env`, `.git` ou arquivos arbitrarios.

## Deploy e qualidade

- Node 22 bookworm-slim, `poppler-utils`, usuario nao-root.
- Incluir `Dockerfile`, `.dockerignore`, `compose.yaml`, `render.yaml` e `.env.example` sem segredos.
- Render usa porta 8787 e `/healthz`; site local usa 4173.
- Ajv e a unica dependencia de runtime adicionada. Testes usam `node:test`.
- Verificar `npm test`, sintaxe Node, configuracao Compose, build Docker e smoke do navegador.



