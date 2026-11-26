import { CafeLight } from "./cafeLights";

export const FPS = 30;
export const TOTAL = 1740; // 58.0 seconds exact
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };

export type CafeShot = {
  id: number;
  a: number;
  b: number;
  light: CafeLight;
};

// 11 cinematic story shots (58.0 s total)
export const SHOTS: CafeShot[] = [
  { id: 1,  a: 0,    b: 126,  light: "day" },    // 0.0 - 4.2s: Hook - Pak Darmo at corner table with glass of water
  { id: 2,  a: 126,  b: 276,  light: "day" },    // 4.2 - 9.2s: Establishing 3D street + Kopi Sudut café + Pak Darmo arriving
  { id: 3,  a: 276,  b: 432,  light: "day" },    // 9.2 - 14.4s: Busy café, Raka behind counter watching customers leave
  { id: 4,  a: 432,  b: 588,  light: "day" },    // 14.4 - 19.6s: Customers whispering, glancing at Pak Darmo, Raka frowning
  { id: 5,  a: 588,  b: 732,  light: "golden" }, // 19.6 - 24.4s: Golden sunset, Raka walks across café to confront Pak Darmo
  { id: 6,  a: 732,  b: 876,  light: "golden" }, // 24.4 - 29.2s: Confrontation close-up - Raka speaks firmly, Pak Darmo surprised
  { id: 7,  a: 876,  b: 1032, light: "golden" }, // 29.2 - 34.4s: Pak Darmo smiles warmly, closes notebook, leaves white envelope
  { id: 8,  a: 1032, b: 1176, light: "golden" }, // 34.4 - 39.2s: Pak Darmo walks down sidewalk; Raka opens envelope & freezes
  { id: 9,  a: 1176, b: 1356, light: "dusk" },   // 39.2 - 45.2s: Twist 1 - Warm lamp glow on deed letter: Pak Darmo owns the building!
  { id: 10, a: 1356, b: 1542, light: "dusk" },   // 45.2 - 51.4s: Twist 2 - Warm memory at corner table: Pak Darmo & late wife with coffee
  { id: 11, a: 1542, b: TOTAL, light: "dusk" },  // 51.4 - 58.0s: Payoff - Raka runs outside with steaming coffee + "KHUSUS PAK DARMO" sign
];

// Soft crossfades on mood/place transitions; white flash at end of hook (f=126)
export const XFADE: Record<number, number> = { 5: 8, 9: 8, 10: 10, 11: 8 };
export const FLASH_AT = 126;

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
  pos: [a.pos[0] + (b.pos[0] - a.pos[0]) * k, a.pos[1] + (b.pos[1] - a.pos[1]) * k, a.pos[2] + (b.pos[2] - a.pos[2]) * k],
  look: [a.look[0] + (b.look[0] - a.look[0]) * k, a.look[1] + (b.look[1] - a.look[1]) * k, a.look[2] + (b.look[2] - a.look[2]) * k],
  fov: a.fov + (b.fov - a.fov) * k,
  roll: a.roll + (b.roll - a.roll) * k,
});

