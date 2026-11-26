import * as THREE from "three";
import { NOINK } from "../bridge/ink";
import { TONE, twoTone, untone } from "../bridge/shade";
import { planksHD, water, cloudHD, stone, roof } from "../bridge/paint";
import { CAFE_LIGHTS, CafeLight, dirFromAngles } from "../cafe/cafeLights";
import { SHOTS, FPS, camAt, clamp01, smooth, glide } from "./story";
import {
  drawJawaCharacter, Role, Mood, Pose,
  makeJawaHookTex, makeSundaBadgeTex, makeYawadwipaBadgeTex,
  makeMajapahitBadgeTex, makeProklamasiBadgeTex, makeModernBadgeTex,
} from "./jawaToon";

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

const addTree = (parent: THREE.Object3D, x: number, y: number, z: number, sc = 1.0, col = "#4ca83e") => {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(sc);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 1.9, 8), makeMat("#7a4e32"));
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

export class JawaWorld {
  root = new THREE.Group();
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bdd4f0", 38, 320);
  private waterTex: THREE.Texture;
  private clouds: THREE.Mesh[] = [];

  // Animated Elements across the 4 Eras
  private smokePuffs: { mesh: THREE.Mesh; offset: number }[] = [];
  private lavaGlowMat: THREE.MeshBasicMaterial;
  private jongShip: THREE.Group;
  private trainGroup: THREE.Group;
  private trainSteam: { mesh: THREE.Mesh; offset: number }[] = [];
  private flagRed: THREE.Mesh;
  private flagWhite: THREE.Mesh;
  private monasGroup: THREE.Group;
  private cityTowers: { mesh: THREE.Group; delay: number }[] = [];

  // Floating Cards
  private hookCard: THREE.Mesh;
  private sundaCard: THREE.Mesh;
  private yawaCard: THREE.Mesh;
  private majapahitCard: THREE.Mesh;
  private proklamasiCard: THREE.Mesh;
  private modernCard: THREE.Mesh;

  // Actors
  private purba: ActorSlot;
  private petani: ActorSlot;
  private majapahit: ActorSlot;
  private wali: ActorSlot;
  private pemuda: ActorSlot;
  private modern: ActorSlot;
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

    // 2. Sky Dome & Clouds spanning all 4 zones (x = 0..270)
    const sky = buildSkyDome();
    this.skyMat = sky.mat;
    this.root.add(sky.mesh);

