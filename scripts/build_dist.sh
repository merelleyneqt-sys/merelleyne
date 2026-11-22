#!/bin/bash
# Builds dist/ — only the public site (no admin, scripts, notes). Keeps dist/.git (the deploy branch).
cd "$(dirname "$0")/.."
mkdir -p dist
find dist -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp index.html style.css app.js settings.js tracks.js dist/
[ -f cover.jpg ] && cp cover.jpg dist/
cp -R audio dist/
touch dist/.nojekyll   # GitHub Pages: serve files as-is
echo "dist/ ready: $(du -sh dist | cut -f1)"
