# Nalatoon 3D Motion Graphics Studio

Proyek terpadu untuk membuat video **3D Diorama Motion Graphics vertikal (9:16, 1080x1920)** menggunakan **Remotion + React Three Fiber + Three.js**, lengkap dengan pipeline **Local AI Narration (Qwen3-TTS MLX)**, **macOS Subtitle Burner (Swift)**, dan **YouTube Shorts Auto-Uploader**.

## Struktur Proyek

```text
nalatoon-motion-3d/
├── src/                      # Source code animasi 3D (Remotion + React + Three.js)
│   ├── index.ts
│   ├── Root.tsx              # Daftar semua komposisi episode Shorts
│   └── videos/
│       ├── padibebek/        # Episode 3D Diorama v3: Sawah Padi-Bebek (Aigamo)
│       ├── minapadi/         # Episode 3D Diorama v3: Sistem Mina Padi Ikan Mas
│       ├── tambora/
│       ├── pulaurun/
│       ├── jawa/
│       ├── bahasajawa/
│       ├── cafe/
│       └── bridge/
├── assets/
│   └── brand/                # Aset logo watermark
├── scripts/
│   ├── render/               # Script render Remotion & Swift subtitle burner
│   ├── audio/                # Script narasi lokal Qwen3-TTS MLX & audio mastering
│   └── youtube/              # Headless YouTube Shorts Auto-Uploader (Data API v3)
├── package.json
├── requirements.txt
└── .env.example
```

## Quick Start

### 1. Install Dependencies (Node.js 18+)
```bash
npm install
```

### 2. Preview Interaktif di Remotion Studio
```bash
npm run studio
```

### 3. Typecheck TypeScript
```bash
npm run typecheck
```

### 4. Render Video 3D (1080x1920, 30fps)
```bash
npm run render:padibebek
# atau
npm run render:minapadi
# atau komposisi apa saja:
zsh scripts/render/render_short.sh MinaPadiShort ./out/minapadi.mp4
```

### 5. Local AI Voiceover (Gratis di Apple Silicon via `mlx-audio` + `Qwen3-TTS`)
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Mode VoiceDesign (intonasi storytelling santai tanpa perlu rekaman referensi)
MLX_MODE=design zsh scripts/audio/clone_voice_mlx.sh "Teks narasi Bahasa Indonesia..." ./out/tts
```

### 6. Headless YouTube Shorts Auto-Uploader
1. Salin `.env.example` menjadi `.env` dan isi path kredensial lokal Anda.
2. Taruh OAuth `client_secret.json` di folder `secrets/` (sudah otomatis di-ignore oleh `.gitignore`).
3. Login 1x lalu jadwalkan antrean:
```bash
python3 scripts/youtube/upload_daily_short.py --auth-only
python3 scripts/youtube/upload_daily_short.py --schedule-all --hour 19 --minute 0
```

> **Keamanan:** File `client_secret.json`, `*token*.json`, `.env`, hasil render `out/`, `*.mp4`, `*.wav`, dan bobot model AI sudah otomatis di-ignore di `.gitignore` agar aman saat di-push ke GitHub/GitLab.
