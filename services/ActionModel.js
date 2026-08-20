// Contextual Action Panel records shared by QML and Node tests.

function text(value) {
  return String(value || "")
}

function action(id, title, description, shortcut, icon, keywords, order) {
  var keywordList = Array.isArray(keywords) ? keywords : []
  return {
    id: id,
    type: "action",
    title: title,
    description: description,
    shortcut: shortcut,
    icon: icon,
    aliases: [],
    keywords: keywordList,
    searchText: [title, description, keywordList.join(" ")].join(" "),
    providerPriority: 0,
    order: order
  }
}

function actionsForResult(result, context) {
  var row = result || {}
  var resultId = text(row.resultId || row.id)
  if (!resultId) return []

  var state = context || {}
  var usage = state.usage || {}
  var favorite = !!state.favorite
  var application = text(row.resultType || row.type) === "application"
  var menu = !application && text(row.resultKind || row.kind) === "menu"
  var resultTitle = text(row.title)
  var actions = []

  actions.push(action(
    "primary",
    application ? "Open Application" : (menu ? "Open Menu" : "Run Command"),
    resultTitle,
    "Enter",
    application ? "" : (menu ? "" : "▶"),
    ["open", "run", "launch", "primary", resultTitle],
    0
  ))

  if (!application && text(row.parentRoute)) {
    actions.push(action(
      "parent",
      "Open Parent in Omarchy Menu",
      text(row.breadcrumb) || "Root menu",
      "Ctrl+Enter",
      "",
      ["parent", "omarchy", "menu", "breadcrumb"],
      1
    ))
  }

  actions.push(action(
    "favorite",
    favorite ? "Remove from Favorites" : "Add to Favorites",
    resultTitle,
    "Ctrl+F",
    "",
    ["favorite", "favourite", "star", "pin", favorite ? "remove" : "add"],
    2
  ))

  if (usage[resultId]) {
    actions.push(action(
      "reset-ranking",
      "Reset Learned Ranking",
      "Forget usage history for " + resultTitle,
      "",
      "",
      ["reset", "ranking", "usage", "history", "forget", "frecency"],
      3
    ))
  }

  return actions
}

if (typeof module !== "undefined") {
  module.exports = {
    actionsForResult: actionsForResult
  }
}
