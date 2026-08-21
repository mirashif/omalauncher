import QtQuick
import Quickshell.Io
import "CalculatorModel.js" as CalculatorModel
import "../services/GenerationModel.js" as GenerationModel

Item {
  id: root
  visible: false

  property bool providerEnabled: true
  property bool backendSettled: false
  property bool backendAvailable: false
  property string backendPath: ""
  property var records: []
  property bool loading: false
  property string error: ""
  property int generation: 0
  property string requestKey: ""
  property string requestedQuery: ""
  property bool requestedStrongMatch: false
  property string expression: ""
  property bool explicitQuery: false

  function clearResult() {
    root.records = []
    root.loading = false
    root.error = ""
  }

  function request(query, strongLauncherMatch) {
    root.requestedQuery = String(query || "")
    root.requestedStrongMatch = strongLauncherMatch === true
    var parsed = CalculatorModel.queryRequest(root.requestedQuery, root.requestedStrongMatch)
    var nextKey = (root.providerEnabled ? "enabled:" : "disabled:") + parsed.key
    if (nextKey === root.requestKey) return
    root.requestKey = nextKey
    root.generation = GenerationModel.next(root.generation)
    debounce.stop()
    if (calculatorProc.running) calculatorProc.signal(15)
    root.expression = parsed.expression
    root.explicitQuery = parsed.explicit
    root.clearResult()
    if (!parsed.active) return
    if (!root.providerEnabled) {
      root.records = parsed.explicit ? [CalculatorModel.disabledRecord()] : []
      return
    }
    if (!parsed.expression) {
      root.records = [CalculatorModel.readyRecord()]
      return
    }
    if (!root.backendSettled) {
      root.loading = true
      root.records = parsed.explicit ? [CalculatorModel.loadingRecord(parsed.expression)] : []
      return
    }
    if (!root.backendAvailable) {
      root.records = parsed.explicit ? [CalculatorModel.unavailableRecord(parsed.expression)] : []
      root.error = parsed.explicit ? "Calculator requires qalc" : ""
      return
    }
    root.loading = true
    root.records = parsed.explicit ? [CalculatorModel.loadingRecord(parsed.expression)] : []
    debounce.restart()
  }

  function retryCurrentRequest() {
    root.requestKey = ""
    root.request(root.requestedQuery, root.requestedStrongMatch)
  }

  Process {
    id: availabilityProc
    property string output: ""
    command: ["which", "qalc"]
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
    interval: 90
    repeat: false
    onTriggered: {
      if (!root.providerEnabled || !root.backendAvailable || !root.expression) {
        root.loading = false
        return
      }
      if (calculatorProc.running) {
        calculatorProc.signal(15)
        debounce.restart()
        return
      }
      calculatorProc.output = ""
      calculatorProc.errorOutput = ""
      calculatorProc.generation = root.generation
      calculatorProc.command = [root.backendPath, "-t", "--", root.expression]
      calculatorProc.running = true
    }
  }

  Process {
    id: calculatorProc
    property int generation: 0
    property string output: ""
    property string errorOutput: ""
    stdout: SplitParser {
      onRead: function(data) { calculatorProc.output += data + "\n" }
    }
    stderr: SplitParser {
      onRead: function(data) { calculatorProc.errorOutput += data + "\n" }
    }
    onExited: function(exitCode, exitStatus) {
      var current = calculatorProc.generation === root.generation
      if (!current) return
      root.loading = false
      var record = exitCode === 0 && exitStatus === 0
        ? CalculatorModel.resultRecord(root.expression, calculatorProc.output) : null
      if (record) {
        root.records = [record]
        root.error = ""
      } else {
        root.error = root.explicitQuery
          ? (String(calculatorProc.errorOutput || "").trim() || "Invalid calculator expression")
          : ""
        root.records = root.explicitQuery
          ? [CalculatorModel.errorRecord(root.expression, root.error)] : []
      }
    }
  }

  onProviderEnabledChanged: root.retryCurrentRequest()
  Component.onCompleted: availabilityProc.running = true
}
