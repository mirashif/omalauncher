const test = require("node:test")
const assert = require("node:assert/strict")

const StateModel = require("../services/StateModel.js")

function app(id, title) {
  return { id, type: "application", title }
}

function command(id, title) {
  return { id, type: "command", title }
}

test("state normalization repairs malformed and duplicate values", () => {
  assert.deepEqual(StateModel.parseState("not json"), StateModel.emptyState())
  assert.match(StateModel.parseStateResult("not json").error, /malformed/)
  assert.equal(StateModel.parseStateResult("").error, "")
  assert.deepEqual(StateModel.normalizeState({
    version: 99,
    favorites: ["application:firefox", "", "application:firefox", null],
    usage: {
      "application:firefox": { count: 3.9, lastUsed: 1200.8 },
      broken: { count: -10, lastUsed: -2 },
      empty: null
    },
    aliases: { "application:firefox": " ff ", empty: "" },
    hidden: ["omarchy:update", "", "omarchy:update"],
    queryHistory: ["firefox", " Firefox ", "update"],
    preferences: {
      compactMode: true,
      calculatorEnabled: false,
      fileSearchEnabled: true,
      quickActivationEnabled: false,
      fileSearchScopes: ["/home/test/Documents/", "/", "relative", "/home/test/Documents"],
      fileSearchIgnores: ["node_modules", "", "node_modules", "*.tmp"]
    }
  }), {
    version: 3,
    favorites: ["application:firefox"],
    usage: { "application:firefox": { count: 3, lastUsed: 1200 } },
    aliases: { "application:firefox": "ff" },
    hidden: ["omarchy:update"],
    queryHistory: ["firefox", "update"],
    preferences: {
      compactMode: true,
      calculatorEnabled: false,
      fileSearchEnabled: true,
      quickActivationEnabled: false,
      fileSearchScopes: ["/home/test/Documents"],
      fileSearchIgnores: ["node_modules", "*.tmp"]
    }
  })
})

test("version 1 state migrates without losing favorites or usage", () => {
  const migrated = StateModel.normalizeState({
    version: 1,
    favorites: ["application:firefox"],
    usage: { "application:firefox": { count: 2, lastUsed: 3000 } }
  })

  assert.deepEqual(migrated, {
    version: 3,
    favorites: ["application:firefox"],
    usage: { "application:firefox": { count: 2, lastUsed: 3000 } },
    aliases: {},
    hidden: [],
    queryHistory: [],
    preferences: StateModel.emptyPreferences()
  })
})

test("version 2 state gains provider defaults without losing compact mode", () => {
  const migrated = StateModel.normalizeState({
    version: 2,
    favorites: ["application:firefox"],
    preferences: { compactMode: true }
  })

  assert.equal(migrated.version, 3)
  assert.equal(migrated.preferences.compactMode, true)
  assert.equal(migrated.preferences.calculatorEnabled, true)
  assert.equal(migrated.preferences.fileSearchEnabled, false)
  assert.equal(migrated.preferences.quickActivationEnabled, true)
  assert.deepEqual(migrated.preferences.fileSearchScopes, [])
})

test("favorites toggle immutably with newest first", () => {
  const initial = StateModel.emptyState()
  const added = StateModel.toggleFavorite(initial, "omarchy:update")
  const second = StateModel.toggleFavorite(added, "application:firefox")
  const removed = StateModel.toggleFavorite(second, "omarchy:update")

  assert.deepEqual(initial.favorites, [])
  assert.deepEqual(second.favorites, ["application:firefox", "omarchy:update"])
  assert.deepEqual(removed.favorites, ["application:firefox"])
})

test("favorites move within ordered bounds", () => {
  const state = StateModel.normalizeState({
    favorites: ["one", "two", "three"]
  })
  const movedUp = StateModel.moveFavorite(state, "three", -1)
  const movedDown = StateModel.moveFavorite(movedUp, "one", 2)

  assert.deepEqual(movedUp.favorites, ["one", "three", "two"])
  assert.deepEqual(movedDown.favorites, ["three", "two", "one"])
  assert.deepEqual(StateModel.moveFavorite(movedDown, "missing", 1).favorites, movedDown.favorites)
})

test("usage records increment count and update recency", () => {
  const once = StateModel.recordUsage(StateModel.emptyState(), "application:firefox", 1000)
  const twice = StateModel.recordUsage(once, "application:firefox", 2500)

  assert.deepEqual(twice.usage["application:firefox"], { count: 2, lastUsed: 2500 })
  assert.equal(once.usage["application:firefox"].count, 1)
})

test("interaction preferences update without losing unrelated state", () => {
  let state = StateModel.toggleFavorite(StateModel.emptyState(), "application:firefox")
  state = StateModel.setAlias(state, "application:firefox", "ff")
  state = StateModel.setHidden(state, "omarchy:update", true)
  state = StateModel.recordQuery(state, "update hyprland")
  state = StateModel.recordQuery(state, "Update Hyprland")
  state = StateModel.recordQuery(state, "firefox")
  state = StateModel.setCompactMode(state, true)

  assert.equal(StateModel.aliasFor(state, "application:firefox"), "ff")
  assert.equal(StateModel.isHidden(state, "omarchy:update"), true)
  assert.deepEqual(state.queryHistory, ["firefox", "Update Hyprland"])
  assert.deepEqual(state.favorites, ["application:firefox"])
  assert.equal(state.preferences.compactMode, true)
  assert.equal(state.preferences.calculatorEnabled, true)

  state = StateModel.setAlias(state, "application:firefox", "")
  state = StateModel.setHidden(state, "omarchy:update", false)
  state = StateModel.clearQueryHistory(state)
  assert.equal(StateModel.aliasFor(state, "application:firefox"), "")
  assert.equal(StateModel.isHidden(state, "omarchy:update"), false)
  assert.deepEqual(state.queryHistory, [])
})

