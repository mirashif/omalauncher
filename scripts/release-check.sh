#!/bin/bash

set -euo pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
omarchy_path="${OMARCHY_PATH:-/usr/share/omarchy}"

cd "$project_dir"

manifest_version=$(jq -r '.version' manifest.json)
package_version=$(jq -r '.version' package.json)
if [[ $manifest_version != "$package_version" ]]; then
  echo "release-check: manifest version $manifest_version does not match package version $package_version" >&2
  exit 1
fi

node --test tests/*.test.js
omarchy plugin validate "$project_dir"

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

bash "$project_dir/scripts/package-smoke-test.sh"

if git -C "$project_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$project_dir" diff --check
fi

echo "Omalauncher release checks passed."
