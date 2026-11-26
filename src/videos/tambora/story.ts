import { CafeLight } from "../cafe/cafeLights";

export const FPS = 30;
export const TOTAL = 1740; // 58.0 seconds exact (+ 2.5s Naltech.ai outro = 60.5s)
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

export type TamboraShot = {
  id: number;
  a: number;
  b: number;
  light: CafeLight;
};

// 11 cinematic butterfly-effect shots (58.0s total)
export const SHOTS: TamboraShot[] = [
  { id: 1,  a: 0,    b: 132,  light: "day" },    // 0.0 - 4.4s: Hook - Tambora 1815 -> Bicycle & Frankenstein!
  { id: 2,  a: 132,  b: 288,  light: "day" },    // 4.4 - 9.6s: 10 April 1815 — Towering Gunung Tambora, Sumbawa
  { id: 3,  a: 288,  b: 438,  light: "golden" }, // 9.6 - 14.6s: Cataclysmic Eruption! 4x Krakatau, summit blasts off
  { id: 4,  a: 438,  b: 594,  light: "dusk" },   // 14.6 - 19.8s: 3D Earth Globe blanketed in volcanic ash ring
  { id: 5,  a: 594,  b: 750,  light: "dusk" },   // 19.8 - 25.0s: 1816 Year Without a Summer — Snow in July in Europe!
  { id: 6,  a: 750,  b: 912,  light: "dusk" },   // 25.0 - 30.4s: Frozen crops & horse crisis in Europe
  { id: 7,  a: 912,  b: 1086, light: "golden" }, // 30.4 - 36.2s: Germany 1817 — Karl Drais invents the First Bicycle!
  { id: 8,  a: 1086, b: 1236, light: "golden" }, // 36.2 - 41.2s: Draisine wooden bike glides past cheering townsfolk
  { id: 9,  a: 1236, b: 1404, light: "dusk" },   // 41.2 - 46.8s: Lake Geneva 1816 — Stormy Gothic Villa Diodati + lightning
  { id: 10, a: 1404, b: 1578, light: "dusk" },   // 46.8 - 52.6s: Mary Shelley writes Frankenstein by candlelight!
  { id: 11, a: 1578, b: TOTAL, light: "dusk" },  // 52.6 - 58.0s: Grand Butterfly-Effect Payoff (Tambora -> Bike + Frankenstein)
];

export const XFADE: Record<number, number> = { 4: 8, 5: 8, 7: 8, 9: 8 };
export const FLASH_AT = 132;

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

