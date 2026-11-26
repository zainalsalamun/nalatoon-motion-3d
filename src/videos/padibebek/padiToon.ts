import * as THREE from "three";

const INK = "#201524";

export type Mood = "calm" | "smile" | "laugh" | "panic" | "shock" | "sweat" | "excited" | "smug";
export type Pose = "stand" | "open_crate" | "point_shock" | "sip_tea" | "spray" | "whistle" | "hold_eggs" | "chase_ducks" | "laugh_wave";
export type Role = "budi" | "darto";

// Minimalist expressive 2D stick-limb + big bean-head characters (exact charming viral appeal of @JadiBeginiClip!)
const drawHead = (g: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
  g.beginPath();
  g.ellipse(cx, cy, r * 1.04, r * 0.96, 0, 0, Math.PI * 2);
  g.fillStyle = "#fce7d0";
  g.fill();
  g.lineWidth = 12;
  g.strokeStyle = INK;
  g.stroke();
};

const drawFace = (g: CanvasRenderingContext2D, cx: number, cy: number, mood: Mood, hasMustache: boolean, dir: number) => {
  const ox = dir * 20;
  const ex = 40;
  const ey = cy + 6;
  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineCap = "round";
  g.lineJoin = "round";

  // Eyes
  if (mood === "laugh" || mood === "smile" || mood === "excited") {
    g.lineWidth = 9;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(cx + ox + s * ex, ey + 6, 16, Math.PI * 1.14, Math.PI * 1.86);
      g.stroke();
    }
  } else if (mood === "panic" || mood === "shock") {
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(cx + ox + s * ex, ey, 19, 0, Math.PI * 2);
      g.fillStyle = "#ffffff";
      g.fill();
      g.lineWidth = 8;
      g.stroke();
      g.beginPath();
      g.arc(cx + ox + s * ex, ey, 6, 0, Math.PI * 2);
      g.fillStyle = INK;
      g.fill();
    }
  } else if (mood === "sweat") {
    g.lineWidth = 9;
    for (const s of [-1, 1]) {
      const px = cx + ox + s * ex;
      g.beginPath();
      g.moveTo(px - 15, ey - 6);
      g.lineTo(px + 15, ey + 4);
      g.stroke();
    }
  } else {
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(cx + ox + s * ex, ey, 10, 14, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Eyebrows
  g.lineWidth = 8;
  for (const s of [-1, 1]) {
    const bx = cx + ox + s * ex;
    const by = ey - 32;
    g.beginPath();
    if (mood === "panic" || mood === "shock") {
      g.moveTo(bx - s * 16, by + 8);
      g.lineTo(bx + s * 16, by - 12);
    } else if (mood === "sweat") {
      g.moveTo(bx - s * 16, by + 6);
      g.lineTo(bx + s * 16, by - 4);
    } else {
      g.moveTo(bx - 16, by);
      g.quadraticCurveTo(bx, by - 8, bx + 16, by);
    }
    g.stroke();
  }

  // Pink cheek blush
  g.fillStyle = "rgba(242, 118, 128, 0.36)";
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + ox + s * 58, ey + 24, 15, 9, 0, 0, Math.PI * 2);
    g.fill();
  }

  // Pak Darto's signature thin mustache!
  const mx = cx + ox;
  const my = cy + 52;
  if (hasMustache) {
    g.strokeStyle = "#362520";
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(mx - 28, my - 8);
    g.quadraticCurveTo(mx, my - 18, mx + 28, my - 8);
    g.stroke();
    g.strokeStyle = INK;
  }

  // Mouth
  g.lineWidth = 9;
  g.beginPath();
  if (mood === "laugh" || mood === "excited") {
    g.arc(mx, my, 24, 0.05 * Math.PI, 0.95 * Math.PI);
    g.fillStyle = "#a32934";
    g.fill();
    g.stroke();
  } else if (mood === "smile" || mood === "smug" || mood === "calm") {
    g.arc(mx, my - 6, 22, 0.14 * Math.PI, 0.86 * Math.PI);
    g.stroke();
  } else if (mood === "panic" || mood === "shock") {
    g.ellipse(mx, my + 12, 18, 26, 0, 0, Math.PI * 2);
    g.fillStyle = "#8c2432";
    g.fill();
    g.stroke();
  } else {
    g.moveTo(mx - 18, my + 10);
    g.quadraticCurveTo(mx, my - 2, mx + 18, my + 10);
    g.stroke();
  }

  // Sweat drops for sweating / panicked Pak Darto!
  if (mood === "sweat" || mood === "panic" || mood === "shock") {
    g.fillStyle = "#6cd4ff";
    g.strokeStyle = INK;
    g.lineWidth = 6;
    for (const [sx, sy] of [[cx + 98, cy - 26], [cx - 98, cy - 8]]) {
      g.beginPath();
      g.moveTo(sx, sy - 20);
      g.quadraticCurveTo(sx + 15, sy + 6, sx, sy + 16);
      g.quadraticCurveTo(sx - 15, sy + 6, sx, sy - 20);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }
};