    const clTex = cloudHD(3);
    const clMat = new THREE.MeshBasicMaterial({ map: clTex, transparent: true, opacity: 0.9, depthWrite: false });
    const cloudSpecs: [number, number, number, number][] = [
      [-18, 25, -44, 26], [22, 27, -48, 28],
      [75, 25, -44, 26], [112, 26, -46, 28],
      [165, 25, -42, 26], [198, 27, -46, 26],
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
    const oceanMat = twoTone(new THREE.MeshLambertMaterial({ map: this.waterTex, color: "#3d9ee6" }));
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(760, 460), oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(135, 0, 0);
    ocean.receiveShadow = true;
    ocean.layers.set(NOINK);
    this.root.add(ocean);

    // =========================================================
    // ZONE 1 (x = 0): JAWA PURBA, GUNUNG BERAPI & SAWAH TERASERING
    // =========================================================
    this.lavaGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.72, 0.16) });
    this.buildZone1AncientJava();

    // =========================================================
    // ZONE 2 (x = 90): CANDI BOROBUDUR 3D & GAPURA MAJAPAHIT
    // =========================================================
    this.jongShip = this.buildZone2Kingdoms();

    // =========================================================
    // ZONE 3 (x = 180): MASJID AGUNG DEMAK & KERETA UAP KOLONIAL
    // =========================================================
    this.trainGroup = this.buildZone3DemakAndTrain();

    // =========================================================
    // ZONE 4 (x = 270): PROKLAMASI 1945, MONAS 3D & SKYLINE MODERN
    // =========================================================
    const z4 = this.buildZone4ModernJava();
    this.flagRed = z4.flagRed;
    this.flagWhite = z4.flagWhite;
    this.monasGroup = z4.monasGroup;

    // 4. Floating Narrative Cards (cleanly proportioned for 9:16!)
    this.hookCard = makeFloatingCard(makeJawaHookTex(), 4.8, 1.7);
    this.hookCard.position.set(0.0, 5.4, 5.6);
    this.root.add(this.hookCard);

    this.sundaCard = makeFloatingCard(makeSundaBadgeTex(), 3.6, 0.96);
    this.sundaCard.position.set(-0.6, 3.85, 5.4);
    this.root.add(this.sundaCard);

    this.yawaCard = makeFloatingCard(makeYawadwipaBadgeTex(), 3.2, 0.86);
    this.yawaCard.position.set(1.4, 3.45, 5.8);
    this.root.add(this.yawaCard);

    this.majapahitCard = makeFloatingCard(makeMajapahitBadgeTex(), 3.6, 0.96);
    this.majapahitCard.position.set(103.5, 4.85, 4.2);
    this.root.add(this.majapahitCard);

    this.proklamasiCard = makeFloatingCard(makeProklamasiBadgeTex(), 3.5, 0.94);
    this.proklamasiCard.position.set(270.0, 4.45, 11.2);
    this.root.add(this.proklamasiCard);

    this.modernCard = makeFloatingCard(makeModernBadgeTex(), 4.5, 1.2);
    this.modernCard.position.set(270.0, 6.2, 13.5);
    this.root.add(this.modernCard);

    // 5. Actors
    this.purba = makeActor("purba", 1.85);
    this.petani = makeActor("petani", 1.85);
    this.majapahit = makeActor("majapahit", 1.9);
    this.wali = makeActor("wali", 1.85);
    this.pemuda = makeActor("pemuda", 1.88);
    this.modern = makeActor("modern", 1.88);
    this.allActors = [this.purba, this.petani, this.majapahit, this.wali, this.pemuda, this.modern];
    for (const a of this.allActors) {
      this.root.add(a.mesh);
      this.root.add(a.shadow);
    }
  }

  private buildZone1AncientJava() {
    const sand = makeMat("#efd392");
    const grass1 = makeMat("#56ad40");
    const grass2 = makeMat("#459134");
    const paddyGold = makeMat("#d8c24e");
    const paddyLush = makeMat("#74c947");
    const rockDark = makeMat("#4b505c");

    // Wide Java island beach base
    const beach = new THREE.Mesh(new THREE.CylinderGeometry(14.5, 15.8, 0.7, 36), sand);
    beach.scale.set(1.35, 1, 0.92);
    beach.position.set(0, 0.35, -1.0);
    beach.receiveShadow = true;
    this.root.add(beach);

    // Stepped Emerald & Golden Terraced Rice Paddies (Sawah Terasering — positioned cleanly behind z = 4.5!)
    const terraces: [number, number, number, number, THREE.Material][] = [
      [11.2, 0.72, -3.4, 0.58, paddyLush],
      [9.0, 1.32, -4.4, 0.62, paddyGold],
      [7.0, 1.94, -5.2, 0.62, paddyLush],
      [5.2, 2.55, -6.0, 0.62, grass1],
    ];
    for (const [rx, ty, tz, th, mat] of terraces) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rx, rx + 0.8, th, 28), mat);
      m.scale.set(1.25, 1, 0.72);
      m.position.set(0, ty, tz);
      m.receiveShadow = true;
      this.root.add(m);
    }

    // Three Iconic Javanese Volcanic Peaks (flat-topped volcano caldera with nested glowing lava crater!)
    const mainVolc = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 7.2, 10.6, 22), rockDark);
    mainVolc.position.set(0.0, 6.0, -7.2);
    mainVolc.castShadow = true;
    this.root.add(mainVolc);
    // Nested glowing HDR lava rim inside flat caldera!
    const crater = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.25, 0.35, 18), this.lavaGlowMat);
    crater.position.set(0.0, 11.35, -7.2);
    crater.layers.set(NOINK);
    this.root.add(crater);

    // Side volcanic peaks
    const leftVolc = new THREE.Mesh(new THREE.ConeGeometry(5.8, 8.6, 18), makeMat("#4a6e54"));
    leftVolc.position.set(-8.6, 4.6, -8.8);
    this.root.add(leftVolc);
    const rightVolc = new THREE.Mesh(new THREE.ConeGeometry(5.2, 7.8, 18), makeMat("#42694d"));
    rightVolc.position.set(8.4, 4.2, -8.4);
    this.root.add(rightVolc);

    // Animated Rising Cartoon Volcanic Smoke Puffs!
    const smokeMat = makeMat("#e8e4f0");
    for (let i = 0; i < 6; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.95 + (i % 3) * 0.25, 14, 10), smokeMat);
      puff.position.set(0, 12.2 + i * 1.1, -7.2);
      this.root.add(puff);
      this.smokePuffs.push({ mesh: puff, offset: i / 6 });
    }

    // Lush Tropical Trees along sides & open foreground meadow (z = 4.5..10.5, y = 0.75)
    for (const [tx, ty, tz, sc] of [[-5.6, 0.75, 4.6, 0.95], [5.8, 0.75, 4.4, 1.0], [-7.8, 0.75, 6.4, 0.85], [7.2, 0.75, 6.6, 0.9]] as [number, number, number, number][]) {
      addTree(this.root, tx, ty, tz, sc, "#4aa83e");
    }
    addBox(this.root, 18.0, 0.4, 8.2, grass2, 0.0, 0.55, 6.6, 0, false);
  }

  private buildZone2Kingdoms() {
    const cx = 90;
    const stoneTex = stone();
    const andesite = twoTone(new THREE.MeshLambertMaterial({ map: stoneTex, color: "#9c9791" }));
    const andesiteDark = makeMat("#6e6a66");
    const grass = makeMat("#529e3f");

    // Green plain base for Mataram Kuno & Majapahit
    addBox(this.root, 36, 0.9, 26, grass, cx + 6, 0.25, 0, 0, false);

    // --- 3D CANDI BOROBUDUR (x = 88.5, z = -2.5) ---
    const boro = new THREE.Group();
    boro.position.set(88.5, 0.7, -2.5);

    // 4 Stepped Square Andesite Terraces
    const sqLevels: [number, number, number][] = [
      [11.2, 0.95, 0.475],
      [9.2, 0.9, 1.4],
      [7.4, 0.85, 2.275],
      [5.8, 0.8, 3.1],
    ];
    for (const [w, h, y] of sqLevels) {
      addBox(boro, w, h, w, andesite, 0, y, 0);
      // Corner mini-stupas on each balustrade
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const ms = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 8), andesiteDark);
        ms.position.set(sx * (w * 0.45), y + h * 0.5 + 0.25, sz * (w * 0.45));
        boro.add(ms);
      }
    }
    // Grand stepped stone staircase ascending Borobudur terraces + Kala archway!
    for (let st = 0; st < 5; st++) {
      addBox(boro, 1.55, 0.58, 0.95, andesiteDark, 0, 0.29 + st * 0.58, 5.75 - st * 0.65);
    }
    // Iconic stone archway gate at base of stairs
    addBox(boro, 0.36, 1.45, 0.55, andesite, -0.78, 0.72, 6.0);
    addBox(boro, 0.36, 1.45, 0.55, andesite, 0.78, 0.72, 6.0);
    addBox(boro, 2.05, 0.42, 0.65, andesiteDark, 0, 1.62, 6.0);

    // 2 Circular Upper Terraces + Ring of Iconic Bell-Shaped Stupas!
    const c1 = new THREE.Mesh(new THREE.CylinderGeometry(2.75, 2.95, 0.65, 24), andesite);
    c1.position.y = 3.82;
    boro.add(c1);
    const c2 = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 2.15, 0.6, 24), andesite);
    c2.position.y = 4.42;
    boro.add(c2);

    const addStupa = (sx: number, sy: number, sz: number, sc = 1.0) => {
      const sg = new THREE.Group();
      sg.position.set(sx, sy, sz);
      sg.scale.setScalar(sc);
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), andesite);
      bell.position.y = 0.05;
      sg.add(bell);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 10), andesiteDark);
      spire.position.y = 0.62;
      sg.add(spire);
      boro.add(sg);
    };
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      addStupa(Math.cos(a) * 2.35, 4.15, Math.sin(a) * 2.35, 0.72);
    }
    // Monumental Central Main Stupa!
    addStupa(0, 4.72, 0, 2.25);

    this.root.add(boro);
    addTree(this.root, 81.0, 0.7, 2.5, 1.05, "#449438");
    addTree(this.root, 95.5, 0.7, -5.2, 1.1, "#4ca83e");

    // --- GAPURA CANDI BENTAR MAJAPAHIT (x = 103.5, z = 4.2) ---
    const brick = makeMat("#b8452e");
    const brickTrim = makeMat("#8c311e");
    const goldMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.18, 0.3) });

    const gapura = new THREE.Group();
    gapura.position.set(103.5, 0.7, 3.2);
    // Twin symmetrical stepped terracotta split gate towers (Candi Bentar!)
    for (const side of [-1, 1]) {
      const gx = side * 2.15;
      addBox(gapura, 1.75, 1.2, 1.65, brick, gx, 0.6, 0);
      addBox(gapura, 1.45, 1.1, 1.4, brickTrim, gx + side * 0.12, 1.75, 0);
      addBox(gapura, 1.15, 1.0, 1.15, brick, gx + side * 0.24, 2.8, 0);
      addBox(gapura, 0.82, 0.85, 0.85, brickTrim, gx + side * 0.34, 3.7, 0);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.9, 4), brick);
      tip.position.set(gx + side * 0.4, 4.55, 0);
      tip.rotation.y = Math.PI / 4;
      gapura.add(tip);
    }
    // Surya Majapahit golden sun crest floating softly between pillars!
    const surya = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), goldMat);
    surya.position.set(0, 3.45, -0.4);
    gapura.add(surya);
    this.root.add(gapura);

    // 3D Nusantara Majapahit Jong Sailing Ship bobbing in bay behind Gapura!
    const jong = new THREE.Group();
    const hull = makeMat("#734222");
    const sailTan = makeMat("#e8c882");
    addBox(jong, 4.6, 1.2, 1.8, hull, 0, 0.6, 0);
    addBox(jong, 1.4, 0.8, 1.7, hull, 1.7, 1.4, 0);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.6, 8), makeMat("#54321c"));
    mast.position.set(-0.2, 3.0, 0);
    jong.add(mast);
    // Iconic slanted Nusantara tanja / jung sail
    addBox(jong, 0.12, 2.2, 2.5, sailTan, -0.35, 3.3, 0, 0.12);
    // Red-white Majapahit Gula Kelapa pennant banner!
    addBox(jong, 1.2, 0.22, 0.05, makeMat("#d92b2b"), 0.4, 5.2, 0, 0, false);
    addBox(jong, 1.2, 0.22, 0.05, makeMat("#ffffff"), 0.4, 4.98, 0, 0, false);
    jong.position.set(103.5, 0.06, -15.5);
    this.root.add(jong);

    return jong;
  }

  private buildZone3DemakAndTrain() {
    const cx = 180;
    const grass = makeMat("#57a343");
    const cobble = makeMat("#b5a68c");
    const roofTile = twoTone(new THREE.MeshLambertMaterial({ map: roof("#b85234"), color: "#c95b3a" }));
    const wallCream = makeMat("#f2e7d0");
    const teak = makeMat("#7a4a2a");
    const glowLamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.45, 0.55) });

    // Island ground + colonial trade road
    addBox(this.root, 34, 0.9, 26, grass, cx, 0.25, 0, 0, false);
    addBox(this.root, 34, 0.14, 7.6, cobble, cx, 0.74, 7.8, 0, false);

    // --- MASJID AGUNG DEMAK 3D (Authentic 3-Tier Javanese Tajug Pyramid Roof!) ---
    const masjid = new THREE.Group();
    masjid.position.set(178.0, 0.7, -1.6);
    // Raised stone base & main hall
    addBox(masjid, 8.6, 0.5, 7.6, makeMat("#9c907e"), 0, 0.25, 0);
    addBox(masjid, 6.2, 2.8, 5.6, wallCream, 0, 1.9, -0.4);
    // Veranda wooden Soko Guru pillars
    for (const px of [-3.4, -1.7, 1.7, 3.4]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 2.6, 10), teak);
      col.position.set(px, 1.8, 2.8);
      col.castShadow = true;
      masjid.add(col);
    }
    // 3-Tiered Iconic Tajug Pyramid Roofs (Mustaka finial on top!)
    const t1 = new THREE.Mesh(new THREE.ConeGeometry(6.5, 1.9, 4), roofTile);
    t1.position.set(0, 4.1, 0);
    t1.rotation.y = Math.PI / 4;
    t1.castShadow = true;
    masjid.add(t1);

    const t2 = new THREE.Mesh(new THREE.ConeGeometry(4.6, 1.7, 4), roofTile);
    t2.position.set(0, 5.55, 0);
    t2.rotation.y = Math.PI / 4;
    masjid.add(t2);

    const t3 = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.65, 4), roofTile);
    t3.position.set(0, 6.9, 0);
    t3.rotation.y = Math.PI / 4;
    masjid.add(t3);

    const mustaka = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), glowLamp);
    mustaka.position.set(0, 7.9, 0);
    masjid.add(mustaka);

    // Warm glowing veranda lanterns
    for (const lx of [-2.4, 0.0, 2.4]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), glowLamp);
      lamp.position.set(lx, 2.8, 2.85);
      lamp.layers.set(NOINK);
      masjid.add(lamp);
    }
    this.root.add(masjid);
    addTree(this.root, 171.2, 0.7, 1.6, 1.0, "#47993c");
    addTree(this.root, 185.0, 0.7, 1.2, 1.05, "#54ad42");

    // --- COLONIAL JAVA IRON RAILWAY & ANIMATED 3D STEAM LOCOMOTIVE (Shot 8) ---
    const railMat = makeMat("#4a4e5c");
    const tieMat = makeMat("#5c3a22");
    addBox(this.root, 34, 0.08, 0.14, railMat, cx, 0.85, 7.1, 0, false);
    addBox(this.root, 34, 0.08, 0.14, railMat, cx, 0.85, 8.1, 0, false);
    for (let tx = cx - 15; tx <= cx + 15; tx += 1.0) {
      addBox(this.root, 0.22, 0.06, 1.45, tieMat, tx, 0.82, 7.6, 0, false);
    }

    const train = new THREE.Group();
    train.position.set(174.0, 0.9, 7.6);
    const locoBlack = makeMat("#2c303d");
    const locoRed = makeMat("#c4332b");
    const brass = makeMat("#e8be42");
    const woodCar = makeMat("#9e5c30");

    // Steam boiler + cabin + smokestack + cowcatcher
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 2.6, 16), locoBlack);
    boiler.rotation.z = Math.PI / 2;
    boiler.position.set(0.6, 1.15, 0);
    boiler.castShadow = true;
    train.add(boiler);
    addBox(train, 1.5, 2.0, 1.5, locoRed, -1.25, 1.4, 0);
    addBox(train, 1.7, 0.18, 1.65, locoBlack, -1.25, 2.48, 0);
    addBox(train, 3.8, 0.35, 1.45, locoRed, 0.1, 0.42, 0);
    // Brass smokestack & headlamp
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.16, 1.0, 12), brass);
    stack.position.set(1.45, 2.0, 0);
    train.add(stack);
    const headlamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), glowLamp);
    headlamp.position.set(1.98, 1.25, 0);
    headlamp.layers.set(NOINK);
    train.add(headlamp);

    // Trailing wooden passenger coach
    addBox(train, 3.6, 1.75, 1.48, woodCar, -4.4, 1.32, 0);
    addBox(train, 3.8, 0.2, 1.6, locoBlack, -4.4, 2.28, 0);
    for (const wx of [-5.4, -4.4, -3.4]) {
      addBox(train, 0.62, 0.56, 1.52, glowLamp, wx, 1.45, 0, 0, false);
    }

    // Iron Wheels
    for (const wx of [1.4, 0.2, -1.2, -3.3, -5.5]) {
      for (const wz of [-0.72, 0.72]) {
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.14, 14), locoBlack);
        wh.rotation.x = Math.PI / 2;
        wh.position.set(wx, 0.36, wz);
        train.add(wh);
      }
    }

    // Cartoon Steam Puffs rising from smokestack!
    const steamMat = makeMat("#f5f7fc");
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.35 + i * 0.08, 12, 10), steamMat);
      p.position.set(1.45, 2.7 + i * 0.4, 0);
      train.add(p);
      this.trainSteam.push({ mesh: p, offset: i / 5 });
    }

    this.root.add(train);
    return train;
  }

  private buildZone4ModernJava() {
    const cx = 270;
    const stonePlaza = twoTone(new THREE.MeshLambertMaterial({ map: stone(), color: "#cbc3b6" }));
    const grass = makeMat("#458f48");

    // Wide Modern Java Island & Plaza
    addBox(this.root, 34, 1.0, 32, stonePlaza, cx, 0.25, 2.0, 0, false);
    addBox(this.root, 30, 0.16, 12, grass, cx, 0.8, 4.0, 0, false);

    // Distant twilight volcanic mountain silhouette behind modern skyline (ties back to Zone 1!)
    const bgVolc = new THREE.Mesh(new THREE.ConeGeometry(18, 22, 20), makeMat("#2c3859"));
    bgVolc.position.set(cx - 12, 10.0, -34);
    this.root.add(bgVolc);
    const bgVolc2 = new THREE.Mesh(new THREE.ConeGeometry(14, 17, 18), makeMat("#243052"));
    bgVolc2.position.set(cx + 14, 8.0, -32);
    this.root.add(bgVolc2);

    // --- PLAZA PROKLAMASI 1945 (z = 11.2): Tall Flagpole + Sang Saka Merah Putih! ---
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 6.0, 10), makeMat("#e8e4dc"));
    pole.position.set(cx - 1.65, 3.75, 11.2);
    this.root.add(pole);
    addBox(this.root, 0.9, 0.45, 0.9, stonePlaza, cx - 1.65, 0.98, 11.2);

    const flagRed = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.62, 0.06), makeMat("#e02424"));
    flagRed.position.set(cx - 0.55, 6.25, 11.2);
    this.root.add(flagRed);
    const flagWhite = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.62, 0.06), makeMat("#ffffff"));
    flagWhite.position.set(cx - 0.55, 5.63, 11.2);
    this.root.add(flagWhite);

    // --- ICONIC 3D MONAS (MONUMEN NASIONAL) + MODERN JAVA SKYLINE! ---
    const monasGroup = new THREE.Group();
    monasGroup.position.set(cx, 0.78, -2.5);

    const marble = makeMat("#f5f2eb");
    const marbleShade = makeMat("#d8d3c8");
    const flameGold = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.75, 0.35) }); // HDR Bloom Golden Flame!
    const winGold = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.15, 1.78, 0.75) });
    const winCyan = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 1.85, 2.5) });

    // Monas Centerpiece Tower (proportioned so full gleaming Golden Flame fits majestically in 9:16!)
    const monas = new THREE.Group();
    monas.position.set(0, 0, 1.5);
    addBox(monas, 5.2, 0.95, 5.2, marbleShade, 0, 0.475, 0);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 1.7, 1.5, 4), marble);
    cup.position.y = 1.7;
    cup.rotation.y = Math.PI / 4;
    monas.add(cup);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 1.02, 12.2, 4), marble);
    shaft.position.y = 8.4;
    shaft.rotation.y = Math.PI / 4;
    shaft.castShadow = true;
    monas.add(shaft);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 0.68, 0.8, 4), marbleShade);
    crown.position.y = 14.8;
    crown.rotation.y = Math.PI / 4;
    monas.add(crown);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.72, 2.7, 8), flameGold);
    flame.position.y = 16.5;
    flame.layers.set(NOINK);
    monas.add(flame);

    monasGroup.add(monas);
    this.cityTowers.push({ mesh: monas, delay: 0.0 });

    // Surrounding Modern Java Skyscrapers (Jakarta / Surabaya / Bandung!)
    const towerSpecs: [number, number, number, number, number, string, "gold" | "cyan", number][] = [
      [-5.2, -3.5, 2.8, 2.8, 16.5, "#364b75", "cyan", 0.08],
      [5.2, -3.2, 2.8, 2.8, 17.2, "#40527a", "gold", 0.1],
      [-8.6, -1.8, 2.6, 2.5, 12.8, "#2e4166", "gold", 0.16],
      [8.6, -1.5, 2.6, 2.5, 13.5, "#334770", "cyan", 0.18],
      [-4.6, 2.2, 2.4, 2.2, 10.6, "#3c5078", "gold", 0.22],
      [4.6, 2.4, 2.5, 2.2, 11.4, "#32466e", "cyan", 0.24],
      [-7.8, 3.6, 2.3, 2.1, 8.8, "#475980", "gold", 0.28],
      [7.8, 3.6, 2.3, 2.1, 9.2, "#394d75", "gold", 0.3],
      [-2.5, -7.2, 3.0, 2.8, 15.0, "#293a5e", "gold", 0.32],
      [2.8, -7.0, 3.0, 2.8, 15.6, "#2e4269", "cyan", 0.34],
    ];
    for (const [tx, tz, tw, td, th, col, wt, delay] of towerSpecs) {
      const tg = new THREE.Group();
      tg.position.set(tx, 0, tz);
      addBox(tg, tw, th, td, makeMat(col), 0, th * 0.5, 0);
      const wMat = wt === "gold" ? winGold : winCyan;
      const rows = Math.floor(th / 1.15);
      for (let r = 1; r < rows; r++) {
        if ((r + Math.round(tx)) % 5 === 0) continue;
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(tw * 0.74, 0.35), wMat);
        strip.position.set(0, r * 1.1, td * 0.51);
        strip.layers.set(NOINK);
        tg.add(strip);
      }
      monasGroup.add(tg);
      this.cityTowers.push({ mesh: tg, delay });
    }

    const cityGlow = new THREE.PointLight("#ffd06b", 5.5, 44);
    cityGlow.position.set(0, 7.5, 5.5);
    monasGroup.add(cityGlow);

    this.root.add(monasGroup);
    return { flagRed, flagWhite, monasGroup };
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
      drawJawaCharacter(a.ctx, a.role, mood, pose, phase, dir);
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

    const focusX = id <= 4 ? 0 : id <= 6 ? 90 : id <= 8 ? 180 : 270;
    this.applyLight(s.light, scene, focusX);

    // Ocean wave scroll & clouds facing camera
    this.waterTex.offset.set(t * 0.015, t * 0.01);
    this.clouds.forEach((cl) => cl.lookAt(cam.position));

    // Animate Volcanic Smoke Puffs (Zone 1)
    for (const sp of this.smokePuffs) {
      const cyc = (t * 0.35 + sp.offset) % 1;
      sp.mesh.position.set(Math.sin(cyc * 5.0 + sp.offset * 6) * 0.85, 11.6 + cyc * 6.5, -7.2);
      sp.mesh.scale.setScalar(0.55 + cyc * 1.15);
    }
    const lavaPulse = 1.0 + Math.sin(t * 5.0) * 0.16;
    this.lavaGlowMat.color.setRGB(2.1 * lavaPulse, 0.72 * lavaPulse, 0.16);

    // Majapahit Jong ship gentle ocean bobbing
    this.jongShip.position.y = 0.08 + Math.sin(t * 1.4) * 0.14;
    this.jongShip.rotation.z = Math.sin(t * 1.1) * 0.04;

    // Colonial Java Steam Train chugging across Shot 8!
    const trainX = id === 8 ? 173.5 + u * 13.5 : 174.0;
    this.trainGroup.position.x = trainX;
    this.trainGroup.position.y = 0.9 + Math.abs(Math.sin(t * 12.0)) * 0.04;
    for (const st of this.trainSteam) {
      const cyc = (t * 0.9 + st.offset) % 1;
      st.mesh.position.set(1.45 - cyc * 2.4, 2.55 + cyc * 2.2, 0);
      st.mesh.scale.setScalar(0.45 + cyc * 1.1);
    }

    // Waving Sang Saka Merah Putih (Shot 9)
    const wave = Math.sin(t * 6.5) * 0.08;
    this.flagRed.rotation.y = wave;
    this.flagWhite.rotation.y = wave;

    // Modern Monas & Java Skyline rise animation (Shots 10–11)
    if (id === 10) {
      this.monasGroup.visible = true;
      for (const tw of this.cityTowers) {
        const k = clamp01((u - 0.05 - tw.delay * 0.85) / 0.45);
        const rise = glide(k);
        tw.mesh.scale.set(1, Math.max(0.001, rise), 1);
        tw.mesh.visible = rise > 0.01;
      }
    } else if (id === 11) {
      this.monasGroup.visible = true;
      for (const tw of this.cityTowers) {
        tw.mesh.scale.set(1, 1, 1);
        tw.mesh.visible = true;
      }
    } else {
      this.monasGroup.visible = false;
    }

    // Floating narrative cards visibility & gentle camera orientation
    this.hookCard.visible = id === 1;
    this.sundaCard.visible = id === 2;
    this.yawaCard.visible = id === 4;
    this.majapahitCard.visible = id === 6;
    this.proklamasiCard.visible = id === 9;
    this.modernCard.visible = id === 11;

    for (const card of [this.hookCard, this.sundaCard, this.yawaCard, this.majapahitCard, this.proklamasiCard, this.modernCard]) {
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
        this.hookCard.position.y = 5.2 + Math.sin(t * 2.4) * 0.1;
        this.setActor(this.petani, true, -1.6, 0.75, 6.2, "smile", "hold_rice", t * 0.8, 1, cam);
        this.setActor(this.modern, true, 1.6, 0.75, 6.2, "proud", "cheer", t * 1.1, -1, cam);
        break;
      }
      case 2: {
        this.sundaCard.position.y = 3.9 + Math.sin(t * 2.2) * 0.08;
        this.setActor(this.purba, true, -0.6, 0.75, 5.8, "amazed", "hold_spear", t * 0.8, 0, cam);
        break;
      }
      case 3: {
        this.setActor(this.purba, true, -2.0, 0.75, 6.2, "amazed", "stand", t * 0.8, 1, cam);
        break;
      }
      case 4: {
        this.yawaCard.position.y = 3.55 + Math.sin(t * 2.2) * 0.07;
        this.setActor(this.petani, true, 1.4, 0.75, 6.0, "proud", "hold_rice", t * 0.9, 0, cam);
        break;
      }
      case 5: {
        this.setActor(this.petani, true, 88.5, 0.7, 5.8, "peaceful", "greet", t * 0.7, 0, cam, 0.95);
        break;
      }
      case 6: {
        this.majapahitCard.position.y = 4.75 + Math.sin(t * 2.2) * 0.08;
        this.setActor(this.majapahit, true, 103.5, 0.7, 5.6, "heroic", "salute_keris", t * 0.9, 0, cam, 1.05);
        break;
      }
      case 7: {
        this.setActor(this.wali, true, 176.8, 0.7, 3.8, "peaceful", "greet", t * 0.7, 1, cam);
        this.setActor(this.petani, true, 179.4, 0.7, 3.9, "smile", "greet", t * 0.7, -1, cam);
        break;
      }
      case 8: {
        this.setActor(this.petani, true, 183.6, 0.75, 11.2, "amazed", "cheer", t * 1.1, -1, cam);
        break;
      }
      case 9: {
        this.proklamasiCard.position.set(270.4, 3.85, 11.4);
        this.proklamasiCard.position.y = 3.85 + Math.sin(t * 2.4) * 0.06;
        this.setActor(this.pemuda, true, 270.4, 0.75, 11.8, "heroic", "fist_up", t * 1.2, 0, cam, 1.08);
        return V(270.0, 2.4, 11.5);
      }
      case 10: {
        this.setActor(this.modern, true, 270.0, 0.75, 13.8, "proud", "cheer", t * 1.1, 0, cam, 0.95);
        break;
      }
      default: {
        this.modernCard.position.set(270.0, 4.95 + Math.sin(t * 2.2) * 0.08, 14.2);
        this.setActor(this.modern, true, 270.0, 0.75, 14.6, "proud", "cheer", t * 1.2, 0, cam, 1.12);
        return V(270.0, 2.2, 14.6);
      }
    }

    return look;
  }
}
