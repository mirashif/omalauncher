const test = require("node:test")
const assert = require("node:assert/strict")

const DependencyModel = require("../services/DependencyModel.js")

test("dependency requests include only unavailable optional features", () => {
  assert.deepEqual(DependencyModel.requestedPackages("all", {
    calculatorAvailable: false,
    fileSearchAvailable: false
  }), ["libqalculate", "fd"])
  assert.deepEqual(DependencyModel.requestedPackages("all", {
    calculatorAvailable: true,
    fileSearchAvailable: false
  }), ["fd"])
  assert.deepEqual(DependencyModel.requestedPackages("calculator", {
    calculatorAvailable: false,
    fileSearchAvailable: false
  }), ["libqalculate"])
  assert.deepEqual(DependencyModel.requestedPackages("unknown", {}), [])
})

test("terminal installation command is literal, allowlisted, and visible", () => {
  assert.deepEqual(DependencyModel.terminalCommand(["fd", "libqalculate", "malicious; command"]), [
    "xdg-terminal-exec",
    "--app-id=org.omarchy.terminal",
    "--title=Install Omalauncher optional tools",
    "omarchy",
    "pkg",
    "add",
    "libqalculate",
    "fd"
  ])
  assert.equal(
    DependencyModel.commandText(["fd", "libqalculate"]),
    "omarchy pkg add libqalculate fd"
  )
  assert.deepEqual(DependencyModel.terminalCommand(["not-allowed"]), [])
})
