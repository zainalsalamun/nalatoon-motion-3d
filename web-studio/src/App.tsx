import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clapperboard,
  Copy,
  Download,
  Film,
  Layers,
  Mic,
  Play,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
  Volume2,
  X,
  Youtube,
} from "lucide-react";
import { EPISODES, type EpisodeDef } from "./episodes";
import type { BoardConfig, StudioSceneProps, SubtitleCue } from "@studio/types/studioProps";

type StepId = 1 | 2 | 3 | 4;

interface UserProject {
  id: string;
  name: string;
  templateId: string;
  scriptLines: string;
  board?: BoardConfig;
  exposure: number;
  showWatermark: boolean;
  watermarkText: string;
  voiceFile: string;
  renderFile: string;
  ytTitle: string;
  ytDescription: string;
  updatedAt: string;
}

interface HealthResponse {
  ok: boolean;
  capabilities: {
    remotion: boolean;
    mlxTts: boolean;
    voiceCloneRef: boolean;
    youtubePython: boolean;
    youtubeToken: boolean;
    ffmpeg: boolean;
  };
  queueDir: string;
}

interface MediaFile {
  name: string;
  sizeMB: number;
  updatedAt: string;
  url: string;
}

interface StudioJob {
  id: string;
  type: "voice" | "render" | "youtube";
  label: string;
  status: "running" | "done" | "failed";
  progress: number;
  logs: string[];
  outputUrl: string | null;
  outputFile: string | null;
  error: string | null;
}

interface QueueData {
  queueDir: string;
  warning?: string;
  items: { name: string; mp4: string; sizeMB: number; title: string; hasCaption: boolean }[];
  history: {
    uploaded_at?: string;
    publish_at?: string | null;
    title?: string;
    url?: string;
    privacy?: string;
  }[];
}

const DEFAULT_INSTRUCT =
  "A relaxed, confident 30-year-old Indonesian male explainer voice with a warm medium-low pitch. Speaks naturally like a smart friend explaining an interesting science fact in a YouTube video. Smooth conversational flow, steady brisk pace, gentle natural pitch inflection on questions, clean close-mic studio sound.";

