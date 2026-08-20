#!/usr/bin/env node

const fs = require("node:fs")
const path = require("node:path")
const { performance } = require("node:perf_hooks")

const MenuIndex = require("../providers/MenuIndex.js")
const SearchEngine = require("../SearchEngine.js")
const StateModel = require("../services/StateModel.js")

const OPEN_BUDGET_MS = 100
const SEARCH_BUDGET_MS = 16
const omarchyPath = process.env.OMARCHY_PATH || "/usr/share/omarchy"
const defaultPath = path.join(omarchyPath, "default/omarchy/omarchy-menu.jsonc")

function readMenuRecords() {
  const parsed = MenuIndex.parseMenuJsonc(fs.readFileSync(defaultPath, "utf8"))
  if (parsed.error) throw new Error(parsed.error)
  const merged = MenuIndex.mergeMenuSources(parsed.items, [])
  return MenuIndex.buildCommandRecords(merged, {}, {})
}

function applicationRecords(count) {
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

const records = applicationRecords(250).concat(readMenuRecords())
const state = StateModel.emptyState()
const queries = [
  "benchmark application 249",
  "install development docker",
  "remove browser firefox",
  "update configuration",
  "zzzzzzzz"
]

for (let warmup = 0; warmup < 20; warmup += 1) {
  SearchEngine.search(records, queries[warmup % queries.length], { limit: 50 })
  StateModel.emptyStateRows(records, state)
}

const warmOpen = measure(100, () => StateModel.emptyStateRows(records, state))
const search = measure(200, index => {
  SearchEngine.search(records, queries[index % queries.length], { limit: 50 })
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
