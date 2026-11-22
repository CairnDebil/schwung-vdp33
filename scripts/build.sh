#!/usr/bin/env bash
# Build the VDP33 module for Ableton Move (ARM64).
#
# Uses Docker for cross-compilation unless CROSS_PREFIX is set
# (e.g. CROSS_PREFIX=aarch64-linux-gnu- for a local toolchain).
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
IMAGE_NAME="schwung-vdp33-builder"

# Keep the editor and the manual in step with the parameter table in the C source.
# (Done here, on the host, because the Docker image has no Python.)
if command -v python3 >/dev/null 2>&1; then
    python3 "$SCRIPT_DIR/gen_web.py"
fi

if [ -z "$CROSS_PREFIX" ] && [ ! -f "/.dockerenv" ]; then
    echo "=== VDP33 build (via Docker) ==="
    if ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
        echo "Building Docker image (first time only)..."
        docker build -t "$IMAGE_NAME" -f "$SCRIPT_DIR/Dockerfile" "$REPO_ROOT"
    fi
    docker run --rm \
        -v "$REPO_ROOT:/build" \
        -u "$(id -u):$(id -g)" \
        -w /build \
        "$IMAGE_NAME" \
        bash ./scripts/build.sh
    echo "=== Done ==="
    exit 0
fi

CROSS_PREFIX="${CROSS_PREFIX:-aarch64-linux-gnu-}"
cd "$REPO_ROOT"

echo "=== Building VDP33 ==="
echo "Cross prefix: $CROSS_PREFIX"

mkdir -p build dist/vdp33

${CROSS_PREFIX}gcc -O3 -g -shared -fPIC -std=c11 -Wall -Wextra \
    src/dsp/vdp33.c \
    -o build/dsp.so \
    -Isrc/dsp \
    -lm

# cat instead of cp: avoids ExtFS deallocation issues with Docker volumes
cat src/module.json > dist/vdp33/module.json
cat src/help.json   > dist/vdp33/help.json
cat src/ui.js       > dist/vdp33/ui.js
cat src/web/web_ui.html > dist/vdp33/web_ui.html   # editor, served in Schwung Manager -> Remote UI
cat build/dsp.so    > dist/vdp33/dsp.so
cat LICENSE         > dist/vdp33/LICENSE
cat NOTICE          > dist/vdp33/NOTICE
chmod +x dist/vdp33/dsp.so

( cd dist && tar -czvf vdp33-module.tar.gz vdp33/ )

echo ""
echo "=== Build complete ==="
echo "Output:  dist/vdp33/"
echo "Tarball: dist/vdp33-module.tar.gz"
echo "Install: ./scripts/install.sh"