// World coordinate map:
// Corner Table (Hero): x = -2.4, z = 2.6, y = 0 (floor)
// Café Interior: x in [-5.5, 5.5], z in [-4.5, 4.5], front open glass facing +z (street)
// Espresso Counter: x = 2.8, z = -2.0 (Raka stands behind at x = 2.8, z = -3.0)
// Other Tables: (2.2, 2.2), (-2.2, -1.5)
// Sidewalk: z in [4.5, 8.2], Street: z in [8.2, 16.5], Opposite Ruko row: z = 19.5
export const camAt = (id: number, f: number): Cam => {
  const s = SHOTS[id - 1];
  const u = clamp01((f - s.a) / Math.max(1, s.b - s.a));
  const e = glide(u);

  switch (id) {
    case 1: {
      // Hook: Pak Darmo + glass of water + notebook cleanly centered in 9:16!
      const a: Cam = { pos: [-2.45, 1.62, 6.9], look: [-2.75, 1.15, 2.6], fov: 42, roll: -0.015 };
      const b: Cam = { pos: [-2.55, 1.54, 6.1], look: [-2.75, 1.12, 2.6], fov: 40, roll: 0.01 };
      return mix(a, b, e);
    }
    case 2: {
      // Wide establishing of colorful Indonesian street & Kopi Sudut café + Pak Darmo arriving
      const a: Cam = { pos: [3.6, 3.3, 15.2], look: [-0.8, 2.1, 2.2], fov: 44, roll: 0 };
      const b: Cam = { pos: [0.4, 2.35, 12.2], look: [-1.8, 1.65, 2.6], fov: 42, roll: 0 };
      return mix(a, b, e);
    }
    case 3: {
      // Busy café: Raka behind espresso bar + customers + Customer C walking away
      const a: Cam = { pos: [1.6, 2.05, 8.2], look: [2.2, 1.35, 0.6], fov: 44, roll: 0.01 };
      const b: Cam = { pos: [0.8, 1.95, 7.6], look: [1.6, 1.3, 1.2], fov: 42, roll: -0.01 };
      return mix(a, b, e);
    }
    case 4: {
      // Whispering customers at right table glancing toward Pak Darmo
      const a: Cam = { pos: [2.4, 1.68, 7.2], look: [2.1, 1.25, 2.2], fov: 42, roll: 0.015 };
      const b: Cam = { pos: [-0.2, 1.68, 7.8], look: [-1.6, 1.25, 2.5], fov: 42, roll: -0.02 };
      return mix(a, b, e);
    }
    case 5: {
      // Golden hour: Raka walks from counter toward corner table
      const a: Cam = { pos: [1.2, 2.0, 9.2], look: [0.5, 1.35, 0.8], fov: 44, roll: 0 };
      const b: Cam = { pos: [-1.4, 1.8, 7.6], look: [-2.25, 1.28, 2.6], fov: 42, roll: 0.015 };
      return mix(a, b, e);
    }
    case 6: {
      // Confrontation two-shot: BOTH Pak Darmo (left) and Raka (right) framed cleanly!
      const a: Cam = { pos: [-2.15, 1.68, 7.6], look: [-2.28, 1.25, 2.6], fov: 43, roll: 0.02 };
      const b: Cam = { pos: [-2.2, 1.62, 6.85], look: [-2.28, 1.25, 2.6], fov: 41, roll: 0.035 };
      return mix(a, b, e);
    }
    case 7: {
      // Pak Darmo smiles gently, puts down envelope and stands up
      const a: Cam = { pos: [-2.35, 1.62, 6.9], look: [-2.65, 1.22, 2.6], fov: 41, roll: 0 };
      const b: Cam = { pos: [-2.45, 1.54, 6.1], look: [-2.55, 1.15, 2.6], fov: 39, roll: -0.015 };
      return mix(a, b, e);
    }
    case 8: {
      // Pak Darmo walking away along sidewalk while Raka opens envelope & freezes!
      const a: Cam = { pos: [-2.2, 1.75, 9.8], look: [-2.4, 1.3, 3.6], fov: 44, roll: 0 };
      const b: Cam = { pos: [-1.65, 1.62, 6.6], look: [-1.8, 1.32, 2.8], fov: 40, roll: -0.03 };
      return mix(a, b, e);
    }
    case 9: {
      // Dusk Twist 1: Raka + full readable SERTIFIKAT RUKO & Polaroid card framed cleanly!
      const a: Cam = { pos: [-1.55, 1.62, 6.6], look: [-1.65, 1.42, 2.8], fov: 42, roll: -0.015 };
      const b: Cam = { pos: [-1.58, 1.58, 5.95], look: [-1.62, 1.44, 2.8], fov: 40, roll: 0.01 };
      return mix(a, b, e);
    }
    case 10: {
      // Warm nostalgic flashback: BOTH Pak Darmo & Almarhumah Ibu Darmo sharing coffee at corner table!
      const a: Cam = { pos: [-2.35, 1.72, 7.6], look: [-2.4, 1.22, 2.6], fov: 43, roll: 0.01 };
      const b: Cam = { pos: [-2.4, 1.62, 6.6], look: [-2.4, 1.22, 2.6], fov: 41, roll: -0.01 };
      return mix(a, b, e);
    }
    default: {
      // Shot 11: Raka runs outside to hand steaming coffee to Pak Darmo (0..45%), glides to table (45..76%), holds push-in on KHUSUS PAK DARMO (76..100%)!
      if (u < 0.45) {
        const k = glide(u / 0.45);
        const a: Cam = { pos: [-4.2, 1.8, 11.4], look: [-4.3, 1.32, 6.2], fov: 43, roll: 0 };
        const b: Cam = { pos: [-4.3, 1.68, 10.2], look: [-4.4, 1.32, 6.2], fov: 40, roll: 0.01 };
        return mix(a, b, k);
      }
      if (u < 0.76) {
        const k = glide((u - 0.45) / 0.31);
        const a: Cam = { pos: [-4.3, 1.68, 10.2], look: [-4.4, 1.32, 6.2], fov: 40, roll: 0.01 };
        const b: Cam = { pos: [-2.4, 1.36, 4.95], look: [-2.4, 1.04, 2.6], fov: 36, roll: 0 };
        return mix(a, b, k);
      }
      const k = glide((u - 0.76) / 0.24);
      const a: Cam = { pos: [-2.4, 1.36, 4.95], look: [-2.4, 1.04, 2.6], fov: 36, roll: 0 };
      const b: Cam = { pos: [-2.4, 1.28, 4.42], look: [-2.4, 1.04, 2.6], fov: 34, roll: 0 };
      return mix(a, b, k);
    }
  }
};

export const dofAt = (f: number): { cInf: number } => {
  const id = shotAt(f).id;
  if (id === 2) return { cInf: 3.5 }; // wide street establishing stays sharp
  if (id === 1 || id === 6 || id === 7 || id === 9 || id === 10) return { cInf: 12.5 }; // creamy cinematic bokeh on close-ups
  return { cInf: 8.5 }; // medium shots
};
