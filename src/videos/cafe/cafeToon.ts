import * as THREE from "three";

const INK = "#241726";

export type Mood = "calm" | "smile" | "warm" | "frown" | "angry" | "surprised" | "shock" | "sad" | "whisper" | "blink";
export type Pose = "sit" | "stand" | "walk" | "point" | "hold_letter" | "hold_coffee" | "run_coffee" | "leave";
export type Role = "darmo" | "raka" | "ibu" | "custA" | "custB" | "custC";

type CharSpec = {
  skin: string;
  shirt: string;
  shirt2?: string;
  apron?: string;
  hair: string;
  glasses?: boolean;
  peci?: boolean;
  hijab?: string;
  scale?: number;
};

const SPECS: Record<Role, CharSpec> = {
  darmo: { skin: "#f0c8a0", shirt: "#dfd2b4", shirt2: "#9e7b56", hair: "#e8e8ec", glasses: true, peci: true },
  raka:  { skin: "#f5d3b3", shirt: "#f7f4ee", apron: "#6e442c", hair: "#2b2129" },
  ibu:   { skin: "#f2cba5", shirt: "#d97a6c", hair: "#4a3836", hijab: "#e8c4a2" },
  custA: { skin: "#f4d0ae", shirt: "#4c79b8", hair: "#2d222a" },
  custB: { skin: "#e5ba92", shirt: "#529972", hair: "#2a2028", hijab: "#c96f7b" },
  custC: { skin: "#f7d9bc", shirt: "#c98a3e", hair: "#3d2b24", glasses: true },
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

const drawFace = (g: CanvasRenderingContext2D, cx: number, cy: number, mood: Mood, glasses: boolean, dir: number) => {
  const ox = dir * 16;
  const ex = 42;
  const ey = cy + 6;
  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineCap = "round";
  g.lineJoin = "round";

  // Eyes
  if (mood === "blink" || mood === "warm") {
    g.lineWidth = 8;
    for (const s of [-1, 1]) {
      g.beginPath();
      if (mood === "warm") {
        g.arc(cx + ox + s * ex, ey + 6, 15, Math.PI * 1.15, Math.PI * 1.85);
      } else {
        g.moveTo(cx + ox + s * ex - 13, ey);
        g.lineTo(cx + ox + s * ex + 13, ey);
      }
      g.stroke();
    }
  } else if (mood === "shock" || mood === "surprised") {
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
  for (const s of [-1, 1]) {
    const bx = cx + ox + s * ex;
    const by = ey - 32;
    g.beginPath();
    if (mood === "angry" || mood === "frown") {
      g.moveTo(bx - s * 18, by - 4);
      g.lineTo(bx + s * 16, by + (mood === "angry" ? 12 : 7));
    } else if (mood === "sad" || mood === "surprised" || mood === "shock") {
      g.moveTo(bx - s * 18, by + 6);
      g.lineTo(bx + s * 16, by - 8);
    } else {
      g.moveTo(bx - 16, by);
      g.quadraticCurveTo(bx, by - 7, bx + 16, by);
    }
    g.stroke();
  }

  // Glasses (for Pak Darmo & custC)
  if (glasses) {
    g.lineWidth = 6;
    g.strokeStyle = "#4d3830";
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(cx + ox + s * ex, ey + 2, 26, 0, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(cx + ox - ex + 26, ey + 2);
    g.lineTo(cx + ox + ex - 26, ey + 2);
    g.stroke();
    g.strokeStyle = INK;
  }

  // Mouth
  const mx = cx + ox;
  const my = cy + 56;
  g.lineWidth = 8;
  g.beginPath();
  if (mood === "smile" || mood === "warm") {
    g.arc(mx, my - 8, 24, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
  } else if (mood === "angry" || mood === "frown") {
    g.arc(mx, my + 18, 22, 1.18 * Math.PI, 1.82 * Math.PI);
    g.stroke();
  } else if (mood === "shock") {
    g.ellipse(mx, my + 4, 15, 22, 0, 0, Math.PI * 2);
    g.fillStyle = "#8a2832";
    g.fill();
    g.stroke();
  } else if (mood === "surprised" || mood === "whisper") {
    g.ellipse(mx, my + 4, 11, 12, 0, 0, Math.PI * 2);
    g.fillStyle = "#5c2530";
    g.fill();
    g.stroke();
  } else if (mood === "sad") {
    g.moveTo(mx - 18, my + 8);
    g.quadraticCurveTo(mx, my - 4, mx + 18, my + 8);
    g.stroke();
  } else {
    // calm gentle smile
    g.moveTo(mx - 16, my);
    g.quadraticCurveTo(mx, my + 10, mx + 16, my);
    g.stroke();
  }
};

export const drawCharacter = (
  g: CanvasRenderingContext2D,
  role: Role,
  mood: Mood,
  pose: Pose,
  phase: number,
  dir = 1
) => {
  g.clearRect(0, 0, 600, 1000);
  const sp = SPECS[role];
  const cx = 300;
  const bob = pose === "walk" || pose === "run_coffee" ? Math.abs(Math.sin(phase * Math.PI * 2)) * 18 : Math.sin(phase * 2) * 3;
  const headY = (pose === "sit" ? 310 : 245) - bob;
  const bodyTop = headY + 128;
  const bodyBot = bodyTop + 265;

  g.lineCap = "round";
  g.lineJoin = "round";

  // Legs
  g.strokeStyle = INK;
  g.lineWidth = 18;
  if (pose === "sit") {
    // Seated thighs forward + shins down
    for (const s of [-1, 1]) {
      const lx = cx + s * 36;
      g.beginPath();
      g.moveTo(lx, bodyBot - 15);
      g.lineTo(lx + dir * 65, bodyBot + 45);
      g.lineTo(lx + dir * 72, 955);
      g.stroke();
      // Shoe
      g.beginPath();
      g.moveTo(lx + dir * 64, 958);
      g.lineTo(lx + dir * 104, 958);
      g.lineWidth = 20;
      g.stroke();
      g.lineWidth = 18;
    }
  } else {
    const sw = pose === "walk" || pose === "run_coffee" ? Math.sin(phase * Math.PI * 2) * (pose === "run_coffee" ? 85 : 58) : 0;
    for (const [idx, s] of [[-1, -1], [1, 1]] as const) {
      const lx = cx + s * 34;
      const fx = lx + idx * sw;
      const lift = pose === "walk" || pose === "run_coffee" ? Math.max(0, -idx * Math.cos(phase * Math.PI * 2)) * 34 : 0;
      g.beginPath();
      g.moveTo(lx, bodyBot - 10);
      g.lineTo(fx, 965 - lift);
      g.stroke();
      // Shoe
      g.beginPath();
      g.moveTo(fx - 8, 968 - lift);
      g.lineTo(fx + dir * 32, 968 - lift);
      g.lineWidth = 20;
      g.stroke();
      g.lineWidth = 18;
    }
  }

  // Torso (rounded pill body)
  g.beginPath();
  g.roundRect(cx - 88, bodyTop, 176, 275, 84);
  g.fillStyle = sp.shirt;
  g.fill();

  // Subtle batik pattern stripe for Pak Darmo
  if (sp.shirt2) {
    g.save();
    g.clip();
    g.fillStyle = sp.shirt2;
    g.globalAlpha = 0.28;
    for (let y = bodyTop + 20; y < bodyBot; y += 38) {
      for (let x = cx - 90; x < cx + 90; x += 38) {
        g.beginPath();
        g.moveTo(x + 19, y);
        g.lineTo(x + 32, y + 14);
        g.lineTo(x + 19, y + 28);
        g.lineTo(x + 6, y + 14);
        g.closePath();
        g.fill();
      }
    }
    g.restore();
  }

  // Barista apron for Raka
  if (sp.apron) {
    g.save();
    g.beginPath();
    g.roundRect(cx - 88, bodyTop, 176, 275, 84);
    g.clip();
    g.fillStyle = sp.apron;
    g.fillRect(cx - 64, bodyTop + 44, 128, 240);
    g.strokeStyle = INK;
    g.lineWidth = 8;
    g.strokeRect(cx - 64, bodyTop + 44, 128, 240);
    // Apron pocket
    g.fillStyle = "#52321e";
    g.fillRect(cx - 38, bodyTop + 150, 76, 52);
    g.strokeRect(cx - 38, bodyTop + 150, 76, 52);
    // Straps
    g.lineWidth = 10;
    g.strokeStyle = sp.apron;
    g.beginPath();
    g.moveTo(cx - 46, bodyTop + 44); g.lineTo(cx - 36, bodyTop - 6);
    g.moveTo(cx + 46, bodyTop + 44); g.lineTo(cx + 36, bodyTop - 6);
    g.stroke();
    g.restore();
  }

  // Torso outline
  g.beginPath();
  g.roundRect(cx - 88, bodyTop, 176, 275, 84);
  g.lineWidth = 11;
  g.strokeStyle = INK;
  g.stroke();

  // Arms + held props
  g.strokeStyle = INK;
  g.lineWidth = 16;
  const armY = bodyTop + 62;
  if (pose === "point") {
    // Left arm down, right arm pointing toward table
    g.beginPath(); g.moveTo(cx - 84, armY); g.lineTo(cx - 125, armY + 130); g.stroke();
    g.beginPath(); g.moveTo(cx + 84, armY); g.lineTo(cx + dir * 185, armY + 28); g.stroke();
    g.beginPath(); g.arc(cx + dir * 188, armY + 28, 13, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
  } else if (pose === "hold_letter") {
    // Both arms holding an open white letter in front of chest (trembling slightly!)
    const tremble = Math.sin(phase * 28) * 5;
    g.beginPath(); g.moveTo(cx - 82, armY); g.lineTo(cx - 64 + tremble, armY + 75); g.stroke();
    g.beginPath(); g.moveTo(cx + 82, armY); g.lineTo(cx + 64 + tremble, armY + 75); g.stroke();
    // Letter sheet
    g.save();
    g.translate(cx + tremble, armY + 62);
    g.fillStyle = "#fff9ec";
    g.strokeStyle = INK;
    g.lineWidth = 8;
    g.beginPath();
    g.roundRect(-78, -56, 156, 118, 8);
    g.fill(); g.stroke();
    g.strokeStyle = "#8a7865";
    g.lineWidth = 5;
    for (const ly of [-28, -8, 12, 32]) {
      g.beginPath(); g.moveTo(-54, ly); g.lineTo(54, ly); g.stroke();
    }
    g.restore();
  } else if (pose === "hold_coffee" || pose === "run_coffee") {
    const sw = pose === "run_coffee" ? Math.sin(phase * Math.PI * 2) * 35 : 0;
    g.beginPath(); g.moveTo(cx - 84, armY); g.lineTo(cx - 110 - sw, armY + 115); g.stroke();
    const hx = cx + dir * 145;
    const hy = armY + 38;
    g.beginPath(); g.moveTo(cx + 84, armY); g.lineTo(hx, hy); g.stroke();
    // Steaming coffee cup in hand
    g.fillStyle = "#fff8ee";
    g.strokeStyle = INK;
    g.lineWidth = 8;
    g.beginPath(); g.roundRect(hx - 24, hy - 36, 48, 52, 8); g.fill(); g.stroke();
    g.fillStyle = "#6e4226";
    g.fillRect(hx - 20, hy - 14, 40, 18);
    // Steam wisps
    g.strokeStyle = "rgba(255,255,255,0.85)";
    g.lineWidth = 6;
    for (const sx of [-10, 10]) {
      const wave = Math.sin(phase * 8 + sx) * 7;
      g.beginPath();
      g.moveTo(hx + sx, hy - 46);
      g.quadraticCurveTo(hx + sx + wave, hy - 68, hx + sx - wave * 0.5, hy - 90);
      g.stroke();
    }
  } else if (pose === "sit") {
    g.beginPath(); g.moveTo(cx - 82, armY); g.lineTo(cx - 56, armY + 115); g.lineTo(cx + dir * 45, armY + 120); g.stroke();
    g.beginPath(); g.moveTo(cx + 82, armY); g.lineTo(cx + 104, armY + 115); g.stroke();
  } else {
    const sw = pose === "walk" ? Math.sin(phase * Math.PI * 2) * 55 : 0;
    g.beginPath(); g.moveTo(cx - 84, armY); g.lineTo(cx - 108 + sw, armY + 135); g.stroke();
    g.beginPath(); g.moveTo(cx + 84, armY); g.lineTo(cx + 108 - sw, armY + 135); g.stroke();
  }

  // Hijab wrap behind head if applicable
  if (sp.hijab) {
    g.beginPath();
    g.ellipse(cx, headY + 18, 134, 146, 0, 0, Math.PI * 2);
    g.fillStyle = sp.hijab;
    g.fill();
    g.lineWidth = 11;
    g.strokeStyle = INK;
    g.stroke();
  }

  // Bean head
  drawBeanHead(g, cx, headY, 118, 126, sp.skin);

  // Hair or Peci
  if (sp.peci) {
    // Neat white hair tufts tucked cleanly under black velvet peci (with crisp ink stroke!)
    g.fillStyle = sp.hair;
    g.strokeStyle = INK;
    g.lineWidth = 9;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(cx + s * 98, headY - 38, 22, 34, s * 0.25, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    g.beginPath();
    g.roundRect(cx - 108, headY - 154, 216, 88, [34, 34, 12, 12]);
    g.fillStyle = "#22202a";
    g.fill();
    g.lineWidth = 11;
    g.strokeStyle = INK;
    g.stroke();
  } else if (!sp.hijab) {
    g.beginPath();
    g.moveTo(cx - 118, headY - 26);
    g.bezierCurveTo(cx - 120, headY - 150, cx + 120, headY - 150, cx + 118, headY - 26);
    g.quadraticCurveTo(cx + 35, headY - 72, cx - 18, headY - 46);
    g.quadraticCurveTo(cx - 72, headY - 70, cx - 118, headY - 26);
    g.closePath();
    g.fillStyle = sp.hair;
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = INK;
    g.stroke();
  }

  // Face
  drawFace(g, cx, headY, mood, !!sp.glasses, dir);
};

// ---------------- 2D Prop / Effect Card Textures ----------------
export const makePropTexture = (key: string, draw: (g: CanvasRenderingContext2D) => void, w = 512, h = 512) => {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
};

export const makeDeedPhotoCard = () => makePropTexture("deedCard", (g) => {
  g.clearRect(0, 0, 640, 640);
  // Warm cream deed paper tilted slightly left
  g.save();
  g.translate(290, 310);
  g.rotate(-0.07);
  g.fillStyle = "#faf1dc";
  g.strokeStyle = INK;
  g.lineWidth = 10;
  g.beginPath(); g.roundRect(-210, -240, 420, 480, 16); g.fill(); g.stroke();
  // Header banner
  g.fillStyle = "#c4533b";
  g.fillRect(-175, -205, 350, 56);
  g.fillStyle = "#ffffff";
  g.font = "900 30px sans-serif";
  g.textAlign = "center";
  g.fillText("SERTIFIKAT RUKO", 0, -166);
  // Document lines
  g.fillStyle = "#2b2430";
  g.font = "700 26px sans-serif";
  g.fillText("Pemilik: Bpk. Darmo", 0, -96);
  g.strokeStyle = "#9e8f7b";
  g.lineWidth = 6;
  for (const y of [-50, -16, 18, 52]) {
    g.beginPath(); g.moveTo(-155, y); g.lineTo(155, y); g.stroke();
  }
  // Red official stamp
  g.beginPath(); g.arc(105, 145, 52, 0, Math.PI * 2);
  g.strokeStyle = "#c73434"; g.lineWidth = 8; g.stroke();
  g.fillStyle = "#c73434"; g.font = "900 22px sans-serif";
  g.fillText("LUNAS", 105, 152);
  g.restore();

  // Polaroid photo tucked at bottom-right showing Pak Darmo + Ibu Darmo smiling with coffee
  g.save();
  g.translate(455, 425);
  g.rotate(0.11);
  g.fillStyle = "#ffffff";
  g.strokeStyle = INK;
  g.lineWidth = 9;
  g.beginPath(); g.roundRect(-130, -150, 260, 300, 10); g.fill(); g.stroke();
  // Warm golden photo interior
  const gr = g.createLinearGradient(0, -130, 0, 80);
  gr.addColorStop(0, "#ffd494"); gr.addColorStop(1, "#e89268");
  g.fillStyle = gr;
  g.fillRect(-110, -130, 220, 200);
  g.strokeRect(-110, -130, 220, 200);
  // Mini couple bean heads inside photo
  drawBeanHead(g, -42, -32, 34, 36, "#f0c8a0");
  drawBeanHead(g, 42, -26, 34, 36, "#f2cba5");
  g.strokeStyle = INK; g.lineWidth = 5;
  for (const cx of [-42, 42]) {
    g.beginPath(); g.arc(cx, -18, 12, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  }
  g.fillStyle = "#4a3830";
  g.font = "italic 700 24px sans-serif";
  g.textAlign = "center";
  g.fillText("Meja Pojok, 1996", 0, 118);
  g.restore();
}, 640, 640);

export const makeReservedSignTex = () => makePropTexture("reservedSign", (g) => {
  g.fillStyle = "#3a2518";
  g.fillRect(0, 0, 512, 320);
  g.strokeStyle = "#d9a959";
  g.lineWidth = 14;
  g.strokeRect(18, 18, 476, 284);
  g.fillStyle = "#ffd97d";
  g.font = "900 44px sans-serif";
  g.textAlign = "center";
  g.fillText("KHUSUS UNTUK", 256, 125);
  g.fillStyle = "#ffffff";
  g.font = "900 66px sans-serif";
  g.fillText("PAK DARMO", 256, 215);
}, 512, 320);

export const makeCafeBannerTex = () => makePropTexture("cafeBanner", (g) => {
  g.fillStyle = "#2b1d17";
  g.fillRect(0, 0, 768, 220);
  g.strokeStyle = "#f2c166";
  g.lineWidth = 12;
  g.strokeRect(14, 14, 740, 192);
  g.fillStyle = "#ffd97d";
  g.font = "900 84px sans-serif";
  g.textAlign = "center";
  g.fillText("KOPI SUDUT", 384, 134);
  g.fillStyle = "#f4e8d2";
  g.font = "700 28px sans-serif";
  g.fillText("SEJAK 1996", 384, 180);
}, 768, 220);

export const makeWhisperTex = () => makePropTexture("whisperFx", (g) => {
  g.clearRect(0, 0, 320, 200);
  g.fillStyle = "#ffffff";
  g.strokeStyle = INK;
  g.lineWidth = 10;
  g.beginPath();
  g.roundRect(24, 24, 272, 126, 48);
  g.fill(); g.stroke();
  g.fillStyle = INK;
  for (const x of [105, 160, 215]) {
    g.beginPath(); g.arc(x, 87, 14, 0, Math.PI * 2); g.fill();
  }
}, 320, 200);

export const makeShockTex = () => makePropTexture("shockFx", (g) => {
  g.clearRect(0, 0, 400, 400);
  g.strokeStyle = "#ffd94a";
  g.lineWidth = 16;
  g.lineCap = "round";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.beginPath();
    g.moveTo(200 + Math.cos(a) * 95, 200 + Math.sin(a) * 95);
    g.lineTo(200 + Math.cos(a) * 175, 200 + Math.sin(a) * 175);
    g.stroke();
  }
}, 400, 400);