test("provider preferences and scope lists update independently", () => {
  let state = StateModel.emptyState()
  state = StateModel.setPreference(state, "calculatorEnabled", false)
  state = StateModel.setPreference(state, "fileSearchEnabled", true)
  state = StateModel.addFileScope(state, "/home/test/Documents/")
  state = StateModel.addFileScope(state, "/home/test/Documents")
  state = StateModel.addFileScope(state, "/")
  state = StateModel.addFileIgnore(state, "node_modules")
  state = StateModel.addFileIgnore(state, "*.tmp")
  state = StateModel.removeFileIgnore(state, "node_modules")

  assert.equal(state.preferences.calculatorEnabled, false)
  assert.equal(state.preferences.fileSearchEnabled, true)
  assert.equal(state.preferences.quickActivationEnabled, true)
  assert.deepEqual(state.preferences.fileSearchScopes, ["/home/test/Documents"])
  assert.deepEqual(state.preferences.fileSearchIgnores, ["*.tmp"])

  state = StateModel.removeFileScope(state, "/home/test/Documents/")
  assert.deepEqual(state.preferences.fileSearchScopes, [])
})

test("provider and personalization resets preserve unrelated state", () => {
  let state = StateModel.toggleFavorite(StateModel.emptyState(), "application:firefox")
  state = StateModel.setCompactMode(state, true)
  state = StateModel.setPreference(state, "fileSearchEnabled", true)
  state = StateModel.addFileScope(state, "/home/test/Documents")

  const providersReset = StateModel.resetProviderSettings(state)
  assert.deepEqual(providersReset.favorites, ["application:firefox"])
  assert.equal(providersReset.preferences.compactMode, true)
  assert.equal(providersReset.preferences.fileSearchEnabled, false)
  assert.deepEqual(providersReset.preferences.fileSearchScopes, [])

  const personalizationReset = StateModel.resetPersonalization(state)
  assert.deepEqual(personalizationReset.favorites, [])
  assert.equal(personalizationReset.preferences.fileSearchEnabled, true)
  assert.deepEqual(personalizationReset.preferences.fileSearchScopes, ["/home/test/Documents"])
})

test("empty state groups favorites and recent records without duplicates", () => {
  const records = [
    app("application:firefox", "Firefox"),
    app("application:brave", "Brave"),
    app("application:code", "Code"),
    command("omarchy:update", "Update"),
    command("omarchy:remove.firefox", "Firefox"),
    command("omarchy:style.screensaver", "Screensaver")
  ]
  const state = {
    version: 1,
    favorites: ["omarchy:update", "application:firefox", "missing"],
    usage: {
      "omarchy:update": { count: 4, lastUsed: 5000 },
      "application:firefox": { count: 2, lastUsed: 4500 },
      "application:brave": { count: 1, lastUsed: 4000 },
      "omarchy:remove.firefox": { count: 3, lastUsed: 3000 },
      missing: { count: 99, lastUsed: 9000 }
    }
  }

  const rows = StateModel.emptyStateRows(records, state)
  assert.deepEqual(rows.map(row => [row.id, row.section, row.favorite]), [
    ["omarchy:update", "Favorites", true],
    ["application:firefox", "Favorites", true],
    ["application:brave", "Recent Applications", false],
    ["omarchy:remove.firefox", "Recent Commands", false],
    ["application:code", "Applications", false],
    ["omarchy:style.screensaver", "Omarchy Commands", false]
  ])
  assert.equal(rows.length, records.length)
  assert.equal(new Set(rows.map(row => row.id)).size, records.length)

  const limited = StateModel.emptyStateRows(records, state, { favoriteLimit: 1 })
  assert.equal(limited.length, records.length)
  assert.deepEqual(
    limited.find(row => row.id === "application:firefox"),
    { id: "application:firefox", type: "application", title: "Firefox", section: "Applications", favorite: true }
  )
})

test("empty state shows the complete index without history", () => {
  const records = [
    app("application:firefox", "Firefox"),
    app("application:code", "Code"),
    command("omarchy:update", "Update"),
    command("omarchy:remove.firefox", "Firefox")
  ]

  const rows = StateModel.emptyStateRows(records, StateModel.emptyState())
  assert.deepEqual(rows.map(row => [row.id, row.section]), [
    ["application:firefox", "Applications"],
    ["application:code", "Applications"],
    ["omarchy:update", "Omarchy Commands"],
    ["omarchy:remove.firefox", "Omarchy Commands"]
  ])
})

test("empty state preserves explicit sections for launcher-owned records", () => {
  const rows = StateModel.emptyStateRows([{
    id: "omalauncher:manage-hidden",
    type: "launcher-command",
    title: "Manage Hidden Results",
    section: "Launcher"
  }], StateModel.emptyState())

  assert.equal(rows[0].section, "Launcher")
})

test("reset ranking can clear one result or all usage", () => {
  const state = {
    version: 1,
    favorites: ["application:firefox"],
    usage: {
      "application:firefox": { count: 2, lastUsed: 2000 },
      "omarchy:update": { count: 1, lastUsed: 1000 }
    }
  }
  assert.deepEqual(Object.keys(StateModel.resetUsage(state, "application:firefox").usage), ["omarchy:update"])
  assert.deepEqual(StateModel.resetUsage(state).usage, {})
  assert.deepEqual(StateModel.resetUsage(state).favorites, ["application:firefox"])
})
