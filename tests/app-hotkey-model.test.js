const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { execFileSync } = require("node:child_process")

const AppHotkeyModel = require("../providers/AppHotkeyModel.js")

test("hotkeys normalize aliases and require a safe global modifier", () => {
  assert.equal(AppHotkeyModel.normalizeHotkey("shift + meta + b"), "SUPER + SHIFT + B")
  assert.equal(AppHotkeyModel.normalizeHotkey("Control+Alt+Enter"), "CTRL + ALT + RETURN")
  assert.equal(AppHotkeyModel.normalizeHotkey("SUPER + SUPER + B"), "")
  assert.equal(AppHotkeyModel.normalizeHotkey("SUPER + B + C"), "")
  assert.equal(AppHotkeyModel.safeGlobalHotkey("SHIFT + B"), false)
  assert.equal(AppHotkeyModel.safeGlobalHotkey("CTRL + B"), true)
})

test("managed hotkey blocks preserve every unrelated user binding", () => {
  const original = [
    "-- My bindings",
    "o.bind(\"SUPER + R\", \"Launcher\", \"run-launcher\")",
    ""
  ].join("\n")
  const entries = AppHotkeyModel.setEntry({}, "org.mozilla.firefox", "Firefox", "SUPER + F")
  const updated = AppHotkeyModel.updateBindingsSource(original, entries)

  assert.ok(updated.startsWith(original.trimEnd()))
  assert.match(updated, /hl\.unbind\("SUPER \+ F"\)\no\.bind/)
  assert.deepEqual(AppHotkeyModel.parseManagedEntries(updated), entries)

  const removed = AppHotkeyModel.updateBindingsSource(updated, {})
  assert.equal(removed, original)
})

test("managed hotkeys remain last so confirmed overrides take effect", () => {
  const existing = [
    AppHotkeyModel.BEGIN_MARKER,
    '-- app: {"id":"old","title":"Old","hotkey":"SUPER + O"}',
    'hl.unbind("SUPER + O")',
    'o.bind("SUPER + O", "Old", "old")',
    AppHotkeyModel.END_MARKER,
    'o.bind("SUPER + X", "User binding", "user")',
    ""
  ].join("\n")
  const entries = AppHotkeyModel.setEntry({}, "new", "New", "SUPER + N")
  const updated = AppHotkeyModel.updateBindingsSource(existing, entries)

  assert.ok(updated.indexOf("User binding") < updated.indexOf(AppHotkeyModel.BEGIN_MARKER))
  assert.ok(updated.endsWith(AppHotkeyModel.END_MARKER + "\n"))
})

test("assigning an owned chord transfers it to only one application", () => {
  let entries = AppHotkeyModel.setEntry({}, "first", "First", "SUPER + 1")
  entries = AppHotkeyModel.setEntry(entries, "second", "Second", "SUPER + 1")
  assert.deepEqual(Object.keys(entries), ["second"])
  assert.equal(entries["second"].hotkey, "SUPER + 1")
})

