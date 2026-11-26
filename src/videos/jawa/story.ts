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

export type JawaShot = {
  id: number;
  a: number;
  b: number;
  light: CafeLight;
};

// 11 cinematic historical shots across 4 eras of Pulau Jawa (58.0s total)
export const SHOTS: JawaShot[] = [
  { id: 1,  a: 0,    b: 132,  light: "day" },    // 0.0 - 4.4s: Hook - 7% luas Indonesia, 56% penduduk!
  { id: 2,  a: 132,  b: 288,  light: "day" },    // 4.4 - 9.6s: Paparan Sunda (Zaman Es) & Manusia Purba Sangiran
  { id: 3,  a: 288,  b: 438,  light: "day" },    // 9.6 - 14.6s: Laut naik + deretan gunung berapi menyuburkan tanah
  { id: 4,  a: 438,  b: 594,  light: "day" },    // 14.6 - 19.8s: Sawah terasering subur — "Yawadwipa" (Pulau Padi)
  { id: 5,  a: 594,  b: 750,  light: "golden" }, // 19.8 - 25.0s: Era Mataram Kuno — Candi Borobudur 3D di senja keemasan
  { id: 6,  a: 750,  b: 912,  light: "golden" }, // 25.0 - 30.4s: Majapahit — Gapura Candi Bentar, Kapal Jong & Bhinneka Tunggal Ika
  { id: 7,  a: 912,  b: 1086, light: "golden" }, // 30.4 - 36.2s: Wali Songo & Kesultanan Demak (Masjid atap tumpang 3)
  { id: 8,  a: 1086, b: 1236, light: "golden" }, // 36.2 - 41.2s: Era Kolonial — Kereta uap & jalur perdagangan Jawa
  { id: 9,  a: 1236, b: 1404, light: "dusk" },   // 41.2 - 46.8s: Proklamasi Kemerdekaan 17 Agustus 1945 + Sang Saka Merah Putih
  { id: 10, a: 1404, b: 1578, light: "dusk" },   // 46.8 - 52.6s: Jawa Modern — Monas 3D + 150+ juta jiwa pulau terpadat di dunia
  { id: 11, a: 1578, b: TOTAL, light: "dusk" },  // 52.6 - 58.0s: Grand finale — Monas & skyline berkilau + gunung berapi di belakang
];

export const XFADE: Record<number, number> = { 5: 8, 7: 8, 9: 8 };
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

