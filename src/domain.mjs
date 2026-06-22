export const DPH_MODEL_THRESHOLD = 2_000_000;

export const DISPLAY_ORDER = [
  "DATOVKA",
  "DPH",
  "DPPO",
  "OR_ZAPIS",
  "PROVOZOVNA",
  "SIDLO_OZNACENI",
  "SKUTECNI_MAJITELE",
  "ZAM_CSSZ",
  "ZAM_ZP",
  "ZIVNOST_VOLNA",
  "ZIVNOST_VAZANA",
  "ZIVNOST_KONCESE",
];

const DEFAULT_BASELINE_CODES = ["DATOVKA", "DPPO", "OR_ZAPIS", "ZIVNOST_VOLNA"];

const TRADE_TYPE_TO_CODE = {
  volna: "ZIVNOST_VOLNA",
  vazana: "ZIVNOST_VAZANA",
  koncese: "ZIVNOST_KONCESE",
};

const TIMING_BY_CODE = {
  OR_ZAPIS: "pred_zalozenim",
  DPPO: "po_zalozeni",
  DATOVKA: "po_zalozeni",
  ZIVNOST_VOLNA: "pred_zalozenim",
  ZIVNOST_VAZANA: "pred_zalozenim",
  ZIVNOST_KONCESE: "pred_zalozenim",
  SIDLO_OZNACENI: "ted",
  SKUTECNI_MAJITELE: "po_zalozeni",
  DPH: "hlidat_v_case",
  ZAM_CSSZ: "po_zalozeni",
  ZAM_ZP: "po_zalozeni",
  PROVOZOVNA: "pred_zahajenim",
};

const SHORT_REASON_BY_CODE = {
  OR_ZAPIS: "s.r.o. vzniká zápisem do obchodního rejstříku.",
  DPPO: "Nová právnická osoba se musí přihlásit k dani z příjmů právnických osob.",
  DATOVKA: "Datová schránka vzniká pro právnickou osobu automaticky, ale firma ji musí převzít a používat.",
  SIDLO_OZNACENI: "Sídlo musí být viditelně označené, i když ho běžné zakládací formuláře často nezdůrazní.",
  SKUTECNI_MAJITELE: "Evidence skutečných majitelů je povinností s.r.o. bez ohledu na obor.",
  PROVOZOVNA: "Záměr obsahuje provozovnu, takže je potřeba ji ohlásit.",
  ZAM_CSSZ: "Firma plánuje zaměstnance, proto vzniká registrace zaměstnavatele na ČSSZ.",
  ZAM_ZP: "Firma plánuje zaměstnance, proto musí řešit oznámení vůči zdravotním pojišťovnám.",
  DPH: "Odhad obratu překračuje modelový demo práh, proto agent plánuje hlídání DPH v čase.",
  ZIVNOST_VOLNA: "Předmět podnikání spadá v sandbox klasifikaci do volné živnosti.",
  ZIVNOST_VAZANA: "Předmět podnikání je v sandbox klasifikaci regulovaný jako vázaná živnost.",
  ZIVNOST_KONCESE: "Předmět podnikání je v sandbox klasifikaci koncesovaný.",
};

const SOURCE_BY_CODE = {
  OR_ZAPIS: ["rule.always_for_sro", "intent.forma"],
  DPPO: ["rule.always_for_sro", "lookup_legislation:dppo"],
  DATOVKA: ["rule.always_for_sro", "lookup_legislation:datovka"],
  SIDLO_OZNACENI: ["intent.sidlo", "rule.hidden_obligation"],
  SKUTECNI_MAJITELE: ["intent.spolecnici", "rule.always_for_sro"],
  PROVOZOVNA: ["intent.provozovna", "rule.provozovna"],
  ZAM_CSSZ: ["intent.plan_zamestnancu", "rule.employees"],
  ZAM_ZP: ["intent.plan_zamestnancu", "rule.employees"],
  DPH: ["intent.predpokladany_obrat_rok", "rule.dph_threshold", "lookup_legislation:dph"],
  ZIVNOST_VOLNA: ["lookup_registry:zivnost", "klasifikace_zivnosti.json"],
  ZIVNOST_VAZANA: ["lookup_registry:zivnost", "klasifikace_zivnosti.json"],
  ZIVNOST_KONCESE: ["lookup_registry:zivnost", "klasifikace_zivnosti.json"],
};

export function normalizeDataset(dataset) {
  return {
    intents: dataset.intents ?? dataset.zamery ?? dataset.zamery_firem ?? [],
    cases: dataset.cases ?? dataset.ukazkove_pripady ?? [],
    classifications: dataset.classifications ?? dataset.klasifikace_zivnosti ?? {},
    catalog: dataset.catalog ?? dataset.katalog_povinnosti ?? {},
    ares: dataset.ares ?? dataset.registr_ares ?? {},
  };
}

