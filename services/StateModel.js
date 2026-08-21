// Pure persistent-state helpers shared by QML and Node tests.

/** @typedef {import("../types/models").UnknownRecord} UnknownRecord */
/** @typedef {import("../types/models").BooleanMap} BooleanMap */
/** @typedef {import("../types/models").StringMap} StringMap */
/** @typedef {import("../types/models").UsageMap} UsageMap */
/** @typedef {import("../types/models").Preferences} Preferences */
/** @typedef {import("../types/models").OnboardingState} OnboardingState */
/** @typedef {import("../types/models").LauncherState} LauncherState */
/** @typedef {import("../types/models").StateParseResult} StateParseResult */
/** @typedef {import("../types/models").BooleanPreferenceKey} BooleanPreferenceKey */
/** @typedef {import("../types/models").ListPreferenceKey} ListPreferenceKey */
/** @typedef {import("../types/models").SearchableRecord} SearchableRecord */
/** @typedef {import("../types/models").RecentRecord} RecentRecord */
/** @typedef {import("../types/models").EmptyRowsOptions} EmptyRowsOptions */

var STATE_VERSION = 1
var QUERY_HISTORY_LIMIT = 50

/** @returns {OnboardingState} */
function emptyOnboarding() {
  return {
    version: 1,
    status: "pending",
    hotkey: "",
    showCoach: false
  }
}

/** @returns {Preferences} */
function emptyPreferences() {
  return {
    compactMode: false,
    calculatorEnabled: true,
    fileSearchEnabled: false,
    quickActivationEnabled: true,
    fileSearchScopes: [],
    fileSearchIgnores: []
  }
}

/** @returns {LauncherState} */
function emptyState() {
  return {
    version: STATE_VERSION,
    favorites: [],
    usage: {},
    aliases: {},
    hidden: [],
    queryHistory: [],
    preferences: emptyPreferences(),
    onboarding: emptyOnboarding()
  }
}

/** @param {unknown} value @returns {string} */
function validId(value) {
  return String(value || "").trim()
}

/** @param {unknown} value @returns {string} */
function validText(value) {
  return String(value || "").trim()
}

/** @param {unknown} value @returns {string} */
function normalizeScope(value) {
  var scope = validText(value).replace(/\/+$/g, "")
  if (!scope || scope.charAt(0) !== "/" || scope === "/") return ""
  return scope.slice(0, 4096)
}

/** @param {unknown} value @returns {string} */
function normalizeIgnore(value) {
  var pattern = validText(value)
  if (!pattern || /[\r\n\0]/.test(pattern)) return ""
  return pattern.slice(0, 256)
}

/**
 * @param {unknown} values
 * @param {(value: unknown) => string} normalizer
 * @param {number} limit
 * @returns {string[]}
 */
function uniqueList(values, normalizer, limit) {
  var input = Array.isArray(values) ? values : []
  /** @type {string[]} */
  var output = []
  /** @type {BooleanMap} */
  var seen = {}
  for (var i = 0; i < input.length && output.length < limit; i++) {
    var value = normalizer(input[i])
    if (!value || seen[value]) continue
    seen[value] = true
    output.push(value)
  }
  return output
}

/**
 * @param {unknown} state
 * @param {Partial<LauncherState> | null | undefined} changes
 * @returns {LauncherState}
 */
function stateWith(state, changes) {
  var current = normalizeState(state)
  var updates = changes || {}
  return {
    version: STATE_VERSION,
    favorites: updates.favorites === undefined ? current.favorites : updates.favorites,
    usage: updates.usage === undefined ? current.usage : updates.usage,
    aliases: updates.aliases === undefined ? current.aliases : updates.aliases,
    hidden: updates.hidden === undefined ? current.hidden : updates.hidden,
    queryHistory: updates.queryHistory === undefined ? current.queryHistory : updates.queryHistory,
    preferences: updates.preferences === undefined ? current.preferences : updates.preferences,
    onboarding: updates.onboarding === undefined ? current.onboarding : updates.onboarding
  }
}

