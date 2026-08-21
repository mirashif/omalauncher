const test = require("node:test")
const assert = require("node:assert/strict")

const SettingsModel = require("../services/SettingsModel.js")
const SearchEngine = require("../services/SearchEngine.js")
const StateModel = require("../services/StateModel.js")

function configuredState() {
  let state = StateModel.emptyState()
  state = StateModel.setPreference(state, "fileSearchEnabled", true)
  state = StateModel.setPreference(state, "quickActivationEnabled", true)
  state = StateModel.addFileScope(state, "/home/test/Documents")
  state = StateModel.addFileIgnore(state, "node_modules")
  return state
}

function settingsContext() {
  return {
    fileSearchSettled: true,
    fileSearchAvailable: false,
    calculatorSettled: true,
    calculatorAvailable: true,
    launcherHotkey: "SUPER + R",
    onboardingHotkey: "SUPER + R",
    commonScopes: ["/home/test/Documents", "/home/test/Downloads"],
    productVersion: "0.10.0",
    creatorWebsiteUrl: "https://mirashif.com",
    repositoryUrl: "https://github.com/mirashif/omalauncher"
  }
}

test("settings root is concise and uses semantic controls", () => {
  const rows = SettingsModel.settingsRecords(configuredState().preferences, settingsContext())
  const shortcut = rows.find(row => row.kind === "settings-open-shortcut")
  const compact = rows.find(row => row.settingKey === "compactMode")
  const quickActivation = rows.find(row => row.settingKey === "quickActivationEnabled")
  const calculator = rows.find(row => row.settingKey === "calculatorEnabled")
  const fileSearch = rows.find(row => row.kind === "settings-open-file-search")
  const reset = rows.find(row => row.kind === "settings-open-reset")
  const about = rows.find(row => row.kind === "settings-open-about")

  assert.equal(rows.length, 7)
  assert.ok(shortcut)
  assert.ok(compact)
  assert.ok(quickActivation)
  assert.ok(calculator)
  assert.ok(fileSearch)
  assert.ok(reset)
  assert.ok(about)
  assert.equal(shortcut.controlType, "navigation")
  assert.equal(shortcut.trailingText, "SUPER + R")
  assert.equal(compact.controlType, "toggle")
  assert.equal(compact.checked, false)
  assert.equal(quickActivation.checked, true)
  assert.equal(calculator.description, "Show instant results for = expressions")
  assert.equal(fileSearch.controlType, "navigation")
  assert.equal(fileSearch.trailingText, "On · 1 folder")
  assert.equal(fileSearch.targetRoute, "settings-file-search")
  assert.equal(reset.targetRoute, "settings-reset")
  assert.equal(about.trailingText, "v0.10.0")
  assert.deepEqual([...new Set(rows.map(row => row.section))], ["General", "Providers", "Data", "About"])
})

test("file-search details contain provider state and configured rules", () => {
  const rows = SettingsModel.fileSearchRecords(configuredState().preferences, settingsContext())
  const fileToggle = rows.find(row => row.settingKey === "fileSearchEnabled")
  const addScope = rows.find(row => row.kind === "settings-open-scope")
  const scope = rows.find(row => row.kind === "settings-remove-scope")
  const addIgnore = rows.find(row => row.kind === "settings-open-ignore")
  const ignore = rows.find(row => row.kind === "settings-remove-ignore")

  assert.ok(fileToggle)
  assert.ok(addScope)
  assert.ok(scope)
  assert.ok(addIgnore)
  assert.ok(ignore)
  assert.equal(fileToggle.controlType, "toggle")
  assert.equal(fileToggle.checked, true)
  assert.equal(fileToggle.description, "fd is unavailable; install it to search files")
  assert.equal(addScope.title, "Add Folder")
  assert.equal(addScope.targetRoute, "settings-scope")
  assert.equal(scope.title, "Documents")
  assert.equal(scope.section, "Included Folders")
  assert.equal(scope.settingValue, "/home/test/Documents")
  assert.equal(scope.trailingText, "Remove")
  assert.equal(addIgnore.targetRoute, "settings-ignore")
  assert.equal(ignore.title, "node_modules")
  assert.equal(ignore.settingValue, "node_modules")
})

test("shortcut actions live on a dedicated page", () => {
  const rows = SettingsModel.shortcutRecords(settingsContext())
  const configure = rows.find(row => row.kind === "settings-open-launcher-hotkey")
  const setup = rows.find(row => row.kind === "settings-run-onboarding")
  const remove = rows.find(row => row.kind === "settings-open-remove-launcher-hotkey")

  assert.ok(configure)
  assert.ok(setup)
  assert.ok(remove)
  assert.equal(configure.trailingText, "SUPER + R")
  assert.equal(setup.section, "Setup")
  assert.equal(remove.destructive, true)
  assert.equal(remove.targetRoute, "settings-remove-shortcut")
})

