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

export type BhasaShot = {
  id: number;
  a: number;
  b: number;
  light: CafeLight;
};

// 11 detailed linguistic history shots of Bahasa Jawa (58.0s total)
export const SHOTS: BhasaShot[] = [
  { id: 1,  a: 0,    b: 132,  light: "day" },    // 0.0 - 4.4s: Hook - 80+ juta penutur sampai Amerika Selatan!
  { id: 2,  a: 132,  b: 288,  light: "day" },    // 4.4 - 9.6s: Pelaut Austronesia 4.000 tahun lalu (Perahu Bercadik 3D)
  { id: 3,  a: 288,  b: 438,  light: "day" },    // 9.6 - 14.6s: Rumpun Melayu-Polinesia (Jawa · Melayu · Tagalog · Hawaii)
  { id: 4,  a: 438,  b: 594,  light: "day" },    // 14.6 - 19.8s: Masuknya Sansekerta -> Lahir Bahasa Jawa Kuno (Kawi)
  { id: 5,  a: 594,  b: 750,  light: "golden" }, // 19.8 - 25.0s: Prasasti Sukabumi (25 Maret 804 M) — bukti tertulis tertua!
  { id: 6,  a: 750,  b: 912,  light: "golden" }, // 25.0 - 30.4s: Evolusi Aksara: Pallawa -> Kawi -> Hanacaraka (kaligrafi vektor)
  { id: 7,  a: 912,  b: 1086, light: "golden" }, // 30.4 - 36.2s: Era Mataram Islam (abad ke-16) — Pendopo Joglo 3D & serapan Arab
  { id: 8,  a: 1086, b: 1236, light: "golden" }, // 36.2 - 41.2s: 3D Tangga Unggah-Ungguh: Mangan (Ngoko) -> Nedha (Madya) -> Dhahar (Krama)
  { id: 9,  a: 1236, b: 1404, light: "dusk" },   // 41.2 - 46.8s: Etika sopan santun dalam bahasa — salam hangat di Pendopo
  { id: 10, a: 1404, b: 1578, light: "dusk" },   // 46.8 - 52.6s: Bahasa Jawa Mendunia — 3D Globe jalur Jawa -> Suriname & Kaledonia Baru
  { id: 11, a: 1578, b: TOTAL, light: "dusk" },  // 52.6 - 58.0s: Finale - 1.200+ tahun sejarah, lintas generasi di Pendopo & kota modern
];

export const XFADE: Record<number, number> = { 4: 8, 7: 8, 10: 8, 11: 8 };
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

