// Pure numbered-result activation helpers shared by QML and Node tests.

function resultIndex(ordinal, resultCount, maximumVisibleRows, enabled, eligible) {
  if (enabled !== true || eligible !== true) return -1
  var number = Math.floor(Number(ordinal || 0))
  var count = Math.max(0, Math.floor(Number(resultCount || 0)))
  var visible = Math.max(0, Math.floor(Number(maximumVisibleRows || 0)))
  if (number < 1 || number > visible || number > count) return -1
  return number - 1
}

function hintForIndex(index, resultCount, maximumVisibleRows, enabled, eligible) {
  var ordinal = Math.floor(Number(index)) + 1
  return resultIndex(ordinal, resultCount, maximumVisibleRows, enabled, eligible) >= 0
    ? "Ctrl+" + ordinal : ""
}

if (typeof module !== "undefined") {
  module.exports = {
    resultIndex: resultIndex,
    hintForIndex: hintForIndex
  }
}
