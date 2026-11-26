#!/usr/bin/env python3
"""
Builds the complete audio master, exact frame timings, and SRT subtitles for:
"Ada Apa dengan Mekari?" (~55-60s vertical 1080x1920 30fps editorial 3D explainer)

- Uses Qwen3-TTS-12Hz-0.6B-Base-8bit (lang_code="Indonesian") anchored to ONE consistent
  native Indonesian storytelling reference voice (sample_C_calm_storyteller.wav) so ALL 7 cues
  have 100% identical speaker timbre and native Indonesian pronunciation.
"""

import json
import math
import os
import subprocess
import numpy as np
import soundfile as sf
from scipy import signal
from mlx_audio.tts.utils import load_model
from mlx_audio.utils import load_audio

PROJECT_ROOT = "/Users/macbookpro/.gemini/antigravity/scratch/nalatoon-motion-3d"
OUT_DIR = os.path.join(PROJECT_ROOT, "out", "mekari")
CLIP_DIR = os.path.join(OUT_DIR, "clips_v2")
os.makedirs(CLIP_DIR, exist_ok=True)

COMPOSITOR_DIR = os.path.join(PROJECT_ROOT, "node_modules", "@remotion", "compositor-darwin-arm64")
FFMPEG = os.path.join(COMPOSITOR_DIR, "ffmpeg")

SR = 48000
FPS = 30
MODEL_ID = "mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit"

REF_AUDIO_PATH = "/Users/macbookpro/.gemini/antigravity/brain/a8dcf605-69f5-4661-be59-41368cafec71/scratch/tts_demos/sample_C_calm_storyteller.wav"
REF_TEXT = (
    "Bayangin deh, sawah baru aja ditanam, eh malah dilepasi ratusan bebek sekaligus. "
    "Warga awalnya panik, takut padinya abis dimakan semua. "
    "Tapi anehnya, bebek-bebek ini justru nggak nyentuh daun padi sama sekali. "
    "Kenapa bisa gitu? Soalnya di balik air lumpur itu, ada ratusan hama wereng yang siap ngancurin panen."
)

# 7 exact cues strictly following the user's editorial script and factual boundaries!
CUES = [
    (
        1,
        "hook_payday",
        "Mekari bermasalah saat periode gajian. Sebenarnya, apa yang terjadi?",
        [
            ("Mekari bermasalah", "Mekari bermasalah", True),
            ("saat periode gajian.", "saat periode gajian", False),
            ("Sebenarnya, apa yang terjadi?", "Sebenarnya apa yang terjadi", True),
        ],
    ),
    (
        2,
        "timeline_news",
        "Pada dua puluh lima November, pengguna melaporkan kesulitan mengakses layanan. Media juga memberitakan gangguan pencairan gaji.",
        [
            ("Pada 25 November,", "Pada dua puluh lima November", True),
            ("pengguna kesulitan akses layanan.", "pengguna melaporkan kesulitan mengakses layanan", False),
            ("Media memberitakan", "Media juga memberitakan", False),
            ("gangguan pencairan gaji.", "gangguan pencairan gaji", True),
        ],
    ),
    (
        3,
        "official_notice",
        "Dalam pembaruan resmi keesokan paginya, Mekari menyebut aktivitas tidak wajar yang diduga sebagai upaya serangan siber.",
        [
            ("Pembaruan resmi keesokan paginya:", "Dalam pembaruan resmi keesokan paginya", False),
            ("Mekari menyebut aktivitas tidak wajar", "Mekari menyebut aktivitas tidak wajar", False),
            ("diduga upaya serangan siber.", "yang diduga sebagai upaya serangan siber", True),
        ],
    ),
    (
        4,
        "isolation_gate",
        "Sistem dinonaktifkan untuk mencegah pergerakan data. Jadi, layanan yang berhenti juga bagian dari langkah penanganan.",
        [
            ("Sistem dinonaktifkan", "Sistem dinonaktifkan", True),
            ("untuk mencegah pergerakan data.", "untuk mencegah pergerakan data", False),
            ("Layanan berhenti juga bagian", "Jadi layanan yang berhenti juga bagian", False),
            ("dari langkah penanganan.", "dari langkah penanganan", False),
        ],
    ),
    (
        5,
        "new_infra",
        "Mekari membangun infrastruktur baru, terpisah dari sistem lama. Targetnya siap dalam dua puluh empat jam, lalu layanan dipulihkan bertahap setelah verifikasi keamanan.",
        [
            ("Mekari bangun infrastruktur baru,", "Mekari membangun infrastruktur baru", True),
            ("terpisah dari sistem lama.", "terpisah dari sistem lama", False),
            ("Target siap 24 jam,", "Targetnya siap dalam dua puluh empat jam", True),
            ("dipulihkan bertahap setelah verifikasi.", "lalu layanan dipulihkan bertahap setelah verifikasi keamanan", False),
        ],
    ),
    (
        6,
        "data_check",
        "Apakah data bocor? Pengumuman resmi yang kami baca belum memastikan ada atau tidaknya kebocoran.",
        [
            ("Apakah data bocor?", "Apakah data bocor", True),
            ("Pengumuman resmi belum memastikan", "Pengumuman resmi yang kami baca belum memastikan", False),
            ("ada atau tidaknya kebocoran.", "ada atau tidaknya kebocoran", True),
        ],
    ),
    (
        7,
        "safety_outro",
        "Untuk bantuan, gunakan kanal resmi. Jangan berikan kata sandi, kode O T P, atau data penggajian lewat pesan yang mengatasnamakan Mekari.",
        [
            ("Untuk bantuan, gunakan kanal resmi.", "Untuk bantuan gunakan kanal resmi", False),
            ("Jangan berikan kata sandi,", "Jangan berikan kata sandi", True),
            ("kode OTP, atau data penggajian", "kode O T P atau data penggajian", True),
            ("lewat pesan mengatasnamakan Mekari.", "lewat pesan yang mengatasnamakan Mekari", False),
        ],
    ),
]


