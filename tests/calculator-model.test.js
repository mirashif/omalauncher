const test = require("node:test")
const assert = require("node:assert/strict")

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

test("arithmetic heuristics yield to strong launcher matches", () => {
  assert.equal(CalculatorModel.queryRequest("10 km to mi", false).active, true)
  assert.equal(CalculatorModel.queryRequest("10 km to mi", true).active, false)
  assert.equal(CalculatorModel.queryRequest("firefox", false).active, false)
  assert.equal(CalculatorModel.queryRequest("2; touch /tmp/nope", false).active, false)
})

test("qalc output becomes an ephemeral calculator record", () => {
  const record = CalculatorModel.resultRecord("2 + 2", "4\n")
  assert.ok(record)
  assert.equal(record.type, "calculator")
  assert.equal(record.title, "4")
  assert.equal(record.calculatorExpression, "2 + 2")
  assert.equal(record.calculatorResult, "4")
  assert.equal(CalculatorModel.resultRecord("broken", "error: failed"), null)
})

test("missing qalc produces an actionable explicit-query row", () => {
  const record = CalculatorModel.unavailableRecord("2 + 2")
  assert.equal(record.kind, "calculator-unavailable")
  assert.match(record.description, /libqalculate/)
  assert.equal(CalculatorModel.loadingRecord("2 + 2").kind, "calculator-loading")
  assert.equal(CalculatorModel.errorRecord("2 + 2", "Invalid expression").description, "Invalid expression")
  assert.equal(CalculatorModel.readyRecord().title, "Type a Calculation")
  assert.equal(CalculatorModel.readyRecord().description, "Example: = 12 * 8")
  assert.equal(CalculatorModel.disabledRecord().kind, "calculator-unavailable")
})
