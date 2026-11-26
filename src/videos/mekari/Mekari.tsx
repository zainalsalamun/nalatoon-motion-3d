import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { LensBlur } from "../bridge/lensblur";
import { MekariWorld, type SceneTiming } from "./mekariWorld";
import timingsData from "./timings.json";
import type { StudioSceneProps } from "../../types/studioProps";

export const MEKARI_FRAMES: number = timingsData.totalFrames;

const SCENE_BADGES: Record<number, { label: string; accent: string }> = {
  1: { label: "ILUSTRASI · 25 NOVEMBER 2026", accent: "#f59e0b" },
  2: { label: "LAPORAN MEDIA · 25–26 NOVEMBER", accent: "#38bdf8" },
  3: { label: "PEMBARUAN RESMI · 26 NOV 09.00 WIB", accent: "#f59e0b" },
  4: { label: "DIAGRAM ILUSTRASI KONSEPTUAL", accent: "#ef4444" },
  5: { label: "ILUSTRASI · TARGET 24 JAM (BERTAHAP)", accent: "#f59e0b" },
  6: { label: "STATUS DATA · BELUM TERKONFIRMASI", accent: "#f59e0b" },
  7: { label: "PESAN SIMULASI · TANPA TAUTAN AKTIF", accent: "#38bdf8" },
};

const makeBloom = () => {
  const b = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    intensity: 0.24,
    luminanceThreshold: 1.02,
    luminanceSmoothing: 0.3,
    mipmapBlur: true,
    levels: 5,
    radius: 0.5,
  });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const fwd = new THREE.Vector3();

const Inner: React.FC<{ exposure?: number; lite: boolean }> = ({ exposure, lite }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / Math.max(1, fps);
  const { camera, scene, gl } = useThree();
  const world = useMemo(() => new MekariWorld(lite), [lite]);
  const target = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => () => world.dispose(), [world]);

  useEffect(() => {
    gl.toneMapping = lite ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    gl.toneMappingExposure = exposure ?? 1.04;
  }, [gl, exposure, lite]);

  const fx = useMemo(
    () =>
      lite
        ? null
        : {
            lens: new LensBlur({ maxCoC: 18, nearScale: 1.08 }),
            bloom: makeBloom(),
            tone: new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
          },
    [lite],
  );

  const post = useMemo(
    () =>
      fx ? (
        <EffectComposer multisampling={4}>
          <primitive object={fx.lens.pre} dispose={null} />
          <primitive object={fx.lens.main} dispose={null} />
          <primitive object={fx.bloom} dispose={null} />
          <primitive object={fx.tone} dispose={null} />
        </EffectComposer>
      ) : null,
    [fx],
  );

  const cam = camera as THREE.PerspectiveCamera;
  target.copy(world.update(sec, timingsData.scenes as SceneTiming[], cam, scene));

  if (fx) {
    cam.getWorldDirection(fwd);
    fx.lens.focus = Math.max(0.8, target.clone().sub(cam.position).dot(fwd));
    fx.lens.cInf = 0.22;
  }

  return (
    <>
      <primitive object={world.root} dispose={null} />
      {post}
    </>
  );
};

