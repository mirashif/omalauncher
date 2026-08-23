// Pure global-shortcut policy and Omarchy/Hyprland binding generation. The
// generated block is the only part of bindings.lua that OmaLauncher owns.

/** @typedef {import("../types/models").GlobalShortcutTarget} GlobalShortcutTarget */
/** @typedef {import("../types/models").GlobalShortcutEntry} GlobalShortcutEntry */
/** @typedef {import("../types/models").GlobalShortcutMap} GlobalShortcutMap */
/** @typedef {import("../types/models").HotkeyMutationRequest} HotkeyMutationRequest */

var BEGIN_MARKER = "-- BEGIN OMALAUNCHER GLOBAL SHORTCUTS (managed)"
var END_MARKER = "-- END OMALAUNCHER GLOBAL SHORTCUTS"
var LEGACY_BEGIN_MARKER = "-- BEGIN OMALAUNCHER APP HOTKEYS (managed)"
var LEGACY_END_MARKER = "-- END OMALAUNCHER APP HOTKEYS"
var LAUNCHER_TITLE = "OmaLauncher"
var LAUNCHER_COMMAND = "omarchy-shell shell toggle com.mirashif.omalauncher '{\"source\":\"hotkey\"}'"
var MENU_TITLE = "Omarchy menu"
var MENU_COMMAND = "omarchy-menu toggle"
var MENU_PRIMARY_HOTKEY = "SUPER + SPACE"
var MENU_FALLBACK_HOTKEY = "SUPER + R"

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** @param {unknown} value @returns {value is unknown[]} */
function isUnknownArray(value) {
  return Array.isArray(value)
}

/**
 * @param {unknown} source
 * @returns {{ begin: number, end: number, beginMarker: string, endMarker: string }}
 */
function managedBounds(source) {
  var text = String(source || "")
  var markerPairs = [
    [BEGIN_MARKER, END_MARKER],
    [LEGACY_BEGIN_MARKER, LEGACY_END_MARKER]
  ]
  for (var i = 0; i < markerPairs.length; i++) {
    var pair = markerPairs[i] || []
    var beginMarker = String(pair[0] || "")
    var endMarker = String(pair[1] || "")
    var begin = text.indexOf(beginMarker)
    var end = begin < 0 ? -1 : text.indexOf(endMarker, begin + beginMarker.length)
    if (begin >= 0 && end >= 0) return {
      begin: begin, end: end, beginMarker: beginMarker, endMarker: endMarker
    }
  }
  return { begin: -1, end: -1, beginMarker: "", endMarker: "" }
}

/** @param {unknown} value @returns {string} */
function cleanAppId(value) {
  var id = String(value || "").trim().replace(/\.desktop$/, "")
  return !id || id.indexOf("/") >= 0 || /[\r\n\0]/.test(id) ? "" : id
}

/** @param {unknown} value @returns {string} */
function cleanTargetKey(value) {
  var key = String(value || "").trim()
  return !key || key.length > 512 || /[\r\n\0]/.test(key) ? "" : key
}

/** @param {unknown} value @param {string} fallback @returns {string} */
function cleanTitle(value, fallback) {
  var title = String(value || "").trim().replace(/[\r\n\t]+/g, " ")
  if (title.length > 256) title = title.slice(0, 256)
  return title || fallback
}

/** @param {unknown} value @returns {string} */
function cleanPluginId(value) {
  var id = String(value || "").trim()
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) && id.indexOf("..") < 0 ? id : ""
}

/** @param {unknown} value @returns {string} */
function cleanRoute(value) {
  var route = String(value || "").trim()
  return route.length <= 512 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(route)
    && route.indexOf("..") < 0 ? route : ""
}

/** @param {unknown} value @returns {string} */
function cleanObjectJson(value) {
  try {
    /** @type {unknown} */
    var parsed = typeof value === "string" ? JSON.parse(value || "{}") : value
    if (!isRecord(parsed)) return ""
    var encoded = JSON.stringify(parsed)
    return encoded.length <= 4096 ? encoded : ""
  } catch (error) { return "" }
}

