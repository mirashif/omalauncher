import Quickshell
import Quickshell.Io
import QtQuick
import "GlobalShortcutModel.js" as GlobalShortcutModel

// Owns only OmaLauncher's marked block in the user's Hyprland bindings file.
// GlobalShortcutModel keeps parsing and mutation generation testable outside QML.
Item {
  id: root
  visible: false

  readonly property string configHome: Quickshell.env("XDG_CONFIG_HOME")
    || (Quickshell.env("HOME") + "/.config")
  readonly property string bindingsPath: configHome + "/hypr/bindings.lua"
  readonly property string menuFallbackHotkey: GlobalShortcutModel.MENU_FALLBACK_HOTKEY
  property var entries: ({})
  property string launcherHotkey: ""
  property string menuHotkey: ""
  property bool ready: false
  property bool busy: false
  property string error: ""
  property var pendingTarget: ({})
  property string pendingTitle: ""
  property string pendingHotkey: ""
  property string pendingMenuHotkey: ""
  property string pendingConflict: ""
  property string pendingMode: ""
  property string pendingSource: ""

  signal shortcutConflictDetected(string targetKey, string title, string hotkey,
    string existingDescription)
  signal launcherConflictDetected(string hotkey, string existingDescription, bool namedLauncher,
    bool namedMenu, string menuFallbackHotkey, string menuFallbackDescription,
    bool menuFallbackIsLauncher)
  signal launcherHotkeyInspected(string hotkey, string existingDescription, bool namedLauncher,
    bool namedMenu, string menuFallbackHotkey, string menuFallbackDescription,
    bool menuFallbackIsLauncher)
  signal shortcutApplied(string targetKey, string hotkey, string replacedDescription)
  signal shortcutRemoved(string targetKey)
  signal launcherHotkeyApplied(string hotkey, string replacedDescription)
  signal launcherHotkeyRemoved()
  signal mutationFailed(string message)

  function hydrate(source) {
    root.entries = GlobalShortcutModel.parseManagedEntries(source)
    root.launcherHotkey = GlobalShortcutModel.parseManagedLauncherHotkey(source)
    root.menuHotkey = GlobalShortcutModel.parseManagedMenuHotkey(source)
    root.ready = true
    root.error = ""
  }

  function targetFor(result) {
    return GlobalShortcutModel.targetForResult(result)
  }

  function canAssign(result) {
    return root.targetFor(result) !== null
  }

  function hotkeyFor(result) {
    var target = root.targetFor(result)
    var entry = target ? root.entries[String(target.key || "")] : null
    return entry ? String(entry.hotkey || "") : ""
  }

  function clearPending() {
    root.pendingTarget = ({})
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

  function requestSet(result, hotkey) {
    if (root.busy || !root.ready) return false
    var chord = GlobalShortcutModel.normalizeHotkey(hotkey)
    if (!GlobalShortcutModel.safeGlobalHotkey(chord)) {
      root.mutationFailed("Hotkeys need Super, Ctrl, or Alt plus one key")
      return false
    }
    var target = root.targetFor(result)
    if (!target) {
      root.mutationFailed("This result cannot own a global shortcut")
      return false
    }
    if (root.menuHotkey === chord) {
      root.mutationFailed("This shortcut is reserved for Omarchy Menu")
      return false
    }
    if (root.hotkeyFor(result) === chord) {
      root.shortcutApplied(String(target.key || ""), chord, "")
      return true
    }
    root.pendingTarget = target
    root.pendingTitle = String(target.title || target.key || "Result")
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
    var chord = GlobalShortcutModel.normalizeHotkey(hotkey)
    if (!GlobalShortcutModel.safeGlobalHotkey(chord)) {
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
    var chord = GlobalShortcutModel.normalizeHotkey(hotkey)
    if (!GlobalShortcutModel.safeGlobalHotkey(chord)) {
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
    root.pendingTarget = ({})
    root.pendingTitle = GlobalShortcutModel.LAUNCHER_TITLE
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
    var chord = GlobalShortcutModel.normalizeHotkey(hotkey)
    var fallback = GlobalShortcutModel.normalizeHotkey(menuHotkey)
    if (!GlobalShortcutModel.safeGlobalHotkey(chord)
        || !GlobalShortcutModel.safeGlobalHotkey(fallback) || chord === fallback) {
      root.mutationFailed("Could not prepare a safe Omarchy Menu shortcut")
      return false
    }
    root.pendingTarget = ({})
    root.pendingTitle = GlobalShortcutModel.LAUNCHER_TITLE
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
    if (root.pendingMode === "set" && !String(root.pendingTarget.key || "")) return false
    return root.applySet()
  }

  function applySet() {
    var currentSource = bindingsFile.text()
    var entries = GlobalShortcutModel.parseManagedEntries(currentSource)
    var launcher = GlobalShortcutModel.parseManagedLauncherHotkey(currentSource)
    var menu = GlobalShortcutModel.parseManagedMenuHotkey(currentSource)
    if (root.pendingMode === "set-launcher-menu") {
      entries = GlobalShortcutModel.removeHotkey(entries, root.pendingHotkey)
      entries = GlobalShortcutModel.removeHotkey(entries, root.pendingMenuHotkey)
      launcher = root.pendingHotkey
      menu = root.pendingMenuHotkey
    } else if (root.pendingMode === "set-launcher") {
      entries = GlobalShortcutModel.removeHotkey(entries, root.pendingHotkey)
      launcher = root.pendingHotkey
      menu = ""
    } else {
      entries = GlobalShortcutModel.setEntry(entries, root.pendingTarget, root.pendingHotkey)
      if (launcher === root.pendingHotkey) launcher = ""
    }
    return root.applyMutation(
      root.pendingMode, currentSource,
      GlobalShortcutModel.updateBindingsSource(currentSource, entries, launcher, menu))
  }

  function requestRemove(result) {
    if (root.busy || !root.ready) return false
    var target = root.targetFor(result)
    if (!target || !root.hotkeyFor(result)) return false
    root.pendingTarget = target
    root.pendingTitle = String(target.title || target.key || "")
    root.pendingHotkey = ""
    root.pendingConflict = ""
    var currentSource = bindingsFile.text()
    return root.applyMutation("remove", currentSource,
      GlobalShortcutModel.updateBindingsSource(currentSource,
        GlobalShortcutModel.removeEntry(
          GlobalShortcutModel.parseManagedEntries(currentSource), target.key)))
  }

  function requestRemoveLauncher() {
    if (root.busy || !root.ready || !root.launcherHotkey) return false
    root.pendingTarget = ({})
    root.pendingTitle = GlobalShortcutModel.LAUNCHER_TITLE
    root.pendingHotkey = root.launcherHotkey
    root.pendingConflict = ""
    var currentSource = bindingsFile.text()
    return root.applyMutation("remove-launcher", currentSource,
      GlobalShortcutModel.updateBindingsSource(currentSource,
        GlobalShortcutModel.parseManagedEntries(currentSource), "", ""))
  }

  function applyMutation(mode, expectedSource, source) {
    var request = GlobalShortcutModel.mutationRequest(root.bindingsPath, expectedSource, source)
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
      var conflict = GlobalShortcutModel.conflictDescription(conflictCheckOutput.text, root.pendingHotkey)
      var namedLauncher = GlobalShortcutModel.isNamedLauncherBinding(
        conflictCheckOutput.text, root.pendingHotkey)
      var namedMenu = GlobalShortcutModel.isNamedMenuBinding(
        conflictCheckOutput.text, root.pendingHotkey)
      var fallback = root.pendingMenuHotkey || GlobalShortcutModel.MENU_FALLBACK_HOTKEY
      var fallbackConflict = GlobalShortcutModel.externalConflictDescription(
        conflictCheckOutput.text, fallback, root.launcherHotkey, root.menuHotkey)
      var fallbackIsLauncher = GlobalShortcutModel.isNamedLauncherBinding(
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
          root.shortcutConflictDetected(String(root.pendingTarget.key || ""),
            root.pendingTitle, root.pendingHotkey, conflict)
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
        GlobalShortcutModel.conflictDescription(availabilityCheckOutput.text, chord),
        GlobalShortcutModel.isNamedLauncherBinding(availabilityCheckOutput.text, chord),
        GlobalShortcutModel.isNamedMenuBinding(availabilityCheckOutput.text, chord),
        GlobalShortcutModel.MENU_FALLBACK_HOTKEY,
        GlobalShortcutModel.externalConflictDescription(
          availabilityCheckOutput.text, GlobalShortcutModel.MENU_FALLBACK_HOTKEY,
          root.launcherHotkey, root.menuHotkey),
        GlobalShortcutModel.isNamedLauncherBinding(
          availabilityCheckOutput.text, GlobalShortcutModel.MENU_FALLBACK_HOTKEY))
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
      var targetKey = String(root.pendingTarget.key || "")
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
      if (mode === "remove") root.shortcutRemoved(targetKey)
      else if (mode === "remove-launcher") root.launcherHotkeyRemoved()
      else if (mode === "set-launcher" || mode === "set-launcher-menu")
        root.launcherHotkeyApplied(hotkey, conflict)
      else root.shortcutApplied(targetKey, hotkey, conflict)
    }
  }
}
