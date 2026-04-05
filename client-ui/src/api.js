const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";
const API_KEY = process.env.REACT_APP_API_KEY || "";

export async function sendProof(data) {
  const res = await fetch(`${API_URL}/api/prove`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY
    },
    body: JSON.stringify({
      proof:         data.proof,
      publicSignals: data.publicSignals,
      nonce:         data.nonce,
      commitment:    data.commitment,
      bleWitness:    data.bleWitness || null
    })
  });
  return await res.json();
}
