import { CafeLight } from "../cafe/cafeLights";

export const FPS = 30;
export const TOTAL = 2657; // 88.57s exact — Audio-First locked to Qwen3-TTS Studio Voice (ZERO dark outro, seamless loop!)
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
};
export const glide = (u: number) => {
  const x = clamp01(u);
  return x * x * x * (x * (6 * x - 15) + 10);
};

export type MinaShot = {
  id: number;
  a: number;
  b: number;
  light: CafeLight;
};

// Audio-First exact frame timings from minapadi_shots_timing.json!
export const SHOTS: MinaShot[] = [
  { id: 1,  a: 0,    b: 137,  light: "day" },
  { id: 2,  a: 137,  b: 313,  light: "day" },
  { id: 3,  a: 313,  b: 478,  light: "day" },
  { id: 4,  a: 478,  b: 648,  light: "day" },
  { id: 5,  a: 648,  b: 819,  light: "day" },
  { id: 6,  a: 819,  b: 975,  light: "day" },
  { id: 7,  a: 975,  b: 1151, light: "day" },
  { id: 8,  a: 1151, b: 1319, light: "day" },
  { id: 9,  a: 1319, b: 1496, light: "day" },
  { id: 10, a: 1496, b: 1684, light: "golden" },
  { id: 11, a: 1684, b: 1827, light: "golden" },
  { id: 12, a: 1827, b: 2009, light: "golden" },
  { id: 13, a: 2009, b: 2200, light: "golden" },
  { id: 14, a: 2200, b: 2324, light: "golden" },
  { id: 15, a: 2324, b: 2459, light: "day" },
  { id: 16, a: 2459, b: TOTAL, light: "day" },
];

export const XFADE: Record<number, number> = { 10: 6, 15: 6 };

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) {
      return [
        { id: s.id - 1, alpha: 1 },
        { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) },
      ];
    }
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

export type Cam = { pos: V3; look: V3; fov: number; roll: number };

const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: [
    a.pos[0] + (b.pos[0] - a.pos[0]) * k,
    a.pos[1] + (b.pos[1] - a.pos[1]) * k,
    a.pos[2] + (b.pos[2] - a.pos[2]) * k,
  ],
  look: [
    a.look[0] + (b.look[0] - a.look[0]) * k,
    a.look[1] + (b.look[1] - a.look[1]) * k,
    a.look[2] + (b.look[2] - a.look[2]) * k,
  ],
  fov: a.fov + (b.fov - a.fov) * k,
  roll: a.roll + (b.roll - a.roll) * k,
});

