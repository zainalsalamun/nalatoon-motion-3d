#!/usr/bin/env python3
"""
Cross-Platform Indonesian Voiceover Generator (macOS Apple Silicon, Windows, Linux, Intel Mac)

Modes:
  --mode design   Qwen3-TTS 1.7B VoiceDesign via mlx-audio (macOS Apple Silicon Metal GPU)
  --mode clone    Qwen3-TTS 0.6B Base Voice Cloning via mlx-audio (macOS Apple Silicon Metal GPU)
  --mode edge     Microsoft Edge Neural Indonesian TTS via edge-tts (Windows / Linux / Intel Mac / All OS)
"""

import argparse
import asyncio
import os
import subprocess
import sys


def trim_and_tighten(wav, sr, max_gap_s=0.17, thresh=0.012):
    import numpy as np

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


def run_mlx(args):
    import numpy as np
    import soundfile as sf
    from mlx_audio.tts.utils import load_model
    from mlx_audio.utils import load_audio

    if args.mode == "design":
        model_id = os.environ.get("MLX_TTS_MODEL", "mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-8bit")
        print(f"Loading {model_id} (15%)...", flush=True)
        model = load_model(model_id)
        print("Synthesizing Indonesian voiceover via Qwen3-TTS VoiceDesign (55%)...", flush=True)
        res = list(
            model.generate_voice_design(
                text=args.text,
                instruct=args.instruct,
                language="auto",
                temperature=args.temperature,
                top_p=0.92,
            )
        )
    else:
        model_id = "mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit"
        print(f"Loading {model_id} (15%)...", flush=True)
        model = load_model(model_id)
        if not args.ref_audio or not args.ref_text or not os.path.exists(args.ref_audio) or not os.path.exists(args.ref_text):
            raise FileNotFoundError("Voice cloning membutuhkan --ref-audio dan --ref-text yang valid.")
        ref_audio = load_audio(args.ref_audio, sample_rate=model.sample_rate)
        ref_text = open(args.ref_text, "r", encoding="utf-8").read().strip()
        print("Cloning voice via Qwen3-TTS Base (55%)...", flush=True)
        res = list(
            model.generate(
                text=args.text,
                ref_audio=ref_audio,
                ref_text=ref_text,
                lang_code="Indonesian",
                temperature=args.temperature,
                top_p=0.95,
            )
        )

    wav = np.concatenate([np.array(r.audio, dtype=np.float32) for r in res], axis=0)
    wav = trim_and_tighten(wav, model.sample_rate, max_gap_s=0.17)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    sf.write(args.out, wav, model.sample_rate)
    print(f"Voice saved ({len(wav) / model.sample_rate:.2f}s) -> {args.out} (100%)", flush=True)


def run_edge(args):
    import edge_tts

    voice = args.edge_voice or "id-ID-ArdiNeural"
    rate = args.edge_rate or "+8%"
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    is_wav = args.out.lower().endswith(".wav")
    tmp_mp3 = args.out[:-4] + ".tmp.mp3" if is_wav else args.out

    print(f"Synthesizing cross-platform Indonesian voice ({voice}, rate={rate}) (35%)...", flush=True)

    async def _gen():
        comm = edge_tts.Communicate(args.text, voice=voice, rate=rate)
        await comm.save(tmp_mp3)

    asyncio.run(_gen())

    if is_wav:
        ffmpeg = args.ffmpeg or "ffmpeg"
        print("Converting MP3 -> WAV 24kHz mono (80%)...", flush=True)
        subprocess.run(
            [ffmpeg, "-y", "-i", tmp_mp3, "-ar", "24000", "-ac", "1", args.out],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            os.remove(tmp_mp3)
        except OSError:
            pass

    print(f"Voice saved -> {args.out} (100%)", flush=True)


def main():
    ap = argparse.ArgumentParser(description="Cross-platform Indonesian voiceover generator")
    ap.add_argument("--mode", choices=["design", "clone", "edge"], default="edge")
    ap.add_argument("--text", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--instruct", default="")
    ap.add_argument("--temperature", type=float, default=0.85)
    ap.add_argument("--ref-audio", default="")
    ap.add_argument("--ref-text", default="")
    ap.add_argument("--edge-voice", default="id-ID-ArdiNeural")
    ap.add_argument("--edge-rate", default="+8%")
    ap.add_argument("--ffmpeg", default="ffmpeg")
    args = ap.parse_args()

    if args.mode in ("design", "clone"):
        run_mlx(args)
    else:
        run_edge(args)


if __name__ == "__main__":
    main()
