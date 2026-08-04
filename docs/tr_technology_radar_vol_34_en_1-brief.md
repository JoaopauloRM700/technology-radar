# Brief para IA - Análise de PDF para Radar Tecnológico

Arquivo analisado: D:\Documents\Technology-Radar\data\downloads\thoughtworks-technology-radar\tr_technology_radar_vol_34_en_1.pdf
Data: 2026-07-23T17:04:44.208Z
Tamanho do texto extraído: 141007 caracteres

Você é um Arquiteto Estratégico de Tecnologia e Pesquisador de Inovação. Analise os sinais extraídos deste PDF e proponha novos blips ou mudanças para o Radar Tecnológico de Engenharia de Software.

Regras:

- Retorne somente JSON válido.
- Proponha apenas tecnologias, técnicas, plataformas, ferramentas, linguagens ou frameworks que tenham evidência no PDF.
- Não repita blips que já existem se a proposta for apenas sinônimo.
- Use os quadrantes: Técnicas, Plataformas, Ferramentas, Linguagens e Frameworks.
- Use os anéis: Adopt, Trial, Assess, Caution.
- Use horizonte: Curto, Médio, Longo.
- Use maturidade: Experimental, Emergente, Madura.
- Use risco e esforço: Baixo, Médio, Alto.
- Para cada proposta, inclua evidência textual curta, página se disponível, justificativa e contraindicação.

Formato obrigatório:

```json
{
  "generatedAt": "2026-07-23T17:04:44.213Z",
  "proposals": [
    {
      "action": "add",
      "reason": "Por que este blip deve entrar no radar.",
      "confidence": 0.7,
      "evidence": [
        {
          "source": "tr_technology_radar_vol_34_en_1.pdf",
          "url": "file://D:/Documents/Technology-Radar/data/downloads/thoughtworks-technology-radar/tr_technology_radar_vol_34_en_1.pdf",
          "note": "Trecho ou evidência resumida do PDF."
        }
      ],
      "blip": {
        "name": "Nome do blip",
        "quadrant": "Técnicas",
        "ring": "Assess",
        "horizon": "Médio",
        "maturity": "Emergente",
        "risk": "Médio",
        "effort": "Médio",
        "status": "Monitorar",
        "source": "tr_technology_radar_vol_34_en_1.pdf",
        "theme": "Tema",
        "detailsUrl": "",
        "strategic": "Justificativa estratégica.",
        "constraints": "Gargalos e contraindicações."
      }
    }
  ]
}
```

## Termos candidatos

- This (50)
- Teams (21)
- However (20)
- While (16)
- LLMs (16)
- Claude Code (15)
- Radar (13)
- Trial (12)
- APIs (12)
- Assess (10)
- JSON (10)
- These (9)
- Techniques (9)
- Unlike (9)
- DORA (8)
- Context (8)
- Tools (8)
- Python (8)
- Agent Skills (7)
- Coding (7)
- Instead (7)
- Cursor (7)
- OpenClaw (6)
- CodeScene (6)
- Measuring (6)
- Google (6)
- PydanticAI (6)
- LangGraph (6)
- Warp (6)
- With (5)
- When (5)
- Sprites (5)
- Databricks (5)
- Iceberg (5)
- Progressive (4)
- AI-accelerated (4)
- Dev Containers (4)
- Some (4)
- Code (4)
- AI-generatedcode (4)
- Platforms (4)
- ClickHouse (4)
- Git AI (4)
- VS Code (4)
- GenAI (4)
- CDKTF (4)
- LanguagesandFrameworks (4)
- React (4)
- The Radar (3)
- Without (3)
- AI-driven (3)
- Agents (3)
- What (3)
- Zero (3)
- Superpowers (3)
- Feedback (3)
- Beyond (3)
- Adopt Context (3)
- Mapping (3)
- Mutation (3)

## Possíveis títulos e blips

