#!/usr/bin/env bash
set -euo pipefail

rm -rf app components lib types public node_modules .next
rm -f index.html styles.css app.js next.config.js next.config.mjs next-env.d.ts
rm -f tsconfig.json package.json package-lock.json vercel.json README.md .gitignore

cp -R clean-project/. .

echo "Clean final TK English Club installed."
