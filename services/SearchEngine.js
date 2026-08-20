// Deterministic semantic ranking shared by QML and Node tests.

/** @typedef {import("../types/models").SearchableRecord} SearchableRecord */
/** @typedef {import("../types/models").RankedRecord} RankedRecord */
/** @typedef {import("../types/models").SearchOptions} SearchOptions */
/** @typedef {import("../types/models").SemanticScore} SemanticScore */
/** @typedef {import("../types/models").UsageMap} UsageMap */

/**
 * @param {unknown} value
 * @returns {string}
 */
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

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function tokens(value) {
  var normalized = normalize(value)
  return normalized ? normalized.split(" ") : []
}

/**
 * @param {string} term
 * @param {readonly string[]} words
 * @returns {number}
 */
function prefixTokenIndex(term, words) {
  for (var i = 0; i < words.length; i++) {
    var word = words[i]
    if (word !== undefined && word.indexOf(term) === 0) return i
  }
  return -1
}

/**
 * @param {string} term
 * @param {readonly string[]} words
 * @returns {number}
 */
function containsTokenIndex(term, words) {
  for (var i = 0; i < words.length; i++) {
    var word = words[i]
    if (word !== undefined && word.indexOf(term) >= 0) return i
  }
  return -1
}

/**
 * @param {unknown} needle
 * @param {unknown} haystack
 * @returns {number}
 */
function subsequenceCost(needle, haystack) {
  var n = normalize(needle).replace(/\s+/g, "")
  var h = normalize(haystack).replace(/\s+/g, "")
  return subsequenceCostNormalized(n, h)
}

/**
 * @param {string} n
 * @param {string} h
 * @returns {number}
 */
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

/**
 * @param {readonly string[]} queryTerms
 * @param {readonly string[]} words
 * @param {(term: string, words: readonly string[]) => number} matcher
 * @returns {number}
 */
function everyTermMatches(queryTerms, words, matcher) {
  var quality = 0
  for (var i = 0; i < queryTerms.length; i++) {
    var term = queryTerms[i]
    if (term === undefined) return -1
    var index = matcher(term, words)
    if (index < 0) return -1
    quality += index
  }
  return quality
}

/**
 * @param {readonly string[]} queryTerms
 * @param {readonly string[]} words
 * @returns {number}
 */
function everyTermFuzzyMatches(queryTerms, words) {
  var quality = 0
  for (var i = 0; i < queryTerms.length; i++) {
    var best = -1
    for (var j = 0; j < words.length; j++) {
      var queryTerm = queryTerms[i]
      var word = words[j]
      if (queryTerm === undefined || word === undefined) continue
      var cost = subsequenceCostNormalized(queryTerm, word)
      if (cost >= 0 && (best < 0 || cost < best)) best = cost
    }
    if (best < 0) return -1
    quality += best
  }
  return quality
}

/**
 * @param {SearchableRecord} record
 * @returns {SearchableRecord}
 */
function prepareRecord(record) {
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

/**
 * @param {SearchableRecord} record
 * @param {string} needle
 * @param {readonly string[]} queryTerms
 * @returns {SemanticScore | null}
 */
function semanticScorePrepared(record, needle, queryTerms) {
  if (!needle) return null

  var title = record._searchTitle === undefined ? normalize(record.title) : record._searchTitle
  var aliases = Array.isArray(record.aliases) ? record.aliases : []
  var normalizedAliases = Array.isArray(record._searchAliases)
    ? record._searchAliases : aliases.map(function(alias) { return normalize(alias) })
  for (var i = 0; i < aliases.length; i++) {
    var normalizedAlias = normalizedAliases[i]
    if (normalizedAlias === needle) return { tier: 1, quality: i }
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

/**
 * @param {SearchableRecord} record
 * @param {unknown} query
 * @returns {SemanticScore | null}
 */
function semanticScore(record, query) {
  var needle = normalize(query)
  return semanticScorePrepared(record, needle, needle ? needle.split(" ") : [])
}

/**
 * @param {SearchableRecord} record
 * @param {UsageMap | null | undefined} usage
 * @param {number} now
 * @returns {number}
 */
function usageScore(record, usage, now) {
  var entry = usage && usage[record.id]
  if (!entry) return 0
  var count = Math.max(0, Number(entry.count || 0))
  var lastUsed = Math.max(0, Number(entry.lastUsed || 0))
  var ageHours = lastUsed ? Math.max(0, (now - lastUsed) / 3600000) : 100000
  return Math.log(count + 1) * 10 + 10 / (1 + ageHours / 24)
}

/**
 * @param {SearchableRecord} record
 * @returns {SearchableRecord}
 */
function copyRecord(record) {
  var copy = Object.assign({}, record)
  delete copy._searchTitle
  delete copy._searchAliases
  delete copy._searchContextWords
  delete copy._searchFullWords
  return copy
}

/**
 * @param {readonly SearchableRecord[] | null | undefined} records
 * @param {unknown} query
 * @param {SearchOptions | null} [options]
 * @returns {RankedRecord[]}
 */
function search(records, query, options) {
  var opts = options || {}
  var usage = opts.usage || {}
  var now = Number(opts.now || Date.now())
  var limit = Math.max(1, Number(opts.limit || 50))
  /** @type {{record: SearchableRecord, tier: number, quality: number, usage: number}[]} */
  var scored = []
  var needle = normalize(query)
  if (!needle) return []
  var queryTerms = needle.split(" ")

  var source = records || []
  for (var i = 0; i < source.length; i++) {
    var record = source[i]
    if (!record) continue
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

  /** @type {RankedRecord[]} */
  var results = []
  for (var j = 0; j < scored.length && j < limit; j++) {
    var scoredResult = scored[j]
    if (!scoredResult) continue
    var result = Object.assign(copyRecord(scoredResult.record), {
      semanticTier: scoredResult.tier,
      semanticQuality: scoredResult.quality
    })
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
