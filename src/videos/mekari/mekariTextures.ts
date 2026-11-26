import * as THREE from "three";

const makeCanvasTex = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
};

/** Connecting hero object texture: single illustrative Payroll folder (ZERO fake balances/accounts!) */
export const makePayrollFolderTex = () =>
  makeCanvasTex(768, 540, (g, w, h) => {
    g.fillStyle = "#efe6d5";
    g.fillRect(0, 0, w, h);

    // Top folder crimson-terracotta accent band
    g.fillStyle = "#d9532f";
    g.fillRect(0, 0, w, 108);

    g.fillStyle = "#fff9f0";
    g.font = "900 44px 'Avenir Next', 'Helvetica Neue', sans-serif";
    g.textAlign = "left";
    g.fillText("BERKAS PAYROLL", 44, 68);

    // Right badge: ILUSTRASI
    g.fillStyle = "rgba(18, 22, 34, 0.28)";
    g.beginPath();
    g.roundRect(w - 224, 28, 184, 50, 10);
    g.fill();
    g.fillStyle = "#fff7eb";
    g.font = "800 24px 'Avenir Next', sans-serif";
    g.textAlign = "center";
    g.fillText("ILUSTRASI", w - 132, 61);

    // Abstract schematic payroll rows (NO fake numbers or account data!)
    g.fillStyle = "#33394a";
    g.font = "700 28px 'Avenir Next', sans-serif";
    g.textAlign = "left";
    g.fillText("SIKLUS PENGGAJIAN · NOV 2026", 44, 176);

    for (let i = 0; i < 4; i++) {
      const y = 224 + i * 64;
      g.fillStyle = "#d8cebc";
      g.beginPath();
      g.roundRect(44, y, 420 - (i % 2) * 70, 26, 8);
      g.fill();

      g.fillStyle = "#c9bca6";
      g.beginPath();
      g.roundRect(w - 196, y, 152, 26, 8);
      g.fill();
    }

    g.strokeStyle = "#b8ab95";
    g.lineWidth = 4;
    g.strokeRect(14, 14, w - 28, h - 28);
  });

/** Scene 1: Sculpted 3D Calendar Block — 25 NOVEMBER */
export const makeCalendarTex = () =>
  makeCanvasTex(720, 820, (g, w, h) => {
    g.fillStyle = "#f5efe4";
    g.fillRect(0, 0, w, h);

    // Top red header bar
    g.fillStyle = "#c83e2b";
    g.fillRect(0, 0, w, 190);

    // Calendar binder rings
    for (const rx of [165, 360, 555]) {
      g.fillStyle = "#222736";
      g.beginPath();
      g.arc(rx, 46, 22, 0, Math.PI * 2);
      g.fill();
    }

    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.font = "800 50px 'Avenir Next', sans-serif";
    g.fillText("NOVEMBER 2026", w / 2, 146);

    // Giant 25 numeral
    g.fillStyle = "#161a24";
    g.font = "900 310px 'Avenir Next', sans-serif";
    g.fillText("25", w / 2, 515);

    // Bottom pill: PERIODE GAJIAN
    g.fillStyle = "#222838";
    g.beginPath();
    g.roundRect(110, 588, w - 220, 92, 16);
    g.fill();
    g.fillStyle = "#f5b841";
    g.font = "800 40px 'Avenir Next', sans-serif";
    g.fillText("PERIODE GAJIAN", w / 2, 648);

    g.fillStyle = "#7a7368";
    g.font = "700 24px 'Avenir Next', sans-serif";
    g.fillText("ILUSTRASI LINIMASA", w / 2, 756);
  });