// World coordinate map (4 Zones cleanly separated along +X):
// Zone 1 (x = 0):   Pulau Sumbawa & Gunung Tambora 1815 (Shots 1-3)
// Zone 2 (x = 90):  3D Earth Globe w/ Ash Ring at (90, 6, -24) [Shot 4] + Snowy 1816 European Village at (90, 0, 4) [Shots 5-6]
// Zone 3 (x = 180): 1817 Germany Cobblestone Street + Karl Drais 3D Wooden Bicycle (Shots 7-8)
// Zone 4 (x = 270): Stormy Villa Diodati, Lake Geneva + Mary Shelley & Frankenstein + Finale Tableau (Shots 9-11)
export const camAt = (id: number, f: number): Cam => {
  const s = SHOTS[id - 1];
  const u = clamp01((f - s.a) / Math.max(1, s.b - s.a));
  const e = glide(u);

  switch (id) {
    case 1: {
      // Hook: Lush Sumbawa + Tambora volcano + crisp floating TAMBORA 1815 -> SEPEDA & FRANKENSTEIN card
      const a: Cam = { pos: [0.3, 4.4, 19.6], look: [0.0, 3.4, 2.0], fov: 44, roll: -0.01 };
      const b: Cam = { pos: [-0.3, 3.8, 17.2], look: [0.0, 3.2, 2.4], fov: 42, roll: 0.01 };
      return mix(a, b, e);
    }
    case 2: {
      // 10 April 1815: Dramatic sweeping rise along towering Mount Tambora
      const a: Cam = { pos: [-6.5, 4.5, 22.0], look: [0.0, 5.2, -5.0], fov: 45, roll: 0 };
      const b: Cam = { pos: [5.5, 6.2, 19.5], look: [0.0, 6.2, -5.0], fov: 43, roll: 0 };
      return mix(a, b, e);
    }
    case 3: {
      // Cataclysmic 3D Eruption! Subtle camera shake + dramatic upward tilt as giant ash mushroom column shoots up!
      const shakeX = Math.sin(f * 1.9) * 0.16 * smooth(u * 3);
      const shakeY = Math.cos(f * 2.3) * 0.14 * smooth(u * 3);
      const a: Cam = { pos: [3.2 + shakeX, 4.2 + shakeY, 21.5], look: [0.0, 6.2, -5.8], fov: 46, roll: -0.015 };
      const b: Cam = { pos: [-3.2 + shakeX, 6.5 + shakeY, 24.5], look: [0.0, 9.2, -5.8], fov: 48, roll: 0.015 };
      return mix(a, b, e);
    }
    case 4: {
      // Zone 2A (x = 90, z = -24): Full 3D Rotating Earth Globe + swirling volcanic ash ring cleanly framed!
      const a: Cam = { pos: [88.2, 6.6, -7.2], look: [90.0, 6.2, -24.0], fov: 44, roll: -0.01 };
      const b: Cam = { pos: [91.8, 6.2, -9.2], look: [90.0, 6.2, -24.0], fov: 42, roll: 0.01 };
      return mix(a, b, e);
    }
    case 5: {
      // Zone 2B (x = 90, z = 4): Snowy European Village in July 1816 + shivering villager + falling snow!
      const a: Cam = { pos: [87.2, 3.2, 17.5], look: [90.0, 2.5, 4.0], fov: 44, roll: 0 };
      const b: Cam = { pos: [92.4, 2.9, 15.8], look: [90.0, 2.4, 4.5], fov: 42, roll: 0 };
      return mix(a, b, e);
    }
    case 6: {
      // Zone 2B: Close-up on snow-buried crops, empty barn & sad European farmer beside cartoon horse
      const a: Cam = { pos: [91.5, 2.4, 15.0], look: [91.2, 1.9, 6.2], fov: 42, roll: -0.01 };
      const b: Cam = { pos: [89.8, 2.2, 13.6], look: [90.8, 1.85, 6.2], fov: 40, roll: 0.01 };
      return mix(a, b, e);
    }
    case 7: {
      // Zone 3 (x = 180): 1817 Germany! Karl Drais reveals & rides the 3D Wooden First Bicycle (Draisine)!
      const a: Cam = { pos: [176.5, 2.7, 14.8], look: [179.2, 2.2, 4.5], fov: 43, roll: -0.008 };
      const b: Cam = { pos: [181.8, 2.5, 13.5], look: [180.5, 2.1, 4.5], fov: 41, roll: 0.008 };
      return mix(a, b, e);
    }
    case 8: {
      // Zone 3: Joyful tracking glide following Karl Drais zipping past cheering townsfolk on his bicycle!
      const a: Cam = { pos: [177.2, 2.6, 15.6], look: [178.5, 1.9, 5.2], fov: 43, roll: 0.01 };
      const b: Cam = { pos: [184.5, 2.5, 14.6], look: [182.8, 1.9, 5.2], fov: 42, roll: -0.01 };
      return mix(a, b, e);
    }
    case 9: {
      // Zone 4 (x = 270): Stormy Gothic Villa Diodati by Lake Geneva with dramatic lightning!
      const a: Cam = { pos: [265.8, 3.8, 17.8], look: [270.0, 3.4, 1.5], fov: 44, roll: -0.012 };
      const b: Cam = { pos: [273.5, 3.3, 15.5], look: [270.0, 3.2, 1.5], fov: 42, roll: 0.012 };
      return mix(a, b, e);
    }
    case 10: {
      // Zone 4: Warm candlelit terrace — Mary Shelley & Frankenstein cleanly framed with generous 9:16 margins!
      const a: Cam = { pos: [269.6, 2.55, 16.4], look: [270.0, 2.25, 6.4], fov: 43, roll: -0.008 };
      const b: Cam = { pos: [270.4, 2.45, 15.2], look: [270.0, 2.25, 6.4], fov: 41, roll: 0.008 };
      return mix(a, b, e);
    }
    default: {
      // Shot 11 Grand Butterfly-Effect Payoff: Full wooden bicycle + Karl Drais + Mary Shelley + Frankenstein inside 9:16!
      const a: Cam = { pos: [270.1, 3.1, 19.6], look: [270.0, 2.9, 6.4], fov: 45, roll: 0.008 };
      const b: Cam = { pos: [269.9, 3.4, 21.4], look: [270.0, 3.2, 6.4], fov: 46, roll: -0.008 };
      return mix(a, b, e);
    }
  }
};

export const dofAt = (f: number): { cInf: number } => {
  const id = shotAt(f).id;
  if (id === 2 || id === 3 || id === 4 || id === 9 || id === 11) return { cInf: 2.2 };
  if (id === 6 || id === 7 || id === 10) return { cInf: 6.0 };
  return { cInf: 4.0 };
};
