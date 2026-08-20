#!/bin/bash

set -euo pipefail

plugin_id=io.github.omalauncher

omarchy-shell shell call "$plugin_id" open '{}' >/dev/null
metrics=$(omarchy-shell shell call "$plugin_id" performanceStats '')
omarchy-shell shell call "$plugin_id" close '' >/dev/null

jq -e '
  .warmOpenMs <= .budgets.warmOpenMs
  and .maxSearchUpdateMs <= .budgets.searchUpdateMs
' <<<"$metrics" >/dev/null

printf '%s\n' "$metrics"
