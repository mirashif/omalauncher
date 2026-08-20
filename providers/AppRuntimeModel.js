// Conservative Hyprland window identity helpers for application Quit/Restart.

/** @typedef {import("../types/models").AppRuntimeSnapshot} AppRuntimeSnapshot */
/** @typedef {import("../types/models").AppRuntimeWindow} AppRuntimeWindow */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** @param {unknown} value @returns {value is unknown[]} */
function isUnknownArray(value) {
  return Array.isArray(value)
}

/** @param {unknown} value @returns {string} */
function identity(value) {
  return String(value || "").trim().replace(/\.desktop$/i, "").toLowerCase()
}

/** @returns {AppRuntimeSnapshot} */
function emptySnapshot() {
  return {
    supported: false,
    appId: "",
    startupClass: "",
    identity: "",
    running: false,
    windows: [],
    error: ""
  }
}

/**
 * @param {unknown} json
 * @param {unknown} appId
 * @param {unknown} startupClass
 * @returns {AppRuntimeSnapshot}
 */
function runtimeSnapshot(json, appId, startupClass) {
  var id = String(appId || "").trim().replace(/\.desktop$/i, "")
  var startup = String(startupClass || "").trim()
  var matchIdentity = identity(startup || id)
  var snapshot = emptySnapshot()
  snapshot.appId = id
  snapshot.startupClass = startup
  snapshot.identity = matchIdentity
  if (!id || !matchIdentity || /[\r\n\0]/.test(matchIdentity)) {
    snapshot.error = "Application identity is unavailable"
    return snapshot
  }

  /** @type {unknown} */
  var parsed
  try {
    parsed = JSON.parse(String(json || "[]"))
  } catch (error) {
    snapshot.error = "Hyprland returned invalid window data"
    return snapshot
  }
  if (!isUnknownArray(parsed)) {
    snapshot.error = "Hyprland returned unsupported window data"
    return snapshot
  }

  /** @type {Array<{row: Record<string, unknown>, address: string, pid: number}>} */
  var validRows = []
  /** @type {Record<string, boolean>} */
  var matchedPids = {}
  for (var i = 0; i < parsed.length; i++) {
    var row = parsed[i]
    if (!isRecord(row) || row["mapped"] === false) continue
    var address = String(row["address"] || "")
    var pid = Number(row["pid"] || 0)
    if (!/^0x[0-9a-f]+$/i.test(address) || !Number.isSafeInteger(pid) || pid <= 0) continue
    validRows.push({ row: row, address: address, pid: pid })
    var currentClass = identity(row["class"])
    var initialClass = identity(row["initialClass"])
    if (currentClass === matchIdentity || initialClass === matchIdentity) {
      matchedPids[String(pid)] = true
    }
  }

  /** @type {AppRuntimeWindow[]} */
  var windows = []
  /** @type {Record<string, boolean>} */
  var seenAddresses = {}
  for (var v = 0; v < validRows.length; v++) {
    var candidate = validRows[v]
    if (!candidate) continue
    var candidateClass = identity(candidate.row["class"])
    var candidateInitialClass = identity(candidate.row["initialClass"])
    var exactClass = candidateClass === matchIdentity || candidateInitialClass === matchIdentity
    if (!exactClass && matchedPids[String(candidate.pid)] !== true) continue
    if (seenAddresses[candidate.address]) continue
    seenAddresses[candidate.address] = true
    windows.push({
      address: candidate.address,
      pid: candidate.pid,
      className: String(candidate.row["class"] || candidate.row["initialClass"] || ""),
      title: String(candidate.row["title"] || candidate.row["initialTitle"] || "")
    })
  }

  snapshot.supported = true
  snapshot.running = windows.length > 0
  snapshot.windows = windows
  return snapshot
}

/**
 * @param {AppRuntimeSnapshot | null | undefined} snapshot
 * @param {unknown} appId
 * @param {unknown} startupClass
 * @returns {boolean}
 */
function matchesTarget(snapshot, appId, startupClass) {
  var state = snapshot || emptySnapshot()
  return state.supported === true
    && state.appId === String(appId || "").trim().replace(/\.desktop$/i, "")
    && state.identity === identity(String(startupClass || "").trim() || appId)
}

/** @param {unknown} address @returns {string} */
function closeExpression(address) {
  var value = String(address || "")
  if (!/^0x[0-9a-f]+$/i.test(value)) return ""
  return "hl.dsp.window.close({ window = \"address:" + value + "\" })"
}

/** @param {unknown} json @param {readonly unknown[] | null | undefined} addresses @returns {string[]} */
function presentAddresses(json, addresses) {
  /** @type {Record<string, boolean>} */
  var expected = {}
  var values = addresses || []
  for (var i = 0; i < values.length; i++) {
    var address = String(values[i] || "")
    if (/^0x[0-9a-f]+$/i.test(address)) expected[address.toLowerCase()] = true
  }
  /** @type {unknown} */
  var parsed
  try { parsed = JSON.parse(String(json || "[]")) } catch (error) { return Object.keys(expected) }
  if (!isUnknownArray(parsed)) return Object.keys(expected)
  var present = []
  for (var rowIndex = 0; rowIndex < parsed.length; rowIndex++) {
    var row = parsed[rowIndex]
    if (!isRecord(row)) continue
    var current = String(row["address"] || "").toLowerCase()
    if (expected[current] === true) present.push(current)
  }
  return present
}

if (typeof module !== "undefined") {
  module.exports = {
    identity: identity,
    emptySnapshot: emptySnapshot,
    runtimeSnapshot: runtimeSnapshot,
    matchesTarget: matchesTarget,
    closeExpression: closeExpression,
    presentAddresses: presentAddresses
  }
}
