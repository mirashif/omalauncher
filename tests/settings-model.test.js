const test = require("node:test")
const assert = require("node:assert/strict")

const SettingsModel = require("../services/SettingsModel.js")
const StateModel = require("../services/StateModel.js")

test("settings expose provider toggles and configured file rules", () => {
  let state = StateModel.emptyState()
  state = StateModel.setPreference(state, "fileSearchEnabled", true)
  state = StateModel.addFileScope(state, "/home/test/Documents")
  state = StateModel.addFileIgnore(state, "node_modules")
  const rows = SettingsModel.settingsRecords(state.preferences)

  assert.equal(rows.find(row => row.settingKey === "fileSearchEnabled").description, "Enabled")
  assert.equal(rows.find(row => row.kind === "settings-remove-scope").settingValue, "/home/test/Documents")
  assert.equal(rows.find(row => row.kind === "settings-remove-ignore").settingValue, "node_modules")
  assert.equal(rows.some(row => row.kind === "settings-open-reset-personalization"), true)
})

test("settings input routes preserve literal values and validation errors", () => {
  const scope = SettingsModel.inputRecords("settings-scope", "/home/test/My Files", "", false)[0]
  const invalid = SettingsModel.inputRecords("settings-scope", "relative", "Use an absolute path", false)[0]
  const ignore = SettingsModel.inputRecords("settings-ignore", "*.tmp", "", false)[0]

  assert.equal(scope.settingValue, "/home/test/My Files")
  assert.equal(invalid.description, "Use an absolute path")
  assert.equal(ignore.settingValue, "*.tmp")
})

test("reset routes require a separate confirmation choice", () => {
  const rows = SettingsModel.confirmationRecords("settings-reset-personalization")
  assert.deepEqual(rows.map(row => row.kind), [
    "settings-confirm-reset-personalization",
    "settings-cancel"
  ])
  assert.equal(SettingsModel.isConfirmationRoute("settings-reset-personalization"), true)
  assert.equal(SettingsModel.isRoute("unrelated"), false)
})
