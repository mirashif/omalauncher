const test = require("node:test")
const assert = require("node:assert/strict")

const ActionModel = require("../services/ActionModel.js")
const SearchEngine = require("../services/SearchEngine.js")

test("application actions expose open and favorites without an Omarchy parent", () => {
  const actions = ActionModel.actionsForResult({
    resultId: "application:brave-browser",
    resultType: "application",
    title: "Brave",
    parentRoute: "root"
  }, { favorite: false, usage: {} })

  assert.deepEqual(actions.map(action => action.id), [
    "primary", "configure-actions", "favorite", "toggle-hidden"
  ])
  assert.equal(actions[0].title, "Open Application")
  assert.equal(actions[1].title, "Configure Application")
  assert.equal(actions[2].title, "Add to Favorites")
})

test("applications expose uninstall only when the provider supports removal", () => {
  const result = {
    resultId: "application:brave-browser",
    resultType: "application",
    title: "Brave"
  }
  const unavailable = ActionModel.actionsForResult(result, { canUninstall: false })
  const available = ActionModel.actionsForResult(result, { canUninstall: true })

  assert.equal(unavailable.some(action => action.id === "uninstall-application"), false)
  assert.deepEqual(
    available.map(action => action.id),
    ["primary", "configure-actions", "favorite", "toggle-hidden", "uninstall-application"]
  )
  assert.equal(available[4].section, "Manage")
  assert.equal(available[4].destructive, true)
})

test("applications expose desktop-entry utilities only when resolution is available", () => {
  const result = {
    resultId: "application:org.mozilla.firefox",
    resultType: "application",
    appId: "org.mozilla.firefox",
    title: "Firefox"
  }
  const actions = ActionModel.actionsForResult(result, { canResolveDesktopEntry: true })

  assert.deepEqual(actions.slice(0, 2).map(action => action.id), [
    "primary", "application-tools"
  ])
  assert.equal(actions[1].kind, "submenu")

  const utilities = ActionModel.actionsForResult(
    result, { canResolveDesktopEntry: true }, "application-tools")
  assert.deepEqual(utilities.map(action => action.id), [
    "reveal-application", "copy-desktop-entry-path", "copy-application-id"
  ])
  assert.equal(utilities[2].description, "org.mozilla.firefox")
})

test("application quit and restart appear only for a confirmed running identity", () => {
  const result = {
    resultId: "application:org.mozilla.firefox",
    resultType: "application",
    appId: "org.mozilla.firefox",
    title: "Firefox"
  }
  const stopped = ActionModel.actionsForResult(result, { applicationRunning: false })
  const running = ActionModel.actionsForResult(result, { applicationRunning: true })

  assert.equal(stopped.some(action => action.id === "quit-application"), false)
  assert.deepEqual(
    running.filter(action => action.id.endsWith("-application")).map(action => action.id),
    ["quit-application", "restart-application"]
  )
  assert.deepEqual(running.slice(0, 4).map(action => action.id), [
    "primary", "quit-application", "restart-application", "application-tools"
  ])
})

test("commands expose structured root and Omarchy submenu actions", () => {
  const id = "omarchy:update.config.hyprland"
  const actions = ActionModel.actionsForResult({
    resultId: id,
    resultType: "omarchy-command",
    resultKind: "action",
    title: "Hyprland",
    breadcrumb: "Update › Config",
    parentRoute: "update.config"
  }, {
    favorite: true,
    usage: { [id]: { count: 3, lastUsed: 1000 } }
  })

  assert.deepEqual(actions.map(action => action.id), [
    "primary", "omarchy-actions", "configure-actions", "favorite", "toggle-hidden", "reset-ranking"
  ])
  assert.equal(actions[0].title, "Run Command")
  assert.equal(actions[1].kind, "submenu")
  assert.equal(actions[1].target, "omarchy")
  assert.equal(actions[2].title, "Configure Command")
  assert.equal(actions[3].title, "Remove from Favorites")
  assert.deepEqual(actions.map(action => action.section), [
    "Primary", "Navigation", "Configure", "Favorites", "Manage", "Manage"
  ])

  const omarchyActions = ActionModel.actionsForResult({
    resultId: id,
    resultType: "omarchy-command",
    resultKind: "action",
    title: "Hyprland",
    breadcrumb: "Update › Config",
    parentRoute: "update.config"
  }, { favorite: true, usage: {} }, "omarchy")
  assert.deepEqual(omarchyActions.map(action => action.id), ["parent", "stock-menu"])
  assert.equal(omarchyActions[0].description, "Update › Config")
})