export const drawPadiCharacter = (
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
  const cx = W * 0.5;
  const runBounce = pose === "chase_ducks" ? Math.abs(Math.sin(phase * Math.PI * 6)) * 28 : Math.sin(phase * Math.PI * 2) * 7;
  const leanX = pose === "chase_ducks" ? 26 : pose === "spray" ? -18 : 0;

  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = INK;

  const footY = H - 34;
  const hipY = H - 255 - runBounce;
  const torsoTop = hipY - 210;

  // Expressive thin black stick legs (super nimble & charming animation!)
  const stride = pose === "chase_ducks" ? Math.sin(phase * Math.PI * 6) * 54 : pose === "spray" ? Math.sin(phase * Math.PI * 3) * 24 : 0;
  g.lineWidth = 18;
  g.beginPath();
  g.moveTo(cx - 32 + leanX * 0.4, hipY + 12);
  g.lineTo(cx - 38 - stride, footY - 12);
  g.moveTo(cx + 32 + leanX * 0.4, hipY + 12);
  g.lineTo(cx + 38 + stride, footY - 12);
  g.stroke();

  // Boots / feet
  g.fillStyle = "#2b1d1c";
  g.lineWidth = 8;
  for (const fx of [cx - 38 - stride, cx + 38 + stride]) {
    g.beginPath();
    g.ellipse(fx + (dir || 1) * 10, footY - 10, 26, 13, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  // Torso (Pak Budi: Teal 3-button farmer tunic; Pak Darto: Warm Brown-Gold Batik Shirt!)
  const tx = cx + leanX;
  g.fillStyle = role === "budi" ? "#1e8578" : "#8c4a1c";
  g.lineWidth = 12;
  g.beginPath();
  g.roundRect(tx - 78, torsoTop, 156, 224, 38);
  g.fill();
  g.stroke();

  if (role === "budi") {
    // Crisp 3-button teal farmer shirt detail
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(tx, torsoTop + 6);
    g.lineTo(tx, torsoTop + 120);
    g.stroke();
    g.fillStyle = "#f5ebd4";
    for (const by of [torsoTop + 42, torsoTop + 76, torsoTop + 110]) {
      g.beginPath();
      g.arc(tx, by, 7, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  } else {
    // Rich brown-gold Indonesian Batik diamond pattern for Pak Darto!
    g.strokeStyle = "#f2c14e";
    g.lineWidth = 6;
    for (let row = 0; row < 3; row++) {
      for (let col = -1; col <= 1; col++) {
        const bx = tx + col * 42;
        const by = torsoTop + 48 + row * 56;
        g.beginPath();
        g.moveTo(bx, by - 14);
        g.lineTo(bx + 14, by);
        g.lineTo(bx, by + 14);
        g.lineTo(bx - 14, by);
        g.closePath();
        g.stroke();
      }
    }
  }

  // Expressive thin black stick arms + hands & props!
  const shY = torsoTop + 56;
  const drawStickArm = (sx: number, sy: number, ex: number, ey: number, mx: number, my: number) => {
    g.strokeStyle = INK;
    g.lineWidth = 18;
    g.beginPath();
    g.moveTo(sx, sy);
    g.quadraticCurveTo(mx, my, ex, ey);
    g.stroke();
    g.fillStyle = "#fce7d0";
    g.lineWidth = 8;
    g.beginPath();
    g.arc(ex, ey, 19, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  };

  if (pose === "point_shock") {
    drawStickArm(tx - 74, shY, tx - 125, shY + 95, tx - 118, shY + 45);
    drawStickArm(tx + 74, shY, tx + 178, shY - 32, tx + 132, shY + 8);
  } else if (pose === "sip_tea") {
    drawStickArm(tx - 74, shY, tx - 115, shY + 100, tx - 112, shY + 55);
    drawStickArm(tx + 74, shY, tx + 78, shY + 42, tx + 122, shY + 72);
    // Steaming warm clay tea mug!
    g.fillStyle = "#c96838";
    g.strokeStyle = INK;
    g.lineWidth = 8;
    g.beginPath();
    g.roundRect(tx + 56, shY + 18, 46, 52, 10);
    g.fill();
    g.stroke();
  } else if (pose === "spray") {
    // Holding green pesticide sprayer backpack & wand!
    g.fillStyle = "#2b9e4b";
    g.strokeStyle = INK;
    g.lineWidth = 9;
    g.beginPath();
    g.roundRect(tx + 62, torsoTop + 16, 58, 138, 16);
    g.fill();
    g.stroke();
    const sw = Math.sin(phase * Math.PI * 5) * 18;
    drawStickArm(tx - 74, shY, tx - 148, shY + 58 + sw, tx - 120, shY + 76);
    drawStickArm(tx + 74, shY, tx - 86, shY + 82 + sw, tx + 20, shY + 105);
    // Brass spray lance + white mist!
    g.strokeStyle = "#4d525c";
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(tx - 148, shY + 58 + sw);
    g.lineTo(tx - 245, shY + 95 + sw);
    g.stroke();
    g.fillStyle = "rgba(220, 255, 225, 0.72)";
    g.beginPath();
    g.arc(tx - 262, shY + 104 + sw, 26, 0, Math.PI * 2);
    g.fill();
  } else if (pose === "hold_eggs") {
    // Proudly holding woven basket brimming with fresh blue-white duck eggs!
    drawStickArm(tx - 74, shY, tx - 52, shY + 86, tx - 112, shY + 76);
    drawStickArm(tx + 74, shY, tx + 52, shY + 86, tx + 112, shY + 76);
    g.fillStyle = "#c98b42";
    g.strokeStyle = INK;
    g.lineWidth = 9;
    g.beginPath();
    g.roundRect(tx - 72, shY + 54, 144, 72, 22);
    g.fill();
    g.stroke();
    // Eggs peeking out!
    g.fillStyle = "#d9f5f0";
    for (const ex of [-36, 0, 36]) {
      g.beginPath();
      g.ellipse(tx + ex, shY + 46, 20, 26, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  } else if (pose === "chase_ducks" || pose === "laugh_wave") {
    const wave = Math.sin(phase * Math.PI * 6) * 26;
    drawStickArm(tx - 74, shY, tx - 155, shY - 95 + wave, tx - 128, shY - 15);
    drawStickArm(tx + 74, shY, tx + 155, shY - 95 - wave, tx + 128, shY - 15);
  } else if (pose === "whistle") {
    drawStickArm(tx - 74, shY, tx - 115, shY + 98, tx - 114, shY + 55);
    drawStickArm(tx + 74, shY, tx + 165, shY - 45, tx + 132, shY + 12);
  } else {
    const sw = Math.sin(phase * Math.PI * 2) * 14;
    drawStickArm(tx - 74, shY, tx - 108, shY + 112 + sw, tx - 118, shY + 60);
    drawStickArm(tx + 74, shY, tx + 108, shY + 112 - sw, tx + 118, shY + 60);
  }

  // Big Expressive Cream Round Head
  const headY = torsoTop - 102;
  drawHead(g, tx, headY, 108);
  drawFace(g, tx, headY, mood, role === "darto", dir);

  // Iconic Indonesian Headgear
  g.strokeStyle = INK;
  g.lineWidth = 11;
  g.lineJoin = "round";
  if (role === "budi") {
    // Classic bright woven straw farmer Caping!
    g.fillStyle = "#f2cc59";
    g.beginPath();
    g.moveTo(tx - 165, headY - 48);
    g.lineTo(tx, headY - 172);
    g.lineTo(tx + 165, headY - 48);
    g.quadraticCurveTo(tx, headY - 22, tx - 165, headY - 48);
    g.closePath();
    g.fill();
    g.stroke();
    // Woven band line
    g.strokeStyle = "#bd8624";
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(tx - 98, headY - 94);
    g.quadraticCurveTo(tx, headY - 76, tx + 98, headY - 94);
    g.stroke();
  } else {
    // Pak Darto's crisp black Indonesian Peci!
    g.fillStyle = "#1d1a24";
    g.beginPath();
    g.roundRect(tx - 92, headY - 146, 184, 82, 20);
    g.fill();
    g.stroke();
  }
};

// --- ONE Diegetic Wooden Signboard Planted Naturally in the Paddy (Shot 12 ONLY — ZERO floating UI cards!) ---
export const makeDiegeticBoardTex = () => {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 680;
  const g = cv.getContext("2d")!;

  // Chalkboard/whiteboard cream wood surface with dark wooden frame
  g.fillStyle = "#fbf4e2";
  g.fillRect(0, 0, 1024, 680);
  g.strokeStyle = "#6e4020";
  g.lineWidth = 34;
  g.strokeRect(17, 17, 990, 646);

  // Title header
  g.fillStyle = "#221626";
  g.font = "900 56px -apple-system, BlinkMacSystemFont, sans-serif";
  g.textAlign = "center";
  g.fillText("SISTEM PADI-BEBEK (AIGAMO)", 512, 106);

  g.fillStyle = "#6b543c";
  g.font = "800 32px -apple-system, BlinkMacSystemFont, sans-serif";
  g.fillText("Perbandingan 1 Musim Tanam", 512, 152);

  // Center vertical divider
  g.strokeStyle = "#c9b595";
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(512, 195);
  g.lineTo(512, 625);
  g.stroke();

  // Left Column: SAWAH BIASA
  g.fillStyle = "#c43828";
  g.beginPath();
  g.roundRect(68, 202, 400, 74, 18);
  g.fill();
  g.fillStyle = "#ffffff";
  g.font = "900 40px -apple-system, BlinkMacSystemFont, sans-serif";
  g.fillText("SAWAH BIASA", 268, 253);

  g.fillStyle = "#2b1e24";
  g.font = "800 34px -apple-system, BlinkMacSystemFont, sans-serif";
  g.fillText("- Semprot pestisida", 268, 344);
  g.fillText("- Cabut rumput manual", 268, 418);
  g.fillText("- Beli pupuk kimia", 268, 492);
  g.fillStyle = "#b53324";
  g.font = "900 36px -apple-system, BlinkMacSystemFont, sans-serif";
  g.fillText("Biaya Tinggi", 268, 578);

  // Right Column: SAWAH BEBEK
  g.fillStyle = "#1f8552";
  g.beginPath();
  g.roundRect(556, 202, 400, 74, 18);
  g.fill();
  g.fillStyle = "#ffffff";
  g.font = "900 40px -apple-system, BlinkMacSystemFont, sans-serif";
  g.fillText("SAWAH BEBEK", 756, 253);

  g.fillStyle = "#1c3324";
  g.font = "800 34px -apple-system, BlinkMacSystemFont, sans-serif";
  g.fillText("+ Keong & hama habis", 756, 344);
  g.fillText("+ Pupuk alami gratis", 756, 418);
  g.fillText("+ Bebek & telur bonus!", 756, 492);
  g.fillStyle = "#157a44";
  g.font = "900 36px -apple-system, BlinkMacSystemFont, sans-serif";
  g.fillText("Panen Dobel!", 756, 578);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
};