/** @param {unknown} value @returns {string[]} */
function cleanArgv(value) {
  var source = value
  if (typeof source === "string") {
    try { source = JSON.parse(source) } catch (error) { return [] }
  }
  if (!isUnknownArray(source) || source.length === 0 || source.length > 32) return []
  /** @type {string[]} */
  var argv = []
  for (var i = 0; i < source.length; i++) {
    var argument = source[i]
    if (typeof argument !== "string" || !argument || argument.length > 512
        || /[\r\n\0]/.test(argument)) return []
    argv.push(argument)
  }
  return argv[0] === "omarchy" ? argv : []
}

/** @param {unknown} value @returns {string} */
function cleanLauncherPayload(value) {
  var encoded = cleanObjectJson(value)
  if (!encoded) return ""
  /** @type {unknown} */
  var parsedPayload
  try { parsedPayload = JSON.parse(encoded) } catch (error) { return "" }
  if (!isRecord(parsedPayload)) return ""
  var payload = parsedPayload
  var keys = Object.keys(payload).sort()
  var route = cleanRoute(payload["route"])
  var query = String(payload["query"] || "")
  var routeAllowed = route === "files" || route === "hidden"
    || /^settings(?:-[A-Za-z0-9-]+)?$/.test(route)
    || /^plugins(?:-(?:installed|available|built-in)|-detail:[A-Za-z0-9._-]+)?$/.test(route)
  var queryAllowed = query === "= "
  if ((!routeAllowed && !queryAllowed) || (route && query)) return ""
  var expectedKeys = route ? ["route", "source"] : ["query", "source"]
  if (keys.join("\u0000") !== expectedKeys.sort().join("\u0000")) return ""
  if (String(payload["source"] || "") !== "hotkey") return ""
  return JSON.stringify(route ? { source: "hotkey", route: route } : { source: "hotkey", query: query })
}

/**
 * @param {GlobalShortcutTarget | null | undefined} value
 * @returns {GlobalShortcutTarget | null}
 */
function normalizeTarget(value) {
  var source = value || /** @type {GlobalShortcutTarget} */ ({})
  var key = cleanTargetKey(source.key)
  var kind = String(source.kind || "")
  var title = cleanTitle(source.title, key)
  if (!key || !title) return null
  if (kind === "application") {
    var appId = cleanAppId(source.appId)
    return appId ? { key: key, kind: "application", title: title, appId: appId } : null
  }
  if (kind === "shell-plugin") {
    var pluginId = cleanPluginId(source.pluginId)
    var payloadJson = cleanObjectJson(source.payloadJson)
    return pluginId && payloadJson
      ? { key: key, kind: "shell-plugin", title: title,
        pluginId: pluginId, payloadJson: payloadJson } : null
  }
  if (kind === "shell-ipc") {
    return Array.isArray(source.argv)
      && source.argv.join("\u0000") === "omarchy-shell\u0000notifications\u0000showHistory"
      ? { key: key, kind: "shell-ipc", title: title,
        argv: ["omarchy-shell", "notifications", "showHistory"] } : null
  }
  if (kind === "menu") {
    var route = cleanRoute(source.route)
    return route ? { key: key, kind: "menu", title: title, route: route } : null
  }
  if (kind === "cli") {
    var argv = cleanArgv(source.argv)
    return argv.length > 0 ? { key: key, kind: "cli", title: title, argv: argv } : null
  }
  if (kind === "launcher") {
    var launcherPayload = cleanLauncherPayload(source.payloadJson)
    return launcherPayload ? { key: key, kind: "launcher", title: title,
      payloadJson: launcherPayload } : null
  }
  return null
}

/**
 * @param {Record<string, unknown> | null | undefined} result
 * @returns {GlobalShortcutTarget | null}
 */
