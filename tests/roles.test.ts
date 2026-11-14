import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { decodeJwt } from "jose";
import { createApp } from "../src/app.js";
import { User, Session } from "../src/modules/auth/models.js";
import { initializeUser } from "../src/modules/auth/service.js";
import {
  assignAdministratorRole,
  demoIdentity,
  initializeDemoUser,
} from "../src/modules/auth/initialization.js";
import { hashPassword } from "../src/modules/auth/password.js";
import { Product } from "../src/modules/products/model.js";
import { Supplier } from "../src/modules/suppliers/model.js";
import { Customer } from "../src/modules/customers/model.js";
import { importSource } from "./source.js";
import { config, startDatabase, stopDatabase } from "./database.js";

let now = new Date("2030-01-01T00:00:00Z");
const app = createApp(config, () => now);
const password = "isolated role test password";
let adminToken: string,
  demoToken: string,
  productId: string,
  supplierId: string,
  customerId: string;
async function signIn(email: string, secret = password) {
  const result = await request(app).post("/api/user/login").send({ email, password: secret });
  expect(result.status).toBe(200);
  return result.body.data;
}
async function domainSnapshot() {
  const hash = createHash("sha256");
  for (const collection of [
    "products",
    "suppliers",
    "customers",
    "orders",
    "financialtransactions",
  ])
    for (const row of await mongoose.connection
      .db!.collection(collection)
      .find()
      .sort({ _id: 1 })
      .toArray())
      hash.update(mongoose.mongo.BSON.serialize(row));
  return hash.digest("hex");
}
beforeAll(async () => {
  await startDatabase();
  await importSource();
  await initializeUser("Administrator", "roles-admin@example.test", password);
  await initializeUser(demoIdentity.name, demoIdentity.email, password, "demo");
  adminToken = (await signIn("roles-admin@example.test")).accessToken;
  demoToken = (await signIn(demoIdentity.email)).accessToken;
  productId = (await Product.findOne())!.id;
  supplierId = (await Supplier.findOne())!.id;
  customerId = (await Customer.findOne())!.id;
});
afterAll(stopDatabase);

