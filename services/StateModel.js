// Pure persistent-state helpers shared by QML and Node tests.

var STATE_VERSION = 1

function emptyState() {
  return { version: STATE_VERSION, favorites: [], usage: {} }
}

function validId(value) {
  return String(value || "").trim()
}

function normalizeState(value) {
  var source = value && typeof value === "object" ? value : {}
  var favorites = []
  var seen = {}
  var sourceFavorites = Array.isArray(source.favorites) ? source.favorites : []

  for (var i = 0; i < sourceFavorites.length; i++) {
    var favoriteId = validId(sourceFavorites[i])
    if (!favoriteId || seen[favoriteId]) continue
    seen[favoriteId] = true
    favorites.push(favoriteId)
  }

  var usage = {}
  var sourceUsage = source.usage && typeof source.usage === "object" ? source.usage : {}
  for (var id in sourceUsage) {
    if (!Object.prototype.hasOwnProperty.call(sourceUsage, id)) continue
    var normalizedId = validId(id)
    var entry = sourceUsage[id]
    if (!normalizedId || !entry || typeof entry !== "object") continue
    var count = Math.floor(Number(entry.count || 0))
    var lastUsed = Math.floor(Number(entry.lastUsed || 0))
    if (!isFinite(count) || count < 0) count = 0
    if (!isFinite(lastUsed) || lastUsed < 0) lastUsed = 0
    if (count === 0 && lastUsed === 0) continue
    usage[normalizedId] = { count: count, lastUsed: lastUsed }
  }

  return { version: STATE_VERSION, favorites: favorites, usage: usage }
}

function parseState(raw) {
  return parseStateResult(raw).state
}

function parseStateResult(raw) {
  var text = String(raw || "").trim()
  if (!text) return { state: emptyState(), error: "" }
  try {
    return { state: normalizeState(JSON.parse(text)), error: "" }
  } catch (error) {
    return { state: emptyState(), error: "Launcher state is malformed; using temporary defaults" }
  }
}

function serializeState(state) {
  return JSON.stringify(normalizeState(state), null, 2) + "\n"
}

function isFavorite(state, id) {
  var target = validId(id)
  if (!target) return false
  var favorites = state && Array.isArray(state.favorites) ? state.favorites : []
  return favorites.indexOf(target) >= 0
}

function toggleFavorite(state, id) {
  var current = normalizeState(state)
  var target = validId(id)
  if (!target) return current

  var favorites = current.favorites.slice()
  var index = favorites.indexOf(target)
  if (index >= 0) favorites.splice(index, 1)
  else favorites.unshift(target)

  return { version: STATE_VERSION, favorites: favorites, usage: current.usage }
}

function recordUsage(state, id, now) {
  var current = normalizeState(state)
  var target = validId(id)
  if (!target) return current

  var timestamp = Math.floor(Number(now || Date.now()))
  if (!isFinite(timestamp) || timestamp < 0) timestamp = Date.now()
  var usage = {}
  for (var key in current.usage) {
    if (Object.prototype.hasOwnProperty.call(current.usage, key)) usage[key] = current.usage[key]
  }
  var previous = usage[target] || { count: 0, lastUsed: 0 }
  usage[target] = {
    count: Math.max(0, Number(previous.count || 0)) + 1,
    lastUsed: timestamp
  }

  return { version: STATE_VERSION, favorites: current.favorites, usage: usage }
}

function resetUsage(state, id) {
  var current = normalizeState(state)
  var target = validId(id)
  if (!target) return { version: STATE_VERSION, favorites: current.favorites, usage: {} }

  var usage = {}
  for (var key in current.usage) {
    if (key !== target && Object.prototype.hasOwnProperty.call(current.usage, key)) usage[key] = current.usage[key]
  }
  return { version: STATE_VERSION, favorites: current.favorites, usage: usage }
}

function copyRecord(record, section, favorite) {
  var copy = {}
  for (var key in record) {
    if (Object.prototype.hasOwnProperty.call(record, key)) copy[key] = record[key]
  }
  copy.section = section
  copy.favorite = !!favorite
  return copy
}

function emptyStateRows(records, state, options) {
  var current = normalizeState(state)
  var opts = options || {}
  var favoriteLimit = Math.max(0, Number(opts.favoriteLimit === undefined ? 8 : opts.favoriteLimit))
  var recentApplicationLimit = Math.max(0, Number(opts.recentApplicationLimit === undefined ? 4 : opts.recentApplicationLimit))
  var recentCommandLimit = Math.max(0, Number(opts.recentCommandLimit === undefined ? 4 : opts.recentCommandLimit))
  var byId = {}
  var rows = []
  var favoriteSet = {}

  for (var i = 0; i < (records || []).length; i++) {
    var record = records[i]
    var recordId = validId(record && record.id)
    if (recordId) byId[recordId] = record
  }

  for (var s = 0; s < current.favorites.length; s++) favoriteSet[current.favorites[s]] = true

  for (var f = 0; f < current.favorites.length && rows.length < favoriteLimit; f++) {
    var favoriteId = current.favorites[f]
    var favoriteRecord = byId[favoriteId]
    if (!favoriteRecord) continue
    rows.push(copyRecord(favoriteRecord, "Favorites", true))
  }

  var recentApplications = []
  var recentCommands = []
  for (var id in current.usage) {
    if (!Object.prototype.hasOwnProperty.call(current.usage, id) || favoriteSet[id] || !byId[id]) continue
    var candidate = { record: byId[id], usage: current.usage[id] }
    if (byId[id].type === "application") recentApplications.push(candidate)
    else recentCommands.push(candidate)
  }

  function recentOrder(left, right) {
    if (left.usage.lastUsed !== right.usage.lastUsed) return right.usage.lastUsed - left.usage.lastUsed
    if (left.usage.count !== right.usage.count) return right.usage.count - left.usage.count
    return String(left.record.title || left.record.id).localeCompare(String(right.record.title || right.record.id))
  }

  recentApplications.sort(recentOrder)
  recentCommands.sort(recentOrder)
  for (var a = 0; a < recentApplications.length && a < recentApplicationLimit; a++) {
    rows.push(copyRecord(recentApplications[a].record, "Recent Applications", false))
  }
  for (var c = 0; c < recentCommands.length && c < recentCommandLimit; c++) {
    rows.push(copyRecord(recentCommands[c].record, "Recent Commands", false))
  }
  return rows
}

if (typeof module !== "undefined") {
  module.exports = {
    STATE_VERSION: STATE_VERSION,
    emptyState: emptyState,
    normalizeState: normalizeState,
    parseState: parseState,
    parseStateResult: parseStateResult,
    serializeState: serializeState,
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    recordUsage: recordUsage,
    resetUsage: resetUsage,
    emptyStateRows: emptyStateRows
  }
}
