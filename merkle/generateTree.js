import { buildPoseidon } from "circomlibjs";
import fs from "fs";
import { config } from "dotenv";
config({ path: "../backend/.env" }); // reads CIRCUIT_LEVELS from backend .env

// Approved H3 cells at resolution 9
// Add your H3 cell here — find it by clicking "Verify Location" in the UI
const cells = [
  "89618c444a3ffff"
];

const LEVELS = parseInt(process.env.CIRCUIT_LEVELS) || 5;

const poseidon = await buildPoseidon();
const F = poseidon.F;

const ZERO = F.zero;
const leaves = cells.map(c => F.e(BigInt("0x" + c)));

function buildTree(rawLeaves, levels) {
  const size = 2 ** levels;
  const padded = [...rawLeaves];
  while (padded.length < size) padded.push(ZERO);

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
  return layers;
}

const layers = buildTree(leaves, LEVELS);
const root = F.toString(layers[layers.length - 1][0]);

fs.writeFileSync("tree.json", JSON.stringify({
  root,
  cells,
  leaves: leaves.map(l => F.toString(l))
}, null, 2));

console.log("✅ tree.json written");
console.log("Merkle root:", root);
