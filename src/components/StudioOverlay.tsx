import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { StudioSceneProps } from "../types/studioProps";

export const StudioOverlay: React.FC<StudioSceneProps> = ({
  subtitleText,
  subtitleAccent = false,
  subtitleCues,
  showWatermark = false,
  watermarkText = "Powered by Naltech",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / Math.max(1, fps);

  let activeText = (subtitleText || "").trim();
  let activeAccent = subtitleAccent;

  if (subtitleCues && subtitleCues.length > 0) {
    const cue = subtitleCues.find((c) => sec >= c.startSec && sec < c.endSec);
    activeText = cue ? cue.text.trim() : "";
    activeAccent = Boolean(cue?.accent);
  }

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {activeText ? (
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
              fontFamily: "'Avenir Next', 'Plus Jakarta Sans', -apple-system, sans-serif",
              fontWeight: 900,
              fontSize: 60,
              lineHeight: 1.15,
              color: activeAccent ? "#ffd633" : "#ffffff",
              WebkitTextStroke: "10px #121016",
              paintOrder: "stroke fill",
              textShadow: "0 8px 24px rgba(0,0,0,0.48)",
            }}
          >
            {activeText}
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
            fontFamily: "'Avenir Next', 'Plus Jakarta Sans', -apple-system, sans-serif",
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
