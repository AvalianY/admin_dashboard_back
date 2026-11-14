import { Schema, model, Types } from "mongoose";

export const userRoles = ["admin", "demo"] as const;
export type UserRole = (typeof userRoles)[number];
export interface UserRecord {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role?: UserRole;
  passwordHash: string;
  createdAt: Date;
}
export interface SessionRecord {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export const User = model<UserRecord>(
  "User",
  new Schema<UserRecord>(
    {
      name: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      role: { type: String, enum: userRoles, required: true },
      passwordHash: { type: String, required: true, select: false },
      createdAt: { type: Date, required: true },
    },
    { versionKey: false },
  ),
);

const sessionSchema = new Schema<SessionRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, select: false },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    revokedAt: { type: Date, default: null },
  },
  { versionKey: false },
);
export const Session = model<SessionRecord>("Session", sessionSchema);