/** @param {unknown} value @returns {value is UnknownRecord} */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** @param {unknown} value @returns {LauncherState} */
function normalizeState(value) {
  var source = isRecord(value) ? value : {}
  /** @type {string[]} */
  var favorites = []
  /** @type {BooleanMap} */
  var seen = {}
  var sourceFavorites = Array.isArray(source["favorites"]) ? source["favorites"] : []

  for (var i = 0; i < sourceFavorites.length; i++) {
    var favoriteId = validId(sourceFavorites[i])
    if (!favoriteId || seen[favoriteId]) continue
    seen[favoriteId] = true
    favorites.push(favoriteId)
  }

  /** @type {UsageMap} */
  var usage = {}
  var sourceUsageValue = source["usage"]
  var sourceUsage = isRecord(sourceUsageValue) ? sourceUsageValue : {}
  for (var id in sourceUsage) {
    if (!Object.prototype.hasOwnProperty.call(sourceUsage, id)) continue
    var normalizedId = validId(id)
    var entry = sourceUsage[id]
    if (!normalizedId || !isRecord(entry)) continue
    var count = Math.floor(Number(entry["count"] || 0))
    var lastUsed = Math.floor(Number(entry["lastUsed"] || 0))
    if (!isFinite(count) || count < 0) count = 0
    if (!isFinite(lastUsed) || lastUsed < 0) lastUsed = 0
    if (count === 0 && lastUsed === 0) continue
    usage[normalizedId] = { count: count, lastUsed: lastUsed }
  }

  /** @type {StringMap} */
  var aliases = {}
  var sourceAliasesValue = source["aliases"]
  var sourceAliases = isRecord(sourceAliasesValue) ? sourceAliasesValue : {}
  for (var aliasId in sourceAliases) {
    if (!Object.prototype.hasOwnProperty.call(sourceAliases, aliasId)) continue
    var normalizedAliasId = validId(aliasId)
    var alias = validText(sourceAliases[aliasId])
    if (!normalizedAliasId || !alias) continue
    aliases[normalizedAliasId] = alias.slice(0, 64)
  }

  /** @type {string[]} */
  var hidden = []
  /** @type {BooleanMap} */
  var hiddenSeen = {}
  var sourceHidden = Array.isArray(source["hidden"]) ? source["hidden"] : []
  for (var h = 0; h < sourceHidden.length; h++) {
    var hiddenId = validId(sourceHidden[h])
    if (!hiddenId || hiddenSeen[hiddenId]) continue
    hiddenSeen[hiddenId] = true
    hidden.push(hiddenId)
  }

  /** @type {string[]} */
  var queryHistory = []
  /** @type {BooleanMap} */
  var historySeen = {}
  var sourceHistory = Array.isArray(source["queryHistory"]) ? source["queryHistory"] : []
  for (var q = 0; q < sourceHistory.length && queryHistory.length < QUERY_HISTORY_LIMIT; q++) {
    var query = validText(sourceHistory[q])
    var queryKey = query.toLowerCase()
    if (!query || historySeen[queryKey]) continue
    historySeen[queryKey] = true
    queryHistory.push(query.slice(0, 256))
  }

  var sourcePreferencesValue = source["preferences"]
  var sourcePreferences = isRecord(sourcePreferencesValue) ? sourcePreferencesValue : {}
  var defaults = emptyPreferences()
  /** @type {Preferences} */
  var preferences = {
    compactMode: sourcePreferences["compactMode"] === true,
    calculatorEnabled: sourcePreferences["calculatorEnabled"] === undefined
      ? defaults.calculatorEnabled : sourcePreferences["calculatorEnabled"] === true,
    fileSearchEnabled: sourcePreferences["fileSearchEnabled"] === true,
    quickActivationEnabled: sourcePreferences["quickActivationEnabled"] === undefined
      ? defaults.quickActivationEnabled : sourcePreferences["quickActivationEnabled"] === true,
    fileSearchScopes: uniqueList(sourcePreferences["fileSearchScopes"], normalizeScope, 32),
    fileSearchIgnores: uniqueList(sourcePreferences["fileSearchIgnores"], normalizeIgnore, 64)
  }

  var sourceOnboardingValue = source["onboarding"]
  var sourceOnboarding = isRecord(sourceOnboardingValue) ? sourceOnboardingValue : {}
  var rawOnboardingStatus = validText(sourceOnboarding["status"])
  /** @type {"pending" | "verify" | "complete"} */
  var onboardingStatus = rawOnboardingStatus === "verify" || rawOnboardingStatus === "complete"
    ? rawOnboardingStatus : "pending"
  var onboardingHotkey = validText(sourceOnboarding["hotkey"])
  if (/[^A-Za-z0-9_ +]/.test(onboardingHotkey) || onboardingHotkey.length > 64) {
    onboardingHotkey = ""
  }
  if (onboardingStatus === "verify" && !onboardingHotkey) onboardingStatus = "pending"
  /** @type {OnboardingState} */
  var onboarding = {
    version: 1,
    status: onboardingStatus,
    hotkey: onboardingHotkey,
    showCoach: onboardingStatus === "complete" && sourceOnboarding["showCoach"] === true
  }

  return {
    version: STATE_VERSION,
    favorites: favorites,
    usage: usage,
    aliases: aliases,
    hidden: hidden,
    queryHistory: queryHistory,
    preferences: preferences,
    onboarding: onboarding
  }
}

