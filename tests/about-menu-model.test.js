const test = require("node:test")
const assert = require("node:assert/strict")

const AboutMenuModel = require("../services/AboutMenuModel.js")

test("About Menu exposes launcher-owned routes, help, and a safe close action", () => {
  const rows = AboutMenuModel.records({ repositoryUrl: "https://example.test/omalauncher" })

  assert.deepEqual(rows.map(row => row.id), [
    "settings", "shortcuts", "guide", "about", "report", "close"
  ])
  const settings = rows.find(row => row.id === "settings")
  const guide = rows.find(row => row.id === "guide")
  const report = rows.find(row => row.id === "report")
  const close = rows.find(row => row.id === "close")
  assert.ok(settings)
  assert.ok(guide)
  assert.ok(report)
  assert.ok(close)
  assert.equal(settings.shortcut, "CTRL+,")
  assert.equal(guide.target, "https://example.test/omalauncher#readme")
  assert.equal(report.target, "https://example.test/omalauncher/issues")
  assert.equal(close.title, "Close Launcher")
  assert.equal(rows.some(row => /^Quit/.test(row.title)), false)
})
