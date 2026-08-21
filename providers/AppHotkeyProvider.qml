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
  readonly property string menuFallbackHotkey: AppHotkeyModel.MENU_FALLBACK_HOTKEY
  property var entries: ({})
  property string launcherHotkey: ""
  property string menuHotkey: ""
  property bool ready: false
  property bool busy: false
  property string error: ""
  property string pendingAppId: ""
  property string pendingTitle: ""
  property string pendingHotkey: ""
  property string pendingMenuHotkey: ""
  property string pendingConflict: ""
  property string pendingMode: ""
  property string pendingSource: ""

  signal conflictDetected(string appId, string title, string hotkey, string existingDescription)
  signal launcherConflictDetected(string hotkey, string existingDescription, bool namedLauncher,
    bool namedMenu, string menuFallbackHotkey, string menuFallbackDescription,
    bool menuFallbackIsLauncher)
  signal launcherHotkeyInspected(string hotkey, string existingDescription, bool namedLauncher,
    bool namedMenu, string menuFallbackHotkey, string menuFallbackDescription,
    bool menuFallbackIsLauncher)
  signal hotkeyApplied(string appId, string hotkey, string replacedDescription)
  signal hotkeyRemoved(string appId)
  signal launcherHotkeyApplied(string hotkey, string replacedDescription)
  signal launcherHotkeyRemoved()
  signal mutationFailed(string message)

  function hydrate(source) {
    root.entries = AppHotkeyModel.parseManagedEntries(source)
    root.launcherHotkey = AppHotkeyModel.parseManagedLauncherHotkey(source)
    root.menuHotkey = AppHotkeyModel.parseManagedMenuHotkey(source)
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
    root.pendingMenuHotkey = ""
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
    if (root.menuHotkey === chord) {
      root.mutationFailed("This shortcut is reserved for Omarchy Menu")
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

  function inspectLauncherHotkey(hotkey) {
    if (root.busy || availabilityCheck.running) return false
    var chord = AppHotkeyModel.normalizeHotkey(hotkey)
    if (!AppHotkeyModel.safeGlobalHotkey(chord)) {
      root.mutationFailed("Hotkeys need Super, Ctrl, or Alt plus one key")
      return false
    }
    availabilityCheck.hotkey = chord
    availabilityCheck.command = ["hyprctl", "binds", "-j"]
    availabilityCheck.running = true
    return true
  }

  function requestSetLauncher(hotkey) {
    if (root.busy || !root.ready) return false
    var chord = AppHotkeyModel.normalizeHotkey(hotkey)
    if (!AppHotkeyModel.safeGlobalHotkey(chord)) {
      root.mutationFailed("Hotkeys need Super, Ctrl, or Alt plus one key")
      return false
    }
    if (root.menuHotkey === chord) {
      root.mutationFailed("This shortcut currently opens Omarchy Menu; choose another shortcut")
      return false
    }
    if (root.launcherHotkey === chord) {
      root.launcherHotkeyApplied(chord, "")
      return true
    }
    root.pendingAppId = ""
    root.pendingTitle = AppHotkeyModel.LAUNCHER_TITLE
    root.pendingHotkey = chord
    root.pendingConflict = ""
    root.pendingMode = "set-launcher"
    root.busy = true
    conflictCheck.command = ["hyprctl", "binds", "-j"]
    conflictCheck.running = true
    return true
  }

  function requestReplaceMenuWithLauncher(hotkey, menuHotkey) {
    if (root.busy || !root.ready) return false
    var chord = AppHotkeyModel.normalizeHotkey(hotkey)
    var fallback = AppHotkeyModel.normalizeHotkey(menuHotkey)
    if (!AppHotkeyModel.safeGlobalHotkey(chord)
        || !AppHotkeyModel.safeGlobalHotkey(fallback) || chord === fallback) {
      root.mutationFailed("Could not prepare a safe Omarchy Menu shortcut")
      return false
    }
    root.pendingAppId = ""
    root.pendingTitle = AppHotkeyModel.LAUNCHER_TITLE
    root.pendingHotkey = chord
    root.pendingMenuHotkey = fallback
    root.pendingConflict = ""
    root.pendingMode = "set-launcher-menu"
    root.busy = true
    conflictCheck.command = ["hyprctl", "binds", "-j"]
    conflictCheck.running = true
    return true
  }

  function confirmPendingConflict() {
    if (root.busy || (root.pendingMode !== "set" && root.pendingMode !== "set-launcher"
        && root.pendingMode !== "set-launcher-menu")) return false
    if (root.pendingMode === "set" && !root.pendingAppId) return false
    return root.applySet()
  }

  function applySet() {
    var currentSource = bindingsFile.text()
    var entries = AppHotkeyModel.parseManagedEntries(currentSource)
    var launcher = AppHotkeyModel.parseManagedLauncherHotkey(currentSource)
    var menu = AppHotkeyModel.parseManagedMenuHotkey(currentSource)
    if (root.pendingMode === "set-launcher-menu") {
      entries = AppHotkeyModel.removeHotkey(entries, root.pendingHotkey)
      entries = AppHotkeyModel.removeHotkey(entries, root.pendingMenuHotkey)
      launcher = root.pendingHotkey
      menu = root.pendingMenuHotkey
    } else if (root.pendingMode === "set-launcher") {
      entries = AppHotkeyModel.removeHotkey(entries, root.pendingHotkey)
      launcher = root.pendingHotkey
      menu = ""
    } else {
      entries = AppHotkeyModel.setEntry(
        entries, root.pendingAppId, root.pendingTitle, root.pendingHotkey)
      if (launcher === root.pendingHotkey) launcher = ""
    }
    return root.applyMutation(
      root.pendingMode, currentSource,
      AppHotkeyModel.updateBindingsSource(currentSource, entries, launcher, menu))
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

  function requestRemoveLauncher() {
    if (root.busy || !root.ready || !root.launcherHotkey) return false
    root.pendingAppId = ""
    root.pendingTitle = AppHotkeyModel.LAUNCHER_TITLE
    root.pendingHotkey = root.launcherHotkey
    root.pendingConflict = ""
    var currentSource = bindingsFile.text()
    return root.applyMutation("remove-launcher", currentSource,
      AppHotkeyModel.updateBindingsSource(currentSource,
        AppHotkeyModel.parseManagedEntries(currentSource), "", ""))
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
      root.launcherHotkey = ""
      root.menuHotkey = ""
      root.ready = true
      root.error = "Hotkey settings are unavailable"
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
      var namedLauncher = AppHotkeyModel.isNamedLauncherBinding(
        conflictCheckOutput.text, root.pendingHotkey)
      var namedMenu = AppHotkeyModel.isNamedMenuBinding(
        conflictCheckOutput.text, root.pendingHotkey)
      var fallback = root.pendingMenuHotkey || AppHotkeyModel.MENU_FALLBACK_HOTKEY
      var fallbackConflict = AppHotkeyModel.externalConflictDescription(
        conflictCheckOutput.text, fallback, root.launcherHotkey, root.menuHotkey)
      var fallbackIsLauncher = AppHotkeyModel.isNamedLauncherBinding(
        conflictCheckOutput.text, fallback)

      if (root.pendingMode === "set-launcher-menu") {
        if (conflict && !namedMenu && !namedLauncher) {
          root.mutationFailed(root.pendingHotkey + " is now used by “" + conflict
            + "”. Choose another shortcut.")
          root.clearPending()
          return
        }
        if (fallbackConflict && !fallbackIsLauncher && root.launcherHotkey !== fallback) {
          root.mutationFailed("Omarchy Menu needs " + fallback + ", but it is used by “"
            + fallbackConflict + "”. Choose another launcher shortcut.")
          root.clearPending()
          return
        }
        root.pendingConflict = conflict
        root.applySet()
        return
      }
      if (conflict) {
        root.pendingConflict = conflict
        if (root.pendingMode === "set-launcher") {
          if (namedMenu) {
            root.pendingMode = "set-launcher-menu"
            root.pendingMenuHotkey = fallback
          }
          root.launcherConflictDetected(root.pendingHotkey, conflict, namedLauncher,
            namedMenu, fallback, fallbackConflict, fallbackIsLauncher)
        } else {
          root.conflictDetected(root.pendingAppId, root.pendingTitle, root.pendingHotkey, conflict)
        }
        return
      }
      root.applySet()
    }
  }

  Process {
    id: availabilityCheck
    property string hotkey: ""
    stdout: StdioCollector {
      id: availabilityCheckOutput
      waitForEnd: true
    }
    onExited: function(exitCode, exitStatus) {
      var chord = availabilityCheck.hotkey
      if (exitCode !== 0 || exitStatus !== 0) {
        root.mutationFailed("Could not inspect current Hyprland bindings")
        return
      }
      root.launcherHotkeyInspected(
        chord,
        AppHotkeyModel.conflictDescription(availabilityCheckOutput.text, chord),
        AppHotkeyModel.isNamedLauncherBinding(availabilityCheckOutput.text, chord),
        AppHotkeyModel.isNamedMenuBinding(availabilityCheckOutput.text, chord),
        AppHotkeyModel.MENU_FALLBACK_HOTKEY,
        AppHotkeyModel.externalConflictDescription(
          availabilityCheckOutput.text, AppHotkeyModel.MENU_FALLBACK_HOTKEY,
          root.launcherHotkey, root.menuHotkey),
        AppHotkeyModel.isNamedLauncherBinding(
          availabilityCheckOutput.text, AppHotkeyModel.MENU_FALLBACK_HOTKEY))
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
        root.error = "Could not update hotkeys"
        root.mutationFailed(detail || root.error)
        root.clearPending()
        bindingsFile.reload()
        return
      }
      root.hydrate(root.pendingSource)
      root.clearPending()
      bindingsFile.reload()
      if (mode === "remove") root.hotkeyRemoved(appId)
      else if (mode === "remove-launcher") root.launcherHotkeyRemoved()
      else if (mode === "set-launcher" || mode === "set-launcher-menu")
        root.launcherHotkeyApplied(hotkey, conflict)
      else root.hotkeyApplied(appId, hotkey, conflict)
    }
  }
}
