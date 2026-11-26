import * as THREE from "three";

export type DioramaRole = "budi" | "darto";
export type DioramaMood = "calm" | "smile" | "panic" | "sweat" | "shock" | "smug" | "laugh" | "excited";
export type DioramaPose =
  | "stand"
  | "walk"
  | "point_shock"
  | "sip_tea"
  | "spray"
  | "whistle"
  | "hold_eggs"
  | "chase_ducks"
  | "laugh_wave";

// Procedural woven Javanese batik texture for Pak Darto's 3D cylindrical torso
const makeBatikTex = (): THREE.CanvasTexture => {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#8a4b1f";
  ctx.fillRect(0, 0, 512, 512);

  // Subtle fabric weave
  ctx.fillStyle = "rgba(60,28,8,0.18)";
  for (let y = 0; y < 512; y += 8) ctx.fillRect(0, y, 512, 2);

  // Classic warm gold-ochre Indonesian parang / diamond batik motif
  ctx.strokeStyle = "#e8ba4c";
  ctx.lineWidth = 6;
  ctx.fillStyle = "#5c2c10";
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 8; col++) {
      const cx = col * 64 + (row % 2) * 32;
      const cy = row * 86 + 43;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 26);
      ctx.lineTo(cx + 22, cy);
      ctx.lineTo(cx, cy + 26);
      ctx.lineTo(cx - 22, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#f2d178";
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5c2c10";
    }
  }
  // Collar trim along top
  ctx.fillStyle = "#4d230d";
  ctx.fillRect(0, 0, 512, 34);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
};

