import * as THREE from "three";
import { NOINK } from "../bridge/ink";
import { TONE, twoTone, untone } from "../bridge/shade";
import { planksHD, water, cloudHD, stone, roof } from "../bridge/paint";
import { CAFE_LIGHTS, CafeLight, dirFromAngles } from "../cafe/cafeLights";
import { SHOTS, FPS, camAt, clamp01, smooth, glide } from "./story";
import {
  drawRunCharacter, Role, Mood, Pose,
  makeHookSwapCardTex, makeScaleBadgeTex, makeGoldCompareTex,
  makeNewAmsterdamSignTex, makeTreatyCardTex, makePriceCrashCardTex,
} from "./runToon";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const makeMat = (color: string, extra: THREE.MeshLambertMaterialParameters = {}) =>
  twoTone(new THREE.MeshLambertMaterial({ color, ...extra }));

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

type ActorSlot = {
  role: Role;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  mesh: THREE.Mesh;
  shadow: THREE.Mesh;
  lastKey: string;
};

const makeActor = (role: Role, heightM = 1.8): ActorSlot => {
  const canvas = document.createElement("canvas");
  canvas.width = 620;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const wM = heightM * 0.62;
  const geo = new THREE.PlaneGeometry(wM, heightM);
  geo.translate(0, heightM * 0.5, 0);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.layers.set(NOINK);

  const shGeo = new THREE.CircleGeometry(0.44, 18);
  shGeo.rotateX(-Math.PI / 2);
  const shMat = new THREE.MeshBasicMaterial({ color: "#191526", transparent: true, opacity: 0.34, depthWrite: false });
  const shadow = new THREE.Mesh(shGeo, shMat);
  shadow.position.y = 0.02;
  shadow.layers.set(NOINK);

  return { role, canvas, ctx, tex, mesh, shadow, lastKey: "" };
};

const makeFloatingCard = (tex: THREE.CanvasTexture, w: number, h: number) => {
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.layers.set(NOINK);
  return mesh;
};

const buildNutmegTree = (x: number, y: number, z: number, scale = 1.0, isHero = false) => {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);

  const bark = makeMat("#7a4e32");
  const leaf1 = makeMat("#4ca83e");
  const leaf2 = makeMat("#3b8c32");
  const leaf3 = makeMat("#65bd4a");

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 2.3, 10), bark);
  trunk.position.y = 1.15;
  trunk.castShadow = true;
  g.add(trunk);

  const lobes: [number, number, number, number, THREE.Material][] = [
    [0, 2.95, 0, 1.38, leaf1],
    [-0.95, 2.45, 0.35, 0.96, leaf2],
    [0.95, 2.55, -0.2, 1.02, leaf3],
    [0.2, 2.35, 0.92, 0.92, leaf1],
    [-0.25, 3.65, -0.15, 0.95, leaf3],
  ];
  for (const [lx, ly, lz, r, mat] of lobes) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
    s.position.set(lx, ly, lz);
    s.castShadow = true;
    s.receiveShadow = true;
    g.add(s);
  }

  // Hanging warm spiced nutmeg fruits with vivid crimson mace bands!
  const nutMat = makeMat(isHero ? "#b56124" : "#c7742e");
  const maceMat = makeMat(isHero ? "#e02620" : "#cc3028");

  const nutPositions: [number, number, number][] = isHero
    ? [
        [0.0, 2.15, 1.18], [-0.72, 2.02, 0.92], [0.76, 2.05, 0.88],
        [-0.36, 2.58, 1.12], [0.44, 2.68, 1.05], [0.08, 1.82, 0.95],
        [-0.98, 2.42, 0.72], [0.95, 2.45, 0.65],
      ]
    : [
        [0.5, 2.1, 0.9], [-0.6, 2.2, 0.8], [0.1, 2.6, 1.0],
      ];

  for (const [nx, ny, nz] of nutPositions) {
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(isHero ? 0.21 : 0.14, 12, 10), nutMat);
    fruit.scale.set(1.0, 1.25, 1.0);
    fruit.position.set(nx, ny, nz);
    g.add(fruit);

    const mace = new THREE.Mesh(new THREE.TorusGeometry(isHero ? 0.17 : 0.11, 0.045, 8, 16), maceMat);
    mace.position.set(nx, ny, nz);
    mace.rotation.set(0.6, 0.4, 0);
    g.add(mace);
  }

  return g;
};

const buildGalleon = (flagColors: [string, string, string]) => {
  const g = new THREE.Group();
  const hullMat = makeMat("#7a4726");
  const deckMat = makeMat("#b57d47");
  const trimMat = makeMat("#e8b948");
  const mastMat = makeMat("#5c371f");
  const sailMat = makeMat("#fbf4e4");

  // Main wooden hull
  addBox(g, 5.4, 1.35, 2.15, hullMat, 0, 0.65, 0);
  // Bow & stern raised castles
  addBox(g, 1.45, 0.75, 2.0, hullMat, -2.15, 1.55, 0);
  addBox(g, 1.65, 1.15, 2.1, hullMat, 2.05, 1.75, 0);
  // Gold stern cabin trim & windows
  addBox(g, 1.7, 0.14, 2.18, trimMat, 2.05, 2.34, 0);
  addBox(g, 5.5, 0.14, 2.24, trimMat, 0, 1.3, 0);
  // Deck planks
  addBox(g, 5.1, 0.12, 1.95, deckMat, 0, 1.36, 0);
  // Bowsprit pointing forward (-x)
  const sprit = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 2.6, 8), mastMat);
  sprit.position.set(-3.4, 1.75, 0);
  sprit.rotation.z = Math.PI * 0.34;
  g.add(sprit);

  // Two masts + billowing sails
  for (const [mx, mh, sw, sh] of [[-0.5, 5.8, 2.5, 2.4], [1.4, 4.6, 1.85, 1.8]] as [number, number, number, number][]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, mh, 10), mastMat);
    mast.position.set(mx, 1.2 + mh * 0.5, 0);
    mast.castShadow = true;
    g.add(mast);

    // Horizontal yardarm
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, sw + 0.5, 8), mastMat);
    yard.rotation.x = Math.PI / 2;
    yard.position.set(mx, 1.4 + mh * 0.66, 0);
    g.add(yard);

    // Billowing sail (curved cylinder slice)
    const sailGeo = new THREE.BoxGeometry(0.14, sh, sw);
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(mx - 0.15, 1.4 + mh * 0.44, 0);
    sail.castShadow = true;
    g.add(sail);
  }

  // Tri-band national flag at main mast top
  const fy = 6.95;
  flagColors.forEach((col, i) => {
    addBox(g, 1.35, 0.24, 0.05, makeMat(col), 0.22, fy - i * 0.24, 0, 0, false);
  });

  return g;
};