/** @param {unknown} raw @returns {LauncherState} */
function parseState(raw) {
  return parseStateResult(raw).state
}

/** @param {unknown} raw @returns {StateParseResult} */
function parseStateResult(raw) {
  var text = String(raw || "").trim()
  if (!text) return { state: emptyState(), error: "" }
  try {
    return { state: normalizeState(JSON.parse(text)), error: "" }
  } catch (error) {
    return { state: emptyState(), error: "Launcher state is malformed; using temporary defaults" }
  }
}

/** @param {unknown} state @returns {string} */
function serializeState(state) {
  return JSON.stringify(normalizeState(state), null, 2) + "\n"
}

/** @param {unknown} state @param {unknown} id @returns {boolean} */
function isFavorite(state, id) {
  var target = validId(id)
  if (!target) return false
  return normalizeState(state).favorites.indexOf(target) >= 0
}

/** @param {unknown} state @param {unknown} id @returns {LauncherState} */
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

/** @param {unknown} state @param {unknown} id @param {unknown} delta @returns {LauncherState} */
function moveFavorite(state, id, delta) {
  var current = normalizeState(state)
  var target = validId(id)
  var favorites = current.favorites.slice()
  var from = favorites.indexOf(target)
  if (from < 0 || favorites.length < 2) return current
  var to = Math.max(0, Math.min(favorites.length - 1, from + Number(delta || 0)))
  if (to === from) return current
  favorites.splice(from, 1)
  favorites.splice(to, 0, target)
  return stateWith(current, { favorites: favorites })
}

/** @param {unknown} state @param {unknown} id @param {unknown} now @returns {LauncherState} */
function recordUsage(state, id, now) {
  var current = normalizeState(state)
  var target = validId(id)
  if (!target) return current

  var timestamp = Math.floor(Number(now || Date.now()))
  if (!isFinite(timestamp) || timestamp < 0) timestamp = Date.now()
  /** @type {UsageMap} */
  var usage = {}
  for (var key in current.usage) {
    var currentEntry = current.usage[key]
    if (Object.prototype.hasOwnProperty.call(current.usage, key) && currentEntry) usage[key] = currentEntry
  }
  var previous = usage[target] || { count: 0, lastUsed: 0 }
  usage[target] = {
    count: Math.max(0, Number(previous.count || 0)) + 1,
    lastUsed: timestamp
  }

  return stateWith(current, { usage: usage })
}

