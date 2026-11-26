#!/bin/zsh
set -euo pipefail

# Portable Remotion 3D Short renderer
# Usage: zsh scripts/render/render_short.sh <CompositionId> [out_file]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

COMP_ID="${1:?Usage: zsh scripts/render/render_short.sh <CompositionId> [output.mp4]}"
OUT_FILE="${2:-$PROJECT_ROOT/out/${COMP_ID}.mp4}"

mkdir -p "$(dirname "$OUT_FILE")"
cd "$PROJECT_ROOT"

echo ">>> Rendering $COMP_ID -> $OUT_FILE"
npx remotion render "$COMP_ID" "$OUT_FILE" \
  --concurrency="${REMOTION_CONCURRENCY:-2}" \
  --crf="${REMOTION_CRF:-18}" \
  --gl=angle \
  --timeout=120000

echo ">>> Done: $OUT_FILE"
