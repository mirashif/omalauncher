// Safe built-in calculator and unit-conversion helpers shared by QML and Node tests.

/** @typedef {import("../types/models").CalculatorRequest} CalculatorRequest */
/** @typedef {import("../types/models").CalculatorRecord} CalculatorRecord */
/** @typedef {import("../types/models").CalculatorEvaluation} CalculatorEvaluation */
/** @typedef {{ kind: string, value: string, numberValue: number }} CalculatorToken */
/** @typedef {{ tokens: CalculatorToken[], index: number, error: string }} CalculatorParser */
/** @typedef {{ dimension: string, factor: number, offset: number, symbol: string }} UnitDefinition */
/** @typedef {{ valueExpression: string, sourceUnit: UnitDefinition, targetUnit: UnitDefinition }} ConversionParts */

/** @param {unknown} value @returns {string} */
function text(value) {
  return String(value || "").trim()
}

/** @type {Record<string, UnitDefinition>} */
var UNITS = {}
/** @type {string[]} */
var UNIT_ALIASES = []

/**
 * @param {string[]} aliases
 * @param {string} dimension
 * @param {number} factor
 * @param {number} offset
 * @param {string} symbol
 */
function registerUnit(aliases, dimension, factor, offset, symbol) {
  var definition = { dimension: dimension, factor: factor, offset: offset, symbol: symbol }
  for (var index = 0; index < aliases.length; index++) {
    var alias = aliases[index]
    if (!alias) continue
    var key = alias.toLowerCase()
    UNITS[key] = definition
    UNIT_ALIASES.push(key)
  }
}

registerUnit(["mm", "millimeter", "millimeters", "millimetre", "millimetres"], "length", 0.001, 0, "mm")
registerUnit(["cm", "centimeter", "centimeters", "centimetre", "centimetres"], "length", 0.01, 0, "cm")
registerUnit(["m", "meter", "meters", "metre", "metres"], "length", 1, 0, "m")
registerUnit(["km", "kilometer", "kilometers", "kilometre", "kilometres"], "length", 1000, 0, "km")
registerUnit(["in", "inch", "inches"], "length", 0.0254, 0, "in")
registerUnit(["ft", "foot", "feet"], "length", 0.3048, 0, "ft")
registerUnit(["yd", "yard", "yards"], "length", 0.9144, 0, "yd")
registerUnit(["mi", "mile", "miles"], "length", 1609.344, 0, "mi")

registerUnit(["mg", "milligram", "milligrams"], "mass", 0.000001, 0, "mg")
registerUnit(["g", "gram", "grams"], "mass", 0.001, 0, "g")
registerUnit(["kg", "kilogram", "kilograms"], "mass", 1, 0, "kg")
registerUnit(["oz", "ounce", "ounces"], "mass", 0.028349523125, 0, "oz")
registerUnit(["lb", "lbs", "pound", "pounds"], "mass", 0.45359237, 0, "lb")

registerUnit(["ms", "millisecond", "milliseconds"], "time", 0.001, 0, "ms")
registerUnit(["s", "sec", "second", "seconds"], "time", 1, 0, "s")
registerUnit(["min", "minute", "minutes"], "time", 60, 0, "min")
registerUnit(["h", "hr", "hour", "hours"], "time", 3600, 0, "h")
registerUnit(["day", "days"], "time", 86400, 0, "days")
registerUnit(["week", "weeks"], "time", 604800, 0, "weeks")

registerUnit(["c", "°c", "celsius", "degree celsius", "degrees celsius"], "temperature", 1, 0, "°C")
registerUnit(["f", "°f", "fahrenheit", "degree fahrenheit", "degrees fahrenheit"], "temperature", 5 / 9, -32 * 5 / 9, "°F")
registerUnit(["k", "kelvin", "kelvins"], "temperature", 1, -273.15, "K")

