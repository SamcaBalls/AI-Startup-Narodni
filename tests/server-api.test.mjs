import test from "node:test";
import assert from "node:assert/strict";
import { createFirmGuardServer, loadSandboxDataset } from "../src/server-app.mjs";

const fixtures = {
  intents: [
    {
      id: "FIRMA-0002",
      forma: "s.r.o.",
      nazev: "Zamer 2 s.r.o.",
      predmet: "Provoz e-shopu",
      sidlo: { adresa: "Hlavni 181, Brno", obec: "Brno" },
      spolecnici: [{ typ: "PO", nazev: "Partner Holding 10 s.r.o.", ico: "21668732" }],
      predpokladany_obrat_rok: 4460716,
      plan_zamestnancu: 2,
      provozovna: null,
    },
  ],
  cases: [
    {
      id: "FIRMA-0002",
      predmet: "Provoz e-shopu",
      proc_zradne: "vysoky obrat a zamestnance",
      spravne_povinnosti: [
        "DATOVKA",
        "DPH",
        "DPPO",
        "OR_ZAPIS",
        "SIDLO_OZNACENI",
        "SKUTECNI_MAJITELE",
        "ZAM_CSSZ",
        "ZAM_ZP",
        "ZIVNOST_VOLNA",
      ],
      baseline_povinnosti: ["DATOVKA", "DPPO", "OR_ZAPIS", "ZIVNOST_VOLNA"],
    },
  ],
  classifications: {
    "Provoz e-shopu": "volna",
  },
  catalog: {
    OR_ZAPIS: "Zapis do obchodniho rejstriku",
    DPPO: "Registrace k dani z prijmu pravnickych osob",
    DATOVKA: "Zrizeni datove schranky",
    ZIVNOST_VOLNA: "Ohlaseni volne zivnosti",
    SIDLO_OZNACENI: "Oznaceni sidla firmy",
    SKUTECNI_MAJITELE: "Zapis do evidence skutecnych majitelu",
    DPH: "Registrace k DPH po prekroceni obratu",
    ZAM_CSSZ: "Prihlaseni zamestnavatele na CSSZ",
    ZAM_ZP: "Oznameni zdravotni pojistovne",
  },
  ares: {
    "21668732": { ico: "21668732", nazev: "Partner Holding 10 s.r.o.", aktivni: true },
  },
};

test("loadSandboxDataset includes the legal evidence catalog used by the audit trail", async () => {
  const dataset = await loadSandboxDataset(process.cwd());

  assert.equal(dataset.legalEvidence.DPH[0].actNumber, "235/2004 Sb.");
  assert.equal(dataset.legalEvidence.ZIVNOST_VOLNA[0].actNumber, "455/1991 Sb.");
  assert.match(dataset.legalEvidence.DPH[0].verificationNote, /overit aktualni zneni/i);
});

test("agent API runs the deterministic agent and returns tool log evidence", async () => {
  const server = createFirmGuardServer({ dataset: fixtures, root: process.cwd() });
  const port = await listen(server);

  try {
    const response = await jsonRequest(port, "/api/cases/FIRMA-0002/run-agent", { method: "POST" });

    assert.equal(response.status, 200);
    assert.equal(response.body.type, "agent");
    assert.equal(response.body.companyId, "FIRMA-0002");
    assert.deepEqual(response.body.metrics, { missedObligations: 0, extraObligations: 0, founderBurden: 0 });
    assert.ok(response.body.obligationCodes.includes("DPH"));
    assert.ok(response.body.toolCalls.some((call) => call.tool === "schedule"));
  } finally {
    await close(server);
  }
});

test("agent explain API uses the configured model provider and preserves fallback safety", async () => {
  const server = createFirmGuardServer({
    dataset: fixtures,
    root: process.cwd(),
    createProvider: () => ({
      mode: "ollama",
      model: "qwen3:14b",
      async explain(context) {
        return {
          answer: `Stub explanation for ${context.obligation.code}`,
          source: "ollama",
          model: "qwen3:14b",
        };
      },
    }),
  });
  const port = await listen(server);

  try {
    const response = await jsonRequest(port, "/api/agent/explain", {
      method: "POST",
      body: {
        question: "Proc DPH?",
        obligation: { code: "DPH", title: "Registrace k DPH", reason: "Odhad obratu prekrocil prah." },
        company: { nazev: { value: "Zamer 2 s.r.o." } },
      },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.answer, "Stub explanation for DPH");
    assert.equal(response.body.source, "ollama");
    assert.equal(response.body.model, "qwen3:14b");
    assert.match(response.body.warning, /podklad/i);
  } finally {
    await close(server);
  }
});

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server.address().port;
}

async function close(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function jsonRequest(port, path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body = await response.json();
  return { status: response.status, body };
}
