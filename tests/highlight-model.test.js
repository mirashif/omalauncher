const test = require("node:test")
const assert = require("node:assert/strict")

const HighlightModel = require("../services/HighlightModel.js")

test("highlighting marks matching title tokens", () => {
  assert.equal(
    HighlightModel.highlight("Update Hyprland", ["hyp"]),
    "Update <b>Hyprland</b>"
  )
})

test("highlighting escapes source markup before adding trusted tags", () => {
  assert.equal(
    HighlightModel.highlight("A&B <script>", ["script"]),
    "A&amp;B &lt;<b>script</b>&gt;"
  )
  assert.equal(HighlightModel.highlight("A&B", []), "A&amp;B")
})
