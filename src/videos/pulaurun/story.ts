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

export type RunShot = {
  id: number;
  a: number;
  b: number;
  light: CafeLight;
};

// 11 cinematic historical shots (58.0s total)
export const SHOTS: RunShot[] = [
  { id: 1,  a: 0,    b: 132,  light: "day" },    // 0.0 - 4.4s: Hook - Pulau Run vs New York swap reveal
  { id: 2,  a: 132,  b: 288,  light: "day" },    // 4.4 - 9.6s: Establishing 1667 Banda Sea, Pulau Run & European galleons
  { id: 3,  a: 288,  b: 438,  light: "day" },    // 9.6 - 14.6s: Tiny island scale (3km x 1km) aerial glide
  { id: 4,  a: 438,  b: 594,  light: "day" },    // 14.6 - 19.8s: Glowing nutmeg tree + VOC merchant hugging spice crate
  { id: 5,  a: 594,  b: 750,  light: "golden" }, // 19.8 - 25.0s: Golden hour - 3D balance scale: 1 nutmeg outweighs gold bars
  { id: 6,  a: 750,  b: 912,  light: "golden" }, // 25.0 - 30.4s: Zone B - Modest 1667 New Amsterdam wooden fort & windmill
  { id: 7,  a: 912,  b: 1086, light: "golden" }, // 30.4 - 36.2s: Perjanjian Breda 1667 handshake & treaty scroll stamp
  { id: 8,  a: 1086, b: 1236, light: "golden" }, // 36.2 - 41.2s: Dutch victory dance on spice crates; British officer shrugs
  { id: 9,  a: 1236, b: 1404, light: "dusk" },   // 41.2 - 46.8s: Dusk twist 1 - Nutmeg seedlings smuggled away, price crashes
  { id: 10, a: 1404, b: 1578, light: "dusk" },   // 46.8 - 52.6s: Zone B twist 2 - Glowing 3D Manhattan skyscrapers rise!
  { id: 11, a: 1578, b: TOTAL, light: "dusk" },  // 52.6 - 58.0s: Ironic payoff - Dazzling NYC skyline vs lone nutmeg & shocked VOC merchant
];

// Crossfades on major zone/time transitions; crisp white flash at end of hook (f=132)
export const XFADE: Record<number, number> = { 5: 8, 6: 8, 7: 8, 9: 8, 10: 10 };
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

