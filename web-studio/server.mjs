import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUT_ROOT = path.join(PROJECT_ROOT, "out");
const VOICES_DIR = path.join(OUT_ROOT, "studio_voices");
const RENDERS_DIR = path.join(OUT_ROOT, "studio_renders");
const PRESETS_FILE = path.join(__dirname, ".studio_presets.json");

fs.mkdirSync(VOICES_DIR, { recursive: true });
fs.mkdirSync(RENDERS_DIR, { recursive: true });

// Load optional local .env file without extra dependencies
const envPath = path.join(PROJECT_ROOT, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

function firstExisting(candidates) {
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

function resolveEnvConfig() {
  const scratchDir = path.resolve(PROJECT_ROOT, "..");
  const mlxPython = firstExisting([
    process.env.MLX_PYTHON,
    path.join(PROJECT_ROOT, ".venv", "bin", "python"),
    path.join(scratchDir, "mlx_voice_venv", "bin", "python"),
  ]);
  const ytPython = firstExisting([
    process.env.YT_PYTHON,
    path.join(PROJECT_ROOT, ".venv", "bin", "python"),
    path.join(scratchDir, "yt_uploader_venv", "bin", "python"),
  ]);
  const ytToken = firstExisting([
    process.env.YOUTUBE_TOKEN_FILE,
    path.join(PROJECT_ROOT, "secrets", "youtube_token.json"),
    path.join(scratchDir, "yt_auto_uploader", "youtube_token.json"),
    path.join(scratchDir, "nalaton-studio", "scripts", "youtube_token.json"),
  ]);
  const ytClientSecret = firstExisting([
    process.env.YOUTUBE_CLIENT_SECRET,
    path.join(PROJECT_ROOT, "secrets", "client_secret.json"),
    path.join(scratchDir, "yt_auto_uploader", "client_secret.json"),
    path.join(scratchDir, "nalaton-studio", "scripts", "client_secret.json"),
  ]);
  const defaultDownloadsQueue = path.join(os.homedir(), "Downloads", "Content Daily", "Auto Upload 19-00");
  const queueDir =
    process.env.YOUTUBE_QUEUE_DIR ||
    (fs.existsSync(defaultDownloadsQueue) ? defaultDownloadsQueue : path.join(PROJECT_ROOT, "queue"));

  const refAudio = firstExisting([
    process.env.MLX_REF_AUDIO,
    path.join(PROJECT_ROOT, "assets", "brand", "voice_ref.wav"),
    path.join(scratchDir, "cartoon-3d-studio", "brand", "studio_voice_ref.wav"),
  ]);
  const refText = firstExisting([
    process.env.MLX_REF_TEXT,
    path.join(PROJECT_ROOT, "assets", "brand", "voice_ref.txt"),
    path.join(scratchDir, "cartoon-3d-studio", "brand", "studio_voice_ref.txt"),
  ]);

  const compositorDir = path.join(PROJECT_ROOT, "node_modules", "@remotion", "compositor-darwin-arm64");
  const ffmpegBin = firstExisting([
    path.join(compositorDir, "ffmpeg"),
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
  ]);

  return {
    mlxPython,
    ytPython,
    ytToken,
    ytClientSecret,
    queueDir,
    refAudio,
    refText,
    compositorDir: fs.existsSync(compositorDir) ? compositorDir : null,
    ffmpegBin,
    remotionCli: path.join(PROJECT_ROOT, "node_modules", "@remotion", "cli", "remotion-cli.js"),
  };
}

const jobs = new Map();
let jobCounter = 1;

function createJob(type, label) {
  const id = `job_${Date.now()}_${jobCounter++}`;
  const job = {
    id,
    type,
    label,
    status: "running",
    progress: 0,
    logs: [],
    outputUrl: null,
    outputFile: null,
    error: null,
    createdAt: new Date().toISOString(),
    finishedAt: null,
  };
  jobs.set(id, job);
  return job;
}

function appendLog(job, text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  for (const line of lines) {
    job.logs.push(line);
    if (job.logs.length > 160) job.logs.shift();
    // Parse Remotion or YouTube upload progress percentages
    const mPct = line.match(/(\d{1,3})%/);
    if (mPct) {
      const pct = Math.min(99, Math.max(job.progress, parseInt(mPct[1], 10)));
      job.progress = pct;
    }
    const mRendered = line.match(/Rendered\s+(\d+)\/(\d+)/i);
    if (mRendered) {
      const cur = parseInt(mRendered[1], 10);
      const tot = Math.max(1, parseInt(mRendered[2], 10));
      job.progress = Math.min(95, Math.round((cur / tot) * 90));
    }
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 4 * 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function safeSlug(input, fallback = "item") {
  const s = String(input || "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || fallback;
}

function serveMediaFile(req, res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === ".mp4"
      ? "video/mp4"
      : ext === ".wav"
        ? "audio/wav"
        : ext === ".mp3"
          ? "audio/mpeg"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : "application/octet-stream";

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunkSize = end - start + 1;
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": mime,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": stat.size,
      "Accept-Ranges": "bytes",
      "Content-Type": mime,
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

function listFilesWithStats(dir, exts, urlPrefix) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => !name.startsWith(".") && exts.includes(path.extname(name).toLowerCase()))
    .map((name) => {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      return {
        name,
        sizeMB: Number((st.size / (1024 * 1024)).toFixed(2)),
        updatedAt: st.mtime.toISOString(),
        url: `${urlPrefix}/${encodeURIComponent(name)}`,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function listYoutubeQueue(queueDir) {
  if (!fs.existsSync(queueDir)) {
    return { queueDir, items: [], history: [] };
  }
  const skip = new Set(["Uploaded", "upload_history.json", "auto_upload.log", "CARA_PAKAI.txt", "client_secret.json", ".DS_Store"]);
  const entries = fs.readdirSync(queueDir).filter((e) => !skip.has(e) && !e.startsWith(".")).sort();
  const items = [];

  for (const name of entries) {
    const full = path.join(queueDir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      const files = fs.readdirSync(full);
      const mp4 = files.find((f) => f.toLowerCase().endsWith(".mp4") && !f.startsWith("."));
      if (mp4) {
        const mp4Stat = fs.statSync(path.join(full, mp4));
        const capPath = path.join(full, "caption.txt");
        let title = name;
        let hasCaption = false;
        if (fs.existsSync(capPath)) {
          hasCaption = true;
          const raw = fs.readFileSync(capPath, "utf-8");
          const m = raw.match(/Judul[^\n]*:\s*\n([^\n]+)/i) || raw.match(/Judul\s*:\s*([^\n]+)/i);
          if (m) title = m[1].trim();
        }
        items.push({
          name,
          mp4,
          sizeMB: Number((mp4Stat.size / (1024 * 1024)).toFixed(1)),
          title,
          hasCaption,
        });
      }
    } else if (st.isFile() && name.toLowerCase().endsWith(".mp4")) {
      items.push({
        name,
        mp4: name,
        sizeMB: Number((st.size / (1024 * 1024)).toFixed(1)),
        title: name.replace(/\.mp4$/i, ""),
        hasCaption: false,
      });
    }
  }

  let history = [];
  const histPath = path.join(queueDir, "upload_history.json");
  if (fs.existsSync(histPath)) {
    try {
      history = JSON.parse(fs.readFileSync(histPath, "utf-8"));
    } catch {
      history = [];
    }
  }
  return { queueDir, items, history: history.slice().reverse().slice(0, 12) };
}

function startVoiceJob(payload) {
  const cfg = resolveEnvConfig();
  const job = createJob("voice", `Generate Voice (${payload.mode === "clone" ? "Base Clone" : "VoiceDesign 1.7B"})`);

  if (!cfg.mlxPython) {
    job.status = "failed";
    job.error = "Python environment dengan mlx-audio tidak ditemukan. Install via: pip install -r requirements.txt";
    job.finishedAt = new Date().toISOString();
    return job;
  }

  const mode = payload.mode === "clone" ? "clone" : "design";
  const text = String(payload.text || "").trim();
  if (!text) {
    job.status = "failed";
    job.error = "Teks narasi tidak boleh kosong.";
    job.finishedAt = new Date().toISOString();
    return job;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outName = `${stamp}_${mode}_${safeSlug(payload.label || "voice")}.wav`;
  const outPath = path.join(VOICES_DIR, outName);

  const instruct =
    String(payload.instruct || "").trim() ||
    "A relaxed, confident 30-year-old Indonesian male explainer voice with a warm medium-low pitch. Speaks naturally like a smart friend explaining an interesting fact in a YouTube video. Smooth conversational flow, steady brisk pace, gentle natural pitch inflection on questions, clean close-mic studio sound.";
  const temperature = Math.min(1.2, Math.max(0.4, Number(payload.temperature ?? 0.85)));

  const pyScript = `
import os, sys, json, numpy as np, soundfile as sf
from mlx_audio.tts.utils import load_model
from mlx_audio.utils import load_audio

cfg = json.loads(os.environ["STUDIO_TTS_PAYLOAD"])
mode = cfg["mode"]
out_path = cfg["out_path"]
text = cfg["text"]
temp = float(cfg["temperature"])

def trim_tighten(wav, sr, max_gap_s=0.17, thresh=0.012):
    if wav.ndim > 1:
        wav = wav.mean(axis=-1)
    wav = wav.astype(np.float32)
    win = max(1, int(sr * 0.015))
    rms = np.sqrt(np.convolve(wav ** 2, np.ones(win) / win, mode="same") + 1e-12)
    idx = np.where(rms > thresh)[0]
    if len(idx) > 0:
        pad = int(sr * 0.03)
        wav = wav[max(0, idx[0] - pad) : min(len(wav), idx[-1] + pad)]
    hop = int(sr * 0.01)
    max_sil = int(max_gap_s / 0.01)
    n_frames = len(wav) // hop
    chunks, sil = [], 0
    for i in range(n_frames):
        fr = wav[i * hop : (i + 1) * hop]
        if float(np.sqrt(np.mean(fr ** 2) + 1e-12)) < thresh:
            sil += 1
            if sil <= max_sil:
                chunks.append(fr)
        else:
            sil = 0
            chunks.append(fr)
    if len(wav[n_frames * hop :]) > 0:
        chunks.append(wav[n_frames * hop :])
    out = np.concatenate(chunks) if chunks else wav
    peak = np.max(np.abs(out)) + 1e-9
    return (out / peak * 0.92).astype(np.float32)

if mode == "design":
    model_id = os.environ.get("MLX_TTS_MODEL", "mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-8bit")
    print(f"Loading {model_id} (15%)...", flush=True)
    model = load_model(model_id)
    print("Synthesizing Indonesian voiceover (55%)...", flush=True)
    res = list(model.generate_voice_design(text=text, instruct=cfg["instruct"], language="auto", temperature=temp, top_p=0.92))
else:
    model_id = "mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit"
    print(f"Loading {model_id} (15%)...", flush=True)
    model = load_model(model_id)
    ref_audio = load_audio(cfg["ref_audio"], sample_rate=model.sample_rate)
    ref_text = open(cfg["ref_text"], "r", encoding="utf-8").read().strip()
    print("Cloning voice from studio reference (55%)...", flush=True)
    res = list(model.generate(text=text, ref_audio=ref_audio, ref_text=ref_text, lang_code="Indonesian", temperature=temp, top_p=0.95))

wav = np.concatenate([np.array(r.audio, dtype=np.float32) for r in res], axis=0)
wav = trim_tighten(wav, model.sample_rate, max_gap_s=0.17)
sf.write(out_path, wav, model.sample_rate)
print(f"Voice saved ({len(wav)/model.sample_rate:.2f}s) -> {out_path} (100%)", flush=True)
`;

  if (mode === "clone" && (!cfg.refAudio || !cfg.refText)) {
    job.status = "failed";
    job.error = "File referensi suara (voice_ref.wav / voice_ref.txt) tidak ditemukan. Gunakan mode VoiceDesign 1.7B atau set MLX_REF_AUDIO di .env.";
    job.finishedAt = new Date().toISOString();
    return job;
  }

  appendLog(job, `Memulai Qwen3-TTS (${mode})...`);
  const child = spawn(cfg.mlxPython, ["-c", pyScript], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      STUDIO_TTS_PAYLOAD: JSON.stringify({
        mode,
        text,
        instruct,
        temperature,
        out_path: outPath,
        ref_audio: cfg.refAudio,
        ref_text: cfg.refText,
      }),
    },
  });

  child.stdout.on("data", (d) => appendLog(job, d));
  child.stderr.on("data", (d) => appendLog(job, d));
  child.on("close", (code) => {
    job.finishedAt = new Date().toISOString();
    if (code === 0 && fs.existsSync(outPath)) {
      job.status = "done";
      job.progress = 100;
      job.outputFile = outName;
      job.outputUrl = `/media/voices/${encodeURIComponent(outName)}`;
    } else {
      job.status = "failed";
      job.error = `TTS process exited with code ${code}`;
    }
  });
  return job;
}

function startRenderJob(payload) {
  const cfg = resolveEnvConfig();
  const compId = String(payload.compositionId || "MinaPadiShort");
  const allowedComps = new Set([
    "PadiBebekShort",
    "MinaPadiShort",
    "TamboraShort",
    "PulauRunShort",
    "JawaShort",
    "BahasaJawaShort",
    "CafeShort",
    "BridgeShort",
  ]);
  const job = createJob("render", `Render ${compId}`);

  if (!allowedComps.has(compId)) {
    job.status = "failed";
    job.error = `Composition ID tidak dikenal: ${compId}`;
    job.finishedAt = new Date().toISOString();
    return job;
  }

  const crf = Math.min(28, Math.max(14, parseInt(payload.crf ?? 18, 10) || 18));
  const concurrency = Math.min(4, Math.max(1, parseInt(payload.concurrency ?? 2, 10) || 2));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const rawName = `${stamp}_${compId}_raw.mp4`;
  const finalName = `${stamp}_${compId}.mp4`;
  const rawPath = path.join(RENDERS_DIR, rawName);
  const finalPath = path.join(RENDERS_DIR, finalName);
  const propsPath = path.join(RENDERS_DIR, `${stamp}_${compId}_props.json`);

  fs.writeFileSync(propsPath, JSON.stringify(payload.props || {}, null, 2), "utf-8");

  const args = [
    cfg.remotionCli,
    "render",
    compId,
    rawPath,
    `--props=${propsPath}`,
    `--concurrency=${concurrency}`,
    `--crf=${crf}`,
    "--gl=angle",
    "--timeout=120000",
  ];
  if (payload.frameRange && /^\d+-\d+$/.test(String(payload.frameRange))) {
    args.push(`--frames=${payload.frameRange}`);
  }

  appendLog(job, `Rendering ${compId} (CRF=${crf}, concurrency=${concurrency})...`);
  const env = { ...process.env };
  if (cfg.compositorDir) {
    env.DYLD_LIBRARY_PATH = cfg.compositorDir;
  }

  const child = spawn(process.execPath, args, { cwd: PROJECT_ROOT, env });
  child.stdout.on("data", (d) => appendLog(job, d));
  child.stderr.on("data", (d) => appendLog(job, d));
  child.on("close", (code) => {
    if (code !== 0 || !fs.existsSync(rawPath)) {
      job.status = "failed";
      job.error = `Remotion render failed (exit ${code})`;
      job.finishedAt = new Date().toISOString();
      return;
    }

    const voiceFile = payload.voiceFile ? path.basename(String(payload.voiceFile)) : null;
    const voicePath = voiceFile ? path.join(VOICES_DIR, voiceFile) : null;

    if (voicePath && fs.existsSync(voicePath) && cfg.ffmpegBin) {
      appendLog(job, `Muxing video + voiceover (${voiceFile}) (95%)...`);
      const mux = spawn(
        cfg.ffmpegBin,
        [
          "-y",
          "-i",
          rawPath,
          "-i",
          voicePath,
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-b:a",
          "256k",
          "-ar",
          "48000",
          "-movflags",
          "+faststart",
          "-shortest",
          finalPath,
        ],
        { cwd: PROJECT_ROOT, env },
      );
      mux.stderr.on("data", (d) => appendLog(job, d));
      mux.on("close", (mCode) => {
        job.finishedAt = new Date().toISOString();
        if (mCode === 0 && fs.existsSync(finalPath)) {
          fs.unlinkSync(rawPath);
          job.status = "done";
          job.progress = 100;
          job.outputFile = finalName;
          job.outputUrl = `/media/renders/${encodeURIComponent(finalName)}`;
          appendLog(job, `Render + Audio selesai -> ${finalName} (100%)`);
        } else {
          job.status = "failed";
          job.error = `FFmpeg audio mux failed (exit ${mCode})`;
        }
      });
    } else {
      fs.renameSync(rawPath, finalPath);
      job.status = "done";
      job.progress = 100;
      job.outputFile = finalName;
      job.outputUrl = `/media/renders/${encodeURIComponent(finalName)}`;
      job.finishedAt = new Date().toISOString();
      appendLog(job, `Render selesai -> ${finalName} (100%)`);
    }
  });

  return job;
}

function startYoutubeJob(action, payload = {}) {
  const cfg = resolveEnvConfig();
  const job = createJob("youtube", `YouTube ${action}`);
  if (!cfg.ytPython) {
    job.status = "failed";
    job.error = "Python environment untuk YouTube uploader tidak ditemukan.";
    job.finishedAt = new Date().toISOString();
    return job;
  }

  const script = path.join(PROJECT_ROOT, "scripts", "youtube", "upload_daily_short.py");
  const args = [script];
  if (action === "verify") {
    args.push("--verify-token");
  } else if (action === "schedule") {
    args.push(
      "--schedule-all",
      "--hour",
      String(parseInt(payload.hour ?? 19, 10) || 19),
      "--minute",
      String(parseInt(payload.minute ?? 0, 10) || 0),
    );
    if (payload.dryRun) args.push("--dry-run");
  } else {
    if (payload.dryRun) args.push("--dry-run");
  }

  const env = {
    ...process.env,
    YOUTUBE_QUEUE_DIR: cfg.queueDir,
  };
  if (cfg.ytToken) env.YOUTUBE_TOKEN_FILE = cfg.ytToken;
  if (cfg.ytClientSecret) env.YOUTUBE_CLIENT_SECRET = cfg.ytClientSecret;

  appendLog(job, `Menjalankan YouTube uploader (${action}${payload.dryRun ? " dry-run" : ""})...`);
  const child = spawn(cfg.ytPython, args, { cwd: PROJECT_ROOT, env });
  child.stdout.on("data", (d) => appendLog(job, d));
  child.stderr.on("data", (d) => appendLog(job, d));
  child.on("close", (code) => {
    job.finishedAt = new Date().toISOString();
    if (code === 0) {
      job.status = "done";
      job.progress = 100;
    } else {
      job.status = "failed";
      job.error = `YouTube uploader exited with code ${code}`;
    }
  });
  return job;
}

export async function handleStudioRequest(req, res) {
  const urlObj = new URL(req.url || "/", "http://127.0.0.1:5173");
  const pathname = urlObj.pathname;

  // Media file streaming
  if (req.method === "GET" && pathname.startsWith("/media/voices/")) {
    const file = path.basename(decodeURIComponent(pathname.slice("/media/voices/".length)));
    return serveMediaFile(req, res, path.join(VOICES_DIR, file));
  }
  if (req.method === "GET" && pathname.startsWith("/media/renders/")) {
    const file = path.basename(decodeURIComponent(pathname.slice("/media/renders/".length)));
    return serveMediaFile(req, res, path.join(RENDERS_DIR, file));
  }

  try {
    if (req.method === "GET" && pathname === "/api/health") {
      const cfg = resolveEnvConfig();
      return sendJson(res, 200, {
        ok: true,
        projectRoot: PROJECT_ROOT,
        capabilities: {
          remotion: fs.existsSync(cfg.remotionCli),
          mlxTts: Boolean(cfg.mlxPython),
          voiceCloneRef: Boolean(cfg.refAudio && cfg.refText),
          youtubePython: Boolean(cfg.ytPython),
          youtubeToken: Boolean(cfg.ytToken),
          ffmpeg: Boolean(cfg.ffmpegBin),
        },
        queueDir: cfg.queueDir,
      });
    }

    if (req.method === "GET" && pathname === "/api/presets") {
      if (!fs.existsSync(PRESETS_FILE)) return sendJson(res, 200, {});
      return sendJson(res, 200, JSON.parse(fs.readFileSync(PRESETS_FILE, "utf-8")));
    }

    if (req.method === "POST" && pathname === "/api/presets") {
      const body = await readJsonBody(req);
      fs.writeFileSync(PRESETS_FILE, JSON.stringify(body, null, 2), "utf-8");
      return sendJson(res, 200, { saved: true });
    }

    if (req.method === "GET" && pathname === "/api/voices") {
      return sendJson(res, 200, { files: listFilesWithStats(VOICES_DIR, [".wav", ".mp3"], "/media/voices") });
    }

    if (req.method === "POST" && pathname === "/api/voice/generate") {
      const body = await readJsonBody(req);
      const job = startVoiceJob(body);
      return sendJson(res, 202, job);
    }

    if (req.method === "GET" && pathname === "/api/renders") {
      return sendJson(res, 200, { files: listFilesWithStats(RENDERS_DIR, [".mp4"], "/media/renders") });
    }

    if (req.method === "POST" && pathname === "/api/render") {
      const body = await readJsonBody(req);
      const job = startRenderJob(body);
      return sendJson(res, 202, job);
    }

    if (req.method === "GET" && pathname === "/api/jobs") {
      return sendJson(res, 200, { jobs: Array.from(jobs.values()).reverse().slice(0, 20) });
    }

    if (req.method === "GET" && pathname.startsWith("/api/jobs/")) {
      const id = pathname.slice("/api/jobs/".length);
      const job = jobs.get(id);
      if (!job) return sendJson(res, 404, { error: "Job not found" });
      return sendJson(res, 200, job);
    }

    if (req.method === "GET" && pathname === "/api/youtube/queue") {
      const cfg = resolveEnvConfig();
      return sendJson(res, 200, listYoutubeQueue(cfg.queueDir));
    }

    if (req.method === "POST" && pathname === "/api/youtube/verify") {
      const job = startYoutubeJob("verify");
      return sendJson(res, 202, job);
    }

    if (req.method === "POST" && pathname === "/api/youtube/schedule") {
      const body = await readJsonBody(req);
      const job = startYoutubeJob("schedule", body);
      return sendJson(res, 202, job);
    }

    if (req.method === "POST" && pathname === "/api/youtube/enqueue") {
      const cfg = resolveEnvConfig();
      const body = await readJsonBody(req);
      const renderFile = path.basename(String(body.renderFile || ""));
      const srcMp4 = path.join(RENDERS_DIR, renderFile);
      if (!renderFile || !fs.existsSync(srcMp4)) {
        return sendJson(res, 400, { error: "File render MP4 tidak ditemukan." });
      }
      fs.mkdirSync(cfg.queueDir, { recursive: true });
      const existing = fs.readdirSync(cfg.queueDir).filter((n) => /^\d+_/.test(n));
      const nextNum = String(existing.length + 1).padStart(2, "0");
      const title = String(body.title || renderFile.replace(/\.mp4$/i, "")).trim();
      const desc = String(body.description || `${title}\n\nPowered by Naltech\n#shorts #nalatoon #edukasi`).trim();
      const folderName = `${nextNum}_${safeSlug(title, "short")}`;
      const destDir = path.join(cfg.queueDir, folderName);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(srcMp4, path.join(destDir, renderFile));
      const caption = `YOUTUBE SHORTS\n==============\nJudul:\n${title}\n\nDeskripsi:\n${desc}\n`;
      fs.writeFileSync(path.join(destDir, "caption.txt"), caption, "utf-8");
      return sendJson(res, 200, { queued: true, folderName, queueDir: cfg.queueDir });
    }

    sendJson(res, 404, { error: "Endpoint not found" });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const PORT = parseInt(process.env.STUDIO_API_PORT || "4177", 10);
  http.createServer(handleStudioRequest).listen(PORT, "127.0.0.1", () => {
    console.log(`[Studio API] Listening on http://127.0.0.1:${PORT}`);
  });
}