function targetForResult(result) {
  var row = result || {}
  var key = cleanTargetKey(row["resultId"] || row["id"])
  var type = String(row["resultType"] || row["type"] || "")
  var kind = String(row["resultKind"] || row["kind"] || "")
  var title = cleanTitle(row["title"], key)
  if (!key || !title) return null

  if (type === "application") return normalizeTarget({
    key: key, kind: "application", title: title, appId: String(row["appId"] || "")
  })
  if (type === "shell-plugin" && String(row["executionKind"] || "") === "shell-plugin") {
    return normalizeTarget({
      key: key, kind: "shell-plugin", title: title,
      pluginId: String(row["sourcePluginId"] || ""),
      payloadJson: String(row["shellPayloadJson"] || "{}")
    })
  }
  if (type === "shell-plugin" && String(row["executionKind"] || "") === "shell-ipc") {
    /** @type {unknown} */
    var shellArgv
    try { shellArgv = JSON.parse(String(row["commandArgvJson"] || "[]")) } catch (error) { return null }
    if (!isUnknownArray(shellArgv) || shellArgv.length !== 3
        || shellArgv[0] !== "omarchy-shell" || shellArgv[1] !== "notifications"
        || shellArgv[2] !== "showHistory") return null
    return normalizeTarget({
      key: key, kind: "shell-ipc", title: title,
      argv: ["omarchy-shell", "notifications", "showHistory"]
    })
  }
  if (type === "omarchy-command") return normalizeTarget({
    key: key, kind: "menu", title: title,
    route: String(row["targetRoute"] || row["route"] || "")
  })
  if (type === "omarchy-cli" && String(row["executionKind"] || "") === "cli-direct"
      && row["requiresSudo"] !== true) {
    var cliArgv = cleanArgv(row["commandArgvJson"])
    if (cliArgv.length === 0 || String(row["commandRoute"] || "") !== cliArgv.join(" ")) return null
    return normalizeTarget({ key: key, kind: "cli", title: title, argv: cliArgv })
  }

  var route = ""
  var query = ""
  if (kind === "plugin-open-route" || kind === "plugin-open-details" || kind === "open-plugins")
    route = String(row["targetRoute"] || row["route"] || "plugins")
  else if (kind === "open-settings") route = "settings"
  else if (kind === "open-files") route = "files"
  else if (kind === "manage-hidden") route = "hidden"
  else if (kind === "open-calculator") query = "= "
  else if (kind.indexOf("settings-open-") === 0)
    route = String(row["targetRoute"] || row["route"] || "")
  if (!route && !query) return null
  return normalizeTarget({
    key: key, kind: "launcher", title: title,
    payloadJson: JSON.stringify(route
      ? { source: "hotkey", route: route } : { source: "hotkey", query: query })
  })
}

/** @param {GlobalShortcutTarget | null | undefined} value @returns {string} */
function commandForTarget(value) {
  var target = normalizeTarget(value)
  if (!target) return ""
  if (target.kind === "application")
    return "uwsm-app -- gtk-launch " + shellQuote(String(target.appId || "") + ".desktop")
  if (target.kind === "shell-plugin")
    return "omarchy-shell shell summon " + shellQuote(target.pluginId)
      + " " + shellQuote(target.payloadJson)
  if (target.kind === "menu") return "omarchy menu summon " + shellQuote(target.route)
  if (target.kind === "launcher")
    return "omarchy-shell shell summon com.mirashif.omalauncher " + shellQuote(target.payloadJson)
  if (target.kind === "shell-ipc" || target.kind === "cli")
    return (target.argv || []).map(shellQuote).join(" ")
  return ""
}

/** @param {unknown} value @returns {string} */
function normalizeKey(value) {
  var key = String(value || "").trim().toUpperCase()
  /** @type {Record<string, string>} */
  var aliases = {
    ESC: "ESCAPE",
    ENTER: "RETURN",
    CONTROL: "CTRL",
    META: "SUPER",
    WIN: "SUPER",
    WINDOWS: "SUPER",
    CMD: "SUPER",
    COMMAND: "SUPER",
    OPTION: "ALT",
    PAGEUP: "PAGE_UP",
    PAGEDOWN: "PAGE_DOWN",
    BACKSPACE: "BACKSPACE",
    SPACEBAR: "SPACE"
  }
  return aliases[key] || key
}

