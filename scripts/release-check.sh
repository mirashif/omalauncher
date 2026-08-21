#!/bin/bash

set -euo pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
omarchy_path="${OMARCHY_PATH:-/usr/share/omarchy}"
validation_root=$(mktemp -d "${TMPDIR:-/tmp}/omalauncher-validate.XXXXXX")

cleanup() {
  case "${validation_root:-}" in
    */omalauncher-validate.*) rm -rf -- "$validation_root" ;;
  esac
}
trap cleanup EXIT

cd "$project_dir"

npm run typecheck
npm run lint:types

manifest_version=$(jq -r '.version' manifest.json)
package_version=$(jq -r '.version' package.json)
if [[ $manifest_version != "$package_version" ]]; then
  echo "release-check: manifest version $manifest_version does not match package version $package_version" >&2
  exit 1
fi

node --test tests/*.test.js
rsync -a --exclude=.git --exclude=node_modules "$project_dir/" "$validation_root/"
omarchy plugin validate "$validation_root"

if command -v qmllint >/dev/null 2>&1; then
  qml_lint=$(command -v qmllint)
elif [[ -x /usr/lib/qt6/bin/qmllint ]]; then
  qml_lint=/usr/lib/qt6/bin/qmllint
else
  echo "release-check: qmllint was not found" >&2
  exit 1
fi

mapfile -t qml_files < <(find "$project_dir" -type f -name '*.qml' \
  ! -path '*/.git/*' ! -path '*/node_modules/*' | sort)

# qs.Commons is a Quickshell runtime namespace rather than a standalone QML
# module. Disable only the context-dependent diagnostics; syntax, properties,
# bindings, and the remaining static checks still fail the release check.
"$qml_lint" -W 0 \
  --import disable \
  --unqualified disable \
  --uncreatable-type disable \
  --signal-handler-parameters disable \
  -I "$omarchy_path/shell" \
  -I /usr/lib/qt6/qml \
  "${qml_files[@]}"

if [[ -n ${WAYLAND_DISPLAY:-} ]] \
    && command -v Hyprland >/dev/null \
    && command -v quickshell >/dev/null \
    && command -v wtype >/dev/null; then
  bash "$project_dir/scripts/onboarding-runtime-test.sh"
else
  echo "release-check: skipping onboarding runtime test outside a Wayland session"
fi

bash "$project_dir/scripts/package-smoke-test.sh"

if git -C "$project_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$project_dir" diff --check
fi

echo "Omalauncher release checks passed."