registerUnit(["ml", "milliliter", "milliliters", "millilitre", "millilitres"], "volume", 0.001, 0, "mL")
registerUnit(["l", "liter", "liters", "litre", "litres"], "volume", 1, 0, "L")
registerUnit(["tsp", "teaspoon", "teaspoons"], "volume", 0.00492892159375, 0, "tsp")
registerUnit(["tbsp", "tablespoon", "tablespoons"], "volume", 0.01478676478125, 0, "tbsp")
registerUnit(["cup", "cups"], "volume", 0.2365882365, 0, "cups")
registerUnit(["pt", "pint", "pints"], "volume", 0.473176473, 0, "pt")
registerUnit(["qt", "quart", "quarts"], "volume", 0.946352946, 0, "qt")
registerUnit(["gal", "gallon", "gallons"], "volume", 3.785411784, 0, "gal")

registerUnit(["m/s", "mps"], "speed", 1, 0, "m/s")
registerUnit(["km/h", "kmh", "kph"], "speed", 1 / 3.6, 0, "km/h")
registerUnit(["mph", "mi/h"], "speed", 0.44704, 0, "mph")
registerUnit(["ft/s", "fps"], "speed", 0.3048, 0, "ft/s")

registerUnit(["m2", "m²", "sqm"], "area", 1, 0, "m²")
registerUnit(["km2", "km²", "sqkm"], "area", 1000000, 0, "km²")
registerUnit(["ft2", "ft²", "sqft"], "area", 0.09290304, 0, "ft²")
registerUnit(["acre", "acres"], "area", 4046.8564224, 0, "acres")
registerUnit(["ha", "hectare", "hectares"], "area", 10000, 0, "ha")

registerUnit(["byte", "bytes", "b"], "data", 1, 0, "B")
registerUnit(["kb", "kilobyte", "kilobytes"], "data", 1000, 0, "KB")
registerUnit(["mb", "megabyte", "megabytes"], "data", 1000000, 0, "MB")
registerUnit(["gb", "gigabyte", "gigabytes"], "data", 1000000000, 0, "GB")
registerUnit(["tb", "terabyte", "terabytes"], "data", 1000000000000, 0, "TB")
registerUnit(["kib", "kibibyte", "kibibytes"], "data", 1024, 0, "KiB")
registerUnit(["mib", "mebibyte", "mebibytes"], "data", 1048576, 0, "MiB")
registerUnit(["gib", "gibibyte", "gibibytes"], "data", 1073741824, 0, "GiB")

registerUnit(["deg", "degree", "degrees", "°"], "angle", Math.PI / 180, 0, "°")
registerUnit(["rad", "radian", "radians"], "angle", 1, 0, "rad")

UNIT_ALIASES.sort(function(left, right) { return right.length - left.length })

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
  var hasMathShape = /[+*\/\%^=<>!()]|\s-\s|^-|\b(to|in|of)\b/i.test(expression)
  var safeShape = /^[0-9a-zA-Z_.,+\-*\/\%^=<>!()'"°µ²³\s]+$/.test(expression)
  var heuristic = hasNumber && hasMathShape && safeShape
  var active = explicit || heuristic
  // A valid calculation remains useful even when launcher records also match.
  void strongLauncherMatch
  return {
    active: active,
    explicit: explicit,
    expression: active ? expression : "",
    key: active ? (explicit ? "explicit:" : "heuristic:") + expression : ""
  }
}

/**
 * @param {string} source
 * @returns {{ tokens: CalculatorToken[], error: string }}
 */
