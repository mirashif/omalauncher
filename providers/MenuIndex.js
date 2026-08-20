// Pure menu parsing and indexing logic. Keep this file compatible with both
// QML's JavaScript engine and Node so the exact production code is unit tested.

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key)
}

function cloneObject(value) {
  var out = {}
  if (!isPlainObject(value)) return out
  for (var key in value) if (own(value, key)) out[key] = value[key]
  return out
}

// Remove line/block comments and trailing commas without touching comment-like
// text inside JSON strings (notably https:// URLs in menu action strings).
function stripJsonc(raw) {
  var input = String(raw || "")
  var withoutComments = ""
  var inString = false
  var escaped = false
  var lineComment = false
  var blockComment = false

  for (var i = 0; i < input.length; i++) {
    var ch = input.charAt(i)
    var next = i + 1 < input.length ? input.charAt(i + 1) : ""

    if (lineComment) {
      if (ch === "\n" || ch === "\r") {
        lineComment = false
        withoutComments += ch
      }
      continue
    }

    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false
        i += 1
      } else if (ch === "\n" || ch === "\r") {
        withoutComments += ch
      }
      continue
    }

    if (inString) {
      withoutComments += ch
      if (escaped) escaped = false
      else if (ch === "\\") escaped = true
      else if (ch === "\"") inString = false
      continue
    }

    if (ch === "\"") {
      inString = true
      withoutComments += ch
    } else if (ch === "/" && next === "/") {
      lineComment = true
      i += 1
    } else if (ch === "/" && next === "*") {
      blockComment = true
      i += 1
    } else {
      withoutComments += ch
    }
  }

  var output = ""
  inString = false
  escaped = false
  for (var j = 0; j < withoutComments.length; j++) {
    var current = withoutComments.charAt(j)
    if (inString) {
      output += current
      if (escaped) escaped = false
      else if (current === "\\") escaped = true
      else if (current === "\"") inString = false
      continue
    }

    if (current === "\"") {
      inString = true
      output += current
      continue
    }

    if (current === ",") {
      var lookahead = j + 1
      while (lookahead < withoutComments.length && /\s/.test(withoutComments.charAt(lookahead))) lookahead += 1
      var following = withoutComments.charAt(lookahead)
      if (following === "}" || following === "]") continue
    }
    output += current
  }

  return output
}

function parseMenuJsonc(raw) {
  var stripped = stripJsonc(raw)
  if (!stripped.trim()) return { items: [], error: "" }

  var parsed
  try {
    parsed = JSON.parse(stripped)
  } catch (error) {
    return { items: [], error: String(error) }
  }

  if (!isPlainObject(parsed)) return { items: [], error: "Menu source must contain a JSON object" }
  var source = isPlainObject(parsed.items) ? parsed.items : parsed
  var items = []

  for (var id in source) {
    if (!own(source, id)) continue
    var definition = source[id]
    if (!isPlainObject(definition)) continue
    items.push({ id: String(id), definition: cloneObject(definition) })
  }

  return { items: items, error: "" }
}

function normalizeAliases(value) {
  var aliases = []
  if (Array.isArray(value)) {
    for (var i = 0; i < value.length; i++) {
      var alias = String(value[i] || "").trim()
      if (alias) aliases.push(alias)
    }
  } else {
    var single = String(value || "").trim()
    if (single) aliases.push(single)
  }
  return aliases
}

function normalizeKeywords(value) {
  if (Array.isArray(value)) return normalizeAliases(value)
  var text = String(value || "")
  if (!text) return []
  return text.split(/[;,]/).map(function(entry) { return entry.trim() }).filter(function(entry) { return entry })
}

function normalizeItem(id, definition, order) {
  var value = isPlainObject(definition) ? definition : {}
  var parent = own(value, "parent")
    ? String(value.parent || "")
    : (id.indexOf(".") >= 0 ? id.split(".").slice(0, -1).join(".") : "root")
  if (id === "root") parent = ""

  var action = String(value.action || "")
  var target = String(value.target || "")
  var kind = action ? "action" : (target ? "link" : "menu")

  return {
    id: id,
    parent: parent,
    kind: kind,
    icon: String(value.icon || ""),
    iconFont: String(value.iconFont || ""),
    label: String(value.label || id),
    title: String(value.title || ""),
    target: target,
    description: String(value.description || ""),
    action: action,
    provider: String(value.provider || ""),
    aliases: normalizeAliases(value.aliases),
    keywords: normalizeKeywords(value.keywords),
    when: String(value.when || ""),
    checked: String(value.checked || ""),
    order: order || 0
  }
}

