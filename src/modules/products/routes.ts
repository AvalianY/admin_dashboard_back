import { Router } from "express";
import { z } from "zod";
import { completeness } from "../../shared/completeness.js";
import { objectId } from "../../shared/validation.js";
import { productDto } from "../../shared/serializers.js";
import { categories } from "./model.js";
import { productCreate, productUpdate, productQuery } from "./validation.js";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
} from "./service.js";

export function productRoutes(clock: () => Date) {
  const router = Router();
  router.get("/", async (req, res) => {
    const items = await listProducts(productQuery.parse(req.query));
    res.json({
      data: { items: items.map(productDto), categories },
      meta: completeness(),
    });
  });
  router.post("/", async (req, res) => {
    z.strictObject({}).parse(req.query);
    res
      .status(201)
      .json({
        data: productDto(
          await createProduct(productCreate.parse(req.body), clock()),
        ),
        meta: completeness(),
      });
  });
  router.put("/:productId", async (req, res) => {
    z.strictObject({}).parse(req.query);
    res.json({
      data: productDto(
        await updateProduct(
          objectId.parse(req.params.productId),
          productUpdate.parse(req.body),
          clock(),
        ),
      ),
      meta: completeness(),
    });
  });
  router.delete("/:productId", async (req, res) => {
    z.strictObject({}).parse(req.query);
    await deleteProduct(objectId.parse(req.params.productId), clock());
    res.status(204).end();
  });
  return router;
}