export const camAt = (id: number, f: number): Cam => {
  const s = SHOTS[id - 1];
  const u = clamp01((f - s.a) / Math.max(1, s.b - s.a));
  const e = glide(u);

  switch (id) {
    case 1: {
      // Low water-level close-up: golden carp splashing out of bamboo basket into green flooded paddy!
      const a: Cam = { pos: [3.2, 1.35, 10.6], look: [1.8, 0.42, 6.2], fov: 42, roll: -0.012 };
      const b: Cam = { pos: [3.7, 1.5,  9.2],  look: [2.4, 0.38, 5.2], fov: 40, roll: 0.01 };
      return mix(a, b, e);
    }
    case 2: {
      // Confrontation on mossy bund: Pak Darto panicked vs calm smiling Pak Budi!
      const a: Cam = { pos: [0.1, 1.78, 12.6], look: [0.0, 1.32, 6.8], fov: 42, roll: 0.01 };
      const b: Cam = { pos: [-0.2, 1.68, 11.4], look: [0.0, 1.32, 6.8], fov: 40, roll: -0.01 };
      return mix(a, b, e);
    }
    case 3: {
      // High 45° scenic establishing showing Deep Perimeter Fish Trench (Caren) + bamboo sluice gate!
      const a: Cam = { pos: [0.2, 5.6, 15.6], look: [1.8, 0.8, 1.5], fov: 45, roll: 0 };
      const b: Cam = { pos: [2.2, 4.2, 12.2], look: [2.8, 0.7, -1.5], fov: 43, roll: 0 };
      return mix(a, b, e);
    }
    case 4: {
      // Left field tracking: Pak Darto sweating scooping pests manually in the sun!
      const a: Cam = { pos: [-1.8, 1.9, 11.2], look: [-4.1, 1.15, 4.6], fov: 42, roll: -0.012 };
      const b: Cam = { pos: [-1.4, 1.75, 7.8], look: [-4.1, 1.15, 1.4], fov: 40, roll: 0.012 };
      return mix(a, b, e);
    }
    case 5: {
      // Water-surface glide inside Right field: schools of glowing golden carp patrolling between rice rows!
      const a: Cam = { pos: [2.4, 1.35, 10.6], look: [4.2, 0.3, 2.5], fov: 42, roll: 0 };
      const b: Cam = { pos: [3.6, 1.25, 6.8],  look: [4.8, 0.28, -0.5], fov: 41, roll: 0.01 };
      return mix(a, b, e);
    }
    case 6: {
      // Tight macro close-up: bright 3D golden carp leaping up to snap brown planthopper pest (unobstructed!)
      const a: Cam = { pos: [4.25, 0.94, 6.15], look: [3.05, 0.45, 4.2], fov: 36, roll: -0.01 };
      const b: Cam = { pos: [3.85, 0.88, 5.55], look: [3.05, 0.45, 4.2], fov: 34, roll: 0.01 };
      return mix(a, b, e);
    }
    case 7: {
      // Side water-level tracking: fish tails swirling oxygen bubbles through rice roots!
      const a: Cam = { pos: [1.5, 1.32, 7.8], look: [4.4, 0.35, 3.0], fov: 41, roll: 0.01 };
      const b: Cam = { pos: [1.6, 1.24, 5.0], look: [4.6, 0.35, 0.8], fov: 40, roll: -0.01 };
      return mix(a, b, e);
    }
    case 8: {
      // Low heroic angle through lush thriving emerald rice stalks + nutrient sparkles!
      const a: Cam = { pos: [5.2, 0.82, 8.2], look: [3.4, 1.15, 2.5], fov: 43, roll: -0.012 };
      const b: Cam = { pos: [4.0, 1.15, 6.8], look: [3.2, 1.25, 1.5], fov: 41, roll: 0.01 };
      return mix(a, b, e);
    }
    case 9: {
      // High 45° split-field contrast: patchy Left field vs lush towering Right field gleaming with golden carp!
      const a: Cam = { pos: [0.0, 6.4, 14.2], look: [0.0, 0.8, 0.5], fov: 46, roll: 0 };
      const b: Cam = { pos: [0.0, 5.2, 11.2], look: [0.0, 0.8, -1.5], fov: 44, roll: 0 };
      return mix(a, b, e);
    }
    case 10: {
      // Golden afternoon: Pak Budi lifting bamboo sluice gate as carp gather into deep perimeter trench!
      const a: Cam = { pos: [1.8, 2.15, 11.8], look: [1.1, 0.85, 5.5], fov: 42, roll: 0 };
      const b: Cam = { pos: [1.1, 1.95, 10.4], look: [1.1, 0.78, 5.5], fov: 40, roll: -0.01 };
      return mix(a, b, e);
    }
    case 11: {
      // Comedic close-up: plump golden carp splashing playfully in deep trench beside Pak Budi's scoop net!
      const a: Cam = { pos: [2.8, 1.52, 8.4], look: [1.35, 0.38, 4.8], fov: 38, roll: 0.012 };
      const b: Cam = { pos: [2.3, 1.42, 7.6], look: [1.35, 0.38, 4.8], fov: 36, roll: -0.012 };
      return mix(a, b, e);
    }
    case 12: {
      // Face-on view of the ONE diegetic wooden comparison signboard (SISTEM MINA PADI) cleanly framed inside 9:16!
      const a: Cam = { pos: [2.6, 2.32, 12.1], look: [2.6, 2.22, 4.2], fov: 44, roll: 0 };
      const b: Cam = { pos: [2.6, 2.28, 11.4], look: [2.6, 2.22, 4.2], fov: 42, roll: 0 };
      return mix(a, b, e);
    }
    case 13: {
      // Golden sunset double harvest: proud Pak Budi + wooden bucket overflowing with golden carp + golden paddy!
      const a: Cam = { pos: [1.55, 2.15, 12.6], look: [0.55, 1.25, 5.6], fov: 43, roll: -0.01 };
      const b: Cam = { pos: [1.05, 1.92, 11.2], look: [0.45, 1.22, 5.6], fov: 41, roll: 0.01 };
      return mix(a, b, e);
    }
    case 14: {
      // Comedic reaction: Pak Darto jaw-dropped staring across bund holding bucket & tiny fishing rod!
      const a: Cam = { pos: [-0.55, 1.78, 11.6], look: [-0.35, 1.32, 6.4], fov: 40, roll: 0.012 };
      const b: Cam = { pos: [-0.65, 1.68, 10.6], look: [-0.35, 1.32, 6.4], fov: 38, roll: -0.01 };
      return mix(a, b, e);
    }
    case 15: {
      // Next morning sunny daylight: freshly dug deep clear-water trench + fish bucket on Pak Darto's Left Field!
      const a: Cam = { pos: [-0.5, 2.35, 12.4], look: [-1.5, 0.55, 5.8], fov: 42, roll: -0.01 };
      const b: Cam = { pos: [-1.1, 2.05, 11.0], look: [-1.5, 0.55, 5.8], fov: 40, roll: 0.01 };
      return mix(a, b, e);
    }
    default: {
      // Shot 16 Comedic Loop Payoff: Pak Darto cheering joyfully pouring carp into Left Field while Pak Budi waves laughing!
      const a: Cam = { pos: [-0.9, 2.45, 14.2], look: [-1.35, 1.18, 5.2], fov: 45, roll: -0.01 };
      const b: Cam = { pos: [-1.35, 2.15, 12.6], look: [-1.75, 1.15, 4.4], fov: 43, roll: 0.012 };
      return mix(a, b, e);
    }
  }
};

export const dofAt = (f: number): { cInf: number } => {
  const id = shotAt(f).id;
  if (id === 3 || id === 9) return { cInf: 3.5 };
  if (id === 1 || id === 6 || id === 11 || id === 14 || id === 15) return { cInf: 14.0 };
  return { cInf: 8.5 };
};