// Definitions are merged before normalization so a user override changes only
// the fields it supplies. This matches the documented Omarchy JSONC contract.
function mergeMenuSources(defaultItems, userItems) {
  var definitions = {}
  var order = []
  var sources = [defaultItems || [], userItems || []]

  for (var sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
    var source = sources[sourceIndex]
    for (var itemIndex = 0; itemIndex < source.length; itemIndex++) {
      var parsedItem = source[itemIndex]
      if (!parsedItem || !parsedItem.id || !isPlainObject(parsedItem.definition)) continue
      var id = String(parsedItem.id)
      if (!own(definitions, id)) order.push(id)
      var mergedDefinition = cloneObject(definitions[id])
      var incoming = parsedItem.definition
      for (var key in incoming) if (own(incoming, key)) mergedDefinition[key] = incoming[key]
      definitions[id] = mergedDefinition
    }
  }

  if (!own(definitions, "root")) {
    definitions.root = { label: "Go" }
    order.unshift("root")
  }

  var items = {}
  for (var i = 0; i < order.length; i++) items[order[i]] = normalizeItem(order[i], definitions[order[i]], i)
  return { items: items, itemOrder: order }
}

function item(items, id) {
  return items && own(items, id) ? items[id] : null
}

function pathLabelsFor(items, id, includeSelf) {
  var labels = []
  var current = item(items, id)
  if (!includeSelf && current) current = item(items, current.parent)
  var seen = {}
  var guard = 0

  while (current && current.id !== "root" && guard < 32) {
    if (seen[current.id]) break
    seen[current.id] = true
    labels.unshift(current.label)
    current = item(items, current.parent)
    guard += 1
  }
  return labels
}

function pathFor(items, id) {
  return pathLabelsFor(items, id, true).join(" › ")
}

function parentPathFor(items, id) {
  return pathLabelsFor(items, id, false).join(" › ")
}

function isVisible(items, itemOrder, whenResults, entry, depth, visiting) {
  if (!entry) return false
  if (entry.when && whenResults && whenResults[entry.id] === false) return false
  if (entry.kind !== "menu" && entry.kind !== "link") return true
  if (entry.provider) return true

  var guard = depth || 0
  if (guard >= 32) return false
  var seen = visiting || {}
  if (seen[entry.id]) return false
  var nextSeen = cloneObject(seen)
  nextSeen[entry.id] = true

  var target = entry.kind === "link" ? entry.target : entry.id
  var order = Array.isArray(itemOrder) ? itemOrder : []
  for (var i = 0; i < order.length; i++) {
    var child = item(items, order[i])
    if (child && child.parent === target && isVisible(items, itemOrder, whenResults, child, guard + 1, nextSeen)) return true
  }
  return false
}

function normalizeSearchText(value) {
  var text = String(value || "")
  try { text = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "") } catch (error) { }
  return text
    .toLowerCase()
    .replace(/[._\-/\\>›]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .replace(/\s+/g, " ")
}

function buildCommandRecords(merged, whenResults, checkedResults) {
  var items = merged && merged.items ? merged.items : {}
  var itemOrder = merged && Array.isArray(merged.itemOrder) ? merged.itemOrder : []
  var records = []

  for (var i = 0; i < itemOrder.length; i++) {
    var entry = item(items, itemOrder[i])
    if (!entry || entry.id === "root") continue
    if (!isVisible(items, itemOrder, whenResults || {}, entry)) continue

    var breadcrumb = parentPathFor(items, entry.id)
    var aliases = entry.aliases.slice()
    var keywords = entry.keywords.slice()
    var searchParts = [entry.label, breadcrumb, entry.description, entry.id]
      .concat(aliases)
      .concat(keywords)

    records.push({
      id: "omarchy:" + entry.id,
      type: "omarchy-command",
      kind: entry.kind,
      title: entry.label,
      breadcrumb: breadcrumb,
      description: entry.description,
      icon: entry.icon,
      iconFont: entry.iconFont,
      appIcon: "",
      appId: "",
      aliases: aliases,
      keywords: keywords,
      route: entry.id,
      parentRoute: entry.parent && entry.parent !== "root" ? entry.parent : "root",
      targetRoute: entry.target,
      provider: entry.provider,
      checked: !!(checkedResults && checkedResults[entry.id]),
      searchText: normalizeSearchText(searchParts.join(" ")),
      providerPriority: 1,
      order: entry.order
    })
  }

  return records
}

function recordsForRoute(records, route, includeDescendants) {
  var activeRoute = String(route || "root")
  var source = Array.isArray(records) ? records : []
  var byRoute = {}
  var output = []

  for (var i = 0; i < source.length; i++) {
    var recordRoute = String(source[i] && source[i].route || "")
    if (recordRoute) byRoute[recordRoute] = source[i]
  }

  function belongsToRoute(record) {
    if (!record) return false
    var parent = String(record.parentRoute || "root")
    if (parent === activeRoute) return true
    if (!includeDescendants) return false

    var seen = {}
    var guard = 0
    while (parent && parent !== "root" && guard < 32) {
      if (seen[parent]) return false
      seen[parent] = true
      var parentRecord = byRoute[parent]
      if (!parentRecord) return false
      parent = String(parentRecord.parentRoute || "root")
      if (parent === activeRoute) return true
      guard += 1
    }
    return false
  }

  for (var j = 0; j < source.length; j++) {
    if (belongsToRoute(source[j])) output.push(source[j])
  }
  return output
}

