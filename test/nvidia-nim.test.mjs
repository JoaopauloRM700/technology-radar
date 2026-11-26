import assert from "node:assert/strict";
import test from "node:test";
import { createNvidiaNimClient, NvidiaNimError, validateProposals } from "../scripts/lib/nvidia-nim.mjs";

const apiKey = "fixture-key-never-log-123";
test("propaga o cancelamento do job à requisição de chat", async () => {
  const job = new AbortController();
  const nim = client(async (_url, { signal }) => {
    job.abort();
    signal.throwIfAborted();
    return completion('{"proposals":[]}');
  });
  await assert.rejects(nim.generateProposals("brief", job.signal), errorCode("transport"));
});
const brief = "Trecho de um PDF usado no teste.";
const proposal = {
  action: "add",
  targetId: null,
  reason: "A evidência sustenta um piloto.",
  confidence: 0.75,
  evidence: [{ page: 3, note: "O relatório descreve resultados." }],
  blip: {
    name: "Ferramenta de teste",
    quadrant: "Ferramentas",
    ring: "Trial",
    horizon: "Médio",
    maturity: "Emergente",
    risk: "Baixo",
    effort: "Médio",
    status: "Piloto recomendado",
    source: "Relatório técnico",
    theme: "Qualidade",
    strategic: "Avaliar o efeito em regressões.",
    constraints: "Validar em um piloto.",
    detailsUrl: "https://example.org/relatorio",
  },
};

function completion(content) {
  return Response.json({
    id: "chatcmpl-fixture",
    object: "chat.completion",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  });
}

function client(fetch, options) {
  return createNvidiaNimClient({ env: { NVIDIA_API_KEY: apiKey }, fetch, ...options });
}

function errorCode(code, status) {
  return (error) => {
    assert.ok(error instanceof NvidiaNimError);
    assert.equal(error.code, code);
    if (status !== undefined) assert.equal(error.status, status);
    assert.equal(error.cause, undefined);
    const diagnostic = error.stack + JSON.stringify(error);
    for (const privateText of [brief, apiKey, "upstream-only-content"]) {
      assert.ok(!diagnostic.includes(privateText));
    }
    return true;
  };
}

function strictObject(properties) {
  return { type: "object", properties, additionalProperties: false, required: Object.keys(properties) };
}

test("envia o contrato de chat estrito e devolve as propostas válidas", async () => {
  let request;
  const nim = client(async (url, init) => {
    request = { url, ...init };
    return completion(JSON.stringify({ proposals: [proposal] }));
  }, { env: { NVIDIA_API_KEY: apiKey, NVIDIA_NIM_ENDPOINT: "https://example.org/ignored" } });
  assert.deepEqual(await nim.generateProposals(brief), { proposals: [proposal] });
  assert.equal(request.url, "https://integrate.api.nvidia.com/v1/chat/completions");
  assert.equal(request.method, "POST");
  assert.equal(request.redirect, "manual");
  assert.deepEqual(request.headers, {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  });

  const { messages, ...body } = JSON.parse(request.body);
  assert.deepEqual(messages.map(({ role }) => role), ["system", "user"]);
  assert.match(messages[0].content, /Radar Tecnológico/);
  assert.equal(messages[1].content, brief);
  const nonBlankText = { type: "string", pattern: "\\S" };
  const blip = strictObject({
    name: nonBlankText,
    quadrant: { enum: ["Técnicas", "Plataformas", "Ferramentas", "Linguagens e Frameworks"] },
    ring: { enum: ["Adopt", "Trial", "Assess", "Caution"] },
    horizon: { enum: ["Curto", "Médio", "Longo"] },
    maturity: { enum: ["Experimental", "Emergente", "Madura"] },
    risk: { enum: ["Baixo", "Médio", "Alto"] },
    effort: { enum: ["Baixo", "Médio", "Alto"] },
    status: { enum: ["Monitorar", "Piloto recomendado", "Em piloto", "Padronizar", "Segurar"] },
    source: nonBlankText,
    theme: nonBlankText,
    strategic: nonBlankText,
    constraints: nonBlankText,
    detailsUrl: { type: "string", pattern: "^(?:$|[Hh][Tt][Tt][Pp][Ss]?://)" },
  });
  const fields = {
    reason: nonBlankText,
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidence: {
      type: "array",
      items: strictObject({ page: { type: "integer", minimum: 1 }, note: nonBlankText }),
    },
    blip,
  };
  assert.deepEqual(body, {
    model: "nvidia/nemotron-3.5-super-vl-120b-a12b",
    temperature: 0.2,
    max_tokens: 8192,
    reasoning_effort: "low",
    seed: 42,
    stream: false,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "radar_proposals",
        strict: true,
        schema: strictObject({
          proposals: {
            type: "array",
            maxItems: 5,
            items: {
              anyOf: [
                strictObject({ action: { enum: ["add"] }, targetId: { type: "null" }, ...fields }),
                strictObject({ action: { enum: ["update", "move"] }, targetId: nonBlankText, ...fields }),
              ],
            },
          },
        }),
      },
    },
  });
});

test("usa modelo configurado e endpoint injetado, sem ler endpoint do ambiente", async () => {
  let destination;
  let model;
  const endpoint = "https://example.org/chat";
  const nim = client(async (url, { body }) => {
    destination = url;
    ({ model } = JSON.parse(body));
    return completion('{"proposals":[]}');
  }, {
    endpoint,
    env: { NVIDIA_API_KEY: apiKey, NVIDIA_NIM_MODEL: "custom/model", NVIDIA_NIM_ENDPOINT: "invalid" },
  });
  assert.deepEqual(await nim.generateProposals(brief), { proposals: [] });
  assert.equal(destination, endpoint);
  assert.equal(model, "custom/model");
});

