#!/bin/bash
# Builds dist/ — only the public site (no admin, scripts, notes). Keeps dist/.git (the deploy branch).
cd "$(dirname "$0")/.."
mkdir -p dist
find dist -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp index.html style.css app.js settings.js tracks.js i18n.js fire.js dist/
[ -f cover.jpg ] && cp cover.jpg dist/
cp -R audio dist/
touch dist/.nojekyll   # GitHub Pages: serve files as-is
# safety net: every local file index.html references must be in dist/
missing=$(grep -oE '(src|href)="[^"#:]+"' dist/index.html | sed -E 's/^(src|href)="//; s/"$//; s/\?.*$//' | sort -u | while read -r f; do [ -e "dist/$f" ] || echo "$f"; done)
if [ -n "$missing" ]; then echo "ERROR: missing in dist/: $missing" >&2; exit 1; fi
echo "dist/ ready: $(du -sh dist | cut -f1)"
