import { createFirmGuardServer, loadSandboxDataset } from "./src/server-app.mjs";

const root = process.cwd();
const preferredPort = Number(process.env.PORT ?? 4173);
const quiet = process.argv.includes("--quiet") || process.env.FIRMGUARD_QUIET === "1";
const dataset = await loadSandboxDataset(root);

function listen(port) {
  const server = createFirmGuardServer({ root, dataset });
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && port < preferredPort + 10) {
      listen(port + 1);
      return;
    }
    throw error;
  });
  server.listen(port, "127.0.0.1", () => {
    if (!quiet) {
      console.log(`FirmGuard demo běží na http://127.0.0.1:${port}`);
    }
  });
}

listen(preferredPort);