// These helpers intentionally follow the stock menu's single-process guard
// approach, including eager caching of repeated reader commands.
var GUARD_READERS = [
  "omarchy-channel-current",
  "omarchy-default-agent",
  "omarchy-default-browser",
  "omarchy-default-editor",
  "omarchy-default-terminal",
  "omarchy-dns"
]

function guardHelpers() {
  return 'declare -A __omarchy_pkgs=()\n'
    + 'mapfile -t __omarchy_pkg_names < <({ pacman -Qq; LC_ALL=C pacman -Qi'
    + " | awk '/^[A-Za-z]/ { provides = ($0 ~ /^Provides/); sub(/^[^:]*: /, \"\") }"
    + ' provides && $0 != "None" { n = split($0, p, " ");'
    + ' for (i = 1; i <= n; i++) { sub(/[<>=].*/, "", p[i]); print p[i] } }\'; } 2>/dev/null)\n'
    + 'for __omarchy_pkg in "${__omarchy_pkg_names[@]}"; do __omarchy_pkgs[$__omarchy_pkg]=1; done\n'
    + '__omarchy_pkg_has() { [[ -n ${__omarchy_pkgs[$1]-} ]] && return 0; '
    + '[[ $1 == *[\\<\\>=]* ]] && { pacman -Q "$1" &>/dev/null; return; }; return 1; }\n'
    + 'omarchy-pkg-present() { local p; for p in "$@"; do __omarchy_pkg_has "$p" || return 1; done; return 0; }\n'
    + 'omarchy-pkg-missing() { local p; for p in "$@"; do __omarchy_pkg_has "$p" || return 0; done; return 1; }\n'
    + 'omarchy-cmd-present() { local c; for c in "$@"; do command -v "$c" &>/dev/null || return 1; done; return 0; }\n'
    + 'omarchy-cmd-missing() { local c; for c in "$@"; do command -v "$c" &>/dev/null || return 0; done; return 1; }\n'
}

function guardReaderSlot(index) {
  return "${__omarchy_read_" + index + "}"
}

function substituteGuardReaders(expression) {
  var result = String(expression || "")
  for (var i = 0; i < GUARD_READERS.length; i++) {
    result = result.split("$(" + GUARD_READERS[i] + ")").join(guardReaderSlot(i))
  }
  return result
}

function shellSingleQuote(value) {
  return "'" + String(value || "").split("'").join("'\\''") + "'"
}

function guardPrelude(guards) {
  var prelude = guardHelpers()
  for (var i = 0; i < GUARD_READERS.length; i++) {
    if (guards.indexOf(guardReaderSlot(i)) < 0) continue
    prelude += "__omarchy_read_" + i + "=$(" + GUARD_READERS[i] + " 2>/dev/null) || :\n"
  }
  return prelude
}

function guardLine(id, tag, expression) {
  var truthy = shellSingleQuote(id + ":" + tag + ":1")
  var falsy = shellSingleQuote(id + ":" + tag + ":0")
  return "if { " + substituteGuardReaders(expression) + "; } >/dev/null 2>&1; "
    + "then printf '%s\\n' " + truthy + "; else printf '%s\\n' " + falsy + "; fi\n"
}

function guardScript(items) {
  var guards = ""
  var ids = Object.keys(items || {})
  for (var i = 0; i < ids.length; i++) {
    var entry = items[ids[i]]
    if (!entry) continue
    if (entry.when) guards += guardLine(ids[i], "w", entry.when)
    if (entry.checked) guards += guardLine(ids[i], "c", entry.checked)
  }
  return guards ? guardPrelude(guards) + guards : ""
}

function parseGuardResults(raw) {
  var when = {}
  var checked = {}
  var lines = String(raw || "").split("\n")
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim()
    if (!line) continue
    var valueAt = line.lastIndexOf(":")
    if (valueAt < 0) continue
    var value = line.substring(valueAt + 1) === "1"
    var tagged = line.substring(0, valueAt)
    var tagAt = tagged.lastIndexOf(":")
    if (tagAt < 0) continue
    var id = tagged.substring(0, tagAt)
    var tag = tagged.substring(tagAt + 1)
    if (tag === "w") when[id] = value
    else if (tag === "c") checked[id] = value
  }
  return { when: when, checked: checked }
}

if (typeof module !== "undefined") {
  module.exports = {
    stripJsonc: stripJsonc,
    parseMenuJsonc: parseMenuJsonc,
    normalizeAliases: normalizeAliases,
    normalizeItem: normalizeItem,
    mergeMenuSources: mergeMenuSources,
    item: item,
    pathFor: pathFor,
    parentPathFor: parentPathFor,
    isVisible: isVisible,
    normalizeSearchText: normalizeSearchText,
    buildCommandRecords: buildCommandRecords,
    recordsForRoute: recordsForRoute,
    guardReaders: GUARD_READERS,
    guardScript: guardScript,
    parseGuardResults: parseGuardResults
  }
}
