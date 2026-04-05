# geo-private

Privacy-preserving location verification using zero-knowledge proofs and ESP32 BLE anti-spoofing.

A user proves they are inside a geographic region (H3 cell) without revealing exact coordinates. An ESP32 device acts as a physical anchor — only users within BLE range of the device get full confidence.

---

## How it works

```
User location (lat/lng)
        │
        ▼
   H3 cell index  ──►  Poseidon(h3Index, salt, nonce) = commitment
        │
        ▼
  Merkle proof that h3Index is in the approved region tree
        │
        ▼
  groth16 proof generated server-side (snarkjs)
        │
        ▼
  ESP32 BLE witness scanned (HMAC-SHA256 signed payload)
        │
        ▼
  Backend verifies proof + HMAC + nonce (replay protection)
        │
        ▼
  Returns { verified, confidence, bleStatus }
```

---

## Confidence scoring

| Scenario | Confidence |
|---|---|
| ESP32 detected + HMAC valid | 100% |
| ESP32 detected + HMAC invalid | 40% |
| ESP32 not found / user cancelled | 30% |

---

## Threat model

### What the system protects against

| Threat | Mitigation |
|---|---|
| Server learns exact location | Proof generated server-side from H3 index only — raw lat/lng never sent |
| Proof replay | Nonce bound into `Poseidon(h3Index, salt, nonce)` at circuit level |
| Cross-user nonce reuse | In-memory store tracks `(nonce, commitment)` as unique pair |
| Forged proof | groth16 verification against `verification_key.json` |
| Location spoofing | ESP32 BLE beacon physically anchored at approved location — HMAC signed |
| Proof spam / DoS | Rate limited (configurable via `RATE_LIMIT_MAX`) |

### What the system does NOT protect against

| Limitation | Reason |
|---|---|
| GPS authenticity | No GPS attestation — H3 index comes from browser geolocation |
| Compromised client | Malicious browser can send arbitrary H3 index |
| Trusted setup compromise | Single-contributor ceremony — use multi-party for production |
| Sybil resistance | Multiple proofs from different nonces accepted |

---

## Guarantees vs limitations

| | Status |
|---|---|
| ✅ Server never sees raw coordinates | Guaranteed — only H3 index sent |
| ✅ Proof is single-use | Guaranteed — nonce bound in circuit |
| ✅ Proof is region-specific | Guaranteed — Merkle root is public signal |
| ✅ Physical presence (with ESP32) | Guaranteed within BLE range (~10m) |
| ❌ User is physically present (without ESP32) | Not guaranteed — confidence drops to 30% |
| ❌ User identity verified | Not guaranteed — proofs are anonymous |
| ❌ Production-safe trusted setup | Not guaranteed — single-contributor ceremony |

---

## Performance

Measured on Node.js 18, Windows, snarkjs 0.7 with 5-level Merkle circuit.

| Operation | Time | Where |
|---|---|---|
| Proof generation (`groth16.fullProve`) | ~5–10s | Backend |
| Proof verification (`groth16.verify`) | ~50ms | Backend |
| BLE scan + HMAC verify | ~2–3s | Browser + Backend |
| Nonce check | ~5ms | Backend |

---

## Project structure

```
geo-private/
├── backend/          # Express API — proof generation + verification
│   ├── src/
│   │   ├── db/           # MongoDB connection
│   │   ├── routes/       # /api/generate-proof, /api/prove
│   │   └── services/     # zkVerify, scoring, nonceService
│   ├── .env              # All backend config (single source of truth)
│   └── .env.example
├── circuits/         # Circom circuit (geoH3.circom)
├── client-ui/        # React frontend
│   ├── src/
│   │   ├── App.js        # Main UI
│   │   ├── ble.js        # Web Bluetooth scanner
│   │   ├── H3Map.js      # Leaflet map with H3 polygon
│   │   ├── proof.js      # Calls backend generate-proof
│   │   └── api.js        # Calls backend prove
│   └── .env              # Frontend config (single source of truth)
├── esp32/            # ESP32 DevKitV1 firmware (PlatformIO)
│   └── src/
│       ├── config.h      # All ESP32 config (single source of truth)
│       └── main.cpp      # BLE advertising + HMAC signing
├── merkle/           # Merkle tree builder
│   └── generateTree.js   # Edit cells[] here to change approved regions
└── scripts/
    └── setup.sh      # Circuit compile + trusted setup
```

