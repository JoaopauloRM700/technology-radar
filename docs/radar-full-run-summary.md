# Resumo do Pipeline Completo do Radar

Data: 2026-07-23T17:17:07.050Z

## Descoberta

- Motor: playwright (Chrome instalado via Playwright channel.)
- Fontes verificadas: 9
- Candidatos PDF: 98
- PDFs baixados ou em cache: 6
- PDFs analisados: 6

## Propostas Consolidadas

- Arquivo para importar no app: `data/radar-update-proposals.json`
- Total consolidado: 18

## Execucao com IA

- data/pdf/devops_awards_fullebook_final-proposals.json: ignorado (propostas-existentes), 3 proposta(s) existentes
- data/pdf/dora-core-v2.1.0-summary-proposals.json: falhou (gemini-http-403), raw: data/ai-raw/dora-core-v2.1.0-summary-proposals-gemini-raw.txt
- data/pdf/nist.ai.100-1-proposals.json: falhou (gemini-http-403), raw: data/ai-raw/nist.ai.100-1-proposals-gemini-raw.txt
- data/pdf/nist.ai.100-1.ara-proposals.json: falhou (gemini-http-403), raw: data/ai-raw/nist.ai.100-1.ara-proposals-gemini-raw.txt
- data/pdf/tr_technology_radar_vol_34_en_1-proposals.json: ignorado (propostas-existentes), 12 proposta(s) existentes
- data/pdf/tr_technology_radar_vol_34_pt_1-proposals.json: 3 proposta(s), raw: data/ai-raw/tr_technology_radar_vol_34_pt_1-proposals-gemini-raw.txt

### Arquivos preenchidos

- data/pdf/devops_awards_fullebook_final-proposals.json: 3 proposta(s)
- data/pdf/tr_technology_radar_vol_34_en_1-proposals.json: 12 proposta(s)
- data/pdf/tr_technology_radar_vol_34_pt_1-proposals.json: 3 proposta(s)

### Arquivos ainda vazios

- data/pdf/dora-core-v2.1.0-summary-proposals.json
- data/pdf/nist.ai.100-1-proposals.json
- data/pdf/nist.ai.100-1.ara-proposals.json

### Arquivos invalidos

- Nenhum JSON invalido.

## Proximo passo

1. Abra `index.html`.
2. Clique em **Importar Propostas**.
3. Selecione `data/radar-update-proposals.json`.
4. Revise os blips no editor lateral.
5. Exporte o Markdown final.

Observacao: este comando nao aplica mudancas automaticamente ao radar visual. A aprovacao humana continua sendo a trava de governanca antes da alteracao do radar.
