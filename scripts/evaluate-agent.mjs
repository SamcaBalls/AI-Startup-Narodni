import { compareCodes, createAgentRun, createBaselineRun, scoreBatch } from "../src/domain.mjs";
import { loadSandboxDataset } from "../src/server-app.mjs";

const root = process.cwd();
const asJson = process.argv.includes("--json");
const dataset = await loadSandboxDataset(root);
const batch = scoreBatch(dataset);
const cases = dataset.cases.map((caseRecord) => {
  const baseline = createBaselineRun(caseRecord.id, dataset);
  const agent = createAgentRun(caseRecord.id, dataset);

  return {
    id: caseRecord.id,
    predmet: caseRecord.predmet,
    baseline: {
      obligationCodes: baseline.obligationCodes,
      ...baseline.metrics,
      diff: compareCodes(baseline.obligationCodes, caseRecord.spravne_povinnosti),
    },
    agent: {
      obligationCodes: agent.obligationCodes,
      ...agent.metrics,
      diff: compareCodes(agent.obligationCodes, caseRecord.spravne_povinnosti),
    },
  };
});

const payload = { batch, cases };

if (asJson) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} else {
  printTextReport(payload);
}

function printTextReport(result) {
  process.stdout.write("FirmGuard sandbox evaluation\n");
  process.stdout.write(`Cases: ${result.batch.cases}\n\n`);
  process.stdout.write("Metric                  Baseline  Agent MVP\n");
  process.stdout.write(`Missed obligations      ${pad(result.batch.baseline.missedObligations)}${pad(result.batch.agent.missedObligations)}\n`);
  process.stdout.write(`Extra obligations       ${pad(result.batch.baseline.extraObligations)}${pad(result.batch.agent.extraObligations)}\n`);
  process.stdout.write(`Founder burden          ${pad("-")}${pad(result.batch.agent.founderBurden)}\n\n`);

  for (const caseResult of result.cases) {
    process.stdout.write(
      `${caseResult.id}: baseline ${caseResult.baseline.missedObligations}/${caseResult.baseline.extraObligations}, agent ${caseResult.agent.missedObligations}/${caseResult.agent.extraObligations}\n`,
    );
  }
}

function pad(value) {
  return String(value).padStart(10, " ");
}