/** @param {unknown} value @returns {string} */
function normalizeHotkey(value) {
  var raw = String(value || "").trim()
  if (!raw || /[\r\n\0]/.test(raw)) return ""
  var parts = raw.split(/\s*\+\s*/).map(normalizeKey).filter(Boolean)
  /** @type {Record<string, boolean>} */
  var modifiers = { SUPER: false, CTRL: false, ALT: false, SHIFT: false }
  var key = ""
  for (var i = 0; i < parts.length; i++) {
    var part = String(parts[i] || "")
    if (Object.prototype.hasOwnProperty.call(modifiers, part)) {
      if (modifiers[part]) return ""
      modifiers[part] = true
    } else {
      if (key || !/^[A-Z0-9][A-Z0-9_-]*$/.test(part)) return ""
      key = part
    }
  }
  if (!key) return ""
  var ordered = []
  if (modifiers["SUPER"]) ordered.push("SUPER")
  if (modifiers["CTRL"]) ordered.push("CTRL")
  if (modifiers["ALT"]) ordered.push("ALT")
  if (modifiers["SHIFT"]) ordered.push("SHIFT")
  ordered.push(key)
  return ordered.join(" + ")
}

/** @param {unknown} value @returns {boolean} */
function safeGlobalHotkey(value) {
  var hotkey = normalizeHotkey(value)
  return !!hotkey && /(^| \+ )(SUPER|CTRL|ALT)( \+ |$)/.test(hotkey)
}

/** @param {unknown} value @returns {string} */
function luaQuote(value) {
  var source = String(value || "")
  var escaped = ""
  for (var i = 0; i < source.length; i++) {
    var character = source.charAt(i)
    var code = source.charCodeAt(i)
    if (character === "\\") escaped += "\\\\"
    else if (character === "\"") escaped += "\\\""
    else if (character === "\r") escaped += "\\r"
    else if (character === "\n") escaped += "\\n"
    else if (character === "\t") escaped += "\\t"
    else if (code < 32 || code === 127) escaped += "\\" + String(code).padStart(3, "0")
    else escaped += character
  }
  return "\"" + escaped + "\""
}

