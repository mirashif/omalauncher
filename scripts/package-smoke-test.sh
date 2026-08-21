#!/bin/bash

set -euo pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
temporary_root=$(mktemp -d "${TMPDIR:-/tmp}/omalauncher-smoke.XXXXXX")

cleanup() {
  case "${temporary_root:-}" in
    */omalauncher-smoke.*) rm -rf -- "$temporary_root" ;;
  esac
}
trap cleanup EXIT

source_repo="$temporary_root/source"
test_home="$temporary_root/home"
stub_bin="$temporary_root/bin"
shell_log="$temporary_root/omarchy-shell.log"
plugin_id=$(jq -r '.id' "$project_dir/manifest.json")
installed_plugin="$test_home/.config/omarchy/plugins/$plugin_id"
shell_config="$test_home/.config/omarchy/shell.json"

mkdir -p "$source_repo" "$test_home" "$stub_bin"
rsync -a --exclude=.git --exclude=node_modules "$project_dir/" "$source_repo/"

git -C "$source_repo" init -q
git -C "$source_repo" add -A
git -C "$source_repo" \
  -c user.name="Omalauncher Smoke Test" \
  -c user.email="smoke-test@localhost" \
  commit -qm "Package smoke test"

cp "$project_dir/tests/fixtures/omarchy-shell-stub.sh" "$stub_bin/omarchy-shell"
chmod +x "$stub_bin/omarchy-shell"

export OMARCHY_PATH="${OMARCHY_PATH:-/usr/share/omarchy}"
export OMALAUNCHER_SMOKE_PLUGIN_ID="$plugin_id"
export OMALAUNCHER_SMOKE_SHELL_CONFIG="$shell_config"
export OMALAUNCHER_SMOKE_SHELL_LOG="$shell_log"
HOME="$test_home" PATH="$stub_bin:$PATH" \
  omarchy plugin add "file://$source_repo" --enable --yes >/dev/null

test -f "$installed_plugin/manifest.json"
test -d "$installed_plugin/.git"
omarchy plugin validate "$installed_plugin"
grep -Fqx "shell enablePlugin $plugin_id {}" "$shell_log"
jq -e --arg id "$plugin_id" '
  [.bar.layout.right[] | select(.id == $id)] | length == 1
' "$shell_config" >/dev/null
HOME="$test_home" PATH="$stub_bin:$PATH" omarchy plugin list --json | jq -e --arg id "$plugin_id" '
  [.[] | select(.id == $id and .enabled == true)] | length == 1
' >/dev/null

HOME="$test_home" PATH="$stub_bin:$PATH" \
  omarchy plugin remove "$plugin_id" --yes >/dev/null
test ! -e "$installed_plugin"
jq -e --arg id "$plugin_id" '
  [.bar.layout | to_entries[] | .value[] | select(.id == $id)] | length == 0
' "$shell_config" >/dev/null

echo "Package install/remove smoke test passed."
