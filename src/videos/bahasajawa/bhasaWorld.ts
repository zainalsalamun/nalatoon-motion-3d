import * as THREE from "three";
import { NOINK } from "../bridge/ink";
import { TONE, twoTone, untone } from "../bridge/shade";
import { water, cloudHD, stone, roof } from "../bridge/paint";
import { CAFE_LIGHTS, CafeLight, dirFromAngles } from "../cafe/cafeLights";
import { SHOTS, FPS, camAt, clamp01, smooth } from "./story";
import {
  drawBhasaCharacter, Role, Mood, Pose,
  makeBhasaHookTex, makeAustronesiaTex, makeFamilyTex,
  makeKawiSanskritTex, makeSukabumiTex, makeHanacarakaCardTex,
  makeUnggahCardTex, makeEtikaTex, makeGlobalJavaTex, makeBhasaFinaleTex,
} from "./bhasaToon";

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

const addTree = (parent: THREE.Object3D, x: number, y: number, z: number, sc = 1.0, col = "#4aa83e") => {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(sc);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 1.9, 8), makeMat("#7a4e32"));
  trunk.position.y = 0.95;
  trunk.castShadow = true;
  g.add(trunk);
  const leaf = makeMat(col);
  for (const [lx, ly, lz, r] of [[0, 2.35, 0, 1.05], [-0.65, 1.95, 0.25, 0.72], [0.68, 2.0, -0.2, 0.75]] as [number, number, number, number][]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), leaf);
    s.position.set(lx, ly, lz);
    s.castShadow = true;
    g.add(s);
  }
  parent.add(g);
};

const buildOutriggerCanoe = () => {
  const g = new THREE.Group();
  const hull = makeMat("#8a5029");
  const bamboo = makeMat("#d9b466");
  const sailMat = makeMat("#f7e7c2");

  // Main wooden canoe hull + curved prow & stern
  addBox(g, 4.8, 0.72, 1.25, hull, 0, 0.36, 0);
  addBox(g, 0.85, 0.95, 0.85, hull, -2.55, 0.62, 0);
  addBox(g, 0.85, 0.95, 0.85, hull, 2.55, 0.62, 0);

  // Dual traditional Austronesian bamboo outriggers (Cadik!)
  for (const sz of [-1.45, 1.45]) {
    const floatBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.2, 10), bamboo);
    floatBeam.rotation.z = Math.PI / 2;
    floatBeam.position.set(0, 0.14, sz);
    g.add(floatBeam);
    for (const sx of [-1.1, 1.1]) {
      addBox(g, 0.12, 0.12, 1.6, bamboo, sx, 0.45, sz * 0.5, 0, false);
    }
  }

  // Mast & woven Austronesian tanja sail
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.8, 8), makeMat("#5c361d"));
  mast.position.set(-0.2, 2.1, 0);
  g.add(mast);
  const sail = addBox(g, 0.12, 2.25, 2.15, sailMat, -0.32, 2.45, 0, 0.15);
  sail.rotation.x = 0.08;

  return g;
};

const buildGlobalJavaEarth = () => {
  const g = new THREE.Group();
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 512;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#2674c4";
  ctx.fillRect(0, 0, 1024, 512);

  // Stylized green continents
  ctx.fillStyle = "#52b346";
  ctx.strokeStyle = "#221626";
  ctx.lineWidth = 6;
  const blobs: [number, number, number, number][] = [
    [220, 175, 92, 68], [285, 325, 68, 95],   // Americas (Suriname at 315, 258!)
    [540, 150, 95, 58], [560, 290, 75, 95],   // Europe & Africa
    [710, 175, 128, 80], [815, 360, 68, 52],  // Asia & Australia
  ];
  for (const [bx, by, rx, ry] of blobs) {
    ctx.beginPath();
    ctx.ellipse(bx, by, rx, ry, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Highlighted golden Java + Suriname + New Caledonia markers!
  ctx.fillStyle = "#ffd954";
  ctx.fillRect(748, 278, 88, 20);
  for (const [mx, my, col] of [[785, 292, "#ff3b28"], [315, 258, "#ffdf5e"], [910, 342, "#7ce0ff"]] as [number, number, string][]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(mx, my, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 28, 20),
    twoTone(new THREE.MeshLambertMaterial({ map: tex })),
  );
  g.add(globe);

  // Glowing golden diaspora orbit arcs around Earth!
  const arcMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.75, 0.45) });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(3.85, 0.065, 10, 48), arcMat);
  ring1.rotation.set(1.28, 0.3, 0);
  ring1.layers.set(NOINK);
  g.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(4.15, 0.055, 10, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.9, 2.5) }));
  ring2.rotation.set(1.55, -0.45, 0.2);
  ring2.layers.set(NOINK);
  g.add(ring2);

  return { group: g, globe, ring1, ring2 };
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

