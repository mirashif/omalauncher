// Pure Settings route records shared by QML and Node tests.

/** @typedef {import("../types/models").BooleanMap} BooleanMap */
/** @typedef {import("../types/models").StringMap} StringMap */
/** @typedef {import("../types/models").Preferences} Preferences */
/** @typedef {import("../types/models").SettingsContext} SettingsContext */
/** @typedef {import("../types/models").SettingRecord} SettingRecord */
/**
 * @typedef {{
 *   controlType?: string,
 *   checked?: boolean,
 *   trailingText?: string,
 *   targetRoute?: string,
 *   destructive?: boolean
 * }} RecordOptions
 */

/** @type {BooleanMap} */
var ROUTES = {
  settings: true,
  "settings-shortcut": true,
  "settings-dependencies": true,
  "settings-file-search": true,
  "settings-reset": true,
  "settings-about": true,
  "settings-scope": true,
  "settings-ignore": true,
  "settings-remove-shortcut": true,
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
 * @param {RecordOptions} [options]
 * @returns {SettingRecord}
 */
function record(id, kind, title, description, icon, order, section, key, value, options) {
  var settingKey = text(key)
  var settingValue = text(value)
  var opts = options || {}
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
    keywords: ["omalauncher", "settings", kind, settingKey, settingValue],
    route: "",
    parentRoute: "settings",
    targetRoute: text(opts.targetRoute),
    searchText: [title, description, text(opts.trailingText), "omalauncher settings",
      kind, settingKey, settingValue].join(" "),
    providerPriority: -2,
    order: order,
    section: section,
    settingKey: settingKey,
    settingValue: settingValue,
    controlType: text(opts.controlType || "action"),
    checked: opts.checked === true,
    trailingText: text(opts.trailingText),
    destructive: opts.destructive === true
  }
}

/** @param {unknown} value @returns {string} */
function pathName(value) {
  var path = text(value).replace(/\/+$/g, "")
  return path.slice(path.lastIndexOf("/") + 1) || path
}

/** @param {number} count @param {string} singular @returns {string} */
function countLabel(count, singular) {
  return count + " " + singular + (count === 1 ? "" : "s")
}

/**
 * @param {Partial<Preferences> | null | undefined} preferences
 * @param {SettingsContext | null | undefined} context
 * @returns {SettingRecord[]}
 */
function settingsRecords(preferences, context) {
  var values = preferences || {}
  var status = context || {}
  var scopes = Array.isArray(values.fileSearchScopes) ? values.fileSearchScopes : []
  var launcherHotkey = text(status.launcherHotkey || status.onboardingHotkey)
  var fileSearchStatus = values.fileSearchEnabled === true ? "On" : "Off"
  if (scopes.length > 0) fileSearchStatus += " · " + countLabel(scopes.length, "folder")
  var calculatorDescription = "Show instant results for = expressions"
  if (status.calculatorSettled === true && status.calculatorAvailable !== true) {
    calculatorDescription = "qalc is unavailable"
  }
  var fileSearchDescription = "Choose folders and ignored patterns"
  if (status.fileSearchSettled === true && status.fileSearchAvailable !== true) {
    fileSearchDescription = "fd is unavailable"
  }
  var dependenciesSettled = status.calculatorSettled === true && status.fileSearchSettled === true
  var missingDependencies = (status.calculatorAvailable === true ? 0 : 1)
    + (status.fileSearchAvailable === true ? 0 : 1)
  var dependencyStatus = dependenciesSettled
    ? (missingDependencies > 0 ? countLabel(missingDependencies, "missing") : "Ready")
    : "Checking"
  var version = text(status.productVersion)

  return [
    record("omalauncher:setting-shortcut-page", "settings-open-shortcut", "Launcher Shortcut",
      "Open Omalauncher from anywhere", "󰌌", 0, "General", "", "", {
        controlType: "navigation",
        trailingText: launcherHotkey || "Not set",
        targetRoute: "settings-shortcut"
      }),
    record("omalauncher:setting-compact", "settings-toggle", "Compact Mode",
      "Show only the search field until you start typing", "", 1, "General", "compactMode", "", {
        controlType: "toggle",
        checked: values.compactMode === true
    }),
    record("omalauncher:setting-quick-activation", "settings-toggle", "Numbered Quick Activation",
      "Open the first eight results with Ctrl+1–8", "󰎠", 2, "General",
      "quickActivationEnabled", "", {
        controlType: "toggle",
        checked: values.quickActivationEnabled === true
      }),
    record("omalauncher:setting-calculator", "settings-toggle", "Calculator",
      calculatorDescription, "", 10, "Providers", "calculatorEnabled", "", {
        controlType: "toggle",
        checked: values.calculatorEnabled === true
      }),
    record("omalauncher:setting-file-search-page", "settings-open-file-search", "File Search",
      fileSearchDescription, "󰈞", 11, "Providers", "", "", {
        controlType: "navigation",
        trailingText: fileSearchStatus,
        targetRoute: "settings-file-search"
      }),
    record("omalauncher:setting-dependencies", "settings-open-dependencies", "Optional Features",
      "Install calculator and file-search tools", "󰏗", 12, "Providers", "", "", {
        controlType: "navigation",
        trailingText: dependencyStatus,
        targetRoute: "settings-dependencies"
      }),
    record("omalauncher:setting-reset-page", "settings-open-reset", "Data and Reset",
      "Restore defaults or clear personalization", "󰑐", 20, "Data", "", "", {
        controlType: "navigation",
        targetRoute: "settings-reset"
      }),
    record("omalauncher:setting-about", "settings-open-about", "About Omalauncher",
      "Project details, compatibility, and links", "󰋼", 30, "About", "", "", {
        controlType: "navigation",
        trailingText: version ? "v" + version.replace(/^v/i, "") : "",
        targetRoute: "settings-about"
      })
  ]
}