test("shell features open directly without an unrelated stock-menu action", () => {
  const actions = ActionModel.actionsForResult({
    resultId: "shell-plugin:omarchy.clipboard",
    resultType: "shell-plugin",
    resultKind: "shell-feature",
    executionKind: "shell-plugin",
    title: "Clipboard"
  }, { usage: {} })

  assert.deepEqual(actions.map(action => action.id), [
    "primary", "configure-actions", "favorite", "toggle-hidden"
  ])
  assert.equal(actions[0].title, "Open Shell Feature")
})

test("CLI actions distinguish reviewed execution from help-only discovery", () => {
  const direct = ActionModel.actionsForResult({
    resultId: "omarchy-cli:omarchy-audio-input-mute",
    resultType: "omarchy-cli",
    resultKind: "cli-command",
    executionKind: "cli-direct",
    commandRoute: "omarchy audio input mute",
    title: "Mute Microphone"
  }, { usage: {} })
  const helpOnly = ActionModel.actionsForResult({
    resultId: "omarchy-cli:omarchy-install-package",
    resultType: "omarchy-cli",
    resultKind: "cli-help",
    executionKind: "cli-help",
    commandRoute: "omarchy install package",
    title: "Package"
  }, { usage: {} })

  assert.deepEqual(direct.map(action => action.id), [
    "primary", "command-help", "copy-command", "configure-actions", "favorite", "toggle-hidden"
  ])
  assert.equal(direct[0].title, "Run Command")
  assert.deepEqual(helpOnly.map(action => action.id), [
    "primary", "copy-command", "configure-actions", "favorite", "toggle-hidden"
  ])
  assert.equal(helpOnly[0].title, "Show Command Help")
})

test("submenu primary actions are labelled Open Menu", () => {
  const actions = ActionModel.actionsForResult({
    resultId: "omarchy:setup",
    resultType: "omarchy-command",
    resultKind: "menu",
    title: "Setup",
    parentRoute: "root"
  }, { usage: {} })

  assert.equal(actions[0].title, "Open Menu")
  assert.equal(actions[1].title, "Open With Omarchy")
})

test("menu links use navigation actions", () => {
  const actions = ActionModel.actionsForResult({
    resultId: "omarchy:settings",
    resultType: "omarchy-command",
    resultKind: "link",
    title: "Settings",
    targetRoute: "setup",
    parentRoute: "root"
  }, { usage: {} })

  assert.equal(actions[0].title, "Open Menu")
  assert.equal(actions[1].description, "Settings")
})

test("configure submenu exposes alias and application hotkey editing", () => {
  const result = {
    resultId: "application:brave-browser",
    resultType: "application",
    title: "Brave"
  }
  const empty = ActionModel.actionsForResult(result, {
    alias: "", hidden: false, canConfigureHotkeys: true, hotkey: ""
  }, "configure")
  const configured = ActionModel.actionsForResult(result, {
    alias: "bb", hidden: true, canConfigureHotkeys: true, hotkey: "SUPER + B"
  }, "configure")

  assert.deepEqual(empty.map(action => action.id), ["set-alias", "set-hotkey"])
  assert.equal(empty[0].kind, "editor")
  assert.equal(empty[1].target, "hotkey")
  assert.deepEqual(configured.map(action => action.id), [
    "set-alias", "remove-alias", "set-hotkey", "remove-hotkey"
  ])
  assert.equal(configured[0].description, "bb")
  const main = ActionModel.actionsForResult(result, { hidden: true })
  const visibilityAction = main.find(action => action.id === "toggle-hidden")
  assert.ok(visibilityAction)
  assert.equal(visibilityAction.title, "Unhide from Search")
})

test("hidden-result manager exposes only its primary navigation action", () => {
  const actions = ActionModel.actionsForResult({
    resultId: "omalauncher:manage-hidden",
    resultType: "launcher-command",
    resultKind: "manage-hidden",
    title: "Manage Hidden Results"
  }, {})

  assert.deepEqual(actions.map(action => action.id), ["primary"])
  assert.equal(actions[0].title, "Manage Hidden Results")
})

test("compact-mode command exposes only its primary toggle action", () => {
  const actions = ActionModel.actionsForResult({
    resultId: "omalauncher:toggle-compact",
    resultType: "launcher-command",
    resultKind: "toggle-compact",
    title: "Enable Compact Mode"
  }, {})

  assert.deepEqual(actions.map(action => action.id), ["primary"])
  assert.equal(actions[0].title, "Enable Compact Mode")
})

