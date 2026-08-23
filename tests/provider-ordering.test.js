const test = require("node:test")
const assert = require("node:assert/strict")

const AppIndex = require("../shared/core/src/AppIndex.js")
const CommandCatalogModel = require("../providers/CommandCatalogModel.js")
const MenuIndex = require("../providers/MenuIndex.js")
const PluginCatalogModel = require("../shared/core/src/PluginCatalogModel.js")
const ShellPluginModel = require("../providers/ShellPluginModel.js")
const SearchEngine = require("../shared/core/src/SearchEngine.js")

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

test("an installed application outranks commands for an exact desktop keyword", () => {
  const application = AppIndex.buildApplicationRecords([
    {
      id: "code.desktop",
      name: "Visual Studio Code",
      genericName: "Text Editor",
      keywords: ["vscode"],
      categories: ["TextEditor", "Development", "IDE"]
    }
  ])[0]

  const parsedMenu = MenuIndex.parseMenuJsonc(`{
    "vscode": { "label": "VSCode", "action": "omarchy-default-editor vscode" }
  }`)
  assert.equal(parsedMenu.error, "")
  const mergedMenu = MenuIndex.mergeMenuSources(parsedMenu.items, [])
  const menuCommand = MenuIndex.buildCommandRecords(mergedMenu, {})[0]

  const cliCommand = CommandCatalogModel.buildRecords([
    {
      route: "omarchy install editor vscode",
      binary: "omarchy-install-editor-vscode",
      group: "install",
      name: "editor-vscode"
    }
  ])[0]

  const results = SearchEngine.search([menuCommand, cliCommand, application], "vscode")

  assert.deepEqual(
    results.map(record => record.type),
    ["application", "omarchy-command", "omarchy-cli"]
  )
})

test("root search puts OmaLauncher plugin navigation first for plugin and plugins", () => {
  const parsedMenu = MenuIndex.parseMenuJsonc(`{
    "setup": { "label": "Setup" },
    "setup.plugin": {
      "label": "Plugins",
      "aliases": ["plugin", "plugins"]
    },
    "setup.plugin.enable": {
      "label": "Enable Plugin",
      "action": "omarchy-menu-plugin enable"
    }
  }`)
  assert.equal(parsedMenu.error, "")
  const stockPlugins = MenuIndex.buildCommandRecords(
    MenuIndex.mergeMenuSources(parsedMenu.items, []), {})
    .find(record => record.route === "setup.plugin")
  assert.ok(stockPlugins)
  const records = [...PluginCatalogModel.rootSearchRecords(), stockPlugins]

  for (const query of ["plugin", "plugins"]) {
    const results = SearchEngine.search(records, query, {
      usage: {
        [stockPlugins.id]: { count: 10000, lastUsed: Date.now() }
      }
    })
    assert.equal(results[0].id, "plugin-catalog:search:browse", query)
  }
})
