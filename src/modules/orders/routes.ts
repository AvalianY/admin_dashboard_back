import { Router } from "express";
import { listOrders, orderQuery } from "./service.js";

export function orderRoutes() {
  const router = Router();
  router.get("/", async (req, res) =>
    res.json(await listOrders(orderQuery.parse(req.query))),
  );
  return router;
}