export const camAt = (id: number, f: number): Cam => {
  const s = SHOTS[id - 1];
  const u = clamp01((f - s.a) / Math.max(1, s.b - s.a));
  const e = glide(u);

  switch (id) {
    case 1: {
      // Hook: Clean 9:16 margins on PULAU RUN <-> NEW YORK swap card + both officers + dock & sea!
      const a: Cam = { pos: [0.25, 3.7, 17.8], look: [0.0, 2.55, 5.2], fov: 44, roll: -0.012 };
      const b: Cam = { pos: [-0.25, 3.15, 15.6], look: [0.0, 2.45, 5.5], fov: 42, roll: 0.01 };
      return mix(a, b, e);
    }
    case 2: {
      // Wide establishing aerial glide showing Pulau Run + BOTH rival European sailing galleons in Banda Sea!
      const a: Cam = { pos: [-7.2, 9.2, 27.5], look: [0.0, 2.0, 4.5], fov: 46, roll: 0 };
      const b: Cam = { pos: [5.8, 7.2, 24.5], look: [0.0, 1.9, 4.5], fov: 45, roll: 0 };
      return mix(a, b, e);
    }
    case 3: {
      // High sweeping circle showing tiny Pulau Run (3 km x 1 km) surrounded by vast blue sea
      const a: Cam = { pos: [11.5, 12.2, 20.5], look: [0.0, 2.4, 0.5], fov: 45, roll: 0.012 };
      const b: Cam = { pos: [-8.5, 11.2, 21.5], look: [0.0, 2.4, 0.5], fov: 43, roll: -0.012 };
      return mix(a, b, e);
    }
    case 4: {
      // Hero close-up: Dutch VOC merchant hugging giant nutmeg with starry eyes + nutmeg crate + fruiting nutmeg tree!
      const a: Cam = { pos: [2.25, 2.25, 11.4], look: [2.15, 1.78, 5.8], fov: 42, roll: -0.01 };
      const b: Cam = { pos: [1.95, 2.1, 10.1], look: [2.15, 1.75, 5.8], fov: 40, roll: 0.01 };
      return mix(a, b, e);
    }
    case 5: {
      // Golden Hour: Full 3D Brass Balance Scale + readable "1 PALA > EMAS" badge + VOC merchant cleanly inside 9:16!
      const a: Cam = { pos: [1.35, 2.35, 14.8], look: [1.35, 1.95, 7.6], fov: 43, roll: 0.01 };
      const b: Cam = { pos: [1.55, 2.2, 13.6], look: [1.35, 1.95, 7.6], fov: 41, roll: -0.01 };
      return mix(a, b, e);
    }
    case 6: {
      // Zone B (x = 90): Modest muddy 1667 New Amsterdam fort, spinning windmill & bored Dutch governor
      const a: Cam = { pos: [85.8, 4.2, 16.4], look: [90.0, 2.2, 1.5], fov: 44, roll: 0 };
      const b: Cam = { pos: [93.2, 3.3, 14.0], look: [90.0, 2.1, 1.5], fov: 42, roll: 0 };
      return mix(a, b, e);
    }
    case 7: {
      // Zone A Dock: Full Perjanjian Breda 1667 scroll + BOTH Dutch & British diplomats shaking hands with clean margins!
      const a: Cam = { pos: [0.1, 2.55, 14.4], look: [0.0, 2.15, 6.4], fov: 43, roll: -0.008 };
      const b: Cam = { pos: [-0.15, 2.42, 13.2], look: [0.0, 2.15, 6.4], fov: 41, roll: 0.008 };
      return mix(a, b, e);
    }
    case 8: {
      // Dutch VOC merchant cheers atop spice crates while British officer shrugs holding New Amsterdam map
      const a: Cam = { pos: [-1.1, 2.65, 14.2], look: [-0.1, 2.1, 6.5], fov: 43, roll: 0.012 };
      const b: Cam = { pos: [0.8, 2.5, 13.0], look: [-0.1, 2.05, 6.5], fov: 41, roll: -0.012 };
      return mix(a, b, e);
    }
    case 9: {
      // Dusk Twist 1: Smuggler rowboat escapes with glowing nutmeg saplings while VOC merchant panics near crashing price chart
      const a: Cam = { pos: [-1.6, 3.2, 16.2], look: [-1.2, 2.15, 7.8], fov: 44, roll: -0.015 };
      const b: Cam = { pos: [-3.6, 3.4, 17.8], look: [-3.0, 2.0, 9.2], fov: 43, roll: 0.015 };
      return mix(a, b, e);
    }
    case 10: {
      // Zone B Twist 2 (x = 90): Dramatic rise of 3D glowing Manhattan skyscrapers with FULL Empire State spire visible!
      const a: Cam = { pos: [85.2, 4.2, 24.5], look: [90.0, 5.0, -2.5], fov: 45, roll: 0 };
      const b: Cam = { pos: [92.5, 8.0, 31.8], look: [90.0, 9.8, -2.5], fov: 47, roll: -0.01 };
      return mix(a, b, e);
    }
    default: {
      // Shot 11 Payoff (x = 90): Razor-sharp shocked Dutch merchant holding 1 tiny nutmeg + dazzling full Manhattan skyline behind!
      const a: Cam = { pos: [90.15, 2.65, 23.2], look: [90.0, 5.2, 4.0], fov: 46, roll: 0.008 };
      const b: Cam = { pos: [89.85, 3.05, 25.4], look: [90.0, 6.4, 3.5], fov: 47, roll: -0.008 };
      return mix(a, b, e);
    }
  }
};

export const dofAt = (f: number): { cInf: number } => {
  const id = shotAt(f).id;
  if (id === 2 || id === 3 || id === 10 || id === 11) return { cInf: 2.2 }; // sharp foreground + epic skyline/island!
  if (id === 4 || id === 5 || id === 7) return { cInf: 8.5 }; // warm creamy bokeh without blurring subject
  return { cInf: 5.5 };
};
