import QtQuick
import Quickshell
import Quickshell.Io

Item {
  id: root
  visible: false

  property string pluginId: ""
  property string sourceUrl: ""
  property string imageSource: ""
  property bool loading: false
  property bool ready: false
  property string error: ""
  property int generation: 0
  property bool requestScheduled: false
  property string cacheDirectory: {
    var xdgCache = String(Quickshell.env("XDG_CACHE_HOME") || "")
    var base = xdgCache || String(Quickshell.env("HOME") || "") + "/.cache"
    return base + "/omalauncher/plugin-previews"
  }
  property string sourcePath: ""
  property string pngPath: ""

  function validPluginId(value) {
    var id = String(value || "")
    return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) && id.indexOf("..") < 0
  }

  function validPreviewUrl(value) {
    var url = String(value || "")
    return /^https:\/\/omarchyplugins\.com\/[A-Za-z0-9._~!$&'()*+,;=:@%\/-]+$/.test(url)
      && url.indexOf("..") < 0
  }

  function cancelProcesses() {
    if (prepareProcess.running) prepareProcess.signal(15)
    if (cacheProcess.running) cacheProcess.signal(15)
    if (fetchProcess.running) fetchProcess.signal(15)
    if (convertProcess.running) convertProcess.signal(15)
  }

  function scheduleRequest() {
    if (root.requestScheduled) return
    root.requestScheduled = true
    Qt.callLater(function() {
      root.requestScheduled = false
      root.beginRequest()
    })
  }

  function beginRequest() {
    root.generation += 1
    var requestGeneration = root.generation
    root.cancelProcesses()
    root.imageSource = ""
    root.loading = false
    root.ready = false
    root.error = ""
    if (!root.validPluginId(root.pluginId) || !root.validPreviewUrl(root.sourceUrl)) return

    var assetName = root.sourceUrl.slice(root.sourceUrl.lastIndexOf("/") + 1)
      .replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 96)
    if (!assetName) return
    var cacheKey = root.pluginId + "-" + assetName
    root.sourcePath = root.cacheDirectory + "/" + cacheKey + ".preview"
    root.pngPath = root.cacheDirectory + "/" + cacheKey + ".png"
    root.loading = true
    prepareProcess.requestGeneration = requestGeneration
    prepareProcess.command = ["mkdir", "-p", root.cacheDirectory]
    prepareProcess.running = true
  }

  function failRequest(requestGeneration, message) {
    if (requestGeneration !== root.generation) return
    root.loading = false
    root.ready = true
    root.error = String(message || "Plugin preview is unavailable")
    console.warn("Omalauncher: " + root.error)
  }

  function showCachedPreview(requestGeneration) {
    if (requestGeneration !== root.generation) return
    root.loading = false
    root.ready = true
    root.error = ""
    root.imageSource = "file://" + root.pngPath
  }

  function startFetch(requestGeneration) {
    if (requestGeneration !== root.generation) return
    fetchProcess.requestGeneration = requestGeneration
    fetchProcess.command = [
      "curl", "--compressed", "--fail", "--location", "--silent", "--show-error",
      "--connect-timeout", "5", "--max-time", "20", "--max-filesize", "8388608",
      "--remove-on-error", "--output", root.sourcePath, root.sourceUrl
    ]
    fetchProcess.running = true
  }

  Process {
    id: prepareProcess
    property int requestGeneration: 0
    onExited: function(exitCode, exitStatus) {
      if (requestGeneration !== root.generation) return
      if (exitCode !== 0 || exitStatus !== 0) {
        root.failRequest(requestGeneration, "Could not prepare the plugin preview cache")
        return
      }
      cacheProcess.requestGeneration = requestGeneration
      cacheProcess.command = ["test", "-s", root.pngPath]
      cacheProcess.running = true
    }
  }

  Process {
    id: cacheProcess
    property int requestGeneration: 0
    onExited: function(exitCode, exitStatus) {
      if (requestGeneration !== root.generation) return
      if (exitCode === 0 && exitStatus === 0) {
        root.showCachedPreview(requestGeneration)
        return
      }
      root.startFetch(requestGeneration)
    }
  }

  Process {
    id: fetchProcess
    property int requestGeneration: 0
    stderr: StdioCollector {
      id: fetchStderr
      waitForEnd: true
    }
    onExited: function(exitCode, exitStatus) {
      if (requestGeneration !== root.generation) return
      if (exitCode !== 0 || exitStatus !== 0) {
        var detail = String(fetchStderr.text || "").trim().replace(/\s+/g, " ")
        root.failRequest(requestGeneration,
          detail.slice(0, 180) || "Could not download the plugin preview")
        return
      }
      convertProcess.requestGeneration = requestGeneration
      convertProcess.command = [
        "magick", root.sourcePath + "[0]", "-auto-orient", "-strip",
        "-thumbnail", "896x504>", root.pngPath
      ]
      convertProcess.running = true
    }
  }

  Process {
    id: convertProcess
    property int requestGeneration: 0
    stderr: StdioCollector {
      id: convertStderr
      waitForEnd: true
    }
    onExited: function(exitCode, exitStatus) {
      if (requestGeneration !== root.generation) return
      if (exitCode !== 0 || exitStatus !== 0) {
        var detail = String(convertStderr.text || "").trim().replace(/\s+/g, " ")
        root.failRequest(requestGeneration,
          detail.slice(0, 180) || "Could not convert the plugin preview")
        return
      }
      Quickshell.execDetached(["rm", "--", root.sourcePath])
      root.showCachedPreview(requestGeneration)
    }
  }

  onPluginIdChanged: root.scheduleRequest()
  onSourceUrlChanged: root.scheduleRequest()
  Component.onCompleted: root.scheduleRequest()
}
