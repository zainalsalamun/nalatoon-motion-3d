import * as THREE from "three";
import { grass, bed, cloudHD, roof, planks } from "../bridge/paint";
import { CAFE_LIGHTS, CafeLight, dirFromAngles } from "../cafe/cafeLights";
import { SHOTS, FPS, camAt, clamp01 } from "./story";
import { makeMinaPadiBoardTex } from "./minaBoard";
import { DioramaCharacter } from "../padibebek/dioramaRig";
import type { BoardConfig } from "../../types/studioProps";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const pbr = (color: string, roughness = 0.78, metalness = 0.02, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

const buildRiceClumpGeo = (blades = 8, spread = 0.28, baseH = 0.96): THREE.BufferGeometry => {
  const pos: number[] = [];
  const norm: number[] = [];
  const addTri = (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    pos.push(...a, ...b, ...c);
    norm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  };
  for (let i = 0; i < blades; i++) {
    const ang = (i / blades) * Math.PI * 2 + (i % 2) * 0.22;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const tx = -sa, tz = ca;
    const h = baseH * (0.76 + ((i * 37) % 10) * 0.032);
    const lean = spread * (0.72 + (i % 3) * 0.24);
    const w0 = 0.052, w1 = 0.032, r0 = 0.032;
    const bL: [number, number, number] = [ca * r0 - tx * w0, 0, sa * r0 - tz * w0];
    const bR: [number, number, number] = [ca * r0 + tx * w0, 0, sa * r0 + tz * w0];
    const mL: [number, number, number] = [ca * (r0 + lean * 0.45) - tx * w1, h * 0.56, sa * (r0 + lean * 0.45) - tz * w1];
    const mR: [number, number, number] = [ca * (r0 + lean * 0.45) + tx * w1, h * 0.56, sa * (r0 + lean * 0.45) + tz * w1];
    const tip: [number, number, number] = [ca * (r0 + lean * 1.18), h * 0.94, sa * (r0 + lean * 1.18)];
    addTri(bL, bR, mR); addTri(bL, mR, mL); addTri(mL, mR, tip);
    addTri(bR, bL, mR); addTri(mR, bL, mL); addTri(mR, mL, tip);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(norm, 3));
  return geo;
};

const addBox = (
  parent: THREE.Object3D,
  w: number, h: number, d: number,
  mat: THREE.Material,
  x: number, y: number, z: number,
  ry = 0,
  castShadow = true,
) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = castShadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
};

type FishSlot = {
  group: THREE.Group;
  tailPivot: THREE.Group;
  wake: THREE.Mesh;
  laneX: number;
  baseZ: number;
  speed: number;
  phase: number;
};

// Soft glossy 3D Golden Carp / Koi Fish with hinged wagging tail fin + water ripple!
const buildSoftFish = (bodyHex: string, finHex: string): { group: THREE.Group; tailPivot: THREE.Group; wake: THREE.Mesh } => {
  const g = new THREE.Group();
  const bodyMat = pbr(bodyHex, 0.28, 0.14);
  const finMat = pbr(finHex, 0.38, 0.08);
  const eyeMat = pbr("#1a141c", 0.15, 0.2);

  // Sleek rounded carp body pointing along +Z
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), bodyMat);
  body.scale.set(0.76, 0.92, 1.95);
  body.castShadow = true;
  g.add(body);

  // Cute dorsal fin along top back
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), finMat);
  dorsal.rotation.x = -0.55;
  dorsal.scale.set(0.35, 1.0, 1.35);
  dorsal.position.set(0, 0.16, -0.02);
  g.add(dorsal);

  // Side pectoral fins
  for (const sx of [-0.12, 0.12]) {
    const pFin = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), finMat);
    pFin.rotation.z = sx > 0 ? -1.2 : 1.2;
    pFin.rotation.y = sx > 0 ? -0.4 : 0.4;
    pFin.position.set(sx, -0.03, 0.08);
    g.add(pFin);
  }

  // Glossy black bead eyes near front snout
  for (const sx of [-0.088, 0.088]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), eyeMat);
    eye.position.set(sx, 0.04, 0.22);
    g.add(eye);
  }

  // Hinged oscillating tail fin at -Z
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0, -0.26);
  const tailUpper = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), finMat);
  tailUpper.scale.set(0.28, 1.0, 1.0);
  tailUpper.rotation.x = -Math.PI * 0.62;
  tailUpper.position.set(0, 0.06, -0.1);
  tailPivot.add(tailUpper);
  const tailLower = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 6), finMat);
  tailLower.scale.set(0.28, 1.0, 1.0);
  tailLower.rotation.x = -Math.PI * 0.38;
  tailLower.position.set(0, -0.05, -0.1);
  tailPivot.add(tailLower);
  g.add(tailPivot);

  // Soft translucent surface water ripple
  const wakeGeo = new THREE.RingGeometry(0.2, 0.32, 22);
  wakeGeo.rotateX(-Math.PI / 2);
  const wake = new THREE.Mesh(
    wakeGeo,
    new THREE.MeshBasicMaterial({ color: "#e8f8ff", transparent: true, opacity: 0.48, side: THREE.DoubleSide, depthWrite: false }),
  );
  wake.position.y = 0.02;
  g.add(wake);

  return { group: g, tailPivot, wake };
};

