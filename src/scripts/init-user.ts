import { loadConfig } from "../config.js";
import { connectDatabase, disconnectDatabase } from "../db.js";
import { initializeUser } from "../modules/auth/service.js";

try {
  const config = loadConfig();
  const {
    INITIAL_USER_NAME: name,
    INITIAL_USER_EMAIL: email,
    INITIAL_USER_PASSWORD: password,
  } = process.env;
  if (!name || !email || !password)
    throw new Error("Initial account configuration is required");
  await connectDatabase(config.mongodbUri);
  await initializeUser(name, email, password);
  console.info("Initial account created.");
} catch {
  console.error(
    "Account initialization failed. Check configuration, database availability, and whether the account exists.",
  );
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
