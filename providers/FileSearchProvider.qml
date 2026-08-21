import QtQuick
import Quickshell
import Quickshell.Io
import "FileSearchModel.js" as FileSearchModel
import "../services/GenerationModel.js" as GenerationModel

Item {
  id: root
  visible: false

  property bool providerEnabled: false
  property bool backendSettled: false
  property bool backendAvailable: false
  property string backendPath: ""
  property var records: []
  property bool loading: false
  property string error: ""
  property int generation: 0
  property string requestKey: ""
  property string query: ""
  property var scopes: []
  property var ignores: []
  property var commonScopes: []
  property bool activeRequest: false
  property bool timedOut: false
  readonly property int resultLimit: 100

  function request(queryValue, scopeValues, ignoreValues, active) {
    var nextQuery = String(queryValue || "").trim()
    var nextScopes = Array.isArray(scopeValues) ? scopeValues : []
    var nextIgnores = Array.isArray(ignoreValues) ? ignoreValues : []
    var nextKey = JSON.stringify([
      root.providerEnabled,
      active === true,
      nextQuery,
      nextScopes,
      nextIgnores,
      root.backendSettled,
      root.backendAvailable
    ])
    if (nextKey === root.requestKey) return
    root.requestKey = nextKey
    root.generation = GenerationModel.next(root.generation)
    root.query = nextQuery
    root.scopes = nextScopes
    root.ignores = nextIgnores
    root.activeRequest = active === true
    root.loading = false
    root.error = ""
    root.timedOut = false
    debounce.stop()
    timeout.stop()
    if (searchProc.running) searchProc.signal(15)
    if (canonicalizeProc.running) canonicalizeProc.signal(15)
    root.records = []

    if (!root.activeRequest) return
    if (!root.providerEnabled) {
      root.records = [FileSearchModel.statusRecord(
        "disabled", "File Search Disabled", "Enable it in Omalauncher Settings", "settings")]
      return
    }
    if (root.scopes.length === 0) {
      root.records = [FileSearchModel.statusRecord(
        "unconfigured", "No File Search Scopes", "Add a directory in Omalauncher Settings", "settings")]
      return
    }
    if (!root.backendSettled) {
      root.loading = true
      root.records = [FileSearchModel.statusRecord("loading", "Checking File Search…", "Looking for fd", "")]
      return
    }
    if (!root.backendAvailable) {
      root.records = [FileSearchModel.statusRecord(
        "unavailable", "File Search Unavailable", "Install fd to enable scoped search", "settings")]
      return
    }
    if (!root.query) {
      root.records = [FileSearchModel.statusRecord(
        "ready", "Type to Search Files",
        "Search here, or from Root Search type f report · "
          + root.scopes.length + " configured scope" + (root.scopes.length === 1 ? "" : "s"), "")]
      return
    }
    root.loading = true
    root.records = [FileSearchModel.statusRecord("loading", "Searching Files…", root.query, "")]
    debounce.restart()
  }

  function retryCurrentRequest() {
    root.requestKey = ""
    root.request(root.query, root.scopes, root.ignores, root.activeRequest)
  }

  Process {
    id: availabilityProc
    property string output: ""
    command: ["which", "fd"]
    stdout: SplitParser {
      onRead: function(data) { availabilityProc.output += data }
    }
    onExited: function(exitCode, exitStatus) {
      root.backendPath = String(availabilityProc.output || "").trim()
      root.backendAvailable = exitCode === 0 && exitStatus === 0 && root.backendPath.length > 0
      root.backendSettled = true
      root.retryCurrentRequest()
    }
  }

  Timer {
    id: debounce
    interval: 120
    repeat: false
    onTriggered: {
      if (!root.activeRequest || !root.providerEnabled || !root.backendAvailable || !root.query) return
      if (searchProc.running) {
        searchProc.signal(15)
        debounce.restart()
        return
      }
      if (canonicalizeProc.running) {
        canonicalizeProc.signal(15)
        debounce.restart()
        return
      }
      searchProc.paths = []
      searchProc.errorOutput = ""
      searchProc.generation = root.generation
      searchProc.command = FileSearchModel.commandArguments(
        root.backendPath, root.query, root.scopes, root.ignores, root.resultLimit)
      searchProc.running = true
      timeout.restart()
    }
  }

  Timer {
    id: timeout
    interval: 1500
    repeat: false
    onTriggered: {
      if (searchProc.generation !== root.generation
          && canonicalizeProc.generation !== root.generation) return
      root.timedOut = true
      if (searchProc.running) searchProc.signal(15)
      if (canonicalizeProc.running) canonicalizeProc.signal(15)
    }
  }

  function finishSearch(paths, exitCode, exitStatus, errorOutput, didTimeOut) {
    root.loading = false
    var fileRecords = FileSearchModel.recordsForPaths(
      paths, root.query, root.scopes, root.resultLimit)
    if (fileRecords.length > 0) {
      root.records = fileRecords
      root.error = didTimeOut ? "File search timed out; showing partial results" : ""
      return
    }
    if (didTimeOut) {
      root.error = "File search timed out"
      root.records = [FileSearchModel.statusRecord("error", "File Search Timed Out", root.error, "")]
    } else if (exitCode !== 0 || exitStatus !== 0) {
      root.error = String(errorOutput || "").trim() || "File search failed"
      root.records = [FileSearchModel.statusRecord("error", "File Search Failed", root.error, "")]
    } else {
      root.error = ""
      root.records = [FileSearchModel.statusRecord("empty", "No Matching Files", root.query, "")]
    }
  }

  Process {
    id: searchProc
    property int generation: 0
    property var paths: []
    property string errorOutput: ""
    stdout: SplitParser {
      splitMarker: "\0"
      onRead: function(data) {
        if (searchProc.paths.length < root.resultLimit) {
          searchProc.paths = searchProc.paths.concat([String(data || "")])
        }
      }
    }
    stderr: SplitParser {
      onRead: function(data) { searchProc.errorOutput += data + "\n" }
    }
    onExited: function(exitCode, exitStatus) {
      timeout.stop()
      if (searchProc.generation !== root.generation) return
      if (searchProc.paths.length > 0) {
        canonicalizeProc.generation = searchProc.generation
        canonicalizeProc.sourceExitCode = exitCode
        canonicalizeProc.sourceExitStatus = exitStatus
        canonicalizeProc.sourceError = searchProc.errorOutput
        canonicalizeProc.sourceTimedOut = root.timedOut
        canonicalizeProc.paths = []
        canonicalizeProc.errorOutput = ""
        canonicalizeProc.command = FileSearchModel.canonicalizeArguments(
          "realpath", searchProc.paths, root.resultLimit)
        canonicalizeProc.running = true
        timeout.restart()
        return
      }
      root.finishSearch([], exitCode, exitStatus, searchProc.errorOutput, root.timedOut)
    }
  }

  Process {
    id: canonicalizeProc
    property int generation: 0
    property int sourceExitCode: 0
    property int sourceExitStatus: 0
    property bool sourceTimedOut: false
    property var paths: []
    property string sourceError: ""
    property string errorOutput: ""
    stdout: SplitParser {
      splitMarker: "\0"
      onRead: function(data) {
        if (canonicalizeProc.paths.length < root.resultLimit) {
          canonicalizeProc.paths = canonicalizeProc.paths.concat([String(data || "")])
        }
      }
    }
    stderr: SplitParser {
      onRead: function(data) { canonicalizeProc.errorOutput += data + "\n" }
    }
    onExited: function(exitCode, exitStatus) {
      timeout.stop()
      if (canonicalizeProc.generation !== root.generation) return
      var errorMessage = canonicalizeProc.sourceError || canonicalizeProc.errorOutput
      var failed = canonicalizeProc.sourceExitCode !== 0 || canonicalizeProc.sourceExitStatus !== 0
        || (canonicalizeProc.paths.length === 0 && (exitCode !== 0 || exitStatus !== 0))
      root.finishSearch(
        canonicalizeProc.paths,
        failed ? 1 : 0,
        failed ? 1 : 0,
        errorMessage,
        canonicalizeProc.sourceTimedOut || root.timedOut)
    }
  }

  Process {
    id: commonScopeProc
    property var paths: []
    command: ["find", Quickshell.env("HOME"), "-mindepth", "1", "-maxdepth", "1", "-type", "d", "-print0"]
    stdout: SplitParser {
      splitMarker: "\0"
      onRead: function(data) { commonScopeProc.paths = commonScopeProc.paths.concat([String(data || "")]) }
    }
    onExited: function(exitCode, exitStatus) {
      if (exitCode !== 0 || exitStatus !== 0) return
      var names = ["Desktop", "Documents", "Downloads", "Developer", "Projects", "Code", "Music", "Pictures", "Videos"]
      var matches = []
      for (var index = 0; index < commonScopeProc.paths.length; index++) {
        var path = String(commonScopeProc.paths[index] || "")
        var order = names.indexOf(FileSearchModel.basename(path))
        if (order >= 0) matches.push({ path: path, order: order })
      }
      matches.sort(function(left, right) { return left.order - right.order })
      root.commonScopes = matches.map(function(entry) { return entry.path })
    }
  }

  onProviderEnabledChanged: root.retryCurrentRequest()
  Component.onCompleted: {
    availabilityProc.running = true
    commonScopeProc.running = true
  }
}