/** Scene 2: Attributed Media Monolith (NO fake social posts!) */
export const makeNewsSlabTex = (source: string, timeLabel: string, lines: string[], accentHex: string) =>
  makeCanvasTex(860, 520, (g, w, h) => {
    g.fillStyle = "#141925";
    g.fillRect(0, 0, w, h);

    // Top accent rule
    g.fillStyle = accentHex;
    g.fillRect(0, 0, w, 16);

    // Source badge
    g.fillStyle = accentHex;
    g.font = "800 30px 'Avenir Next', sans-serif";
    g.textAlign = "left";
    g.fillText(source.toUpperCase(), 48, 86);

    g.fillStyle = "#94a3b8";
    g.font = "600 26px 'Avenir Next', sans-serif";
    g.textAlign = "right";
    g.fillText(timeLabel, w - 48, 86);

    g.strokeStyle = "#273147";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(48, 118);
    g.lineTo(w - 48, 118);
    g.stroke();

    // Attributed headline lines
    g.fillStyle = "#f1f5f9";
    g.font = "800 44px 'Avenir Next', sans-serif";
    g.textAlign = "left";
    lines.forEach((line, i) => {
      g.fillText(line, 48, 198 + i * 66, w - 96);
    });

    // Footer attribution tag
    g.fillStyle = "#64748b";
    g.font = "700 24px 'Avenir Next', sans-serif";
    g.fillText("KUTIPAN RINGKAS LAPORAN MEDIA", 48, h - 42);

    g.strokeStyle = "#2b3650";
    g.lineWidth = 6;
    g.strokeRect(3, 3, w - 6, h - 6);
  });

/** Scene 3: Official Mekari Announcement Slab (26 Nov 2026 09.00 WIB) */
export const makeOfficialDocTex = (highlightProgress = 1) =>
  makeCanvasTex(960, 1120, (g, w, h) => {
    g.fillStyle = "#f7f3eb";
    g.fillRect(0, 0, w, h);

    // Official navy header
    g.fillStyle = "#162038";
    g.fillRect(0, 0, w, 190);

    g.fillStyle = "#5eead4";
    g.font = "800 26px 'Avenir Next', sans-serif";
    g.textAlign = "left";
    g.fillText("PENGUMUMAN RESMI · MEKARI.COM/ANNOUNCEMENT", 54, 72);

    g.fillStyle = "#ffffff";
    g.font = "900 44px 'Avenir Next', sans-serif";
    g.fillText("Pembaruan Status Layanan", 54, 134);

    // Date pill
    g.fillStyle = "#e8dfd0";
    g.beginPath();
    g.roundRect(54, 224, 520, 56, 10);
    g.fill();
    g.fillStyle = "#2b3245";
    g.font = "800 28px 'Avenir Next', sans-serif";
    g.fillText("26 November 2026 · 09.00 WIB", 76, 261);

    // Lead abstract text lines
    g.fillStyle = "#3b4254";
    g.font = "600 33px 'Avenir Next', sans-serif";
    g.fillText("Mekari mendeteksi adanya:", 54, 356);

    // Animated amber highlight box behind key verified phrase
    const hlW = Math.max(20, (w - 108) * Math.min(1, Math.max(0, highlightProgress)));
    g.fillStyle = "#fde68a";
    g.beginPath();
    g.roundRect(54, 388, hlW, 186, 14);
    g.fill();

    g.fillStyle = "#111827";
    g.font = "900 46px 'Avenir Next', sans-serif";
    g.fillText("“Aktivitas tidak wajar", 74, 464);
    g.fillText("yang diduga sebagai upaya", 74, 528);

    // Second line highlight
    g.fillStyle = "#b45309";
    g.font = "900 50px 'Avenir Next', sans-serif";
    g.fillText("SERANGAN SIBER”", 74, 640);

    // Containment bullets (factual only)
    g.strokeStyle = "#d5cbb8";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(54, 696);
    g.lineTo(w - 54, 696);
    g.stroke();

    g.fillStyle = "#334155";
    g.font = "700 31px 'Avenir Next', sans-serif";
    g.fillText("• Sistem dinonaktifkan sementara", 54, 766);
    g.fillText("• Pencegahan pergerakan data", 54, 826);
    g.fillText("• Infrastruktur baru disiapkan terpisah", 54, 886);

    g.fillStyle = "#64748b";
    g.font = "700 24px 'Avenir Next', sans-serif";
    g.fillText("ILUSTRASI KUTIPAN DOKUMEN PRIMER · TANPA KLAIM PELAKU", 54, h - 54);
  });

/** Scene 4 & 5: Architectural Block / Beacon Signage */
export const makePlaqueTex = (
  title: string,
  subtitle: string,
  bgHex: string,
  accentHex: string,
  textHex = "#f8fafc",
) =>
  makeCanvasTex(840, 320, (g, w, h) => {
    g.fillStyle = bgHex;
    g.fillRect(0, 0, w, h);

    g.fillStyle = accentHex;
    g.fillRect(0, 0, 22, h);

    g.fillStyle = textHex;
    g.font = "900 52px 'Avenir Next', sans-serif";
    g.textAlign = "left";
    g.fillText(title, 54, 146, w - 90);

    g.fillStyle = accentHex;
    g.font = "800 32px 'Avenir Next', sans-serif";
    g.fillText(subtitle, 54, 218, w - 90);

    g.strokeStyle = accentHex;
    g.lineWidth = 6;
    g.strokeRect(3, 3, w - 6, h - 6);
  });

