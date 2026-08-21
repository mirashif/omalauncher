const test = require("node:test")
const assert = require("node:assert/strict")

const FileSearchModel = require("../providers/FileSearchModel.js")
const GenerationModel = require("../services/GenerationModel.js")

test("file mode is explicit at root and implicit inside the Files route", () => {
  assert.deepEqual(FileSearchModel.queryRequest("f report.pdf", false), {
    active: true,
    query: "report.pdf",
    explicit: true
  })
  assert.equal(FileSearchModel.queryRequest("firefox", false).active, false)
  assert.deepEqual(FileSearchModel.queryRequest("report", true), {
    active: true,
    query: "report",
    explicit: false
  })
})

test("fd command construction keeps queries and scopes as literal arguments", () => {
  const command = FileSearchModel.commandArguments("/usr/bin/fd", "-e sh; touch /tmp/nope", [
    "/home/test/Documents",
    "/",
    "relative"
  ], ["node_modules", "*.tmp"], 100)

  assert.equal(command[0], "/usr/bin/fd")
  assert.equal(command.includes("--fixed-strings"), true)
  assert.deepEqual(command.slice(-2), ["--", "-e sh; touch /tmp/nope"])
  assert.equal(command.filter(value => value === "--search-path").length, 1)
  assert.equal(command.includes("/"), false)

  const canonical = FileSearchModel.canonicalizeArguments("/usr/bin/realpath", [
    "/home/test/Documents/My File.md",
    "/home/test/Documents/-literal"
  ], 100)
  assert.deepEqual(canonical, [
    "/usr/bin/realpath", "-e", "-z", "--",
    "/home/test/Documents/My File.md", "/home/test/Documents/-literal"
  ])
})

test("file results cannot cross configured scope boundaries", () => {
  const scopes = ["/home/test/Documents", "/home/test/Documents/work"]
  assert.equal(FileSearchModel.scopeForPath("/home/test/Documents/report.md", scopes), "/home/test/Documents")
  assert.equal(FileSearchModel.scopeForPath("/home/test/Documents/work/app.js", scopes), "/home/test/Documents/work")
  assert.equal(FileSearchModel.scopeForPath("/home/test/Documents-archive/report.md", scopes), "")
  assert.equal(FileSearchModel.scopeForPath("/etc/passwd", scopes), "")
})

test("file records deduplicate, rank basenames first, and reject outside paths", () => {
  const rows = FileSearchModel.recordsForPaths([
    "/home/test/Documents/archive/report-old.md",
    "/etc/report-secret",
    "/home/test/Documents/report.md",
    "/home/test/Documents/report.md",
    "/home/test/Documents/work/my-report.md"
  ], "report", ["/home/test/Documents"], 10)

  assert.deepEqual(rows.map(row => row.title), ["report.md", "report-old.md", "my-report.md"])
  assert.equal(rows.every(row => row.filePath.indexOf("/home/test/Documents/") === 0), true)
  assert.equal(rows[0].fileScope, "/home/test/Documents")
  assert.equal(rows[0].id, "file:/home/test/Documents:report.md")
  assert.equal(rows[2].breadcrumb, "Documents › work")
})

test("file helpers preserve unusual names and derive safe parent paths", () => {
  const path = "/home/test/Documents/My File [final].md"
  assert.equal(FileSearchModel.basename(path), "My File [final].md")
  assert.equal(FileSearchModel.parentPath(path), "/home/test/Documents")
  assert.equal(FileSearchModel.recordsForPaths([path], "final", ["/home/test/Documents"], 10)[0].title,
    "My File [final].md")
})

test("file search exposes bounded provider status and management records", () => {
  const unavailable = FileSearchModel.statusRecord(
    "unavailable", "File Search Unavailable", "Install fd", "settings")
  assert.equal(unavailable.route, "settings")
  assert.equal(unavailable.breadcrumb, "")
  assert.equal(FileSearchModel.statusRecord(
    "error", "File Search Timed Out", "Timed out", "").kind, "file-search-error")
  assert.equal(FileSearchModel.managementRecord(false, 0).description,
    "Enable in Settings · Root shortcut: f report.pdf")
  assert.equal(FileSearchModel.managementRecord(true, 2).description,
    "2 configured scopes · Root shortcut: f report.pdf")
  assert.equal(FileSearchModel.managementRecord(true, 2).breadcrumb, "")
})

test("superseded file searches cannot apply their late output", () => {
  const firstGeneration = GenerationModel.next(0)
  const secondGeneration = GenerationModel.next(firstGeneration)
  assert.equal(GenerationModel.completion(firstGeneration, secondGeneration, false).apply, false)
  assert.equal(GenerationModel.completion(secondGeneration, secondGeneration, false).apply, true)
})
