#!/bin/bash

set -euo pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
visible=false
if [[ ${1:-} == --visible ]]; then
  visible=true
  shift
fi
(( $# == 0 )) || {
  echo "Usage: $0 [--visible]" >&2
  exit 2
}

runtime_root=$(mktemp -d "${TMPDIR:-/tmp}/omalauncher-onboarding.XXXXXX")
test_home="$runtime_root/home"
test_omarchy="$runtime_root/omarchy"
stub_bin="$runtime_root/bin"
runtime_log="$runtime_root/quickshell.log"
hyprland_log="$runtime_root/hyprland.log"
hypr_log="$runtime_root/hyprctl.log"
plugin_id=$(jq -r '.id' "$project_dir/manifest.json")
plugin_dir="$test_home/.config/omarchy/plugins/$plugin_id"
shell_config="$test_home/.config/omarchy/shell.json"
state_file="$test_home/.local/state/omalauncher/state.json"
quickshell_pid=""
hyprland_pid=""
nested_wayland_display=""
test_failed=false
host_hyprland_signature="${HYPRLAND_INSTANCE_SIGNATURE:-}"
host_runtime_dir="${XDG_RUNTIME_DIR:-/run/user/$UID}"

cleanup() {
  if [[ -n ${quickshell_pid:-} ]] && kill -0 "$quickshell_pid" 2>/dev/null; then
    quickshell kill --pid "$quickshell_pid" >/dev/null 2>&1 || kill "$quickshell_pid" 2>/dev/null || true
    wait "$quickshell_pid" 2>/dev/null || true
  fi
  if [[ -n ${hyprland_pid:-} ]] && kill -0 "$hyprland_pid" 2>/dev/null; then
    kill "$hyprland_pid" 2>/dev/null || true
    wait "$hyprland_pid" 2>/dev/null || true
  fi
  if [[ $test_failed == true || ${OMALAUNCHER_KEEP_TEST_ARTIFACTS:-0} == 1 ]]; then
    printf 'Onboarding test artifacts: %s\n' "$runtime_root" >&2
  else
    case "${runtime_root:-}" in
      */omalauncher-onboarding.*) rm -rf -- "$runtime_root" ;;
    esac
  fi
}
trap cleanup EXIT

fail() {
  test_failed=true
  printf 'onboarding-runtime-test: %s\n' "$1" >&2
  if [[ -n ${nested_wayland_display:-} ]] && command -v grim >/dev/null 2>&1; then
    WAYLAND_DISPLAY="$nested_wayland_display" grim "$runtime_root/failure.png" \
      >/dev/null 2>&1 || true
  fi
  if [[ -f $runtime_log ]]; then
    printf '%s\n' '--- Quickshell log ---' >&2
    tail -n 120 "$runtime_log" >&2
  fi
  if [[ -f $hyprland_log ]]; then
    printf '%s\n' '--- nested Hyprland log ---' >&2
    tail -n 80 "$hyprland_log" >&2
  fi
  exit 1
}

ipc() {
  quickshell ipc --pid "$quickshell_pid" call -- "$@"
}

wait_for_ipc() {
  local target="$1"
  local method="$2"
  local expected="$3"
  local output=""
  for ((attempt = 0; attempt < 100; attempt++)); do
    if ! kill -0 "$quickshell_pid" 2>/dev/null; then
      fail "Quickshell exited before $target.$method became available"
    fi
    output=$(ipc "$target" "$method" 2>/dev/null || true)
    if [[ $output == "$expected" ]]; then
      printf '%s\n' "$output"
      return 0
    fi
    sleep 0.05
  done
  fail "$target.$method did not return $expected"
}

wait_for_stats() {
  local output=""
  for ((attempt = 0; attempt < 100; attempt++)); do
    output=$(ipc shell call "$plugin_id" stats '' 2>/dev/null || true)
    if jq -e . >/dev/null 2>&1 <<<"$output"; then
      printf '%s\n' "$output"
      return 0
    fi
    sleep 0.05
  done
  fail "Omalauncher diagnostics did not become available"
}