test("generated Lua and shell command keep metadata literal", () => {
  const entries = AppHotkeyModel.setEntry(
    {},
    "odd'; touch never #",
    "Odd \"App\"\nName",
    "SUPER + O"
  )
  const block = AppHotkeyModel.managedBlock(entries)

  assert.match(block, /gtk-launch 'odd'\\\\''; touch never #\.desktop'/)
  assert.equal(block.includes("Odd \"App\"\nName"), false)
  assert.match(block, /Odd \\\"App\\\"\\nName/)
})

test("hyprctl binding JSON is converted to canonical conflict descriptions", () => {
  const rows = JSON.stringify([
    { modmask: 65, key: "b", description: "Open browser", dispatcher: "exec" },
    { modmask: 4, key: "RETURN", description: "Open terminal", dispatcher: "exec" }
  ])
  assert.equal(AppHotkeyModel.conflictDescription(rows, "SHIFT + SUPER + B"), "Open browser")
  assert.equal(AppHotkeyModel.conflictDescription(rows, "CTRL + RETURN"), "Open terminal")
  assert.equal(AppHotkeyModel.conflictDescription(rows, "SUPER + X"), "")
})

/** @param {string} directory @param {boolean} failAfterReload */
function makeHyprctlStub(directory, failAfterReload) {
  const executable = path.join(directory, "hyprctl")
  fs.writeFileSync(executable, [
    "#!/usr/bin/env bash",
    "set -eu",
    "printf '%s\\n' \"$1\" >> \"$HOTKEY_TEST_LOG\"",
    "if [[ $1 == configerrors ]]; then",
    "  count=$(grep -c '^configerrors$' \"$HOTKEY_TEST_LOG\")",
    failAfterReload ? "  [[ $count -lt 2 ]] || printf '%s\\n' 'test config error'" : "  :",
    "fi"
  ].join("\n"), { mode: 0o755 })
}

test("binding mutation backs up, reloads, and validates Hyprland", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omalauncher-hotkey-"))
  const bindings = path.join(temporaryRoot, "bindings.lua")
  const log = path.join(temporaryRoot, "hyprctl.log")
  fs.writeFileSync(bindings, "-- original\n")
  fs.writeFileSync(log, "")
  makeHyprctlStub(temporaryRoot, false)
  try {
    const request = AppHotkeyModel.mutationRequest(bindings, "-- original\n", "-- updated\n")
    execFileSync(request.command[0], request.command.slice(1), {
      env: { ...process.env, PATH: temporaryRoot + ":" + process.env["PATH"], HOTKEY_TEST_LOG: log }
    })
    assert.equal(fs.readFileSync(bindings, "utf8"), "-- updated\n")
    assert.equal(fs.readdirSync(temporaryRoot).filter(name => name.startsWith("bindings.lua.bak.")).length, 1)
    assert.deepEqual(fs.readFileSync(log, "utf8").trim().split("\n"), [
      "configerrors", "reload", "configerrors"
    ])
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  }
})

test("binding mutation restores its backup when validation reports an error", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omalauncher-hotkey-rollback-"))
  const bindings = path.join(temporaryRoot, "bindings.lua")
  const log = path.join(temporaryRoot, "hyprctl.log")
  fs.writeFileSync(bindings, "-- original\n")
  fs.writeFileSync(log, "")
  makeHyprctlStub(temporaryRoot, true)
  try {
    const request = AppHotkeyModel.mutationRequest(bindings, "-- original\n", "-- broken\n")
    assert.throws(() => execFileSync(request.command[0], request.command.slice(1), {
      stdio: "pipe",
      env: { ...process.env, PATH: temporaryRoot + ":" + process.env["PATH"], HOTKEY_TEST_LOG: log }
    }))
    assert.equal(fs.readFileSync(bindings, "utf8"), "-- original\n")
    assert.deepEqual(fs.readFileSync(log, "utf8").trim().split("\n"), [
      "configerrors", "reload", "configerrors", "reload"
    ])
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  }
})

test("binding mutation refuses to overwrite a concurrent user edit", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omalauncher-hotkey-race-"))
  const bindings = path.join(temporaryRoot, "bindings.lua")
  const log = path.join(temporaryRoot, "hyprctl.log")
  fs.writeFileSync(bindings, "-- user edited\n")
  fs.writeFileSync(log, "")
  makeHyprctlStub(temporaryRoot, false)
  try {
    const request = AppHotkeyModel.mutationRequest(bindings, "-- stale\n", "-- update\n")
    assert.throws(() => execFileSync(request.command[0], request.command.slice(1), {
      stdio: "pipe",
      env: { ...process.env, PATH: temporaryRoot + ":" + process.env["PATH"], HOTKEY_TEST_LOG: log }
    }))
    assert.equal(fs.readFileSync(bindings, "utf8"), "-- user edited\n")
    assert.equal(fs.readdirSync(temporaryRoot).some(name => name.startsWith("bindings.lua.bak.")), false)
    assert.deepEqual(fs.readFileSync(log, "utf8").trim().split("\n"), ["configerrors"])
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  }
})
