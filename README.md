# Technology Radar e TRM - Engenharia de Software

Radar Tecnológico e Technology Roadmap (TRM) para Engenharia de Software, publicado no GitHub Pages com estado canônico versionado em `data/radar.json`, modo administrador protegido por token em memória e análise temporária de PDFs públicos (textuais e escaneados) via NVIDIA NIM + Poppler em uma API Docker no Render.

## Arquitetura

- **Frontend público (GitHub Pages):** serve `index.html`, `styles.css`, `app.js`, `app-core.mjs` e `data/radar.json`. Visitantes visualizam o radar, a matriz TRM, as fontes e podem exportar Markdown e snapshot HTML offline (`Blob`), sem acesso a edição, IA ou publicação.
- **Estado canônico (`data/radar.json`):** única fonte oficial de verdade (`schemaVersion`, `revision`, `updatedAt`, `changeNote`, `blips`, `sources`). `localStorage` não é utilizado.
- **API administrativa Docker (`scripts/api-server.mjs`, Render):** autentica o proprietário com `ADMIN_TOKEN` (SHA-256 + `timingSafeEqual`), persiste novas versões em `data/radar.json` pela GitHub Contents API com controle otimista de conflito (`baseRevision` -> HTTP `409`) e executa jobs temporários de análise de PDF com Poppler + NVIDIA NIM.
- **Privacidade e efemeridade:** PDFs enviados, imagens JPEG de OCR, textos extraídos, prompts e respostas brutas da IA existem apenas temporariamente durante o job e são removidos em `finally`. Somente documentos públicos podem ser enviados à NVIDIA.

## Variáveis de Ambiente (Somente Backend)

Copie `.env.example` para `.env` localmente (nunca versione `.env` nem coloque segredos no frontend):

| Variável | Obrigatória | Descrição |
|---|---|---|
| `ADMIN_TOKEN` | Sim | Token secreto do administrador com **no mínimo 32 caracteres**. Guardado apenas no backend e mantido somente em memória no navegador durante a sessão. |
| `GITHUB_TOKEN` | Sim | Fine-grained Personal Access Token do GitHub restrito a este repositório com permissão mínima **`Contents: write`**. |
| `GITHUB_OWNER` | Não | Dono do repositório no GitHub (padrão: `JoaopauloRM700`). |
| `GITHUB_REPO` | Não | Nome do repositório no GitHub (padrão: `technology-radar`). |
| `GITHUB_BRANCH` | Não | Branch canônica (padrão: `main`). |
| `NVIDIA_API_KEY` | Sim (para IA) | Chave secreta da API NVIDIA NIM (gerada no portal build.nvidia.com). |
| `NVIDIA_NIM_MODEL` | Não | Modelo de propostas (padrão: `nvidia/nemotron-3.5-super-vl-120b-a12b`). |
| `NVIDIA_NIM_URL` | Não | Endpoint Chat Completions (padrão: `https://integrate.api.nvidia.com/v1/chat/completions`). |
| `NVIDIA_PARSE_URL` | Não | Endpoint Nemotron Parse OCR (padrão: `https://ai.api.nvidia.com/v1/retrieval/nvidia/nemotron-3.5-parse/parse`). |
| `ALLOWED_ORIGINS` | Não | Origens CORS permitidas separadas por vírgula (padrão: `https://joaopaulorm700.github.io,http://localhost:4173`). |
| `PORT` | Não | Porta HTTP da API (padrão: `8787`). |

## Execução Local

No PowerShell do Windows, prefira `npm.cmd` para evitar bloqueios de política de execução.

Instale as dependências uma vez antes de subir os serviços:

```bash
npm.cmd ci
```

### 1. Subir a API em Docker (porta `8787`)

```bash
docker compose up --build
```

A API responderá em `http://localhost:8787/healthz`. Para rodar a API diretamente sem Docker (exige Poppler no `PATH` para análise de PDF):

```bash
npm.cmd run radar:api
```

Esse comando carrega `.env` automaticamente quando o arquivo existe. Se `PORT` usar uma porta diferente de `8787`, ajuste também a meta tag `radar-api-base` do frontend para a URL completa da API. No Docker Compose, `PORT` altera somente a porta publicada no host; o container continua ouvindo em `8787`.

### 2. Subir o frontend estático local (porta `4173`)

```bash
npm.cmd run radar:app
```

Acesse `http://localhost:4173`. O servidor estático local (`scripts/local-server.mjs`) opera por **allowlist estrita** e serve apenas `index.html`, `styles.css`, `app.js`, `app-core.mjs` e `data/radar.json` — nunca `.env`, `.git`, `data/uploads/` ou artefatos internos.

Em `localhost`/`127.0.0.1`, o frontend aponta automaticamente para `http://localhost:8787` se a meta tag `radar-api-base` estiver vazia.

## Deploy no Render e GitHub Pages

### API no Render (Blueprint gratuito)

