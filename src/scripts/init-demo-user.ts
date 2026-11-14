import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { loadConfig } from "../config.js";
import { demoIdentity, initializeDemoUser } from "../modules/auth/initialization.js";

try {
  if (process.platform !== "win32") throw new Error("Windows Credential Manager is required");
  const flags = process.argv.slice(2);
  if (
    flags.length !== 2 ||
    !flags.includes("--server-protection-verified") ||
    !flags.includes("--public-data-approved")
  )
    throw new Error("The deployment and public-data gates must be verified first");
  const config = loadConfig();
  await mongoose.connect(config.mongodbUri, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: false,
    autoCreate: false,
  });
  const database = mongoose.connection.name;
  const target = `E-Pharmacy/${database}/demo`;
  const result = await initializeDemoUser(
    (password) =>
      new Promise<void>((resolve, reject) => {
        const child = spawn(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-File",
            fileURLToPath(new URL("../../scripts/store-demo-credential.ps1", import.meta.url)),
          ],
          { stdio: ["pipe", "ignore", "ignore"], windowsHide: true },
        );
        child.once("error", () => reject(new Error("Secure credential storage failed")));
        child.stdin.on("error", () => reject(new Error("Secure credential storage failed")));
        child.once("close", (code) =>
          code === 0
            ? resolve()
            : reject(new Error("Secure credential storage refused the request")),
        );
        child.stdin.end(JSON.stringify({ target, username: demoIdentity.email, password }));
      }),
  );
  console.info(JSON.stringify({ ...result, credentialTarget: target, credentialsPrinted: false }));
} catch {
  console.error(
    "Demo initialization failed. Verify deployment/data gates, identity, database and existing vault entries. No credentials were printed; existing users and vault entries are never overwritten.",
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
