import * as THREE from "three";

export const makeMinaPadiBoardTex = (): THREE.CanvasTexture => {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 780;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#6e4223";
  ctx.fillRect(0, 0, 1200, 780);
  ctx.fillStyle = "#f7f0df";
  ctx.fillRect(36, 36, 1128, 708);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1a1324";
  ctx.font = "900 58px 'Avenir Next', 'Helvetica Neue', sans-serif";
  ctx.fillText("SISTEM MINA PADI", 600, 118);

  ctx.fillStyle = "#6e4a2b";
  ctx.font = "700 32px 'Avenir Next', sans-serif";
  ctx.fillText("Perbandingan 1 Musim Tanam", 600, 172);

  ctx.strokeStyle = "#d9c8aa";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(600, 224);
  ctx.lineTo(600, 696);
  ctx.stroke();

  // Left: Sawah Biasa
  ctx.fillStyle = "#d62d20";
  ctx.beginPath();
  ctx.roundRect(96, 232, 428, 76, 18);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 40px 'Avenir Next', sans-serif";
  ctx.fillText("SAWAH BIASA", 310, 271);

  ctx.fillStyle = "#2b1d2e";
  ctx.font = "700 34px 'Avenir Next', sans-serif";
  ctx.fillText("- Semprot hama rutin", 310, 384);
  ctx.fillText("- Beli pupuk kimia", 310, 466);
  ctx.fillText("- Air minim oksigen", 310, 548);
  ctx.fillStyle = "#d62d20";
  ctx.font = "900 38px 'Avenir Next', sans-serif";
  ctx.fillText("Panen 1x Saja", 310, 642);

  // Right: Mina Padi
  ctx.fillStyle = "#0e8a4a";
  ctx.beginPath();
  ctx.roundRect(676, 232, 428, 76, 18);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 40px 'Avenir Next', sans-serif";
  ctx.fillText("MINA PADI", 890, 271);

  ctx.fillStyle = "#163322";
  ctx.font = "700 34px 'Avenir Next', sans-serif";
  ctx.fillText("+ Ikan basmi wereng", 890, 384);
  ctx.fillText("+ Pupuk & oksigen alami", 890, 466);
  ctx.fillText("+ Bonus ikan segar!", 890, 548);
  ctx.fillStyle = "#0e8a4a";
  ctx.font = "900 38px 'Avenir Next', sans-serif";
  ctx.fillText("Panen Beras + Ikan!", 890, 642);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
};
