import { loadConfig } from "../config.js";
import { connectDatabase, disconnectDatabase } from "../db.js";
import { importSource } from "../import/source.js";

try {
  const config = loadConfig();
  await connectDatabase(config.mongodbUri);
  console.info(JSON.stringify(await importSource(), null, 2));
} catch {
  console.error(
    "Private source import failed. Verify SOURCE_DATA_DIR, database availability, approved source hashes, and version compatibility.",
  );
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
