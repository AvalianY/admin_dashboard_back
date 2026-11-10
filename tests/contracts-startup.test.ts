import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { createServer, type AddressInfo } from "node:net";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import SwaggerParser from "@apidevtools/swagger-parser";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { FormatsPlugin } from "ajv-formats";
import { createApp } from "../src/app.js";
import { openapi } from "../src/openapi.js";
import { decimal } from "../src/shared/money.js";
import { initializeUser } from "../src/modules/auth/service.js";
import { Product } from "../src/modules/products/model.js";
import { Supplier } from "../src/modules/suppliers/model.js";
import { Customer } from "../src/modules/customers/model.js";
import { importSource } from "./source.js";
import { startDatabase, stopDatabase, config } from "./database.js";

const app = createApp(config);
const ajv = new Ajv2020({ strict: false, allErrors: true });
const addFormats = createRequire(import.meta.url)(
  "ajv-formats",
) as FormatsPlugin;
addFormats(ajv);
ajv.addFormat("decimal128", {
  type: "string",
  validate: (value) => {
    try {
      decimal(value, true);
      return true;
    } catch {
      return false;
    }
  },
});
ajv.addSchema(openapi, "urn:epharmacy:openapi");

beforeAll(async () => {
  await startDatabase();
  await initializeUser(
    "Contract Test",
    "contract@example.test",
    "isolated password",
  );
  await importSource();
});
afterAll(stopDatabase);

function validateBody(
  path: string,
  method: string,
  status: number,
  body: unknown,
) {
  const pointer = path.replaceAll("~", "~0").replaceAll("/", "~1");
  const validate = ajv.compile({
    $ref: `urn:epharmacy:openapi#/paths/${pointer}/${method}/responses/${status}/content/application~1json/schema`,
  });
  expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
}

