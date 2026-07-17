#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="node_modules/expo-constants/scripts/get-app-config-ios.sh"

if [[ ! -f "$SCRIPT_PATH" ]]; then
  exit 0
fi

perl -0pi -e 's/PROJECT_DIR_BASENAME=\$\(basename \$PROJECT_DIR\)/PROJECT_DIR_BASENAME=$(basename "$PROJECT_DIR")/' "$SCRIPT_PATH"
