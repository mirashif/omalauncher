#!/usr/bin/env node

const fs = require("node:fs")
const path = require("node:path")
const { execFileSync } = require("node:child_process")
const { performance } = require("node:perf_hooks")

const MenuIndex = require("../providers/MenuIndex.js")
const CommandCatalogModel = require("../providers/CommandCatalogModel.js")
const SourceMergeModel = require("../providers/SourceMergeModel.js")
const SearchEngine = require("../services/SearchEngine.js")
const StateModel = require("../services/StateModel.js")

const OPEN_BUDGET_MS = 100
const SEARCH_BUDGET_MS = 16
const omarchyPath = process.env["OMARCHY_PATH"] || "/usr/share/omarchy"
const defaultPath = path.join(omarchyPath, "default/omarchy/omarchy-menu.jsonc")

function readMenuRecords() {
  const parsed = MenuIndex.parseMenuJsonc(fs.readFileSync(defaultPath, "utf8"))
  if (parsed.error) throw new Error(parsed.error)
  const merged = MenuIndex.mergeMenuSources(parsed.items, [])
  return MenuIndex.buildCommandRecords(merged, {}, {})
}

function readCliRecords() {
  const raw = execFileSync("omarchy", ["commands", "--json"], { encoding: "utf8" })
  const parsed = CommandCatalogModel.parseCatalog(raw)
  if (parsed.error) throw new Error(parsed.error)
  return CommandCatalogModel.buildRecords(parsed.commands)
}

/**
 * @param {number} count
 * @returns {import("../types/models").SearchableRecord[]}
 */
function applicationRecords(count) {
  /** @type {import("../types/models").SearchableRecord[]} */
  const records = []
  for (let index = 0; index < count; index += 1) {
    records.push({
      id: `benchmark.app.${index}`,
      type: "application",
      title: `Benchmark Application ${index}`,
      breadcrumb: "Applications › Development",
      description: `Representative desktop application number ${index}`,
      keywords: ["benchmark", "development", String(index)],
      aliases: [],
      route: "",
      order: index,
      providerPriority: 0,
      searchText: `benchmark application ${index} applications development representative desktop`
    })
  }
  return records
}

/**
 * @param {number} iterations
 * @param {(index: number) => void} operation
 * @returns {{averageMs: number, worstMs: number}}
 */
function measure(iterations, operation) {
  let worst = 0
  let total = 0
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now()
    operation(index)
    const duration = performance.now() - started
    total += duration
    worst = Math.max(worst, duration)
  }
  return { averageMs: total / iterations, worstMs: worst }
}

const menuRecords = readMenuRecords()
const records = SourceMergeModel.mergeSources({
  applications: applicationRecords(250),
  menuRecords,
  pluginRecords: [],
  cliRecords: readCliRecords(),
  menuItems: menuRecords
})
const preparedRecords = records.map(record => SearchEngine.prepareRecord({
  ...record,
  aliases: Array.isArray(record.aliases) ? record.aliases.slice() : [],
  keywords: Array.isArray(record.keywords) ? record.keywords.slice() : []
}))
const state = StateModel.emptyState()
const queries = [
  "benchmark application 249",
  "install development docker",
  "remove browser firefox",
  "update configuration",
  "audio input mute",
  "doctor troubleshoot",
  "zzzzzzzz"
]

for (let warmup = 0; warmup < 20; warmup += 1) {
  SearchEngine.search(preparedRecords, String(queries[warmup % queries.length] || ""), { limit: 50 })
  StateModel.emptyStateRows(records, state)
}

const warmOpen = measure(100, () => StateModel.emptyStateRows(records, state))
const search = measure(200, index => {
  SearchEngine.search(preparedRecords, String(queries[index % queries.length] || ""), { limit: 50 })
})

const result = {
  records: records.length,
  budgets: { warmOpenMs: OPEN_BUDGET_MS, searchUpdateMs: SEARCH_BUDGET_MS },
  warmOpen,
  search,
  pass: warmOpen.worstMs <= OPEN_BUDGET_MS && search.worstMs <= SEARCH_BUDGET_MS
}

console.log(JSON.stringify(result, null, 2))
if (!result.pass) process.exitCode = 1
