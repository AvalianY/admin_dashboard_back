import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { connectDatabase, disconnectDatabase } from "./db.js";

async function main() {
  const config = loadConfig();
  await connectDatabase(config.mongodbUri);
  const server = createApp(config).listen(config.port, "0.0.0.0", () => {
    console.info(`E-Pharmacy API listening on port ${config.port}`);
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    server.close(() => {
      void disconnectDatabase().then(() => {
        process.exitCode = 0;
      });
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(() => {
  console.error(
    "Application startup failed. Verify environment configuration and database availability.",
  );
  process.exitCode = 1;
});
