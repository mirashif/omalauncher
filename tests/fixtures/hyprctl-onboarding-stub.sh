#!/bin/bash

set -euo pipefail

: "${OMALAUNCHER_ONBOARDING_HYPR_LOG:?}"
printf '%s\n' "$*" >>"$OMALAUNCHER_ONBOARDING_HYPR_LOG"

case "${1:-}" in
  binds)
    printf '%s\n' '[{"modmask":64,"key":"SPACE","description":"Omarchy menu","dispatcher":"__lua"}]'
    ;;
  monitors | clients | workspaces | instances)
    printf '%s\n' '[]'
    ;;
  activeworkspace | activewindow)
    printf '%s\n' '{}'
    ;;
  configerrors | reload)
    ;;
esac