/** @param {unknown} value @returns {string} */
function shellQuote(value) {
  return "'" + String(value || "").replace(/'/g, "'\\''") + "'"
}

/** @param {unknown} source @returns {GlobalShortcutMap} */
function parseManagedEntries(source) {
  var text = String(source || "")
  var bounds = managedBounds(text)
  /** @type {GlobalShortcutMap} */
  var entries = {}
  if (bounds.begin < 0 || bounds.end < 0) return entries
  var lines = text.slice(
    bounds.begin + bounds.beginMarker.length, bounds.end).split(/\r?\n/)
  for (var i = 0; i < lines.length; i++) {
    var shortcutMatch = /^\s*-- shortcut: (\{.*\})\s*$/.exec(lines[i] || "")
    var legacyMatch = /^\s*-- app: (\{.*\})\s*$/.exec(lines[i] || "")
    if (!shortcutMatch && !legacyMatch) continue
    try {
      var metadataJson = String((shortcutMatch ? shortcutMatch[1]
        : (legacyMatch ? legacyMatch[1] : "{}")) || "{}")
      /** @type {unknown} */
      var parsed = JSON.parse(metadataJson)
      if (!isRecord(parsed)) continue
      var hotkey = normalizeHotkey(parsed["hotkey"])
      var target = legacyMatch ? normalizeTarget({
        key: "application:" + cleanAppId(parsed["id"]),
        kind: "application",
        title: String(parsed["title"] || parsed["id"] || ""),
        appId: String(parsed["id"] || "")
      }) : normalizeTarget(/** @type {GlobalShortcutTarget} */ (
        /** @type {unknown} */ (parsed)))
      if (!target || !safeGlobalHotkey(hotkey)) continue
      entries = setEntry(entries, target, hotkey)
    } catch (error) { }
  }
  return entries
}

/** @param {unknown} source @returns {string} */
function parseManagedLauncherHotkey(source) {
  var text = String(source || "")
  var bounds = managedBounds(text)
  if (bounds.begin < 0 || bounds.end < 0) return ""
  var lines = text.slice(
    bounds.begin + bounds.beginMarker.length, bounds.end).split(/\r?\n/)
  for (var i = 0; i < lines.length; i++) {
    var match = /^\s*-- launcher: (\{.*\})\s*$/.exec(lines[i] || "")
    if (!match) continue
    try {
      /** @type {unknown} */
      var parsed = JSON.parse(match[1] || "{}")
      if (!isRecord(parsed)) continue
      var hotkey = normalizeHotkey(parsed["hotkey"])
      if (safeGlobalHotkey(hotkey)) return hotkey
    } catch (error) { }
  }
  return ""
}

/** @param {unknown} source @returns {string} */
function parseManagedMenuHotkey(source) {
  var text = String(source || "")
  var bounds = managedBounds(text)
  if (bounds.begin < 0 || bounds.end < 0) return ""
  var lines = text.slice(
    bounds.begin + bounds.beginMarker.length, bounds.end).split(/\r?\n/)
  for (var i = 0; i < lines.length; i++) {
    var match = /^\s*-- menu: (\{.*\})\s*$/.exec(lines[i] || "")
    if (!match) continue
    try {
      /** @type {unknown} */
      var parsed = JSON.parse(match[1] || "{}")
      if (!isRecord(parsed)) continue
      var hotkey = normalizeHotkey(parsed["hotkey"])
      if (safeGlobalHotkey(hotkey)) return hotkey
    } catch (error) { }
  }
  return ""
}

/** @param {GlobalShortcutMap | null | undefined} entries @returns {GlobalShortcutMap} */
function copyEntries(entries) {
  /** @type {GlobalShortcutMap} */
  var copy = {}
  var source = entries || {}
  var ids = Object.keys(source)
  for (var i = 0; i < ids.length; i++) {
    var entry = source[ids[i] || ""]
    if (!entry) continue
    var target = normalizeTarget(entry)
    var hotkey = entry ? normalizeHotkey(entry.hotkey) : ""
    if (target && safeGlobalHotkey(hotkey))
      copy[target.key] = Object.assign({}, target, { hotkey: hotkey })
  }
  return copy
}

/**
 * @param {GlobalShortcutMap | null | undefined} entries
 * @param {GlobalShortcutTarget | null | undefined} target
 * @param {unknown} hotkey
 * @returns {GlobalShortcutMap}
 */
function setEntry(entries, target, hotkey) {
  var normalized = normalizeTarget(target)
  var chord = normalizeHotkey(hotkey)
  var next = copyEntries(entries)
  if (!normalized || !safeGlobalHotkey(chord)) return next
  var ids = Object.keys(next)
  for (var i = 0; i < ids.length; i++) {
    var existing = next[ids[i] || ""]
    if (existing && (existing.key === normalized.key || existing.hotkey === chord)) delete next[existing.key]
  }
  next[normalized.key] = Object.assign({}, normalized, { hotkey: chord })
  return next
}

/** @param {GlobalShortcutMap | null | undefined} entries @param {unknown} targetKey @returns {GlobalShortcutMap} */
function removeEntry(entries, targetKey) {
  var next = copyEntries(entries)
  var key = cleanTargetKey(targetKey)
  if (key) delete next[key]
  return next
}

/** @param {GlobalShortcutMap | null | undefined} entries @param {unknown} hotkey @returns {GlobalShortcutMap} */
function removeHotkey(entries, hotkey) {
  var next = copyEntries(entries)
  var chord = normalizeHotkey(hotkey)
  if (!chord) return next
  var ids = Object.keys(next)
  for (var i = 0; i < ids.length; i++) {
    var entry = next[ids[i] || ""]
    if (entry && entry.hotkey === chord) delete next[entry.key]
  }
  return next
}

/**
 * @param {GlobalShortcutMap | null | undefined} entries
 * @param {unknown} [launcherHotkey]
 * @param {unknown} [menuHotkey]
 * @returns {string}
 */
function managedBlock(entries, launcherHotkey, menuHotkey) {
  var source = entries || {}
  var launcherChord = normalizeHotkey(launcherHotkey)
  var menuChord = normalizeHotkey(menuHotkey)
  if (menuChord === launcherChord) menuChord = ""
  var ids = Object.keys(source).sort(function(left, right) {
    var leftEntry = source[left]
    var rightEntry = source[right]
    var byHotkey = String(leftEntry ? leftEntry.hotkey : "").localeCompare(String(rightEntry ? rightEntry.hotkey : ""))
    return byHotkey || left.localeCompare(right)
  })
  var primaryMenuHotkeyIsManaged = launcherChord === MENU_PRIMARY_HOTKEY
  for (var ownerIndex = 0; ownerIndex < ids.length && !primaryMenuHotkeyIsManaged; ownerIndex++) {
    var ownerEntry = source[ids[ownerIndex] || ""]
    primaryMenuHotkeyIsManaged = !!ownerEntry
      && normalizeHotkey(ownerEntry.hotkey) === MENU_PRIMARY_HOTKEY
  }
  if (!primaryMenuHotkeyIsManaged) menuChord = ""
  if (ids.length === 0 && !safeGlobalHotkey(launcherChord) && !safeGlobalHotkey(menuChord)) return ""
  var lines = [BEGIN_MARKER]
  if (safeGlobalHotkey(launcherChord)) {
    lines.push("-- launcher: " + JSON.stringify({ hotkey: launcherChord }))
    lines.push("hl.unbind(" + luaQuote(launcherChord) + ")")
    lines.push("o.bind(" + luaQuote(launcherChord) + ", "
      + luaQuote(LAUNCHER_TITLE) + ", " + luaQuote(LAUNCHER_COMMAND) + ")")
  }
  if (safeGlobalHotkey(menuChord)) {
    lines.push("-- menu: " + JSON.stringify({ hotkey: menuChord }))
    lines.push("hl.unbind(" + luaQuote(menuChord) + ")")
    lines.push("o.bind(" + luaQuote(menuChord) + ", "
      + luaQuote(MENU_TITLE) + ", " + luaQuote(MENU_COMMAND) + ")")
  }
  for (var i = 0; i < ids.length; i++) {
    var entry = source[ids[i] || ""]
    if (!entry) continue
    var target = normalizeTarget(entry)
    var hotkey = normalizeHotkey(entry.hotkey)
    var command = commandForTarget(target)
    if (!target || !command || !safeGlobalHotkey(hotkey)
        || hotkey === launcherChord || hotkey === menuChord) continue
    var metadata = Object.assign({}, target, { hotkey: hotkey })
    lines.push("-- shortcut: " + JSON.stringify(metadata))
    lines.push("hl.unbind(" + luaQuote(hotkey) + ")")
    lines.push("o.bind(" + luaQuote(hotkey) + ", "
      + luaQuote(target.title + " (OmaLauncher)") + ", "
      + luaQuote(command) + ")")
  }
  lines.push(END_MARKER)
  return lines.join("\n")
}

/**
 * @param {unknown} source
 * @param {GlobalShortcutMap | null | undefined} entries
 * @param {unknown} [launcherHotkey]
 * @param {unknown} [menuHotkey]
 * @returns {string}
 */
function updateBindingsSource(source, entries, launcherHotkey, menuHotkey) {
  var text = String(source || "")
  var launcherChord = launcherHotkey === undefined
    ? parseManagedLauncherHotkey(text) : normalizeHotkey(launcherHotkey)
  var menuChord = menuHotkey === undefined
    ? parseManagedMenuHotkey(text) : normalizeHotkey(menuHotkey)
  var bounds = managedBounds(text)
  var block = managedBlock(entries, launcherChord, menuChord)
  if (bounds.begin >= 0 && bounds.end >= 0) {
    var lineStart = text.lastIndexOf("\n", bounds.begin - 1) + 1
    var lineEnd = text.indexOf("\n", bounds.end + bounds.endMarker.length)
    if (lineEnd < 0) lineEnd = text.length
    else lineEnd += 1
    var before = text.slice(0, lineStart)
    var after = text.slice(lineEnd)
    text = before + after
    if (text.slice(-2) === "\n\n") text = text.slice(0, -1)
  }
  if (!block) return text
  return text.replace(/\s*$/, "") + "\n\n" + block + "\n"
}

/** @param {unknown} bind @returns {string} */
function hotkeyFromBind(bind) {
  if (!bind || typeof bind !== "object") return ""
  var row = /** @type {Record<string, unknown>} */ (bind)
  var key = normalizeKey(row["key"] || "")
  if (!key) return ""
  var mask = Number(row["modmask"] || 0)
  var parts = []
  if ((mask & 64) !== 0) parts.push("SUPER")
  if ((mask & 4) !== 0) parts.push("CTRL")
  if ((mask & 8) !== 0) parts.push("ALT")
  if ((mask & 1) !== 0) parts.push("SHIFT")
  parts.push(key)
  return normalizeHotkey(parts.join(" + "))
}

/** @param {unknown} json @param {unknown} hotkey @returns {string} */
function conflictDescription(json, hotkey) {
  var target = normalizeHotkey(hotkey)
  if (!target) return ""
  try {
    /** @type {unknown} */
    var rows = JSON.parse(String(json || "[]"))
    if (!isUnknownArray(rows)) return ""
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i]
      if (!isRecord(row) || hotkeyFromBind(row) !== target) continue
      return String(row["description"] || row["dispatcher"] || "Existing Hyprland binding")
    }
  } catch (error) { }
  return ""
}

