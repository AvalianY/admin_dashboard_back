import { mkdir, writeFile } from "node:fs/promises";
import { openapi } from "../openapi.js";

await mkdir("docs", { recursive: true });
await writeFile("docs/openapi.json", `${JSON.stringify(openapi, null, 2)}\n`);
