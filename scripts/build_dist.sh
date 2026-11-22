#!/bin/zsh
# Builds dist/ — only the public site (no admin, scripts, notes). Upload this folder to any static host.
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist
cp index.html style.css app.js settings.js tracks.js dist/
[ -f cover.jpg ] && cp cover.jpg dist/
cp -R audio dist/
echo "dist/ ready: $(du -sh dist | cut -f1)"
