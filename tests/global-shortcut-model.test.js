const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { execFileSync } = require("node:child_process")

const GlobalShortcutModel = require("../providers/GlobalShortcutModel.js")

/** @param {string} appId @param {string} title */
function applicationTarget(appId, title) {
  return GlobalShortcutModel.targetForResult({
    id: "application:" + appId,
    type: "application",
    kind: "application",
    appId,
    title
  })
}

/**
 * @param {import("../types/models").GlobalShortcutMap} entries
 * @param {string} appId
 * @param {string} title
 * @param {string} hotkey
 */
function setApplication(entries, appId, title, hotkey) {
  return GlobalShortcutModel.setEntry(
    entries, applicationTarget(appId, title), hotkey)
}

test("hotkeys normalize aliases and require a safe global modifier", () => {
  assert.equal(GlobalShortcutModel.normalizeHotkey("shift + meta + b"), "SUPER + SHIFT + B")
  assert.equal(GlobalShortcutModel.normalizeHotkey("Control+Alt+Enter"), "CTRL + ALT + RETURN")
  assert.equal(GlobalShortcutModel.normalizeHotkey("SUPER + SUPER + B"), "")
  assert.equal(GlobalShortcutModel.normalizeHotkey("SUPER + B + C"), "")
  assert.equal(GlobalShortcutModel.safeGlobalHotkey("SHIFT + B"), false)
  assert.equal(GlobalShortcutModel.safeGlobalHotkey("CTRL + B"), true)
})

test("stable actionable results become typed shortcut targets", () => {
  assert.deepEqual(applicationTarget("org.mozilla.firefox", "Firefox"), {
    key: "application:org.mozilla.firefox",
    kind: "application",
    title: "Firefox",
    appId: "org.mozilla.firefox"
  })
  assert.deepEqual(GlobalShortcutModel.targetForResult({
    id: "shell-plugin:omarchy.clipboard",
    type: "shell-plugin",
    executionKind: "shell-plugin",
    sourcePluginId: "omarchy.clipboard",
    shellPayloadJson: "{}",
    title: "Clipboard"
  }), {
    key: "shell-plugin:omarchy.clipboard",
    kind: "shell-plugin",
    title: "Clipboard",
    pluginId: "omarchy.clipboard",
    payloadJson: "{}"
  })
  assert.deepEqual(GlobalShortcutModel.targetForResult({
    id: "omarchy:trigger.capture",
    type: "omarchy-command",
    kind: "menu",
    route: "trigger.capture",
    title: "Capture"
  }), {
    key: "omarchy:trigger.capture",
    kind: "menu",
    title: "Capture",
    route: "trigger.capture"
  })
  assert.deepEqual(GlobalShortcutModel.targetForResult({
    id: "omarchy-cli:omarchy-refresh-browser",
    type: "omarchy-cli",
    executionKind: "cli-direct",
    commandArgvJson: '["omarchy","refresh","browser"]',
    commandRoute: "omarchy refresh browser",
    requiresSudo: false,
    title: "Refresh Browser"
  }), {
    key: "omarchy-cli:omarchy-refresh-browser",
    kind: "cli",
    title: "Refresh Browser",
    argv: ["omarchy", "refresh", "browser"]
  })
  assert.deepEqual(GlobalShortcutModel.targetForResult({
    id: "plugin-catalog:search:discover",
    type: "plugin-catalog",
    kind: "plugin-open-route",
    targetRoute: "plugins-available",
    title: "Discover Plugins"
  }), {
    key: "plugin-catalog:search:discover",
    kind: "launcher",
    title: "Discover Plugins",
    payloadJson: '{"source":"hotkey","route":"plugins-available"}'
  })
  assert.deepEqual(GlobalShortcutModel.targetForResult({
    id: "omalauncher:calculate",
    type: "launcher-command",
    kind: "open-calculator",
    title: "Calculate"
  }), {
    key: "omalauncher:calculate",
    kind: "launcher",
    title: "Calculate",
    payloadJson: '{"source":"hotkey","query":"= "}'
  })
})

