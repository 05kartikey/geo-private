import { groth16 } from "snarkjs";
import fs from "fs";

const keyPath = new URL("../../verification_key.json", import.meta.url);

let vKey = null;
if (fs.existsSync(keyPath)) {
  vKey = JSON.parse(fs.readFileSync(keyPath));
} else {
  console.warn("verification_key.json not found — proof verification disabled (dev mode)");
}

export async function verifyProof(proof, publicSignals) {
  if (!vKey) return true; // dev bypass
  return await groth16.verify(vKey, publicSignals, proof);
}
