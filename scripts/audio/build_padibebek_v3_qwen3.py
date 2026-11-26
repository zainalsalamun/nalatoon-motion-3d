import json
import math
import os
import re
import subprocess
import sys
import wave
import numpy as np
import soundfile as sf
from scipy import signal

from mlx_audio.tts.utils import load_model
from mlx_audio.tts.generate import generate_audio

STUDIO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(STUDIO, "out", "padibebek")
CLIP_DIR = os.path.join(OUT_DIR, "v3_qwen3_clips")
BRAIN_DIR = os.environ.get("PREVIEW_OUT_DIR", OUT_DIR)
os.makedirs(CLIP_DIR, exist_ok=True)

FFMPEG = os.path.join(STUDIO, "node_modules/@remotion/compositor-darwin-arm64/ffmpeg")
DYLD_DIR = os.path.join(STUDIO, "node_modules/@remotion/compositor-darwin-arm64")

REF_AUDIO = os.environ.get("MLX_REF_AUDIO", os.path.join(STUDIO, "assets", "brand", "voice_ref.wav"))
REF_TEXT_PATH = os.environ.get("MLX_REF_TEXT", os.path.join(STUDIO, "assets", "brand", "voice_ref.txt"))
REF_TEXT = open(REF_TEXT_PATH, "r", encoding="utf-8").read().strip() if os.path.exists(REF_TEXT_PATH) else ""
MODEL_ID = "mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit"

SR = 48000
FPS = 30

