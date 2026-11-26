#!/bin/zsh
set -euo pipefail

# Portable 100% Local Free Indonesian TTS / Voice Cloning (Apple Silicon MLX + Qwen3-TTS)
# Mode 1 (VoiceDesign - no reference audio required):
#   MLX_MODE=design zsh scripts/audio/clone_voice_mlx.sh "Teks Bahasa Indonesia..." ./out/voice
# Mode 2 (Base Voice Cloning - uses local ref audio + transcript):
#   MLX_MODE=clone zsh scripts/audio/clone_voice_mlx.sh "Teks Bahasa Indonesia..." ./out/voice ./ref.wav ./ref.txt

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TEXT="${1:?Usage: zsh scripts/audio/clone_voice_mlx.sh \"Teks...\" [out_dir] [ref_audio.wav] [ref_text.txt]}"
OUT_DIR="${2:-$PROJECT_ROOT/out/tts}"
REF_AUDIO="${3:-${MLX_REF_AUDIO:-$PROJECT_ROOT/assets/brand/voice_ref.wav}}"
REF_TEXT_FILE="${4:-${MLX_REF_TEXT:-$PROJECT_ROOT/assets/brand/voice_ref.txt}}"
MODE="${MLX_MODE:-design}"
MLX_BIN="${MLX_AUDIO_BIN:-mlx_audio.tts.generate}"

mkdir -p "$OUT_DIR"

if [[ "$MODE" == "design" ]]; then
  MODEL="${MLX_TTS_MODEL:-mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-8bit}"
  INSTRUCT="${MLX_INSTRUCT:-A relaxed, confident 30-year-old Indonesian male explainer voice with a warm medium-low pitch. Speaks naturally like a smart friend explaining an interesting science fact in a YouTube video. Smooth conversational flow, steady brisk pace, gentle natural pitch inflection on questions, clean close-mic studio sound.}"
  "$MLX_BIN" \
    --model "$MODEL" \
    --instruct "$INSTRUCT" \
    --text "$TEXT" \
    --lang_code auto \
    --temperature 0.85 \
    --output_path "$OUT_DIR" \
    --file_prefix "narration"
else
  MODEL="${MLX_TTS_MODEL:-mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit}"
  REF_TEXT="$(cat "$REF_TEXT_FILE")"
  "$MLX_BIN" \
    --model "$MODEL" \
    --ref_audio "$REF_AUDIO" \
    --ref_text "$REF_TEXT" \
    --text "$TEXT" \
    --lang_code Indonesian \
    --output_path "$OUT_DIR" \
    --file_prefix "narration"
fi
