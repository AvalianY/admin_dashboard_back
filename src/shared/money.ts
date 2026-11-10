import { Types } from "mongoose";

export function decimal(value: string, signed = false): Types.Decimal128 {
  if (!(signed ? /^-?\d+(?:\.\d+)?$/ : /^\d+(?:\.\d+)?$/).test(value))
    throw new Error("Invalid decimal format");
  return Types.Decimal128.fromString(value);
}

export function sourceMoney(raw: string) {
  const currency = raw.startsWith("৳") ? ("BDT" as const) : ("EUR" as const);
  const text = raw.replace(/^৳\s*/, "");
  if (!/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(text))
    throw new Error("Invalid source money");
  const amount = decimal(text.replaceAll(",", "").replace(/^\+/, ""), true);
  return { amount, currency };
}

export function moneyString(value: Types.Decimal128): string {
  const text = value.toString();
  if (!/[eE]/.test(text)) return text;
  const [coefficient, power] = text.toLowerCase().split("e");
  const negative = coefficient.startsWith("-");
  const unsigned = coefficient.replace(/^-/, "");
  const [whole, fraction = ""] = unsigned.split(".");
  const digits = whole + fraction;
  const point = whole.length + Number(power);
  const expanded =
    point <= 0
      ? `0.${"0".repeat(-point)}${digits}`
      : point >= digits.length
        ? digits + "0".repeat(point - digits.length)
        : `${digits.slice(0, point)}.${digits.slice(point)}`;
  return `${negative ? "-" : ""}${expanded}`;
}