const buildSkyDome = () => {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      c0: { value: new THREE.Color("#3e82d6") },
      c1: { value: new THREE.Color("#6aa2e6") },
      c2: { value: new THREE.Color("#98c0ef") },
      c3: { value: new THREE.Color("#bdd4f0") },
      c4: { value: new THREE.Color("#d4e3f6") },
      sunDir: { value: new THREE.Vector3(0.4, 0.5, 0.7).normalize() },
      sunDisc: { value: 0 },
      starInt: { value: 0 },
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
      uniform float sunDisc, starInt;
      varying vec3 vPos;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        float h = clamp(vPos.y, 0.0, 1.0);
        vec3 col = mix(c4, c3, smoothstep(0.0, 0.14, h));
        col = mix(col, c2, smoothstep(0.14, 0.34, h));
        col = mix(col, c1, smoothstep(0.34, 0.62, h));
        col = mix(col, c0, smoothstep(0.62, 0.95, h));
        float sd = max(dot(normalize(vPos), normalize(sunDir)), 0.0);
        col += vec3(1.4, 0.85, 0.45) * pow(sd, 48.0) * 0.55 * sunDisc;
        col += vec3(1.8, 1.25, 0.7) * smoothstep(0.996, 0.999, sd) * sunDisc;
        if (starInt > 0.01 && h > 0.18) {
          vec2 uv = floor(vec2(atan(vPos.z, vPos.x), asin(vPos.y)) * 90.0);
          float s = step(0.992, hash(uv));
          col += vec3(1.1, 1.15, 1.35) * s * starInt * smoothstep(0.18, 0.5, h);
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 20), mat);
  mesh.layers.set(NOINK);
  return { mesh, mat };
};

export class PulauRunWorld {
  root = new THREE.Group();
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bdd4f0", 36, 300);
  private waterTex: THREE.Texture;
  private clouds: THREE.Mesh[] = [];

  // Animated 3D Props
  private dutchShip: THREE.Group;
  private britishShip: THREE.Group;
  private smugglerBoat: THREE.Group;
  private scaleGroup: THREE.Group;
  private scaleBeam: THREE.Group;
  private scaleLeftPan: THREE.Group;
  private scaleRightPan: THREE.Group;
  private windmillBlades: THREE.Group;
  private oldFortGroup: THREE.Group;
  private nycGroup: THREE.Group;
  private nycTowers: { mesh: THREE.Group; delay: number; fullH: number }[] = [];

  // Floating 2D Narrative Cards
  private hookCard: THREE.Mesh;
  private scaleCard: THREE.Mesh;
  private goldCard: THREE.Mesh;
  private treatyCard: THREE.Mesh;
  private crashCard: THREE.Mesh;

  // Actors
  private dutch: ActorSlot;
  private british: ActorSlot;
  private sailorA: ActorSlot;
  private smuggler: ActorSlot;
  private allActors: ActorSlot[];