// World coordinate map (4 Detailed Linguistic Zones along +X):
// Zone 1 (x = 0):   Austronesian Sea & Perahu Bercadik 3D + Archipelago Shore (Shots 1-3)
// Zone 2 (x = 90):  Prasasti Sukabumi 804 M Stone Stele + Pujangga Lontar Pavilion (Shots 4-6)
// Zone 3 (x = 180): Royal Mataram Pendopo Joglo + 3D Unggah-Ungguh Steps (Shots 7-9)
// Zone 4 (x = 270): 3D Earth Globe w/ Global Java Arcs at (270, 6.2, -24) [Shot 10] + Modern-Joglo Finale Plaza (270, 0, 4) [Shot 11]
export const camAt = (id: number, f: number): Cam => {
  const s = SHOTS[id - 1];
  const u = clamp01((f - s.a) / Math.max(1, s.b - s.a));
  const e = glide(u);

  switch (id) {
    case 1: {
      // Hook: Vibrant archipelago shore + Perahu Bercadik + floating 80+ Juta Penutur card!
      const a: Cam = { pos: [0.3, 3.6, 17.5], look: [0.0, 2.7, 4.5], fov: 44, roll: -0.01 };
      const b: Cam = { pos: [-0.3, 3.1, 15.2], look: [0.0, 2.6, 4.8], fov: 42, roll: 0.01 };
      return mix(a, b, e);
    }
    case 2: {
      // Pelaut Austronesia sailing 3D Perahu Bercadik across Nusantara sea!
      const a: Cam = { pos: [-5.8, 3.8, 17.8], look: [0.0, 2.3, 4.0], fov: 44, roll: 0 };
      const b: Cam = { pos: [4.2, 3.2, 16.0], look: [0.4, 2.2, 4.5], fov: 42, roll: 0 };
      return mix(a, b, e);
    }
    case 3: {
      // Wide oceanic Austronesian family glide (Jawa · Melayu · Tagalog · Hawaii)
      const a: Cam = { pos: [3.2, 3.6, 17.5], look: [0.0, 2.7, 4.8], fov: 43, roll: 0.01 };
      const b: Cam = { pos: [-2.8, 3.3, 16.2], look: [0.0, 2.7, 4.8], fov: 42, roll: -0.01 };
      return mix(a, b, e);
    }
    case 4: {
      // Zone 2 (x = 90): Sunlit Stone Pavilion — Bahasa Kawi (Austronesia + Sansekerta)
      const a: Cam = { pos: [87.2, 3.0, 15.8], look: [90.0, 2.5, 4.2], fov: 43, roll: 0 };
      const b: Cam = { pos: [92.4, 2.8, 14.4], look: [90.0, 2.4, 4.4], fov: 41, roll: 0 };
      return mix(a, b, e);
    }
    case 5: {
      // Zone 2: Golden sunset hero close-up on 3D Prasasti Sukabumi (25 Maret 804 M)!
      const a: Cam = { pos: [89.2, 2.6, 13.8], look: [90.0, 2.35, 4.6], fov: 42, roll: -0.008 };
      const b: Cam = { pos: [90.8, 2.5, 12.6], look: [90.0, 2.4, 4.6], fov: 40, roll: 0.008 };
      return mix(a, b, e);
    }
    case 6: {
      // Zone 2: Evolution of Script — Pallawa -> Kawi -> Custom Vector Calligraphy Hanacaraka!
      const a: Cam = { pos: [90.4, 2.8, 14.6], look: [90.0, 2.6, 4.8], fov: 43, roll: 0.008 };
      const b: Cam = { pos: [89.6, 2.65, 13.4], look: [90.0, 2.65, 4.8], fov: 41, roll: -0.008 };
      return mix(a, b, e);
    }
    case 7: {
      // Zone 3 (x = 180): Majestic 3D Royal Mataram Pendopo Joglo in golden sunset!
      const a: Cam = { pos: [175.2, 4.2, 16.5], look: [180.0, 3.2, 0.5], fov: 44, roll: 0 };
      const b: Cam = { pos: [184.0, 3.5, 14.8], look: [180.0, 3.0, 0.8], fov: 42, roll: 0 };
      return mix(a, b, e);
    }
    case 8: {
      // Zone 3: 3D Ascending Unggah-Ungguh Steps (Mangan -> Nedha -> Dhahar!) cleanly framed!
      const a: Cam = { pos: [179.4, 2.9, 16.2], look: [180.0, 2.5, 5.2], fov: 43, roll: -0.008 };
      const b: Cam = { pos: [180.6, 2.8, 14.8], look: [180.0, 2.5, 5.2], fov: 41, roll: 0.008 };
      return mix(a, b, e);
    }
    case 9: {
      // Zone 3 Dusk: Warm lantern-lit Pendopo — respectful Javanese greeting (etika dalam bahasa)
      const a: Cam = { pos: [178.6, 2.6, 14.6], look: [180.0, 2.25, 5.2], fov: 42, roll: 0.008 };
      const b: Cam = { pos: [181.2, 2.5, 13.5], look: [180.0, 2.25, 5.2], fov: 40, roll: -0.008 };
      return mix(a, b, e);
    }
    case 10: {
      // Zone 4A (x = 270, z = -24): Full 3D Rotating Earth Globe w/ glowing arcs from Java -> Suriname & New Caledonia!
      const a: Cam = { pos: [268.2, 6.6, -7.2], look: [270.0, 6.2, -24.0], fov: 44, roll: -0.01 };
      const b: Cam = { pos: [271.8, 6.2, -9.2], look: [270.0, 6.2, -24.0], fov: 42, roll: 0.01 };
      return mix(a, b, e);
    }
    default: {
      // Shot 11 Grand Finale (x = 270, z = 4): All 3 eras of Javanese speakers celebrating under glowing Joglo + modern towers!
      const a: Cam = { pos: [270.2, 3.1, 19.4], look: [270.0, 3.2, 4.5], fov: 45, roll: 0.008 };
      const b: Cam = { pos: [269.8, 3.5, 21.2], look: [270.0, 3.6, 4.0], fov: 46, roll: -0.008 };
      return mix(a, b, e);
    }
  }
};

export const dofAt = (f: number): { cInf: number } => {
  const id = shotAt(f).id;
  if (id === 2 || id === 7 || id === 10 || id === 11) return { cInf: 2.2 };
  if (id === 5 || id === 6 || id === 8 || id === 9) return { cInf: 5.5 };
  return { cInf: 3.8 };
};
