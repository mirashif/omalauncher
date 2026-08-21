// Pure scoped file-query helpers shared by QML and Node tests.

/** @typedef {import("../types/models").QueryRequest} QueryRequest */
/** @typedef {import("../types/models").FileRank} FileRank */
/** @typedef {import("../types/models").FileRecord} FileRecord */
/** @typedef {import("../types/models").SearchableRecord} SearchableRecord */
/** @typedef {import("../types/models").DescribedRecord} DescribedRecord */

/**
 * @param {unknown} value
 * @returns {string}
 */
function text(value) {
  return String(value || "").trim()
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizePath(value) {
  var path = String(value === undefined || value === null ? "" : value).replace(/\/+$/g, "")
  return path && path.charAt(0) === "/" ? path : ""
}

/**
 * @param {unknown} rawQuery
 * @param {unknown} routeActive
 * @returns {QueryRequest}
 */
function queryRequest(rawQuery, routeActive) {
  var raw = String(rawQuery || "")
  if (routeActive === true) return { active: true, query: raw.trim(), explicit: false }
  var match = raw.match(/^\s*f\s+(.*)$/i)
  return match
    ? { active: true, query: String(match[1] || "").trim(), explicit: true }
    : { active: false, query: "", explicit: false }
}

/**
 * @param {unknown} fdPath
 * @param {unknown} query
 * @param {readonly unknown[] | null | undefined} scopes
 * @param {readonly unknown[] | null | undefined} ignores
 * @param {unknown} limit
 * @returns {string[]}
 */
function commandArguments(fdPath, query, scopes, ignores, limit) {
  var executable = text(fdPath) || "fd"
  var maximum = Math.max(1, Math.min(500, Math.floor(Number(limit || 100))))
  var args = [
    executable,
    "--type", "f",
    "--color", "never",
    "--absolute-path",
    "--print0",
    "--max-results", String(maximum),
    "--fixed-strings"
  ]
  var ignoreValues = Array.isArray(ignores) ? ignores : []
  for (var ignoreIndex = 0; ignoreIndex < ignoreValues.length; ignoreIndex++) {
    var ignore = text(ignoreValues[ignoreIndex])
    if (ignore) args.push("--exclude", ignore)
  }
  var scopeValues = Array.isArray(scopes) ? scopes : []
  for (var scopeIndex = 0; scopeIndex < scopeValues.length; scopeIndex++) {
    var scope = normalizePath(scopeValues[scopeIndex])
    if (scope && scope !== "/") args.push("--search-path", scope)
  }
  args.push("--", String(query || ""))
  return args
}

/**
 * @param {unknown} realpathPath
 * @param {readonly unknown[] | null | undefined} paths
 * @param {unknown} limit
 * @returns {string[]}
 */
function canonicalizeArguments(realpathPath, paths, limit) {
  var executable = text(realpathPath) || "realpath"
  var maximum = Math.max(1, Math.min(500, Math.floor(Number(limit || 100))))
  var values = Array.isArray(paths) ? paths : []
  var args = [executable, "-e", "-z", "--"]
  for (var index = 0; index < values.length && args.length - 4 < maximum; index++) {
    var path = normalizePath(values[index])
    if (path) args.push(path)
  }
  return args
}

/**
 * @param {unknown} pathValue
 * @param {readonly unknown[] | null | undefined} scopes
 * @returns {string}
 */
function scopeForPath(pathValue, scopes) {
  var path = normalizePath(pathValue)
  var values = Array.isArray(scopes) ? scopes : []
  var best = ""
  for (var index = 0; index < values.length; index++) {
    var scope = normalizePath(values[index])
    if (!scope || scope === "/") continue
    if (path.indexOf(scope + "/") !== 0) continue
    if (scope.length > best.length) best = scope
  }
  return best
}

/**
 * @param {unknown} pathValue
 * @returns {string}
 */
function basename(pathValue) {
  var path = normalizePath(pathValue)
  return path ? path.slice(path.lastIndexOf("/") + 1) : ""
}

/**
 * @param {unknown} pathValue
 * @returns {string}
 */
function parentPath(pathValue) {
  var path = normalizePath(pathValue)
  if (!path) return ""
  var slash = path.lastIndexOf("/")
  return slash <= 0 ? "/" : path.slice(0, slash)
}

/**
 * @param {unknown} pathValue
 * @param {unknown} scopeValue
 * @returns {string}
 */
function relativePath(pathValue, scopeValue) {
  var path = normalizePath(pathValue)
  var scope = normalizePath(scopeValue)
  return path.indexOf(scope + "/") === 0 ? path.slice(scope.length + 1) : path
}

/**
 * @param {unknown} pathValue
 * @param {unknown} scopeValue
 * @returns {string}
 */
function breadcrumbForPath(pathValue, scopeValue) {
  var relative = relativePath(pathValue, scopeValue)
  var slash = relative.lastIndexOf("/")
  var parent = slash >= 0 ? relative.slice(0, slash) : ""
  var scopeName = basename(scopeValue)
  return scopeName + (parent ? " › " + parent.replace(/\//g, " › ") : "")
}

/**
 * @param {unknown} pathValue
 * @returns {string}
 */
function iconForPath(pathValue) {
  var name = basename(pathValue).toLowerCase()
  if (/\.(png|jpe?g|gif|webp|svg|avif)$/.test(name)) return ""
  if (/\.(mp4|mkv|webm|mov|avi)$/.test(name)) return ""
  if (/\.(mp3|flac|wav|ogg|m4a)$/.test(name)) return ""
  if (/\.(zip|tar|gz|bz2|xz|zst|7z|rar)$/.test(name)) return ""
  if (/\.(pdf|docx?|odt|txt|md|rtf)$/.test(name)) return ""
  if (/\.(js|ts|py|rb|go|rs|c|cpp|h|qml|json|toml|ya?ml|sh)$/.test(name)) return ""
  return ""
}

/**
 * @param {unknown} pathValue
 * @param {unknown} scope
 * @param {unknown} query
 * @returns {number}
 */
function matchTier(pathValue, scope, query) {
  var needle = text(query).toLowerCase()
  var name = basename(pathValue).toLowerCase()
  var relative = relativePath(pathValue, scope).toLowerCase()
  if (name === needle) return 0
  if (name.indexOf(needle) === 0) return 1
  if (name.indexOf(needle) >= 0) return 2
  if (relative.indexOf(needle) >= 0) return 3
  return 4
}

/**
 * @param {readonly unknown[] | null | undefined} paths
 * @param {unknown} query
 * @param {readonly unknown[] | null | undefined} scopes
 * @param {unknown} limit
 * @returns {FileRecord[]}
 */
function recordsForPaths(paths, query, scopes, limit) {
  var values = Array.isArray(paths) ? paths : []
  var maximum = Math.max(1, Math.min(500, Math.floor(Number(limit || 100))))
  /** @type {Record<string, boolean>} */
  var seen = {}
  /** @type {FileRank[]} */
  var ranked = []
  for (var index = 0; index < values.length; index++) {
    var path = normalizePath(values[index])
    var scope = scopeForPath(path, scopes)
    if (!path || !scope || seen[path]) continue
    seen[path] = true
    ranked.push({
      path: path,
      scope: scope,
      tier: matchTier(path, scope, query),
      relative: relativePath(path, scope)
    })
  }
  ranked.sort(function(left, right) {
    if (left.tier !== right.tier) return left.tier - right.tier
    var leftDepth = left.relative.split("/").length
    var rightDepth = right.relative.split("/").length
    if (leftDepth !== rightDepth) return leftDepth - rightDepth
    return left.relative.toLowerCase().localeCompare(right.relative.toLowerCase())
  })

  /** @type {FileRecord[]} */
  var records = []
  for (var resultIndex = 0; resultIndex < ranked.length && records.length < maximum; resultIndex++) {
    var result = ranked[resultIndex]
    if (!result) continue
    var name = basename(result.path)
    records.push({
      id: "file:" + result.scope + ":" + result.relative,
      type: "file",
      kind: "file",
      title: name,
      breadcrumb: breadcrumbForPath(result.path, result.scope),
      description: result.path,
      icon: iconForPath(result.path),
      iconFont: "",
      appIcon: "",
      appId: "",
      aliases: [],
      keywords: [],
      route: "",
      parentRoute: "files",
      searchText: name + " " + result.relative,
      providerPriority: -5,
      order: resultIndex,
      section: "Files",
      filePath: result.path,
      fileScope: result.scope
    })
  }
  return records
}

/**
 * @param {string} kind
 * @param {string} title
 * @param {string} description
 * @param {string} route
 * @returns {DescribedRecord}
 */
function statusRecord(kind, title, description, route) {
  return {
    id: "file-search:" + kind,
    type: "file-status",
    kind: "file-search-" + kind,
    title: title,
    breadcrumb: "",
    description: description,
    icon: kind === "loading" ? "" : (kind === "ready" ? "󰈞" : ""),
    iconFont: "",
    appIcon: "",
    appId: "",
    aliases: [],
    keywords: [],
    route: route || "",
    parentRoute: "files",
    searchText: title + " " + description,
    providerPriority: -5,
    order: -1,
    section: "Files",
    filePath: "",
    fileScope: ""
  }
}

/**
 * @param {unknown} enabled
 * @param {unknown} scopeCount
 * @returns {DescribedRecord}
 */
function managementRecord(enabled, scopeCount) {
  return {
    id: "omalauncher:search-files",
    type: "launcher-command",
    kind: "open-files",
    title: "Search Files",
    breadcrumb: "",
    description: enabled === true
      ? (Number(scopeCount || 0) + " configured scope" + (Number(scopeCount || 0) === 1 ? "" : "s")
        + " · Root shortcut: f report.pdf")
      : "Enable in Settings · Root shortcut: f report.pdf",
    icon: "󰈞",
    iconFont: "",
    appIcon: "",
    appId: "",
    aliases: [],
    keywords: ["file", "find", "search", "scope"],
    route: "files",
    parentRoute: "root",
    searchText: "search files find path folder scoped omalauncher",
    providerPriority: -1,
    order: -1,
    section: "Launcher"
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    normalizePath: normalizePath,
    queryRequest: queryRequest,
    commandArguments: commandArguments,
    canonicalizeArguments: canonicalizeArguments,
    scopeForPath: scopeForPath,
    basename: basename,
    parentPath: parentPath,
    relativePath: relativePath,
    breadcrumbForPath: breadcrumbForPath,
    recordsForPaths: recordsForPaths,
    statusRecord: statusRecord,
    managementRecord: managementRecord
  }
}
