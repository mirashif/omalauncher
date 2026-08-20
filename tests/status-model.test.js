const test = require("node:test")
const assert = require("node:assert/strict")

const StatusModel = require("../services/StatusModel.js")

test("loading states distinguish persistence from provider indexing", () => {
  assert.equal(StatusModel.emptyStatus({ stateReady: false }).title, "Loading launcher state…")
  assert.equal(StatusModel.emptyStatus({ stateReady: true, indexSettled: false }).title, "Building unified index…")
  assert.equal(StatusModel.emptyStatus({ stateReady: true, indexSettled: false, query: "firefox" }).title, "Still building the unified index…")
})

test("fatal provider errors are actionable when no records are available", () => {
  const status = StatusModel.emptyStatus({
    stateReady: true,
    indexSettled: true,
    totalRecords: 0,
    warnings: ["Could not load Omarchy commands", "Installed applications are unavailable"]
  })
  assert.equal(status.kind, "error")
  assert.equal(status.title, "Could not load Omarchy commands")
  assert.match(status.detail, /applications are unavailable/)
})

test("partial-provider warnings accompany otherwise normal empty states", () => {
  const status = StatusModel.emptyStatus({
    stateReady: true,
    indexSettled: true,
    totalRecords: 12,
    query: "missing",
    warnings: ["User menu could not be parsed"]
  })
  assert.equal(status.kind, "empty")
  assert.match(status.detail, /^Partial index:/)
})

test("status is hidden whenever results exist and warnings are deduplicated", () => {
  assert.equal(StatusModel.emptyStatus({ resultCount: 1 }).visible, false)
  assert.equal(StatusModel.warningText(["Apps unavailable", "", "Apps unavailable"]), "Apps unavailable")
})
