import { useEffect, useRef } from "react";
import { cellToBoundary } from "h3-js";

export default function H3Map({ h3Index, verified, confidence }) {
  const mapRef = useRef(null);
  const instanceRef = useRef(null);
  const polygonRef = useRef(null);

  const getColor = (v, c) => {
    if (v === false) return "#ef4444";           // red — denied
    if (v === true && c >= 0.9) return "#10b981"; // green — 100%
    if (v === true && c >= 0.5) return "#f59e0b"; // orange — 40%
    if (v === true) return "#fbbf24";             // yellow — 30%
    return "#6366f1";                             // purple — pending
  };

  useEffect(() => {
    if (!h3Index || !window.L) return;

    const L = window.L;
    const boundary = cellToBoundary(h3Index);
    const center = [
      boundary.reduce((s, c) => s + c[0], 0) / boundary.length,
      boundary.reduce((s, c) => s + c[1], 0) / boundary.length,
    ];

    if (!instanceRef.current) {
      instanceRef.current = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView(center, 13);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(instanceRef.current);
    } else {
      instanceRef.current.setView(center, 13);
    }

    if (polygonRef.current) polygonRef.current.remove();

    const color = getColor(verified, confidence);
    polygonRef.current = window.L.polygon(boundary, {
      color,
      fillColor: color,
      fillOpacity: 0.3,
      weight: 2,
    }).addTo(instanceRef.current);

    polygonRef.current
      .bindPopup(`<span style="font-family:monospace;font-size:12px">${h3Index}</span>`)
      .openPopup();

  }, [h3Index]);

  useEffect(() => {
    if (!polygonRef.current) return;
    const color = getColor(verified, confidence);
    polygonRef.current.setStyle({ color, fillColor: color });
  }, [verified, confidence]);

  const color = getColor(verified, confidence);

  return (
    <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden", border: `1px solid ${color}60`, height: "360px", marginTop: "12px", transition: "border-color 0.4s ease" }}>
      <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
      <div style={{
        position: "absolute", bottom: "10px", left: "10px",
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)",
        border: `1px solid ${color}60`,
        borderRadius: "8px", padding: "5px 10px",
        fontSize: "11px", color,
        fontFamily: "monospace", zIndex: 1000, pointerEvents: "none",
        transition: "all 0.4s ease"
      }}>
        {h3Index}
      </div>
    </div>
  );
}