---

## Prerequisites

- [Node.js 18+](https://nodejs.org)
- [Circom 2](https://docs.circom.io/getting-started/installation/)
- [snarkjs](https://github.com/iden3/snarkjs) — `npm install -g snarkjs`
- [PlatformIO](https://platformio.org/) — for ESP32 firmware
- [MongoDB](https://www.mongodb.com/try/download/community) (optional — in-memory fallback if unset)
- Chrome or Edge (Web Bluetooth API required)

---

## Setup

### 1. Clone

```bash
git clone https://github.com/<your-username>/geo-private.git
cd geo-private
```

### 2. Compile the circuit

```bash
bash scripts/setup.sh
```

This will:
- Compile `circuits/geoH3.circom`
- Run the trusted setup (Powers of Tau)
- Export `verification_key.json` into `backend/`

### 3. Add your approved H3 cells

Edit `merkle/generateTree.js`:
```js
const cells = [
  "your-h3-cell-here",  // find by clicking Verify Location in the UI
];
```

Then regenerate the tree:
```bash
cd merkle
node generateTree.js
```

### 4. Configure environment

```bash
cp backend/.env.example backend/.env
cp client-ui/.env.example client-ui/.env
```

Edit `backend/.env` — all config in one place:
- `BLE_SECRET` — must match `esp32/src/config.h`
- `CIRCUIT_LEVELS` — must match circuit compilation (default: 5)

### 5. Flash ESP32

- Open `esp32/` in PlatformIO
- Edit `esp32/src/config.h` — set `BLE_SECRET` to match `backend/.env`
- Click **Build** then **Upload** (COM6)

### 6. Run the backend

```bash
cd backend
npm install
node src/app.js
```

### 7. Run the frontend

```bash
cd client-ui
npm install
npm start
```

Open `http://localhost:3001` in **Chrome or Edge**.

---

## Configuration — single source of truth

| What | File | Key |
|---|---|---|
| Server port | `backend/.env` | `PORT` |
| CORS origin | `backend/.env` | `CLIENT_ORIGIN` |
| API key | `backend/.env` | `API_KEY` |
| Rate limit | `backend/.env` | `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` |
| BLE secret | `backend/.env` + `esp32/src/config.h` | `BLE_SECRET` |
| BLE UUIDs | `backend/.env` + `client-ui/.env` + `esp32/src/config.h` | `BLE_SERVICE_UUID`, `BLE_CHAR_UUID` |
| Circuit levels | `backend/.env` | `CIRCUIT_LEVELS` |
| Approved H3 cells | `merkle/generateTree.js` | `cells[]` |
| MongoDB | `backend/.env` | `MONGO_URI` |

---

## API

### `POST /api/generate-proof`

Generates a groth16 proof server-side.

**Request:**
```json
{
  "h3Index": "89618c444afffff",
  "salt": "123456789",
  "nonce": "987654321",
  "bleWitness": { "available": true, "deviceId": "...", "timestamp": 42, "hmac": "..." }
}
```

**Response:**
```json
{
  "proof": { ... },
  "publicSignals": ["..."],
  "commitment": "...",
  "nonce": "..."
}
```

### `POST /api/prove`

Verifies the proof and returns result.

**Request:**
```json
{
  "proof": { ... },
  "publicSignals": ["..."],
  "nonce": "...",
  "commitment": "...",
  "bleWitness": { ... }
}
```

**Response:**
```json
{
  "verified": true,
  "confidence": 1.0,
  "bleStatus": "verified"
}
```

**Rate limit:** configurable via `RATE_LIMIT_MAX` (default: 20 req/min per IP).

---

## ESP32 deployment

Mount the ESP32 at the **approved physical location** (not carried by the user):

```
Approved location (e.g. office room)
  └── ESP32 on wall/desk — powered, BLE broadcasting
        └── User walks in → browser detects BLE → confidence 100%
        └── User outside → BLE out of range → confidence 30%
```

The ESP32 broadcasts a HMAC-signed payload every 500ms. The backend verifies the HMAC using the shared `BLE_SECRET`. Only an ESP32 with the correct secret produces a valid witness.

---

## License

MIT
