import * as THREE from "three";
import {
  makeAuditSealTex,
  makeCalendarTex,
  makeNewsSlabTex,
  makeOfficialDocTex,
  makePayrollFolderTex,
  makePlaqueTex,
  makeShieldTex,
  makeSimMessageTex,
} from "./mekariTextures";

export interface SceneTiming {
  id: number;
  key: string;
  sceneStartSec: number;
  sceneEndSec: number;
  voStartSec: number;
  voEndSec: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeInOutCubic = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

const pbr = (color: string, roughness = 0.72, metalness = 0.08, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

const addBox = (
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  castShadow = true,
) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = castShadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
};

/**
 * Continuous 7-Station Architectural 3D Editorial World for "Ada Apa dengan Mekari?"
 * Tuned specifically for vertical 9:16 portrait camera framing (zero horizontal text clipping!).
 */
export class MekariWorld {
  root = new THREE.Group();
  private fog = new THREE.Fog("#0c1018", 22, 68);

  // Connecting hero 3D object
  private payrollFolder: THREE.Group;

  // Station 1: Calendar 25 Nov + Stop Barrier
  private barrierPivot: THREE.Group;
  private calendarGroup: THREE.Group;

  // Station 2: Timeline Monoliths (vertically staggered for 9:16!)
  private newsTop: THREE.Group;
  private newsBottom: THREE.Group;

  // Station 3: Official Announcement Slab + Highlight Bar
  private docGroup: THREE.Group;
  private docHighlightBar: THREE.Mesh;

  // Station 4: Conceptual Isolation Architecture
  private gateDoor: THREE.Group;
  private gateGlowMat: THREE.MeshStandardMaterial;

  // Station 5: Dual Separated Infrastructure (Old vs New, Target 24h)
  private newServers: THREE.Mesh[] = [];
  private stageLeds: THREE.MeshStandardMaterial[] = [];

  // Station 6: Glass Audit Chamber + Scanner Beam + Stamp
  private scanBeam: THREE.Mesh;
  private auditSeal: THREE.Group;

  // Station 7: Simulated Scam Message Rejected by Official Shield
  private simMessage: THREE.Group;
  private shieldGroup: THREE.Group;

  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();

  constructor(lite = false) {
    // 1. Editorial Dark Architectural Studio Lighting
    const hemi = new THREE.HemisphereLight("#d3e3fa", "#212838", 1.25);
    this.root.add(hemi);

    const key = new THREE.DirectionalLight("#fff2e0", 2.4);
    key.position.set(16, 26, 20);
    key.castShadow = !lite;
    key.shadow.mapSize.set(lite ? 512 : 2048, lite ? 512 : 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 130;
    const d = 28;
    key.shadow.camera.left = -d;
    key.shadow.camera.right = d;
    key.shadow.camera.top = d;
    key.shadow.camera.bottom = -d;
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.04;
    this.root.add(key);

    const rim = new THREE.DirectionalLight("#55c2f0", 1.15);
    rim.position.set(-14, 12, -16);
    this.root.add(rim);

    // 2. Continuous Matte Studio Floor + Architectural Grid & Track Rail
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 56), pbr("#10141f", 0.88, 0.08));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(36, 0, 0);
    floor.receiveShadow = true;
    this.root.add(floor);

    const gridHelper = new THREE.GridHelper(150, 75, "#253047", "#182032");
    gridHelper.position.set(36, 0.01, 0);
    this.root.add(gridHelper);

    const railMat = pbr("#263147", 0.45, 0.55);
    addBox(this.root, 52, 0.14, 1.35, railMat, 19, 0.07, 0.5, false);
    addBox(this.root, 32, 0.14, 1.35, railMat, 65, 0.07, 0.5, false);

    const stripeMat = new THREE.MeshBasicMaterial({ color: "#38bdf8", transparent: true, opacity: 0.5 });
    addBox(this.root, 51.5, 0.02, 0.14, stripeMat, 19, 0.15, 0.5, false);
    addBox(this.root, 31.5, 0.02, 0.14, stripeMat, 65, 0.15, 0.5, false);

