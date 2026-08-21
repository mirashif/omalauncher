// Pure Settings route records shared by QML and Node tests.

/** @typedef {import("../types/models").BooleanMap} BooleanMap */
/** @typedef {import("../types/models").StringMap} StringMap */
/** @typedef {import("../types/models").Preferences} Preferences */
/** @typedef {import("../types/models").SettingsContext} SettingsContext */
/** @typedef {import("../types/models").SettingRecord} SettingRecord */

/** @type {BooleanMap} */
var ROUTES = {
  settings: true,
  "settings-about": true,
  "settings-scope": true,
  "settings-ignore": true,
  "settings-reset-providers": true,
  "settings-reset-personalization": true
}

/** @param {unknown} value @returns {string} */
function text(value) {
  return String(value || "")
}

/**
 * @param {string} id
 * @param {string} kind
 * @param {string} title
 * @param {string} description
 * @param {string} icon
 * @param {number} order
 * @param {string} section
 * @param {unknown} key
 * @param {unknown} value
 * @returns {SettingRecord}
 */
function record(id, kind, title, description, icon, order, section, key, value) {
  var settingKey = text(key)
  var settingValue = text(value)
  return {
    id: id,
    type: "launcher-command",
    kind: kind,
    title: title,
    breadcrumb: "",
    description: description,
    icon: icon,
    iconFont: "",
    appIcon: "",
    appId: "",
    aliases: [],
    keywords: ["omalauncher", "settings", settingKey, settingValue],
    route: "",
    parentRoute: "settings",
    searchText: [title, description, "omalauncher settings", settingKey, settingValue].join(" "),
    providerPriority: -2,
    order: order,
    section: section,
    settingKey: settingKey,
    settingValue: settingValue
  }
}

/** @param {unknown} enabled @returns {string} */
function enabledLabel(enabled) {
  return enabled === true ? "Enabled" : "Disabled"
}

/** @param {unknown} value @returns {string} */
function pathName(value) {
  var path = text(value).replace(/\/+$/g, "")
  return path.slice(path.lastIndexOf("/") + 1) || path
}

/**
 * @param {Partial<Preferences> | null | undefined} preferences
 * @param {SettingsContext | null | undefined} context
 * @returns {SettingRecord[]}
 */
