const test = require("node:test")
const assert = require("node:assert/strict")

const QuickActivationModel = require("../services/QuickActivationModel.js")

test("numbered activation maps visible ordinals to result indexes", () => {
  assert.equal(QuickActivationModel.resultIndex(1, 12, 8, true, true), 0)
  assert.equal(QuickActivationModel.resultIndex(8, 12, 8, true, true), 7)
  assert.equal(QuickActivationModel.hintForIndex(4, 12, 8, true, true), "Ctrl+5")
})

test("missing and out-of-viewport ordinals are ignored", () => {
  assert.equal(QuickActivationModel.resultIndex(4, 3, 8, true, true), -1)
  assert.equal(QuickActivationModel.resultIndex(9, 12, 8, true, true), -1)
  assert.equal(QuickActivationModel.resultIndex(0, 12, 8, true, true), -1)
})

test("settings, compact collapse, and disabled preferences can block activation", () => {
  assert.equal(QuickActivationModel.resultIndex(1, 8, 8, false, true), -1)
  assert.equal(QuickActivationModel.resultIndex(1, 8, 8, true, false), -1)
  assert.equal(QuickActivationModel.hintForIndex(0, 8, 8, true, false), "")
})
