const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const FileSearchModel = require("../providers/FileSearchModel.js")

/** @param {string[]} values @returns {import("../types/models").FileCandidate[]} */
function searchEntries(values) {
  /** @type {import("../types/models").FileCandidate[]} */
  const entries = []
  for (const value of values) {
    const entry = FileSearchModel.searchEntry(value)
    if (entry) entries.push(entry)
  }
  return entries
}

/** @param {string} name @returns {string} */
function executable(name) {
  const result = spawnSync("which", [name], { encoding: "utf8" })
  return result.status === 0 ? String(result.stdout || "").trim() : ""
}

/** @param {string[]} command @returns {string[]} */
function runNul(command) {
  const result = spawnSync(command[0], command.slice(1), {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024
  })
  assert.equal(result.status, 0, String(result.stderr || ""))
  return String(result.stdout || "").split("\0").filter(Boolean)
}

const findPath = executable("find")
const realpathPath = executable("realpath")
const findVersion = findPath ? spawnSync(findPath, ["--version"], { encoding: "utf8" }) : null
const gnuFind = !!findVersion && findVersion.status === 0 && /GNU findutils/.test(String(findVersion.stdout || ""))

test("find integration returns files and folders while respecting defaults, caps, and scopes", {
  skip: !gnuFind || !realpathPath
}, () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "omalauncher-files-"))
  const scope = path.join(fixture, "scope")
  const outside = path.join(fixture, "outside")
  try {
    fs.mkdirSync(path.join(scope, "docs"), { recursive: true })
    fs.mkdirSync(path.join(scope, "report-folder"), { recursive: true })
    fs.mkdirSync(path.join(scope, "node_modules"), { recursive: true })
    fs.mkdirSync(outside, { recursive: true })
    fs.writeFileSync(path.join(scope, "docs", "report.txt"), "visible")
    fs.writeFileSync(path.join(scope, "docs", "report-2.txt"), "visible")
    fs.writeFileSync(path.join(scope, "docs", "report-3.txt"), "visible")
    fs.writeFileSync(path.join(scope, "node_modules", "report.js"), "ignored")
    fs.writeFileSync(path.join(scope, ".secret-report.txt"), "hidden")
    fs.writeFileSync(path.join(scope, "My File [final].md"), "unusual")
    fs.writeFileSync(path.join(scope, "Trailing final.txt "), "unusual")
    fs.writeFileSync(path.join(outside, "outside-report.txt"), "outside")
    fs.symlinkSync(path.join(outside, "outside-report.txt"), path.join(scope, "outside-link.txt"))
    fs.symlinkSync(outside, path.join(scope, "escape"))

    const canonicalScope = fs.realpathSync(scope)
    const command = FileSearchModel.commandArguments(findPath, "report", [canonicalScope], ["node_modules"], 2)
    const raw = searchEntries(runNul(command)).slice(0, 2)
    assert.equal(raw.length <= 2, true)
    assert.equal(raw.some(value => value.path.includes("node_modules")), false)
    assert.equal(raw.some(value => value.path.includes(".secret-report")), false)

    const candidates = raw.concat([
      { path: path.join(scope, "outside-link.txt"), isDirectory: false },
      { path: path.join(scope, "escape", "outside-report.txt"), isDirectory: false }
    ])
    const canonical = runNul(FileSearchModel.canonicalizeArguments(
      realpathPath, candidates.map(entry => entry.path), 100))
    const records = FileSearchModel.recordsForPaths(
      FileSearchModel.canonicalEntries(canonical, candidates), "report", [canonicalScope], 100)
    assert.equal(records.length > 0, true)
    assert.equal(records.every(record => record.filePath.indexOf(canonicalScope + path.sep) === 0), true)
    assert.equal(records.some(record => record.filePath.includes("outside-report")), false)

    const unusual = runNul(FileSearchModel.commandArguments(
      findPath, "final", [canonicalScope], ["node_modules"], 100))
    const unusualEntries = searchEntries(unusual)
    assert.equal(unusualEntries.some(value => value.path.endsWith("My File [final].md")), true)
    assert.equal(unusualEntries.some(value => value.path.endsWith("Trailing final.txt ")), true)
    const unusualCanonical = runNul(FileSearchModel.canonicalizeArguments(
      realpathPath, unusualEntries.map(entry => entry.path), 100))
    assert.equal(FileSearchModel.recordsForPaths(
      FileSearchModel.canonicalEntries(unusualCanonical, unusualEntries),
      "final", [canonicalScope], 100).some(record => record.title === "Trailing final.txt "), true)
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true })
  }
})