- All Rights Reserved.
- Our mission is to champion software excellence and revolutionize IT.
- We create andshare the Thoughtworks Technology Radar in support of that mission.
- The content is intended as a concise summary.
- We encourage you to explore these technologies.
- We further group these items in four rings to reflect our current position on them.
- We use them when appropriate in our projects.
- Trial: Worth pursuing.
- Its important to understandhow to build up this capability.
- Enterprises can try this technology on a project that can handle the risk.
- We organize the blips in the Radar using two categorizing elements: quadrants andrings.
- The quadrants represent different kinds of blips.
- The rings indicate our recommendation for using that technology.
- A blip is a technology or technique that plays a role in software development.
- Contributors The TAB meets twice a year face-to-face andbiweekly virtually.
- Its primary role is to be an advisory group for Thoughtworks CTO Rachel Laycock.
- The challenge extends beyond semantics.
- The pace of change compounds this uncertainty.
- This environment also risks creating codebase cognitive debt .
- Themes That said, this is not a story of continuity alone.
- Several techniques in this edition reflect this shift.
- The appetite for access collides with unsolvedproblems.
- Injection isnt the only threat.
- What can we do today?
- Treating AI context as a statictext box is a fast track to hallucinations.
- Here, a live, compilable codebase serves as the source of truth.
- New repositories then inherit the latest agent workflows and rules by default.
- These include change metric, rework rate.
- Techniques 6.
- As their popularity has grown, the surrounding ecosystem has expandedas well.
- They were difficult to set up, slow to run and often flaky.
- This has improvedsignificantly.
- The performance hit is now small enough that the trade-off is worthwhile.
- Techniques These checks reduce routine steering work for the human in the loop.
- This is particularly effective for legacy stacks like .N training data often falls short.
- Its also useful for teams with distinctive engineering standards.
- We see sandboxing as a sensible default rather than an optional enhancement.
- The landscape of sandboxing options now spans a broad spectrum.
- Developers needport forwarding and sufficient CPU and memory for agent workloads.
- Standalone tools such as dbt MetricFlow and Cube provide a portable layer across systems.
- The main cost is upfront data modeling investment.
- Techniques 15.
- Techniques such as RLVR help ensure these rewards are verifiable andresistant to gaming.
- Setting up the requiredinfrastructure can be complex.
- This creates a feedbackloop where poor code begets poorer code.
- Some of our teams are now addressing architecture drift reduction with LLMs.
- LLMs are then used to help fix these issues.
- Our teams have foundthis effective, as it is analogous to code refactoring.
- You can run these directly in a browser, host them anywhere, or simply share the file.
- Its also simpler than building a full web application with dedicatedhosting.
- This is where ATLAS can help.
- The core insight is simplicity.
- Every data chunkis tagged with role-based permissions at indexing time.
- This provides a zero trust foundation for internal knowledge bases.
- This technique applies at multiple levels.
- Small language models Assess per dollar than LLMs for certain use cases.
- Weve seen teams evaluate SLMs to reduce inference costs and speed up agenticworkflows.
- Since then, the barrier to adoption has dropped.
- Assess Agent capabilities are outpacing security practices.
- While each addition is useful in isolation, this often leads to agent instruction bloat.
- Instructions become long andsometimes conflict with each other.
- As instructions grow, the likelihood increases that important rules are ignored.
- We also see many teams using AI to generate AGENTS.
- This creates a virtuous cycle in which AI output requires less correction.
- A mindset that expects failures and recovers gracefully outpaces a reactive approach.
- We caution against using MCP by default.
- Techniques 41.
- outside MCP, functioning as an interface layer between the frontend andthe agent backend.
- Platforms 45.
- Strong community adoption further signals production readiness.
- Neo4j is the primary backend, with FalkorDB as a lighter alternative.
- The project has matured significantly since we last assessed it.
- We also findit very effective for training sessions, knowledge sharing andbootcamps.
- Were seeing early interest from teams that need better traceability around these changes.
- Platforms 51.
- We previously trackedits predecessor, Dialogflow , in the Radar.
- Clients including Claude, ChatGPT, VS Code and Goose already ship support.
- Platforms 58.
- Monarch is built on a high-performance Rust backend.
- However, Neutree is still relatively new, and teams shouldapproach adoption with caution.

## Trechos relevantes

### Adopt

.com/radar/faq Our Radar is forward-looking. To make room for new items, we fade items that havent moved recently, which isnt a reflection on their value but rather on our limited Radar real estate. CautionAssessTrialAdopt Adopt: We feel strongly that the industry should be adopting these items. We use them when appropriate in our projects. Trial: Worth pursuing. Its important to understandhow to build up this capability. Enterprises can try this technology on a project that can handle the risk. Assess: Worth exploring with the goal of understanding how it will affect your e