/**
 * @param {SettingsContext | null | undefined} context
 * @returns {SettingRecord[]}
 */
function dependencyRecords(context) {
  var status = context || {}
  var calculatorSettled = status.calculatorSettled === true
  var fileSearchSettled = status.fileSearchSettled === true
  var calculatorAvailable = status.calculatorAvailable === true
  var fileSearchAvailable = status.fileSearchAvailable === true
  var installRunning = status.dependencyInstallRunning === true
  /** @type {string[]} */
  var missingPackages = []
  if (calculatorSettled && !calculatorAvailable) missingPackages.push("libqalculate")
  if (fileSearchSettled && !fileSearchAvailable) missingPackages.push("fd")
  /** @type {SettingRecord[]} */
  var records = []

  if (missingPackages.length > 0) {
    records.push(record(
      "omalauncher:setting-install-dependencies",
      "settings-install-dependencies",
      installRunning ? "Installing Optional Tools…" : "Install Missing Tools",
      installRunning
        ? "Complete the package installation in the terminal"
        : "Runs omarchy pkg add " + missingPackages.join(" ") + " in a visible terminal",
      installRunning ? "" : "󰏗",
      0,
      "Actions",
      "dependencies",
      "all",
      { controlType: "action", trailingText: installRunning ? "In progress" : "Open Terminal" }
    ))
  }

  records.push(record(
    "omalauncher:setting-dependency-calculator",
    calculatorSettled && !calculatorAvailable
      ? "settings-install-dependency" : "settings-dependency-status",
    "Calculator Support",
    calculatorSettled
      ? (calculatorAvailable
          ? "qalc is ready for instant = results"
          : "Install libqalculate to enable calculator results")
      : "Checking for qalc",
    "",
    10,
    "Features",
    "dependency",
    "calculator",
    { controlType: "action", trailingText: calculatorSettled
      ? (calculatorAvailable ? "Installed" : "Install") : "Checking" }
  ))
  records.push(record(
    "omalauncher:setting-dependency-file-search",
    fileSearchSettled && !fileSearchAvailable
      ? "settings-install-dependency" : "settings-dependency-status",
    "File Search Support",
    fileSearchSettled
      ? (fileSearchAvailable
          ? "fd is ready for scoped file search"
          : "Install fd to enable scoped file search")
      : "Checking for fd",
    "󰈞",
    11,
    "Features",
    "dependency",
    "file-search",
    { controlType: "action", trailingText: fileSearchSettled
      ? (fileSearchAvailable ? "Installed" : "Install") : "Checking" }
  ))
  records.push(record(
    "omalauncher:setting-recheck-dependencies",
    "settings-recheck-dependencies",
    "Check Again",
    "Refresh qalc and fd availability",
    "󰑐",
    20,
    "Actions",
    "dependencies",
    "refresh",
    { controlType: "action", trailingText: "Refresh" }
  ))
  return records
}

