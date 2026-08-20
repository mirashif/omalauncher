// Converts Quickshell DesktopEntry objects (or plain test fixtures) into the
// provider-neutral records consumed by SearchEngine.js.

function stringList(value) {
  var out = []
  if (!value) return out
  if (typeof value === "string") {
    var parts = value.split(/[;,]/)
    for (var p = 0; p < parts.length; p++) {
      var part = parts[p].trim()
      if (part) out.push(part)
    }
    return out
  }

  try {
    for (var i = 0; i < value.length; i++) {
      var entry = String(value[i] || "").trim()
      if (entry) out.push(entry)
    }
  } catch (error) { }
  return out
}

function normalizeDesktopId(value) {
  var id = String(value || "").trim()
  return id.slice(-8) === ".desktop" ? id.slice(0, -8) : id
}

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

function buildApplicationRecords(entries, options) {
  var opts = options || {}
  var records = []
  var seen = {}
  var values = entries || []

  for (var i = 0; i < values.length; i++) {
    var entry = values[i]
    if (!entry || entry.noDisplay === true || entry.hidden === true) continue
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
  for (var j = 0; j < records.length; j++) records[j].order = j
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
