import { loadConfig } from "../config.js";
import { connectDatabase, disconnectDatabase } from "../db.js";
import { importSource } from "../import/source.js";
import { demoSourceLocation } from "../import/locations.js";

try {
  const config = loadConfig();
  await connectDatabase(config.mongodbUri);
  console.info(JSON.stringify(await importSource(new Date(), demoSourceLocation), null, 2));
} catch {
  console.error("Synthetic demo import failed. Verify database availability, demo hashes, and source-version isolation.");
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
