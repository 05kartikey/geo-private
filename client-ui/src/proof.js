const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";
const API_KEY = process.env.REACT_APP_API_KEY || "";

export async function generateProof(h3Index, salt, nonce, bleWitness) {
  const res = await fetch(`${API_URL}/api/generate-proof`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY
    },
    body: JSON.stringify({
      h3Index,
      salt: salt.toString(),
      nonce: nonce.toString(),
      bleWitness: bleWitness || null
    })
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error);

  return {
    proof:         data.proof,
    publicSignals: data.publicSignals,
    nonce:         data.nonce,
    commitment:    data.commitment,
    bleWitness:    bleWitness || null
  };
}
