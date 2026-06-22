import intents from "../data/sandbox/zamery_firem.json";
import cases from "../data/sandbox/ukazkove_pripady.json";
import classifications from "../data/sandbox/klasifikace_zivnosti.json";
import catalog from "../data/sandbox/katalog_povinnosti.json";
import ares from "../data/sandbox/registr_ares.json";

// Sandbox dataset assembled from the JSON files in data/sandbox.
// normalizeDataset (domain.mjs) also accepts this raw shape directly.
export const dataset = {
  intents,
  cases,
  classifications,
  catalog,
  ares,
};
