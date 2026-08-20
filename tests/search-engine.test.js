const test = require("node:test")
const assert = require("node:assert/strict")

const SearchEngine = require("../SearchEngine.js")

function record(overrides) {
  return {
    id: "omarchy:test",
    title: "Test",
    breadcrumb: "",
    description: "",
    route: "test",
    aliases: [],
    keywords: [],
    searchText: "test",
    order: 0,
    ...overrides
  }
}

test("semantic tiers are ordered ahead of frecency", () => {
  const exact = record({ id: "exact", title: "Firefox", searchText: "firefox", order: 2 })
  const fuzzy = record({ id: "fuzzy", title: "Firefly Tool", searchText: "firefly tool firefox helper", order: 1 })
  const usage = {
    fuzzy: { count: 10000, lastUsed: Date.now() },
    exact: { count: 0, lastUsed: 0 }
  }
  const results = SearchEngine.search([fuzzy, exact], "firefox", { usage })
  assert.equal(results[0].id, "exact")
  assert.equal(results[0].semanticTier, 2)
})

test("exact aliases beat exact titles", () => {
  const alias = record({ id: "alias", title: "Power", aliases: ["shutdown"], searchText: "power shutdown" })
  const title = record({ id: "title", title: "Shutdown", searchText: "shutdown" })
  assert.equal(SearchEngine.search([title, alias], "shutdown")[0].id, "alias")
})

test("compact fuzzy terms match individual words", () => {
  const firefox = record({
    id: "firefox",
    title: "Firefox",
    breadcrumb: "Remove › Browser",
    searchText: "firefox remove browser remove browser firefox"
  })
  const result = SearchEngine.search([firefox], "rm fire")
  assert.equal(result.length, 1)
  assert.equal(result[0].semanticTier, 6)
})

test("frecency breaks only otherwise equal semantic matches", () => {
  const older = record({ id: "older", title: "Firefox", route: "install.firefox", order: 1 })
  const recent = record({ id: "recent", title: "Firefox", route: "remove.firefox", order: 2 })
  const now = Date.now()
  const usage = { recent: { count: 4, lastUsed: now } }
  assert.equal(SearchEngine.search([older, recent], "firefox", { usage, now })[0].id, "recent")
})

test("prepared records preserve ranking without leaking cache fields", () => {
  const prepared = SearchEngine.prepareRecord(record({
    id: "prepared",
    title: "Hyprland",
    breadcrumb: "Update › Config",
    searchText: "hyprland update config"
  }))
  const result = SearchEngine.search([prepared], "update hyprland")[0]

  assert.equal(result.id, "prepared")
  assert.equal(result.semanticTier, 4)
  assert.equal(Object.keys(result).some(key => key.startsWith("_search")), false)
})