const buildVillageTree = (x: number, y: number, z: number, sc = 1.0, tint = "#5ca83d") => {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(sc);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 2.2, 10), pbr("#755033", 0.92));
  trunk.position.y = 1.1;
  trunk.castShadow = true;
  g.add(trunk);
  const leafMain = pbr(tint, 0.84);
  const leafLight = pbr("#76c24c", 0.82);
  const puffs: [number, number, number, number, boolean][] = [
    [0, 3.0, 0, 1.55, false], [-1.05, 2.55, 0.45, 1.15, true],
    [1.05, 2.65, -0.35, 1.2, false], [0.25, 3.75, 0.35, 1.12, true], [-0.5, 2.45, -0.85, 1.05, false],
  ];
  for (const [px, py, pz, r, lt] of puffs) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), lt ? leafLight : leafMain);
    s.position.set(px, py, pz);
    s.castShadow = true;
    s.receiveShadow = true;
    g.add(s);
  }
  return g;
};

const buildCoconutPalm = (x: number, y: number, z: number, lean = 0.14, sc = 1.0) => {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(sc);
  const bark = pbr("#876042", 0.9);
  const frondMat = pbr("#58a83e", 0.78);
  const nutMat = pbr("#6b4628", 0.82);
  let cy = 0, cx = 0;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.15 - i * 0.012, 0.18 - i * 0.012, 0.95, 10), bark);
    cx += lean * (i * 0.12);
    cy += 0.88;
    seg.position.set(cx, cy - 0.44, 0);
    seg.rotation.z = -lean * (i * 0.15);
    seg.castShadow = true;
    g.add(seg);
  }
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const fg = new THREE.Group();
    fg.position.set(cx, cy, 0);
    fg.rotation.y = ang;
    const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 1.35), frondMat);
    f1.position.set(0, 0.22, 0.62); f1.rotation.x = -0.22; fg.add(f1);
    const f2 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 1.3), frondMat);
    f2.position.set(0, 0.04, 1.72); f2.rotation.x = 0.42; fg.add(f2);
    g.add(fg);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), nutMat);
    nut.position.set(cx + Math.cos(a) * 0.2, cy - 0.12, Math.sin(a) * 0.2);
    g.add(nut);
  }
  return g;
};

