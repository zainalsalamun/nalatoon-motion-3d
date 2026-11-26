import json
import os
import re
import wave
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
VOICE_WAV = os.path.join(ROOT, "voice", "voice.wav")
WORDS_JSON = os.path.join(ROOT, "voice", "words.json")
OUT_JSON = os.path.join(ROOT, "out", "subtitles.json")
OUT_SRT = os.path.join(ROOT, "out", "subtitles.srt")

# Hand-crafted punchy 2-3 word visual subtitle chunks per shot
# Each item: (display_text, spoken_weight_text, accent_bool)
SHOT_CHUNKS = [
    # Shot 1: Tujuh puluh empat tentara merobohkan jembatan besi ini cuma karena berjalan melintasinya.
    [
        ("74 tentara", "Tujuh puluh empat tentara", True),
        ("merobohkan", "merobohkan", False),
        ("jembatan besi ini", "jembatan besi ini", True),
        ("cuma karena", "cuma karena", False),
        ("berjalan melintasinya", "berjalan melintasinya", False),
    ],
    # Shot 2: Tahun seribu delapan ratus tiga puluh satu, jembatan baru di atas sungai ini jadi kebanggaan seluruh kota.
    [
        ("Tahun 1831,", "Tahun seribu delapan ratus tiga puluh satu", True),
        ("jembatan baru", "jembatan baru", False),
        ("di atas sungai ini", "di atas sungai ini", False),
        ("jadi kebanggaan", "jadi kebanggaan", False),
        ("seluruh kota", "seluruh kota", True),
    ],
    # Shot 3: Para tentara pulang berbaris empat sejajar, setiap sepatu bot menghantam papan kayu di detik yang persis sama.
    [
        ("Para tentara pulang", "Para tentara pulang", False),
        ("berbaris 4 sejajar,", "berbaris empat sejajar", True),
        ("setiap sepatu bot", "setiap sepatu bot", False),
        ("menghantam papan kayu", "menghantam papan kayu", False),
        ("di detik yang", "di detik yang", False),
        ("persis sama", "persis sama", True),
    ],
    # Shot 4: Di tengah jembatan, lantainya mulai memantul di bawah kaki mereka.
    [
        ("Di tengah jembatan,", "Di tengah jembatan", False),
        ("lantainya mulai memantul", "lantainya mulai memantul", True),
        ("di bawah kaki mereka", "di bawah kaki mereka", False),
    ],
    # Shot 5: Orang normal pasti melambat, tapi para tentara ini malah menganggapnya lucu.
    [
        ("Orang normal", "Orang normal", False),
        ("pasti melambat,", "pasti melambat", False),
        ("tapi para tentara ini", "tapi para tentara ini", False),
        ("malah menganggapnya lucu", "malah menganggapnya lucu", True),
    ],
    # Shot 6: Seseorang mulai bersiul lagu mars, dan seluruh barisan ikut menghentakkan kaki makin keras di setiap langkah.
    [
        ("Seseorang mulai", "Seseorang mulai", False),
        ("bersiul lagu mars,", "bersiul lagu mars", True),
        ("dan seluruh barisan", "dan seluruh barisan", False),
        ("ikut menghentakkan kaki", "ikut menghentakkan kaki", False),
        ("makin keras", "makin keras", True),
        ("di setiap langkah", "di setiap langkah", False),
    ],
    # Shot 7: Pantulannya makin besar, rantai besi mulai mengerang, tapi tak satu pun mau merusak irama barisan.
    [
        ("Pantulannya makin besar,", "Pantulannya makin besar", True),
        ("rantai besi mulai mengerang,", "rantai besi mulai mengerang", True),
        ("tapi tak satu pun", "tapi tak satu pun", False),
        ("mau merusak", "mau merusak", False),
        ("irama barisan", "irama barisan", False),
    ],
    # Shot 8: Lalu, satu baut penahan patah, dan seluruh ujung jembatan langsung ambruk ke sungai!
    [
        ("Lalu,", "Lalu", False),
        ("satu baut penahan", "satu baut penahan", False),
        ("PATAH!", "patah", True),
        ("dan seluruh ujung jembatan", "dan seluruh ujung jembatan", False),
        ("langsung AMBRUK ke sungai!", "langsung ambruk ke sungai", True),
    ],
    # Shot 9: Untungnya, sungainya cuma sedalam enam puluh sentimeter.
    [
        ("Untungnya,", "Untungnya", True),
        ("sungainya cuma sedalam", "sungainya cuma sedalam", False),
        ("60 sentimeter", "enam puluh sentimeter", True),
    ],
    # Shot 10: Sialnya, sungainya cuma sedalam enam puluh sentimeter.
    [
        ("Sialnya...", "Sialnya", True),
        ("sungainya cuma sedalam", "sungainya cuma sedalam", False),
        ("60 sentimeter", "enam puluh sentimeter", True),
    ],
    # Shot 11: Begini rahasianya: setiap jembatan punya ritme alami untuk berayun.
    [
        ("Begini rahasianya:", "Begini rahasianya", True),
        ("setiap jembatan", "setiap jembatan", False),
        ("punya ritme alami", "punya ritme alami", True),
        ("untuk berayun", "untuk berayun", False),
    ],
    # Shot 12: Pernah mendorong anak di ayunan? Satu dorongan terasa kecil, tapi jika mendarat di momen yang tepat, ayunan melesat makin tinggi.
    [
        ("Pernah mendorong", "Pernah mendorong", False),
        ("anak di ayunan?", "anak di ayunan", True),
        ("Satu dorongan terasa kecil,", "Satu dorongan terasa kecil", False),
        ("tapi jika mendarat", "tapi jika mendarat", False),
        ("di momen yang tepat,", "di momen yang tepat", True),
        ("ayunan melesat makin tinggi", "ayunan melesat makin tinggi", True),
    ],
    # Shot 13: Tujuh puluh empat tentara yang melangkah serempak mendorong jembatan seperti ayunan raksasa.
    [
        ("74 tentara", "Tujuh puluh empat tentara", True),
        ("yang melangkah serempak", "yang melangkah serempak", False),
        ("mendorong jembatan", "mendorong jembatan", False),
        ("seperti ayunan raksasa", "seperti ayunan raksasa", True),
    ],
    # Shot 14: Tak ada yang tewas, tapi militer langsung membuat aturan: dilarang baris serempak di atas jembatan.
    [
        ("Tak ada yang tewas,", "Tak ada yang tewas", False),
        ("tapi militer langsung", "tapi militer langsung", False),
        ("membuat aturan:", "membuat aturan", True),
        ("DILARANG baris serempak", "dilarang baris serempak", True),
        ("di atas jembatan", "di atas jembatan", False),
    ],
    # Shot 15: Jadi sampai hari ini, pasukan paling disiplin di dunia pun menyeberangi jembatan seperti rombongan turis.
    [
        ("Jadi sampai hari ini,", "Jadi sampai hari ini", False),
        ("pasukan paling disiplin", "pasukan paling disiplin", False),
        ("di dunia pun", "di dunia pun", False),
        ("menyeberangi jembatan", "menyeberangi jembatan", False),
        ("seperti rombongan turis", "seperti rombongan turis", True),
    ],
]


