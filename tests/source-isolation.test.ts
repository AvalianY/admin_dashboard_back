import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { demoSourceLocation, originalSourceLocation } from "../src/import/locations.js";
import { importSource as importDataset, prepareSource as prepareDataset } from "../src/import/source.js";
import { Product } from "../src/modules/products/model.js";
import { Supplier } from "../src/modules/suppliers/model.js";
import { Customer } from "../src/modules/customers/model.js";
import { Order } from "../src/modules/orders/model.js";
import { Transaction } from "../src/modules/transactions/model.js";
import { importSource, prepareSource } from "./source.js";
import { startDatabase, stopDatabase, config } from "./database.js";

const execute = promisify(execFile);
const models = [Product, Supplier, Customer, Order, Transaction];
const files = ["products.json", "suppliers.json", "customers.json", "orders.json", "Income-Expenses.json"];
let temporary: string;
const generated = () => ({
  directory: join(temporary, "data", "demo"),
  manifestPath: join(temporary, "data", "demo", "source-manifest.json"),
});
beforeAll(async () => {
  await startDatabase();
  temporary = await mkdtemp(join(tmpdir(), "epharmacy-source-"));
  await mkdir(join(temporary, "scripts"));
  await copyFile("scripts/generate-demo.mjs", join(temporary, "scripts", "generate-demo.mjs"));
  await execute(process.execPath, [join(temporary, "scripts", "generate-demo.mjs")], { windowsHide: true });
});
beforeEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(models.map((model) => model.collection.deleteMany({})));
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await stopDatabase();
  if (temporary) {
    if (dirname(resolve(temporary)) !== resolve(tmpdir()) || !basename(temporary).startsWith("epharmacy-source-"))
      throw new Error("Unexpected temporary cleanup target");
    await rm(temporary, { recursive: true, force: true });
  }
});

describe("public and private source isolation", () => {
  it("uses clearly synthetic identities, reserved hosts and a separate source version", async () => {
    const source = await prepareSource();
    expect(source.version.startsWith("demo-v1:")).toBe(true);
    expect(source.batches.map((batch) => batch.documents.length)).toEqual([60, 5, 88, 25, 12]);
    const customers = JSON.parse(await readFile(join(demoSourceLocation.directory, "customers.json"), "utf8")) as Record<string, string>[];
    for (const customer of customers) {
      expect(customer.name).toMatch(/^Demo Customer \d{3}$/);
      expect(customer.email).toMatch(/^customer\d{3}@example\.test$/);
      expect(customer.phone).toMatch(/^TEST-PHONE-\d{3}$/);
      expect(customer.address).toMatch(/^Fictional Customer Address \d{3} \(TEST ONLY\)$/);
      expect(new URL(customer.photo ?? customer.image).hostname).toBe("assets.example.test");
    }
    const manifest = JSON.parse(await readFile(demoSourceLocation.manifestPath, "utf8"));
    expect(manifest.kind).toBe("synthetic");
    expect(manifest.versionPrefix).toBe("demo-v1");
    expect(manifest.archiveSha256).toBeUndefined();
  });
  it("reproduces every committed fixture byte without reading original files", async () => {
    for (const file of [...files, "source-manifest.json"]) {
      const committed = await readFile(join(demoSourceLocation.directory, file));
      const regenerated = await readFile(join(generated().directory, file));
      expect(committed.equals(regenerated), file).toBe(true);
    }
  });
  it("supports SOURCE_DATA_DIR without weakening the selected manifest", async () => {
    vi.stubEnv("SOURCE_DATA_DIR", generated().directory);
    expect(originalSourceLocation().directory).toBe(generated().directory);
    const selected = { ...originalSourceLocation(), manifestPath: generated().manifestPath };
    expect((await prepareDataset(new Date(), selected)).version).toMatch(/^demo-v1:/);
    await expect(prepareDataset()).rejects.toThrow("Unapproved source modification");
  });
  it("never falls back to private data when public tests have a private environment setting", async () => {
    vi.stubEnv("SOURCE_DATA_DIR", join(temporary, "missing-private-source"));
    expect((await importSource()).results.map((row) => row.count)).toEqual([60, 5, 88, 25, 12]);
  });
  it("rejects modified fixture bytes before inserting any records", async () => {
    const path = join(generated().directory, "products.json");
    const original = await readFile(path);
    await writeFile(path, Buffer.concat([original, Buffer.from("\n")]));
    try {
      await expect(importDataset(new Date(), generated())).rejects.toThrow("Unapproved source modification");
      expect(await Product.countDocuments()).toBe(0);
    } finally {
      await writeFile(path, original);
    }
  });
  it("refuses to mix separately manifested source versions", async () => {
    await importSource();
    const original = await readFile(generated().manifestPath);
    const manifest = JSON.parse(original.toString("utf8"));
    manifest.versionPrefix = "another-synthetic-version";
    await writeFile(generated().manifestPath, JSON.stringify(manifest));
    try {
      await expect(importDataset(new Date(), generated())).rejects.toThrow("explicit migration");
      expect(await Product.countDocuments()).toBe(60);
      expect(await Product.countDocuments({ "provenance.version": /^demo-v1:/ })).toBe(60);
    } finally {
      await writeFile(generated().manifestPath, original);
    }
  });
  it("fails the private CLI clearly when original files are unavailable, without demo fallback", async () => {
    let exitCode: number | undefined;
    let diagnostics = "";
    try {
      await execute(process.execPath, ["--import", "tsx", "src/scripts/seed.ts"], {
        windowsHide: true,
        env: { ...process.env, NODE_ENV: "test", PORT: "3000", CORS_ORIGINS: "", MONGODB_URI: config.mongodbUri, JWT_SECRET: config.jwtSecret, SOURCE_DATA_DIR: join(temporary, "missing-private-source") },
      });
    } catch (error) {
      const failure = error as { code: number; stderr: string };
      exitCode = failure.code;
      diagnostics = failure.stderr;
    }
    expect(exitCode).toBe(1);
    expect(diagnostics).toContain("Private source import failed");
    expect(diagnostics).not.toContain(config.mongodbUri);
    expect(await Product.countDocuments()).toBe(0);
  });
  it("runs the explicit demo CLI idempotently without private originals", async () => {
    const options = {
      windowsHide: true,
      env: { ...process.env, NODE_ENV: "test", PORT: "3000", CORS_ORIGINS: "", MONGODB_URI: config.mongodbUri, JWT_SECRET: config.jwtSecret, SOURCE_DATA_DIR: join(temporary, "missing-private-source") },
    };
    for (const inserted of [190, 0]) {
      const result = await execute(process.execPath, ["--import", "tsx", "src/scripts/seed-demo.ts"], options);
      const report = JSON.parse(result.stdout);
      expect(report.version).toMatch(/^demo-v1:/);
      expect(report.results.map((row: { count: number }) => row.count)).toEqual([60, 5, 88, 25, 12]);
      expect(report.results.reduce((total: number, row: { inserted: number }) => total + row.inserted, 0)).toBe(inserted);
    }
    expect(await Product.countDocuments()).toBe(60);
  });
});