/** @param {unknown} state @param {unknown} [id] @returns {LauncherState} */
function resetUsage(state, id) {
  var current = normalizeState(state)
  var target = validId(id)
  if (!target) return stateWith(current, { usage: {} })

  /** @type {UsageMap} */
  var usage = {}
  for (var key in current.usage) {
    var currentEntry = current.usage[key]
    if (key !== target && Object.prototype.hasOwnProperty.call(current.usage, key) && currentEntry) usage[key] = currentEntry
  }
  return stateWith(current, { usage: usage })
}

/** @param {unknown} state @param {unknown} id @returns {string} */
function aliasFor(state, id) {
  var current = normalizeState(state)
  var target = validId(id)
  return target && current.aliases[target] ? String(current.aliases[target]) : ""
}

/** @param {unknown} state @param {unknown} id @param {unknown} value @returns {LauncherState} */
function setAlias(state, id, value) {
  var current = normalizeState(state)
  var target = validId(id)
  var alias = validText(value).slice(0, 64)
  if (!target) return current
  /** @type {StringMap} */
  var aliases = {}
  for (var key in current.aliases) {
    var currentAlias = current.aliases[key]
    if (Object.prototype.hasOwnProperty.call(current.aliases, key) && key !== target && currentAlias) aliases[key] = currentAlias
  }
  if (alias) aliases[target] = alias
  return stateWith(current, { aliases: aliases })
}

/** @param {unknown} state @param {unknown} id @returns {boolean} */
function isHidden(state, id) {
  var current = normalizeState(state)
  var target = validId(id)
  return !!target && current.hidden.indexOf(target) >= 0
}

/** @param {unknown} state @param {unknown} id @param {unknown} hiddenValue @returns {LauncherState} */
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

/** @param {unknown} state @param {unknown} value @returns {LauncherState} */
function recordQuery(state, value) {
  var current = normalizeState(state)
  var query = validText(value).slice(0, 256)
  if (!query) return current
  var queryKey = query.toLowerCase()
  var history = [query]
  for (var i = 0; i < current.queryHistory.length && history.length < QUERY_HISTORY_LIMIT; i++) {
    var historyEntry = current.queryHistory[i]
    if (historyEntry && historyEntry.toLowerCase() !== queryKey) history.push(historyEntry)
  }
  return stateWith(current, { queryHistory: history })
}

/** @param {unknown} state @returns {LauncherState} */
function clearQueryHistory(state) {
  return stateWith(state, { queryHistory: [] })
}

/** @param {unknown} state @param {unknown} enabled @returns {LauncherState} */
function setCompactMode(state, enabled) {
  return setPreference(state, "compactMode", enabled)
}

/** @param {unknown} value @returns {value is BooleanPreferenceKey} */
function isBooleanPreferenceKey(value) {
  return value === "compactMode" || value === "calculatorEnabled"
    || value === "fileSearchEnabled" || value === "quickActivationEnabled"
}

/**
 * @param {unknown} state
 * @param {unknown} key
 * @param {unknown} enabled
 * @returns {LauncherState}
 */
function setPreference(state, key, enabled) {
  var current = normalizeState(state)
  if (!isBooleanPreferenceKey(key)) return current
  /** @type {Preferences} */
  var preferences = Object.assign({}, current.preferences)
  preferences[key] = enabled === true
  return stateWith(current, { preferences: preferences })
}

/**
 * @param {unknown} state
 * @param {ListPreferenceKey} key
 * @param {unknown} value
 * @param {boolean} add
 * @param {(value: unknown) => string} normalizer
 * @param {number} limit
 * @returns {LauncherState}
 */
