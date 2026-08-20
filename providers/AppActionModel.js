// Safe desktop-entry resolution helpers shared by QML and Node tests.

/** @typedef {import("../types/models").DesktopEntryResolutionRequest} DesktopEntryResolutionRequest */

/** @returns {string} */
function resolverScript() {
  return [
    "set -eu",
    "target=${1%.desktop}",
    "[[ -n $target && $target != */* ]] || exit 2",
    "data_home=${XDG_DATA_HOME:-$HOME/.local/share}",
    "data_dirs=${XDG_DATA_DIRS:-/usr/local/share:/usr/share}",
    "roots=(\"$data_home/applications\")",
    "IFS=: read -r -a shared_roots <<< \"$data_dirs\"",
    "for shared_root in \"${shared_roots[@]}\"; do",
    "  [[ -n $shared_root ]] && roots+=(\"$shared_root/applications\")",
    "done",
    "for root in \"${roots[@]}\"; do",
    "  [[ -d $root ]] || continue",
    "  while IFS= read -r -d '' candidate; do",
    "    relative=${candidate#\"$root\"/}",
    "    candidate_id=${relative%.desktop}",
    "    candidate_id=${candidate_id//\\//-}",
    "    if [[ $candidate_id == \"$target\" ]]; then",
    "      realpath -e -- \"$candidate\"",
    "      exit 0",
    "    fi",
    "  done < <(find \"$root\" -type f -name '*.desktop' -print0 2>/dev/null)",
    "done",
    "exit 1"
  ].join("\n")
}

/**
 * @param {unknown} appId
 * @param {unknown} operation
 * @returns {DesktopEntryResolutionRequest}
 */
function resolutionRequest(appId, operation) {
  var id = String(appId || "").trim().replace(/\.desktop$/, "")
  var requestedOperation = String(operation || "")
  var validOperation = requestedOperation === "reveal" || requestedOperation === "copy-path"
  if (!id || id.indexOf("/") >= 0 || /[\r\n\0]/.test(id) || !validOperation) {
    return { active: false, appId: "", operation: "", command: [] }
  }
  return {
    active: true,
    appId: id,
    operation: requestedOperation,
    command: ["bash", "-c", resolverScript(), "omalauncher-desktop-entry", id]
  }
}

/** @param {unknown} output @returns {string} */
function resolvedPath(output) {
  var value = String(output || "").trim()
  if (!value || value.charAt(0) !== "/" || /[\r\n\0]/.test(value) || !value.endsWith(".desktop")) return ""
  return value
}

if (typeof module !== "undefined") {
  module.exports = {
    resolverScript: resolverScript,
    resolutionRequest: resolutionRequest,
    resolvedPath: resolvedPath
  }
}
