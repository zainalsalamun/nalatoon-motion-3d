import * as THREE from "three";
import { NOINK } from "../bridge/ink";
import { TONE, twoTone, untone } from "../bridge/shade";
import { planksHD, cobbleHD, facadeHD, roofHD, cloudHD } from "../bridge/paint";
import { CAFE_LIGHTS, CafeLight, dirFromAngles } from "./cafeLights";
import { SHOTS, FPS, camAt, clamp01, smooth, V3 } from "./story";
import {
  drawCharacter, Role, Mood, Pose,
  makeDeedPhotoCard, makeReservedSignTex, makeCafeBannerTex, makeWhisperTex, makeShockTex,
} from "./cafeToon";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const setLayerDeep = (o: THREE.Object3D, layer: number) => {
  o.traverse((c) => c.layers.set(layer));
};

type ActorSlot = {
  role: Role;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  shadow: THREE.Mesh;
  lastKey: string;
};

const makeActor = (role: Role, heightM = 1.72): ActorSlot => {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const wM = heightM * 0.6;
  const geo = new THREE.PlaneGeometry(wM, heightM);
  geo.translate(0, heightM * 0.5, 0); // feet sit on y = 0
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.layers.set(NOINK);

  // Soft ground contact shadow
  const shGeo = new THREE.CircleGeometry(0.42, 18);
  shGeo.rotateX(-Math.PI / 2);
  const shMat = new THREE.MeshBasicMaterial({ color: "#1c1728", transparent: true, opacity: 0.32, depthWrite: false });
  const shadow = new THREE.Mesh(shGeo, shMat);
  shadow.position.y = 0.015;
  shadow.layers.set(NOINK);

  return { role, canvas, ctx, tex, mesh, mat, shadow, lastKey: "" };
};

const makeMat = (color: string, extra: THREE.MeshLambertMaterialParameters = {}) =>
  twoTone(new THREE.MeshLambertMaterial({ color, ...extra }));

const addBox = (parent: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, ry = 0) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

const addTree = (parent: THREE.Object3D, x: number, z: number, scale = 1.0, greenHex = "#57a83e") => {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  const bark = makeMat("#855638");
  const leaf = makeMat(greenHex);
  const leaf2 = makeMat("#4a9437");

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.5, 10), bark);
  trunk.position.y = 1.25;
  trunk.castShadow = true;
  g.add(trunk);

  const lobes: [number, number, number, number, THREE.Material][] = [
    [0, 3.2, 0, 1.35, leaf],
    [-0.85, 2.75, 0.35, 0.95, leaf2],
    [0.85, 2.8, -0.25, 1.0, leaf],
    [0.15, 2.65, 0.85, 0.85, leaf2],
    [-0.2, 3.85, -0.2, 0.92, leaf],
  ];
  for (const [lx, ly, lz, r, mat] of lobes) {
    const sph = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
    sph.position.set(lx, ly, lz);
    sph.castShadow = true;
    sph.receiveShadow = true;
    g.add(sph);
  }
  parent.add(g);
};

const addTableSet = (parent: THREE.Object3D, x: number, z: number, withLeftChair = true, withRightChair = true) => {
  const wood = makeMat("#9c623a");
  const woodDark = makeMat("#613b22");
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  // Tabletop
  addBox(g, 1.25, 0.08, 0.95, wood, 0, 0.78, 0);
  // Center pedestal + legs
  addBox(g, 0.12, 0.76, 0.12, woodDark, 0, 0.38, 0);
  addBox(g, 0.65, 0.06, 0.55, woodDark, 0, 0.03, 0);

  const addChair = (cx: number, facing: number) => {
    addBox(g, 0.48, 0.06, 0.48, wood, cx, 0.46, 0);
    addBox(g, 0.46, 0.5, 0.06, wood, cx + facing * -0.22, 0.72, 0, Math.PI / 2);
    for (const sx of [-0.19, 0.19]) for (const sz of [-0.19, 0.19])
      addBox(g, 0.05, 0.46, 0.05, woodDark, cx + sx, 0.23, sz);
  };
  if (withLeftChair) addChair(-0.82, 1);
  if (withRightChair) addChair(0.82, -1);
  parent.add(g);
};

export class CafeWorld {
  root = new THREE.Group();
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private cafeWarmLight: THREE.PointLight;
  private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bdd4f0", 28, 260);
  private clouds: THREE.Mesh[] = [];
  private lampBulbs: THREE.MeshBasicMaterial[] = [];

  // Actors
  private darmo: ActorSlot;
  private raka: ActorSlot;
  private ibu: ActorSlot;
  private custA: ActorSlot;
  private custB: ActorSlot;
  private custC: ActorSlot;
  private allActors: ActorSlot[];

  // Dynamic 3D / 2D story props
  private waterGlass: THREE.Group;
  private notebook: THREE.Mesh;
  private envelope: THREE.Mesh;
  private coffeePair: THREE.Group;
  private reservedSign: THREE.Group;
  private deedCard: THREE.Mesh;
  private whisperCard: THREE.Mesh;
  private shockCard: THREE.Mesh;
  private warmMemorySpot: THREE.Mesh;

