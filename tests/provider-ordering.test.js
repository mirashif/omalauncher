const test = require("node:test")
const assert = require("node:assert/strict")

const AppIndex = require("../providers/AppIndex.js")
const CommandCatalogModel = require("../providers/CommandCatalogModel.js")
const MenuIndex = require("../providers/MenuIndex.js")
const ShellPluginModel = require("../providers/ShellPluginModel.js")
const SearchEngine = require("../services/SearchEngine.js")

test("fully tied search results follow provider priority and expose their sections", () => {
  const application = AppIndex.buildApplicationRecords([
    { id: "test.desktop", name: "Test" }
  ])[0]

  const shellFeature = ShellPluginModel.buildRecords({
    "example.test": { name: "Test", kinds: ["overlay"] }
  }, {
    enabledIds: { "example.test": true }
  })[0]

  const parsedMenu = MenuIndex.parseMenuJsonc(`{
    "test": { "label": "Test", "action": "omarchy-test" }
  }`)
  assert.equal(parsedMenu.error, "")
  const mergedMenu = MenuIndex.mergeMenuSources(parsedMenu.items, [])
  const menuCommand = MenuIndex.buildCommandRecords(mergedMenu, {})[0]

  const cliCommand = CommandCatalogModel.buildRecords([
    { route: "omarchy test", binary: "omarchy-test", name: "test" }
  ])[0]

  const results = SearchEngine.search([
    cliCommand,
    menuCommand,
    shellFeature,
    application
  ], "test")

  assert.deepEqual(
    results.map(record => [record.type, record.section, record.providerPriority]),
    [
      ["application", "Applications", 0],
      ["shell-plugin", "Shell Features", 1],
      ["omarchy-command", "Omarchy Commands", 2],
      ["omarchy-cli", "Omarchy CLI", 3]
    ]
  )
})
