#!/bin/bash
set -e

echo "==> Compiling circuit..."
mkdir -p circuits/build
circom circuits/geoH3.circom --r1cs --wasm --sym -o circuits/build

echo "==> Downloading Powers of Tau (if needed)..."
if [ ! -f pot12_final.ptau ]; then
  curl -L https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau -o pot12_final.ptau
fi

echo "==> Running trusted setup..."
snarkjs groth16 setup circuits/build/geoH3.r1cs pot12_final.ptau circuits/build/geoH3_0000.zkey

echo "==> Contributing to ceremony..."
snarkjs zkey contribute circuits/build/geoH3_0000.zkey circuits/build/geoH3_final.zkey --name="contributor" -e="$(openssl rand -hex 32)"

echo "==> Exporting verification key..."
snarkjs zkey export verificationkey circuits/build/geoH3_final.zkey backend/verification_key.json

echo "==> Done. verification_key.json written to backend/"
