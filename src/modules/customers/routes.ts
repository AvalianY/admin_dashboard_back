import { Router } from "express";
import { z } from "zod";
import { objectId } from "../../shared/validation.js";
import {
  createCustomer,
  customerCreate,
  customerDetails,
  customerPatch,
  customerQuery,
  listCustomers,
  updateCustomer,
} from "./service.js";

export function customerRoutes(clock: () => Date) {
  const router = Router();
  router.post("/", async (req, res) => {
    z.strictObject({}).parse(req.query);
    res.status(201).json(
      await createCustomer(customerCreate.parse(req.body), clock()),
    );
  });
  router.get("/", async (req, res) =>
    res.json(await listCustomers(customerQuery.parse(req.query))),
  );
  router.get("/:customerId", async (req, res) => {
    z.strictObject({}).parse(req.query);
    res.json(await customerDetails(objectId.parse(req.params.customerId)));
  });
  router.patch("/:customerId", async (req, res) => {
    z.strictObject({}).parse(req.query);
    res.json(
      await updateCustomer(
        objectId.parse(req.params.customerId),
        customerPatch.parse(req.body),
        clock(),
      ),
    );
  });
  return router;
}