### Adopt

radar/faq Our Radar is forward-looking. To make room for new items, we fade items that havent moved recently, which isnt a reflection on their value but rather on our limited Radar real estate. CautionAssessTrialAdopt Adopt: We feel strongly that the industry should be adopting these items. We use them when appropriate in our projects. Trial: Worth pursuing. Its important to understandhow to build up this capability. Enterprises can try this technology on a project that can handle the risk. Assess: Worth exploring with the goal of understanding how it will affect your enterpr

### Adopt

for new items, we fade items that havent moved recently, which isnt a reflection on their value but rather on our limited Radar real estate. CautionAssessTrialAdopt Adopt: We feel strongly that the industry should be adopting these items. We use them when appropriate in our projects. Trial: Worth pursuing. Its important to understandhow to build up this capability. Enterprises can try this technology on a project that can handle the risk. Assess: Worth exploring with the goal of understanding how it will affect your enterprise Caution: Proceed with care. These items involve

### Adopt

in an agentic world AI is changing notonly technology but also how we assess and evaluate it. While assembling this volume of the Technology Radar, we noticedthat evaluating technology is becoming harder as the industry adopts AI. One contributing factor is semanticdiffusion: the rapidemergence of new terms for evolving practices, often before their meanings have stabilized. For example, terms such as spec-driven development and harness engineering are sometimes usedinconsistently or overlap in meaning. Without shareddefinitions, its difficult to determine whether were seeing

### Adopt

quickly and with relatively little effort, what ensures continuedinvestment in maintaining and evolving it? This environment also risks creating codebase cognitive debt . As more code is generated by AI, its easier to adopt solutions without developing the mental models neededto understandhow they work. Over time, this gap in understanding accumulates, making systems harder to reason about, debug andevolve. Retaining principles, relinquishing patterns An interesting consequence of AI in software development is that its not only forcing us to look to the future; its also push

### Adopt

tools such as CodeScene . Beyond in-loop feedback, some of our teams have also reducedarchitectural drift by combining deterministic structural rules with LLM-based evaluation. Themes CautionCautionAssessAssessTrialTrialAdoptAdopt The Radar New Movedin/out No change Adopt Context engineering Curatedsharedinstructions for software teams DORA metrics Passkeys Structured output from LLMs Zero trust architecture Trial Agent Skills Browser-basedcomponent testing Feedbacksensors for coding agents Mapping code smells to refactoring techniques Mutation testing Progressive context disclo

### Adopt

such as CodeScene . Beyond in-loop feedback, some of our teams have also reducedarchitectural drift by combining deterministic structural rules with LLM-based evaluation. Themes CautionCautionAssessAssessTrialTrialAdoptAdopt The Radar New Movedin/out No change Adopt Context engineering Curatedsharedinstructions for software teams DORA metrics Passkeys Structured output from LLMs Zero trust architecture Trial Agent Skills Browser-basedcomponent testing Feedbacksensors for coding agents Mapping code smells to refactoring techniques Mutation testing Progressive context disclosure

### Adopt

ck, some of our teams have also reducedarchitectural drift by combining deterministic structural rules with LLM-based evaluation. Themes CautionCautionAssessAssessTrialTrialAdoptAdopt The Radar New Movedin/out No change Adopt Context engineering Curatedsharedinstructions for software teams DORA metrics Passkeys Structured output from LLMs Zero trust architecture Trial Agent Skills Browser-basedcomponent testing Feedbacksensors for coding agents Mapping code smells to refactoring techniques Mutation testing Progressive context disclosure Sandboxed execution for coding agents Sema

### Adopt

tion bloat AI-accelerated shadow IT Codebase cognitive debt Coding agent swarms Coding throughput as a measure of productivity Ignoring durability in agent workflows MCP by default Pixel-streameddevelopment environments Adopt Trial Apache APISIX Amazon BedrockAgentCore Graphiti Langfuse Port Replit SigNoz Assess Agent Trace ClickStack Coder Databricks Agent Bricks DuckLake FalkorDB Google Dialogflow CX MCP Apps Monarch Neutree OptScale Rhesis Runpod Sprites torchforge torchtitan Caution Techniques Platforms The Radar Adopt Axe-core Claude Code Cursor Kafbat UI mise Trial cargo-m

