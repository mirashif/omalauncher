const test = require("node:test")
const assert = require("node:assert/strict")

const LayoutModel = require("../services/LayoutModel.js")

test("focused monitor names select the matching Quickshell screen", () => {
  const screens = [{ name: "eDP-1" }, { name: "DP-2" }]
  assert.equal(LayoutModel.screenForMonitor(screens, "DP-2"), screens[1])
  assert.equal(LayoutModel.screenForMonitor(screens, "HDMI-A-1"), null)
})

test("result card height preserves the complete result viewport and bottom margin", () => {
  assert.equal(LayoutModel.resultCardHeight(52, 58, 12, 13, 12), 147)
})

test("compact card height keeps only the search field and its padding", () => {
  assert.equal(LayoutModel.compactCardHeight(52, 12), 76)
})

test("card geometry preserves the preferred size and vertical anchor", () => {
  assert.deepEqual(LayoutModel.cardGeometry(2048, 1152, 680, 296, 12, 0.18), {
    width: 680,
    height: 296,
    y: 207
  })
})

test("card geometry clamps safely inside small monitor work areas", () => {
  assert.deepEqual(LayoutModel.cardGeometry(320, 200, 680, 600, 12, 0.18), {
    width: 296,
    height: 176,
    y: 12
  })
})
