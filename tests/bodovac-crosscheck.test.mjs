import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { createAgentRun } from "../src/domain.mjs";
import { loadSandboxDataset } from "../src/server-app.mjs";

test("agent score is cross-checked by the provided Python bodovac.py scorer", async () => {
  const dataset = await loadSandboxDataset(process.cwd());
  const choices = Object.fromEntries(
    dataset.cases.map((caseRecord) => [caseRecord.id, createAgentRun(caseRecord.id, dataset).obligationCodes]),
  );
  const python = findPython();

  assert.ok(python, "Python runtime is required for bodovac.py cross-check");
  assert.ok(existsSync("data/sandbox/bodovac.py"), "data/sandbox/bodovac.py must be bundled with the sandbox dataset");

  const result = spawnSync(
    python,
    [
      "-c",
      [
        "import importlib.util, json, pathlib, sys",
        "module_path = pathlib.Path('data/sandbox/bodovac.py').resolve()",
        "spec = importlib.util.spec_from_file_location('bodovac', module_path)",
        "bodovac = importlib.util.module_from_spec(spec)",
        "spec.loader.exec_module(bodovac)",
        "score = bodovac.vyhodnot(json.loads(sys.stdin.read()))",
        "print('JSON_RESULT=' + json.dumps(score))",
      ].join("; "),
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      input: JSON.stringify(choices),
    },
  );

  assert.equal(result.status, 0, result.stderr);

  const jsonLine = result.stdout
    .split(/\r?\n/)
    .find((line) => line.startsWith("JSON_RESULT="));
  assert.ok(jsonLine, result.stdout);

  const score = JSON.parse(jsonLine.replace("JSON_RESULT=", ""));
  assert.deepEqual(score.baseline, [28, 2]);
  assert.deepEqual(score.vase, [0, 0]);
});

function findPython() {
  const candidates = [
    process.env.FIRMGUARD_PYTHON,
    join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "python.exe"),
    "python",
    "py",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (result.status === 0) return candidate;
  }

  return "";
}
