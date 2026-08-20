import Quickshell
import Quickshell.Hyprland
import Quickshell.Io
import Quickshell.Wayland
import QtQuick
import qs.Commons
import "providers"
import "services"
import "providers/MenuIndex.js" as MenuIndex
import "providers/FileSearchModel.js" as FileSearchModel
import "services/ActionModel.js" as ActionModel
import "services/GenerationModel.js" as GenerationModel
import "services/HighlightModel.js" as HighlightModel
import "services/LayoutModel.js" as LayoutModel
import "services/NavigationModel.js" as NavigationModel
import "services/QuickActivationModel.js" as QuickActivationModel
import "services/SettingsModel.js" as SettingsModel
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
  property var rootSearchRecords: []
  property var rootEmptyRecords: []
  property string activeRoute: "root"
  property var navigationStack: []
  property int selectedIndex: 0
  property int resultSectionCount: 0
  property int queryHistoryIndex: -1
  property string queryHistoryDraft: ""
  property bool applyingQueryHistory: false
  property bool suppressSearchChange: false
  property bool compactExpanded: false
  property bool actionPanelOpen: false
  property var actionTarget: ({})
  property int actionSelectedIndex: 0
  property string actionRoute: "root"
  property string actionRouteTitle: "Actions"
  property var actionNavigationStack: []
  property int actionSectionCount: 0
  property bool aliasEditorOpen: false
  property string aliasEditorError: ""
  property bool warningPanelOpen: false
  property bool guardsPending: false
  property bool guardsReady: false
  property bool guardEvaluationSettled: false
  property bool guardResultsAvailable: false
  property int menuRevision: 0
  property string defaultSourceError: ""
  property string userSourceError: ""
  property string guardError: ""
  property string settingsInputError: ""
  property bool settingsInputBusy: false
  property bool settingsScopeSuggested: false
  property double openMeasurementStartedAt: 0
  property double lastWarmOpenMs: 0
  property double lastSearchUpdateMs: 0
  property double maxSearchUpdateMs: 0
  property int resultRebuilds: 0
  property int searchMeasurements: 0
  readonly property bool appsReady: appProvider.ready
  readonly property string appProviderError: appProvider.error
  readonly property string activeMenuTitle: root.menuTitle(root.activeRoute)
  readonly property bool commandIndexSettled: defaultSourceSettled
    && (!defaultSourceLoaded || guardEvaluationSettled || guardResultsAvailable)
  readonly property bool indexSettled: stateStore.loaded && appsReady && commandIndexSettled
  readonly property bool indexReady: indexSettled
  readonly property bool compactMode: !!stateStore.preferences
    && stateStore.preferences.compactMode === true
  readonly property bool compactCollapsed: compactMode
    && !compactExpanded
    && !searchInput.text
    && activeRoute === "root"
    && !actionPanelOpen
    && !warningPanelOpen
  readonly property string providerWarning: StatusModel.warningText([
    stateStore.error,
    defaultSourceError,
    userSourceError,
    guardError,
    appProviderError
  ])
  readonly property var providerDiagnostics: StatusModel.providerDiagnostics([
    {
      provider: "Launcher state",
      error: stateStore.error,
      detail: stateStore.error ? "Could not persist state at " + stateStore.statePath : ""
    },
    {
      provider: "Omarchy commands",
      error: defaultSourceError,
      detail: defaultSourceError ? "Source: " + root.defaultMenuPath : ""
    },
    {
      provider: "Custom commands",
      error: userSourceError,
      detail: userSourceError ? "Source: " + root.userMenuPath : ""
    },
    {
      provider: "Command availability",
      error: guardError,
      detail: guardError ? "Retry reruns the command visibility checks." : ""
    },
    {
      provider: "Applications",
      error: appProviderError,
      detail: appProviderError ? "Retry rebuilds the desktop application index." : ""
    }
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
  readonly property int cardPadding: Style.space(12)
  readonly property int dividerHeight: Math.max(1, Style.space(1))
  readonly property int resultsTopOffset: cardPadding + dividerHeight
  readonly property int footerHeight: Style.space(38)
  readonly property int rowHeight: Math.max(Style.space(58), Style.font.body + Style.font.caption + Style.space(22))
  readonly property int sectionHeight: Style.space(28)
  readonly property int maximumVisibleRows: 8
  readonly property int listHeight: Math.max(rowHeight,
    Math.min(maximumVisibleRows, Math.max(1, resultsModel.count)) * rowHeight
      + resultSectionCount * sectionHeight)
  readonly property int actionRowHeight: Math.max(Style.space(50), Style.font.body + Style.font.caption + Style.space(18))
  readonly property int actionListHeight: Math.max(actionRowHeight,
    Math.min(5, Math.max(1, actionResultsModel.count)) * actionRowHeight
      + actionSectionCount * sectionHeight)
  readonly property int actionPanelHeight: Style.space(48) + Style.space(46) + actionListHeight + Style.space(28)
  readonly property int warningPanelHeight: Style.space(76)
    + Math.max(1, providerDiagnostics.length) * Style.space(76)
    + Style.space(58)

  function focusedScreen() {
    var monitor = Hyprland.focusedMonitor
    var name = monitor ? String(monitor.name || "") : ""
    return LayoutModel.screenForMonitor(Quickshell.screens || [], name)
  }

  function open(payloadJson) {
    root.openMeasurementStartedAt = Date.now()
    var payload = ({})
    try { payload = JSON.parse(payloadJson || "{}") } catch (error) { payload = ({}) }
    var targetScreen = root.focusedScreen()
    if (targetScreen) panel.screen = targetScreen
    root.resetActionPanel()
    root.warningPanelOpen = false
    root.compactExpanded = false
    root.activeRoute = "root"
    root.navigationStack = []
    root.opened = true
    root.setSearchTextSilently(String(payload.query || ""))
    root.selectedIndex = 0
    root.resetQueryHistoryNavigation()
    root.rebuildResults()
    if (root.openMeasurementStartedAt > 0) {
      root.lastWarmOpenMs = Math.max(0, Date.now() - root.openMeasurementStartedAt)
    }
    root.evaluateGuards()
    appProvider.refreshIcons()
    Qt.callLater(function() {
      searchInput.forceActiveFocus()
      if (root.opened && root.openMeasurementStartedAt > 0) {
        root.lastWarmOpenMs = Math.max(0, Date.now() - root.openMeasurementStartedAt)
      }
    })
  }

  function close() {
    root.resetActionPanel()
    root.warningPanelOpen = false
    root.compactExpanded = false
    root.opened = false
    root.activeRoute = "root"
    root.navigationStack = []
    root.setSearchTextSilently("")
    root.selectedIndex = 0
    root.resetQueryHistoryNavigation()
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

  function showOsd(icon, message) {
    if (!message || !root.shell || typeof root.shell.summon !== "function") return
    root.shell.summon("omarchy.osd", JSON.stringify({
      icon: String(icon || ""),
      message: String(message),
      duration: 1400
    }))
  }

  function openWarningPanel() {
    if (root.providerDiagnostics.length === 0) return
    root.resetActionPanel()
    root.warningPanelOpen = true
    Qt.callLater(function() { warningPanel.forceActiveFocus() })
  }

  function closeWarningPanel() {
    if (!root.warningPanelOpen) return
    root.warningPanelOpen = false
    if (root.opened) Qt.callLater(function() { searchInput.forceActiveFocus() })
  }

  function retryProviders() {
    root.warningPanelOpen = false
    root.showOsd("", "Retrying launcher providers")
    root.refresh()
    if (root.opened) Qt.callLater(function() { searchInput.forceActiveFocus() })
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
      stateReady: stateStore.loaded,
      warmOpenMs: root.lastWarmOpenMs,
      maxSearchUpdateMs: root.maxSearchUpdateMs,
      calculatorBackendAvailable: calculatorProvider.backendAvailable,
      fileSearchBackendAvailable: fileSearchProvider.backendAvailable,
      fileSearchScopes: stateStore.preferences.fileSearchScopes.length
    })
  }

  function performanceStats() {
    return JSON.stringify({
      warmOpenMs: root.lastWarmOpenMs,
      lastSearchUpdateMs: root.lastSearchUpdateMs,
      maxSearchUpdateMs: root.maxSearchUpdateMs,
      resultRebuilds: root.resultRebuilds,
      searchMeasurements: root.searchMeasurements,
      budgets: {
        warmOpenMs: 100,
        searchUpdateMs: 16
      }
    })
  }

  function resetPerformanceStats() {
    root.openMeasurementStartedAt = 0
    root.lastWarmOpenMs = 0
    root.lastSearchUpdateMs = 0
    root.maxSearchUpdateMs = 0
    root.resultRebuilds = 0
    root.searchMeasurements = 0
    return "ok"
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

  function navigationStats() {
    return JSON.stringify({
      route: root.activeRoute,
      title: root.activeMenuTitle,
      stack: root.navigationStack,
      query: String(searchInput.text || ""),
      results: resultsModel.count
    })
  }

  function navigate(route) {
    return root.setActiveRoute(String(route || "root"), true) ? "ok" : "not-found"
  }

  function debugEmptyState() {
    return JSON.stringify(stateStore.emptyRows(root.allRecords).map(function(row) {
      return { id: row.id, type: row.type, title: row.title, section: row.section }
    }))
  }

  function emptyStateStats() {
    var rows = stateStore.emptyRows(root.allRecords)
    var sections = ({})
    var seen = ({})
    for (var i = 0; i < rows.length; i++) {
      var section = String(rows[i].section || "")
      sections[section] = Number(sections[section] || 0) + 1
      seen[String(rows[i].id || "")] = true
    }
    return JSON.stringify({
      rows: rows.length,
      unique: Object.keys(seen).length,
      indexed: root.allRecords.length,
      sections: sections
    })
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
    root.menuRevision = GenerationModel.next(root.menuRevision)
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
    root.commandRecords = MenuIndex.buildCommandRecords(merged, root.whenResults, root.checkedResults)
    root.rebuildUnifiedRecords()
  }

  function rebuildUnifiedRecords() {
    root.allRecords = root.appRecords.concat(root.commandRecords)
    root.rebuildCachedRecords()
    root.rebuildResults()
  }

  function rebuildCachedRecords() {
    root.rootSearchRecords = root.personalizedRecords(root.visibleRecords(root.allRecords))
    root.rootEmptyRecords = stateStore.emptyRows(root.allRecords)
  }

  function hiddenRecords() {
    var output = []
    for (var i = 0; i < root.allRecords.length; i++) {
      var record = root.allRecords[i]
      if (!stateStore.isHidden(record.id)) continue
      var copy = ({})
      for (var key in record) {
        if (Object.prototype.hasOwnProperty.call(record, key)) copy[key] = record[key]
      }
      copy.section = record.type === "application" ? "Hidden Applications" : "Hidden Omarchy Commands"
      output.push(SearchEngine.prepareRecord(copy))
    }
    return output
  }

  function managementRecords() {
    var preferences = stateStore.preferences || ({})
    var fileScopes = Array.isArray(preferences.fileSearchScopes)
      ? preferences.fileSearchScopes : []
    var records = [{
      id: "omalauncher:settings",
      type: "launcher-command",
      kind: "open-settings",
      title: "Omalauncher Settings",
      breadcrumb: "Omalauncher",
      description: "Configure launcher behavior and providers",
      icon: "",
      iconFont: "",
      appIcon: "",
      appId: "",
      aliases: [],
      keywords: ["settings", "preferences", "configure", "providers"],
      route: "settings",
      parentRoute: "root",
      searchText: "omalauncher settings preferences configure providers",
      providerPriority: -1,
      order: -3,
      section: "Launcher"
    }, {
      id: "omalauncher:toggle-compact",
      type: "launcher-command",
      kind: "toggle-compact",
      title: root.compactMode ? "Disable Compact Mode" : "Enable Compact Mode",
      breadcrumb: "Omalauncher",
      description: "Show only the search field until interaction begins",
      icon: root.compactMode ? "" : "",
      iconFont: "",
      appIcon: "",
      appId: "",
      aliases: [],
      keywords: ["compact", "minimal", "collapse", "preference"],
      route: "",
      parentRoute: "root",
      searchText: "compact mode minimal collapse preference omalauncher",
      providerPriority: -1,
      order: -2,
      section: "Launcher"
    }]
    records.push(FileSearchModel.managementRecord(
      preferences.fileSearchEnabled === true,
      fileScopes.length))
    if ((stateStore.hidden || []).length > 0) records.push({
      id: "omalauncher:manage-hidden",
      type: "launcher-command",
      kind: "manage-hidden",
      title: "Manage Hidden Results",
      breadcrumb: "Omalauncher",
      description: "Review and restore results hidden from search",
      icon: "",
      iconFont: "",
      appIcon: "",
      appId: "",
      aliases: [],
      keywords: ["hidden", "unhide", "visibility", "manage"],
      route: "hidden",
      parentRoute: "root",
      searchText: "manage hidden results unhide visibility omalauncher",
      providerPriority: -1,
      order: -1,
      section: "Launcher"
    })
    return records
  }

  function visibleRecords(records) {
    var output = []
    var source = records || []
    for (var i = 0; i < source.length; i++) {
      if (!stateStore.isHidden(source[i].id)) output.push(source[i])
    }
    return output
  }

  function personalizedRecords(records) {
    var output = []
    var source = records || []
    for (var i = 0; i < source.length; i++) {
      var record = source[i]
      var copy = ({})
      for (var key in record) {
        if (Object.prototype.hasOwnProperty.call(record, key)) copy[key] = record[key]
      }
      var userAlias = stateStore.aliasFor(record.id)
      var aliases = userAlias ? [userAlias] : []
      var sourceAliases = Array.isArray(record.aliases) ? record.aliases : []
      for (var a = 0; a < sourceAliases.length; a++) {
        if (String(sourceAliases[a]).toLowerCase() !== userAlias.toLowerCase()) aliases.push(sourceAliases[a])
      }
      copy.aliases = aliases
      copy.userAlias = userAlias
      copy.searchText = [record.searchText || "", userAlias].join(" ")
      output.push(copy)
    }
    return output
  }

  function rebuildResults() {
    var rebuildStartedAt = Date.now()
    resultsModel.clear()
    var rawQuery = String(searchInput.text || "")
    var query = rawQuery.trim()
    var preferences = stateStore.preferences || ({})
    var fileScopes = Array.isArray(preferences.fileSearchScopes)
      ? preferences.fileSearchScopes : []
    var fileIgnores = Array.isArray(preferences.fileSearchIgnores)
      ? preferences.fileSearchIgnores : []
    if (root.activeRoute !== "root" && root.activeRoute !== "apps"
        && root.activeRoute !== "hidden" && root.activeRoute !== "files"
        && !SettingsModel.isRoute(root.activeRoute)
        && !root.menuItems[root.activeRoute]) {
      root.activeRoute = "root"
      root.navigationStack = []
    }

    var scopedRecords = []
    var scopedRecordsPersonalized = false
    if (root.activeRoute === "root") {
      scopedRecords = root.rootSearchRecords.concat(root.personalizedRecords(root.managementRecords()))
      scopedRecordsPersonalized = true
    } else if (root.activeRoute === "apps") {
      scopedRecords = root.visibleRecords(root.appRecords)
    } else if (root.activeRoute === "hidden") {
      scopedRecords = root.hiddenRecords()
    } else if (root.activeRoute === "settings") {
      scopedRecords = SettingsModel.settingsRecords(preferences, {
        calculatorSettled: calculatorProvider.backendSettled,
        calculatorAvailable: calculatorProvider.backendAvailable,
        fileSearchSettled: fileSearchProvider.backendSettled,
        fileSearchAvailable: fileSearchProvider.backendAvailable,
        commonScopes: fileSearchProvider.commonScopes
      })
    } else if (SettingsModel.isInputRoute(root.activeRoute)) {
      scopedRecords = SettingsModel.inputRecords(
        root.activeRoute, query, root.settingsInputError, root.settingsInputBusy)
    } else if (SettingsModel.isConfirmationRoute(root.activeRoute)) {
      scopedRecords = SettingsModel.confirmationRecords(root.activeRoute)
    } else if (root.activeRoute !== "root") {
      scopedRecords = root.visibleRecords(MenuIndex.recordsForRoute(root.commandRecords, root.activeRoute, !!query))
    }

    if (!scopedRecordsPersonalized) scopedRecords = root.personalizedRecords(scopedRecords)
    var results
    if (SettingsModel.isInputRoute(root.activeRoute)
        || SettingsModel.isConfirmationRoute(root.activeRoute)) results = scopedRecords
    else if (query) results = SearchEngine.search(scopedRecords, query, { limit: 50, usage: stateStore.usage })
    else if (root.activeRoute === "root") results = root.rootEmptyRecords
    else results = scopedRecords

    var strongLauncherMatch = false
    for (var matchIndex = 0; matchIndex < results.length; matchIndex++) {
      if (Number(results[matchIndex].semanticTier || 99) <= 3) {
        strongLauncherMatch = true
        break
      }
    }
    var fileRequest = FileSearchModel.queryRequest(rawQuery, root.activeRoute === "files")
    fileSearchProvider.request(
      fileRequest.query,
      fileScopes,
      fileIgnores,
      fileRequest.active)
    calculatorProvider.request(
      !fileRequest.active && root.activeRoute === "root" ? query : "", strongLauncherMatch)
    if (fileRequest.active) {
      results = fileSearchProvider.records
    } else if (root.activeRoute === "root" && query && calculatorProvider.records.length > 0) {
      results = calculatorProvider.records.concat(results).slice(0, 50)
    }
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
        targetRoute: String(result.targetRoute || ""),
        provider: String(result.provider || ""),
        settingKey: String(result.settingKey || ""),
        settingValue: String(result.settingValue || ""),
        calculatorExpression: String(result.calculatorExpression || ""),
        calculatorResult: String(result.calculatorResult || ""),
        filePath: String(result.filePath || ""),
        fileScope: String(result.fileScope || ""),
        isChecked: !!result.checked,
        semanticTier: Number(result.semanticTier || 0),
        section: section,
        favorite: stateStore.isFavorite(result.id),
        userAlias: String(result.userAlias || "")
      })
    }
    root.resultSectionCount = Object.keys(sections).length

    if (resultsModel.count === 0) root.selectedIndex = 0
    else root.selectedIndex = Math.max(0, Math.min(root.selectedIndex, resultsModel.count - 1))
    root.lastSearchUpdateMs = Math.max(0, Date.now() - rebuildStartedAt)
    if (query && root.activeRoute === "root" && !fileRequest.active) {
      root.maxSearchUpdateMs = Math.max(root.maxSearchUpdateMs, root.lastSearchUpdateMs)
      root.searchMeasurements += 1
    }
    root.resultRebuilds += 1
    Qt.callLater(root.revealSelection)
  }

  function moveSelection(delta) {
    if (resultsModel.count === 0) return
    root.selectedIndex = (root.selectedIndex + delta + resultsModel.count) % resultsModel.count
    root.revealSelection()
  }

  function modelRows(model) {
    var rows = []
    for (var i = 0; i < model.count; i++) rows.push({ section: String(model.get(i).section || "") })
    return rows
  }

  function moveResultSection(delta) {
    if (resultsModel.count === 0) return
    root.selectedIndex = NavigationModel.sectionJumpIndex(root.modelRows(resultsModel), root.selectedIndex, delta)
    root.revealSelection()
  }

  function moveActionSection(delta) {
    if (actionResultsModel.count === 0) return
    root.actionSelectedIndex = NavigationModel.sectionJumpIndex(
      root.modelRows(actionResultsModel), root.actionSelectedIndex, delta)
    root.revealActionSelection()
  }

  function resetQueryHistoryNavigation() {
    root.queryHistoryIndex = -1
    root.queryHistoryDraft = ""
  }

  function setSearchTextSilently(value) {
    root.suppressSearchChange = true
    searchInput.text = String(value || "")
    root.suppressSearchChange = false
  }

  function cycleQueryHistory(older) {
    var history = stateStore.queryHistory || []
    if (history.length === 0) return false
    if (root.queryHistoryIndex < 0) {
      if (!older) return false
      root.queryHistoryDraft = String(searchInput.text || "")
      root.queryHistoryIndex = 0
    } else if (older) {
      root.queryHistoryIndex = Math.min(history.length - 1, root.queryHistoryIndex + 1)
    } else {
      root.queryHistoryIndex -= 1
    }

    root.applyingQueryHistory = true
    searchInput.text = root.queryHistoryIndex < 0
      ? root.queryHistoryDraft : String(history[root.queryHistoryIndex] || "")
    root.applyingQueryHistory = false
    searchInput.selectAll()
    return true
  }

  function popToRoot() {
    root.resetActionPanel()
    root.activeRoute = "root"
    root.navigationStack = []
    root.setSearchTextSilently("")
    root.selectedIndex = 0
    root.resetQueryHistoryNavigation()
    root.rebuildResults()
    Qt.callLater(function() { searchInput.forceActiveFocus() })
  }

  function revealSelection() {
    if (resultsModel.count > 0) resultList.positionViewAtIndex(root.selectedIndex, ListView.Contain)
  }

  function selectResultById(resultId) {
    var target = String(resultId || "")
    for (var i = 0; i < resultsModel.count; i++) {
      if (String(resultsModel.get(i).resultId || "") !== target) continue
      root.selectedIndex = i
      root.revealSelection()
      return true
    }
    return false
  }

  function resultSnapshotAt(index) {
    var targetIndex = Number(index)
    if (resultsModel.count === 0 || targetIndex < 0 || targetIndex >= resultsModel.count) return ({})
    var row = resultsModel.get(targetIndex)
    return {
      resultId: String(row.resultId || ""),
      resultType: String(row.resultType || ""),
      resultKind: String(row.resultKind || ""),
      title: String(row.title || ""),
      breadcrumb: String(row.breadcrumb || ""),
      description: String(row.description || ""),
      appId: String(row.appId || ""),
      route: String(row.route || ""),
      parentRoute: String(row.parentRoute || ""),
      targetRoute: String(row.targetRoute || ""),
      provider: String(row.provider || ""),
      settingKey: String(row.settingKey || ""),
      settingValue: String(row.settingValue || ""),
      calculatorExpression: String(row.calculatorExpression || ""),
      calculatorResult: String(row.calculatorResult || ""),
      filePath: String(row.filePath || ""),
      fileScope: String(row.fileScope || ""),
      userAlias: String(row.userAlias || "")
    }
  }

  function selectedResultSnapshot() {
    return root.resultSnapshotAt(root.selectedIndex)
  }

  function quickActivationOrdinal(key) {
    var keys = [Qt.Key_1, Qt.Key_2, Qt.Key_3, Qt.Key_4, Qt.Key_5, Qt.Key_6, Qt.Key_7, Qt.Key_8]
    for (var index = 0; index < keys.length; index++) {
      if (key === keys[index]) return index + 1
    }
    return 0
  }

  function quickActivationEligible() {
    return !SettingsModel.isRoute(root.activeRoute)
      && !root.compactCollapsed
      && !root.actionPanelOpen
      && !root.warningPanelOpen
  }

  function quickActivationHint(index) {
    return QuickActivationModel.hintForIndex(
      index,
      resultsModel.count,
      root.maximumVisibleRows,
      stateStore.preferences.quickActivationEnabled === true,
      root.quickActivationEligible())
  }

  function activateQuickResult(event) {
    if (event.modifiers !== Qt.ControlModifier) return false
    var ordinal = root.quickActivationOrdinal(event.key)
    var index = QuickActivationModel.resultIndex(
      ordinal,
      resultsModel.count,
      root.maximumVisibleRows,
      stateStore.preferences.quickActivationEnabled === true,
      root.quickActivationEligible())
    if (index < 0) return false
    root.runResult(root.resultSnapshotAt(index), false)
    return true
  }

  function menuTitle(route) {
    if (route === "root") return "Omalauncher"
    if (route === "apps") return "Apps"
    if (route === "files") return "Files"
    if (route === "hidden") return "Hidden Results"
    if (SettingsModel.isRoute(route)) return SettingsModel.routeTitle(route)
    var entry = root.menuItems[route]
    return entry ? String(entry.title || entry.label || route) : String(route || "Omalauncher")
  }

  function setActiveRoute(route, pushHistory) {
    var nextRoute = String(route || "root")
    if (nextRoute !== "root" && nextRoute !== "hidden" && nextRoute !== "files"
        && !SettingsModel.isRoute(nextRoute)) {
      var nextEntry = root.menuItems[nextRoute]
      if (!nextEntry || (nextEntry.kind !== "menu" && nextEntry.kind !== "link")) return false
      if (nextEntry.kind === "link" && nextEntry.target) {
        nextRoute = String(nextEntry.target)
        nextEntry = root.menuItems[nextRoute]
      }
      if (!nextEntry || (nextEntry.kind !== "menu" && nextEntry.kind !== "link")) return false
      if (nextEntry.provider && nextEntry.provider !== "apps") return false
    }
    if (pushHistory && nextRoute !== root.activeRoute) {
      root.navigationStack = root.navigationStack.concat([root.activeRoute])
    }
    root.resetActionPanel()
    root.settingsInputError = ""
    if (root.settingsInputBusy && nextRoute !== root.activeRoute) {
      if (scopeRealpathProc.running) scopeRealpathProc.signal(15)
      if (scopeTypeProc.running) scopeTypeProc.signal(15)
      root.settingsInputBusy = false
      root.settingsScopeSuggested = false
    }
    root.activeRoute = nextRoute
    root.setSearchTextSilently("")
    root.selectedIndex = 0
    root.rebuildResults()
    Qt.callLater(function() { searchInput.forceActiveFocus() })
    return true
  }

  function goBack() {
    if (root.activeRoute === "root") return false
    var previousRoute = "root"
    if (root.navigationStack.length > 0) {
      previousRoute = root.navigationStack[root.navigationStack.length - 1]
      root.navigationStack = root.navigationStack.slice(0, root.navigationStack.length - 1)
    } else {
      var current = root.menuItems[root.activeRoute]
      previousRoute = current && current.parent ? String(current.parent) : "root"
    }
    return root.setActiveRoute(previousRoute, false)
  }

  function openMenu(row) {
    var provider = String(row.provider || "")
    var route = String(row.targetRoute || row.route || "")
    if (provider && provider !== "apps") {
      root.runStockRoute(route)
      return
    }
    if (!root.setActiveRoute(route, true)) root.runStockRoute(route)
  }

  function resetActionPanel() {
    root.actionPanelOpen = false
    root.actionTarget = ({})
    root.actionSelectedIndex = 0
    root.actionRoute = "root"
    root.actionRouteTitle = "Actions"
    root.actionNavigationStack = []
    root.actionSectionCount = 0
    root.aliasEditorOpen = false
    root.aliasEditorError = ""
    actionResultsModel.clear()
    actionSearchInput.text = ""
  }

  function openActionPanel() {
    var target = root.selectedResultSnapshot()
    if (!target.resultId) return
    root.warningPanelOpen = false
    root.actionTarget = target
    root.actionSelectedIndex = 0
    root.actionRoute = "root"
    root.actionRouteTitle = "Actions"
    root.actionNavigationStack = []
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
      usage: stateStore.usage,
      alias: stateStore.aliasFor(root.actionTarget.resultId),
      hidden: stateStore.isHidden(root.actionTarget.resultId),
      favoriteIndex: stateStore.favorites.indexOf(root.actionTarget.resultId),
      favoriteCount: stateStore.favorites.length
    }, root.actionRoute)
    var query = String(actionSearchInput.text || "").trim()
    if (query) actions = SearchEngine.search(actions, query, { limit: 10 })
    var sections = ({})
    for (var i = 0; i < actions.length; i++) {
      var action = actions[i]
      var section = String(action.section || "")
      if (section) sections[section] = true
      actionResultsModel.append({
        actionId: String(action.id || ""),
        title: String(action.title || ""),
        description: String(action.description || ""),
        shortcut: String(action.shortcut || ""),
        icon: String(action.icon || ""),
        section: section,
        actionKind: String(action.kind || "command"),
        targetRoute: String(action.target || "")
      })
    }
    root.actionSectionCount = Object.keys(sections).length

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

  function openActionRoute(route, title) {
    var nextRoute = String(route || "")
    if (!nextRoute) return
    root.actionNavigationStack = root.actionNavigationStack.concat([{
      route: root.actionRoute,
      title: root.actionRouteTitle
    }])
    root.actionRoute = nextRoute
    root.actionRouteTitle = String(title || "Actions")
    root.actionSelectedIndex = 0
    actionSearchInput.text = ""
    root.rebuildActions()
    Qt.callLater(function() { actionSearchInput.forceActiveFocus() })
  }

  function goBackActionRoute() {
    if (root.actionNavigationStack.length === 0) return false
    var previous = root.actionNavigationStack[root.actionNavigationStack.length - 1]
    root.actionNavigationStack = root.actionNavigationStack.slice(0, root.actionNavigationStack.length - 1)
    root.actionRoute = String(previous.route || "root")
    root.actionRouteTitle = String(previous.title || "Actions")
    root.actionSelectedIndex = 0
    actionSearchInput.text = ""
    root.rebuildActions()
    Qt.callLater(function() { actionSearchInput.forceActiveFocus() })
    return true
  }

  function aliasConflictId(value, targetId) {
    var alias = SearchEngine.normalize(value)
    if (!alias) return ""
    for (var i = 0; i < root.allRecords.length; i++) {
      var record = root.allRecords[i]
      if (String(record.id || "") === String(targetId || "")) continue
      var userAlias = stateStore.aliasFor(record.id)
      if (userAlias && SearchEngine.normalize(userAlias) === alias) return String(record.id || "")
      var aliases = Array.isArray(record.aliases) ? record.aliases : []
      for (var a = 0; a < aliases.length; a++) {
        if (SearchEngine.normalize(aliases[a]) === alias) return String(record.id || "")
      }
    }
    return ""
  }

  function resultTitleById(resultId) {
    for (var i = 0; i < root.allRecords.length; i++) {
      if (String(root.allRecords[i].id || "") === String(resultId || "")) return String(root.allRecords[i].title || resultId)
    }
    return String(resultId || "")
  }

  function openAliasEditor() {
    root.aliasEditorError = ""
    root.aliasEditorOpen = true
    aliasEditInput.text = stateStore.aliasFor(root.actionTarget.resultId)
    Qt.callLater(function() {
      aliasEditInput.forceActiveFocus()
      aliasEditInput.selectAll()
    })
  }

  function closeAliasEditor() {
    root.aliasEditorOpen = false
    root.aliasEditorError = ""
    Qt.callLater(function() { actionSearchInput.forceActiveFocus() })
  }

  function saveAliasEditor() {
    var alias = String(aliasEditInput.text || "").trim().toLowerCase()
    if (!alias) {
      root.aliasEditorError = "Enter an alias"
      return
    }
    if (!/^[a-z0-9._-]+$/.test(alias)) {
      root.aliasEditorError = "Use letters, numbers, dots, dashes, or underscores"
      return
    }
    var conflictId = root.aliasConflictId(alias, root.actionTarget.resultId)
    if (conflictId) {
      root.aliasEditorError = "Already used by " + root.resultTitleById(conflictId)
      return
    }
    stateStore.setAlias(root.actionTarget.resultId, alias)
    root.showOsd("󰌷", "Alias set: " + alias)
    root.closeAliasEditor()
    root.rebuildActions()
  }

  function performAction(actionId) {
    var selectedActionId = String(actionId || "")
    if (!selectedActionId) {
      if (actionResultsModel.count === 0 || root.actionSelectedIndex >= actionResultsModel.count) return
      selectedActionId = String(actionResultsModel.get(root.actionSelectedIndex).actionId || "")
    }
    var target = root.actionTarget
    if (!target.resultId) return

    var selectedAction = ({})
    for (var actionIndex = 0; actionIndex < actionResultsModel.count; actionIndex++) {
      var candidate = actionResultsModel.get(actionIndex)
      if (String(candidate.actionId || "") === selectedActionId) {
        selectedAction = candidate
        break
      }
    }
    if (String(selectedAction.actionKind || "") === "submenu") {
      root.openActionRoute(selectedAction.targetRoute, selectedAction.title)
      return
    }
    if (String(selectedAction.actionKind || "") === "editor"
        && String(selectedAction.targetRoute || "") === "alias") {
      root.openAliasEditor()
      return
    }

    if (selectedActionId === "favorite") {
      var favoriteNow = stateStore.toggleFavorite(target.resultId)
      root.showOsd("", favoriteNow ? "Favorited " + target.title : "Removed favorite " + target.title)
      return
    }
    if (selectedActionId === "favorite-up" || selectedActionId === "favorite-down") {
      root.moveFavoriteForId(target.resultId, selectedActionId === "favorite-up" ? -1 : 1)
      return
    }
    if (selectedActionId === "reset-ranking") {
      stateStore.resetRanking(target.resultId)
      root.showOsd("󰈹", "Reset ranking for " + target.title)
      return
    }
    if (selectedActionId === "remove-alias") {
      stateStore.setAlias(target.resultId, "")
      root.showOsd("󰌷", "Alias removed from " + target.title)
      root.rebuildActions()
      return
    }
    if (selectedActionId === "toggle-hidden") {
      var hiddenNow = stateStore.setHidden(target.resultId, !stateStore.isHidden(target.resultId))
      root.showOsd(hiddenNow ? "" : "", hiddenNow ? "Hidden " + target.title : "Restored " + target.title)
      root.closeActionPanel()
      if (!hiddenNow && root.activeRoute === "hidden" && root.hiddenRecords().length === 0) root.goBack()
      return
    }
    if (selectedActionId === "stock-menu") {
      root.openInStockMenu(target)
      return
    }
    if (selectedActionId === "copy-expression") {
      root.copyText(target.calculatorExpression, "Copied calculator expression")
      return
    }
    if (selectedActionId === "copy-path") {
      root.copyText(target.filePath, "Copied file path")
      return
    }
    if (selectedActionId === "reveal-file") {
      root.revealFile(target.filePath)
      return
    }
    if (selectedActionId === "primary" || selectedActionId === "parent") {
      root.runResult(target, selectedActionId === "parent")
    }
  }

  function runStockRoute(route) {
    var selectedRoute = String(route || "")
    if (!selectedRoute) return
    root.showOsd("", "Opening in Omarchy")
    root.close()
    if (root.shell && typeof root.shell.hide === "function") root.shell.hide(root.pluginId)
    Quickshell.execDetached(["omarchy", "menu", "summon", selectedRoute])
  }

  function runResult(row, useParent) {
    if (!row || !row.resultId) return
    if (row.resultKind === "open-settings") {
      root.setActiveRoute("settings", true)
      return
    }
    if (row.resultKind === "settings-toggle") {
      var settingKey = String(row.settingKey || "")
      if (settingKey === "compactMode") {
        root.toggleCompactMode()
        if (root.activeRoute !== "settings") root.setActiveRoute("settings", true)
      } else {
        var nextSettingValue = stateStore.preferences[settingKey] !== true
        stateStore.setPreference(settingKey, nextSettingValue)
        root.showOsd("", row.title + " " + (nextSettingValue ? "enabled" : "disabled"))
        root.rebuildResults()
      }
      return
    }
    if (row.resultKind === "settings-open-scope") {
      root.setActiveRoute("settings-scope", true)
      return
    }
    if (row.resultKind === "settings-add-suggested-scope") {
      root.validateSettingsScope(row.settingValue)
      return
    }
    if (row.resultKind === "settings-open-ignore") {
      root.setActiveRoute("settings-ignore", true)
      return
    }
    if (row.resultKind === "settings-save-scope") {
      root.validateSettingsScope(row.settingValue)
      return
    }
    if (row.resultKind === "settings-save-ignore") {
      root.saveSettingsIgnore(row.settingValue)
      return
    }
    if (row.resultKind === "settings-remove-scope") {
      stateStore.removeFileScope(row.settingValue)
      root.showOsd("󰈞", "Removed file search scope")
      root.rebuildResults()
      return
    }
    if (row.resultKind === "settings-remove-ignore") {
      stateStore.removeFileIgnore(row.settingValue)
      root.showOsd("󰈞", "Removed file ignore pattern")
      root.rebuildResults()
      return
    }
    if (row.resultKind === "settings-open-reset-providers") {
      root.setActiveRoute("settings-reset-providers", true)
      return
    }
    if (row.resultKind === "settings-open-reset-personalization") {
      root.setActiveRoute("settings-reset-personalization", true)
      return
    }
    if (row.resultKind === "settings-confirm-reset-providers") {
      stateStore.resetProviderSettings()
      root.showOsd("󰑐", "Provider settings reset")
      root.goBack()
      return
    }
    if (row.resultKind === "settings-confirm-reset-personalization") {
      stateStore.resetPersonalization()
      root.showOsd("", "Personalization reset")
      root.goBack()
      return
    }
    if (row.resultKind === "settings-cancel") {
      root.goBack()
      return
    }
    if (row.resultKind === "calculator") {
      root.copyText(row.calculatorResult, "Copied calculator result")
      return
    }
    if (row.resultKind === "calculator-unavailable") {
      root.setActiveRoute("settings", true)
      return
    }
    if (row.resultKind === "calculator-loading" || row.resultKind === "calculator-error") return
    if (row.resultKind === "open-files") {
      root.setActiveRoute(
        stateStore.preferences.fileSearchEnabled === true ? "files" : "settings", true)
      return
    }
    if (row.resultType === "file-status") {
      if (row.route === "settings") root.setActiveRoute("settings", true)
      return
    }
    if (row.resultType === "file") {
      var fileQuery = String(searchInput.text || "").trim()
      if (fileQuery) stateStore.recordQuery(fileQuery)
      root.openFile(row.filePath)
      return
    }
    if (row.resultKind === "toggle-compact") {
      root.toggleCompactMode()
      return
    }
    if (row.resultKind === "manage-hidden") {
      root.setActiveRoute("hidden", true)
      return
    }
    var selectedQuery = String(searchInput.text || "").trim()
    if (selectedQuery) stateStore.recordQuery(selectedQuery)
    stateStore.recordSelection(row.resultId)
    if (row.resultType === "application") {
      root.launchApplication(row.appId, row.title)
    } else if (useParent) {
      root.setActiveRoute(row.parentRoute || "root", true)
    } else if (row.resultKind === "menu" || row.resultKind === "link") {
      root.openMenu(row)
    } else {
      root.runStockRoute(row.route)
    }
  }

  function openInStockMenu(row) {
    if (!row || row.resultType === "application") return
    var route = (row.resultKind === "menu" || row.resultKind === "link")
      ? String(row.targetRoute || row.route || "root")
      : String(row.parentRoute || "root")
    root.runStockRoute(route)
  }

  function runSelected(useParent) {
    root.runResult(root.selectedResultSnapshot(), useParent)
  }

  function toggleCompactMode() {
    var enabled = !root.compactMode
    root.resetActionPanel()
    root.warningPanelOpen = false
    stateStore.setCompactMode(enabled)
    root.compactExpanded = false
    root.setSearchTextSilently("")
    root.selectedIndex = 0
    root.showOsd(enabled ? "" : "", enabled ? "Compact Mode enabled" : "Compact Mode disabled")
    root.rebuildResults()
    Qt.callLater(function() { searchInput.forceActiveFocus() })
  }

  function validateSettingsScope(value) {
    if (root.settingsInputBusy) return
    root.settingsScopeSuggested = root.activeRoute === "settings"
    var candidate = String(value || "").trim()
    if (!candidate || candidate.charAt(0) !== "/") {
      root.settingsInputError = "Enter an absolute directory path"
      root.rebuildResults()
      return
    }
    if (candidate === "/") {
      root.settingsInputError = "The filesystem root cannot be a search scope"
      root.rebuildResults()
      return
    }
    root.settingsInputBusy = true
    root.settingsInputError = ""
    scopeRealpathProc.output = ""
    scopeRealpathProc.command = ["realpath", "-e", "--", candidate]
    scopeRealpathProc.running = true
    root.rebuildResults()
  }

  function saveSettingsIgnore(value) {
    var pattern = String(value || "").trim()
    if (!pattern || /[\r\n\0]/.test(pattern)) {
      root.settingsInputError = "Enter one file name or glob pattern"
      root.rebuildResults()
      return
    }
    var existed = stateStore.preferences.fileSearchIgnores.indexOf(pattern) >= 0
    stateStore.addFileIgnore(pattern)
    root.showOsd("󰈞", existed ? "Ignore pattern already configured" : "Added file ignore pattern")
    root.goBack()
  }

  function copyText(value, message) {
    var copyValue = String(value || "")
    if (!copyValue) return
    Quickshell.execDetached(["wl-copy", "--", copyValue])
    root.showOsd("", String(message || "Copied"))
    root.dismiss()
  }

  function openFile(value) {
    var path = String(value || "")
    if (!path || path.charAt(0) !== "/") return
    root.dismiss()
    Quickshell.execDetached(["xdg-open", path])
  }

  function revealFile(value) {
    var parent = FileSearchModel.parentPath(value)
    if (!parent || parent.charAt(0) !== "/") return
    root.dismiss()
    Quickshell.execDetached(["xdg-open", parent])
  }

  function toggleSelectedFavorite() {
    if (resultsModel.count === 0 || root.selectedIndex < 0 || root.selectedIndex >= resultsModel.count) return
    var row = resultsModel.get(root.selectedIndex)
    var favoriteNow = stateStore.toggleFavorite(row.resultId)
    root.showOsd("", favoriteNow ? "Favorited " + row.title : "Removed favorite " + row.title)
  }

  function moveFavoriteForId(resultId, delta) {
    var target = String(resultId || "")
    if (!stateStore.isFavorite(target)) return
    var previousIndex = stateStore.favorites.indexOf(target)
    stateStore.moveFavorite(target, delta)
    var nextIndex = stateStore.favorites.indexOf(target)
    if (nextIndex !== previousIndex) {
      root.showOsd("", "Moved " + root.resultTitleById(target) + " to favorite " + (nextIndex + 1))
    }
    Qt.callLater(function() { root.selectResultById(target) })
  }

  function moveSelectedFavorite(delta) {
    var selected = root.selectedResultSnapshot()
    if (selected.resultId) root.moveFavoriteForId(selected.resultId, delta)
  }

  function launchApplication(appId, title) {
    if (!appId) return
    root.close()
    if (root.shell && typeof root.shell.hide === "function") root.shell.hide(root.pluginId)
    appProvider.launch(appId, title)
  }

  function highlightedText(value) {
    var fileRequest = FileSearchModel.queryRequest(
      searchInput.text, root.activeRoute === "files")
    return HighlightModel.highlight(
      value, SearchEngine.tokens(fileRequest.active ? fileRequest.query : searchInput.text))
  }

  function primaryActionLabel() {
    var row = root.selectedResultSnapshot()
    if (!row.resultId) return ""
    if (row.resultKind === "toggle-compact") return "Toggle"
    if (row.resultKind === "manage-hidden") return "Manage"
    if (row.resultKind === "open-settings") return "Open Settings"
    if (row.resultKind === "open-files") return "Open File Search"
    if (String(row.resultKind || "").indexOf("settings-") === 0) return "Apply"
    if (row.resultKind === "calculator") return "Copy Result"
    if (String(row.resultKind || "").indexOf("calculator-") === 0) return ""
    if (row.resultType === "file") return "Open File"
    if (row.resultType === "file-status") return row.route === "settings" ? "Open Settings" : ""
    if (row.resultType === "application") return "Open Application"
    if (row.resultKind === "menu" || row.resultKind === "link") return "Open Menu"
    return "Run Command"
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
    guardProc.generation = root.menuRevision
    guardProc.command = ["bash", "-lc", script]
    guardProc.running = true
  }

  Process {
    id: scopeRealpathProc
    property string output: ""
    stdout: SplitParser {
      onRead: function(data) { scopeRealpathProc.output += data }
    }
    onExited: function(exitCode, exitStatus) {
      if (root.activeRoute !== "settings-scope" && root.activeRoute !== "settings") return
      var canonical = String(scopeRealpathProc.output || "").trim()
      if (exitCode !== 0 || exitStatus !== 0 || !canonical || canonical === "/") {
        root.settingsInputBusy = false
        root.settingsInputError = canonical === "/"
          ? "The filesystem root cannot be a search scope"
          : "Directory does not exist"
        if (root.settingsScopeSuggested) root.showOsd("", root.settingsInputError)
        root.rebuildResults()
        return
      }
      scopeTypeProc.canonical = canonical
      scopeTypeProc.output = ""
      scopeTypeProc.command = ["stat", "-c", "%F", "--", canonical]
      scopeTypeProc.running = true
    }
  }

  Process {
    id: scopeTypeProc
    property string canonical: ""
    property string output: ""
    stdout: SplitParser {
      onRead: function(data) { scopeTypeProc.output += data }
    }
    onExited: function(exitCode, exitStatus) {
      if (root.activeRoute !== "settings-scope" && root.activeRoute !== "settings") return
      root.settingsInputBusy = false
      if (exitCode !== 0 || exitStatus !== 0 || String(scopeTypeProc.output || "").trim() !== "directory") {
        root.settingsInputError = "Search scopes must be existing directories"
        if (root.settingsScopeSuggested) root.showOsd("", root.settingsInputError)
        root.rebuildResults()
        return
      }
      var canonical = String(scopeTypeProc.canonical || "")
      var existed = stateStore.preferences.fileSearchScopes.indexOf(canonical) >= 0
      stateStore.addFileScope(canonical)
      root.showOsd("󰈞", existed ? "Search scope already configured" : "Added file search scope")
      if (root.settingsScopeSuggested) {
        root.settingsScopeSuggested = false
        root.settingsInputError = ""
        root.rebuildResults()
        Qt.callLater(function() { searchInput.forceActiveFocus() })
      } else {
        root.goBack()
      }
    }
  }

  ListModel { id: resultsModel }
  ListModel { id: actionResultsModel }

  StateStore {
    id: stateStore
    onSnapshotChanged: {
      root.rebuildCachedRecords()
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

  CalculatorProvider {
    id: calculatorProvider
    providerEnabled: !!stateStore.preferences
      && stateStore.preferences.calculatorEnabled === true
    onRecordsChanged: root.rebuildResults()
    onBackendSettledChanged: if (root.activeRoute === "settings") root.rebuildResults()
  }

  FileSearchProvider {
    id: fileSearchProvider
    providerEnabled: !!stateStore.preferences
      && stateStore.preferences.fileSearchEnabled === true
    onRecordsChanged: root.rebuildResults()
    onBackendSettledChanged: if (root.activeRoute === "settings") root.rebuildResults()
    onCommonScopesChanged: if (root.activeRoute === "settings") root.rebuildResults()
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
    property int generation: 0
    stdout: SplitParser {
      onRead: function(data) { guardProc.collected += data + "\n" }
    }
    onExited: function(exitCode, exitStatus) {
      var completion = GenerationModel.completion(
        guardProc.generation, root.menuRevision, root.guardsPending)
      if (completion.apply) {
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
      }
      if (completion.restart) Qt.callLater(root.evaluateGuards)
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
        Math.max(
          root.compactCollapsed
            ? LayoutModel.compactCardHeight(searchBox.height, root.cardPadding)
            : LayoutModel.resultCardHeight(
                searchBox.height,
                root.listHeight,
                root.cardPadding,
                root.resultsTopOffset,
                root.footerHeight),
          root.actionPanelOpen ? root.actionPanelHeight + Style.space(24) : 0),
        root.warningPanelOpen ? root.warningPanelHeight + Style.space(24) : 0)
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
      Accessible.role: Accessible.Dialog
      Accessible.name: "Omalauncher"

      MouseArea {
        anchors.fill: parent
        onClicked: {
          if (root.actionPanelOpen) root.closeActionPanel()
          else if (root.warningPanelOpen) root.closeWarningPanel()
          else searchInput.forceActiveFocus()
        }
      }

      Rectangle {
        id: searchBox
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.margins: root.cardPadding
        height: Math.max(Style.space(52), Style.font.heading + Style.space(24))
        radius: Math.max(0, Style.cornerRadius - Style.space(2))
        color: root.selectedBackground
        opacity: 0.96

        Text {
          anchors.left: parent.left
          anchors.leftMargin: Style.space(16)
          anchors.verticalCenter: parent.verticalCenter
          text: root.activeRoute === "root" ? "" : ""
          color: root.selectedText
          font.family: Style.font.menuFamily
          font.pixelSize: Style.font.icon
          Accessible.role: root.activeRoute === "root" ? Accessible.StaticText : Accessible.Button
          Accessible.name: root.activeRoute === "root" ? "Search" : "Back to previous section"
          Accessible.onPressAction: if (root.activeRoute !== "root") root.goBack()

          MouseArea {
            anchors.fill: parent
            enabled: root.activeRoute !== "root"
            cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
            onClicked: root.goBack()
          }
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
            : (root.indexSettled
                ? (root.activeRoute === "root" ? "Search apps and Omarchy commands…" : "Search " + root.activeMenuTitle + "…")
                : "Building unified index…")
          color: root.selectedText
          opacity: 0.55
          font.family: Style.font.menuFamily
          font.pixelSize: Style.font.heading
          elide: Text.ElideRight
        }

        TextInput {
          id: searchInput
          enabled: !root.actionPanelOpen && !root.warningPanelOpen && stateStore.loaded
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
          Accessible.role: Accessible.EditableText
          Accessible.name: root.activeRoute === "root"
            ? "Search applications and Omarchy commands"
            : "Search " + root.activeMenuTitle
          Accessible.description: "Type to filter results"
          Accessible.focusable: true
          Accessible.searchEdit: true
          onTextChanged: {
            if (root.suppressSearchChange) return
            if (!root.applyingQueryHistory) root.resetQueryHistoryNavigation()
            if (SettingsModel.isInputRoute(root.activeRoute)) root.settingsInputError = ""
            if (!searchInput.text) root.compactExpanded = false
            root.selectedIndex = 0
            root.rebuildResults()
          }

          Keys.priority: Keys.BeforeItem
          Keys.onPressed: function(event) {
            if (root.activateQuickResult(event)) {
              event.accepted = true
            } else if ((event.modifiers & Qt.ControlModifier) !== 0 && event.key === Qt.Key_K) {
              root.openActionPanel()
              event.accepted = true
            } else if ((event.modifiers & Qt.ControlModifier) !== 0
                       && (event.modifiers & Qt.ShiftModifier) !== 0
                       && event.key === Qt.Key_C) {
              root.toggleCompactMode()
              event.accepted = true
            } else if ((event.modifiers & Qt.ControlModifier) !== 0 && event.key === Qt.Key_W) {
              root.dismiss()
              event.accepted = true
            } else if ((event.modifiers & Qt.ShiftModifier) !== 0 && event.key === Qt.Key_Escape) {
              root.popToRoot()
              event.accepted = true
            } else if ((event.modifiers & Qt.ControlModifier) !== 0
                       && (event.modifiers & Qt.ShiftModifier) !== 0
                       && event.key === Qt.Key_Up) {
              root.moveSelectedFavorite(-1)
              event.accepted = true
            } else if ((event.modifiers & Qt.ControlModifier) !== 0
                       && (event.modifiers & Qt.ShiftModifier) !== 0
                       && event.key === Qt.Key_Down) {
              root.moveSelectedFavorite(1)
              event.accepted = true
            } else if ((event.modifiers & Qt.ControlModifier) !== 0 && event.key === Qt.Key_F) {
              root.toggleSelectedFavorite()
              event.accepted = true
            } else if ((event.modifiers & Qt.ControlModifier) !== 0 && event.key === Qt.Key_Up) {
              root.moveResultSection(-1)
              event.accepted = true
            } else if ((event.modifiers & Qt.ControlModifier) !== 0 && event.key === Qt.Key_Down) {
              root.moveResultSection(1)
              event.accepted = true
            } else if (event.key === Qt.Key_Escape) {
              if (searchInput.text) searchInput.text = ""
              else if (root.goBack()) { }
              else root.dismiss()
              event.accepted = true
            } else if ((event.key === Qt.Key_Backspace || event.key === Qt.Key_Left)
                       && !searchInput.text && root.activeRoute !== "root") {
              root.goBack()
              event.accepted = true
            } else if (event.key === Qt.Key_Up) {
              if (root.selectedIndex === 0) root.cycleQueryHistory(true)
              else root.moveSelection(-1)
              event.accepted = true
            } else if (event.key === Qt.Key_Down) {
              if (root.compactCollapsed) root.compactExpanded = true
              else if (!root.cycleQueryHistory(false)) root.moveSelection(1)
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

        Item {
          width: Style.space(38)
          height: parent.height
          anchors.right: parent.right
          anchors.verticalCenter: parent.verticalCenter
          visible: !!root.providerWarning
          Accessible.role: Accessible.Button
          Accessible.name: "Open provider warnings"
          Accessible.description: root.providerWarning
          Accessible.focusable: true
          Accessible.onPressAction: root.openWarningPanel()

          Text {
            anchors.centerIn: parent
            text: ""
            color: root.selectedText
            opacity: warningMouse.containsMouse ? 1 : 0.7
            font.family: Style.font.menuFamily
            font.pixelSize: Style.font.body
          }

          MouseArea {
            id: warningMouse
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.openWarningPanel()
          }
        }
      }

      Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: searchBox.bottom
        anchors.topMargin: root.cardPadding
        height: root.dividerHeight
        visible: !root.compactCollapsed
        color: root.borderColor
        opacity: 0.5
      }

      ListView {
        id: resultList
        visible: !root.compactCollapsed
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: searchBox.bottom
        anchors.topMargin: root.resultsTopOffset
        anchors.bottom: parent.bottom
        anchors.bottomMargin: root.footerHeight
        model: resultsModel
        enabled: !root.actionPanelOpen
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        section.property: "section"
        section.criteria: ViewSection.FullString
        Accessible.role: Accessible.List
        Accessible.name: "Search results"
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
          required property string targetRoute
          required property string provider
          required property string resultKind
          required property bool favorite
          required property bool isChecked
          required property string userAlias

          readonly property bool selected: index === root.selectedIndex
          readonly property bool isApplication: resultType === "application"
          width: ListView.view.width
          height: root.rowHeight
          radius: Math.max(0, Style.cornerRadius - Style.space(3))
          color: selected ? root.selectedBackground : "transparent"
          Accessible.role: Accessible.ListItem
          Accessible.name: resultRow.title
          Accessible.description: resultRow.breadcrumb || resultRow.description
          Accessible.focusable: true
          Accessible.focused: resultRow.selected
          Accessible.onPressAction: {
            root.selectedIndex = resultRow.index
            root.runSelected(false)
          }

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
            anchors.right: rowBadges.left
            anchors.rightMargin: Style.space(12)
            anchors.verticalCenter: parent.verticalCenter
            spacing: Style.space(3)

            Text {
              width: parent.width
              text: root.highlightedText(resultRow.title) + (resultRow.isChecked ? " ✓" : "")
              textFormat: Text.RichText
              color: resultRow.selected ? root.selectedText : root.foreground
              font.family: Style.font.menuFamily
              font.pixelSize: Style.font.heading
              font.weight: Font.Medium
              elide: Text.ElideRight
            }

            Text {
              width: parent.width
              text: resultRow.breadcrumb
                ? root.highlightedText(resultRow.breadcrumb)
                : HighlightModel.escapeHtml(resultRow.description)
              visible: text.length > 0
              textFormat: Text.RichText
              color: resultRow.selected ? root.selectedText : root.foreground
              opacity: 0.58
              font.family: Style.font.menuFamily
              font.pixelSize: Style.font.bodySmall
              elide: Text.ElideRight
            }
          }

          Row {
            id: rowBadges
            anchors.right: parent.right
            anchors.rightMargin: Style.space(18)
            anchors.verticalCenter: parent.verticalCenter
            spacing: Style.space(8)

            Rectangle {
              visible: root.quickActivationHint(resultRow.index).length > 0
              width: quickActivationText.implicitWidth + Style.space(10)
              height: Math.max(Style.space(22), quickActivationText.implicitHeight + Style.space(6))
              radius: height / 2
              color: resultRow.selected ? root.selectedText : root.selectedBackground
              opacity: 0.75

              Text {
                id: quickActivationText
                anchors.centerIn: parent
                text: root.quickActivationHint(resultRow.index)
                color: resultRow.selected ? root.selectedBackground : root.selectedText
                font.family: Style.font.menuFamily
                font.pixelSize: Style.font.caption
              }
            }

            Text {
              visible: resultRow.favorite
              text: "★"
              color: resultRow.selected ? root.selectedText : root.foreground
              opacity: 0.7
              font.family: Style.font.menuFamily
              font.pixelSize: Style.font.body
            }

            Rectangle {
              visible: resultRow.userAlias.length > 0
              width: aliasBadgeText.implicitWidth + Style.space(12)
              height: Math.max(Style.space(22), aliasBadgeText.implicitHeight + Style.space(6))
              radius: height / 2
              color: resultRow.selected ? root.selectedText : root.selectedBackground
              opacity: 0.82

              Text {
                id: aliasBadgeText
                anchors.centerIn: parent
                text: resultRow.userAlias
                color: resultRow.selected ? root.selectedBackground : root.selectedText
                font.family: Style.font.menuFamily
                font.pixelSize: Style.font.caption
              }
            }
          }

          MouseArea {
            anchors.fill: parent
            hoverEnabled: true
            acceptedButtons: Qt.LeftButton | Qt.RightButton
            cursorShape: Qt.PointingHandCursor
            onPositionChanged: root.selectedIndex = NavigationModel.pointerSelectionIndex(
              resultsModel.count, root.selectedIndex, resultRow.index, true)
            onClicked: function(mouse) {
              root.selectedIndex = resultRow.index
              if (mouse.button === Qt.RightButton) root.openActionPanel()
              else root.runSelected(false)
            }
          }
        }
      }

      Column {
        anchors.centerIn: resultList
        spacing: Style.space(8)
        width: Math.max(1, Math.min(Style.space(500), resultList.width - Style.space(32)))
        visible: !root.compactCollapsed && root.emptyStatus.visible

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
        id: footer
        visible: !root.compactCollapsed
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        height: root.footerHeight
        color: "transparent"

        Rectangle {
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.top: parent.top
          height: root.dividerHeight
          color: root.borderColor
          opacity: 0.45
        }

        Text {
          anchors.left: parent.left
          anchors.leftMargin: Style.space(18)
          anchors.verticalCenter: parent.verticalCenter
          text: root.primaryActionLabel() ? "↵  " + root.primaryActionLabel() : ""
          color: root.foreground
          opacity: 0.58
          font.family: Style.font.menuFamily
          font.pixelSize: Style.font.caption
        }

        Text {
          anchors.right: parent.right
          anchors.rightMargin: Style.space(18)
          anchors.verticalCenter: parent.verticalCenter
          text: "Ctrl+K  Actions"
          color: root.foreground
          opacity: 0.58
          font.family: Style.font.menuFamily
          font.pixelSize: Style.font.caption
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
        Accessible.role: Accessible.PopupMenu
        Accessible.name: root.actionRouteTitle + " for " + String(root.actionTarget.title || "")

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
            text: root.actionRouteTitle
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
            Accessible.role: Accessible.EditableText
            Accessible.name: "Search actions"
            Accessible.focusable: true
            Accessible.searchEdit: true
            onTextChanged: {
              root.actionSelectedIndex = 0
              root.rebuildActions()
            }

            Keys.priority: Keys.BeforeItem
            Keys.onPressed: function(event) {
              if ((event.modifiers & Qt.ControlModifier) !== 0 && event.key === Qt.Key_W) {
                root.dismiss()
                event.accepted = true
              } else if ((event.modifiers & Qt.ControlModifier) !== 0
                         && (event.modifiers & Qt.ShiftModifier) !== 0
                         && event.key === Qt.Key_C) {
                root.toggleCompactMode()
                event.accepted = true
              } else if ((event.modifiers & Qt.ShiftModifier) !== 0 && event.key === Qt.Key_Escape) {
                root.popToRoot()
                event.accepted = true
              } else if (event.key === Qt.Key_Escape
                  || ((event.modifiers & Qt.ControlModifier) !== 0 && event.key === Qt.Key_K)) {
                if (event.key === Qt.Key_Escape && root.goBackActionRoute()) { }
                else root.closeActionPanel()
                event.accepted = true
              } else if ((event.modifiers & Qt.ControlModifier) !== 0
                         && (event.modifiers & Qt.ShiftModifier) !== 0
                         && event.key === Qt.Key_Up) {
                root.moveFavoriteForId(root.actionTarget.resultId, -1)
                event.accepted = true
              } else if ((event.modifiers & Qt.ControlModifier) !== 0
                         && (event.modifiers & Qt.ShiftModifier) !== 0
                         && event.key === Qt.Key_Down) {
                root.moveFavoriteForId(root.actionTarget.resultId, 1)
                event.accepted = true
              } else if ((event.modifiers & Qt.ControlModifier) !== 0 && event.key === Qt.Key_F) {
                root.performAction("favorite")
                event.accepted = true
              } else if ((event.modifiers & Qt.ControlModifier) !== 0 && event.key === Qt.Key_Up) {
                root.moveActionSection(-1)
                event.accepted = true
              } else if ((event.modifiers & Qt.ControlModifier) !== 0 && event.key === Qt.Key_Down) {
                root.moveActionSection(1)
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
          section.property: "section"
          section.criteria: ViewSection.FullString
          Accessible.role: Accessible.List
          Accessible.name: "Available actions"
          section.delegate: Rectangle {
            required property string section
            width: actionList.width
            height: section ? root.sectionHeight : 0
            color: "transparent"

            Text {
              anchors.left: parent.left
              anchors.leftMargin: Style.space(16)
              anchors.bottom: parent.bottom
              anchors.bottomMargin: Style.space(4)
              text: parent.section
              color: root.foreground
              opacity: 0.46
              font.family: Style.font.menuFamily
              font.pixelSize: Style.font.caption
              font.weight: Font.DemiBold
            }
          }

          delegate: Rectangle {
            id: actionRow
            required property int index
            required property string actionId
            required property string title
            required property string description
            required property string shortcut
            required property string icon
            required property string actionKind
            required property string targetRoute

            readonly property bool selected: index === root.actionSelectedIndex
            width: ListView.view.width
            height: root.actionRowHeight
            radius: Math.max(0, Style.cornerRadius - Style.space(4))
            color: selected ? root.selectedBackground : "transparent"
            Accessible.role: Accessible.MenuItem
            Accessible.name: actionRow.title
            Accessible.description: actionRow.description
            Accessible.focusable: true
            Accessible.focused: actionRow.selected
            Accessible.onPressAction: {
              root.actionSelectedIndex = actionRow.index
              root.performAction(actionRow.actionId)
            }

            Text {
              width: Style.space(40)
              anchors.left: parent.left
              anchors.leftMargin: Style.space(10)
              anchors.verticalCenter: parent.verticalCenter
              text: actionRow.icon || (actionRow.actionKind === "submenu" ? "" : "")
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
              onPositionChanged: root.actionSelectedIndex = NavigationModel.pointerSelectionIndex(
                actionResultsModel.count, root.actionSelectedIndex, actionRow.index, true)
              onClicked: {
                root.actionSelectedIndex = actionRow.index
                root.performAction(actionRow.actionId)
              }
            }
          }
        }

        Text {
          anchors.centerIn: actionList
          visible: actionResultsModel.count === 0 && !root.aliasEditorOpen
          text: "No matching actions"
          color: root.foreground
          opacity: 0.55
          font.family: Style.font.menuFamily
          font.pixelSize: Style.font.body
        }

        Rectangle {
          id: aliasEditor
          anchors.fill: parent
          visible: root.aliasEditorOpen
          z: 30
          radius: actionPanel.radius
          color: root.background
          border.width: Math.max(1, Style.space(1))
          border.color: root.borderColor
          Accessible.role: Accessible.Dialog
          Accessible.name: "Set alias for " + String(root.actionTarget.title || "")

          MouseArea {
            anchors.fill: parent
            onClicked: aliasEditInput.forceActiveFocus()
          }

          Column {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.margins: Style.space(18)
            spacing: Style.space(12)

            Text {
              width: parent.width
              text: "Set Alias"
              color: root.foreground
              font.family: Style.font.menuFamily
              font.pixelSize: Style.font.title
              font.weight: Font.DemiBold
            }

            Text {
              width: parent.width
              text: String(root.actionTarget.title || "")
              color: root.foreground
              opacity: 0.55
              font.family: Style.font.menuFamily
              font.pixelSize: Style.font.bodySmall
              elide: Text.ElideRight
            }

            Rectangle {
              width: parent.width
              height: Style.space(48)
              radius: Math.max(0, Style.cornerRadius - Style.space(4))
              color: root.selectedBackground

              TextInput {
                id: aliasEditInput
                anchors.fill: parent
                anchors.leftMargin: Style.space(14)
                anchors.rightMargin: Style.space(14)
                verticalAlignment: TextInput.AlignVCenter
                color: root.selectedText
                selectionColor: root.selectedText
                selectedTextColor: root.selectedBackground
                font.family: Style.font.menuFamily
                font.pixelSize: Style.font.body
                maximumLength: 64
                clip: true
                Accessible.role: Accessible.EditableText
                Accessible.name: "Search alias"
                Accessible.description: "Use letters, numbers, dots, dashes, or underscores"
                Accessible.focusable: true
                onTextChanged: root.aliasEditorError = ""

                Keys.priority: Keys.BeforeItem
                Keys.onPressed: function(event) {
                  if ((event.modifiers & Qt.ControlModifier) !== 0 && event.key === Qt.Key_W) {
                    root.dismiss()
                    event.accepted = true
                  } else if ((event.modifiers & Qt.ShiftModifier) !== 0 && event.key === Qt.Key_Escape) {
                    root.popToRoot()
                    event.accepted = true
                  } else if (event.key === Qt.Key_Escape) {
                    root.closeAliasEditor()
                    event.accepted = true
                  } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
                    root.saveAliasEditor()
                    event.accepted = true
                  }
                }
              }
            }

            Text {
              width: parent.width
              text: root.aliasEditorError || "A short keyword without spaces"
              color: root.aliasEditorError ? Color.urgent : root.foreground
              opacity: root.aliasEditorError ? 0.9 : 0.5
              font.family: Style.font.menuFamily
              font.pixelSize: Style.font.caption
              wrapMode: Text.Wrap
            }

            Text {
              width: parent.width
              text: "Enter  Save  ·  Esc  Cancel"
              color: root.foreground
              opacity: 0.48
              font.family: Style.font.menuFamily
              font.pixelSize: Style.font.caption
            }
          }
        }
      }

      Rectangle {
        id: warningPanel
        visible: root.warningPanelOpen
        z: 40
        width: Math.max(1, Math.min(Style.space(500), card.width - Style.space(24)))
        height: Math.max(1, Math.min(root.warningPanelHeight, card.height - Style.space(24)))
        anchors.top: parent.top
        anchors.right: parent.right
        anchors.margins: Style.space(12)
        radius: Math.max(0, Style.cornerRadius - Style.space(2))
        color: root.background
        border.width: Math.max(1, Style.space(1))
        border.color: root.borderColor
        focus: visible
        Accessible.role: Accessible.Dialog
        Accessible.name: "Provider warnings"

        onVisibleChanged: {
          if (visible) Qt.callLater(function() { warningPanel.forceActiveFocus() })
        }

        Keys.onPressed: function(event) {
          if ((event.modifiers & Qt.ControlModifier) !== 0 && event.key === Qt.Key_W) {
            root.dismiss()
            event.accepted = true
          } else if (event.key === Qt.Key_Escape) {
            root.closeWarningPanel()
            event.accepted = true
          } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter
                     || ((event.modifiers & Qt.ControlModifier) !== 0 && event.key === Qt.Key_R)) {
            root.retryProviders()
            event.accepted = true
          }
        }

        MouseArea {
          anchors.fill: parent
          onClicked: warningPanel.forceActiveFocus()
        }

        Text {
          id: warningTitle
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.top: parent.top
          anchors.margins: Style.space(18)
          text: "Provider Warnings"
          color: root.foreground
          font.family: Style.font.menuFamily
          font.pixelSize: Style.font.title
          font.weight: Font.DemiBold
        }

        ListView {
          id: warningList
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.top: warningTitle.bottom
          anchors.bottom: retryButton.top
          anchors.topMargin: Style.space(10)
          anchors.bottomMargin: Style.space(8)
          model: root.providerDiagnostics
          clip: true
          boundsBehavior: Flickable.StopAtBounds
          Accessible.role: Accessible.List
          Accessible.name: "Provider diagnostics"

          delegate: Item {
            required property var modelData
            width: ListView.view.width
            height: Style.space(76)
            Accessible.role: Accessible.ListItem
            Accessible.name: modelData.provider + ": " + modelData.error
            Accessible.description: modelData.detail

            Text {
              anchors.left: parent.left
              anchors.right: parent.right
              anchors.top: parent.top
              anchors.leftMargin: Style.space(18)
              anchors.rightMargin: Style.space(18)
              text: modelData.provider + " · " + modelData.error
              color: root.foreground
              font.family: Style.font.menuFamily
              font.pixelSize: Style.font.body
              font.weight: Font.Medium
              elide: Text.ElideRight
            }

            Text {
              anchors.left: parent.left
              anchors.right: parent.right
              anchors.top: parent.top
              anchors.topMargin: Style.space(27)
              anchors.leftMargin: Style.space(18)
              anchors.rightMargin: Style.space(18)
              text: modelData.detail
              color: root.foreground
              opacity: 0.5
              font.family: Style.font.menuFamily
              font.pixelSize: Style.font.caption
              wrapMode: Text.Wrap
              maximumLineCount: 2
              elide: Text.ElideRight
            }
          }
        }

        Rectangle {
          id: retryButton
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.bottom: parent.bottom
          anchors.margins: Style.space(12)
          height: Style.space(42)
          radius: Math.max(0, Style.cornerRadius - Style.space(4))
          color: root.selectedBackground
          Accessible.role: Accessible.Button
          Accessible.name: "Retry providers"
          Accessible.description: "Reload launcher state, menus, command checks, and applications"
          Accessible.focusable: true
          Accessible.onPressAction: root.retryProviders()

          Text {
            anchors.centerIn: parent
            text: "  Retry Providers     Enter"
            color: root.selectedText
            font.family: Style.font.menuFamily
            font.pixelSize: Style.font.body
            font.weight: Font.Medium
          }

          MouseArea {
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.retryProviders()
          }
        }
      }
    }
  }
}
