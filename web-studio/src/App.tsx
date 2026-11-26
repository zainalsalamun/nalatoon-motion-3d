import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  CheckCircle2,
  Clapperboard,
  Download,
  Film,
  Layers,
  Mic,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Sliders,
  Sparkles,
  UploadCloud,
  Volume2,
  Youtube,
} from "lucide-react";
import { EPISODES, type EpisodeDef } from "./episodes";
import type { BoardConfig, StudioSceneProps } from "@studio/types/studioProps";

type TabId = "editor" | "voice" | "render" | "youtube";

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

export const App: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);

  const [selectedId, setSelectedId] = useState<string>(EPISODES[0].id);
  const episode: EpisodeDef = useMemo(
    () => EPISODES.find((e) => e.id === selectedId) || EPISODES[0],
    [selectedId],
  );

  const [activeTab, setActiveTab] = useState<TabId>("editor");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "warn" | "error"; text: string } | null>(null);

  // Per-episode live editor state
  const [boardByEp, setBoardByEp] = useState<Record<string, BoardConfig>>(() => {
    const init: Record<string, BoardConfig> = {};
    for (const ep of EPISODES) {
      if (ep.defaultBoard) init[ep.id] = { ...ep.defaultBoard };
    }
    return init;
  });
  const [exposure, setExposure] = useState<number>(1.06);
  const [subtitleText, setSubtitleText] = useState<string>(EPISODES[0].defaultSubtitle);
  const [subtitleAccent, setSubtitleAccent] = useState<boolean>(false);
  const [showWatermark, setShowWatermark] = useState<boolean>(true);
  const [watermarkText, setWatermarkText] = useState<string>("Powered by Naltech");

  // Voice studio state
  const [voiceMode, setVoiceMode] = useState<"design" | "clone">("design");
  const [voiceScript, setVoiceScript] = useState<string>(EPISODES[0].defaultScript);
  const [voiceInstruct, setVoiceInstruct] = useState<string>(DEFAULT_INSTRUCT);
  const [voiceTemp, setVoiceTemp] = useState<number>(0.85);
  const [voices, setVoices] = useState<MediaFile[]>([]);
  const [selectedVoiceFile, setSelectedVoiceFile] = useState<string>("");

  // Render state
  const [renderCrf, setRenderCrf] = useState<number>(18);
  const [renderConcurrency, setRenderConcurrency] = useState<number>(2);
  const [frameRange, setFrameRange] = useState<string>("");
  const [renders, setRenders] = useState<MediaFile[]>([]);

  // YouTube state
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [ytHour, setYtHour] = useState<number>(19);
  const [ytMinute, setYtMinute] = useState<number>(0);
  const [enqueueFile, setEnqueueFile] = useState<string>("");
  const [enqueueTitle, setEnqueueTitle] = useState<string>("");
  const [enqueueDesc, setEnqueueDesc] = useState<string>("");

  // Active background jobs
  const [activeJob, setActiveJob] = useState<StudioJob | null>(null);

  const showNotice = useCallback((kind: "ok" | "warn" | "error", text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  const refreshLists = useCallback(async () => {
    try {
      const [hRes, vRes, rRes, qRes] = await Promise.all([
        fetch("/api/health").then((r) => r.json()),
        fetch("/api/voices").then((r) => r.json()),
        fetch("/api/renders").then((r) => r.json()),
        fetch("/api/youtube/queue").then((r) => r.json()),
      ]);
      setHealth(hRes);
      setVoices(vRes.files || []);
      setRenders(rRes.files || []);
      setQueueData(qRes);
    } catch {
      showNotice("warn", "API lokal (port 4177) belum tersambung. Jalankan lewat: npm run ui");
    }
  }, [showNotice]);

  useEffect(() => {
    refreshLists();
    fetch("/api/presets")
      .then((r) => r.json())
      .then((saved) => {
        if (saved && saved.boardByEp) {
          setBoardByEp((prev) => ({ ...prev, ...saved.boardByEp }));
        }
      })
      .catch(() => {});
  }, [refreshLists]);

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
          showNotice("ok", `${updated.label} selesai!`);
          if (updated.type === "voice" && updated.outputFile) {
            setSelectedVoiceFile(updated.outputFile);
          }
          if (updated.type === "render" && updated.outputFile) {
            setEnqueueFile(updated.outputFile);
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
  }, [activeJob, refreshLists, showNotice]);

  const handleSelectEpisode = (id: string) => {
    setSelectedId(id);
    const ep = EPISODES.find((e) => e.id === id);
    if (ep) {
      setSubtitleText(ep.defaultSubtitle);
      setVoiceScript(ep.defaultScript);
    }
  };

  const currentBoard: BoardConfig | undefined = boardByEp[episode.id] || episode.defaultBoard;

  const updateBoardField = <K extends keyof BoardConfig>(key: K, value: BoardConfig[K]) => {
    if (!currentBoard) return;
    setBoardByEp((prev) => ({
      ...prev,
      [episode.id]: {
        ...currentBoard,
        [key]: value,
      },
    }));
  };

  const updateBoardItem = (side: "leftItems" | "rightItems", idx: number, value: string) => {
    if (!currentBoard) return;
    const next: [string, string, string] = [...currentBoard[side]] as [string, string, string];
    next[idx] = value;
    updateBoardField(side, next);
  };

  const sceneInputProps: StudioSceneProps = useMemo(
    () => ({
      board: episode.supportsBoardEditor ? currentBoard : undefined,
      exposure,
      subtitleText,
      subtitleAccent,
      showWatermark,
      watermarkText,
    }),
    [episode.supportsBoardEditor, currentBoard, exposure, subtitleText, subtitleAccent, showWatermark, watermarkText],
  );

  const jumpToFrame = (frame: number) => {
    playerRef.current?.seekTo(frame);
  };

  const handleSavePresets = async () => {
    try {
      await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardByEp }),
      });
      showNotice("ok", "Preset Papan 3D tersimpan lokal.");
    } catch {
      showNotice("error", "Gagal menyimpan preset.");
    }
  };

  const handleResetBoard = () => {
    if (!episode.defaultBoard) return;
    setBoardByEp((prev) => ({ ...prev, [episode.id]: { ...episode.defaultBoard! } }));
    setExposure(1.06);
    setSubtitleText(episode.defaultSubtitle);
    showNotice("ok", "Reset ke pengaturan default episode.");
  };

  const handleGenerateVoice = async () => {
    try {
      const res = await fetch("/api/voice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: voiceMode,
          text: voiceScript,
          instruct: voiceInstruct,
          temperature: voiceTemp,
          label: episode.id,
        }),
      });
      const job: StudioJob = await res.json();
      setActiveJob(job);
      if (job.status === "failed") {
        showNotice("error", job.error || "Voice generation gagal.");
      }
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
          frameRange: frameRange.trim() || undefined,
          voiceFile: selectedVoiceFile || undefined,
          props: sceneInputProps,
        }),
      });
      const job: StudioJob = await res.json();
      setActiveJob(job);
      setActiveTab("render");
      if (job.status === "failed") {
        showNotice("error", job.error || "Gagal memulai render.");
      }
    } catch {
      showNotice("error", "Tidak bisa menghubungi Studio API.");
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

  const handleEnqueueRender = async () => {
    if (!enqueueFile) {
      showNotice("warn", "Pilih file MP4 hasil render dulu.");
      return;
    }
    try {
      const res = await fetch("/api/youtube/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          renderFile: enqueueFile,
          title: enqueueTitle || episode.name,
          description:
            enqueueDesc ||
            `${enqueueTitle || episode.name}\n\nPowered by Naltech\n#shorts #nalatoon #edukasi #faktaunik`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice("error", data.error || "Gagal memasukkan ke antrean.");
        return;
      }
      showNotice("ok", `Masuk antrean YouTube: ${data.folderName}`);
      setEnqueueTitle("");
      setEnqueueDesc("");
      refreshLists();
    } catch {
      showNotice("error", "Gagal menambah ke antrean YouTube.");
    }
  };

  const durationSec = (episode.durationInFrames / episode.fps).toFixed(1);

  return (
    <div className="app-shell">
      {/* Top Studio Navigation */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Clapperboard size={17} />
          </div>
          <span>Nalatoon 3D Studio</span>
          <span className="brand-sub">LOCAL WEB APP</span>
        </div>

        <div className="topbar-center">
          <select
            aria-label="Pilih Episode 3D"
            className="episode-select"
            value={episode.id}
            onChange={(e) => handleSelectEpisode(e.target.value)}
          >
            {EPISODES.map((ep) => (
              <option key={ep.id} value={ep.id}>
                {ep.name} ({ep.badge})
              </option>
            ))}
          </select>
          <span className="meta-pill">
            1080×1920 · {episode.fps}fps · {durationSec}s
          </span>
        </div>

        <div className="topbar-right">
          <div className="status-dots">
            <span className={`cap-badge ${health?.capabilities.mlxTts ? "ok" : ""}`}>
              <Mic size={11} /> Qwen3-TTS
            </span>
            <span className={`cap-badge ${health?.capabilities.youtubeToken ? "ok" : ""}`}>
              <Youtube size={11} /> YouTube API
            </span>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleStartRender}
            disabled={activeJob?.status === "running"}
          >
            <Film size={14} /> Render MP4
          </button>
        </div>
      </header>

      <div className="workspace">
        {/* Left Sidebar: Episode Library */}
        <aside className="sidebar" aria-label="Daftar Episode 3D">
          <div className="sidebar-header">Komposisi Episode ({EPISODES.length})</div>
          <div className="episode-list">
            {EPISODES.map((ep) => (
              <button
                key={ep.id}
                type="button"
                className={`episode-card ${ep.id === episode.id ? "active" : ""}`}
                onClick={() => handleSelectEpisode(ep.id)}
              >
                <div className="episode-card-title">{ep.name}</div>
                <div className="episode-card-meta">
                  <span className="episode-badge">{ep.badge}</span>
                  <span>{(ep.durationInFrames / ep.fps).toFixed(0)}s</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Center Stage: Live 3D Player */}
        <main className="stage">
          {toast && (
            <div className={`banner ${toast.kind === "warn" ? "warn" : toast.kind === "error" ? "error" : ""}`}>
              {toast.text}
            </div>
          )}

          <div className="phone-bezel">
            <div className="phone-screen">
              <Player
                key={episode.id}
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
            </div>
          </div>

          <div className="bookmark-bar" aria-label="Lompat cepat ke shot">
            {episode.bookmarks.map((bm) => (
              <button
                key={bm.label}
                type="button"
                className="bookmark-btn"
                onClick={() => jumpToFrame(bm.frame)}
              >
                <Play size={11} />
                {bm.label}
              </button>
            ))}
          </div>

          <div className="stage-footer">
            <span>{episode.description}</span>
          </div>
        </main>

        {/* Right Inspector: 4 Studio Tabs */}
        <aside className="inspector">
          <div className="tabs" role="tablist" aria-label="Alat Studio">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "editor"}
              className="tab-btn"
              onClick={() => setActiveTab("editor")}
            >
              <Sliders size={14} /> Editor 3D
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "voice"}
              className="tab-btn"
              onClick={() => setActiveTab("voice")}
            >
              <Mic size={14} /> Voice AI
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "render"}
              className="tab-btn"
              onClick={() => setActiveTab("render")}
            >
              <Film size={14} /> Render
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "youtube"}
              className="tab-btn"
              onClick={() => setActiveTab("youtube")}
            >
              <Youtube size={14} /> YouTube
            </button>
          </div>

          <div className="inspector-body">
            {/* Live Background Job Progress Card */}
            {activeJob && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">
                    <Sparkles size={14} /> {activeJob.label}
                  </span>
                  <span className="meta-pill">
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
              </div>
            )}

            {/* TAB 1: EDITOR 3D */}
            {activeTab === "editor" && (
              <>
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">
                      <Layers size={14} /> Pencahayaan & Overlay Preview
                    </span>
                    <button type="button" className="btn btn-sm" onClick={handleResetBoard}>
                      <RotateCcw size={12} /> Reset
                    </button>
                  </div>

                  <div className="field">
                    <div className="row-between">
                      <label htmlFor="exposure-range">Exposure Kamera 3D</label>
                      <span className="meta-pill">{exposure.toFixed(2)}</span>
                    </div>
                    <input
                      id="exposure-range"
                      type="range"
                      min="0.80"
                      max="1.35"
                      step="0.02"
                      value={exposure}
                      onChange={(e) => setExposure(parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="sub-preview">Live Subtitle Preview (Overlay)</label>
                    <input
                      id="sub-preview"
                      className="input"
                      placeholder="Kosongkan untuk sembunyikan subtitle preview"
                      value={subtitleText}
                      onChange={(e) => setSubtitleText(e.target.value)}
                    />
                  </div>

                  <div className="switch-row">
                    <label htmlFor="sub-accent">Warna Aksen Kuning (Punchline)</label>
                    <input
                      id="sub-accent"
                      type="checkbox"
                      checked={subtitleAccent}
                      onChange={(e) => setSubtitleAccent(e.target.checked)}
                    />
                  </div>

                  <div className="switch-row">
                    <label htmlFor="wm-toggle">Tampilkan Watermark Bawah</label>
                    <input
                      id="wm-toggle"
                      type="checkbox"
                      checked={showWatermark}
                      onChange={(e) => setShowWatermark(e.target.checked)}
                    />
                  </div>

                  {showWatermark && (
                    <div className="field">
                      <label htmlFor="wm-text">Teks Watermark</label>
                      <input
                        id="wm-text"
                        className="input"
                        value={watermarkText}
                        onChange={(e) => setWatermarkText(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {episode.supportsBoardEditor && currentBoard ? (
                  <div className="card">
                    <div className="card-header">
                      <span className="card-title">
                        <Sliders size={14} /> Papan Infografis 3D (Live)
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
                        <button type="button" className="btn btn-primary btn-sm" onClick={handleSavePresets}>
                          <Save size={12} /> Simpan
                        </button>
                      </div>
                    </div>

                    <p className="hint">
                      Ketik teks di bawah — tekstur kayu papan 3D di dalam scene langsung berubah secara real-time.
                    </p>

                    <div className="field">
                      <label>Judul Papan 3D</label>
                      <input
                        className="input"
                        value={currentBoard.title}
                        onChange={(e) => updateBoardField("title", e.target.value)}
                      />
                    </div>

                    <div className="field">
                      <label>Subjudul</label>
                      <input
                        className="input"
                        value={currentBoard.subtitle}
                        onChange={(e) => updateBoardField("subtitle", e.target.value)}
                      />
                    </div>

                    <div className="grid-2">
                      <div className="field">
                        <span className="col-badge-left">KOLOM KIRI (MERAH)</span>
                        <input
                          className="input"
                          value={currentBoard.leftHeader}
                          onChange={(e) => updateBoardField("leftHeader", e.target.value)}
                        />
                        {currentBoard.leftItems.map((it, i) => (
                          <input
                            key={i}
                            className="input"
                            value={it}
                            onChange={(e) => updateBoardItem("leftItems", i, e.target.value)}
                          />
                        ))}
                        <input
                          className="input"
                          value={currentBoard.leftFooter}
                          onChange={(e) => updateBoardField("leftFooter", e.target.value)}
                        />
                      </div>

                      <div className="field">
                        <span className="col-badge-right">KOLOM KANAN (HIJAU)</span>
                        <input
                          className="input"
                          value={currentBoard.rightHeader}
                          onChange={(e) => updateBoardField("rightHeader", e.target.value)}
                        />
                        {currentBoard.rightItems.map((it, i) => (
                          <input
                            key={i}
                            className="input"
                            value={it}
                            onChange={(e) => updateBoardItem("rightItems", i, e.target.value)}
                          />
                        ))}
                        <input
                          className="input"
                          value={currentBoard.rightFooter}
                          onChange={(e) => updateBoardField("rightFooter", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="card">
                    <span className="card-title">Info Episode</span>
                    <p className="hint">
                      Editor papan infografis 3D live saat ini aktif di <strong>Mina Padi Ikan Mas</strong> dan{" "}
                      <strong>Sawah Padi-Bebek (Aigamo)</strong>. Kamu tetap bisa preview, generate voiceover, dan
                      render episode ini di tab sebelah.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* TAB 2: VOICE AI STUDIO */}
            {activeTab === "voice" && (
              <>
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">
                      <Mic size={14} /> Qwen3-TTS MLX (Gratis & Lokal)
                    </span>
                    <span className={`cap-badge ${health?.capabilities.mlxTts ? "ok" : ""}`}>
                      {health?.capabilities.mlxTts ? "GPU Siap" : "Perlu mlx-audio"}
                    </span>
                  </div>

                  <div className="grid-2">
                    <button
                      type="button"
                      className={`btn btn-sm ${voiceMode === "design" ? "btn-primary" : ""}`}
                      onClick={() => setVoiceMode("design")}
                    >
                      VoiceDesign 1.7B (Santai)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${voiceMode === "clone" ? "btn-primary" : ""}`}
                      onClick={() => setVoiceMode("clone")}
                    >
                      Voice Cloning (Base)
                    </button>
                  </div>

                  <div className="field">
                    <label htmlFor="voice-script">Naskah Bahasa Indonesia (Gaya Ngobrol)</label>
                    <textarea
                      id="voice-script"
                      className="textarea"
                      value={voiceScript}
                      onChange={(e) => setVoiceScript(e.target.value)}
                    />
                  </div>

                  {voiceMode === "design" && (
                    <div className="field">
                      <label htmlFor="voice-instruct">Arahan Intonasi & Karakter Suara</label>
                      <textarea
                        id="voice-instruct"
                        className="textarea"
                        style={{ minHeight: 64 }}
                        value={voiceInstruct}
                        onChange={(e) => setVoiceInstruct(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="field">
                    <div className="row-between">
                      <label htmlFor="voice-temp">Ekspresi / Temperature</label>
                      <span className="meta-pill">{voiceTemp.toFixed(2)}</span>
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

                  <button
                    type="button"
                    className="btn btn-primary btn-full"
                    disabled={activeJob?.status === "running"}
                    onClick={handleGenerateVoice}
                  >
                    <Sparkles size={15} /> Generate Voiceover WAV
                  </button>
                </div>

                <div className="card">
                  <div className="card-header">
                    <span className="card-title">
                      <Volume2 size={14} /> Hasil Voiceover ({voices.length})
                    </span>
                    <button type="button" className="btn btn-sm" onClick={refreshLists}>
                      <RefreshCw size={12} />
                    </button>
                  </div>

                  {voices.length === 0 ? (
                    <p className="hint">Belum ada voiceover yang di-generate dari studio.</p>
                  ) : (
                    voices.map((v) => (
                      <div key={v.name} className="media-item">
                        <div className="row-between">
                          <strong style={{ fontSize: 12 }}>{v.name}</strong>
                          <span className="meta-pill">{v.sizeMB} MB</span>
                        </div>
                        <audio controls src={v.url} />
                        <div className="row-between">
                          <button
                            type="button"
                            className={`btn btn-sm ${selectedVoiceFile === v.name ? "btn-primary" : ""}`}
                            onClick={() => {
                              setSelectedVoiceFile(v.name);
                              showNotice("ok", `Dipilih untuk muxing render: ${v.name}`);
                            }}
                          >
                            <CheckCircle2 size={12} />
                            {selectedVoiceFile === v.name ? "Dipakai di Render" : "Pakai untuk Render"}
                          </button>
                          <a className="btn btn-sm" href={v.url} download={v.name}>
                            <Download size={12} /> Unduh
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* TAB 3: RENDER MP4 */}
            {activeTab === "render" && (
              <>
                <div className="card">
                  <span className="card-title">
                    <Film size={14} /> Pengaturan Render MP4 ({episode.id})
                  </span>

                  <div className="grid-2">
                    <div className="field">
                      <label htmlFor="crf-select">Kualitas Video (CRF)</label>
                      <select
                        id="crf-select"
                        className="select"
                        value={renderCrf}
                        onChange={(e) => setRenderCrf(parseInt(e.target.value, 10))}
                      >
                        <option value={18}>18 — Ultra Tajam</option>
                        <option value={20}>20 — Seimbang</option>
                        <option value={23}>23 — Cepat & Ringan</option>
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
                        <option value={1}>1 (Hemat RAM)</option>
                        <option value={2}>2 (Rekomendasi)</option>
                        <option value={3}>3 (Cepat)</option>
                      </select>
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="frame-range">Rentang Frame Opsional (mis. 0-150 untuk tes cepat 5 detik)</label>
                    <input
                      id="frame-range"
                      className="input"
                      placeholder="Kosongkan untuk render penuh"
                      value={frameRange}
                      onChange={(e) => setFrameRange(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="mux-voice">Gabungkan Voiceover (Opsional)</label>
                    <select
                      id="mux-voice"
                      className="select"
                      value={selectedVoiceFile}
                      onChange={(e) => setSelectedVoiceFile(e.target.value)}
                    >
                      <option value="">Tanpa audio (video 3D saja)</option>
                      {voices.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name} ({v.sizeMB} MB)
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-full"
                    disabled={activeJob?.status === "running"}
                    onClick={handleStartRender}
                  >
                    <Film size={15} /> Mulai Render {episode.id}
                  </button>
                </div>

                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Video Hasil Render ({renders.length})</span>
                    <button type="button" className="btn btn-sm" onClick={refreshLists}>
                      <RefreshCw size={12} />
                    </button>
                  </div>

                  {renders.length === 0 ? (
                    <p className="hint">Belum ada video render di out/studio_renders/.</p>
                  ) : (
                    renders.map((r) => (
                      <div key={r.name} className="media-item">
                        <div className="row-between">
                          <strong style={{ fontSize: 12 }}>{r.name}</strong>
                          <span className="meta-pill">{r.sizeMB} MB</span>
                        </div>
                        <video controls src={r.url} style={{ maxHeight: 260 }} />
                        <div className="row-between">
                          <button
                            type="button"
                            className="btn btn-amber btn-sm"
                            onClick={() => {
                              setEnqueueFile(r.name);
                              setEnqueueTitle(episode.name);
                              setActiveTab("youtube");
                            }}
                          >
                            <Send size={12} /> Kirim ke YouTube
                          </button>
                          <a className="btn btn-sm" href={r.url} download={r.name}>
                            <Download size={12} /> Unduh MP4
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* TAB 4: YOUTUBE SCHEDULER */}
            {activeTab === "youtube" && (
              <>
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">
                      <Youtube size={14} /> Koneksi YouTube Data API v3
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={activeJob?.status === "running"}
                      onClick={() => handleYoutubeAction("/api/youtube/verify")}
                    >
                      <CheckCircle2 size={12} /> Verify Token
                    </button>
                  </div>
                  <p className="hint">
                    Folder antrean aktif: <code>{queueData?.queueDir || "-"}</code>
                  </p>
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
                        handleYoutubeAction("/api/youtube/schedule", {
                          hour: ytHour,
                          minute: ytMinute,
                          dryRun: true,
                        })
                      }
                    >
                      Dry-Run Cek Jadwal
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={activeJob?.status === "running"}
                      onClick={() =>
                        handleYoutubeAction("/api/youtube/schedule", {
                          hour: ytHour,
                          minute: ytMinute,
                          dryRun: false,
                        })
                      }
                    >
                      <UploadCloud size={13} /> Jadwalkan Semua
                    </button>
                  </div>
                </div>

                <div className="card">
                  <span className="card-title">Tambah Video Render ke Antrean</span>
                  <div className="field">
                    <label>Pilih File Render MP4</label>
                    <select
                      className="select"
                      value={enqueueFile}
                      onChange={(e) => setEnqueueFile(e.target.value)}
                    >
                      <option value="">-- Pilih MP4 --</option>
                      {renders.map((r) => (
                        <option key={r.name} value={r.name}>
                          {r.name} ({r.sizeMB} MB)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Judul YouTube Shorts</label>
                    <input
                      className="input"
                      placeholder="Maks. 100 karakter, tanpa emoji"
                      value={enqueueTitle}
                      onChange={(e) => setEnqueueTitle(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Deskripsi & Hashtags</label>
                    <textarea
                      className="textarea"
                      style={{ minHeight: 64 }}
                      placeholder="Deskripsi singkat + #shorts #nalatoon #faktaunik"
                      value={enqueueDesc}
                      onChange={(e) => setEnqueueDesc(e.target.value)}
                    />
                  </div>
                  <button type="button" className="btn btn-amber btn-full" onClick={handleEnqueueRender}>
                    <Send size={14} /> Masukkan ke Antrean Upload
                  </button>
                </div>

                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Antrean Siap Upload ({queueData?.items.length ?? 0})</span>
                    <button type="button" className="btn btn-sm" onClick={refreshLists}>
                      <RefreshCw size={12} />
                    </button>
                  </div>
                  {!queueData || queueData.items.length === 0 ? (
                    <p className="hint">Antrean sedang kosong.</p>
                  ) : (
                    queueData.items.map((it) => (
                      <div key={it.name} className="media-item">
                        <div className="row-between">
                          <strong style={{ fontSize: 12 }}>{it.title}</strong>
                          <span className="meta-pill">{it.sizeMB} MB</span>
                        </div>
                        <span className="hint">
                          Folder: {it.name} · {it.hasCaption ? "caption.txt siap" : "tanpa caption.txt"}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {queueData && queueData.history.length > 0 && (
                  <div className="card">
                    <span className="card-title">Riwayat Terjadwal / Terbit</span>
                    {queueData.history.map((h, i) => (
                      <div key={i} className="media-item">
                        <strong style={{ fontSize: 12 }}>{h.title || "Short"}</strong>
                        <span className="hint">
                          {h.publish_at ? `Jadwal: ${h.publish_at}` : `Status: ${h.privacy || "public"}`}
                        </span>
                        {h.url && (
                          <a
                            href={h.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#34d399", fontSize: 12 }}
                          >
                            {h.url}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
