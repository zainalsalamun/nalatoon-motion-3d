import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  Check,
  Clapperboard,
  Download,
  Film,
  Layers,
  Mic,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  SlidersHorizontal,
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
  const [previewMode, setPreviewMode] = useState<"lite" | "hd">("lite");
  const [viewportActive, setViewportActive] = useState<boolean>(true);
  const [debouncedBoard, setDebouncedBoard] = useState<BoardConfig | undefined>(EPISODES[0].defaultBoard);

  const [voiceMode, setVoiceMode] = useState<"design" | "clone">("design");
  const [voiceScript, setVoiceScript] = useState<string>(EPISODES[0].defaultScript);
  const [voiceInstruct, setVoiceInstruct] = useState<string>(DEFAULT_INSTRUCT);
  const [voiceTemp, setVoiceTemp] = useState<number>(0.85);
  const [voices, setVoices] = useState<MediaFile[]>([]);
  const [selectedVoiceFile, setSelectedVoiceFile] = useState<string>("");

  const [renderCrf, setRenderCrf] = useState<number>(18);
  const [renderConcurrency, setRenderConcurrency] = useState<number>(2);
  const [frameRange, setFrameRange] = useState<string>("");
  const [renders, setRenders] = useState<MediaFile[]>([]);

  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [ytHour, setYtHour] = useState<number>(19);
  const [ytMinute, setYtMinute] = useState<number>(0);
  const [enqueueFile, setEnqueueFile] = useState<string>("");
  const [enqueueTitle, setEnqueueTitle] = useState<string>("");
  const [enqueueDesc, setEnqueueDesc] = useState<string>("");

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
      showNotice("warn", "API studio lokal tidak merespons. Jalankan lewat: npm run ui");
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
        // retry on next tick
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

  // Debounce 3D canvas texture rebuilds while typing to avoid allocating textures on every keystroke
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedBoard(currentBoard), 180);
    return () => window.clearTimeout(t);
  }, [currentBoard]);

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
      board: episode.supportsBoardEditor ? debouncedBoard : undefined,
      exposure,
      subtitleText,
      subtitleAccent,
      showWatermark,
      watermarkText,
      previewMode,
    }),
    [
      episode.supportsBoardEditor,
      debouncedBoard,
      exposure,
      subtitleText,
      subtitleAccent,
      showWatermark,
      watermarkText,
      previewMode,
    ],
  );

  const renderExportProps: StudioSceneProps = useMemo(
    () => ({
      board: episode.supportsBoardEditor ? currentBoard : undefined,
      exposure,
      subtitleText,
      subtitleAccent,
      showWatermark,
      watermarkText,
      previewMode: "hd",
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
    showNotice("ok", "Pengaturan dikembalikan ke default.");
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
          props: renderExportProps,
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
      {/* Hardware Console Top Bar */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Clapperboard size={15} />
          </div>
          <span>Nalatoon</span>
          <span className="brand-divider">//</span>
          <span className="brand-console">3D DIORAMA CONSOLE</span>
        </div>

        <div className="topbar-center">
          <select
            aria-label="Pilih Episode 3D"
            className="episode-select"
            value={episode.id}
            onChange={(e) => handleSelectEpisode(e.target.value)}
          >
            {EPISODES.map((ep, idx) => (
              <option key={ep.id} value={ep.id}>
                {String(idx + 1).padStart(2, "0")} — {ep.name}
              </option>
            ))}
          </select>
          <span className="readout">
            1080×1920 · {episode.fps}FPS · {durationSec}S
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
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleStartRender}
            disabled={activeJob?.status === "running"}
          >
            <Film size={13} /> Render MP4
          </button>
        </div>
      </header>

      <div className="workspace">
        {/* Left Sidebar: Numbered Episode Reel */}
        <aside className="sidebar" aria-label="Daftar Episode 3D">
          <div className="sidebar-header">
            <span>REEL KOMPOSISI</span>
            <span>{String(EPISODES.length).padStart(2, "0")}</span>
          </div>
          <div className="episode-list">
            {EPISODES.map((ep, idx) => (
              <button
                key={ep.id}
                type="button"
                className={`episode-row ${ep.id === episode.id ? "active" : ""}`}
                onClick={() => handleSelectEpisode(ep.id)}
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

          <div className="monitor-housing">
            <div className="monitor-strip">
              <span className="monitor-rec">
                <span className={`led-dot ${viewportActive ? "rec" : ""}`} />
                {viewportActive ? `MONITOR 9:16 (${previewMode.toUpperCase()})` : "3D SLEEP (0 MB VRAM)"}
              </span>
              <div className="monitor-actions">
                <button
                  type="button"
                  className={`mini-toggle ${previewMode === "lite" ? "active" : ""}`}
                  title="Mode ringan 540p tanpa bokeh untuk hemat RAM (Render MP4 tetap 100% HD)"
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
              <button
                key={bm.label}
                type="button"
                className="shot-key"
                onClick={() => jumpToFrame(bm.frame)}
              >
                <span className="shot-key-idx">{String(i + 1).padStart(2, "0")}</span>
                <span>{bm.label}</span>
              </button>
            ))}
          </div>

          <div className="stage-caption">{episode.description}</div>
        </main>

        {/* Right Architectural Inspector (Flat Sections, Zero Card Nesting) */}
        <aside className="inspector">
          <div className="tabs" role="tablist" aria-label="Panel Kontrol Studio">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "editor"}
              className="tab-btn"
              onClick={() => setActiveTab("editor")}
            >
              <SlidersHorizontal size={13} /> Editor 3D
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "voice"}
              className="tab-btn"
              onClick={() => setActiveTab("voice")}
            >
              <Mic size={13} /> Voice AI
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "render"}
              className="tab-btn"
              onClick={() => setActiveTab("render")}
            >
              <Film size={13} /> Render
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "youtube"}
              className="tab-btn"
              onClick={() => setActiveTab("youtube")}
            >
              <Youtube size={13} /> YouTube
            </button>
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

            {/* TAB 1: EDITOR 3D */}
            {activeTab === "editor" && (
              <>
                <section className="panel-section">
                  <div className="section-head">
                    <span className="section-title">
                      <Layers size={13} /> Kamera & Overlay
                    </span>
                    <button type="button" className="btn btn-sm" onClick={handleResetBoard}>
                      <RotateCcw size={12} /> Reset
                    </button>
                  </div>

                  <div className="field">
                    <div className="row-between">
                      <label htmlFor="exposure-range">Exposure Kamera 3D</label>
                      <span className="readout">{exposure.toFixed(2)} EV</span>
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
                    <label htmlFor="sub-preview">Live Subtitle Preview</label>
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
                    <label htmlFor="wm-toggle">Watermark Bawah</label>
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
                </section>

                {episode.supportsBoardEditor && currentBoard ? (
                  <section className="panel-section">
                    <div className="section-head">
                      <span className="section-title">
                        <SlidersHorizontal size={13} /> Papan Infografis 3D
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
                      Perubahan teks langsung memperbarui tekstur papan kayu di dalam scene 3D secara real-time.
                    </p>

                    <div className="field">
                      <label htmlFor="board-title">Judul Papan 3D</label>
                      <input
                        id="board-title"
                        className="input"
                        value={currentBoard.title}
                        onChange={(e) => updateBoardField("title", e.target.value)}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="board-subtitle">Subjudul</label>
                      <input
                        id="board-subtitle"
                        className="input"
                        value={currentBoard.subtitle}
                        onChange={(e) => updateBoardField("subtitle", e.target.value)}
                      />
                    </div>

                    <div className="grid-2">
                      <div className="field">
                        <span className="col-label-left">KOLOM KIRI</span>
                        <input
                          className="input"
                          aria-label="Header kolom kiri"
                          value={currentBoard.leftHeader}
                          onChange={(e) => updateBoardField("leftHeader", e.target.value)}
                        />
                        {currentBoard.leftItems.map((it, i) => (
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
                          value={currentBoard.leftFooter}
                          onChange={(e) => updateBoardField("leftFooter", e.target.value)}
                        />
                      </div>

                      <div className="field">
                        <span className="col-label-right">KOLOM KANAN</span>
                        <input
                          className="input"
                          aria-label="Header kolom kanan"
                          value={currentBoard.rightHeader}
                          onChange={(e) => updateBoardField("rightHeader", e.target.value)}
                        />
                        {currentBoard.rightItems.map((it, i) => (
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
                          value={currentBoard.rightFooter}
                          onChange={(e) => updateBoardField("rightFooter", e.target.value)}
                        />
                      </div>
                    </div>
                  </section>
                ) : (
                  <section className="panel-section">
                    <span className="section-title">Catatan Episode</span>
                    <p className="hint">
                      Editor papan infografis 3D aktif di <strong>Mina Padi Ikan Mas</strong> dan{" "}
                      <strong>Sawah Padi-Bebek (Aigamo)</strong>. Preview, voiceover AI, dan render MP4 tetap tersedia
                      penuh untuk episode ini.
                    </p>
                  </section>
                )}
              </>
            )}

            {/* TAB 2: VOICE AI */}
            {activeTab === "voice" && (
              <>
                <section className="panel-section">
                  <div className="section-head">
                    <span className="section-title">
                      <Mic size={13} /> Qwen3-TTS MLX
                    </span>
                    <span className="led-item">
                      <span className={`led-dot ${health?.capabilities.mlxTts ? "on" : ""}`} />
                      {health?.capabilities.mlxTts ? "GPU SIAP" : "OFFLINE"}
                    </span>
                  </div>

                  <div className="segmented" role="group" aria-label="Mode Voice TTS">
                    <button
                      type="button"
                      className={`seg-btn ${voiceMode === "design" ? "active" : ""}`}
                      onClick={() => setVoiceMode("design")}
                    >
                      VoiceDesign 1.7B
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${voiceMode === "clone" ? "active" : ""}`}
                      onClick={() => setVoiceMode("clone")}
                    >
                      Voice Cloning
                    </button>
                  </div>

                  <div className="field">
                    <label htmlFor="voice-script">Naskah Bahasa Indonesia</label>
                    <textarea
                      id="voice-script"
                      className="textarea"
                      value={voiceScript}
                      onChange={(e) => setVoiceScript(e.target.value)}
                    />
                  </div>

                  {voiceMode === "design" && (
                    <div className="field">
                      <label htmlFor="voice-instruct">Arahan Intonasi & Karakter</label>
                      <textarea
                        id="voice-instruct"
                        className="textarea"
                        style={{ minHeight: 68 }}
                        value={voiceInstruct}
                        onChange={(e) => setVoiceInstruct(e.target.value)}
                      />
                    </div>
                  )}

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
                      <Volume2 size={13} /> Takes Tersimpan ({voices.length})
                    </span>
                    <button type="button" className="btn btn-sm" onClick={refreshLists} aria-label="Segarkan daftar suara">
                      <RefreshCw size={12} />
                    </button>
                  </div>

                  {voices.length === 0 ? (
                    <p className="hint">Belum ada file voiceover di out/studio_voices/.</p>
                  ) : (
                    voices.map((v) => (
                      <div key={v.name} className="list-row">
                        <div className="row-between">
                          <strong style={{ fontSize: 12 }}>{v.name}</strong>
                          <span className="readout">{v.sizeMB} MB</span>
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
                            <Check size={12} />
                            {selectedVoiceFile === v.name ? "Aktif di Render" : "Pakai di Render"}
                          </button>
                          <a className="btn btn-sm" href={v.url} download={v.name}>
                            <Download size={12} /> Unduh
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </section>
              </>
            )}

            {/* TAB 3: RENDER MP4 */}
            {activeTab === "render" && (
              <>
                <section className="panel-section">
                  <span className="section-title">
                    <Film size={13} /> Konfigurasi Render ({episode.id})
                  </span>

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
                        <option value={1}>1 — Hemat RAM</option>
                        <option value={2}>2 — Standar</option>
                        <option value={3}>3 — Cepat</option>
                      </select>
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="frame-range">Rentang Frame Opsional (mis. 0-150 untuk tes 5 detik)</label>
                    <input
                      id="frame-range"
                      className="input"
                      placeholder="Kosongkan untuk render penuh"
                      value={frameRange}
                      onChange={(e) => setFrameRange(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="mux-voice">Track Audio Voiceover</label>
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
                    <Film size={14} /> Render {episode.id} ke MP4
                  </button>
                </section>

                <section className="panel-section">
                  <div className="section-head">
                    <span className="section-title">Output Render ({renders.length})</span>
                    <button type="button" className="btn btn-sm" onClick={refreshLists} aria-label="Segarkan daftar render">
                      <RefreshCw size={12} />
                    </button>
                  </div>

                  {renders.length === 0 ? (
                    <p className="hint">Belum ada video di out/studio_renders/.</p>
                  ) : (
                    renders.map((r) => (
                      <div key={r.name} className="list-row">
                        <div className="row-between">
                          <strong style={{ fontSize: 12 }}>{r.name}</strong>
                          <span className="readout">{r.sizeMB} MB</span>
                        </div>
                        <video controls src={r.url} style={{ maxHeight: 250 }} />
                        <div className="row-between">
                          <button
                            type="button"
                            className="btn btn-secondary-accent btn-sm"
                            onClick={() => {
                              setEnqueueFile(r.name);
                              setEnqueueTitle(episode.name);
                              setActiveTab("youtube");
                            }}
                          >
                            <Send size={12} /> Kirim ke Antrean YT
                          </button>
                          <a className="btn btn-sm" href={r.url} download={r.name}>
                            <Download size={12} /> Unduh
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </section>
              </>
            )}

            {/* TAB 4: YOUTUBE SCHEDULER */}
            {activeTab === "youtube" && (
              <>
                <section className="panel-section">
                  <div className="section-head">
                    <span className="section-title">
                      <Youtube size={13} /> YouTube Data API v3
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
                </section>

                <section className="panel-section">
                  <span className="section-title">Tambah Video ke Antrean</span>
                  <div className="field">
                    <label htmlFor="yt-file">File Render MP4</label>
                    <select
                      id="yt-file"
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
                    <label htmlFor="yt-title">Judul YouTube Shorts</label>
                    <input
                      id="yt-title"
                      className="input"
                      placeholder="Maks. 100 karakter, tanpa emoji"
                      value={enqueueTitle}
                      onChange={(e) => setEnqueueTitle(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="yt-desc">Deskripsi & Hashtags</label>
                    <textarea
                      id="yt-desc"
                      className="textarea"
                      style={{ minHeight: 64 }}
                      placeholder="Deskripsi singkat + #shorts #nalatoon #faktaunik"
                      value={enqueueDesc}
                      onChange={(e) => setEnqueueDesc(e.target.value)}
                    />
                  </div>
                  <button type="button" className="btn btn-secondary-accent btn-full" onClick={handleEnqueueRender}>
                    <Send size={13} /> Masukkan ke Antrean Upload
                  </button>
                </section>

                <section className="panel-section">
                  <div className="section-head">
                    <span className="section-title">Antrean Aktif ({queueData?.items.length ?? 0})</span>
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
                        <span className="hint">
                          {it.name} · {it.hasCaption ? "caption.txt siap" : "tanpa caption.txt"}
                        </span>
                      </div>
                    ))
                  )}
                </section>

                {queueData && queueData.history.length > 0 && (
                  <section className="panel-section">
                    <span className="section-title">Riwayat Terjadwal / Terbit</span>
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
        </aside>
      </div>
    </div>
  );
};
