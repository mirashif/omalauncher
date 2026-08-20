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
plugin_id=$(jq -r '.id' "$project_dir/manifest.json")
installed_plugin="$test_home/.config/omarchy/plugins/$plugin_id"

mkdir -p "$source_repo" "$test_home" "$stub_bin"
rsync -a --exclude=.git --exclude=node_modules "$project_dir/" "$source_repo/"

git -C "$source_repo" init -q
git -C "$source_repo" add -A
git -C "$source_repo" \
  -c user.name="Omalauncher Smoke Test" \
  -c user.email="smoke-test@localhost" \
  commit -qm "Package smoke test"

printf '%s\n' \
  '#!/bin/sh' \
  'if [ "${2:-}" = "listPlugins" ]; then printf "[]\\n"; fi' \
  'exit 0' >"$stub_bin/omarchy-shell"
chmod +x "$stub_bin/omarchy-shell"

export OMARCHY_PATH="${OMARCHY_PATH:-/usr/share/omarchy}"
HOME="$test_home" PATH="$stub_bin:$PATH" \
  omarchy plugin add "file://$source_repo" --yes >/dev/null

test -f "$installed_plugin/manifest.json"
test -d "$installed_plugin/.git"
omarchy plugin validate "$installed_plugin"

HOME="$test_home" PATH="$stub_bin:$PATH" \
  omarchy plugin remove "$plugin_id" --yes >/dev/null
test ! -e "$installed_plugin"

echo "Package install/remove smoke test passed."
