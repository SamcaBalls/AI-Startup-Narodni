import test from "node:test";
import assert from "node:assert/strict";
import {
  createAgentRun,
  createBaselineRun,
  createCompanyProfile,
  scoreBatch,
} from "../src/domain.mjs";

const fixtures = {
  intents: [
    {
      id: "FIRMA-0001",
      forma: "s.r.o.",
      nazev: "Zamer 1 s.r.o.",
      predmet: "Ucetnictvi a danove poradenstvi",
      sidlo: { adresa: "Hlavni 92, Ceske Budejovice", obec: "Ceske Budejovice" },
      spolecnici: [{ typ: "PO", nazev: "Partner Holding 7 s.r.o.", ico: "28728463" }],
      predpokladany_obrat_rok: 531148,
      plan_zamestnancu: 0,
      provozovna: { adresa: "Provozni 49, Brno" },
    },
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
      id: "FIRMA-0001",
      spravne_povinnosti: [
        "DATOVKA",
        "DPPO",
        "OR_ZAPIS",
        "PROVOZOVNA",
        "SIDLO_OZNACENI",
        "SKUTECNI_MAJITELE",
        "ZIVNOST_VAZANA",
      ],
      baseline_povinnosti: ["DATOVKA", "DPPO", "OR_ZAPIS", "ZIVNOST_VOLNA"],
    },
    {
      id: "FIRMA-0002",
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
    "Ucetnictvi a danove poradenstvi": "vazana",
    "Provoz e-shopu": "volna",
  },
  catalog: {
    OR_ZAPIS: "Zapis do obchodniho rejstriku",
    DPPO: "Registrace k dani z prijmu pravnickych osob",
    DATOVKA: "Zrizeni datove schranky (automaticky)",
    ZIVNOST_VOLNA: "Ohlaseni volne zivnosti",
    ZIVNOST_VAZANA: "Vazana zivnost (odborna zpusobilost)",
    SIDLO_OZNACENI: "Oznaceni sidla firmy",
    SKUTECNI_MAJITELE: "Zapis do evidence skutecnych majitelu",
    DPH: "Registrace k DPH po prekroceni obratu",
    ZAM_CSSZ: "Prihlaseni zamestnavatele na CSSZ",
    ZAM_ZP: "Oznameni zdravotni pojistovne",
    PROVOZOVNA: "Ohlaseni provozovny",
  },
  ares: {
    "28728463": { ico: "28728463", nazev: "Partner Holding 7 s.r.o.", aktivni: true },
    "21668732": { ico: "21668732", nazev: "Partner Holding 10 s.r.o.", aktivni: true },
  },
};

test("createBaselineRun returns the simple wizard obligations from the labelled case", () => {
  const result = createBaselineRun("FIRMA-0002", fixtures);

  assert.deepEqual(result.obligationCodes, ["DATOVKA", "DPPO", "OR_ZAPIS", "ZIVNOST_VOLNA"]);
  assert.equal(result.metrics.missedObligations, 5);
  assert.equal(result.metrics.extraObligations, 0);
});

test("createAgentRun derives hidden and delayed obligations for the e-shop case", () => {
  const result = createAgentRun("FIRMA-0002", fixtures);

  assert.deepEqual(result.obligationCodes, [
    "DATOVKA",
    "DPH",
    "DPPO",
    "OR_ZAPIS",
    "SIDLO_OZNACENI",
    "SKUTECNI_MAJITELE",
    "ZAM_CSSZ",
    "ZAM_ZP",
    "ZIVNOST_VOLNA",
  ]);
  assert.equal(result.metrics.missedObligations, 0);
  assert.equal(result.metrics.extraObligations, 0);
  assert.equal(result.metrics.founderBurden, 0);
  assert.equal(result.scheduled[0].povinnost, "DPH");
  assert.deepEqual(
    result.toolCalls.map((call) => call.tool),
    ["get_intent", "lookup_registry", "lookup_registry", "lookup_legislation", "schedule"],
  );
});

test("createAgentRun classifies accounting as a regulated trade and avoids the free trade false positive", () => {
  const result = createAgentRun("FIRMA-0001", fixtures);

  assert.ok(result.obligationCodes.includes("ZIVNOST_VAZANA"));
  assert.ok(result.obligationCodes.includes("PROVOZOVNA"));
  assert.equal(result.obligationCodes.includes("ZIVNOST_VOLNA"), false);
  assert.equal(result.metrics.missedObligations, 0);
  assert.equal(result.metrics.extraObligations, 0);
});

test("scoreBatch reports the baseline gap and the deterministic agent score", () => {
  const result = scoreBatch(fixtures);

  assert.deepEqual(result.baseline, { missedObligations: 9, extraObligations: 1 });
  assert.deepEqual(result.agent, { missedObligations: 0, extraObligations: 0, founderBurden: 0 });
});

test("createCompanyProfile exposes editable Settings > O firme fields with source labels", () => {
  const result = createCompanyProfile("FIRMA-0002", fixtures);

  assert.equal(result.nazev.value, "Zamer 2 s.r.o.");
  assert.equal(result.predmet.source, "zamer");
  assert.equal(result.souhlas_registry.value, true);
  assert.equal(result.plan_zamestnancu.value, 2);
});
