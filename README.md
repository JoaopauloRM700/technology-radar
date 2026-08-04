# Technology Radar e TRM - Engenharia de Software

Protótipo local de um Radar Tecnológico e Technology Roadmap (TRM) para Engenharia de Software, com foco em P&D, desenvolvimento, qualidade, segurança, DevOps, plataforma e governança de IA.

O projeto combina o modelo do Thoughtworks Technology Radar com atributos de roadmap tecnológico: horizonte temporal, maturidade, risco e esforço de implantação.

## Como Abrir

Abra o arquivo abaixo no navegador:

```text
D:\Documents\Technology-Radar\index.html
```

O app funciona como uma página HTML local, sem backend. As edições feitas na interface ficam salvas no `localStorage` do navegador.

Para usar análise de PDF pela interface, abra pelo servidor local:

```bash
npm.cmd run radar:app
```

Depois acesse:

```text
http://localhost:4173
```

Esse modo habilita o botão **Analisar PDF**, porque o backend local consegue ler `.env`, salvar o upload, analisar o PDF e chamar o Gemini.

## Funcionalidades

- Visualização de radar com quadrantes e anéis.
- Edição de blips pelo painel lateral.
- Adição e exclusão de tecnologias.
- Mudança de quadrante, anel, horizonte, maturidade, risco e esforço.
- Ficha resumida ao clicar em um ponto do radar.
- Link de detalhes por tecnologia.
- Matriz Radar + TRM.
- Biblioteca de fontes monitoradas.
- Exportação em Markdown.
- Importação de propostas geradas por IA.
- Análise assistida de PDFs para gerar sinais e propostas de novos blips.
- Upload de PDF pela interface quando o app roda via `npm.cmd run radar:app`.
- Exportação de snapshot HTML mensal para compartilhar com gestão.

## Quadrantes

- Técnicas
- Plataformas
- Ferramentas
- Linguagens e Frameworks

## Anéis

- Adopt: tecnologia madura, pronta para uso padrão.
- Trial: promissora, recomendada para piloto controlado.
- Assess: requer avaliação de viabilidade.
- Caution: exige cautela ou deve ser evitada no momento.

## Comandos

No PowerShell, use `npm.cmd` para evitar bloqueios de política de execução:

Para executar o pipeline local completo:

```bash
npm.cmd run radar:full
```

Para abrir o app com backend local e upload de PDF:

```bash
npm.cmd run radar:app
```

Esse comando roda descoberta de fontes/PDFs, baixa arquivos novos, analisa PDFs, consolida todos os arquivos `data/pdf/*-proposals.json` preenchidos e gera:

- `data/radar-update-proposals.json`: JSON único para importar no app.
- `docs/radar-full-run-summary.md`: resumo do pipeline, com arquivos preenchidos e arquivos ainda vazios.

Observação: sem uma chave de IA configurada, o comando não cria propostas novas sozinho a partir dos briefs. Ele consolida as propostas já existentes e mostra quais arquivos ainda precisam de curadoria por IA/humana.

Para executar o pipeline completo com geração automática de propostas via Gemini:

```bash
npm.cmd run radar:full:gemini
```

Antes, preencha o arquivo `.env`:

```env
GEMINI_API_KEY=SUA_CHAVE_AQUI
GEMINI_MODEL=gemini-3.6-flash
GEMINI_API_VERSION=v1beta
```

O modo Gemini preenche arquivos `data/pdf/*-proposals.json` vazios, preserva propostas já existentes e depois consolida tudo em `data/radar-update-proposals.json`. Para forçar reprocessamento de propostas já preenchidas:

```bash
npm.cmd run radar:full:gemini -- --ai-overwrite
```

Para limitar o número de briefs processados pela IA em um teste:

```bash
npm.cmd run radar:full:gemini -- --ai-limit 2
```

```bash
npm.cmd run radar:update
```

Esse comando coleta sinais nas fontes de `data/monitored-sources.json` e gera:

- `data/radar-signals.json`: sinais extraídos das fontes.
- `docs/radar-ai-update-brief.md`: briefing pronto para enviar a uma IA.
- `data/radar-update-proposals.json`: arquivo onde a resposta JSON da IA deve ser salva.

