// User-facing launcher state derived from provider readiness and errors.

function cleanWarnings(values) {
  var warnings = []
  var seen = {}
  for (var i = 0; i < (values || []).length; i++) {
    var warning = String(values[i] || "").trim()
    if (!warning || seen[warning]) continue
    seen[warning] = true
    warnings.push(warning)
  }
  return warnings
}

function warningText(values) {
  return cleanWarnings(values).join(" · ")
}

function emptyStatus(options) {
  var opts = options || {}
  var resultCount = Math.max(0, Number(opts.resultCount || 0))
  var totalRecords = Math.max(0, Number(opts.totalRecords || 0))
  var query = String(opts.query || "").trim()
  var warnings = cleanWarnings(opts.warnings)

  if (resultCount > 0) return { visible: false, kind: "", title: "", detail: "" }
  if (!opts.stateReady) {
    return {
      visible: true,
      kind: "loading",
      title: "Loading launcher state…",
      detail: "Favorites and usage history will be ready shortly."
    }
  }
  if (!opts.indexSettled) {
    return {
      visible: true,
      kind: "loading",
      title: query ? "Still building the unified index…" : "Building unified index…",
      detail: warnings.length ? warnings[0] : "Loading applications and Omarchy commands."
    }
  }
  if (warnings.length && totalRecords === 0) {
    return {
      visible: true,
      kind: "error",
      title: warnings[0],
      detail: warnings.length > 1 ? warnings.slice(1).join(" · ") : "See Troubleshooting in the README for recovery steps."
    }
  }
  if (query) {
    return {
      visible: true,
      kind: "empty",
      title: "No matching applications or commands",
      detail: warnings.length ? "Partial index: " + warnings.join(" · ") : "Try a title, breadcrumb, alias, or command ID."
    }
  }
  return {
    visible: true,
    kind: "empty",
    title: "No favorites or recent items yet",
    detail: warnings.length ? "Partial index: " + warnings.join(" · ") : "Start typing to search applications and Omarchy commands."
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    cleanWarnings: cleanWarnings,
    warningText: warningText,
    emptyStatus: emptyStatus
  }
}
