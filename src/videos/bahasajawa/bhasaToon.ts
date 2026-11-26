import * as THREE from "three";

const INK = "#221626";

export type Mood = "smile" | "proud" | "amazed" | "peaceful" | "focused" | "respect";
export type Pose = "stand" | "point" | "write_lontar" | "salam" | "bow" | "cheer" | "paddle";
export type Role = "pelaut" | "pujangga" | "keraton" | "muda";

type CharSpec = {
  skin: string;
  top: string;
  bottom: string;
  accent: string;
  headgear: "headband" | "sage_bun" | "blangkon_gold" | "modern_hair";
};

const SPECS: Record<Role, CharSpec> = {
  pelaut:   { skin: "#d99d72", top: "#327a66", bottom: "#5c422c", accent: "#f2c94c", headgear: "headband" },
  pujangga: { skin: "#e2ae84", top: "#f5ebd6", bottom: "#7a4428", accent: "#e8b43c", headgear: "sage_bun" },
  keraton:  { skin: "#e6b48a", top: "#2c2436", bottom: "#8c5426", accent: "#ffd44d", headgear: "blangkon_gold" },
  muda:     { skin: "#e8b890", top: "#2e6cb5", bottom: "#2b3245", accent: "#ffcf40", headgear: "modern_hair" },
};

const drawBeanHead = (g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, fill: string) => {
  g.beginPath();
  g.moveTo(cx, cy - ry);
  g.bezierCurveTo(cx + rx * 1.06, cy - ry * 0.92, cx + rx * 1.02, cy + ry * 0.55, cx + rx * 0.62, cy + ry * 0.92);
  g.bezierCurveTo(cx + rx * 0.28, cy + ry * 1.06, cx - rx * 0.28, cy + ry * 1.06, cx - rx * 0.62, cy + ry * 0.92);
  g.bezierCurveTo(cx - rx * 1.02, cy + ry * 0.55, cx - rx * 1.06, cy - ry * 0.92, cx, cy - ry);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 11;
  g.strokeStyle = INK;
  g.stroke();
};

const drawFace = (g: CanvasRenderingContext2D, cx: number, cy: number, mood: Mood, dir: number) => {
  const ox = dir * 14;
  const ex = 40;
  const ey = cy + 6;
  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineCap = "round";
  g.lineJoin = "round";

  if (mood === "proud" || mood === "peaceful" || mood === "respect") {
    g.lineWidth = 8;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(cx + ox + s * ex, ey + 6, 15, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    }
  } else if (mood === "amazed") {
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(cx + ox + s * ex, ey, 16, 0, Math.PI * 2);
      g.fillStyle = "#ffffff";
      g.fill();
      g.lineWidth = 7;
      g.stroke();
      g.beginPath();
      g.arc(cx + ox + s * ex, ey, 6, 0, Math.PI * 2);
      g.fillStyle = INK;
      g.fill();
    }
  } else {
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(cx + ox + s * ex, ey, 10, 13, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  g.lineWidth = 8;
  g.strokeStyle = INK;
  for (const s of [-1, 1]) {
    const bx = cx + ox + s * ex;
    const by = ey - 31;
    g.beginPath();
    g.moveTo(bx - 16, by);
    g.quadraticCurveTo(bx, by - 8, bx + 16, by);
    g.stroke();
  }

  g.fillStyle = "rgba(235, 110, 90, 0.28)";
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + ox + s * 54, ey + 24, 14, 8, 0, 0, Math.PI * 2);
    g.fill();
  }

  const mx = cx + ox;
  const my = cy + 54;
  g.lineWidth = 8;
  g.strokeStyle = INK;
  g.beginPath();
  if (mood === "amazed") {
    g.ellipse(mx, my + 8, 14, 18, 0, 0, Math.PI * 2);
    g.fillStyle = "#8c2832";
    g.fill();
    g.stroke();
  } else {
    g.arc(mx, my - 4, 23, 0.14 * Math.PI, 0.86 * Math.PI);
    g.stroke();
  }
};

