import * as THREE from "three";

const INK = "#221626";

export type Mood = "smile" | "proud" | "amazed" | "peaceful" | "heroic" | "calm";
export type Pose = "stand" | "hold_spear" | "hold_rice" | "salute_keris" | "greet" | "fist_up" | "cheer";
export type Role = "purba" | "petani" | "majapahit" | "wali" | "pemuda" | "modern";

type CharSpec = {
  skin: string;
  top: string;
  bottom: string;
  accent: string;
  headgear: "wild" | "caping" | "crown" | "udeng_white" | "peci" | "blangkon";
};

const SPECS: Record<Role, CharSpec> = {
  purba:     { skin: "#d99e73", top: "#8c5630", bottom: "#6e4224", accent: "#c7894a", headgear: "wild" },
  petani:    { skin: "#e0ab80", top: "#4f7a44", bottom: "#5c4330", accent: "#e8c456", headgear: "caping" },
  majapahit: { skin: "#e6b488", top: "#b82525", bottom: "#3b221a", accent: "#ffd44d", headgear: "crown" },
  wali:      { skin: "#e6b68c", top: "#f7f4ec", bottom: "#4a6b5c", accent: "#d4b054", headgear: "udeng_white" },
  pemuda:    { skin: "#e6b48a", top: "#c7b287", bottom: "#6e5c3e", accent: "#d92b2b", headgear: "peci" },
  modern:    { skin: "#e8b990", top: "#2c6cb0", bottom: "#2b3042", accent: "#f2c14e", headgear: "blangkon" },
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

  if (mood === "proud" || mood === "peaceful") {
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

  // Eyebrows
  g.lineWidth = 8;
  g.strokeStyle = INK;
  for (const s of [-1, 1]) {
    const bx = cx + ox + s * ex;
    const by = ey - 31;
    g.beginPath();
    if (mood === "heroic") {
      g.moveTo(bx - s * 16, by - 4);
      g.lineTo(bx + s * 16, by + 7);
    } else {
      g.moveTo(bx - 16, by);
      g.quadraticCurveTo(bx, by - 8, bx + 16, by);
    }
    g.stroke();
  }

  // Warm cheek blush
  g.fillStyle = "rgba(235, 110, 90, 0.28)";
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + ox + s * 54, ey + 24, 14, 8, 0, 0, Math.PI * 2);
    g.fill();
  }

  // Mouth
  const mx = cx + ox;
  const my = cy + 54;
  g.lineWidth = 8;
  g.strokeStyle = INK;
  g.beginPath();
  if (mood === "smile" || mood === "proud" || mood === "peaceful") {
    g.arc(mx, my - 4, 24, 0.14 * Math.PI, 0.86 * Math.PI);
    g.stroke();
  } else if (mood === "heroic") {
    g.arc(mx, my + 2, 22, 0.08 * Math.PI, 0.92 * Math.PI);
    g.fillStyle = "#8c2832";
    g.fill();
    g.stroke();
  } else if (mood === "amazed") {
    g.ellipse(mx, my + 8, 14, 18, 0, 0, Math.PI * 2);
    g.fillStyle = "#8c2832";
    g.fill();
    g.stroke();
  } else {
    g.moveTo(mx - 15, my + 6);
    g.quadraticCurveTo(mx, my + 14, mx + 15, my + 6);
    g.stroke();
  }
};