export function createCompanyProfile(companyId, dataset) {
  const data = normalizeDataset(dataset);
  const intent = findIntent(companyId, data);

  return {
    nazev: field(intent.nazev, "zamer", true),
    obecne_zamereni: field(intent.predmet, "zamer", true),
    predmet: field(intent.predmet, "zamer", true),
    sidlo: field(intent.sidlo?.adresa ?? "", "zamer", true),
    kontaktni_email: field("", "uzivatel", false),
    preferovany_kanal: field("aplikace", "uzivatel", false),
    prvni_mesic_cinnosti: field("2026-07", "uzivatel", false),
    predpokladany_obrat_rok: field(intent.predpokladany_obrat_rok ?? 0, "zamer", true),
    plan_zamestnancu: field(intent.plan_zamestnancu ?? 0, "zamer", true),
    provozovna: field(Boolean(intent.provozovna), "zamer", true),
    ucetni_kontakt: field("", "uzivatel", false),
    souhlas_registry: field(true, "uzivatel", true),
  };
}

export function createBaselineRun(companyId, dataset) {
  const data = normalizeDataset(dataset);
  const caseRecord = findCase(companyId, data);
  const obligationCodes = orderCodes(caseRecord?.baseline_povinnosti ?? DEFAULT_BASELINE_CODES);

  return {
    type: "baseline",
    companyId,
    obligationCodes,
    obligations: obligationCodes.map((code) => createObligation(code, data.catalog, { baseline: true })),
    toolCalls: [
      {
        tool: "baseline_wizard",
        args: { id: companyId },
        resultSummary: "Jednoduchý průvodce vrací základní registrace a vždy volnou živnost.",
      },
    ],
    scheduled: [],
    founderQuestions: [],
    metrics: scoreCase(obligationCodes, caseRecord?.spravne_povinnosti),
    warnings: ["Baseline končí po založení a nehlídá skryté ani odložené povinnosti."],
  };
}

export function createAgentRun(companyId, dataset) {
  const data = normalizeDataset(dataset);
  const intent = findIntent(companyId, data);
  const caseRecord = findCase(companyId, data);
  const toolCalls = [];
  const scheduled = [];
  const founderQuestions = [];
  const codes = new Set(["DATOVKA", "DPPO", "OR_ZAPIS", "SIDLO_OZNACENI", "SKUTECNI_MAJITELE"]);

  toolCalls.push({
    tool: "get_intent",
    args: { id: companyId },
    resultSummary: `Načten záměr ${intent.nazev ?? companyId}.`,
    result: summarizeIntent(intent),
  });

  const tradeLookup = lookupTrade(intent.predmet, data.classifications);
  toolCalls.push({
    tool: "lookup_registry",
    args: { typ: "zivnost", klic: intent.predmet },
    resultSummary: tradeLookup
      ? `Předmět spadá do kategorie ${tradeLookup.typ_zivnosti}.`
      : "Předmět se nepodařilo zařadit bez lidské kontroly.",
    result: tradeLookup,
  });

  if (tradeLookup?.typ_zivnosti) {
    codes.add(TRADE_TYPE_TO_CODE[tradeLookup.typ_zivnosti]);
  } else {
    founderQuestions.push({
      id: companyId,
      field: "predmet",
      question: "Předmět podnikání není v sandbox klasifikaci. Potvrďte typ živnosti.",
      reason: "Tento údaj nejde v dostupném datasetu dohledat.",
    });
  }

  for (const partner of intent.spolecnici ?? []) {
    if (partner.typ === "PO" && partner.ico) {
      const result = data.ares[String(partner.ico)] ?? null;
      toolCalls.push({
        tool: "lookup_registry",
        args: { typ: "ares", klic: partner.ico },
        resultSummary: result ? `Ověřen společník ${result.nazev}.` : `Společník ${partner.ico} nebyl nalezen v ARES sandboxu.`,
        result,
      });
    }
  }

  if (intent.provozovna) {
    codes.add("PROVOZOVNA");
  }

  if ((intent.plan_zamestnancu ?? 0) > 0) {
    codes.add("ZAM_CSSZ");
    codes.add("ZAM_ZP");
  }

  if ((intent.predpokladany_obrat_rok ?? 0) >= DPH_MODEL_THRESHOLD) {
    codes.add("DPH");
    toolCalls.push({
      tool: "lookup_legislation",
      args: { tema: "dph" },
      resultSummary: "Placeholder: pro produkci ověřit aktuální zákonný práh a znění.",
      result: { tema: "dph", poznamka: "Sandbox používá modelový práh pro demo." },
    });

    const scheduleResult = {
      id: companyId,
      povinnost: "DPH",
      termin: "hlídat překročení obratu v čase",
    };
    scheduled.push(scheduleResult);
    toolCalls.push({
      tool: "schedule",
      args: { id: companyId, povinnost: "DPH", termin: scheduleResult.termin },
      resultSummary: "DPH přidána do časového hlídání.",
      result: scheduleResult,
    });
  }

  const obligationCodes = orderCodes([...codes]);
  const obligations = obligationCodes.map((code) =>
    createObligation(code, data.catalog, {
      scheduled: scheduled.some((item) => item.povinnost === code),
      status: scheduled.some((item) => item.povinnost === code) ? "naplanovano" : "ceka_na_schvaleni",
    }),
  );

  return {
    type: "agent",
    companyId,
    obligationCodes,
    obligations,
    toolCalls,
    scheduled,
    founderQuestions,
    metrics: {
      ...scoreCase(obligationCodes, caseRecord?.spravne_povinnosti),
      founderBurden: founderQuestions.length,
    },
    warnings: ["Výstup je ověřitelný podklad pro člověka, ne závazná právní rada."],
  };
}

