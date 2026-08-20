// Converts Quickshell DesktopEntry objects (or plain test fixtures) into the
// provider-neutral records consumed by services/SearchEngine.js.

/** @typedef {import("../types/models").DesktopEntryInput} DesktopEntryInput */
/** @typedef {import("../types/models").ApplicationBuildOptions} ApplicationBuildOptions */
/** @typedef {import("../types/models").ApplicationRecord} ApplicationRecord */

/**
 * @param {unknown} value
 * @returns {value is ArrayLike<unknown>}
 */
function isArrayLike(value) {
  if (value === null || typeof value !== "object") return false
  return "length" in value && typeof value.length === "number"
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function stringList(value) {
  /** @type {string[]} */
  var out = []
  if (!value) return out
  if (typeof value === "string") {
    var parts = value.split(/[;,]/)
    for (var p = 0; p < parts.length; p++) {
      var part = String(parts[p] || "").trim()
      if (part) out.push(part)
    }
    return out
  }

  if (isArrayLike(value)) {
    for (var i = 0; i < value.length; i++) {
      var entry = String(value[i] || "").trim()
      if (entry) out.push(entry)
    }
  }
  return out
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeDesktopId(value) {
  var id = String(value || "").trim()
  return id.slice(-8) === ".desktop" ? id.slice(0, -8) : id
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeSearchText(value) {
  var text = String(value || "")
  try { text = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "") } catch (error) { }
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[._\-/\\>›]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .replace(/\s+/g, " ")
}

/**
 * @param {readonly DesktopEntryInput[] | null | undefined} entries
 * @param {ApplicationBuildOptions | null} [options]
 * @returns {ApplicationRecord[]}
 */
function buildApplicationRecords(entries, options) {
  var opts = options || {}
  /** @type {ApplicationRecord[]} */
  var records = []
  /** @type {Record<string, boolean>} */
  var seen = {}
  var values = entries || []

  for (var i = 0; i < values.length; i++) {
    var entry = values[i]
    if (!entry) continue
    if (entry.noDisplay === true || entry.hidden === true) continue
    var appId = normalizeDesktopId(entry.id)
    var title = String(entry.name || appId).trim()
    if (!appId || !title || seen[appId]) continue
    seen[appId] = true

    var genericName = String(entry.genericName || "").trim()
    var comment = String(entry.comment || "").trim()
    var keywords = stringList(entry.keywords)
    var categories = stringList(entry.categories)
    var description = genericName || comment || "Application"
    var searchParts = [title, genericName, comment, appId]
      .concat(keywords)
      .concat(categories)

    records.push({
      id: "application:" + appId,
      type: "application",
      kind: "application",
      title: title,
      breadcrumb: "",
      description: description,
      icon: "",
      iconFont: "",
      appIcon: String(entry.icon || ""),
      appId: appId,
      startupClass: String(entry.startupClass || "").trim(),
      aliases: [],
      keywords: keywords.concat(categories),
      route: "",
      parentRoute: "",
      searchText: normalizeSearchText(searchParts.join(" ")),
      providerPriority: Number(opts.providerPriority || 0),
      order: records.length
    })
  }

  records.sort(function(left, right) {
    var byTitle = left.title.toLowerCase().localeCompare(right.title.toLowerCase())
    if (byTitle !== 0) return byTitle
    return left.appId.localeCompare(right.appId)
  })
  for (var j = 0; j < records.length; j++) {
    var record = records[j]
    if (record) record.order = j
  }
  return records
}

if (typeof module !== "undefined") {
  module.exports = {
    stringList: stringList,
    normalizeDesktopId: normalizeDesktopId,
    normalizeSearchText: normalizeSearchText,
    buildApplicationRecords: buildApplicationRecords
  }
}
