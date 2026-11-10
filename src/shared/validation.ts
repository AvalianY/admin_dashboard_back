import { z } from "zod";
import { decimal } from "./money.js";
import { isCalendarDate } from "./dates.js";

export const text = z.string().trim().min(1);
export const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/);
export const calendarDate = z
  .string()
  .refine(isCalendarDate, "Expected a valid YYYY-MM-DD date");
export const nonNegativeMoney = z.string().refine((value) => {
  try {
    decimal(value);
    return true;
  } catch {
    return false;
  }
}, "Expected a non-negative exact decimal string supported by Decimal128");
export const nameQuery = z.string().trim().optional();
export const sortOrder = z.enum(["asc", "desc"]).default("desc");
export const literalFilter = (name?: string) => {
  if (!name) return {};
  // BSON regex patterns cannot contain raw NUL bytes; PCRE hex escaping preserves literal search.
  const pattern = name
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll(String.fromCharCode(0), "\\x00");
  return { name: { $regex: pattern, $options: "i" } };
};