def spoken_weight(text: str, display: str) -> float:
    # Count Indonesian syllables (vowel clusters) + slight pause weight for punctuation
    vowels = len(re.findall(r"[aiueoAIUEO]+", text))
    chars = len(re.sub(r"\s+", "", text))
    pause = 0.0
    if display.endswith((",", ":")):
        pause = 1.6
    elif display.endswith(("?", "!", "...")):
        pause = 2.4
    return max(1.0, vowels * 1.15 + chars * 0.12 + pause)


def load_voice():
    with wave.open(VOICE_WAV, "rb") as wf:
        sr = wf.getframerate()
        raw = wf.readframes(wf.getnframes())
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0
    return x, sr


def snap_to_valley(audio: np.ndarray, sr: int, t_est: float, t_lo: float, t_hi: float) -> float:
    """Snap an estimated boundary within +-120ms to the quietest 20ms RMS valley (natural word/clause gap)."""
    lo = max(t_lo + 0.05, t_est - 0.12)
    hi = min(t_hi - 0.05, t_est + 0.12)
    if hi <= lo:
        return t_est
    win = int(0.02 * sr)
    step = int(0.005 * sr)
    i0 = int(lo * sr)
    i1 = int(hi * sr)
    best_t = t_est
    best_e = 1e9
    for idx in range(i0, max(i0 + 1, i1 - win), step):
        seg = audio[idx:idx + win]
        e = float(np.sqrt(np.mean(seg * seg)))
        # gentle bias toward t_est so we don't jump far unnecessarily
        t_cur = (idx + win * 0.5) / sr
        score = e + 0.02 * abs(t_cur - t_est)
        if score < best_e:
            best_e = score
            best_t = t_cur
    return best_t


def fmt_srt(t: float) -> str:
    ms = int(round(t * 1000))
    h = ms // 3600000
    ms %= 3600000
    m = ms // 60000
    ms %= 60000
    s = ms // 1000
    ms %= 1000
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def main():
    audio, sr = load_voice()
    with open(WORDS_JSON, "r", encoding="utf-8") as f:
        shots = json.load(f)

    assert len(shots) == len(SHOT_CHUNKS), f"Mismatch {len(shots)} vs {len(SHOT_CHUNKS)}"

    cues = []
    for shot_meta, chunks in zip(shots, SHOT_CHUNKS):
        t0 = float(shot_meta["s"])
        t1 = float(shot_meta["e"])
        dur = t1 - t0

        weights = [spoken_weight(sp, disp) for disp, sp, _ in chunks]
        total_w = sum(weights)

        # Compute cumulative boundaries snapped to local RMS valleys
        bounds = [t0]
        cum = 0.0
        for idx in range(len(chunks) - 1):
            cum += weights[idx]
            est = t0 + dur * (cum / total_w)
            snapped = snap_to_valley(audio, sr, est, bounds[-1] + 0.15, t1 - 0.15)
            bounds.append(snapped)
        bounds.append(t1 + 0.08)  # tiny readable tail

        for idx, (disp, _, accent) in enumerate(chunks):
            cues.append({
                "text": disp,
                "s": round(bounds[idx], 3),
                "e": round(bounds[idx + 1], 3),
                "accent": accent,
            })

    # Ensure zero overlap between consecutive cues
    for i in range(len(cues) - 1):
        if cues[i]["e"] > cues[i + 1]["s"]:
            cues[i]["e"] = round(cues[i + 1]["s"] - 0.01, 3)

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(cues, f, indent=2, ensure_ascii=False)

    srt_lines = []
    for idx, c in enumerate(cues, 1):
        srt_lines.append(f"{idx}\n{fmt_srt(c['s'])} --> {fmt_srt(c['e'])}\n{c['text']}\n")
    with open(OUT_SRT, "w", encoding="utf-8") as f:
        f.write("\n".join(srt_lines))

    print(f"Generated {len(cues)} synced subtitle cues -> {OUT_JSON} & {OUT_SRT}")
    for c in cues[:8]:
        print(f"  [{c['s']:5.2f}..{c['e']:5.2f}] {'*' if c['accent'] else ' '} {c['text']}")


if __name__ == "__main__":
    main()