### Adopt

Noz Assess Agent Trace ClickStack Coder Databricks Agent Bricks DuckLake FalkorDB Google Dialogflow CX MCP Apps Monarch Neutree OptScale Rhesis Runpod Sprites torchforge torchtitan Caution Techniques Platforms The Radar Adopt Axe-core Claude Code Cursor Kafbat UI mise Trial cargo-mutants Claude Code plugin marketplace Dev Containers Figma Make OpenAI Codex Typst Assess Agent Scan Beads Bloom CDK Terrain CodeScene ConfIT Entire CLI Git AI Google Antigravity Google Mainframe Assessment Tool OpenCode OpenSpec PageIndex Pencil Pi Qwen 3 TTS SGLang ty Warp WuppieFuzz Caution OpenClaw

### Adopt

ssess Agent Scan Beads Bloom CDK Terrain CodeScene ConfIT Entire CLI Git AI Google Antigravity Google Mainframe Assessment Tool OpenCode OpenSpec PageIndex Pencil Pi Qwen 3 TTS SGLang ty Warp WuppieFuzz Caution OpenClaw Adopt Apache Iceberg Declarative Automation Bundles React JS React Native Svelte Typer Trial DeepEval Docling LangExtract LangGraph LiteLLM Modern.js Assess Agent Lightning GitHub SpecKit Mastra Pipecat Superpowers TanStackStart Unsloth Caution Tools Languages and Frameworks The Radar Techniques CautionCautionAssessAssessTrialTrialAdoptAdopt Adopt Context enginee

### Adopt

gExtract LangGraph LiteLLM Modern.js Assess Agent Lightning GitHub SpecKit Mastra Pipecat Superpowers TanStackStart Unsloth Caution Tools Languages and Frameworks The Radar Techniques CautionCautionAssessAssessTrialTrialAdoptAdopt Adopt Context engineering Curatedsharedinstructions for software teams DORA metrics Passkeys Structured output from LLMs Zero trust architecture Trial Agent Skills Browser-basedcomponent testing Feedbacksensors for coding agents Mapping code smells to refactoring techniques Mutation testing Progressive context disclosure Sandboxed execution for coding

### Adopt

act LangGraph LiteLLM Modern.js Assess Agent Lightning GitHub SpecKit Mastra Pipecat Superpowers TanStackStart Unsloth Caution Tools Languages and Frameworks The Radar Techniques CautionCautionAssessAssessTrialTrialAdoptAdopt Adopt Context engineering Curatedsharedinstructions for software teams DORA metrics Passkeys Structured output from LLMs Zero trust architecture Trial Agent Skills Browser-basedcomponent testing Feedbacksensors for coding agents Mapping code smells to refactoring techniques Mutation testing Progressive context disclosure Sandboxed execution for coding agent

### Adopt

ngGraph LiteLLM Modern.js Assess Agent Lightning GitHub SpecKit Mastra Pipecat Superpowers TanStackStart Unsloth Caution Tools Languages and Frameworks The Radar Techniques CautionCautionAssessAssessTrialTrialAdoptAdopt Adopt Context engineering Curatedsharedinstructions for software teams DORA metrics Passkeys Structured output from LLMs Zero trust architecture Trial Agent Skills Browser-basedcomponent testing Feedbacksensors for coding agents Mapping code smells to refactoring techniques Mutation testing Progressive context disclosure Sandboxed execution for coding agents Sema

### Adopt

Coding agent swarms Coding throughput as a measure of productivity Ignoring durability in agent workflows MCP by default Pixel-streameddevelopment environments New Movedin/out No change Techniques 1. Context engineering Adopt Context engineering has evolvedfrom an optimization tacticinto a foundational architectural concern for modern AI systems. Unlike prompt engineering, which focuses on wording, context engineering treats the context window as a design surface andintentionally constructs the AIs information environment. As agents tackle more complex tasks, dumping raw data i

### Adopt

