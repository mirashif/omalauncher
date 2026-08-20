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
  property string error: ""
  readonly property var favorites: snapshot.favorites || []
  readonly property var usage: snapshot.usage || ({})
  readonly property var aliases: snapshot.aliases || ({})
  readonly property var hidden: snapshot.hidden || []
  readonly property var queryHistory: snapshot.queryHistory || []
  readonly property var preferences: snapshot.preferences || ({ compactMode: false })

  function hydrate(raw) {
    var parsed = StateModel.parseStateResult(raw)
    root.snapshot = parsed.state
    root.error = parsed.error
    if (parsed.error) console.warn("Omalauncher: " + parsed.error + " at " + root.statePath)
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

  function moveFavorite(id, delta) {
    root.snapshot = StateModel.moveFavorite(root.snapshot, id, delta)
    root.scheduleSave()
  }

  function recordSelection(id) {
    root.snapshot = StateModel.recordUsage(root.snapshot, id, Date.now())
    root.scheduleSave()
  }

  function resetRanking(id) {
    root.snapshot = StateModel.resetUsage(root.snapshot, id)
    root.scheduleSave()
  }

  function aliasFor(id) {
    return StateModel.aliasFor(root.snapshot, id)
  }

  function setAlias(id, value) {
    root.snapshot = StateModel.setAlias(root.snapshot, id, value)
    root.scheduleSave()
    return root.aliasFor(id)
  }

  function isHidden(id) {
    return StateModel.isHidden(root.snapshot, id)
  }

  function setHidden(id, hiddenValue) {
    root.snapshot = StateModel.setHidden(root.snapshot, id, hiddenValue)
    root.scheduleSave()
    return root.isHidden(id)
  }

  function recordQuery(value) {
    root.snapshot = StateModel.recordQuery(root.snapshot, value)
    root.scheduleSave()
  }

  function clearQueryHistory() {
    root.snapshot = StateModel.clearQueryHistory(root.snapshot)
    root.scheduleSave()
  }

  function setCompactMode(enabled) {
    root.snapshot = StateModel.setCompactMode(root.snapshot, enabled)
    root.scheduleSave()
  }

  function emptyRows(records) {
    return StateModel.emptyStateRows(records, root.snapshot, {
      recentApplicationLimit: 4,
      recentCommandLimit: 4
    })
  }

  Process {
    id: ensureDirectory
    command: ["mkdir", "-p", "--", root.stateDir]
    onExited: function(exitCode, exitStatus) {
      if (exitCode !== 0 || exitStatus !== 0) {
        root.error = "Favorites and usage history are unavailable"
        root.loaded = true
        console.warn("Omalauncher: could not create state directory " + root.stateDir + "; using in-memory state")
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
    onSaved: root.error = ""
    onSaveFailed: {
      root.error = "Favorites and usage history could not be saved"
      console.warn("Omalauncher: state save failed at " + root.statePath)
    }
  }

  Timer {
    id: saveTimer
    interval: 200
    repeat: false
    onTriggered: root.flush()
  }

  Component.onCompleted: ensureDirectory.running = true
}
