import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { LensBlur } from "../bridge/lensblur";
import { MinaPadiWorld } from "./minaWorld";
import { TOTAL, layersAt, dofAt } from "./story";

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

const Inner: React.FC<{ id: number }> = ({ id }) => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new MinaPadiWorld(), []);
  const target = useMemo(() => new THREE.Vector3(), []);

  const fx = useMemo(() => ({
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.15 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
  }), []);

  const post = useMemo(() => (
    <EffectComposer multisampling={4}>
      <primitive object={fx.lens.pre} dispose={null} />
      <primitive object={fx.lens.main} dispose={null} />
      <primitive object={fx.bloom} dispose={null} />
      <primitive object={fx.tone} dispose={null} />
    </EffectComposer>
  ), [fx]);

  const cam = camera as THREE.PerspectiveCamera;
  target.copy(world.update(id, f, cam, scene));

  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  fx.lens.focus = Math.max(0.5, target.clone().sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;

  return (
    <>
      <primitive object={world.root} dispose={null} />
      {post}
    </>
  );
};

const ShotView: React.FC<{ id: number; alpha: number }> = ({ id, alpha }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas
      width={1080}
      height={1920}
      shadows="percentage"
      gl={{ antialias: true, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.06 }}
      camera={{ fov: 42, near: 0.2, far: 1200 }}
    >
      <Inner id={id} />
    </ThreeCanvas>
  </AbsoluteFill>
);

export const MinaPadiShort: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#b7daf5" }}>
      {layersAt(f).map((l, i) => <ShotView key={i ? "over" : "base"} id={l.id} alpha={l.alpha} />)}
    </AbsoluteFill>
  );
};
