import * as THREE from "three";
import { grass, bed, cloudHD, roof, planks } from "../bridge/paint";
import { CAFE_LIGHTS, CafeLight, dirFromAngles } from "../cafe/cafeLights";
import { SHOTS, FPS, camAt, clamp01 } from "./story";
import { makeDiegeticBoardTex } from "./padiToon";
import { DioramaCharacter } from "./dioramaRig";
import type { BoardConfig } from "../../types/studioProps";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// Soft Blender-Diorama PBR Material helper (NO harsh cel-shading or black ink outlines!)
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
    const w0 = 0.052;
    const w1 = 0.032;
    const r0 = 0.032;

    const bL: [number, number, number] = [ca * r0 - tx * w0, 0, sa * r0 - tz * w0];
    const bR: [number, number, number] = [ca * r0 + tx * w0, 0, sa * r0 + tz * w0];
    const mL: [number, number, number] = [ca * (r0 + lean * 0.45) - tx * w1, h * 0.56, sa * (r0 + lean * 0.45) - tz * w1];
    const mR: [number, number, number] = [ca * (r0 + lean * 0.45) + tx * w1, h * 0.56, sa * (r0 + lean * 0.45) + tz * w1];
    const tip: [number, number, number] = [ca * (r0 + lean * 1.18), h * 0.94, sa * (r0 + lean * 1.18)];

    addTri(bL, bR, mR);
    addTri(bL, mR, mL);
    addTri(mL, mR, tip);
    addTri(bR, bL, mR);
    addTri(mR, bL, mL);
    addTri(mR, mL, tip);
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

type DuckSlot = {
  group: THREE.Group;
  headGroup: THREE.Group;
  wingL: THREE.Mesh;
  wingR: THREE.Mesh;
  wake: THREE.Mesh;
  laneX: number;
  baseZ: number;
  speed: number;
  phase: number;
};

const buildSoftDuck = (bodyHex: string): { group: THREE.Group; headGroup: THREE.Group; wingL: THREE.Mesh; wingR: THREE.Mesh; wake: THREE.Mesh } => {
  const g = new THREE.Group();
  const bodyMat = pbr(bodyHex, 0.62, 0.02);
  const billMat = pbr("#f58620", 0.48, 0.04);
  const eyeMat = pbr("#1a141c", 0.18, 0.15);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), bodyMat);
  body.scale.set(1.0, 0.82, 1.36);
  body.position.set(0, 0.2, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 12), bodyMat);
  tail.position.set(0, 0.3, -0.3);
  tail.rotation.x = -0.65;
  tail.castShadow = true;
  g.add(tail);

  const wingGeo = new THREE.SphereGeometry(0.16, 12, 10);
  wingGeo.scale(0.35, 0.65, 1.15);
  const wingL = new THREE.Mesh(wingGeo, bodyMat);
  wingL.position.set(-0.22, 0.23, 0.02);
  wingL.castShadow = true;
  g.add(wingL);
  const wingR = new THREE.Mesh(wingGeo, bodyMat);
  wingR.position.set(0.22, 0.23, 0.02);
  wingR.castShadow = true;
  g.add(wingR);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.28, 0.22);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 0.24, 14), bodyMat);
  neck.position.set(0, 0.1, 0.02);
  neck.castShadow = true;
  headGroup.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.148, 16, 14), bodyMat);
  head.position.set(0, 0.25, 0.05);
  head.castShadow = true;
  headGroup.add(head);
  const bill = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.09, 6, 10), billMat);
  bill.rotation.x = Math.PI / 2;
  bill.scale.set(1.45, 1.0, 0.75);
  bill.position.set(0, 0.22, 0.2);
  headGroup.add(bill);
  for (const sx of [-0.098, 0.098]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), eyeMat);
    eye.position.set(sx, 0.28, 0.14);
    headGroup.add(eye);
  }
  g.add(headGroup);

  const wakeGeo = new THREE.RingGeometry(0.24, 0.37, 24);
  wakeGeo.rotateX(-Math.PI / 2);
  const wake = new THREE.Mesh(
    wakeGeo,
    new THREE.MeshBasicMaterial({ color: "#eef8ff", transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
  );
  wake.position.y = 0.025;
  g.add(wake);

  return { group: g, headGroup, wingL, wingR, wake };
};

// Soft lush 3D rounded tropical village tree (exact @JadiBeginiClip clustered soft green canopy!)
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
    [0, 3.0, 0, 1.55, false],
    [-1.05, 2.55, 0.45, 1.15, true],
    [1.05, 2.65, -0.35, 1.2, false],
    [0.25, 3.75, 0.35, 1.12, true],
    [-0.5, 2.45, -0.85, 1.05, false],
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
    // Soft arched 2-segment tropical palm frond
    const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 1.35), frondMat);
    f1.position.set(0, 0.22, 0.62);
    f1.rotation.x = -0.22;
    fg.add(f1);
    const f2 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 1.3), frondMat);
    f2.position.set(0, 0.04, 1.72);
    f2.rotation.x = 0.42;
    fg.add(f2);
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
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 c0, c1, c2, c3, c4, sunDir;
      uniform float sunDisc;
      varying vec3 vPos;
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

