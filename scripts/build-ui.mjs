import { build } from "vite";
import { createUiViteConfig } from "./ui-vite-config.mjs";

await build(createUiViteConfig());
