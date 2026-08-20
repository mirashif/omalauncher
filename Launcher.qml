import Quickshell
import Quickshell.Hyprland
import Quickshell.Io
import Quickshell.Wayland
import QtQuick
import qs.Commons
import "providers"
import "services"
import "providers/MenuIndex.js" as MenuIndex
import "services/ActionModel.js" as ActionModel
import "services/LayoutModel.js" as LayoutModel
import "services/StatusModel.js" as StatusModel
import "SearchEngine.js" as SearchEngine

Item {
  id: root

  // Injected by omarchy-shell.
  property string omarchyPath: Quickshell.env("OMARCHY_PATH")
  property var shell: null
  property var manifest: null

  property bool opened: false
  property bool defaultSourceLoaded: false
  property bool defaultSourceSettled: false
  property var defaultMenuItems: []
  property var userMenuItems: []
  property var menuItems: ({})
  property var menuOrder: []
  property var whenResults: ({})
  property var checkedResults: ({})
  property var commandRecords: []
  property var appRecords: []
  property var allRecords: []
  property int selectedIndex: 0
  property int resultSectionCount: 0
  property bool actionPanelOpen: false
  property var actionTarget: ({})
  property int actionSelectedIndex: 0
  property bool guardsPending: false
  property bool guardsReady: false
  property bool guardEvaluationSettled: false
  property bool guardResultsAvailable: false
  property string defaultSourceError: ""
  property string userSourceError: ""
  property string guardError: ""
  readonly property bool appsReady: appProvider.ready
  readonly property string appProviderError: appProvider.error
  readonly property bool commandIndexSettled: defaultSourceSettled
    && (!defaultSourceLoaded || guardEvaluationSettled || guardResultsAvailable)
  readonly property bool indexSettled: stateStore.loaded && appsReady && commandIndexSettled
  readonly property bool indexReady: indexSettled
  readonly property string providerWarning: StatusModel.warningText([
    stateStore.error,
    defaultSourceError,
    userSourceError,
    guardError,
    appProviderError
  ])
  readonly property var emptyStatus: StatusModel.emptyStatus({
    stateReady: stateStore.loaded,
    indexSettled: root.indexSettled,
    query: searchInput.text,
    resultCount: resultsModel.count,
    totalRecords: root.allRecords.length,
    warnings: [stateStore.error, defaultSourceError, userSourceError, guardError, appProviderError]
  })

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
  readonly property int sectionHeight: Style.space(28)
  readonly property int maximumVisibleRows: 8
  readonly property int listHeight: Math.max(rowHeight,
    Math.min(maximumVisibleRows, Math.max(1, resultsModel.count)) * rowHeight
      + resultSectionCount * sectionHeight)
  readonly property int actionRowHeight: Math.max(Style.space(50), Style.font.body + Style.font.caption + Style.space(18))
  readonly property int actionListHeight: Math.max(actionRowHeight,
    Math.min(5, Math.max(1, actionResultsModel.count)) * actionRowHeight)
  readonly property int actionPanelHeight: Style.space(48) + Style.space(46) + actionListHeight + Style.space(28)

  function focusedScreen() {
    var monitor = Hyprland.focusedMonitor
    var name = monitor ? String(monitor.name || "") : ""
    return LayoutModel.screenForMonitor(Quickshell.screens || [], name)
  }

  function open(payloadJson) {
    var payload = ({})
    try { payload = JSON.parse(payloadJson || "{}") } catch (error) { payload = ({}) }
    var targetScreen = root.focusedScreen()
    if (targetScreen) panel.screen = targetScreen
    root.resetActionPanel()
    root.opened = true
    searchInput.text = String(payload.query || "")
    root.selectedIndex = 0
    root.rebuildResults()
    root.evaluateGuards()
    appProvider.refreshIcons()
    Qt.callLater(function() { searchInput.forceActiveFocus() })
  }

  function close() {
    root.resetActionPanel()
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
    root.defaultSourceSettled = false
    root.guardEvaluationSettled = false
    defaultMenuFile.reload()
    userMenuFile.reload()
    appProvider.refresh()
    return "ok"
  }

  function ping() { return "ok" }

  function stats() {
    return JSON.stringify({
      applications: root.appRecords.length,
      commands: root.commandRecords.length,
      total: root.allRecords.length,
      ready: root.indexSettled,
      healthy: !root.providerWarning,
      warning: root.providerWarning,
      sharedAppLibrary: appProvider.usingSharedLibrary,
      favorites: stateStore.favorites.length,
      usageEntries: Object.keys(stateStore.usage).length,
      stateReady: stateStore.loaded
    })
  }

  function stateStats() {
    return JSON.stringify({
      path: stateStore.statePath,
      loaded: stateStore.loaded,
      error: stateStore.error,
      favorites: stateStore.favorites.length,
      usageEntries: Object.keys(stateStore.usage).length
    })
  }

  function debugEmptyState() {
    return JSON.stringify(stateStore.emptyRows(root.allRecords).map(function(row) {
      return { id: row.id, type: row.type, title: row.title, section: row.section }
    }))
  }

  function debugSearch(query) {
    var rows = SearchEngine.search(root.allRecords, String(query || ""), {
      limit: 5,
      usage: stateStore.usage
    })
    return JSON.stringify(rows.map(function(row) {
      return {
        id: row.id,
        type: row.type,
        title: row.title,
        context: row.breadcrumb || row.description,
        tier: row.semanticTier
      }
    }))
  }

  function actionStats() {
    var actions = []
    for (var i = 0; i < actionResultsModel.count; i++) {
      var action = actionResultsModel.get(i)
      actions.push({ id: action.actionId, title: action.title })
    }
    return JSON.stringify({
      launcherOpen: root.opened,
      rootQuery: String(searchInput.text || ""),
      actionPanelOpen: root.actionPanelOpen,
      target: String(root.actionTarget.resultId || ""),
      query: String(actionSearchInput.text || ""),
      selectedIndex: root.actionSelectedIndex,
      actions: actions
    })
  }

  function uiStats() {
    var screen = panel.screen
    return JSON.stringify({
      launcherOpen: root.opened,
      focusedMonitor: Hyprland.focusedMonitor ? String(Hyprland.focusedMonitor.name || "") : "",
      panelScreen: screen ? String(screen.name || "") : "",
      monitorScale: Hyprland.focusedMonitor ? Number(Hyprland.focusedMonitor.scale || 1) : 1,
      screenWidth: screen ? Number(screen.width || 0) : 0,
      screenHeight: screen ? Number(screen.height || 0) : 0,
      devicePixelRatio: screen ? Number(screen.devicePixelRatio || 1) : 1,
      cardWidth: Number(card.width || 0),
      cardHeight: Number(card.height || 0),
      cardY: Number(card.y || 0),
      indexSettled: root.indexSettled,
      warning: root.providerWarning
    })
  }

  function applyParsedSource(parsed, isDefault) {
    if (parsed.error) {
      var sourceName = isDefault ? root.defaultMenuPath : root.userMenuPath
      console.warn("Omalauncher: menu JSONC parse failed at " + sourceName + ": " + parsed.error)
      if (isDefault) {
        root.defaultSourceSettled = true
        if (root.defaultSourceLoaded) root.guardEvaluationSettled = true
        root.defaultSourceError = "Could not parse the Omarchy command menu"
      } else {
        root.userSourceError = "Could not parse the custom Omarchy menu"
      }
      return
    } else {
      if (isDefault) {
        root.defaultMenuItems = parsed.items
        root.defaultSourceLoaded = true
        root.defaultSourceSettled = true
        root.defaultSourceError = ""
      } else {
        root.userMenuItems = parsed.items
        root.userSourceError = ""
      }
    }
    root.rebuildMenu()
  }

  function rebuildMenu() {
    if (!root.defaultSourceLoaded) return
    var merged = MenuIndex.mergeMenuSources(root.defaultMenuItems, root.userMenuItems)
    root.menuItems = merged.items
    root.menuOrder = merged.itemOrder
    root.guardsReady = false
    root.guardEvaluationSettled = false
    root.rebuildCommandRecords()
    root.evaluateGuards()
  }

  function rebuildCommandRecords() {
    var merged = { items: root.menuItems, itemOrder: root.menuOrder }
    root.commandRecords = MenuIndex.buildCommandRecords(merged, root.whenResults)
    root.rebuildUnifiedRecords()
  }

  function rebuildUnifiedRecords() {
    root.allRecords = root.appRecords.concat(root.commandRecords)
    root.rebuildResults()
  }

  function rebuildResults() {
    resultsModel.clear()
    var query = String(searchInput.text || "").trim()
    var results = query
      ? SearchEngine.search(root.allRecords, query, { limit: 50, usage: stateStore.usage })
      : stateStore.emptyRows(root.allRecords)
    var sections = {}
    for (var i = 0; i < results.length; i++) {
      var result = results[i]
      var section = String(result.section || "")
      if (section) sections[section] = true
      resultsModel.append({
        resultId: String(result.id || ""),
        resultType: String(result.type || ""),
        resultKind: String(result.kind || ""),
        title: String(result.title || ""),
        breadcrumb: String(result.breadcrumb || ""),
        description: String(result.description || ""),
        icon: String(result.icon || ""),
        iconFont: String(result.iconFont || ""),
        appIcon: String(result.appIcon || ""),
        appId: String(result.appId || ""),
        route: String(result.route || ""),
        parentRoute: String(result.parentRoute || "root"),
        semanticTier: Number(result.semanticTier || 0),
        section: section,
        favorite: stateStore.isFavorite(result.id)
      })
    }
    root.resultSectionCount = Object.keys(sections).length

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

  function selectedResultSnapshot() {
    if (resultsModel.count === 0 || root.selectedIndex < 0 || root.selectedIndex >= resultsModel.count) return ({})
    var row = resultsModel.get(root.selectedIndex)
    return {
      resultId: String(row.resultId || ""),
      resultType: String(row.resultType || ""),
      resultKind: String(row.resultKind || ""),
      title: String(row.title || ""),
      breadcrumb: String(row.breadcrumb || ""),
      description: String(row.description || ""),
      appId: String(row.appId || ""),
      route: String(row.route || ""),
      parentRoute: String(row.parentRoute || "")
    }
  }

  function resetActionPanel() {
    root.actionPanelOpen = false
    root.actionTarget = ({})
    root.actionSelectedIndex = 0
    actionResultsModel.clear()
    actionSearchInput.text = ""
  }

  function openActionPanel() {
    var target = root.selectedResultSnapshot()
    if (!target.resultId) return
    root.actionTarget = target
    root.actionSelectedIndex = 0
    actionSearchInput.text = ""
    root.actionPanelOpen = true
    root.rebuildActions()
    Qt.callLater(function() { actionSearchInput.forceActiveFocus() })
  }

  function closeActionPanel() {
    if (!root.actionPanelOpen) return
    root.resetActionPanel()
    if (root.opened) Qt.callLater(function() { searchInput.forceActiveFocus() })
  }

  function rebuildActions() {
    actionResultsModel.clear()
    if (!root.actionTarget.resultId) {
      root.actionSelectedIndex = 0
      return
    }

    var actions = ActionModel.actionsForResult(root.actionTarget, {
      favorite: stateStore.isFavorite(root.actionTarget.resultId),
      usage: stateStore.usage
    })
    var query = String(actionSearchInput.text || "").trim()
    if (query) actions = SearchEngine.search(actions, query, { limit: 10 })
    for (var i = 0; i < actions.length; i++) {
      var action = actions[i]
      actionResultsModel.append({
        actionId: String(action.id || ""),
        title: String(action.title || ""),
        description: String(action.description || ""),
        shortcut: String(action.shortcut || ""),
        icon: String(action.icon || "")
      })
    }

    if (actionResultsModel.count === 0) root.actionSelectedIndex = 0
    else root.actionSelectedIndex = Math.max(0, Math.min(root.actionSelectedIndex, actionResultsModel.count - 1))
    Qt.callLater(root.revealActionSelection)
  }

  function moveActionSelection(delta) {
    if (actionResultsModel.count === 0) return
    root.actionSelectedIndex = (root.actionSelectedIndex + delta + actionResultsModel.count) % actionResultsModel.count
    root.revealActionSelection()
  }

  function revealActionSelection() {
    if (actionResultsModel.count > 0) actionList.positionViewAtIndex(root.actionSelectedIndex, ListView.Contain)
  }

  function performAction(actionId) {
    var selectedActionId = String(actionId || "")
    if (!selectedActionId) {
      if (actionResultsModel.count === 0 || root.actionSelectedIndex >= actionResultsModel.count) return
      selectedActionId = String(actionResultsModel.get(root.actionSelectedIndex).actionId || "")
    }
    var target = root.actionTarget
    if (!target.resultId) return

    if (selectedActionId === "favorite") {
      stateStore.toggleFavorite(target.resultId)
      return
    }
    if (selectedActionId === "reset-ranking") {
      stateStore.resetRanking(target.resultId)
      return
    }
    if (selectedActionId === "primary" || selectedActionId === "parent") {
      root.runResult(target, selectedActionId === "parent")
    }
  }

  function runRoute(route) {
    var selectedRoute = String(route || "")
    if (!selectedRoute) return
    root.close()
    if (root.shell && typeof root.shell.hide === "function") root.shell.hide(root.pluginId)
    Quickshell.execDetached(["omarchy", "menu", "summon", selectedRoute])
  }

  function runResult(row, useParent) {
    if (!row || !row.resultId) return
    stateStore.recordSelection(row.resultId)
    if (row.resultType === "application") root.launchApplication(row.appId, row.title)
    else root.runRoute(useParent ? row.parentRoute : row.route)
  }

  function runSelected(useParent) {
    root.runResult(root.selectedResultSnapshot(), useParent)
  }

  function toggleSelectedFavorite() {
    if (resultsModel.count === 0 || root.selectedIndex < 0 || root.selectedIndex >= resultsModel.count) return
    stateStore.toggleFavorite(resultsModel.get(root.selectedIndex).resultId)
  }

  function launchApplication(appId, title) {
    if (!appId) return
    root.close()
    if (root.shell && typeof root.shell.hide === "function") root.shell.hide(root.pluginId)
    appProvider.launch(appId, title)
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
    root.guardEvaluationSettled = false
    var script = MenuIndex.guardScript(root.menuItems)
    if (!script) {
      root.whenResults = ({})
      root.checkedResults = ({})
      root.guardsReady = true
      root.guardResultsAvailable = true
      root.guardEvaluationSettled = true
      root.guardError = ""
      root.rebuildCommandRecords()
      return
    }
    guardProc.collected = ""
    guardProc.command = ["bash", "-lc", script]
    guardProc.running = true
  }

  ListModel { id: resultsModel }
  ListModel { id: actionResultsModel }

  StateStore {
    id: stateStore
    onSnapshotChanged: {
      root.rebuildResults()
      if (root.actionPanelOpen) root.rebuildActions()
    }
  }

  AppProvider {
    id: appProvider
    appLibrary: root.shell ? root.shell.appLibrary : null
    onRecordsChanged: {
      root.appRecords = appProvider.records
      root.rebuildUnifiedRecords()
    }
  }

  FileView {
    id: defaultMenuFile
    path: root.defaultMenuPath
    watchChanges: true
    printErrors: false
    onLoaded: root.applyParsedSource(MenuIndex.parseMenuJsonc(text()), true)
    onLoadFailed: function(error) {
      root.defaultSourceSettled = true
      if (root.defaultSourceLoaded) root.guardEvaluationSettled = true
      root.defaultSourceError = "Could not load the Omarchy command menu"
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
      root.userSourceError = ""
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
        root.guardResultsAvailable = true
        root.guardEvaluationSettled = true
        root.guardError = ""
        root.rebuildCommandRecords()
      } else {
        if (!root.guardResultsAvailable) {
          var fallbackWhen = ({})
          var ids = Object.keys(root.menuItems)
          for (var i = 0; i < ids.length; i++) {
            var entry = root.menuItems[ids[i]]
            if (entry && entry.when) fallbackWhen[ids[i]] = false
          }
          root.whenResults = fallbackWhen
          root.checkedResults = ({})
          root.guardError = "Some Omarchy commands were hidden because availability checks failed"
          root.rebuildCommandRecords()
        } else {
          root.guardError = "Command availability could not be refreshed; showing last known results"
        }
        root.guardsReady = true
        root.guardEvaluationSettled = true
        console.warn("Omalauncher: menu visibility batch failed; unavailable commands remain hidden")
      }
      if (root.guardsPending) Qt.callLater(root.evaluateGuards)
    }
  }

  PanelWindow {
    id: panel
    visible: root.opened
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
      readonly property int desiredHeight: Math.max(
        searchBox.height + Style.space(1) + root.listHeight + Style.space(24),
        root.actionPanelOpen ? root.actionPanelHeight + Style.space(24) : 0)
      readonly property var responsiveGeometry: LayoutModel.cardGeometry(
        panel.width,
        panel.height,
        Style.space(680),
        desiredHeight,
        Style.gapsOut,
        0.18)
      width: responsiveGeometry.width
      height: responsiveGeometry.height
      anchors.horizontalCenter: parent.horizontalCenter
      y: responsiveGeometry.y
      radius: Style.cornerRadius
      color: root.background
      border.width: Math.max(1, Style.space(1))
      border.color: root.borderColor

      MouseArea {
        anchors.fill: parent
        onClicked: {
          if (root.actionPanelOpen) root.closeActionPanel()
          else searchInput.forceActiveFocus()
        }
      }

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
          anchors.rightMargin: root.providerWarning ? Style.space(42) : Style.space(16)
          anchors.verticalCenter: parent.verticalCenter
          visible: !searchInput.text
          text: !stateStore.loaded
            ? "Loading launcher state…"
            : (root.indexSettled ? "Search apps and Omarchy commands…" : "Building unified index…")
          color: root.selectedText
          opacity: 0.55
          font.family: Style.font.menuFamily
          font.pixelSize: Style.font.heading
          elide: Text.ElideRight
        }

        TextInput {
          id: searchInput
          enabled: !root.actionPanelOpen && stateStore.loaded
          anchors.left: parent.left
          anchors.leftMargin: Style.space(48)
          anchors.right: parent.right
          anchors.rightMargin: root.providerWarning ? Style.space(42) : Style.space(16)
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
            if ((event.modifiers & Qt.ControlModifier) !== 0 && event.key === Qt.Key_K) {
              root.openActionPanel()
              event.accepted = true
            } else if ((event.modifiers & Qt.ControlModifier) !== 0 && event.key === Qt.Key_F) {
              root.toggleSelectedFavorite()
              event.accepted = true
            } else if (event.key === Qt.Key_Escape) {
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

        Text {
          anchors.right: parent.right
          anchors.rightMargin: Style.space(15)
          anchors.verticalCenter: parent.verticalCenter
          visible: !!root.providerWarning
          text: ""
          color: root.selectedText
          opacity: 0.7
          font.family: Style.font.menuFamily
          font.pixelSize: Style.font.body
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
        enabled: !root.actionPanelOpen
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        section.property: "section"
        section.criteria: ViewSection.FullString
        section.delegate: Rectangle {
          required property string section
          width: resultList.width
          height: section ? root.sectionHeight : 0
          color: "transparent"

          Text {
            anchors.left: parent.left
            anchors.leftMargin: Style.space(22)
            anchors.bottom: parent.bottom
            anchors.bottomMargin: Style.space(4)
            text: parent.section
            color: root.foreground
            opacity: 0.48
            font.family: Style.font.menuFamily
            font.pixelSize: Style.font.caption
            font.weight: Font.DemiBold
          }
        }

        delegate: Rectangle {
          id: resultRow
          required property int index
          required property string resultType
          required property string title
          required property string breadcrumb
          required property string description
          required property string icon
          required property string iconFont
          required property string appIcon
          required property string appId
          required property string route
          required property string parentRoute
          required property string resultKind
          required property bool favorite

          readonly property bool selected: index === root.selectedIndex
          readonly property bool isApplication: resultType === "application"
          width: ListView.view.width
          height: root.rowHeight
          radius: Math.max(0, Style.cornerRadius - Style.space(3))
          color: selected ? root.selectedBackground : "transparent"

          Item {
            id: rowIcon
            width: Style.space(48)
            height: parent.height
            anchors.left: parent.left
            anchors.leftMargin: Style.space(12)

            Text {
              anchors.fill: parent
              visible: !resultRow.isApplication
              text: resultRow.icon || (resultRow.resultKind === "menu" ? "" : "")
              color: resultRow.selected ? root.selectedText : root.foreground
              font.family: resultRow.iconFont || Style.font.menuFamily
              font.pixelSize: Style.font.iconLarge
              horizontalAlignment: Text.AlignHCenter
              verticalAlignment: Text.AlignVCenter
            }

            Image {
              width: Style.font.iconLarge
              height: Style.font.iconLarge
              anchors.centerIn: parent
              visible: resultRow.isApplication
              source: resultRow.isApplication ? appProvider.iconSource(resultRow.appIcon) : ""
              sourceSize.width: width * Screen.devicePixelRatio
              sourceSize.height: height * Screen.devicePixelRatio
              fillMode: Image.PreserveAspectFit
              asynchronous: true
            }
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
                : root.escapeHtml(resultRow.description)
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
            text: (resultRow.favorite ? "★  ·  " : "") + "Ctrl+K  ·  ↵"
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
        width: Math.max(1, Math.min(Style.space(500), resultList.width - Style.space(32)))
        visible: root.emptyStatus.visible

        Text {
          width: parent.width
          horizontalAlignment: Text.AlignHCenter
          text: root.emptyStatus.kind === "loading" ? "" : (root.emptyStatus.kind === "error" ? "" : "")
          color: root.foreground
          opacity: 0.55
          font.family: Style.font.menuFamily
          font.pixelSize: Style.font.iconLarge
        }

        Text {
          width: parent.width
          horizontalAlignment: Text.AlignHCenter
          text: root.emptyStatus.title
          color: root.foreground
          opacity: 0.68
          font.family: Style.font.menuFamily
          font.pixelSize: Style.font.title
        }

        Text {
          width: parent.width
          horizontalAlignment: Text.AlignHCenter
          visible: text.length > 0
          text: root.emptyStatus.detail
          color: root.foreground
          opacity: 0.42
          font.family: Style.font.menuFamily
          font.pixelSize: Style.font.bodySmall
          wrapMode: Text.Wrap
        }
      }

      Rectangle {
        id: actionPanel
        visible: root.actionPanelOpen
        z: 20
        width: Math.max(1, Math.min(Style.space(420), card.width - Style.space(24)))
        height: Math.max(1, Math.min(root.actionPanelHeight, card.height - Style.space(24)))
        anchors.top: parent.top
        anchors.right: parent.right
        anchors.margins: Style.space(12)
        radius: Math.max(0, Style.cornerRadius - Style.space(2))
        color: root.background
        border.width: Math.max(1, Style.space(1))
        border.color: root.borderColor

        MouseArea {
          anchors.fill: parent
          onClicked: actionSearchInput.forceActiveFocus()
        }

        Item {
          id: actionHeader
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.top: parent.top
          height: Style.space(48)

          Text {
            anchors.left: parent.left
            anchors.leftMargin: Style.space(16)
            anchors.verticalCenter: parent.verticalCenter
            text: "Actions"
            color: root.foreground
            font.family: Style.font.menuFamily
            font.pixelSize: Style.font.title
            font.weight: Font.DemiBold
          }

          Text {
            anchors.left: parent.left
            anchors.leftMargin: Style.space(90)
            anchors.right: parent.right
            anchors.rightMargin: Style.space(16)
            anchors.verticalCenter: parent.verticalCenter
            horizontalAlignment: Text.AlignRight
            text: String(root.actionTarget.title || "")
            color: root.foreground
            opacity: 0.5
            font.family: Style.font.menuFamily
            font.pixelSize: Style.font.bodySmall
            elide: Text.ElideRight
          }
        }

        Rectangle {
          id: actionSearchBox
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.top: actionHeader.bottom
          anchors.leftMargin: Style.space(12)
          anchors.rightMargin: Style.space(12)
          height: Style.space(46)
          radius: Math.max(0, Style.cornerRadius - Style.space(4))
          color: root.selectedBackground

          Text {
            anchors.left: parent.left
            anchors.leftMargin: Style.space(13)
            anchors.verticalCenter: parent.verticalCenter
            text: ""
            color: root.selectedText
            opacity: 0.7
            font.family: Style.font.menuFamily
            font.pixelSize: Style.font.body
          }

          Text {
            anchors.left: parent.left
            anchors.leftMargin: Style.space(40)
            anchors.right: parent.right
            anchors.rightMargin: Style.space(12)
            anchors.verticalCenter: parent.verticalCenter
            visible: !actionSearchInput.text
            text: "Search actions…"
            color: root.selectedText
            opacity: 0.5
            font.family: Style.font.menuFamily
            font.pixelSize: Style.font.body
            elide: Text.ElideRight
          }

          TextInput {
            id: actionSearchInput
            anchors.left: parent.left
            anchors.leftMargin: Style.space(40)
            anchors.right: parent.right
            anchors.rightMargin: Style.space(12)
            anchors.verticalCenter: parent.verticalCenter
            color: root.selectedText
            selectionColor: root.selectedText
            selectedTextColor: root.selectedBackground
            font.family: Style.font.menuFamily
            font.pixelSize: Style.font.body
            clip: true
            onTextChanged: {
              root.actionSelectedIndex = 0
              root.rebuildActions()
            }

            Keys.priority: Keys.BeforeItem
            Keys.onPressed: function(event) {
              if (event.key === Qt.Key_Escape
                  || ((event.modifiers & Qt.ControlModifier) !== 0 && event.key === Qt.Key_K)) {
                root.closeActionPanel()
                event.accepted = true
              } else if ((event.modifiers & Qt.ControlModifier) !== 0 && event.key === Qt.Key_F) {
                root.performAction("favorite")
                event.accepted = true
              } else if (event.key === Qt.Key_Up) {
                root.moveActionSelection(-1)
                event.accepted = true
              } else if (event.key === Qt.Key_Down) {
                root.moveActionSelection(1)
                event.accepted = true
              } else if (event.key === Qt.Key_PageUp) {
                root.moveActionSelection(-5)
                event.accepted = true
              } else if (event.key === Qt.Key_PageDown) {
                root.moveActionSelection(5)
                event.accepted = true
              } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
                root.performAction("")
                event.accepted = true
              }
            }
          }
        }

        ListView {
          id: actionList
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.top: actionSearchBox.bottom
          anchors.bottom: parent.bottom
          anchors.topMargin: Style.space(8)
          anchors.bottomMargin: Style.space(12)
          model: actionResultsModel
          clip: true
          boundsBehavior: Flickable.StopAtBounds

          delegate: Rectangle {
            id: actionRow
            required property int index
            required property string actionId
            required property string title
            required property string description
            required property string shortcut
            required property string icon

            readonly property bool selected: index === root.actionSelectedIndex
            width: ListView.view.width
            height: root.actionRowHeight
            radius: Math.max(0, Style.cornerRadius - Style.space(4))
            color: selected ? root.selectedBackground : "transparent"

            Text {
              width: Style.space(40)
              anchors.left: parent.left
              anchors.leftMargin: Style.space(10)
              anchors.verticalCenter: parent.verticalCenter
              text: actionRow.icon
              color: actionRow.selected ? root.selectedText : root.foreground
              font.family: Style.font.menuFamily
              font.pixelSize: Style.font.icon
              horizontalAlignment: Text.AlignHCenter
            }

            Column {
              anchors.left: parent.left
              anchors.leftMargin: Style.space(58)
              anchors.right: actionShortcut.left
              anchors.rightMargin: Style.space(10)
              anchors.verticalCenter: parent.verticalCenter
              spacing: Style.space(2)

              Text {
                width: parent.width
                text: actionRow.title
                color: actionRow.selected ? root.selectedText : root.foreground
                font.family: Style.font.menuFamily
                font.pixelSize: Style.font.body
                font.weight: Font.Medium
                elide: Text.ElideRight
              }

              Text {
                width: parent.width
                visible: text.length > 0
                text: actionRow.description
                color: actionRow.selected ? root.selectedText : root.foreground
                opacity: 0.5
                font.family: Style.font.menuFamily
                font.pixelSize: Style.font.caption
                elide: Text.ElideRight
              }
            }

            Text {
              id: actionShortcut
              anchors.right: parent.right
              anchors.rightMargin: Style.space(14)
              anchors.verticalCenter: parent.verticalCenter
              visible: actionRow.shortcut.length > 0
              text: actionRow.shortcut
              color: actionRow.selected ? root.selectedText : root.foreground
              opacity: 0.58
              font.family: Style.font.menuFamily
              font.pixelSize: Style.font.caption
            }

            MouseArea {
              anchors.fill: parent
              hoverEnabled: true
              cursorShape: Qt.PointingHandCursor
              onPositionChanged: root.actionSelectedIndex = actionRow.index
              onClicked: {
                root.actionSelectedIndex = actionRow.index
                root.performAction(actionRow.actionId)
              }
            }
          }
        }

        Text {
          anchors.centerIn: actionList
          visible: actionResultsModel.count === 0
          text: "No matching actions"
          color: root.foreground
          opacity: 0.55
          font.family: Style.font.menuFamily
          font.pixelSize: Style.font.body
        }
      }
    }
  }
}
