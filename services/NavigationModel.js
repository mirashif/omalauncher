// Pure list-navigation helpers shared by QML and Node tests.

/** @typedef {import("../types/models").NavigationRow} NavigationRow */

/**
 * @param {unknown} value
 * @returns {string}
 */
function text(value) {
  return String(value || "")
}

/**
 * @param {readonly NavigationRow[] | null | undefined} rows
 * @param {unknown} currentIndex
 * @param {unknown} delta
 * @returns {number}
 */
function sectionJumpIndex(rows, currentIndex, delta) {
  var values = rows || []
  if (values.length === 0) return 0
  var current = Math.max(0, Math.min(values.length - 1, Number(currentIndex || 0)))
  var direction = Number(delta || 0)
  var currentRow = values[current]
  var currentSection = text(currentRow && currentRow.section)

  if (direction > 0) {
    for (var next = current + 1; next < values.length; next++) {
      var nextRow = values[next]
      if (text(nextRow && nextRow.section) !== currentSection) return next
    }
    return current
  }

  if (direction < 0) {
    var previous = current - 1
    while (previous >= 0) {
      var candidate = values[previous]
      if (text(candidate && candidate.section) !== currentSection) break
      previous -= 1
    }
    if (previous < 0) return current
    var previousRow = values[previous]
    var previousSection = text(previousRow && previousRow.section)
    while (previous > 0) {
      var earlierRow = values[previous - 1]
      if (text(earlierRow && earlierRow.section) !== previousSection) break
      previous -= 1
    }
    return previous
  }

  return current
}

/**
 * @param {unknown} count
 * @param {unknown} currentIndex
 * @param {unknown} hoveredIndex
 * @param {unknown} moved
 * @returns {number}
 */
function pointerSelectionIndex(count, currentIndex, hoveredIndex, moved) {
  var length = Math.max(0, Math.floor(Number(count || 0)))
  if (length === 0) return 0
  var current = Math.max(0, Math.min(length - 1, Math.floor(Number(currentIndex || 0))))
  if (moved !== true) return current
  var hovered = Math.floor(Number(hoveredIndex))
  if (!isFinite(hovered) || hovered < 0 || hovered >= length) return current
  return hovered
}

if (typeof module !== "undefined") {
  module.exports = {
    sectionJumpIndex: sectionJumpIndex,
    pointerSelectionIndex: pointerSelectionIndex
  }
}
