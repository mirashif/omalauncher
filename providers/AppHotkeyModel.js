// Pure helpers for Omarchy/Hyprland per-application hotkeys. The generated
// block is the only part of bindings.lua that Omalauncher owns.

/** @typedef {import("../types/models").AppHotkeyEntry} AppHotkeyEntry */
/** @typedef {import("../types/models").AppHotkeyMap} AppHotkeyMap */
/** @typedef {import("../types/models").HotkeyMutationRequest} HotkeyMutationRequest */

var BEGIN_MARKER = "-- BEGIN OMALAUNCHER APP HOTKEYS (managed)"
var END_MARKER = "-- END OMALAUNCHER APP HOTKEYS"

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** @param {unknown} value @returns {value is unknown[]} */
function isUnknownArray(value) {
  return Array.isArray(value)
}

/** @param {unknown} value @returns {string} */
function cleanAppId(value) {
  var id = String(value || "").trim().replace(/\.desktop$/, "")
  return !id || id.indexOf("/") >= 0 || /[\r\n\0]/.test(id) ? "" : id
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

/** @param {unknown} source @returns {AppHotkeyMap} */
function parseManagedEntries(source) {
  var text = String(source || "")
  var begin = text.indexOf(BEGIN_MARKER)
  var end = begin < 0 ? -1 : text.indexOf(END_MARKER, begin + BEGIN_MARKER.length)
  /** @type {AppHotkeyMap} */
  var entries = {}
  if (begin < 0 || end < 0) return entries
  var lines = text.slice(begin + BEGIN_MARKER.length, end).split(/\r?\n/)
  for (var i = 0; i < lines.length; i++) {
    var match = /^\s*-- app: (\{.*\})\s*$/.exec(lines[i] || "")
    if (!match) continue
    try {
      /** @type {unknown} */
      var parsed = JSON.parse(match[1] || "{}")
      if (!isRecord(parsed)) continue
      var appId = cleanAppId(parsed["id"])
      var hotkey = normalizeHotkey(parsed["hotkey"])
      if (!appId || !safeGlobalHotkey(hotkey)) continue
      entries[appId] = {
        appId: appId,
        title: String(parsed["title"] || appId).trim() || appId,
        hotkey: hotkey
      }
    } catch (error) { }
  }
  return entries
}

/** @param {AppHotkeyMap | null | undefined} entries @returns {AppHotkeyMap} */
function copyEntries(entries) {
  /** @type {AppHotkeyMap} */
  var copy = {}
  var source = entries || {}
  var ids = Object.keys(source)
  for (var i = 0; i < ids.length; i++) {
    var entry = source[ids[i] || ""]
    if (entry) copy[entry.appId] = {
      appId: entry.appId,
      title: entry.title,
      hotkey: entry.hotkey
    }
  }
  return copy
}

/**
 * @param {AppHotkeyMap | null | undefined} entries
 * @param {unknown} appId
 * @param {unknown} title
 * @param {unknown} hotkey
 * @returns {AppHotkeyMap}
 */
function setEntry(entries, appId, title, hotkey) {
  var id = cleanAppId(appId)
  var chord = normalizeHotkey(hotkey)
  var next = copyEntries(entries)
  if (!id || !safeGlobalHotkey(chord)) return next
  var ids = Object.keys(next)
  for (var i = 0; i < ids.length; i++) {
    var existing = next[ids[i] || ""]
    if (existing && (existing.appId === id || existing.hotkey === chord)) delete next[existing.appId]
  }
  next[id] = { appId: id, title: String(title || id).trim() || id, hotkey: chord }
  return next
}

/** @param {AppHotkeyMap | null | undefined} entries @param {unknown} appId @returns {AppHotkeyMap} */
function removeEntry(entries, appId) {
  var next = copyEntries(entries)
  var id = cleanAppId(appId)
  if (id) delete next[id]
  return next
}

/** @param {AppHotkeyMap | null | undefined} entries @returns {string} */
function managedBlock(entries) {
  var source = entries || {}
  var ids = Object.keys(source).sort(function(left, right) {
    var leftEntry = source[left]
    var rightEntry = source[right]
    var byHotkey = String(leftEntry ? leftEntry.hotkey : "").localeCompare(String(rightEntry ? rightEntry.hotkey : ""))
    return byHotkey || left.localeCompare(right)
  })
  if (ids.length === 0) return ""
  var lines = [BEGIN_MARKER]
  for (var i = 0; i < ids.length; i++) {
    var entry = source[ids[i] || ""]
    if (!entry) continue
    var appId = cleanAppId(entry.appId)
    var hotkey = normalizeHotkey(entry.hotkey)
    if (!appId || !safeGlobalHotkey(hotkey)) continue
    var title = String(entry.title || appId).trim() || appId
    lines.push("-- app: " + JSON.stringify({ id: appId, title: title, hotkey: hotkey }))
    lines.push("hl.unbind(" + luaQuote(hotkey) + ")")
    lines.push("o.bind(" + luaQuote(hotkey) + ", "
      + luaQuote(title + " (Omalauncher)") + ", "
      + luaQuote("uwsm-app -- gtk-launch " + shellQuote(appId + ".desktop")) + ")")
  }
  lines.push(END_MARKER)
  return lines.join("\n")
}

/** @param {unknown} source @param {AppHotkeyMap | null | undefined} entries @returns {string} */
function updateBindingsSource(source, entries) {
  var text = String(source || "")
  var begin = text.indexOf(BEGIN_MARKER)
  var end = begin < 0 ? -1 : text.indexOf(END_MARKER, begin + BEGIN_MARKER.length)
  var block = managedBlock(entries)
  if (begin >= 0 && end >= 0) {
    var lineStart = text.lastIndexOf("\n", begin - 1) + 1
    var lineEnd = text.indexOf("\n", end + END_MARKER.length)
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
    cleanAppId: cleanAppId,
    normalizeHotkey: normalizeHotkey,
    safeGlobalHotkey: safeGlobalHotkey,
    luaQuote: luaQuote,
    shellQuote: shellQuote,
    parseManagedEntries: parseManagedEntries,
    setEntry: setEntry,
    removeEntry: removeEntry,
    managedBlock: managedBlock,
    updateBindingsSource: updateBindingsSource,
    hotkeyFromBind: hotkeyFromBind,
    conflictDescription: conflictDescription,
    mutationScript: mutationScript,
    mutationRequest: mutationRequest
  }
}
