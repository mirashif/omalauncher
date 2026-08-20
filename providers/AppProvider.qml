import Quickshell
import QtQuick
import "AppIndex.js" as AppIndex

// Adapter around Omarchy's shared AppLibrary. All internal API usage lives in
// this file so a future shell change does not leak through the launcher.
Item {
  id: root
  visible: false

  property var appLibrary: null
  property var records: []
  property bool ready: false
  property string error: ""
  readonly property bool usingSharedLibrary: appLibrary !== null && appLibrary !== undefined

  function sourceEntries() {
    var entries = []
    if (root.usingSharedLibrary && typeof root.appLibrary.sortedEntries === "function") {
      var rows = root.appLibrary.sortedEntries("") || []
      for (var i = 0; i < rows.length; i++) {
        if (rows[i] && rows[i].entry) entries.push(rows[i].entry)
      }
      return entries
    }

    try {
      var values = DesktopEntries.applications.values || []
      for (var j = 0; j < values.length; j++) entries.push(values[j])
    } catch (sourceError) {
      root.error = "Installed applications are unavailable"
      console.warn("Omalauncher: DesktopEntries fallback failed: " + sourceError)
    }
    return entries
  }

  function refresh() {
    root.error = ""
    try {
      root.records = AppIndex.buildApplicationRecords(root.sourceEntries())
      root.ready = true
    } catch (refreshError) {
      root.records = []
      root.ready = true
      root.error = "Could not build the application index"
      console.warn("Omalauncher: application index failed: " + refreshError)
    }
  }

  function refreshIcons() {
    if (root.usingSharedLibrary && typeof root.appLibrary.refreshIcons === "function") {
      root.appLibrary.refreshIcons()
    }
  }

  function iconSource(icon) {
    if (root.usingSharedLibrary && typeof root.appLibrary.iconSource === "function") {
      return root.appLibrary.iconSource(icon)
    }
    var value = String(icon || "")
    if (value.indexOf("file://") === 0 || value.indexOf("image://") === 0) return value
    if (value.charAt(0) === "/") return "file://" + value
    var source = Quickshell.iconPath(value || "application-x-executable", true)
    return source || Quickshell.iconPath("application-x-executable", true)
  }

  function launch(appId, title) {
    var id = AppIndex.normalizeDesktopId(appId)
    if (!id) return false
    if (root.usingSharedLibrary && typeof root.appLibrary.launch === "function") {
      root.appLibrary.launch(id, title)
      return true
    }

    var entry = null
    try { entry = DesktopEntries.byId(id) } catch (firstError) { }
    if (!entry) {
      try { entry = DesktopEntries.byId(id + ".desktop") } catch (secondError) { }
    }
    if (!entry || typeof entry.execute !== "function") {
      console.warn("Omalauncher: application entry disappeared before launch: " + id)
      root.refresh()
      return false
    }
    entry.execute()
    return true
  }

  onAppLibraryChanged: root.refresh()

  Connections {
    target: root.appLibrary
    function onAppsChanged() { root.refresh() }
  }

  Connections {
    target: DesktopEntries.applications
    function onValuesChanged() {
      if (!root.usingSharedLibrary) root.refresh()
    }
  }

  Component.onCompleted: root.refresh()
}
