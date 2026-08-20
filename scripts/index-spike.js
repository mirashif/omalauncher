#!/usr/bin/env node

const fs = require("node:fs")
const path = require("node:path")
const { execFileSync } = require("node:child_process")

const MenuIndex = require("../providers/MenuIndex.js")
const SearchEngine = require("../services/SearchEngine.js")

const omarchyPath = process.env["OMARCHY_PATH"] || "/usr/share/omarchy"
const userHome = process.env["HOME"] || ""
const defaultPath = path.join(omarchyPath, "default/omarchy/omarchy-menu.jsonc")
const userPath = path.join(userHome, ".config/omarchy/extensions/omarchy-menu.jsonc")
const includeUnavailable = process.argv.includes("--all")
const queries = process.argv.filter(argument => argument !== "--all").slice(2)
const requestedQueries = queries.length ? queries : [
  "install docker",
  "remove firefox",
  "update hyprland",
  "style screensaver",
  "browser default"
]

/**
 * @param {string} filePath
 * @param {boolean} required
 * @returns {import("../types/models").MenuSourceItem[]}
 */
function readSource(filePath, required) {
  try {
    const parsed = MenuIndex.parseMenuJsonc(fs.readFileSync(filePath, "utf8"))
    if (parsed.error) throw new Error(parsed.error)
    return parsed.items
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    if (required) throw new Error(`Could not read ${filePath}: ${detail}`)
    return []
  }
}

const merged = MenuIndex.mergeMenuSources(
  readSource(defaultPath, true),
  readSource(userPath, false)
)

/** @type {import("../types/models").BooleanMap} */
let whenResults = {}
if (!includeUnavailable) {
  const script = MenuIndex.guardScript(merged.items)
  if (script) {
    const output = execFileSync("bash", ["-lc", script], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 })
    whenResults = MenuIndex.parseGuardResults(output).when
  }
}

const records = MenuIndex.buildCommandRecords(merged, whenResults)
const actions = records.filter(record => record.kind === "action").length
const navigable = records.length - actions

console.log(`${records.length} ${includeUnavailable ? "static" : "visible"} records (${actions} actions, ${navigable} menus/links)`)
for (const query of requestedQueries) {
  const results = SearchEngine.search(records, query, { limit: 3 })
  console.log(`\n${query}`)
  if (!results.length) {
    console.log("  no visible result")
    continue
  }
  for (const result of results) {
    const context = result.breadcrumb ? ` — ${result.breadcrumb}` : ""
    console.log(`  [tier ${result.semanticTier}] ${result.title}${context} (${result.route})`)
  }
}
