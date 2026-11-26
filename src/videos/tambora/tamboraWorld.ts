import * as THREE from "three";
import { NOINK } from "../bridge/ink";
import { TONE, twoTone, untone } from "../bridge/shade";
import { water, cloudHD, stone, roof, cobble } from "../bridge/paint";
import { CAFE_LIGHTS, CafeLight, dirFromAngles } from "../cafe/cafeLights";
import { SHOTS, FPS, camAt, clamp01, smooth, glide } from "./story";
import {
  drawTamboraCharacter, Role, Mood, Pose,
  makeTamboraHookTex, makeSumbawaDateTex, makeKrakatauScaleTex,
  makeJulySnowTex, makeBikeCardTex, makeFrankensteinCardTex, makeFinaleCardTex,
} from "./tamboraToon";

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

const makeActor = (role: Role, heightM = 1.85): ActorSlot => {
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

  const shGeo = new THREE.CircleGeometry(0.45, 18);
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

const buildWoodenBicycle = () => {
  const g = new THREE.Group();
  const oak = makeMat("#9c6234");
  const oakDark = makeMat("#663d1e");
  const iron = makeMat("#353945");
  const leather = makeMat("#4a291a");

  const makeWheel = (wx: number) => {
    const wg = new THREE.Group();
    wg.position.set(wx, 0.55, 0);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.065, 10, 22), oak);
    wg.add(rim);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.028, 8, 22), iron);
    wg.add(tire);
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.0, 6), oakDark);
      sp.rotation.z = (i * Math.PI) / 4;
      wg.add(sp);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 10), iron);
    hub.rotation.x = Math.PI / 2;
    wg.add(hub);
    return wg;
  };

  const rearWheel = makeWheel(-0.92);
  const frontWheel = makeWheel(0.92);
  g.add(rearWheel);
  g.add(frontWheel);

  // Curved wooden Draisine main beam + front steerer fork + handlebars + saddle!
  addBox(g, 1.95, 0.18, 0.14, oak, 0, 1.12, 0);
  // Rear fork
  addBox(g, 0.12, 0.65, 0.24, oakDark, -0.92, 0.85, 0);
  // Front steering column + wooden crossbar handle
  addBox(g, 0.12, 0.92, 0.24, oakDark, 0.92, 1.02, 0);
  addBox(g, 0.12, 0.1, 0.78, oakDark, 0.92, 1.48, 0);
  // Leather saddle
  addBox(g, 0.52, 0.14, 0.3, leather, -0.1, 1.28, 0);

  return { group: g, rearWheel, frontWheel };
};

const buildEarthGlobe = () => {
  const g = new THREE.Group();
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 512;
  const ctx = cv.getContext("2d")!;
  // Ocean blue
  ctx.fillStyle = "#2b78c7";
  ctx.fillRect(0, 0, 1024, 512);
  // Stylized green continents (Eurasia, Africa, Americas, Australia, Indonesia!)
  ctx.fillStyle = "#52b346";
  ctx.strokeStyle = "#221626";
  ctx.lineWidth = 6;
  const blobs: [number, number, number, number][] = [
    [220, 180, 95, 70], [280, 320, 65, 95],   // Americas
    [540, 150, 95, 58], [560, 290, 75, 95],   // Europe & Africa
    [710, 175, 130, 82], [810, 360, 65, 50],  // Asia & Australia
  ];
  for (const [bx, by, rx, ry] of blobs) {
    ctx.beginPath();
    ctx.ellipse(bx, by, rx, ry, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Indonesia archipelago + glowing red Tambora marker!
  ctx.fillStyle = "#69cc54";
  ctx.fillRect(745, 275, 95, 22);
  ctx.fillStyle = "#ff3b28";
  ctx.beginPath();
  ctx.arc(802, 292, 14, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 28, 20),
    twoTone(new THREE.MeshLambertMaterial({ map: tex })),
  );
  g.add(globe);

  // Dark volcanic ash ring cloud wrapping around Earth!
  const ashRing = new THREE.Group();
  const ashMat = new THREE.MeshBasicMaterial({ color: "#3d3947", transparent: true, opacity: 0.78 });
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.55 + (i % 3) * 0.18, 10, 8), ashMat);
    puff.position.set(Math.cos(ang) * 3.85, Math.sin(ang * 2) * 0.45, Math.sin(ang) * 3.85);
    puff.layers.set(NOINK);
    ashRing.add(puff);
  }
  ashRing.rotation.z = 0.22;
  g.add(ashRing);

  return { group: g, globe, ashRing };
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
        if (starInt > 0.01 && h > 0.16) {
          vec2 uv = floor(vec2(atan(vPos.z, vPos.x), asin(vPos.y)) * 90.0);
          float s = step(0.992, hash(uv));
          col += vec3(1.1, 1.15, 1.35) * s * starInt * smoothstep(0.16, 0.48, h);
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(520, 32, 20), mat);
  mesh.layers.set(NOINK);
  return { mesh, mat };
};