def trim_and_tighten(wav: np.ndarray, sr: int, max_gap_s: float = 0.16, thresh: float = 0.012) -> np.ndarray:
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
    return (out / peak * 0.88).astype(np.float32)


def resample_and_tempo(in_wav: str, out_wav: str, tempo: float = 1.07):
    env = os.environ.copy()
    env["DYLD_LIBRARY_PATH"] = COMPOSITOR_DIR
    filters = [f"atempo={tempo:.3f}", "loudnorm=I=-16:TP=-1.5:LRA=8"]
    subprocess.run(
        [FFMPEG, "-y", "-i", in_wav, "-af", ",".join(filters), "-ar", str(SR), "-ac", "1", out_wav],
        env=env,
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def make_ambient_bed(total_samples: int, sr: int) -> np.ndarray:
    t = np.arange(total_samples, dtype=np.float64) / sr
    pad = (
        0.42 * np.sin(2 * math.pi * 73.42 * t)
        + 0.28 * np.sin(2 * math.pi * 110.0 * t + 0.4)
        + 0.16 * np.sin(2 * math.pi * 174.61 * t + 1.1)
        + 0.09 * np.sin(2 * math.pi * 220.0 * t + 2.0)
    )
    lfo = 0.72 + 0.28 * np.sin(2 * math.pi * 0.14 * t)
    beat_phase = (t * (112.0 / 60.0)) % 1.0
    pulse = np.exp(-beat_phase * 9.5) * np.sin(2 * math.pi * 146.83 * t) * 0.20
    bed = pad * lfo * 0.55 + pulse
    b, a = signal.butter(3, 620.0 / (sr * 0.5), btype="low")
    bed = signal.lfilter(b, a, bed).astype(np.float32)
    fi = int(sr * 0.8)
    fo = int(sr * 1.4)
    if total_samples > fi + fo:
        bed[:fi] *= np.linspace(0.0, 1.0, fi)
        bed[-fo:] *= np.linspace(1.0, 0.0, fo)
    return (bed * 0.085).astype(np.float32)


def make_whoosh(sr: int, dur: float = 0.26, pitch_start: float = 340.0, pitch_end: float = 110.0) -> np.ndarray:
    n = int(sr * dur)
    t = np.linspace(0, dur, n, dtype=np.float32)
    rng = np.random.default_rng(42)
    noise = rng.normal(0, 1, n).astype(np.float32)
    b, a = signal.butter(2, [220.0 / (sr * 0.5), 1800.0 / (sr * 0.5)], btype="band")
    filt = signal.lfilter(b, a, noise).astype(np.float32)
    env = np.maximum(0.0, np.sin(np.pi * (t / dur))) ** 1.6
    tone = np.sin(2 * np.pi * np.linspace(pitch_start, pitch_end, n) * t) * 0.35
    out = (filt * 0.55 + tone) * env
    return (out / (np.max(np.abs(out)) + 1e-9) * 0.16).astype(np.float32)


def make_gate_thump(sr: int) -> np.ndarray:
    dur = 0.28
    n = int(sr * dur)
    t = np.linspace(0, dur, n, dtype=np.float32)
    freq = 120.0 * np.exp(-t * 9.0) + 42.0
    phase = 2 * np.pi * np.cumsum(freq) / sr
    out = np.sin(phase) * np.exp(-t * 11.0)
    return (out * 0.26).astype(np.float32)


def fmt_srt_ts(sec: float) -> str:
    ms = int(round(max(0.0, sec) * 1000))
    h = ms // 3600000
    ms %= 3600000
    m = ms // 60000
    ms %= 60000
    s = ms // 1000
    ms %= 1000
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def main():
    print(f"Loading {MODEL_ID} with consistent native Indonesian ref...", flush=True)
    model = load_model(MODEL_ID)
    model_sr = model.sample_rate
    ref_audio = load_audio(REF_AUDIO_PATH, sample_rate=model_sr)

    cue_wavs = []
    cue_meta = []

    for cid, key, spoken, chunks in CUES:
        raw_path = os.path.join(CLIP_DIR, f"cue_{cid:02d}_{key}_raw.wav")
        proc_path = os.path.join(CLIP_DIR, f"cue_{cid:02d}_{key}.wav")

        if not os.path.exists(raw_path):
            print(f"  [Cue {cid}/7] Generating: {spoken}", flush=True)
            res = list(
                model.generate(
                    text=spoken,
                    ref_audio=ref_audio,
                    ref_text=REF_TEXT,
                    lang_code="Indonesian",
                    temperature=0.82,
                    top_p=0.92,
                    max_tokens=320,
                )
            )
            wav = np.concatenate([np.array(r.audio, dtype=np.float32) for r in res], axis=0)
            wav = trim_and_tighten(wav, model_sr, max_gap_s=0.14)
            sf.write(raw_path, wav, model_sr)
        else:
            print(f"  [Cue {cid}/7] Using cached {os.path.basename(raw_path)}", flush=True)

        resample_and_tempo(raw_path, proc_path, tempo=1.06)
        w48, _ = sf.read(proc_path, dtype="float32")
        if w48.ndim > 1:
            w48 = w48.mean(axis=-1)
        dur_s = len(w48) / SR
        print(f"    -> processed duration: {dur_s:.2f}s", flush=True)
        cue_wavs.append(w48)
        cue_meta.append((cid, key, spoken, chunks, dur_s))

    lead_s = 0.35
    gap_s = 0.32
    outro_tail_s = 2.80

    cursor = lead_s
    scenes = []
    subtitles = []

    for idx, (cid, key, spoken, chunks, dur_s) in enumerate(cue_meta):
        vo_start = cursor
        vo_end = cursor + dur_s
        scene_start = 0.0 if idx == 0 else vo_start - (gap_s * 0.5)
        scene_end = (vo_end + outro_tail_s) if idx == len(cue_meta) - 1 else (vo_end + gap_s * 0.5)

        scenes.append({
            "id": cid,
            "key": key,
            "sceneStartSec": round(scene_start, 3),
            "sceneEndSec": round(scene_end, 3),
            "sceneStartFrame": int(round(scene_start * FPS)),
            "sceneEndFrame": int(round(scene_end * FPS)),
            "voStartSec": round(vo_start, 3),
            "voEndSec": round(vo_end, 3),
            "spoken": spoken,
        })

        weights = [max(4, len(wtxt.replace(" ", ""))) for _, wtxt, _ in chunks]
        tot_w = sum(weights)
        sub_c = vo_start
        for c_i, (disp, _, accent) in enumerate(chunks):
            cdur = (weights[c_i] / tot_w) * dur_s
            subtitles.append({
                "startSec": round(sub_c, 3),
                "endSec": round(sub_c + cdur, 3),
                "text": disp,
                "accent": accent,
            })
            sub_c += cdur

        cursor = vo_end + gap_s

    total_sec = scenes[-1]["sceneEndSec"]
    total_frames = int(math.ceil(total_sec * FPS))
    total_samples = int(math.ceil(total_sec * SR))

    print(f"\nTotal assembled duration: {total_sec:.2f}s ({total_frames} frames @ {FPS}fps)", flush=True)

    voice_bus = np.zeros(total_samples, dtype=np.float32)
    for sc, w48 in zip(scenes, cue_wavs):
        s_idx = int(round(sc["voStartSec"] * SR))
        e_idx = min(total_samples, s_idx + len(w48))
        voice_bus[s_idx:e_idx] += w48[: e_idx - s_idx]

    bed_bus = make_ambient_bed(total_samples, SR)
    sfx_bus = np.zeros(total_samples, dtype=np.float32)
    whoosh = make_whoosh(SR)
    thump = make_gate_thump(SR)

    for sc in scenes[1:]:
        cut_idx = max(0, int(round((sc["sceneStartSec"] - 0.06) * SR)))
        snd = thump if sc["id"] in (4, 7) else whoosh
        e_idx = min(total_samples, cut_idx + len(snd))
        sfx_bus[cut_idx:e_idx] += snd[: e_idx - cut_idx]

    vo_env = np.abs(voice_bus)
    win = int(SR * 0.08)
    vo_env = np.convolve(vo_env, np.ones(win, dtype=np.float32) / win, mode="same")
    duck = np.clip(1.0 - vo_env * 3.2, 0.38, 1.0)

    mix_l = voice_bus * 0.95 + bed_bus * duck + sfx_bus * 0.90
    mix_r = voice_bus * 0.95 + bed_bus * duck * 0.98 + sfx_bus * 0.95
    stereo = np.stack([mix_l, mix_r], axis=-1)
    assert not np.isnan(stereo).any(), "NaN detected in audio mix!"
    peak = np.max(np.abs(stereo)) + 1e-9
    if peak > 0.94:
        stereo = stereo / peak * 0.94

    raw_master = os.path.join(OUT_DIR, "mekari_master_raw.wav")
    final_master = os.path.join(OUT_DIR, "mekari_audio_master.wav")
    sf.write(raw_master, stereo, SR, subtype="PCM_16")

    env = os.environ.copy()
    env["DYLD_LIBRARY_PATH"] = COMPOSITOR_DIR
    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-i",
            raw_master,
            "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=9",
            "-ar",
            str(SR),
            "-ac",
            "2",
            final_master,
        ],
        env=env,
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    pub_audio = os.path.join(PROJECT_ROOT, "public", "mekari_audio_master.wav")
    subprocess.run(["cp", final_master, pub_audio], check=True)

    timings = {
        "fps": FPS,
        "totalSec": round(total_sec, 3),
        "totalFrames": total_frames,
        "outroStartSec": round(scenes[-1]["voEndSec"] + 0.15, 3),
        "scenes": scenes,
        "subtitles": subtitles,
    }
    os.makedirs(os.path.join(PROJECT_ROOT, "src", "videos", "mekari"), exist_ok=True)
    for p in (
        os.path.join(OUT_DIR, "mekari_timings.json"),
        os.path.join(PROJECT_ROOT, "src", "videos", "mekari", "timings.json"),
    ):
        with open(p, "w", encoding="utf-8") as f:
            json.dump(timings, f, indent=2, ensure_ascii=False)

    srt_lines = []
    for i, sub in enumerate(subtitles, 1):
        srt_lines.append(f"{i}\n{fmt_srt_ts(sub['startSec'])} --> {fmt_srt_ts(sub['endSec'])}\n{sub['text']}\n")
    srt_path = os.path.join(OUT_DIR, "mekari_subtitles.srt")
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(srt_lines))

    print(f"DONE! Master WAV -> {final_master}", flush=True)
    print(f"      Timings    -> {os.path.join(OUT_DIR, 'mekari_timings.json')}", flush=True)
    print(f"      SRT        -> {srt_path}", flush=True)


if __name__ == "__main__":
    main()