Para testar o fluxo sem Internet:

```bash
npm.cmd run radar:update:offline
```

Para descobrir PDFs e relatórios nas fontes monitoradas usando Playwright quando disponível:

```bash
npm.cmd run radar:discover
```

O comando lê `data/monitored-sources.json`, abre as fontes marcadas com `"strategy": "playwright"` em um navegador headless, detecta links de PDF ou relatórios, baixa arquivos novos em `data/downloads/`, evita duplicatas por cache/hash e chama automaticamente o analisador de PDF.

Em ambientes sandbox, como o Codex, a navegação real do Playwright pode pedir permissão de rede. Sem essa permissão, o comando registra a falha no relatório e não baixa arquivos.

Opções úteis:

```bash
npm.cmd run radar:discover -- --source Thoughtworks
npm.cmd run radar:discover -- --max-sources 3
npm.cmd run radar:discover -- --max-pdfs-per-source 1
npm.cmd run radar:discover -- --no-analyze
npm.cmd run radar:discover -- --fetch-only
```

Saídas geradas:

- `data/discovery/radar-discovery.json`: relatório estruturado da varredura.
- `data/discovery/download-cache.json`: cache de PDFs baixados e hashes.
- `docs/radar-discovery-brief.md`: briefing de auditoria da descoberta.
- `data/downloads/`: PDFs baixados por fonte.
- `data/pdf/`: textos, sinais, briefs e propostas por PDF analisado.

Campos úteis em `data/monitored-sources.json`:

- `strategy`: `playwright` para páginas dinâmicas ou `fetch` para HTML simples.
- `discoverPdfs`: habilita ou desabilita busca de PDFs naquela fonte.
- `maxPdfDownloads`: limite padrão de downloads por fonte.
- `preferredPdfPatterns`: padrões que aumentam a prioridade de PDFs relevantes.
- `excludedPdfPatterns`: padrões que reduzem a prioridade de PDFs fora de escopo.

Para analisar um PDF local:

```bash
npm.cmd run radar:pdf -- "D:\Downloads\tr_technology_radar_vol_34_en_1.pdf"
```

Esse comando gera:

- `data/pdf/<nome-do-pdf>.txt`: texto extraído do PDF.
- `data/pdf/<nome-do-pdf>-signals.json`: sinais, trechos e termos candidatos.
- `docs/<nome-do-pdf>-brief.md`: briefing pronto para enviar a uma IA.
- `data/pdf/<nome-do-pdf>-proposals.json`: arquivo de propostas para importar no app.

## Fluxo de Atualização com IA

1. Rode `npm.cmd run radar:update`.
2. Abra `docs/radar-ai-update-brief.md`.
3. Cole o briefing em uma IA, como Gemini Studio ou ChatGPT.
4. Peça para a IA retornar somente JSON válido no formato solicitado.
5. Salve a resposta em `data/radar-update-proposals.json`.
6. Abra `index.html`.
7. Clique em **Importar Propostas**.
8. Revise e confirme a aplicação das mudanças.

A IA não altera o radar automaticamente. Ela propõe mudanças, e a decisão final continua humana.

## Fluxo de Análise de PDF

1. Coloque o PDF em uma pasta local acessível.
2. Rode `npm.cmd run radar:pdf -- "CAMINHO\DO\ARQUIVO.pdf"`.
3. Revise `docs/<nome-do-pdf>-brief.md`.
4. Cole o briefing em uma IA e peça retorno somente em JSON.
5. Salve o JSON em `data/pdf/<nome-do-pdf>-proposals.json`.
6. Abra `index.html`.
7. Clique em **Importar Propostas** e escolha o JSON do PDF.
8. Revise cada blip no editor lateral antes de consolidar.

Observação: PDFs com texto embutido funcionam bem. PDFs escaneados ou baseados em imagem podem exigir uma etapa futura de OCR, como Docling, Azure Document Intelligence, Google Document AI, Amazon Textract ou outro parser dedicado.

## Fluxo de Upload de PDF na Interface

