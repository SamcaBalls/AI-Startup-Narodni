import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function createUiViteConfig(overrides = {}) {
  const { plugins = [], server = {}, ...rest } = overrides;

  return {
    root,
    configFile: false,
    plugins: [react(), ...plugins],
    server: {
      host: "127.0.0.1",
      port: 4173,
      ...server,
    },
    ...rest,
  };
}
