#!/bin/bash
# Publishes dist/ to the gh-pages branch of origin (GitHub Pages serves that branch).
set -e
cd "$(dirname "$0")/.."
bash scripts/build_dist.sh
URL=$(git remote get-url origin)
cd dist
if [ ! -d .git ]; then
  git init -q -b gh-pages
  git remote add origin "$URL"
  git fetch -q origin gh-pages 2>/dev/null && git reset -q --soft origin/gh-pages || true
fi
git add -A
if git diff --cached --quiet; then echo "Site already up to date."; exit 0; fi
git commit -qm "Deploy $(date '+%Y-%m-%d %H:%M')"
git push -q origin gh-pages
echo "Site deployed."
