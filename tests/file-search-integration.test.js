const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const FileSearchModel = require("../providers/FileSearchModel.js")

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

const fdPath = executable("fd")
const realpathPath = executable("realpath")

test("fd integration respects hidden files, ignores, caps, unusual names, and canonical scopes", {
  skip: !fdPath || !realpathPath
}, () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "omalauncher-files-"))
  const scope = path.join(fixture, "scope")
  const outside = path.join(fixture, "outside")
  try {
    fs.mkdirSync(path.join(scope, "docs"), { recursive: true })
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
    const command = FileSearchModel.commandArguments(fdPath, "report", [canonicalScope], ["node_modules"], 2)
    const raw = runNul(command)
    assert.equal(raw.length <= 2, true)
    assert.equal(raw.some(value => value.includes("node_modules")), false)
    assert.equal(raw.some(value => value.includes(".secret-report")), false)

    const candidates = raw.concat([
      path.join(scope, "outside-link.txt"),
      path.join(scope, "escape", "outside-report.txt")
    ])
    const canonical = runNul(FileSearchModel.canonicalizeArguments(realpathPath, candidates, 100))
    const records = FileSearchModel.recordsForPaths(canonical, "report", [canonicalScope], 100)
    assert.equal(records.length > 0, true)
    assert.equal(records.every(record => record.filePath.indexOf(canonicalScope + path.sep) === 0), true)
    assert.equal(records.some(record => record.filePath.includes("outside-report")), false)

    const unusual = runNul(FileSearchModel.commandArguments(
      fdPath, "final", [canonicalScope], ["node_modules"], 100))
    assert.equal(unusual.some(value => value.endsWith("My File [final].md")), true)
    assert.equal(unusual.some(value => value.endsWith("Trailing final.txt ")), true)
    const unusualCanonical = runNul(FileSearchModel.canonicalizeArguments(
      realpathPath, unusual, 100))
    assert.equal(FileSearchModel.recordsForPaths(
      unusualCanonical, "final", [canonicalScope], 100).some(record => record.title === "Trailing final.txt "), true)
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true })
  }
})
