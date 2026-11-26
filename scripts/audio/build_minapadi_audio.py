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
OUT_DIR = os.path.join(STUDIO, "out", "minapadi")
CLIP_DIR = os.path.join(OUT_DIR, "qwen3_clips")
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
TEMPO = 1.18  # Pitch-preserved snappy viral Shorts pacing (~64-70s total, ZERO clipped syllables!)

SHOTS_SCRIPT = [
    (1, "day",
     "Loh, sawah baru ditanam padi, kok malah dilepasi ratusan ikan mas?!",
     [("Loh, sawah baru ditanam,", "Loh sawah baru ditanam padi", False),
      ("kok malah dilepasi", "kok malah dilepasi", True),
      ("ratusan ikan mas?!", "ratusan ikan mas", True)]),
    (2, "day",
     "Pak Darto langsung kaget lagi. Waduh Bud, kemarin bebek, sekarang sawahmu jadi kolam ikan?!",
     [("Pak Darto langsung kaget:", "Pak Darto langsung kaget lagi", False),
      ("\"Waduh Bud, kemarin bebek,", "Waduh Bud kemarin bebek", True),
      ("sekarang jadi kolam ikan?!\"", "sekarang sawahmu jadi kolam ikan", True)]),
    (3, "day",
     "Bedanya, Pak Budi sengaja menggali parit dalam di pinggir sawah supaya ikan tetap aman berenang.",
     [("Pak Budi sengaja menggali", "Bedanya Pak Budi sengaja menggali", False),
      ("parit dalam di pinggir sawah", "parit dalam di pinggir sawah", True),
      ("biar ikan aman berenang", "supaya ikan tetap aman berenang", False)]),
    (4, "day",
     "Di sawah sebelah, tetangganya sibuk membasmi jentik nyamuk, wereng, dan hama secara manual.",
     [("Di sawah sebelah,", "Di sawah sebelah", False),
      ("tetangganya sibuk membasmi", "tetangganya sibuk membasmi", False),
      ("nyamuk & hama manual", "jentik nyamuk wereng dan hama secara manual", True)]),
    (5, "day",
     "Sementara di sawah Pak Budi, ratusan ikan mas justru patroli gratis dari pagi sampai malam.",
     [("Di sawah Pak Budi,", "Sementara di sawah Pak Budi", False),
      ("ratusan ikan mas patroli", "ratusan ikan mas justru patroli gratis", True),
      ("dari pagi sampai malam", "dari pagi sampai malam", False)]),
    (6, "day",
     "Ikan mas melahap habis wereng, jentik nyamuk, dan telur keong sebelum merusak batang padi.",
     [("Ikan mas melahap habis", "Ikan mas melahap habis", False),
      ("wereng & jentik nyamuk", "wereng jentik nyamuk dan telur keong", True),
      ("sebelum merusak padi", "sebelum merusak batang padi", False)]),
    (7, "day",
     "Gerakan sirip mereka terus mengaduk lumpur, bikin air kaya oksigen dan akar padi bernapas lega.",
     [("Sirip mereka mengaduk lumpur,", "Gerakan sirip mereka terus mengaduk lumpur", False),
      ("air jadi kaya oksigen,", "bikin air kaya oksigen", True),
      ("akar padi bernapas lega", "dan akar padi bernapas lega", True)]),
    (8, "day",
     "Ditambah lagi, kotoran ikan otomatis jadi pupuk alami super subur tanpa beli kimia mahal.",
     [("Ditambah kotoran ikannya", "Ditambah lagi kotoran ikan", False),
      ("jadi pupuk alami subur", "otomatis jadi pupuk alami super subur", True),
      ("tanpa beli kimia mahal", "tanpa beli kimia mahal", False)]),
    (9, "day",
     "Hasilnya? Batang padi Pak Budi tumbuh jauh lebih kokoh, hijau, dan bulirnya lebih padat!",
     [("Hasilnya? Padi Pak Budi", "Hasilnya Batang padi Pak Budi", True),
      ("tumbuh jauh lebih kokoh,", "tumbuh jauh lebih kokoh hijau", False),
      ("dan bulirnya lebih padat!", "dan bulirnya lebih padat", True)]),
    (10, "golden",
     "Hebatnya lagi, saat air sawah dikeringkan jelang panen, ikan otomatis berkumpul ke parit pinggir.",
     [("Saat air sawah dikeringkan", "Hebatnya lagi saat air sawah dikeringkan", False),
      ("jelang panen,", "jelang panen", False),
      ("ikan kumpul ke parit pinggir", "ikan otomatis berkumpul ke parit pinggir", True)]),
    (11, "golden",
     "Jadi Pak Budi nggak perlu capek mengejar ikan satu-satu di tengah lumpur sawah!",
     [("Jadi Pak Budi nggak perlu", "Jadi Pak Budi nggak perlu", False),
      ("capek mengejar ikan", "capek mengejar ikan satu-satu", True),
      ("di tengah lumpur sawah!", "di tengah lumpur sawah", False)]),
    (12, "golden",
     "Warisan cerdas petani Indonesia ini disebut sistem Mina Padi, diakui dunia karena ramah lingkungan.",
     [("Warisan petani Indonesia:", "Warisan cerdas petani Indonesia ini", False),
      ("Sistem Mina Padi,", "disebut sistem Mina Padi", True),
      ("diakui dunia ramah alam", "diakui dunia karena ramah lingkungan", True)]),
    (13, "golden",
     "Begitu musim panen tiba, Pak Budi panen dobel: beras organik premium plus ratusan kilo ikan segar!",
     [("Saat panen tiba,", "Begitu musim panen tiba", False),
      ("Pak Budi panen dobel:", "Pak Budi panen dobel", True),
      ("beras organik premium", "beras organik premium", False),
      ("plus ratusan kilo ikan!", "plus ratusan kilo ikan segar", True)]),
    (14, "golden",
     "Pak Darto yang tadi melongo, langsung pulang mengambil ember dan pancingan!",
     [("Pak Darto yang melongo,", "Pak Darto yang tadi melongo", False),
      ("langsung pulang ambil", "langsung pulang mengambil", True),
      ("ember dan pancingan!", "ember dan pancingan", True)]),
    (15, "day",
     "Musim berikutnya, sawah sebelah pun ikut digali parit penuh air jernih.",
     [("Musim berikutnya,", "Musim berikutnya", False),
      ("sawah sebelah ikut digali", "sawah sebelah pun ikut digali", False),
      ("parit penuh air jernih", "parit penuh air jernih", True)]),
    (16, "day",
     "Sekarang dua-duanya panen beras sekaligus ikan! Di daerahmu, sistem Mina Padi ini masih ada nggak?",
     [("Sekarang dua-duanya panen", "Sekarang dua-duanya panen", False),
      ("beras sekaligus ikan!", "beras sekaligus ikan", True),
      ("Di daerahmu masih ada nggak?", "Di daerahmu sistem Mina Padi ini masih ada nggak", True)]),
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


def apply_atempo(x: np.ndarray, sr: int, tempo: float, tag: str) -> np.ndarray:
    p_in = os.path.join(CLIP_DIR, f"{tag}_in.wav")
    p_out = os.path.join(CLIP_DIR, f"{tag}_out.wav")
    sf.write(p_in, x, sr, subtype="PCM_16")
    env = os.environ.copy()
    env["DYLD_LIBRARY_PATH"] = DYLD_DIR
    subprocess.run([
        FFMPEG, "-y", "-i", p_in, "-filter:a", f"atempo={tempo:.3f}",
        "-ar", str(sr), "-ac", "1", "-c:a", "pcm_s16le", p_out
    ], env=env, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    y_out, _ = sf.read(p_out)
    return y_out.astype(np.float64)


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


def synth_minapadi_score(total_samples: int, shot_starts: dict, speech_mask: np.ndarray) -> np.ndarray:
    """Warm Sundanese/Balinese Water-Paddy Acoustic Score + Bubbly Water Splash & Fish Leap SFX!"""
    L = np.zeros(total_samples, dtype=np.float64)
    R = np.zeros(total_samples, dtype=np.float64)
    total_dur = total_samples / SR

    def add_tone(t0: float, dur: float, freq: float, amp: float, pan: float = 0.5, style: str = "kecapi"):
        i0 = int(round(t0 * SR))
        n = int(round(dur * SR))
        if i0 >= total_samples or n <= 0:
            return
        n = min(n, total_samples - i0)
        tt = np.arange(n) / SR
        if style == "kecapi":
            # Shimmering Sundanese plucked zither (Kecapi) + warm ukulele
            env = np.minimum(1.0, tt / 0.005) * np.exp(-tt * 4.4) * np.maximum(0.0, np.minimum(1.0, (dur - tt) / 0.06))
            sig = (
                0.65 * np.sin(2 * np.pi * freq * tt)
                + 0.28 * np.sin(2 * np.pi * freq * 2.0 * tt) * np.exp(-tt * 6.5)
                + 0.12 * np.sin(2 * np.pi * freq * 3.0 * tt) * np.exp(-tt * 10.0)
            ) * env * amp
        elif style == "bass":
            env = np.minimum(1.0, tt / 0.015) * np.exp(-tt * 2.6)
            sig = (0.82 * np.sin(2 * np.pi * freq * tt) + 0.2 * np.sin(2 * np.pi * freq * 2.0 * tt)) * env * amp
        else:  # suling bamboo flute
            env = np.minimum(1.0, tt / 0.11) * np.maximum(0.0, np.minimum(1.0, (dur - tt) / 0.16))
            vib = 1.0 + 0.012 * np.sin(2 * np.pi * 5.2 * tt)
            sig = (np.sin(2 * np.pi * freq * vib * tt) + 0.15 * np.sin(2 * np.pi * freq * 2.0 * tt)) * env * amp
        L[i0:i0 + n] += sig * math.cos(pan * math.pi * 0.5)
        R[i0:i0 + n] += sig * math.sin(pan * math.pi * 0.5)

    def add_splash(t0: float, dur: float = 0.42, amp: float = 0.085, pan: float = 0.5):
        i0 = int(round(t0 * SR))
        n = min(int(round(dur * SR)), total_samples - i0)
        if i0 < 0 or n <= 0:
            return
        rng = np.random.default_rng(303 + int(t0 * 100))
        wn = signal.sosfilt(signal.butter(2, [480, 3400], btype="bandpass", fs=SR, output="sos"), rng.standard_normal(n))
        tt = np.arange(n) / SR
        env = np.minimum(1.0, tt / 0.016) * np.exp(-tt * 5.6)
        sig = wn * env * amp
        L[i0:i0 + n] += sig * math.cos(pan * math.pi * 0.5)
        R[i0:i0 + n] += sig * math.sin(pan * math.pi * 0.5)

    def add_bubble(t0: float, f0: float = 420.0, amp: float = 0.075, pan: float = 0.5):
        """Cute rising water-drop 'bloop!' bubble SFX for swimming fish!"""
        dur = 0.11
        i0 = int(round(t0 * SR))
        n = min(int(round(dur * SR)), total_samples - i0)
        if i0 < 0 or n <= 0:
            return
        tt = np.arange(n) / SR
        f_inst = f0 * (1.0 + 1.45 * (tt / dur) ** 1.4)
        ph = 2 * np.pi * np.cumsum(f_inst) / SR
        env = np.sin(np.linspace(0, np.pi, n)) ** 1.3
        sig = np.sin(ph) * env * amp
        L[i0:i0 + n] += sig * math.cos(pan * math.pi * 0.5)
        R[i0:i0 + n] += sig * math.sin(pan * math.pi * 0.5)

    # Fresh bright D-major / Sundanese pastoral chord loop (D -> Bm -> G -> A)
    chords = [
        (146.83, [293.66, 369.99, 440.00, 587.33]),  # D
        (123.47, [246.94, 293.66, 369.99, 493.88]),  # Bm
        (196.00, [392.00, 493.88, 587.33, 739.99]),  # Gmaj7
        (220.00, [329.63, 440.00, 554.37, 659.25]),  # A
    ]
    step_s = 0.255
    t_cur = 0.0
    step = 0
    while t_cur < total_dur - 0.12:
        bar = (step // 8) % 4
        beat = step % 8
        bass_f, notes = chords[bar]
        if beat == 0:
            add_tone(t_cur, 0.45, bass_f * 0.5, 0.068, 0.5, "bass")
        elif beat == 4:
            add_tone(t_cur, 0.40, bass_f * 0.75, 0.052, 0.5, "bass")
        if beat in (0, 2, 3, 5, 6):
            n_idx = (beat + bar) % len(notes)
            pan = 0.34 if beat % 2 == 0 else 0.66
            add_tone(t_cur, 0.36, notes[n_idx], 0.036, pan, "kecapi")
            if beat in (2, 6):
                add_tone(t_cur, 0.30, notes[(n_idx + 1) % len(notes)], 0.026, 1.0 - pan, "kecapi")
        if (t_cur > shot_starts[13] and beat in (0, 4)) or (shot_starts[5] < t_cur < shot_starts[9] and beat == 0 and bar in (0, 2)):
            add_tone(t_cur + 0.04, 0.90, notes[(bar + 2) % len(notes)] * 2.0, 0.022, 0.58, "suling")
        t_cur += step_s
        step += 1

    # Diegetic Fish & Water SFX synced to exact Mina Padi story beats!
    # Shot 1: Tipping basket of golden carp into flooded paddy!
    add_splash(shot_starts[1] + 0.30, 0.48, 0.095, 0.55)
    add_bubble(shot_starts[1] + 0.75, 380, 0.075, 0.60)
    add_bubble(shot_starts[1] + 1.05, 480, 0.070, 0.44)
    add_splash(shot_starts[1] + 1.60, 0.40, 0.080, 0.50)

    # Shot 5 & 6: Swimming carp + leaping to snap pest!
    add_bubble(shot_starts[5] + 0.60, 430, 0.070, 0.58)
    add_bubble(shot_starts[5] + 1.40, 510, 0.068, 0.45)
    add_splash(shot_starts[6] + 1.60, 0.38, 0.090, 0.52)
    add_bubble(shot_starts[6] + 2.05, 560, 0.075, 0.54)

    # Shot 7: Swirling oxygen bubbles in mud water!
    for k, off in enumerate([0.4, 0.85, 1.35, 1.9, 2.4]):
        add_bubble(shot_starts[7] + off, 360 + k * 55, 0.065, 0.38 + (k % 3) * 0.12)

    # Shot 10 & 11: Opening bamboo sluice gate + splashing fat fish in trench!
    add_splash(shot_starts[10] + 0.50, 0.65, 0.080, 0.48)
    add_splash(shot_starts[11] + 0.80, 0.42, 0.088, 0.54)
    add_bubble(shot_starts[11] + 1.25, 440, 0.075, 0.50)

    # Shot 13: Golden double harvest chime!
    for k, f in enumerate([587.33, 739.99, 880.00, 1174.66]):
        add_tone(shot_starts[13] + 0.25 + k * 0.09, 0.85, f, 0.042, 0.32 + k * 0.12, "kecapi")

    # Shot 16: Pak Darto pouring his own shiny carp into Left Field -> loops back to Shot 1!
    add_splash(shot_starts[16] + 0.40, 0.45, 0.085, 0.40)
    add_bubble(shot_starts[16] + 0.90, 420, 0.075, 0.42)
    add_bubble(shot_starts[16] + 1.20, 510, 0.070, 0.48)

    sos_lp = signal.butter(2, 5200, btype="lowpass", fs=SR, output="sos")
    L = signal.sosfilt(sos_lp, L)
    R = signal.sosfilt(sos_lp, R)

    win = int(0.16 * SR)
    smooth_mask = np.convolve(speech_mask, np.ones(win) / win, mode="same")
    duck_gain = 1.0 - 0.56 * np.clip(smooth_mask, 0.0, 1.0)
    return np.stack([L * duck_gain, R * duck_gain], axis=1)


def main():
    print(f"=== Loading Qwen3-TTS MLX ONCE on Apple Silicon Metal GPU ({MODEL_ID}) ===")
    model = load_model(MODEL_ID)

    shot_audios = []
    for sid, light, text, chunks in SHOTS_SCRIPT:
        prefix = f"mp_s{sid:02d}"
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
        cands = sorted(f for f in os.listdir(CLIP_DIR) if f.startswith(prefix) and f.endswith(".wav"))
        raw_p = os.path.join(CLIP_DIR, cands[0])
        y24, sr_in = sf.read(raw_p)
        if y24.ndim > 1:
            y24 = y24.mean(axis=1)
        g = math.gcd(SR, sr_in)
        y48 = signal.resample_poly(y24.astype(np.float64), SR // g, sr_in // g)
        seg = trim_silence(y48, SR)
        seg = broadcast_clean(seg, SR)
        # Pitch-preserved snappy Shorts pace (1.18x) -> crisp ~65-72s total, ZERO clipped syllables!
        seg = apply_atempo(seg, SR, TEMPO, f"{prefix}_tempo")
        seg = trim_silence(seg, SR)
        seg = broadcast_clean(seg, SR)
        fade = min(int(0.008 * SR), len(seg) // 4)
        if fade > 0:
            r = np.linspace(0.0, 1.0, fade)
            seg[:fade] *= r
            seg[-fade:] *= r[::-1]

        shot_audios.append((sid, light, seg, chunks))
        print(f"  MinaPadi Shot {sid:02d}: dur={len(seg)/SR:.2f}s")

    print("=== Building Audio-First 16-Shot Frame-Accurate Timeline (Mina Padi) ===")
    cur_f = 0
    timings = []
    shot_starts_s = {}
    placed = []
    for idx, (sid, light, seg, chunks) in enumerate(shot_audios):
        a_f = cur_f
        sp_start_f = cur_f + (3 if idx == 0 else 2)
        sp_frames = int(math.ceil((len(seg) / SR) * FPS))
        b_f = sp_start_f + sp_frames + (7 if idx == len(shot_audios) - 1 else 4)
        timings.append({"id": sid, "a": a_f, "b": b_f, "light": light, "dur_s": round((b_f - a_f) / FPS, 3)})
        shot_starts_s[sid] = a_f / FPS
        placed.append((sid, sp_start_f / FPS, b_f / FPS, seg, chunks))
        cur_f = b_f

    total_frames = cur_f
    total_dur = total_frames / FPS
    total_samples = int(round(total_dur * SR))
    print(f"TOTAL MINA PADI AUDIO-FIRST TIMELINE: {total_frames} frames = {total_dur:.2f}s exact @ 30fps!")

    vo = np.zeros(total_samples, dtype=np.float64)
    speech_mask = np.zeros(total_samples, dtype=np.float64)
    sub_cues = []

    for sid, t0, t_end, seg, chunks in placed:
        i0 = int(round(t0 * SR))
        n = min(len(seg), total_samples - i0)
        vo[i0:i0 + n] += seg[:n]
        speech_mask[i0:i0 + n] = 1.0

        dur = n / SR
        weights = [spoken_weight(sp, disp) for disp, sp, _ in chunks]
        tw = sum(weights)
        bounds = [t0]
        cum = 0.0
        t1 = t0 + dur
        for j in range(len(chunks) - 1):
            cum += weights[j]
            bounds.append(snap_valley(vo, t0 + dur * (cum / tw), bounds[-1] + 0.14, t1 - 0.14))
        bounds.append(min(total_dur - 0.03, t1 + 0.06))
        for j, (disp, _, accent) in enumerate(chunks):
            sub_cues.append({"text": disp, "s": round(bounds[j], 3), "e": round(bounds[j + 1], 3), "accent": accent})

    for i in range(len(sub_cues) - 1):
        if sub_cues[i]["e"] > sub_cues[i + 1]["s"]:
            sub_cues[i]["e"] = round(sub_cues[i + 1]["s"] - 0.01, 3)

    vo_norm = vo * (0.86 / (np.max(np.abs(vo)) + 1e-9))
    vo_stereo = np.stack([vo_norm, vo_norm], axis=1)
    music_stereo = synth_minapadi_score(total_samples, shot_starts_s, speech_mask)
    mix = np.tanh((vo_stereo + music_stereo * 0.78) * 0.96) * 0.95

    micro = int(0.035 * SR)
    mix[:micro] *= np.linspace(0.0, 1.0, micro)[:, None]
    mix[-micro:] *= np.linspace(1.0, 0.0, micro)[:, None]

    out_wav = os.path.join(OUT_DIR, "minapadi_audio_master.wav")
    pcm = np.clip(np.round(mix * 32767.0), -32768, 32767).astype(np.int16)
    with wave.open(out_wav, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())

    with open(os.path.join(OUT_DIR, "minapadi_shots_timing.json"), "w", encoding="utf-8") as f:
        json.dump({"total_frames": total_frames, "total_dur": round(total_dur, 3), "shots": timings}, f, indent=2)

    with open(os.path.join(OUT_DIR, "minapadi_subtitles.json"), "w", encoding="utf-8") as f:
        json.dump(sub_cues, f, indent=2, ensure_ascii=False)

    with open(os.path.join(OUT_DIR, "minapadi_subtitles.srt"), "w", encoding="utf-8") as f:
        f.write("\n".join(f"{i}\n{fmt_srt(c['s'])} --> {fmt_srt(c['e'])}\n{c['text']}\n" for i, c in enumerate(sub_cues, 1)))

    print(f"SUCCESS MINA PADI AUDIO-FIRST: {out_wav} ({total_dur:.2f}s / {total_frames} frames) + {len(sub_cues)} cues!")


if __name__ == "__main__":
    main()
