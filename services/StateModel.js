// Pure persistent-state helpers shared by QML and Node tests.

var STATE_VERSION = 2
var QUERY_HISTORY_LIMIT = 50

function emptyPreferences() {
  return { compactMode: false }
}

function emptyState() {
  return {
    version: STATE_VERSION,
    favorites: [],
    usage: {},
    aliases: {},
    hidden: [],
    queryHistory: [],
    preferences: emptyPreferences()
  }
}

function validId(value) {
  return String(value || "").trim()
}

function validText(value) {
  return String(value || "").trim()
}

function stateWith(state, changes) {
  var current = normalizeState(state)
  var next = {
    version: STATE_VERSION,
    favorites: current.favorites,
    usage: current.usage,
    aliases: current.aliases,
    hidden: current.hidden,
    queryHistory: current.queryHistory,
    preferences: current.preferences
  }
  var updates = changes || {}
  for (var key in updates) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) next[key] = updates[key]
  }
  return next
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

  var aliases = {}
  var sourceAliases = source.aliases && typeof source.aliases === "object" && !Array.isArray(source.aliases)
    ? source.aliases : {}
  for (var aliasId in sourceAliases) {
    if (!Object.prototype.hasOwnProperty.call(sourceAliases, aliasId)) continue
    var normalizedAliasId = validId(aliasId)
    var alias = validText(sourceAliases[aliasId])
    if (!normalizedAliasId || !alias) continue
    aliases[normalizedAliasId] = alias.slice(0, 64)
  }

  var hidden = []
  var hiddenSeen = {}
  var sourceHidden = Array.isArray(source.hidden) ? source.hidden : []
  for (var h = 0; h < sourceHidden.length; h++) {
    var hiddenId = validId(sourceHidden[h])
    if (!hiddenId || hiddenSeen[hiddenId]) continue
    hiddenSeen[hiddenId] = true
    hidden.push(hiddenId)
  }

  var queryHistory = []
  var historySeen = {}
  var sourceHistory = Array.isArray(source.queryHistory) ? source.queryHistory : []
  for (var q = 0; q < sourceHistory.length && queryHistory.length < QUERY_HISTORY_LIMIT; q++) {
    var query = validText(sourceHistory[q])
    var queryKey = query.toLowerCase()
    if (!query || historySeen[queryKey]) continue
    historySeen[queryKey] = true
    queryHistory.push(query.slice(0, 256))
  }

  var sourcePreferences = source.preferences && typeof source.preferences === "object"
    ? source.preferences : {}
  var preferences = { compactMode: sourcePreferences.compactMode === true }

  return {
    version: STATE_VERSION,
    favorites: favorites,
    usage: usage,
    aliases: aliases,
    hidden: hidden,
    queryHistory: queryHistory,
    preferences: preferences
  }
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

  return stateWith(current, { favorites: favorites })
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

  return stateWith(current, { usage: usage })
}

function resetUsage(state, id) {
  var current = normalizeState(state)
  var target = validId(id)
  if (!target) return stateWith(current, { usage: {} })

  var usage = {}
  for (var key in current.usage) {
    if (key !== target && Object.prototype.hasOwnProperty.call(current.usage, key)) usage[key] = current.usage[key]
  }
  return stateWith(current, { usage: usage })
}

function aliasFor(state, id) {
  var current = normalizeState(state)
  var target = validId(id)
  return target && current.aliases[target] ? current.aliases[target] : ""
}

function setAlias(state, id, value) {
  var current = normalizeState(state)
  var target = validId(id)
  var alias = validText(value).slice(0, 64)
  if (!target) return current
  var aliases = {}
  for (var key in current.aliases) {
    if (Object.prototype.hasOwnProperty.call(current.aliases, key) && key !== target) aliases[key] = current.aliases[key]
  }
  if (alias) aliases[target] = alias
  return stateWith(current, { aliases: aliases })
}

function isHidden(state, id) {
  var current = normalizeState(state)
  var target = validId(id)
  return !!target && current.hidden.indexOf(target) >= 0
}

function setHidden(state, id, hiddenValue) {
  var current = normalizeState(state)
  var target = validId(id)
  if (!target) return current
  var hidden = current.hidden.slice()
  var index = hidden.indexOf(target)
  if (hiddenValue && index < 0) hidden.unshift(target)
  else if (!hiddenValue && index >= 0) hidden.splice(index, 1)
  return stateWith(current, { hidden: hidden })
}

function recordQuery(state, value) {
  var current = normalizeState(state)
  var query = validText(value).slice(0, 256)
  if (!query) return current
  var queryKey = query.toLowerCase()
  var history = [query]
  for (var i = 0; i < current.queryHistory.length && history.length < QUERY_HISTORY_LIMIT; i++) {
    if (current.queryHistory[i].toLowerCase() !== queryKey) history.push(current.queryHistory[i])
  }
  return stateWith(current, { queryHistory: history })
}

function clearQueryHistory(state) {
  return stateWith(state, { queryHistory: [] })
}

function setCompactMode(state, enabled) {
  return stateWith(state, { preferences: { compactMode: enabled === true } })
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
  var favoriteLimit = Math.max(0, Number(opts.favoriteLimit === undefined ? (records || []).length : opts.favoriteLimit))
  var recentApplicationLimit = Math.max(0, Number(opts.recentApplicationLimit === undefined ? 4 : opts.recentApplicationLimit))
  var recentCommandLimit = Math.max(0, Number(opts.recentCommandLimit === undefined ? 4 : opts.recentCommandLimit))
  var byId = {}
  var rows = []
  var favoriteSet = {}
  var included = {}

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
    included[favoriteId] = true
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
    included[recentApplications[a].record.id] = true
  }
  for (var c = 0; c < recentCommands.length && c < recentCommandLimit; c++) {
    rows.push(copyRecord(recentCommands[c].record, "Recent Commands", false))
    included[recentCommands[c].record.id] = true
  }

  for (var r = 0; r < (records || []).length; r++) {
    var remainingRecord = records[r]
    var remainingId = validId(remainingRecord && remainingRecord.id)
    if (!remainingId || included[remainingId]) continue
    var section = String(remainingRecord.section || "")
      || (remainingRecord.type === "application" ? "Applications" : "Omarchy Commands")
    rows.push(copyRecord(remainingRecord, section, isFavorite(current, remainingId)))
    included[remainingId] = true
  }
  return rows
}

if (typeof module !== "undefined") {
  module.exports = {
    STATE_VERSION: STATE_VERSION,
    QUERY_HISTORY_LIMIT: QUERY_HISTORY_LIMIT,
    emptyState: emptyState,
    normalizeState: normalizeState,
    parseState: parseState,
    parseStateResult: parseStateResult,
    serializeState: serializeState,
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    recordUsage: recordUsage,
    resetUsage: resetUsage,
    aliasFor: aliasFor,
    setAlias: setAlias,
    isHidden: isHidden,
    setHidden: setHidden,
    recordQuery: recordQuery,
    clearQueryHistory: clearQueryHistory,
    setCompactMode: setCompactMode,
    emptyStateRows: emptyStateRows
  }
}
