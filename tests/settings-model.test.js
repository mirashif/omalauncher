const test = require("node:test")
const assert = require("node:assert/strict")

const SettingsModel = require("../services/SettingsModel.js")
const SearchEngine = require("../services/SearchEngine.js")
const StateModel = require("../services/StateModel.js")

test("settings expose provider toggles and configured file rules", () => {
  let state = StateModel.emptyState()
  state = StateModel.setPreference(state, "fileSearchEnabled", true)
  state = StateModel.addFileScope(state, "/home/test/Documents")
  state = StateModel.addFileIgnore(state, "node_modules")
  const rows = SettingsModel.settingsRecords(state.preferences, {
    fileSearchSettled: true,
    fileSearchAvailable: false,
    launcherHotkey: "SUPER + R",
    onboardingHotkey: "SUPER + R",
    commonScopes: ["/home/test/Documents", "/home/test/Downloads"],
    productVersion: "0.10.0"
  })
  const fileToggle = rows.find(row => row.settingKey === "fileSearchEnabled")
  const calculatorToggle = rows.find(row => row.settingKey === "calculatorEnabled")
  const scope = rows.find(row => row.kind === "settings-remove-scope")
  const ignore = rows.find(row => row.kind === "settings-remove-ignore")
  const suggested = rows.find(row => row.kind === "settings-add-suggested-scope")
  const launcherHotkey = rows.find(row => row.kind === "settings-open-launcher-hotkey")
  assert.ok(fileToggle)
  assert.ok(calculatorToggle)
  assert.ok(scope)
  assert.ok(ignore)
  assert.ok(suggested)
  assert.ok(launcherHotkey)

  assert.equal(fileToggle.description, "Enabled · Try f report · 1 scope · fd unavailable")
  assert.equal(calculatorToggle.description, "Enabled · Try = 12 * 8")
  assert.equal(fileToggle.breadcrumb, "")
  assert.equal(scope.title, "Remove Documents")
  assert.equal(scope.settingValue, "/home/test/Documents")
  assert.equal(ignore.title, "Remove node_modules")
  assert.equal(ignore.settingValue, "node_modules")
  assert.equal(suggested.settingValue, "/home/test/Downloads")
  assert.equal(launcherHotkey.description, "SUPER + R")
  assert.equal(rows.some(row => row.kind === "settings-remove-launcher-hotkey"), true)
  assert.equal(rows.some(row => row.kind === "settings-open-reset-personalization"), true)
  const about = rows.find(row => row.kind === "settings-open-about")
  assert.ok(about)
  assert.equal(about.section, "About")
  assert.equal(about.description, "Version 0.10.0 · Project details and links")
  assert.ok(rows.indexOf(about) > rows.findIndex(row => row.section === "Reset"))
})

test("launcher settings are searchable directly from root", () => {
  const rows = SettingsModel.rootSearchRecords(StateModel.emptyPreferences(), {
    launcherHotkey: "SUPER + SPACE",
    onboardingHotkey: "SUPER + SPACE",
    productVersion: "0.10.0"
  }).map(SearchEngine.prepareRecord)
  const results = SearchEngine.search(rows, "setting launcher hotkey")

  assert.equal(results[0].kind, "settings-open-launcher-hotkey")
  assert.equal(results[0].title, "Launcher Shortcut")
  assert.equal(results[0].breadcrumb, "Omalauncher Settings")
  assert.equal(rows.every(row => row.emptyVisible === false), true)
})

test("about route exposes product details, compatibility, and project links", () => {
  const rows = SettingsModel.aboutRecords({
    productVersion: "0.10.0",
    repositoryUrl: "https://github.com/mirashif/omalauncher"
  })

  assert.deepEqual(rows.map(row => row.kind), [
    "about-copy-details",
    "about-copy-details",
    "about-open-url",
    "about-open-url",
    "about-open-url"
  ])
  assert.equal(rows[0].title, "Omalauncher v0.10.0")
  assert.equal(rows[1].description, "Omarchy 4 · Quickshell 0.3")
  assert.equal(rows[2].settingValue, "https://github.com/mirashif/omalauncher")
  assert.equal(rows[3].settingValue, "https://github.com/mirashif/omalauncher/issues")
  assert.equal(rows[4].settingValue, "https://github.com/mirashif/omalauncher/blob/main/LICENSE")
  assert.equal(SettingsModel.isRoute("settings-about"), true)
  assert.equal(SettingsModel.routeTitle("settings-about"), "About Omalauncher")
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
