import test from "node:test";
import assert from "node:assert/strict";

import { createUiViteConfig } from "../scripts/ui-vite-config.mjs";

test("UI Vite config enables the React JSX runtime", () => {
  const config = createUiViteConfig();
  const pluginNames = config.plugins.flat().map((plugin) => plugin.name);

  assert.equal(config.configFile, false);
  assert.ok(pluginNames.includes("vite:react-babel"));
  assert.ok(pluginNames.includes("vite:react-refresh"));
});
