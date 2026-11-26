import * as THREE from "three";

const INK = "#221626";

export type Mood = "amazed" | "shiver" | "sad" | "proud" | "idea" | "focused" | "spooky_smile" | "smile";
export type Pose = "stand" | "shiver" | "ride" | "write" | "monster_wave" | "cheer" | "point";
export type Role = "sumbawa" | "european" | "drais" | "shelley" | "frankenstein";

type CharSpec = {
  skin: string;
  top: string;
  bottom: string;
  accent: string;
  headgear: "ikat" | "winter_cap" | "tophat" | "bonnet" | "bolts";
};

const SPECS: Record<Role, CharSpec> = {
  sumbawa:      { skin: "#e0ab80", top: "#2c7a5b", bottom: "#4d3626", accent: "#f2c94c", headgear: "ikat" },
  european:     { skin: "#f5d4b8", top: "#5c6f8a", bottom: "#363e4f", accent: "#c94238", headgear: "winter_cap" },
  drais:        { skin: "#f7d7bc", top: "#2d4c7a", bottom: "#d9ceb8", accent: "#e8b942", headgear: "tophat" },
  shelley:      { skin: "#fae0c8", top: "#6e3866", bottom: "#4a2445", accent: "#f7e6c4", headgear: "bonnet" },
  frankenstein: { skin: "#7ec46b", top: "#3b3847", bottom: "#262430", accent: "#8c96a8", headgear: "bolts" },
};