/** Scene 6: Unconfirmed Data Audit Glass Stamp */
export const makeAuditSealTex = () =>
  makeCanvasTex(900, 460, (g, w, h) => {
    g.fillStyle = "#101722";
    g.fillRect(0, 0, w, h);

    g.strokeStyle = "#f59e0b";
    g.lineWidth = 12;
    g.strokeRect(20, 20, w - 40, h - 40);

    g.fillStyle = "#94a3b8";
    g.font = "800 32px 'Avenir Next', sans-serif";
    g.textAlign = "center";
    g.fillText("STATUS KEBOCORAN DATA", w / 2, 118);

    // Amber stamp banner
    g.fillStyle = "rgba(245, 158, 11, 0.16)";
    g.beginPath();
    g.roundRect(70, 154, w - 140, 142, 16);
    g.fill();
    g.strokeStyle = "#f59e0b";
    g.lineWidth = 5;
    g.stroke();

    g.fillStyle = "#fbbf24";
    g.font = "900 58px 'Avenir Next', sans-serif";
    g.fillText("BELUM TERKONFIRMASI", w / 2, 245);

    g.fillStyle = "#cbd5e1";
    g.font = "700 27px 'Avenir Next', sans-serif";
    g.fillText("Pengumuman resmi belum memastikan ada/tidaknya kebocoran", w / 2, 376, w - 90);
  });

/** Scene 7: Simulated Scam Message (NO active links, clearly marked SIMULASI) */
export const makeSimMessageTex = () =>
  makeCanvasTex(840, 560, (g, w, h) => {
    g.fillStyle = "#181d29";
    g.fillRect(0, 0, w, h);

    // Top warning banner
    g.fillStyle = "#b91c1c";
    g.fillRect(0, 0, w, 92);
    g.fillStyle = "#ffffff";
    g.font = "900 30px 'Avenir Next', sans-serif";
    g.textAlign = "center";
    g.fillText("PESAN SIMULASI · TANPA TAUTAN AKTIF", w / 2, 57);

    // Sender line
    g.fillStyle = "#fca5a5";
    g.font = "800 28px 'Avenir Next', sans-serif";
    g.textAlign = "left";
    g.fillText("Pengirim tidak dikenal (mengatasnamakan Mekari)", 48, 160);

    // Message bubble body
    g.fillStyle = "#232a3b";
    g.beginPath();
    g.roundRect(48, 192, w - 96, 224, 18);
    g.fill();

    g.fillStyle = "#e2e8f0";
    g.font = "700 34px 'Avenir Next', sans-serif";
    g.fillText("“Mohon kirim kata sandi,", 80, 266);
    g.fillText("kode OTP, dan data penggajian", 80, 322);
    g.fillText("untuk percepatan pemulihan akun.”", 80, 378);

    // Big red REJECT footer
    g.fillStyle = "#ef4444";
    g.font = "900 38px 'Avenir Next', sans-serif";
    g.textAlign = "center";
    g.fillText("TOLAK · JANGAN BAGIKAN DATA SENSITIF", w / 2, 496);

    g.strokeStyle = "#dc2626";
    g.lineWidth = 8;
    g.strokeRect(4, 4, w - 8, h - 8);
  });

/** Scene 7: Shield Front Plaque */
export const makeShieldTex = () =>
  makeCanvasTex(520, 520, (g, w, h) => {
    g.fillStyle = "#0e2a38";
    g.fillRect(0, 0, w, h);

    g.strokeStyle = "#38bdf8";
    g.lineWidth = 16;
    g.strokeRect(18, 18, w - 36, h - 36);

    g.fillStyle = "#38bdf8";
    g.font = "900 62px 'Avenir Next', sans-serif";
    g.textAlign = "center";
    g.fillText("GUNAKAN", w / 2, 220);
    g.fillStyle = "#ffffff";
    g.fillText("KANAL RESMI", w / 2, 305);

    g.fillStyle = "#94a3b8";
    g.font = "700 28px 'Avenir Next', sans-serif";
    g.fillText("mekari.com/announcement", w / 2, 385);
  });
