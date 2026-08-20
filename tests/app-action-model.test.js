const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { execFileSync } = require("node:child_process")

const AppActionModel = require("../providers/AppActionModel.js")

test("desktop-entry resolution keeps application ids as literal arguments", () => {
  const appId = "odd'; touch /tmp/never #"
  const request = AppActionModel.resolutionRequest(appId, "reveal")

  assert.equal(request.active, false)
  const literal = AppActionModel.resolutionRequest("odd'; touch never #", "reveal")
  assert.equal(literal.active, true)
  assert.equal(literal.command.at(-1), "odd'; touch never #")
  assert.equal(literal.command[2].includes("odd'; touch never #"), false)
})

test("desktop-entry resolution follows XDG precedence and nested id rules", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omalauncher-app-action-"))
  const dataHome = path.join(temporaryRoot, "home-data")
  const sharedData = path.join(temporaryRoot, "shared-data")
  const relativePath = path.join("applications", "tools", "editor.desktop")
  const userEntry = path.join(dataHome, relativePath)
  const sharedEntry = path.join(sharedData, relativePath)
  fs.mkdirSync(path.dirname(userEntry), { recursive: true })
  fs.mkdirSync(path.dirname(sharedEntry), { recursive: true })
  fs.writeFileSync(userEntry, "[Desktop Entry]\nName=User Editor\nType=Application\n")
  fs.writeFileSync(sharedEntry, "[Desktop Entry]\nName=Shared Editor\nType=Application\n")

  try {
    const request = AppActionModel.resolutionRequest("tools-editor", "copy-path")
    const output = execFileSync(request.command[0], request.command.slice(1), {
      encoding: "utf8",
      env: {
        ...process.env,
        XDG_DATA_HOME: dataHome,
        XDG_DATA_DIRS: sharedData
      }
    })
    assert.equal(AppActionModel.resolvedPath(output), fs.realpathSync(userEntry))
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  }
})

test("resolved desktop-entry paths reject non-files and multiline output", () => {
  assert.equal(AppActionModel.resolvedPath("relative/app.desktop"), "")
  assert.equal(AppActionModel.resolvedPath("/tmp/app.txt"), "")
  assert.equal(AppActionModel.resolvedPath("/tmp/app.desktop\n/tmp/other.desktop"), "")
  assert.equal(AppActionModel.resolvedPath("/tmp/app.desktop\n"), "/tmp/app.desktop")
})
