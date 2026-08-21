// Pure numbered-result activation helpers shared by QML and Node tests.

/**
 * @param {unknown} ordinal
 * @param {unknown} resultCount
 * @param {unknown} maximumActivationResults
 * @param {unknown} enabled
 * @param {unknown} eligible
 * @returns {number}
 */
function resultIndex(ordinal, resultCount, maximumActivationResults, enabled, eligible) {
  if (enabled !== true || eligible !== true) return -1
  var number = Math.floor(Number(ordinal || 0))
  var count = Math.max(0, Math.floor(Number(resultCount || 0)))
  var maximum = Math.max(0, Math.floor(Number(maximumActivationResults || 0)))
  if (number < 1 || number > maximum || number > count) return -1
  return number - 1
}

/**
 * @param {unknown} index
 * @param {unknown} resultCount
 * @param {unknown} maximumActivationResults
 * @param {unknown} enabled
 * @param {unknown} eligible
 * @returns {string}
 */
function hintForIndex(index, resultCount, maximumActivationResults, enabled, eligible) {
  var ordinal = Math.floor(Number(index)) + 1
  if (resultIndex(ordinal, resultCount, maximumActivationResults, enabled, eligible) < 0) return ""
  return "Ctrl+" + (ordinal === 10 ? 0 : ordinal)
}

if (typeof module !== "undefined") {
  module.exports = {
    resultIndex: resultIndex,
    hintForIndex: hintForIndex
  }
}
