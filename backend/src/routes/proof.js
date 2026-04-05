import express from "express";
import Joi from "joi";
import fs from "fs";
import { groth16 } from "snarkjs";
import { buildPoseidon } from "circomlibjs";
import { verifyProof } from "../services/zkVerify.js";
import { checkNonce } from "../services/nonceService.js";
import { scoreProof } from "../services/scoring.js";

const router = express.Router();

// Load tree once at startup
const treePath = new URL("../../../merkle/tree.json", import.meta.url);
const tree = JSON.parse(fs.readFileSync(treePath));

const LEVELS = parseInt(process.env.CIRCUIT_LEVELS) || 5;
let poseidonInstance = null;
async function getPoseidon() {
  if (!poseidonInstance) poseidonInstance = await buildPoseidon();
  return poseidonInstance;
}

// Rebuild full padded tree layers for path lookup
async function getMerklePath(h3Index) {
  const poseidon = await getPoseidon();
  const F = poseidon.F;

  // Recompute leaves from stored cells
  const leaves = tree.cells.map(c => F.e(BigInt("0x" + c)));
  const ZERO = F.zero;

  // Pad to 2^LEVELS
  const size = 2 ** LEVELS;
  const padded = [...leaves];
  while (padded.length < size) padded.push(ZERO);

  // Find index of this h3Index in approved cells
  const leafIndex = tree.cells.indexOf(h3Index);
  if (leafIndex === -1) return null; // not in approved region

  // Build all layers
  let layer = padded;
  const layers = [layer];
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      next.push(poseidon([layer[i], layer[i + 1]]));
    }
    layer = next;
    layers.push(layer);
  }

  // Extract path
  const pathElements = [];
  const pathIndices = [];
  let idx = leafIndex;
  for (let i = 0; i < layers.length - 1; i++) {
    const isRight = idx % 2;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    pathElements.push(F.toString(layers[i][siblingIdx] ?? ZERO));
    pathIndices.push(isRight);
    idx = Math.floor(idx / 2);
  }

  return { pathElements, pathIndices, root: tree.root };
}

const wasmPath = new URL("../../../circuits/build/geoH3_js/geoH3.wasm", import.meta.url);
const zkeyPath = new URL("../../../circuits/build/geoH3_final.zkey", import.meta.url);

function toFilePath(url) {
  return decodeURIComponent(url.pathname.replace(/^\//, ""));
}

const generateSchema = Joi.object({
  h3Index:    Joi.string().required(),
  salt:       Joi.string().required(),
  nonce:      Joi.string().required(),
  bleWitness: Joi.object({
    available: Joi.boolean().required(),
    deviceId:  Joi.string(),
    timestamp: Joi.number(),
    hmac:      Joi.string(),
    reason:    Joi.string()
  }).optional().allow(null)
});

const proveSchema = Joi.object({
  proof:         Joi.object().required(),
  publicSignals: Joi.array().required(),
  nonce:         Joi.string().required(),
  commitment:    Joi.string().required(),
  bleWitness:    Joi.object().optional().allow(null)
});

// POST /api/generate-proof
// Accepts h3Index (hex), salt, nonce — looks up Merkle path dynamically
router.post("/generate-proof", async (req, res) => {
  const { error, value } = generateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  try {
    const poseidon = await getPoseidon();
    const F = poseidon.F;

    const merkle = await getMerklePath(value.h3Index);
    if (!merkle) {
      return res.status(403).json({ error: "H3 cell not in approved region" });
    }

    const h3BigInt  = BigInt("0x" + value.h3Index).toString();

    const commitment = F.toString(
      poseidon([BigInt("0x" + value.h3Index), BigInt(value.salt), BigInt(value.nonce)])
    );

    const input = {
      h3Index:      h3BigInt,
      salt:         value.salt,
      nonce:        value.nonce,
      commitment,
      root: merkle.root,
      pathElements: merkle.pathElements,
      pathIndices: merkle.pathIndices
    };

    const { proof, publicSignals } = await groth16.fullProve(
      input,
      toFilePath(wasmPath),
      toFilePath(zkeyPath)
    );

    res.json({ proof, publicSignals, commitment, nonce: value.nonce, bleWitness: value.bleWitness || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/prove — verifies proof
router.post("/prove", async (req, res) => {
  const { error, value } = proveSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { proof, publicSignals, nonce, commitment, bleWitness } = value;

  if (!await checkNonce(nonce, commitment)) {
    return res.status(400).json({ error: "Replay detected" });
  }

  const valid = await verifyProof(proof, publicSignals);
  if (!valid) return res.status(400).json({ error: "Invalid proof" });

  const { confidence, bleStatus } = scoreProof(bleWitness);
  res.json({ verified: true, confidence, bleStatus });
});

export default router;
