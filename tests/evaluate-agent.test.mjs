import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("evaluate-agent script scores the bundled six-case sandbox dataset", () => {
  const result = spawnSync(process.execPath, ["scripts/evaluate-agent.mjs", "--json"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.batch.cases, 6);
  assert.deepEqual(payload.batch.baseline, { missedObligations: 28, extraObligations: 2 });
  assert.deepEqual(payload.batch.agent, { missedObligations: 0, extraObligations: 0, founderBurden: 0 });
});
