import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const N = 131072;
const options = { N, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32).toString("hex");
  const key = await derive(password, salt);
  return `scrypt$${N}$8$1$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const [algorithm, cost, r, p, salt, hash] = encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    Number(cost) !== N ||
    r !== "8" ||
    p !== "1" ||
    !salt ||
    !hash ||
    !/^[a-f0-9]{128}$/.test(hash)
  )
    return false;
  return timingSafeEqual(
    await derive(password, salt),
    Buffer.from(hash, "hex"),
  );
}
