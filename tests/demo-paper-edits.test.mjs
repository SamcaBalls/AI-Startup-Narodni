import test from "node:test";
import assert from "node:assert/strict";

import { createDemoPaperEdit } from "../src/demo-paper-edits.mjs";
import { loadSandboxDataset } from "../src/server-app.mjs";
import { createInitialState, getSelectedPaper } from "../src/state.js";

test("demo ARES request edits the selected founding contract", async () => {
  const dataset = await loadSandboxDataset(process.cwd());
  const state = createInitialState(dataset);
  const paper = getSelectedPaper(state);
  const intent = state.runtimeDataset.intents.find((item) => item.id === state.company.id);

  const edit = createDemoPaperEdit({
    question: "Doplň prosím do dokumentu údaje z veřejně známých rejstříků (ARES).",
    document: paper,
    company: state.company.profile,
    intent,
    agentRun: state.agentRun,
  });

  assert.ok(edit);
  assert.match(edit.body, /Obchodní firma: Zamer 2 s\.r\.o\./);
  assert.match(edit.body, /Sídlo: Hlavni 181, Brno/);
  assert.match(edit.body, /Předmět podnikání: Provoz e-shopu/);
  assert.match(edit.body, /Navazující compliance plán: .*DPH/);
  assert.equal(edit.body.includes("[doplnit]"), false);
  assert.match(edit.answer, /Doplnil jsem společenskou smlouvu/);
});