const drawHeadgear = (g: CanvasRenderingContext2D, cx: number, cy: number, spec: CharSpec) => {
  const hy = cy - 86;
  g.strokeStyle = INK;
  g.lineWidth = 10;
  g.lineJoin = "round";

  if (spec.headgear === "headband") {
    // Ancient Austronesian navigator woven headband + hair
    g.fillStyle = "#2b2024";
    g.beginPath();
    g.arc(cx, hy + 20, 92, Math.PI, 0);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#d94b2b";
    g.beginPath();
    g.roundRect(cx - 94, hy - 2, 188, 30, 12);
    g.fill();
    g.stroke();
  } else if (spec.headgear === "sage_bun") {
    // Ancient Javanese Pujangga topknot (Gelung) + golden hair ring!
    g.fillStyle = "#362b30";
    g.beginPath();
    g.arc(cx, hy + 22, 92, Math.PI, 0);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(cx, hy - 68, 34, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = "#ffd64d";
    g.beginPath();
    g.roundRect(cx - 38, hy - 44, 76, 18, 8);
    g.fill();
    g.stroke();
  } else if (spec.headgear === "blangkon_gold") {
    // Royal Mataram Batik Blangkon with golden trim & batik wing!
    g.fillStyle = "#7a4424";
    g.beginPath();
    g.arc(cx, hy + 22, 94, Math.PI, 0);
    g.closePath();
    g.fill();
    g.stroke();
    g.strokeStyle = "#ffd64d";
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(cx - 88, hy + 10);
    g.quadraticCurveTo(cx, hy - 14, cx + 88, hy + 10);
    g.stroke();
  } else {
    // Modern neat dark hair
    g.fillStyle = "#241d29";
    g.beginPath();
    g.arc(cx, hy + 24, 94, Math.PI * 0.94, Math.PI * 0.06);
    g.quadraticCurveTo(cx + 30, hy - 4, cx - 25, hy + 16);
    g.closePath();
    g.fill();
    g.stroke();
  }
};

export const drawBhasaCharacter = (
  g: CanvasRenderingContext2D,
  role: Role,
  mood: Mood,
  pose: Pose,
  phase: number,
  dir: number,
) => {
  const W = g.canvas.width;
  const H = g.canvas.height;
  g.clearRect(0, 0, W, H);
  const spec = SPECS[role];
  const cx = W * 0.5;
  const bob = Math.sin(phase * Math.PI * 2) * (pose === "cheer" ? 16 : 6);

  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = INK;
  g.lineWidth = 11;

  const footY = H - 36;
  const hipY = H - 235 + bob;

  // Jarik Batik / Sarong for Pujangga & Keraton, pants for Pelaut & Muda
  if (role === "pujangga" || role === "keraton") {
    g.fillStyle = spec.bottom;
    g.beginPath();
    g.roundRect(cx - 68, hipY - 10, 136, footY - hipY - 8, 22);
    g.fill();
    g.stroke();
    g.strokeStyle = spec.accent;
    g.lineWidth = 7;
    for (let y = hipY + 34; y < footY - 38; y += 42) {
      g.beginPath();
      g.moveTo(cx - 56, y);
      g.lineTo(cx + 56, y + 18);
      g.stroke();
    }
    g.strokeStyle = INK;
    g.lineWidth = 11;
  } else {
    for (const s of [-1, 1]) {
      const lx = cx + s * 34;
      g.fillStyle = spec.bottom;
      g.beginPath();
      g.roundRect(lx - 22, hipY, 44, footY - hipY - 22, 16);
      g.fill();
      g.stroke();
      g.fillStyle = "#2b1d1c";
      g.beginPath();
      g.ellipse(lx + s * 6, footY - 12, 32, 18, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }

  // Torso (Beskap / Tunic / Batik Shirt)
  const torsoTop = hipY - 225;
  g.fillStyle = spec.top;
  g.beginPath();
  g.moveTo(cx - 70, torsoTop + 12);
  g.quadraticCurveTo(cx, torsoTop - 16, cx + 70, torsoTop + 12);
  g.lineTo(cx + 90, hipY + 32);
  g.quadraticCurveTo(cx, hipY + 48, cx - 90, hipY + 32);
  g.closePath();
  g.fill();
  g.stroke();

  // Gold sash / belt
  g.fillStyle = spec.accent;
  g.fillRect(cx - 78, hipY - 38, 156, 26);
  g.strokeRect(cx - 78, hipY - 38, 156, 26);

  // Arms
  const shY = torsoTop + 44;
  const drawArm = (sx: number, sy: number, ex: number, ey: number, mx: number, my: number) => {
    g.strokeStyle = INK;
    g.lineWidth = 44;
    g.beginPath();
    g.moveTo(sx, sy);
    g.quadraticCurveTo(mx, my, ex, ey);
    g.stroke();
    g.strokeStyle = spec.top;
    g.lineWidth = 24;
    g.beginPath();
    g.moveTo(sx, sy);
    g.quadraticCurveTo(mx, my, ex, ey);
    g.stroke();
    g.fillStyle = spec.skin;
    g.strokeStyle = INK;
    g.lineWidth = 9;
    g.beginPath();
    g.arc(ex, ey, 22, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  };

  if (pose === "cheer") {
    const wave = Math.sin(phase * Math.PI * 4) * 22;
    drawArm(cx - 70, shY, cx - 152, shY - 122 + wave, cx - 130, shY - 30);
    drawArm(cx + 70, shY, cx + 152, shY - 122 - wave, cx + 130, shY - 30);
  } else if (pose === "salam" || pose === "bow") {
    // Respectful Javanese Ngapurancang / Salam hands folded warmly at chest!
    drawArm(cx - 70, shY, cx - 14, shY + 76, cx - 112, shY + 86);
    drawArm(cx + 70, shY, cx + 14, shY + 76, cx + 112, shY + 86);
  } else if (pose === "write_lontar") {
    // Holding golden Lontar palm-leaf manuscript + stylus!
    drawArm(cx - 70, shY, cx - 44, shY + 86, cx - 114, shY + 72);
    const wr = Math.sin(phase * Math.PI * 6) * 10;
    drawArm(cx + 70, shY, cx + 62 + wr, shY + 72, cx + 116, shY + 76);
    g.fillStyle = "#f2dfa6";
    g.strokeStyle = INK;
    g.lineWidth = 8;
    g.beginPath();
    g.roundRect(cx - 72, shY + 68, 144, 38, 10);
    g.fill();
    g.stroke();
  } else if (pose === "paddle") {
    drawArm(cx - 70, shY, cx - 124, shY + 84, cx - 118, shY + 46);
    drawArm(cx + 70, shY, cx + 136, shY + 28, cx + 124, shY + 60);
    g.strokeStyle = "#6e4222";
    g.lineWidth = 14;
    g.beginPath();
    g.moveTo(cx + 136, shY - 115);
    g.lineTo(cx + 136, H - 30);
    g.stroke();
  } else if (pose === "point") {
    drawArm(cx - 70, shY, cx - 108, shY + 108, cx - 114, shY + 56);
    drawArm(cx + 70, shY, cx + 162, shY - 24, cx + 126, shY + 14);
  } else {
    const sw = Math.sin(phase * Math.PI * 2) * 14;
    drawArm(cx - 70, shY, cx - 104, shY + 120 + sw, cx - 114, shY + 60);
    drawArm(cx + 70, shY, cx + 104, shY + 120 - sw, cx + 114, shY + 60);
  }

  // Head
  const headY = torsoTop - 94 + (pose === "bow" ? 12 : 0);
  drawBeanHead(g, cx, headY, 94, 106, spec.skin);
  drawFace(g, cx, headY, mood, dir);
  drawHeadgear(g, cx, headY, spec);
};

// --- Rich Linguistic Showcase Cards (100% pure Canvas vector + bold Indonesian typography, ZERO emojis, ZERO missing-font tofu!) ---

const makeCardCanvas = (w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
};

// Shot 1 Hook Card
export const makeBhasaHookTex = () =>
  makeCardCanvas(960, 350, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "rgba(24, 18, 38, 0.94)";
    g.strokeStyle = "#ffd954";
    g.lineWidth = 12;
    g.beginPath();
    g.roundRect(18, 18, w - 36, h - 36, 40);
    g.fill();
    g.stroke();

    g.fillStyle = "#ffdf5e";
    g.font = "900 56px -apple-system, BlinkMacSystemFont, sans-serif";
    g.textAlign = "center";
    g.fillText("ASAL USUL BAHASA JAWA", w / 2, 106);

    g.fillStyle = "#265c8c";
    g.beginPath();
    g.roundRect(58, 140, 390, 146, 24);
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = "900 58px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("80+ JUTA", 253, 214);
    g.fillStyle = "#9ae2ff";
    g.font = "800 28px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("PENUTUR AKTIF", 253, 258);

    g.fillStyle = "#9e3424";
    g.beginPath();
    g.roundRect(w - 448, 140, 390, 146, 24);
    g.fill();
    g.fillStyle = "#ffdf5e";
    g.font = "900 56px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("1.200+ THN", w - 253, 214);
    g.fillStyle = "#fff2e0";
    g.font = "800 28px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("SEJARAH TERTULIS", w - 253, 258);
  });

const makeBadge = (title: string, subtitle: string, bg: string, border: string, titleCol: string) =>
  makeCardCanvas(860, 225, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = bg;
    g.strokeStyle = border;
    g.lineWidth = 12;
    g.beginPath();
    g.roundRect(16, 16, w - 32, h - 32, 34);
    g.fill();
    g.stroke();

    g.fillStyle = titleCol;
    g.font = "900 52px -apple-system, BlinkMacSystemFont, sans-serif";
    g.textAlign = "center";
    g.fillText(title, w / 2, 104);

    g.fillStyle = "#f7efe0";
    g.font = "800 32px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText(subtitle, w / 2, 166);
  });

export const makeAustronesiaTex = () =>
  makeBadge("RUMPUN AUSTRONESIA", "PELAYARAN 4.000 TAHUN LALU KE NUSANTARA", "rgba(18, 46, 78, 0.93)", "#7ce0ff", "#8ce6ff");

export const makeFamilyTex = () =>
  makeBadge("MELAYU-POLINESIA", "JAWA · MELAYU · TAGALOG · HAWAII", "rgba(22, 60, 56, 0.93)", "#ffd954", "#ffdf5e");

export const makeKawiSanskritTex = () =>
  makeCardCanvas(860, 225, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "rgba(68, 30, 18, 0.94)";
    g.strokeStyle = "#ffd954";
    g.lineWidth = 12;
    g.beginPath();
    g.roundRect(16, 16, w - 32, h - 32, 34);
    g.fill();
    g.stroke();
    g.fillStyle = "#ffdf5e";
    g.font = "900 50px -apple-system, BlinkMacSystemFont, sans-serif";
    g.textAlign = "center";
    g.fillText("JAWA KUNO (KAWI)", w / 2, 102);
    g.fillStyle = "#f7efe0";
    g.font = "800 26px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("AUSTRONESIA + SANSEKERTA (BHUMI · RAJA · NAGARA)", w / 2, 162);
  });

export const makeSukabumiTex = () =>
  makeBadge("PRASASTI SUKABUMI", "25 MARET 804 M — TEKS JAWA TERTUA (KEDIRI)", "rgba(56, 36, 22, 0.94)", "#f5c556", "#ffdf5e");

// Shot 6: Custom Vector Calligraphy Card for Pallawa -> Kawi -> Hanacaraka (drawn with smooth Bezier curves so ZERO font tofu!)
export const makeHanacarakaCardTex = () =>
  makeCardCanvas(940, 420, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#f7e8c4";
    g.strokeStyle = INK;
    g.lineWidth = 14;
    g.beginPath();
    g.roundRect(22, 22, w - 44, h - 44, 36);
    g.fill();
    g.stroke();

    g.strokeStyle = "#b57c36";
    g.lineWidth = 5;
    g.beginPath();
    g.roundRect(44, 44, w - 88, h - 88, 22);
    g.stroke();

    g.fillStyle = "#2b1b24";
    g.font = "900 44px -apple-system, BlinkMacSystemFont, sans-serif";
    g.textAlign = "center";
    g.fillText("EVOLUSI AKSARA JAWA", w / 2, 108);

    g.fillStyle = "#a83222";
    g.font = "900 34px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("PALLAWA (INDIA)  →  KAWI  →  HANACARAKA", w / 2, 162);

    // Draw stylized calligraphic Javanese Aksara-inspired golden/ink arches (Ha - Na - Ca - Ra - Ka) purely with Canvas curves!
    const drawGlyph = (gx: number, gy: number, arches: number, tail: boolean) => {
      g.strokeStyle = "#2b1b24";
      g.lineWidth = 11;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      let x = gx - (arches * 22);
      g.moveTo(x, gy + 28);
      for (let i = 0; i < arches; i++) {
        g.bezierCurveTo(x, gy - 32, x + 44, gy - 32, x + 44, gy + 28);
        x += 44;
      }
      if (tail) {
        g.bezierCurveTo(x, gy + 44, x - 18, gy + 50, x - 26, gy + 36);
      }
      g.stroke();
    };

    const labels = ["HA", "NA", "CA", "RA", "KA"];
    const archCounts = [3, 2, 3, 2, 3];
    const tails = [false, true, true, false, true];
    for (let i = 0; i < 5; i++) {
      const gx = 148 + i * 162;
      drawGlyph(gx, 255, archCounts[i], tails[i]);
      g.fillStyle = "#8a4a18";
      g.font = "900 30px -apple-system, BlinkMacSystemFont, sans-serif";
      g.fillText(labels[i], gx, 342);
    }
  });

