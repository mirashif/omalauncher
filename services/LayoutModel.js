// Pure monitor selection and responsive card geometry helpers.

/** @typedef {import("../types/models").ScreenLike} ScreenLike */
/** @typedef {import("../types/models").CardGeometry} CardGeometry */

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function finiteNumber(value, fallback) {
  var number = Number(value)
  return isFinite(number) ? number : fallback
}

/**
 * @param {readonly ScreenLike[] | null | undefined} screens
 * @param {unknown} monitorName
 * @returns {ScreenLike | null}
 */
function screenForMonitor(screens, monitorName) {
  var name = String(monitorName || "")
  var values = screens || []
  for (var i = 0; i < values.length; i++) {
    var screen = values[i]
    if (screen && String(screen.name || "") === name) return screen
  }
  return null
}

/**
 * @param {unknown} searchHeight
 * @param {unknown} listHeight
 * @param {unknown} topMargin
 * @param {unknown} resultsOffset
 * @param {unknown} bottomMargin
 * @returns {number}
 */
function resultCardHeight(searchHeight, listHeight, topMargin, resultsOffset, bottomMargin) {
  return Math.max(0, finiteNumber(searchHeight, 0))
    + Math.max(0, finiteNumber(listHeight, 0))
    + Math.max(0, finiteNumber(topMargin, 0))
    + Math.max(0, finiteNumber(resultsOffset, 0))
    + Math.max(0, finiteNumber(bottomMargin, 0))
}

/**
 * @param {unknown} searchHeight
 * @param {unknown} padding
 * @returns {number}
 */
function compactCardHeight(searchHeight, padding) {
  return Math.max(0, finiteNumber(searchHeight, 0))
    + Math.max(0, finiteNumber(padding, 0)) * 2
}

/**
 * @param {unknown} panelWidth
 * @param {unknown} panelHeight
 * @param {unknown} desiredWidth
 * @param {unknown} desiredHeight
 * @param {unknown} gap
 * @param {unknown} anchorRatio
 * @returns {CardGeometry}
 */
function cardGeometry(panelWidth, panelHeight, desiredWidth, desiredHeight, gap, anchorRatio) {
  var panelW = Math.max(1, finiteNumber(panelWidth, 1))
  var panelH = Math.max(1, finiteNumber(panelHeight, 1))
  var margin = Math.max(0, finiteNumber(gap, 0))
  var targetWidth = Math.max(1, finiteNumber(desiredWidth, 1))
  var targetHeight = Math.max(1, finiteNumber(desiredHeight, 1))
  var ratio = Math.max(0, Math.min(1, finiteNumber(anchorRatio, 0.18)))
  var width = Math.max(1, Math.min(targetWidth, panelW - margin * 2))
  var height = Math.max(1, Math.min(targetHeight, panelH - margin * 2))
  var preferredY = Math.round(panelH * ratio)
  var maximumY = panelH - height - margin
  var y = Math.max(margin, Math.min(preferredY, maximumY))
  return { width: width, height: height, y: y }
}

if (typeof module !== "undefined") {
  module.exports = {
    screenForMonitor: screenForMonitor,
    resultCardHeight: resultCardHeight,
    compactCardHeight: compactCardHeight,
    cardGeometry: cardGeometry
  }
}
