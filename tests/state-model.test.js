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
    }
  }), {
    version: 1,
    favorites: ["application:firefox"],
    usage: { "application:firefox": { count: 3, lastUsed: 1200 } }
  })
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

test("usage records increment count and update recency", () => {
  const once = StateModel.recordUsage(StateModel.emptyState(), "application:firefox", 1000)
  const twice = StateModel.recordUsage(once, "application:firefox", 2500)

  assert.deepEqual(twice.usage["application:firefox"], { count: 2, lastUsed: 2500 })
  assert.equal(once.usage["application:firefox"].count, 1)
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