function updatePreferenceList(state, key, value, add, normalizer, limit) {
  var current = normalizeState(state)
  var normalized = normalizer(value)
  if (!normalized) return current
  var values = current.preferences[key].slice()
  var index = values.indexOf(normalized)
  if (add && index < 0 && values.length < limit) values.push(normalized)
  if (!add && index >= 0) values.splice(index, 1)
  /** @type {Preferences} */
  var preferences = Object.assign({}, current.preferences)
  preferences[key] = values
  return stateWith(current, { preferences: preferences })
}

/** @param {unknown} state @param {unknown} value @returns {LauncherState} */
function addFileScope(state, value) {
  return updatePreferenceList(state, "fileSearchScopes", value, true, normalizeScope, 32)
}

/** @param {unknown} state @param {unknown} value @returns {LauncherState} */
function removeFileScope(state, value) {
  return updatePreferenceList(state, "fileSearchScopes", value, false, normalizeScope, 32)
}

/** @param {unknown} state @param {unknown} value @returns {LauncherState} */
function addFileIgnore(state, value) {
  return updatePreferenceList(state, "fileSearchIgnores", value, true, normalizeIgnore, 64)
}

/** @param {unknown} state @param {unknown} value @returns {LauncherState} */
function removeFileIgnore(state, value) {
  return updatePreferenceList(state, "fileSearchIgnores", value, false, normalizeIgnore, 64)
}

/** @param {unknown} state @returns {LauncherState} */
function resetProviderSettings(state) {
  var current = normalizeState(state)
  var defaults = emptyPreferences()
  defaults.compactMode = current.preferences.compactMode
  return stateWith(current, { preferences: defaults })
}

/** @param {unknown} state @returns {LauncherState} */
function resetPersonalization(state) {
  var current = normalizeState(state)
  return stateWith(current, {
    favorites: [],
    usage: {},
    aliases: {},
    hidden: [],
    queryHistory: []
  })
}

/**
 * @param {unknown} state
 * @param {unknown} status
 * @param {unknown} hotkey
 * @param {unknown} showCoach
 * @returns {LauncherState}
 */
function setOnboarding(state, status, hotkey, showCoach) {
  var current = normalizeState(state)
  var nextStatus = validText(status)
  if (nextStatus !== "pending" && nextStatus !== "verify" && nextStatus !== "complete") {
    return current
  }
  var chord = validText(hotkey)
  if (/[^A-Za-z0-9_ +]/.test(chord) || chord.length > 64) chord = ""
  if (nextStatus === "verify" && !chord) return current
  return stateWith(current, {
    onboarding: {
      version: 1,
      status: nextStatus,
      hotkey: chord,
      showCoach: nextStatus === "complete" && showCoach === true
    }
  })
}

/** @param {unknown} state @returns {LauncherState} */
function dismissOnboardingCoach(state) {
  var current = normalizeState(state)
  if (!current.onboarding.showCoach) return current
  return setOnboarding(current, "complete", current.onboarding.hotkey, false)
}

/**
 * @param {SearchableRecord} record
 * @param {string} section
 * @param {boolean} favorite
 * @returns {SearchableRecord}
 */
function copyRecord(record, section, favorite) {
  return Object.assign({}, record, { section: section, favorite: favorite })
}

/**
 * @param {readonly SearchableRecord[] | null | undefined} records
 * @param {unknown} state
 * @param {EmptyRowsOptions | null} [options]
 * @returns {SearchableRecord[]}
 */