const drawHeadgear = (g: CanvasRenderingContext2D, cx: number, cy: number, spec: CharSpec) => {
  const hy = cy - 86;
  g.strokeStyle = INK;
  g.lineWidth = 10;
  g.lineJoin = "round";

  if (spec.headgear === "wild") {
    // Prehistoric messy dark hair
    g.fillStyle = "#2b2024";
    g.beginPath();
    g.arc(cx, hy + 24, 96, Math.PI * 0.9, Math.PI * 0.1);
    g.lineTo(cx + 92, hy - 25);
    g.lineTo(cx + 42, hy - 54);
    g.lineTo(cx, hy - 74);
    g.lineTo(cx - 46, hy - 52);
    g.lineTo(cx - 94, hy - 22);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (spec.headgear === "caping") {
    // Iconic woven bamboo Javanese farmer Caping hat!
    g.fillStyle = "#e6be6c";
    g.beginPath();
    g.moveTo(cx - 142, hy + 26);
    g.lineTo(cx, hy - 86);
    g.lineTo(cx + 142, hy + 26);
    g.quadraticCurveTo(cx, hy + 46, cx - 142, hy + 26);
    g.closePath();
    g.fill();
    g.stroke();
    // Woven accent band
    g.strokeStyle = "#b58032";
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(cx - 88, hy - 12);
    g.quadraticCurveTo(cx, hy + 4, cx + 88, hy - 12);
    g.stroke();
  } else if (spec.headgear === "crown") {
    // Majapahit golden royal crown (Makuta)
    g.fillStyle = "#ffd23f";
    g.beginPath();
    g.moveTo(cx - 82, hy + 20);
    g.lineTo(cx - 96, hy - 48);
    g.lineTo(cx - 42, hy - 18);
    g.lineTo(cx, hy - 98);
    g.lineTo(cx + 42, hy - 18);
    g.lineTo(cx + 96, hy - 48);
    g.lineTo(cx + 82, hy + 20);
    g.closePath();
    g.fill();
    g.stroke();
    // Ruby jewel center
    g.fillStyle = "#d92b2b";
    g.beginPath();
    g.arc(cx, hy - 12, 16, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else if (spec.headgear === "udeng_white") {
    // Wali Songo white Javanese turban / udeng
    g.fillStyle = "#f7f4ec";
    g.beginPath();
    g.arc(cx, hy + 16, 98, Math.PI * 0.96, Math.PI * 0.04);
    g.quadraticCurveTo(cx, hy + 42, cx - 98, hy + 16);
    g.closePath();
    g.fill();
    g.stroke();
    g.strokeStyle = "#d4b054";
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(cx - 86, hy + 6);
    g.quadraticCurveTo(cx, hy - 28, cx + 86, hy + 6);
    g.stroke();
  } else if (spec.headgear === "peci") {
    // Iconic Indonesian black Peci (1945 Independence!)
    g.fillStyle = "#1c1a24";
    g.beginPath();
    g.roundRect(cx - 84, hy - 48, 168, 72, 18);
    g.fill();
    g.stroke();
    // Red-white independence pin on peci!
    g.fillStyle = "#e02b2b";
    g.fillRect(cx - 60, hy - 22, 26, 12);
    g.fillStyle = "#ffffff";
    g.fillRect(cx - 60, hy - 10, 26, 12);
  } else {
    // Modern Javanese Blangkon batik cap!
    g.fillStyle = "#7a4a2a";
    g.beginPath();
    g.arc(cx, hy + 22, 92, Math.PI, 0);
    g.closePath();
    g.fill();
    g.stroke();
    g.strokeStyle = "#f2c14e";
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(cx - 86, hy + 12);
    g.lineTo(cx + 86, hy + 12);
    g.stroke();
  }
};

export const drawJawaCharacter = (
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
  const bob = Math.sin(phase * Math.PI * 2) * (pose === "cheer" || pose === "fist_up" ? 16 : 7);

  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = INK;
  g.lineWidth = 11;

  const footY = H - 36;
  const hipY = H - 235 + bob;

  // Legs / Sarong / Kain Batik
  if (role === "wali" || role === "majapahit") {
    g.fillStyle = spec.bottom;
    g.beginPath();
    g.roundRect(cx - 68, hipY - 10, 136, footY - hipY - 8, 22);
    g.fill();
    g.stroke();
    // Gold batik diagonal stripes
    g.strokeStyle = spec.accent;
    g.lineWidth = 7;
    for (let y = hipY + 35; y < footY - 40; y += 44) {
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

  // Torso
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

  // Accent sash / belt
  g.fillStyle = spec.accent;
  g.fillRect(cx - 78, hipY - 38, 156, 28);
  g.strokeRect(cx - 78, hipY - 38, 156, 28);

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
  } else if (pose === "fist_up") {
    drawArm(cx - 70, shY, cx - 110, shY + 112, cx - 115, shY + 55);
    drawArm(cx + 70, shY, cx + 138, shY - 142, cx + 132, shY - 40);
  } else if (pose === "hold_rice") {
    // Holding golden bundle of Javanese rice stalks!
    drawArm(cx - 70, shY, cx - 42, shY + 86, cx - 118, shY + 72);
    drawArm(cx + 70, shY, cx + 42, shY + 86, cx + 118, shY + 72);
    g.fillStyle = "#f2c94c";
    g.strokeStyle = INK;
    g.lineWidth = 9;
    g.beginPath();
    g.ellipse(cx, shY + 72, 66, 38, -0.2, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.strokeStyle = "#c98b24";
    g.lineWidth = 6;
    for (let dx = -34; dx <= 34; dx += 17) {
      g.beginPath();
      g.moveTo(cx + dx, shY + 42);
      g.lineTo(cx + dx - 12, shY + 102);
      g.stroke();
    }
  } else if (pose === "hold_spear") {
    drawArm(cx - 70, shY, cx - 110, shY + 112, cx - 116, shY + 56);
    drawArm(cx + 70, shY, cx + 135, shY + 26, cx + 125, shY + 62);
    // Wooden prehistoric spear
    g.strokeStyle = "#5c3b22";
    g.lineWidth = 14;
    g.beginPath();
    g.moveTo(cx + 135, shY - 180);
    g.lineTo(cx + 135, H - 45);
    g.stroke();
    g.fillStyle = "#9ea3ab";
    g.strokeStyle = INK;
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(cx + 135, shY - 235);
    g.lineTo(cx + 158, shY - 175);
    g.lineTo(cx + 112, shY - 175);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (pose === "salute_keris") {
    drawArm(cx - 70, shY, cx - 112, shY + 105, cx - 116, shY + 55);
    drawArm(cx + 70, shY, cx + 152, shY - 68, cx + 132, shY - 6);
    // Golden Majapahit Keris blade raised!
    g.fillStyle = "#ffd64d";
    g.strokeStyle = INK;
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(cx + 152, shY - 185);
    g.lineTo(cx + 168, shY - 88);
    g.lineTo(cx + 136, shY - 88);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (pose === "greet") {
    // Respectful Indonesian Salam greeting (hands together at chest)
    drawArm(cx - 70, shY, cx - 16, shY + 78, cx - 112, shY + 86);
    drawArm(cx + 70, shY, cx + 16, shY + 78, cx + 112, shY + 86);
  } else {
    const sw = Math.sin(phase * Math.PI * 2) * 14;
    drawArm(cx - 70, shY, cx - 104, shY + 120 + sw, cx - 115, shY + 60);
    drawArm(cx + 70, shY, cx + 104, shY + 120 - sw, cx + 115, shY + 60);
  }

  // Head + Face + Headgear
  const headY = torsoTop - 94;
  drawBeanHead(g, cx, headY, 94, 106, spec.skin);
  drawFace(g, cx, headY, mood, dir);
  drawHeadgear(g, cx, headY, spec);
};

// --- Crisp 2D Historical Era Cards (pure vector + bold Indonesian typography, ZERO emojis) ---

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

// Shot 1 Hook Banner: PULAU JAWA — 7% LUAS vs 56% PENDUDUK
export const makeJawaHookTex = () =>
  makeCardCanvas(960, 340, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "rgba(18, 28, 48, 0.93)";
    g.strokeStyle = "#ffd954";
    g.lineWidth = 12;
    g.beginPath();
    g.roundRect(18, 18, w - 36, h - 36, 40);
    g.fill();
    g.stroke();

    g.fillStyle = "#ffffff";
    g.font = "900 54px -apple-system, BlinkMacSystemFont, sans-serif";
    g.textAlign = "center";
    g.fillText("SEJARAH PULAU JAWA", w / 2, 102);

    // Left box: 7% LUAS
    g.fillStyle = "#226b47";
    g.beginPath();
    g.roundRect(62, 138, 370, 146, 24);
    g.fill();
    g.fillStyle = "#ffdf5e";
    g.font = "900 66px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("7%", 247, 214);
    g.fillStyle = "#e8f7ee";
    g.font = "800 30px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("LUAS INDONESIA", 247, 260);

    // Right box: 56% PENDUDUK
    g.fillStyle = "#b53324";
    g.beginPath();
    g.roundRect(w - 432, 138, 370, 146, 24);
    g.fill();
    g.fillStyle = "#ffdf5e";
    g.font = "900 66px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("56%", w - 247, 214);
    g.fillStyle = "#fff2ee";
    g.font = "800 30px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("TOTAL PENDUDUK", w - 247, 260);
  });

const makeEraBadge = (title: string, subtitle: string, bg: string, border: string, titleCol: string) =>
  makeCardCanvas(820, 220, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = bg;
    g.strokeStyle = border;
    g.lineWidth = 12;
    g.beginPath();
    g.roundRect(16, 16, w - 32, h - 32, 34);
    g.fill();
    g.stroke();

    g.fillStyle = titleCol;
    g.font = "900 58px -apple-system, BlinkMacSystemFont, sans-serif";
    g.textAlign = "center";
    g.fillText(title, w / 2, 104);

    g.fillStyle = "#f7efe0";
    g.font = "800 34px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText(subtitle, w / 2, 166);
  });

export const makeSundaBadgeTex = () =>
  makeEraBadge("PAPARAN SUNDA", "JAWA MENYATU DENGAN BENUA ASIA", "rgba(22, 44, 72, 0.92)", "#7cd4ff", "#8ce0ff");

export const makeYawadwipaBadgeTex = () =>
  makeEraBadge("YAWADWIPA", "SANG PULAU PADI NUSANTARA", "rgba(38, 54, 24, 0.92)", "#ffd954", "#ffdf5e");

export const makeMajapahitBadgeTex = () =>
  makeEraBadge("MAJAPAHIT", "BHINNEKA TUNGGAL IKA", "rgba(84, 22, 18, 0.93)", "#ffd954", "#ffdf5e");

export const makeProklamasiBadgeTex = () =>
  makeEraBadge("17 AGUSTUS 1945", "PROKLAMASI KEMERDEKAAN RI", "rgba(150, 24, 24, 0.94)", "#ffffff", "#ffdf5e");

export const makeModernBadgeTex = () =>
  makeEraBadge("150+ JUTA JIWA", "PULAU TERPADAT DI PLANET BUMI", "rgba(14, 26, 52, 0.93)", "#ffd954", "#7ce2ff");