/**
 * @param {SettingsContext | null | undefined} context
 * @returns {SettingRecord[]}
 */
function shortcutRecords(context) {
  var status = context || {}
  var launcherHotkey = text(status.launcherHotkey || status.onboardingHotkey)
  /** @type {SettingRecord[]} */
  var records = [
    record("omalauncher:setting-launcher-hotkey", "settings-open-launcher-hotkey",
      launcherHotkey ? "Change Launcher Shortcut" : "Set Launcher Shortcut",
      "Record a global keyboard shortcut", "󰌌", 0, "Shortcut", "launcherHotkey", "", {
        controlType: "navigation",
        trailingText: launcherHotkey || "Not set"
      }),
    record("omalauncher:setting-run-onboarding", "settings-run-onboarding", "Run Welcome Setup Again",
      "Review the shortcut and test it from the desktop", "󰑐", 10, "Setup", "", "", {
        controlType: "action"
      })
  ]
  if (text(status.launcherHotkey)) {
    records.push(record("omalauncher:setting-remove-launcher-hotkey",
      "settings-open-remove-launcher-hotkey", "Remove Launcher Shortcut",
      "Omalauncher will remain available from the bar", "", 20, "Setup", "", "", {
        controlType: "navigation",
        trailingText: "Remove",
        targetRoute: "settings-remove-shortcut",
        destructive: true
      }))
  }
  return records
}

/**
 * @param {Partial<Preferences> | null | undefined} preferences
 * @param {SettingsContext | null | undefined} context
 * @returns {SettingRecord[]}
 */
function suggestedScopeRecords(preferences, context) {
  var values = preferences || {}
  var status = context || {}
  var scopes = Array.isArray(values.fileSearchScopes) ? values.fileSearchScopes : []
  var suggestions = Array.isArray(status.commonScopes) ? status.commonScopes : []
  /** @type {SettingRecord[]} */
  var records = []
  for (var suggestionIndex = 0; suggestionIndex < suggestions.length; suggestionIndex++) {
    var suggestion = text(suggestions[suggestionIndex])
    if (!suggestion || scopes.indexOf(suggestion) >= 0) continue
    records.push(record(
      "omalauncher:setting-suggested-scope:" + suggestionIndex,
      "settings-add-suggested-scope",
      pathName(suggestion),
      suggestion,
      "󰈞",
      10 + suggestionIndex,
      "Suggested Folders",
      "fileSearchScopes",
      suggestion,
      { controlType: "action", trailingText: "Add" }
    ))
  }
  return records
}

/**
 * @param {Partial<Preferences> | null | undefined} preferences
 * @param {SettingsContext | null | undefined} context
 * @returns {SettingRecord[]}
 */
function fileSearchRecords(preferences, context) {
  var values = preferences || {}
  var status = context || {}
  var scopes = Array.isArray(values.fileSearchScopes) ? values.fileSearchScopes : []
  var ignores = Array.isArray(values.fileSearchIgnores) ? values.fileSearchIgnores : []
  var fileDescription = "Show matching files in launcher results · Try f report.pdf"
  if (status.fileSearchSettled === true && status.fileSearchAvailable !== true) {
    fileDescription = "fd is unavailable; install it to search files"
  }
  /** @type {SettingRecord[]} */
  var records = [
    record("omalauncher:setting-file-search", "settings-toggle", "Include File Results",
      fileDescription, "󰈞", 0, "Provider", "fileSearchEnabled", "", {
        controlType: "toggle",
        checked: values.fileSearchEnabled === true
      }),
    record("omalauncher:setting-add-scope", "settings-open-scope", "Add Folder",
      scopes.length > 0 ? countLabel(scopes.length, "folder") + " included" : "Choose where file search can look",
      "", 10, "Search Folders", "", "", {
        controlType: "navigation",
        targetRoute: "settings-scope"
      })
  ]

  for (var scopeIndex = 0; scopeIndex < scopes.length; scopeIndex++) {
    records.push(record(
      "omalauncher:setting-scope:" + scopeIndex,
      "settings-remove-scope",
      pathName(scopes[scopeIndex]),
      text(scopes[scopeIndex]),
      "󰉋",
      20 + scopeIndex,
      "Included Folders",
      "fileSearchScopes",
      scopes[scopeIndex],
      { controlType: "action", trailingText: "Remove" }
    ))
  }

  records.push(record("omalauncher:setting-add-ignore", "settings-open-ignore", "Add Ignore Pattern",
    ignores.length > 0 ? countLabel(ignores.length, "pattern") + " configured" : "Skip names such as node_modules or *.tmp",
    "", 40, "Ignored Files", "", "", {
      controlType: "navigation",
      targetRoute: "settings-ignore"
    }))
  for (var ignoreIndex = 0; ignoreIndex < ignores.length; ignoreIndex++) {
    records.push(record(
      "omalauncher:setting-ignore:" + ignoreIndex,
      "settings-remove-ignore",
      text(ignores[ignoreIndex]),
      "Files matching this pattern are skipped",
      "󰈉",
      50 + ignoreIndex,
      "Ignored Patterns",
      "fileSearchIgnores",
      ignores[ignoreIndex],
      { controlType: "action", trailingText: "Remove" }
    ))
  }
  return records
}

