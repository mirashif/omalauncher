const test = require("node:test")
const assert = require("node:assert/strict")

const SourceMergeModel = require("../providers/SourceMergeModel.js")

test("source merge keeps provider order and removes menu/plugin/CLI duplicates", () => {
  const applications = [{ id: "app" }]
  const menuRecords = [{ id: "menu" }]
  const pluginRecords = [
    {
      id: "clipboard-plugin",
      sourcePluginId: "omarchy.clipboard",
      menuBinaries: [],
      coveredCommandRoutes: ["omarchy menu clipboard"]
    },
    {
      id: "emoji-plugin",
      sourcePluginId: "omarchy.emojis",
      menuBinaries: ["omarchy-menu-emoji"],
      coveredCommandRoutes: ["omarchy menu emoji"]
    },
    {
      id: "speed-plugin",
      sourcePluginId: "omarchy.speedtest",
      menuBinaries: [],
      coveredCommandRoutes: []
    }
  ]
  const cliRecords = [
    { id: "clipboard-cli", commandBinary: "omarchy-menu-clipboard", commandRoute: "omarchy menu clipboard" },
    { id: "emoji-cli", commandBinary: "omarchy-menu-emoji", commandRoute: "omarchy menu emoji" },
    { id: "update-cli", commandBinary: "omarchy-update", commandRoute: "omarchy update" },
    { id: "unique-cli", commandBinary: "omarchy-unique", commandRoute: "omarchy unique" }
  ]
  const menuItems = [
    { action: "omarchy-menu-emoji" },
    { action: "omarchy-shell shell summon omarchy.speedtest" },
    { action: "omarchy-update" }
  ]

  const merged = SourceMergeModel.mergeSources({
    applications,
    menuRecords,
    pluginRecords,
    cliRecords,
    menuItems
  })

  assert.deepEqual(merged.map(record => record.id), ["app", "menu", "clipboard-plugin", "unique-cli"])
})

test("menu coverage extracts exact command binaries and plugin ids from compound actions", () => {
  const coverage = SourceMergeModel.menuCoverage([
    { action: "uwsm-app -- omarchy-menu-foo && omarchy-shell shell summon example.panel" }
  ])

  assert.equal(coverage.binaries["omarchy-menu-foo"], true)
  assert.equal(coverage.binaries["omarchy-shell"], undefined)
  assert.equal(coverage.pluginIds["example.panel"], true)
})

test("a plugin-specific IPC action does not hide the plugin's full panel", () => {
  const merged = SourceMergeModel.mergeSources({
    menuRecords: [{ id: "battery", sourceAction: "omarchy-shell omarchy.power togglePercentage" }],
    menuItems: [{ sourceAction: "omarchy-shell omarchy.power togglePercentage" }],
    pluginRecords: [{
      id: "power-panel",
      sourcePluginId: "omarchy.power",
      menuBinaries: [],
      coveredCommandRoutes: []
    }]
  })

  assert.deepEqual(merged.map(record => record.id), ["battery", "power-panel"])
})
