const test = require("node:test")
const assert = require("node:assert/strict")

const ShortcutBindingModel = require("../providers/ShortcutBindingModel.js")

const sample = [
  "SUPER + R                           → Omarchy menu",
  "SUPER CTRL + V                      → Clipboard manager",
  "SUPER CTRL + E                      → Emojis",
  "SUPER CTRL ALT + D                  → Calendar",
  "SUPER SHIFT + B                     → Browser",
  "SUPER ALT SHIFT + B                 → Browser",
  "F9                                  → Start dictation (push-to-talk)",
  ""
].join("\n")

test("Omarchy display shortcuts parse into canonical chords", () => {
  assert.equal(ShortcutBindingModel.normalizeDisplayHotkey("SUPER CTRL + V"), "SUPER + CTRL + V")
  assert.equal(ShortcutBindingModel.normalizeDisplayHotkey("SUPER ALT SHIFT + B"), "SUPER + ALT + SHIFT + B")
  assert.equal(ShortcutBindingModel.normalizeDisplayHotkey("F9"), "F9")

  const bindings = ShortcutBindingModel.parseBindings(sample)
  assert.equal(bindings.length, 7)
  assert.deepEqual(bindings[1], {
    hotkey: "SUPER + CTRL + V",
    description: "Clipboard manager",
    descriptionKey: "clipboard manager"
  })
})

test("shortcut resolution prefers managed global shortcuts and explicit plugin identities", () => {
  const bindings = ShortcutBindingModel.parseBindings(sample)
  assert.equal(ShortcutBindingModel.shortcutForResult({
    title: "Clipboard",
    sourcePluginId: "omarchy.clipboard"
  }, bindings, ""), "SUPER + CTRL + V")
  assert.equal(ShortcutBindingModel.shortcutForResult({
    title: "Emojis",
    sourcePluginId: "omarchy.emojis"
  }, bindings, ""), "SUPER + CTRL + E")
  assert.equal(ShortcutBindingModel.shortcutForResult({
    title: "Browser",
    type: "application"
  }, bindings, "SUPER + B"), "SUPER + B")
})

test("shortcut resolution uses exact route/title matches and hides ambiguous guesses", () => {
  const bindings = ShortcutBindingModel.parseBindings(sample)
  assert.equal(ShortcutBindingModel.shortcutForResult({
    title: "System",
    targetRoute: "system"
  }, bindings, ""), "")
  assert.equal(ShortcutBindingModel.shortcutForResult({ title: "Calendar" }, bindings, ""), "SUPER + CTRL + ALT + D")
  assert.equal(ShortcutBindingModel.shortcutForResult({ title: "Browser" }, bindings, ""), "")
  assert.equal(ShortcutBindingModel.shortcutForResult({ title: "Unrelated Clipboard Tool" }, bindings, ""), "")
})