/** @returns {SettingRecord[]} */
function resetRecords() {
  return [
    record("omalauncher:setting-reset-providers", "settings-open-reset-providers",
      "Reset Provider Settings", "Restore provider defaults and remove folders and ignore patterns",
      "󰑐", 0, "Reset", "", "", {
        controlType: "navigation",
        trailingText: "Review",
        targetRoute: "settings-reset-providers",
        destructive: true
      }),
    record("omalauncher:setting-reset-personalization", "settings-open-reset-personalization",
      "Reset Personalization", "Clear favorites, aliases, hidden results, history, and ranking",
      "", 1, "Reset", "", "", {
        controlType: "navigation",
        trailingText: "Review",
        targetRoute: "settings-reset-personalization",
        destructive: true
      })
  ]
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
    .concat(shortcutRecords(context))
    .concat(dependencyRecords(context))
    .concat(fileSearchRecords(preferences, context))
    .concat(resetRecords())
    .concat(suggestedScopeRecords(preferences, context))
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
  var creatorWebsiteUrl = text(values.creatorWebsiteUrl) || "https://mirashif.com"
  var repositoryUrl = text(values.repositoryUrl) || "https://github.com/mirashif/omalauncher"
  var productTitle = "Omalauncher" + (version ? " v" + version.replace(/^v/i, "") : "")
  return [
    record("omalauncher:about-product", "about-copy-details", productTitle,
      "A keyboard-first command palette for Omarchy", "󰋼", 0, "", "about",
      productTitle + " · Omarchy 4 · Quickshell 0.3", {
        controlType: "hero",
        trailingText: "Omarchy 4 · Quickshell 0.3"
      }),
    record("omalauncher:about-creator", "about-open-url", "Mir Ashif",
      "Creator and maintainer", "󰖟", 10, "Creator", "website", creatorWebsiteUrl, {
        controlType: "link",
        trailingText: "mirashif.com"
      }),
    record("omalauncher:about-source", "about-open-url", "Source Code",
      "View the project on GitHub", "", 20, "Project", "source", repositoryUrl, {
        controlType: "link"
      }),
    record("omalauncher:about-issues", "about-open-url", "Report an Issue",
      "Open the GitHub issue tracker", "", 21, "Project", "issues", repositoryUrl + "/issues", {
        controlType: "link"
      }),
    record("omalauncher:about-license", "about-open-url", "MIT License",
      "Read the license on GitHub", "", 22, "Project", "license",
      repositoryUrl + "/blob/main/LICENSE", {
        controlType: "link"
      })
  ]
}

/**
 * @param {unknown} route
 * @param {unknown} query
 * @param {unknown} error
 * @param {unknown} busy
 * @param {Partial<Preferences> | null | undefined} [preferences]
 * @param {SettingsContext | null | undefined} [context]
 * @returns {SettingRecord[]}
 */
