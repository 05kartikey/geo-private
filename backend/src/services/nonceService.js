import Redis from "ioredis";

const DEV = !process.env.REDIS_URL;

// Local dev: in-memory Map with manual TTL cleanup
const memNonces = new Map();

export const redis = DEV ? null : new Redis(process.env.REDIS_URL);

export async function checkNonce(nonce, commitment) {
  const key = `nonce:${commitment}:${nonce}`;

  if (DEV) {
    if (memNonces.has(key)) return false;
    memNonces.set(key, true);
    setTimeout(() => memNonces.delete(key), 300_000);
    return true;
  }

  const result = await redis.set(key, "1", "NX", "PX", 300_000);
  return result === "OK";
}
