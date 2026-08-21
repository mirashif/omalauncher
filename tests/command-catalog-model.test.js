const test = require("node:test")
const assert = require("node:assert/strict")

const CommandCatalogModel = require("../providers/CommandCatalogModel.js")
const SearchEngine = require("../services/SearchEngine.js")

/** @param {unknown} commands @returns {string} */
function catalog(commands) {
  return JSON.stringify({ ok: true, commands })
}

test("CLI catalog parsing validates the envelope and command identity", () => {
  const parsed = CommandCatalogModel.parseCatalog(catalog([
    { route: "omarchy menu clipboard", binary: "omarchy-menu-clipboard" },
    { route: "not-omarchy unsafe", binary: "unsafe" },
    null
  ]))

  assert.equal(parsed.error, "")
  assert.equal(parsed.commands.length, 1)
  assert.match(CommandCatalogModel.parseCatalog("{broken").error, /invalid JSON/)
  assert.match(CommandCatalogModel.parseCatalog(JSON.stringify({ commands: [] })).error, /unsupported shape/)
})

test("only reviewed context-free CLI routes execute directly", () => {
  const commands = [
    {
      route: "omarchy menu clipboard",
      binary: "omarchy-menu-clipboard",
      group: "menu",
      name: "clipboard",
      summary: "Open clipboard history",
      requires_sudo: false,
      args: "",
      aliases: ["omarchy menu clip"]
    },
    {
      route: "omarchy install package",
      binary: "omarchy-install-package",
      group: "install",
      name: "package",
      summary: "Install a package",
      requires_sudo: false,
      args: "<package>"
    },
    {
      route: "omarchy system foo",
      binary: "omarchy-system-foo",
      group: "system",
      name: "foo",
      summary: "Privileged command",
      requires_sudo: true,
      args: ""
    }
  ]
  const records = CommandCatalogModel.buildRecords(commands)

  assert.deepEqual(records.map(record => record.executionKind), ["cli-direct", "cli-help", "cli-help"])
  assert.equal(records[0].title, "Clipboard Manager")
  assert.deepEqual(JSON.parse(records[0].commandArgvJson), ["omarchy", "menu", "clipboard"])
  assert.equal(records.every(record => record.emptyVisible === false), true)
  assert.equal(SearchEngine.search(records, "menu clip")[0].commandRoute, "omarchy menu clipboard")
})

test("hidden CLI commands stay out of the launcher", () => {
  const records = CommandCatalogModel.buildRecords([
    { route: "omarchy visible", binary: "omarchy-visible", name: "visible" },
    { route: "omarchy hidden", binary: "omarchy-hidden", name: "hidden", hidden: true }
  ])

  assert.deepEqual(records.map(record => record.commandRoute), ["omarchy visible"])
})

test("the catalog exposes the supported coding-agent picker variant", () => {
  const records = CommandCatalogModel.buildRecords([{
    route: "omarchy agent",
    binary: "omarchy-agent",
    group: "agent",
    name: "",
    summary: "Launch the default coding agent",
    args: "[--inline] [--pick]"
  }])

  assert.deepEqual(records.map(record => record.commandRoute), [
    "omarchy agent",
    "omarchy agent --pick"
  ])
  assert.equal(records[1].title, "Choose Coding Agent")
  assert.equal(records[1].emptyVisible, true)
  assert.deepEqual(JSON.parse(records[1].commandArgvJson), ["omarchy", "agent", "--pick"])
})

test("supported coding-agent names find the agent picker", () => {
  const records = CommandCatalogModel.buildRecords([
    {
      route: "omarchy agent",
      binary: "omarchy-agent",
      group: "agent",
      summary: "Launch the default coding agent",
      args: "[--inline] [--pick]"
    },
    {
      route: "omarchy default agent",
      binary: "omarchy-default-agent",
      group: "default",
      name: "agent",
      summary: "Set and launch the default coding agent",
      args: "[codex|future-agent]"
    }
  ])

  assert.equal(SearchEngine.search(records, "codex")[0].commandRoute, "omarchy agent --pick")
  assert.equal(SearchEngine.search(records, "future agent")[0].commandRoute, "omarchy agent --pick")
})