test("launcher settings are searchable directly from root", () => {
  const rows = SettingsModel.rootSearchRecords(StateModel.emptyPreferences(), settingsContext())
    .map(SearchEngine.prepareRecord)
  const results = SearchEngine.search(rows, "setting launcher hotkey")

  assert.equal(results[0].kind, "settings-open-launcher-hotkey")
  assert.equal(results[0].title, "Change Launcher Shortcut")
  assert.equal(results[0].breadcrumb, "Omalauncher Settings")
  assert.equal(rows.every(row => row.emptyVisible === false), true)
})

test("configured folders remain searchable as removal actions", () => {
  const rows = SettingsModel.rootSearchRecords(configuredState().preferences, settingsContext())
    .map(SearchEngine.prepareRecord)
  const results = SearchEngine.search(rows, "remove documents")

  assert.equal(results[0].kind, "settings-remove-scope")
  assert.equal(results[0].title, "Documents")
})

test("about route exposes a product hero and project links", () => {
  const rows = SettingsModel.aboutRecords(settingsContext())

  assert.deepEqual(rows.map(row => row.kind), [
    "about-copy-details",
    "about-open-url",
    "about-open-url",
    "about-open-url",
    "about-open-url"
  ])
  assert.equal(rows[0].title, "Omalauncher v0.10.0")
  assert.equal(rows[0].controlType, "hero")
  assert.equal(rows[0].trailingText, "Omarchy 4 · Quickshell 0.3")
  assert.equal(rows[1].title, "Mir Ashif")
  assert.equal(rows[1].description, "Creator and maintainer")
  assert.equal(rows[1].section, "Creator")
  assert.equal(rows[1].trailingText, "mirashif.com")
  assert.equal(rows[1].settingValue, "https://mirashif.com")
  assert.equal(rows[2].settingValue, "https://github.com/mirashif/omalauncher")
  assert.equal(rows[3].settingValue, "https://github.com/mirashif/omalauncher/issues")
  assert.equal(rows[4].settingValue, "https://github.com/mirashif/omalauncher/blob/main/LICENSE")
  assert.equal(SettingsModel.isRoute("settings-about"), true)
  assert.equal(SettingsModel.routeTitle("settings-about"), "About Omalauncher")
})

test("folder input keeps suggestions out of the main settings page", () => {
  const preferences = configuredState().preferences
  const emptyInput = SettingsModel.inputRecords(
    "settings-scope", "", "", false, preferences, settingsContext())
  const typedInput = SettingsModel.inputRecords(
    "settings-scope", "/home/test/My Files", "", false, preferences, settingsContext())
  const invalid = SettingsModel.inputRecords(
    "settings-scope", "relative", "Use an absolute path", false, preferences, settingsContext())[0]
  const ignore = SettingsModel.inputRecords("settings-ignore", "*.tmp", "", false)[0]

  assert.equal(emptyInput[0].title, "Enter a Folder Path")
  assert.equal(emptyInput.some(row => row.settingValue === "/home/test/Downloads"), true)
  assert.equal(SettingsModel.settingsRecords(preferences, settingsContext())
    .some(row => row.kind === "settings-add-suggested-scope"), false)
  assert.equal(typedInput.length, 1)
  assert.equal(typedInput[0].settingValue, "/home/test/My Files")
  assert.equal(invalid.description, "Use an absolute path")
  assert.equal(ignore.settingValue, "*.tmp")
  assert.equal(SettingsModel.routeTitle("settings-scope"), "Add Folder")
})

test("immediate folder validation remains valid outside Settings", () => {
  assert.equal(SettingsModel.scopeValidationApplies("root", true), true)
  assert.equal(SettingsModel.scopeValidationApplies("settings", true), true)
  assert.equal(SettingsModel.scopeValidationApplies("settings-scope", false), true)
  assert.equal(SettingsModel.scopeValidationApplies("root", false), false)
})

test("destructive settings require a separate confirmation choice", () => {
  const reset = SettingsModel.confirmationRecords("settings-reset-personalization")
  const shortcut = SettingsModel.confirmationRecords("settings-remove-shortcut")

  assert.deepEqual(reset.map(row => row.kind), [
    "settings-confirm-reset-personalization",
    "settings-cancel"
  ])
  assert.equal(shortcut[0].kind, "settings-confirm-remove-shortcut")
  assert.equal(shortcut[0].destructive, true)
  assert.equal(SettingsModel.isConfirmationRoute("settings-remove-shortcut"), true)
  assert.equal(SettingsModel.isRoute("settings-file-search"), true)
  assert.equal(SettingsModel.isRoute("unrelated"), false)
})

test("recordsForRoute keeps nested settings route-specific", () => {
  const preferences = configuredState().preferences
  assert.equal(SettingsModel.recordsForRoute(
    "settings", preferences, settingsContext(), "", "", false).length, 7)
  assert.equal(SettingsModel.recordsForRoute(
    "settings-shortcut", preferences, settingsContext(), "", "", false)[0].section, "Shortcut")
  assert.equal(SettingsModel.recordsForRoute(
    "settings-file-search", preferences, settingsContext(), "", "", false)[0].kind,
  "settings-toggle")
  assert.equal(SettingsModel.recordsForRoute(
    "settings-reset", preferences, settingsContext(), "", "", false).length, 2)
})
