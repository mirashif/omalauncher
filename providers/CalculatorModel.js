// Pure calculator query and output normalization shared by QML and Node tests.

function text(value) {
  return String(value || "").trim()
}

function queryRequest(query, strongLauncherMatch) {
  var raw = text(query)
  if (!raw) return { active: false, explicit: false, expression: "", key: "" }

  var explicit = raw.charAt(0) === "="
  var expression = explicit ? text(raw.slice(1)) : raw
  if (!expression || expression.length > 512) {
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

function loadingRecord(expression) {
  return statusRecord(expression, "calculator-loading", "Calculating…", "Waiting for qalc", "")
}

function errorRecord(expression, message) {
  return statusRecord(expression, "calculator-error", "Could Not Calculate", text(message), "")
}

if (typeof module !== "undefined") {
  module.exports = {
    queryRequest: queryRequest,
    normalizedResult: normalizedResult,
    resultRecord: resultRecord,
    unavailableRecord: unavailableRecord,
    loadingRecord: loadingRecord,
    errorRecord: errorRecord
  }
}
