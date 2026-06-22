import { createServer } from "vite";
import { createUiViteConfig } from "./ui-vite-config.mjs";

const server = await createServer(createUiViteConfig());

await server.listen();
server.printUrls();
