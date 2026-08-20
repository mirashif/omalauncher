import QtQuick
import Quickshell.Io
import "CommandCatalogModel.js" as CommandCatalogModel

Item {
  id: root
  visible: false

  property string omarchyPath: "/usr/share/omarchy"
  readonly property string binPath: root.omarchyPath + "/bin"
  property var records: []
  property var commands: []
  property bool ready: false
  property bool loading: false
  property bool pendingRefresh: false
  property string error: ""
  property double lastLoadedAt: 0

  function refresh() {
    if (catalogProcess.running) {
      root.pendingRefresh = true
      return
    }
    root.pendingRefresh = false
    root.loading = true
    catalogProcess.running = true
  }

  function refreshIfStale() {
    if (!root.ready || root.error || Date.now() - root.lastLoadedAt > 60000)
      root.refresh()
  }

  function finishRefresh(exitCode, exitStatus) {
    root.loading = false
    var parsed = CommandCatalogModel.parseCatalog(catalogStdout.text)
    if (exitCode === 0 && exitStatus === 0 && !parsed.error) {
      root.commands = parsed.commands
      root.records = CommandCatalogModel.buildRecords(parsed.commands)
      root.error = ""
      root.lastLoadedAt = Date.now()
    } else {
      var detail = String(catalogStderr.text || "").trim()
      root.error = parsed.error || detail || "Could not load the Omarchy CLI catalog"
      console.warn("Omalauncher: CLI catalog refresh failed: " + root.error)
    }
    root.ready = true
    if (root.pendingRefresh)
      Qt.callLater(root.refresh)
  }

  Process {
    id: catalogProcess
    command: ["omarchy", "commands", "--json"]
    stdout: StdioCollector {
      id: catalogStdout
      waitForEnd: true
    }
    stderr: StdioCollector {
      id: catalogStderr
      waitForEnd: true
    }
    onExited: function(exitCode, exitStatus) {
      root.finishRefresh(exitCode, exitStatus)
    }
  }

  Timer {
    id: catalogDebounce
    interval: 220
    repeat: false
    onTriggered: root.refresh()
  }

  Process {
    id: catalogWatcher
    command: [
      "inotifywait", "-m", "-q",
      "-e", "close_write,create,delete,move",
      "--format", "%e", root.binPath
    ]
    stdout: SplitParser {
      onRead: function(data) { catalogDebounce.restart() }
    }
    onExited: function(exitCode) {
      if (exitCode !== 0)
        watcherRestart.restart()
    }
  }

  Timer {
    id: watcherRestart
    interval: 2000
    repeat: false
    onTriggered: {
      if (!catalogWatcher.running)
        catalogWatcher.running = true
    }
  }

  onBinPathChanged: {
    if (catalogWatcher.running)
      catalogWatcher.running = false
    watcherRestart.restart()
  }

  Component.onCompleted: {
    root.refresh()
    catalogWatcher.running = true
  }
}