/** @param {unknown} json @param {unknown} hotkey @returns {boolean} */
function isNamedLauncherBinding(json, hotkey) {
  var target = normalizeHotkey(hotkey)
  if (!target) return false
  try {
    /** @type {unknown} */
    var rows = JSON.parse(String(json || "[]"))
    if (!isUnknownArray(rows)) return false
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i]
      if (!isRecord(row) || hotkeyFromBind(row) !== target) continue
      if (String(row["description"] || "").trim().toLowerCase() === LAUNCHER_TITLE.toLowerCase())
        return true
    }
  } catch (error) { }
  return false
}

/** @param {unknown} json @param {unknown} hotkey @returns {boolean} */
function isNamedMenuBinding(json, hotkey) {
  var target = normalizeHotkey(hotkey)
  if (!target) return false
  try {
    /** @type {unknown} */
    var rows = JSON.parse(String(json || "[]"))
    if (!isUnknownArray(rows)) return false
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i]
      if (!isRecord(row) || hotkeyFromBind(row) !== target) continue
      if (String(row["description"] || "").trim().toLowerCase() === MENU_TITLE.toLowerCase())
        return true
    }
  } catch (error) { }
  return false
}

/**
 * Returns only conflicts not already owned by OmaLauncher's managed block.
 * @param {unknown} json
 * @param {unknown} hotkey
 * @param {unknown} launcherHotkey
 * @param {unknown} menuHotkey
 * @returns {string}
 */
