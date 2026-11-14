import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { z } from "zod";
import { User } from "./models.js";
import { hashPassword } from "./password.js";

export const demoIdentity = { name: "Demo User", email: "demo@e-pharmacy.example" } as const;

export async function initializeDemoUser(storeCredential: (password: string) => Promise<void>) {
  await User.init();
  const existing = await User.findOne({ email: demoIdentity.email });
  if (existing) {
    if (existing.role !== "demo")
      throw new Error("Existing demo identity has an incompatible role");
    return { status: "exists" as const, id: existing.id, role: "demo" as const };
  }
  const password = randomBytes(32).toString("base64url");
  const passwordHash = await hashPassword(password);
  // Persist recovery material first. A failed database write retains the vault entry for reconciliation.
  await storeCredential(password);
  const user = await User.create({
    ...demoIdentity,
    role: "demo",
    passwordHash,
    createdAt: new Date(),
  });
  return { status: "created" as const, id: user.id, role: "demo" as const };
}

export async function assignAdministratorRole(id: string, email: string, apply = false) {
  if (!Types.ObjectId.isValid(id)) throw new Error("An exact account identifier is required");
  const normalizedEmail = z.email().parse(email).toLowerCase();
  const filter = { _id: new Types.ObjectId(id), email: normalizedEmail };
  const user = await User.findOne(filter);
  if (!user) throw new Error("Exact administrator identity does not match");
  if (user.role === "admin") return { status: "unchanged" as const, writes: 0 };
  if (user.role !== undefined)
    throw new Error("Only a verified legacy account with no role can be migrated");
  if (!apply) return { status: "planned" as const, writes: 0 };
  const result = await User.collection.updateOne(
    { ...filter, role: { $exists: false } },
    { $set: { role: "admin" } },
  );
  if (result.modifiedCount !== 1)
    throw new Error("Account changed; migration stopped without retry");
  return { status: "migrated" as const, writes: 1 };
}
