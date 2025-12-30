#!/bin/bash
# Build script for canvas-wasm
set -e

echo "Building canvas-wasm..."

if ! command -v wasm-pack &> /dev/null; then
    echo "wasm-pack not found. Installing..."
    cargo install wasm-pack
fi

wasm-pack build --target web --out-dir pkg "$@"

echo "Build complete! Output in crates/canvas-wasm/pkg/"
ls -lh pkg/*.wasm pkg/*.js 2>/dev/null || true