function externalConflictDescription(json, hotkey, launcherHotkey, menuHotkey) {
  var target = normalizeHotkey(hotkey)
  var description = conflictDescription(json, target)
  if (!description) return ""
  if (target === normalizeHotkey(launcherHotkey) && isNamedLauncherBinding(json, target)) return ""
  if (target === normalizeHotkey(menuHotkey) && isNamedMenuBinding(json, target)) return ""
  return description
}

/** @returns {string} */
function mutationScript() {
  return [
    "set -u",
    "target=$1",
    "expected=$2",
    "content=$3",
    "[[ $target == /* && -f $target ]] || { printf '%s\\n' 'Bindings file is unavailable'; exit 2; }",
    "current_errors=$(hyprctl configerrors 2>&1) || { printf '%s\\n' 'Could not validate the current Hyprland config'; exit 3; }",
    "[[ -z $current_errors ]] || { printf '%s\\n' \"Fix the existing Hyprland config error first: $current_errors\"; exit 4; }",
    "cmp -s -- \"$target\" <(printf '%s' \"$expected\") || { printf '%s\\n' 'Bindings changed while the hotkey was being checked; try again'; exit 5; }",
    "stamp=$(date +%Y%m%d-%H%M%S)",
    "backup=$(mktemp \"$target.bak.$stamp.XXXXXX\") || exit 6",
    "cp -p -- \"$target\" \"$backup\" || { printf '%s\\n' 'Could not back up bindings.lua'; exit 6; }",
    "temporary=$(mktemp --tmpdir=\"$(dirname -- \"$target\")\" .omalauncher-bindings.XXXXXX) || exit 7",
    "trap 'rm -f -- \"$temporary\"' EXIT",
    "printf '%s' \"$content\" > \"$temporary\" || exit 8",
    "chmod --reference=\"$target\" \"$temporary\" || exit 9",
    "mv -- \"$temporary\" \"$target\" || exit 10",
    "if ! hyprctl reload >/dev/null 2>&1; then",
    "  cp -p -- \"$backup\" \"$target\"",
    "  hyprctl reload >/dev/null 2>&1 || true",
    "  printf '%s\\n' 'Hyprland rejected the reload; restored the backup'",
    "  exit 11",
    "fi",
    "new_errors=$(hyprctl configerrors 2>&1) || new_errors='Could not read Hyprland config errors'",
    "if [[ -n $new_errors ]]; then",
    "  cp -p -- \"$backup\" \"$target\"",
    "  hyprctl reload >/dev/null 2>&1 || true",
    "  printf '%s\\n' \"Hyprland reported an error; restored the backup: $new_errors\"",
    "  exit 12",
    "fi",
    "printf '%s\\n' \"$backup\""
  ].join("\n")
}

