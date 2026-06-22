const DEFAULT_ENDPOINT = "http://localhost:11434";
const DEFAULT_MODEL = "qwen3:14b";

export function createModelProvider(options = {}) {
  const mode = options.mode ?? "mock";

  if (mode === "ollama") {
    return createOllamaProvider(options);
  }

  return {
    mode: "mock",
    async explain(context) {
      return fallbackExplanation(context);
    },
    async assist(context) {
      return fallbackAssist(context);
    },
  };
}

function createOllamaProvider(options) {
  const endpoint = trimTrailingSlash(options.endpoint ?? DEFAULT_ENDPOINT);
  const model = options.model ?? DEFAULT_MODEL;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  return {
    mode: "ollama",
    model,
    endpoint,
    explain(context) {
      return runGenerate({ fetchImpl, endpoint, model, context, buildPrompt: buildExplainPrompt, fallback: fallbackExplanation });
    },
    assist(context) {
      return runGenerate({ fetchImpl, endpoint, model, context, buildPrompt: buildAssistPrompt, fallback: fallbackAssist });
    },
  };
}

async function runGenerate({ fetchImpl, endpoint, model, context, buildPrompt, fallback }) {
  if (typeof fetchImpl !== "function") {
    return fallback(context, "fetch API není dostupné");
  }

  try {
    return await generateWithModel({ fetchImpl, endpoint, model, context, buildPrompt });
  } catch (error) {
    if (isMissingModel(error)) {
      const discoveredModel = await discoverQwenModel(fetchImpl, endpoint, model);
      if (discoveredModel && discoveredModel !== model) {
        try {
          return await generateWithModel({ fetchImpl, endpoint, model: discoveredModel, context, buildPrompt });
        } catch (retryError) {
          return fallback(context, retryError.message);
        }
      }
    }

    return fallback(context, error.message);
  }
}