// World coordinate map (4 eras cleanly separated along +X):
// Zone 1 (x = 0):   Jawa Purba, Paparan Sunda, 3 Gunung Berapi & Sawah Terasering (Shots 1–4)
// Zone 2 (x = 90):  Candi Borobudur 3D (x = 88, z = -3) & Gapura Majapahit + Kapal Jong (x = 102, z = 4) (Shots 5–6)
// Zone 3 (x = 180): Masjid Agung Demak atap tumpang 3 (x = 176, z = -2) & Jalur Kereta Uap Kolonial (x = 180, z = 8) (Shots 7–8)
// Zone 4 (x = 270): Plaza Proklamasi 1945 (z = 11) + Monas 3D & Modern Java Skyline (z = -3) (Shots 9–11)
export const camAt = (id: number, f: number): Cam => {
  const s = SHOTS[id - 1];
  const u = clamp01((f - s.a) / Math.max(1, s.b - s.a));
  const e = glide(u);

  switch (id) {
    case 1: {
      // Hook: Iconic lush volcanic Pulau Jawa + terraced sawah + floating 7% vs 56% card!
      const a: Cam = { pos: [0.4, 5.2, 20.5], look: [0.0, 3.3, 1.5], fov: 44, roll: -0.01 };
      const b: Cam = { pos: [-0.4, 4.4, 17.8], look: [0.0, 3.1, 2.0], fov: 42, roll: 0.01 };
      return mix(a, b, e);
    }
    case 2: {
      // Paparan Sunda & Manusia Purba Sangiran standing on ancient land bridge
      const a: Cam = { pos: [-3.8, 3.6, 15.8], look: [-0.8, 2.3, 5.2], fov: 44, roll: 0 };
      const b: Cam = { pos: [1.8, 2.9, 13.6], look: [-0.5, 2.1, 5.6], fov: 42, roll: 0 };
      return mix(a, b, e);
    }
    case 3: {
      // Dramatic low-to-high volcanic eruption smoke + glowing crater + rising sea & lush foothills
      const a: Cam = { pos: [6.5, 4.8, 19.8], look: [0.0, 5.6, -4.5], fov: 45, roll: 0.012 };
      const b: Cam = { pos: [-5.5, 6.2, 18.2], look: [0.0, 6.2, -4.5], fov: 43, roll: -0.012 };
      return mix(a, b, e);
    }
    case 4: {
      // Yawadwipa (Pulau Padi): golden-green terraced sawah + happy Javanese farmer holding rice sheaves
      const a: Cam = { pos: [2.2, 2.6, 13.8], look: [1.5, 2.0, 5.8], fov: 42, roll: -0.008 };
      const b: Cam = { pos: [1.1, 2.35, 12.2], look: [1.4, 1.95, 5.8], fov: 40, roll: 0.008 };
      return mix(a, b, e);
    }
    case 5: {
      // Zone 2 (x = 90): Golden sunset sweeping reveal of 3D Candi Borobudur!
      const a: Cam = { pos: [82.5, 4.6, 16.2], look: [88.5, 4.2, -2.5], fov: 44, roll: 0 };
      const b: Cam = { pos: [93.5, 5.8, 14.5], look: [88.5, 4.4, -2.5], fov: 42, roll: 0 };
      return mix(a, b, e);
    }
    case 6: {
      // Zone 2 Right (x = 104): Majapahit Candi Bentar red-brick gate + royal knight + Nusantara Jong ship!
      const a: Cam = { pos: [101.2, 3.0, 15.8], look: [103.5, 2.6, 4.2], fov: 43, roll: -0.01 };
      const b: Cam = { pos: [105.4, 2.8, 14.4], look: [103.5, 2.6, 4.2], fov: 41, roll: 0.01 };
      return mix(a, b, e);
    }
    case 7: {
      // Zone 3 (x = 180): Masjid Agung Demak (3-tier roof) + Wali Songo & villagers
      const a: Cam = { pos: [174.5, 3.5, 13.8], look: [178.0, 2.8, 0.5], fov: 43, roll: 0 };
      const b: Cam = { pos: [181.2, 3.2, 12.2], look: [178.0, 2.7, 0.5], fov: 41, roll: 0 };
      return mix(a, b, e);
    }
    case 8: {
      // Zone 3 Front (x = 180, z = 8): Animated 3D Steam Locomotive chugging across colonial Java rail!
      const a: Cam = { pos: [176.5, 3.4, 19.2], look: [180.0, 2.1, 7.6], fov: 44, roll: 0.012 };
      const b: Cam = { pos: [184.2, 3.1, 18.0], look: [181.5, 2.1, 7.6], fov: 42, roll: -0.012 };
      return mix(a, b, e);
    }
    case 9: {
      // Zone 4 (x = 270): Proklamasi 17 Agustus 1945 — Sang Saka Merah Putih cleanly ABOVE card + Pemuda Merdeka!
      const a: Cam = { pos: [268.4, 3.0, 23.2], look: [270.0, 3.1, 11.2], fov: 44, roll: -0.01 };
      const b: Cam = { pos: [271.2, 2.9, 21.6], look: [270.0, 3.1, 11.2], fov: 42, roll: 0.01 };
      return mix(a, b, e);
    }
    case 10: {
      // Zone 4 (x = 270): Epic rise of 3D Monas (Golden Flame!) + Glowing Modern Java Skyline!
      const a: Cam = { pos: [265.2, 4.4, 25.5], look: [270.0, 6.2, -2.5], fov: 46, roll: 0 };
      const b: Cam = { pos: [274.2, 7.8, 32.5], look: [270.0, 9.2, -2.5], fov: 48, roll: -0.008 };
      return mix(a, b, e);
    }
    default: {
      // Shot 11 Grand Finale: Full gleaming Golden Flame Monas + Glowing Skyline + Modern Javanese citizen + badge!
      const a: Cam = { pos: [270.2, 3.4, 29.2], look: [270.0, 7.2, 1.0], fov: 48, roll: 0.008 };
      const b: Cam = { pos: [269.8, 4.0, 32.5], look: [270.0, 8.2, 0.0], fov: 48, roll: -0.008 };
      return mix(a, b, e);
    }
  }
};

export const dofAt = (f: number): { cInf: number } => {
  const id = shotAt(f).id;
  if (id === 1 || id === 3 || id === 5 || id === 10 || id === 11) return { cInf: 2.2 }; // crisp monumental views
  if (id === 4 || id === 6 || id === 7 || id === 9) return { cInf: 6.5 };
  return { cInf: 4.5 };
};