function inputRecords(route, query, error, busy, preferences, context) {
  var value = text(query).trim()
  if (route === "settings-scope") {
    var scopeRecords = [record(
      "omalauncher:setting-save-scope",
      "settings-save-scope",
      busy ? "Checking Folder…" : (value ? "Add Folder" : "Enter a Folder Path"),
      text(error) || value || "Type an absolute folder path, then press Enter",
      busy ? "" : "",
      0,
      "Add Folder",
      "fileSearchScopes",
      value,
      { controlType: "action", trailingText: value ? "Add" : "" }
    )]
    if (!value && !text(error) && busy !== true) {
      scopeRecords = scopeRecords.concat(suggestedScopeRecords(preferences, context))
    }
    return scopeRecords
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
    value,
    { controlType: "action", trailingText: value ? "Add" : "" }
  )]
}

/** @param {unknown} route @returns {SettingRecord[]} */
function confirmationRecords(route) {
  var value = text(route)
  var providers = value === "settings-reset-providers"
  var shortcut = value === "settings-remove-shortcut"
  var confirmKind = shortcut ? "settings-confirm-remove-shortcut"
    : (providers ? "settings-confirm-reset-providers" : "settings-confirm-reset-personalization")
  var title = shortcut ? "Remove Launcher Shortcut"
    : (providers ? "Reset Provider Settings" : "Reset Personalization")
  var description = shortcut
    ? "You will need to open Omalauncher from the bar until another shortcut is configured"
    : (providers
        ? "Restore provider defaults and remove configured folders and ignore patterns"
        : "Clear favorites, aliases, hidden results, history, and learned ranking")
  return [
    record("omalauncher:confirm:" + value, confirmKind, title, description,
      "", 0, "Confirmation", "", "", {
        controlType: "action",
        trailingText: shortcut ? "Remove" : "Reset",
        destructive: true
      }),
    record("omalauncher:cancel:" + value, "settings-cancel", "Cancel", "Keep current settings",
      "", 1, "Confirmation", "", "", { controlType: "action" })
  ]
}

/**
 * @param {unknown} route
 * @param {Partial<Preferences> | null | undefined} preferences
 * @param {SettingsContext | null | undefined} context
 * @param {unknown} query
 * @param {unknown} error
 * @param {unknown} busy
 * @returns {SettingRecord[]}
 */
function recordsForRoute(route, preferences, context, query, error, busy) {
  var value = text(route)
  if (value === "settings") return settingsRecords(preferences, context)
  if (value === "settings-shortcut") return shortcutRecords(context)
  if (value === "settings-dependencies") return dependencyRecords(context)
  if (value === "settings-file-search") return fileSearchRecords(preferences, context)
  if (value === "settings-reset") return resetRecords()
  if (value === "settings-about") return aboutRecords(context)
  if (isInputRoute(value)) return inputRecords(value, query, error, busy, preferences, context)
  if (isConfirmationRoute(value)) return confirmationRecords(value)
  return []
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
  return value === "settings-remove-shortcut"
    || value === "settings-reset-providers"
    || value === "settings-reset-personalization"
}

/**
 * @param {unknown} route
 * @param {unknown} addImmediately
 * @returns {boolean}
 */
function scopeValidationApplies(route, addImmediately) {
  return addImmediately === true || text(route) === "settings-scope"
}

/** @param {unknown} route @returns {string} */
function routeTitle(route) {
  /** @type {StringMap} */
  var titles = {
    settings: "Settings",
    "settings-shortcut": "Launcher Shortcut",
    "settings-dependencies": "Optional Features",
    "settings-file-search": "File Search",
    "settings-reset": "Data and Reset",
    "settings-about": "About Omalauncher",
    "settings-scope": "Add Folder",
    "settings-ignore": "Add Ignore Pattern",
    "settings-remove-shortcut": "Remove Launcher Shortcut",
    "settings-reset-providers": "Reset Provider Settings",
    "settings-reset-personalization": "Reset Personalization"
  }
  return titles[text(route)] || "Settings"
}

if (typeof module !== "undefined") {
  module.exports = {
    settingsRecords: settingsRecords,
    shortcutRecords: shortcutRecords,
    dependencyRecords: dependencyRecords,
    fileSearchRecords: fileSearchRecords,
    resetRecords: resetRecords,
    rootSearchRecords: rootSearchRecords,
    aboutRecords: aboutRecords,
    inputRecords: inputRecords,
    confirmationRecords: confirmationRecords,
    recordsForRoute: recordsForRoute,
    isRoute: isRoute,
    isInputRoute: isInputRoute,
    isConfirmationRoute: isConfirmationRoute,
    scopeValidationApplies: scopeValidationApplies,
    routeTitle: routeTitle
  }
}