async function generateWithModel({ fetchImpl, endpoint, model, context, buildPrompt }) {
  const response = await fetchImpl(`${endpoint}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      prompt: buildPrompt(context),
      options: {
        temperature: 0.15,
        top_p: 0.8,
      },
    }),
  });

  if (!response.ok) {
    const error = new Error(`Ollama HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  return {
    answer: parseOllamaResponse(payload.response),
    source: "ollama",
    model,
  };
}

async function discoverQwenModel(fetchImpl, endpoint, preferredModel) {
  try {
    const response = await fetchImpl(`${endpoint}/api/tags`);
    if (!response.ok) return "";

    const payload = await response.json();
    const models = Array.isArray(payload.models) ? payload.models : [];
    const exact = models.find((item) => item.name === preferredModel || item.model === preferredModel);
    if (exact) return exact.name ?? exact.model;

    const qwen14 = models.find((item) => isQwen3(item) && isFourteenB(item));
    if (qwen14) return qwen14.name ?? qwen14.model;

    const qwen = models.find(isQwen3);
    return qwen ? qwen.name ?? qwen.model : "";
  } catch {
    return "";
  }
}

function isMissingModel(error) {
  return error?.status === 404 || /model|not found|404/i.test(error?.message ?? "");
}

function isQwen3(item) {
  const haystack = [
    item.name,
    item.model,
    item.details?.family,
    ...(Array.isArray(item.details?.families) ? item.details.families : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes("qwen3");
}

function isFourteenB(item) {
  return String(item.details?.parameter_size ?? item.name ?? item.model ?? "").includes("14");
}

function buildExplainPrompt(context) {
  const obligation = context.obligation ?? {};
  const companyName = context.company?.nazev?.value ?? "vybraná firma";
  const question = context.question ?? "Vysvětli povinnost.";

  return [
    "Jsi lokální compliance agent pro demo založení s.r.o. v České republice.",
    "Nevydávej závaznou právní radu. Odpovídej stručně, česky a srozumitelně.",
    "Drž se pouze dodaného kódu povinnosti, důvodu z pravidel a právní demo opory. Nevymýšlej další právní výklady.",
    "Pokud je kód DPH, mluv výhradně o dani z přidané hodnoty a hlídání obratu.",
    "Odpověď má mít nejvýše dvě věty.",
    "Nepoužívej <think> bloky ani skryté úvahy.",
    "Vrať pouze validní JSON ve tvaru {\"answer\":\"...\"}.",
    `Firma: ${companyName}`,
    `Povinnost: ${obligation.code ?? "nezadaná"} - ${obligation.title ?? ""}`,
    `Důvod z pravidel: ${obligation.reason ?? ""}`,
    `Právní demo opora: ${formatLegalEvidence(obligation.legalEvidence)}`,
    `Otázka uživatele: ${question}`,
  ].join("\n");
}

function buildAssistPrompt(context) {
  const company = context.company ?? {};
  const document = context.document ?? {};
  const agentRun = context.agentRun ?? {};
  const companyName = company.nazev?.value ?? "vybraná firma";
  const sidlo = company.sidlo?.value ?? "";
  const predmet = company.predmet?.value ?? "";
  const question = context.question ?? "Pomoz mi s dokumentem.";

  return [
    "Jsi asistent pro veřejnou správu, který pomáhá firmě s úředními dokumenty.",
    "Pracuj s compliance plánem FirmGuard agenta, ale nevydávej závaznou právní radu.",
    "Odpovídej stručně, česky a srozumitelně. Vrať JSON ve tvaru {\"answer\":\"...\"}.",
    `Firma: ${companyName}${sidlo ? `, sídlo ${sidlo}` : ""}${predmet ? `, předmět ${predmet}` : ""}`,
    `Agentem nalezené povinnosti: ${formatObligationCodes(agentRun.obligationCodes)}`,
    `Skóre agenta: missed=${agentRun.metrics?.missedObligations ?? "n/a"}, extra=${agentRun.metrics?.extraObligations ?? "n/a"}`,
    `Dokument: ${document.title ?? "bez názvu"}`,
    `Obsah dokumentu:\n${(document.body ?? "").slice(0, 1500)}`,
    `Požadavek uživatele: ${question}`,
  ].join("\n");
}

function fallbackAssist(context, errorMessage = "") {
  const company = context.company ?? {};
  const document = context.document ?? {};
  const agentRun = context.agentRun ?? {};
  const companyName = company.nazev?.value ?? "vaše firma";
  const sidlo = company.sidlo?.value ?? "";
  const predmet = company.predmet?.value ?? "";
  const title = document.title ?? "dokument";
  const facts = [
    `firma ${companyName}`,
    sidlo ? `sídlo ${sidlo}` : "",
    predmet ? `předmět ${predmet}` : "",
    agentRun.obligationCodes?.length ? `povinnosti ${formatObligationCodes(agentRun.obligationCodes)}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const suffix = errorMessage
    ? ` Model zatím není připojen (${errorMessage}), proto běží šablonová odpověď.`
    : "";

  return {
    answer: `K dokumentu „${title}": pracuji s údaji a compliance plánem (${facts}). Návrh doplnění a úprav připravím jako podklad ke kontrole člověkem, ne jako závaznou právní radu.${suffix}`,
    source: "fallback-template",
    model: "none",
  };
}

function parseOllamaResponse(responseText) {
  if (!responseText) {
    throw new Error("Ollama vrátila prázdnou odpověď");
  }

  const cleaned = stripThinking(String(responseText)).trim();
  const candidates = [
    cleaned,
    unwrapMarkdownFence(cleaned),
    extractJsonObject(cleaned),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const answer = parseAnswer(candidate);
    if (answer) return answer;
  }

  if (cleaned) {
    return cleaned;
  }

  throw new Error("Ollama odpověď nemá pole answer");
}

function parseAnswer(value) {
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed.answer === "string" && parsed.answer.trim()) {
      return parsed.answer.trim();
    }
  } catch {
    return "";
  }

  return "";
}

function stripThinking(value) {
  return value.replace(/<think>[\s\S]*?<\/think>/gi, "");
}

function unwrapMarkdownFence(value) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fenced?.[1]?.trim() ?? "";
}

function extractJsonObject(value) {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  return start !== -1 && end > start ? value.slice(start, end + 1).trim() : "";
}

function fallbackExplanation(context, errorMessage = "") {
  const obligation = context.obligation ?? {};
  const companyName = context.company?.nazev?.value ?? "vybraná firma";
  const title = obligation.title ?? obligation.code ?? "Tato povinnost";
  const reason = obligation.reason ?? "vyplývá z deterministických pravidel sandbox datasetu.";
  const legal = formatLegalEvidence(obligation.legalEvidence);
  const suffix = errorMessage ? ` Model zatím není dostupný (${errorMessage}), proto běží šablonové vysvětlení.` : "";
  const legalSentence = legal ? ` Demo opora: ${legal}.` : "";

  return {
    answer: `${title}: u firmy ${companyName} ji agent navrhuje, protože ${lowerFirst(reason)}${legalSentence} Výstup je podklad ke schválení člověkem, ne závazná právní rada.${suffix}`,
    source: "fallback-template",
    model: "none",
  };
}

function formatObligationCodes(codes = []) {
  return codes.length ? codes.join(", ") : "nezjištěno";
}

function formatLegalEvidence(legalEvidence = []) {
  return legalEvidence
    .map((source) => `${source.actNumber} ${source.actName ?? ""}`.trim())
    .filter(Boolean)
    .join("; ");
}

function lowerFirst(text) {
  return text ? text.charAt(0).toLocaleLowerCase("cs-CZ") + text.slice(1) : text;
}

function trimTrailingSlash(value) {
  return value.replace(/\/$/, "");
}