test("rejeita chave ausente ao criar o cliente", () => {
  assert.throws(() => client(() => assert.fail("nenhuma chamada esperada"), {
    env: { NVIDIA_API_KEY: "  " },
  }), errorCode("missing-key"));
});

test("aceita até cinco propostas, com alvo update reservado para validação posterior", async () => {
  const proposals = [
    ...Array(4).fill(proposal),
    { ...proposal, action: "update", targetId: "id-a-validar-no-core" },
  ];
  const nim = client(async () => completion(JSON.stringify({ proposals })));
  assert.deepEqual(await nim.generateProposals(brief), { proposals });
});

test("valida alvos e páginas contra o contexto do radar e do PDF", () => {
  const update = { ...proposal, action: "update", targetId: "ES-01" };
  assert.deepEqual(validateProposals({ proposals: [update] }, {
    totalPages: 3,
    targetIds: new Set(["ES-01"]),
  }), { proposals: [update] });
  assert.throws(() => validateProposals({ proposals: [{ ...update, targetId: "ES-02" }] }, {
    totalPages: 3,
    targetIds: new Set(["ES-01"]),
  }), errorCode("invalid-schema"));
  assert.throws(() => validateProposals({ proposals: [{
    ...update,
    evidence: [{ page: 4, note: "Página inexistente" }],
  }] }, {
    totalPages: 3,
    targetIds: new Set(["ES-01"]),
  }), errorCode("invalid-schema"));
});

for (const [label, payload] of [
  ["seis propostas", { proposals: Array(6).fill(proposal) }],
  ["metadados extras na resposta", { proposals: [], generatedAt: new Date(0).toISOString() }],
  ["alvo ausente", { proposals: [{ ...proposal, targetId: undefined }] }],
  ["alvo nulo para update", { proposals: [{ ...proposal, action: "update", targetId: null }] }],
  ["alvo vazio para move", { proposals: [{ ...proposal, action: "move", targetId: " " }] }],
  ["alvo informado para add", { proposals: [{ ...proposal, targetId: "ES-01" }] }],
  ["ação desconhecida", { proposals: [{ ...proposal, action: "delete" }] }],
  ["confiança fora do intervalo", { proposals: [{ ...proposal, confidence: 1.01 }] }],
  ["página fracionária", { proposals: [{ ...proposal, evidence: [{ page: 1.5, note: "trecho" }] }] }],
  ["chave extra na evidência", { proposals: [{ ...proposal, evidence: [{ page: 1, note: "trecho", url: "https://example.org" }] }] }],
  ["id em blip", { proposals: [{ ...proposal, blip: { ...proposal.blip, id: "ES-01" } }] }],
  ["blip incompleto", { proposals: [{ ...proposal, blip: { ...proposal.blip, source: undefined } }] }],
  ["enum inválido", { proposals: [{ ...proposal, blip: { ...proposal.blip, ring: "Maybe" } }] }],
  ["protocolo inseguro", { proposals: [{ ...proposal, blip: { ...proposal.blip, detailsUrl: "file:///secret" } }] }],
  ["URL HTTP inválida", { proposals: [{ ...proposal, blip: { ...proposal.blip, detailsUrl: "https://" } }] }],
]) {
  test(`rejeita ${label} como esquema inválido`, async () => {
    const nim = client(async () => completion(JSON.stringify(payload)));
    await assert.rejects(nim.generateProposals(brief), errorCode("invalid-schema"));
  });
}

for (const [label, reply] of [
  ["JSON HTTP malformado", () => new Response("upstream-only-content")],
  ["choices ausente", () => Response.json({ content: '{"proposals":[]}' })],
  ["content sem string", () => completion({ proposals: [] })],
  ["content JSON malformado", () => completion("upstream-only-content")],
  ["content cercado por Markdown", () => completion('```json\n{"proposals":[]}\n```')],
]) {
  test(`rejeita ${label} como resposta malformada`, async () => {
    await assert.rejects(client(reply).generateProposals(brief), errorCode("malformed-response"));
  });
}

for (const status of [202, 302, 429]) {
  test(`rejeita HTTP ${status} sem ler o corpo`, async () => {
    let canceled = false;
    const nim = client(async () => ({
      status,
      body: { async cancel() { canceled = true; } },
      text: async () => assert.fail("corpo HTTP não deve ser lido"),
    }));
    await assert.rejects(nim.generateProposals(brief), errorCode("http", status));
    assert.equal(canceled, true);
  });
}

test("converte falha de transporte em erro sem detalhes do upstream", async () => {
  const nim = client(async () => { throw new Error(`${brief} ${apiKey}`); });
  await assert.rejects(nim.generateProposals(brief), errorCode("transport"));
});

test("aplica o timeout padrão durante a leitura do corpo e aborta a chamada", async () => {
  let expire;
  let signal;
  let activeTimer;
  let startBodyRead;
  const readingBody = new Promise((resolve) => { startBodyRead = resolve; });
  const clock = {
    setTimeout(callback, ms) {
      assert.equal(ms, 60_000);
      expire = callback;
      activeTimer = Symbol("timer");
      return activeTimer;
    },
    clearTimeout(timer) {
      assert.equal(timer, activeTimer);
      activeTimer = undefined;
    },
  };
  const nim = client(async (url, init) => {
    ({ signal } = init);
    return {
      status: 200,
      text() {
        startBodyRead();
        return new Promise(() => {});
      },
    };
  }, { clock });
  const result = nim.generateProposals(brief);
  await readingBody;
  expire();
  await assert.rejects(result, errorCode("timeout"));
  assert.equal(signal.aborted, true);
  assert.equal(activeTimer, undefined);
});
