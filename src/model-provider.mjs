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

  async function runGenerate(context, buildPromptFn, fallbackFn) {
    if (typeof fetchImpl !== "function") {
      return fallbackFn(context, "fetch API není dostupné");
    }

    try {
      const response = await fetchImpl(`${endpoint}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          format: "json",
          prompt: buildPromptFn(context),
          options: {
            temperature: 0.15,
            top_p: 0.8,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama HTTP ${response.status}`);
      }

      const payload = await response.json();
      return { answer: parseOllamaResponse(payload.response), source: "ollama", model };
    } catch (error) {
      return fallbackFn(context, error.message);
    }
  }

  return {
    mode: "ollama",
    model,
    endpoint,
    explain(context) {
      return runGenerate(context, buildPrompt, fallbackExplanation);
    },
    assist(context) {
      return runGenerate(context, buildAssistPrompt, fallbackAssist);
    },
  };
}

function buildPrompt(context) {
  const obligation = context.obligation ?? {};
  const companyName = context.company?.nazev?.value ?? "vybraná firma";
  const question = context.question ?? "Vysvětli povinnost.";

  return [
    "Jsi lokální compliance agent pro demo založení s.r.o. v České republice.",
    "Nevydávej závaznou právní radu. Odpovídej stručně, česky a srozumitelně.",
    "Vrať JSON ve tvaru {\"answer\":\"...\"}.",
    `Firma: ${companyName}`,
    `Povinnost: ${obligation.code ?? "nezadaná"} - ${obligation.title ?? ""}`,
    `Důvod z pravidel: ${obligation.reason ?? ""}`,
    `Otázka uživatele: ${question}`,
  ].join("\n");
}

function buildAssistPrompt(context) {
  const company = context.company ?? {};
  const document = context.document ?? {};
  const companyName = company.nazev?.value ?? "vybraná firma";
  const sidlo = company.sidlo?.value ?? "";
  const predmet = company.predmet?.value ?? "";
  const question = context.question ?? "Pomoz mi s dokumentem.";

  return [
    "Jsi asistent pro veřejnou správu, který pomáhá firmě s úředními dokumenty (návrhy smluv, žádosti, ohlášení).",
    "Můžeš dokument upravit, doplnit z veřejně známých údajů firmy nebo poradit. Nevydávej závaznou právní radu.",
    "Odpovídej stručně, česky a srozumitelně. Vrať JSON ve tvaru {\"answer\":\"...\"}.",
    `Firma: ${companyName}${sidlo ? `, sídlo ${sidlo}` : ""}${predmet ? `, předmět ${predmet}` : ""}`,
    `Dokument: ${document.title ?? "bez názvu"}`,
    `Obsah dokumentu:\n${(document.body ?? "").slice(0, 1500)}`,
    `Požadavek uživatele: ${question}`,
  ].join("\n");
}

function fallbackAssist(context, errorMessage = "") {
  const company = context.company ?? {};
  const document = context.document ?? {};
  const companyName = company.nazev?.value ?? "vaše firma";
  const sidlo = company.sidlo?.value ?? "";
  const predmet = company.predmet?.value ?? "";
  const title = document.title ?? "dokument";
  const facts = [
    `firma ${companyName}`,
    sidlo ? `sídlo ${sidlo}` : "",
    predmet ? `předmět ${predmet}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const suffix = errorMessage
    ? ` Model zatím není připojen (${errorMessage}), proto běží šablonová odpověď.`
    : "";

  return {
    answer: `K dokumentu „${title}": pracuji s veřejně známými údaji (${facts}). Návrh doplnění a úprav připravím jako podklad ke kontrole člověkem, ne jako závaznou právní radu.${suffix}`,
    source: "fallback-template",
    model: "none",
  };
}

function parseOllamaResponse(responseText) {
  if (!responseText) {
    throw new Error("Ollama vrátila prázdnou odpověď");
  }

  try {
    const parsed = JSON.parse(responseText);
    if (typeof parsed.answer === "string" && parsed.answer.trim()) {
      return parsed.answer.trim();
    }
  } catch {
    if (typeof responseText === "string" && responseText.trim()) {
      return responseText.trim();
    }
  }

  throw new Error("Ollama odpověď nemá pole answer");
}

function fallbackExplanation(context, errorMessage = "") {
  const obligation = context.obligation ?? {};
  const companyName = context.company?.nazev?.value ?? "vybraná firma";
  const title = obligation.title ?? obligation.code ?? "Tato povinnost";
  const reason = obligation.reason ?? "vyplývá z deterministických pravidel sandbox datasetu.";
  const suffix = errorMessage ? ` Model zatím není dostupný (${errorMessage}), proto běží šablonové vysvětlení.` : "";

  return {
    answer: `${title}: u firmy ${companyName} ji agent navrhuje, protože ${lowerFirst(reason)} Výstup je podklad ke schválení člověkem, ne závazná právní rada.${suffix}`,
    source: "fallback-template",
    model: "none",
  };
}

function lowerFirst(text) {
  return text ? text.charAt(0).toLocaleLowerCase("cs-CZ") + text.slice(1) : text;
}

function trimTrailingSlash(value) {
  return value.replace(/\/$/, "");
}
