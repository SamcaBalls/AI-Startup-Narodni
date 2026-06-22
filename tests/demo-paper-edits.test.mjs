import test from "node:test";
import assert from "node:assert/strict";

import { DEMO_PAPER_EDIT_DELAY_MS, createDemoPaperEdit } from "../src/demo-paper-edits.mjs";
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
  assert.match(edit.body, /Vltava Market s\.r\.o\./);
  assert.match(edit.body, /Křižíkova 148\/34, 186 00 Praha 8 - Karlín/);
  assert.match(edit.body, /Provozování e-shopu s domácími potřebami/);
  assert.match(edit.body, /Článek I\./);
  assert.match(edit.body, /Základní kapitál společnosti činí 10 000 Kč/);
  assert.match(edit.body, /Navazující compliance plán: .*DPH/);
  assert.equal(edit.body.includes("[doplnit]"), false);
  assert.match(edit.answer, /Doplnil jsem společenskou smlouvu/);
});

test("demo workspace starts with a realistic company profile", async () => {
  const dataset = await loadSandboxDataset(process.cwd());
  const state = createInitialState(dataset);

  assert.equal(state.company.profile.nazev.value, "Vltava Market s.r.o.");
  assert.equal(state.company.profile.sidlo.value, "Křižíkova 148/34, 186 00 Praha 8 - Karlín");
  assert.equal(state.company.profile.predpokladany_obrat_rok.value, 4_850_000);
  assert.deepEqual(
    state.runtimeDataset.intents.find((item) => item.id === state.company.id).spolecnici.map((partner) => partner.jmeno),
    ["Jan Novák", "Eva Svobodová"],
  );
});

test("scripted paper edits wait long enough to look agent-driven", () => {
  assert.ok(DEMO_PAPER_EDIT_DELAY_MS >= 1200);
  assert.ok(DEMO_PAPER_EDIT_DELAY_MS <= 2500);
});