export function scoreBatch(dataset) {
  const data = normalizeDataset(dataset);
  const baselineTotals = { missedObligations: 0, extraObligations: 0 };
  const agentTotals = { missedObligations: 0, extraObligations: 0, founderBurden: 0 };

  for (const caseRecord of data.cases) {
    const baseline = createBaselineRun(caseRecord.id, data).metrics;
    const agent = createAgentRun(caseRecord.id, data).metrics;

    baselineTotals.missedObligations += baseline.missedObligations;
    baselineTotals.extraObligations += baseline.extraObligations;
    agentTotals.missedObligations += agent.missedObligations;
    agentTotals.extraObligations += agent.extraObligations;
    agentTotals.founderBurden += agent.founderBurden;
  }

  return {
    cases: data.cases.length,
    baseline: baselineTotals,
    agent: agentTotals,
  };
}

export function createExplanation(obligation, run, profile) {
  const title = obligation?.title ?? obligation?.code ?? "Povinnost";
  const reason = obligation?.reason ?? "Agent ji odvodil z dostupných údajů.";
  const companyName = profile?.nazev?.value ?? run?.companyId ?? "firma";
  const sourceList = (obligation?.sources ?? []).join(", ");

  return `${title}: ${companyName} má tuto položku v plánu, protože ${lowerFirst(reason)} Zdroje: ${sourceList}. Před provedením ji musí potvrdit člověk.`;
}

export function compareCodes(actualCodes, expectedCodes = []) {
  const actual = new Set(actualCodes);
  const expected = new Set(expectedCodes);

  return {
    missed: [...expected].filter((code) => !actual.has(code)).sort(),
    extra: [...actual].filter((code) => !expected.has(code)).sort(),
  };
}

function findIntent(companyId, data) {
  const intent = data.intents.find((item) => item.id === companyId);
  if (!intent) {
    throw new Error(`Unknown company intent: ${companyId}`);
  }
  return intent;
}

function findCase(companyId, data) {
  return data.cases.find((item) => item.id === companyId) ?? null;
}

function field(value, source, required) {
  return { value, source, required };
}

function lookupTrade(predmet, classifications) {
  const typ = classifications[predmet];
  return typ ? { predmet, typ_zivnosti: typ } : null;
}

function createObligation(code, catalog, options = {}) {
  return {
    code,
    title: catalog[code] ?? code,
    status: options.status ?? (options.baseline ? "baseline" : "ceka_na_schvaleni"),
    timing: TIMING_BY_CODE[code] ?? "ted",
    reason: SHORT_REASON_BY_CODE[code] ?? "Povinnost vznikla z pravidel sandbox datasetu.",
    sources: SOURCE_BY_CODE[code] ?? ["rule.sandbox"],
    confidence: options.baseline ? "nizka" : "vysoka",
    requiresHumanApproval: !options.baseline,
    scheduled: Boolean(options.scheduled),
  };
}

function scoreCase(actualCodes, expectedCodes = []) {
  if (!expectedCodes.length) {
    return { missedObligations: 0, extraObligations: 0 };
  }

  const diff = compareCodes(actualCodes, expectedCodes);
  return {
    missedObligations: diff.missed.length,
    extraObligations: diff.extra.length,
  };
}

function orderCodes(codes) {
  return [...new Set(codes)].sort((a, b) => {
    const ai = DISPLAY_ORDER.indexOf(a);
    const bi = DISPLAY_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.localeCompare(b);
  });
}

function summarizeIntent(intent) {
  return {
    id: intent.id,
    predmet: intent.predmet,
    obrat: intent.predpokladany_obrat_rok,
    zamestnanci: intent.plan_zamestnancu,
    provozovna: Boolean(intent.provozovna),
  };
}

function lowerFirst(text) {
  return text ? text.charAt(0).toLocaleLowerCase("cs-CZ") + text.slice(1) : text;
}
