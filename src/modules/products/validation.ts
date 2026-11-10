import { z } from "zod";
import {
  text,
  nonNegativeMoney,
  nameQuery,
  sortOrder,
} from "../../shared/validation.js";
import { categories, legacyCategories } from "./model.js";

const fields = {
  name: text,
  category: z.enum(categories),
  stock: z.number().int().nonnegative().refine(Number.isSafeInteger),
  suppliers: text,
  price: nonNegativeMoney,
};
export const productCreate = z.strictObject(fields);
export const productUpdate = z.strictObject({
  ...fields,
  category: z.enum([...categories, ...legacyCategories]),
});
export const productQuery = z.strictObject({
  name: nameQuery,
  sortBy: z
    .enum(["name", "category", "stock", "suppliers", "price", "createdAt"])
    .default("createdAt"),
  sortOrder,
});