function settingsRecords(preferences, context) {
  var values = preferences || {}
  var status = context || {}
  var calculatorDescription = enabledLabel(values.calculatorEnabled) + " · Try = 12 * 8"
  if (status.calculatorSettled === true && status.calculatorAvailable !== true) {
    calculatorDescription += " · qalc unavailable"
  }
  var scopes = Array.isArray(values.fileSearchScopes) ? values.fileSearchScopes : []
  var fileDescription = enabledLabel(values.fileSearchEnabled) + " · Try f report"
  if (scopes.length > 0) {
    fileDescription += " · " + scopes.length + " scope" + (scopes.length === 1 ? "" : "s")
  }
  if (status.fileSearchSettled === true && status.fileSearchAvailable !== true) {
    fileDescription += " · fd unavailable"
  }
  /** @type {SettingRecord[]} */
  var records = [
    record("omalauncher:setting-launcher-hotkey", "settings-open-launcher-hotkey", "Launcher Shortcut",
      text(status.launcherHotkey || status.onboardingHotkey) || "Not configured", "󰌌", -3, "Shortcuts",
      "launcherHotkey", ""),
    record("omalauncher:setting-run-onboarding", "settings-run-onboarding", "Run Welcome Setup Again",
      "Review the launcher shortcut and test it", "󰑐", -2, "Shortcuts", "", ""),
    record("omalauncher:setting-compact", "settings-toggle", "Compact Mode",
      enabledLabel(values.compactMode), "", 0, "Behavior", "compactMode", ""),
    record("omalauncher:setting-quick-activation", "settings-toggle", "Numbered Quick Activation",
      enabledLabel(values.quickActivationEnabled), "󰎠", 1, "Behavior", "quickActivationEnabled", ""),
    record("omalauncher:setting-calculator", "settings-toggle", "Calculator Results",
      calculatorDescription, "", 2, "Providers", "calculatorEnabled", ""),
    record("omalauncher:setting-file-search", "settings-toggle", "Scoped File Search",
      fileDescription, "󰈞", 3, "Providers", "fileSearchEnabled", ""),
    record("omalauncher:setting-add-scope", "settings-open-scope", "Add File Search Scope",
      "Choose an existing directory", "", 4, "File Search", "", "")
  ]

  if (text(status.launcherHotkey)) {
    records.splice(2, 0, record("omalauncher:setting-remove-launcher-hotkey", "settings-remove-launcher-hotkey",
      "Remove Launcher Shortcut", text(status.launcherHotkey), "", -1, "Shortcuts", "", ""))
  }

  var suggestions = Array.isArray(status.commonScopes) ? status.commonScopes : []
  for (var suggestionIndex = 0; suggestionIndex < suggestions.length; suggestionIndex++) {
    var suggestion = text(suggestions[suggestionIndex])
    if (!suggestion || scopes.indexOf(suggestion) >= 0) continue
    records.push(record(
      "omalauncher:setting-suggested-scope:" + suggestionIndex,
      "settings-add-suggested-scope",
      "Add " + pathName(suggestion),
      suggestion,
      "󰈞",
      5 + suggestionIndex,
      "Suggested Scopes",
      "fileSearchScopes",
      suggestion
    ))
  }

  for (var scopeIndex = 0; scopeIndex < scopes.length; scopeIndex++) {
    records.push(record(
      "omalauncher:setting-scope:" + scopeIndex,
      "settings-remove-scope",
      "Remove " + pathName(scopes[scopeIndex]),
      text(scopes[scopeIndex]),
      "",
      20 + scopeIndex,
      "File Search Scopes",
      "fileSearchScopes",
      scopes[scopeIndex]
    ))
  }

  var ignoreOrder = 40
  records.push(record("omalauncher:setting-add-ignore", "settings-open-ignore", "Add File Ignore Pattern",
    "For example node_modules or *.tmp", "", ignoreOrder, "File Search", "", ""))
  var ignores = Array.isArray(values.fileSearchIgnores) ? values.fileSearchIgnores : []
  for (var ignoreIndex = 0; ignoreIndex < ignores.length; ignoreIndex++) {
    records.push(record(
      "omalauncher:setting-ignore:" + ignoreIndex,
      "settings-remove-ignore",
      "Remove " + text(ignores[ignoreIndex]),
      text(ignores[ignoreIndex]),
      "",
      ignoreOrder + 1 + ignoreIndex,
      "File Search Ignores",
      "fileSearchIgnores",
      ignores[ignoreIndex]
    ))
  }

  records.push(record("omalauncher:setting-reset-providers", "settings-open-reset-providers",
    "Reset Provider Settings", "Restore provider defaults and clear scopes", "󰑐", 80, "Reset", "", ""))
  records.push(record("omalauncher:setting-reset-personalization", "settings-open-reset-personalization",
    "Reset Personalization", "Clear favorites, aliases, hidden results, history, and ranking", "", 81, "Reset", "", ""))
  var version = text(status.productVersion)
  records.push(record("omalauncher:setting-about", "settings-open-about", "About Omalauncher",
    (version ? "Version " + version + " · " : "") + "Project details and links",
    "󰋼", 100, "About", "", ""))
  return records
}

/**
 * Exposes Settings actions to root search without adding them to the launcher's
 * empty state. About already has a dedicated root record, so keep one result.
 * @param {Partial<Preferences> | null | undefined} preferences
 * @param {SettingsContext | null | undefined} context
 * @returns {SettingRecord[]}
 */
function rootSearchRecords(preferences, context) {
  var source = settingsRecords(preferences, context)
  /** @type {SettingRecord[]} */
  var records = []
  for (var i = 0; i < source.length; i++) {
    var sourceRecord = source[i]
    if (!sourceRecord || sourceRecord.kind === "settings-open-about") continue
    var copy = /** @type {SettingRecord} */ (Object.assign({}, sourceRecord))
    copy.breadcrumb = "Omalauncher Settings"
    copy.section = "Launcher Settings"
    copy.emptyVisible = false
    records.push(copy)
  }
  return records
}

/**
 * @param {SettingsContext | null | undefined} context
 * @returns {SettingRecord[]}
 */