    // Distant architectural studio backdrop pillars for real parallax depth & bokeh
    const pillarMat = pbr("#161d2e", 0.82, 0.14);
    for (let px = -8; px <= 86; px += 7) {
      addBox(this.root, 1.3, 11 + (Math.abs(px) % 3) * 2.5, 1.3, pillarMat, px, 5.5, -8.5 - (Math.abs(px) % 2) * 2.2, false);
    }

    // 3. HERO CONNECTING OBJECT: Sculpted 3D Illustrative Payroll Folder!
    this.payrollFolder = this.buildPayrollFolder();
    this.root.add(this.payrollFolder);

    const postMat = pbr("#2d374d", 0.48, 0.45);
    const slabBase = pbr("#1a2234", 0.52, 0.3);

    // 4. STATION 1 (x = 0): Sculpted 3D Calendar 25 Nov + Mechanical Stop Barrier
    this.calendarGroup = new THREE.Group();
    this.calendarGroup.position.set(-0.35, 0, -1.8);
    addBox(this.calendarGroup, 3.0, 3.45, 0.5, pbr("#232b3d", 0.55, 0.25), 0, 2.25, 0);
    const calFace = new THREE.Mesh(
      new THREE.PlaneGeometry(2.78, 3.2),
      new THREE.MeshBasicMaterial({ map: makeCalendarTex() }),
    );
    calFace.position.set(0, 2.25, 0.26);
    this.calendarGroup.add(calFace);
    addBox(this.calendarGroup, 2.2, 0.55, 0.85, postMat, 0, 0.27, 0);
    this.root.add(this.calendarGroup);

    // Stop barrier pedestal & lowering vermilion arm at x = 1.65
    addBox(this.root, 0.36, 1.75, 0.36, postMat, 1.65, 0.87, -0.35);
    this.barrierPivot = new THREE.Group();
    this.barrierPivot.position.set(1.65, 1.48, -0.22);
    const armMat = pbr("#e04a32", 0.4, 0.2, { emissive: "#5e170e", emissiveIntensity: 0.45 });
    addBox(this.barrierPivot, 0.16, 0.16, 2.25, armMat, 0, 0, 1.05);
    this.root.add(this.barrierPivot);

    // 5. STATION 2 (x = 12): Vertically-Staggered 3D Attributed News Monoliths (perfect 9:16 fit!)
    const tlGroup = new THREE.Group();
    tlGroup.position.set(12, 0, -1.5);
    // Vertical timeline spine pole
    addBox(tlGroup, 0.12, 5.4, 0.12, pbr("#38bdf8", 0.4, 0.3, { emissive: "#0c4a6e", emissiveIntensity: 0.6 }), -1.75, 2.7, -0.25);

    this.newsTop = new THREE.Group();
    this.newsTop.position.set(-0.08, 3.85, 0.0);
    this.newsTop.rotation.y = 0.08;
    addBox(this.newsTop, 3.15, 1.88, 0.22, slabBase, 0, 0, 0);
    const ntFace = new THREE.Mesh(
      new THREE.PlaneGeometry(3.02, 1.76),
      new THREE.MeshBasicMaterial({
        map: makeNewsSlabTex(
          "KumparanTekno",
          "25 Nov · 16.17 WIB",
          ["Aplikasi Mekari down saat", "tanggal gajian; pengguna", "kesulitan akses & sign-in."],
          "#38bdf8",
        ),
      }),
    );
    ntFace.position.set(0, 0, 0.12);
    this.newsTop.add(ntFace);
    tlGroup.add(this.newsTop);

    this.newsBottom = new THREE.Group();
    this.newsBottom.position.set(0.14, 1.75, 0.2);
    this.newsBottom.rotation.y = -0.08;
    addBox(this.newsBottom, 3.15, 1.88, 0.22, slabBase, 0, 0, 0);
    const nbFace = new THREE.Mesh(
      new THREE.PlaneGeometry(3.02, 1.76),
      new THREE.MeshBasicMaterial({
        map: makeNewsSlabTex(
          "Katadata",
          "26 Nov · 06.58 WIB",
          ["Gangguan layanan meluas", "hingga proses pencairan", "gaji karyawan terdampak."],
          "#f59e0b",
        ),
      }),
    );
    nbFace.position.set(0, 0, 0.12);
    this.newsBottom.add(nbFace);
    tlGroup.add(this.newsBottom);
    this.root.add(tlGroup);

