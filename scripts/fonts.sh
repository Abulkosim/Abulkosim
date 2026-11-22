#!/bin/sh
# Fetches the two fonts the cards embed, from npm, into assets/fonts.
# render.mjs checks their hashes before it uses them.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$root/assets/fonts"
cd "$tmp"
npm pack --silent @fontsource-variable/inter@5.1.1 @fontsource/jetbrains-mono@5.1.1 >/dev/null
tar -xzOf fontsource-variable-inter-5.1.1.tgz package/files/inter-latin-wght-normal.woff2 > "$root/assets/fonts/inter.woff2"
tar -xzOf fontsource-jetbrains-mono-5.1.1.tgz package/files/jetbrains-mono-latin-400-normal.woff2 > "$root/assets/fonts/jetbrains-mono.woff2"