context as a statictext box is a fast track to hallucinations. To buildresilient enterprise agents, teams must engineer context as a dynamic, precisely managedpipeline. 2. Curated shared instructions for software teams Adopt As teams mature in their use of AI, relying on individual developers to write prompts from scratch is emerging as an anti-pattern. We advocate for curatedsharedinstructions for software teams, treating AI guidance as a collaborative engineering asset rather than a personal workflow. Initially, this practice focusedon maintaining general-purpose prompt libra

### Adopt

les by default. This approach ensures consistent, high-quality AI assistance is built into every project from day one, while separating general prompt libraries from repository-specific AI configuration. 3. DORA metrics Adopt The metrics definedby the DORA research program have been widely adopted and have proven to be strong leading indicators of how a delivery organization is performing. These include change metric, rework rate. Rework rate is a stability metricthat measures how much of a teams delivery pipeline is consumedby unplanned rework to fix workpreviously consideredc

### Adopt

tance is built into every project from day one, while separating general prompt libraries from repository-specific AI configuration. 3. DORA metrics Adopt The metrics definedby the DORA research program have been widely adopted and have proven to be strong leading indicators of how a delivery organization is performing. These include change metric, rework rate. Rework rate is a stability metricthat measures how much of a teams delivery pipeline is consumedby unplanned rework to fix workpreviously consideredcomplete, such as user-facing bugs or defects. In the era of AI-assisted

### Adopt

n and learning rather than just building complex dashboards. Simple mechanisms, such as check-ins during retrospectives, are often more effective than overly detailedtracking tools at improving capabilities. 4. Passkeys Adopt Shepherdedby the FIDOAlliance andbackedby Apple, Google and Microsoft, passkeys have matured into Adopt. They are FIDO2 credentials that can replace passwords using asymmetricpublic-key cryptography. The private key is storedin a hardware-backedsecure enclave on the users device, protected by biometrics or a PIN, and never leaves it. Each credential is ori

### Adopt

retrospectives, are often more effective than overly detailedtracking tools at improving capabilities. 4. Passkeys Adopt Shepherdedby the FIDOAlliance andbackedby Apple, Google and Microsoft, passkeys have matured into Adopt. They are FIDO2 credentials that can replace passwords using asymmetricpublic-key cryptography. The private key is storedin a hardware-backedsecure enclave on the users device, protected by biometrics or a PIN, and never leaves it. Each credential is origin-boundto its relying- party domain, making passkeys structurally phishing-resistant: a lookalike site

### Adopt

ock-in concerns. Major identity providers including Auth0, Okta and Azure AD now support passkeys as a first-class feature, and implementation has been simplified from a multi-month effort to a two-sprint project. Weve adoptedpasskeys internally and treat them as the default starting point for new authentication implementations. Teams shoulddesign account recovery carefully andavoidphishable fallback paths such as SMS OTP, which reintroduce the vulnerabilities passkeys eliminate. Device-boundcredentials on hardware security keys remain necessary for AAL3 scenarios such as privi

### Adopt

s such as SMS OTP, which reintroduce the vulnerabilities passkeys eliminate. Device-boundcredentials on hardware security keys remain necessary for AAL3 scenarios such as privilegedaccess. 5. Structured output from LLMs Adopt Structured output from LLMs is the practice of constraining models to produce responses in a predefinedformat, such as JSON or a specificprogramming language class. We continue to see this technique deliver reliable results in production, andwe now consider it a sensible default for applications that consume LLM responses programmatically. All major model p

### Adopt

or or a frameworklike PydanticAI to provide a stable abstraction across providers with validation and automatic retries, or Outlines for constrained generation on self-hostedmodels. Techniques 6. Zero trust architecture Adopt As we enter the age of agents, many enterprises are grappling with how to buildthem while addressing the security risks of granting autonomy to unpredictable systems. Zero trust architecture never trust, always verify, along with identity-basedsecurity and least-privilege access, should be treated as foundational for any agent deployment. Our teams are ap

### Adopt

ndations andenabling fine-grainedauthentication in dynamicenvironments. Continuous monitoring and verification of agent behavior are also critical for proactively managing threats. Beyondagent deployments, our teams are adopting practices such as OIDC impersonation in GCP for different applications, including CI/CD pipelines , replacing long-lived statickeys with short-lived tokens issuedafter identity verification. We recommendteams treat ZTA principles as non-negotiable defaults, regardless of the system being built. 7. Agent Skills Trial As AI agents evolve from simple chat i

