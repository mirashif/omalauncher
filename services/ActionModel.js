// Contextual Action Panel records shared by QML and Node tests.

/** @typedef {import("../types/models").ActionInput} ActionInput */
/** @typedef {import("../types/models").ActionContext} ActionContext */
/** @typedef {import("../types/models").ActionRecord} ActionRecord */

/** @param {unknown} value @returns {string} */
function text(value) {
  return String(value || "")
}

/**
 * @param {string} id
 * @param {string} title
 * @param {string} description
 * @param {string} shortcut
 * @param {string} icon
 * @param {readonly string[]} keywords
 * @param {number} order
 * @param {string} section
 * @param {string} [kind]
 * @param {string} [target]
 * @returns {ActionRecord}
 */
function action(id, title, description, shortcut, icon, keywords, order, section, kind, target) {
  var keywordList = keywords.slice()
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

/**
 * @param {ActionInput | null | undefined} result
 * @param {ActionContext | null | undefined} context
 * @param {unknown} [route]
 * @returns {ActionRecord[]}
 */
function actionsForResult(result, context, route) {
  var row = result || {}
  var resultId = text(row.resultId || row.id)
  if (!resultId) return []

  var state = context || {}
  var usage = state.usage || {}
  var favorite = !!state.favorite
  var application = text(row.resultType || row.type) === "application"
  var stockCommand = text(row.resultType || row.type) === "omarchy-command"
  var executionKind = text(row.executionKind)
  var shellFeature = executionKind === "shell-plugin" || executionKind === "shell-ipc"
  var cliDirect = executionKind === "cli-direct"
  var cliHelp = executionKind === "cli-help"
  var cliCommand = cliDirect || cliHelp
  var resultKind = text(row.resultKind || row.kind)
  var menu = !application && (resultKind === "menu" || resultKind === "link")
  var hiddenManager = resultKind === "manage-hidden"
  var compactToggle = resultKind === "toggle-compact"
  var settingsCommand = resultKind === "open-settings" || resultKind === "open-files"
    || resultKind.indexOf("settings-") === 0
  var calculator = text(row.resultType || row.type) === "calculator"
  var file = text(row.resultType || row.type) === "file"
  var fileStatus = text(row.resultType || row.type) === "file-status"
  var resultTitle = text(row.title)
  /** @type {ActionRecord[]} */
  var actions = []
  var activeRoute = text(route || "root")

  if (file || fileStatus) {
    actions.push(action("primary", file ? "Open File" : resultTitle,
      file ? text(row.filePath || row.description) : text(row.description),
      "Enter", file ? "󰁞" : "", ["file", "open", "primary"], 0, "File"))
    if (file) {
      actions.push(action("reveal-file", "Reveal in File Manager", text(row.filePath || row.description),
        "", "󰗃", ["file", "reveal", "folder", "manager"], 1, "File"))
      actions.push(action("copy-path", "Copy Path", text(row.filePath || row.description),
        "", "", ["file", "copy", "path"], 2, "File"))
    }
    return actions
  }

  if (calculator) {
    if (resultKind !== "calculator") {
      actions.push(action("primary", resultTitle, text(row.description), "Enter", "",
        ["calculator", "status"], 0, "Calculator"))
      return actions
    }
    actions.push(action("primary", "Copy Result", text(row.calculatorResult), "Enter", "",
      ["copy", "result", "calculator"], 0, "Calculator"))
    actions.push(action("copy-expression", "Copy Expression", text(row.calculatorExpression), "", "󰆏",
      ["copy", "expression", "calculator"], 1, "Calculator"))
    return actions
  }

  if (activeRoute === "omarchy") {
    if (!stockCommand) return []
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
      : (compactToggle ? resultTitle
        : (settingsCommand ? resultTitle
          : (application ? "Open Application"
            : (shellFeature ? "Open Shell Feature"
              : (cliHelp ? "Show Command Help" : (menu ? "Open Menu" : "Run Command")))))),
    resultTitle,
    "Enter",
    hiddenManager ? "" : (compactToggle ? "" : (application ? "" : (menu ? "" : "▶"))),
    ["open", "run", "launch", "primary", resultTitle],
    0,
    "Primary"
  ))

  if (hiddenManager || compactToggle || settingsCommand) return actions

  if (cliDirect) {
    actions.push(action(
      "command-help",
      "Show Command Help",
      text(row.commandRoute) || resultTitle,
      "",
      "󰋖",
      ["command", "help", "usage", "manual", "terminal"],
      actions.length,
      "Command"
    ))
  }

  if (cliCommand) {
    actions.push(action(
      "copy-command",
      "Copy Command",
      text(row.commandRoute) || resultTitle,
      "",
      "",
      ["command", "copy", "terminal", "cli"],
      actions.length,
      "Command"
    ))
  }

  if (stockCommand) {
    actions.push(action(
      "omarchy-actions",
      "Open With Omarchy",
      text(row.breadcrumb) || resultTitle,
      "",
      "󰍉",
      ["parent", "default", "stock", "fallback", "omarchy", "menu"],
      actions.length,
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
    actions.length,
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
    actions.length,
    "Favorites"
  ))

  var favoriteIndex = Number(state.favoriteIndex === undefined ? -1 : state.favoriteIndex)
  var favoriteCount = Math.max(0, Number(state.favoriteCount || 0))
  if (favorite && favoriteIndex > 0) {
    actions.push(action(
      "favorite-up",
      "Move Favorite Up",
      resultTitle,
      "Ctrl+Shift+Up",
      "",
      ["favorite", "move", "reorder", "up"],
      4,
      "Favorites"
    ))
  }
  if (favorite && favoriteIndex >= 0 && favoriteIndex < favoriteCount - 1) {
    actions.push(action(
      "favorite-down",
      "Move Favorite Down",
      resultTitle,
      "Ctrl+Shift+Down",
      "",
      ["favorite", "move", "reorder", "down"],
      5,
      "Favorites"
    ))
  }

  if (usage[resultId]) {
    actions.push(action(
      "reset-ranking",
      "Reset Learned Ranking",
      "Forget usage history for " + resultTitle,
      "",
      "",
      ["reset", "ranking", "usage", "history", "forget", "frecency"],
      6,
      "Manage"
    ))
  }

  if (application && state.canUninstall === true) {
    actions.push(action(
      "uninstall-application",
      "Uninstall Application",
      resultTitle,
      "",
      "",
      ["uninstall", "remove", "delete", "application", resultTitle],
      actions.length,
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
