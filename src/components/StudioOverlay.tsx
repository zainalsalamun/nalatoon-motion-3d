import React from "react";
import { AbsoluteFill } from "remotion";
import type { StudioSceneProps } from "../types/studioProps";

export const StudioOverlay: React.FC<StudioSceneProps> = ({
  subtitleText,
  subtitleAccent = false,
  showWatermark = false,
  watermarkText = "Powered by Naltech",
}) => {
  const cleanSub = (subtitleText || "").trim();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {cleanSub ? (
        <div
          style={{
            position: "absolute",
            left: 54,
            right: 54,
            bottom: 440,
            display: "flex",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontFamily: "'Avenir Next', 'Inter', -apple-system, sans-serif",
              fontWeight: 900,
              fontSize: 64,
              lineHeight: 1.15,
              color: subtitleAccent ? "#ffd633" : "#ffffff",
              WebkitTextStroke: "10px #121016",
              paintOrder: "stroke fill",
              textShadow: "0 8px 24px rgba(0,0,0,0.48)",
            }}
          >
            {cleanSub}
          </span>
        </div>
      ) : null}

      {showWatermark && watermarkText ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 72,
            textAlign: "center",
            fontFamily: "'Avenir Next', 'Inter', -apple-system, sans-serif",
            fontWeight: 700,
            fontSize: 28,
            letterSpacing: "0.02em",
            color: "rgba(255,255,255,0.88)",
            textShadow: "0 2px 10px rgba(0,0,0,0.7)",
          }}
        >
          {watermarkText}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
