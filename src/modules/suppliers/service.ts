import { z } from "zod";
import { Supplier } from "./model.js";
import { supplierCreate, supplierUpdate } from "./validation.js";
import { literalFilter } from "../../shared/validation.js";
import { decimal } from "../../shared/money.js";
import { ApiError } from "../../shared/errors.js";

export const listSuppliers = (name?: string) =>
  Supplier.find(literalFilter(name)).sort({ name: 1, _id: 1 });
export const createSupplier = (
  input: z.infer<typeof supplierCreate>,
  now: Date,
) =>
  Supplier.create({
    ...input,
    amount: decimal(input.amount),
    createdAt: now,
    updatedAt: now,
  });
export async function updateSupplier(
  id: string,
  input: z.infer<typeof supplierUpdate>,
  now: Date,
) {
  const current = await Supplier.findById(id);
  if (!current) throw new ApiError(404, "NOT_FOUND", "Supplier not found");
  if (input.amount === null && current.amount !== null)
    throw new ApiError(
      400,
      "INVALID_AMOUNT_TRANSITION",
      "A known EUR amount cannot be replaced with null",
    );
  const supplier = await Supplier.findOneAndUpdate(
    { _id: id, amount: current.amount },
    {
      $set: {
        ...input,
        amount: input.amount === null ? null : decimal(input.amount),
        updatedAt: now,
      },
    },
    { returnDocument: "after", runValidators: true },
  );
  if (!supplier)
    throw new ApiError(
      409,
      "CONCURRENT_CHANGE",
      "Supplier amount changed; reload and retry",
    );
  return supplier;
}