const buildSkyDome = () => {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      c0: { value: new THREE.Color("#4f92db") },
      c1: { value: new THREE.Color("#80b8eb") },
      c2: { value: new THREE.Color("#b4d6f4") },
      c3: { value: new THREE.Color("#d9ebfa") },
      c4: { value: new THREE.Color("#eef5fc") },
      sunDir: { value: new THREE.Vector3(0.4, 0.5, 0.7).normalize() },
      sunDisc: { value: 0 },
    },
    vertexShader: `varying vec3 vPos; void main() { vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 c0, c1, c2, c3, c4, sunDir; uniform float sunDisc; varying vec3 vPos;
      void main() {
        float h = clamp(vPos.y, 0.0, 1.0);
        vec3 col = mix(c4, c3, smoothstep(0.0, 0.14, h));
        col = mix(col, c2, smoothstep(0.14, 0.34, h));
        col = mix(col, c1, smoothstep(0.34, 0.62, h));
        col = mix(col, c0, smoothstep(0.62, 0.95, h));
        float sd = max(dot(normalize(vPos), normalize(sunDir)), 0.0);
        col += vec3(1.2, 0.8, 0.42) * pow(sd, 36.0) * 0.45 * sunDisc;
        col += vec3(1.6, 1.15, 0.65) * smoothstep(0.996, 0.999, sd) * sunDisc;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return { mesh: new THREE.Mesh(new THREE.SphereGeometry(420, 32, 20), mat), mat };
};

export class MinaPadiWorld {
  root = new THREE.Group();
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#d4e7f7", 36, 195);
  private waterTex: THREE.Texture;
  private paddyWaterRight: THREE.Mesh;
  private clouds: THREE.Mesh[] = [];

  private leftRiceMesh: THREE.InstancedMesh;
  private rightRiceMesh: THREE.InstancedMesh;
  private leftRiceMat: THREE.MeshStandardMaterial;
  private rightRiceMat: THREE.MeshStandardMaterial;
  private leftCoords: [number, number, number][] = [];
  private rightCoords: [number, number, number][] = [];
  private dummy = new THREE.Object3D();

  // Animated 3D Fish, Trenches, Sluice Gate, Pests, Bubbles & Buckets!
  private fish: FishSlot[] = [];
  private rightTrenchWater: THREE.Mesh;
  private leftTrenchWater: THREE.Mesh;
  private sluiceGate: THREE.Group;
  private sluicePanel: THREE.Mesh;
  private heroPest: THREE.Group;
  private bubbles: THREE.Mesh[] = [];
  private sparkles: THREE.Mesh[] = [];
  private releaseBasket: THREE.Group;
  private scoopNet: THREE.Group;
  private fishBucket: THREE.Group;
  private leftFishBucket: THREE.Group;
  private signGroup: THREE.Group;
  private boardMat: THREE.MeshBasicMaterial;
  private weedPatchLeft: THREE.Group;

  private budi: DioramaCharacter;
  private darto: DioramaCharacter;

  constructor(board?: Partial<BoardConfig>) {
    // 1. Soft PBR Blender-Diorama Sunlight
    this.hemi = new THREE.HemisphereLight("#cbe3ff", "#7a8559", 1.35);
    this.root.add(this.hemi);

    this.sun = new THREE.DirectionalLight("#fff6e3", 2.55);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 140;
    const d = 28;
    this.sun.shadow.camera.left = -d;
    this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d;
    this.sun.shadow.camera.bottom = -d;
    this.sun.shadow.bias = -0.0002;
    this.sun.shadow.normalBias = 0.045;
    this.sun.shadow.radius = 3.5;
    this.root.add(this.sun);
    this.root.add(this.sun.target);

    this.fill = new THREE.DirectionalLight("#c2dcfa", 0.55);
    this.fill.position.set(-16, 14, 16);
    this.root.add(this.fill);

    // 2. Sky & Clouds
    const sky = buildSkyDome();
    this.skyMat = sky.mat;
    this.root.add(sky.mesh);

    const clTex = cloudHD(4);
    const clMat = new THREE.MeshBasicMaterial({ map: clTex, transparent: true, opacity: 0.85, depthWrite: false });
    for (const [cx, cy, cz, sc] of [[-24, 24, -46, 26], [14, 26, -50, 28], [38, 22, -42, 22], [-4, 19, -34, 18]] as [number, number, number, number][]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sc, sc * 0.48), clMat);
      m.position.set(cx, cy, cz);
      this.root.add(m);
      this.clouds.push(m);
    }

    // 3. Natural Indonesian Muddy Paddy + Clear Reflective Water + Deep Perimeter Fish Trenches (Caren)!
    const bedTex = bed().clone();
    bedTex.repeat.set(9, 9);
    bedTex.needsUpdate = true;
    const mudFloor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), pbr("#7d6442", 0.94, 0.0, { map: bedTex }));
    mudFloor.rotation.x = -Math.PI / 2;
    mudFloor.position.y = -0.02;
    mudFloor.receiveShadow = true;
    this.root.add(mudFloor);

    const wCanvas = document.createElement("canvas");
    wCanvas.width = 256;
    wCanvas.height = 256;
    const wCtx = wCanvas.getContext("2d")!;
    wCtx.fillStyle = "#8aa5a3";
    wCtx.fillRect(0, 0, 256, 256);
    wCtx.fillStyle = "rgba(255,255,255,0.22)";
    for (let i = 0; i < 42; i++) {
      wCtx.fillRect((i * 59) % 256, (i * 37) % 256, 28 + (i % 24), 3);
    }
    this.waterTex = new THREE.CanvasTexture(wCanvas);
    this.waterTex.colorSpace = THREE.SRGBColorSpace;
    this.waterTex.wrapS = this.waterTex.wrapT = THREE.RepeatWrapping;
    this.waterTex.repeat.set(10, 10);

    const waterMat = new THREE.MeshStandardMaterial({
      map: this.waterTex, color: "#a4c2c7", roughness: 0.14, metalness: 0.22, transparent: true, opacity: 0.56,
    });
    // Left field water
    const paddyWaterLeft = new THREE.Mesh(new THREE.PlaneGeometry(13, 26), waterMat);
    paddyWaterLeft.rotation.x = -Math.PI / 2;
    paddyWaterLeft.position.set(-6.5, 0.08, 1.0);
    paddyWaterLeft.receiveShadow = true;
    this.root.add(paddyWaterLeft);

    // Right field water (lowers gently during Shot 10-11 harvest draining!)
    this.paddyWaterRight = new THREE.Mesh(new THREE.PlaneGeometry(13, 26), waterMat);
    this.paddyWaterRight.rotation.x = -Math.PI / 2;
    this.paddyWaterRight.position.set(6.5, 0.08, 1.0);
    this.paddyWaterRight.receiveShadow = true;
    this.root.add(this.paddyWaterRight);

    // Deep Perimeter Fish Trench (Caren) along the bund in Pak Budi's Right Field (x = 0.74..2.05) — rich deep teal-aqua channel!
    const trenchMat = new THREE.MeshStandardMaterial({
      map: this.waterTex, color: "#3d8594", roughness: 0.12, metalness: 0.26, transparent: true, opacity: 0.86,
    });
    this.rightTrenchWater = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 24.5), trenchMat);
    this.rightTrenchWater.rotation.x = -Math.PI / 2;
    this.rightTrenchWater.position.set(1.42, 0.095, 0.5);
    this.root.add(this.rightTrenchWater);

    // Pak Darto's brand-new Perimeter Trench in Left Field (visible in Shots 15-16!)
    this.leftTrenchWater = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 24.5), trenchMat);
    this.leftTrenchWater.rotation.x = -Math.PI / 2;
    this.leftTrenchWater.position.set(-1.42, 0.095, 0.5);
    this.leftTrenchWater.visible = false;
    this.root.add(this.leftTrenchWater);

    // Central Mossy Grass Bund (Pematang Sawah)
    const grassTex = grass().clone();
    grassTex.repeat.set(2, 12);
    grassTex.needsUpdate = true;
    const bundMat = pbr("#88c752", 0.88, 0.0, { map: grassTex });
    addBox(this.root, 1.48, 0.44, 28.0, bundMat, 0.0, 0.22, 0.0);

    const outerGrassTex = grass().clone();
    outerGrassTex.repeat.set(16, 8);
    outerGrassTex.needsUpdate = true;
    const outerGrass = pbr("#76b547", 0.9, 0.0, { map: outerGrassTex });
    addBox(this.root, 50.0, 0.52, 26.0, outerGrass, 0.0, 0.24, -24.5, 0, false);
    addBox(this.root, 32.0, 0.44, 1.6, bundMat, 0.0, 0.22, 13.8, 0, false);
    addBox(this.root, 1.6, 0.44, 28.0, bundMat, -12.2, 0.22, 0.0, 0, false);
    addBox(this.root, 1.6, 0.44, 28.0, bundMat, 12.2, 0.22, 0.0, 0, false);

    // 4. 300 Multi-Blade Swaying 3D Rice Clumps (Right field starts at x=2.35 leaving room for the deep perimeter Fish Trench!)
    const riceGeo = buildRiceClumpGeo(8, 0.28, 0.96);
    this.leftRiceMat = pbr("#6db33f", 0.72, 0.02);
    this.rightRiceMat = pbr("#58ab38", 0.72, 0.02);

    for (let ix = 0; ix < 9; ix++) {
      for (let iz = 0; iz < 16; iz++) {
        const jx = (((ix * 37 + iz * 17) % 10) - 5) * 0.03;
        const jz = (((ix * 13 + iz * 29) % 10) - 5) * 0.03;
        this.leftCoords.push([-2.35 - ix * 0.98 + jx, -9.8 + iz * 1.38 + jz, (ix + iz) * 0.45]);
        this.rightCoords.push([2.35 + ix * 0.98 + jx, -9.8 + iz * 1.38 + jz, (ix + iz) * 0.45]);
      }
    }
    this.leftRiceMesh = new THREE.InstancedMesh(riceGeo, this.leftRiceMat, this.leftCoords.length);
    this.rightRiceMesh = new THREE.InstancedMesh(riceGeo, this.rightRiceMat, this.rightCoords.length);
    this.leftRiceMesh.castShadow = true;
    this.rightRiceMesh.castShadow = true;
    this.root.add(this.leftRiceMesh, this.rightRiceMesh);

    // Wild weeds in Left Field (Shots 4..9)
    this.weedPatchLeft = new THREE.Group();
    const weedGeo = buildRiceClumpGeo(6, 0.36, 0.48);
    const weedMat = pbr("#66732d", 0.85);
    for (let i = 0; i < 16; i++) {
      const w = new THREE.Mesh(weedGeo, weedMat);
      w.position.set(-2.65 - (i % 4) * 1.6, 0.04, -4.5 + Math.floor(i / 4) * 3.15);
      w.rotation.y = i * 1.1;
      this.weedPatchLeft.add(w);
    }
    this.root.add(this.weedPatchLeft);

    // 5. 24 Animated 3D Swimming Golden Carp & Koi Fish!
    const palette: [string, string][] = [
      ["#ff881a", "#ffd166"], // Bright Golden Carp (Ikan Mas)
      ["#f5a623", "#ffe184"], // Warm Gold Carp
      ["#eb4d28", "#fff0db"], // Red-Gold Koi Carp
      ["#ff9d2e", "#ffd97d"], // Sunset Carp
    ];
    for (let i = 0; i < 24; i++) {
      const [c1, c2] = palette[i % palette.length];
      const fObj = buildSoftFish(c1, c2);
      this.root.add(fObj.group);
      this.fish.push({
        ...fObj,
        laneX: i < 8 ? (1.05 + (i % 2) * 0.72) : (2.75 + ((i - 8) % 5) * 1.45),
        baseZ: -5.2 + Math.floor(i / 6) * 3.4,
        speed: 0.85 + (i % 5) * 0.16,
        phase: i * 0.63,
      });
    }

    // 6. 3D Wooden Bamboo Water-Gate Sluice (Pintu Air) on Bund for Shot 10 draining!
    this.sluiceGate = new THREE.Group();
    this.sluiceGate.position.set(1.42, 0.08, 6.2);
    const bamMat = pbr("#b58947", 0.86);
    addBox(this.sluiceGate, 0.12, 1.35, 0.12, bamMat, -0.68, 0.65, 0);
    addBox(this.sluiceGate, 0.12, 1.35, 0.12, bamMat, 0.68, 0.65, 0);
    addBox(this.sluiceGate, 1.5, 0.12, 0.14, bamMat, 0, 1.28, 0);
    this.sluicePanel = addBox(this.sluiceGate, 1.24, 0.75, 0.07, pbr("#875b32", 0.88), 0, 0.42, 0);
    this.root.add(this.sluiceGate);

    // 7. Hero 3D Planthopper Pest (Wereng) perched clearly in open rice gap in Shot 6!
    this.heroPest = new THREE.Group();
    this.heroPest.position.set(2.95, 0.56, 4.2);
    const pBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.11, 6, 10), pbr("#5c3a1e", 0.55));
    pBody.rotation.z = 0.5;
    this.heroPest.add(pBody);
    for (const sz of [-0.05, 0.05]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), pbr("#a67c52", 0.4, 0.05, { transparent: true, opacity: 0.75 }));
      wing.scale.set(1.6, 0.35, 0.7);
      wing.position.set(-0.04, 0.04, sz);
      this.heroPest.add(wing);
    }
    this.root.add(this.heroPest);

    // 8. Rising 3D Translucent Oxygen Bubbles (Shot 7!) & Nutrient Sparkles (Shot 8!)
    const bubMat = pbr("#dff8ff", 0.1, 0.1, { transparent: true, opacity: 0.72 });
    for (let i = 0; i < 18; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.045 + (i % 3) * 0.02, 10, 8), bubMat);
      this.root.add(b);
      this.bubbles.push(b);
    }
    const spMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.9, 1.0) });
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), spMat);
      this.root.add(sp);
      this.sparkles.push(sp);
    }

    // 9. Interactive 3D Props (Fish Release Basket, Bamboo Scoop Net, Overflowing Harvest Fish Bucket, Diegetic Wooden Board!)
    const weaveMat = pbr("#bd8642", 0.86, 0.0, { map: planks() });
    this.releaseBasket = new THREE.Group();
    this.releaseBasket.position.set(1.05, 0.54, 6.75);
    const rCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.56, 16), weaveMat);
    rCyl.rotation.z = -1.1; // Tilted pouring golden carp into paddy!
    rCyl.castShadow = true;
    this.releaseBasket.add(rCyl);
    this.root.add(this.releaseBasket);

    // Bamboo Scoop Net (Serokan) for Shot 11
    this.scoopNet = new THREE.Group();
    this.scoopNet.position.set(1.25, 0.52, 5.1);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1.5, 10), bamMat);
    handle.rotation.z = 0.65;
    handle.position.set(-0.5, 0.52, 0);
    this.scoopNet.add(handle);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 20), bamMat);
    hoop.rotation.x = Math.PI / 2;
    this.scoopNet.add(hoop);
    const meshNet = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 14, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
      pbr("#d9e4e8", 0.8, 0, { transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
    );
    this.scoopNet.add(meshNet);
    this.root.add(this.scoopNet);

    // Overflowing Wooden Harvest Fish Bucket on bund (Shots 13-14!)
    const makeFishBucket = (x: number, y: number, z: number) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.34, 0.44, 18), pbr("#8f5c30", 0.82));
      tub.position.y = 0.22;
      tub.castShadow = true;
      g.add(tub);
      const topWater = new THREE.Mesh(new THREE.CircleGeometry(0.41, 18), pbr("#5aa9bd", 0.15, 0.2));
      topWater.rotation.x = -Math.PI / 2;
      topWater.position.y = 0.42;
      g.add(topWater);
      for (let k = 0; k < 5; k++) {
        const mf = buildSoftFish(k % 2 === 0 ? "#ff881a" : "#eb4d28", "#ffd166");
        mf.wake.visible = false;
        mf.group.scale.setScalar(0.75);
        const ang = (k / 5) * Math.PI * 2;
        mf.group.position.set(Math.cos(ang) * 0.16, 0.44 + (k % 2) * 0.04, Math.sin(ang) * 0.16);
        mf.group.rotation.y = ang + 1.2;
        mf.group.rotation.x = -0.25;
        g.add(mf.group);
      }
      return g;
    };
    this.fishBucket = makeFishBucket(-0.34, 0.44, 6.75);
    this.root.add(this.fishBucket);

    this.leftFishBucket = makeFishBucket(-0.48, 0.44, 6.6);
    this.root.add(this.leftFishBucket);

    // ONE Diegetic Wooden Signboard (Shot 12 ONLY — SISTEM MINA PADI!)
    this.signGroup = new THREE.Group();
    this.signGroup.position.set(2.6, 0.08, 4.2);
    const postWood = pbr("#6e4223", 0.88);
    addBox(this.signGroup, 0.14, 1.55, 0.14, postWood, -1.05, 0.78, -0.14);
    addBox(this.signGroup, 0.14, 1.55, 0.14, postWood, 1.05, 0.78, -0.14);
    addBox(this.signGroup, 3.16, 2.08, 0.1, postWood, 0, 2.22, -0.06);
    this.boardMat = new THREE.MeshBasicMaterial({ map: makeMinaPadiBoardTex(board), side: THREE.DoubleSide });
    const boardPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(3.08, 2.0),
      this.boardMat,
    );
    boardPlane.position.set(0, 2.22, 0.02);
    this.signGroup.add(boardPlane);
    this.root.add(this.signGroup);

    // 10. Indonesian Countryside Backdrop
    this.buildIndonesianVillage();

    // 11. Returning FULL 3D RIGGED CHARACTERS (Pak Budi & Pak Darto!)
    this.budi = new DioramaCharacter("budi");
    this.darto = new DioramaCharacter("darto");
    this.root.add(this.budi.root, this.darto.root);
  }

  setBoard(board?: Partial<BoardConfig>) {
    const prev = this.boardMat.map;
    this.boardMat.map = makeMinaPadiBoardTex(board);
    this.boardMat.needsUpdate = true;
    if (prev) prev.dispose();
  }

  private buildIndonesianVillage() {
    const roofTile = pbr("#c95a38", 0.78, 0.02, { map: roof("#c44e32") });
    const bamboo = pbr("#c7a258", 0.85);
    const winBlue = pbr("#5f93c2", 0.35, 0.12);
    const woodDark = pbr("#633f24", 0.86);

    // Open Bamboo Saung Gazebo
    const saung = new THREE.Group();
    saung.position.set(5.4, 0.44, -5.8);
    addBox(saung, 3.1, 0.22, 2.6, bamboo, 0, 0.72, 0);
    for (const sx of [-1.4, 1.4]) for (const sz of [-1.15, 1.15]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 2.85, 10), bamboo);
      p.position.set(sx, 1.42, sz);
      p.castShadow = true;
      saung.add(p);
    }
    const thatch = new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.45, 4), pbr("#b58c48", 0.92));
    thatch.position.set(0, 3.4, 0);
    thatch.rotation.y = Math.PI / 4;
    thatch.castShadow = true;
    saung.add(thatch);
    this.root.add(saung);

    // 3 Cozy Kampung Houses
    const houses: [number, number, string, number][] = [
      [-6.8, -16.2, "#f2e7d0", 3.6],
      [-0.2, -16.8, "#e8efe0", 4.0],
      [7.4,  -16.4, "#f5e3cc", 3.5],
    ];
    for (const [hx, hz, col, hw] of houses) {
      addBox(this.root, hw, 2.65, 3.2, pbr(col, 0.88), hx, 1.8, hz);
      const rf = new THREE.Mesh(new THREE.ConeGeometry(hw * 0.86, 1.85, 4), roofTile);
      rf.position.set(hx, 4.02, hz);
      rf.rotation.y = Math.PI / 4;
      rf.castShadow = true;
      this.root.add(rf);
      addBox(this.root, 0.78, 1.45, 0.1, woodDark, hx - 0.65, 1.25, hz + 1.62, 0, false);
      addBox(this.root, 0.88, 0.78, 0.1, winBlue, hx + 0.75, 1.95, hz + 1.62, 0, false);
    }

    // Lush Fluffy 3D Rounded Village Trees
    const trees: [number, number, number, string][] = [
      [-11.2, -19.5, 1.35, "#59a63c"], [-4.2, -20.8, 1.45, "#4d9434"],
      [2.8,   -20.5, 1.55, "#60ad42"], [9.8,  -20.2, 1.38, "#529b38"],
      [-8.5,  -22.5, 1.65, "#468a2e"], [5.5,  -23.0, 1.6,  "#55a13a"],
    ];
    for (const [tx, tz, sc, tint] of trees) {
      this.root.add(buildVillageTree(tx, 0.48, tz, sc, tint));
    }

    // Mini Indonesian Flag
    const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.048, 4.5, 8), bamboo);
    fp.position.set(3.6, 2.7, -14.8);
    this.root.add(fp);
    addBox(this.root, 0.9, 0.28, 0.03, pbr("#d92b2b", 0.7), 4.05, 4.75, -14.8, 0, false);
    addBox(this.root, 0.9, 0.28, 0.03, pbr("#faf8f5", 0.7), 4.05, 4.47, -14.8, 0, false);

    // 7 Curved Coconut Palms
    const palms: [number, number, number, number][] = [
      [-10.5, -14.5, -0.15, 1.05], [-3.8, -15.5, 0.12, 1.1], [3.2, -16.0, -0.1, 1.0],
      [10.8, -14.2, 0.16, 1.12], [-12.5, -6.5, -0.12, 0.95], [12.6, -5.5, 0.14, 1.0], [9.2, -19.5, -0.1, 1.15],
    ];
    for (const [px, pz, ln, sc] of palms) {
      this.root.add(buildCoconutPalm(px, 0.48, pz, ln, sc));
    }

    const poleMat = pbr("#544942", 0.9);
    for (const px of [-9.0, 0.8, 10.6]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.105, 6.2, 8), poleMat);
      pole.position.set(px, 3.5, -13.5);
      this.root.add(pole);
      addBox(this.root, 0.95, 0.08, 0.08, poleMat, px, 6.1, -13.5, 0, false);
    }
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 20.0, 6), poleMat);
    wire.rotation.z = Math.PI / 2;
    wire.position.set(0.8, 6.0, -13.5);
    this.root.add(wire);

    const mtn1 = new THREE.Mesh(new THREE.ConeGeometry(26, 18, 24), pbr("#7aa4b8", 0.96));
    mtn1.position.set(-16, 8.2, -56);
    this.root.add(mtn1);
    const mtn2 = new THREE.Mesh(new THREE.ConeGeometry(30, 22, 26), pbr("#6d97ad", 0.96));
    mtn2.position.set(14, 10.0, -62);
    this.root.add(mtn2);
  }

  private applyLight(kind: CafeLight, scene: THREE.Scene) {
    const p = CAFE_LIGHTS[kind];
    const dir = dirFromAngles(p.az, p.el);
    this.sun.position.set(dir.x * 42, dir.y * 42, dir.z * 42);
    this.sun.target.position.set(0, 0, 0);
    this.sun.target.updateMatrixWorld();

    if (kind === "golden") {
      this.sun.color.set("#ffbe78");
      this.sun.intensity = 2.8;
      this.hemi.color.set("#ffd1a3");
      this.hemi.groundColor.set("#6b5c42");
      this.hemi.intensity = 1.15;
      this.fog.color.set("#f0c69e");
      (this.skyMat.uniforms.c0.value as THREE.Color).set("#4f6ea8");
      (this.skyMat.uniforms.c1.value as THREE.Color).set("#9c8ab0");
      (this.skyMat.uniforms.c2.value as THREE.Color).set("#e0a684");
      (this.skyMat.uniforms.c3.value as THREE.Color).set("#f5c28e");
      (this.skyMat.uniforms.c4.value as THREE.Color).set("#fae0b8");
      this.skyMat.uniforms.sunDisc.value = 0.85;
    } else {
      this.sun.color.set("#fff6e3");
      this.sun.intensity = 2.5;
      this.hemi.color.set("#cbe3ff");
      this.hemi.groundColor.set("#7a8559");
      this.hemi.intensity = 1.35;
      this.fog.color.set("#d4e7f7");
      (this.skyMat.uniforms.c0.value as THREE.Color).set("#4f92db");
      (this.skyMat.uniforms.c1.value as THREE.Color).set("#80b8eb");
      (this.skyMat.uniforms.c2.value as THREE.Color).set("#b4d6f4");
      (this.skyMat.uniforms.c3.value as THREE.Color).set("#d9ebfa");
      (this.skyMat.uniforms.c4.value as THREE.Color).set("#eef5fc");
      this.skyMat.uniforms.sunDisc.value = 0.25;
    }
    this.fog.near = 36;
    this.fog.far = 195;
    scene.fog = this.fog;
    this.skyMat.uniforms.sunDir.value.copy(dir);
  }

  private updateRice(id: number, t: number) {
    let lScaleY = 0.54, rScaleY = 0.54;
    let lCol = "#6eb542", rCol = "#5fb53c";
    if (id >= 5 && id <= 8) {
      lScaleY = 0.72; rScaleY = 0.98;
      lCol = "#85a646"; rCol = "#4ca835";
    } else if (id === 9) {
      lScaleY = 0.8; rScaleY = 1.32;
      lCol = "#96a84c"; rCol = "#3fa632";
    } else if (id >= 10 && id <= 14) {
      lScaleY = 0.95; rScaleY = 1.4;
      lCol = "#75a846"; rCol = "#e3be3b";
    }
    this.leftRiceMat.color.set(lCol);
    this.rightRiceMat.color.set(rCol);

    for (let i = 0; i < this.leftCoords.length; i++) {
      const [x, z, ph] = this.leftCoords[i];
      this.dummy.position.set(x, 0.04, z);
      this.dummy.rotation.set(Math.sin(t * 2.0 + ph) * 0.06, ph, Math.cos(t * 1.7 + ph) * 0.05);
      this.dummy.scale.set(1.0, lScaleY * (0.88 + (i % 4) * 0.06), 1.0);
      this.dummy.updateMatrix();
      this.leftRiceMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.leftRiceMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.rightCoords.length; i++) {
      const [x, z, ph] = this.rightCoords[i];
      this.dummy.position.set(x, 0.04, z);
      this.dummy.rotation.set(Math.sin(t * 2.2 + ph) * 0.07, ph, Math.cos(t * 1.8 + ph) * 0.06);
      this.dummy.scale.set(1.06, rScaleY * (0.92 + (i % 4) * 0.05), 1.06);
      this.dummy.updateMatrix();
      this.rightRiceMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.rightRiceMesh.instanceMatrix.needsUpdate = true;
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3 {
    const t = f / FPS;
    const s = SHOTS[id - 1];
    const u = clamp01((f - s.a) / Math.max(1, s.b - s.a));
    const c = camAt(id, f);

    cam.position.set(...c.pos);
    cam.fov = c.fov;
    cam.updateProjectionMatrix();
    const look = V(...c.look);
    cam.lookAt(look);
    cam.rotateZ(c.roll);

    this.applyLight(s.light, scene);
    this.waterTex.offset.set(t * 0.015, t * 0.01);
    this.clouds.forEach((cl) => cl.lookAt(cam.position));
    this.updateRice(id, t);

    // Dynamic water draining in Shots 10-11 + Left Trench appearing in Shots 15-16!
    this.paddyWaterRight.position.y = (id === 10 || id === 11) ? (0.08 - 0.065 * (id === 10 ? u : 1)) : 0.08;
    this.leftTrenchWater.visible = id === 15 || id === 16;
    this.sluiceGate.visible = id === 3 || id === 10 || id === 11;
    this.sluicePanel.position.y = id === 10 ? 0.42 + u * 0.46 : (id === 11 ? 0.88 : 0.42);

    this.releaseBasket.visible = id === 1;
    this.scoopNet.visible = id === 11;
    this.scoopNet.position.y = 0.52 + Math.sin(t * 3.5) * 0.08;
    this.fishBucket.visible = id === 13 || id === 14;
    this.leftFishBucket.visible = id === 15;
    this.signGroup.visible = id === 12;
    this.weedPatchLeft.visible = id >= 4 && id <= 9;

    // Hero pest in Shot 6 (snapped up by leaping golden carp!)
    this.heroPest.visible = id === 6 && u < 0.56;
    this.heroPest.position.y = 0.56 + Math.sin(t * 9) * 0.025;

    // Oxygen bubbles in Shot 7
    for (let i = 0; i < this.bubbles.length; i++) {
      const b = this.bubbles[i];
      b.visible = id === 7;
      if (id === 7) {
        const cyc = (t * 0.85 + i * 0.17) % 1;
        b.position.set(2.4 + (i % 6) * 0.65, 0.1 + cyc * 0.55, 1.4 + Math.floor(i / 6) * 1.4);
      }
    }
    // Nutrient sparkles in Shot 8
    for (let i = 0; i < this.sparkles.length; i++) {
      const sp = this.sparkles[i];
      sp.visible = id === 8;
      if (id === 8) {
        const cyc = (t * 0.9 + i * 0.19) % 1;
        sp.position.set(2.4 + (i % 5) * 0.72, 0.25 + cyc * 1.4, 2.2 + Math.floor(i / 5) * 1.6);
        sp.rotation.y = t * 4.0 + i;
      }
    }

    // --- ANIMATE ALL 24 3D GOLDEN CARP & KOI FISH ---
    for (let i = 0; i < this.fish.length; i++) {
      const fi = this.fish[i];
      const showFish = id !== 12 && id !== 15;
      fi.group.visible = showFish;
      if (!showFish) continue;

      fi.tailPivot.rotation.y = Math.sin(t * 16.0 + fi.phase) * 0.45;
      fi.wake.scale.setScalar(0.85 + Math.sin(t * 5.0 + fi.phase) * 0.25);
      fi.group.rotation.x = 0;
      fi.wake.visible = true;

      if (id === 1) {
        // Golden carp tumbling & splashing out of bamboo basket into green flooded paddy!
        const delay = (i % 10) * 0.05;
        const k = clamp01((u - delay) / 0.6);
        const tx = 1.45 + (i % 6) * 0.78;
        const tz = 6.5 - Math.floor(i / 6) * 1.05 - k * 2.0;
        const arc = Math.sin(k * Math.PI) * 0.58 * (k < 0.55 ? 1 : 0);
        fi.group.position.set(1.05 + (tx - 1.05) * k, 0.14 + arc, 6.75 + (tz - 6.75) * k);
        fi.group.rotation.y = Math.atan2(tx - 1.05, tz - 6.75);
        fi.group.rotation.x = k < 0.55 ? -0.45 + k * 1.4 : 0;
      } else if (id === 6 && i === 0) {
        // HERO GOLDEN CARP leaping out of water to snap brown planthopper cleanly in open view!
        const leap = u > 0.28 && u < 0.78 ? Math.sin(((u - 0.28) / 0.50) * Math.PI) : 0;
        fi.group.position.set(3.18 - leap * 0.2, 0.14 + leap * 0.52, 4.2);
        fi.group.rotation.y = -Math.PI * 0.5;
        fi.group.rotation.x = -leap * 0.7;
      } else if (id === 10 || id === 11) {
        // Water drains -> ALL 24 carp gather densely & splash happily inside the deep perimeter trench (x = 0.95..1.85)!
        const tx = 0.98 + (i % 3) * 0.38;
        const fx = id === 10 ? fi.laneX + (tx - fi.laneX) * u : tx;
        const fz = 3.2 + ((i * 0.42 + t * 0.9) % 4.6) - 1.2;
        const splash = (id === 11 && i === 0) ? Math.abs(Math.sin(t * 5.0)) * 0.34 : 0;
        fi.group.position.set(fx, 0.14 + splash, fz);
        fi.group.rotation.y = id === 10 ? -Math.PI * 0.5 : Math.sin(t * 2 + fi.phase) * 0.4;
      } else if (id === 13 || id === 14) {
        // Gleaming fish swimming peacefully in the deep perimeter trench right beside the bund!
        const fz = -2.5 + ((i * 0.85 + t * 0.8) % 9.5);
        fi.group.position.set(1.05 + (i % 3) * 0.34, 0.14, fz);
        fi.group.rotation.y = 0;
      } else if (id === 16) {
        // COMEDIC LOOP PAYOFF: Golden carp swimming & splashing across PAK DARTO'S LEFT FIELD + trench!
        const lx = -1.25 - (i % 5) * 1.05 - Math.sin(t * 1.4 + fi.phase) * 0.35;
        const lz = 6.2 - Math.floor(i / 5) * 1.8 - u * 2.1;
        fi.group.position.set(lx, 0.14, lz);
        fi.group.rotation.y = Math.PI + Math.sin(t * 3 + fi.phase) * 0.3;
      } else {
        // Shots 2-9: Carp darting gracefully along Right Field rows & deep perimeter trench!
        const swimZ = fi.baseZ + Math.sin(t * fi.speed + fi.phase) * 2.5;
        const dirZ = Math.cos(t * fi.speed + fi.phase) >= 0 ? 0 : Math.PI;
        fi.group.position.set(fi.laneX + Math.sin(t * 1.8 + fi.phase) * 0.16, 0.14, swimZ);
        fi.group.rotation.y = dirZ + Math.sin(t * 4 + fi.phase) * 0.15;
      }
      // Hide water surface wake ring whenever a fish leaps into the air!
      fi.wake.visible = fi.group.position.y < 0.19;
    }

    // --- FULL 3D RIGGED CHARACTER CHOREOGRAPHY ---
    this.budi.root.visible = false;
    this.darto.root.visible = false;

    switch (id) {
      case 1:
        this.budi.setState(true, 0.25, 0.44, 7.1, 0.85, "smile", "stand", t, 0.2);
        return V(2.0, 0.45, 5.8);
      case 2:
        this.darto.setState(true, -0.52, 0.44, 6.8, 0.55, "panic", "point_shock", t, 0.22);
        this.budi.setState(true, 0.54, 0.44, 6.8, -0.45, "calm", "stand", t, -0.2);
        return V(0.0, 1.32, 6.8);
      case 3:
        this.budi.setState(true, 0.25, 0.44, 4.6, 0.75, "smile", "stand", t, 0.15);
        this.darto.setState(true, -3.2, 0.08, 4.2, Math.PI * 0.82, "sweat", "spray", t, 0);
        return V(1.6, 0.7, 2.0);
      case 4: {
        const dz = 5.4 - u * 4.0;
        this.darto.setState(true, -4.1, 0.08, dz, 0.45, "sweat", "spray", t, -0.15);
        return V(-4.1, 1.1, dz);
      }
      case 5:
        this.budi.setState(true, 5.4, 1.24, -5.6, -0.25, "smile", "sip_tea", t, 0);
        return V(4.2, 0.3, 2.5);
      case 6:
        return V(3.55, 0.42, 4.1);
      case 7:
        return V(4.4, 0.35, 2.0);
      case 8:
        return V(3.4, 1.0, 2.5);
      case 9:
        this.darto.setState(true, -3.4, 0.08, 2.8, Math.PI * 0.78, "sweat", "spray", t, 0);
        this.budi.setState(true, 5.4, 1.24, -5.6, -0.2, "smile", "sip_tea", t, 0);
        return V(0.0, 1.0, 1.0);
      case 10:
        this.budi.setState(true, 0.22, 0.44, 6.2, 0.85, "smile", "whistle", t, 0.15);
        return V(1.2, 0.75, 5.6);
      case 11:
        this.budi.setState(true, 0.22, 0.44, 5.2, 0.85, "laugh", "stand", t, 0.15);
        return V(1.35, 0.4, 4.8);
      case 12:
        this.budi.setState(true, 0.25, 0.44, 4.5, 0.45, "smug", "point_shock", t, 0.1);
        return V(2.6, 2.2, 4.2);
      case 13:
        this.budi.setState(true, 0.34, 0.44, 6.45, 0.15, "laugh", "laugh_wave", t, 0);
        return V(0.45, 1.25, 6.45);
      case 14:
        this.darto.setState(true, -0.55, 0.44, 6.8, 0.5, "shock", "point_shock", t, 0.15);
        this.budi.setState(true, 0.52, 0.44, 5.6, -0.4, "laugh", "laugh_wave", t, -0.15);
        return V(-0.55, 1.28, 6.8);
      case 15:
        return V(-1.4, 0.55, 5.8);
      default: {
        const dx = -2.2 - u * 1.4;
        const dz = 5.6 - u * 2.1;
        this.darto.setState(true, dx, 0.08, dz, 0.28, "excited", "chase_ducks", t, -0.1);
        this.budi.setState(true, 0.05, 0.44, 4.4, -0.35, "laugh", "laugh_wave", t, -0.15);
        return V(dx * 0.65, 1.15, dz);
      }
    }
  }
}