/** @param {unknown} path @param {unknown} expectedSource @param {unknown} source @returns {HotkeyMutationRequest} */
function mutationRequest(path, expectedSource, source) {
  var target = String(path || "")
  var expected = String(expectedSource || "")
  var content = String(source || "")
  if (target.charAt(0) !== "/" || /[\r\n\0]/.test(target)
      || expected.indexOf("\0") >= 0 || content.indexOf("\0") >= 0) {
    return { active: false, command: [] }
  }
  return {
    active: true,
    command: ["bash", "-c", mutationScript(), "omalauncher-hotkey-update", target, expected, content]
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    BEGIN_MARKER: BEGIN_MARKER,
    END_MARKER: END_MARKER,
    LAUNCHER_TITLE: LAUNCHER_TITLE,
    LAUNCHER_COMMAND: LAUNCHER_COMMAND,
    MENU_TITLE: MENU_TITLE,
    MENU_COMMAND: MENU_COMMAND,
    MENU_PRIMARY_HOTKEY: MENU_PRIMARY_HOTKEY,
    MENU_FALLBACK_HOTKEY: MENU_FALLBACK_HOTKEY,
    cleanAppId: cleanAppId,
    cleanTargetKey: cleanTargetKey,
    normalizeTarget: normalizeTarget,
    targetForResult: targetForResult,
    commandForTarget: commandForTarget,
    normalizeHotkey: normalizeHotkey,
    safeGlobalHotkey: safeGlobalHotkey,
    luaQuote: luaQuote,
    shellQuote: shellQuote,
    parseManagedEntries: parseManagedEntries,
    parseManagedLauncherHotkey: parseManagedLauncherHotkey,
    parseManagedMenuHotkey: parseManagedMenuHotkey,
    setEntry: setEntry,
    removeEntry: removeEntry,
    removeHotkey: removeHotkey,
    managedBlock: managedBlock,
    updateBindingsSource: updateBindingsSource,
    hotkeyFromBind: hotkeyFromBind,
    conflictDescription: conflictDescription,
    isNamedLauncherBinding: isNamedLauncherBinding,
    isNamedMenuBinding: isNamedMenuBinding,
    externalConflictDescription: externalConflictDescription,
    mutationScript: mutationScript,
    mutationRequest: mutationRequest
  }
}
