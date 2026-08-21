const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const projectRoot = path.resolve(__dirname, "..")

test("file open and reveal use literal argument arrays", () => {
  const launcher = fs.readFileSync(path.join(projectRoot, "Launcher.qml"), "utf8")
  assert.match(launcher, /execDetached\(\["xdg-open", path\]\)/)
  assert.match(launcher, /execDetached\(\["xdg-open", parent\]\)/)
})

test("file scans are debounced, bounded, cancelled, and never shell-built", () => {
  const provider = fs.readFileSync(path.join(projectRoot, "providers", "FileSearchProvider.qml"), "utf8")
  assert.match(provider, /interval: 120/)
  assert.match(provider, /interval: 1500/)
  assert.match(provider, /signal\(15\)/)
  assert.doesNotMatch(provider, /bash|sh -c/i)
})

test("the empty Files route teaches the root search shortcut", () => {
  const provider = fs.readFileSync(path.join(projectRoot, "providers", "FileSearchProvider.qml"), "utf8")
  assert.match(provider, /from Root Search type f report/)
})
