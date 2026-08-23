import QtQuick
import Quickshell.Io
import "../shared/core/src/PluginCatalogModel.js" as PluginCatalogModel

Item {
  id: root
  visible: false

  property var pluginRegistry: null
  property string catalogUrl: "https://omarchyplugins.com/catalog.json"
  property string marketplaceBaseUrl: "https://omarchyplugins.com"
  property var remotePayload: null
  property var catalog: PluginCatalogModel.buildCatalog(null, [], {
    marketplaceBaseUrl: root.marketplaceBaseUrl
  })
  property bool ready: false
  property bool loading: false
  property bool pendingRefresh: false
  property string error: ""
  property double lastLoadedAt: 0

  function installedSnapshot() {
    if (!root.pluginRegistry) return []
    var manifests = root.pluginRegistry.installedPlugins || ({})
    var ids = Object.keys(manifests).sort()
    var output = []
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i]
      var manifest = manifests[id]
      if (!manifest) continue
      var kinds = Array.isArray(manifest.kinds) ? manifest.kinds : []
      var isBarOption = kinds.indexOf("bar") >= 0
      var isBarWidget = kinds.indexOf("bar-widget") >= 0
      var enabled = false
      try {
        enabled = isBarWidget && !isBarOption
          ? root.pluginRegistry.inBar(id) === true
          : root.pluginRegistry.isEnabled(id) === true
      } catch (stateError) { enabled = false }
      var omarchyMetadata = manifest.omarchy || ({})
      output.push({
        id: String(id || ""),
        name: String(manifest.name || id || ""),
        description: String(manifest.description || ""),
        version: String(manifest.version || ""),
        kinds: kinds,
        enabled: enabled,
        canDisable: !isBarOption,
        firstParty: manifest.__isFirstParty === true,
        clonedFrom: String(omarchyMetadata.clonedFrom || ""),
        sourceDir: String(manifest.__sourceDir || "")
      })
    }
    return output
  }

  function rebuildCatalog() {
    root.catalog = PluginCatalogModel.buildCatalog(
      root.remotePayload,
      root.installedSnapshot(),
      { marketplaceBaseUrl: root.marketplaceBaseUrl })
  }

  function refreshInstalled() {
    root.rebuildCatalog()
  }

  function ensureLoaded() {
    if (!root.ready && !root.loading) root.refresh()
  }

  function refresh() {
    if (catalogProcess.running) {
      root.pendingRefresh = true
      return
    }
    root.pendingRefresh = false
    root.loading = true
    catalogProcess.command = [
      "curl", "--compressed", "--fail", "--location", "--silent", "--show-error",
      "--connect-timeout", "5", "--max-time", "15", "--max-filesize", "8388608",
      root.catalogUrl
    ]
    catalogProcess.running = true
  }

  function finishRefresh(exitCode, exitStatus) {
    // Mark the first request settled before loading changes; that signal
    // rebuilds the active route and must not enqueue an identical fetch.
    root.ready = true
    var parsed = null
    var parseError = ""
    if (exitCode === 0 && exitStatus === 0) {
      try { parsed = JSON.parse(catalogStdout.text) }
      catch (error) { parseError = "Plugin catalog returned invalid JSON" }
    }
    if (parsed) {
      var candidate = PluginCatalogModel.buildCatalog(parsed, root.installedSnapshot(), {
        marketplaceBaseUrl: root.marketplaceBaseUrl
      })
      if (!candidate.remoteError) {
        root.remotePayload = parsed
        root.catalog = candidate
        root.error = ""
        root.lastLoadedAt = Date.now()
      } else {
        root.catalog = candidate
        root.error = candidate.remoteError
      }
    } else {
      var detail = String(catalogStderr.text || "").trim().replace(/\s+/g, " ")
      root.error = parseError || detail.slice(0, 220) || "Could not load the plugin catalog"
      root.rebuildCatalog()
      console.warn("OmaLauncher: plugin catalog refresh failed: " + root.error)
    }
    root.loading = false
    if (root.pendingRefresh) Qt.callLater(root.refresh)
  }

  Process {
    id: catalogProcess
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

  Connections {
    target: root.pluginRegistry
    function onPluginsChanged() { Qt.callLater(root.refreshInstalled) }
    function onScanFinished() { Qt.callLater(root.refreshInstalled) }
  }

  onPluginRegistryChanged: Qt.callLater(root.refreshInstalled)
  onMarketplaceBaseUrlChanged: Qt.callLater(root.rebuildCatalog)
  Component.onCompleted: Qt.callLater(root.refreshInstalled)
}
