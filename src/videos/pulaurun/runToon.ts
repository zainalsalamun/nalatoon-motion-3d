import * as THREE from "three";

const INK = "#221626";

export type Mood = "proud" | "greedy" | "smile" | "bored" | "smug" | "shrug" | "panic" | "shock" | "scheme" | "calm";
export type Pose = "stand" | "hug_nutmeg" | "handshake_l" | "handshake_r" | "cheer" | "shrug" | "hold_map" | "hold_tiny_nutmeg" | "row" | "point";
export type Role = "dutch" | "british" | "sailor" | "smuggler";

type CharSpec = {
  skin: string;
  coat: string;
  trim: string;
  pants: string;
  hatColor: string;
  hatType: "wide" | "tricorne" | "cap" | "hood";
  mustache?: boolean;
  mustacheColor?: string;
};

const SPECS: Record<Role, CharSpec> = {
  dutch:    { skin: "#f4cca6", coat: "#d96b27", trim: "#f5d78c", pants: "#3d2d28", hatColor: "#2e242c", hatType: "wide", mustache: true, mustacheColor: "#9c5e28" },
  british:  { skin: "#f7d4b2", coat: "#c93232", trim: "#f2d679", pants: "#ede8dc", hatColor: "#1f2438", hatType: "tricorne", mustache: true, mustacheColor: "#5e4638" },
  sailor:   { skin: "#ecc098", coat: "#3b6aa8", trim: "#f4f2eb", pants: "#2b384e", hatColor: "#d99d4a", hatType: "cap" },
  smuggler: { skin: "#e0b38c", coat: "#2c344a", trim: "#5c6a82", pants: "#1c202e", hatColor: "#1d2336", hatType: "hood" },
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

const drawFace = (g: CanvasRenderingContext2D, cx: number, cy: number, mood: Mood, spec: CharSpec, dir: number) => {
  const ox = dir * 16;
  const ex = 40;
  const ey = cy + 6;
  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineCap = "round";
  g.lineJoin = "round";

  // Eyes
  if (mood === "greedy") {
    // Sparkling golden star/coin eyes!
    for (const s of [-1, 1]) {
      const px = cx + ox + s * ex;
      g.fillStyle = "#ffcf33";
      g.strokeStyle = INK;
      g.lineWidth = 6;
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4;
        const r = i % 2 === 0 ? 22 : 9;
        if (i === 0) g.moveTo(px + Math.cos(ang) * r, ey + Math.sin(ang) * r);
        else g.lineTo(px + Math.cos(ang) * r, ey + Math.sin(ang) * r);
      }
      g.closePath();
      g.fill();
      g.stroke();
    }
  } else if (mood === "shock" || mood === "panic") {
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(cx + ox + s * ex, ey, 17, 0, Math.PI * 2);
      g.fillStyle = "#ffffff";
      g.fill();
      g.lineWidth = 7;
      g.stroke();
      g.beginPath();
      g.arc(cx + ox + s * ex, ey, 5.5, 0, Math.PI * 2);
      g.fillStyle = INK;
      g.fill();
    }
  } else if (mood === "proud" || mood === "smug") {
    g.lineWidth = 8;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(cx + ox + s * ex, ey + 6, 15, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    }
  } else if (mood === "bored") {
    for (const s of [-1, 1]) {
      const px = cx + ox + s * ex;
      g.beginPath();
      g.ellipse(px, ey + 4, 10, 9, 0, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 8;
      g.beginPath();
      g.moveTo(px - 16, ey - 5);
      g.lineTo(px + 16, ey - 5);
      g.stroke();
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
    if (mood === "scheme") {
      g.moveTo(bx - s * 16, by - 4);
      g.lineTo(bx + s * 16, by + 10);
    } else if (mood === "panic" || mood === "shock") {
      g.moveTo(bx - s * 18, by + 8);
      g.lineTo(bx + s * 16, by - 12);
    } else if (mood === "shrug" || mood === "bored") {
      g.moveTo(bx - 15, by + 2);
      g.lineTo(bx + 15, by + 2);
    } else {
      g.moveTo(bx - 16, by);
      g.quadraticCurveTo(bx, by - 8, bx + 16, by);
    }
    g.stroke();
  }

  // Cheek blush on proud/smile/greedy
  if (mood === "proud" || mood === "greedy" || mood === "smile") {
    g.fillStyle = "rgba(235, 110, 90, 0.32)";
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(cx + ox + s * 56, ey + 26, 15, 9, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Mustache for 17th-century European officers
  const mx = cx + ox;
  const my = cy + 54;
  if (spec.mustache) {
    g.fillStyle = spec.mustacheColor ?? "#6b4226";
    g.strokeStyle = INK;
    g.lineWidth = 6;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(mx, my - 10);
      g.quadraticCurveTo(mx + s * 22, my - 22, mx + s * 46, my - 6);
      g.quadraticCurveTo(mx + s * 24, my + 6, mx, my - 2);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }

  // Mouth
  g.lineWidth = 8;
  g.strokeStyle = INK;
  g.beginPath();
  if (mood === "proud" || mood === "greedy" || mood === "smile") {
    g.arc(mx, my - 2, 24, 0.12 * Math.PI, 0.88 * Math.PI);
    g.stroke();
  } else if (mood === "smug" || mood === "scheme") {
    g.moveTo(mx - 18, my + 8);
    g.quadraticCurveTo(mx + 6, my + 16, mx + 24, my - 2);
    g.stroke();
  } else if (mood === "shock") {
    g.ellipse(mx, my + 14, 18, 26, 0, 0, Math.PI * 2);
    g.fillStyle = "#8c2432";
    g.fill();
    g.stroke();
  } else if (mood === "panic") {
    g.moveTo(mx - 24, my + 16);
    g.quadraticCurveTo(mx - 12, my + 2, mx, my + 16);
    g.quadraticCurveTo(mx + 12, my + 2, mx + 24, my + 16);
    g.stroke();
  } else if (mood === "bored" || mood === "shrug") {
    g.moveTo(mx - 16, my + 12);
    g.lineTo(mx + 16, my + 10);
    g.stroke();
  } else {
    g.moveTo(mx - 14, my + 8);
    g.quadraticCurveTo(mx, my + 16, mx + 14, my + 8);
    g.stroke();
  }

  // Sweat drops on panic / shock
  if (mood === "panic" || mood === "shock") {
    g.fillStyle = "#7dd8ff";
    g.strokeStyle = INK;
    g.lineWidth = 5;
    for (const [sx, sy] of [[cx + 96, cy - 35], [cx - 98, cy - 10]]) {
      g.beginPath();
      g.moveTo(sx, sy - 18);
      g.quadraticCurveTo(sx + 14, sy + 6, sx, sy + 14);
      g.quadraticCurveTo(sx - 14, sy + 6, sx, sy - 18);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }
};

const drawHat = (g: CanvasRenderingContext2D, cx: number, cy: number, spec: CharSpec, popOffsetY = 0) => {
  const hy = cy - 92 - popOffsetY;
  g.strokeStyle = INK;
  g.lineWidth = 10;
  g.lineJoin = "round";

  if (spec.hatType === "wide") {
    // 17th-century Dutch VOC wide-brim felt hat + orange/gold buckle & feather
    g.fillStyle = spec.hatColor;
    g.beginPath();
    g.ellipse(cx, hy + 18, 128, 28, -0.05, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // Crown
    g.beginPath();
    g.moveTo(cx - 68, hy + 12);
    g.lineTo(cx - 56, hy - 68);
    g.quadraticCurveTo(cx, hy - 84, cx + 56, hy - 68);
    g.lineTo(cx + 68, hy + 12);
    g.closePath();
    g.fill();
    g.stroke();
    // Orange sash & gold buckle
    g.fillStyle = "#e87828";
    g.fillRect(cx - 64, hy - 14, 128, 24);
    g.strokeRect(cx - 64, hy - 14, 128, 24);
    g.fillStyle = "#ffd64d";
    g.fillRect(cx - 18, hy - 18, 36, 32);
    g.strokeRect(cx - 18, hy - 18, 36, 32);
    // Plume feather
    g.fillStyle = "#fff5e0";
    g.beginPath();
    g.moveTo(cx + 52, hy - 10);
    g.quadraticCurveTo(cx + 115, hy - 78, cx + 82, hy - 115);
    g.quadraticCurveTo(cx + 42, hy - 80, cx + 44, hy - 10);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (spec.hatType === "tricorne") {
    // Classic British Royal officer tricorne hat with gold trim
    g.fillStyle = spec.hatColor;
    g.beginPath();
    g.moveTo(cx - 122, hy + 14);
    g.quadraticCurveTo(cx - 82, hy - 62, cx, hy - 78);
    g.quadraticCurveTo(cx + 82, hy - 62, cx + 122, hy + 14);
    g.quadraticCurveTo(cx, hy + 36, cx - 122, hy + 14);
    g.closePath();
    g.fill();
    g.stroke();
    // Gold trim along rim
    g.strokeStyle = "#f2d679";
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(cx - 104, hy + 8);
    g.quadraticCurveTo(cx, hy - 48, cx + 104, hy + 8);
    g.stroke();
    // Red/white cockade emblem
    g.fillStyle = "#e03b3b";
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(cx - 32, hy - 18, 16, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else if (spec.hatType === "cap") {
    // Sailor bandana / cap
    g.fillStyle = spec.hatColor;
    g.beginPath();
    g.arc(cx, hy + 18, 86, Math.PI, 0);
    g.closePath();
    g.fill();
    g.stroke();
  } else {
    // Dark smuggler hood
    g.fillStyle = spec.hatColor;
    g.beginPath();
    g.arc(cx, hy + 28, 102, Math.PI * 0.92, Math.PI * 0.08);
    g.lineTo(cx + 96, hy + 68);
    g.quadraticCurveTo(cx, hy + 26, cx - 96, hy + 68);
    g.closePath();
    g.fill();
    g.stroke();
  }
};

export const drawRunCharacter = (
  g: CanvasRenderingContext2D,
  role: Role,
  mood: Mood,
  pose: Pose,
  phase: number,
  dir: number, // -1 left, 0 front, 1 right
  hatPop = 0,
) => {
  const W = g.canvas.width;
  const H = g.canvas.height;
  g.clearRect(0, 0, W, H);
  const spec = SPECS[role];
  const cx = W * 0.5;
  const bob = Math.sin(phase * Math.PI * 2) * (pose === "cheer" ? 18 : 7);

  g.lineCap = "round";
  g.lineJoin = "round";

  // Legs
  const footY = H - 36;
  const hipY = H - 235 + bob;
  const legSpread = pose === "cheer" ? 44 : 34;
  g.strokeStyle = INK;
  g.lineWidth = 11;
  for (const s of [-1, 1]) {
    const lx = cx + s * legSpread;
    g.fillStyle = spec.pants;
    g.beginPath();
    g.roundRect(lx - 22, hipY, 44, footY - hipY - 22, 16);
    g.fill();
    g.stroke();
    // Colonial buckled boot
    g.fillStyle = "#2b1d1c";
    g.beginPath();
    g.ellipse(lx + s * 8, footY - 12, 34, 19, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  // Torso / 17th-century flared colonial coat
  const torsoTop = hipY - 225;
  g.fillStyle = spec.coat;
  g.beginPath();
  g.moveTo(cx - 72, torsoTop + 12);
  g.quadraticCurveTo(cx, torsoTop - 16, cx + 72, torsoTop + 12);
  g.lineTo(cx + 96, hipY + 36);
  g.quadraticCurveTo(cx, hipY + 54, cx - 96, hipY + 36);
  g.closePath();
  g.fill();
  g.stroke();

  // White cravat / lace jabot collar + gold trim buttons
  g.fillStyle = "#faf6ec";
  g.beginPath();
  g.moveTo(cx - 24, torsoTop + 8);
  g.lineTo(cx + 24, torsoTop + 8);
  g.lineTo(cx + 14, torsoTop + 72);
  g.lineTo(cx, torsoTop + 86);
  g.lineTo(cx - 14, torsoTop + 72);
  g.closePath();
  g.fill();
  g.stroke();

  // Belt & gold sash
  g.fillStyle = "#2b1d1e";
  g.fillRect(cx - 84, hipY - 40, 168, 28);
  g.strokeRect(cx - 84, hipY - 40, 168, 28);
  g.fillStyle = spec.trim;
  g.fillRect(cx - 22, hipY - 44, 44, 36);
  g.strokeRect(cx - 22, hipY - 44, 44, 36);

  // Arms based on pose
  const shY = torsoTop + 44;
  const drawArm = (sx: number, sy: number, ex: number, ey: number, mx: number, my: number) => {
    g.strokeStyle = INK;
    g.lineWidth = 44;
    g.beginPath();
    g.moveTo(sx, sy);
    g.quadraticCurveTo(mx, my, ex, ey);
    g.stroke();
    g.strokeStyle = spec.coat;
    g.lineWidth = 24;
    g.beginPath();
    g.moveTo(sx, sy);
    g.quadraticCurveTo(mx, my, ex, ey);
    g.stroke();
    // Hand
    g.fillStyle = spec.skin;
    g.strokeStyle = INK;
    g.lineWidth = 9;
    g.beginPath();
    g.arc(ex, ey, 22, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  };

  if (pose === "cheer") {
    const wave = Math.sin(phase * Math.PI * 4) * 24;
    drawArm(cx - 72, shY, cx - 155, shY - 125 + wave, cx - 135, shY - 35);
    drawArm(cx + 72, shY, cx + 155, shY - 125 - wave, cx + 135, shY - 35);
  } else if (pose === "shrug") {
    drawArm(cx - 72, shY, cx - 148, shY + 25, cx - 130, shY + 85);
    drawArm(cx + 72, shY, cx + 148, shY + 25, cx + 130, shY + 85);
  } else if (pose === "handshake_l") {
    drawArm(cx - 72, shY, cx - 108, shY + 115, cx - 115, shY + 60);
    drawArm(cx + 72, shY, cx + 178, shY + 62, cx + 130, shY + 85);
  } else if (pose === "handshake_r") {
    drawArm(cx - 72, shY, cx - 178, shY + 62, cx - 130, shY + 85);
    drawArm(cx + 72, shY, cx + 108, shY + 115, cx + 115, shY + 60);
  } else if (pose === "hug_nutmeg") {
    // Hugging a giant gleaming golden nutmeg!
    g.fillStyle = "#b86b2b";
    g.strokeStyle = INK;
    g.lineWidth = 10;
    g.beginPath();
    g.ellipse(cx, shY + 84, 58, 44, -0.15, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // Red mace lace ribbons around nutmeg
    g.strokeStyle = "#d9342c";
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(cx - 38, shY + 62);
    g.quadraticCurveTo(cx, shY + 104, cx + 38, shY + 68);
    g.moveTo(cx - 28, shY + 106);
    g.quadraticCurveTo(cx + 4, shY + 68, cx + 32, shY + 104);
    g.stroke();
    drawArm(cx - 72, shY, cx - 32, shY + 86, cx - 115, shY + 75);
    drawArm(cx + 72, shY, cx + 32, shY + 86, cx + 115, shY + 75);
  } else if (pose === "hold_tiny_nutmeg") {
    // Holding ONE tiny nutmeg in disbelief while other arm drops in shock!
    drawArm(cx - 72, shY, cx - 132, shY + 95, cx - 122, shY + 40);
    drawArm(cx + 72, shY, cx + 134, shY + 24, cx + 124, shY + 68);
    // Tiny nutmeg perched on palm
    g.fillStyle = "#b86b2b";
    g.strokeStyle = INK;
    g.lineWidth = 7;
    g.beginPath();
    g.ellipse(cx + 138, shY - 2, 22, 16, -0.2, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else if (pose === "hold_map") {
    // Holding rolled parchment map of New Amsterdam
    drawArm(cx - 72, shY, cx - 104, shY + 96, cx - 110, shY + 46);
    drawArm(cx + 72, shY, cx + 110, shY + 52, cx + 120, shY + 80);
    g.fillStyle = "#f5e6bf";
    g.strokeStyle = INK;
    g.lineWidth = 8;
    g.save();
    g.translate(cx + 114, shY + 22);
    g.rotate(0.25);
    g.fillRect(-18, -56, 36, 112);
    g.strokeRect(-18, -56, 36, 112);
    g.restore();
  } else if (pose === "point") {
    drawArm(cx - 72, shY, cx - 108, shY + 110, cx - 112, shY + 58);
    drawArm(cx + 72, shY, cx + 168, shY - 20, cx + 128, shY + 16);
  } else {
    const sw = Math.sin(phase * Math.PI * 2) * 14;
    drawArm(cx - 72, shY, cx - 104, shY + 122 + sw, cx - 116, shY + 62);
    drawArm(cx + 72, shY, cx + 104, shY + 122 - sw, cx + 116, shY + 62);
  }

  // Bean Head
  const headY = torsoTop - 94;
  drawBeanHead(g, cx, headY, 96, 108, spec.skin);
  drawFace(g, cx, headY, mood, spec, dir);
  drawHat(g, cx, headY, spec, hatPop * 95);
};

// --- Crisp 2D Historical Prop & Info Cards (all pure vector + bold Indonesian labels, ZERO emojis) ---

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

// Shot 1 Hook floating visual comparison banner: PULAU RUN <-> NEW YORK
export const makeHookSwapCardTex = () =>
  makeCardCanvas(1024, 380, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    // Warm cream parchment pill card with thick ink outline
    g.fillStyle = "rgba(18, 28, 48, 0.92)";
    g.strokeStyle = "#ffd954";
    g.lineWidth = 12;
    g.beginPath();
    g.roundRect(18, 20, w - 36, h - 40, 44);
    g.fill();
    g.stroke();

    // Left panel: tiny green tropical island icon
    g.fillStyle = "#2b7ec9";
    g.beginPath();
    g.roundRect(54, 58, 340, 264, 28);
    g.fill();
    // Little island dome + palm tree
    g.fillStyle = "#f2d28b";
    g.beginPath();
    g.ellipse(224, 212, 118, 32, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#52b346";
    g.beginPath();
    g.arc(224, 206, 86, Math.PI, 0);
    g.closePath();
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.stroke();
    // Label
    g.fillStyle = "#ffffff";
    g.font = "900 42px -apple-system, BlinkMacSystemFont, sans-serif";
    g.textAlign = "center";
    g.fillText("PULAU RUN", 224, 268);
    g.fillStyle = "#ffe066";
    g.font = "800 28px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("MALUKU (3 KM)", 224, 304);

    // Center bold double swap arrows
    g.fillStyle = "#ffd954";
    g.font = "900 84px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("⇄", w * 0.5, 198);
    g.fillStyle = "#9ad8ff";
    g.font = "900 30px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("1667", w * 0.5, 250);

    // Right panel: Manhattan skyline silhouette icon
    g.fillStyle = "#162447";
    g.beginPath();
    g.roundRect(w - 394, 58, 340, 264, 28);
    g.fill();
    const bx = w - 358;
    const bars: [number, number, number, string][] = [
      [18, 95, 36, "#4668a8"], [62, 130, 40, "#547cc2"], [110, 168, 44, "#6795de"],
      [162, 120, 38, "#4c72b8"], [208, 145, 42, "#5b85cc"],
    ];
    for (const [ox, bh, bw, col] of bars) {
      g.fillStyle = col;
      g.fillRect(bx + ox, 224 - bh, bw, bh);
      // Tiny glowing yellow windows
      g.fillStyle = "#ffdf6b";
      for (let wy = 224 - bh + 12; wy < 216; wy += 18) {
        g.fillRect(bx + ox + 8, wy, bw - 16, 7);
      }
    }
    // Empire State spire
    g.fillStyle = "#9ad8ff";
    g.fillRect(bx + 129, 224 - 196, 6, 30);
    // Label
    g.fillStyle = "#ffffff";
    g.font = "900 42px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("NEW YORK", w - 224, 268);
    g.fillStyle = "#7ce2ff";
    g.font = "800 28px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("MANHATTAN", w - 224, 304);
  });

// Shot 3 Scale badge: 3 KM x 1 KM
export const makeScaleBadgeTex = () =>
  makeCardCanvas(720, 220, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#fff8e6";
    g.strokeStyle = INK;
    g.lineWidth = 12;
    g.beginPath();
    g.roundRect(16, 16, w - 32, h - 32, 34);
    g.fill();
    g.stroke();
    g.fillStyle = "#c93828";
    g.font = "900 72px -apple-system, BlinkMacSystemFont, sans-serif";
    g.textAlign = "center";
    g.fillText("3 KM × 1 KM", w / 2, 108);
    g.fillStyle = "#2b2130";
    g.font = "800 36px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("PULAU RUN — KEP. BANDA", w / 2, 168);
  });

// Shot 5 Balance comparison sign: PALA > EMAS
export const makeGoldCompareTex = () =>
  makeCardCanvas(760, 210, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "rgba(38, 22, 16, 0.92)";
    g.strokeStyle = "#ffd64a";
    g.lineWidth = 11;
    g.beginPath();
    g.roundRect(14, 14, w - 28, h - 28, 32);
    g.fill();
    g.stroke();
    g.fillStyle = "#ffdf5e";
    g.font = "900 66px -apple-system, BlinkMacSystemFont, sans-serif";
    g.textAlign = "center";
    g.fillText("1 PALA  >  EMAS", w / 2, 104);
    g.fillStyle = "#f7ead0";
    g.font = "800 34px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("HARTA PALING DIBURU ABAD KE-17", w / 2, 162);
  });

// Shot 6 New Amsterdam wooden fort sign
export const makeNewAmsterdamSignTex = () =>
  makeCardCanvas(680, 210, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#8a562e";
    g.strokeStyle = INK;
    g.lineWidth = 12;
    g.beginPath();
    g.roundRect(14, 14, w - 28, h - 28, 22);
    g.fill();
    g.stroke();
    g.fillStyle = "#faf0d4";
    g.font = "900 54px -apple-system, BlinkMacSystemFont, sans-serif";
    g.textAlign = "center";
    g.fillText("NEW AMSTERDAM", w / 2, 98);
    g.fillStyle = "#f2ca6b";
    g.font = "800 36px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("KOLONI BELANDA — 1667", w / 2, 158);
  });

// Shot 7 Perjanjian Breda 1667 parchment scroll with red wax seal
export const makeTreatyCardTex = () =>
  makeCardCanvas(920, 440, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    // Parchment scroll
    g.fillStyle = "#f7e8c4";
    g.strokeStyle = INK;
    g.lineWidth = 14;
    g.beginPath();
    g.roundRect(24, 24, w - 48, h - 48, 36);
    g.fill();
    g.stroke();

    // Inner ornamental border
    g.strokeStyle = "#b37c3b";
    g.lineWidth = 5;
    g.beginPath();
    g.roundRect(48, 48, w - 96, h - 96, 22);
    g.stroke();

    g.fillStyle = "#2b1b24";
    g.font = "900 56px -apple-system, BlinkMacSystemFont, sans-serif";
    g.textAlign = "center";
    g.fillText("PERJANJIAN BREDA", w / 2, 126);

    g.fillStyle = "#b53324";
    g.font = "900 42px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("31 JULI 1667", w / 2, 182);

    // Swap clauses
    g.fillStyle = "#2b1b24";
    g.font = "800 38px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("BELANDA  →  PULAU RUN (MALUKU)", w / 2, 260);
    g.fillText("INGGRIS  →  NEW AMSTERDAM", w / 2, 322);

    // Red wax seal bottom right
    g.fillStyle = "#c92a2a";
    g.strokeStyle = INK;
    g.lineWidth = 8;
    g.beginPath();
    g.arc(w - 115, h - 105, 52, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = "#ffd966";
    g.font = "900 32px -apple-system, BlinkMacSystemFont, sans-serif";
    g.fillText("SAH", w - 115, h - 94);
  });

// Shot 9 Crashing nutmeg price chart card
export const makePriceCrashCardTex = () =>
  makeCardCanvas(760, 420, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "rgba(24, 18, 36, 0.93)";
    g.strokeStyle = "#ff5252";
    g.lineWidth = 12;
    g.beginPath();
    g.roundRect(18, 18, w - 36, h - 36, 34);
    g.fill();
    g.stroke();

    g.fillStyle = "#ff6b6b";
    g.font = "900 48px -apple-system, BlinkMacSystemFont, sans-serif";
    g.textAlign = "center";
    g.fillText("HARGA PALA ANJLOK!", w / 2, 88);

    // Grid lines
    g.strokeStyle = "rgba(255,255,255,0.16)";
    g.lineWidth = 3;
    for (let y = 130; y <= 330; y += 50) {
      g.beginPath();
      g.moveTo(74, y);
      g.lineTo(w - 74, y);
      g.stroke();
    }

    // Crashing red zig-zag line + arrowhead
    g.strokeStyle = "#ff3b3b";
    g.lineWidth = 16;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(95, 145);
    g.lineTo(260, 160);
    g.lineTo(360, 210);
    g.lineTo(490, 285);
    g.lineTo(635, 342);
    g.stroke();

    // Arrow head
    g.fillStyle = "#ff3b3b";
    g.beginPath();
    g.moveTo(665, 355);
    g.lineTo(605, 358);
    g.lineTo(634, 305);
    g.closePath();
    g.fill();
  });
