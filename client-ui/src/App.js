import { useState } from "react";
import { getH3 } from "./h3Helper";
import { generateProof } from "./proof";
import { sendProof } from "./api";
import { scanBLE } from "./ble";
import H3Map from "./H3Map";

export default function App() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locationInfo, setLocationInfo] = useState(null);
  const [step, setStep] = useState("");
  const [bleStatus, setBleStatus] = useState(null);

  const handleVerify = async () => {
    const bleWitness = await scanBLE();
    setLoading(true);
    setError(null);
    setResult(null);
    setBleStatus(bleWitness.available ? "found" : "not_found");
    setStep("Requesting location...");
    try {
      const { latitude, longitude } = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(
          pos => resolve(pos.coords),
          () => reject(new Error("Location access denied"))
        )
      );
      const h3Index = getH3(latitude, longitude);
      setLocationInfo({ lat: latitude.toFixed(6), lon: longitude.toFixed(6), h3Index });
      setStep("Generating zk proof...");
      const salt = BigInt(Math.floor(Math.random() * 1e15));
      const nonce = BigInt(Date.now());
      const pd = await generateProof(h3Index, salt, nonce, bleWitness);
      setStep("Verifying on server...");
      const response = await sendProof(pd);
      setResult(response);
      setStep("");
    } catch (e) {
      setError(e.message);
      setStep("");
    } finally {
      setLoading(false);
    }
  };

  const confidence = result?.confidence ?? 0;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f0f4ff; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fillBar { from { width:0 } }
        .fade { animation: fadeUp 0.35s ease forwards; }
        .pulse { animation: pulse 1.5s ease infinite; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #eef2ff 0%, #faf5ff 50%, #eff6ff 100%)", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

        {/* Header */}
        <header style={{ padding: "22px 5vw", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(99,102,241,0.12)", background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>🔐</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "20px", color: "#1e1b4b" }}>Geo-Private</div>
              <div style={{ color: "#9ca3af", fontSize: "13px" }}>Privacy-preserving location verification</div>
            </div>
          </div>
          <span style={{ background: "#ede9fe", border: "1px solid #c4b5fd", color: "#7c3aed", fontSize: "13px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", padding: "8px 18px", borderRadius: "999px" }}>
            ZK-SNARK · groth16
          </span>
        </header>

        {/* Main two-column — full width */}
        <main style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0", minHeight: "calc(100vh - 80px)" }}>

          {/* LEFT */}
          <div style={{ padding: "72px 5vw 72px 6vw", display: "flex", flexDirection: "column", justifyContent: "center", borderRight: "1px solid rgba(99,102,241,0.08)" }}>
            <p style={{ color: "#6366f1", fontSize: "14px", fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: "16px" }}>Privacy-Preserving Location</p>
            <h1 style={{ fontSize: "clamp(40px, 4vw, 64px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-1.5px", marginBottom: "24px", color: "#1e1b4b" }}>
              Prove where you are.<br />
              <span style={{ background: "linear-gradient(135deg, #6366f1, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Reveal nothing.
              </span>
            </h1>
            <p style={{ color: "#6b7280", fontSize: "18px", lineHeight: 1.7, marginBottom: "40px", maxWidth: "520px" }}>
              Generate a cryptographic proof that you're inside an approved region — without exposing your exact coordinates to anyone.
            </p>

            <button
              onClick={handleVerify}
              disabled={loading}
              style={{
                padding: "18px 36px", borderRadius: "16px", border: "none",
                background: loading ? "#e0e7ff" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: loading ? "#a5b4fc" : "#fff",
                fontSize: "18px", fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: "12px",
                width: "fit-content",
                boxShadow: loading ? "none" : "0 10px 30px rgba(99,102,241,0.35)",
              }}
            >
              {loading ? (
                <>
                  <span style={{ width: "18px", height: "18px", border: "2px solid #c7d2fe", borderTop: "2px solid #6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
                  <span className="pulse">{step}</span>
                </>
              ) : <><span>📍</span> Verify My Location</>}
            </button>

            {error && (
              <div className="fade" style={{ marginTop: "20px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "14px", padding: "16px 20px", color: "#dc2626", fontSize: "16px" }}>
                ⚠️ {error}
              </div>
            )}

            {/* BLE Status */}
            {bleStatus && (
              <div className="fade" style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "14px", background: bleStatus === "found" ? "#f0fdf4" : "#fefce8", border: `1px solid ${bleStatus === "found" ? "#86efac" : "#fde68a"}`, borderRadius: "14px", padding: "16px 20px" }}>
                <span style={{ fontSize: "24px" }}>{bleStatus === "found" ? "📡" : "⚠️"}</span>
                <div>
                  <p style={{ fontSize: "16px", fontWeight: 700, color: bleStatus === "found" ? "#15803d" : "#92400e", marginBottom: "2px" }}>
                    {bleStatus === "found" ? "ESP32 Detected" : "ESP32 Not Found"}
                  </p>
                  <p style={{ fontSize: "14px", color: bleStatus === "found" ? "#16a34a" : "#b45309" }}>
                    {bleStatus === "found" ? "BLE witness captured — anti-spoofing active" : "Proceeding without hardware witness — confidence reduced"}
                  </p>
                </div>
              </div>
            )}

            {/* Guarantees */}
            <div style={{ marginTop: "48px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {[
                { ok: true,  text: "Server never sees your coordinates" },
                { ok: true,  text: "Proof is single-use — nonce bound in circuit" },
                { ok: false, text: "Cannot verify you're physically present" },
              ].map(({ ok, text }, i) => (
                <div key={i} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "18px" }}>{ok ? "✅" : "❌"}</span>
                  <span style={{ color: "#6b7280", fontSize: "16px" }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT */}
          <div style={{ padding: "72px 6vw 72px 5vw", display: "flex", flexDirection: "column", gap: "20px", justifyContent: "center" }}>

            {!locationInfo && !error && (
              <div style={{ background: "white", border: "2px dashed #e0e7ff", borderRadius: "24px", padding: "80px 40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", flex: 1 }}>
                <div style={{ fontSize: "64px", opacity: 0.2 }}>🗺️</div>
                <p style={{ color: "#9ca3af", fontSize: "18px" }}>Click "Verify My Location" to begin</p>
              </div>
            )}

            {locationInfo && (
              <div className="fade" style={{ background: "white", border: "1px solid #e0e7ff", borderRadius: "24px", padding: "28px", boxShadow: "0 4px 24px rgba(99,102,241,0.07)" }}>
                <p style={{ color: "#9ca3af", fontSize: "12px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "18px" }}>📍 Location Detected</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                  {[{ label: "Latitude", value: locationInfo.lat }, { label: "Longitude", value: locationInfo.lon }].map(({ label, value }) => (
                    <div key={label} style={{ background: "#f8faff", border: "1px solid #e0e7ff", borderRadius: "12px", padding: "16px" }}>
                      <p style={{ color: "#9ca3af", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "6px" }}>{label}</p>
                      <p style={{ color: "#1e1b4b", fontFamily: "monospace", fontSize: "16px", fontWeight: 700 }}>{value}</p>
                    </div>
                  ))}
                </div>
                <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: "12px", padding: "16px", marginBottom: "14px" }}>
                  <p style={{ color: "#a78bfa", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "6px" }}>H3 Cell</p>
                  <p style={{ color: "#6366f1", fontFamily: "monospace", fontSize: "16px", fontWeight: 700 }}>{locationInfo.h3Index}</p>
                </div>
                <H3Map h3Index={locationInfo.h3Index} verified={result ? result.verified : null} />
              </div>
            )}

            {result && (
              <div className="fade" style={{
                background: result.verified ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${result.verified ? "#86efac" : "#fecaca"}`,
                borderRadius: "24px", padding: "36px", textAlign: "center",
                boxShadow: result.verified ? "0 4px 24px rgba(16,185,129,0.1)" : "0 4px 24px rgba(239,68,68,0.1)"
              }}>
                <div style={{ fontSize: "56px", marginBottom: "14px" }}>{result.verified ? "✅" : "❌"}</div>
                <p style={{ fontSize: "28px", fontWeight: 800, marginBottom: "8px", color: result.verified ? "#15803d" : "#dc2626" }}>
                  {result.verified ? "Access Granted" : "Access Denied"}
                </p>
                <p style={{ color: "#6b7280", fontSize: "16px", marginBottom: result.verified ? "24px" : "8px" }}>
                  {result.verified ? "Location verified inside approved region" : "H3 cell not in approved region"}
                </p>
                {result.bleStatus && (
                  <p style={{ fontSize: "15px", color: result.bleStatus === "verified" ? "#16a34a" : "#9ca3af", marginBottom: result.verified ? "16px" : 0 }}>
                    BLE: {{
                      verified:        "✅ Hardware witness verified",
                      no_device:       "⚠️ No ESP32 witness",
                      hmac_failed:     "❌ HMAC verification failed",
                      invalid_payload: "❌ Invalid BLE payload",
                    }[result.bleStatus] || result.bleStatus}
                  </p>
                )}
                {result.verified && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ color: "#9ca3af", fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>Confidence</span>
                      <span style={{ color: "#16a34a", fontSize: "16px", fontWeight: 800 }}>{(confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ background: "#dcfce7", borderRadius: "999px", height: "10px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${confidence * 100}%`, background: "linear-gradient(90deg, #16a34a, #22c55e)", borderRadius: "999px", animation: "fillBar 0.8s ease" }} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer style={{ padding: "20px 5vw", borderTop: "1px solid rgba(99,102,241,0.08)", background: "rgba(255,255,255,0.6)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#9ca3af", fontSize: "14px" }}>Geo-Private · Privacy-preserving location verification</span>
          <span style={{ color: "#9ca3af", fontSize: "14px" }}>groth16 · Poseidon · H3 · Circom 2</span>
        </footer>
      </div>
    </>
  );
}
