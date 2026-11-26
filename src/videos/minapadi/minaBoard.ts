import * as THREE from "three";
import { BoardConfig, DEFAULT_MINA_PADI_BOARD } from "../../types/studioProps";

export const makeMinaPadiBoardTex = (overrides?: Partial<BoardConfig>): THREE.CanvasTexture => {
  const cfg: BoardConfig = {
    ...DEFAULT_MINA_PADI_BOARD,
    ...overrides,
    leftItems: overrides?.leftItems ?? DEFAULT_MINA_PADI_BOARD.leftItems,
    rightItems: overrides?.rightItems ?? DEFAULT_MINA_PADI_BOARD.rightItems,
  };

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
  ctx.font = "900 56px 'Avenir Next', 'Helvetica Neue', sans-serif";
  ctx.fillText(cfg.title, 600, 118, 1080);

  ctx.fillStyle = "#6e4a2b";
  ctx.font = "700 32px 'Avenir Next', sans-serif";
  ctx.fillText(cfg.subtitle, 600, 172, 1060);

  ctx.strokeStyle = "#d9c8aa";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(600, 224);
  ctx.lineTo(600, 696);
  ctx.stroke();

  // Left column
  ctx.fillStyle = "#d62d20";
  ctx.beginPath();
  ctx.roundRect(96, 232, 428, 76, 18);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 40px 'Avenir Next', sans-serif";
  ctx.fillText(cfg.leftHeader, 310, 271, 400);

  ctx.fillStyle = "#2b1d2e";
  ctx.font = "700 34px 'Avenir Next', sans-serif";
  ctx.fillText(cfg.leftItems[0] || "", 310, 384, 460);
  ctx.fillText(cfg.leftItems[1] || "", 310, 466, 460);
  ctx.fillText(cfg.leftItems[2] || "", 310, 548, 460);
  ctx.fillStyle = "#d62d20";
  ctx.font = "900 38px 'Avenir Next', sans-serif";
  ctx.fillText(cfg.leftFooter, 310, 642, 460);

  // Right column
  ctx.fillStyle = "#0e8a4a";
  ctx.beginPath();
  ctx.roundRect(676, 232, 428, 76, 18);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 40px 'Avenir Next', sans-serif";
  ctx.fillText(cfg.rightHeader, 890, 271, 400);

  ctx.fillStyle = "#163322";
  ctx.font = "700 34px 'Avenir Next', sans-serif";
  ctx.fillText(cfg.rightItems[0] || "", 890, 384, 460);
  ctx.fillText(cfg.rightItems[1] || "", 890, 466, 460);
  ctx.fillText(cfg.rightItems[2] || "", 890, 548, 460);
  ctx.fillStyle = "#0e8a4a";
  ctx.font = "900 38px 'Avenir Next', sans-serif";
  ctx.fillText(cfg.rightFooter, 890, 642, 460);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
};