export class PadiBebekWorld {
  root = new THREE.Group();
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#d4e7f7", 34, 195);
  private waterTex: THREE.Texture;
  private clouds: THREE.Mesh[] = [];

  private leftRiceMesh: THREE.InstancedMesh;
  private rightRiceMesh: THREE.InstancedMesh;
  private leftRiceMat: THREE.MeshStandardMaterial;
  private rightRiceMat: THREE.MeshStandardMaterial;
  private leftCoords: [number, number, number][] = [];
  private rightCoords: [number, number, number][] = [];
  private dummy = new THREE.Object3D();

  private ducks: DuckSlot[] = [];
  private heroSnail: THREE.Group;
  private sparkles: THREE.Mesh[] = [];
  private crateGroup: THREE.Group;
  private sprayerTank: THREE.Group;
  private eggBasket: THREE.Group;
  private signGroup: THREE.Group;
  private boardMat: THREE.MeshBasicMaterial;
  private weedPatchLeft: THREE.Group;

  // FULL 3D RIGGED CHARACTERS (NO 2D flat cards!)
  private budi: DioramaCharacter;
  private darto: DioramaCharacter;

  constructor(board?: Partial<BoardConfig>, lite = false) {
    // 1. Warm Soft Blender-Style Daylight Rig!
    this.hemi = new THREE.HemisphereLight("#cbe3ff", "#7a8559", 1.35);
    this.root.add(this.hemi);

    this.sun = new THREE.DirectionalLight("#fff3dc", 2.55);
    this.sun.castShadow = !lite;
    this.sun.shadow.mapSize.set(lite ? 512 : 2048, lite ? 512 : 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 140;
    const d = 28;
    this.sun.shadow.camera.left = -d;
    this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d;
    this.sun.shadow.camera.bottom = -d;
    this.sun.shadow.bias = -0.0002;
    this.sun.shadow.normalBias = 0.045; // Eliminates 100% of curved-surface shadow acne!
    this.sun.shadow.radius = 3.5; // Soft painterly shadow edges!
    this.root.add(this.sun);
    this.root.add(this.sun.target);

    this.fill = new THREE.DirectionalLight("#c2dcfa", 0.55);
    this.fill.position.set(-16, 14, 16);
    this.root.add(this.fill);

    // 2. Soft Sky Dome & Fluffy Painted Clouds
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

    // 3. Natural Indonesian Muddy Paddy + Soft Sky-Reflective Shallow Water (EXACT @JadiBeginiClip Palette!)
    const bedTex = bed().clone();
    bedTex.repeat.set(9, 9);
    bedTex.needsUpdate = true;
    const mudFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      pbr("#826946", 0.94, 0.0, { map: bedTex }),
    );
    mudFloor.rotation.x = -Math.PI / 2;
    mudFloor.position.y = -0.02;
    mudFloor.receiveShadow = true;
    this.root.add(mudFloor);

    // Custom soft sunlit natural paddy water texture (silvery sky reflection over warm mud, NOT royal blue!)
    const wCanvas = document.createElement("canvas");
    wCanvas.width = 256;
    wCanvas.height = 256;
    const wCtx = wCanvas.getContext("2d")!;
    wCtx.fillStyle = "#8aa5a3";
    wCtx.fillRect(0, 0, 256, 256);
    wCtx.fillStyle = "rgba(255,255,255,0.22)";
    for (let i = 0; i < 42; i++) {
      const rx = (i * 59) % 256;
      const ry = (i * 37) % 256;
      wCtx.fillRect(rx, ry, 28 + (i % 24), 3);
    }
    this.waterTex = new THREE.CanvasTexture(wCanvas);
    this.waterTex.colorSpace = THREE.SRGBColorSpace;
    this.waterTex.wrapS = this.waterTex.wrapT = THREE.RepeatWrapping;
    this.waterTex.repeat.set(10, 10);

    const paddyWater = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 26),
      new THREE.MeshStandardMaterial({
        map: this.waterTex,
        color: "#a8c0c4",
        roughness: 0.14,
        metalness: 0.22,
        transparent: true,
        opacity: 0.56,
      }),
    );
    paddyWater.rotation.x = -Math.PI / 2;
    paddyWater.position.set(0, 0.08, 1.0);
    paddyWater.receiveShadow = true;
    this.root.add(paddyWater);

    // Soft Sunlit Grass Bund (Pematang Sawah) — organic warm lime-green without black outlines!
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

    // 4. 320 Swaying Multi-Blade 3D Rice Clumps (Soft PBR!)
    const riceGeo = buildRiceClumpGeo(8, 0.28, 0.96);
    this.leftRiceMat = pbr("#6db33f", 0.72, 0.02);
    this.rightRiceMat = pbr("#58ab38", 0.72, 0.02);

    for (let ix = 0; ix < 10; ix++) {
      for (let iz = 0; iz < 16; iz++) {
        const jx = (((ix * 37 + iz * 17) % 10) - 5) * 0.03;
        const jz = (((ix * 13 + iz * 29) % 10) - 5) * 0.03;
        this.leftCoords.push([-1.5 - ix * 0.96 + jx, -9.8 + iz * 1.38 + jz, (ix + iz) * 0.45]);
        this.rightCoords.push([1.5 + ix * 0.96 + jx, -9.8 + iz * 1.38 + jz, (ix + iz) * 0.45]);
      }
    }
    this.leftRiceMesh = new THREE.InstancedMesh(riceGeo, this.leftRiceMat, this.leftCoords.length);
    this.rightRiceMesh = new THREE.InstancedMesh(riceGeo, this.rightRiceMat, this.rightCoords.length);
    this.leftRiceMesh.castShadow = true;
    this.rightRiceMesh.castShadow = true;
    this.leftRiceMesh.receiveShadow = true;
    this.rightRiceMesh.receiveShadow = true;
    this.root.add(this.leftRiceMesh);
    this.root.add(this.rightRiceMesh);

    // Wild weed tufts in Pak Darto's Left Field
    this.weedPatchLeft = new THREE.Group();
    const weedGeo = buildRiceClumpGeo(6, 0.36, 0.48);
    const weedMat = pbr("#66732d", 0.85);
    for (let i = 0; i < 18; i++) {
      const w = new THREE.Mesh(weedGeo, weedMat);
      w.position.set(-2.05 - (i % 5) * 1.42, 0.04, -4.5 + Math.floor(i / 5) * 3.15);
      w.rotation.y = i * 1.1;
      w.scale.set(1.15, 0.95, 1.15);
      this.weedPatchLeft.add(w);
    }
    this.root.add(this.weedPatchLeft);

    // 5. 18 Soft 3D Swimming Cartoon Ducks!
    const duckColors = ["#fff7e2", "#f5e1ab", "#ebd094", "#fff4d6"];
    for (let i = 0; i < 18; i++) {
      const dObj = buildSoftDuck(duckColors[i % duckColors.length]);
      this.root.add(dObj.group);
      this.ducks.push({
        ...dObj,
        laneX: 1.9 + (i % 6) * 1.35,
        baseZ: -5.5 + Math.floor(i / 6) * 4.4,
        speed: 0.55 + (i % 4) * 0.14,
        phase: i * 0.72,
      });
    }

    // 6. Hero 3D Golden Apple Snail (Keong Mas)
    this.heroSnail = new THREE.Group();
    this.heroSnail.position.set(3.45, 0.24, 4.1);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 14), pbr("#e69b2e", 0.42, 0.06));
    shell.scale.set(1.15, 1.0, 0.9);
    shell.castShadow = true;
    this.heroSnail.add(shell);
    const swirl = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 10, 16), pbr("#8f4d18", 0.55));
    swirl.position.set(0.08, 0.02, 0.1);
    this.heroSnail.add(swirl);
    this.root.add(this.heroSnail);

    // Nutrient sparkles rising around thriving roots (Shot 8!)
    const spMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.9, 1.0) });
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), spMat);
      this.root.add(sp);
      this.sparkles.push(sp);
    }

    // 7. Rich Soft PBR Indonesian Village (Fluffy 3D Trees, Bamboo Saung, Kampung Houses, Coconut Palms!)
    this.buildIndonesianVillage();

    // 8. Interactive 3D Props
    const plankMat = pbr("#c78f52", 0.82, 0.0, { map: planks() });
    this.crateGroup = new THREE.Group();
    this.crateGroup.position.set(1.1, 0.44, 6.9);
    addBox(this.crateGroup, 1.15, 0.72, 0.92, plankMat, 0, 0.36, 0);
    addBox(this.crateGroup, 1.2, 0.08, 0.95, pbr("#8f5d30", 0.85), -0.35, 0.88, 0, 0, false).rotation.z = 0.65;
    this.root.add(this.crateGroup);

    // Abandoned Green Pesticide Sprayer Tank on bund (Shot 15!)
    this.sprayerTank = new THREE.Group();
    this.sprayerTank.position.set(-0.15, 0.44, 7.0);
    const tankBody = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.74, 18), pbr("#2d9c4f", 0.44, 0.08));
    tankBody.position.y = 0.37;
    tankBody.castShadow = true;
    this.sprayerTank.add(tankBody);
    addBox(this.sprayerTank, 0.2, 0.13, 0.2, pbr("#e6c03c", 0.48), 0, 0.8, 0);
    const wand = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.05, 10), pbr("#555d66", 0.35, 0.6));
    wand.position.set(0.32, 0.45, 0.1);
    wand.rotation.z = -0.55;
    this.sprayerTank.add(wand);
    this.root.add(this.sprayerTank);

    // Woven Basket brimming with Blue-White Duck Eggs (Shot 13!)
    this.eggBasket = new THREE.Group();
    this.eggBasket.position.set(-0.34, 0.44, 6.75);
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.27, 0.36, 18), pbr("#bd833e", 0.86));
    basket.position.y = 0.18;
    basket.castShadow = true;
    this.eggBasket.add(basket);
    const eggMat = pbr("#dff5f0", 0.36, 0.04);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const egg = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), eggMat);
      egg.scale.set(1, 1.3, 1);
      egg.position.set(Math.cos(a) * 0.14, 0.37, Math.sin(a) * 0.14);
      egg.castShadow = true;
      this.eggBasket.add(egg);
    }
    this.root.add(this.eggBasket);

    // ONE Diegetic Wooden Signboard planted cleanly in the paddy (Shot 12 ONLY!)
    this.signGroup = new THREE.Group();
    this.signGroup.position.set(2.6, 0.08, 4.2);
    const postWood = pbr("#6e4223", 0.88);
    addBox(this.signGroup, 0.14, 1.55, 0.14, postWood, -1.05, 0.78, -0.14);
    addBox(this.signGroup, 0.14, 1.55, 0.14, postWood, 1.05, 0.78, -0.14);
    addBox(this.signGroup, 3.16, 2.08, 0.1, postWood, 0, 2.22, -0.06);
    this.boardMat = new THREE.MeshBasicMaterial({ map: makeDiegeticBoardTex(board), side: THREE.DoubleSide });
    const boardPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(3.08, 2.0),
      this.boardMat,
    );
    boardPlane.position.set(0, 2.22, 0.02);
    this.signGroup.add(boardPlane);
    this.root.add(this.signGroup);

    // 9. FULL 3D RIGGED ACTORS (Pak Budi & Pak Darto!)
    this.budi = new DioramaCharacter("budi");
    this.darto = new DioramaCharacter("darto");
    this.root.add(this.budi.root, this.darto.root);
  }

  setBoard(board?: Partial<BoardConfig>) {
    const prev = this.boardMat.map;
    this.boardMat.map = makeDiegeticBoardTex(board);
    this.boardMat.needsUpdate = true;
    if (prev) prev.dispose();
  }

  dispose() {
    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        if (std.map) std.map.dispose();
        if (std.bumpMap) std.bumpMap.dispose();
        m.dispose();
      }
    });
  }

  private buildIndonesianVillage() {
    const roofTile = pbr("#c95a38", 0.78, 0.02, { map: roof("#c44e32") });
    const bamboo = pbr("#c7a258", 0.85);
    const winBlue = pbr("#5f93c2", 0.35, 0.12);
    const woodDark = pbr("#633f24", 0.86);

    // Open Bamboo Saung Gazebo at (5.4, 0.44, -5.8)
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

    // 3 Cozy Kampung Houses across the village horizon (z = -16.5)
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

    // Lush Fluffy 3D Rounded Village Trees behind the kampung houses (EXACT @JadiBeginiClip backdrop!)
    const trees: [number, number, number, string][] = [
      [-11.2, -19.5, 1.35, "#59a63c"],
      [-4.2,  -20.8, 1.45, "#4d9434"],
      [2.8,   -20.5, 1.55, "#60ad42"],
      [9.8,   -20.2, 1.38, "#529b38"],
      [-8.5,  -22.5, 1.65, "#468a2e"],
      [5.5,   -23.0, 1.6,  "#55a13a"],
    ];
    for (const [tx, tz, sc, tint] of trees) {
      this.root.add(buildVillageTree(tx, 0.48, tz, sc, tint));
    }

    // Mini Indonesian Flag waving gently near village houses
    const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.048, 4.5, 8), bamboo);
    fp.position.set(3.6, 2.7, -14.8);
    this.root.add(fp);
    addBox(this.root, 0.9, 0.28, 0.03, pbr("#d92b2b", 0.7), 4.05, 4.75, -14.8, 0, false);
    addBox(this.root, 0.9, 0.28, 0.03, pbr("#faf8f5", 0.7), 4.05, 4.47, -14.8, 0, false);

    // 7 Curved Coconut Palm Trees framing the lush kampung skyline
    const palms: [number, number, number, number][] = [
      [-10.5, -14.5, -0.15, 1.05], [-3.8, -15.5, 0.12, 1.1], [3.2, -16.0, -0.1, 1.0],
      [10.8, -14.2, 0.16, 1.12], [-12.5, -6.5, -0.12, 0.95], [12.6, -5.5, 0.14, 1.0], [9.2, -19.5, -0.1, 1.15],
    ];
    for (const [px, pz, ln, sc] of palms) {
      this.root.add(buildCoconutPalm(px, 0.48, pz, ln, sc));
    }

    // Wooden Utility Poles + Overhead Power Line
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

    // Soft Misty Blue-Green Distant Tropical Mountains
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
      lScaleY = 0.72; rScaleY = 0.96;
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
    this.waterTex.offset.set(t * 0.012, t * 0.009);
    this.clouds.forEach((cl) => cl.lookAt(cam.position));

    this.updateRice(id, t);

    this.crateGroup.visible = id === 1;
    this.crateGroup.position.set(1.1, 0.44, 6.9);
    this.sprayerTank.visible = id === 15;
    this.eggBasket.visible = id === 13 || id === 14;
    this.signGroup.visible = id === 12;
    this.weedPatchLeft.visible = id >= 4 && id <= 9;

    for (let i = 0; i < this.sparkles.length; i++) {
      const sp = this.sparkles[i];
      sp.visible = id === 8;
      if (id === 8) {
        const cyc = (t * 0.9 + i * 0.19) % 1;
        sp.position.set(2.2 + (i % 5) * 0.72, 0.25 + cyc * 1.4, 2.2 + Math.floor(i / 5) * 1.6);
        sp.rotation.y = t * 4.0 + i;
      }
    }

    this.heroSnail.visible = id === 6 && u < 0.62;

    // --- ANIMATE ALL 18 SOFT 3D DUCKS ---
    for (let i = 0; i < this.ducks.length; i++) {
      const d = this.ducks[i];
      const showDucks = id !== 12 && id !== 15;
      d.group.visible = showDucks;
      if (!showDucks) continue;

      const flap = Math.sin(t * 14.0 + d.phase) * 0.28;
      d.wingL.rotation.z = flap;
      d.wingR.rotation.z = -flap;
      const wk = 0.85 + Math.sin(t * 5.0 + d.phase) * 0.25;
      d.wake.scale.setScalar(wk);
      d.headGroup.rotation.x = Math.sin(t * 4.0 + d.phase) * 0.14;

      if (id === 1) {
        const delay = (i % 8) * 0.06;
        const k = clamp01((u - delay) / 0.65);
        const tx = 1.6 + (i % 5) * 0.95;
        const tz = 6.6 - Math.floor(i / 5) * 1.15 - k * 2.2;
        const hop = Math.sin(k * Math.PI) * 0.45 * (k < 0.5 ? 1 : 0);
        d.group.position.set(1.1 + (tx - 1.1) * k, 0.08 + hop, 6.9 + (tz - 6.9) * k);
        d.group.rotation.y = Math.atan2(tx - 1.1, tz - 6.9);
      } else if (id === 6 && i === 0) {
        d.group.position.set(3.85, 0.08, 4.1);
        d.group.rotation.y = -Math.PI * 0.5;
        const peck = u > 0.35 && u < 0.72 ? Math.sin(((u - 0.35) / 0.37) * Math.PI) : 0;
        d.headGroup.rotation.x = peck * 1.05;
      } else if (id === 10 || id === 11) {
        if (id === 11 && i === 0) {
          d.group.position.set(2.55, 0.08, 4.4);
          d.group.rotation.y = -0.35;
          d.headGroup.rotation.x = -0.25 + Math.sin(t * 6) * 0.12;
        } else {
          const mx = d.laneX - u * (d.laneX - 0.45);
          d.group.position.set(Math.max(0.2, mx), mx < 0.9 ? 0.44 : 0.08, d.baseZ + 2.5);
          d.group.rotation.y = -Math.PI / 2;
        }
      } else if (id === 13 || id === 14) {
        d.group.position.set(-0.42 + (i % 3) * 0.42, 0.44, -1.8 + Math.floor(i / 3) * 1.15);
        d.group.rotation.y = 0.2 + Math.sin(t + d.phase) * 0.28;
        d.wake.visible = false;
      } else if (id === 16) {
        const lx = -1.6 - (i % 5) * 1.15 - Math.sin(t * 1.5 + d.phase) * 0.4;
        const lz = 6.2 - Math.floor(i / 5) * 1.9 - u * 2.4;
        d.group.position.set(lx, 0.08, lz);
        d.group.rotation.y = Math.PI + Math.sin(t * 3 + d.phase) * 0.3;
        d.wake.visible = true;
      } else {
        const swimZ = d.baseZ + Math.sin(t * d.speed + d.phase) * 2.6;
        const dirZ = Math.cos(t * d.speed + d.phase) >= 0 ? 0 : Math.PI;
        d.group.position.set(d.laneX, 0.08, swimZ);
        d.group.rotation.y = dirZ;
        d.wake.visible = true;
        if ((i + Math.floor(t * 1.4)) % 3 === 0) {
          d.headGroup.rotation.x = 0.65;
        }
      }
    }

    // --- FULL 3D RIGGED CHARACTER CHOREOGRAPHY (Natural 3D facing, turning & leaning!) ---
    this.budi.root.visible = false;
    this.darto.root.visible = false;

    switch (id) {
      case 1:
        this.budi.setState(true, 0.25, 0.44, 7.2, 0.85, "smile", "stand", t, 0.2);
        return V(2.2, 0.5, 5.8);
      case 2:
        // Pak Darto angled toward Pak Budi pointing excitedly while Pak Budi smiles calmly back!
        this.darto.setState(true, -0.52, 0.44, 6.8, 0.55, "panic", "point_shock", t, 0.22);
        this.budi.setState(true, 0.54, 0.44, 6.8, -0.45, "calm", "stand", t, -0.2);
        return V(0.0, 1.35, 6.8);
      case 3:
        // High 45° scenic two-field establishing shot (just like @JadiBeginiClip!):
        // Pak Darto bent forward spraying in Left Field (seen in 3D!) while Pak Budi sips tea in bamboo saung!
        this.budi.setState(true, 5.4, 1.24, -5.6, -0.35, "smile", "sip_tea", t, 0, 0.96);
        this.darto.setState(true, -2.5, 0.08, 4.2, Math.PI * 0.82, "sweat", "spray", t, 0);
        return V(0.4, 1.2, 1.5);
      case 4: {
        const dz = 5.4 - u * 4.0;
        // Seen from a dynamic 3/4 front-side 3D angle walking forward through the mud spraying pesticide!
        this.darto.setState(true, -4.1, 0.08, dz, 0.45, "sweat", "spray", t, -0.15);
        return V(-4.1, 1.1, dz);
      }
      case 5:
        this.budi.setState(true, 5.4, 1.24, -5.6, -0.25, "smile", "sip_tea", t, 0);
        return V(4.2, 0.5, 2.5);
      case 6:
        return V(3.6, 0.35, 4.1);
      case 7:
        return V(4.5, 0.4, 2.0);
      case 8:
        return V(3.4, 1.0, 2.5);
      case 9:
        this.darto.setState(true, -3.4, 0.08, 2.8, Math.PI * 0.78, "sweat", "spray", t, 0);
        this.budi.setState(true, 5.4, 1.24, -5.6, -0.2, "smile", "sip_tea", t, 0);
        return V(0.0, 1.0, 1.0);
      case 10:
        this.budi.setState(true, 0.2, 0.44, 5.6, 0.65, "smile", "whistle", t, 0.15);
        return V(0.6, 1.1, 5.6);
      case 11:
        this.budi.setState(true, 1.45, 0.44, 4.7, 0.75, "laugh", "whistle", t, 0.15);
        return V(2.5, 0.65, 4.4);
      case 12:
        this.budi.setState(true, 0.25, 0.44, 4.5, 0.45, "smug", "point_shock", t, 0.1);
        return V(2.6, 2.2, 4.2);
      case 13:
        this.budi.setState(true, 0.34, 0.44, 6.45, 0.15, "laugh", "hold_eggs", t, 0);
        return V(0.45, 1.25, 6.45);
      case 14:
        this.darto.setState(true, -0.55, 0.44, 6.8, 0.5, "shock", "point_shock", t, 0.15);
        this.budi.setState(true, 0.52, 0.44, 5.6, -0.4, "laugh", "hold_eggs", t, -0.15);
        return V(-0.55, 1.28, 6.8);
      case 15:
        return V(-0.15, 0.85, 7.0);
      default: {
        // Shot 16 Comedic Loop Payoff: Pak Darto joyfully chasing his own ducks in 3D while Pak Budi laughs on the bund!
        const dx = -2.2 - u * 1.5;
        const dz = 5.6 - u * 2.2;
        this.darto.setState(true, dx, 0.08, dz, 0.28, "excited", "chase_ducks", t, -0.1);
        this.budi.setState(true, 0.05, 0.44, 4.4, -0.35, "laugh", "laugh_wave", t, -0.15);
        return V(dx * 0.65, 1.15, dz);
      }
    }
  }
}
