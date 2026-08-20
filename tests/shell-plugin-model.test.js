const test = require("node:test")
const assert = require("node:assert/strict")

const ShellPluginModel = require("../providers/ShellPluginModel.js")

test("shell feature index includes summonable panels, overlays, and live panel widgets", () => {
  const manifests = {
    "omarchy.clipboard": {
      name: "Clipboard",
      description: "Clipboard history",
      kinds: ["overlay"]
    },
    "omarchy.audio": {
      name: "Audio",
      kinds: ["bar-widget"],
      barWidget: { displayName: "Sound", category: "System", aliases: ["volume"] }
    },
    "omarchy.tray": { name: "Tray", kinds: ["bar-widget"] },
    "example.service": { name: "Background Service", kinds: ["service"] },
    "example.explicit": {
      name: "Explicit Tool",
      kinds: ["service"],
      omalauncher: { summon: true, title: "Explicit Surface", aliases: ["custom"] }
    }
  }
  const records = ShellPluginModel.buildRecords(manifests, {
    launcherId: "omalauncher",
    enabledIds: {
      "omarchy.clipboard": true,
      "omarchy.audio": true,
      "omarchy.tray": true,
      "example.service": true,
      "example.explicit": true
    },
    panelIds: { "omarchy.audio": true }
  })

  assert.deepEqual(records.map(record => record.sourcePluginId), [
    "example.explicit",
    "omarchy.audio",
    "omarchy.clipboard"
  ])
  const audio = records.find(record => record.sourcePluginId === "omarchy.audio")
  const clipboard = records.find(record => record.sourcePluginId === "omarchy.clipboard")
  assert.ok(audio)
  assert.ok(clipboard)
  assert.equal(audio.title, "Sound")
  assert.equal(audio.keywords && audio.keywords.includes("volume"), true)
  assert.deepEqual(clipboard.coveredCommandRoutes, ["omarchy menu clipboard"])
})

test("disabled, internal, opted-out, and launcher-self plugins are excluded", () => {
  const manifests = {
    omalauncher: { name: "Omalauncher", kinds: ["menu"] },
    "omarchy.menu": { name: "Default Menu", kinds: ["menu"] },
    "example.disabled": { name: "Disabled", kinds: ["panel"] },
    "example.optout": { name: "Private", kinds: ["panel"], omalauncher: false }
  }
  const records = ShellPluginModel.buildRecords(manifests, {
    launcherId: "omalauncher",
    enabledIds: {
      omalauncher: true,
      "omarchy.menu": true,
      "example.disabled": false,
      "example.optout": true
    }
  })

  assert.deepEqual(records, [])
})

test("enabled notification service exposes its safe history action", () => {
  const records = ShellPluginModel.buildRecords({
    "omarchy.notifications": {
      name: "Notifications",
      description: "Notification daemon and history",
      kinds: ["service"]
    }
  }, {
    enabledIds: { "omarchy.notifications": true }
  })

  assert.equal(records.length, 1)
  assert.equal(records[0].title, "Notification History")
  assert.equal(records[0].executionKind, "shell-ipc")
  assert.deepEqual(JSON.parse(records[0].commandArgvJson), [
    "omarchy-shell", "notifications", "showHistory"
  ])
})
