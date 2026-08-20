const test = require("node:test")
const assert = require("node:assert/strict")

const GenerationModel = require("../services/GenerationModel.js")

test("generation identifiers increase monotonically", () => {
  assert.equal(GenerationModel.next(0), 1)
  assert.equal(GenerationModel.next(7), 8)
  assert.equal(GenerationModel.next("invalid"), 1)
})

test("current asynchronous output applies without a redundant restart", () => {
  assert.deepEqual(GenerationModel.completion(4, 4, false), {
    apply: true,
    restart: false
  })
})

test("superseded asynchronous output is discarded and restarted", () => {
  assert.deepEqual(GenerationModel.completion(4, 5, false), {
    apply: false,
    restart: true
  })
})

test("a queued refresh restarts even after current output applies", () => {
  assert.deepEqual(GenerationModel.completion(5, 5, true), {
    apply: true,
    restart: true
  })
})
