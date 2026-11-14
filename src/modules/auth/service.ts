import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { Types } from "mongoose";
import type { RequestHandler } from "express";
import { z } from "zod";
import { ApiError } from "../../shared/errors.js";
import {
  User,
  Session,
  userRoles,
  type UserRecord,
  type UserRole,
} from "./models.js";
import { hashPassword, verifyPassword } from "./password.js";

export const loginSchema = z.strictObject({
  email: z.email(),
  password: z.string().min(1),
});
export const userDto = (user: UserRecord) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: userRoles.includes(user.role as UserRole) ? user.role : null,
});
const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const unauthorized = () =>
  new ApiError(401, "UNAUTHORIZED", "Invalid credentials or authentication");
let dummyHash: Promise<string> | undefined;

export async function initializeUser(
  name: string,
  email: string,
  password: string,
  role: UserRole = "admin",
) {
  z.string().trim().min(1).parse(name);
  z.email().parse(email);
  z.string().min(1).parse(password);
  z.enum(userRoles).parse(role);
  const normalizedEmail = email.toLowerCase();
  await User.init();
  if (await User.exists({ email: normalizedEmail }))
    throw new Error(
      "Account already exists; initialization does not overwrite credentials",
    );
  return User.create({
    name: name.trim(),
    email: normalizedEmail,
    role,
    passwordHash: await hashPassword(password),
    createdAt: new Date(),
  });
}

// Role is read from MongoDB on every authenticated request, never trusted from JWT/body.
export const requireBusinessAccess: RequestHandler = (req, res, next) => {
  const role = (res.locals.user as UserRecord).role;
  if (role !== "admin" && role !== "demo")
    throw new ApiError(
      403,
      "ROLE_NOT_CONFIGURED",
      "Business access is not configured for this account",
    );
  if (role === "demo" && !["GET", "HEAD", "OPTIONS"].includes(req.method))
    throw new ApiError(
      403,
      "DEMO_READ_ONLY",
      "Demo accounts have read-only access",
    );
  next();
};

export async function login(
  email: string,
  password: string,
  secret: string,
  now: Date,
) {
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+passwordHash",
  );
  dummyHash ??= hashPassword(randomBytes(32).toString("hex"));
  const fallbackHash = await dummyHash;
  const passwordHash = user?.passwordHash ?? fallbackHash;
  const matches = await verifyPassword(password, passwordHash);
  if (!user || !matches) throw unauthorized();
  const sessionId = new Types.ObjectId();
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = new Date((issuedAt + 3600) * 1000);
  const accessToken = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setJti(sessionId.toString())
    .setIssuer("e-pharmacy-api")
    .setAudience("e-pharmacy-admin")
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 3600)
    .sign(new TextEncoder().encode(secret));
  await Session.create({
    _id: sessionId,
    userId: user._id,
    tokenHash: tokenHash(accessToken),
    createdAt: now,
    expiresAt,
    revokedAt: null,
  });
  return {
    accessToken,
    tokenType: "Bearer" as const,
    expiresAt: expiresAt.toISOString(),
    user: userDto(user),
  };
}

export function requireAuth(secret: string, clock: () => Date): RequestHandler {
  return async (req, res, next) => {
    const match = /^Bearer +([^\s]+)$/i.exec(req.headers.authorization ?? "");
    if (!match) throw unauthorized();
    const now = clock();
    let subject: string;
    let sessionId: string;
    try {
      const { payload } = await jwtVerify(
        match[1],
        new TextEncoder().encode(secret),
        {
          algorithms: ["HS256"],
          issuer: "e-pharmacy-api",
          audience: "e-pharmacy-admin",
          currentDate: now,
          requiredClaims: ["sub", "jti", "iat", "exp"],
        },
      );
      if (
        !payload.sub ||
        !payload.jti ||
        !Types.ObjectId.isValid(payload.sub) ||
        !Types.ObjectId.isValid(payload.jti)
      )
        throw unauthorized();
      subject = payload.sub;
      sessionId = payload.jti;
    } catch {
      throw unauthorized();
    }
    const session = await Session.findOne({
      _id: sessionId,
      userId: subject,
      tokenHash: tokenHash(match[1]),
      revokedAt: null,
      expiresAt: { $gt: now },
    });
    if (!session) throw unauthorized();
    const user = await User.findById(subject);
    if (!user) throw unauthorized();
    res.locals.user = user;
    res.locals.sessionId = session._id;
    res.set("Cache-Control", "no-store");
    next();
  };
}
