import mongoose from "mongoose";
import { parseArgs } from "node:util";
import { loadConfig } from "../config.js";
import { assignAdministratorRole } from "../modules/auth/initialization.js";

try {
  const { values } = parseArgs({
    options: {
      id: { type: "string" },
      email: { type: "string" },
      apply: { type: "boolean", default: false },
    },
  });
  if (!values.id || !values.email) throw new Error("Exact reviewed identity is required");
  await mongoose.connect(loadConfig().mongodbUri, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: false,
    autoCreate: false,
  });
  console.info(
    JSON.stringify(await assignAdministratorRole(values.id, values.email, values.apply)),
  );
} catch {
  console.error(
    "Role migration refused or failed. Review the exact identity and current role. Credentials and sessions are not reset.",
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
