import { z } from "zod";
import { ApiError } from "../../shared/errors.js";
import { decimal } from "../../shared/money.js";
import { literalFilter } from "../../shared/validation.js";
import { Product, categories, type ProductRecord } from "./model.js";
import { productCreate, productUpdate, productQuery } from "./validation.js";

export async function listProducts(input: z.infer<typeof productQuery>) {
  const filter = { deletedAt: null, ...literalFilter(input.name) };
  if (input.sortBy === "createdAt") {
    return Product.aggregate<ProductRecord>([
      { $match: filter },
      {
        $addFields: {
          creationKnown: { $cond: [{ $ne: ["$createdAt", null] }, 1, 0] },
        },
      },
      {
        $sort: {
          creationKnown: -1,
          createdAt: input.sortOrder === "asc" ? 1 : -1,
          "provenance.index": 1,
          _id: 1,
        },
      },
    ]);
  }
  return Product.find(filter).sort({
    [input.sortBy]: input.sortOrder === "asc" ? 1 : -1,
    _id: 1,
  });
}

export async function createProduct(
  input: z.infer<typeof productCreate>,
  now: Date,
) {
  return Product.create({
    ...input,
    price: decimal(input.price),
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateProduct(
  id: string,
  input: z.infer<typeof productUpdate>,
  now: Date,
) {
  const current = await Product.findOne({ _id: id, deletedAt: null });
  if (!current) throw new ApiError(404, "NOT_FOUND", "Product not found");
  if (
    !(categories as readonly string[]).includes(input.category) &&
    input.category !== current.category
  )
    throw new ApiError(
      400,
      "INVALID_CATEGORY_TRANSITION",
      "The current legacy category may only be retained or replaced by an approved category",
    );
  const product = await Product.findOneAndUpdate(
    { _id: id, deletedAt: null, category: current.category },
    { $set: { ...input, price: decimal(input.price), updatedAt: now } },
    { returnDocument: "after", runValidators: true },
  );
  if (!product)
    throw new ApiError(
      409,
      "CONCURRENT_CHANGE",
      "Product state changed; reload and retry",
    );
  return product;
}

export async function deleteProduct(id: string, now: Date) {
  const product = await Product.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: { deletedAt: now, updatedAt: now } },
  );
  if (!product) throw new ApiError(404, "NOT_FOUND", "Product not found");
}
