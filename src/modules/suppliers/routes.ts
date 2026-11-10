import { Router } from "express";
import { z } from "zod";
import { objectId } from "../../shared/validation.js";
import { supplierDto, supplierMissing } from "../../shared/serializers.js";
import { completeness } from "../../shared/completeness.js";
import { supplierCreate, supplierQuery, supplierUpdate } from "./validation.js";
import { createSupplier, listSuppliers, updateSupplier } from "./service.js";

export function supplierRoutes(clock: () => Date) {
  const router = Router();
  router.get("/", async (req, res) => {
    const input = supplierQuery.parse(req.query);
    const items = await listSuppliers(input.name);
    res.json({
      data: { items: items.map(supplierDto) },
      meta: completeness(items.flatMap(supplierMissing)),
    });
  });
  router.post("/", async (req, res) => {
    z.strictObject({}).parse(req.query);
    const input = supplierCreate.parse(req.body);
    const supplier = await createSupplier(input, clock());
    res
      .status(201)
      .json({
        data: supplierDto(supplier),
        meta: completeness(supplierMissing(supplier)),
      });
  });
  router.put("/:supplierId", async (req, res) => {
    z.strictObject({}).parse(req.query);
    const id = objectId.parse(req.params.supplierId);
    const input = supplierUpdate.parse(req.body);
    const supplier = await updateSupplier(id, input, clock());
    res.json({
      data: supplierDto(supplier),
      meta: completeness(supplierMissing(supplier)),
    });
  });
  return router;
}
