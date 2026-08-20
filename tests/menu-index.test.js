const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const MenuIndex = require("../providers/MenuIndex.js")
const SearchEngine = require("../services/SearchEngine.js")

const fixtures = path.join(__dirname, "fixtures")

/** @param {string} name @returns {import("../types/models").MenuSourceItem[]} */
function loadFixture(name) {
  const raw = fs.readFileSync(path.join(fixtures, name), "utf8")
  const parsed = MenuIndex.parseMenuJsonc(raw)
  assert.equal(parsed.error, "")
  return parsed.items
}

function fixtureIndex(whenResults = { "remove.browser.firefox": true, "hidden.action": false }) {
  const merged = MenuIndex.mergeMenuSources(
    loadFixture("contextual-menu.jsonc"),
    loadFixture("user-menu.jsonc")
  )
  return {
    merged,
    records: MenuIndex.buildCommandRecords(merged, whenResults)
  }
}

test("JSONC parsing preserves URL-like strings and accepts trailing commas", () => {
  const parsed = MenuIndex.parseMenuJsonc(`{
    // comment
    "docs": { "label": "Docs", "action": "open https://example.com/a//b", },
  }`)
  assert.equal(parsed.error, "")
  assert.equal(parsed.items[0].definition["action"], "open https://example.com/a//b")
})

test("malformed JSONC reports an actionable parse error", () => {
  const parsed = MenuIndex.parseMenuJsonc('{ "broken": ')
  assert.equal(parsed.items.length, 0)
  assert.match(parsed.error, /SyntaxError|JSON/)
})

test("user definitions override only the fields they provide", () => {
  const { merged } = fixtureIndex()
  const firefox = merged.items["remove.browser.firefox"]
  assert.equal(firefox.action, "remove-firefox")
  assert.equal(firefox.when, "has-firefox")
  assert.equal(firefox.description, "Remove the Mozilla browser")
})

test("command records contain route and ancestor breadcrumb metadata", () => {
  const { records } = fixtureIndex()
  const firefox = records.find(record => record.route === "remove.browser.firefox")
  assert.ok(firefox)
  assert.deepEqual(
    { title: firefox.title, breadcrumb: firefox.breadcrumb, route: firefox.route },
    { title: "Firefox", breadcrumb: "Remove › Browser", route: "remove.browser.firefox" }
  )
  assert.match(firefox.searchText, /^firefox remove browser /)
  assert.match(firefox.searchText, / remove browser firefox$/)
})

test("command records preserve navigation, provider, and checked metadata", () => {
  const parsed = MenuIndex.parseMenuJsonc(`{
    "apps": { "label": "Apps", "provider": "apps" },
    "setup": { "label": "Setup" },
    "settings": { "label": "Settings", "target": "setup" },
    "setup.enabled": { "label": "Enabled", "checked": "is-enabled", "action": "enable" }
  }`)
  const merged = MenuIndex.mergeMenuSources(parsed.items, [])
  const records = MenuIndex.buildCommandRecords(merged, {}, { "setup.enabled": true })

  assert.deepEqual(
    records.map(record => [record.route, record.targetRoute, record.provider, record.checked]),
    [
      ["apps", "", "apps", false],
      ["setup", "", "", false],
      ["settings", "setup", "", false],
      ["setup.enabled", "", "", true]
    ]
  )
})

test("menu routes expose direct children or all descendants in source order", () => {
  const { records } = fixtureIndex()
  assert.deepEqual(
    MenuIndex.recordsForRoute(records, "install", false).map(record => record.route),
    ["install.browser", "install.development"]
  )
  assert.deepEqual(
    MenuIndex.recordsForRoute(records, "install", true).map(record => record.route),
    [
      "install.browser",
      "install.browser.firefox",
      "install.development",
      "install.development.docker-dbs"
    ]
  )
})

test("conditional visibility removes unavailable leaves and empty menus", () => {
  const { records } = fixtureIndex({
    "remove.browser.firefox": false,
    "hidden.action": false
  })
  assert.equal(records.some(record => record.route === "remove.browser.firefox"), false)
  assert.equal(records.some(record => record.route === "hidden.action"), false)
  assert.equal(records.some(record => record.route === "hidden"), false)
})

test("contextual acceptance queries reach the intended stock-style routes", () => {
  const { records } = fixtureIndex()
  /** @type {[string, string][]} */
  const cases = [
    ["install docker", "install.development.docker-dbs"],
    ["remove firefox", "remove.browser.firefox"],
    ["update hyprland", "update.config.hyprland"],
    ["style screensaver", "style.screensaver"],
    ["browser default", "setup.default.browser"]
  ]

  for (const [query, expectedRoute] of cases) {
    const results = SearchEngine.search(records, query)
    assert.ok(results.length > 0, `expected a result for ${query}`)
    assert.equal(results[0].route, expectedRoute, query)
    assert.equal(results[0].semanticTier, 4, query)
  }
})

test("duplicate Firefox titles remain distinguishable by breadcrumb", () => {
  const { records } = fixtureIndex()
  const results = SearchEngine.search(records, "firefox")
    .filter(result => result.title === "Firefox")
  assert.equal(results.length, 3)
  assert.deepEqual(
    new Set(results.map(result => result.breadcrumb)),
    new Set(["Install › Browser", "Remove › Browser", "Setup › Defaults › Browser"])
  )
})

test("guard result parsing preserves ids and both result types", () => {
  const parsed = MenuIndex.parseGuardResults([
    "remove.browser.firefox:w:1",
    "setup.default.browser.firefox:c:0",
    "odd:id:w:0"
  ].join("\n"))
  assert.equal(parsed.when["remove.browser.firefox"], true)
  assert.equal(parsed.checked["setup.default.browser.firefox"], false)
  assert.equal(parsed.when["odd:id"], false)
})

test("guard generation creates one batch and caches repeated readers", () => {
  const { merged } = fixtureIndex()
  merged.items["setup.default.browser.firefox"].checked = '[[ "$(omarchy-default-browser)" == firefox ]]'
  const script = MenuIndex.guardScript(merged.items)
  assert.match(script, /declare -A __omarchy_pkgs/)
  assert.equal((script.match(/__omarchy_read_2=\$\(omarchy-default-browser/g) || []).length, 1)
  assert.match(script, /remove\.browser\.firefox:w:/)
})