wait_for_stats_matching() {
  local expression="$1"
  local description="$2"
  local output=""
  for ((attempt = 0; attempt < 120; attempt++)); do
    output=$(ipc shell call "$plugin_id" stats '' 2>/dev/null || true)
    if jq -e "$expression" >/dev/null 2>&1 <<<"$output"; then
      printf '%s\n' "$output"
      return 0
    fi
    sleep 0.05
  done
  fail "$description"
}

press_enter() {
  WAYLAND_DISPLAY="$nested_wayland_display" wtype -k Return
}

demo_pause() {
  if [[ $visible == true ]]; then sleep 1; fi
}

wait_for_plugin() {
  local output=""
  for ((attempt = 0; attempt < 100; attempt++)); do
    output=$(ipc shell listPlugins 2>/dev/null || true)
    if jq -e --arg id "$plugin_id" 'any(.[]; .id == $id and .enabled == true)' \
      >/dev/null 2>&1 <<<"$output"; then
      return 0
    fi
    sleep 0.05
  done
  fail "Omalauncher was not discovered as an enabled plugin"
}

mkdir -p "$plugin_dir" "$test_home/.config/hypr" "$stub_bin" "$test_omarchy"
rsync -a --exclude=.git --exclude=node_modules "$project_dir/" "$plugin_dir/"

for packaged_path in /usr/share/omarchy/*; do
  packaged_name=${packaged_path##*/}
  [[ $packaged_name == shell ]] && continue
  ln -s "$packaged_path" "$test_omarchy/$packaged_name"
done
cp -a /usr/share/omarchy/shell "$test_omarchy/shell"

cp "$project_dir/tests/fixtures/hyprctl-onboarding-stub.sh" "$stub_bin/hyprctl"
chmod +x "$stub_bin/hyprctl"
for optional_tool in qalc fd; do
  printf '%s\n' '#!/bin/sh' 'exit 0' >"$stub_bin/$optional_tool"
  chmod +x "$stub_bin/$optional_tool"
done
printf '%s\n' '-- Isolated onboarding test bindings' >"$test_home/.config/hypr/bindings.lua"
jq -n --arg id "$plugin_id" '{
  version: 1,
  bar: {
    layout: {
      left: [{id: "omarchy.menu"}, {id: "omarchy.workspaces"}],
      center: [{id: "omarchy.clock"}],
      right: [{id: $id}]
    }
  }
}' >"$shell_config"

test ! -e "$state_file" || fail "the isolated state was not empty"

[[ -n ${WAYLAND_DISPLAY:-} ]] || fail "a parent Wayland session is required"
HYPRLAND_NO_SD_VARS=1 Hyprland --config "$project_dir/tests/fixtures/nested-hyprland.conf" \
  >"$hyprland_log" 2>&1 &
hyprland_pid=$!

nested_lock=""
for ((attempt = 0; attempt < 100; attempt++)); do
  for candidate in "$host_runtime_dir"/hypr/*/hyprland.lock; do
    [[ -f $candidate ]] || continue
    if [[ $(sed -n '1p' "$candidate") == "$hyprland_pid" ]]; then
      nested_lock="$candidate"
      break 2
    fi
  done
  kill -0 "$hyprland_pid" 2>/dev/null || fail "the nested Hyprland compositor exited"
  sleep 0.05
done
[[ -n $nested_lock ]] || fail "the nested Hyprland compositor did not publish its socket"
nested_wayland_display=$(sed -n '2p' "$nested_lock")
nested_hyprland_signature=${nested_lock%/hyprland.lock}
nested_hyprland_signature=${nested_hyprland_signature##*/}

if [[ $visible == false && -n $host_hyprland_signature ]]; then
  nested_address=""
  for ((attempt = 0; attempt < 40; attempt++)); do
    nested_address=$(/usr/bin/hyprctl -i "$host_hyprland_signature" clients -j 2>/dev/null \
      | jq -r --argjson pid "$hyprland_pid" '.[] | select(.pid == $pid) | .address' | head -n1)
    [[ -n $nested_address ]] && break
    sleep 0.05
  done
  if [[ -n $nested_address ]]; then
    hide_expression="return hl.dispatch(hl.dsp.window.move({ workspace = \"special:omalauncher-test\", follow = false, window = \"address:$nested_address\" }))"
    /usr/bin/hyprctl -i "$host_hyprland_signature" eval "$hide_expression" >/dev/null
  fi