// Procedural soft teal Indonesian petani shirt texture for Pak Budi's 3D torso
const makeBudiShirtTex = (): THREE.CanvasTexture => {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#1f8c7a";
  ctx.fillRect(0, 0, 512, 512);

  // Subtle cotton linen grain
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let y = 0; y < 512; y += 6) ctx.fillRect(0, y, 512, 2);

  // Dark teal collar & front placket (centered at u = 0.5 -> x = 256)
  ctx.fillStyle = "#135c50";
  ctx.fillRect(0, 0, 512, 36);
  ctx.fillRect(244, 32, 24, 240);

  // 3 cute wooden/cream shirt buttons down front center
  ctx.fillStyle = "#f5ebd6";
  ctx.strokeStyle = "#10453c";
  ctx.lineWidth = 4;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(256, 86 + i * 62, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Pocket on left chest
  ctx.strokeStyle = "#135c50";
  ctx.lineWidth = 5;
  ctx.strokeRect(306, 120, 62, 66);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

// Dynamic face texture wrapped cleanly on the FRONT of the 3D head sphere!
const paintHeadCanvas = (ctx: CanvasRenderingContext2D, role: DioramaRole, mood: DioramaMood, phase: number) => {
  const w = 512, h = 256;
  ctx.clearRect(0, 0, w, h);

  // Warm soft cream skin tone across entire sphere
  ctx.fillStyle = "#f7e3ce";
  ctx.fillRect(0, 0, w, h);

  // Soft warm hair dome covering back/top sides (for natural 3D view from behind!)
  if (role === "budi") {
    ctx.fillStyle = "#2b201b";
    ctx.fillRect(0, 0, w, 62);
    // Back of head hair (left and right edges of equirectangular UV: u near 0 and u near 1)
    ctx.fillRect(0, 48, 125, 118);
    ctx.fillRect(w - 125, 48, 125, 118);
  } else {
    // Pak Darto short dark hair under peci around sides/back
    ctx.fillStyle = "#241d1c";
    ctx.fillRect(0, 0, w, 72);
    ctx.fillRect(0, 58, 120, 95);
    ctx.fillRect(w - 120, 58, 120, 95);
  }

  // Front face center is at u = 0.5 -> x = 256, y = 136
  const cx = 256;
  const cy = 138;

  // Soft rosy cheeks
  ctx.fillStyle = "rgba(242, 132, 118, 0.36)";
  ctx.beginPath(); ctx.ellipse(cx - 48, cy + 18, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 48, cy + 18, 16, 10, 0, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = "#1c1518";
  ctx.fillStyle = "#1c1518";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const blink = Math.sin(phase * 1.9) > 0.96 && mood !== "panic" && mood !== "shock";

  // Eyes & eyebrows
  if (mood === "laugh" || mood === "excited") {
    ctx.lineWidth = 6.5;
    for (const sx of [-26, 26]) {
      ctx.beginPath(); ctx.arc(cx + sx, cy - 2, 13, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    }
  } else if (mood === "sweat") {
    ctx.lineWidth = 6;
    // Squinting > < tired eyes
    ctx.beginPath();
    ctx.moveTo(cx - 38, cy - 14); ctx.lineTo(cx - 18, cy - 4); ctx.lineTo(cx - 38, cy + 6);
    ctx.moveTo(cx + 38, cy - 14); ctx.lineTo(cx + 18, cy - 4); ctx.lineTo(cx + 38, cy + 6);
    ctx.stroke();
  } else if (mood === "panic" || mood === "shock") {
    for (const sx of [-26, 26]) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(cx + sx, cy - 6, 15, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 4.5; ctx.stroke();
      ctx.fillStyle = "#1c1518";
      ctx.beginPath(); ctx.arc(cx + sx, cy - 6, 5.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineWidth = 5.5;
    if (mood === "panic") {
      ctx.beginPath();
      ctx.moveTo(cx - 42, cy - 28); ctx.lineTo(cx - 14, cy - 18);
      ctx.moveTo(cx + 42, cy - 28); ctx.lineTo(cx + 14, cy - 18);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(cx - 26, cy - 24, 14, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 26, cy - 24, 14, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  } else if (blink) {
    ctx.lineWidth = 6;
    for (const sx of [-26, 26]) {
      ctx.beginPath(); ctx.moveTo(cx + sx - 11, cy - 4); ctx.lineTo(cx + sx + 11, cy - 4); ctx.stroke();
    }
  } else {
    // Classic warm @JadiBeginiClip dot eyes!
    for (const sx of [-25, 25]) {
      ctx.beginPath(); ctx.ellipse(cx + sx, cy - 6, 7.5, 9.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(cx + sx - 2.2, cy - 9, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1c1518";
    }
    ctx.lineWidth = 5;
    if (mood === "smug") {
      ctx.beginPath(); ctx.moveTo(cx - 36, cy - 20); ctx.lineTo(cx - 14, cy - 23); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 14, cy - 26); ctx.lineTo(cx + 38, cy - 19); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(cx - 25, cy - 19, 12, Math.PI * 1.18, Math.PI * 1.82); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + 25, cy - 19, 12, Math.PI * 1.18, Math.PI * 1.82); ctx.stroke();
    }
  }

  // Pak Darto's signature small tidy Javanese mustache!
  if (role === "darto") {
    ctx.fillStyle = "#2b1d17";
    ctx.beginPath();
    ctx.ellipse(cx - 9, cy + 16, 11, 4.5, -0.15, 0, Math.PI * 2);
    ctx.ellipse(cx + 9, cy + 16, 11, 4.5, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // Animated expressive mouth
  const talk = Math.abs(Math.sin(phase * 7.0));
  ctx.lineWidth = 5.5;
  if (mood === "panic") {
    ctx.fillStyle = "#b82e2e";
    ctx.beginPath(); ctx.ellipse(cx, cy + 32, 14, 14 + talk * 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (mood === "shock") {
    ctx.fillStyle = "#36181c";
    ctx.beginPath(); ctx.ellipse(cx, cy + 34, 12, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (mood === "sweat") {
    ctx.beginPath(); ctx.arc(cx, cy + 40, 14, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
  } else if (mood === "laugh" || mood === "excited") {
    ctx.fillStyle = "#c93838";
    ctx.beginPath(); ctx.arc(cx, cy + 25, 16, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy + 20, 14, 0.18 * Math.PI, 0.82 * Math.PI); ctx.stroke();
  }

  // Cute sweat drops on forehead for panic / sweat moods
  if (mood === "panic" || mood === "sweat") {
    ctx.fillStyle = "#76d1ff";
    ctx.strokeStyle = "#29698f";
    ctx.lineWidth = 3;
    const dy = (phase * 14) % 10;
    for (const [dx, oy] of [[-58, -14], [56, -8]] as [number, number][]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx, cy + oy + dy - 10);
      ctx.quadraticCurveTo(cx + dx + 8, cy + oy + dy + 2, cx + dx, cy + oy + dy + 8);
      ctx.quadraticCurveTo(cx + dx - 8, cy + oy + dy + 2, cx + dx, cy + oy + dy - 10);
      ctx.fill(); ctx.stroke();
    }
  }
};

export class DioramaCharacter {
  root = new THREE.Group();
  bodyPivot = new THREE.Group();
  headPivot = new THREE.Group();
  armL = new THREE.Group();
  armR = new THREE.Group();
  legL = new THREE.Group();
  legR = new THREE.Group();

  // Held / worn 3D props
  private backpackSprayer: THREE.Group;
  private sprayerWand: THREE.Group;
  private sprayMist: THREE.Mesh;
  private teaMug: THREE.Group;
  private heldEggs: THREE.Group;

  private role: DioramaRole;
  private faceCanvas: HTMLCanvasElement;
  private faceCtx: CanvasRenderingContext2D;
  private faceTex: THREE.CanvasTexture;
  private lastFaceKey = "";

  constructor(role: DioramaRole) {
    this.role = role;

    const limbMat = new THREE.MeshStandardMaterial({ color: "#262026", roughness: 0.72, metalness: 0.05 });
    const skinMat = new THREE.MeshStandardMaterial({ color: "#f7e3ce", roughness: 0.68, metalness: 0.02 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: "#2b221e", roughness: 0.8 });

    // Grounded soft contact shadow disc
    const shGeo = new THREE.CircleGeometry(0.44, 24);
    shGeo.rotateX(-Math.PI / 2);
    const shMat = new THREE.MeshBasicMaterial({ color: "#14101c", transparent: true, opacity: 0.24, depthWrite: false });
    const shadow = new THREE.Mesh(shGeo, shMat);
    shadow.position.y = 0.015;
    this.root.add(shadow);

    // 1. 3D Legs (hip y = 0.56 down to feet y = 0)
    const buildLeg = (sx: number) => {
      const lg = new THREE.Group();
      lg.position.set(sx, 0.56, 0);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.036, 0.52, 10), limbMat);
      shaft.position.y = -0.26;
      shaft.castShadow = true;
      lg.add(shaft);
      const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 10), shoeMat);
      shoe.scale.set(1.0, 0.62, 1.45);
      shoe.position.set(0, -0.52, 0.03);
      shoe.castShadow = true;
      lg.add(shoe);
      return lg;
    };
    this.legL = buildLeg(-0.11);
    this.legR = buildLeg(0.11);
    this.root.add(this.legL, this.legR);

    // 2. 3D Body Pivot (allows leaning forward, bouncing, twisting in 3D!)
    this.bodyPivot.position.set(0, 0.56, 0);
    this.root.add(this.bodyPivot);

    // 3D Cylindrical Torso + Smooth Rounded Shoulders/Hips (EVEN Batik & Shirt UV with ZERO stretching!)
    const torsoTex = role === "darto" ? makeBatikTex() : makeBudiShirtTex();
    const torsoMat = new THREE.MeshStandardMaterial({ map: torsoTex, roughness: 0.82, metalness: 0.02 });
    const trimMat = new THREE.MeshStandardMaterial({
      color: role === "darto" ? "#6e3814" : "#187566",
      roughness: 0.84,
      metalness: 0.02,
    });
    const cylGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.56, 28, 1, true);
    // In Three.js CylinderGeometry, u = 0.5 faces +Z natively!
    const torsoCyl = new THREE.Mesh(cylGeo, torsoMat);
    torsoCyl.position.y = 0.36;
    torsoCyl.castShadow = true;
    torsoCyl.receiveShadow = true;
    this.bodyPivot.add(torsoCyl);

    const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), trimMat);
    capTop.scale.set(1, 0.55, 1);
    capTop.position.y = 0.635;
    capTop.castShadow = true;
    this.bodyPivot.add(capTop);

    const capBot = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 14, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), trimMat);
    capBot.scale.set(1, 0.55, 1);
    capBot.position.y = 0.085;
    capBot.castShadow = true;
    this.bodyPivot.add(capBot);

    // 3. 3D Articulated Arms (shoulders at y = 0.54 relative to bodyPivot)
    const buildArm = (sx: number) => {
      const ag = new THREE.Group();
      ag.position.set(sx, 0.54, 0);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.032, 0.44, 10), limbMat);
      upper.position.y = -0.22;
      upper.castShadow = true;
      ag.add(upper);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), skinMat);
      hand.position.y = -0.44;
      hand.castShadow = true;
      ag.add(hand);
      return ag;
    };
    this.armL = buildArm(-0.26);
    this.armR = buildArm(0.26);
    this.bodyPivot.add(this.armL, this.armR);

    // 4. 3D Head Pivot (at y = 0.78 relative to bodyPivot)
    this.headPivot.position.set(0, 0.78, 0);
    this.bodyPivot.add(this.headPivot);

    this.faceCanvas = document.createElement("canvas");
    this.faceCanvas.width = 512;
    this.faceCanvas.height = 256;
    this.faceCtx = this.faceCanvas.getContext("2d")!;
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTex.colorSpace = THREE.SRGBColorSpace;
    this.faceTex.anisotropy = 4;

    const headGeo = new THREE.SphereGeometry(0.32, 26, 20);
    headGeo.rotateY(-Math.PI / 2); // u = 0.5 faces +Z!
    const headMat = new THREE.MeshStandardMaterial({ map: this.faceTex, roughness: 0.65, metalness: 0.02 });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.scale.set(1.06, 0.94, 0.98);
    headMesh.position.y = 0.28;
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    this.headPivot.add(headMesh);

    // 5. Iconic 3D Indonesian Headgear!
    if (role === "budi") {
      // Woven Bamboo Conical Caping Hat!
      const capingMat = new THREE.MeshStandardMaterial({ color: "#deb552", roughness: 0.86, metalness: 0.02 });
      const caping = new THREE.Mesh(new THREE.ConeGeometry(0.54, 0.28, 22), capingMat);
      caping.position.y = 0.58;
      caping.castShadow = true;
      this.headPivot.add(caping);
      // Darker woven rim ring
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.53, 0.022, 8, 24),
        new THREE.MeshStandardMaterial({ color: "#a37829", roughness: 0.9 }),
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.445;
      this.headPivot.add(rim);
    } else {
      // Classic 3D Black Velvet Peci (Songkok)!
      const peciMat = new THREE.MeshStandardMaterial({ color: "#1d1a21", roughness: 0.88, metalness: 0.04 });
      const peci = new THREE.Mesh(new THREE.CylinderGeometry(0.295, 0.305, 0.24, 24), peciMat);
      peci.scale.set(1.02, 1.0, 1.12);
      peci.position.set(0, 0.54, 0.0);
      peci.rotation.x = -0.06;
      peci.castShadow = true;
      this.headPivot.add(peci);
    }

    // 6. 3D Backpack Pesticide Sprayer + Wand + Mist (for Pak Darto!)
    this.backpackSprayer = new THREE.Group();
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.17, 0.46, 16),
      new THREE.MeshStandardMaterial({ color: "#2d9c4f", roughness: 0.45, metalness: 0.1 }),
    );
    tank.position.set(0, 0.4, -0.32);
    tank.castShadow = true;
    this.backpackSprayer.add(tank);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12),
      new THREE.MeshStandardMaterial({ color: "#e8c43c", roughness: 0.5 }),
    );
    cap.position.set(0, 0.66, -0.32);
    this.backpackSprayer.add(cap);
    this.backpackSprayer.visible = false;
    this.bodyPivot.add(this.backpackSprayer);

    this.sprayerWand = new THREE.Group();
    // Point wand DOWNWARD & FORWARD from hand toward the rice paddy!
    this.sprayerWand.position.set(0, -0.44, 0);
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.78, 8),
      new THREE.MeshStandardMaterial({ color: "#555d66", roughness: 0.35, metalness: 0.65 }),
    );
    pipe.rotation.x = Math.PI * 0.62;
    pipe.position.set(0, -0.14, 0.34);
    this.sprayerWand.add(pipe);
    this.sprayMist = new THREE.Mesh(
      new THREE.ConeGeometry(0.26, 0.68, 16),
      new THREE.MeshBasicMaterial({ color: "#e8fbff", transparent: true, opacity: 0.36, depthWrite: false }),
    );
    this.sprayMist.rotation.x = -Math.PI * 0.38;
    this.sprayMist.position.set(0, -0.36, 0.88);
    this.sprayerWand.add(this.sprayMist);
    this.sprayerWand.visible = false;
    this.armR.add(this.sprayerWand);

    // 7. 3D Warm Coffee/Tea Mug (for Pak Budi relaxing in saung!)
    this.teaMug = new THREE.Group();
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.058, 0.13, 14),
      new THREE.MeshStandardMaterial({ color: "#d95b38", roughness: 0.45 }),
    );
    mug.position.set(0, -0.44, 0.08);
    this.teaMug.add(mug);
    this.teaMug.visible = false;
    this.armR.add(this.teaMug);

    // 8. 3D Small Egg Tray held in front (for Pak Budi harvest!)
    this.heldEggs = new THREE.Group();
    const tray = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.17, 0.14, 14),
      new THREE.MeshStandardMaterial({ color: "#b57c3a", roughness: 0.85 }),
    );
    tray.position.set(0, 0.34, 0.34);
    this.heldEggs.add(tray);
    const eMat = new THREE.MeshStandardMaterial({ color: "#e3f5f2", roughness: 0.35 });
    for (const [ex, ez] of [[-0.08, 0.32], [0.08, 0.32], [0, 0.4], [0, 0.26]] as [number, number][]) {
      const egg = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), eMat);
      egg.scale.set(1, 1.28, 1);
      egg.position.set(ex, 0.44, ez);
      this.heldEggs.add(egg);
    }
    this.heldEggs.visible = false;
    this.bodyPivot.add(this.heldEggs);
  }

  setState(
    visible: boolean,
    x: number, y: number, z: number,
    yaw: number,
    mood: DioramaMood,
    pose: DioramaPose,
    phase: number,
    headTurn = 0,
    scale = 1.0,
  ) {
    this.root.visible = visible;
    if (!visible) return;

    this.root.position.set(x, y, z);
    this.root.rotation.y = yaw;
    this.root.scale.setScalar(scale);

    // Update dynamic face canvas texture (quantized for crisp performance)
    const pQ = Math.round(phase * 10);
    const fKey = `${mood}|${pQ}`;
    if (fKey !== this.lastFaceKey) {
      paintHeadCanvas(this.faceCtx, this.role, mood, phase);
      this.faceTex.needsUpdate = true;
      this.lastFaceKey = fKey;
    }

    // Reset transforms
    this.bodyPivot.position.set(0, 0.56, 0);
    this.bodyPivot.rotation.set(0, 0, 0);
    this.headPivot.rotation.set(0, headTurn, 0);
    this.armL.rotation.set(0, 0, 0.16);
    this.armR.rotation.set(0, 0, -0.16);
    this.legL.rotation.set(0, 0, 0);
    this.legR.rotation.set(0, 0, 0);

    this.backpackSprayer.visible = false;
    this.sprayerWand.visible = false;
    this.teaMug.visible = false;
    this.heldEggs.visible = false;

    const bob = Math.sin(phase * 4.0) * 0.025;

    switch (pose) {
      case "stand":
        this.bodyPivot.position.y = 0.56 + bob;
        this.armL.rotation.z = 0.16 + Math.sin(phase * 2.5) * 0.05;
        this.armR.rotation.z = -0.16 - Math.sin(phase * 2.5) * 0.05;
        this.headPivot.rotation.x = Math.sin(phase * 2.0) * 0.04;
        break;

      case "walk": {
        const sw = Math.sin(phase * 7.5);
        this.bodyPivot.position.y = 0.56 + Math.abs(sw) * 0.05;
        this.bodyPivot.rotation.x = 0.08;
        this.legL.rotation.x = sw * 0.52;
        this.legR.rotation.x = -sw * 0.52;
        this.armL.rotation.x = -sw * 0.45;
        this.armR.rotation.x = sw * 0.45;
        break;
      }

      case "point_shock":
        this.bodyPivot.position.y = 0.56 + Math.abs(Math.sin(phase * 7.0)) * 0.05;
        this.bodyPivot.rotation.x = 0.14;
        this.armR.rotation.set(-1.35 + Math.sin(phase * 10) * 0.18, 0, -0.25);
        this.armL.rotation.set(-0.4, 0, 0.65);
        this.headPivot.rotation.z = Math.sin(phase * 8) * 0.06;
        break;

      case "sip_tea":
        this.teaMug.visible = true;
        this.bodyPivot.position.y = 0.56 + bob;
        this.armR.rotation.set(-1.15 + Math.sin(phase * 2.4) * 0.25, 0.25, -0.1);
        this.armL.rotation.set(-0.2, 0, 0.25);
        this.headPivot.rotation.x = -0.06 + Math.sin(phase * 2.4) * 0.08;
        break;

      case "spray": {
        this.backpackSprayer.visible = true;
        this.sprayerWand.visible = true;
        const sw = Math.sin(phase * 6.0);
        this.bodyPivot.position.y = 0.56 + Math.abs(sw) * 0.04;
        this.bodyPivot.rotation.x = 0.22; // Leaning forward tiredly while spraying!
        this.legL.rotation.x = sw * 0.42;
        this.legR.rotation.x = -sw * 0.42;
        this.armR.rotation.set(-0.48, Math.sin(phase * 5.0) * 0.35, -0.18);
        this.armL.rotation.set(-0.35, -0.15, 0.25);
        this.sprayMist.scale.setScalar(0.85 + Math.sin(phase * 18) * 0.22);
        break;
      }

      case "whistle":
        this.bodyPivot.position.y = 0.56 + bob;
        this.armR.rotation.set(-0.4, 0, 2.35 + Math.sin(phase * 8) * 0.28);
        this.armL.rotation.set(-0.3, 0, -0.35);
        break;

      case "hold_eggs":
        this.heldEggs.visible = true;
        this.bodyPivot.position.y = 0.56 + Math.abs(Math.sin(phase * 4.5)) * 0.03;
        this.armL.rotation.set(-0.95, -0.35, 0.15);
        this.armR.rotation.set(-0.95, 0.35, -0.15);
        break;

      case "chase_ducks": {
        const run = Math.sin(phase * 11.0);
        this.bodyPivot.position.y = 0.56 + Math.abs(run) * 0.12;
        this.bodyPivot.rotation.x = 0.2;
        this.legL.rotation.x = run * 0.68;
        this.legR.rotation.x = -run * 0.68;
        // Arms raised joyfully OUTWARD & UPWARD!
        this.armL.rotation.set(-0.35, 0, -2.35 + Math.sin(phase * 11) * 0.32);
        this.armR.rotation.set(-0.35, 0, 2.35 - Math.sin(phase * 11) * 0.32);
        break;
      }

      case "laugh_wave":
        this.bodyPivot.position.y = 0.56 + Math.abs(Math.sin(phase * 7.5)) * 0.06;
        this.armL.rotation.set(-0.3, 0, -2.4 + Math.sin(phase * 10) * 0.32);
        this.armR.rotation.set(-0.3, 0, 2.4 - Math.sin(phase * 10) * 0.32);
        this.headPivot.rotation.x = -0.08 + Math.sin(phase * 9) * 0.06;
        break;
    }
  }
}