### Adopt

such as documentation. Agents load skills only when neededbasedon their descriptions, which reduces token consumption andmitigates context window exhaustion andproblems such as agent ins truction bloat Skills have been adopted very quickly, not only in coding agents but also in personal assistants such as OpenClaw . Theyre also one reason teams are becoming more cautious about defaulting to MCP many use cases can be addressed just as effectively by pointing an agent at a local CLI or script. As their popularity has grown, the surrounding ecosystem has expandedas well. Plugin m

### Adopt

overwritten. Context graphs are worth assessing for agenticapplications that require persistent memory across sessions or traceable decision reasoning. Techniques Assess Teams working with coding agents are increasingly adopting spec-driven development workflows. Whether they use a lightweight or opinionatedframework, these workflows typically follow a similar feedback flywheel extends this flow with an additional step focusedon continuously improving the coding agent harness. The approach is similar to retrospectives: teams capture successes and failures during a coding agent s

### Adopt

ill need a human-in-the-loop to avoidcontext rot andnoisy feedback that couldlead the agent astray. We suggest using this approach to evaluate the entire coding agent harness as your environment evolves, especially when adopting new models; what workedwith one model may not be necessary with the next. 21. HTML Tools Assess Since agentictools make it easy to buildsmall, task-specificutilities, the main challenge is often how to deploy andshare them. HTMLTools is an approach where a shareable script or utility is packaged as a single HTML file. You can run these directly in a brow

### Adopt

ht opportunities to improve the feedback flywheel . We recommend tracking collaboration quality at the team level, rather than the individual level, alongside DORA metrics to build a more complete picture of coding agentadoption. 24. MITRE ATLAS Assess Agenticsystems and coding tools introduce new architectures and emergent security threats. MITRE ATLAS is a knowledge base of adversarial tactics andtechniques targeting AI and MLsystems. More focused than the broader MITRE ATT&CK framework and designedto complement it, ATLAS provides a taxonomy of threats for MLpipelines, LLM app

### Adopt

a zero trust foundation for internal knowledge bases. As many vector databases now support high-performance metadata filtering, such as Milvus or services built on Amazon S3 , this technique has become more practical to adopt, even for large knowledge bases. 28. Skills as executable onboarding documentation Assess Agent Skills curatedsharedinstructions and many other context engineering techniques appear throughout this edition of the Radar. One use case we want to highlight in the coding context is the use of skills as executable onboarding documentation. This technique applies

### Adopt

umentation through internal or external skill registries like Tessl . And thirdly, weve foundthis useful for onboarding teams to internal platforms to lower the barrier to using a key technology or reduce friction when adopting a design system. So far, our experience with this has reliedheavily on MCP servers but is now shifting toward skills. As with other forms of documentation, the challenge of keeping this up to date doesnt go away. However, unlike static documentation, executable documentation can help you notice staleness much earlier. 29. Small language models Assess pe

### Adopt

ding agents Assess In the previous Radar, we described a team of coding agents as a technique where a developer orchestrates a small set of role-specificagents to collaborate on a coding task. Since then, the barrier to adoption has dropped. Subagent support has become more of a table stakes feature across establishedcoding agent tools, andClaude Code now includes an agent teams feature that provides built-in orchestration. In a team of agents, a primary orchestrator typically coordinates task sequencing and parallelization. Agents shouldbe able to communicate not only with the

### Adopt

one-off workflows and critical processes that require durable, production-ready implementation is key to balancing experimentation with control. Techniques Organizations should prioritize governance as part of their AI adoption strategy by facilitating experimentation within controlledenvironments. Appropriately instrumentedInternal sandboxes give noncoders a place to deploy prototypes where usage can be tracked. Pairing these with a shared catalogue of existing workflows helps teams discover whats already been built before duplicating effort. Workflows that gain traction can

### Adopt

