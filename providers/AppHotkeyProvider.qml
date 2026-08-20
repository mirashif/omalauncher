import Quickshell
import Quickshell.Io
import QtQuick
import "AppHotkeyModel.js" as AppHotkeyModel

// Owns only Omalauncher's marked block in the user's Hyprland bindings file.
// AppHotkeyModel keeps parsing and mutation generation testable outside QML.
Item {
  id: root
  visible: false

  readonly property string configHome: Quickshell.env("XDG_CONFIG_HOME")
    || (Quickshell.env("HOME") + "/.config")
  readonly property string bindingsPath: configHome + "/hypr/bindings.lua"
  property var entries: ({})
  property bool ready: false
  property bool busy: false
  property string error: ""
  property string pendingAppId: ""
  property string pendingTitle: ""
  property string pendingHotkey: ""
  property string pendingConflict: ""
  property string pendingMode: ""
  property string pendingSource: ""

  signal conflictDetected(string appId, string title, string hotkey, string existingDescription)
  signal hotkeyApplied(string appId, string hotkey, string replacedDescription)
  signal hotkeyRemoved(string appId)
  signal mutationFailed(string message)

  function hydrate(source) {
    root.entries = AppHotkeyModel.parseManagedEntries(source)
    root.ready = true
    root.error = ""
  }

  function hotkeyFor(appId) {
    var entry = root.entries[String(appId || "")]
    return entry ? String(entry.hotkey || "") : ""
  }

  function clearPending() {
    root.pendingAppId = ""
    root.pendingTitle = ""
    root.pendingHotkey = ""
    root.pendingConflict = ""
    root.pendingMode = ""
    root.pendingSource = ""
  }

  function cancelPending() {
    if (!root.busy) root.clearPending()
  }

  function requestSet(appId, title, hotkey) {
    if (root.busy || !root.ready) return false
    var chord = AppHotkeyModel.normalizeHotkey(hotkey)
    if (!AppHotkeyModel.safeGlobalHotkey(chord)) {
      root.mutationFailed("Hotkeys need Super, Ctrl, or Alt plus one key")
      return false
    }
    var id = AppHotkeyModel.cleanAppId(appId)
    if (!id) {
      root.mutationFailed("This application does not have a usable desktop ID")
      return false
    }
    if (root.hotkeyFor(id) === chord) {
      root.hotkeyApplied(id, chord, "")
      return true
    }
    root.pendingAppId = id
    root.pendingTitle = String(title || id)
    root.pendingHotkey = chord
    root.pendingConflict = ""
    root.pendingMode = "set"
    root.busy = true
    conflictCheck.command = ["hyprctl", "binds", "-j"]
    conflictCheck.running = true
    return true
  }

  function confirmPendingConflict() {
    if (root.busy || root.pendingMode !== "set" || !root.pendingAppId) return false
    return root.applySet()
  }

  function applySet() {
    var currentSource = bindingsFile.text()
    var next = AppHotkeyModel.setEntry(
      AppHotkeyModel.parseManagedEntries(currentSource),
      root.pendingAppId, root.pendingTitle, root.pendingHotkey)
    return root.applyMutation(
      "set", currentSource, AppHotkeyModel.updateBindingsSource(currentSource, next))
  }

  function requestRemove(appId) {
    if (root.busy || !root.ready) return false
    var id = AppHotkeyModel.cleanAppId(appId)
    if (!id || !root.hotkeyFor(id)) return false
    root.pendingAppId = id
    root.pendingTitle = ""
    root.pendingHotkey = ""
    root.pendingConflict = ""
    var currentSource = bindingsFile.text()
    return root.applyMutation("remove", currentSource,
      AppHotkeyModel.updateBindingsSource(currentSource,
        AppHotkeyModel.removeEntry(AppHotkeyModel.parseManagedEntries(currentSource), id)))
  }

  function applyMutation(mode, expectedSource, source) {
    var request = AppHotkeyModel.mutationRequest(root.bindingsPath, expectedSource, source)
    if (!request.active) {
      root.mutationFailed("Could not prepare the Hyprland binding update")
      root.clearPending()
      return false
    }
    root.pendingMode = mode
    root.pendingSource = source
    root.busy = true
    mutation.command = request.command
    mutation.running = true
    return true
  }

  FileView {
    id: bindingsFile
    path: root.bindingsPath
    watchChanges: true
    printErrors: false
    onLoaded: root.hydrate(text())
    onLoadFailed: {
      root.entries = ({})
      root.ready = true
      root.error = "Per-application hotkeys are unavailable"
    }
    onFileChanged: if (!root.busy) reload()
  }

  Process {
    id: conflictCheck
    stdout: StdioCollector {
      id: conflictCheckOutput
      waitForEnd: true
    }
    onExited: function(exitCode, exitStatus) {
      root.busy = false
      if (exitCode !== 0 || exitStatus !== 0) {
        root.mutationFailed("Could not inspect current Hyprland bindings")
        root.clearPending()
        return
      }
      var conflict = AppHotkeyModel.conflictDescription(conflictCheckOutput.text, root.pendingHotkey)
      if (conflict) {
        root.pendingConflict = conflict
        root.conflictDetected(root.pendingAppId, root.pendingTitle, root.pendingHotkey, conflict)
        return
      }
      root.applySet()
    }
  }

  Process {
    id: mutation
    stdout: StdioCollector {
      id: mutationOutput
      waitForEnd: true
    }
    onExited: function(exitCode, exitStatus) {
      root.busy = false
      var mode = root.pendingMode
      var appId = root.pendingAppId
      var hotkey = root.pendingHotkey
      var conflict = root.pendingConflict
      if (exitCode !== 0 || exitStatus !== 0) {
        var detail = String(mutationOutput.text || "").trim()
        root.error = "Could not update per-application hotkeys"
        root.mutationFailed(detail || root.error)
        root.clearPending()
        bindingsFile.reload()
        return
      }
      root.hydrate(root.pendingSource)
      root.clearPending()
      bindingsFile.reload()
      if (mode === "remove") root.hotkeyRemoved(appId)
      else root.hotkeyApplied(appId, hotkey, conflict)
    }
  }
}