// Shot 8: Viral Relatable 3-Tier Unggah-Ungguh Card (MANGAN -> NEDHA -> DHAHAR!)
export const makeUnggahCardTex = () =>
  makeCardCanvas(960, 390, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "rgba(26, 18, 36, 0.94)";
    g.strokeStyle = "#ffd954";
    g.lineWidth = 12;
    g.beginPath();
    g.roundRect(18, 18, w - 36, h - 36, 38);
    g.fill();
    g.stroke();

    g.fillStyle = "#ffdf5e";
    g.font = "900 46px -apple-system, BlinkMacSystemFont, sans-serif";
    g.textAlign = "center";
    g.fillText("TINGKAT TUTUR (UNGGAH-UNGGUH)", w / 2, 96);

    const tiers: [number, string, string, string, string][] = [
      [52,  "NGOKO", "MANGAN", "Teman Akrab", "#2e75a8"],
      [356, "MADYA", "NEDHA",  "Menengah",    "#b87324"],
      [660, "KRAMA", "DHAHAR", "Sangat Halus", "#9c2b3a"],
    ];
    for (const [px, lvl, word, desc, col] of tiers) {
      g.fillStyle = col;
      g.beginPath();
      g.roundRect(px, 132, 248, 200, 24);
      g.fill();
      g.fillStyle = "#ffe580";
      g.font = "800 28px -apple-system, BlinkMacSystemFont, sans-serif";
      g.fillText(lvl, px + 124, 178);
      g.fillStyle = "#ffffff";
      g.font = "900 44px -apple-system, BlinkMacSystemFont, sans-serif";
      g.fillText(word, px + 124, 244);
      g.fillStyle = "#f2eee6";
      g.font = "700 26px -apple-system, BlinkMacSystemFont, sans-serif";
      g.fillText(desc, px + 124, 298);
    }
  });

export const makeEtikaTex = () =>
  makeBadge("ETIKA DALAM BAHASA", "SATU ARTI, TIGA TINGKAT KESOPANAN", "rgba(44, 24, 48, 0.94)", "#ffd954", "#ffdf5e");

export const makeGlobalJavaTex = () =>
  makeBadge("JAWA MENDUNIA", "SURINAME (AMERIKA) · KALEDONIA BARU (PASIFIK)", "rgba(18, 32, 64, 0.94)", "#7ce0ff", "#8ce6ff");

export const makeBhasaFinaleTex = () =>
  makeBadge("80+ JUTA PENUTUR", "WARISAN 1.200+ TAHUN BUDAYA NUSANTARA", "rgba(22, 20, 44, 0.94)", "#ffd954", "#ffdf5e");