describe("server-owned roles on the existing JWT/session mechanism", () => {
  it("returns both roles through Login/User Info without putting permissions into JWT", async () => {
    for (const [email, role] of [
      ["roles-admin@example.test", "admin"],
      [demoIdentity.email, "demo"],
    ]) {
      const session = await signIn(email);
      expect(session.user.role).toBe(role);
      expect(decodeJwt(session.accessToken)).not.toHaveProperty("role");
      const profile = await request(app)
        .get("/api/user/user-info")
        .auth(session.accessToken, { type: "bearer" });
      expect(profile.status).toBe(200);
      expect(profile.body.data.role).toBe(role);
    }
  });
  it.each([
    "/api/dashboard",
    "/api/products?name=Example&sortBy=name&sortOrder=asc",
    "/api/suppliers?name=Example",
    "/api/customers?page=1&limit=5",
    "/api/orders?sortBy=price&sortOrder=desc",
  ])("allows demo GET %s", async (path) => {
    expect((await request(app).get(path).auth(demoToken, { type: "bearer" })).status).toBe(200);
  });
  it("allows customer details/history and denies unauthenticated access", async () => {
    const result = await request(app)
      .get(`/api/customers/${customerId}`)
      .auth(demoToken, { type: "bearer" });
    expect(result.status).toBe(200);
    expect(result.body.data).toHaveProperty("history");
    expect((await request(app).get("/api/products")).status).toBe(401);
  });
  const product = {
    name: "Forbidden product",
    category: "Medicine",
    stock: 1,
    suppliers: "Example",
    price: "1.23",
  };
  const supplier = {
    name: "Forbidden supplier",
    address: "Example",
    company: "Example",
    deliveryDate: "2030-01-01",
    amount: "1.23",
    status: "Active",
  };
  const targets = [
    { method: "post", path: () => "/api/products", body: product },
    { method: "put", path: () => `/api/products/${productId}`, body: product },
    { method: "delete", path: () => `/api/products/${productId}`, body: {} },
    { method: "post", path: () => "/api/suppliers", body: supplier },
    { method: "put", path: () => `/api/suppliers/${supplierId}`, body: supplier },
    {
      method: "post",
      path: () => "/api/customers",
      body: {
        name: "Forbidden customer",
        email: "new@example.test",
        address: "Example",
        phone: "TEST-PHONE",
      },
    },
    {
      method: "patch",
      path: () => `/api/customers/${customerId}`,
      body: { name: "Forbidden change" },
    },
  ] as const;
  it.each(targets)("denies demo $method before any domain mutation", async (target) => {
    const before = await domainSnapshot();
    for (const body of [target.body, { role: "admin" }]) {
      const http = request(app);
      const result = await http[target.method](target.path())
        .auth(demoToken, { type: "bearer" })
        .set("X-Role", "admin")
        .send(body);
      expect(result.status).toBe(403);
      expect(result.body).toEqual({
        error: { code: "DEMO_READ_ONLY", message: "Demo accounts have read-only access" },
      });
      expect(result.headers["www-authenticate"]).toBeUndefined();
    }
    expect(await domainSnapshot()).toBe(before);
  });
  it("cannot assign role during Login and distinguishes CORS from authorization", async () => {
    expect(
      (
        await request(app)
          .post("/api/user/login")
          .send({ email: demoIdentity.email, password, role: "admin" })
      ).status,
    ).toBe(400);
    const result = await request(app)
      .post("/api/products")
      .auth(demoToken, { type: "bearer" })
      .set("Origin", "https://not-allowed.example.test")
      .send(product);
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
  });
  it("retains admin CRUD and rechecks a changed database role for an existing token", async () => {
    const created = await request(app)
      .post("/api/products")
      .auth(adminToken, { type: "bearer" })
      .send(product);
    expect(created.status).toBe(201);
    expect(
      (
        await request(app)
          .put(`/api/products/${created.body.data.id}`)
          .auth(adminToken, { type: "bearer" })
          .send({ ...product, stock: 2 })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .delete(`/api/products/${created.body.data.id}`)
          .auth(adminToken, { type: "bearer" })
      ).status,
    ).toBe(204);
    await User.updateOne({ email: "roles-admin@example.test" }, { $set: { role: "demo" } });
    try {
      expect(
        (
          await request(app)
            .post("/api/products")
            .auth(adminToken, { type: "bearer" })
            .send(product)
        ).body.error.code,
      ).toBe("DEMO_READ_ONLY");
      expect(
        (await request(app).get("/api/user/user-info").auth(adminToken, { type: "bearer" })).body
          .data.role,
      ).toBe("demo");
    } finally {
      await User.updateOne({ email: "roles-admin@example.test" }, { $set: { role: "admin" } });
    }
  });
  it("preserves independent demo logout and JWT expiration", async () => {
    const first = await signIn(demoIdentity.email),
      second = await signIn(demoIdentity.email);
    expect(
      (await request(app).get("/api/user/logout").auth(first.accessToken, { type: "bearer" }))
        .status,
    ).toBe(204);
    expect(
      (await request(app).get("/api/user/user-info").auth(first.accessToken, { type: "bearer" }))
        .status,
    ).toBe(401);
    expect(
      (await request(app).get("/api/products").auth(second.accessToken, { type: "bearer" })).status,
    ).toBe(200);
    now = new Date("2030-01-01T01:00:00Z");
    try {
      expect(
        (await request(app).get("/api/products").auth(second.accessToken, { type: "bearer" }))
          .status,
      ).toBe(401);
    } finally {
      now = new Date("2030-01-01T00:00:00Z");
    }
  });
  it("migrates only the exact reviewed legacy identity, preserving credentials and sessions", async () => {
    const legacyId = new mongoose.Types.ObjectId(),
      unrelatedId = new mongoose.Types.ObjectId();
    const hash = await hashPassword(password);
    await User.collection.insertMany([
      {
        _id: legacyId,
        name: "Legacy",
        email: "legacy@example.test",
        passwordHash: hash,
        createdAt: now,
      },
      {
        _id: unrelatedId,
        name: "Unconfigured",
        email: "unconfigured@example.test",
        passwordHash: hash,
        createdAt: now,
      },
    ]);
    const session = await signIn("legacy@example.test");
    expect(session.user.role).toBeNull();
    expect(
      (await request(app).get("/api/products").auth(session.accessToken, { type: "bearer" })).body
        .error.code,
    ).toBe("ROLE_NOT_CONFIGURED");
    const storedSession = await Session.findById(decodeJwt(session.accessToken).jti).lean();
    expect(await assignAdministratorRole(legacyId.toString(), "legacy@example.test")).toEqual({
      status: "planned",
      writes: 0,
    });
    expect((await User.findById(legacyId))!.role).toBeUndefined();
    await expect(
      assignAdministratorRole(legacyId.toString(), "wrong@example.test", true),
    ).rejects.toThrow();
    expect(await assignAdministratorRole(legacyId.toString(), "legacy@example.test", true)).toEqual(
      { status: "migrated", writes: 1 },
    );
    expect(await assignAdministratorRole(legacyId.toString(), "legacy@example.test", true)).toEqual(
      { status: "unchanged", writes: 0 },
    );
    expect((await User.findById(legacyId).select("+passwordHash"))!.passwordHash).toBe(hash);
    expect(await Session.findById(storedSession!._id).lean()).toEqual(storedSession);
    expect((await User.findById(unrelatedId))!.role).toBeUndefined();
    expect(
      (await request(app).get("/api/products").auth(session.accessToken, { type: "bearer" }))
        .status,
    ).toBe(200);
    await expect(
      assignAdministratorRole(
        (await User.findOne({ email: demoIdentity.email }))!.id,
        demoIdentity.email,
        true,
      ),
    ).rejects.toThrow();
  });
});

describe("demo provisioning without credential disclosure or overwrite", () => {
  it("generates a password only into the secure sink; repeat does not overwrite", async () => {
    await User.deleteOne({ email: demoIdentity.email });
    let passwordFromSink = "";
    const result = await initializeDemoUser(async (value) => {
      passwordFromSink = value;
    });
    expect(passwordFromSink).toHaveLength(43);
    expect(JSON.stringify(result)).not.toContain(passwordFromSink);
    expect((await signIn(demoIdentity.email, passwordFromSink)).user.role).toBe("demo");
    const before = await User.findOne({ email: demoIdentity.email }).select("+passwordHash").lean();
    expect(
      (
        await initializeDemoUser(async () => {
          throw Error("Must not run");
        })
      ).status,
    ).toBe("exists");
    expect(
      await User.findOne({ email: demoIdentity.email }).select("+passwordHash").lean(),
    ).toEqual(before);
  });
  it("refuses conflicting identities and never creates an account if storage fails", async () => {
    await User.updateOne({ email: demoIdentity.email }, { $set: { role: "admin" } });
    await expect(initializeDemoUser(async () => {})).rejects.toThrow("incompatible role");
    await User.deleteOne({ email: demoIdentity.email });
    await expect(
      initializeDemoUser(async () => {
        throw Error("Vault unavailable");
      }),
    ).rejects.toThrow("Vault unavailable");
    expect(await User.countDocuments({ email: demoIdentity.email })).toBe(0);
  });
});