export class BahasaJawaWorld {
  root = new THREE.Group();
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bdd4f0", 38, 320);
  private waterTex: THREE.Texture;
  private clouds: THREE.Mesh[] = [];

  // Animated 3D Props
  private canoe: THREE.Group;
  private earthObj: { group: THREE.Group; globe: THREE.Mesh; ring1: THREE.Mesh; ring2: THREE.Mesh };
  private stepsGroup: THREE.Group;

  // Floating Linguistic Showcase Cards
  private hookCard: THREE.Mesh;
  private austroCard: THREE.Mesh;
  private familyCard: THREE.Mesh;
  private kawiCard: THREE.Mesh;
  private sukabumiCard: THREE.Mesh;
  private hanacarakaCard: THREE.Mesh;
  private unggahCard: THREE.Mesh;
  private etikaCard: THREE.Mesh;
  private globalCard: THREE.Mesh;
  private finaleCard: THREE.Mesh;

  // Actors
  private pelaut: ActorSlot;
  private pujangga: ActorSlot;
  private keraton: ActorSlot;
  private muda: ActorSlot;
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

    // 2. Sky Dome & Fluffy Clouds
    const sky = buildSkyDome();
    this.skyMat = sky.mat;
    this.root.add(sky.mesh);

    const clTex = cloudHD(2);
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

    // 3. Endless Painted Archipelago Ocean (y = 0)
    this.waterTex = water().clone();
    this.waterTex.repeat.set(60, 40);
    this.waterTex.needsUpdate = true;
    const oceanMat = twoTone(new THREE.MeshLambertMaterial({ map: this.waterTex, color: "#3b9de6" }));
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(760, 460), oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(135, 0, 0);
    ocean.receiveShadow = true;
    ocean.layers.set(NOINK);
    this.root.add(ocean);

    // =========================================================
    // ZONE 1 (x = 0): PELAYARAN AUSTRONESIA & PERAHU BERCADIK 3D
    // =========================================================
    this.canoe = this.buildZone1Austronesia();

    // =========================================================
    // ZONE 2 (x = 90): PRASASTI SUKABUMI 804 M & PAVILIUN KAWI
    // =========================================================
    this.buildZone2PrasastiKawi();

    // =========================================================
    // ZONE 3 (x = 180): PENDOPO JOGLO MATARAM & TANGGA UNGGAH-UNGGUH
    // =========================================================
    this.stepsGroup = this.buildZone3PendopoMataram();

    // =========================================================
    // ZONE 4 (x = 270): GLOBE GLOBAL JAVA + MODERN JOGLO FINALE
    // =========================================================
    this.earthObj = buildGlobalJavaEarth();
    this.earthObj.group.position.set(270.0, 6.2, -24.0);
    this.root.add(this.earthObj.group);
    this.buildZone4ModernFinale();

    // 4. Floating Narrative Cards (all cleanly sized for 9:16!)
    this.hookCard = makeFloatingCard(makeBhasaHookTex(), 4.2, 1.53);
    this.hookCard.position.set(0.0, 4.4, 5.2);
    this.root.add(this.hookCard);

    this.austroCard = makeFloatingCard(makeAustronesiaTex(), 4.1, 1.07);
    this.austroCard.position.set(0.0, 4.5, 4.5);
    this.root.add(this.austroCard);

    this.familyCard = makeFloatingCard(makeFamilyTex(), 4.1, 1.07);
    this.familyCard.position.set(0.0, 4.5, 4.8);
    this.root.add(this.familyCard);

    this.kawiCard = makeFloatingCard(makeKawiSanskritTex(), 3.6, 0.94);
    this.kawiCard.position.set(90.0, 4.45, 5.4);
    this.root.add(this.kawiCard);

    this.sukabumiCard = makeFloatingCard(makeSukabumiTex(), 3.3, 0.86);
    this.sukabumiCard.position.set(90.0, 4.35, 5.4);
    this.root.add(this.sukabumiCard);

