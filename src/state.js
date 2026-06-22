import {
  createAgentRun,
  createBaselineRun,
  createCompanyProfile,
  scoreBatch,
} from "./domain.mjs";

// The app is a single logged-in company's workspace.
const COMPANY_ID = "FIRMA-0002";

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `p-${Math.random().toString(36).slice(2)}`;
}

function greeting(title) {
  return {
    role: "agent",
    text: `Otevřel jsem „${title}". Můžu ho upravit, doplnit z veřejně známých dat (ARES) nebo poradit. Vše je podklad ke kontrole člověkem, ne závazná právní rada.`,
  };
}

function seedPaper(title, body) {
  return { id: newId(), title, body, messages: [greeting(title)] };
}

const SEED_PAPERS = [
  seedPaper(
    "Společenská smlouva",
    [
      "SPOLEČENSKÁ SMLOUVA O ZALOŽENÍ SPOLEČNOSTI S RUČENÍM OMEZENÝM",
      "",
      "1. Obchodní firma: [doplnit]",
      "2. Sídlo: [doplnit]",
      "3. Předmět podnikání: [doplnit]",
      "4. Společníci a jejich vklady: [doplnit]",
      "5. Výše základního kapitálu: [doplnit]",
      "6. Jednatel: [doplnit]",
      "",
      "Pracovní návrh.",
    ].join("\n"),
  ),
  seedPaper(
    "Ohlášení živnosti",
    [
      "OHLÁŠENÍ ŽIVNOSTI",
      "",
      "Podnikatel: [doplnit]",
      "Předmět podnikání: [doplnit]",
      "Druh živnosti: [doplnit]",
      "Místo podnikání / provozovna: [doplnit]",
    ].join("\n"),
  ),
  seedPaper(
    "Přihláška k registraci k DPH",
    [
      "PŘIHLÁŠKA K REGISTRACI K DANI Z PŘIDANÉ HODNOTY",
      "",
      "Plátce: [doplnit]",
      "DIČ: [doplnit]",
      "Důvod registrace: [doplnit]",
      "Předpokládaný roční obrat: [doplnit]",
    ].join("\n"),
  ),
];

export function createInitialState(dataset) {
  const profile = createCompanyProfile(COMPANY_ID, dataset);
  const runtimeDataset = datasetWithProfile(dataset, COMPANY_ID, profile);

  return {
    dataset,
    runtimeDataset,
    company: {
      id: COMPANY_ID,
      profile,
    },
    baselineRun: createBaselineRun(COMPANY_ID, runtimeDataset),
    agentRun: createAgentRun(COMPANY_ID, runtimeDataset),
    batchScore: scoreBatch(dataset),
    papers: SEED_PAPERS,
    selectedPaperId: SEED_PAPERS[0].id,
    settingsOpen: false,
    providerMode: "mock",
  };
}

export function getSelectedPaper(state) {
  return state.papers.find((paper) => paper.id === state.selectedPaperId) ?? null;
}

function mapPaper(state, id, change) {
  return {
    ...state,
    papers: state.papers.map((paper) => (paper.id === id ? { ...paper, ...change(paper) } : paper)),
  };
}

export function reducer(state, action) {
  switch (action.type) {
    case "NEW_PAPER": {
      const paper = seedPaper("Nový papír", "");
      return { ...state, papers: [paper, ...state.papers], selectedPaperId: paper.id };
    }

    case "DELETE_PAPER": {
      const papers = state.papers.filter((paper) => paper.id !== action.id);
      const selectedPaperId =
        state.selectedPaperId === action.id ? (papers[0]?.id ?? null) : state.selectedPaperId;
      return { ...state, papers, selectedPaperId };
    }

    case "SELECT_PAPER":
      return { ...state, selectedPaperId: action.id };

    case "RENAME_PAPER":
      return mapPaper(state, action.id, () => ({ title: action.title }));

    case "EDIT_BODY":
      return mapPaper(state, action.id, () => ({ body: action.body }));

    case "PUSH_MESSAGE":
      return mapPaper(state, action.paperId, (paper) => ({
        messages: [...paper.messages, action.message],
      }));

    case "OPEN_SETTINGS":
      return { ...state, settingsOpen: true };

    case "CLOSE_SETTINGS":
      return { ...state, settingsOpen: false };

    case "UPDATE_PROFILE_FIELD": {
      const field = state.company.profile[action.key];
      if (!field) return state;
      const profile = {
        ...state.company.profile,
        [action.key]: { ...field, value: action.value, source: "uzivatel" },
      };
      const runtimeDataset = datasetWithProfile(state.dataset, state.company.id, profile);

      return {
        ...state,
        runtimeDataset,
        baselineRun: createBaselineRun(state.company.id, runtimeDataset),
        agentRun: createAgentRun(state.company.id, runtimeDataset),
        company: {
          ...state.company,
          profile,
        },
      };
    }

    case "SET_PROVIDER_MODE":
      return { ...state, providerMode: action.mode };

    default:
      return state;
  }
}

function datasetWithProfile(dataset, companyId, profile) {
  return {
    ...dataset,
    intents: dataset.intents.map((intent) => {
      if (intent.id !== companyId) return intent;

      return {
        ...intent,
        nazev: profile.nazev?.value ?? intent.nazev,
        predmet: profile.predmet?.value ?? intent.predmet,
        sidlo: {
          ...intent.sidlo,
          adresa: profile.sidlo?.value ?? intent.sidlo?.adresa ?? "",
        },
        predpokladany_obrat_rok: Number(profile.predpokladany_obrat_rok?.value ?? intent.predpokladany_obrat_rok ?? 0),
        plan_zamestnancu: Number(profile.plan_zamestnancu?.value ?? intent.plan_zamestnancu ?? 0),
        provozovna: profile.provozovna?.value ? (intent.provozovna ?? { adresa: profile.sidlo?.value ?? intent.sidlo?.adresa ?? "" }) : null,
      };
    }),
  };
}