function aboutRecords(context) {
  var values = context || {}
  var version = text(values.productVersion)
  var repositoryUrl = text(values.repositoryUrl) || "https://github.com/mirashif/omalauncher"
  var productTitle = "Omalauncher" + (version ? " v" + version.replace(/^v/i, "") : "")
  return [
    record("omalauncher:about-product", "about-copy-details", productTitle,
      "A keyboard-first command palette for Omarchy", "󰋼", 0, "About", "about", productTitle),
    record("omalauncher:about-compatibility", "about-copy-details", "Compatibility",
      "Omarchy 4 · Quickshell 0.3", "󰍹", 1, "About", "compatibility",
      "Omarchy 4 · Quickshell 0.3"),
    record("omalauncher:about-source", "about-open-url", "View Source Code",
      "Open the project on GitHub", "", 10, "Project", "source", repositoryUrl),
    record("omalauncher:about-issues", "about-open-url", "Report an Issue",
      "Open the GitHub issue tracker", "", 11, "Project", "issues", repositoryUrl + "/issues"),
    record("omalauncher:about-license", "about-open-url", "View MIT License",
      "Read the license on GitHub", "", 12, "Project", "license",
      repositoryUrl + "/blob/main/LICENSE")
  ]
}

/**
 * @param {unknown} route
 * @param {unknown} query
 * @param {unknown} error
 * @param {unknown} busy
 * @returns {SettingRecord[]}
 */
function inputRecords(route, query, error, busy) {
  var value = text(query).trim()
  if (route === "settings-scope") {
    return [record(
      "omalauncher:setting-save-scope",
      "settings-save-scope",
      busy ? "Validating Directory…" : (value ? "Add Directory" : "Enter a Directory Path"),
      text(error) || value || "Type an absolute path, then press Enter",
      busy ? "" : "",
      0,
      "File Search Scope",
      "fileSearchScopes",
      value
    )]
  }
  return [record(
    "omalauncher:setting-save-ignore",
    "settings-save-ignore",
    value ? "Add Ignore Pattern" : "Enter an Ignore Pattern",
    text(error) || value || "Type a fixed name or glob, then press Enter",
    "",
    0,
    "File Search Ignore",
    "fileSearchIgnores",
    value
  )]
}

/** @param {unknown} route @returns {SettingRecord[]} */
function confirmationRecords(route) {
  var providers = route === "settings-reset-providers"
  return [
    record(
      providers ? "omalauncher:confirm-reset-providers" : "omalauncher:confirm-reset-personalization",
      providers ? "settings-confirm-reset-providers" : "settings-confirm-reset-personalization",
      providers ? "Confirm Provider Settings Reset" : "Confirm Personalization Reset",
      providers
        ? "Restore provider defaults and remove configured scopes and ignores"
        : "Clear favorites, aliases, hidden results, history, and learned ranking",
      "",
      0,
      "Confirmation",
      "",
      ""
    ),
    record("omalauncher:cancel-reset", "settings-cancel", "Cancel", "Keep current settings", "", 1,
      "Confirmation", "", "")
  ]
}

/** @param {unknown} route @returns {boolean} */
function isRoute(route) {
  return ROUTES[text(route)] === true
}

/** @param {unknown} route @returns {boolean} */
function isInputRoute(route) {
  var value = text(route)
  return value === "settings-scope" || value === "settings-ignore"
}

/** @param {unknown} route @returns {boolean} */
function isConfirmationRoute(route) {
  var value = text(route)
  return value === "settings-reset-providers" || value === "settings-reset-personalization"
}

/** @param {unknown} route @returns {string} */
function routeTitle(route) {
  /** @type {StringMap} */
  var titles = {
    settings: "Omalauncher Settings",
    "settings-about": "About Omalauncher",
    "settings-scope": "Add File Search Scope",
    "settings-ignore": "Add File Ignore Pattern",
    "settings-reset-providers": "Reset Provider Settings",
    "settings-reset-personalization": "Reset Personalization"
  }
  return titles[text(route)] || "Omalauncher Settings"
}

if (typeof module !== "undefined") {
  module.exports = {
    settingsRecords: settingsRecords,
    rootSearchRecords: rootSearchRecords,
    aboutRecords: aboutRecords,
    inputRecords: inputRecords,
    confirmationRecords: confirmationRecords,
    isRoute: isRoute,
    isInputRoute: isInputRoute,
    isConfirmationRoute: isConfirmationRoute,
    routeTitle: routeTitle
  }
}
