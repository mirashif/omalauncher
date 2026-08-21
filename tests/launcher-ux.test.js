const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const projectRoot = path.resolve(__dirname, "..")

test("search selection uses the theme selected-state contrast pair", () => {
  const launcher = fs.readFileSync(path.join(projectRoot, "Launcher.qml"), "utf8")
  const searchInput = /TextInput \{\s*id: searchInput[\s\S]*?Accessible\.role: Accessible\.EditableText/.exec(launcher)

  assert.ok(searchInput)
  assert.match(searchInput[0], /selectionColor: root\.selectedBackground/)
  assert.match(searchInput[0], /selectedTextColor: root\.selectedText/)
})

test("up and down rotate through search results instead of query history", () => {
  const launcher = fs.readFileSync(path.join(projectRoot, "Launcher.qml"), "utf8")
  const searchInput = /TextInput \{\s*id: searchInput[\s\S]*?Keys\.onPressed: function\(event\) \{([\s\S]*?)\n\s*\}\n\s*\}/.exec(launcher)

  assert.ok(searchInput)
  assert.match(searchInput[1], /event\.key === Qt\.Key_Up[\s\S]*?root\.moveSelection\(-1\)/)
  assert.match(searchInput[1], /event\.key === Qt\.Key_Down[\s\S]*?root\.moveSelection\(1\)/)
  assert.doesNotMatch(searchInput[1], /cycleQueryHistory/)
})

test("new installations place the launcher widget on the right", () => {
  const manifest = fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8")
  assert.match(manifest, /"barWidget"\s*:\s*\{[\s\S]*?"defaultSection"\s*:\s*"right"/)
})

test("Calculate is discoverable and starts an equals-prefixed expression", () => {
  const launcher = fs.readFileSync(path.join(projectRoot, "Launcher.qml"), "utf8")

  assert.match(launcher, /kind: "open-calculator"[\s\S]*?"Start with = · Example: = 12 \* 8"/)
  assert.match(launcher, /kind: "open-calculator"[\s\S]*?breadcrumb: ""/)
  assert.match(launcher, /if \(row\.resultKind === "open-calculator"\) \{[\s\S]*?setSearchTextSilently\("= "\)/)
  assert.match(launcher, /if \(row\.resultKind === "open-calculator"\) return "Start Calculating"/)
  assert.match(launcher, /row\.resultKind === "calculator-ready"/)
})

test("suggested folders add immediately from root search", () => {
  const launcher = fs.readFileSync(path.join(projectRoot, "Launcher.qml"), "utf8")
  const suggestedScopeAction = /if \(row\.resultKind === "settings-add-suggested-scope"\) \{([\s\S]*?)\n\s*\}/.exec(launcher)

  assert.ok(suggestedScopeAction)
  assert.match(suggestedScopeAction[1], /validateSettingsScope\(row\.settingValue, true\)/)
  assert.equal((launcher.match(/SettingsModel\.scopeValidationApplies/g) || []).length, 2)
})
