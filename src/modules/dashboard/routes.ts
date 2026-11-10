import { Router } from "express";
import { z } from "zod";
import type { UserRecord } from "../auth/models.js";
import { getDashboard } from "./service.js";

export function dashboardRoutes(clock: () => Date) {
  const router = Router();
  router.get("/", async (req, res) => {
    z.strictObject({}).parse(req.query);
    res.json(await getDashboard(res.locals.user as UserRecord, clock()));
  });
  return router;
}