    // 6. STATION 3 (x = 24): Official Announcement 3D Document Slab (26 Nov 09.00 WIB)
    this.docGroup = new THREE.Group();
    this.docGroup.position.set(24.0, 0, -1.5);
    addBox(this.docGroup, 3.35, 3.95, 0.32, pbr("#202739", 0.5, 0.3), 0, 2.7, 0);
    const docFace = new THREE.Mesh(
      new THREE.PlaneGeometry(3.16, 3.74),
      new THREE.MeshBasicMaterial({ map: makeOfficialDocTex(1) }),
    );
    docFace.position.set(0, 2.7, 0.17);
    this.docGroup.add(docFace);

    this.docHighlightBar = new THREE.Mesh(
      new THREE.PlaneGeometry(2.75, 0.1),
      new THREE.MeshBasicMaterial({ color: "#f59e0b", transparent: true, opacity: 0.9 }),
    );
    this.docHighlightBar.position.set(0, 2.34, 0.2);
    this.docGroup.add(this.docHighlightBar);
    this.root.add(this.docGroup);

    // 7. STATION 4 (x = 36): Conceptual 3D Isolation Gate (ZERO pillar occlusion!)
    const isoGroup = new THREE.Group();
    isoGroup.position.set(36, 0, 0);

    // Left block: APLIKASI
    addBox(isoGroup, 1.55, 1.4, 1.5, pbr("#1d2b44", 0.55, 0.25), -1.6, 0.7, -1.1);
    const appPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(1.65, 0.66),
      new THREE.MeshBasicMaterial({ map: makePlaqueTex("APLIKASI", "Akses Pengguna", "#131c2e", "#38bdf8") }),
    );
    appPlaque.position.set(-1.6, 1.85, -0.25);
    isoGroup.add(appPlaque);

