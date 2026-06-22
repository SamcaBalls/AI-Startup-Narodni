import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dataDir = join(process.cwd(), "data", "sandbox");

const files = {
  intents: "zamery_firem.json",
  cases: "ukazkove_pripady.json",
  classifications: "klasifikace_zivnosti.json",
  catalog: "katalog_povinnosti.json",
  ares: "registr_ares.json",
};

const payload = {};
for (const [key, fileName] of Object.entries(files)) {
  payload[key] = JSON.parse(await readFile(join(dataDir, fileName), "utf8"));
}

const output = `window.FIRMGUARD_DATA = ${JSON.stringify(payload, null, 2)};\n`;
await writeFile(join(dataDir, "embedded-data.js"), output, "utf8");
console.log("Generated data/sandbox/embedded-data.js");
