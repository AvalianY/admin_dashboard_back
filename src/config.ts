import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().default(""),
});

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  port: number;
  mongodbUri: string;
  jwtSecret: string;
  corsOrigins: string[];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = environmentSchema.safeParse(env);
  if (!result.success) {
    throw new Error(
      `Invalid configuration: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  }
  const value = result.data;
  const origins = value.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  for (const origin of origins) {
    if (new URL(origin).origin !== origin || origin === "*")
      throw new Error("CORS_ORIGINS must contain explicit URL origins");
  }
  return {
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    mongodbUri: value.MONGODB_URI,
    jwtSecret: value.JWT_SECRET,
    corsOrigins: origins,
  };
}
