#!/bin/bash

set -euo pipefail

plugin_id=com.mirashif.omalauncher

omarchy-shell shell call "$plugin_id" resetPerformanceStats '' >/dev/null
omarchy-shell shell call "$plugin_id" open '{"query":"update hyprland"}' >/dev/null
metrics=$(omarchy-shell shell call "$plugin_id" performanceStats '')
omarchy-shell shell call "$plugin_id" close '' >/dev/null

jq -e '
  .warmOpenMs <= .budgets.warmOpenMs
  and .maxSearchUpdateMs <= .budgets.searchUpdateMs
  and .searchMeasurements > 0
' <<<"$metrics" >/dev/null

printf '%s\n' "$metrics"