, teams reach a tipping point where small changes trigger unexpectedfailures, fixes introduce regressions and cleanup efforts increase risk instead of reducing it. Teams shouldavoid complacency with AI-generatedcode and adopt explicit countermeasures: feedback sensors for coding agents tracking team cognitive load and architectural fitness functions to continuously enforce key constraints as AI accelerates output. 37. Coding agent swarms Caution Where a team of coding agents is a small, deliberate group, a coding agent swarm applies dozens to hundreds of agents to a problem, wit

### Adopt

fication is harder. Nevertheless, these experiments contribute to emerging patterns for making long-running swarms technically viable. They remain costly andare still far from mature, which is why we advise caution when adopting this technique. 38. Coding throughput as a measure of productivity Caution AI coding assistants are delivering real productivity gains andare rapidly becoming standard developer tooling. However, were increasingly seeing organizations measure success using superficial throughput metrics are usedin isolation, they can negatively shape employee behavior.

### Adopt

s agents everything they needwithout the protocol overhead. As Simon Willison notes , almost everything I might achieve with an MCP can be handledby a CLI tool instead. This isnt a rejection of MCP. Teams should avoidadopting it by default andfirst ask whether their system actually requires protocol-level interoperability. MCP makes sense when its governance and integration benefits outweigh the added complexity andpotential fidelity loss. Techniques 41. Pixel-streamed development environments Caution Pixel-streamed development environments use VDI-style remote desktops or wo

### Adopt

tops or workstations for software development, with editing, builds anddebugging performed through a streamed desktop rather than on a local machine or a code-centric remote environment. We continue to see organizations adopt them to meet security, standardization and onboarding goals, especially for offshore teams andlift-and-shift cloudprograms. In practice, however, the trade-off is often poor: latency, input lag andinconsistent screen responsiveness create constant cognitive friction that slows delivery andmakes everyday development work more tiring. Unlike development envir

### Adopt

xel-streameddevelopment environments as a default choice for software delivery unless a compelling security or regulatory constraint clearly outweighs the productivity cost. Platforms CautionCautionAssessAssessTrialTrialAdoptAdopt Adopt Trial Apache APISIX Amazon BedrockAgentCore Graphiti Langfuse Port Replit SigNoz Assess Agent Trace ClickStack Coder Databricks Agent Bricks DuckLake FalkorDB Google Dialogflow CX MCP Apps Monarch Neutree OptScale Rhesis Runpod Sprites torchforge torchtitan Caution New Movedin/out No change 42. AG-UI Protocol Trial is an open protocol andlibrary

### Adopt

treameddevelopment environments as a default choice for software delivery unless a compelling security or regulatory constraint clearly outweighs the productivity cost. Platforms CautionCautionAssessAssessTrialTrialAdoptAdopt Adopt Trial Apache APISIX Amazon BedrockAgentCore Graphiti Langfuse Port Replit SigNoz Assess Agent Trace ClickStack Coder Databricks Agent Bricks DuckLake FalkorDB Google Dialogflow CX MCP Apps Monarch Neutree OptScale Rhesis Runpod Sprites torchforge torchtitan Caution New Movedin/out No change 42. AG-UI Protocol Trial is an open protocol andlibrary desig

### Adopt

ddevelopment environments as a default choice for software delivery unless a compelling security or regulatory constraint clearly outweighs the productivity cost. Platforms CautionCautionAssessAssessTrialTrialAdoptAdopt Adopt Trial Apache APISIX Amazon BedrockAgentCore Graphiti Langfuse Port Replit SigNoz Assess Agent Trace ClickStack Coder Databricks Agent Bricks DuckLake FalkorDB Google Dialogflow CX MCP Apps Monarch Neutree OptScale Rhesis Runpod Sprites torchforge torchtitan Caution New Movedin/out No change 42. AG-UI Protocol Trial is an open protocol andlibrary designed to

### Adopt

lugin ecosystem, including WASM. By supporting the Kubernetes Gateway API, Apache APISIX can be usedas a Kubernetes gateway and is a strong candidate for replacing legacy Nginx ingress controllers. Some of our teams are adopting Apache APISIX andfindits performance andfeature set compelling. 44. Amazon Bedrock AgentCore Trial Amazon BedrockAgentCore is the agenticplatform for building, running andoperating agents at scale, securely, without the overheadof infrastructure management, similar to GCP Vertex AI Agent Builder and Azure AI Foundry Agent Service . While its tempting to