fi

env \
  HOME="$test_home" \
  XDG_CONFIG_HOME="$test_home/.config" \
  XDG_STATE_HOME="$test_home/.local/state" \
  XDG_CACHE_HOME="$test_home/.cache" \
  OMARCHY_PATH="$test_omarchy" \
  OMALAUNCHER_ONBOARDING_HYPR_LOG="$hypr_log" \
  PATH="$stub_bin:$PATH" \
  WAYLAND_DISPLAY="$nested_wayland_display" \
  HYPRLAND_INSTANCE_SIGNATURE="$nested_hyprland_signature" \
  QT_QPA_PLATFORM=wayland \
  QT_QUICK_BACKEND=software \
  quickshell --no-color -p "$test_omarchy/shell" >"$runtime_log" 2>&1 &
quickshell_pid=$!

wait_for_ipc shell ping ok >/dev/null
wait_for_plugin
ipc shell toggle "$plugin_id" '{"source":"onboarding-test"}' >/dev/null
stats=$(wait_for_stats)

jq -e '
  .stateReady == true
  and .onboarding.visible == true
  and .onboarding.stage == "pending"
  and .onboarding.accessibleName == "Welcome to Omalauncher"
' <<<"$stats" >/dev/null || fail "empty state did not present pending onboarding"

printf '%s\n' '✓ empty state opens Welcome Setup'
demo_pause

stats=$(wait_for_stats_matching '
  .onboarding.visible == true
  and .onboarding.busy == false
  and .onboarding.replacesMenu == true
  and .onboarding.primaryAction == "Replace Omarchy Menu"
' "the recommended shortcut replacement did not become ready")
press_enter

stats=$(wait_for_stats_matching '
  .onboarding.visible == true
  and .onboarding.stage == "dependencies"
  and .onboarding.status == "dependencies"
  and .onboarding.calculatorAvailable == true
  and .onboarding.fileSearchAvailable == true
  and .onboarding.primaryAction == "Continue"
' "replacing the shortcut did not advance onboarding to optional features")
printf '%s\n' '✓ optional features are presented without blocking setup'
demo_pause
press_enter

stats=$(wait_for_stats_matching '
  .onboarding.visible == true
  and .onboarding.stage == "verify"
  and .onboarding.status == "verify"
  and .onboarding.primaryAction == "Close and try it"
' "optional features did not advance onboarding to verification")
jq -e '.onboarding.hotkey == "SUPER + SPACE"' <<<"$stats" >/dev/null \
  || fail "onboarding saved the wrong shortcut"
rg -q --fixed-strings -- '-- launcher: {"hotkey":"SUPER + SPACE"}' \
  "$test_home/.config/hypr/bindings.lua" \
  || fail "the launcher shortcut was not written"
rg -q --fixed-strings -- '-- menu: {"hotkey":"SUPER + R"}' \
  "$test_home/.config/hypr/bindings.lua" \
  || fail "the Omarchy Menu fallback was not written"
printf '%s\n' '✓ recommended shortcut replaces Omarchy Menu safely'
demo_pause

press_enter
wait_for_stats_matching '
  .launcherOpen == false
  and .onboarding.visible == false
  and .onboarding.status == "verify"
' "the verification action did not close Omalauncher" >/dev/null
printf '%s\n' '✓ verification closes Omalauncher'
demo_pause

ipc shell summon "$plugin_id" '{"source":"hotkey"}' >/dev/null
wait_for_stats_matching '
  .launcherOpen == true
  and .onboarding.visible == false
  and .onboarding.status == "complete"
' "reopening from the launcher shortcut did not complete onboarding" >/dev/null
printf '%s\n' '✓ reopening from the shortcut completes onboarding'

for ((attempt = 0; attempt < 40; attempt++)); do
  if [[ -f $state_file ]] && jq -e '
    .onboarding.status == "complete"
    and .onboarding.hotkey == "SUPER + SPACE"
    and .onboarding.showCoach == true
  ' "$state_file" >/dev/null 2>&1; then
    printf '%s\n' 'Onboarding runtime journey passed.'
    exit 0
  fi
  sleep 0.05
done
fail "completed onboarding state was not persisted"
