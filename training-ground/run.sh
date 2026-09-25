#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
node simulate.mjs scenario.json report.html
echo "Open report.html in a browser."