test("transient, destructive, and contextual rows cannot own shortcuts", () => {
  assert.equal(GlobalShortcutModel.targetForResult({
    id: "file:/tmp/report", type: "file", kind: "file", filePath: "/tmp/report", title: "report"
  }), null)
  assert.equal(GlobalShortcutModel.targetForResult({
    id: "calculator:2+2", type: "calculator", kind: "calculator", title: "4"
  }), null)
  assert.equal(GlobalShortcutModel.targetForResult({
    id: "plugin-catalog:action:remove:example", type: "plugin-catalog",
    kind: "plugin-action", settingKey: "remove", title: "Remove Plugin"
  }), null)
  assert.equal(GlobalShortcutModel.targetForResult({
    id: "omalauncher:setting-compact", type: "setting", kind: "settings-toggle",
    title: "Compact Mode"
  }), null)
  assert.equal(GlobalShortcutModel.targetForResult({
    id: "omarchy-cli:unsafe", type: "omarchy-cli", executionKind: "cli-help",
    commandArgvJson: '["omarchy","unsafe"]', commandRoute: "omarchy unsafe", title: "Unsafe"
  }), null)
})

test("shortcut commands are generated only from validated structured targets", () => {
  assert.equal(GlobalShortcutModel.commandForTarget(applicationTarget("firefox", "Firefox")),
    "uwsm-app -- gtk-launch 'firefox.desktop'")
  assert.equal(GlobalShortcutModel.commandForTarget(GlobalShortcutModel.targetForResult({
    id: "shell-plugin:omarchy.clipboard", type: "shell-plugin", executionKind: "shell-plugin",
    sourcePluginId: "omarchy.clipboard", shellPayloadJson: '{"view":"history"}', title: "Clipboard"
  })), "omarchy-shell shell summon 'omarchy.clipboard' '{\"view\":\"history\"}'")
  assert.equal(GlobalShortcutModel.commandForTarget(GlobalShortcutModel.targetForResult({
    id: "omarchy:trigger.capture", type: "omarchy-command", kind: "menu",
    route: "trigger.capture", title: "Capture"
  })), "omarchy menu summon 'trigger.capture'")
  assert.equal(GlobalShortcutModel.commandForTarget(GlobalShortcutModel.targetForResult({
    id: "omarchy-cli:test", type: "omarchy-cli", executionKind: "cli-direct",
    commandArgvJson: '["omarchy","test"]', commandRoute: "omarchy test", title: "Test"
  })), "'omarchy' 'test'")
})

test("managed hotkey blocks preserve every unrelated user binding", () => {
  const original = [
    "-- My bindings",
    "o.bind(\"SUPER + R\", \"Launcher\", \"run-launcher\")",
    ""
  ].join("\n")
  const entries = setApplication({}, "org.mozilla.firefox", "Firefox", "SUPER + F")
  const updated = GlobalShortcutModel.updateBindingsSource(original, entries)

  assert.ok(updated.startsWith(original.trimEnd()))
  assert.match(updated, /hl\.unbind\("SUPER \+ F"\)\no\.bind/)
  assert.deepEqual(GlobalShortcutModel.parseManagedEntries(updated), entries)

  const removed = GlobalShortcutModel.updateBindingsSource(updated, {})
  assert.equal(removed, original)
})

test("launcher and application hotkeys share one managed block", () => {
  const original = "-- My bindings\n"
  const entries = setApplication({}, "org.mozilla.firefox", "Firefox", "SUPER + F")
  const updated = GlobalShortcutModel.updateBindingsSource(original, entries, "SUPER + R")

  assert.equal(GlobalShortcutModel.parseManagedLauncherHotkey(updated), "SUPER + R")
  assert.deepEqual(GlobalShortcutModel.parseManagedEntries(updated), entries)
  assert.match(updated, /-- launcher: \{"hotkey":"SUPER \+ R"\}/)
  assert.match(updated, /omarchy-shell shell toggle com\.mirashif\.omalauncher/)

  const applicationUpdated = GlobalShortcutModel.updateBindingsSource(
    updated,
    setApplication(entries, "org.gnome.Nautilus", "Files", "SUPER + E")
  )
  assert.equal(GlobalShortcutModel.parseManagedLauncherHotkey(applicationUpdated), "SUPER + R")
})

