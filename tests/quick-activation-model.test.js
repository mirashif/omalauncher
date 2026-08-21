const test = require("node:test")
const assert = require("node:assert/strict")

const QuickActivationModel = require("../services/QuickActivationModel.js")

test("numbered activation maps the first ten ordinals to result indexes", () => {
  assert.equal(QuickActivationModel.resultIndex(1, 12, 10, true, true), 0)
  assert.equal(QuickActivationModel.resultIndex(9, 12, 10, true, true), 8)
  assert.equal(QuickActivationModel.resultIndex(10, 12, 10, true, true), 9)
  assert.equal(QuickActivationModel.hintForIndex(4, 12, 10, true, true), "Ctrl+5")
  assert.equal(QuickActivationModel.hintForIndex(9, 12, 10, true, true), "Ctrl+0")
})

test("missing and out-of-range ordinals are ignored", () => {
  assert.equal(QuickActivationModel.resultIndex(4, 3, 10, true, true), -1)
  assert.equal(QuickActivationModel.resultIndex(11, 12, 10, true, true), -1)
  assert.equal(QuickActivationModel.resultIndex(0, 12, 10, true, true), -1)
})

test("settings, compact collapse, and disabled preferences can block activation", () => {
  assert.equal(QuickActivationModel.resultIndex(1, 8, 10, false, true), -1)
  assert.equal(QuickActivationModel.resultIndex(1, 8, 10, true, false), -1)
  assert.equal(QuickActivationModel.hintForIndex(0, 8, 10, true, false), "")
})
