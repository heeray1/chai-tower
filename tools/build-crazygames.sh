#!/usr/bin/env bash
# Builds the CrazyGames upload from the website files:
#   dist/crazygames/              the game, with the CrazyGames SDK added in <head>
#   dist/chai-tower-crazygames.zip   upload this on developer.crazygames.com
# The website (index.html as committed) stays SDK-free; index.html switches its portal code on only when the SDK is present.
set -euo pipefail
cd "$(dirname "$0")/.."
out=dist/crazygames
rm -rf dist && mkdir -p "$out/assets" "$out/vendor"
cp levels.js "$out/"
cp vendor/matter.min.js "$out/vendor/"
cp assets/*.png assets/stall.jpg "$out/assets/"
# add the SDK before the icon link (inside <head>, before the game scripts); drop the website's link-preview tags
perl -ne 'next if /property="og:|name="twitter:/;
  s#^<link rel="icon"#<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n<link rel="icon"#; print' \
  index.html > "$out/index.html"
grep -q 'crazygames-sdk-v3.js' "$out/index.html" || { echo "SDK tag not added" >&2; exit 1; }
(cd "$out" && zip -qr ../chai-tower-crazygames.zip .)
echo "built $out ($(du -sh "$out" | cut -f1)), dist/chai-tower-crazygames.zip ($(du -h dist/chai-tower-crazygames.zip | cut -f1))"