1. Preencha `.env` com `GEMINI_API_KEY`.
2. Rode `npm.cmd run radar:app`.
3. Abra `http://localhost:4173`.
4. Clique em **Analisar PDF**.
5. Escolha um PDF.
6. O servidor local salva o upload em `data/uploads/`, gera texto/sinais/brief em `data/pdf/` e `docs/`, chama Gemini e cria um `*-proposals.json`.
7. O app pergunta se você quer aplicar as propostas ao radar local.
8. Revise os blips no editor lateral antes de exportar o Markdown.

Se abrir `index.html` diretamente por `file://`, o botão avisa para usar `npm.cmd run radar:app`.

## Fluxo de Envio Mensal para Gestão

1. Rode `npm.cmd run radar:app`.
2. Abra `http://localhost:4173`.
3. Atualize o radar, importe propostas e revise os blips.
4. Vá para a aba **Exportação**.
5. Clique em **Salvar HTML**.
6. O sistema salva um snapshot em `exports/YYYY-MM-DD-radar-tecnologico-engenharia-software.html` e também baixa uma cópia pelo navegador.

Esse HTML é autônomo: pode ser enviado por e-mail, Teams, Drive ou SharePoint e não depende do servidor local nem do `localStorage`.

## Arquivos Principais

- `index.html`: interface do radar.
- `styles.css`: estilos visuais.
- `app.js`: dados iniciais, edição, exportação, importação e renderização do radar.
- `package.json`: comandos locais.
- `scripts/discover-sources.mjs`: coletor Playwright/fetch para encontrar, baixar e analisar PDFs nas fontes.
- `scripts/run-radar-full.mjs`: orquestrador de descoberta, análise e consolidação em um único JSON importável.
- `scripts/local-server.mjs`: servidor local para abrir o app e processar uploads de PDF.
- `scripts/gemini-proposals.mjs`: geração de propostas com Gemini a partir dos briefs.
- `scripts/html-export.mjs`: gerador de snapshot HTML autônomo para envio mensal.
- `exports/`: snapshots HTML mensais compartilháveis.
- `scripts/update-radar.mjs`: coletor de sinais das fontes monitoradas.
- `scripts/analyze-pdf.mjs`: extrator local de sinais a partir de PDFs.
- `data/monitored-sources.json`: lista de fontes usadas pelo agente de atualização.
- `data/discovery/`: relatórios e cache de descoberta automatizada.
- `data/downloads/`: PDFs baixados das fontes monitoradas.
- `data/radar-update-proposals.example.json`: exemplo de JSON aceito pela importação.
- `data/pdf/`: saídas de análises de PDFs e propostas específicas por arquivo.
- `docs/radar-trm-engenharia-software.md`: relatório executivo em Markdown.
- `docs/radar-ai-update-brief.md`: briefing gerado para análise por IA.

## Fontes Monitoradas

As fontes iniciais incluem:

- Thoughtworks Technology Radar
- DORA Research
- OWASP GenAI Security
- GitHub Blog e Changelog
- GitLab DevSecOps Reports
- Stack Overflow Developer Survey
- CNCF Landscape
- OpenSSF
- NIST AI RMF
- Martin Fowler
- InfoQ Trends
- SIG State of Software

## Governança Recomendada

- Atualizar mensalmente.
- Registrar fonte, data, evidência e justificativa para cada mudança.
- Evitar promoção para Adopt sem evidência forte.
- Tratar sinais de comunidades como alertas, não como decisão automática.
- Exigir revisão OWASP/NIST para blips ligados a agentes, LLMs, MCP e automação autônoma.
- Manter pilotos com hipótese, métricas, critério de sucesso e plano de saída.

## Próximas Evoluções

- Integração direta com API de IA para gerar propostas sem copiar o briefing manualmente.
- Upload de PDF diretamente pela interface, com backend local ou parser/OCR embarcado.
- Persistência em arquivo ou banco local, em vez de somente `localStorage`.
- Histórico mensal de versões do radar.
- Exportação direta para Google Docs/Drive.
- Painel de aprovação de propostas com diff antes/depois.
- Radar adicional para Robótica.
