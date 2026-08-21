const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const projectRoot = path.resolve(__dirname, "..")

test("launcher exposes About from root search and routes its actions", () => {
  const launcher = fs.readFileSync(path.join(projectRoot, "Launcher.qml"), "utf8")

  assert.match(launcher, /kind: "settings-open-about"/)
  assert.match(launcher, /root\.setActiveRoute\("settings-about", true\)/)
  assert.match(launcher, /SettingsModel\.aboutRecords\(/)
  assert.match(launcher, /row\.resultKind === "about-copy-details"/)
  assert.match(launcher, /row\.resultKind === "about-open-url"/)
  assert.match(launcher, /Quickshell\.execDetached\(\["xdg-open", url\]\)/)
})
