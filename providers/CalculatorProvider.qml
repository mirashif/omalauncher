import QtQuick
import "CalculatorModel.js" as CalculatorModel

Item {
  id: root
  visible: false

  property bool providerEnabled: true
  property var records: []
  property bool loading: false
  property string error: ""
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

    var evaluation = CalculatorModel.evaluate(parsed.expression)
    var record = evaluation.ok
      ? CalculatorModel.resultRecord(parsed.expression, evaluation.result) : null
    if (record) {
      root.records = [record]
      return
    }
    root.error = parsed.explicit ? evaluation.error : ""
    root.records = parsed.explicit
      ? [CalculatorModel.errorRecord(parsed.expression, root.error)] : []
  }

  function retryCurrentRequest() {
    root.requestKey = ""
    root.request(root.requestedQuery, root.requestedStrongMatch)
  }

  onProviderEnabledChanged: root.retryCurrentRequest()
}