describe("integration acceptance", () => {
  it("validates OpenAPI and the complete set of 15 approved operations", async () => {
    await expect(
      SwaggerParser.validate(JSON.parse(JSON.stringify(openapi))),
    ).resolves.toBeDefined();
    expect(
      Object.values(openapi.paths).flatMap((path) => Object.keys(path)),
    ).toHaveLength(15);
    const generated = JSON.parse(await readFile("docs/openapi.json", "utf8"));
    expect(generated).toEqual(JSON.parse(JSON.stringify(openapi)));
  });
  it("validates actual success/error HTTP responses against every response-bearing operation", async () => {
    const login = await request(app)
      .post("/api/user/login")
      .send({ email: "contract@example.test", password: "isolated password" });
    expect(login.status).toBe(200);
    validateBody("/api/user/login", "post", 200, login.body);
    const token = login.body.data.accessToken;
    for (const path of [
      "/api/user/user-info",
      "/api/dashboard",
      "/api/products",
      "/api/suppliers",
      "/api/customers",
      "/api/orders",
    ]) {
      const response = await request(app)
        .get(path)
        .auth(token, { type: "bearer" });
      expect(response.status).toBe(200);
      validateBody(path, "get", 200, response.body);
    }
    const customer = (await Customer.findOne())!;
    const details = await request(app)
      .get(`/api/customers/${customer.id}`)
      .auth(token, { type: "bearer" });
    validateBody("/api/customers/{customerId}", "get", 200, details.body);
    const patched = await request(app)
      .patch(`/api/customers/${customer.id}`)
      .auth(token, { type: "bearer" })
      .send({ country: "Confirmed fixture country" });
    validateBody("/api/customers/{customerId}", "patch", 200, patched.body);
    const productInput = {
      name: "Contract product",
      category: "Medicine",
      stock: 1,
      suppliers: "String",
      price: "1.50",
    };
    const product = await request(app)
      .post("/api/products")
      .auth(token, { type: "bearer" })
      .send(productInput);
    expect(product.status).toBe(201);
    validateBody("/api/products", "post", 201, product.body);
    const updated = await request(app)
      .put(`/api/products/${product.body.data.id}`)
      .auth(token, { type: "bearer" })
      .send({ ...productInput, stock: 2 });
    validateBody("/api/products/{productId}", "put", 200, updated.body);
    const supplierInput = {
      name: "Contract supplier",
      address: "Address",
      company: "Company",
      deliveryDate: "2026-11-09",
      amount: "12.50",
      status: "Active",
    };
    const supplier = await request(app)
      .post("/api/suppliers")
      .auth(token, { type: "bearer" })
      .send(supplierInput);
    validateBody("/api/suppliers", "post", 201, supplier.body);
    const supplierUpdated = await request(app)
      .put(`/api/suppliers/${supplier.body.data.id}`)
      .auth(token, { type: "bearer" })
      .send({ ...supplierInput, status: "Deactive" });
    validateBody(
      "/api/suppliers/{supplierId}",
      "put",
      200,
      supplierUpdated.body,
    );
    const deleted = await request(app)
      .delete(`/api/products/${product.body.data.id}`)
      .auth(token, { type: "bearer" });
    expect(deleted.status).toBe(204);
    expect(deleted.text).toBe("");
    const invalid = await request(app)
      .post("/api/products")
      .auth(token, { type: "bearer" })
      .send({ stock: -1 });
    expect(invalid.status).toBe(400);
    validateBody("/api/products", "post", 400, invalid.body);
    const unauthorized = await request(app).get("/api/dashboard");
    expect(unauthorized.status).toBe(401);
    validateBody("/api/dashboard", "get", 401, unauthorized.body);
    const absent = await request(app)
      .put("/api/suppliers/000000000000000000000000")
      .auth(token, { type: "bearer" })
      .send(supplierInput);
    expect(absent.status).toBe(404);
    validateBody("/api/suppliers/{supplierId}", "put", 404, absent.body);
    const logout = await request(app)
      .get("/api/user/logout")
      .auth(token, { type: "bearer" });
    expect(logout.status).toBe(204);
    expect(logout.text).toBe("");
  });
  it("sanitizes unexpected database failures", async () => {
    const token = (
      await request(app)
        .post("/api/user/login")
        .send({ email: "contract@example.test", password: "isolated password" })
    ).body.data.accessToken;
    const spy = vi.spyOn(Product, "find").mockImplementationOnce(() => {
      throw new Error("private database credentials must never be returned");
    });
    try {
      const result = await request(app)
        .get("/api/products")
        .query({ sortBy: "name" })
        .auth(token, { type: "bearer" });
      expect(result.status).toBe(500);
      expect(result.text).not.toContain("credentials");
      validateBody("/api/products", "get", 500, result.body);
    } finally {
      spy.mockRestore();
    }
  });
  it("starts the actual server entry point against an isolated database", async () => {
    await promisify(execFile)(
      process.execPath,
      ["node_modules/typescript/bin/tsc", "-p", "tsconfig.build.json"],
      { windowsHide: true },
    );
    const reservation = createServer();
    await new Promise<void>((resolve) =>
      reservation.listen(0, "127.0.0.1", resolve),
    );
    const port = (reservation.address() as AddressInfo).port;
    await new Promise<void>((resolve, reject) =>
      reservation.close((error) => (error ? reject(error) : resolve())),
    );
    const child = spawn(
      process.execPath,
      [
        "--env-file-if-exists=.env",
        "--input-type=module",
        "-e",
        `
          import { Server } from "node:net";
          const emit = Server.prototype.emit;
          Server.prototype.emit = function (event, ...args) {
            if (event === "listening") {
              console.info(JSON.stringify({ event: "listener_bound", address: this.address() }));
            }
            return emit.call(this, event, ...args);
          };
          await import("./dist/server.js");
        `,
      ],
      {
        windowsHide: true,
        env: {
          ...process.env,
          NODE_ENV: "test",
          PORT: String(port),
          MONGODB_URI: config.mongodbUri,
          JWT_SECRET: config.jwtSecret,
          CORS_ORIGINS: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const exited = new Promise<void>((resolve) =>
      child.once("exit", () => resolve()),
    );
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });
    try {
      let ready = false;
      for (
        let attempt = 0;
        attempt < 100 && child.exitCode === null;
        attempt++
      ) {
        try {
          const response = await fetch(
            `http://127.0.0.1:${port}/api/products`,
            { signal: AbortSignal.timeout(300) },
          );
          if (response.status === 401) {
            ready = true;
            break;
          }
        } catch {
          /* Wait for database connection and listener startup. */
        }
        await delay(50);
      }
      expect(ready, output).toBe(true);
      const binding = output.split(/\r?\n/).find((line) => line.includes('"listener_bound"'));
      expect(binding, output).toBeDefined();
      expect(JSON.parse(binding!).address).toMatchObject({
        address: "0.0.0.0",
        family: "IPv4",
        port,
      });
    } finally {
      child.kill();
      await exited;
    }
  });
  it("verifies every synthetic source file against its separate byte manifest", async () => {
    const manifest = JSON.parse(
      await readFile("data/demo/source-manifest.json", "utf8"),
    ) as { files: Record<string, { sha256: string; records: number }> };
    for (const [file, expected] of Object.entries(manifest.files)) {
      const buffer = await readFile(`data/demo/${file}`);
      expect(createHash("sha256").update(buffer).digest("hex")).toBe(
        expected.sha256,
      );
      expect(JSON.parse(buffer.toString("utf8"))).toHaveLength(
        expected.records,
      );
    }
    expect(Object.keys(manifest.files)).toHaveLength(5);
    expect(await Supplier.countDocuments({ legacyMoney: { $ne: null } })).toBe(
      5,
    );
  });
});
