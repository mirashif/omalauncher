import QtQuick
import "ShellPluginModel.js" as ShellPluginModel

Item {
  id: root
  visible: false

  property var shell: null
  property var pluginRegistry: null
  property string launcherId: ""
  property var records: []
  property bool ready: false
  property string error: ""

  function refresh() {
    if (!root.pluginRegistry) {
      root.records = []
      root.ready = true
      root.error = "Shell features are unavailable"
      return
    }
    if (root.pluginRegistry.scanning === true && Object.keys(root.pluginRegistry.installedPlugins || {}).length === 0) {
      root.ready = false
      root.error = ""
      return
    }

    try {
      var manifests = root.pluginRegistry.installedPlugins || {}
      var ids = Object.keys(manifests)
      var enabledIds = {}
      var panelIds = {}

      for (var i = 0; i < ids.length; i++) {
        var id = ids[i]
        enabledIds[id] = root.pluginRegistry.isEnabled(id) === true
        var kinds = manifests[id] && manifests[id].kinds
        if (!Array.isArray(kinds) || kinds.indexOf("bar-widget") < 0)
          continue
        try {
          panelIds[id] = !!(root.shell && root.shell.bar
            && typeof root.shell.bar.findPanelWidget === "function"
            && root.shell.bar.findPanelWidget(id))
        } catch (panelError) {
          panelIds[id] = false
        }
      }

      root.records = ShellPluginModel.buildRecords(manifests, {
        enabledIds: enabledIds,
        panelIds: panelIds,
        launcherId: root.launcherId
      })
      root.error = ""
      root.ready = true
    } catch (refreshError) {
      root.records = []
      root.error = "Could not build the shell feature index"
      root.ready = true
      console.warn("Omalauncher: shell feature index failed: " + refreshError)
    }
  }

  onShellChanged: Qt.callLater(root.refresh)
  onPluginRegistryChanged: Qt.callLater(root.refresh)
  onLauncherIdChanged: Qt.callLater(root.refresh)

  Connections {
    target: root.pluginRegistry
    function onPluginsChanged() { Qt.callLater(root.refresh) }
    function onScanFinished() { Qt.callLater(root.refresh) }
  }

  Component.onCompleted: Qt.callLater(root.refresh)
}
