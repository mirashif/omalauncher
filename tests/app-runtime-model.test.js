const test = require("node:test")
const assert = require("node:assert/strict")

const AppRuntimeModel = require("../providers/AppRuntimeModel.js")

const clients = [
  {
    address: "0xabc1",
    mapped: true,
    class: "brave-browser",
    initialClass: "brave-browser",
    title: "Browser",
    pid: 100
  },
  {
    address: "0xabc2",
    mapped: true,
    class: "",
    initialClass: "",
    title: "Picture in picture",
    pid: 100
  },
  {
    address: "0xabc3",
    mapped: true,
    class: "brave-browser-beta",
    initialClass: "brave-browser-beta",
    title: "Different application",
    pid: 200
  }
]

test("runtime matching requires an exact startup class and includes its same-process windows", () => {
  const snapshot = AppRuntimeModel.runtimeSnapshot(
    JSON.stringify(clients), "browser.desktop", "BRAVE-browser")

  assert.equal(snapshot.supported, true)
  assert.equal(snapshot.running, true)
  assert.deepEqual(snapshot.windows.map(window => window.address), ["0xabc1", "0xabc2"])
  assert.equal(snapshot.windows.some(window => window.address === "0xabc3"), false)
})

test("startup class takes priority over a coincidentally matching desktop id", () => {
  const snapshot = AppRuntimeModel.runtimeSnapshot(
    JSON.stringify(clients), "brave-browser", "unrelated-class")

  assert.equal(snapshot.running, false)
  assert.equal(snapshot.identity, "unrelated-class")
})

test("desktop id is the conservative fallback when StartupWMClass is absent", () => {
  const snapshot = AppRuntimeModel.runtimeSnapshot(JSON.stringify(clients), "brave-browser", "")
  assert.equal(snapshot.running, true)
  assert.equal(AppRuntimeModel.matchesTarget(snapshot, "brave-browser.desktop", ""), true)
  assert.equal(AppRuntimeModel.matchesTarget(snapshot, "other", ""), false)
})

test("malformed window data disables runtime actions", () => {
  const malformed = AppRuntimeModel.runtimeSnapshot("not json", "brave-browser", "")
  const missingIdentity = AppRuntimeModel.runtimeSnapshot("[]", "", "")
  assert.equal(malformed.supported, false)
  assert.match(malformed.error, /invalid window data/)
  assert.equal(missingIdentity.supported, false)
})

test("close dispatch expressions accept only exact Hyprland addresses", () => {
  assert.equal(
    AppRuntimeModel.closeExpression("0xAbC123"),
    'hl.dsp.window.close({ window = "address:0xAbC123" })'
  )
  assert.equal(AppRuntimeModel.closeExpression('0x1" })'), "")
  assert.equal(AppRuntimeModel.closeExpression("class:brave-browser"), "")
})

test("verification tracks every originally closed address after its identity anchor disappears", () => {
  const onlyPictureInPicture = JSON.stringify([clients[1]])
  assert.deepEqual(
    AppRuntimeModel.presentAddresses(onlyPictureInPicture, ["0xabc1", "0xabc2"]),
    ["0xabc2"]
  )
  assert.deepEqual(AppRuntimeModel.presentAddresses("not json", ["0xabc1"]), ["0xabc1"])
})
