import Quickshell
import Quickshell.Hyprland
import Quickshell.Io
import Quickshell.Wayland
import QtQuick
import qs.Commons
import "providers/MenuIndex.js" as MenuIndex
import "SearchEngine.js" as SearchEngine

Item {
  id: root

  // Injected by omarchy-shell.
  property string omarchyPath: Quickshell.env("OMARCHY_PATH")
  property var shell: null
  property var manifest: null

  property bool opened: false
  property bool defaultSourceLoaded: false
  property var defaultMenuItems: []
  property var userMenuItems: []
  property var menuItems: ({})
  property var menuOrder: []
  property var whenResults: ({})
  property var checkedResults: ({})
  property var commandRecords: []
  property int selectedIndex: 0
  property bool guardsPending: false
  property bool guardsReady: false
  property string sourceError: ""

  readonly property string pluginId: manifest && manifest.id
    ? String(manifest.id) : "io.github.omalauncher"
  readonly property string defaultMenuPath: omarchyPath + "/default/omarchy/omarchy-menu.jsonc"
  readonly property string userMenuPath: Quickshell.env("HOME") + "/.config/omarchy/extensions/omarchy-menu.jsonc"
  readonly property color background: Color.menu.background
  readonly property color foreground: Color.menu.text
  readonly property color borderColor: Color.menu.border
  readonly property color scrim: Color.menu.scrim
  readonly property color selectedBackground: Color.menu.selectedBackground
  readonly property color selectedText: Color.menu.selectedText
  readonly property int rowHeight: Math.max(Style.space(58), Style.font.body + Style.font.caption + Style.space(22))
  readonly property int maximumVisibleRows: 8
  readonly property int listHeight: Math.max(rowHeight, Math.min(maximumVisibleRows, Math.max(1, resultsModel.count)) * rowHeight)

  function focusedScreen() {
    var monitor = Hyprland.focusedMonitor
    var name = monitor ? String(monitor.name || "") : ""
    var screens = Quickshell.screens || []
    for (var i = 0; i < screens.length; i++) {
      if (String(screens[i].name || "") === name) return screens[i]
    }
    return null
  }

  function open(payloadJson) {
    var payload = ({})
    try { payload = JSON.parse(payloadJson || "{}") } catch (error) { payload = ({}) }
    var targetScreen = root.focusedScreen()
    if (targetScreen) panel.screen = targetScreen
    root.opened = true
    searchInput.text = String(payload.query || "")
    root.selectedIndex = 0
    root.rebuildResults()
    root.evaluateGuards()
    Qt.callLater(function() { searchInput.forceActiveFocus() })
  }

  function close() {
    root.opened = false
    searchInput.text = ""
    root.selectedIndex = 0
  }

  function dismiss() {
    root.close()
    if (root.shell && typeof root.shell.hide === "function") {
      Qt.callLater(function() { root.shell.hide(root.pluginId) })
    }
  }

  function refresh() {
    defaultMenuFile.reload()
    userMenuFile.reload()
    return "ok"
  }

  function ping() { return "ok" }

  function applyParsedSource(parsed, isDefault) {
    if (parsed.error) {
      var sourceName = isDefault ? root.defaultMenuPath : root.userMenuPath
      console.warn("Omalauncher: menu JSONC parse failed at " + sourceName + ": " + parsed.error)
      root.sourceError = "Could not parse " + sourceName
      if (isDefault) root.defaultMenuItems = []
      else root.userMenuItems = []
    } else {
      if (isDefault) {
        root.defaultMenuItems = parsed.items
        root.defaultSourceLoaded = true
      } else {
        root.userMenuItems = parsed.items
      }
      root.sourceError = ""
    }
    root.rebuildMenu()
  }

  function rebuildMenu() {
    if (!root.defaultSourceLoaded) return
    var merged = MenuIndex.mergeMenuSources(root.defaultMenuItems, root.userMenuItems)
    root.menuItems = merged.items
    root.menuOrder = merged.itemOrder
    root.guardsReady = false
    root.rebuildCommandRecords()
    root.evaluateGuards()
  }

  function rebuildCommandRecords() {
    var merged = { items: root.menuItems, itemOrder: root.menuOrder }
    root.commandRecords = MenuIndex.buildCommandRecords(merged, root.whenResults)
    root.rebuildResults()
  }

  function rebuildResults() {
    resultsModel.clear()
    var query = String(searchInput.text || "").trim()
    if (!query) {
      root.selectedIndex = 0
      return
    }

    var results = SearchEngine.search(root.commandRecords, query, { limit: 50 })
    for (var i = 0; i < results.length; i++) {
      var result = results[i]
      resultsModel.append({
        resultId: String(result.id || ""),
        resultKind: String(result.kind || ""),
        title: String(result.title || ""),
        breadcrumb: String(result.breadcrumb || ""),
        description: String(result.description || ""),
        icon: String(result.icon || ""),
        iconFont: String(result.iconFont || ""),
        route: String(result.route || ""),
        parentRoute: String(result.parentRoute || "root"),
        semanticTier: Number(result.semanticTier || 0)
      })
    }

    if (resultsModel.count === 0) root.selectedIndex = 0
    else root.selectedIndex = Math.max(0, Math.min(root.selectedIndex, resultsModel.count - 1))
    Qt.callLater(root.revealSelection)
  }

  function moveSelection(delta) {
    if (resultsModel.count === 0) return
    root.selectedIndex = (root.selectedIndex + delta + resultsModel.count) % resultsModel.count
    root.revealSelection()
  }

  function revealSelection() {
    if (resultsModel.count > 0) resultList.positionViewAtIndex(root.selectedIndex, ListView.Contain)
  }

  function runRoute(route) {
    var selectedRoute = String(route || "")
    if (!selectedRoute) return
    root.close()
    if (root.shell && typeof root.shell.hide === "function") root.shell.hide(root.pluginId)
    Quickshell.execDetached(["omarchy", "menu", "summon", selectedRoute])
  }

  function runSelected(useParent) {
    if (resultsModel.count === 0 || root.selectedIndex < 0 || root.selectedIndex >= resultsModel.count) return
    var row = resultsModel.get(root.selectedIndex)
    root.runRoute(useParent ? row.parentRoute : row.route)
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
  }

  function escapeRegex(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  }

  function highlightedBreadcrumb(value) {
    var output = root.escapeHtml(value)
    var queryTerms = SearchEngine.tokens(searchInput.text)
    for (var i = 0; i < queryTerms.length; i++) {
      var term = queryTerms[i]
      if (!term) continue
      output = output.replace(new RegExp("(" + root.escapeRegex(term) + "[a-z0-9]*)", "ig"), "<b>$1</b>")
    }
    return output
  }

  function evaluateGuards() {
    if (!root.defaultSourceLoaded) return
    if (guardProc.running) {
      root.guardsPending = true
      return
    }
    root.guardsPending = false
    var script = MenuIndex.guardScript(root.menuItems)
    if (!script) {
      root.whenResults = ({})
      root.checkedResults = ({})
      root.guardsReady = true
      root.rebuildCommandRecords()
      return
    }
    guardProc.collected = ""
    guardProc.command = ["bash", "-lc", script]
    guardProc.running = true
  }

  ListModel { id: resultsModel }

  FileView {
    id: defaultMenuFile
    path: root.defaultMenuPath
    watchChanges: true
    printErrors: false
    onLoaded: root.applyParsedSource(MenuIndex.parseMenuJsonc(text()), true)
    onLoadFailed: function(error) {
      root.defaultSourceLoaded = false
      root.sourceError = "Could not load the Omarchy menu definition"
      console.warn("Omalauncher: default menu load failed: " + error)
    }
    onFileChanged: reload()
  }

  FileView {
    id: userMenuFile
    path: root.userMenuPath
    watchChanges: true
    printErrors: false
    onLoaded: root.applyParsedSource(MenuIndex.parseMenuJsonc(text()), false)
    onLoadFailed: {
      root.userMenuItems = []
      root.rebuildMenu()
    }
    onFileChanged: reload()
  }

  Process {
    id: guardProc
    property string collected: ""
    stdout: SplitParser {
      onRead: function(data) { guardProc.collected += data + "\n" }
    }
    onExited: function(exitCode, exitStatus) {
      if (exitCode === 0 && exitStatus === 0) {
        var parsed = MenuIndex.parseGuardResults(guardProc.collected)
        root.whenResults = parsed.when
        root.checkedResults = parsed.checked
        root.guardsReady = true
        root.rebuildCommandRecords()
      } else {
        console.warn("Omalauncher: menu visibility batch failed; retaining the last complete result")
      }
      if (root.guardsPending) Qt.callLater(root.evaluateGuards)
    }
  }

  PanelWindow {
    id: panel
    visible: root.opened && root.defaultSourceLoaded
    anchors { top: true; bottom: true; left: true; right: true }
    color: "transparent"
    WlrLayershell.namespace: "omalauncher"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive
    exclusionMode: ExclusionMode.Ignore

    Rectangle {
      anchors.fill: parent
      color: root.scrim
    }

    MouseArea {
      anchors.fill: parent
      onClicked: root.dismiss()
    }

    Rectangle {
      id: card
      width: Math.min(Style.space(680), panel.width - Style.gapsOut * 2)
      height: searchBox.height + Style.space(1) + root.listHeight + Style.space(24)
      anchors.horizontalCenter: parent.horizontalCenter
      y: Math.max(Style.gapsOut, Math.round(panel.height * 0.18))
      radius: Style.cornerRadius
      color: root.background
      border.width: Math.max(1, Style.space(1))
      border.color: root.borderColor

      MouseArea { anchors.fill: parent; onClicked: searchInput.forceActiveFocus() }

      Rectangle {
        id: searchBox
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.margins: Style.space(12)
        height: Math.max(Style.space(52), Style.font.heading + Style.space(24))
        radius: Math.max(0, Style.cornerRadius - Style.space(2))
        color: root.selectedBackground
        opacity: 0.96

        Text {
          anchors.left: parent.left
          anchors.leftMargin: Style.space(16)
          anchors.verticalCenter: parent.verticalCenter
          text: ""
          color: root.selectedText
          font.family: Style.font.menuFamily
          font.pixelSize: Style.font.icon
        }

        Text {
          anchors.left: parent.left
          anchors.leftMargin: Style.space(48)
          anchors.right: parent.right
          anchors.rightMargin: Style.space(16)
          anchors.verticalCenter: parent.verticalCenter
          visible: !searchInput.text
          text: root.guardsReady ? "Search apps and Omarchy commands…" : "Building command index…"
          color: root.selectedText
          opacity: 0.55
          font.family: Style.font.menuFamily
          font.pixelSize: Style.font.heading
          elide: Text.ElideRight
        }

        TextInput {
          id: searchInput
          anchors.left: parent.left
          anchors.leftMargin: Style.space(48)
          anchors.right: parent.right
          anchors.rightMargin: Style.space(16)
          anchors.verticalCenter: parent.verticalCenter
          color: root.selectedText
          selectionColor: root.selectedText
          selectedTextColor: root.selectedBackground
          font.family: Style.font.menuFamily
          font.pixelSize: Style.font.heading
          clip: true
          onTextChanged: {
            root.selectedIndex = 0
            root.rebuildResults()
          }

          Keys.priority: Keys.BeforeItem
          Keys.onPressed: function(event) {
            if (event.key === Qt.Key_Escape) {
              if (searchInput.text) searchInput.text = ""
              else root.dismiss()
              event.accepted = true
            } else if (event.key === Qt.Key_Up) {
              root.moveSelection(-1)
              event.accepted = true
            } else if (event.key === Qt.Key_Down) {
              root.moveSelection(1)
              event.accepted = true
            } else if (event.key === Qt.Key_PageUp) {
              root.moveSelection(-root.maximumVisibleRows)
              event.accepted = true
            } else if (event.key === Qt.Key_PageDown) {
              root.moveSelection(root.maximumVisibleRows)
              event.accepted = true
            } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
              root.runSelected((event.modifiers & Qt.ControlModifier) !== 0)
              event.accepted = true
            }
          }
        }
      }

      Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: searchBox.bottom
        anchors.topMargin: Style.space(12)
        height: Math.max(1, Style.space(1))
        color: root.borderColor
        opacity: 0.5
      }

      ListView {
        id: resultList
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: searchBox.bottom
        anchors.topMargin: Style.space(13)
        anchors.bottom: parent.bottom
        anchors.bottomMargin: Style.space(12)
        model: resultsModel
        clip: true
        boundsBehavior: Flickable.StopAtBounds

        delegate: Rectangle {
          id: resultRow
          required property int index
          required property string title
          required property string breadcrumb
          required property string description
          required property string icon
          required property string iconFont
          required property string route
          required property string parentRoute
          required property string resultKind

          readonly property bool selected: index === root.selectedIndex
          width: ListView.view.width
          height: root.rowHeight
          radius: Math.max(0, Style.cornerRadius - Style.space(3))
          color: selected ? root.selectedBackground : "transparent"

          Text {
            id: rowIcon
            width: Style.space(48)
            anchors.left: parent.left
            anchors.leftMargin: Style.space(12)
            anchors.verticalCenter: parent.verticalCenter
            text: resultRow.icon || (resultRow.resultKind === "menu" ? "" : "")
            color: resultRow.selected ? root.selectedText : root.foreground
            font.family: resultRow.iconFont || Style.font.menuFamily
            font.pixelSize: Style.font.iconLarge
            horizontalAlignment: Text.AlignHCenter
          }

          Column {
            anchors.left: rowIcon.right
            anchors.leftMargin: Style.space(6)
            anchors.right: shortcut.left
            anchors.rightMargin: Style.space(12)
            anchors.verticalCenter: parent.verticalCenter
            spacing: Style.space(3)

            Text {
              width: parent.width
              text: resultRow.title
              color: resultRow.selected ? root.selectedText : root.foreground
              font.family: Style.font.menuFamily
              font.pixelSize: Style.font.heading
              font.weight: Font.Medium
              elide: Text.ElideRight
            }

            Text {
              width: parent.width
              text: resultRow.breadcrumb
                ? root.highlightedBreadcrumb(resultRow.breadcrumb)
                : resultRow.description
              visible: text.length > 0
              textFormat: Text.RichText
              color: resultRow.selected ? root.selectedText : root.foreground
              opacity: 0.58
              font.family: Style.font.menuFamily
              font.pixelSize: Style.font.bodySmall
              elide: Text.ElideRight
            }
          }

          Text {
            id: shortcut
            anchors.right: parent.right
            anchors.rightMargin: Style.space(18)
            anchors.verticalCenter: parent.verticalCenter
            visible: resultRow.selected
            text: "↵"
            color: root.selectedText
            opacity: 0.68
            font.family: Style.font.menuFamily
            font.pixelSize: Style.font.body
          }

          MouseArea {
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onPositionChanged: root.selectedIndex = resultRow.index
            onClicked: {
              root.selectedIndex = resultRow.index
              root.runSelected(false)
            }
          }
        }
      }

      Column {
        anchors.centerIn: resultList
        spacing: Style.space(8)
        visible: resultsModel.count === 0

        Text {
          width: Style.space(500)
          horizontalAlignment: Text.AlignHCenter
          text: searchInput.text ? "No matching commands" : (root.sourceError || "Type to search Omarchy commands")
          color: root.foreground
          opacity: 0.68
          font.family: Style.font.menuFamily
          font.pixelSize: Style.font.title
        }

        Text {
          width: Style.space(500)
          horizontalAlignment: Text.AlignHCenter
          visible: !searchInput.text && !root.sourceError
          text: "Enter runs  ·  Ctrl+Enter opens the parent menu"
          color: root.foreground
          opacity: 0.42
          font.family: Style.font.menuFamily
          font.pixelSize: Style.font.bodySmall
        }
      }
    }
  }
}