export class TamboraWorld {
  root = new THREE.Group();
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bdd4f0", 38, 320);
  private waterTex: THREE.Texture;
  private clouds: THREE.Mesh[] = [];

  // Zone 1: Tambora Eruption parts
  private tamboraPeak: THREE.Mesh;
  private eruptionPlume: THREE.Group;
  private lavaBombs: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; phase: number }[] = [];
  private smokePuffs: { mesh: THREE.Mesh; offset: number }[] = [];

  // Zone 2: Earth Globe + Snowy July 1816 Europe
  private earthObj: { group: THREE.Group; globe: THREE.Mesh; ashRing: THREE.Group };
  private snowflakes: { mesh: THREE.Mesh; x0: number; y0: number; z0: number; sp: number }[] = [];

  // Zone 3: Animated Wooden Draisine Bicycle
  private bikeObj: { group: THREE.Group; rearWheel: THREE.Group; frontWheel: THREE.Group };

  // Zone 4: Stormy Villa Diodati, Lightning & Frankenstein Finale
  private lightningBolt: THREE.Group;
  private finaleBike: THREE.Group;
  private glowingBook: THREE.Group;

  // Floating Narrative Cards
  private hookCard: THREE.Mesh;
  private dateCard: THREE.Mesh;
  private scaleCard: THREE.Mesh;
  private snowCard: THREE.Mesh;
  private bikeCard: THREE.Mesh;
  private frankCard: THREE.Mesh;
  private finaleCard: THREE.Mesh;

  // Actors
  private sumbawa: ActorSlot;
  private european: ActorSlot;
  private drais: ActorSlot;
  private shelley: ActorSlot;
  private frank: ActorSlot;
  private allActors: ActorSlot[];

  constructor() {
    // 1. Lights
    this.hemi = new THREE.HemisphereLight("#84b6f0", "#7f9688", 1.42);
    this.root.add(this.hemi);

    this.sun = new THREE.DirectionalLight("#fff4de", 3.15);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 170;
    const d = 42;
    this.sun.shadow.camera.left = -d;
    this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d;
    this.sun.shadow.camera.bottom = -d;
    this.sun.shadow.bias = -0.0005;
    this.root.add(this.sun);
    this.root.add(this.sun.target);

    this.fill = new THREE.DirectionalLight("#b8d0f2", 0.45);
    this.fill.position.set(-18, 14, -14);
    this.root.add(this.fill);

    // 2. Sky Dome & Painted Clouds
    const sky = buildSkyDome();
    this.skyMat = sky.mat;
    this.root.add(sky.mesh);

    const clTex = cloudHD(5);
    const clMat = new THREE.MeshBasicMaterial({ map: clTex, transparent: true, opacity: 0.9, depthWrite: false });
    const cloudSpecs: [number, number, number, number][] = [
      [-18, 25, -44, 26], [20, 27, -48, 28],
      [74, 26, -44, 26], [110, 26, -46, 28],
      [164, 25, -42, 26], [198, 27, -46, 26],
      [252, 26, -46, 28], [288, 24, -42, 26],
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
    this.waterTex.repeat.set(60, 40);
    this.waterTex.needsUpdate = true;
    const oceanMat = twoTone(new THREE.MeshLambertMaterial({ map: this.waterTex, color: "#389ae0" }));
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(760, 460), oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(135, 0, 0);
    ocean.receiveShadow = true;
    ocean.layers.set(NOINK);
    this.root.add(ocean);

    // =========================================================
    // ZONE 1 (x = 0): GUNUNG TAMBORA 1815, SUMBAWA
    // =========================================================
    const z1 = this.buildZone1Tambora();
    this.tamboraPeak = z1.peak;
    this.eruptionPlume = z1.plume;

    // =========================================================
    // ZONE 2 (x = 90): 3D EARTH GLOBE + SNOWY JULY 1816 EUROPE
    // =========================================================
    this.earthObj = buildEarthGlobe();
    this.earthObj.group.position.set(90.0, 6.2, -24.0);
    this.root.add(this.earthObj.group);
    this.buildZone2SnowyEurope();

    // =========================================================
    // ZONE 3 (x = 180): 1817 GERMANY + KARL DRAIS FIRST BICYCLE
    // =========================================================
    this.bikeObj = buildWoodenBicycle();
    this.bikeObj.group.position.set(177.0, 0.78, 5.2);
    this.root.add(this.bikeObj.group);
    this.buildZone3Germany();

    // =========================================================
    // ZONE 4 (x = 270): VILLA DIODATI, FRANKENSTEIN & FINALE
    // =========================================================
    const z4 = this.buildZone4VillaAndFinale();
    this.lightningBolt = z4.lightning;
    this.finaleBike = z4.finaleBike;
    this.glowingBook = z4.glowingBook;

    // 4. Floating Narrative Cards (proportioned cleanly inside 9:16 margins!)
    this.hookCard = makeFloatingCard(makeTamboraHookTex(), 4.6, 1.64);
    this.hookCard.position.set(0.0, 5.1, 5.2);
    this.root.add(this.hookCard);

    this.dateCard = makeFloatingCard(makeSumbawaDateTex(), 4.2, 1.1);
    this.dateCard.position.set(0.0, 9.6, -2.0);
    this.root.add(this.dateCard);

    this.scaleCard = makeFloatingCard(makeKrakatauScaleTex(), 4.8, 1.26);
    this.scaleCard.position.set(0.0, 12.2, -2.5);
    this.root.add(this.scaleCard);

    this.snowCard = makeFloatingCard(makeJulySnowTex(), 3.8, 1.0);
    this.snowCard.position.set(90.0, 4.6, 4.8);
    this.root.add(this.snowCard);

    this.bikeCard = makeFloatingCard(makeBikeCardTex(), 3.6, 0.94);
    this.bikeCard.position.set(180.0, 4.3, 4.5);
    this.root.add(this.bikeCard);

    this.frankCard = makeFloatingCard(makeFrankensteinCardTex(), 3.3, 0.88);
    this.frankCard.position.set(270.0, 4.15, 6.2);
    this.root.add(this.frankCard);

    this.finaleCard = makeFloatingCard(makeFinaleCardTex(), 4.2, 1.1);
    this.finaleCard.position.set(270.0, 5.2, 6.2);
    this.root.add(this.finaleCard);

    // 5. Actors
    this.sumbawa = makeActor("sumbawa", 1.85);
    this.european = makeActor("european", 1.85);
    this.drais = makeActor("drais", 1.88);
    this.shelley = makeActor("shelley", 1.82);
    this.frank = makeActor("frankenstein", 1.98);
    this.allActors = [this.sumbawa, this.european, this.drais, this.shelley, this.frank];
    for (const a of this.allActors) {
      this.root.add(a.mesh);
      this.root.add(a.shadow);
    }
  }

  private buildZone1Tambora() {
    const sand = makeMat("#efd392");
    const grass = makeMat("#4ca840");
    const rockDark = makeMat("#484854");
    const lavaGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.72, 0.14) });

    // Sumbawa tropical island base & clean flat meadow for actors
    const beach = new THREE.Mesh(new THREE.CylinderGeometry(14.5, 16.0, 0.7, 36), sand);
    beach.scale.set(1.3, 1, 0.9);
    beach.position.set(0, 0.35, -1.0);
    this.root.add(beach);
    addBox(this.root, 18.0, 0.4, 9.2, grass, 0.0, 0.55, 6.4, 0, false);

    // Gunung Tambora Base Caldera Cone (remains after summit blows off!)
    const baseCone = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 8.6, 8.2, 24), rockDark);
    baseCone.position.set(0, 4.6, -6.2);
    baseCone.castShadow = true;
    this.root.add(baseCone);

    // Towering Pre-Eruption Summit Cone (4,300m -> gets blasted off in Shot 3!)
    const peak = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 2.65, 4.2, 22), makeMat("#565462"));
    peak.position.set(0, 10.7, -6.2);
    peak.castShadow = true;
    this.root.add(peak);

    // Glowing molten crater core inside caldera
    const crater = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.45, 0.45, 20), lavaGlow);
    crater.position.set(0, 8.75, -6.2);
    crater.layers.set(NOINK);
    this.root.add(crater);

    // Subtle pre-eruption smoke puffs
    const smokeMat = makeMat("#d8d6e0");
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), smokeMat);
      sp.position.set(0, 13.0 + i * 1.0, -6.2);
      this.root.add(sp);
      this.smokePuffs.push({ mesh: sp, offset: i / 5 });
    }

    // Colossal Eruption Ash Mushroom Column + Glowing Lava Bombs (Shot 3!)
    const plume = new THREE.Group();
    plume.position.set(0, 8.7, -6.2);
    const ashDark = makeMat("#3a3542");
    const ashWarm = makeMat("#5c4444");
    // Rising fiery core + ash stem
    const fireCore = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.2, 6.5, 16), lavaGlow);
    fireCore.position.y = 3.2;
    fireCore.layers.set(NOINK);
    plume.add(fireCore);
    // Giant mushroom ash puffs at top
    const puffs: [number, number, number, number, THREE.Material][] = [
      [0, 7.2, 0, 2.8, ashDark],
      [-2.6, 8.8, 0.4, 2.6, ashWarm], [2.6, 8.6, -0.3, 2.6, ashDark],
      [0, 10.6, 0, 3.4, ashDark], [-3.8, 10.2, 0.5, 2.2, ashDark], [3.8, 10.0, 0.3, 2.2, ashWarm],
    ];
    for (const [px, py, pz, r, m] of puffs) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
      s.position.set(px, py, pz);
      plume.add(s);
    }
    // Flying glowing lava bombs!
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), lavaGlow);
      b.layers.set(NOINK);
      plume.add(b);
      this.lavaBombs.push({ mesh: b, vx: Math.cos(ang) * 4.2, vy: 8.5 + (i % 3) * 2.0, vz: Math.sin(ang) * 3.5, phase: i * 0.13 });
    }
    plume.visible = false;
    this.root.add(plume);

    return { peak, plume };
  }

  private buildZone2SnowyEurope() {
    const cx = 90;
    const snowMat = makeMat("#eef4fc");
    const wallCream = makeMat("#e6d8c0");
    const timber = makeMat("#543828");
    const warmWin = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.55, 0.65) });

    // Snow-blanketed European ground
    addBox(this.root, 26, 0.9, 20, snowMat, cx, 0.25, 4.5, 0, false);

    // 3 Charming Half-Timbered European Cottages with Snow-Covered Roofs!
    const cottages: [number, number, number, number][] = [
      [cx - 4.2, 0.5, 3.6, 3.4],
      [cx + 0.0, -1.2, 4.0, 3.8],
      [cx + 4.4, 0.8, 3.5, 3.2],
    ];
    for (const [hx, hz, hw, hh] of cottages) {
      addBox(this.root, hw, hh, 3.2, wallCream, hx, 0.7 + hh * 0.5, hz);
      // Dark timber crossbeams
      addBox(this.root, hw + 0.08, 0.16, 3.28, timber, hx, 0.7 + hh * 0.55, hz, 0, false);
      // Thick snow-blanketed pitched roof!
      const rf = new THREE.Mesh(new THREE.ConeGeometry(hw * 0.82, 2.2, 4), snowMat);
      rf.position.set(hx, 0.7 + hh + 1.05, hz);
      rf.rotation.y = Math.PI / 4;
      this.root.add(rf);
      // Warm glowing cottage window
      addBox(this.root, 0.85, 0.85, 0.1, warmWin, hx, 0.7 + hh * 0.52, hz + 1.62, 0, false);
    }

    // Cute 3D Wooden Cartoon Horse standing sadly next to snow-covered empty barn (Shot 6!)
    const horse = new THREE.Group();
    horse.position.set(cx + 2.2, 0.7, 6.4);
    const brown = makeMat("#7a4a2a");
    addBox(horse, 1.55, 0.78, 0.62, brown, 0, 1.08, 0);
    addBox(horse, 0.42, 0.82, 0.42, brown, -0.78, 1.48, 0);
    addBox(horse, 0.62, 0.42, 0.4, brown, -1.06, 1.72, 0);
    for (const lx of [-0.55, 0.55]) for (const lz of [-0.2, 0.2]) {
      addBox(horse, 0.16, 0.78, 0.16, makeMat("#54321c"), lx, 0.39, lz);
    }
    this.root.add(horse);

    // 36 Animated Falling 3D Snowflakes drifting across Zone 2!
    const flakeMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    for (let i = 0; i < 36; i++) {
      const fx = cx - 7.5 + ((i * 3.7) % 15.0);
      const fy = 1.0 + ((i * 2.3) % 9.0);
      const fz = 1.0 + ((i * 4.1) % 11.0);
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 6), flakeMat);
      m.position.set(fx, fy, fz);
      m.layers.set(NOINK);
      this.root.add(m);
      this.snowflakes.push({ mesh: m, x0: fx, y0: fy, z0: fz, sp: 0.9 + (i % 4) * 0.35 });
    }
  }

  private buildZone3Germany() {
    const cx = 180;
    const cobTex = cobble().clone();
    cobTex.repeat.set(6, 4);
    cobTex.needsUpdate = true;
    const streetMat = twoTone(new THREE.MeshLambertMaterial({ map: cobTex, color: "#c9bba2" }));
    const roofRed = twoTone(new THREE.MeshLambertMaterial({ map: roof("#b54836"), color: "#c95844" }));

    // Sunlit 1817 German cobblestone town street
    addBox(this.root, 32, 0.9, 20, streetMat, cx, 0.25, 4.0, 0, false);

    // Colorful German Half-Timbered Workshop Facades behind street!
    const houses: [number, number, string, number][] = [
      [cx - 6.0, -0.8, "#f0dfc0", 4.6],
      [cx - 1.2, -1.0, "#e6c38c", 5.2],
      [cx + 3.8, -0.8, "#dce6e0", 4.8],
      [cx + 8.6, -0.8, "#f0d3c0", 4.4],
    ];
    const timber = makeMat("#5c3a22");
    const winBlue = makeMat("#6fa3d4");
    for (const [hx, hz, col, hh] of houses) {
      addBox(this.root, 4.2, hh, 3.6, makeMat(col), hx, 0.7 + hh * 0.5, hz);
      addBox(this.root, 4.28, 0.16, 3.68, timber, hx, 0.7 + hh * 0.5, hz, 0, false);
      const rf = new THREE.Mesh(new THREE.ConeGeometry(3.4, 2.4, 4), roofRed);
      rf.position.set(hx, 0.7 + hh + 1.15, hz);
      rf.rotation.y = Math.PI / 4;
      this.root.add(rf);
      for (const wx of [-0.95, 0.95]) {
        addBox(this.root, 0.78, 0.92, 0.1, winBlue, hx + wx, 0.7 + hh * 0.68, hz + 1.82, 0, false);
      }
    }
  }

  private buildZone4VillaAndFinale() {
    const cx = 270;
    const stoneDark = twoTone(new THREE.MeshLambertMaterial({ map: stone(), color: "#767385" }));
    const slateRoof = makeMat("#33364f");
    const warmWin = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.65, 0.55) });
    const boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.5, 3.0) });

    // Stone Lakeside Terrace of Villa Diodati (Lake Geneva, 1816!)
    addBox(this.root, 26, 0.9, 20, stoneDark, cx, 0.25, 4.0, 0, false);

    // Gothic Villa Diodati Mansion with Pointed Towers & Warm Glowing Windows
    addBox(this.root, 9.2, 5.2, 4.6, makeMat("#6c687a"), cx, 3.3, -1.2);
    const mainRoof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 3.0, 4), slateRoof);
    mainRoof.position.set(cx, 7.4, -1.2);
    mainRoof.rotation.y = Math.PI / 4;
    this.root.add(mainRoof);

    for (const sx of [-4.6, 4.6]) {
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.45, 6.8, 12), makeMat("#5c586b"));
      tw.position.set(cx + sx, 4.1, -0.8);
      this.root.add(tw);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(1.65, 3.2, 12), slateRoof);
      spire.position.set(cx + sx, 9.1, -0.8);
      this.root.add(spire);
    }
    // Glowing warm Gothic windows
    for (const wx of [-2.4, 0, 2.4]) {
      addBox(this.root, 1.15, 1.65, 0.12, warmWin, cx + wx, 3.6, 1.14, 0, false);
    }

    // Animated Jagged HDR Bloom Lightning Bolt in Stormy Sky (Shot 9!)
    const lightning = new THREE.Group();
    lightning.position.set(cx + 2.4, 10.5, -4.5);
    addBox(lightning, 0.28, 3.2, 0.14, boltMat, 0.4, 2.2, 0, 0, false).rotation.z = -0.35;
    addBox(lightning, 0.26, 2.8, 0.14, boltMat, -0.2, 0.2, 0, 0, false).rotation.z = 0.42;
    addBox(lightning, 0.22, 3.0, 0.14, boltMat, 0.35, -1.8, 0, 0, false).rotation.z = -0.3;
    lightning.traverse((c) => c.layers.set(NOINK));
    this.root.add(lightning);

    // Candlelit Writing Desk + Glowing Open Frankenstein Storybook (Shots 10–11!)
    const glowingBook = new THREE.Group();
    glowingBook.position.set(cx, 0.72, 6.4);
    addBox(glowingBook, 1.8, 0.12, 1.0, makeMat("#6e4226"), 0, 0.85, 0);
    for (const lx of [-0.75, 0.75]) for (const lz of [-0.38, 0.38]) {
      addBox(glowingBook, 0.1, 0.85, 0.1, makeMat("#4d2c18"), lx, 0.42, lz);
    }
    const pageGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 2.2, 1.35) }); // eerie green-gold glow!
    addBox(glowingBook, 0.65, 0.08, 0.52, pageGlow, -0.32, 0.96, 0, 0, false).rotation.z = 0.16;
    addBox(glowingBook, 0.65, 0.08, 0.52, pageGlow, 0.32, 0.96, 0, 0, false).rotation.z = -0.16;
    this.root.add(glowingBook);

    // Finale Display Wooden Bicycle beside desk for Shot 11 Butterfly-Effect Summary!
    const fBike = buildWoodenBicycle();
    fBike.group.position.set(cx - 2.05, 0.72, 6.9);
    fBike.group.scale.setScalar(0.84);
    this.root.add(fBike.group);

    return { lightning, finaleBike: fBike.group, glowingBook };
  }

  private setActor(
    a: ActorSlot,
    visible: boolean,
    x: number, y: number, z: number,
    mood: Mood, pose: Pose, phase: number, dir: number,
    cam: THREE.PerspectiveCamera,
    scale = 1.0,
  ) {
    a.mesh.visible = visible;
    a.shadow.visible = visible;
    if (!visible) return;
    a.mesh.position.set(x, y, z);
    a.mesh.scale.setScalar(scale);
    a.shadow.position.set(x, y + 0.02, z);
    a.shadow.scale.setScalar(scale);
    a.mesh.rotation.y = Math.atan2(cam.position.x - x, cam.position.z - z);

    const pQ = Math.round(phase * 12);
    const key = `${mood}|${pose}|${pQ}|${dir}`;
    if (key !== a.lastKey) {
      drawTamboraCharacter(a.ctx, a.role, mood, pose, phase, dir);
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
    this.fog.near = p.fogNear + 16;
    this.fog.far = p.fogFar + 50;
    scene.fog = this.fog;

    for (let i = 0; i < 5; i++) {
      (this.skyMat.uniforms[`c${i}`].value as THREE.Color).copy(untone(p.sky[i]));
    }
    this.skyMat.uniforms.sunDir.value.copy(dir);
    this.skyMat.uniforms.sunDisc.value = p.sunDisc;
    this.skyMat.uniforms.starInt.value = kind === "dusk" ? 0.85 : 0.0;
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

    const focusX = id <= 3 ? 0 : id <= 6 ? 90 : id <= 8 ? 180 : 270;
    this.applyLight(s.light, scene, focusX);

    // Ocean wave drift & clouds
    this.waterTex.offset.set(t * 0.015, t * 0.01);
    this.clouds.forEach((cl) => cl.lookAt(cam.position));

    // Zone 1: Tambora Pre-Eruption vs Cataclysmic Eruption (Shot 3!)
    if (id === 3) {
      const blast = smooth(u * 2.2);
      this.tamboraPeak.visible = blast < 0.65;
      this.tamboraPeak.position.y = 10.7 + blast * 4.5;
      this.tamboraPeak.scale.setScalar(Math.max(0.01, 1.0 - blast * 1.3));
      this.eruptionPlume.visible = true;
      const sc = 0.25 + 1.05 * glide(u);
      this.eruptionPlume.scale.set(sc * 0.9, sc, sc * 0.9);
      for (const lb of this.lavaBombs) {
        const lt = (u * 2.2 + lb.phase) % 1;
        lb.mesh.position.set(lb.vx * lt, lb.vy * lt - 5.2 * lt * lt, lb.vz * lt);
      }
    } else {
      this.tamboraPeak.visible = true;
      this.tamboraPeak.position.y = 10.7;
      this.tamboraPeak.scale.setScalar(1);
      this.eruptionPlume.visible = false;
    }

    for (const sp of this.smokePuffs) {
      sp.mesh.visible = id === 1 || id === 2;
      const cyc = (t * 0.35 + sp.offset) % 1;
      sp.mesh.position.set(Math.sin(cyc * 4 + sp.offset * 6) * 0.6, 12.6 + cyc * 5.2, -6.2);
      sp.mesh.scale.setScalar(0.5 + cyc * 1.1);
    }

    // Zone 2A: Rotating Earth Globe & expanding volcanic ash ring (Shot 4)
    this.earthObj.group.visible = id === 4;
    if (id === 4) {
      this.earthObj.globe.rotation.y = -2.2 + u * 2.4;
      this.earthObj.ashRing.rotation.y = t * 1.2;
      this.earthObj.ashRing.scale.setScalar(0.45 + 0.65 * smooth(u * 1.6));
    }

    // Zone 2B: Falling 3D Snowflakes in July 1816 Europe!
    const snowOn = id === 5 || id === 6;
    for (const sf of this.snowflakes) {
      sf.mesh.visible = snowOn;
      if (snowOn) {
        const fall = (sf.y0 - t * sf.sp * 1.8 + 30) % 9.5;
        sf.mesh.position.set(sf.x0 + Math.sin(t * 2.0 + sf.y0) * 0.45, 0.8 + fall, sf.z0);
      }
    }

    // Zone 3: Animated Wooden Draisine Bicycle + spinning spoked wheels!
    const bikeX = id === 7 ? 176.8 + u * 5.2 : id === 8 ? 176.5 + u * 8.6 : 178.0;
    this.bikeObj.group.position.set(bikeX, 0.72, 5.4);
    this.bikeObj.rearWheel.rotation.z = -bikeX * 2.2;
    this.bikeObj.frontWheel.rotation.z = -bikeX * 2.2;

    // Zone 4: Stormy Lightning flashes (Shot 9) & Finale props
    const flashBeat = (f % 36 < 5) || (f % 36 >= 9 && f % 36 < 12);
    this.lightningBolt.visible = id === 9 && flashBeat;
    this.glowingBook.visible = id === 10 || id === 11;
    this.finaleBike.visible = id === 11;

    // Floating Narrative Cards
    this.hookCard.visible = id === 1;
    this.dateCard.visible = id === 2;
    this.scaleCard.visible = id === 3;
    this.snowCard.visible = id === 5;
    this.bikeCard.visible = id === 7;
    this.frankCard.visible = id === 10;
    this.finaleCard.visible = id === 11;

    for (const card of [this.hookCard, this.dateCard, this.scaleCard, this.snowCard, this.bikeCard, this.frankCard, this.finaleCard]) {
      if (card.visible) {
        card.rotation.y = Math.atan2(cam.position.x - card.position.x, cam.position.z - card.position.z);
      }
    }

    // Hide all actors first
    for (const a of this.allActors) {
      a.mesh.visible = false;
      a.shadow.visible = false;
    }

    switch (id) {
      case 1: {
        this.hookCard.position.y = 5.0 + Math.sin(t * 2.4) * 0.1;
        this.setActor(this.sumbawa, true, -1.65, 0.75, 6.4, "amazed", "point", t * 0.9, 1, cam);
        this.setActor(this.drais, true, 1.65, 0.75, 6.4, "proud", "cheer", t * 1.0, -1, cam);
        break;
      }
      case 2: {
        this.dateCard.position.y = 9.8 + Math.sin(t * 2.2) * 0.1;
        this.setActor(this.sumbawa, true, -1.8, 0.75, 6.8, "amazed", "point", t * 0.8, 1, cam);
        break;
      }
      case 3: {
        this.scaleCard.position.y = 12.6 + Math.sin(t * 2.8) * 0.12;
        this.setActor(this.sumbawa, true, -2.2, 0.75, 7.2, "amazed", "stand", t * 1.4, 1, cam);
        break;
      }
      case 4: {
        break; // Pure dramatic 3D Earth Globe blanketed in ash!
      }
      case 5: {
        this.snowCard.position.y = 4.65 + Math.sin(t * 2.4) * 0.08;
        this.setActor(this.european, true, 90.0, 0.72, 6.8, "shiver", "shiver", t * 1.2, 0, cam);
        break;
      }
      case 6: {
        this.setActor(this.european, true, 89.6, 0.72, 6.6, "sad", "shiver", t * 0.9, 1, cam);
        break;
      }
      case 7: {
        this.bikeCard.position.y = 4.35 + Math.sin(t * 2.4) * 0.08;
        this.setActor(this.drais, true, bikeX - 0.1, 1.42, 5.45, "idea", "ride", t * 1.5, 1, cam, 0.92);
        break;
      }
      case 8: {
        this.setActor(this.drais, true, bikeX - 0.1, 1.42, 5.45, "proud", "ride", t * 1.8, 1, cam, 0.92);
        this.setActor(this.european, true, 183.5, 0.72, 7.2, "amazed", "cheer", t * 1.2, -1, cam);
        break;
      }
      case 9: {
        this.setActor(this.shelley, true, 270.0, 0.72, 6.8, "focused", "stand", t * 0.8, 0, cam);
        break;
      }
      case 10: {
        this.frankCard.position.y = 4.2 + Math.sin(t * 2.2) * 0.07;
        this.setActor(this.shelley, true, 268.75, 0.72, 6.6, "focused", "write", t * 1.3, 1, cam);
        const pop = smooth((u - 0.18) / 0.3);
        if (pop > 0.02) {
          this.setActor(this.frank, true, 271.25, 0.72, 6.5, "spooky_smile", "monster_wave", t * 1.1, -1, cam, 0.2 + 0.85 * pop);
        }
        return V(270.0, 2.0, 6.6);
      }
      default: {
        this.finaleCard.position.y = 5.3 + Math.sin(t * 2.2) * 0.08;
        this.setActor(this.drais, true, 267.95, 1.32, 6.95, "proud", "ride", t * 1.1, 1, cam, 0.84);
        this.setActor(this.shelley, true, 270.05, 0.72, 7.45, "smile", "cheer", t * 1.0, 0, cam, 0.94);
        this.setActor(this.frank, true, 271.95, 0.72, 6.85, "spooky_smile", "monster_wave", t * 1.1, -1, cam, 0.98);
        return V(270.0, 2.2, 7.0);
      }
    }

    return look;
  }
}