  constructor() {
    const R = this.root;

    // 1. Sky Dome (5-stop gradient)
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        c0: { value: new THREE.Color() },
        c1: { value: new THREE.Color() },
        c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() },
        c4: { value: new THREE.Color() },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform vec3 c0,c1,c2,c3,c4; varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = h < 0.08 ? mix(c4, c3, h / 0.08)
                   : h < 0.22 ? mix(c3, c2, (h - 0.08) / 0.14)
                   : h < 0.48 ? mix(c2, c1, (h - 0.22) / 0.26)
                   : mix(c1, c0, (h - 0.48) / 0.52);
          gl_FragColor = vec4(col, 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 28, 18), this.skyMat);
    sky.layers.set(NOINK);
    R.add(sky);

    // Clouds
    const cTex = cloudHD(1);
    for (const [cx, cy, cz, sw, sh] of [
      [-40, 48, -95, 42, 18], [32, 56, -110, 48, 20], [-10, 42, 105, 44, 18], [55, 44, 95, 38, 16],
    ] as const) {
      const cm = new THREE.Mesh(
        new THREE.PlaneGeometry(sw, sh),
        new THREE.MeshBasicMaterial({ map: cTex, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })
      );
      cm.position.set(cx, cy, cz);
      cm.layers.set(NOINK);
      R.add(cm);
      this.clouds.push(cm);
    }

    // 2. Lights
    this.hemi = new THREE.HemisphereLight("#84b6f0", "#9f8769", 1.45);
    R.add(this.hemi);
    this.sun = new THREE.DirectionalLight("#fff4de", 3.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 2;
    this.sun.shadow.camera.far = 90;
    const sc = 22;
    this.sun.shadow.camera.left = -sc;
    this.sun.shadow.camera.right = sc;
    this.sun.shadow.camera.top = sc;
    this.sun.shadow.camera.bottom = -sc;
    this.sun.shadow.bias = -0.0005;
    R.add(this.sun);
    this.fill = new THREE.DirectionalLight("#b8d0f2", 0.42);
    R.add(this.fill);

    this.cafeWarmLight = new THREE.PointLight("#ffb866", 0.0, 14, 1.5);
    this.cafeWarmLight.position.set(-1.0, 3.2, 1.5);
    R.add(this.cafeWarmLight);

    // 3. Ground: Sidewalk, Asphalt Road, Grass Hills
    const sidewalkMat = twoTone(new THREE.MeshLambertMaterial({ map: cobbleHD() }));
    const swMesh = new THREE.Mesh(new THREE.PlaneGeometry(140, 26), sidewalkMat);
    swMesh.rotation.x = -Math.PI / 2;
    swMesh.position.set(0, -0.01, -2);
    swMesh.receiveShadow = true;
    R.add(swMesh);

    const roadMat = makeMat("#4a4f5e");
    const road = new THREE.Mesh(new THREE.PlaneGeometry(140, 9.5), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -0.06, 12.8);
    road.receiveShadow = true;
    R.add(road);

    // White dashed lane stripes on road
    const stripeMat = makeMat("#f0ece1");
    for (let x = -45; x <= 45; x += 5.5) {
      const st = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.24), stripeMat);
      st.rotation.x = -Math.PI / 2;
      st.position.set(x, -0.045, 12.8);
      R.add(st);
    }

    // Curb + Opposite Sidewalk
    const curbMat = makeMat("#c9c2b2");
    addBox(R, 140, 0.14, 0.35, curbMat, 0, 0.0, 8.15);
    addBox(R, 140, 0.14, 0.35, curbMat, 0, 0.0, 17.5);
    const oppSw = new THREE.Mesh(new THREE.PlaneGeometry(140, 28), sidewalkMat);
    oppSw.rotation.x = -Math.PI / 2;
    oppSw.position.set(0, -0.01, 31.5);
    oppSw.receiveShadow = true;
    R.add(oppSw);

    // 4. HERO 3D CORNER CAFÉ ("KOPI SUDUT")
    const cafe = new THREE.Group();
    R.add(cafe);

    // Wooden floor inside café
    const floorMat = twoTone(new THREE.MeshLambertMaterial({ map: planksHD() }));
    const floor = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.14, 9.2), floorMat);
    floor.position.set(0, -0.05, 0);
    floor.receiveShadow = true;
    cafe.add(floor);

    const creamWall = makeMat("#f5e3c3");
    const trimWood = makeMat("#7a4a2b");
    const roofMat = twoTone(new THREE.MeshLambertMaterial({ map: roofHD("#b8563c") }));

    // Back wall (z = -4.5) & Left wall (x = -5.6) & Right wall (x = 5.6) — no interior shadow-blocking!
    const bw = addBox(cafe, 11.6, 4.4, 0.35, creamWall, 0, 2.2, -4.55); bw.castShadow = false;
    const lw = addBox(cafe, 0.35, 4.4, 9.2, creamWall, -5.6, 2.2, 0);   lw.castShadow = false;
    const rw = addBox(cafe, 0.35, 4.4, 9.2, creamWall, 5.6, 2.2, 0);    rw.castShadow = false;

    // Warm wood wainscoting along back & side walls
    addBox(cafe, 11.1, 1.15, 0.08, trimWood, 0, 0.58, -4.34).castShadow = false;
    addBox(cafe, 0.08, 1.15, 8.8, trimWood, -5.38, 0.58, 0).castShadow = false;
    addBox(cafe, 0.08, 1.15, 8.8, trimWood, 5.38, 0.58, 0).castShadow = false;

    // Cozy Café Interior Decor: Framed Posters, Bookshelf with Coffee Jars, Vintage Wall Clock, Corner Plant!
    const frameWood = makeMat("#54331d");
    const posterPalette = ["#d97a54", "#4f8c7a", "#e6b85c"];
    for (let i = 0; i < 3; i++) {
      const px = -4.1 + i * 1.65;
      addBox(cafe, 1.05, 1.25, 0.08, frameWood, px, 2.65, -4.32).castShadow = false;
      addBox(cafe, 0.88, 1.08, 0.09, makeMat(posterPalette[i]), px, 2.65, -4.30).castShadow = false;
    }
    // Left wall shelf + coffee tins & vintage picture
    addBox(cafe, 0.32, 0.09, 2.4, frameWood, -5.24, 2.15, -1.6).castShadow = false;
    for (let j = 0; j < 4; j++) {
      const jar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.28, 10),
        makeMat(["#c74c3c", "#e6b84c", "#4b8c6b", "#7a5136"][j])
      );
      jar.position.set(-5.22, 2.34, -2.4 + j * 0.52);
      cafe.add(jar);
    }
    // Warm potted indoor palm/fern in back-left corner
    const inPot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.52, 10), makeMat("#b85f42"));
    inPot.position.set(-4.75, 0.26, -3.7);
    cafe.add(inPot);
    const inBush = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), makeMat("#4a993f"));
    inBush.position.set(-4.75, 0.92, -3.7);
    cafe.add(inBush);

    // Decorative framed window on left wall (sunset light pours through!)
    const glassMat = new THREE.MeshBasicMaterial({ color: "#ffe3b0", transparent: true, opacity: 0.32 });
    const winPane = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.1), glassMat);
    winPane.rotation.y = Math.PI / 2;
    winPane.position.set(-5.36, 2.3, 1.8);
    winPane.layers.set(NOINK);
    cafe.add(winPane);
    addBox(cafe, 0.12, 0.12, 3.4, trimWood, -5.38, 3.38, 1.8).castShadow = false;
    addBox(cafe, 0.12, 0.12, 3.4, trimWood, -5.38, 1.24, 1.8).castShadow = false;

    // Front corner wooden pillars + header beam
    addBox(cafe, 0.32, 4.4, 0.32, trimWood, -5.5, 2.2, 4.5).castShadow = false;
    addBox(cafe, 0.32, 4.4, 0.32, trimWood, 5.5, 2.2, 4.5).castShadow = false;
    addBox(cafe, 11.4, 0.52, 0.42, trimWood, 0, 4.2, 4.5).castShadow = false;

    // Roof (no interior shadow-blocking!) + Clean Unobstructed Signboard ("KOPI SUDUT SEJAK 1996")
    const rBase = addBox(cafe, 12.2, 0.3, 10.0, trimWood, 0, 4.55, 0); rBase.castShadow = false;
    const roofSlope = new THREE.Mesh(new THREE.ConeGeometry(8.5, 2.6, 4), roofMat);
    roofSlope.rotation.y = Math.PI / 4;
    roofSlope.position.set(0, 5.95, 0);
    roofSlope.castShadow = false;
    cafe.add(roofSlope);

    // Striped Red & Cream Café Awning along front
    const awnRed = makeMat("#c4473b");
    const awnCream = makeMat("#f5ead6");
    for (let i = 0; i < 12; i++) {
      const ax = -5.0 + i * (10.0 / 11);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.1, 1.9), i % 2 === 0 ? awnRed : awnCream);
      strip.position.set(ax, 3.88, 5.35);
      strip.rotation.x = 0.28;
      strip.castShadow = false;
      cafe.add(strip);
    }

    // Café Signboard cleanly mounted in front of fascia (zero roof clipping!)
    const signBack = addBox(cafe, 4.8, 1.44, 0.16, makeMat("#2b1d17"), 0, 5.45, 5.45);
    signBack.castShadow = false;
    const signBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 1.32),
      new THREE.MeshBasicMaterial({ map: makeCafeBannerTex() })
    );
    signBoard.position.set(0, 5.45, 5.55);
    signBoard.layers.set(NOINK);
    cafe.add(signBoard);

    // Espresso Counter + Machine + Chalkboard Menu
    const counterWood = makeMat("#78492d");
    const counterTop = makeMat("#e8dec8");
    addBox(cafe, 4.4, 1.05, 0.95, counterWood, 2.8, 0.525, -2.0);
    addBox(cafe, 4.55, 0.09, 1.08, counterTop, 2.8, 1.08, -2.0);
    // Shiny Espresso Machine
    const chrome = makeMat("#bcc4cf");
    const darkMetal = makeMat("#323640");
    addBox(cafe, 0.95, 0.65, 0.55, chrome, 3.5, 1.44, -2.0);
    addBox(cafe, 0.75, 0.14, 0.42, darkMetal, 3.5, 1.8, -2.0);
    // Chalkboard Menu on Back Wall
    addBox(cafe, 3.6, 1.65, 0.08, makeMat("#26302b"), 2.8, 2.65, -4.34);
    addBox(cafe, 3.74, 0.1, 0.12, trimWood, 2.8, 3.5, -4.34);
    addBox(cafe, 3.74, 0.1, 0.12, trimWood, 2.8, 1.8, -4.34);

    // Hanging Warm Pendant Lamps (emissive HDR bulbs for dusk bloom!)
    const cordMat = makeMat("#221e24");
    const shadeMat = makeMat("#3d2a22");
    for (const [lx, lz] of [[-2.4, 2.6], [2.2, 2.2], [2.8, -2.0]] as const) {
      addBox(cafe, 0.04, 1.35, 0.04, cordMat, lx, 3.85, lz);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.24, 14), shadeMat);
      cone.position.set(lx, 3.16, lz);
      cafe.add(cone);
      const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.15, 0.72) });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), bulbMat);
      bulb.position.set(lx, 3.04, lz);
      bulb.layers.set(NOINK);
      cafe.add(bulb);
      this.lampBulbs.push(bulbMat);
    }

    // Tables & Chairs
    addTableSet(cafe, -2.4, 2.6, true, true);  // Hero Corner Table (Meja Pojok!)
    addTableSet(cafe, 2.2, 2.2, true, true);   // Customer Table Right
    addTableSet(cafe, -2.1, -1.6, true, true); // Back Table Left

    // Potted Plants flanking entrance
    const potMat = makeMat("#b85f42");
    const plantGreen = makeMat("#4a993f");
    for (const px of [-5.2, 5.2]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.55, 10), potMat);
      pot.position.set(px, 0.275, 5.25);
      R.add(pot);
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), plantGreen);
      bush.position.set(px, 0.85, 5.25);
      R.add(bush);
    }

    // 5. Surrounding Indonesian Ruko Shophouses & Trees & Streetlamps
    const rukoColors = [
      { wall: "#e8d6b9", shutter: "#3f6356", roof: "#a8523b" },
      { wall: "#d99270", shutter: "#3b475e", roof: "#6e4d47" },
      { wall: "#c7d4be", shutter: "#5e4638", roof: "#9c553b" },
      { wall: "#ebd09c", shutter: "#3f5266", roof: "#7d4c40" },
    ];
    const addRuko = (rx: number, rz: number, w: number, h: number, idx: number, rotY = 0) => {
      const pal = rukoColors[idx % rukoColors.length];
      const fac = twoTone(new THREE.MeshLambertMaterial({ map: facadeHD(`ruko_${idx}`, w, h, { wall: pal.wall, shutter: pal.shutter }) }));
      const rf = twoTone(new THREE.MeshLambertMaterial({ map: roofHD(pal.roof) }));
      const g = new THREE.Group();
      g.position.set(rx, 0, rz);
      g.rotation.y = rotY;
      addBox(g, w, h, 7.5, fac, 0, h / 2, 0);
      addBox(g, w + 0.4, 0.6, 8.0, rf, 0, h + 0.3, 0);
      R.add(g);
    };
    // Neighbors beside café
    addRuko(-12.5, -0.5, 9.5, 7.6, 0, 0);
    addRuko(-22.5, -0.5, 9.5, 6.8, 1, 0);
    addRuko(12.2, -0.5, 9.2, 7.2, 2, 0);
    addRuko(22.0, -0.5, 9.5, 8.0, 3, 0);
    // Across the street (for background depth when looking out)
    for (let i = 0; i < 6; i++) {
      addRuko(-26 + i * 10.5, 22.5, 9.5, 7.0 + (i % 2) * 1.4, i + 1, Math.PI);
    }

    // Lush Trees along sidewalk (clear of camera sight lines!)
    addTree(R, -9.2, 6.8, 1.25, "#54a63c");
    addTree(R, 9.8, 6.8, 1.3, "#49963a");
    addTree(R, -18.0, 6.8, 1.35, "#60b044");
    addTree(R, 18.5, 6.8, 1.2, "#4f9e3d");
    addTree(R, -12.0, 18.8, 1.3, "#5aa840");
    addTree(R, 6.5, 18.8, 1.25, "#4c9939");

    // Street Lantern Posts
    const ironMat = makeMat("#353944");
    for (const sx of [-6.8, 7.2, -16.5, 16.5]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 3.8, 8), ironMat);
      pole.position.set(sx, 1.9, 7.6);
      R.add(pole);
      const glMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.15, 0.72) });
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.38, 0.28), glMat);
      lamp.position.set(sx, 3.92, 7.6);
      lamp.layers.set(NOINK);
      R.add(lamp);
      this.lampBulbs.push(glMat);
    }

    // 6. HERO DYNAMIC STORY PROPS ON CORNER TABLE (-2.4, 0.82, 2.6)
    // Glass of clear water
    this.waterGlass = new THREE.Group();
    this.waterGlass.position.set(-2.35, 0.82, 2.55);
    const glCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.055, 0.21, 14),
      new THREE.MeshLambertMaterial({ color: "#b8ebff", transparent: true, opacity: 0.78 })
    );
    glCyl.position.y = 0.105;
    this.waterGlass.add(glCyl);
    const waterInner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.048, 0.15, 12),
      new THREE.MeshBasicMaterial({ color: "#7cd7ff" })
    );
    waterInner.position.y = 0.08;
    waterInner.layers.set(NOINK);
    this.waterGlass.add(waterInner);
    R.add(this.waterGlass);

    // Old Leather Notebook
    this.notebook = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.24), makeMat("#6e432b"));
    this.notebook.position.set(-2.62, 0.84, 2.66);
    this.notebook.rotation.y = 0.22;
    R.add(this.notebook);

    // White Envelope left on table
    this.envelope = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.22), makeMat("#faf5e8"));
    this.envelope.position.set(-2.22, 0.835, 2.68);
    this.envelope.rotation.y = -0.18;
    this.envelope.visible = false;
    R.add(this.envelope);

    // Pair of Warm Coffee Mugs (for flashback & finale)
    this.coffeePair = new THREE.Group();
    const mugMat = makeMat("#f5eee0");
    const cofMat = makeMat("#4a2916");
    for (const [mx, mz] of [[-2.86, 2.58], [-1.94, 2.58]]) {
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.14, 12), mugMat);
      mug.position.set(mx, 0.89, mz);
      this.coffeePair.add(mug);
      const top = new THREE.Mesh(new THREE.CircleGeometry(0.058, 12), cofMat);
      top.rotation.x = -Math.PI / 2;
      top.position.set(mx, 0.962, mz);
      this.coffeePair.add(top);
    }
    this.coffeePair.visible = false;
    R.add(this.coffeePair);

    // Wooden "KHUSUS UNTUK PAK DARMO" Table Sign (Shot 11 finale!)
    this.reservedSign = new THREE.Group();
    this.reservedSign.position.set(-2.4, 0.82, 2.6);
    addBox(this.reservedSign, 0.66, 0.42, 0.06, makeMat("#4a2e1d"), 0, 0.23, 0);
    const signFace = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.38),
      new THREE.MeshBasicMaterial({ map: makeReservedSignTex() })
    );
    signFace.position.set(0, 0.23, 0.036);
    signFace.layers.set(NOINK);
    this.reservedSign.add(signFace);
    this.reservedSign.visible = false;
    R.add(this.reservedSign);

    // Floating 2D Visual Story Cards (NOINK layer)
    this.deedCard = new THREE.Mesh(
      new THREE.PlaneGeometry(1.12, 1.12),
      new THREE.MeshBasicMaterial({ map: makeDeedPhotoCard(), transparent: true, alphaTest: 0.1 })
    );
    this.deedCard.layers.set(NOINK);
    this.deedCard.visible = false;
    R.add(this.deedCard);

    this.whisperCard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.82, 0.52),
      new THREE.MeshBasicMaterial({ map: makeWhisperTex(), transparent: true, alphaTest: 0.1 })
    );
    this.whisperCard.layers.set(NOINK);
    this.whisperCard.visible = false;
    R.add(this.whisperCard);

    this.shockCard = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 1.15),
      new THREE.MeshBasicMaterial({ map: makeShockTex(), transparent: true, alphaTest: 0.1 })
    );
    this.shockCard.layers.set(NOINK);
    this.shockCard.visible = false;
    R.add(this.shockCard);

    // Warm sunlit pool spotlight on corner table for flashback (Shot 10)
    const poolGeo = new THREE.CircleGeometry(1.85, 28);
    poolGeo.rotateX(-Math.PI / 2);
    this.warmMemorySpot = new THREE.Mesh(
      poolGeo,
      new THREE.MeshBasicMaterial({ color: "#ffd27a", transparent: true, opacity: 0.24, depthWrite: false })
    );
    this.warmMemorySpot.position.set(-2.4, 0.03, 2.6);
    this.warmMemorySpot.layers.set(NOINK);
    this.warmMemorySpot.visible = false;
    R.add(this.warmMemorySpot);

    // 7. CAST (2D Bean-Head Billboards)
    this.darmo = makeActor("darmo", 1.70);
    this.raka  = makeActor("raka",  1.76);
    this.ibu   = makeActor("ibu",   1.64);
    this.custA = makeActor("custA", 1.72);
    this.custB = makeActor("custB", 1.66);
    this.custC = makeActor("custC", 1.74);
    this.allActors = [this.darmo, this.raka, this.ibu, this.custA, this.custB, this.custC];
    for (const a of this.allActors) {
      R.add(a.mesh);
      R.add(a.shadow);
    }
  }

  private placeActor(
    a: ActorSlot,
    cam: THREE.PerspectiveCamera,
    visible: boolean,
    pos: V3,
    mood: Mood,
    pose: Pose,
    phase: number,
    dir: number,
    tint: THREE.Color
  ) {
    a.mesh.visible = visible;
    a.shadow.visible = visible;
    if (!visible) return;

    // Periodic natural blink every ~2.2s
    const blinkCycle = (phase * 0.45) % 1;
    const finalMood: Mood = (mood === "calm" || mood === "smile") && blinkCycle > 0.94 ? "blink" : mood;
    const qPhase = Math.round(phase * 15) / 15;
    const key = `${finalMood}_${pose}_${dir}_${pose === "sit" || pose === "stand" || pose === "point" ? 0 : qPhase}`;
    if (a.lastKey !== key) {
      drawCharacter(a.ctx, a.role, finalMood, pose, phase, dir);
      a.tex.needsUpdate = true;
      a.lastKey = key;
    }

    a.mesh.position.set(pos[0], pos[1], pos[2]);
    a.shadow.position.set(pos[0], 0.02, pos[2]);
    // Billboard smoothly facing camera yaw (stays upright!)
    const dx = cam.position.x - pos[0];
    const dz = cam.position.z - pos[2];
    a.mesh.rotation.set(0, Math.atan2(dx, dz), 0);
    a.mat.color.copy(tint);
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3 {
    const s = SHOTS[id - 1];
    const t = f / FPS;
    const u = clamp01((f - s.a) / Math.max(1, s.b - s.a));
    const L = CAFE_LIGHTS[s.light];

    // 1. Camera
    const c = camAt(id, f);
    cam.position.set(...c.pos);
    cam.fov = c.fov;
    cam.lookAt(...c.look);
    cam.rotateZ(c.roll);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);

    // 2. Lighting + Sky + Fog
    this.fog.color.set(L.fogCol);
    this.fog.near = L.fogNear;
    this.fog.far = L.fogFar;
    scene.fog = this.fog;

    this.hemi.color.set(L.hemiSky);
    this.hemi.groundColor.set(L.hemiGnd);
    this.hemi.intensity = L.hemiInt;

    const sunDir = dirFromAngles(L.az, L.el);
    this.sun.position.copy(sunDir).multiplyScalar(40);
    this.sun.color.set(L.sunCol);
    this.sun.intensity = L.sunInt;

    this.fill.position.set(-sunDir.x * 20, 12, -sunDir.z * 20);
    this.fill.color.set(L.fillCol);
    this.fill.intensity = L.fillInt;

    TONE.uLitCol.value.set(...L.lit);
    TONE.uShadeCol.value.set(...L.shade);
    TONE.uShadeLift.value.set(...L.lift);

    for (let i = 0; i < 5; i++) {
      (this.skyMat.uniforms[`c${i}`].value as THREE.Color).copy(untone(L.sky[i]));
    }
    for (let i = 0; i < this.clouds.length; i++) {
      this.clouds[i].lookAt(cam.position);
      this.clouds[i].position.x += Math.sin(t * 0.05 + i) * 0.002;
    }

    // Café pendant & street lamps glow brightly during golden/dusk!
    const lampBoost = s.light === "dusk" ? 2.4 : s.light === "golden" ? 1.55 : 0.95;
    for (const bm of this.lampBulbs) {
      bm.color.setRGB(1.1 * lampBoost, 0.85 * lampBoost, 0.45 * lampBoost);
    }
    this.cafeWarmLight.intensity = s.light === "dusk" ? 4.2 : s.light === "golden" ? 1.8 : 0.0;

    // Scene light tint applied to 2D characters so they blend into day/golden/dusk
    const charTint =
      s.light === "day"    ? new THREE.Color("#f5f4f0")
    : s.light === "golden" ? new THREE.Color("#ffd8b0")
    :                        new THREE.Color("#f0d8c8");

    // 3. Reset dynamic props before per-shot staging
    this.waterGlass.visible = id <= 9;
    this.notebook.visible = id <= 6 || (id === 7 && u < 0.55);
    this.envelope.visible = (id === 7 && u > 0.45) || id === 8;
    this.coffeePair.visible = id === 10 || (id === 11 && u > 0.52);
    this.reservedSign.visible = id === 11 && u > 0.45;
    this.deedCard.visible = false;
    this.whisperCard.visible = false;
    this.shockCard.visible = false;
    this.warmMemorySpot.visible = id === 10;

    // 4. Pose Cast per Shot!
    if (id === 1) {
      // Hook: Pak Darmo calmly seated at corner table with glass of water
      this.placeActor(this.darmo, cam, true, [-3.18, 0, 2.6], "calm", "sit", t, 1, charTint);
      this.placeActor(this.raka,  cam, true, [2.8, 0, -2.9], "calm", "stand", t, -1, charTint);
      this.placeActor(this.ibu,   cam, false, [0, 0, 0], "warm", "sit", t, -1, charTint);
      this.placeActor(this.custA, cam, true, [1.4, 0, 2.2], "calm", "sit", t, 1, charTint);
      this.placeActor(this.custB, cam, false, [0, 0, 0], "calm", "sit", t, -1, charTint);
      this.placeActor(this.custC, cam, false, [0, 0, 0], "calm", "sit", t, -1, charTint);
    } else if (id === 2) {
      // Wide establishing: Pak Darmo walking in along sidewalk -> taking corner seat
      const walkU = smooth(u * 1.4);
      const dx = -7.2 + walkU * 4.0;
      const dz = 6.2 - walkU * 3.6;
      const seated = u > 0.72;
      this.placeActor(this.darmo, cam, true, seated ? [-3.18, 0, 2.6] : [dx, 0, dz], "smile", seated ? "sit" : "walk", t * 1.6, 1, charTint);
      this.placeActor(this.raka,  cam, true, [2.8, 0, -2.9], "smile", "stand", t, -1, charTint);
      this.placeActor(this.ibu,   cam, false, [0, 0, 0], "warm", "sit", t, -1, charTint);
      this.placeActor(this.custA, cam, true, [1.4, 0, 2.2], "calm", "sit", t, 1, charTint);
      this.placeActor(this.custB, cam, true, [3.0, 0, 2.2], "smile", "sit", t, -1, charTint);
      this.placeActor(this.custC, cam, false, [0, 0, 0], "calm", "stand", t, 1, charTint);
    } else if (id === 3) {
      // Busy café: Raka behind counter frowning as Customer C sees full tables and walks away disappointed
      const leaveX = 0.5 + smooth(u) * 5.2;
      this.placeActor(this.darmo, cam, true, [-3.18, 0, 2.6], "calm", "sit", t, 1, charTint);
      this.placeActor(this.raka,  cam, true, [2.8, 0, -2.9], "frown", "stand", t, -1, charTint);
      this.placeActor(this.ibu,   cam, false, [0, 0, 0], "warm", "sit", t, -1, charTint);
      this.placeActor(this.custA, cam, true, [1.4, 0, 2.2], "calm", "sit", t, 1, charTint);
      this.placeActor(this.custB, cam, true, [3.0, 0, 2.2], "calm", "sit", t, -1, charTint);
      this.placeActor(this.custC, cam, true, [leaveX, 0, 5.4], "sad", "walk", t * 1.7, 1, charTint);
    } else if (id === 4) {
      // Customers whispering & glancing at Pak Darmo
      this.placeActor(this.darmo, cam, true, [-3.18, 0, 2.6], "calm", "sit", t, 1, charTint);
      this.placeActor(this.raka,  cam, true, [2.8, 0, -2.9], "frown", "stand", t, -1, charTint);
      this.placeActor(this.ibu,   cam, false, [0, 0, 0], "warm", "sit", t, -1, charTint);
      this.placeActor(this.custA, cam, true, [1.4, 0, 2.2], "whisper", "sit", t, -1, charTint);
      this.placeActor(this.custB, cam, true, [2.85, 0, 2.2], "frown", "sit", t, -1, charTint);
      this.placeActor(this.custC, cam, false, [0, 0, 0], "calm", "sit", t, 1, charTint);
      this.whisperCard.visible = true;
      this.whisperCard.position.set(2.1, 2.05 + Math.sin(t * 5) * 0.05, 2.2);
      this.whisperCard.lookAt(cam.position);
    } else if (id === 5) {
      // Golden hour: Raka walks determinedly from counter to Pak Darmo's corner table
      const wu = smooth(u);
      const rx = 2.6 - wu * 3.85;
      const rz = -1.2 + wu * 3.8;
      this.placeActor(this.darmo, cam, true, [-3.18, 0, 2.6], "calm", "sit", t, 1, charTint);
      this.placeActor(this.raka,  cam, true, [rx, 0, rz], "angry", u < 0.9 ? "walk" : "stand", t * 1.8, -1, charTint);
      this.placeActor(this.ibu,   cam, false, [0, 0, 0], "warm", "sit", t, -1, charTint);
      this.placeActor(this.custA, cam, true, [1.4, 0, 2.2], "surprised", "sit", t, -1, charTint);
      this.placeActor(this.custB, cam, true, [3.0, 0, 2.2], "surprised", "sit", t, -1, charTint);
      this.placeActor(this.custC, cam, false, [0, 0, 0], "calm", "sit", t, 1, charTint);
    } else if (id === 6) {
      // Confrontation close-up: Raka gesturing/talking firmly, Pak Darmo surprised
      this.placeActor(this.darmo, cam, true, [-3.18, 0, 2.6], "surprised", "sit", t, 1, charTint);
      this.placeActor(this.raka,  cam, true, [-1.35, 0, 2.6], "angry", "point", t, -1, charTint);
      this.placeActor(this.ibu,   cam, false, [0, 0, 0], "warm", "sit", t, -1, charTint);
      this.placeActor(this.custA, cam, true, [1.4, 0, 2.2], "surprised", "sit", t, -1, charTint);
      this.placeActor(this.custB, cam, false, [0, 0, 0], "calm", "sit", t, -1, charTint);
      this.placeActor(this.custC, cam, false, [0, 0, 0], "calm", "sit", t, 1, charTint);
    } else if (id === 7) {
      // Pak Darmo smiles warmly, stands up, leaves envelope
      const stood = u > 0.55;
      this.placeActor(this.darmo, cam, true, stood ? [-3.1, 0, 3.0] : [-3.18, 0, 2.6], "warm", stood ? "stand" : "sit", t, 1, charTint);
      this.placeActor(this.raka,  cam, true, [-1.35, 0, 2.6], "frown", "stand", t, -1, charTint);
      this.placeActor(this.ibu,   cam, false, [0, 0, 0], "warm", "sit", t, -1, charTint);
      this.placeActor(this.custA, cam, false, [0, 0, 0], "calm", "sit", t, -1, charTint);
      this.placeActor(this.custB, cam, false, [0, 0, 0], "calm", "sit", t, -1, charTint);
      this.placeActor(this.custC, cam, false, [0, 0, 0], "calm", "sit", t, 1, charTint);
    } else if (id === 8) {
      // Pak Darmo walking away down sidewalk while Raka opens envelope & gets shocked!
      const walkX = -3.4 - smooth(u) * 5.2;
      this.placeActor(this.darmo, cam, true, [walkX, 0, 6.2], "warm", "walk", t * 1.3, -1, charTint);
      const shocked = u > 0.52;
      this.placeActor(this.raka,  cam, true, [-1.45, 0, 2.75], shocked ? "shock" : "surprised", "hold_letter", t, -1, charTint);
      this.placeActor(this.ibu,   cam, false, [0, 0, 0], "warm", "sit", t, -1, charTint);
      this.placeActor(this.custA, cam, false, [0, 0, 0], "calm", "sit", t, -1, charTint);
      this.placeActor(this.custB, cam, false, [0, 0, 0], "calm", "sit", t, -1, charTint);
      this.placeActor(this.custC, cam, false, [0, 0, 0], "calm", "sit", t, 1, charTint);
      if (shocked) {
        this.shockCard.visible = true;
        const sc = 0.85 + Math.sin(t * 20) * 0.08;
        this.shockCard.scale.setScalar(sc);
        this.shockCard.position.set(-1.45, 1.82, 2.7);
        this.shockCard.lookAt(cam.position);
      }
    } else if (id === 9) {
      // Dusk Twist 1: Raka holding letter in awe + floating Deed & Polaroid visual card cleanly framed!
      this.placeActor(this.darmo, cam, false, [0, 0, 0], "warm", "stand", t, 1, charTint);
      this.placeActor(this.raka,  cam, true, [-2.22, 0, 2.3], "shock", "hold_letter", t, 1, charTint);
      this.placeActor(this.ibu,   cam, false, [0, 0, 0], "warm", "sit", t, -1, charTint);
      this.placeActor(this.custA, cam, false, [0, 0, 0], "calm", "sit", t, -1, charTint);
      this.placeActor(this.custB, cam, false, [0, 0, 0], "calm", "sit", t, -1, charTint);
      this.placeActor(this.custC, cam, false, [0, 0, 0], "calm", "sit", t, 1, charTint);
      this.deedCard.visible = true;
      const pop = smooth(u * 3.5);
      this.deedCard.scale.setScalar(0.80 + 0.10 * pop);
      this.deedCard.position.set(-1.48, 1.62 + Math.sin(t * 2.2) * 0.03, 3.05);
      this.deedCard.lookAt(cam.position);
    } else if (id === 10) {
      // Warm nostalgic flashback: Pak Darmo & Almarhumah Ibu Darmo sharing coffee at the corner table!
      const memTint = new THREE.Color("#ffe2b8");
      this.placeActor(this.darmo, cam, true, [-3.18, 0, 2.6], "warm", "sit", t, 1, memTint);
      this.placeActor(this.ibu,   cam, true, [-1.62, 0, 2.6], "warm", "sit", t, -1, memTint);
      this.placeActor(this.raka,  cam, false, [0, 0, 0], "calm", "stand", t, -1, memTint);
      this.placeActor(this.custA, cam, false, [0, 0, 0], "calm", "sit", t, -1, memTint);
      this.placeActor(this.custB, cam, false, [0, 0, 0], "calm", "sit", t, -1, memTint);
      this.placeActor(this.custC, cam, false, [0, 0, 0], "calm", "sit", t, 1, memTint);
    } else {
      // Shot 11 Finale: Raka runs outside to hand steaming coffee to Pak Darmo under warm streetlamp, then camera glides to "KHUSUS PAK DARMO" table!
      const runU = smooth(u * 2.4);
      const rx = -1.2 - runU * 2.7;
      const arrived = u > 0.42;
      this.placeActor(this.darmo, cam, true, [-5.0, 0, 6.2], "warm", "stand", t, 1, charTint);
      this.placeActor(this.raka,  cam, true, [rx, 0, 6.2], "smile", arrived ? "hold_coffee" : "run_coffee", t * 2.4, -1, charTint);
      this.placeActor(this.ibu,   cam, false, [0, 0, 0], "warm", "sit", t, -1, charTint);
      this.placeActor(this.custA, cam, false, [0, 0, 0], "calm", "sit", t, -1, charTint);
      this.placeActor(this.custB, cam, false, [0, 0, 0], "calm", "sit", t, -1, charTint);
      this.placeActor(this.custC, cam, false, [0, 0, 0], "calm", "sit", t, 1, charTint);
    }

    return V(...c.look);
  }
}
