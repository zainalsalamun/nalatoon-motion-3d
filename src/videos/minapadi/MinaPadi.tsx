import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { LensBlur } from "../bridge/lensblur";
import { MinaPadiWorld } from "./minaWorld";
import { TOTAL, layersAt, dofAt } from "./story";
import { StudioOverlay } from "../../components/StudioOverlay";
import type { BoardConfig, StudioSceneProps } from "../../types/studioProps";

export const MINA_PADI_FRAMES = TOTAL;

const makeBloom = () => {
  const b = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    intensity: 0.28,
    luminanceThreshold: 1.05,
    luminanceSmoothing: 0.28,
    mipmapBlur: true,
    levels: 5,
    radius: 0.55,
  });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const fwd = new THREE.Vector3();

const Inner: React.FC<{ id: number; board?: Partial<BoardConfig>; exposure?: number; lite: boolean }> = ({
  id,
  board,
  exposure,
  lite,
}) => {
  const f = useCurrentFrame();
  const { camera, scene, gl } = useThree();
  const world = useMemo(() => new MinaPadiWorld(board, lite), [lite]);
  const target = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => () => world.dispose(), [world]);

  const boardKey = JSON.stringify(board || null);
  useEffect(() => {
    world.setBoard(board);
  }, [world, boardKey]);

  useEffect(() => {
    gl.toneMapping = lite ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    gl.toneMappingExposure = exposure ?? 1.06;
  }, [gl, exposure, lite]);

  const fx = useMemo(
    () =>
      lite
        ? null
        : {
            lens: new LensBlur({ maxCoC: 24, nearScale: 1.15 }),
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
  target.copy(world.update(id, f, cam, scene));

  if (fx) {
    const d = dofAt(f);
    cam.getWorldDirection(fwd);
    fx.lens.focus = Math.max(0.5, target.clone().sub(cam.position).dot(fwd));
    fx.lens.cInf = d.cInf;
  }

  return (
    <>
      <primitive object={world.root} dispose={null} />
      {post}
    </>
  );
};

const ShotView: React.FC<{
  id: number;
  alpha: number;
  board?: Partial<BoardConfig>;
  exposure?: number;
  lite: boolean;
}> = ({ id, alpha, board, exposure, lite }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas
      width={lite ? 540 : 1080}
      height={lite ? 960 : 1920}
      dpr={lite ? 1 : undefined}
      shadows={lite ? false : "percentage"}
      gl={{
        antialias: !lite,
        stencil: false,
        powerPreference: lite ? "low-power" : "high-performance",
        toneMappingExposure: exposure ?? 1.06,
      }}
      camera={{ fov: 42, near: 0.2, far: 1200 }}
      style={lite ? { width: "100%", height: "100%" } : undefined}
    >
      <Inner id={id} board={board} exposure={exposure} lite={lite} />
    </ThreeCanvas>
  </AbsoluteFill>
);

export const MinaPadiShort: React.FC<StudioSceneProps> = (props) => {
  const f = useCurrentFrame();
  const lite = props.previewMode === "lite";
  const layers = layersAt(f);
  const visibleLayers = lite ? layers.slice(-1) : layers;
  return (
    <AbsoluteFill style={{ background: "#b7daf5" }}>
      {visibleLayers.map((l, i) => (
        <ShotView
          key={lite ? "lite-single" : i ? "over" : "base"}
          id={l.id}
          alpha={lite ? 1 : l.alpha}
          board={props.board}
          exposure={props.exposure}
          lite={lite}
        />
      ))}
      <StudioOverlay {...props} />
    </AbsoluteFill>
  );
};
