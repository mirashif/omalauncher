// User-facing launcher state derived from provider readiness and errors.

/** @typedef {import("../types/models").ProviderDiagnosticInput} ProviderDiagnosticInput */
/** @typedef {import("../types/models").ProviderDiagnostic} ProviderDiagnostic */
/** @typedef {import("../types/models").EmptyStatusOptions} EmptyStatusOptions */
/** @typedef {import("../types/models").EmptyStatus} EmptyStatus */

/**
 * @param {readonly unknown[] | null | undefined} values
 * @returns {string[]}
 */
function cleanWarnings(values) {
  /** @type {string[]} */
  var warnings = []
  /** @type {Record<string, boolean>} */
  var seen = {}
  var source = values || []
  for (var i = 0; i < source.length; i++) {
    var warning = String(source[i] || "").trim()
    if (!warning || seen[warning]) continue
    seen[warning] = true
    warnings.push(warning)
  }
  return warnings
}

/**
 * @param {readonly unknown[] | null | undefined} values
 * @returns {string}
 */
function warningText(values) {
  return cleanWarnings(values).join(" · ")
}

/**
 * @param {readonly ProviderDiagnosticInput[] | null | undefined} entries
 * @returns {ProviderDiagnostic[]}
 */
function providerDiagnostics(entries) {
  /** @type {ProviderDiagnostic[]} */
  var diagnostics = []
  /** @type {Record<string, boolean>} */
  var seen = {}
  var values = entries || []
  for (var i = 0; i < values.length; i++) {
    var entry = values[i]
    if (!entry) continue
    var error = String(entry.error || "").trim()
    if (!error) continue
    var provider = String(entry.provider || "Provider").trim() || "Provider"
    var detail = String(entry.detail || error).trim() || error
    var key = provider + "\n" + error + "\n" + detail
    if (seen[key]) continue
    seen[key] = true
    diagnostics.push({ provider: provider, error: error, detail: detail })
  }
  return diagnostics
}

/**
 * @param {EmptyStatusOptions | null | undefined} options
 * @returns {EmptyStatus}
 */
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
      detail: warnings.length ? String(warnings[0]) : "Loading applications, shell features, and Omarchy commands."
    }
  }
  if (warnings.length && totalRecords === 0) {
    return {
      visible: true,
      kind: "error",
      title: String(warnings[0]),
      detail: warnings.length > 1 ? warnings.slice(1).join(" · ") : "See Troubleshooting in the README for recovery steps."
    }
  }
  if (query) {
    return {
      visible: true,
      kind: "empty",
      title: "No matching results",
      detail: warnings.length
        ? "Partial index: " + warnings.join(" · ")
        : "Try fewer words or search by an app, setting, or action name."
    }
  }
  return {
    visible: true,
    kind: "empty",
    title: "No applications, shell features, or commands available",
    detail: warnings.length ? "Partial index: " + warnings.join(" · ") : "The unified index is empty."
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    cleanWarnings: cleanWarnings,
    warningText: warningText,
    providerDiagnostics: providerDiagnostics,
    emptyStatus: emptyStatus
  }
}
