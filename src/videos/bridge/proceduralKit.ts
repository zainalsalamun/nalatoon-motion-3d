import * as THREE from "three";
import { Kit } from "./build";

const m = (name: string, color: string) => {
  const mat = new THREE.MeshStandardMaterial({ color });
  mat.name = name;
  return mat;
};

const add = (g: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  g.add(mesh);
  return mesh;
};

const makeLantern = () => {
  const g = new THREE.Group();
  const iron = m("iron", "#3d424d"), glass = m("glass", "#ffe596");
  add(g, new THREE.CylinderGeometry(0.06, 0.1, 0.25, 8), iron, 0, 0.125, 0);
  add(g, new THREE.CylinderGeometry(0.035, 0.045, 0.72, 8), iron, 0, 0.56, 0);
  add(g, new THREE.BoxGeometry(0.14, 0.18, 0.14), glass, 0, 0.94, 0);
  add(g, new THREE.ConeGeometry(0.12, 0.1, 4), iron, 0, 1.08, 0, 0, Math.PI / 4, 0);
  return g;
};

const makeStall = (awningColor: string) => {
  const g = new THREE.Group();
  const wood = m("wood", "#a8724a"), woodD = m("woodDark", "#7a4f33"), cloth = m("cloth", awningColor), cream = m("cream", "#f4ecd8");
  // counter
  add(g, new THREE.BoxGeometry(1.4, 0.36, 0.65), wood, 0, 0.18, 0);
  add(g, new THREE.BoxGeometry(1.48, 0.06, 0.72), woodD, 0, 0.38, 0);
  // posts
  for (const sx of [-0.64, 0.64]) for (const sz of [-0.28, 0.28])
    add(g, new THREE.BoxGeometry(0.06, 0.9, 0.06), woodD, sx, 0.52, sz);
  // sloped striped awning
  for (let i = 0; i < 5; i++) {
    add(g, new THREE.BoxGeometry(0.29, 0.06, 0.88), i % 2 === 0 ? cloth : cream, -0.58 + i * 0.29, 0.98, 0, 0.18, 0, 0);
  }
  return g;
};

const makeBench = () => {
  const g = new THREE.Group();
  const wood = m("wood", "#a8724a"), iron = m("iron", "#3b404c");
  add(g, new THREE.BoxGeometry(1.4, 0.08, 0.42), wood, 0, 0.44, 0);
  add(g, new THREE.BoxGeometry(1.4, 0.32, 0.07), wood, 0, 0.72, -0.18, -0.15, 0, 0);
  for (const sx of [-0.55, 0.55]) add(g, new THREE.BoxGeometry(0.08, 0.44, 0.38), iron, sx, 0.22, 0);
  return g;
};

const makeCart = () => {
  const g = new THREE.Group();
  const wood = m("wood", "#a8724a"), woodD = m("woodDark", "#7a4f33");
  add(g, new THREE.BoxGeometry(1.1, 0.35, 0.68), wood, 0, 0.48, 0);
  add(g, new THREE.BoxGeometry(0.7, 0.06, 0.06), woodD, 0.85, 0.42, -0.22);
  add(g, new THREE.BoxGeometry(0.7, 0.06, 0.06), woodD, 0.85, 0.42, 0.22);
  for (const sz of [-0.38, 0.38])
    add(g, new THREE.CylinderGeometry(0.28, 0.28, 0.08, 12), woodD, -0.1, 0.28, sz, Math.PI / 2, 0, 0);
  return g;
};

const makeWindmill = () => {
  const g = new THREE.Group();
  const stone = m("stone", "#d6cfbe"), roof = m("roof", "#8a4a3c"), sail = m("sail", "#f2ebd8"), wood = m("woodDark", "#6e4b33");
  add(g, new THREE.CylinderGeometry(0.22, 0.36, 0.82, 10), stone, 0, 0.41, 0);
  add(g, new THREE.ConeGeometry(0.28, 0.24, 10), roof, 0, 0.92, 0);
  add(g, new THREE.BoxGeometry(0.06, 0.85, 0.03), wood, 0, 0.78, 0.26, 0, 0, 0.4);
  add(g, new THREE.BoxGeometry(0.85, 0.06, 0.03), wood, 0, 0.78, 0.26, 0, 0, 0.4);
  add(g, new THREE.BoxGeometry(0.14, 0.76, 0.015), sail, 0, 0.78, 0.28, 0, 0, 0.4);
  add(g, new THREE.BoxGeometry(0.76, 0.14, 0.015), sail, 0, 0.78, 0.28, 0, 0, 0.4);
  return g;
};

const makeCanoe = () => {
  const g = new THREE.Group();
  const wood = m("wood", "#9c623d"), woodD = m("woodDark", "#6e4226");
  const hull = new THREE.SphereGeometry(0.5, 12, 8);
  hull.scale(2.6, 0.55, 0.85);
  add(g, hull, wood, 0, 0.22, 0);
  add(g, new THREE.BoxGeometry(1.4, 0.06, 0.5), woodD, 0, 0.32, 0);
  return g;
};

const makeFlower = (petalColor: string) => {
  const g = new THREE.Group();
  const stem = m("leafsDark", "#4a9142"), petal = m("petal", petalColor), core = m("core", "#ffd64a");
  for (const [ox, oz] of [[0, 0], [0.22, 0.15], [-0.2, 0.18]]) {
    add(g, new THREE.CylinderGeometry(0.03, 0.04, 0.65, 6), stem, ox, 0.325, oz);
    add(g, new THREE.SphereGeometry(0.16, 8, 6), petal, ox, 0.72, oz);
    add(g, new THREE.SphereGeometry(0.08, 6, 5), core, ox, 0.78, oz);
  }
  return g;
};

const makeLily = () => {
  const g = new THREE.Group();
  const pad = m("leafsGreen", "#5aa83c");
  add(g, new THREE.CylinderGeometry(0.45, 0.45, 0.08, 12), pad, 0, 0.04, 0);
  return g;
};

export const buildProceduralKit = (): Kit => ({
  lantern: makeLantern(),
  "stall-red": makeStall("#c6453f"),
  "stall-green": makeStall("#3d8f56"),
  "stall-bench": makeBench(),
  cart: makeCart(),
  windmill: makeWindmill(),
  canoe: makeCanoe(),
  flower_redA: makeFlower("#e04a4a"),
  flower_yellowA: makeFlower("#f2c844"),
  flower_purpleA: makeFlower("#9b5de5"),
  lily_large: makeLily(),
});