function tokenize(source) {
  /** @type {CalculatorToken[]} */
  var tokens = []
  var input = source.replace(/×/g, "*").replace(/÷/g, "/").replace(/\bof\b/gi, "*")
    .replace(/\*\*/g, "^")
  var index = 0
  while (index < input.length) {
    var character = input.charAt(index)
    if (/\s/.test(character)) {
      index++
      continue
    }
    var remaining = input.slice(index)
    var numberMatch = remaining.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i)
    if (numberMatch && numberMatch[0]) {
      var numberValue = Number(numberMatch[0])
      if (!isFinite(numberValue)) return { tokens: [], error: "Number is too large" }
      tokens.push({ kind: "number", value: numberMatch[0], numberValue: numberValue })
      index += numberMatch[0].length
      continue
    }
    var identifierMatch = remaining.match(/^[A-Za-z_][A-Za-z0-9_]*/)
    if (identifierMatch && identifierMatch[0]) {
      tokens.push({ kind: "identifier", value: identifierMatch[0].toLowerCase(), numberValue: 0 })
      index += identifierMatch[0].length
      continue
    }
    if (character === "(") tokens.push({ kind: "left", value: character, numberValue: 0 })
    else if (character === ")") tokens.push({ kind: "right", value: character, numberValue: 0 })
    else if (character === ",") tokens.push({ kind: "comma", value: character, numberValue: 0 })
    else if ("+-*/%^!".indexOf(character) >= 0) {
      tokens.push({ kind: "operator", value: character, numberValue: 0 })
    } else {
      return { tokens: [], error: "Unsupported character" }
    }
    index++
  }
  tokens.push({ kind: "end", value: "", numberValue: 0 })
  return { tokens: tokens, error: "" }
}

/** @param {CalculatorParser} parser @returns {CalculatorToken} */
function currentToken(parser) {
  return parser.tokens[parser.index] || { kind: "end", value: "", numberValue: 0 }
}

/** @param {CalculatorParser} parser @returns {CalculatorToken} */
function consumeToken(parser) {
  var token = currentToken(parser)
  parser.index++
  return token
}

/**
 * @param {string} name
 * @param {number[]} args
 * @returns {number}
 */
function functionValue(name, args) {
  if (name === "sqrt" && args.length === 1) return Math.sqrt(args[0] || 0)
  if (name === "abs" && args.length === 1) return Math.abs(args[0] || 0)
  if (name === "sin" && args.length === 1) return Math.sin(args[0] || 0)
  if (name === "cos" && args.length === 1) return Math.cos(args[0] || 0)
  if (name === "tan" && args.length === 1) return Math.tan(args[0] || 0)
  if ((name === "ln" || name === "log") && args.length === 1) return Math.log(args[0] || 0)
  if (name === "log10" && args.length === 1) return Math.log(args[0] || 0) / Math.LN10
  if (name === "floor" && args.length === 1) return Math.floor(args[0] || 0)
  if (name === "ceil" && args.length === 1) return Math.ceil(args[0] || 0)
  if (name === "round" && args.length === 1) return Math.round(args[0] || 0)
  if (name === "min" && args.length > 0) return Math.min.apply(Math, args)
  if (name === "max" && args.length > 0) return Math.max.apply(Math, args)
  if (name === "pow" && args.length === 2) return Math.pow(args[0] || 0, args[1] || 0)
  return NaN
}

/** @param {CalculatorParser} parser @returns {number} */
function parsePrefix(parser) {
  var token = consumeToken(parser)
  if (token.kind === "number") return token.numberValue
  if (token.kind === "operator" && (token.value === "+" || token.value === "-")) {
    var unaryValue = parseExpression(parser, 3)
    return token.value === "-" ? -unaryValue : unaryValue
  }
  if (token.kind === "left") {
    var grouped = parseExpression(parser, 0)
    if (currentToken(parser).kind !== "right") {
      parser.error = "Missing closing parenthesis"
      return NaN
    }
    consumeToken(parser)
    return grouped
  }
  if (token.kind === "identifier") {
    if (token.value === "pi") return Math.PI
    if (token.value === "e") return Math.E
    if (currentToken(parser).kind !== "left") {
      parser.error = "Unknown name"
      return NaN
    }
    consumeToken(parser)
    /** @type {number[]} */
    var args = []
    if (currentToken(parser).kind !== "right") {
      while (!parser.error) {
        args.push(parseExpression(parser, 0))
        if (currentToken(parser).kind !== "comma") break
        consumeToken(parser)
      }
    }
    if (currentToken(parser).kind !== "right") {
      parser.error = "Missing closing parenthesis"
      return NaN
    }
    consumeToken(parser)
    var calculated = functionValue(token.value, args)
    if (!isFinite(calculated)) parser.error = "Invalid function or value"
    return calculated
  }
  parser.error = "Expected a number"
  return NaN
}