1. Conecte o repositório do GitHub no [Render](https://render.com/) usando o Blueprint `render.yaml` (o Render constrói diretamente a partir do `Dockerfile` com Node 22 `bookworm-slim`, `poppler-utils` e usuário não-root `node`).
2. Preencha os segredos marcados com `sync: false` no painel do Render:
   - `NVIDIA_API_KEY`
   - `ADMIN_TOKEN` (mínimo 32 caracteres)
   - `GITHUB_TOKEN` (fine-grained PAT com `Contents: write` neste repositório)
3. Verifique o health check em `https://<seu-servico>.onrender.com/healthz`.

### Configurar a URL pública da API no GitHub Pages

1. Edite a meta tag em `index.html`:

```html
<meta name="radar-api-base" content="https://<seu-servico>.onrender.com" />
```

2. Faça commit na branch `main` do GitHub.
3. No GitHub, ative **Settings -> Pages -> Deploy from a branch (`main` / `/root`)**.

### Cold start e limites do plano gratuito do Render

- Serviços web gratuitos do Render entram em hibernação após **15 minutos de inatividade** e têm **filesystem efêmero** (reinícios apagam arquivos temporários e jobs em memória). Consulte os [limites oficiais do Render Free](https://render.com/docs/free).
- O Render ignora commits que alteram somente `data/radar.json`, evitando um redeploy da API a cada versão publicada pelo administrador.
- O frontend desperta a API automaticamente chamando `GET /healthz` por até **90 segundos** antes de autenticar, salvar ou enviar PDFs.
- Se o Render reiniciar durante uma análise, o polling (`GET /api/v1/analysis-jobs/:id`) recebe `404` e exibe uma mensagem orientando o reenvio do PDF. O estado permanente em `data/radar.json` no GitHub permanece intacto.
- Após **Salvar versão**, o commit `chore(radar): <descrição>` é gravado imediatamente no GitHub `main`, mas o GitHub Pages pode levar alguns minutos para publicar o novo `data/radar.json`.
- Se a resposta da publicação exceder 60 segundos, o diálogo é liberado com status incerto e o rascunho permanece na aba; confira o histórico do GitHub antes de tentar novamente.

## Limites e Governança da Análise de PDF

- Somente **PDFs públicos**, sem criptografia, com assinatura `%PDF-`, até **10 MiB** e **75 páginas**.
- Extração híbrida: `pdftotext -layout` para páginas textuais; páginas com menos de 80 caracteres úteis são renderizadas em JPEG com a maior dimensão limitada a 2048 px (`pdftoppm`) e enviadas ao `nvidia/nemotron-3.5-parse` (concorrência máxima 2, timeout de 60 s por chamada, retry de 2 s e 5 s apenas para HTTP `429`/`503`).
- Limites da POC: **1 job simultâneo**, timeout total de **10 minutos**, TTL de **30 minutos** em memória e **10 análises por dia UTC**.
- A cota diária é mantida apenas na memória do processo e reinicia quando o serviço do Render reinicia; o radar publicado continua permanente no GitHub.
- Máximo de **5 propostas** (`add`, `update`, `move`). Exclusões sugeridas pela IA nunca são aceitas. Todas as propostas abrem **desmarcadas** no diálogo de revisão com confiança, evidência por página e diff antes/depois, sendo aplicadas somente ao rascunho até você clicar em **Salvar versão**.

## Sincronização Manual GitHub -> GitLab

O repositório do **GitHub (`main`) é a fonte de verdade**, pois a API grava commits diretamente nele. Antes de iniciar qualquer alteração local, sincronize o `main` do GitHub para o GitLab (`origin`):

```bash
git fetch github
git checkout main
git merge --ff-only github/main
git push origin main
```

## Fluxo CLI (Descoberta e Propostas Locais)

Comandos disponíveis para execução offline/local em lote:

- `npm.cmd test`: executa toda a suíte `node:test`.
- `npm.cmd run radar:app`: sobe o servidor estático local seguro na porta `4173`.
- `npm.cmd run radar:api`: sobe a API administrativa localmente na porta `8787`.
- `npm.cmd run radar:full`: descobre fontes, baixa/analisa PDFs novos e consolida propostas.
- `npm.cmd run radar:full:nim`: executa o pipeline completo gerando propostas com NVIDIA NIM (preserva artefatos históricos gerados com Gemini).
- `npm.cmd run radar:discover`: varredura de fontes em `data/monitored-sources.json`.
- `npm.cmd run radar:pdf -- "<caminho.pdf>"`: extração local de sinais e brief de um PDF.
- `npm.cmd run radar:update` / `radar:update:offline`: coleta de sinais das fontes monitoradas.

Fontes com `strategy: "publications"` abrem até cinco páginas recentes do índice oficial, extraem metadados acadêmicos e encaminham PDFs públicos ao pipeline existente. A classificação (`peer-reviewed`, `preprint`, `technical-report` ou `corporate-research`) e a deduplicação por DOI/arXiv/título ajudam a revisão, mas nunca publicam blips automaticamente.

O catálogo exibido no site fica em `data/radar.json`; a configuração de coleta fica em `data/monitored-sources.json`. Ao adicionar ou remover uma fonte, mantenha nome e URL sincronizados nos dois arquivos.

## Arquivos Principais

- `data/radar.json`: estado canônico versionado do radar.
- `index.html`, `styles.css`, `app.js`, `app-core.mjs`: frontend estático, modo admin, diálogo de revisão e exportação HTML client-side.
- `scripts/local-server.mjs`: servidor estático local com allowlist para desenvolvimento (`4173`).
- `scripts/api-server.mjs`: servidor HTTP da API administrativa e jobs de análise (`8787`).
- `scripts/lib/github-radar-store.mjs`: leitura/gravação versionada no GitHub com detecção de conflito `409`.
- `scripts/lib/nvidia-nim.mjs`: cliente NVIDIA NIM com JSON Schema estrito.
- `scripts/lib/pdf-pipeline.mjs`: validação, Poppler e OCR seletivo com Nemotron Parse.
- `scripts/lib/analysis-jobs.mjs`: fila/estado em memória, limites diários, timeout e limpeza.
- `Dockerfile`, `.dockerignore`, `compose.yaml`, `render.yaml`: empacotamento e deploy no Render.
