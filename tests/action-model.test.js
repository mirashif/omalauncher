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

  assert.deepEqual(actions.map(action => action.id), ["primary", "favorite"])
  assert.equal(actions[0].title, "Open Application")
  assert.equal(actions[1].title, "Add to Favorites")
})

test("commands expose primary, parent, favorite, and learned-ranking actions", () => {
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

  assert.deepEqual(actions.map(action => action.id), ["primary", "parent", "stock-menu", "favorite", "reset-ranking"])
  assert.equal(actions[0].title, "Run Command")
  assert.equal(actions[1].title, "Open Parent Menu")
  assert.equal(actions[1].description, "Update › Config")
  assert.equal(actions[2].title, "Open in Default Omarchy Menu")
  assert.equal(actions[3].title, "Remove from Favorites")
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
  assert.equal(actions[2].title, "Open in Default Omarchy Menu")
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
  assert.equal(actions[2].description, "Settings")
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

  assert.equal(SearchEngine.search(actions, "parent")[0].id, "parent")
  assert.equal(SearchEngine.search(actions, "stock")[0].id, "stock-menu")
  assert.equal(SearchEngine.search(actions, "star")[0].id, "favorite")
  assert.equal(SearchEngine.search(actions, "frecency")[0].id, "reset-ranking")
})
