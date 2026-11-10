import { Router } from "express";
import { z } from "zod";
import type { AppConfig } from "../../config.js";
import { Session, type UserRecord } from "./models.js";
import { login, loginSchema, requireAuth, userDto } from "./service.js";

export function authRoutes(config: AppConfig, clock: () => Date) {
  const router = Router();
  router.post("/login", async (req, res) => {
    z.strictObject({}).parse(req.query);
    const input = loginSchema.parse(req.body);
    res
      .set("Cache-Control", "no-store")
      .json({
        data: await login(
          input.email,
          input.password,
          config.jwtSecret,
          clock(),
        ),
      });
  });
  router.use(requireAuth(config.jwtSecret, clock));
  router.get("/user-info", (req, res) => {
    z.strictObject({}).parse(req.query);
    res.json({ data: userDto(res.locals.user as UserRecord) });
  });
  router.get("/logout", async (req, res) => {
    z.strictObject({}).parse(req.query);
    await Session.updateOne(
      { _id: res.locals.sessionId },
      { $set: { revokedAt: clock() } },
    );
    res.status(204).end();
  });
  return router;
}