export const MekariShort: React.FC<StudioSceneProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / Math.max(1, fps);
  const lite = props.previewMode === "lite";

  // Active scene & badge
  let activeScene = timingsData.scenes[0];
  for (const s of timingsData.scenes) {
    if (sec >= s.sceneStartSec) activeScene = s;
  }
  const badge = SCENE_BADGES[activeScene.id] || SCENE_BADGES[1];
  const badgeFrame = Math.max(0, Math.round((sec - activeScene.sceneStartSec) * fps));
  const badgeIn = spring({ frame: badgeFrame, fps, config: { damping: 18, stiffness: 160 } });

  // Active synced subtitle cue (either overridden from Web Studio or baked timings.json)
  const cues = props.subtitleCues && props.subtitleCues.length > 0 ? props.subtitleCues : timingsData.subtitles;
  const activeCue = cues.find((c) => sec >= c.startSec && sec < c.endSec);
  const cueLocalFrame = activeCue ? Math.max(0, Math.round((sec - activeCue.startSec) * fps)) : 0;
  const cuePop = activeCue
    ? spring({ frame: cueLocalFrame, fps, config: { damping: 16, stiffness: 220 } })
    : 0;

  // Clean Editorial Outro with Original Alpha NALTECH Logo + Official Source Caveat
  const outroStartFrame = Math.round(timingsData.outroStartSec * fps);
  const outroOpacity = interpolate(frame, [outroStartFrame - 6, outroStartFrame + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoSpring = spring({
    frame: Math.max(0, frame - outroStartFrame),
    fps,
    config: { damping: 16, stiffness: 130 },
  });

  const showWatermark = props.showWatermark !== false;
  const watermarkText = props.watermarkText || "Powered by Naltech";

  return (
    <AbsoluteFill style={{ background: "#0c1018" }}>
      {/* Layer 1: Continuous 3D Architectural Editorial World */}
      <ThreeCanvas
        width={1080}
        height={1920}
        dpr={lite ? 1 : undefined}
        shadows={lite ? false : "percentage"}
        gl={{
          antialias: !lite,
          stencil: false,
          powerPreference: lite ? "low-power" : "high-performance",
          toneMappingExposure: props.exposure ?? 1.04,
        }}
        camera={{ fov: 40, near: 0.2, far: 160 }}
      >
        <Inner exposure={props.exposure} lite={lite} />
      </ThreeCanvas>

      {/* Layer 2: Subtle Editorial Top & Bottom Vignette for Type Contrast */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(10,14,22,0.58) 0%, rgba(10,14,22,0) 20%, rgba(10,14,22,0) 68%, rgba(10,14,22,0.78) 100%)",
        }}
      />

      {/* Layer 3: Contextual Factual / Illustration Badge (Safe Zone Top-Left) */}
      {outroOpacity < 0.85 && (
        <div
          style={{
            position: "absolute",
            top: 96,
            left: 56,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 24px",
            borderRadius: 10,
            background: "rgba(15, 20, 32, 0.86)",
            border: `2px solid ${badge.accent}`,
            opacity: (1 - outroOpacity) * badgeIn,
            transform: `translateY(${(1 - badgeIn) * -18}px)`,
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: badge.accent,
            }}
          />
          <span
            style={{
              fontFamily: "'Avenir Next', 'Plus Jakarta Sans', -apple-system, sans-serif",
              fontWeight: 800,
              fontSize: 25,
              letterSpacing: "0.06em",
              color: "#f8fafc",
            }}
          >
            {badge.label}
          </span>
        </div>
      )}

      {/* Layer 4: Synced Editorial Subtitle (Middle-Lower Safe Zone, Above Watermark) */}
      {activeCue && outroOpacity < 0.5 && (
        <div
          style={{
            position: "absolute",
            left: 60,
            right: 60,
            bottom: 240,
            display: "flex",
            justifyContent: "center",
            textAlign: "center",
            opacity: (1 - outroOpacity * 2) * cuePop,
            transform: `translateY(${(1 - cuePop) * 18}px) scale(${0.95 + cuePop * 0.05})`,
          }}
        >
          <span
            style={{
              fontFamily: "'Avenir Next', 'Plus Jakarta Sans', -apple-system, sans-serif",
              fontWeight: 900,
              fontSize: 56,
              lineHeight: 1.18,
              color: activeCue.accent ? "#fbbf24" : "#ffffff",
              WebkitTextStroke: "10px #0b0f18",
              paintOrder: "stroke fill",
              textShadow: "0 8px 26px rgba(0,0,0,0.65)",
            }}
          >
            {activeCue.text}
          </span>
        </div>
      )}

      {/* Layer 5: Persistent Source Caveat on Final Scene + Original Alpha NALTECH Logo Outro */}
      {outroOpacity > 0.01 && (
        <AbsoluteFill
          style={{
            background: "#0a0e16",
            opacity: outroOpacity,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 76px",
            gap: 34,
          }}
        >
          <div
            style={{
              transform: `scale(${0.86 + logoSpring * 0.14}) translateY(${(1 - logoSpring) * 24}px)`,
              opacity: logoSpring,
            }}
          >
            <Img
              src={staticFile("naltech_logo_transparent.png")}
              style={{ width: 340, height: 340, objectFit: "contain" }}
            />
          </div>

          <div
            style={{
              textAlign: "center",
              padding: "20px 32px",
              borderRadius: 12,
              background: "rgba(22, 31, 48, 0.85)",
              border: "2px solid rgba(56, 189, 248, 0.45)",
              opacity: logoSpring,
              transform: `translateY(${(1 - logoSpring) * 18}px)`,
            }}
          >
            <div
              style={{
                fontFamily: "'Avenir Next', 'Plus Jakarta Sans', sans-serif",
                fontWeight: 800,
                fontSize: 30,
                color: "#38bdf8",
                marginBottom: 8,
              }}
            >
              Kanal Resmi: mekari.com/announcement
            </div>
            <div
              style={{
                fontFamily: "'Avenir Next', 'Plus Jakarta Sans', sans-serif",
                fontWeight: 600,
                fontSize: 25,
                color: "#cbd5e1",
                lineHeight: 1.4,
              }}
            >
              Berdasarkan pembaruan 26 November 2026, 09.00 WIB — dapat berubah
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* Exact Watermark: bottom 42px per brief */}
      {showWatermark && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 42,
            textAlign: "center",
            fontFamily: "'Avenir Next', 'Plus Jakarta Sans', sans-serif",
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: "0.03em",
            color: "rgba(241, 245, 249, 0.86)",
            textShadow: "0 2px 10px rgba(0,0,0,0.75)",
          }}
        >
          {watermarkText}
        </div>
      )}
    </AbsoluteFill>
  );
};