/** @param {number} value @returns {number} */
function factorial(value) {
  if (value < 0 || value > 170 || Math.floor(value) !== value) return NaN
  var result = 1
  for (var index = 2; index <= value; index++) result *= index
  return result
}

/** @param {CalculatorToken} token @returns {number} */
function precedence(token) {
  if (token.kind !== "operator") return -1
  if (token.value === "+" || token.value === "-") return 1
  if (token.value === "*" || token.value === "/" || token.value === "%") return 2
  if (token.value === "^") return 3
  return -1
}

/**
 * @param {CalculatorParser} parser
 * @param {number} minimumPrecedence
 * @returns {number}
 */
function parseExpression(parser, minimumPrecedence) {
  var left = parsePrefix(parser)
  while (!parser.error) {
    var token = currentToken(parser)
    if (token.kind === "operator" && token.value === "!") {
      consumeToken(parser)
      left = factorial(left)
      if (!isFinite(left)) parser.error = "Factorial needs an integer from 0 to 170"
      continue
    }
    if (token.kind === "operator" && token.value === "%") {
      var afterPercent = parser.tokens[parser.index + 1]
      var postfix = !afterPercent || afterPercent.kind === "end" || afterPercent.kind === "right"
        || afterPercent.kind === "comma" || afterPercent.kind === "operator"
      if (postfix) {
        consumeToken(parser)
        left /= 100
        continue
      }
    }
    var operatorPrecedence = precedence(token)
    if (operatorPrecedence < minimumPrecedence) break
    consumeToken(parser)
    var right = parseExpression(parser,
      token.value === "^" ? operatorPrecedence : operatorPrecedence + 1)
    if (token.value === "+") left += right
    else if (token.value === "-") left -= right
    else if (token.value === "*") left *= right
    else if (token.value === "/") {
      if (right === 0) parser.error = "Cannot divide by zero"
      else left /= right
    } else if (token.value === "%") {
      if (right === 0) parser.error = "Cannot divide by zero"
      else left %= right
    } else if (token.value === "^") left = Math.pow(left, right)
    if (!isFinite(left) && !parser.error) parser.error = "Result is not a finite number"
  }
  return left
}

/**
 * @param {string} expression
 * @returns {{ ok: boolean, value: number, error: string }}
 */
function arithmeticValue(expression) {
  var tokenized = tokenize(expression)
  if (tokenized.error) return { ok: false, value: 0, error: tokenized.error }
  var parser = { tokens: tokenized.tokens, index: 0, error: "" }
  var value = parseExpression(parser, 0)
  if (!parser.error && currentToken(parser).kind !== "end") parser.error = "Unexpected input"
  if (!parser.error && !isFinite(value)) parser.error = "Result is not a finite number"
  return parser.error
    ? { ok: false, value: 0, error: parser.error }
    : { ok: true, value: value, error: "" }
}

/** @param {string} unit @returns {UnitDefinition | null} */
function unitDefinition(unit) {
  return UNITS[unit.toLowerCase().trim()] || null
}

