import Quickshell.Io
import QtQuick
import "ShortcutBindingModel.js" as ShortcutBindingModel

// Reads Omarchy's active, source-aware keybinding view. Failure is deliberately
// non-fatal: shortcut accessories disappear while the launcher remains usable.
Item {
  id: root
  visible: false

  property var bindings: []
  property bool ready: false
  property bool busy: false
  property bool pendingRefresh: false
  property string error: ""

  function refresh() {
    if (root.busy) {
      root.pendingRefresh = true
      return false
    }
    root.pendingRefresh = false
    root.busy = true
    keybindingsProcess.command = ["omarchy-menu-keybindings", "--print"]
    keybindingsProcess.running = true
    return true
  }

  function shortcutFor(result, managedHotkey) {
    return ShortcutBindingModel.shortcutForResult(result, root.bindings, managedHotkey)
  }

  Process {
    id: keybindingsProcess
    stdout: StdioCollector {
      id: keybindingsOutput
      waitForEnd: true
    }
    onExited: function(exitCode, exitStatus) {
      root.busy = false
      root.ready = true
      if (exitCode !== 0 || exitStatus !== 0) {
        root.error = "Active shortcuts are unavailable"
      } else {
        root.bindings = ShortcutBindingModel.parseBindings(keybindingsOutput.text)
        root.error = ""
      }
      if (root.pendingRefresh) Qt.callLater(root.refresh)
    }
  }

  Component.onCompleted: root.refresh()
}
