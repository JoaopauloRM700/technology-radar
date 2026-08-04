# Brief para Atualização Assistida por IA do Radar Tecnológico

Data da coleta: 2026-07-23T16:15:12.667Z

Você é um arquiteto estratégico de tecnologia. Analise os sinais abaixo e proponha mudanças para o Radar Tecnológico de Engenharia de Software.

Regras obrigatórias:

- Não aplique mudanças automaticamente.
- Proponha apenas ações com evidência explícita nas fontes.
- Use "add" para novo blip, "update" para mudar um blip existente e "remove" apenas se houver forte justificativa.
- Preserve o modelo Thoughtworks Radar: quadrantes Técnicas, Plataformas, Ferramentas, Linguagens e Frameworks; anéis Adopt, Trial, Assess, Caution.
- Preserve o TRM: horizonte Curto, Médio, Longo; maturidade Experimental, Emergente, Madura; risco Baixo, Médio, Alto; esforço Baixo, Médio, Alto.
- Seja conservador para Adopt; para P&D, prefira Trial ou Assess quando houver incerteza.
- Para riscos agentic/LLM, considere OWASP e NIST antes de promoção.

Retorne somente JSON válido no seguinte formato:

```json
{
  "generatedAt": "2026-07-23T16:15:12.670Z",
  "proposals": [
    {
      "action": "update",
      "id": "ES-16",
      "reason": "Explique a razão da proposta.",
      "confidence": 0.72,
      "evidence": [
        {
          "source": "Nome da fonte",
          "url": "https://...",
          "note": "Evidência resumida"
        }
      ],
      "changes": {
        "ring": "Trial",
        "horizon": "Médio",
        "maturity": "Emergente",
        "risk": "Médio",
        "effort": "Alto",
        "status": "Monitorar",
        "strategic": "Justificativa estratégica atualizada.",
        "constraints": "Gargalos e contraindicações atualizados."
      }
    },
    {
      "action": "add",
      "reason": "Explique a razão da proposta.",
      "confidence": 0.64,
      "evidence": [
        {
          "source": "Nome da fonte",
          "url": "https://...",
          "note": "Evidência resumida"
        }
      ],
      "blip": {
        "name": "Nome do novo blip",
        "quadrant": "Técnicas",
        "ring": "Assess",
        "horizon": "Médio",
        "maturity": "Experimental",
        "risk": "Médio",
        "effort": "Médio",
        "status": "Monitorar",
        "source": "Fonte principal",
        "theme": "Tema",
        "strategic": "Por que avaliar nesta organização.",
        "constraints": "Gargalos e contraindicações."
      }
    }
  ]
}
```

## Sinais coletados

### Thoughtworks Technology Radar

- URL: https://www.thoughtworks.com/radar
- Força da fonte: Alta
- Status da coleta: ok
- Título detectado: Thoughtworks Technology Radar

- radar: Monitorar evidências sobre radar em Thoughtworks Technology Radar.
- agentic: Monitorar evidências sobre agentic em Thoughtworks Technology Radar.
- engineering: Monitorar evidências sobre engineering em Thoughtworks Technology Radar.
- software quality: Monitorar evidências sobre software quality em Thoughtworks Technology Radar.

### DORA Research

- URL: https://dora.dev/research/
- Força da fonte: Alta
- Status da coleta: ok
- Título detectado: DORA Research

- metrics: Monitorar evidências sobre metrics em DORA Research.
- AI-assisted software development: Monitorar evidências sobre AI-assisted software development em DORA Research.
- DevOps: Monitorar evidências sobre DevOps em DORA Research.

### OWASP GenAI Security

- URL: https://genai.owasp.org/
- Força da fonte: Alta
- Status da coleta: ok
- Título detectado: OWASP GenAI Security

- LLM security: Monitorar evidências sobre LLM security em OWASP GenAI Security.
- agentic security: Monitorar evidências sobre agentic security em OWASP GenAI Security.
- MCP: Monitorar evidências sobre MCP em OWASP GenAI Security.
- AI governance: Monitorar evidências sobre AI governance em OWASP GenAI Security.