  constructor() {
    // 1. Lights
    this.hemi = new THREE.HemisphereLight("#84b6f0", "#7f9688", 1.4);
    this.root.add(this.hemi);

    this.sun = new THREE.DirectionalLight("#fff4de", 3.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 160;
    const d = 38;
    this.sun.shadow.camera.left = -d;
    this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d;
    this.sun.shadow.camera.bottom = -d;
    this.sun.shadow.bias = -0.0005;
    this.root.add(this.sun);
    this.root.add(this.sun.target);

    this.fill = new THREE.DirectionalLight("#b8d0f2", 0.45);
    this.fill.position.set(-18, 12, -14);
    this.root.add(this.fill);

    // 2. Sky Dome & Fluffy Painted Clouds
    const sky = buildSkyDome();
    this.skyMat = sky.mat;
    this.root.add(sky.mesh);

    const clTex = cloudHD(1);
    const clMat = new THREE.MeshBasicMaterial({ map: clTex, transparent: true, opacity: 0.92, depthWrite: false });
    const cloudSpecs: [number, number, number, number][] = [
      [-28, 24, -46, 26], [16, 28, -52, 30], [45, 22, -40, 22],
      [74, 27, -48, 28], [108, 24, -44, 26], [-8, 19, -28, 18], [92, 22, -30, 20],
    ];
    for (const [cx, cy, cz, sc] of cloudSpecs) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sc, sc * 0.48), clMat);
      m.position.set(cx, cy, cz);
      m.layers.set(NOINK);
      this.root.add(m);
      this.clouds.push(m);
    }

    // 3. Endless Painted Ocean (y = 0)
    this.waterTex = water().clone();
    this.waterTex.repeat.set(34, 34);
    this.waterTex.needsUpdate = true;
    const oceanMat = twoTone(new THREE.MeshLambertMaterial({ map: this.waterTex, color: "#4ba6e8" }));
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(460, 460), oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(45, 0, 0);
    ocean.receiveShadow = true;
    ocean.layers.set(NOINK);
    this.root.add(ocean);

    // =========================================================
    // ZONE A: PULAU RUN, KEPULAUAN BANDA, MALUKU (x = 0, z = 0)
    // =========================================================
    this.buildPulauRunZone();

    // Ships & Smuggler Boat (pulled cleanly into 9:16 bay framing!)
    this.dutchShip = buildGalleon(["#e87722", "#f7f5f0", "#2d6cc0"]); // Historical Dutch Prinsenvlag
    this.dutchShip.scale.setScalar(0.8);
    this.dutchShip.position.set(-4.8, 0.05, 12.2);
    this.dutchShip.rotation.y = -0.35;
    this.root.add(this.dutchShip);

    this.britishShip = buildGalleon(["#cf2b2b", "#f7f5f0", "#234a94"]); // British Royal flag
    this.britishShip.scale.setScalar(0.8);
    this.britishShip.position.set(5.2, 0.05, 11.8);
    this.britishShip.rotation.y = Math.PI + 0.35;
    this.root.add(this.britishShip);

    this.smugglerBoat = this.buildSmugglerBoat();
    this.smugglerBoat.position.set(-4.5, 0.05, 11.8);
    this.root.add(this.smugglerBoat);

    // Animated Brass Balance Scale on Dock (shown ONLY in Shot 5!)
    const sc = this.buildBalanceScale();
    sc.group.position.set(1.35, 0.8, 7.6);
    this.scaleGroup = sc.group;
    this.scaleBeam = sc.beam;
    this.scaleLeftPan = sc.leftPan;
    this.scaleRightPan = sc.rightPan;
    this.root.add(sc.group);

    // =========================================================
    // ZONE B: NEW AMSTERDAM (1667) -> MODERN MANHATTAN NYC (x = 90, z = 0)
    // =========================================================
    const zoneB = this.buildNewYorkZone();
    this.oldFortGroup = zoneB.oldFort;
    this.windmillBlades = zoneB.windmillBlades;
    this.nycGroup = zoneB.nycGroup;

    // 4. Floating Narrative Cards (proportioned cleanly with generous 9:16 side margins!)
    this.hookCard = makeFloatingCard(makeHookSwapCardTex(), 3.8, 1.41);
    this.hookCard.position.set(0.0, 4.45, 5.5);
    this.root.add(this.hookCard);

    this.scaleCard = makeFloatingCard(makeScaleBadgeTex(), 4.2, 1.3);
    this.scaleCard.position.set(0.0, 5.4, 0.0);
    this.root.add(this.scaleCard);

    this.goldCard = makeFloatingCard(makeGoldCompareTex(), 2.65, 0.74);
    this.goldCard.position.set(1.35, 3.25, 7.6);
    this.root.add(this.goldCard);

    this.treatyCard = makeFloatingCard(makeTreatyCardTex(), 2.9, 1.39);
    this.treatyCard.position.set(0.0, 3.42, 6.4);
    this.root.add(this.treatyCard);

    this.crashCard = makeFloatingCard(makePriceCrashCardTex(), 2.8, 1.55);
    this.crashCard.position.set(0.2, 3.35, 7.2);
    this.root.add(this.crashCard);

    // 5. Actors
    this.dutch = makeActor("dutch", 1.85);
    this.british = makeActor("british", 1.85);
    this.sailorA = makeActor("sailor", 1.72);
    this.smuggler = makeActor("smuggler", 1.7);
    this.allActors = [this.dutch, this.british, this.sailorA, this.smuggler];
    for (const a of this.allActors) {
      this.root.add(a.mesh);
      this.root.add(a.shadow);
    }
  }

  private buildPulauRunZone() {
    const sandMat = makeMat("#f0d390");
    const grass1 = makeMat("#56ad40");
    const grass2 = makeMat("#459134");
    const peakMat = makeMat("#3b7346");
    const foamMat = new THREE.MeshBasicMaterial({ color: "#e6f8ff", transparent: true, opacity: 0.72 });

    // Shore white foam ring
    const foam = new THREE.Mesh(new THREE.CylinderGeometry(10.3, 10.6, 0.06, 36), foamMat);
    foam.scale.set(1.22, 1, 0.85);
    foam.position.set(0, 0.03, -1.6);
    foam.layers.set(NOINK);
    this.root.add(foam);

    // Sandy beach base
    const beach = new THREE.Mesh(new THREE.CylinderGeometry(8.8, 9.8, 0.65, 32), sandMat);
    beach.scale.set(1.22, 1, 0.84);
    beach.position.set(0, 0.32, -1.6);
    beach.receiveShadow = true;
    this.root.add(beach);

    // Lush emerald volcanic hills of Pulau Run
    const hills: [number, number, number, number, number, THREE.Material][] = [
      [0, 0.6, -2.5, 6.8, 2.9, grass1],
      [-3.8, 0.6, -3.2, 4.4, 3.8, grass2],
      [3.6, 0.6, -2.8, 4.1, 3.1, grass1],
      [-0.8, 1.4, -4.4, 4.8, 4.9, grass2],
    ];
    for (const [hx, hy, hz, r, h, mat] of hills) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), mat);
      m.scale.set(1.1, h / r, 0.92);
      m.position.set(hx, hy, hz);
      m.castShadow = true;
      m.receiveShadow = true;
      this.root.add(m);
    }

    // Distant iconic Banda Gunung Api volcanic cone in background
    const volcano = new THREE.Mesh(new THREE.ConeGeometry(16, 22, 24), peakMat);
    volcano.position.set(-22, 10.5, -44);
    this.root.add(volcano);
    const islet2 = new THREE.Mesh(new THREE.SphereGeometry(7, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), makeMat("#4a8a52"));
    islet2.scale.set(1.4, 0.55, 1.0);
    islet2.position.set(24, 0, -38);
    this.root.add(islet2);

    // Hero Nutmeg Tree (right beside dock!) + Grove of tropical nutmeg trees
    this.root.add(buildNutmegTree(3.15, 0.55, 2.35, 1.15, true));
    const grove: [number, number, number, number][] = [
      [-4.6, 1.2, 0.2, 0.95], [-6.8, 0.8, -1.8, 0.85], [-2.5, 2.4, -2.6, 1.05],
      [1.4, 2.5, -2.2, 0.98], [5.4, 1.1, -0.8, 0.92], [6.8, 0.7, -3.2, 0.88],
      [-0.2, 3.4, -4.2, 1.1], [-4.5, 2.6, -4.4, 0.95], [3.6, 2.2, -4.2, 0.92],
    ];
    for (const [tx, ty, tz, sc] of grove) {
      this.root.add(buildNutmegTree(tx, ty, tz, sc, false));
    }

    // Wooden Colonial Harbour Dock (deck top at y = 0.8)
    const plankTex = planksHD().clone();
    plankTex.repeat.set(3, 3);
    plankTex.needsUpdate = true;
    const dockMat = twoTone(new THREE.MeshLambertMaterial({ map: plankTex, color: "#cf9a63" }));
    const pilingMat = makeMat("#664026");

    addBox(this.root, 6.2, 0.24, 6.0, dockMat, 0.2, 0.68, 7.0);
    // Connecting pier bridge to sandy beach
    addBox(this.root, 3.2, 0.22, 3.2, dockMat, 0.2, 0.66, 3.0);

    // Wooden pilings underneath & bollards
    for (const px of [-2.7, -0.8, 1.2, 3.1]) {
      for (const pz of [4.2, 7.0, 9.8]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.8, 10), pilingMat);
        post.position.set(px, 0.35, pz);
        post.castShadow = true;
        this.root.add(post);
      }
    }

    // Spice Crates & Wooden Barrels on the Dock
    const crateMat = makeMat("#c48745");
    const bandMat = makeMat("#4a362c");
    const cratePositions: [number, number, number, number][] = [
      [-1.95, 1.2, 5.1, 0.8], [-1.95, 1.98, 5.1, 0.74], [-1.05, 1.2, 5.05, 0.8],
      [-2.15, 1.15, 6.3, 0.7], [2.45, 1.18, 5.4, 0.76],
    ];
    for (const [cx, cy, cz, sz] of cratePositions) {
      addBox(this.root, sz, sz, sz, crateMat, cx, cy, cz, 0.12);
      addBox(this.root, sz + 0.04, 0.08, sz + 0.04, bandMat, cx, cy, cz, 0.12, false);
    }

    // Hero open nutmeg crate beside Hero Nutmeg Tree (for Shot 4!)
    addBox(this.root, 0.92, 0.65, 0.76, crateMat, 2.75, 1.12, 3.35, -0.15);
    const nutGlow = makeMat("#a65a22");
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2;
      const nut = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), nutGlow);
      nut.position.set(2.75 + Math.cos(ang) * 0.24, 1.5, 3.35 + Math.sin(ang) * 0.18);
      this.root.add(nut);
    }

    // Treaty Table at (0.0, 0.8, 6.4) for Perjanjian Breda 1667!
    const tableWood = makeMat("#8a532d");
    const clothRed = makeMat("#a82c2c");
    addBox(this.root, 1.65, 0.1, 1.0, tableWood, 0.0, 1.62, 6.4);
    addBox(this.root, 1.48, 0.14, 0.88, clothRed, 0.0, 1.65, 6.4);
    for (const lx of [-0.68, 0.68]) for (const lz of [-0.38, 0.38]) {
      addBox(this.root, 0.1, 0.82, 0.1, pilingMat, lx, 1.21, 6.4 + lz);
    }
    // Parchment scroll resting on treaty table
    addBox(this.root, 0.68, 0.04, 0.48, makeMat("#f7e8c4"), 0.0, 1.74, 6.4, 0.06, false);
  }

  private buildBalanceScale() {
    const group = new THREE.Group();
    const brass = makeMat("#e8b938");
    const brassDark = makeMat("#a87b1e");
    const goldBarMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.32, 1.02, 0.22) });
    const nutGlow = makeMat("#a85922");
    const maceRed = makeMat("#e02620");

    // Pedestal base & center pillar
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.14, 16), brassDark);
    base.position.y = 0.07;
    group.add(base);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.65, 12), brass);
    pillar.position.y = 0.9;
    group.add(pillar);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), brass);
    cap.position.y = 1.75;
    group.add(cap);

    // Pivoting Beam
    const beam = new THREE.Group();
    beam.position.set(0, 1.68, 0);
    addBox(beam, 1.72, 0.08, 0.08, brass, 0, 0, 0);
    group.add(beam);

    // Left Pan (ONE giant glowing Nutmeg — heavier!)
    const leftPan = new THREE.Group();
    leftPan.position.set(-0.78, 0, 0);
    const lChain = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.68, 6), brassDark);
    lChain.position.y = -0.34;
    leftPan.add(lChain);
    const lDish = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.28, 0.08, 18), brass);
    lDish.position.y = -0.7;
    leftPan.add(lDish);
    const bigNut = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), nutGlow);
    bigNut.scale.set(1.05, 1.25, 1.05);
    bigNut.position.y = -0.44;
    leftPan.add(bigNut);
    const mace = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 16), maceRed);
    mace.position.y = -0.44;
    mace.rotation.set(0.6, 0.4, 0);
    leftPan.add(mace);
    beam.add(leftPan);

    // Right Pan (Pile of 5 gleaming Gold Bars — lifted up!)
    const rightPan = new THREE.Group();
    rightPan.position.set(0.78, 0, 0);
    const rChain = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.68, 6), brassDark);
    rChain.position.y = -0.34;
    rightPan.add(rChain);
    const rDish = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.28, 0.08, 18), brass);
    rDish.position.y = -0.7;
    rightPan.add(rDish);
    const bars: [number, number, number][] = [
      [-0.14, -0.61, 0.08], [0.14, -0.61, 0.08], [0.0, -0.61, -0.14],
      [-0.08, -0.48, 0.0], [0.1, -0.48, 0.0],
    ];
    for (const [bx, by, bz] of bars) {
      addBox(rightPan, 0.22, 0.11, 0.13, goldBarMat, bx, by, bz, 0.15, false);
    }
    beam.add(rightPan);

    return { group, beam, leftPan, rightPan };
  }

  private buildSmugglerBoat() {
    const g = new THREE.Group();
    const wood = makeMat("#543828");
    addBox(g, 2.8, 0.52, 1.15, wood, 0, 0.25, 0);
    // Glowing green nutmeg saplings in wooden pots inside boat!
    const potMat = makeMat("#9c5a36");
    const leafGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.52, 1.42, 0.48) });
    for (const sx of [-0.55, 0.25, 0.85]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.26, 10), potMat);
      pot.position.set(sx, 0.62, 0);
      g.add(pot);
      const plant = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), leafGlow);
      plant.position.set(sx, 0.96, 0);
      g.add(plant);
    }
    return g;
  }

  private buildNewYorkZone() {
    const cx = 90;
    const islandStone = twoTone(new THREE.MeshLambertMaterial({ map: stone(), color: "#b8b0a2" }));
    const mudMat = makeMat("#8a7e5c");

    // Manhattan / New Amsterdam island platform
    addBox(this.root, 24, 1.1, 26, islandStone, cx, 0.1, -2.5);
    addBox(this.root, 22.8, 0.25, 24.8, mudMat, cx, 0.68, -2.5);

    // Foreground waterfront viewing pier for Shot 11 (x = 90, z = 15.2, top y = 0.8)
    const plankTex = planksHD().clone();
    plankTex.repeat.set(2, 2);
    plankTex.needsUpdate = true;
    const dockMat = twoTone(new THREE.MeshLambertMaterial({ map: plankTex, color: "#9c7b5c" }));
    addBox(this.root, 7.6, 0.26, 5.2, dockMat, cx, 0.68, 15.2);
    for (const px of [cx - 3.4, cx + 3.4]) for (const pz of [13.0, 17.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.8, 10), makeMat("#543d2c"));
      post.position.set(px, 0.35, pz);
      this.root.add(post);
    }

    // --- 1667 OLD NEW AMSTERDAM FORT & WINDMILL ---
    const oldFort = new THREE.Group();
    oldFort.position.set(cx, 0.8, 0.5);
    const logMat = makeMat("#7d5232");
    const brickMat = makeMat("#b86246");
    const roofRed = twoTone(new THREE.MeshLambertMaterial({ map: roof("#b54836"), color: "#c95844" }));

    // Wooden palisade fort wall
    addBox(oldFort, 8.5, 1.8, 0.35, logMat, 0, 0.9, -4.2);
    addBox(oldFort, 0.35, 1.8, 7.5, logMat, -4.2, 0.9, -0.5);
    addBox(oldFort, 0.35, 1.8, 7.5, logMat, 4.2, 0.9, -0.5);
    // Corner watchtowers
    for (const wx of [-4.2, 4.2]) {
      addBox(oldFort, 1.35, 2.8, 1.35, logMat, wx, 1.4, 3.0);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.95, 4), roofRed);
      cap.position.set(wx, 3.25, 3.0);
      cap.rotation.y = Math.PI / 4;
      oldFort.add(cap);
    }
    // Cute Dutch colonial stepped-gable cottages
    for (const [hx, hz, hw, hh] of [[-1.9, -1.6, 2.1, 2.1], [2.1, -1.8, 1.9, 1.9], [-2.2, 1.2, 1.8, 1.7]] as [number, number, number, number][]) {
      addBox(oldFort, hw, hh, 1.9, brickMat, hx, hh * 0.5, hz);
      const rf = new THREE.Mesh(new THREE.ConeGeometry(hw * 0.82, 1.15, 4), roofRed);
      rf.position.set(hx, hh + 0.55, hz);
      rf.rotation.y = Math.PI / 4;
      oldFort.add(rf);
    }

    // Iconic 1667 Dutch Windmill!
    const millBody = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.15, 4.2, 12), makeMat("#c2a882"));
    millBody.position.set(1.9, 2.1, 1.1);
    millBody.castShadow = true;
    oldFort.add(millBody);
    const millCap = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.9, 12), roofRed);
    millCap.position.set(1.9, 4.6, 1.1);
    oldFort.add(millCap);

    const windmillBlades = new THREE.Group();
    windmillBlades.position.set(1.9, 3.9, 1.92);
    const sailCream = makeMat("#f2e6c8");
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI) / 2;
      addBox(arm, 0.1, 2.4, 0.08, logMat, 0, 1.2, 0);
      addBox(arm, 0.45, 1.75, 0.04, sailCream, 0.25, 1.45, 0.04);
      windmillBlades.add(arm);
    }
    oldFort.add(windmillBlades);

    // "NEW AMSTERDAM — KOLONI BELANDA 1667" wooden sign
    const signBoard = makeFloatingCard(makeNewAmsterdamSignTex(), 3.8, 1.18);
    signBoard.position.set(0.0, 2.25, 4.2);
    oldFort.add(signBoard);
    addBox(oldFort, 0.14, 1.8, 0.14, logMat, -1.35, 0.9, 4.18);
    addBox(oldFort, 0.14, 1.8, 0.14, logMat, 1.35, 0.9, 4.18);
    this.root.add(oldFort);

    // --- MODERN MANHATTAN / NEW YORK 3D SKYSCRAPERS (Shot 10 & 11!) ---
    const nycGroup = new THREE.Group();
    nycGroup.position.set(cx, 0.78, -2.5);

    const winGold = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.82, 0.78) });
    const winCyan = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.72, 1.85, 2.5) });
    const spireGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 2.3, 2.8) });

    // [x, z, w, d, h, bodyColor, winType, style, delay]
    const specs: [number, number, number, number, number, string, "gold" | "cyan", "empire" | "chrysler" | "wtc" | "box", number][] = [
      [0.0, -3.5, 3.2, 3.2, 22.5, "#3b4c73", "gold", "empire", 0.0],     // Hero Empire State spire!
      [-4.2, -5.2, 2.8, 2.8, 19.5, "#355585", "cyan", "wtc", 0.08],       // One World Trade monolith
      [4.4, -4.6, 2.6, 2.6, 17.8, "#4b5a7d", "gold", "chrysler", 0.12],   // Chrysler crown tower
      [-7.4, -2.5, 2.5, 2.5, 13.5, "#2f4166", "gold", "box", 0.18],
      [7.2, -2.2, 2.6, 2.5, 14.5, "#3a4d78", "cyan", "box", 0.2],
      [-2.8, 0.2, 2.4, 2.2, 12.2, "#445478", "gold", "box", 0.15],
      [2.8, 0.6, 2.5, 2.3, 13.4, "#354970", "cyan", "box", 0.16],
      [-6.0, 2.2, 2.3, 2.1, 9.8, "#4c5c80", "gold", "box", 0.24],
      [6.2, 2.4, 2.4, 2.1, 10.6, "#3a4f78", "gold", "box", 0.26],
      [-0.4, 2.8, 2.6, 2.0, 8.8, "#3e527a", "cyan", "box", 0.22],
      [-8.8, -6.5, 2.6, 2.6, 15.2, "#2a3b5c", "cyan", "box", 0.28],
      [8.6, -6.2, 2.6, 2.6, 15.8, "#314266", "gold", "box", 0.3],
      [-2.2, -8.5, 3.0, 2.8, 16.5, "#2b3b5e", "gold", "box", 0.32],
      [2.6, -8.2, 2.9, 2.8, 17.0, "#33476e", "cyan", "box", 0.34],
    ];

    for (const [tx, tz, tw, td, th, col, wt, style, delay] of specs) {
      const tg = new THREE.Group();
      tg.position.set(tx, 0, tz);
      const bMat = makeMat(col);
      const wMat = wt === "gold" ? winGold : winCyan;

      if (style === "empire") {
        // Tiered Art Deco Empire State silhouette
        addBox(tg, tw, th * 0.55, td, bMat, 0, th * 0.275, 0);
        addBox(tg, tw * 0.72, th * 0.28, td * 0.72, bMat, 0, th * 0.69, 0);
        addBox(tg, tw * 0.44, th * 0.17, td * 0.44, bMat, 0, th * 0.915, 0);
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.22, 4.6, 8), spireGlow);
        spire.position.y = th + 2.2;
        spire.layers.set(NOINK);
        tg.add(spire);
      } else if (style === "wtc") {
        // Tapered sleek glass monolith
        addBox(tg, tw, th, td, bMat, 0, th * 0.5, 0);
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 3.8, 8), spireGlow);
        spire.position.y = th + 1.9;
        spire.layers.set(NOINK);
        tg.add(spire);
      } else if (style === "chrysler") {
        addBox(tg, tw, th * 0.82, td, bMat, 0, th * 0.41, 0);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(tw * 0.58, th * 0.28, 6), spireGlow);
        crown.position.y = th * 0.96;
        crown.layers.set(NOINK);
        tg.add(crown);
      } else {
        addBox(tg, tw, th, td, bMat, 0, th * 0.5, 0);
      }

      // Glowing HDR window strips along front (+z) & sides!
      const rows = Math.floor(th / 1.15);
      for (let r = 1; r < rows; r++) {
        const wy = r * 1.1;
        const ww = style === "empire" && wy > th * 0.55 ? tw * 0.52 : tw * 0.76;
        const wz = style === "empire" && wy > th * 0.55 ? td * 0.37 : td * 0.51;
        if ((r + Math.round(tx)) % 5 === 0) continue; // natural dark office floors
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(ww, 0.36), wMat);
        strip.position.set(0, wy, wz);
        strip.layers.set(NOINK);
        tg.add(strip);
      }

      nycGroup.add(tg);
      this.nycTowers.push({ mesh: tg, delay, fullH: th });
    }

    // Warm golden skyline base glow reflection
    const cityGlow = new THREE.PointLight("#ffcf6e", 5.5, 42);
    cityGlow.position.set(0, 6.5, 5.5);
    nycGroup.add(cityGlow);

    this.root.add(nycGroup);
    return { oldFort, windmillBlades, nycGroup };
  }

  private setActor(
    a: ActorSlot,
    visible: boolean,
    x: number, y: number, z: number,
    mood: Mood, pose: Pose, phase: number, dir: number,
    cam: THREE.PerspectiveCamera,
    hatPop = 0,
    scale = 1.0,
  ) {
    a.mesh.visible = visible;
    a.shadow.visible = visible;
    if (!visible) return;
    a.mesh.position.set(x, y, z);
    a.mesh.scale.setScalar(scale);
    a.shadow.position.set(x, y + 0.02, z);
    a.shadow.scale.setScalar(scale);

    // Cylindrical billboard facing camera
    a.mesh.rotation.y = Math.atan2(cam.position.x - x, cam.position.z - z);

    const pQ = Math.round(phase * 12);
    const hQ = Math.round(hatPop * 12);
    const key = `${mood}|${pose}|${pQ}|${dir}|${hQ}`;
    if (key !== a.lastKey) {
      drawRunCharacter(a.ctx, a.role, mood, pose, phase, dir, hatPop);
      a.tex.needsUpdate = true;
      a.lastKey = key;
    }
  }

  private applyLight(kind: CafeLight, scene: THREE.Scene, focusX: number) {
    const p = CAFE_LIGHTS[kind];
    const dir = dirFromAngles(p.az, p.el);
    this.sun.position.set(focusX + dir.x * 48, dir.y * 48, dir.z * 48);
    this.sun.target.position.set(focusX, 0, 0);
    this.sun.target.updateMatrixWorld();
    this.sun.color.set(p.sunCol);
    this.sun.intensity = p.sunInt;

    this.hemi.color.set(p.hemiSky);
    this.hemi.groundColor.set(p.hemiGnd);
    this.hemi.intensity = p.hemiInt;

    this.fill.color.set(p.fillCol);
    this.fill.intensity = p.fillInt;

    TONE.uLitCol.value.set(...p.lit);
    TONE.uShadeCol.value.set(...p.shade);
    TONE.uShadeLift.value.set(...p.lift);

    this.fog.color.set(p.fogCol);
    this.fog.near = p.fogNear + 12;
    this.fog.far = p.fogFar + 40;
    scene.fog = this.fog;

    for (let i = 0; i < 5; i++) {
      (this.skyMat.uniforms[`c${i}`].value as THREE.Color).copy(untone(p.sky[i]));
    }
    this.skyMat.uniforms.sunDir.value.copy(dir);
    this.skyMat.uniforms.sunDisc.value = p.sunDisc;
    this.skyMat.uniforms.starInt.value = kind === "dusk" ? 0.95 : 0.0;
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

    const inZoneB = id === 6 || id === 10 || id === 11;
    this.applyLight(s.light, scene, inZoneB ? 90 : 0);

    // Gentle ocean drift & drifting clouds
    this.waterTex.offset.set(t * 0.015, t * 0.01);
    this.clouds.forEach((cl, i) => {
      cl.position.x += Math.sin(t * 0.1 + i) * 0.002;
      cl.lookAt(cam.position);
    });

    // Ships bobbing smoothly on waves
    this.dutchShip.position.y = 0.08 + Math.sin(t * 1.4) * 0.12;
    this.dutchShip.rotation.z = Math.sin(t * 1.1) * 0.045;
    this.britishShip.position.y = 0.08 + Math.sin(t * 1.3 + 1.4) * 0.12;
    this.britishShip.rotation.z = Math.sin(t * 1.05 + 1.0) * 0.045;

    // Spinning Dutch windmill blades in New Amsterdam
    this.windmillBlades.rotation.z = -t * 1.35;

    // Default visibility for shot-specific props & cards
    this.scaleGroup.visible = id === 5;
    this.hookCard.visible = id === 1;
    this.scaleCard.visible = id === 3;
    this.goldCard.visible = id === 5;
    this.treatyCard.visible = id === 7;
    this.crashCard.visible = id === 9;
    this.smugglerBoat.visible = id === 9;

    // Always orient floating cards gently toward camera
    for (const card of [this.hookCard, this.scaleCard, this.goldCard, this.treatyCard, this.crashCard]) {
      if (card.visible) {
        card.rotation.y = Math.atan2(cam.position.x - card.position.x, cam.position.z - card.position.z);
      }
    }

    // Balance Scale tip animation (Shot 5: nutmeg dramatically slams down outweighing gold!)
    const tipAmt = id === 5 ? 0.24 * smooth(u * 1.8) + Math.sin(t * 3.5) * 0.015 : 0.18;
    this.scaleBeam.rotation.z = tipAmt;
    this.scaleLeftPan.rotation.z = -tipAmt;
    this.scaleRightPan.rotation.z = -tipAmt;

    // Zone B Transformation: 1667 New Amsterdam vs Modern Manhattan Skyscrapers!
    if (id === 6) {
      this.oldFortGroup.visible = true;
      this.oldFortGroup.scale.setScalar(1);
      this.nycGroup.visible = false;
    } else if (id === 10) {
      const fortShrink = 1 - smooth((u - 0.05) / 0.28);
      this.oldFortGroup.visible = fortShrink > 0.02;
      this.oldFortGroup.scale.set(1, Math.max(0.01, fortShrink), 1);
      this.nycGroup.visible = true;
      for (const tw of this.nycTowers) {
        const k = clamp01((u - 0.1 - tw.delay * 0.85) / 0.45);
        const rise = glide(k);
        tw.mesh.scale.set(1, Math.max(0.001, rise), 1);
        tw.mesh.visible = rise > 0.01;
      }
    } else if (id === 11) {
      this.oldFortGroup.visible = false;
      this.nycGroup.visible = true;
      for (const tw of this.nycTowers) {
        tw.mesh.scale.set(1, 1, 1);
        tw.mesh.visible = true;
      }
    } else {
      this.oldFortGroup.visible = false;
      this.nycGroup.visible = false;
    }

    // Hide all actors first, then stage exact shot choreography
    for (const a of this.allActors) {
      a.mesh.visible = false;
      a.shadow.visible = false;
    }

    // --- SHOT-BY-SHOT CHOREOGRAPHY ---
    switch (id) {
      case 1: {
        // Hook: Floating PULAU RUN <-> NEW YORK swap banner bobbing cleanly above Dutch & British officers!
        this.hookCard.position.y = 4.35 + Math.sin(t * 2.5) * 0.1;
        const pop = smooth(u * 4.5);
        this.hookCard.scale.setScalar(0.88 + 0.12 * pop);
        this.setActor(this.dutch, true, -1.25, 0.8, 7.6, "smug", "point", t * 0.8, 1, cam);
        this.setActor(this.british, true, 1.35, 0.8, 7.6, "proud", "hold_map", t * 0.8, -1, cam);
        break;
      }
      case 2: {
        // Establishing Banda Sea: officers & sailors on dock watching rival galleons
        this.setActor(this.dutch, true, -1.2, 0.8, 7.4, "scheme", "stand", t * 0.7, 1, cam);
        this.setActor(this.british, true, 1.3, 0.8, 7.4, "proud", "stand", t * 0.7, -1, cam);
        this.setActor(this.sailorA, true, 0.0, 0.8, 8.6, "calm", "point", t * 0.8, 0, cam);
        break;
      }
      case 3: {
        // Tiny scale 3 km x 1 km badge floating over Pulau Run
        this.scaleCard.position.y = 5.5 + Math.sin(t * 2.4) * 0.15;
        this.setActor(this.sailorA, true, -0.5, 0.8, 7.6, "shrug", "hold_map", t * 0.8, 0, cam);
        break;
      }
      case 4: {
        // Hero Nutmeg Tree close-up: Dutch VOC merchant standing cleanly in front of crates hugging giant golden nutmeg with starry greedy eyes!
        this.setActor(this.dutch, true, 1.85, 0.8, 6.35, "greedy", "hug_nutmeg", t * 1.1, 1, cam);
        break;
      }
      case 5: {
        // Golden hour: 3D Brass Balance Scale (1 nutmeg > gold bars) + amazed Dutch merchant
        this.goldCard.position.y = 3.22 + Math.sin(t * 2.2) * 0.07;
        this.setActor(this.dutch, true, 0.12, 0.8, 7.55, "greedy", "point", t * 0.9, 1, cam);
        break;
      }
      case 6: {
        // Zone B: Modest muddy New Amsterdam fort — bored Dutch governor looking unimpressed
        this.setActor(this.dutch, true, 88.2, 0.8, 6.2, "bored", "shrug", t * 0.6, 1, cam);
        this.setActor(this.sailorA, true, 92.2, 0.8, 6.0, "calm", "stand", t * 0.7, -1, cam);
        break;
      }
      case 7: {
        // Perjanjian Breda 1667 handshake + treaty scroll card popping/stamping into view!
        const stamp = smooth((u - 0.12) / 0.25);
        this.treatyCard.scale.setScalar(0.1 + 0.9 * stamp);
        this.treatyCard.position.y = 3.45 + Math.sin(t * 2.2) * 0.06;
        this.setActor(this.dutch, true, -1.12, 0.8, 6.45, "smug", "handshake_l", t * 0.8, 1, cam);
        this.setActor(this.british, true, 1.12, 0.8, 6.45, "smile", "handshake_r", t * 0.8, -1, cam);
        break;
      }
      case 8: {
        // Dutch VOC merchant cheers triumphantly on crates; British officer shrugs holding New Amsterdam map
        this.setActor(this.dutch, true, -1.2, 1.48, 6.1, "proud", "cheer", t * 1.5, 0, cam);
        this.setActor(this.british, true, 1.25, 0.8, 6.8, "shrug", "hold_map", t * 0.8, -1, cam);
        break;
      }
      case 9: {
        // Dusk Twist 1: Smuggler rowboat escapes with glowing nutmeg seedlings while VOC merchant panics!
        const bx = -4.2 - u * 7.8;
        const bz = 11.4 + u * 2.8;
        this.smugglerBoat.position.set(bx, 0.06 + Math.sin(t * 2.2) * 0.08, bz);
        this.smugglerBoat.rotation.y = 0.25;
        this.setActor(this.smuggler, true, bx - 0.2, 0.48, bz, "scheme", "row", t * 1.4, -1, cam, 0, 0.82);

        this.crashCard.position.y = 3.32 + Math.sin(t * 3.0) * 0.06;
        this.setActor(this.dutch, true, -1.25, 0.8, 7.6, "panic", "shrug", t * 1.6, -1, cam, 0.25);
        break;
      }
      case 10: {
        // Zone B Twist 2: Epic Manhattan skyline rising — tiny British officer admiring the metropolis!
        this.setActor(this.british, true, 90.0, 0.8, 13.8, "proud", "cheer", t * 1.0, 0, cam, 0, 0.9);
        break;
      }
      default: {
        // Shot 11 Ironic Payoff: Shocked Dutch VOC merchant on waterfront pier holding ONE tiny nutmeg as his hat pops up!
        const hatPop = 0.45 + 0.55 * Math.sin(smooth(u * 2.4) * Math.PI * 0.85) + Math.sin(t * 6.0) * 0.08;
        this.setActor(this.dutch, true, 90.0, 0.8, 15.2, "shock", "hold_tiny_nutmeg", t * 1.1, 0, cam, Math.max(0.2, hatPop), 1.12);
        return V(90.0, 2.0, 15.2); // Focus DOF directly on the shocked VOC merchant!
      }
    }

    return look;
  }
}