/** @param {string} expression @returns {ConversionParts | null} */
function conversionParts(expression) {
  var match = expression.match(/^(.+)\s+(?:to|in)\s+(.+)$/i)
  if (!match || !match[1] || !match[2]) return null
  var target = unitDefinition(match[2])
  if (!target) return null
  var left = text(match[1])
  var lowerLeft = left.toLowerCase()
  for (var index = 0; index < UNIT_ALIASES.length; index++) {
    var alias = UNIT_ALIASES[index]
    if (!alias || lowerLeft.slice(-alias.length) !== alias) continue
    var valueExpression = text(left.slice(0, left.length - alias.length))
    if (!valueExpression) continue
    var source = unitDefinition(alias)
    if (source) return { valueExpression: valueExpression, sourceUnit: source, targetUnit: target }
  }
  return null
}

/** @param {number} value @returns {string} */
function formatNumber(value) {
  var normalized = Math.abs(value) < 1e-12 ? 0 : value
  return String(Number(normalized.toPrecision(12)))
}

/** @param {unknown} expression @returns {CalculatorEvaluation} */
function evaluate(expression) {
  var source = text(expression)
  if (!source) return { ok: false, result: "", error: "Enter a calculation" }
  var conversion = conversionParts(source)
  if (conversion) {
    if (conversion.sourceUnit.dimension !== conversion.targetUnit.dimension) {
      return { ok: false, result: "", error: "Units are not compatible" }
    }
    var conversionValue = arithmeticValue(conversion.valueExpression)
    if (!conversionValue.ok) return { ok: false, result: "", error: conversionValue.error }
    var baseValue = conversionValue.value * conversion.sourceUnit.factor + conversion.sourceUnit.offset
    var converted = (baseValue - conversion.targetUnit.offset) / conversion.targetUnit.factor
    if (!isFinite(converted)) return { ok: false, result: "", error: "Result is not a finite number" }
    return { ok: true, result: formatNumber(converted) + " " + conversion.targetUnit.symbol, error: "" }
  }
  if (/\s+(?:to|in)\s+/i.test(source)) {
    return { ok: false, result: "", error: "Unknown or incomplete unit conversion" }
  }
  var arithmetic = arithmeticValue(source)
  return arithmetic.ok
    ? { ok: true, result: formatNumber(arithmetic.value), error: "" }
    : { ok: false, result: "", error: arithmetic.error }
}

/**
 * @param {unknown} expression
 * @param {unknown} output
 * @returns {CalculatorRecord | null}
 */
function resultRecord(expression, output) {
  var result = text(output)
  if (!result) return null
  var source = text(expression)
  return {
    id: "calculator:" + source,
    type: "calculator",
    kind: "calculator",
    title: result.slice(0, 1024),
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
    calculatorResult: result.slice(0, 1024)
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
  var source = text(expression)
  return {
    id: "calculator:" + kind,
    type: "calculator",
    kind: kind,
    title: title,
    breadcrumb: source,
    description: description,
    icon: icon,
    iconFont: "",
    appIcon: "",
    appId: "",
    aliases: [],
    keywords: [],
    route: "",
    parentRoute: "root",
    searchText: source,
    providerPriority: -10,
    order: -100,
    section: "Calculator",
    calculatorExpression: source,
    calculatorResult: ""
  }
}

/** @returns {CalculatorRecord} */
function readyRecord() {
  return statusRecord("", "calculator-ready", "Type a Calculation", "Example: 12 * 8 or 10 km to mi", "")
}

/** @returns {CalculatorRecord} */
function disabledRecord() {
  return statusRecord("", "calculator-unavailable", "Calculator Disabled",
    "Enable Calculator Results in OmaLauncher Settings", "")
}

/** @param {unknown} expression @param {unknown} message @returns {CalculatorRecord} */
function errorRecord(expression, message) {
  return statusRecord(expression, "calculator-error", "Could Not Calculate", text(message), "")
}

if (typeof module !== "undefined") {
  module.exports = {
    queryRequest: queryRequest,
    evaluate: evaluate,
    resultRecord: resultRecord,
    readyRecord: readyRecord,
    disabledRecord: disabledRecord,
    errorRecord: errorRecord,
    formatNumber: formatNumber
  }
}
