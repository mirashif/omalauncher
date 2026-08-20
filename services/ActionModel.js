// Contextual Action Panel records shared by QML and Node tests.

function text(value) {
  return String(value || "")
}

function action(id, title, description, shortcut, icon, keywords, order, section, kind, target) {
  var keywordList = Array.isArray(keywords) ? keywords : []
  return {
    id: id,
    type: "action",
    title: title,
    description: description,
    shortcut: shortcut,
    icon: icon,
    section: text(section),
    kind: text(kind || "command"),
    target: text(target),
    aliases: [],
    keywords: keywordList,
    searchText: [title, description, keywordList.join(" ")].join(" "),
    providerPriority: 0,
    order: order
  }
}

function actionsForResult(result, context, route) {
  var row = result || {}
  var resultId = text(row.resultId || row.id)
  if (!resultId) return []

  var state = context || {}
  var usage = state.usage || {}
  var favorite = !!state.favorite
  var application = text(row.resultType || row.type) === "application"
  var resultKind = text(row.resultKind || row.kind)
  var menu = !application && (resultKind === "menu" || resultKind === "link")
  var hiddenManager = resultKind === "manage-hidden"
  var resultTitle = text(row.title)
  var actions = []
  var activeRoute = text(route || "root")

  if (activeRoute === "omarchy") {
    if (application) return []
    if (text(row.parentRoute)) {
      actions.push(action(
        "parent",
        "Open Parent Menu",
        text(row.breadcrumb) || "Root menu",
        "Ctrl+Enter",
        "",
        ["parent", "back", "menu", "breadcrumb"],
        0,
        "Navigation"
      ))
    }
    actions.push(action(
      "stock-menu",
      "Open in Default Omarchy Menu",
      menu ? resultTitle : (text(row.breadcrumb) || "Root menu"),
      "",
      "󰍉",
      ["default", "stock", "fallback", "omarchy", "menu"],
      1,
      "Navigation"
    ))
    return actions
  }

  if (activeRoute === "configure") {
    var currentAlias = text(state.alias)
    actions.push(action(
      "set-alias",
      currentAlias ? "Change Alias" : "Set Alias",
      currentAlias || resultTitle,
      "",
      "󰌌",
      ["alias", "keyword", "rename", "configure"],
      0,
      "Alias",
      "editor",
      "alias"
    ))
    if (currentAlias) {
      actions.push(action(
        "remove-alias",
        "Remove Alias",
        currentAlias,
        "",
        "",
        ["alias", "remove", "delete", "clear"],
        1,
        "Alias"
      ))
    }
    actions.push(action(
      "toggle-hidden",
      state.hidden ? "Unhide from Search" : "Hide from Search",
      resultTitle,
      "",
      state.hidden ? "" : "",
      ["hide", "unhide", "visibility", "search"],
      2,
      "Visibility"
    ))
    return actions
  }

  actions.push(action(
    "primary",
    hiddenManager ? "Manage Hidden Results"
      : (application ? "Open Application" : (menu ? "Open Menu" : "Run Command")),
    resultTitle,
    "Enter",
    hiddenManager ? "" : (application ? "" : (menu ? "" : "▶")),
    ["open", "run", "launch", "primary", resultTitle],
    0,
    "Primary"
  ))

  if (hiddenManager) return actions

  if (!application) {
    actions.push(action(
      "omarchy-actions",
      "Open With Omarchy",
      text(row.breadcrumb) || resultTitle,
      "",
      "󰍉",
      ["parent", "default", "stock", "fallback", "omarchy", "menu"],
      1,
      "Navigation",
      "submenu",
      "omarchy"
    ))
  }


  actions.push(action(
    "configure-actions",
    "Configure Result",
    state.alias ? "Alias: " + text(state.alias) : "Set a search alias",
    "",
    "",
    ["configure", "alias", "keyword", "settings"],
    2,
    "Configure",
    "submenu",
    "configure"
  ))

  actions.push(action(
    "favorite",
    favorite ? "Remove from Favorites" : "Add to Favorites",
    resultTitle,
    "Ctrl+F",
    "",
    ["favorite", "favourite", "star", "pin", favorite ? "remove" : "add"],
    3,
    "Favorites"
  ))

  if (usage[resultId]) {
    actions.push(action(
      "reset-ranking",
      "Reset Learned Ranking",
      "Forget usage history for " + resultTitle,
      "",
      "",
      ["reset", "ranking", "usage", "history", "forget", "frecency"],
      4,
      "Manage"
    ))
  }

  return actions
}

if (typeof module !== "undefined") {
  module.exports = {
    actionsForResult: actionsForResult
  }
}
