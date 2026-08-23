// App-level menu records for the left side of the footer.

/** @typedef {import("../types/models").AboutMenuRecord} AboutMenuRecord */

/** @param {unknown} value @returns {string} */
function text(value) {
  return String(value || "")
}

/**
 * @param {string} id
 * @param {string} title
 * @param {string} description
 * @param {string} icon
 * @param {string} shortcut
 * @param {string} section
 * @param {string} kind
 * @param {string} target
 * @returns {AboutMenuRecord}
 */
function record(id, title, description, icon, shortcut, section, kind, target) {
  return {
    id: id,
    title: title,
    description: description,
    icon: icon,
    shortcut: shortcut,
    section: section,
    kind: kind,
    target: target
  }
}

/** @param {{repositoryUrl?: string} | null | undefined} context @returns {AboutMenuRecord[]} */
function records(context) {
  var values = context || {}
  var repositoryUrl = text(values.repositoryUrl) || "https://github.com/mirashif/omalauncher"
  return [
    record("settings", "Settings", "Customize OmaLauncher", "", "CTRL+,", "General", "route", "settings"),
    record("shortcuts", "Keyboard Shortcuts", "View every launcher shortcut", "󰌌", "", "General", "url", repositoryUrl + "#keyboard-shortcuts"),
    record("guide", "User Guide", "Read the OmaLauncher guide", "󰋖", "CTRL+SHIFT+/", "Help", "url", repositoryUrl + "#readme"),
    record("about", "About OmaLauncher", "Version, source, and project details", "󰋼", "", "Help", "route", "settings-about"),
    record("report", "Report an Issue", "Open the GitHub issue tracker", "", "", "Help", "url", repositoryUrl + "/issues"),
    record("close", "Close Launcher", "Return to the desktop", "󰅖", "CTRL+W", "Other", "close", "")
  ]
}

if (typeof module !== "undefined") {
  module.exports = { records: records }
}
