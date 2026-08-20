import QtQuick
import Quickshell
import Quickshell.Io
import "StateModel.js" as StateModel

Item {
  id: root

  readonly property string stateHome: Quickshell.env("XDG_STATE_HOME") || (Quickshell.env("HOME") + "/.local/state")
  readonly property string stateDir: stateHome + "/omalauncher"
  readonly property string statePath: stateDir + "/state.json"
  property var snapshot: StateModel.emptyState()
  property bool loaded: false
  property bool directoryReady: false
  property bool dirty: false
  readonly property var favorites: snapshot.favorites || []
  readonly property var usage: snapshot.usage || ({})

  function hydrate(raw) {
    root.snapshot = StateModel.parseState(raw)
    root.loaded = true
  }

  function scheduleSave() {
    root.dirty = true
    if (root.loaded && root.directoryReady) saveTimer.restart()
  }

  function flush() {
    if (!root.loaded || !root.directoryReady || !root.dirty) return
    stateFile.setText(StateModel.serializeState(root.snapshot))
    root.dirty = false
  }

  function isFavorite(id) {
    return StateModel.isFavorite(root.snapshot, id)
  }

  function toggleFavorite(id) {
    root.snapshot = StateModel.toggleFavorite(root.snapshot, id)
    root.scheduleSave()
    return root.isFavorite(id)
  }

  function recordSelection(id) {
    root.snapshot = StateModel.recordUsage(root.snapshot, id, Date.now())
    root.scheduleSave()
  }

  function resetRanking(id) {
    root.snapshot = StateModel.resetUsage(root.snapshot, id)
    root.scheduleSave()
  }

  function emptyRows(records) {
    return StateModel.emptyStateRows(records, root.snapshot, {
      favoriteLimit: 8,
      recentApplicationLimit: 4,
      recentCommandLimit: 4
    })
  }

  Process {
    id: ensureDirectory
    command: ["mkdir", "-p", "--", root.stateDir]
    onExited: function(exitCode, exitStatus) {
      if (exitCode !== 0 || exitStatus !== 0) {
        console.warn("Omalauncher: could not create state directory " + root.stateDir)
        return
      }
      root.directoryReady = true
      stateFile.reload()
      if (root.dirty) saveTimer.restart()
    }
  }

  FileView {
    id: stateFile
    path: root.directoryReady ? root.statePath : ""
    watchChanges: true
    atomicWrites: true
    printErrors: false
    onLoaded: root.hydrate(text())
    onLoadFailed: if (root.directoryReady) root.hydrate("")
    onFileChanged: if (!root.dirty) reload()
  }

  Timer {
    id: saveTimer
    interval: 200
    repeat: false
    onTriggered: root.flush()
  }

  Component.onCompleted: ensureDirectory.running = true
}