    // Right block: SISTEM INTI
    addBox(isoGroup, 1.55, 1.8, 1.5, pbr("#1c2433", 0.55, 0.3), 1.6, 0.9, -1.1);
    const corePlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(1.65, 0.66),
      new THREE.MeshBasicMaterial({ map: makePlaqueTex("SISTEM INTI", "Data Dilindungi", "#131824", "#22c55e") }),
    );
    corePlaque.position.set(1.6, 2.2, -0.25);
    isoGroup.add(corePlaque);

    // Center Heavy Mechanical Isolation Gate Arch (pillars at z=-1.3 & z=+1.2, overhead sign cleanly ABOVE!)
    addBox(isoGroup, 0.28, 3.6, 0.28, postMat, 0, 1.8, -1.35);
    addBox(isoGroup, 0.28, 3.6, 0.28, postMat, 0, 1.8, 1.25);
    addBox(isoGroup, 0.38, 0.35, 2.9, postMat, 0, 3.55, -0.05);

    this.gateDoor = new THREE.Group();
    this.gateGlowMat = pbr("#ef4444", 0.4, 0.3, { emissive: "#991b1b", emissiveIntensity: 0.7 });
    addBox(this.gateDoor, 0.22, 2.35, 2.35, pbr("#242938", 0.48, 0.5), 0, 1.25, -0.05);
    addBox(this.gateDoor, 0.28, 0.18, 2.32, this.gateGlowMat, 0, 0.22, -0.05);
    isoGroup.add(this.gateDoor);

    // Overhead crisp plaque mounted cleanly ABOVE the arch at y=4.35, z=0.4 (100% unobstructed!)
    const gateSign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 1.22),
      new THREE.MeshBasicMaterial({
        map: makePlaqueTex("DINONAKTIFKAN", "Cegah Pergerakan Data", "#261214", "#ef4444"),
      }),
    );
    gateSign.position.set(0, 4.35, 0.35);
    isoGroup.add(gateSign);
    this.root.add(isoGroup);

    // 8. STATION 5 (x = 49): Dual Separated Infrastructure Islands (Tightened for 9:16!)
    const infraGroup = new THREE.Group();
    infraGroup.position.set(49, 0, -1.1);

    // Left Island: SISTEM LAMA (dimmed, isolated)
    addBox(infraGroup, 2.4, 0.3, 2.5, pbr("#1a1d26", 0.85, 0.12), -1.8, 0.15, 0);
    for (let i = 0; i < 3; i++) {
      addBox(infraGroup, 0.56, 1.55 + (i % 2) * 0.28, 0.56, pbr("#262b38", 0.7, 0.22), -2.45 + i * 0.65, 1.05, -0.35);
    }
    const oldSign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.84),
      new THREE.MeshBasicMaterial({ map: makePlaqueTex("SISTEM LAMA", "Terisolasi", "#1b1c22", "#94a3b8", "#cbd5e1") }),
    );
    oldSign.position.set(-1.7, 2.65, 0.45);
    infraGroup.add(oldSign);

    // Physical glowing amber separation wall in air-gap (x = -0.25)
    addBox(
      infraGroup,
      0.08,
      2.6,
      2.8,
      new THREE.MeshBasicMaterial({ color: "#f59e0b", transparent: true, opacity: 0.55 }),
      -0.25,
      1.3,
      0,
      false,
    );

    // Right Island: INFRASTRUKTUR BARU (rising modular towers + amber staged LEDs!)
    addBox(infraGroup, 2.8, 0.34, 2.6, pbr("#172336", 0.6, 0.25), 1.6, 0.17, 0);
    const srvMat = pbr("#1f314d", 0.4, 0.48);
    for (let i = 0; i < 6; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.64, 2.0, 0.64), srvMat);
      tower.position.set(0.85 + col * 0.78, 1.3, -0.45 + row * 0.88);
      tower.castShadow = true;
      tower.receiveShadow = true;
      infraGroup.add(tower);
      this.newServers.push(tower);

      const ledMat = pbr("#f59e0b", 0.25, 0.1, { emissive: "#f59e0b", emissiveIntensity: 0.75 });
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.08), ledMat);
      led.position.set(0.85 + col * 0.78, 2.1, -0.1 + row * 0.88);
      infraGroup.add(led);
      this.stageLeds.push(ledMat);
    }

    // Prominent overhead TARGET 24 JAM sign positioned cleanly above both islands
    const newSign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 1.28),
      new THREE.MeshBasicMaterial({
        map: makePlaqueTex("INFRASTRUKTUR BARU", "TARGET 24 JAM · BERTAHAP", "#102033", "#f59e0b"),
      }),
    );
    newSign.position.set(0.75, 4.15, 0.4);
    infraGroup.add(newSign);
    this.root.add(infraGroup);

    // 9. STATION 6 (x = 61): Glass Inspection Chamber — BELUM TERKONFIRMASI
    const auditGroup = new THREE.Group();
    auditGroup.position.set(61, 0, 0.35);
    addBox(auditGroup, 2.8, 0.2, 2.2, pbr("#1c2436", 0.5, 0.4), 0, 0.1, 0);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: "#93c5fd",
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.2,
    });
    addBox(auditGroup, 2.55, 2.15, 2.0, glassMat, 0, 1.28, 0, false);

    this.scanBeam = new THREE.Mesh(
      new THREE.PlaneGeometry(2.45, 1.9),
      new THREE.MeshBasicMaterial({ color: "#38bdf8", transparent: true, opacity: 0.38, side: THREE.DoubleSide }),
    );
    this.scanBeam.rotation.x = Math.PI / 2;
    this.scanBeam.position.set(0, 1.15, 0);
    auditGroup.add(this.scanBeam);

    this.auditSeal = new THREE.Group();
    this.auditSeal.position.set(0, 3.65, -0.1);
    const sealMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.3, 1.68),
      new THREE.MeshBasicMaterial({ map: makeAuditSealTex() }),
    );
    this.auditSeal.add(sealMesh);
    auditGroup.add(this.auditSeal);
    this.root.add(auditGroup);

    // 10. STATION 7 (x = 72): Vertically-Staggered Simulated Scam Rejected by Official Shield!
    const safeGroup = new THREE.Group();
    safeGroup.position.set(72, 0, -0.8);

    this.simMessage = new THREE.Group();
    this.simMessage.position.set(-0.25, 3.75, 0.1);
    const simMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.1, 2.06),
      new THREE.MeshBasicMaterial({ map: makeSimMessageTex() }),
    );
    this.simMessage.add(simMesh);
    safeGroup.add(this.simMessage);

    this.shieldGroup = new THREE.Group();
    this.shieldGroup.position.set(0.35, 1.6, 0.7);
    addBox(this.shieldGroup, 2.15, 2.15, 0.24, pbr("#0f2b3d", 0.35, 0.55), 0, 0, 0);
    const shFace = new THREE.Mesh(
      new THREE.PlaneGeometry(2.02, 2.02),
      new THREE.MeshBasicMaterial({ map: makeShieldTex() }),
    );
    shFace.position.set(0, 0, 0.13);
    this.shieldGroup.add(shFace);
    safeGroup.add(this.shieldGroup);
    this.root.add(safeGroup);
  }

  private buildPayrollFolder(): THREE.Group {
    const g = new THREE.Group();
    const coverMat = pbr("#d9532f", 0.52, 0.08);
    const paperMat = pbr("#f7f2e7", 0.85, 0.0);

    addBox(g, 1.38, 0.96, 0.08, coverMat, 0, 0, -0.06);
    addBox(g, 1.3, 0.88, 0.1, paperMat, 0, 0.03, 0.0);
    addBox(g, 1.38, 0.96, 0.06, pbr("#efe6d5", 0.65, 0.04), 0, 0, 0.07);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(1.35, 0.94),
      new THREE.MeshBasicMaterial({ map: makePayrollFolderTex() }),
    );
    face.position.set(0, 0, 0.105);
    g.add(face);
    return g;
  }

  update(sec: number, scenes: SceneTiming[], camera: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3 {
    scene.fog = this.fog;
    scene.background = new THREE.Color("#0c1018");

    let activeIdx = 0;
    for (let i = 0; i < scenes.length; i++) {
      if (sec >= scenes[i].sceneStartSec) activeIdx = i;
    }
    const sc = scenes[activeIdx] || scenes[0];
    const dur = Math.max(0.1, sc.sceneEndSec - sc.sceneStartSec);
    const p = clamp01((sec - sc.sceneStartSec) / dur);
    const pe = easeOutCubic(p);
    const hoverY = 0.86 + Math.sin(sec * 2.4) * 0.04;

    if (activeIdx === 0) {
      // Scene 1: Full-frame 3D Calendar 25 Nov + Barrier Arm + Sliding Payroll Folder
      const slide = easeOutCubic(clamp01(p * 1.65));
      const folderX = -2.0 + slide * 2.45;
      const recoil = p > 0.45 ? Math.sin((p - 0.45) * 14) * Math.exp(-(p - 0.45) * 7) * 0.12 : 0;
      this.payrollFolder.position.set(folderX - recoil, hoverY, 0.55);
      this.payrollFolder.rotation.set(-0.06, 0.1 - slide * 0.08, 0);
      this.barrierPivot.rotation.x = -1.25 * (1 - easeOutCubic(clamp01((p - 0.15) * 3.2)));

      this.camPos.set(-0.5 + pe * 0.8, 2.55 - pe * 0.15, 11.4 - pe * 1.1);
      this.camLook.set(0.1, 1.95, -0.8);
    } else if (activeIdx === 1) {
      // Scene 2: Vertical-staggered KumparanTekno & Katadata Monoliths + Gliding Payroll Folder
      this.payrollFolder.position.set(10.8 + easeInOutCubic(p) * 2.4, 0.72 + Math.sin(sec * 2.4) * 0.03, 0.75);
      this.payrollFolder.rotation.set(-0.05, Math.sin(p * Math.PI) * 0.16, 0);

      const s1 = easeOutCubic(clamp01(p * 2.6));
      const s2 = easeOutCubic(clamp01((p - 0.22) * 2.6));
      this.newsTop.position.x = -1.2 + s1 * 1.12;
      this.newsBottom.position.x = 1.3 - s2 * 1.16;

      this.camPos.set(11.6 + pe * 0.7, 2.5, 11.4 - pe * 0.7);
      this.camLook.set(12.0, 2.35, -0.8);
    } else if (activeIdx === 2) {
      // Scene 3: Official Announcement 26 Nov 09.00 WIB (100% edge-to-edge readable!)
      this.payrollFolder.position.set(22.9 + pe * 0.35, 0.82 + Math.sin(sec * 2.2) * 0.03, 0.8);
      this.payrollFolder.rotation.set(-0.04, 0.22, 0);

      const hl = easeOutCubic(clamp01((p - 0.22) * 2.5));
      this.docHighlightBar.scale.x = Math.max(0.01, hl);
      this.docHighlightBar.position.x = -1.37 + hl * 1.37;

      this.camPos.set(24.15 - pe * 0.2, 2.65, 11.2 - pe * 1.15);
      this.camLook.set(24.0, 2.35, -1.2);
    } else if (activeIdx === 3) {
      // Scene 4: Full Conceptual Isolation Architecture (APLIKASI -> Gate -> SISTEM INTI!)
      const approach = easeOutCubic(clamp01(p * 1.8));
      this.payrollFolder.position.set(34.1 + approach * 1.0, hoverY, 0.55);
      this.payrollFolder.rotation.set(-0.05, 0.14, 0);

      const drop = easeOutCubic(clamp01((p - 0.12) * 3.0));
      this.gateDoor.position.y = 2.35 * (1 - drop);
      this.gateGlowMat.emissiveIntensity = 0.45 + drop * 0.75;

      this.camPos.set(35.6 + pe * 0.8, 3.9 - pe * 0.2, 15.2 - pe * 0.8);
      this.camLook.set(36.0, 2.2, -0.4);
    } else if (activeIdx === 4) {
      // Scene 5: Wide Chasm View — Both Islands + Rising Modular Servers + TARGET 24 JAM!
      this.payrollFolder.position.set(48.35 + easeInOutCubic(p) * 0.9, hoverY, 0.95);
      this.payrollFolder.rotation.set(-0.05, -0.14, 0);

      this.newServers.forEach((srv, idx) => {
        const sp = easeOutCubic(clamp01((p - idx * 0.08) * 2.4));
        srv.scale.y = Math.max(0.1, sp);
        srv.position.y = 0.34 + sp * 0.98;
      });
      this.stageLeds.forEach((mat, idx) => {
        mat.emissiveIntensity = 0.45 + 0.55 * Math.sin(sec * 3.6 + idx * 0.9);
      });

      this.camPos.set(48.3 + easeInOutCubic(p) * 1.5, 3.4, 14.2 - pe * 0.9);
      this.camLook.set(49.0, 2.25, -0.8);
    } else if (activeIdx === 5) {
      // Scene 6: Glass Audit Chamber + Full BELUM TERKONFIRMASI Plaque
      this.payrollFolder.position.set(61.0, 1.12 + Math.sin(sec * 2.2) * 0.05, 0.35);
      this.payrollFolder.rotation.set(-0.04, Math.sin(p * Math.PI) * 0.22, 0);

      this.scanBeam.position.y = 0.4 + (0.5 + 0.5 * Math.sin(sec * 3.2)) * 1.65;
      const sealPop = easeOutCubic(clamp01((p - 0.14) * 3.0));
      this.auditSeal.scale.setScalar(0.86 + sealPop * 0.14);

      this.camPos.set(60.75 + pe * 0.5, 2.45, 11.4 - pe * 0.8);
      this.camLook.set(61.0, 2.25, 0.1);
    } else {
      // Scene 7: Simulated Scam Message Rejected + Official Shield
      this.payrollFolder.position.set(70.95, hoverY, 0.3);
      this.payrollFolder.rotation.set(-0.04, 0.22, 0);

      const incoming = easeOutCubic(clamp01(p * 3.0));
      const reject = easeOutCubic(clamp01((p - 0.35) * 2.6));
      this.simMessage.position.x = -1.6 + incoming * 1.45 - reject * 0.45;
      this.simMessage.rotation.z = -reject * 0.08;

      const shieldIn = easeOutCubic(clamp01((p - 0.14) * 3.0));
      this.shieldGroup.scale.setScalar(0.8 + shieldIn * 0.2);

      this.camPos.set(72.0, 2.55, 11.5 - pe * 0.7);
      this.camLook.set(72.0, 2.4, -0.3);
    }

    camera.position.copy(this.camPos);
    camera.lookAt(this.camLook);
    return this.camLook.clone();
  }

  dispose() {
    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        if (std.map) std.map.dispose();
        m.dispose();
      }
    });
  }
}
