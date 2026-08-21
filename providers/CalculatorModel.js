// Pure calculator query and output normalization shared by QML and Node tests.

/** @typedef {import("../types/models").CalculatorRequest} CalculatorRequest */
/** @typedef {import("../types/models").CalculatorRecord} CalculatorRecord */

/**
 * @param {unknown} value
 * @returns {string}
 */
function text(value) {
  return String(value || "").trim()
}

/**
 * @param {unknown} query
 * @param {unknown} strongLauncherMatch
 * @returns {CalculatorRequest}
 */
function queryRequest(query, strongLauncherMatch) {
  var raw = text(query)
  if (!raw) return { active: false, explicit: false, expression: "", key: "" }

  var explicit = raw.charAt(0) === "="
  var expression = explicit ? text(raw.slice(1)) : raw
  if (!expression) {
    return explicit
      ? { active: true, explicit: true, expression: "", key: "explicit:" }
      : { active: false, explicit: false, expression: "", key: "" }
  }
  if (expression.length > 512) {
    return { active: false, explicit: explicit, expression: "", key: "" }
  }

  var hasNumber = /[0-9]/.test(expression)
  var hasOperator = /[+*\/%^=<>]|\s-\s|^-|\b(to|in)\b/i.test(expression)
  var safeShape = /^[0-9a-zA-Z_.,+\-*\/%^=<>!()\[\]{}'"°µ$€£¥\s]+$/.test(expression)
  var heuristic = !strongLauncherMatch && hasNumber && hasOperator && safeShape
  var active = explicit || heuristic
  return {
    active: active,
    explicit: explicit,
    expression: active ? expression : "",
    key: active ? (explicit ? "explicit:" : "heuristic:") + expression : ""
  }
}

/**
 * @param {unknown} output
 * @returns {string}
 */
function normalizedResult(output) {
  var lines = String(output || "").split(/\r?\n/)
  for (var index = 0; index < lines.length; index++) {
    var value = text(lines[index])
    if (!value) continue
    if (/^(error|warning):/i.test(value)) return ""
    return value.slice(0, 1024)
  }
  return ""
}

/**
 * @param {unknown} expression
 * @param {unknown} output
 * @returns {CalculatorRecord | null}
 */
function resultRecord(expression, output) {
  var result = normalizedResult(output)
  if (!result) return null
  var source = text(expression)
  return {
    id: "calculator:" + source,
    type: "calculator",
    kind: "calculator",
    title: result,
    breadcrumb: source,
    description: "Copy calculator result",
    icon: "",
    iconFont: "",
    appIcon: "",
    appId: "",
    aliases: [],
    keywords: [],
    route: "",
    parentRoute: "root",
    searchText: source + " " + result,
    providerPriority: -10,
    order: -100,
    section: "Calculator",
    calculatorExpression: source,
    calculatorResult: result
  }
}

/**
 * @param {unknown} expression
 * @returns {CalculatorRecord}
 */
function unavailableRecord(expression) {
  var source = text(expression)
  return {
    id: "calculator:unavailable",
    type: "calculator",
    kind: "calculator-unavailable",
    title: "Calculator Unavailable",
    breadcrumb: source,
    description: "Install libqalculate to provide the qalc backend",
    icon: "",
    iconFont: "",
    appIcon: "",
    appId: "",
    aliases: [],
    keywords: [],
    route: "settings",
    parentRoute: "root",
    searchText: source,
    providerPriority: -10,
    order: -100,
    section: "Calculator",
    calculatorExpression: source,
    calculatorResult: ""
  }
}

/**
 * @param {unknown} expression
 * @param {string} kind
 * @param {string} title
 * @param {string} description
 * @param {string} icon
 * @returns {CalculatorRecord}
 */
function statusRecord(expression, kind, title, description, icon) {
  var record = unavailableRecord(expression)
  record.id = "calculator:" + kind
  record.kind = kind
  record.title = title
  record.description = description
  record.icon = icon
  record.route = ""
  return record
}

/**
 * @param {unknown} expression
 * @returns {CalculatorRecord}
 */
function loadingRecord(expression) {
  return statusRecord(expression, "calculator-loading", "Calculating…", "Waiting for qalc", "")
}

/**
 * @returns {CalculatorRecord}
 */
function readyRecord() {
  return statusRecord("", "calculator-ready", "Type a Calculation", "Example: = 12 * 8", "")
}

/**
 * @returns {CalculatorRecord}
 */
function disabledRecord() {
  return statusRecord("", "calculator-unavailable", "Calculator Disabled",
    "Enable Calculator Results in Omalauncher Settings", "")
}

/**
 * @param {unknown} expression
 * @param {unknown} message
 * @returns {CalculatorRecord}
 */
function errorRecord(expression, message) {
  return statusRecord(expression, "calculator-error", "Could Not Calculate", text(message), "")
}

if (typeof module !== "undefined") {
  module.exports = {
    queryRequest: queryRequest,
    normalizedResult: normalizedResult,
    resultRecord: resultRecord,
    unavailableRecord: unavailableRecord,
    readyRecord: readyRecord,
    disabledRecord: disabledRecord,
    loadingRecord: loadingRecord,
    errorRecord: errorRecord
  }
}
