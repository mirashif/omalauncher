// Pure optional-dependency helpers shared by QML and Node tests.

/** @typedef {import("../types/models").UnknownRecord} UnknownRecord */

/** @type {Readonly<Record<string, string>>} */
var PACKAGE_BY_FEATURE = Object.freeze({
  calculator: "libqalculate",
  "file-search": "fd"
})

/** @param {unknown} value @returns {value is UnknownRecord} */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/**
 * @param {unknown} context
 * @param {string} feature
 * @returns {boolean}
 */
function featureAvailable(context, feature) {
  if (!isRecord(context)) return false
  if (feature === "calculator") return context["calculatorAvailable"] === true
  if (feature === "file-search") return context["fileSearchAvailable"] === true
  return false
}

/**
 * @param {unknown} request
 * @param {unknown} context
 * @returns {string[]}
 */
function requestedPackages(request, context) {
  var requested = String(request || "")
  var features = requested === "all"
    ? ["calculator", "file-search"]
    : (Object.prototype.hasOwnProperty.call(PACKAGE_BY_FEATURE, requested) ? [requested] : [])
  /** @type {string[]} */
  var packages = []
  for (var i = 0; i < features.length; i++) {
    var feature = features[i]
    if (!feature || featureAvailable(context, feature)) continue
    var packageName = PACKAGE_BY_FEATURE[feature]
    if (packageName) packages.push(packageName)
  }
  return packages
}

/**
 * @param {unknown} values
 * @returns {string[]}
 */
function allowedPackages(values) {
  var source = Array.isArray(values) ? values : []
  var allowed = ["libqalculate", "fd"]
  return allowed.filter(function(packageName) { return source.indexOf(packageName) >= 0 })
}

/**
 * @param {unknown} packages
 * @returns {string[]}
 */
function terminalCommand(packages) {
  var selected = allowedPackages(packages)
  if (selected.length === 0) return []
  return [
    "xdg-terminal-exec",
    "--app-id=org.omarchy.terminal",
    "--title=Install Omalauncher optional tools",
    "omarchy",
    "pkg",
    "add"
  ].concat(selected)
}

/**
 * @param {unknown} packages
 * @returns {string}
 */
function commandText(packages) {
  var selected = allowedPackages(packages)
  return selected.length > 0 ? "omarchy pkg add " + selected.join(" ") : ""
}

if (typeof module !== "undefined") {
  module.exports = {
    requestedPackages: requestedPackages,
    allowedPackages: allowedPackages,
    terminalCommand: terminalCommand,
    commandText: commandText
  }
}