function buildTimedCues(scriptLines: string, totalSec: number): SubtitleCue[] {
  const lines = scriptLines
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const weights = lines.map((l) => Math.max(3, l.split(/\s+/).length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const startOffset = 0.4;
  const usable = Math.max(2, totalSec - 1.2);
  let cursor = startOffset;
  return lines.map((raw, idx) => {
    const accent = raw.startsWith("*");
    const text = accent ? raw.slice(1).trim() : raw;
    const dur = (weights[idx] / totalWeight) * usable;
    const cue: SubtitleCue = {
      startSec: Number(cursor.toFixed(2)),
      endSec: Number((cursor + dur).toFixed(2)),
      text,
      accent,
    };
    cursor += dur;
    return cue;
  });
}

function makeProjectFromTemplate(ep: EpisodeDef, customName?: string, customScript?: string): UserProject {
  const name = (customName || `${ep.name} (Baru)`).trim();
  const defaultLines = (customScript || ep.defaultScript)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");
  return {
    id: `proj_${Date.now()}`,
    name,
    templateId: ep.id,
    scriptLines: defaultLines,
    board: ep.defaultBoard
      ? {
          ...ep.defaultBoard,
          leftItems: [...ep.defaultBoard.leftItems] as [string, string, string],
          rightItems: [...ep.defaultBoard.rightItems] as [string, string, string],
        }
      : undefined,
    exposure: 1.06,
    showWatermark: true,
    watermarkText: "Powered by Naltech",
    voiceFile: "",
    renderFile: "",
    ytTitle: name.slice(0, 95),
    ytDescription: `${name}\n\nPowered by Naltech\n#shorts #nalatoon #edukasi #faktaunik`,
    updatedAt: new Date().toISOString(),
  };
}

export const App: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);

  // User projects + built-in templates
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(EPISODES[0].id);

  // New Episode Creator modal
  const [showCreator, setShowCreator] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>("");
  const [newTemplateId, setNewTemplateId] = useState<string>(EPISODES[0].id);
  const [newScript, setNewScript] = useState<string>("");

  // Guided 4-Step Pipeline
  const [step, setStep] = useState<StepId>(1);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "warn" | "error"; text: string } | null>(null);

  // Monitor performance state
  const [previewMode, setPreviewMode] = useState<"lite" | "hd">("lite");
  const [viewportActive, setViewportActive] = useState<boolean>(true);

  // Voice settings
  const [voiceMode, setVoiceMode] = useState<"design" | "clone" | "edge">("design");
  const [voiceInstruct, setVoiceInstruct] = useState<string>(DEFAULT_INSTRUCT);
  const [voiceTemp, setVoiceTemp] = useState<number>(0.85);
  const [edgeVoice, setEdgeVoice] = useState<string>("id-ID-ArdiNeural");
  const [voices, setVoices] = useState<MediaFile[]>([]);

  // Render settings
  const [renderCrf, setRenderCrf] = useState<number>(18);
  const [renderConcurrency, setRenderConcurrency] = useState<number>(2);
  const [renderGl, setRenderGl] = useState<"angle" | "swiftshader">("angle");
  const [frameRange, setFrameRange] = useState<string>("");
  const [renders, setRenders] = useState<MediaFile[]>([]);

  // YouTube state
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [ytHour, setYtHour] = useState<number>(19);
  const [ytMinute, setYtMinute] = useState<number>(0);

  // Active job
  const [activeJob, setActiveJob] = useState<StudioJob | null>(null);

  const showNotice = useCallback((kind: "ok" | "warn" | "error", text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  const persistProjects = useCallback(async (nextList: UserProject[]) => {
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects: nextList }),
      });
    } catch {
      // ignore offline save error
    }
  }, []);

  const refreshLists = useCallback(async () => {
    try {
      const [hRes, vRes, rRes, qRes, pRes] = await Promise.all([
        fetch("/api/health").then((r) => r.json()),
        fetch("/api/voices").then((r) => r.json()),
        fetch("/api/renders").then((r) => r.json()),
        fetch("/api/youtube/queue").then((r) => r.json()),
        fetch("/api/projects").then((r) => r.json()),
      ]);
      setHealth(hRes);
      setVoices(vRes.files || []);
      setRenders(rRes.files || []);
      setQueueData(qRes);
      if (Array.isArray(pRes.projects)) {
        setProjects(pRes.projects);
      }
    } catch {
      showNotice("warn", "API studio lokal tidak merespons. Jalankan lewat: npm run ui");
    }
  }, [showNotice]);

  useEffect(() => {
    refreshLists();
  }, [refreshLists]);

  // Active working project (or ephemeral template preview)
  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId],
  );

  const episode: EpisodeDef = useMemo(() => {
    const tid = activeProject ? activeProject.templateId : selectedTemplateId;
    return EPISODES.find((e) => e.id === tid) || EPISODES[0];
  }, [activeProject, selectedTemplateId]);

  // Ephemeral working state when previewing a built-in template before saving as a project
  const [draftForTemplate, setDraftForTemplate] = useState<UserProject>(() =>
    makeProjectFromTemplate(EPISODES[0], EPISODES[0].name),
  );

  const currentWork: UserProject = activeProject || draftForTemplate;

  const updateCurrentWork = useCallback(
    (updater: (prev: UserProject) => UserProject) => {
      if (activeProject) {
        setProjects((prevList) => {
          const next = prevList.map((p) =>
            p.id === activeProject.id ? { ...updater(p), updatedAt: new Date().toISOString() } : p,
          );
          persistProjects(next);
          return next;
        });
      } else {
        setDraftForTemplate((prev) => ({ ...updater(prev), updatedAt: new Date().toISOString() }));
      }
    },
    [activeProject, persistProjects],
  );

  // Debounce 3D board texture rebuilds while typing
  const [debouncedBoard, setDebouncedBoard] = useState<BoardConfig | undefined>(currentWork.board);
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedBoard(currentWork.board), 180);
    return () => window.clearTimeout(t);
  }, [currentWork.board]);

  // Poll active background job
  useEffect(() => {
    if (!activeJob || activeJob.status !== "running") return;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${activeJob.id}`);
        if (!res.ok) return;
        const updated: StudioJob = await res.json();
        setActiveJob(updated);
        if (updated.status === "done") {
          showNotice("ok", `${updated.label} selesai.`);
          if (updated.type === "voice" && updated.outputFile) {
            updateCurrentWork((p) => ({ ...p, voiceFile: updated.outputFile! }));
          }
          if (updated.type === "render" && updated.outputFile) {
            updateCurrentWork((p) => ({ ...p, renderFile: updated.outputFile! }));
          }
          refreshLists();
        } else if (updated.status === "failed") {
          showNotice("error", updated.error || `${updated.label} gagal.`);
        }
      } catch {
        // retry next tick
      }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [activeJob, refreshLists, showNotice, updateCurrentWork]);

  const handleSelectBuiltInTemplate = (id: string) => {
    const ep = EPISODES.find((e) => e.id === id) || EPISODES[0];
    setActiveProjectId(null);
    setSelectedTemplateId(ep.id);
    setDraftForTemplate(makeProjectFromTemplate(ep, ep.name));
  };

  const handleCreateProject = () => {
    const ep = EPISODES.find((e) => e.id === newTemplateId) || EPISODES[0];
    const created = makeProjectFromTemplate(ep, newName.trim() || `${ep.name} #${projects.length + 1}`, newScript);
    const next = [created, ...projects];
    setProjects(next);
    persistProjects(next);
    setActiveProjectId(created.id);
    setShowCreator(false);
    setNewName("");
    setNewScript("");
    setStep(1);
    showNotice("ok", `Proyek baru dibuat: ${created.name}`);
  };

  const handleCloneTemplateToProject = () => {
    const created: UserProject = {
      ...currentWork,
      id: `proj_${Date.now()}`,
      name: activeProject ? `${currentWork.name} (Salinan)` : `${episode.name} #${projects.length + 1}`,
      updatedAt: new Date().toISOString(),
    };
    const next = [created, ...projects];
    setProjects(next);
    persistProjects(next);
    setActiveProjectId(created.id);
    showNotice("ok", `Disimpan ke Proyek Saya: ${created.name}`);
  };

  const handleDeleteProject = (id: string) => {
    const next = projects.filter((p) => p.id !== id);
    setProjects(next);
    persistProjects(next);
    if (activeProjectId === id) {
      setActiveProjectId(next[0]?.id || null);
    }
    showNotice("ok", "Proyek dihapus.");
  };

  const totalSec = episode.durationInFrames / episode.fps;
  const timedCues = useMemo(
    () => buildTimedCues(currentWork.scriptLines, totalSec),
    [currentWork.scriptLines, totalSec],
  );

  const sceneInputProps: StudioSceneProps = useMemo(
    () => ({
      board: episode.supportsBoardEditor ? debouncedBoard : undefined,
      exposure: currentWork.exposure,
      subtitleCues: timedCues,
      showWatermark: currentWork.showWatermark,
      watermarkText: currentWork.watermarkText,
      previewMode,
    }),
    [
      episode.supportsBoardEditor,
      debouncedBoard,
      currentWork.exposure,
      timedCues,
      currentWork.showWatermark,
      currentWork.watermarkText,
      previewMode,
    ],
  );

  const renderExportProps: StudioSceneProps = useMemo(
    () => ({
      board: episode.supportsBoardEditor ? currentWork.board : undefined,
      exposure: currentWork.exposure,
      subtitleCues: timedCues,
      showWatermark: currentWork.showWatermark,
      watermarkText: currentWork.watermarkText,
      previewMode: "hd",
    }),
    [
      episode.supportsBoardEditor,
      currentWork.board,
      currentWork.exposure,
      timedCues,
      currentWork.showWatermark,
      currentWork.watermarkText,
    ],
  );

  const updateBoardField = <K extends keyof BoardConfig>(key: K, value: BoardConfig[K]) => {
    updateCurrentWork((p) => {
      const base = p.board || episode.defaultBoard;
      if (!base) return p;
      return { ...p, board: { ...base, [key]: value } };
    });
  };

  const updateBoardItem = (side: "leftItems" | "rightItems", idx: number, value: string) => {
    updateCurrentWork((p) => {
      const base = p.board || episode.defaultBoard;
      if (!base) return p;
      const arr = [...base[side]] as [string, string, string];
      arr[idx] = value;
      return { ...p, board: { ...base, [side]: arr } };
    });
  };

  const jumpToFrame = (frame: number) => {
    setViewportActive(true);
    window.setTimeout(() => playerRef.current?.seekTo(frame), 40);
  };

  const handleGenerateVoice = async () => {
    const cleanText = currentWork.scriptLines
      .split(/\r?\n/)
      .map((l) => l.replace(/^\*/, "").trim())
      .filter(Boolean)
      .join(" ");
    if (!cleanText) {
      showNotice("warn", "Isi naskah di Langkah 1 dulu sebelum membuat suara.");
      return;
    }
    try {
      const res = await fetch("/api/voice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: voiceMode,
          text: cleanText,
          instruct: voiceInstruct,
          temperature: voiceTemp,
          edgeVoice,
          label: currentWork.name,
        }),
      });
      const job: StudioJob = await res.json();
      setActiveJob(job);
      if (job.status === "failed") showNotice("error", job.error || "Voice generation gagal.");
    } catch {
      showNotice("error", "Tidak bisa menghubungi Studio API.");
    }
  };

  const handleStartRender = async () => {
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compositionId: episode.id,
          crf: renderCrf,
          concurrency: renderConcurrency,
          gl: renderGl,
          frameRange: frameRange.trim() || undefined,
          voiceFile: currentWork.voiceFile || undefined,
          props: renderExportProps,
        }),
      });
      const job: StudioJob = await res.json();
      setActiveJob(job);
      if (job.status === "failed") showNotice("error", job.error || "Gagal memulai render.");
    } catch {
      showNotice("error", "Tidak bisa menghubungi Studio API.");
    }
  };

  const handleEnqueueRender = async () => {
    const mp4 = currentWork.renderFile;
    if (!mp4) {
      showNotice("warn", "Render video MP4 di Langkah 3 dulu (atau pilih file render di bawah).");
      return;
    }
    try {
      const res = await fetch("/api/youtube/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          renderFile: mp4,
          title: currentWork.ytTitle || currentWork.name,
          description: currentWork.ytDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice("error", data.error || "Gagal memasukkan ke antrean.");
        return;
      }
      showNotice("ok", `Masuk antrean YouTube: ${data.folderName}`);
      refreshLists();
    } catch {
      showNotice("error", "Gagal menambah ke antrean YouTube.");
    }
  };

  const handleYoutubeAction = async (endpoint: "/api/youtube/verify" | "/api/youtube/schedule", body = {}) => {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const job: StudioJob = await res.json();
      setActiveJob(job);
    } catch {
      showNotice("error", "Gagal menjalankan perintah YouTube uploader.");
    }
  };

  const step1Done = timedCues.length > 0;
  const step2Done = Boolean(currentWork.voiceFile);
  const step3Done = Boolean(currentWork.renderFile);

  const stepGuides: Record<StepId, { title: string; desc: string }> = {
    1: {
      title: "Langkah 1 — Buat Naskah & Atur Visual 3D",
      desc: "Tulis naskah (1 baris = 1 subtitle otomatis di monitor 3D) dan sesuaikan teks Papan 3D.",
    },
    2: {
      title: "Langkah 2 — Buat Suara Narasi AI",
      desc: "Naskah dari Langkah 1 otomatis masuk ke sini. Generate audio lalu pasang ke proyek ini.",
    },
    3: {
      title: "Langkah 3 — Render Video Full HD (MP4)",
      desc: "Gabungkan animasi 3D + subtitle + suara AI menjadi file MP4 1080×1920 siap upload.",
    },
    4: {
      title: "Langkah 4 — Antrean & Jadwal YouTube Shorts",
      desc: "Masukkan MP4 hasil Langkah 3 ke antrean dan jadwalkan tayang otomatis jam 19:00 WIB.",
    },
  };

  return (
    <div className="app-shell">
      {/* Hardware Console Top Bar */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Clapperboard size={15} />
          </div>
          <span>Nalatoon</span>
          <span className="brand-divider">//</span>
          <span className="brand-console">3D VIDEO CREATOR</span>
        </div>

        <div className="topbar-center">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13 }}>
            {currentWork.name}
          </span>
          <span className="readout">
            {episode.name.toUpperCase()} · {totalSec.toFixed(0)}S
          </span>
        </div>

        <div className="topbar-right">
          <div className="led-group" aria-label="Status Koneksi Lokal">
            <span className="led-item">
              <span className={`led-dot ${health?.capabilities.mlxTts ? "on" : ""}`} />
              TTS
            </span>
            <span className="led-item">
              <span className={`led-dot ${health?.capabilities.youtubeToken ? "on" : ""}`} />
              YT
            </span>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreator(true)}>
            <Plus size={13} /> Buat Episode Baru
          </button>
        </div>
      </header>

      <div className="workspace">
        {/* Left Sidebar: My Projects vs Built-in 3D Templates */}
        <aside className="sidebar" aria-label="Proyek dan Template 3D">
          <div className="sidebar-cta">
            <button type="button" className="btn btn-primary btn-full" onClick={() => setShowCreator(true)}>
              <Plus size={14} /> Buat Episode Baru
            </button>
          </div>

          <div className="episode-list">
            <div className="sidebar-header">
              <span>PROYEK SAYA</span>
              <span>{String(projects.length).padStart(2, "0")}</span>
            </div>

            {projects.length === 0 ? (
              <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
                <p className="hint">
                  Belum ada proyek tersimpan. Klik <strong>Buat Episode Baru</strong> di atas untuk membuat videomu
                  sendiri dari template 3D.
                </p>
              </div>
            ) : (
              projects.map((p) => {
                const epDef = EPISODES.find((e) => e.id === p.templateId);
                const isActive = p.id === activeProjectId;
                return (
                  <div key={p.id} className={`project-row ${isActive ? "active" : ""}`}>
                    <button
                      type="button"
                      className="project-select-btn"
                      onClick={() => {
                        setActiveProjectId(p.id);
                        setStep(1);
                      }}
                    >
                      <span className="episode-row-title">{p.name}</span>
                      <span className="episode-row-kind">{epDef?.name || p.templateId}</span>
                      <span className="step-dots" title="Progres 4 langkah">
                        <span className={`step-dot ${p.scriptLines.trim() ? "done" : ""}`} />
                        <span className={`step-dot ${p.voiceFile ? "done" : ""}`} />
                        <span className={`step-dot ${p.renderFile ? "done" : ""}`} />
                        <span className="step-dot" />
                      </span>
                    </button>
                    <button
                      type="button"
                      className="project-del-btn"
                      title="Hapus proyek"
                      aria-label={`Hapus ${p.name}`}
                      onClick={() => handleDeleteProject(p.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            )}

            <div className="sidebar-header">
              <span>TEMPLATE 3D BAWAAN</span>
              <span>{String(EPISODES.length).padStart(2, "0")}</span>
            </div>

            {EPISODES.map((ep, idx) => (
              <button
                key={ep.id}
                type="button"
                className={`episode-row ${!activeProject && ep.id === selectedTemplateId ? "active" : ""}`}
                onClick={() => handleSelectBuiltInTemplate(ep.id)}
              >
                <span className="episode-num">{String(idx + 1).padStart(2, "0")}</span>
                <span>
                  <span className="episode-row-title">{ep.name}</span>
                  <span className="episode-row-kind">{ep.badge}</span>
                </span>
                <span className="episode-dur">{(ep.durationInFrames / ep.fps).toFixed(0)}s</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Center Stage: Drafting-Grid Reference Monitor */}
        <main className="stage">
          {toast && (
            <div className={`notice-strip ${toast.kind === "warn" ? "warn" : toast.kind === "error" ? "error" : ""}`}>
              {toast.text}
            </div>
          )}

          {!activeProject && (
            <div className="notice-strip warn" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span>Sedang preview template bawaan ({episode.name}).</span>
              <button type="button" className="btn btn-sm" onClick={handleCloneTemplateToProject}>
                <Copy size={11} /> Simpan jadi Proyek Saya
              </button>
            </div>
          )}

          <div className="monitor-housing">
            <div className="monitor-strip">
              <span className="monitor-rec">
                <span className={`led-dot ${viewportActive ? "rec" : ""}`} />
                {viewportActive ? `PREVIEW 9:16 (${previewMode.toUpperCase()})` : "3D SLEEP (0 MB VRAM)"}
              </span>
              <div className="monitor-actions">
                <button
                  type="button"
                  className={`mini-toggle ${previewMode === "lite" ? "active" : ""}`}
                  title="Mode ringan 540p hemat RAM (Render MP4 tetap 100% HD)"
                  onClick={() => setPreviewMode((m) => (m === "lite" ? "hd" : "lite"))}
                >
                  {previewMode === "lite" ? "LITE" : "FULL HD"}
                </button>
                <button
                  type="button"
                  className={`mini-toggle ${!viewportActive ? "active" : ""}`}
                  title="Matikan kanvas 3D sementara agar RAM langsung lega"
                  onClick={() => setViewportActive((v) => !v)}
                >
                  {viewportActive ? "SLEEP 3D" : "WAKE 3D"}
                </button>
              </div>
            </div>
            <div className="monitor-viewport">
              {viewportActive ? (
                <Player
                  key={`${episode.id}_${previewMode}`}
                  ref={playerRef}
                  component={episode.component}
                  inputProps={sceneInputProps}
                  durationInFrames={episode.durationInFrames}
                  compositionWidth={1080}
                  compositionHeight={1920}
                  fps={episode.fps}
                  controls
                  loop
                  style={{ width: "100%", height: "100%" }}
                />
              ) : (
                <div className="sleep-screen">
                  <Clapperboard size={28} />
                  <strong>Preview 3D dalam mode Sleep</strong>
                  <span>Memori WebGL dilepas total. Klik tombol di bawah untuk mengaktifkan kembali.</span>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setViewportActive(true)}>
                    <Play size={12} /> Aktifkan Preview 3D
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="transport-bar" aria-label="Lompat cepat ke shot">
            {episode.bookmarks.map((bm, i) => (
              <button key={bm.label} type="button" className="shot-key" onClick={() => jumpToFrame(bm.frame)}>
                <span className="shot-key-idx">{String(i + 1).padStart(2, "0")}</span>
                <span>{bm.label}</span>
              </button>
            ))}
          </div>

          <div className="stage-caption">{episode.description}</div>
        </main>

        {/* Right Panel: Guided 4-Step Wizard */}
        <aside className="inspector">
          <div className="tabs" role="tablist" aria-label="4 Langkah Pembuatan Video">
            <button
              type="button"
              role="tab"
              aria-selected={step === 1}
              className="tab-btn"
              onClick={() => setStep(1)}
            >
              <span className={`step-num ${step1Done ? "done" : ""}`}>
                {step1Done ? <Check size={10} /> : "01"}
              </span>
              <span>Naskah</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={step === 2}
              className="tab-btn"
              onClick={() => setStep(2)}
            >
              <span className={`step-num ${step2Done ? "done" : ""}`}>
                {step2Done ? <Check size={10} /> : "02"}
              </span>
              <span>Suara AI</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={step === 3}
              className="tab-btn"
              onClick={() => setStep(3)}
            >
              <span className={`step-num ${step3Done ? "done" : ""}`}>
                {step3Done ? <Check size={10} /> : "03"}
              </span>
              <span>Render</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={step === 4}
              className="tab-btn"
              onClick={() => setStep(4)}
            >
              <span className="step-num">04</span>
              <span>YouTube</span>
            </button>
          </div>

          <div className="step-guide">
            <strong>{stepGuides[step].title}</strong>
            <div>{stepGuides[step].desc}</div>
          </div>

          <div className="inspector-body">
            {activeJob && (
              <section className="panel-section">
                <div className="section-head">
                  <span className="section-title">
                    <Radio size={13} /> {activeJob.label}
                  </span>
                  <span className="readout">
                    {activeJob.status === "running"
                      ? `${activeJob.progress}%`
                      : activeJob.status === "done"
                        ? "SELESAI"
                        : "GAGAL"}
                  </span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${activeJob.progress}%` }} />
                </div>
                {activeJob.logs.length > 0 && (
                  <div className="log-box">{activeJob.logs.slice(-10).join("\n")}</div>
                )}
              </section>
            )}

            {/* STEP 1: NASKAH & VISUAL 3D */}
            {step === 1 && (
              <>
                <section className="panel-section">
                  <div className="section-head">
                    <span className="section-title">
                      <Layers size={13} /> Identitas & Naskah Subtitle
                    </span>
                    <span className="readout">{timedCues.length} BARIS SUBTITLE</span>
                  </div>

                  <div className="field">
                    <label htmlFor="proj-name">Nama Episode</label>
                    <input
                      id="proj-name"
                      className="input"
                      value={currentWork.name}
                      onChange={(e) =>
                        updateCurrentWork((p) => ({
                          ...p,
                          name: e.target.value,
                          ytTitle: p.ytTitle === p.name ? e.target.value : p.ytTitle,
                        }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="script-lines">
                      Naskah Episode (1 baris = 1 subtitle otomatis; awali * untuk kuning)
                    </label>
                    <textarea
                      id="script-lines"
                      className="textarea"
                      style={{ minHeight: 118 }}
                      value={currentWork.scriptLines}
                      onChange={(e) => updateCurrentWork((p) => ({ ...p, scriptLines: e.target.value }))}
                    />
                  </div>
                </section>

                {episode.supportsBoardEditor && currentWork.board ? (
                  <section className="panel-section">
                    <div className="section-head">
                      <span className="section-title">
                        <SlidersHorizontal size={13} /> Papan Infografis 3D (Live)
                      </span>
                      <div className="row">
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => {
                            const boardShot = episode.bookmarks.find((b) => b.label.includes("Papan"));
                            if (boardShot) jumpToFrame(boardShot.frame);
                          }}
                        >
                          <Play size={11} /> Lihat Papan
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => {
                            if (!episode.defaultBoard) return;
                            updateCurrentWork((p) => ({ ...p, board: { ...episode.defaultBoard! }, exposure: 1.06 }));
                          }}
                        >
                          <RotateCcw size={11} /> Reset
                        </button>
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="board-title">Judul Papan 3D</label>
                      <input
                        id="board-title"
                        className="input"
                        value={currentWork.board.title}
                        onChange={(e) => updateBoardField("title", e.target.value)}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="board-subtitle">Subjudul</label>
                      <input
                        id="board-subtitle"
                        className="input"
                        value={currentWork.board.subtitle}
                        onChange={(e) => updateBoardField("subtitle", e.target.value)}
                      />
                    </div>

                    <div className="grid-2">
                      <div className="field">
                        <span className="col-label-left">KOLOM KIRI</span>
                        <input
                          className="input"
                          aria-label="Header kolom kiri"
                          value={currentWork.board.leftHeader}
                          onChange={(e) => updateBoardField("leftHeader", e.target.value)}
                        />
                        {currentWork.board.leftItems.map((it, i) => (
                          <input
                            key={i}
                            className="input"
                            aria-label={`Poin kiri ${i + 1}`}
                            value={it}
                            onChange={(e) => updateBoardItem("leftItems", i, e.target.value)}
                          />
                        ))}
                        <input
                          className="input"
                          aria-label="Kesimpulan kiri"
                          value={currentWork.board.leftFooter}
                          onChange={(e) => updateBoardField("leftFooter", e.target.value)}
                        />
                      </div>

                      <div className="field">
                        <span className="col-label-right">KOLOM KANAN</span>
                        <input
                          className="input"
                          aria-label="Header kolom kanan"
                          value={currentWork.board.rightHeader}
                          onChange={(e) => updateBoardField("rightHeader", e.target.value)}
                        />
                        {currentWork.board.rightItems.map((it, i) => (
                          <input
                            key={i}
                            className="input"
                            aria-label={`Poin kanan ${i + 1}`}
                            value={it}
                            onChange={(e) => updateBoardItem("rightItems", i, e.target.value)}
                          />
                        ))}
                        <input
                          className="input"
                          aria-label="Kesimpulan kanan"
                          value={currentWork.board.rightFooter}
                          onChange={(e) => updateBoardField("rightFooter", e.target.value)}
                        />
                      </div>
                    </div>
                  </section>
                ) : null}

                <section className="panel-section">
                  <span className="section-title">Kamera & Watermark</span>
                  <div className="field">
                    <div className="row-between">
                      <label htmlFor="exposure-range">Exposure Kamera 3D</label>
                      <span className="readout">{currentWork.exposure.toFixed(2)} EV</span>
                    </div>
                    <input
                      id="exposure-range"
                      type="range"
                      min="0.80"
                      max="1.35"
                      step="0.02"
                      value={currentWork.exposure}
                      onChange={(e) => updateCurrentWork((p) => ({ ...p, exposure: parseFloat(e.target.value) }))}
                    />
                  </div>
                  <div className="switch-row">
                    <label htmlFor="wm-toggle">Tampilkan Watermark Bawah</label>
                    <input
                      id="wm-toggle"
                      type="checkbox"
                      checked={currentWork.showWatermark}
                      onChange={(e) => updateCurrentWork((p) => ({ ...p, showWatermark: e.target.checked }))}
                    />
                  </div>
                  {currentWork.showWatermark && (
                    <div className="field">
                      <label htmlFor="wm-text">Teks Watermark</label>
                      <input
                        id="wm-text"
                        className="input"
                        value={currentWork.watermarkText}
                        onChange={(e) => updateCurrentWork((p) => ({ ...p, watermarkText: e.target.value }))}
                      />
                    </div>
                  )}
                </section>
              </>
            )}

            {/* STEP 2: SUARA AI */}
            {step === 2 && (
              <>
                <section className="panel-section">
                  <div className="section-head">
                    <span className="section-title">
                      <Mic size={13} /> Pilih Engine Suara
                    </span>
                    <span className="led-item">
                      <span className={`led-dot ${health?.capabilities.mlxTts ? "on" : ""}`} />
                      {health?.capabilities.mlxTts ? "MLX SIAP" : "EDGE TTS"}
                    </span>
                  </div>

                  <div className="segmented segmented-3" role="group" aria-label="Mode Voice TTS">
                    <button
                      type="button"
                      className={`seg-btn ${voiceMode === "design" ? "active" : ""}`}
                      onClick={() => setVoiceMode("design")}
                    >
                      Qwen3 1.7B (Mac)
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${voiceMode === "clone" ? "active" : ""}`}
                      onClick={() => setVoiceMode("clone")}
                    >
                      Clone (Mac)
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${voiceMode === "edge" ? "active" : ""}`}
                      onClick={() => setVoiceMode("edge")}
                    >
                      Edge TTS (All OS)
                    </button>
                  </div>

                  {voiceMode === "edge" && (
                    <div className="field">
                      <label htmlFor="edge-voice">Suara Neural Indonesia (Windows / Linux / Mac)</label>
                      <select
                        id="edge-voice"
                        className="select"
                        value={edgeVoice}
                        onChange={(e) => setEdgeVoice(e.target.value)}
                      >
                        <option value="id-ID-ArdiNeural">Ardi (Pria Indonesia)</option>
                        <option value="id-ID-GadisNeural">Gadis (Wanita Indonesia)</option>
                      </select>
                    </div>
                  )}

                  <div className="field">
                    <label htmlFor="voice-script">Naskah Narasi (tersinkron dari Langkah 1)</label>
                    <textarea
                      id="voice-script"
                      className="textarea"
                      value={currentWork.scriptLines}
                      onChange={(e) => updateCurrentWork((p) => ({ ...p, scriptLines: e.target.value }))}
                    />
                  </div>

                  {voiceMode === "design" && (
                    <div className="field">
                      <label htmlFor="voice-instruct">Arahan Intonasi & Karakter</label>
                      <textarea
                        id="voice-instruct"
                        className="textarea"
                        style={{ minHeight: 62 }}
                        value={voiceInstruct}
                        onChange={(e) => setVoiceInstruct(e.target.value)}
                      />
                    </div>
                  )}

                  {voiceMode !== "edge" && (
                    <div className="field">
                      <div className="row-between">
                        <label htmlFor="voice-temp">Temperature Intonasi</label>
                        <span className="readout">{voiceTemp.toFixed(2)}</span>
                      </div>
                      <input
                        id="voice-temp"
                        type="range"
                        min="0.55"
                        max="1.10"
                        step="0.05"
                        value={voiceTemp}
                        onChange={(e) => setVoiceTemp(parseFloat(e.target.value))}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn-primary btn-full"
                    disabled={activeJob?.status === "running"}
                    onClick={handleGenerateVoice}
                  >
                    <Mic size={14} /> Generate Voiceover WAV
                  </button>
                </section>

                <section className="panel-section">
                  <div className="section-head">
                    <span className="section-title">
                      <Volume2 size={13} /> Pilih Audio untuk Video Ini ({voices.length})
                    </span>
                    <button type="button" className="btn btn-sm" onClick={refreshLists} aria-label="Segarkan suara">
                      <RefreshCw size={12} />
                    </button>
                  </div>

                  {voices.length === 0 ? (
                    <p className="hint">Belum ada voiceover. Klik tombol Generate di atas.</p>
                  ) : (
                    voices.map((v) => {
                      const active = currentWork.voiceFile === v.name;
                      return (
                        <div key={v.name} className="list-row">
                          <div className="row-between">
                            <strong style={{ fontSize: 12 }}>{v.name}</strong>
                            <span className="readout">{v.sizeMB} MB</span>
                          </div>
                          <audio controls src={v.url} />
                          <div className="row-between">
                            <button
                              type="button"
                              className={`btn btn-sm ${active ? "btn-primary" : ""}`}
                              onClick={() => {
                                updateCurrentWork((p) => ({ ...p, voiceFile: v.name }));
                                showNotice("ok", `Audio terpasang ke proyek: ${v.name}`);
                              }}
                            >
                              <Check size={12} />
                              {active ? "Terpasang di Proyek" : "Pasang ke Proyek"}
                            </button>
                            <a className="btn btn-sm" href={v.url} download={v.name}>
                              <Download size={12} /> Unduh
                            </a>
                          </div>
                        </div>
                      );
                    })
                  )}
                </section>
              </>
            )}

            {/* STEP 3: RENDER MP4 */}
            {step === 3 && (
              <>
                <section className="panel-section">
                  <span className="section-title">
                    <Film size={13} /> Ringkasan Sebelum Render
                  </span>

                  <div className="checklist">
                    <div className="check-row">
                      <span>Template 3D</span>
                      <span className="check-ok">{episode.id} (1080×1920 HD)</span>
                    </div>
                    <div className="check-row">
                      <span>Subtitle Otomatis</span>
                      <span className={timedCues.length > 0 ? "check-ok" : "check-warn"}>
                        {timedCues.length > 0 ? `${timedCues.length} baris siap` : "Kosong"}
                      </span>
                    </div>
                    <div className="check-row">
                      <span>Track Voiceover</span>
                      <span className={currentWork.voiceFile ? "check-ok" : "check-warn"}>
                        {currentWork.voiceFile || "Tanpa suara (opsional)"}
                      </span>
                    </div>
                  </div>

                  <div className="grid-2">
                    <div className="field">
                      <label htmlFor="crf-select">Kualitas (CRF)</label>
                      <select
                        id="crf-select"
                        className="select"
                        value={renderCrf}
                        onChange={(e) => setRenderCrf(parseInt(e.target.value, 10))}
                      >
                        <option value={18}>18 — Master Tajam</option>
                        <option value={20}>20 — Seimbang</option>
                        <option value={23}>23 — Draft Cepat</option>
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="conc-select">Concurrency</label>
                      <select
                        id="conc-select"
                        className="select"
                        value={renderConcurrency}
                        onChange={(e) => setRenderConcurrency(parseInt(e.target.value, 10))}
                      >
                        <option value={1}>1 — Hemat RAM (8GB)</option>
                        <option value={2}>2 — Standar</option>
                        <option value={3}>3 — Cepat</option>
                      </select>
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="gl-select">WebGL Renderer</label>
                    <select
                      id="gl-select"
                      className="select"
                      value={renderGl}
                      onChange={(e) => setRenderGl(e.target.value as "angle" | "swiftshader")}
                    >
                      <option value="angle">ANGLE — GPU Hardware (Mac / Windows / Linux)</option>
                      <option value="swiftshader">SwiftShader — CPU Fallback (VPS / Tanpa GPU)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="frame-range">Tes Cepat Rentang Frame (mis. 0-150 = 5 detik)</label>
                    <input
                      id="frame-range"
                      className="input"
                      placeholder="Kosongkan untuk render penuh"
                      value={frameRange}
                      onChange={(e) => setFrameRange(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-full"
                    disabled={activeJob?.status === "running"}
                    onClick={handleStartRender}
                  >
                    <Film size={14} /> Render Video MP4 Sekarang
                  </button>
                </section>

                <section className="panel-section">
                  <div className="section-head">
                    <span className="section-title">Hasil Render MP4 ({renders.length})</span>
                    <button type="button" className="btn btn-sm" onClick={refreshLists} aria-label="Segarkan render">
                      <RefreshCw size={12} />
                    </button>
                  </div>

                  {renders.length === 0 ? (
                    <p className="hint">Belum ada video render. Klik Render Video MP4 di atas.</p>
                  ) : (
                    renders.map((r) => {
                      const active = currentWork.renderFile === r.name;
                      return (
                        <div key={r.name} className="list-row">
                          <div className="row-between">
                            <strong style={{ fontSize: 12 }}>{r.name}</strong>
                            <span className="readout">{r.sizeMB} MB</span>
                          </div>
                          <video controls src={r.url} style={{ maxHeight: 240 }} />
                          <div className="row-between">
                            <button
                              type="button"
                              className={`btn btn-sm ${active ? "btn-primary" : ""}`}
                              onClick={() => {
                                updateCurrentWork((p) => ({ ...p, renderFile: r.name }));
                                setStep(4);
                              }}
                            >
                              <Check size={12} />
                              {active ? "Siap di Langkah 4" : "Pakai untuk Upload →"}
                            </button>
                            <a className="btn btn-sm" href={r.url} download={r.name}>
                              <Download size={12} /> Unduh
                            </a>
                          </div>
                        </div>
                      );
                    })
                  )}
                </section>
              </>
            )}

            {/* STEP 4: UPLOAD YOUTUBE */}
            {step === 4 && (
              <>
                <section className="panel-section">
                  <div className="section-head">
                    <span className="section-title">
                      <Youtube size={13} /> Kirim ke Antrean YouTube
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={activeJob?.status === "running"}
                      onClick={() => handleYoutubeAction("/api/youtube/verify")}
                    >
                      <Check size={12} /> Verify Token
                    </button>
                  </div>

                  <div className="field">
                    <label htmlFor="yt-file">File Video MP4 (dari Langkah 3)</label>
                    <select
                      id="yt-file"
                      className="select"
                      value={currentWork.renderFile}
                      onChange={(e) => updateCurrentWork((p) => ({ ...p, renderFile: e.target.value }))}
                    >
                      <option value="">-- Pilih file MP4 hasil render --</option>
                      {renders.map((r) => (
                        <option key={r.name} value={r.name}>
                          {r.name} ({r.sizeMB} MB)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="yt-title">Judul YouTube Shorts</label>
                    <input
                      id="yt-title"
                      className="input"
                      placeholder="Maks. 100 karakter, tanpa emoji"
                      value={currentWork.ytTitle}
                      onChange={(e) => updateCurrentWork((p) => ({ ...p, ytTitle: e.target.value }))}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="yt-desc">Deskripsi & Hashtags</label>
                    <textarea
                      id="yt-desc"
                      className="textarea"
                      style={{ minHeight: 68 }}
                      value={currentWork.ytDescription}
                      onChange={(e) => updateCurrentWork((p) => ({ ...p, ytDescription: e.target.value }))}
                    />
                  </div>

                  <button type="button" className="btn btn-secondary-accent btn-full" onClick={handleEnqueueRender}>
                    <Send size={13} /> 1. Masukkan Video ke Antrean
                  </button>
                </section>

                <section className="panel-section">
                  <span className="section-title">2. Jadwalkan Tayang Otomatis</span>
                  <p className="hint">
                    Folder antrean: <code>{queueData?.queueDir || "-"}</code>
                  </p>
                  {queueData?.warning && <div className="notice-strip warn">{queueData.warning}</div>}

                  <div className="grid-2">
                    <div className="field">
                      <label htmlFor="yt-hour">Jam Tayang (WIB)</label>
                      <input
                        id="yt-hour"
                        type="number"
                        min={0}
                        max={23}
                        className="input"
                        value={ytHour}
                        onChange={(e) => setYtHour(parseInt(e.target.value, 10) || 19)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="yt-min">Menit</label>
                      <input
                        id="yt-min"
                        type="number"
                        min={0}
                        max={59}
                        className="input"
                        value={ytMinute}
                        onChange={(e) => setYtMinute(parseInt(e.target.value, 10) || 0)}
                      />
                    </div>
                  </div>

                  <div className="grid-2">
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={activeJob?.status === "running"}
                      onClick={() =>
                        handleYoutubeAction("/api/youtube/schedule", { hour: ytHour, minute: ytMinute, dryRun: true })
                      }
                    >
                      Dry-Run Cek Jadwal
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={activeJob?.status === "running"}
                      onClick={() =>
                        handleYoutubeAction("/api/youtube/schedule", { hour: ytHour, minute: ytMinute, dryRun: false })
                      }
                    >
                      <UploadCloud size={13} /> Jadwalkan Semua
                    </button>
                  </div>
                </section>

                <section className="panel-section">
                  <div className="section-head">
                    <span className="section-title">Antrean Siap Upload ({queueData?.items.length ?? 0})</span>
                    <button type="button" className="btn btn-sm" onClick={refreshLists} aria-label="Segarkan antrean">
                      <RefreshCw size={12} />
                    </button>
                  </div>
                  {!queueData || queueData.items.length === 0 ? (
                    <p className="hint">Antrean sedang kosong.</p>
                  ) : (
                    queueData.items.map((it) => (
                      <div key={it.name} className="list-row">
                        <div className="row-between">
                          <strong style={{ fontSize: 12 }}>{it.title}</strong>
                          <span className="readout">{it.sizeMB} MB</span>
                        </div>
                        <span className="hint">{it.name}</span>
                      </div>
                    ))
                  )}
                </section>

                {queueData && queueData.history.length > 0 && (
                  <section className="panel-section">
                    <span className="section-title">Riwayat Tayang</span>
                    {queueData.history.map((h, i) => (
                      <div key={i} className="list-row">
                        <strong style={{ fontSize: 12 }}>{h.title || "Short"}</strong>
                        <span className="hint">
                          {h.publish_at ? `Jadwal: ${h.publish_at}` : `Status: ${h.privacy || "public"}`}
                        </span>
                        {h.url && (
                          <a className="yt-link" href={h.url} target="_blank" rel="noreferrer">
                            {h.url}
                          </a>
                        )}
                      </div>
                    ))}
                  </section>
                )}
              </>
            )}
          </div>

          {/* Sticky Bottom Wizard Navigation */}
          <footer className="wizard-footer">
            {step > 1 ? (
              <button type="button" className="btn btn-sm" onClick={() => setStep((s) => (s - 1) as StepId)}>
                <ArrowLeft size={13} /> Kembali
              </button>
            ) : !activeProject ? (
              <button type="button" className="btn btn-sm" onClick={handleCloneTemplateToProject}>
                <Save size={12} /> Simpan Proyek
              </button>
            ) : (
              <span className="readout">AUTO-SAVED</span>
            )}

            {step < 4 ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setStep((s) => (s + 1) as StepId)}
              >
                Lanjut: {step === 1 ? "2. Suara AI" : step === 2 ? "3. Render MP4" : "4. YouTube"}{" "}
                <ArrowRight size={13} />
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreator(true)}>
                <Plus size={13} /> Buat Episode Baru
              </button>
            )}
          </footer>
        </aside>
      </div>

      {/* Modal: + Buat Episode Baru */}
      {showCreator && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Buat Episode Baru">
          <div className="modal-panel">
            <div className="modal-head">
              <span>Buat Episode 3D Baru</span>
              <button type="button" className="btn btn-sm" onClick={() => setShowCreator(false)} aria-label="Tutup">
                <X size={14} />
              </button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label htmlFor="new-ep-name">1. Judul / Topik Episode</label>
                <input
                  id="new-ep-name"
                  className="input"
                  placeholder="Contoh: Kenapa Sistem Subak Bali Nggak Pernah Kekeringan?"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div className="field">
                <label>2. Pilih Template Dunia 3D</label>
                <div className="template-grid">
                  {EPISODES.map((ep) => (
                    <button
                      key={ep.id}
                      type="button"
                      className={`template-card ${newTemplateId === ep.id ? "selected" : ""}`}
                      onClick={() => setNewTemplateId(ep.id)}
                    >
                      <strong>{ep.name}</strong>
                      <span>
                        {ep.badge} · {(ep.durationInFrames / ep.fps).toFixed(0)}s
                        {ep.supportsBoardEditor ? " · Edit Papan 3D" : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label htmlFor="new-ep-script">3. Naskah Awal (Opsional — 1 baris = 1 subtitle)</label>
                <textarea
                  id="new-ep-script"
                  className="textarea"
                  placeholder="Kosongkan untuk mulai dari contoh naskah bawaan template..."
                  value={newScript}
                  onChange={(e) => setNewScript(e.target.value)}
                />
              </div>

              <div className="row-between">
                <button type="button" className="btn" onClick={() => setShowCreator(false)}>
                  Batal
                </button>
                <button type="button" className="btn btn-primary" onClick={handleCreateProject}>
                  <Plus size={14} /> Buat & Mulai Langkah 1 →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
