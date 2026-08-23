const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const projectRoot = path.resolve(__dirname, "..")
const launcher = fs.readFileSync(path.join(projectRoot, "Launcher.qml"), "utf8")
const shortcutProvider = fs.readFileSync(
  path.join(projectRoot, "providers", "ShortcutBindingProvider.qml"), "utf8")

test("active Omarchy shortcuts are exposed as result accessories", () => {
  assert.match(shortcutProvider, /\["omarchy-menu-keybindings", "--print"\]/)
  assert.match(launcher, /assignedShortcut: root\.assignedShortcutForResult\(result\)/)
  assert.match(launcher, /id: assignedShortcutCue[\s\S]*?text: root\.shortcutCue\(resultRow\.assignedShortcut\)/)
  assert.match(launcher, /id: quickActivationCue[\s\S]*?text: root\.shortcutCue\(root\.quickActivationHint/)
  assert.doesNotMatch(launcher, /assignedShortcut\.length === 0[\s\S]{0,160}quickActivationHint/)
  assert.doesNotMatch(launcher, /id: (?:assignedShortcut|quickActivation)Badge/)
})

test("launcher shortcuts use exact modifier matching and keep text copy safe", () => {
  assert.match(launcher, /function exactModifiers\(event, modifiers\)/)
  assert.match(launcher, /Qt\.ControlModifier \| Qt\.ShiftModifier\)[\s\S]*?event\.key === Qt\.Key_K[\s\S]*?toggleAboutMenu/)
  assert.match(launcher, /Qt\.ControlModifier\) && event\.key === Qt\.Key_Comma/)
  assert.match(launcher, /event\.key === Qt\.Key_Comma[\s\S]*?configureSelectedResult/)
  assert.match(launcher, /event\.key === Qt\.Key_D[\s\S]*?toggleSelectedHidden/)
  assert.match(launcher, /event\.key === Qt\.Key_O[\s\S]*?revealSelectedResult/)
  assert.match(launcher, /event\.key === Qt\.Key_C && searchInput\.selectedText\.length === 0/)
  assert.match(launcher, /event\.key === Qt\.Key_N[\s\S]*?moveSelection\(1\)/)
  assert.match(launcher, /event\.key === Qt\.Key_P[\s\S]*?moveSelection\(-1\)/)
  assert.match(launcher, /Qt\.Key_Backtab[\s\S]*?root\.goBack\(\)/)
})

test("footer provides a flat OmaLauncher menu and action controls", () => {
  const footer = /Rectangle \{\s*id: footer[\s\S]*?\n      Rectangle \{\s*id: aboutMenuPanel/.exec(launcher)

  assert.ok(footer)
  assert.match(launcher, /readonly property string aboutMenuShortcut: "Ctrl\+Shift\+K"/)
  assert.match(launcher, /function shortcutCue\(shortcut\)[\s\S]*?"\[" \+ value \+ "\]"/)
  assert.match(footer[0], /Item \{\s*id: footerAboutButton[\s\S]*?root\.shortcutCue\(root\.aboutMenuShortcut\)/)
  assert.match(footer[0], /root\.shortcutCue\("↵"\)/)
  assert.match(footer[0], /root\.shortcutCue\(root\.secondaryFooterShortcut\(\)\)/)
  assert.doesNotMatch(footer[0], /text: "Menu"|text: root\.activeMenuTitle/)
  assert.match(launcher, /Item \{\s*id: footerControl[\s\S]*?id: footerPrimarySegment[\s\S]*?id: footerSecondarySegment/)
  assert.doesNotMatch(launcher, /Rectangle \{\s*id: footerControl/)
  assert.match(launcher, /id: aboutMenuPanel/)
  assert.match(launcher, /AboutMenuModel\.records/)
  assert.match(launcher, /Accessible\.name: "OmaLauncher menu"/)
})
