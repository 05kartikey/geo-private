pragma circom 2.0.0;

include "./node_modules/circomlib/circuits/poseidon.circom";
include "./node_modules/circomlib/circuits/mux1.circom";

// Inline Merkle proof verifier using Poseidon hash
template MerkleProof(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output root;

    component hashers[levels];
    component mux[levels];

    signal hashes[levels + 1];
    hashes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        mux[i] = MultiMux1(2);
        mux[i].c[0][0] <== hashes[i];
        mux[i].c[0][1] <== pathElements[i];
        mux[i].c[1][0] <== pathElements[i];
        mux[i].c[1][1] <== hashes[i];
        mux[i].s <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];
        hashes[i + 1] <== hashers[i].out;
    }

    root <== hashes[levels];
}

template GeoH3Proof(levels) {
    signal input h3Index;
    signal input salt;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    signal input root;
    signal input commitment;
    signal input nonce;

    // Commitment binds h3Index + salt + nonce — proof is unique per nonce
    component hash = Poseidon(3);
    hash.inputs[0] <== h3Index;
    hash.inputs[1] <== salt;
    hash.inputs[2] <== nonce;
    hash.out === commitment;

    // Merkle proof — verifies h3Index is in the approved region tree
    component merkle = MerkleProof(levels);
    merkle.leaf <== h3Index;
    for (var i = 0; i < levels; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i] <== pathIndices[i];
    }
    merkle.root === root;
}

component main { public [root, commitment] } = GeoH3Proof(5);
