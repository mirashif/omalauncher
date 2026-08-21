#!/bin/bash

set -euo pipefail

: "${OMALAUNCHER_SMOKE_PLUGIN_ID:?}"
: "${OMALAUNCHER_SMOKE_SHELL_CONFIG:?}"
: "${OMALAUNCHER_SMOKE_SHELL_LOG:?}"

printf '%s\n' "$*" >>"$OMALAUNCHER_SMOKE_SHELL_LOG"

target="${1:-}"
method="${2:-}"
plugin_root="$HOME/.config/omarchy/plugins"
manifest="$plugin_root/$OMALAUNCHER_SMOKE_PLUGIN_ID/manifest.json"

[[ $target == shell ]] || exit 0

write_shell_config() {
  local expression="$1"
  local temporary_config
  shift

  mkdir -p "$(dirname -- "$OMALAUNCHER_SMOKE_SHELL_CONFIG")"
  if [[ ! -f $OMALAUNCHER_SMOKE_SHELL_CONFIG ]]; then
    printf '%s\n' '{"version":1,"bar":{"layout":{"left":[],"center":[],"right":[]}}}' \
      >"$OMALAUNCHER_SMOKE_SHELL_CONFIG"
  fi
  temporary_config=$(mktemp "${OMALAUNCHER_SMOKE_SHELL_CONFIG}.XXXXXX")
  jq "$@" --arg id "$OMALAUNCHER_SMOKE_PLUGIN_ID" "$expression" \
    "$OMALAUNCHER_SMOKE_SHELL_CONFIG" >"$temporary_config"
  mv "$temporary_config" "$OMALAUNCHER_SMOKE_SHELL_CONFIG"
}

case "$method" in
  ping | rescanPlugins)
    printf '%s\n' ok
    ;;
  listPlugins)
    if [[ ! -f $manifest ]]; then
      printf '%s\n' '[]'
      exit 0
    fi
    enabled=false
    if [[ -f $OMALAUNCHER_SMOKE_SHELL_CONFIG ]] && jq -e --arg id "$OMALAUNCHER_SMOKE_PLUGIN_ID" '
      [.bar.layout | to_entries[] | .value[] | select(.id == $id)] | length == 1
    ' "$OMALAUNCHER_SMOKE_SHELL_CONFIG" >/dev/null; then
      enabled=true
    fi
    jq -cn \
      --arg id "$OMALAUNCHER_SMOKE_PLUGIN_ID" \
      --arg name "$(jq -r '.name' "$manifest")" \
      --argjson kinds "$(jq -c '.kinds' "$manifest")" \
      --argjson enabled "$enabled" \
      '[{id: $id, name: $name, kinds: $kinds, enabled: $enabled,
         active: false, canDisable: true, firstParty: false, clonedFrom: ""}]'
    ;;
  enablePlugin)
    id="${3:-}"
    placement="${4:-}"
    [[ -n $placement ]] || placement='{}'
    [[ $id == "$OMALAUNCHER_SMOKE_PLUGIN_ID" && -f $manifest ]] || {
      printf '%s\n' unknown
      exit 0
    }
    section=$(jq -r --arg fallback "$(jq -r '.barWidget.defaultSection // "right"' "$manifest")" \
      '.section // $fallback' <<<"$placement")
    case "$section" in left | center | right) ;; *) printf '%s\n' 'invalid placement'; exit 0 ;; esac
    write_shell_config '
      .bar.layout.left = [.bar.layout.left[] | select(.id != $id)]
      | .bar.layout.center = [.bar.layout.center[] | select(.id != $id)]
      | .bar.layout.right = [.bar.layout.right[] | select(.id != $id)]
      | .bar.layout[$section] += [{id: $id}]
    ' --arg section "$section"
    printf '%s\n' ok
    ;;
  setPluginEnabled)
    id="${3:-}"
    enabled="${4:-false}"
    [[ $id == "$OMALAUNCHER_SMOKE_PLUGIN_ID" ]] || {
      printf '%s\n' unknown
      exit 0
    }
    if [[ $enabled == true ]]; then
      printf '%s\n' 'use enablePlugin'
      exit 0
    fi
    write_shell_config '
      .bar.layout.left = [.bar.layout.left[] | select(.id != $id)]
      | .bar.layout.center = [.bar.layout.center[] | select(.id != $id)]
      | .bar.layout.right = [.bar.layout.right[] | select(.id != $id)]
    '
    printf '%s\n' ok
    ;;
esac
