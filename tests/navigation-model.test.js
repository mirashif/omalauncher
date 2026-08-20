const test = require("node:test")
const assert = require("node:assert/strict")

const NavigationModel = require("../services/NavigationModel.js")

const rows = [
  { section: "Favorites" },
  { section: "Favorites" },
  { section: "Applications" },
  { section: "Applications" },
  { section: "Commands" }
]

test("section jumps land on the first row of adjacent sections", () => {
  assert.equal(NavigationModel.sectionJumpIndex(rows, 0, 1), 2)
  assert.equal(NavigationModel.sectionJumpIndex(rows, 3, 1), 4)
  assert.equal(NavigationModel.sectionJumpIndex(rows, 4, -1), 2)
  assert.equal(NavigationModel.sectionJumpIndex(rows, 2, -1), 0)
})

test("section jumps stay put at list boundaries", () => {
  assert.equal(NavigationModel.sectionJumpIndex(rows, 0, -1), 0)
  assert.equal(NavigationModel.sectionJumpIndex(rows, 4, 1), 4)
  assert.equal(NavigationModel.sectionJumpIndex([], 0, 1), 0)
})

test("a stationary pointer does not steal keyboard selection", () => {
  assert.equal(NavigationModel.pointerSelectionIndex(5, 3, 1, false), 3)
})

test("deliberate pointer movement owns selection for the hovered row", () => {
  assert.equal(NavigationModel.pointerSelectionIndex(5, 3, 1, true), 1)
  assert.equal(NavigationModel.pointerSelectionIndex(5, 3, 8, true), 3)
  assert.equal(NavigationModel.pointerSelectionIndex(0, 3, 1, true), 0)
})