    this.hanacarakaCard = makeFloatingCard(makeHanacarakaCardTex(), 3.45, 1.54);
    this.hanacarakaCard.position.set(90.0, 4.25, 5.6);
    this.root.add(this.hanacarakaCard);

    this.unggahCard = makeFloatingCard(makeUnggahCardTex(), 3.55, 1.44);
    this.unggahCard.position.set(180.0, 4.3, 7.6);
    this.root.add(this.unggahCard);

    this.etikaCard = makeFloatingCard(makeEtikaTex(), 3.4, 0.89);
    this.etikaCard.position.set(180.0, 4.15, 7.4);
    this.root.add(this.etikaCard);

    this.globalCard = makeFloatingCard(makeGlobalJavaTex(), 4.5, 1.18);
    this.globalCard.position.set(270.0, 10.6, -24.0);
    this.root.add(this.globalCard);

    this.finaleCard = makeFloatingCard(makeBhasaFinaleTex(), 4.6, 1.2);
    this.finaleCard.position.set(270.0, 5.4, 5.4);
    this.root.add(this.finaleCard);

    // 5. Actors
    this.pelaut = makeActor("pelaut", 1.85);
    this.pujangga = makeActor("pujangga", 1.85);
    this.keraton = makeActor("keraton", 1.88);
    this.muda = makeActor("muda", 1.85);
    this.allActors = [this.pelaut, this.pujangga, this.keraton, this.muda];
    for (const a of this.allActors) {
      this.root.add(a.mesh);
      this.root.add(a.shadow);
    }
  }

  private buildZone1Austronesia() {
    const sand = makeMat("#efd392");
    const grass = makeMat("#52ad42");

    // Tropical Nusantara Island background + beach
    const beach = new THREE.Mesh(new THREE.CylinderGeometry(12.0, 13.5, 0.7, 32), sand);
    beach.scale.set(1.3, 1, 0.75);
    beach.position.set(0, 0.35, -6.5);
    this.root.add(beach);

    const hill = new THREE.Mesh(new THREE.SphereGeometry(7.5, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), grass);
    hill.scale.set(1.4, 0.65, 0.85);
    hill.position.set(0, 0.65, -7.8);
    this.root.add(hill);

    for (const [tx, tz, sc] of [[-5.2, -3.5, 1.0], [5.4, -3.8, 1.05], [-2.0, -5.2, 0.95], [2.4, -5.0, 0.9]] as [number, number, number][]) {
      addTree(this.root, tx, 0.7, tz, sc, "#46a13b");
    }

    // Wooden coastal jetty for Hook characters at z = 6.2
    addBox(this.root, 7.2, 0.32, 3.8, makeMat("#a86e3c"), 0.0, 0.56, 6.8);

    // Traditional 3D Austronesian Outrigger Canoe (Perahu Bercadik!) angled cleanly so sail shines!
    const canoe = buildOutriggerCanoe();
    canoe.position.set(-0.2, 0.08, 3.2);
    canoe.rotation.y = 0.28;
    this.root.add(canoe);
    return canoe;
  }

  private buildZone2PrasastiKawi() {
    const cx = 90;
    const stoneTex = stone();
    const andesite = twoTone(new THREE.MeshLambertMaterial({ map: stoneTex, color: "#9c968e" }));
    const andesiteDark = makeMat("#66625c");
    const grass = makeMat("#56a342");
    const runeGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.1, 1.65, 0.45) });

    // Ancient Kediri courtyard terrace
    addBox(this.root, 26, 0.9, 20, grass, cx, 0.25, 3.5, 0, false);
    addBox(this.root, 12.5, 0.22, 10.5, andesite, cx, 0.78, 3.6, 0, false);

    // Classic Javanese Candi Stone Wall Backdrop
    addBox(this.root, 10.5, 3.6, 1.2, andesite, cx, 2.6, -1.6);
    for (const sx of [-4.6, 4.6]) {
      const finial = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.5, 4), andesiteDark);
      finial.position.set(cx + sx, 5.15, -1.6);
      finial.rotation.y = Math.PI / 4;
      this.root.add(finial);
    }

    // HERO 3D PRASASTI SUKABUMI (25 MARET 804 M) STONE STELE!
    const stele = new THREE.Group();
    stele.position.set(cx, 0.9, 3.8);
    // Lotus pedestal base
    addBox(stele, 2.2, 0.42, 1.15, andesiteDark, 0, 0.21, 0);
    // Tall carved stone tablet + pointed sacred Kawi crown top!
    addBox(stele, 1.68, 2.2, 0.48, andesite, 0, 1.52, 0);
    const crownTop = new THREE.Mesh(new THREE.ConeGeometry(1.18, 0.85, 4), andesite);
    crownTop.scale.set(1.0, 1.0, 0.42);
    crownTop.rotation.y = Math.PI / 4;
    crownTop.position.set(0, 3.04, 0);
    stele.add(crownTop);

    // Glowing Golden Carved Kawi Inscription Lines on Front of Prasasti!
    for (let r = 0; r < 5; r++) {
      const wLine = r === 0 ? 0.85 : 1.15 - (r % 2) * 0.15;
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(wLine, 0.1), runeGlow);
      bar.position.set(0, 2.35 - r * 0.34, 0.26);
      bar.layers.set(NOINK);
      stele.add(bar);
    }
    this.root.add(stele);

    addTree(this.root, cx - 7.0, 0.7, 1.5, 1.0, "#46993c");
    addTree(this.root, cx + 7.2, 0.7, 1.2, 1.05, "#52ab44");
  }

  private buildZone3PendopoMataram() {
    const cx = 180;
    const grass = makeMat("#529e40");
    const marbleFloor = makeMat("#dfd3bc");
    const teak = makeMat("#784828");
    const roofTile = twoTone(new THREE.MeshLambertMaterial({ map: roof("#b84c30"), color: "#c9593a" }));
    const lampGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.72, 0.55) });

    // Keraton Courtyard
    addBox(this.root, 28, 0.9, 22, grass, cx, 0.25, 3.5, 0, false);
    addBox(this.root, 15.0, 0.3, 12.0, marbleFloor, cx, 0.82, 2.5, 0, false);

    // --- MAJESTIC 3D ROYAL MATARAM PENDOPO JOGLO ---
    const joglo = new THREE.Group();
    joglo.position.set(cx, 0.95, 0.4);
    // 4 Teakwood Soko Guru columns + outer veranda columns
    for (const px of [-4.2, -1.8, 1.8, 4.2]) {
      for (const pz of [-2.4, 2.4]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 3.2, 10), teak);
        col.position.set(px, 1.6, pz);
        col.castShadow = true;
        joglo.add(col);
      }
    }
    // Lower wide trapezoidal Joglo eaves roof
    const lowerRoof = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 7.6, 1.8, 4), roofTile);
    lowerRoof.position.set(0, 4.0, 0);
    lowerRoof.rotation.y = Math.PI / 4;
    joglo.add(lowerRoof);
    // Iconic Steep Soaring Central Joglo Crown Roof (Brunjung!)
    const upperRoof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.9, 4), roofTile);
    upperRoof.position.set(0, 6.3, 0);
    upperRoof.rotation.y = Math.PI / 4;
    joglo.add(upperRoof);
    // Golden Roof Finial (Mustaka) & Hanging Warm Brass Pendopo Lamps!
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), lampGlow);
    fin.position.set(0, 7.85, 0);
    joglo.add(fin);
    for (const lx of [-2.4, 0, 2.4]) {
      const lmp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), lampGlow);
      lmp.position.set(lx, 2.85, 2.0);
      lmp.layers.set(NOINK);
      joglo.add(lmp);
    }
    this.root.add(joglo);

    // --- 3 ASCENDING 3D UNGGAH-UNGGUH STEPS (NGOKO -> MADYA -> KRAMA!) ---
    const stepsGroup = new THREE.Group();
    stepsGroup.position.set(cx, 0.96, 6.2);
    addBox(stepsGroup, 1.65, 0.45, 1.25, makeMat("#2e75a8"), -1.85, 0.225, 0); // Step 1: NGOKO
    addBox(stepsGroup, 1.65, 0.95, 1.25, makeMat("#c47c28"), 0.0,   0.475, 0); // Step 2: MADYA
    addBox(stepsGroup, 1.65, 1.48, 1.25, makeMat("#a82c3e"), 1.85,  0.74,  0); // Step 3: KRAMA
    this.root.add(stepsGroup);

    addTree(this.root, cx - 7.8, 0.7, 2.2, 1.0, "#46993c");
    addTree(this.root, cx + 7.8, 0.7, 2.0, 1.05, "#52ab44");
    return stepsGroup;
  }

  private buildZone4ModernFinale() {
    const cx = 270;
    const stonePlaza = twoTone(new THREE.MeshLambertMaterial({ map: stone(), color: "#cbc2b4" }));
    const roofTile = twoTone(new THREE.MeshLambertMaterial({ map: roof("#b84c30"), color: "#c9593a" }));
    const winGold = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.8, 0.75) });
    const winCyan = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 1.85, 2.5) });

    // Twilight Heritage-Meets-Modern Plaza
    addBox(this.root, 28, 0.9, 20, stonePlaza, cx, 0.25, 4.0, 0, false);

    // Illuminated Joglo Pavilion Centerpiece
    const miniJoglo = new THREE.Group();
    miniJoglo.position.set(cx, 0.7, 1.8);
    for (const px of [-2.4, 2.4]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 2.8, 10), makeMat("#7a4a2a"));
      col.position.set(px, 1.4, 0);
      miniJoglo.add(col);
    }
    const r1 = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 4.6, 1.2, 4), roofTile);
    r1.position.y = 3.25;
    r1.rotation.y = Math.PI / 4;
    miniJoglo.add(r1);
    const r2 = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.0, 4), roofTile);
    r2.position.y = 4.75;
    r2.rotation.y = Math.PI / 4;
    miniJoglo.add(r2);
    this.root.add(miniJoglo);

    // Glowing Modern Javanese Skyline Towers rising behind the Heritage Joglo!
    const towers: [number, number, number, number, string, "gold" | "cyan"][] = [
      [-6.8, -3.5, 2.6, 13.5, "#334770", "gold"],
      [-3.5, -5.2, 2.8, 16.5, "#3b4e78", "cyan"],
      [0.0,  -6.2, 3.0, 18.0, "#2f4269", "gold"],
      [3.6,  -5.0, 2.8, 15.8, "#384c75", "cyan"],
      [6.8,  -3.2, 2.6, 12.8, "#41547d", "gold"],
    ];
    for (const [tx, tz, tw, th, col, wt] of towers) {
      const tg = new THREE.Group();
      tg.position.set(cx + tx, 0.7, tz);
      addBox(tg, tw, th, tw, makeMat(col), 0, th * 0.5, 0);
      const wMat = wt === "gold" ? winGold : winCyan;
      for (let r = 1; r < Math.floor(th / 1.2); r++) {
        if (r % 4 === 0) continue;
        const st = new THREE.Mesh(new THREE.PlaneGeometry(tw * 0.72, 0.34), wMat);
        st.position.set(0, r * 1.15, tw * 0.51);
        st.layers.set(NOINK);
        tg.add(st);
      }
      this.root.add(tg);
    }
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
      drawBhasaCharacter(a.ctx, a.role, mood, pose, phase, dir);
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
    this.skyMat.uniforms.starInt.value = kind === "dusk" ? 0.9 : 0.0;
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

    const focusX = id <= 3 ? 0 : id <= 6 ? 90 : id <= 9 ? 180 : 270;
    this.applyLight(s.light, scene, focusX);

    // Ocean waves & drifting clouds
    this.waterTex.offset.set(t * 0.015, t * 0.01);
    this.clouds.forEach((cl) => cl.lookAt(cam.position));

    // Canoe gentle bobbing on Austronesian waves
    this.canoe.position.y = 0.08 + Math.sin(t * 1.6) * 0.14;
    this.canoe.rotation.z = Math.sin(t * 1.2) * 0.045;

    // 3D Steps shown only in Shot 8 (Unggah-Ungguh showcase)
    this.stepsGroup.visible = id === 8;

    // Global Java Earth Globe (Shot 10)
    this.earthObj.group.visible = id === 10;
    if (id === 10) {
      this.earthObj.globe.rotation.y = -2.1 + u * 2.6;
      this.earthObj.ring1.rotation.z = t * 0.7;
      this.earthObj.ring2.rotation.z = -t * 0.6;
    }

    // Floating narrative cards visibility
    this.hookCard.visible = id === 1;
    this.austroCard.visible = id === 2;
    this.familyCard.visible = id === 3;
    this.kawiCard.visible = id === 4;
    this.sukabumiCard.visible = id === 5;
    this.hanacarakaCard.visible = id === 6;
    this.unggahCard.visible = id === 8;
    this.etikaCard.visible = id === 9;
    this.globalCard.visible = id === 10;
    this.finaleCard.visible = id === 11;

    for (const card of [
      this.hookCard, this.austroCard, this.familyCard, this.kawiCard,
      this.sukabumiCard, this.hanacarakaCard, this.unggahCard,
      this.etikaCard, this.globalCard, this.finaleCard,
    ]) {
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
        this.hookCard.position.y = 4.45 + Math.sin(t * 2.4) * 0.08;
        this.setActor(this.keraton, true, -1.5, 0.72, 6.6, "respect", "salam", t * 0.8, 1, cam);
        this.setActor(this.muda, true, 1.5, 0.72, 6.6, "proud", "cheer", t * 1.1, -1, cam);
        break;
      }
      case 2: {
        this.austroCard.position.y = 4.55 + Math.sin(t * 2.2) * 0.08;
        this.setActor(this.pelaut, true, 0.85, 0.75 + Math.sin(t * 1.6) * 0.14, 3.3, "proud", "paddle", t * 1.1, 1, cam);
        break;
      }
      case 3: {
        this.familyCard.position.y = 4.55 + Math.sin(t * 2.2) * 0.08;
        this.setActor(this.pelaut, true, -1.2, 0.72, 6.6, "smile", "point", t * 0.9, 1, cam);
        this.setActor(this.muda, true, 1.3, 0.72, 6.6, "amazed", "stand", t * 0.9, -1, cam);
        break;
      }
      case 4: {
        this.kawiCard.position.y = 4.3 + Math.sin(t * 2.2) * 0.08;
        this.setActor(this.pujangga, true, 88.2, 0.9, 5.6, "focused", "write_lontar", t * 1.0, 1, cam);
        break;
      }
      case 5: {
        this.sukabumiCard.position.y = 4.2 + Math.sin(t * 2.2) * 0.07;
        this.setActor(this.pujangga, true, 88.3, 0.9, 5.4, "proud", "point", t * 0.9, 1, cam);
        return V(90.0, 2.2, 4.6);
      }
      case 6: {
        const pop = smooth((u - 0.08) / 0.25);
        this.hanacarakaCard.scale.setScalar(0.15 + 0.85 * pop);
        this.hanacarakaCard.position.y = 4.05 + Math.sin(t * 2.2) * 0.06;
        this.setActor(this.pujangga, true, 90.0, 0.9, 6.2, "peaceful", "write_lontar", t * 1.1, 0, cam);
        return V(90.0, 2.3, 5.4);
      }
      case 7: {
        this.setActor(this.keraton, true, 180.0, 0.95, 4.4, "respect", "salam", t * 0.8, 0, cam);
        break;
      }
      case 8: {
        this.unggahCard.position.y = 4.3 + Math.sin(t * 2.2) * 0.06;
        // Muda stands on NGOKO step (left), Keraton noble stands politely on KRAMA step (right)!
        this.setActor(this.muda, true, 178.15, 1.41, 6.2, "smile", "cheer", t * 1.0, 1, cam, 0.88);
        this.setActor(this.keraton, true, 181.85, 2.44, 6.2, "respect", "bow", t * 0.8, -1, cam, 0.88);
        return V(180.0, 2.5, 6.2);
      }
      case 9: {
        this.etikaCard.position.y = 4.25 + Math.sin(t * 2.2) * 0.07;
        this.setActor(this.muda, true, 178.7, 0.95, 5.8, "respect", "bow", t * 0.8, 1, cam);
        this.setActor(this.keraton, true, 181.3, 0.95, 5.8, "peaceful", "salam", t * 0.8, -1, cam);
        return V(180.0, 2.1, 5.8);
      }
      case 10: {
        this.globalCard.position.y = 10.55 + Math.sin(t * 2.2) * 0.08;
        break;
      }
      default: {
        this.finaleCard.position.y = 5.45 + Math.sin(t * 2.2) * 0.08;
        this.setActor(this.pujangga, true, 267.9, 0.72, 6.2, "peaceful", "write_lontar", t * 0.9, 1, cam, 0.94);
        this.setActor(this.keraton, true, 270.0, 0.72, 6.6, "respect", "salam", t * 0.9, 0, cam, 1.0);
        this.setActor(this.muda, true, 272.1, 0.72, 6.2, "proud", "cheer", t * 1.1, -1, cam, 0.96);
        return V(270.0, 2.3, 6.4);
      }
    }

    return look;
  }
}