test("replacing the stock menu shortcut gives Omarchy Menu a fallback chord", () => {
  const updated = GlobalShortcutModel.updateBindingsSource(
    "-- My bindings\n", {}, "SUPER + SPACE", "SUPER + R")

  assert.equal(GlobalShortcutModel.parseManagedLauncherHotkey(updated), "SUPER + SPACE")
  assert.equal(GlobalShortcutModel.parseManagedMenuHotkey(updated), "SUPER + R")
  assert.match(updated, /hl\.unbind\("SUPER \+ SPACE"\)/)
  assert.match(updated, /o\.bind\("SUPER \+ SPACE", "OmaLauncher"/)
  assert.match(updated, /hl\.unbind\("SUPER \+ R"\)/)
  assert.match(updated, /o\.bind\("SUPER \+ R", "Omarchy menu", "omarchy-menu toggle"\)/)

  const withoutLauncher = GlobalShortcutModel.updateBindingsSource(updated, {}, "")
  assert.equal(GlobalShortcutModel.parseManagedLauncherHotkey(withoutLauncher), "")
  assert.equal(GlobalShortcutModel.parseManagedMenuHotkey(withoutLauncher), "")
  assert.equal(withoutLauncher, "-- My bindings\n")

  const movedLauncher = GlobalShortcutModel.updateBindingsSource(
    updated, {}, "SUPER + X")
  assert.equal(GlobalShortcutModel.parseManagedLauncherHotkey(movedLauncher), "SUPER + X")
  assert.equal(GlobalShortcutModel.parseManagedMenuHotkey(movedLauncher), "")

  const applicationEntries = setApplication(
    {}, "org.example.Launcher", "Example", "SUPER + SPACE")
  const transferredToApplication = GlobalShortcutModel.updateBindingsSource(
    updated, applicationEntries, "")
  assert.equal(GlobalShortcutModel.parseManagedMenuHotkey(transferredToApplication), "SUPER + R")
})

test("managed menu fallbacks are not reported as external conflicts", () => {
  const rows = JSON.stringify([
    { modmask: 64, key: "SPACE", description: "Omarchy menu", dispatcher: "__lua" },
    { modmask: 64, key: "R", description: "Omarchy menu", dispatcher: "__lua" }
  ])

  assert.equal(GlobalShortcutModel.externalConflictDescription(
    rows, "SUPER + R", "", "SUPER + R"), "")
  assert.equal(GlobalShortcutModel.externalConflictDescription(
    rows, "SUPER + SPACE", "", "SUPER + R"), "Omarchy menu")
})

test("owned hotkeys can transfer between the launcher and applications", () => {
  const entries = setApplication({}, "org.mozilla.firefox", "Firefox", "SUPER + R")
  assert.deepEqual(GlobalShortcutModel.removeHotkey(entries, "SUPER + R"), {})

  const source = GlobalShortcutModel.updateBindingsSource("", entries, "SUPER + R")
  assert.equal(GlobalShortcutModel.parseManagedLauncherHotkey(source), "SUPER + R")
  assert.deepEqual(GlobalShortcutModel.parseManagedEntries(source), {})
})

test("managed hotkeys remain last so confirmed overrides take effect", () => {
  const existing = [
    GlobalShortcutModel.BEGIN_MARKER,
    '-- app: {"id":"old","title":"Old","hotkey":"SUPER + O"}',
    'hl.unbind("SUPER + O")',
    'o.bind("SUPER + O", "Old", "old")',
    GlobalShortcutModel.END_MARKER,
    'o.bind("SUPER + X", "User binding", "user")',
    ""
  ].join("\n")
  const entries = setApplication({}, "new", "New", "SUPER + N")
  const updated = GlobalShortcutModel.updateBindingsSource(existing, entries)

  assert.ok(updated.indexOf("User binding") < updated.indexOf(GlobalShortcutModel.BEGIN_MARKER))
  assert.ok(updated.endsWith(GlobalShortcutModel.END_MARKER + "\n"))
})

test("assigning an owned chord transfers it to only one application", () => {
  let entries = setApplication({}, "first", "First", "SUPER + 1")
  entries = setApplication(entries, "second", "Second", "SUPER + 1")
  assert.deepEqual(Object.keys(entries), ["application:second"])
  assert.equal(entries["application:second"].hotkey, "SUPER + 1")
})

test("legacy application records migrate into generalized shortcut metadata", () => {
  const source = [
    "-- BEGIN OMALAUNCHER APP HOTKEYS (managed)",
    '-- app: {"id":"org.mozilla.firefox","title":"Firefox","hotkey":"SUPER + F"}',
    'hl.unbind("SUPER + F")',
    'o.bind("SUPER + F", "Firefox", "old")',
    "-- END OMALAUNCHER APP HOTKEYS",
    ""
  ].join("\n")
  const entries = GlobalShortcutModel.parseManagedEntries(source)
  assert.equal(entries["application:org.mozilla.firefox"].kind, "application")
  const migrated = GlobalShortcutModel.updateBindingsSource(source, entries)
  assert.match(migrated, /BEGIN OMALAUNCHER GLOBAL SHORTCUTS/)
  assert.doesNotMatch(migrated, /BEGIN OMALAUNCHER APP HOTKEYS/)
  assert.match(migrated, /-- shortcut: /)
  assert.doesNotMatch(migrated, /-- app: /)
  assert.equal(GlobalShortcutModel.parseManagedEntries(migrated)[
    "application:org.mozilla.firefox"].hotkey, "SUPER + F")
})

test("generated Lua and shell command keep metadata literal", () => {
  const entries = setApplication(
    {},
    "odd'; touch never #",
    "Odd \"App\"\nName",
    "SUPER + O"
  )
  const block = GlobalShortcutModel.managedBlock(entries)

  assert.match(block, /gtk-launch 'odd'\\\\''; touch never #\.desktop'/)
  assert.equal(block.includes("Odd \"App\"\nName"), false)
  assert.match(block, /Odd \\\"App\\\" Name/)
})

test("hyprctl binding JSON is converted to canonical conflict descriptions", () => {
  const rows = JSON.stringify([
    { modmask: 65, key: "b", description: "Open browser", dispatcher: "exec" },
    { modmask: 4, key: "RETURN", description: "Open terminal", dispatcher: "exec" }
  ])
  assert.equal(GlobalShortcutModel.conflictDescription(rows, "SHIFT + SUPER + B"), "Open browser")
  assert.equal(GlobalShortcutModel.conflictDescription(rows, "CTRL + RETURN"), "Open terminal")
  assert.equal(GlobalShortcutModel.conflictDescription(rows, "SUPER + X"), "")
  assert.equal(GlobalShortcutModel.isNamedLauncherBinding(JSON.stringify([
    { modmask: 64, key: "R", description: "OmaLauncher", dispatcher: "__lua" }
  ]), "SUPER + R"), true)
  assert.equal(GlobalShortcutModel.isNamedLauncherBinding(rows, "SUPER + B"), false)
  assert.equal(GlobalShortcutModel.isNamedMenuBinding(JSON.stringify([
    { modmask: 64, key: "SPACE", description: "Omarchy menu", dispatcher: "__lua" }
  ]), "SUPER + SPACE"), true)
  assert.equal(GlobalShortcutModel.isNamedMenuBinding(rows, "SUPER + B"), false)
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
    const request = GlobalShortcutModel.mutationRequest(bindings, "-- original\n", "-- updated\n")
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
    const request = GlobalShortcutModel.mutationRequest(bindings, "-- original\n", "-- broken\n")
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
    const request = GlobalShortcutModel.mutationRequest(bindings, "-- stale\n", "-- update\n")
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
