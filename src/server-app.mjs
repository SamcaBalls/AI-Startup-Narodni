import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import {
  createAgentRun,
  createBaselineRun,
  createCompanyProfile,
  normalizeDataset,
  scoreBatch,
} from "./domain.mjs";
import { createModelProvider } from "./model-provider.mjs";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const SANDBOX_FILES = {
  intents: "zamery_firem.json",
  cases: "ukazkove_pripady.json",
  classifications: "klasifikace_zivnosti.json",
  catalog: "katalog_povinnosti.json",
  ares: "registr_ares.json",
  legalEvidence: "pravni_zdroje.json",
};

export async function loadSandboxDataset(root = process.cwd()) {
  const entries = await Promise.all(
    Object.entries(SANDBOX_FILES).map(async ([key, filename]) => {
      const filePath = resolve(root, "data", "sandbox", filename);
      return [key, JSON.parse(await readFile(filePath, "utf8"))];
    }),
  );

  return Object.fromEntries(entries);
}

export function createFirmGuardServer(options = {}) {
  const root = resolve(options.root ?? process.cwd());
  const datasetPromise = Promise.resolve(options.dataset ?? loadSandboxDataset(root)).then(normalizeDataset);
  const createProvider = options.createProvider ?? ((providerOptions) => createModelProvider(providerOptions));
  const env = options.env ?? process.env;

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

      if (url.pathname.startsWith("/api/")) {
        const dataset = await datasetPromise;
        await handleApi({ request, response, url, dataset, createProvider, env });
        return;
      }

      serveStatic({ response, url, root });
    } catch (error) {
      sendJson(response, 500, {
        error: "internal_error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

async function handleApi({ request, response, url, dataset, createProvider, env }) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      model: env.FIRMGUARD_MODEL ?? "qwen3:14b",
      modelMode: env.FIRMGUARD_MODEL_MODE ?? "ollama",
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/cases") {
    sendJson(
      response,
      200,
      dataset.cases.map((caseRecord) => ({
        id: caseRecord.id,
        predmet: caseRecord.predmet,
        proc_zradne: caseRecord.proc_zradne,
      })),
    );
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/batch/score") {
    sendJson(response, 200, scoreBatch(dataset));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/agent/explain") {
    const body = await readJsonBody(request);
    const provider = createProvider({
      mode: body.providerMode ?? body.mode ?? env.FIRMGUARD_MODEL_MODE ?? "ollama",
      endpoint: env.OLLAMA_HOST ?? env.OLLAMA_ENDPOINT ?? "http://localhost:11434",
      model: env.FIRMGUARD_MODEL ?? "qwen3:14b",
    });
    const explanation = await provider.explain(body);
    sendJson(response, 200, {
      ...explanation,
      warning: "Vystup je podklad ke schvaleni clovekem, ne zavazna pravni rada.",
    });
    return;
  }

  const caseMatch = url.pathname.match(/^\/api\/cases\/([^/]+)(?:\/([^/]+))?$/);
  if (caseMatch) {
    await handleCaseApi({ request, response, dataset, companyId: decodeURIComponent(caseMatch[1]), action: caseMatch[2] });
    return;
  }

  sendJson(response, 404, { error: "not_found" });
}

async function handleCaseApi({ request, response, dataset, companyId, action }) {
  const intent = dataset.intents.find((item) => item.id === companyId);
  const caseRecord = dataset.cases.find((item) => item.id === companyId);

  if (!intent) {
    sendJson(response, 404, { error: "unknown_company", companyId });
    return;
  }

  if (request.method === "GET" && !action) {
    sendJson(response, 200, {
      intent,
      case: caseRecord,
      profile: createCompanyProfile(companyId, dataset),
    });
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  const body = await readJsonBody(request);
  const runtimeDataset = body.profile ? applyProfile(dataset, companyId, body.profile) : dataset;

  if (action === "run-baseline") {
    sendJson(response, 200, createBaselineRun(companyId, runtimeDataset));
    return;
  }

  if (action === "run-agent") {
    sendJson(response, 200, createAgentRun(companyId, runtimeDataset));
    return;
  }

  if (action === "score") {
    sendJson(response, 200, {
      expected: caseRecord?.spravne_povinnosti ?? [],
      baseline: createBaselineRun(companyId, runtimeDataset),
      agent: createAgentRun(companyId, runtimeDataset),
    });
    return;
  }

  sendJson(response, 404, { error: "unknown_case_action", action });
}

function applyProfile(dataset, companyId, profile) {
  return {
    ...dataset,
    intents: dataset.intents.map((intent) => {
      if (intent.id !== companyId) return intent;

      return {
        ...intent,
        nazev: profileValue(profile.nazev, intent.nazev),
        predmet: profileValue(profile.predmet, intent.predmet),
        sidlo: {
          ...intent.sidlo,
          adresa: profileValue(profile.sidlo, intent.sidlo?.adresa ?? ""),
        },
        predpokladany_obrat_rok: Number(profileValue(profile.predpokladany_obrat_rok, intent.predpokladany_obrat_rok ?? 0)),
        plan_zamestnancu: Number(profileValue(profile.plan_zamestnancu, intent.plan_zamestnancu ?? 0)),
        provozovna: profileValue(profile.provozovna, Boolean(intent.provozovna))
          ? (intent.provozovna ?? { adresa: profileValue(profile.sidlo, intent.sidlo?.adresa ?? "") })
          : null,
      };
    }),
  };
}

function profileValue(field, fallback) {
  if (field && typeof field === "object" && "value" in field) return field.value;
  return field ?? fallback;
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function serveStatic({ response, url, root }) {
  const requestedPath = decodeURIComponent(url.pathname) === "/" ? "index.html" : decodeURIComponent(url.pathname).slice(1);
  const filePath = resolve(root, requestedPath);

  if (!isWithinRoot(filePath, root) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(filePath).pipe(response);
}

function isWithinRoot(filePath, root) {
  return filePath === root || filePath.startsWith(root.endsWith(sep) ? root : `${root}${sep}`);
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}
