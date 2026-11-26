import { CafeLight } from "../cafe/cafeLights";

export const FPS = 30;
export const TOTAL = 2626; // 87.53s exact — Audio-First locked 100% to real user voice (ZERO dark outro for seamless auto-loop!)
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

export type PadiShot = {
  id: number;
  a: number;
  b: number;
  light: CafeLight;
};

// 16 Audio-First frame-accurate shots locked to real user storytelling voice (v3_shots_timing.json)!
export const SHOTS: PadiShot[] = [
  { id: 1,  a: 0,    b: 138,  light: "day" },    // 0.00 - 4.60s: Ducks splashing out of crate into green rice!
  { id: 2,  a: 138,  b: 255,  light: "day" },    // 4.60 - 8.50s: Confrontation on bund: Pak Darto panicked vs calm Pak Budi
  { id: 3,  a: 255,  b: 381,  light: "day" },    // 8.50 - 12.70s: High two-field establishing + Pak Budi relaxing in bamboo saung
  { id: 4,  a: 381,  b: 533,  light: "day" },    // 12.70 - 17.77s: Left field tracking: Pak Darto sweating & spraying pesticide
  { id: 5,  a: 533,  b: 673,  light: "day" },    // 17.77 - 22.43s: Low water-level glide inside Right field: ducks paddling cleanly!
  { id: 6,  a: 673,  b: 866,  light: "day" },    // 22.43 - 28.87s: Close-up: duck dipping head to gobble 3D golden snail (keong mas)!
  { id: 7,  a: 866,  b: 998,  light: "day" },    // 28.87 - 33.27s: Side tracking: ducks stirring mud water so weeds can't grow
  { id: 8,  a: 998,  b: 1188, light: "day" },    // 33.27 - 39.60s: Low upward angle through thriving emerald rice stalks + sparkles
  { id: 9,  a: 1188, b: 1362, light: "day" },    // 39.60 - 45.40s: High split comparison: patchy Left field vs lush emerald Right field!
  { id: 10, a: 1362, b: 1564, light: "golden" }, // 45.40 - 52.13s: Golden afternoon: Pak Budi whistling ducks back onto bund
  { id: 11, a: 1564, b: 1725, light: "golden" }, // 52.13 - 57.50s: Comedic close-up: cheeky duck eyeing golden rice panicles!
  { id: 12, a: 1725, b: 1936, light: "golden" }, // 57.50 - 64.53s: Diegetic wooden signboard planted in mud (BIASA vs BEBEK)
  { id: 13, a: 1936, b: 2127, light: "golden" }, // 64.53 - 70.90s: Golden harvest: Budi's golden field + basket of duck eggs!
  { id: 14, a: 2127, b: 2281, light: "golden" }, // 70.90 - 76.03s: Reaction close-up: Pak Darto stunned staring across the bund!
  { id: 15, a: 2281, b: 2443, light: "day" },    // 76.03 - 81.43s: Next season morning: Pak Darto's green sprayer sits abandoned on bund!
  { id: 16, a: 2443, b: TOTAL, light: "day" },   // 81.43 - 87.53s: Comedic loop payoff: Pak Darto chasing his own new ducks!
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

// Single Super-Detailed Indonesian Rice Paddy World Coordinate Map:
// - Central Grass Bund (Pematang Sawah): x in [-0.7, 0.7], y = 0.42, z in [-14, 14]
// - Left Paddy (Pak Darto — Conventional):  x in [-11.5, -0.7], water y = 0.08
// - Right Paddy (Pak Budi — Duck Paddy):    x in [0.7, 11.5], water y = 0.08
// - Bamboo Saung Gazebo (Pak Budi):         (5.6, 0.42, -5.8)
// - Wooden Diegetic Comparison Signboard:   (2.6, 0.42, 4.2)
// - Kampung Village Houses + Coconut Palms + Power Poles: z in [-16, -24]
// - Misty Tropical Mountains:               z in [-46, -62]
export const camAt = (id: number, f: number): Cam => {
  const s = SHOTS[id - 1];
  const u = clamp01((f - s.a) / Math.max(1, s.b - s.a));
  const e = glide(u);

  switch (id) {
    case 1: {
      // Ground-level close-up: ducks splashing out of bamboo crate right into flooded green paddy!
      const a: Cam = { pos: [3.2, 1.15, 10.6], look: [1.9, 0.55, 6.2], fov: 42, roll: -0.015 };
      const b: Cam = { pos: [3.8, 1.35, 9.2],  look: [2.5, 0.55, 5.2], fov: 40, roll: 0.01 };
      return mix(a, b, e);
    }
    case 2: {
      // Two-character confrontation right on central grass bund (Pak Darto left vs Pak Budi right!)
      const a: Cam = { pos: [0.1, 1.75, 12.6], look: [0.0, 1.35, 6.8], fov: 42, roll: 0.01 };
      const b: Cam = { pos: [-0.2, 1.65, 11.4], look: [0.0, 1.35, 6.8], fov: 40, roll: -0.01 };
      return mix(a, b, e);
    }
    case 3: {
      // High scenic two-field establishing shot (exact @JadiBeginiClip perspective along the green bund!)
      const a: Cam = { pos: [0.0, 5.2, 15.8], look: [0.8, 1.4, -2.5], fov: 45, roll: 0 };
      const b: Cam = { pos: [2.4, 3.8, 11.8], look: [4.2, 1.6, -4.5], fov: 43, roll: 0 };
      return mix(a, b, e);
    }
    case 4: {
      // Dynamic tracking shot on Left Field following Pak Darto spraying misty pesticide in the sun!
      const a: Cam = { pos: [-1.8, 1.85, 11.2], look: [-4.4, 1.15, 4.5], fov: 42, roll: -0.015 };
      const b: Cam = { pos: [-1.4, 1.75, 7.6],  look: [-4.4, 1.15, 1.2], fov: 40, roll: 0.015 };
      return mix(a, b, e);
    }
    case 5: {
      // Low water-level glide sweeping through Pak Budi's flooded rice rows with swimming ducks!
      const a: Cam = { pos: [2.2, 1.05, 10.4], look: [4.2, 0.52, 2.2], fov: 42, roll: 0 };
      const b: Cam = { pos: [3.6, 0.95, 6.4],  look: [4.8, 0.48, -0.8], fov: 41, roll: 0.01 };
      return mix(a, b, e);
    }
    case 6: {
      // Tight close-up on hero 3D duck swooping down to gobble golden apple snail (keong mas)!
      const a: Cam = { pos: [4.9, 0.92, 6.8], look: [3.6, 0.36, 4.1], fov: 36, roll: -0.01 };
      const b: Cam = { pos: [4.3, 0.84, 6.0], look: [3.6, 0.34, 4.1], fov: 34, roll: 0.01 };
      return mix(a, b, e);
    }
    case 7: {
      // Side water-tracking angle showing ducks paddling & stirring up bubbles/mud ripples!
      const a: Cam = { pos: [1.3, 1.25, 7.6], look: [4.6, 0.42, 3.0], fov: 41, roll: 0.01 };
      const b: Cam = { pos: [1.5, 1.18, 4.6], look: [4.8, 0.42, 0.5], fov: 40, roll: -0.01 };
      return mix(a, b, e);
    }
    case 8: {
      // Low heroic angle looking through lush thriving emerald rice stalks + nutrient sparkles!
      const a: Cam = { pos: [5.2, 0.78, 8.2], look: [3.4, 1.15, 2.5], fov: 43, roll: -0.015 };
      const b: Cam = { pos: [4.0, 1.15, 6.8], look: [3.2, 1.25, 1.5], fov: 41, roll: 0.01 };
      return mix(a, b, e);
    }
    case 9: {
      // High dramatic split-field comparison: patchy Left field (Darto) vs vibrant lush Right field (Budi)!
      const a: Cam = { pos: [0.0, 6.4, 14.2], look: [0.0, 0.8, 0.5], fov: 46, roll: 0 };
      const b: Cam = { pos: [0.0, 5.2, 11.2], look: [0.0, 0.8, -1.5], fov: 44, roll: 0 };
      return mix(a, b, e);
    }
    case 10: {
      // Golden afternoon: Pak Budi on the bund gently herding his ducks back out of the field!
      const a: Cam = { pos: [1.6, 1.85, 11.8], look: [0.8, 1.15, 5.6], fov: 42, roll: 0 };
      const b: Cam = { pos: [0.6, 1.68, 10.4], look: [0.4, 1.12, 5.6], fov: 40, roll: -0.01 };
      return mix(a, b, e);
    }
    case 11: {
      // Comedic close-up: cheeky duck eyeing golden rice panicles as Pak Budi gently scoops it up!
      const a: Cam = { pos: [3.8, 1.18, 7.6], look: [2.6, 0.65, 4.4], fov: 38, roll: 0.015 };
      const b: Cam = { pos: [3.3, 1.12, 6.8], look: [2.5, 0.65, 4.4], fov: 36, roll: -0.015 };
      return mix(a, b, e);
    }
    case 12: {
      // Face-on view of the ONE diegetic wooden comparison signboard planted naturally in the paddy (100% framed cleanly inside 9:16!)
      const a: Cam = { pos: [2.6, 2.32, 12.1], look: [2.6, 2.22, 4.2], fov: 44, roll: 0 };
      const b: Cam = { pos: [2.6, 2.28, 11.4], look: [2.6, 2.22, 4.2], fov: 42, roll: 0 };
      return mix(a, b, e);
    }
    case 13: {
      // Golden Sunset Harvest: Pak Budi + egg basket cleanly on central bund, gleaming golden field on right!
      const a: Cam = { pos: [1.55, 2.15, 12.6], look: [0.55, 1.25, 5.6], fov: 43, roll: -0.01 };
      const b: Cam = { pos: [1.05, 1.92, 11.2], look: [0.45, 1.22, 5.6], fov: 41, roll: 0.01 };
      return mix(a, b, e);
    }
    case 14: {
      // Reaction close-up: Pak Darto stunned wide-eyed on bund staring at Pak Budi's double harvest!
      const a: Cam = { pos: [-0.55, 1.78, 11.6], look: [-0.35, 1.32, 6.4], fov: 40, roll: 0.015 };
      const b: Cam = { pos: [-0.65, 1.68, 10.6], look: [-0.35, 1.32, 6.4], fov: 38, roll: -0.01 };
      return mix(a, b, e);
    }
    case 15: {
      // Next season sunny morning: Pak Darto's abandoned green sprayer tank resting lonely on the bund!
      const a: Cam = { pos: [0.8, 1.28, 11.4], look: [-0.15, 0.85, 7.0], fov: 38, roll: -0.01 };
      const b: Cam = { pos: [0.2, 1.38, 10.2], look: [-0.15, 0.85, 7.0], fov: 36, roll: 0.01 };
      return mix(a, b, e);
    }
    default: {
      // Shot 16 Comedic Loop Payoff: Pak Darto excitedly chasing his own new flock in Left Field while Pak Budi waves laughing on the bund!
      const a: Cam = { pos: [-0.9, 2.45, 14.2], look: [-1.45, 1.18, 5.2], fov: 45, roll: -0.01 };
      const b: Cam = { pos: [-1.4, 2.15, 12.6], look: [-1.85, 1.15, 4.4], fov: 43, roll: 0.015 };
      return mix(a, b, e);
    }
  }
};

export const dofAt = (f: number): { cInf: number } => {
  const id = shotAt(f).id;
  if (id === 3 || id === 9) return { cInf: 3.5 }; // wide two-field comparisons sharp
  if (id === 1 || id === 6 || id === 11 || id === 14 || id === 15) return { cInf: 14.0 }; // rich creamy cinematic bokeh!
  return { cInf: 8.5 };
};