SHOTS_SCRIPT = [
    (1, "day",
     "Loh, padi baru ditanam, kok malah dilepasi ratusan bebek?!",
     [("Loh, padi baru ditanam,", "Loh padi baru ditanam", False),
      ("kok malah dilepasi", "kok malah dilepasi", True),
      ("ratusan bebek?!", "ratusan bebek", True)]),
    (2, "day",
     "Tetangganya langsung panik. Waduh Bud, padimu bisa habis dimakan bebek!",
     [("Tetangganya langsung panik:", "Tetangganya langsung panik", False),
      ("\"Waduh Bud, padimu bisa", "Waduh Bud padimu bisa", True),
      ("habis dimakan bebek!\"", "habis dimakan bebek", True)]),
    (3, "day",
     "Tapi Pak Budi malah santai ngopi di saung. Kok bisa tenang banget?",
     [("Tapi Pak Budi malah", "Tapi Pak Budi malah", False),
      ("santai ngopi di saung.", "santai ngopi di saung", True),
      ("Kok bisa tenang banget?", "Kok bisa tenang banget", True)]),
    (4, "day",
     "Di sawah sebelah, tetangganya harus capek-capek semprot pestisida mahal.",
     [("Di sawah sebelah,", "Di sawah sebelah", False),
      ("tetangganya capek semprot", "tetangganya harus capek-capek semprot", False),
      ("pestisida mahal", "pestisida mahal", True)]),
    (5, "day",
     "Sementara di sawah Pak Budi, pasukan bebek ini justru kerja setiap hari.",
     [("Sementara di sawah Pak Budi,", "Sementara di sawah Pak Budi", False),
      ("pasukan bebek ini justru", "pasukan bebek ini justru", True),
      ("kerja setiap hari", "kerja setiap hari", False)]),
    (6, "day",
     "Bebek nggak doyan daun padi yang keras. Mereka justru melahap habis keong mas dan hama!",
     [("Bebek nggak doyan", "Bebek nggak doyan", False),
      ("daun padi yang keras.", "daun padi yang keras", False),
      ("Mereka justru melahap habis", "Mereka justru melahap habis", False),
      ("keong mas dan hama!", "keong mas dan hama", True)]),
    (7, "day",
     "Kaki bebek terus mengaduk air jadi keruh, bikin rumput liar gagal tumbuh.",
     [("Kaki bebek terus", "Kaki bebek terus", False),
      ("mengaduk air jadi keruh,", "mengaduk air jadi keruh", True),
      ("bikin rumput liar", "bikin rumput liar", False),
      ("gagal tumbuh", "gagal tumbuh", True)]),
    (8, "day",
     "Plus, kotoran bebeknya otomatis jadi pupuk organik gratis buat akar padi.",
     [("Plus, kotoran bebeknya", "Plus kotoran bebeknya", False),
      ("otomatis jadi pupuk organik", "otomatis jadi pupuk organik", True),
      ("gratis buat akar padi", "gratis buat akar padi", True)]),
    (9, "day",
     "Hasilnya? Tanpa pestisida sedikit pun, sawah Pak Budi jauh lebih hijau dan lebat!",
     [("Hasilnya? Tanpa pestisida", "Hasilnya Tanpa pestisida", True),
      ("sedikit pun,", "sedikit pun", False),
      ("sawah Pak Budi jauh lebih", "sawah Pak Budi jauh lebih", False),
      ("hijau dan lebat!", "hijau dan lebat", True)]),
    (10, "golden",
     "Eits, ada satu syarat penting. Begitu padi mulai berbunga, bebek wajib ditarik pulang.",
     [("Eits, ada satu syarat penting:", "Eits ada satu syarat penting", True),
      ("Begitu padi mulai berbunga,", "Begitu padi mulai berbunga", False),
      ("bebek wajib ditarik pulang", "bebek wajib ditarik pulang", True)]),
    (11, "golden",
     "Kalau telat sedikit saja, justru gabah padinya yang ludes jadi camilan bebek!",
     [("Kalau telat sedikit saja,", "Kalau telat sedikit saja", False),
      ("justru gabah padinya", "justru gabah padinya yang ludes", True),
      ("ludes jadi camilan bebek!", "jadi camilan bebek", True)]),
    (12, "golden",
     "Metode cerdas ini disebut sistem Padi-Bebek atau Aigamo, hemat biaya sekaligus ramah alam.",
     [("Metode cerdas ini disebut", "Metode cerdas ini disebut", False),
      ("sistem Padi-Bebek (Aigamo),", "sistem Padi-Bebek atau Aigamo", True),
      ("hemat biaya sekaligus", "hemat biaya sekaligus", False),
      ("ramah alam", "ramah alam", True)]),
    (13, "golden",
     "Saat panen tiba, Pak Budi untung dobel: beras organik mahal, plus telur dan bebek gemuk!",
     [("Saat panen tiba,", "Saat panen tiba", False),
      ("Pak Budi untung dobel:", "Pak Budi untung dobel", True),
      ("beras organik mahal,", "beras organik mahal", False),
      ("plus telur & bebek gemuk!", "plus telur dan bebek gemuk", True)]),
    (14, "golden",
     "Tetangganya yang dulu mengejek cuma bisa melongo lihat panennya melimpah.",
     [("Tetangganya yang dulu mengejek", "Tetangganya yang dulu mengejek", False),
      ("cuma bisa melongo", "cuma bisa melongo", True),
      ("lihat panennya melimpah", "lihat panennya melimpah", True)]),
    (15, "day",
     "Musim tanam berikutnya, alat semprot pestisidanya langsung pensiun!",
     [("Musim tanam berikutnya,", "Musim tanam berikutnya", False),
      ("alat semprot pestisidanya", "alat semprot pestisidanya", False),
      ("langsung pensiun!", "langsung pensiun", True)]),
    (16, "day",
     "Sekarang gantian dia yang sibuk ngejar bebek! Di daerahmu, cara ini sudah ada belum?",
     [("Sekarang gantian dia yang", "Sekarang gantian dia yang", False),
      ("sibuk ngejar bebek!", "sibuk ngejar bebek", True),
      ("Di daerahmu sudah ada belum?", "Di daerahmu cara ini sudah ada belum", True)]),
]


def trim_silence(x: np.ndarray, sr: int) -> np.ndarray:
    idx = np.where(np.abs(x) > 0.010)[0]
    if len(idx) == 0:
        return x
    return x[max(0, idx[0] - int(0.02 * sr)):min(len(x), idx[-1] + int(0.035 * sr))]


def broadcast_clean(x: np.ndarray, sr: int) -> np.ndarray:
    sos_hp = signal.butter(3, 75, btype="highpass", fs=sr, output="sos")
    x = signal.sosfilt(sos_hp, x.astype(np.float64))
    rms = float(np.sqrt(np.mean(x * x)) + 1e-9)
    return np.tanh(x * (0.21 / rms) * 1.02) * 0.90


def spoken_weight(text: str, disp: str) -> float:
    vowels = len(re.findall(r"[aiueoAIUEO]+", text))
    chars = len(re.sub(r"\s+", "", text))
    pause = 1.4 if disp.endswith((",", ":")) else (2.0 if disp.endswith((".", "?", "!")) else 0.0)
    return max(1.0, vowels * 1.15 + chars * 0.12 + pause)


