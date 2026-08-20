// Safe rich-text highlighting shared by QML and Node tests.

/**
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * @param {unknown} value
 * @param {readonly unknown[] | null | undefined} queryTerms
 * @returns {string}
 */
function highlight(value, queryTerms) {
  var source = String(value || "")
  /** @type {string[]} */
  var terms = []
  /** @type {Record<string, boolean>} */
  var seen = {}
  var values = Array.isArray(queryTerms) ? queryTerms : []
  for (var i = 0; i < values.length; i++) {
    var term = String(values[i] || "").toLowerCase()
    if (!term || seen[term]) continue
    seen[term] = true
    terms.push(term)
  }
  if (terms.length === 0) return escapeHtml(source)
  terms.sort(function(left, right) { return right.length - left.length })

  var matcher = new RegExp("(" + terms.map(escapeRegex).join("|") + ")[a-z0-9]*", "ig")
  var output = ""
  var last = 0
  var match
  while ((match = matcher.exec(source)) !== null) {
    output += escapeHtml(source.slice(last, match.index))
    var matchedText = match[0] || ""
    output += "<b>" + escapeHtml(matchedText) + "</b>"
    last = match.index + matchedText.length
    if (matchedText.length === 0) matcher.lastIndex += 1
  }
  return output + escapeHtml(source.slice(last))
}

if (typeof module !== "undefined") {
  module.exports = { escapeHtml: escapeHtml, highlight: highlight }
}
