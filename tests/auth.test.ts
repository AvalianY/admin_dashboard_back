import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { User, Session } from "../src/modules/auth/models.js";
import { initializeUser } from "../src/modules/auth/service.js";
import { startDatabase, stopDatabase, config } from "./database.js";

const password = "isolated account password";
let now = new Date("2026-11-09T12:00:00.000Z");
const app = createApp(config, () => now);
beforeAll(async () => {
  await startDatabase();
  await Promise.all([User.init(), Session.init()]);
  await initializeUser("Test Administrator", "admin@example.test", password);
});
afterAll(stopDatabase);

async function signIn() {
  const response = await request(app)
    .post("/api/user/login")
    .send({ email: "admin@example.test", password });
  expect(response.status).toBe(200);
  return response.body.data.accessToken as string;
}

describe("authentication", () => {
  it.each(["Bearer", "bearer", "BEARER", "bEaReR"])("accepts the %s scheme without changing the token", async (scheme) => {
    const token = await signIn();
    const result = await request(app).get("/api/user/user-info")
      .set("Authorization", `${scheme} ${token}`);
    expect(result.status).toBe(200);
  });
  it("accepts the standard space separator without making the JWT case-insensitive", async () => {
    const token = await signIn();
    expect((await request(app).get("/api/user/user-info")
      .set("Authorization", `Bearer   ${token}`)).status).toBe(200);
    const [header, payload, signature] = token.split(".");
    const changed = signature.replace(/[A-Za-z]/, (letter) =>
      letter === letter.toLowerCase() ? letter.toUpperCase() : letter.toLowerCase());
    const invalid = await request(app).get("/api/user/user-info")
      .set("Authorization", `bearer ${header}.${payload}.${changed}`);
    expect(invalid.status).toBe(401);
    expect(invalid.headers["www-authenticate"]).toBe('Bearer realm="e-pharmacy"');
  });
  it.each([undefined, "Bearer invalid", "Basic invalid", "Bearer\tinvalid"])(
    "provides a safe Bearer challenge for invalid authentication: %s", async (authorization) => {
      const attempt = request(app).get("/api/user/user-info");
      if (authorization !== undefined) attempt.set("Authorization", authorization);
      const result = await attempt;
      expect(result.status).toBe(401);
      expect(result.headers["www-authenticate"]).toBe('Bearer realm="e-pharmacy"');
      expect(result.headers["www-authenticate"]).not.toContain("invalid");
    },
  );
  it("returns a real account and a one-hour session without secret fields", async () => {
    const token = await signIn();
    const result = await request(app)
      .get("/api/user/user-info")
      .auth(token, { type: "bearer" });
    expect(result.status).toBe(200);
    expect(result.body.data.email).toBe("admin@example.test");
    expect(Object.keys(result.body.data).sort()).toEqual([
      "email",
      "id",
      "name",
    ]);
    const session = await Session.findOne();
    expect(session!.expiresAt.getTime() - session!.createdAt.getTime()).toBe(
      3600000,
    );
  });
  it("rejects wrong credentials, unknown users, missing and invalid tokens", async () => {
    for (const email of ["admin@example.test", "absent@example.test"])
      expect(
        (
          await request(app)
            .post("/api/user/login")
            .send({ email, password: "wrong" })
        ).status,
      ).toBe(401);
    expect((await request(app).get("/api/user/user-info")).status).toBe(401);
    expect(
      (
        await request(app)
          .get("/api/user/user-info")
          .auth("invalid", { type: "bearer" })
      ).status,
    ).toBe(401);
  });
  it("revokes only the current session", async () => {
    const first = await signIn();
    const second = await signIn();
    expect(
      (
        await request(app)
          .get("/api/user/logout")
          .auth(first, { type: "bearer" })
      ).status,
    ).toBe(204);
    const revoked = await request(app).get("/api/user/user-info")
      .auth(first, { type: "bearer" });
    expect(revoked.status).toBe(401);
    expect(revoked.headers["www-authenticate"]).toBe('Bearer realm="e-pharmacy"');
    expect(
      (
        await request(app)
          .get("/api/user/user-info")
          .auth(second, { type: "bearer" })
      ).status,
    ).toBe(200);
  });
  it("rejects expired sessions", async () => {
    const token = await signIn();
    now = new Date("2026-11-09T13:00:00.000Z");
    try {
      const expired = await request(app).get("/api/user/user-info")
        .auth(token, { type: "bearer" });
      expect(expired.status).toBe(401);
      expect(expired.headers["www-authenticate"]).toBe('Bearer realm="e-pharmacy"');
    } finally {
      now = new Date("2026-11-09T12:00:00.000Z");
    }
  });
  it("validates JSON, forbids unknown fields and checks origins", async () => {
    expect(
      (
        await request(app)
          .post("/api/user/login")
          .send({ email: "invalid", password })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/user/login")
          .send({ email: "admin@example.test", password, role: "admin" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/user/login")
          .set("Content-Type", "application/json")
          .send("{")
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/user/login")
          .set("Origin", "https://unknown.example")
      ).status,
    ).toBe(403);
  });
  it("does not overwrite an existing account", async () => {
    await expect(
      initializeUser("Changed", "admin@example.test", "different"),
    ).rejects.toThrow("already exists");
  });
});