def snap_valley(audio: np.ndarray, t_est: float, t_lo: float, t_hi: float) -> float:
    lo = max(t_lo + 0.05, t_est - 0.12)
    hi = min(t_hi - 0.05, t_est + 0.12)
    if hi <= lo:
        return t_est
    win = int(0.02 * SR)
    step = int(0.005 * SR)
    best_t, best_e = t_est, 1e9
    for idx in range(int(lo * SR), max(int(lo * SR) + 1, int(hi * SR) - win), step):
        seg = audio[idx:idx + win]
        e = float(np.sqrt(np.mean(seg * seg)))
        t_cur = (idx + win * 0.5) / SR
        sc = e + 0.02 * abs(t_cur - t_est)
        if sc < best_e:
            best_e, best_t = sc, t_cur
    return best_t


def fmt_srt(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


sys.path.insert(0, STUDIO)
from build_padibebek_v3_audio import synth_rural_score


def main():
    with open(os.path.join(OUT_DIR, "v3_shots_timing.json"), "r", encoding="utf-8") as f:
        orig_timing = json.load(f)
    orig_map = {s["id"]: s for s in orig_timing["shots"]}

    print(f"=== Loading Qwen3-TTS MLX ONCE on Apple Silicon Metal GPU ({MODEL_ID}) ===")
    model = load_model(MODEL_ID)

    shot_audios = []
    env = os.environ.copy()
    env["DYLD_LIBRARY_PATH"] = DYLD_DIR

    for sid, light, text, chunks in SHOTS_SCRIPT:
        prefix = f"q3_s{sid:02d}"
        # Remove old output if any
        for fn in os.listdir(CLIP_DIR):
            if fn.startswith(prefix):
                os.remove(os.path.join(CLIP_DIR, fn))

        generate_audio(
            text=text,
            model=model,
            ref_audio=REF_AUDIO,
            ref_text=REF_TEXT,
            lang_code="Indonesian",
            output_path=CLIP_DIR,
            file_prefix=prefix,
            join_audio=True,
            verbose=False,
        )
        # Find generated wav
        cands = sorted(f for f in os.listdir(CLIP_DIR) if f.startswith(prefix) and f.endswith(".wav"))
        raw_p = os.path.join(CLIP_DIR, cands[0])
        y24, sr_in = sf.read(raw_p)
        if y24.ndim > 1:
            y24 = y24.mean(axis=1)
        g = math.gcd(SR, sr_in)
        y48 = signal.resample_poly(y24.astype(np.float64), SR // g, sr_in // g)
        seg = trim_silence(y48, SR)
        seg = broadcast_clean(seg, SR)

        # Gentle pitch-preserved fit ONLY if clip is longer than rendered 3D Diorama v3 raw shot!
        orig_dur = (orig_map[sid]["b"] - orig_map[sid]["a"]) / FPS
        max_speech = orig_dur - 0.16
        if len(seg) / SR > max_speech:
            ratio = min(1.25, (len(seg) / SR) / max_speech + 0.02)
            p_in = os.path.join(CLIP_DIR, f"{prefix}_fit_in.wav")
            p_out = os.path.join(CLIP_DIR, f"{prefix}_fit_out.wav")
            sf.write(p_in, seg, SR, subtype="PCM_16")
            subprocess.run([
                FFMPEG, "-y", "-i", p_in, "-filter:a", f"atempo={ratio:.3f}",
                "-ar", str(SR), "-ac", "1", "-c:a", "pcm_s16le", p_out
            ], env=env, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            seg, _ = sf.read(p_out)
            seg = seg.astype(np.float64)

        fade = min(int(0.008 * SR), len(seg) // 4)
        if fade > 0:
            r = np.linspace(0.0, 1.0, fade)
            seg[:fade] *= r
            seg[-fade:] *= r[::-1]

        shot_audios.append((sid, light, seg, chunks))
        print(f"  Qwen3 Shot {sid:02d}: dur={len(seg)/SR:.2f}s (available 3D raw={orig_dur:.2f}s)")

    print("=== Building Audio-First 16-Shot Frame-Accurate Timeline ===")
    cur_f = 0
    new_timings = []
    shot_starts_s = {}
    placed = []
    for idx, (sid, light, seg, chunks) in enumerate(shot_audios):
        a_f = cur_f
        sp_start_f = cur_f + (3 if idx == 0 else 2)
        sp_frames = int(math.ceil((len(seg) / SR) * FPS))
        gap_end = 7 if idx == len(shot_audios) - 1 else 4
        b_f = sp_start_f + sp_frames + gap_end
        orig_len = orig_map[sid]["b"] - orig_map[sid]["a"]
        if (b_f - a_f) > orig_len:
            b_f = a_f + orig_len
        new_timings.append({
            "id": sid, "a": a_f, "b": b_f, "light": light,
            "orig_a": orig_map[sid]["a"], "orig_b": orig_map[sid]["b"],
            "dur_s": round((b_f - a_f) / FPS, 3),
        })
        shot_starts_s[sid] = a_f / FPS
        placed.append((sid, sp_start_f / FPS, b_f / FPS, seg, chunks))
        cur_f = b_f

    total_frames = cur_f
    total_dur = total_frames / FPS
    total_samples = int(round(total_dur * SR))
    print(f"TOTAL QWEN3 TIMELINE: {total_frames} frames = {total_dur:.2f}s exact @ 30fps!")

    vo = np.zeros(total_samples, dtype=np.float64)
    speech_mask = np.zeros(total_samples, dtype=np.float64)
    sub_cues = []

    for sid, t0, t_shot_end, seg, chunks in placed:
        i0 = int(round(t0 * SR))
        n = min(len(seg), int(round((t_shot_end - t0 - 0.02) * SR)), total_samples - i0)
        vo[i0:i0 + n] += seg[:n]
        speech_mask[i0:i0 + n] = 1.0

        dur = n / SR
        weights = [spoken_weight(sp, disp) for disp, sp, _ in chunks]
        total_w = sum(weights)
        bounds = [t0]
        cum = 0.0
        t1 = t0 + dur
        for j in range(len(chunks) - 1):
            cum += weights[j]
            est = t0 + dur * (cum / total_w)
            bounds.append(snap_valley(vo, est, bounds[-1] + 0.14, t1 - 0.14))
        bounds.append(min(total_dur - 0.03, t1 + 0.06))

        for j, (disp, _, accent) in enumerate(chunks):
            sub_cues.append({
                "text": disp,
                "s": round(bounds[j], 3),
                "e": round(bounds[j + 1], 3),
                "accent": accent,
            })

    for i in range(len(sub_cues) - 1):
        if sub_cues[i]["e"] > sub_cues[i + 1]["s"]:
            sub_cues[i]["e"] = round(sub_cues[i + 1]["s"] - 0.01, 3)

    v_peak = np.max(np.abs(vo)) + 1e-9
    vo_norm = vo * (0.86 / v_peak)
    solo_preview = os.path.join(BRAIN_DIR, "padibebek_v3_voice_qwen3_studio.wav")
    sf.write(solo_preview, vo_norm, SR, subtype="PCM_16")
    print(f"Saved Solo Qwen3 Studio Cloned Voice -> {solo_preview}")

    vo_stereo = np.stack([vo_norm, vo_norm], axis=1)
    music_stereo = synth_rural_score(total_samples, shot_starts_s, speech_mask)
    mix = np.tanh((vo_stereo + music_stereo * 0.78) * 0.96) * 0.95

    micro = int(0.035 * SR)
    mix[:micro] *= np.linspace(0.0, 1.0, micro)[:, None]
    mix[-micro:] *= np.linspace(1.0, 0.0, micro)[:, None]

    out_wav = os.path.join(OUT_DIR, "v3_qwen3_audio_master.wav")
    pcm = np.clip(np.round(mix * 32767.0), -32768, 32767).astype(np.int16)
    with wave.open(out_wav, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())

    with open(os.path.join(OUT_DIR, "v3_qwen3_shots_timing.json"), "w", encoding="utf-8") as f:
        json.dump({"total_frames": total_frames, "total_dur": round(total_dur, 3), "shots": new_timings}, f, indent=2)

    with open(os.path.join(OUT_DIR, "v3_qwen3_subtitles.json"), "w", encoding="utf-8") as f:
        json.dump(sub_cues, f, indent=2, ensure_ascii=False)

    with open(os.path.join(OUT_DIR, "v3_qwen3_subtitles.srt"), "w", encoding="utf-8") as f:
        f.write("\n".join(f"{i}\n{fmt_srt(c['s'])} --> {fmt_srt(c['e'])}\n{c['text']}\n" for i, c in enumerate(sub_cues, 1)))

    print(f"SUCCESS QWEN3 STUDIO MIX -> {out_wav} ({total_dur:.2f}s / {total_frames} frames) + {len(sub_cues)} cues!")


if __name__ == "__main__":
    main()