const drawBeanHead = (g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, fill: string, flatTop = false) => {
  g.beginPath();
  if (flatTop) {
    // Classic flat-topped cute cartoon Frankenstein head!
    g.roundRect(cx - rx * 0.92, cy - ry * 0.95, rx * 1.84, ry * 1.9, 28);
  } else {
    g.moveTo(cx, cy - ry);
    g.bezierCurveTo(cx + rx * 1.06, cy - ry * 0.92, cx + rx * 1.02, cy + ry * 0.55, cx + rx * 0.62, cy + ry * 0.92);
    g.bezierCurveTo(cx + rx * 0.28, cy + ry * 1.06, cx - rx * 0.28, cy + ry * 1.06, cx - rx * 0.62, cy + ry * 0.92);
    g.bezierCurveTo(cx - rx * 1.02, cy + ry * 0.55, cx - rx * 1.06, cy - ry * 0.92, cx, cy - ry);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 11;
  g.strokeStyle = INK;
  g.stroke();
};

const drawFace = (g: CanvasRenderingContext2D, cx: number, cy: number, mood: Mood, role: Role, dir: number) => {
  const ox = dir * 14;
  const ex = 40;
  const ey = cy + 6;
  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineCap = "round";
  g.lineJoin = "round";

  if (mood === "proud" || mood === "idea") {
    g.lineWidth = 8;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(cx + ox + s * ex, ey + 6, 15, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    }
  } else if (mood === "amazed" || mood === "shiver") {
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
    if (mood === "shiver" || mood === "sad") {
      g.moveTo(bx - s * 16, by + 6);
      g.lineTo(bx + s * 16, by - 8);
    } else if (role === "frankenstein") {
      g.moveTo(bx - 18, by);
      g.lineTo(bx + 18, by);
    } else {
      g.moveTo(bx - 16, by);
      g.quadraticCurveTo(bx, by - 8, bx + 16, by);
    }
    g.stroke();
  }

  // Cute forehead stitch on Frankenstein!
  if (role === "frankenstein") {
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(cx - 42, cy - 52);
    g.lineTo(cx + 38, cy - 42);
    for (let sx = -30; sx <= 26; sx += 18) {
      g.moveTo(cx + sx, cy - 60);
      g.lineTo(cx + sx - 4, cy - 36);
    }
    g.stroke();
  }

  // Mouth
  const mx = cx + ox;
  const my = cy + 54;
  g.lineWidth = 8;
  g.strokeStyle = INK;
  g.beginPath();
  if (mood === "proud" || mood === "idea" || mood === "smile" || mood === "spooky_smile") {
    g.arc(mx, my - 4, 24, 0.14 * Math.PI, 0.86 * Math.PI);
    g.stroke();
  } else if (mood === "shiver") {
    // Chattering shivering zig-zag mouth!
    g.moveTo(mx - 24, my + 8);
    g.lineTo(mx - 12, my - 2);
    g.lineTo(mx, my + 10);
    g.lineTo(mx + 12, my - 2);
    g.lineTo(mx + 24, my + 8);
    g.stroke();
  } else if (mood === "sad") {
    g.arc(mx, my + 18, 20, 1.18 * Math.PI, 1.82 * Math.PI);
    g.stroke();
  } else if (mood === "amazed") {
    g.ellipse(mx, my + 8, 15, 20, 0, 0, Math.PI * 2);
    g.fillStyle = "#8c2832";
    g.fill();
    g.stroke();
  } else {
    g.moveTo(mx - 14, my + 6);
    g.quadraticCurveTo(mx, my + 14, mx + 14, my + 6);
    g.stroke();
  }
};

const drawHeadgear = (g: CanvasRenderingContext2D, cx: number, cy: number, spec: CharSpec) => {
  const hy = cy - 86;
  g.strokeStyle = INK;
  g.lineWidth = 10;
  g.lineJoin = "round";

  if (spec.headgear === "ikat") {
    // Traditional Sumbawa / Nusantara cloth headband (Sapuk / Destar)
    g.fillStyle = "#d94528";
    g.beginPath();
    g.roundRect(cx - 94, hy - 14, 188, 44, 18);
    g.fill();
    g.stroke();
    g.strokeStyle = "#ffd954";
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(cx - 82, hy + 8);
    g.lineTo(cx + 82, hy + 8);
    g.stroke();
  } else if (spec.headgear === "winter_cap") {
    // Chilly 1816 European woolen winter beanie + pom-pom!
    g.fillStyle = "#c94238";
    g.beginPath();
    g.arc(cx, hy + 20, 96, Math.PI, 0);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#f2eee6";
    g.beginPath();
    g.roundRect(cx - 102, hy + 4, 204, 32, 14);
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(cx, hy - 82, 22, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else if (spec.headgear === "tophat") {
    // 1817 Karl Drais gentleman Top Hat!
    g.fillStyle = "#222430";
    g.beginPath();
    g.ellipse(cx, hy + 18, 124, 22, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillRect(cx - 68, hy - 102, 136, 118);
    g.strokeRect(cx - 68, hy - 102, 136, 118);
    g.fillStyle = "#e8b942";
    g.fillRect(cx - 68, hy - 12, 136, 22);
    g.strokeRect(cx - 68, hy - 12, 136, 22);
  } else if (spec.headgear === "bonnet") {
    // 1816 Mary Shelley Regency curls & ribbon!
    g.fillStyle = "#6e4228";
    g.beginPath();
    g.arc(cx, hy + 24, 102, Math.PI * 0.92, Math.PI * 0.08);
    g.closePath();
    g.fill();
    g.stroke();
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(cx + s * 92, cy + 16, 26, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    g.fillStyle = "#e685a0";
    g.beginPath();
    g.roundRect(cx - 88, hy - 8, 176, 24, 10);
    g.fill();
    g.stroke();
  } else {
    // Classic Frankenstein flat black hair + metal neck bolts!
    g.fillStyle = "#1c1a24";
    g.fillRect(cx - 88, hy - 22, 176, 46);
    g.strokeRect(cx - 88, hy - 22, 176, 46);
    // Silver neck bolts
    g.fillStyle = "#b5c2d4";
    for (const s of [-1, 1]) {
      g.fillRect(cx + s * 86 - (s > 0 ? 0 : 28), cy + 72, 28, 18);
      g.strokeRect(cx + s * 86 - (s > 0 ? 0 : 28), cy + 72, 28, 18);
    }
  }
};

export const drawTamboraCharacter = (
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
  const shiverX = pose === "shiver" ? Math.sin(phase * Math.PI * 14) * 10 : 0;
  const bob = Math.sin(phase * Math.PI * 2) * (pose === "cheer" || pose === "ride" ? 14 : 6);

  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = INK;
  g.lineWidth = 11;

  const footY = H - 36;
  const hipY = H - 235 + bob;
  const px = cx + shiverX;

  // Legs / Skirt
  if (role === "shelley") {
    g.fillStyle = spec.bottom;
    g.beginPath();
    g.moveTo(px - 68, hipY - 10);
    g.lineTo(px + 68, hipY - 10);
    g.lineTo(px + 106, footY - 16);
    g.lineTo(px - 106, footY - 16);
    g.closePath();
    g.fill();
    g.stroke();
  } else {
    const stride = pose === "ride" ? Math.sin(phase * Math.PI * 6) * 28 : 0;
    for (const s of [-1, 1]) {
      const lx = px + s * 34;
      g.fillStyle = spec.bottom;
      g.beginPath();
      g.roundRect(lx - 22, hipY + s * stride * 0.35, 44, footY - hipY - 22, 16);
      g.fill();
      g.stroke();
      g.fillStyle = "#2b1d1c";
      g.beginPath();
      g.ellipse(lx + s * 6, footY - 12 + s * stride * 0.35, 32, 18, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }

  // Torso
  const torsoTop = hipY - 225;
  g.fillStyle = spec.top;
  g.beginPath();
  g.moveTo(px - 70, torsoTop + 12);
  g.quadraticCurveTo(px, torsoTop - 16, px + 70, torsoTop + 12);
  g.lineTo(px + 90, hipY + 32);
  g.quadraticCurveTo(px, hipY + 48, px - 90, hipY + 32);
  g.closePath();
  g.fill();
  g.stroke();

  // Scarf for chilly European or belt for others
  g.fillStyle = spec.accent;
  if (role === "european") {
    g.beginPath();
    g.roundRect(px - 74, torsoTop + 4, 148, 34, 14);
    g.fill();
    g.stroke();
  } else {
    g.fillRect(px - 78, hipY - 38, 156, 26);
    g.strokeRect(px - 78, hipY - 38, 156, 26);
  }

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

  if (pose === "cheer" || pose === "monster_wave") {
    const wave = Math.sin(phase * Math.PI * 4) * 24;
    drawArm(px - 70, shY, px - 152, shY - 115 + wave, px - 130, shY - 26);
    drawArm(px + 70, shY, px + 152, shY - 115 - wave, px + 130, shY - 26);
  } else if (pose === "shiver") {
    // Hugging self tightly in the July snow!
    drawArm(px - 70, shY, px + 44, shY + 62, px - 90, shY + 86);
    drawArm(px + 70, shY, px - 44, shY + 68, px + 90, shY + 86);
  } else if (pose === "ride") {
    // Reaching forward to steer wooden bicycle handlebars!
    drawArm(px - 70, shY, px + 56, shY + 46, px - 40, shY + 72);
    drawArm(px + 70, shY, px + 156, shY + 34, px + 125, shY + 56);
  } else if (pose === "write") {
    // Holding white feather quill pen writing Frankenstein!
    drawArm(px - 70, shY, px - 52, shY + 82, px - 112, shY + 72);
    const wr = Math.sin(phase * Math.PI * 8) * 14;
    drawArm(px + 70, shY, px + 108 + wr, shY + 56, px + 122, shY + 72);
    // Feather quill
    g.fillStyle = "#fff9eb";
    g.strokeStyle = INK;
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(px + 108 + wr, shY + 56);
    g.quadraticCurveTo(px + 178 + wr, shY - 45, px + 158 + wr, shY - 82);
    g.quadraticCurveTo(px + 118 + wr, shY - 32, px + 108 + wr, shY + 56);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (pose === "point") {
    drawArm(px - 70, shY, px - 108, shY + 108, px - 114, shY + 56);
    drawArm(px + 70, shY, px + 162, shY - 24, px + 126, shY + 14);
  } else {
    const sw = Math.sin(phase * Math.PI * 2) * 14;
    drawArm(px - 70, shY, px - 104, shY + 120 + sw, px - 114, shY + 60);
    drawArm(px + 70, shY, px + 104, shY + 120 - sw, px + 114, shY + 60);
  }

  // Head + Face + Headgear
  const headY = torsoTop - 94;
  drawBeanHead(g, px, headY, 94, 106, spec.skin, role === "frankenstein");
  drawFace(g, px, headY, mood, role, dir);
  drawHeadgear(g, px, headY, spec);
};

// --- Crisp 2D Butterfly-Effect Historical Cards (pure vector + bold Indonesian typography, ZERO emojis) ---

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

// Shot 1 Hook Banner: TAMBORA 1815 -> SEPEDA + FRANKENSTEIN
export const makeTamboraHookTex = () =>
  makeCardCanvas(980, 350, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "rgba(20, 22, 42, 0.94)";
    g.strokeStyle = "#ff9a3c";
    g.lineWidth = 12;
    g.beginPath();
    g.roundRect(18, 18, w - 36, h - 36, 40);
    g.fill();
    g.stroke();

    g.fillStyle = "#ffd954";
    g.font = "900 50px -apple-system, BlinkMacSystemFont, sans-serif";
    g.textAlign = "center";
    g.fillText("GUNUNG TAMBORA 1815", w / 2, 98);

    // 3 connected butterfly-effect pills
    const pills: [number, string, string, string][] = [
      [54, "LETUSAN", "SUMBAWA", "#c43824"],
      [358, "SEPEDA", "PERTAMA", "#286ea8"],
      [662, "NOVEL", "FRANKENSTEIN", "#6c3680"],
    ];
    for (const [px, t1, t2, col] of pills) {
      g.fillStyle = col;
      g.beginPath();
      g.roundRect(px, 136, 264, 152, 24);
      g.fill();
      g.fillStyle = "#ffffff";
      g.font = "900 36px -apple-system, BlinkMacSystemFont, sans-serif";
      g.fillText(t1, px + 132, 204);
      g.fillStyle = "#ffe270";
      g.font = "800 28px -apple-system, BlinkMacSystemFont, sans-serif";
      g.fillText(t2, px + 132, 252);
    }

    // Connecting arrows
    g.fillStyle = "#ffd954";
    g.font = "900 48px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("→", 338, 226);
    g.fillText("→", 642, 226);
  });

const makeBadge = (title: string, subtitle: string, bg: string, border: string, titleCol: string) =>
  makeCardCanvas(840, 220, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = bg;
    g.strokeStyle = border;
    g.lineWidth = 12;
    g.beginPath();
    g.roundRect(16, 16, w - 32, h - 32, 34);
    g.fill();
    g.stroke();

    g.fillStyle = titleCol;
    g.font = "900 54px -apple-system, BlinkMacSystemFont, sans-serif";
    g.textAlign = "center";
    g.fillText(title, w / 2, 102);

    g.fillStyle = "#f7efe0";
    g.font = "800 34px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText(subtitle, w / 2, 164);
  });

export const makeSumbawaDateTex = () =>
  makeBadge("10 APRIL 1815", "PULAU SUMBAWA, NTB — INDONESIA", "rgba(54, 22, 18, 0.93)", "#ff9a3c", "#ffdf5e");

export const makeKrakatauScaleTex = () =>
  makeBadge("4x KRAKATAU", "PUNCAK TERPANGKAS 1.400 METER", "rgba(88, 20, 18, 0.94)", "#ff6b3d", "#ffd954");

export const makeJulySnowTex = () =>
  makeBadge("JULI 1816", "TAHUN TANPA MUSIM PANAS DI EROPA", "rgba(22, 42, 76, 0.93)", "#9be0ff", "#a8e6ff");

export const makeBikeCardTex = () =>
  makeBadge("1817: DRAISINE", "SEPEDA PERTAMA DI DUNIA", "rgba(26, 48, 72, 0.93)", "#ffd954", "#ffdf5e");

export const makeFrankensteinCardTex = () =>
  makeBadge("FRANKENSTEIN", "DITULIS MARY SHELLEY — 1816", "rgba(42, 22, 58, 0.94)", "#a2f084", "#b4ff96");

export const makeFinaleCardTex = () =>
  makeBadge("EFEK KUPU-KUPU", "1 LETUSAN INDONESIA MENGUBAH DUNIA", "rgba(18, 26, 52, 0.94)", "#ffd954", "#ffdf5e");
