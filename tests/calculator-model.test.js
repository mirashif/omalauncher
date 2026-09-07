const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const CalculatorModel = require("../providers/CalculatorModel.js")

test("explicit calculator queries preserve expressions without evaluation", () => {
  assert.deepEqual(CalculatorModel.queryRequest("= 2 + 2", true), {
    active: true,
    explicit: true,
    expression: "2 + 2",
    key: "explicit:2 + 2"
  })
  assert.deepEqual(CalculatorModel.queryRequest("= ", true), {
    active: true,
    explicit: true,
    expression: "",
    key: "explicit:"
  })
})

test("math and conversions work without an equals prefix and stay active beside launcher matches", () => {
  assert.equal(CalculatorModel.queryRequest("10 km to mi", false).active, true)
  assert.equal(CalculatorModel.queryRequest("10 km to mi", true).active, true)
  assert.equal(CalculatorModel.queryRequest("2 + 2", true).active, true)
  assert.equal(CalculatorModel.queryRequest("firefox", false).active, false)
  assert.equal(CalculatorModel.queryRequest("2; touch /tmp/nope", false).active, false)
})

test("built-in arithmetic is safe and respects normal precedence", () => {
  assert.deepEqual(CalculatorModel.evaluate("2 + 2 * 3"), { ok: true, result: "8", error: "" })
  assert.deepEqual(CalculatorModel.evaluate("sqrt(81) + 3!"), { ok: true, result: "15", error: "" })
  assert.deepEqual(CalculatorModel.evaluate("max(2, 8)"), { ok: true, result: "8", error: "" })
  assert.deepEqual(CalculatorModel.evaluate("20% of 50"), { ok: true, result: "10", error: "" })
  assert.equal(CalculatorModel.evaluate("1 / 0").ok, false)
  assert.equal(CalculatorModel.evaluate("2; touch /tmp/nope").ok, false)
})

test("built-in conversions cover common compatible units", () => {
  assert.deepEqual(CalculatorModel.evaluate("10 km to mi"), {
    ok: true,
    result: "6.21371192237 mi",
    error: ""
  })
  assert.deepEqual(CalculatorModel.evaluate("100 c to f"), { ok: true, result: "212 °F", error: "" })
  assert.deepEqual(CalculatorModel.evaluate("1 GiB in MiB"), { ok: true, result: "1024 MiB", error: "" })
  assert.equal(CalculatorModel.evaluate("1 kg to miles").error, "Units are not compatible")
})

test("built-in output becomes an ephemeral calculator record", () => {
  const record = CalculatorModel.resultRecord("2 + 2", "4")
  assert.ok(record)
  assert.equal(record.type, "calculator")
  assert.equal(record.title, "4")
  assert.equal(record.calculatorExpression, "2 + 2")
  assert.equal(record.calculatorResult, "4")
  assert.equal(CalculatorModel.resultRecord("broken", ""), null)
})

test("calculator status rows teach prefix-free input", () => {
  assert.equal(CalculatorModel.errorRecord("2 + 2", "Invalid expression").description, "Invalid expression")
  assert.equal(CalculatorModel.readyRecord().title, "Type a Calculation")
  assert.equal(CalculatorModel.readyRecord().description, "Example: 12 * 8 or 10 km to mi")
  assert.equal(CalculatorModel.disabledRecord().kind, "calculator-unavailable")
})

test("calculator examples teach arithmetic and conversions with runnable expressions", () => {
  const examples = CalculatorModel.exampleRecords()
  assert.deepEqual(examples.map(row => row.calculatorExpression),
    ["12 * 8", "10 km to mi", "72 f to c"])
  assert.equal(examples.every(row => row.kind === "calculator-example"), true)
})

test("calculator provider evaluates in process without an optional backend", () => {
  const provider = fs.readFileSync(path.join(__dirname, "..", "providers", "CalculatorProvider.qml"), "utf8")
  assert.match(provider, /CalculatorModel\.evaluate\(parsed\.expression\)/)
  assert.doesNotMatch(provider, /\bProcess\s*\{|qalc|libqalculate/)
})
