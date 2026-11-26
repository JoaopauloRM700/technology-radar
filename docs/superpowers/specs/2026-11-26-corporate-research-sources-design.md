# Fontes corporativas de pesquisa — design

## Intenção

Ampliar o Radar Tecnológico com publicações técnicas e acadêmicas produzidas por grandes empresas, preservando a revisão humana antes de qualquer alteração nos blips.

## Objetivos

- Cadastrar Microsoft Research, Google Research, Google DeepMind, IBM Research, Amazon Science, Meta AI, NVIDIA Research e Salesforce AI Research nas fontes públicas e monitoradas.
- Coletar, nas páginas oficiais, título, autores, data/ano, áreas, resumo, venue, DOI/arXiv e links do paper/PDF.
- Classificar a evidência como `peer-reviewed`, `preprint`, `technical-report` ou `corporate-research`.
- Deduplicar por DOI, arXiv e, como fallback, título mais ano, inclusive entre fontes.
- Reaproveitar o download, análise por NIM e revisão humana já existentes quando houver PDF público.

## Não objetivos

- Não publicar blips automaticamente.
- Não criar crawlers específicos para o HTML interno de cada empresa.
- Não baixar texto integral quando não houver PDF público.
- Não alterar o schema público de `data/radar.json`, o frontend ou a API administrativa.

## Restrições

- Node.js 22 e APIs nativas; nenhuma dependência nova.
- No máximo cinco páginas de publicação por fonte em cada varredura, configurável por fonte.
- Somente páginas de detalhe na mesma origem e compatíveis com padrões explícitos da fonte.
- Erros em uma publicação não interrompem as demais fontes.
- Os contratos existentes `pdfCandidates` e `downloads` permanecem presentes.

## Abordagens consideradas

1. **Somente cadastrar as URLs:** menor diff, mas o coletor atual vê apenas PDFs ligados diretamente na primeira página e perderia a maioria dos papers.
2. **Um scraper por empresa:** extrairia mais campos, mas criaria oito integrações frágeis e alto custo de manutenção.
3. **Coletor genérico com padrões por fonte (escolhida):** visita links de detalhe configurados, prioriza JSON-LD e metatags acadêmicas e usa fallbacks simples. É a menor solução que entrega metadados úteis sem acoplar o projeto ao HTML de cada portal.

## Fluxo e dados

Fontes com `strategy: "publications"` entram na varredura mesmo sem descoberta direta de PDFs. O coletor carrega o índice, seleciona links na mesma origem por `publicationLinkPatterns`, limita a quantidade, visita cada detalhe e produz `publications` no relatório. Cada item contém `title`, `authors`, `publishedAt`, `year`, `areas`, `abstract`, `venue`, `doi`, `arxivId`, `detailUrl`, `paperUrl`, `pdfUrl` e `evidenceLevel`.

PDFs diretos e links arXiv são convertidos em candidatos do pipeline existente. O brief passa a listar as publicações e seus níveis de evidência. DOI, arXiv e título/ano impedem que Google Research/DeepMind ou outros portais produzam registros repetidos na mesma execução.

## Segurança e falhas

- O crawler não segue links de detalhe para outra origem.
- URLs inválidas e páginas não-200 são registradas como erros por item.
- HTML sem título acadêmico válido não gera publicação.
- `peer-reviewed` só é usado quando há venue de conferência ou periódico; arXiv isolado permanece `preprint`.

