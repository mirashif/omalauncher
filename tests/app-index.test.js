const test = require("node:test")
const assert = require("node:assert/strict")

const AppIndex = require("../providers/AppIndex.js")
const SearchEngine = require("../services/SearchEngine.js")

const entries = [
  {
    id: "org.mozilla.firefox.desktop",
    name: "Firefox",
    genericName: "Web Browser",
    comment: "Browse the World Wide Web",
    icon: "firefox",
    keywords: ["Internet", "WWW", "Browser", "Web"],
    categories: ["Network", "WebBrowser"]
  },
  {
    id: "code",
    name: "Visual Studio Code",
    genericName: "Text Editor",
    comment: "Code Editing. Redefined.",
    icon: "visual-studio-code",
    keywords: ["vscode"],
    categories: ["Development", "IDE"]
  },
  { id: "hidden", name: "Hidden", noDisplay: true },
  { id: "filtered", name: "Filtered", hidden: true },
  { id: "code.desktop", name: "Duplicate Code" }
]

test("application records normalize ids, metadata, and icons", () => {
  const records = AppIndex.buildApplicationRecords(entries)
  assert.equal(records.length, 2)
  const firefox = records.find(record => record.appId === "org.mozilla.firefox")
  assert.ok(firefox)
  assert.deepEqual(
    {
      id: firefox.id,
      type: firefox.type,
      title: firefox.title,
      description: firefox.description,
      appIcon: firefox.appIcon
    },
    {
      id: "application:org.mozilla.firefox",
      type: "application",
      title: "Firefox",
      description: "Web Browser",
      appIcon: "firefox"
    }
  )
})

test("generic names, comments, keywords, categories, and desktop ids are searchable", () => {
  const records = AppIndex.buildApplicationRecords(entries)
  assert.equal(SearchEngine.search(records, "web browser")[0].appId, "org.mozilla.firefox")
  assert.equal(SearchEngine.search(records, "world wide")[0].appId, "org.mozilla.firefox")
  assert.equal(SearchEngine.search(records, "vscode")[0].appId, "code")
  assert.equal(SearchEngine.search(records, "development ide")[0].appId, "code")
  assert.equal(SearchEngine.search(records, "mozilla firefox")[0].appId, "org.mozilla.firefox")
})

test("an exact application and command tie favors the application provider", () => {
  const app = AppIndex.buildApplicationRecords(entries).find(record => record.title === "Firefox")
  assert.ok(app)
  const command = {
    id: "omarchy:remove.browser.firefox",
    type: "omarchy-command",
    kind: "action",
    title: "Firefox",
    breadcrumb: "Remove › Browser",
    description: "",
    route: "remove.browser.firefox",
    aliases: [],
    keywords: [],
    searchText: "firefox remove browser",
    providerPriority: 1,
    order: 0
  }
  const results = SearchEngine.search([command, app], "firefox")
  assert.equal(results[0].type, "application")
  assert.equal(results[1].type, "omarchy-command")
})

test("search results do not mutate provider records", () => {
  const records = AppIndex.buildApplicationRecords(entries)
  SearchEngine.search(records, "firefox")
  assert.equal(Object.hasOwn(records[0], "semanticTier"), false)
  assert.equal(Object.hasOwn(records[0], "semanticQuality"), false)
})
