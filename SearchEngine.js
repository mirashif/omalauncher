// Deterministic semantic ranking shared by QML and Node tests.

function normalize(value) {
  var text = String(value || "")
  try { text = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "") } catch (error) { }
  return text
    .toLowerCase()
    .replace(/[._\-/\\>›]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .replace(/\s+/g, " ")
}

function tokens(value) {
  var normalized = normalize(value)
  return normalized ? normalized.split(" ") : []
}

function prefixTokenIndex(term, words) {
  for (var i = 0; i < words.length; i++) {
    if (words[i].indexOf(term) === 0) return i
  }
  return -1
}

function containsTokenIndex(term, words) {
  for (var i = 0; i < words.length; i++) {
    if (words[i].indexOf(term) >= 0) return i
  }
  return -1
}

function subsequenceCost(needle, haystack) {
  var n = normalize(needle).replace(/\s+/g, "")
  var h = normalize(haystack).replace(/\s+/g, "")
  return subsequenceCostNormalized(n, h)
}

function subsequenceCostNormalized(n, h) {
  if (!n || !h) return -1
  var at = 0
  var first = -1
  var last = -1
  for (var i = 0; i < h.length && at < n.length; i++) {
    if (h.charAt(i) !== n.charAt(at)) continue
    if (first < 0) first = i
    last = i
    at += 1
  }
  if (at !== n.length) return -1
  return (last - first + 1 - n.length) + first
}

function everyTermMatches(queryTerms, words, matcher) {
  var quality = 0
  for (var i = 0; i < queryTerms.length; i++) {
    var index = matcher(queryTerms[i], words)
    if (index < 0) return -1
    quality += index
  }
  return quality
}

function everyTermFuzzyMatches(queryTerms, words) {
  var quality = 0
  for (var i = 0; i < queryTerms.length; i++) {
    var best = -1
    for (var j = 0; j < words.length; j++) {
      var cost = subsequenceCostNormalized(queryTerms[i], words[j])
      if (cost >= 0 && (best < 0 || cost < best)) best = cost
    }
    if (best < 0) return -1
    quality += best
  }
  return quality
}

function prepareRecord(record) {
  if (!record || typeof record !== "object") return record
  var aliases = Array.isArray(record.aliases) ? record.aliases : []
  record._searchTitle = normalize(record.title)
  record._searchAliases = aliases.map(function(alias) { return normalize(alias) })
  record._searchContextWords = tokens((record.title || "") + " " + (record.breadcrumb || ""))
  record._searchFullWords = tokens(record.searchText || [
    record.title,
    record.breadcrumb,
    record.description,
    record.route,
    aliases.join(" "),
    (record.keywords || []).join(" ")
  ].join(" "))
  return record
}

function semanticScorePrepared(record, needle, queryTerms) {
  if (!needle) return null

  var title = record._searchTitle === undefined ? normalize(record.title) : record._searchTitle
  var aliases = Array.isArray(record.aliases) ? record.aliases : []
  var normalizedAliases = Array.isArray(record._searchAliases)
    ? record._searchAliases : aliases.map(function(alias) { return normalize(alias) })
  for (var i = 0; i < aliases.length; i++) {
    if (normalizedAliases[i] === needle) return { tier: 1, quality: i }
  }
  if (title === needle) return { tier: 2, quality: 0 }
  if (title.indexOf(needle) === 0) return { tier: 3, quality: title.length - needle.length }

  var contextWords = Array.isArray(record._searchContextWords)
    ? record._searchContextWords : tokens((record.title || "") + " " + (record.breadcrumb || ""))
  var contextQuality = everyTermMatches(queryTerms, contextWords, prefixTokenIndex)
  if (contextQuality >= 0) return { tier: 4, quality: contextQuality + Math.max(0, contextWords.length - queryTerms.length) }

  var fullWords = Array.isArray(record._searchFullWords) ? record._searchFullWords : tokens(record.searchText || [
      record.title,
      record.breadcrumb,
      record.description,
      record.route,
      aliases.join(" "),
      (record.keywords || []).join(" ")
    ].join(" "))
  var keywordQuality = everyTermMatches(queryTerms, fullWords, containsTokenIndex)
  if (keywordQuality >= 0) return { tier: 5, quality: keywordQuality + Math.max(0, fullWords.length - queryTerms.length) }

  var fuzzyQuality = everyTermFuzzyMatches(queryTerms, fullWords)
  if (fuzzyQuality >= 0) return { tier: 6, quality: fuzzyQuality }
  return null
}

function semanticScore(record, query) {
  var needle = normalize(query)
  return semanticScorePrepared(record, needle, needle ? needle.split(" ") : [])
}

function usageScore(record, usage, now) {
  var entry = usage && usage[record.id]
  if (!entry) return 0
  var count = Math.max(0, Number(entry.count || 0))
  var lastUsed = Math.max(0, Number(entry.lastUsed || 0))
  var ageHours = lastUsed ? Math.max(0, (now - lastUsed) / 3600000) : 100000
  return Math.log(count + 1) * 10 + 10 / (1 + ageHours / 24)
}

function copyRecord(record) {
  var copy = {}
  for (var key in record) {
    if (key.indexOf("_search") === 0) continue
    if (Object.prototype.hasOwnProperty.call(record, key)) copy[key] = record[key]
  }
  return copy
}

function search(records, query, options) {
  var opts = options || {}
  var usage = opts.usage || {}
  var now = Number(opts.now || Date.now())
  var limit = Math.max(1, Number(opts.limit || 50))
  var scored = []
  var needle = normalize(query)
  if (!needle) return []
  var queryTerms = needle.split(" ")

  for (var i = 0; i < (records || []).length; i++) {
    var record = records[i]
    var semantic = semanticScorePrepared(record, needle, queryTerms)
    if (!semantic) continue
    scored.push({
      record: record,
      tier: semantic.tier,
      quality: semantic.quality,
      usage: usageScore(record, usage, now)
    })
  }

  scored.sort(function(left, right) {
    if (left.tier !== right.tier) return left.tier - right.tier
    if (left.quality !== right.quality) return left.quality - right.quality
    if (left.usage !== right.usage) return right.usage - left.usage
    var leftProvider = Number(left.record.providerPriority || 0)
    var rightProvider = Number(right.record.providerPriority || 0)
    if (leftProvider !== rightProvider) return leftProvider - rightProvider
    var leftOrder = Number(left.record.order || 0)
    var rightOrder = Number(right.record.order || 0)
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return String(left.record.route || left.record.id).localeCompare(String(right.record.route || right.record.id))
  })

  var results = []
  for (var j = 0; j < scored.length && j < limit; j++) {
    var result = copyRecord(scored[j].record)
    result.semanticTier = scored[j].tier
    result.semanticQuality = scored[j].quality
    results.push(result)
  }
  return results
}

if (typeof module !== "undefined") {
  module.exports = {
    normalize: normalize,
    tokens: tokens,
    subsequenceCost: subsequenceCost,
    prepareRecord: prepareRecord,
    semanticScore: semanticScore,
    usageScore: usageScore,
    search: search
  }
}