test("settings commands expose only their launcher-owned primary action", () => {
  const settingActions = ActionModel.actionsForResult({
    resultId: "omalauncher:setting-file-search",
    resultType: "launcher-command",
    resultKind: "settings-toggle",
    title: "Scoped File Search"
  }, {})
  const aboutActions = ActionModel.actionsForResult({
    resultId: "omalauncher:about-source",
    resultType: "launcher-command",
    resultKind: "about-open-url",
    title: "View Source Code"
  }, {})
  const calculatorActions = ActionModel.actionsForResult({
    resultId: "omalauncher:calculate",
    resultType: "launcher-command",
    resultKind: "open-calculator",
    title: "Calculate"
  }, {})

  assert.deepEqual(settingActions.map(action => action.id), ["primary"])
  assert.deepEqual(aboutActions.map(action => action.id), ["primary"])
  assert.deepEqual(calculatorActions.map(action => action.id), ["primary"])
  assert.equal(settingActions[0].title, "Scoped File Search")
  assert.equal(aboutActions[0].title, "View Source Code")
  assert.equal(calculatorActions[0].title, "Calculate")
})

test("calculator results expose copy actions without launcher personalization", () => {
  const actions = ActionModel.actionsForResult({
    resultId: "calculator:2 + 2",
    resultType: "calculator",
    resultKind: "calculator",
    title: "4",
    calculatorExpression: "2 + 2",
    calculatorResult: "4"
  }, {})

  assert.deepEqual(actions.map(action => action.id), ["primary", "copy-expression"])
  assert.equal(actions[0].title, "Copy Result")
  assert.equal(actions[1].description, "2 + 2")
})

test("file results expose literal open, reveal, and copy-path actions", () => {
  const actions = ActionModel.actionsForResult({
    resultId: "file:/home/test/Documents:report.md",
    resultType: "file",
    resultKind: "file",
    title: "report.md",
    filePath: "/home/test/Documents/report.md"
  }, {})

  assert.deepEqual(actions.map(action => action.id), ["primary", "reveal-file", "copy-path"])
  assert.equal(actions[0].title, "Open File")
  assert.equal(actions[1].description, "/home/test/Documents/report.md")
})

test("file-search management and status rows expose only their primary action", () => {
  const management = ActionModel.actionsForResult({
    resultId: "omalauncher:search-files",
    resultType: "launcher-command",
    resultKind: "open-files",
    title: "Search Files"
  }, {})
  const status = ActionModel.actionsForResult({
    resultId: "file-search:unavailable",
    resultType: "file-status",
    resultKind: "file-search-unavailable",
    title: "File Search Unavailable"
  }, {})

  assert.deepEqual(management.map(action => action.id), ["primary"])
  assert.deepEqual(status.map(action => action.id), ["primary"])
})

test("favorite actions expose only valid reorder directions", () => {
  const result = {
    resultId: "application:brave-browser",
    resultType: "application",
    title: "Brave"
  }
  const first = ActionModel.actionsForResult(result, {
    favorite: true,
    favoriteIndex: 0,
    favoriteCount: 3
  })
  const middle = ActionModel.actionsForResult(result, {
    favorite: true,
    favoriteIndex: 1,
    favoriteCount: 3
  })

  assert.equal(first.some(action => action.id === "favorite-up"), false)
  assert.equal(first.some(action => action.id === "favorite-down"), true)
  assert.equal(middle.some(action => action.id === "favorite-up"), true)
  assert.equal(middle.some(action => action.id === "favorite-down"), true)
})

test("action titles and keywords are searchable", () => {
  const id = "omarchy:update.config.hyprland"
  const actions = ActionModel.actionsForResult({
    resultId: id,
    resultType: "omarchy-command",
    resultKind: "action",
    title: "Hyprland",
    parentRoute: "update.config"
  }, { usage: { [id]: { count: 1, lastUsed: 1000 } } })

  assert.equal(SearchEngine.search(actions, "parent")[0].id, "omarchy-actions")
  assert.equal(SearchEngine.search(actions, "stock")[0].id, "omarchy-actions")
  assert.equal(SearchEngine.search(actions, "star")[0].id, "favorite")
  assert.equal(SearchEngine.search(actions, "frecency")[0].id, "reset-ranking")
})
