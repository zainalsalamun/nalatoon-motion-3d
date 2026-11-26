import * as THREE from "three";

export type CafeLight = "day" | "golden" | "dusk";

export type CafeLightPreset = {
  az: number; el: number;
  sunCol: string; sunInt: number;
  hemiSky: string; hemiGnd: string; hemiInt: number;
  fillCol: string; fillInt: number;
  lit: [number, number, number]; shade: [number, number, number]; lift: [number, number, number];
  fogCol: string; fogNear: number; fogFar: number;
  sky: [string, string, string, string, string];
  cloudCol: string; sunDisc: number;
};

export const CAFE_LIGHTS: Record<CafeLight, CafeLightPreset> = {
  day: {
    az: 68, el: 48,
    sunCol: "#fff4de", sunInt: 3.1,
    hemiSky: "#84b6f0", hemiGnd: "#9f8769", hemiInt: 1.45,
    fillCol: "#b8d0f2", fillInt: 0.42,
    lit: [1.54, 1.46, 1.32], shade: [0.34, 0.34, 0.44], lift: [0.06, 0.07, 0.12],
    fogCol: "#bdd4f0", fogNear: 28, fogFar: 260,
    sky: ["#3e82d6", "#6aa2e6", "#98c0ef", "#bdd4f0", "#d4e3f6"],
    cloudCol: "#eef4fb", sunDisc: 0,
  },
  golden: {
    az: 18, el: 12,
    sunCol: "#ffad5c", sunInt: 3.4,
    hemiSky: "#f2a07a", hemiGnd: "#6e5272", hemiInt: 1.35,
    fillCol: "#7d79b5", fillInt: 0.45,
    lit: [1.62, 1.18, 0.86], shade: [0.28, 0.27, 0.46], lift: [0.08, 0.06, 0.14],
    fogCol: "#e6a882", fogNear: 24, fogFar: 220,
    sky: ["#4e5a94", "#8a6d96", "#cc8380", "#f2a878", "#ffd296"],
    cloudCol: "#ffe0bd", sunDisc: 1,
  },
  dusk: {
    az: -28, el: 8,
    sunCol: "#ff9b52", sunInt: 1.85,
    hemiSky: "#5a6ea8", hemiGnd: "#3d3354", hemiInt: 1.25,
    fillCol: "#6372b0", fillInt: 0.48,
    lit: [1.38, 1.08, 0.92], shade: [0.24, 0.25, 0.45], lift: [0.07, 0.08, 0.16],
    fogCol: "#5f6a96", fogNear: 22, fogFar: 200,
    sky: ["#1a2752", "#2f3e73", "#54558a", "#9c6d7e", "#e09878"],
    cloudCol: "#c99696", sunDisc: 0.45,
  },
};

export const CAFE_GRADE: Record<CafeLight, { sat: number; contrast: number; lift: [number, number, number] }> = {
  day:    { sat: 1.08, contrast: 1.04, lift: [0, 0, 0] },
  golden: { sat: 1.14, contrast: 1.06, lift: [0.01, -0.005, 0.015] },
  dusk:   { sat: 1.12, contrast: 1.07, lift: [0.005, 0.005, 0.025] },
};

export const dirFromAngles = (azDeg: number, elDeg: number) => {
  const az = (azDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
};