function emptyStateRows(records, state, options) {
  var current = normalizeState(state)
  var source = records || []
  var opts = options || {}
  var favoriteLimit = Math.max(0, Number(opts.favoriteLimit === undefined ? source.length : opts.favoriteLimit))
  var recentApplicationLimit = Math.max(0, Number(opts.recentApplicationLimit === undefined ? 4 : opts.recentApplicationLimit))
  var recentCommandLimit = Math.max(0, Number(opts.recentCommandLimit === undefined ? 4 : opts.recentCommandLimit))
  /** @type {Record<string, SearchableRecord>} */
  var byId = {}
  /** @type {SearchableRecord[]} */
  var rows = []
  /** @type {BooleanMap} */
  var favoriteSet = {}
  /** @type {BooleanMap} */
  var included = {}

  for (var i = 0; i < source.length; i++) {
    var record = source[i]
    var recordId = validId(record && record.id)
    if (recordId && record) byId[recordId] = record
  }

  for (var s = 0; s < current.favorites.length; s++) {
    var favoriteKey = current.favorites[s]
    if (favoriteKey) favoriteSet[favoriteKey] = true
  }

  for (var f = 0; f < current.favorites.length && rows.length < favoriteLimit; f++) {
    var favoriteId = current.favorites[f]
    if (!favoriteId) continue
    var favoriteRecord = byId[favoriteId]
    if (!favoriteRecord) continue
    rows.push(copyRecord(favoriteRecord, "Favorites", true))
    included[favoriteId] = true
  }

  /** @type {RecentRecord[]} */
  var recentApplications = []
  /** @type {RecentRecord[]} */
  var recentCommands = []
  for (var id in current.usage) {
    if (!Object.prototype.hasOwnProperty.call(current.usage, id) || favoriteSet[id] || !byId[id]) continue
    var candidateRecord = byId[id]
    var candidateUsage = current.usage[id]
    if (!candidateRecord || !candidateUsage) continue
    var candidate = { record: candidateRecord, usage: candidateUsage }
    if (candidateRecord.type === "application") recentApplications.push(candidate)
    else recentCommands.push(candidate)
  }

  /** @param {RecentRecord} left @param {RecentRecord} right @returns {number} */
  function recentOrder(left, right) {
    if (left.usage.lastUsed !== right.usage.lastUsed) return right.usage.lastUsed - left.usage.lastUsed
    if (left.usage.count !== right.usage.count) return right.usage.count - left.usage.count
    return String(left.record.title || left.record.id).localeCompare(String(right.record.title || right.record.id))
  }

  recentApplications.sort(recentOrder)
  recentCommands.sort(recentOrder)
  for (var a = 0; a < recentApplications.length && a < recentApplicationLimit; a++) {
    var recentApplication = recentApplications[a]
    if (!recentApplication) continue
    rows.push(copyRecord(recentApplication.record, "Recent Applications", false))
    included[recentApplication.record.id] = true
  }
  for (var c = 0; c < recentCommands.length && c < recentCommandLimit; c++) {
    var recentCommand = recentCommands[c]
    if (!recentCommand) continue
    rows.push(copyRecord(recentCommand.record, "Recent Commands", false))
    included[recentCommand.record.id] = true
  }

  for (var r = 0; r < source.length; r++) {
    var remainingRecord = source[r]
    var remainingId = validId(remainingRecord && remainingRecord.id)
    if (!remainingRecord || !remainingId || included[remainingId]) continue
    if (remainingRecord.emptyVisible === false) continue
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
    emptyOnboarding: emptyOnboarding,
    emptyPreferences: emptyPreferences,
    emptyState: emptyState,
    normalizeState: normalizeState,
    parseState: parseState,
    parseStateResult: parseStateResult,
    serializeState: serializeState,
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    moveFavorite: moveFavorite,
    recordUsage: recordUsage,
    resetUsage: resetUsage,
    aliasFor: aliasFor,
    setAlias: setAlias,
    isHidden: isHidden,
    setHidden: setHidden,
    recordQuery: recordQuery,
    clearQueryHistory: clearQueryHistory,
    setCompactMode: setCompactMode,
    setPreference: setPreference,
    addFileScope: addFileScope,
    removeFileScope: removeFileScope,
    addFileIgnore: addFileIgnore,
    removeFileIgnore: removeFileIgnore,
    resetProviderSettings: resetProviderSettings,
    resetPersonalization: resetPersonalization,
    setOnboarding: setOnboarding,
    dismissOnboardingCoach: dismissOnboardingCoach,
    emptyStateRows: emptyStateRows
  }
}
