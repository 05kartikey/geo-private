import crypto from "crypto";

const BLE_SECRET = process.env.BLE_SECRET || "";

function verifyHMAC(deviceId, timestamp, hmac) {
  if (!BLE_SECRET) return false;
  const message  = `${deviceId}:${timestamp}`;
  const expected = crypto
    .createHmac("sha256", BLE_SECRET)
    .update(message)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(hmac,     "hex"),
    Buffer.from(expected, "hex")
  );
}

export function scoreProof(bleWitness) {
  if (!bleWitness || !bleWitness.available) {
    return { confidence: 0.3, bleStatus: "no_device" };
  }

  const { deviceId, timestamp, hmac } = bleWitness;

  if (!hmac || !deviceId || timestamp === undefined) {
    return { confidence: 0.4, bleStatus: "invalid_payload" };
  }

  if (!verifyHMAC(deviceId, timestamp, hmac)) {
    return { confidence: 0.4, bleStatus: "hmac_failed" };
  }

  return { confidence: 1.0, bleStatus: "verified" };
}
