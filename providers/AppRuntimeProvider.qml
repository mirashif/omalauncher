import Quickshell.Io
import QtQuick
import "AppRuntimeModel.js" as AppRuntimeModel

// Refreshes Hyprland state immediately before acting, closes only exact window
// addresses, and verifies exit before Quit/Restart is considered complete.
Item {
  id: root
  visible: false

  property var snapshot: AppRuntimeModel.emptySnapshot()
  property bool busy: false
  property string operation: ""
  property string targetAppId: ""
  property string targetStartupClass: ""
  property string targetTitle: ""
  property var closeQueue: []
  property int closeIndex: 0
  property double verificationDeadline: 0

  signal quitCompleted(string appId, string title)
  signal restartReady(string appId, string title)
  signal actionFailed(string operation, string appId, string message)

  function matchesTarget(appId, startupClass) {
    return AppRuntimeModel.matchesTarget(root.snapshot, appId, startupClass)
  }

  function inspect(appId, startupClass, title) {
    if (root.busy || statusProcess.running || closeProcess.running) return false
    root.targetAppId = String(appId || "")
    root.targetStartupClass = String(startupClass || "")
    root.targetTitle = String(title || root.targetAppId)
    root.busy = true
    return root.startStatus("inspect")
  }

  function requestAction(action, appId, startupClass, title) {
    var requested = String(action || "")
    if ((requested !== "quit" && requested !== "restart") || root.busy) return false
    root.targetAppId = String(appId || "")
    root.targetStartupClass = String(startupClass || "")
    root.targetTitle = String(title || root.targetAppId)
    root.closeQueue = []
    root.closeIndex = 0
    root.busy = true
    return root.startStatus("prepare-" + requested)
  }

  function startStatus(mode) {
    if (statusProcess.running) return false
    root.operation = mode
    statusProcess.output = ""
    statusProcess.command = ["hyprctl", "clients", "-j"]
    statusProcess.running = true
    return true
  }

  function fail(message) {
    var failedOperation = root.operation.indexOf("restart") >= 0 ? "restart" : "quit"
    var appId = root.targetAppId
    root.busy = false
    root.operation = ""
    root.closeQueue = []
    root.closeIndex = 0
    root.actionFailed(failedOperation, appId, String(message || "Application action failed"))
  }

  function beginClose(state) {
    root.closeQueue = state.windows.map(function(window) { return String(window.address || "") })
    root.closeIndex = 0
    root.closeNext()
  }

  function closeNext() {
    if (root.closeIndex >= root.closeQueue.length) {
      root.verificationDeadline = Date.now() + 5000
      root.operation = root.operation === "prepare-restart" ? "verify-restart" : "verify-quit"
      verificationTimer.restart()
      return
    }
    var expression = AppRuntimeModel.closeExpression(root.closeQueue[root.closeIndex])
    if (!expression) {
      root.fail("Hyprland returned an invalid window address")
      return
    }
    closeProcess.command = ["hyprctl", "dispatch", expression]
    closeProcess.running = true
  }

  function finishVerified() {
    var mode = root.operation
    var appId = root.targetAppId
    var title = root.targetTitle
    root.busy = false
    root.operation = ""
    root.closeQueue = []
    root.closeIndex = 0
    if (mode === "verify-restart") root.restartReady(appId, title)
    else root.quitCompleted(appId, title)
  }

  Process {
    id: statusProcess
    property string output: ""
    stdout: SplitParser {
      onRead: function(data) { statusProcess.output += data + "\n" }
    }
    onExited: function(exitCode, exitStatus) {
      if (exitCode !== 0 || exitStatus !== 0) {
        if (root.operation === "inspect") {
          root.snapshot = AppRuntimeModel.emptySnapshot()
          root.busy = false
          root.operation = ""
        } else root.fail("Could not inspect Hyprland windows")
        return
      }
      var state = AppRuntimeModel.runtimeSnapshot(
        statusProcess.output, root.targetAppId, root.targetStartupClass)
      root.snapshot = state
      if (root.operation === "inspect") {
        root.busy = false
        root.operation = ""
        return
      }
      if (!state.supported) {
        root.fail(state.error || "Could not identify this application's windows")
        return
      }
      if (root.operation === "prepare-quit" || root.operation === "prepare-restart") {
        if (!state.running) {
          root.fail("Application is no longer running")
          return
        }
        root.beginClose(state)
        return
      }
      if (root.operation === "verify-quit" || root.operation === "verify-restart") {
        var remainingAddresses = AppRuntimeModel.presentAddresses(
          statusProcess.output, root.closeQueue)
        if (!state.running && remainingAddresses.length === 0) {
          root.finishVerified()
        } else if (Date.now() >= root.verificationDeadline) {
          root.fail("Application did not close within five seconds")
        } else {
          verificationTimer.restart()
        }
      }
    }
  }

  Process {
    id: closeProcess
    onExited: function(exitCode, exitStatus) {
      if (exitCode !== 0 || exitStatus !== 0) {
        root.fail("Hyprland could not close an application window")
        return
      }
      root.closeIndex += 1
      root.closeNext()
    }
  }

  Timer {
    id: verificationTimer
    interval: 200
    repeat: false
    onTriggered: root.startStatus(root.operation)
  }
}
