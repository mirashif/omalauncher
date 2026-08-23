// @ts-check

const test = require("node:test")
const assert = require("node:assert/strict")

const AppIndex = require("../src/AppIndex.js")
const SearchEngine = require("../src/SearchEngine.js")

const entries = [
  {
    id: "org.mozilla.firefox.desktop",
    name: "Firefox",
    genericName: "Web Browser",
    icon: "firefox",
    keywords: ["Internet", "Browser"]
  },
  {
    id: "code",
    name: "Visual Studio Code",
    genericName: "Text Editor",
    keywords: ["vscode"],
    categories: ["Development", "IDE"]
  },
  { id: "hidden", name: "Hidden", noDisplay: true }
]

test("desktop entries become stable application records", () => {
  const records = AppIndex.buildApplicationRecords(entries)
  assert.deepEqual(records.map(record => record.appId), [
    "org.mozilla.firefox",
    "code"
  ])
  assert.equal(records[0].description, "Web Browser")
})

test("search covers titles, metadata, and keywords", () => {
  const records = AppIndex.buildApplicationRecords(entries)
  assert.equal(SearchEngine.search(records, "firefox")[0].appId, "org.mozilla.firefox")
  assert.equal(SearchEngine.search(records, "web browser")[0].appId, "org.mozilla.firefox")
  assert.equal(SearchEngine.search(records, "vscode")[0].appId, "code")
})

test("exact titles rank above contextual matches without mutating records", () => {
  const records = AppIndex.buildApplicationRecords(entries)
  const contextual = Object.assign({}, records[1], {
    id: "command:firefox",
    type: "command",
    title: "Install browser",
    searchText: "install firefox browser",
    providerPriority: 1
  })
  const results = SearchEngine.search([contextual, records[0]], "firefox")
  assert.equal(results[0].id, "application:org.mozilla.firefox")
  assert.equal(Object.hasOwn(records[0], "semanticTier"), false)
})

test("search preserves camel-case word boundaries and fuzzy matching", () => {
  const records = AppIndex.buildApplicationRecords([{
    id: "org.example.modelUsage",
    name: "ModelUsage",
    keywords: ["tokens"]
  }])
  assert.equal(SearchEngine.search(records, "model usage")[0].appId, "org.example.modelUsage")
  assert.equal(SearchEngine.search(records, "mdl usg")[0].appId, "org.example.modelUsage")
})
