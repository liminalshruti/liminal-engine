#!/usr/bin/env bash
#
# verify-demo-video.sh — Liminal Engine — Agentic Work Governance MVP
# Hackathon: Liminal Engine Governance Hack 2026
#
# Verifies that the demo recording video exists and is judge-ready.
# Run this before final submission to confirm the video is in place.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m⚠\033[0m %s\n' "$1"; }

bold "Liminal Engine — demo video verification"
echo

# Expected video location
VIDEO_DIR="demos/recordings"
VIDEO_FILE="$VIDEO_DIR/acme-governance-demo.mp4"

# Check if recordings directory exists
if [ ! -d "$VIDEO_DIR" ]; then
  fail "Directory $VIDEO_DIR does not exist"
  exit 1
fi

ok "Directory $VIDEO_DIR exists"

# Check if video file exists
if [ ! -f "$VIDEO_FILE" ]; then
  # Check for alternative formats
  FOUND=0
  for ext in mp4 mov webm mkv avi; do
    if [ -f "$VIDEO_DIR/acme-governance-demo.$ext" ]; then
      VIDEO_FILE="$VIDEO_DIR/acme-governance-demo.$ext"
      FOUND=1
      break
    fi
  done

  if [ $FOUND -eq 0 ]; then
    warn "No video found at $VIDEO_FILE or alternative formats"
    echo
    echo "  To record the demo:"
    echo "    1. cd apps/desktop-demo && pnpm dev"
    echo "    2. Use a screen recording tool (QuickTime, OBS, etc.)"
    echo "    3. Step through all 14 beats using the Next button"
    echo "    4. Save as demos/recordings/acme-governance-demo.mp4"
    echo
    exit 1
  fi
fi

# File exists
ok "Video file exists: $VIDEO_FILE"

# Check file size (should be non-zero)
SIZE=$(stat -f%z "$VIDEO_FILE" 2>/dev/null || stat -c%s "$VIDEO_FILE" 2>/dev/null || echo "0")
SIZE_MB=$(echo "scale=2; $SIZE / 1048576" | bc)

if [ "$SIZE" -lt 1048576 ]; then
  warn "Video file is very small ($SIZE_MB MB) — may not be a complete recording"
else
  ok "Video file size: ${SIZE_MB} MB"
fi

# Verify README exists
if [ -f "$VIDEO_DIR/README.md" ]; then
  ok "Recording directory documentation exists"
else
  warn "No README.md in $VIDEO_DIR (optional but recommended)"
fi

# Summary
echo
bold "Verification complete"
echo "  The demo recording is ready for submission."
echo "  Judges will find the video at: demos/recordings/"
echo