### GitHub Blog

- URL: https://github.blog/
- Força da fonte: Média
- Status da coleta: ok
- Título detectado: GitHub Blog

- coding agents: Monitorar evidências sobre coding agents em GitHub Blog.
- Copilot: Monitorar evidências sobre Copilot em GitHub Blog.
- languages: Monitorar evidências sobre languages em GitHub Blog.
- supply chain: Monitorar evidências sobre supply chain em GitHub Blog.

### GitLab Resources

- URL: https://about.gitlab.com/resources/
- Força da fonte: Média
- Status da coleta: ok
- Título detectado: GitLab Resources

- DevSecOps: Monitorar evidências sobre DevSecOps em GitLab Resources.
- platform engineering: Monitorar evidências sobre platform engineering em GitLab Resources.
- AI accountability: Monitorar evidências sobre AI accountability em GitLab Resources.

### Stack Overflow Developer Survey

- URL: https://survey.stackoverflow.co/
- Força da fonte: Média
- Status da coleta: ok
- Título detectado: Stack Overflow Developer Survey

- developer adoption: Monitorar evidências sobre developer adoption em Stack Overflow Developer Survey.
- AI trust: Monitorar evidências sobre AI trust em Stack Overflow Developer Survey.
- languages: Monitorar evidências sobre languages em Stack Overflow Developer Survey.
- tools: Monitorar evidências sobre tools em Stack Overflow Developer Survey.

### CNCF Landscape

- URL: https://landscape.cncf.io/
- Força da fonte: Alta
- Status da coleta: ok
- Título detectado: CNCF Landscape

- cloud native: Monitorar evidências sobre cloud native em CNCF Landscape.
- observability: Monitorar evidências sobre observability em CNCF Landscape.
- platform: Monitorar evidências sobre platform em CNCF Landscape.
- security: Monitorar evidências sobre security em CNCF Landscape.

### OpenSSF

- URL: https://openssf.org/
- Força da fonte: Alta
- Status da coleta: ok
- Título detectado: OpenSSF

- supply chain: Monitorar evidências sobre supply chain em OpenSSF.
- SLSA: Monitorar evidências sobre SLSA em OpenSSF.
- Scorecard: Monitorar evidências sobre Scorecard em OpenSSF.
- Sigstore: Monitorar evidências sobre Sigstore em OpenSSF.

### NIST AI RMF

- URL: https://www.nist.gov/itl/ai-risk-management-framework
- Força da fonte: Alta
- Status da coleta: ok
- Título detectado: NIST AI RMF

- AI risk: Monitorar evidências sobre AI risk em NIST AI RMF.
- governance: Monitorar evidências sobre governance em NIST AI RMF.
- secure development: Monitorar evidências sobre secure development em NIST AI RMF.

### Martin Fowler

- URL: https://martinfowler.com/
- Força da fonte: Média
- Status da coleta: ok
- Título detectado: Martin Fowler

- architecture: Monitorar evidências sobre architecture em Martin Fowler.
- agentic programming: Monitorar evidências sobre agentic programming em Martin Fowler.
- software engineering: Monitorar evidências sobre software engineering em Martin Fowler.

### InfoQ Trends

- URL: https://www.infoq.com/infoq-trends-report/
- Força da fonte: Complementar
- Status da coleta: ok
- Título detectado: InfoQ Trends

- architecture: Monitorar evidências sobre architecture em InfoQ Trends.
- AI: Monitorar evidências sobre AI em InfoQ Trends.
- data: Monitorar evidências sobre data em InfoQ Trends.
- methods: Monitorar evidências sobre methods em InfoQ Trends.

### SIG State of Software

- URL: https://www.softwareimprovementgroup.com/
- Força da fonte: Média
- Status da coleta: ok
- Título detectado: SIG State of Software

- software quality: Monitorar evidências sobre software quality em SIG State of Software.
- technical debt: Monitorar evidências sobre technical debt em SIG State of Software.
- AI-generated code: Monitorar evidências sobre AI-generated code em SIG State of Software.
