import { resolve } from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connectDatabase, disconnectDatabase } from "../src/db.js";
import type { AppConfig } from "../src/config.js";

export const config: AppConfig = {
  nodeEnv: "test",
  port: 3000,
  mongodbUri: "",
  jwtSecret: "isolated-test-secret-with-more-than-32-characters",
  corsOrigins: ["http://localhost:5173"],
};
let database: MongoMemoryServer;

export async function startDatabase() {
  process.env.MONGOMS_DOWNLOAD_DIR ??= resolve(
    "node_modules/.cache/mongodb-binaries",
  );
  database = await MongoMemoryServer.create({
    binary: { version: "8.0.17" },
    instance: {
      dbName: "e_pharmacy_isolated_test",
      args: ["--setParameter", "ttlMonitorEnabled=false"],
    },
  });
  config.mongodbUri = database.getUri();
  await connectDatabase(config.mongodbUri);
}

export async function stopDatabase() {
  await disconnectDatabase();
  await database?.stop();
}
