// Parse Omarchy's supported keybinding display and resolve only unambiguous
// launcher-result associations. The provider keeps command execution in QML;
// these helpers stay pure for Node tests.

/** @typedef {import("../types/models").ShortcutBinding} ShortcutBinding */
/** @typedef {import("../types/models").ShortcutResultInput} ShortcutResultInput */

/** @type {Record<string, string[]>} */
var PLUGIN_DESCRIPTIONS = {
  "omarchy.audio": ["Audio"],
  "omarchy.bluetooth": ["Bluetooth"],
  "omarchy.clipboard": ["Clipboard manager"],
  "omarchy.clock": ["Calendar"],
  "omarchy.emojis": ["Emojis"],
  "omarchy.monitor": ["Display"],
  "omarchy.network": ["Network"],
  "omarchy.notifications": ["Open notification history"],
  "omarchy.power": ["Power"],
  "omarchy.weather": ["Toggle weather"]
}

/** @type {Record<string, string[]>} */
var ROUTE_DESCRIPTIONS = {
  apps: ["Apps menu"],
  system: ["System menu"],
  "style.background": ["Background switcher"],
  "style.theme": ["Theme menu"],
  "trigger.capture": ["Capture menu"],
  "trigger.hardware": ["Hardware menu"],
  "trigger.reminder.set": ["Set reminder"],
  "trigger.share": ["Share"],
  "trigger.toggle": ["Toggle menu"]
}

/** @param {unknown} value @returns {string} */
function text(value) {
  return String(value || "").trim()
}

/** @param {unknown} value @returns {string} */
function normalizedDescription(value) {
  return text(value).toLowerCase().replace(/\s+/g, " ")
}

/**
 * Converts Omarchy's display form (`SUPER CTRL + V`) into the canonical form
 * already used by Omalauncher's hotkey editor (`SUPER + CTRL + V`).
 * @param {unknown} value
 * @returns {string}
 */
function normalizeDisplayHotkey(value) {
  var source = text(value).toUpperCase().replace(/\s+/g, " ")
  if (!source) return ""
  var sides = source.split("+")
  var key = text(sides.pop()).toUpperCase()
  if (!key) return ""
  var modifierText = sides.join(" ")
  var rawModifiers = modifierText.split(/\s+/)
  /** @type {Record<string, boolean>} */
  var modifiers = {}
  for (var i = 0; i < rawModifiers.length; i++) {
    var modifier = rawModifiers[i] || ""
    if (modifier === "CONTROL") modifier = "CTRL"
    if (modifier === "META") modifier = "SUPER"
    if (modifier === "SUPER" || modifier === "CTRL" || modifier === "ALT" || modifier === "SHIFT")
      modifiers[modifier] = true
  }
  var order = ["SUPER", "CTRL", "ALT", "SHIFT"]
  /** @type {string[]} */
  var parts = []
  for (var orderIndex = 0; orderIndex < order.length; orderIndex++) {
    var orderedModifier = order[orderIndex] || ""
    if (orderedModifier && modifiers[orderedModifier]) parts.push(orderedModifier)
  }
  parts.push(key)
  return parts.join(" + ")
}

/** @param {unknown} raw @returns {ShortcutBinding[]} */
function parseBindings(raw) {
  var lines = String(raw || "").split(/\r?\n/)
  /** @type {ShortcutBinding[]} */
  var records = []
  /** @type {Record<string, boolean>} */
  var seen = {}
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i] || ""
    var separator = line.indexOf("→")
    if (separator < 0) continue
    var hotkey = normalizeDisplayHotkey(line.slice(0, separator))
    var description = text(line.slice(separator + 1))
    var descriptionKey = normalizedDescription(description)
    var identity = hotkey + "\u0000" + descriptionKey
    if (!hotkey || !descriptionKey || seen[identity]) continue
    seen[identity] = true
    records.push({ hotkey: hotkey, description: description, descriptionKey: descriptionKey })
  }
  return records
}

/** @param {string[]} target @param {unknown} values @returns {void} */
function appendCandidates(target, values) {
  var source = Array.isArray(values) ? values : []
  for (var i = 0; i < source.length; i++) {
    var candidate = text(source[i])
    if (candidate && target.indexOf(candidate) < 0) target.push(candidate)
  }
}

/** @param {ShortcutResultInput | null | undefined} result @returns {string[]} */
function candidateDescriptions(result) {
  var row = result || {}
  /** @type {string[]} */
  var candidates = []
  appendCandidates(candidates, PLUGIN_DESCRIPTIONS[text(row.sourcePluginId)])
  var route = text(row.targetRoute || row.route)
  appendCandidates(candidates, ROUTE_DESCRIPTIONS[route])
  var title = text(row.title)
  if (title) {
    appendCandidates(candidates, [title])
    if (/\b(menu|manager|switcher)$/i.test(title) === false)
      appendCandidates(candidates, [title + " menu"])
  }
  return candidates
}

/**
 * @param {ShortcutResultInput | null | undefined} result
 * @param {readonly ShortcutBinding[] | null | undefined} bindings
 * @param {unknown} managedHotkey
 * @returns {string}
 */
function shortcutForResult(result, bindings, managedHotkey) {
  var owned = text(managedHotkey)
  if (owned) return owned
  var source = bindings || []
  var candidates = candidateDescriptions(result)
  for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
    var key = normalizedDescription(candidates[candidateIndex])
    var matchedHotkey = ""
    var matchCount = 0
    for (var bindingIndex = 0; bindingIndex < source.length; bindingIndex++) {
      var binding = source[bindingIndex]
      if (!binding || binding.descriptionKey !== key) continue
      matchedHotkey = text(binding.hotkey)
      matchCount += 1
    }
    if (matchCount === 1) return matchedHotkey
  }
  return ""
}

if (typeof module !== "undefined") {
  module.exports = {
    normalizeDisplayHotkey: normalizeDisplayHotkey,
    parseBindings: parseBindings,
    candidateDescriptions: candidateDescriptions,
    shortcutForResult: shortcutForResult
  }
}
