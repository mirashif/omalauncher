const test = require("node:test")
const assert = require("node:assert/strict")

const ActionModel = require("../services/ActionModel.js")
const SearchEngine = require("../SearchEngine.js")

test("application actions expose open and favorites without an Omarchy parent", () => {
  const actions = ActionModel.actionsForResult({
    resultId: "application:brave-browser",
    resultType: "application",
    title: "Brave",
    parentRoute: "root"
  }, { favorite: false, usage: {} })

  assert.deepEqual(actions.map(action => action.id), ["primary", "configure-actions", "favorite"])
  assert.equal(actions[0].title, "Open Application")
  assert.equal(actions[2].title, "Add to Favorites")
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

  assert.deepEqual(actions.map(action => action.id), ["primary", "omarchy-actions", "configure-actions", "favorite", "reset-ranking"])
  assert.equal(actions[0].title, "Run Command")
  assert.equal(actions[1].kind, "submenu")
  assert.equal(actions[1].target, "omarchy")
  assert.equal(actions[3].title, "Remove from Favorites")
  assert.deepEqual(actions.map(action => action.section), ["Primary", "Navigation", "Configure", "Favorites", "Manage"])

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

test("configure submenu exposes alias editing and removal", () => {
  const result = {
    resultId: "application:brave-browser",
    resultType: "application",
    title: "Brave"
  }
  const empty = ActionModel.actionsForResult(result, { alias: "", hidden: false }, "configure")
  const configured = ActionModel.actionsForResult(result, { alias: "bb", hidden: true }, "configure")

  assert.deepEqual(empty.map(action => action.id), ["set-alias", "toggle-hidden"])
  assert.equal(empty[0].kind, "editor")
  assert.equal(empty[1].title, "Hide from Search")
  assert.deepEqual(configured.map(action => action.id), ["set-alias", "remove-alias", "toggle-hidden"])
  assert.equal(configured[0].description, "bb")
  assert.equal(configured[2].title, "Unhide from Search")
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
