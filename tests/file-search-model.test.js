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

test("find command construction keeps queries and scopes as literal arguments", () => {
  const command = FileSearchModel.commandArguments("/usr/bin/find", "-e sh; touch /tmp/nope", [
    "/home/test/Documents",
    "/",
    "relative"
  ], ["node_modules", "*.tmp"], 100)

  assert.equal(command[0], "/usr/bin/find")
  assert.equal(command[1], "/home/test/Documents")
  assert.equal(command.includes("*-e sh; touch /tmp/nope*"), true)
  assert.equal(command.includes("node_modules"), true)
  assert.equal(command.includes(".*"), true)
  assert.equal(command.includes("-printf"), true)
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

test("find output retains whether a result is a regular folder", () => {
  assert.deepEqual(FileSearchModel.searchEntry("f:/home/test/Documents/report.md"), {
    path: "/home/test/Documents/report.md",
    isDirectory: false
  })
  assert.deepEqual(FileSearchModel.searchEntry("d:/home/test/Documents/Reports"), {
    path: "/home/test/Documents/Reports",
    isDirectory: true
  })
  assert.equal(FileSearchModel.searchEntry("l:/home/test/Documents/link"), null)
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

test("file records include ordinary folders with folder affordances", () => {
  const rows = FileSearchModel.recordsForPaths([
    { path: "/home/test/Documents/Reports", isDirectory: true },
    { path: "/home/test/Documents/report.md", isDirectory: false }
  ], "report", ["/home/test/Documents"], 10)

  assert.deepEqual(rows.map(row => row.kind).sort(), ["file", "folder"])
  const folder = rows.find(row => row.kind === "folder")
  assert.ok(folder)
  assert.equal(folder.icon, "󰉋")
})

test("file helpers preserve unusual names and derive safe parent paths", () => {
  const path = "/home/test/Documents/My File [final].md"
  assert.equal(FileSearchModel.basename(path), "My File [final].md")
  assert.equal(FileSearchModel.parentPath(path), "/home/test/Documents")
  assert.equal(FileSearchModel.recordsForPaths([path], "final", ["/home/test/Documents"], 10)[0].title,
    "My File [final].md")
})

test("file search exposes bounded provider status and management records", () => {
  const disabled = FileSearchModel.statusRecord(
    "disabled", "File Search Disabled", "Enable in Settings", "settings")
  assert.equal(disabled.route, "settings")
  assert.equal(disabled.breadcrumb, "")
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
