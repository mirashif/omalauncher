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
