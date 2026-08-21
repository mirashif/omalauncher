/** @typedef {import("../types/models").UnknownRecord} UnknownRecord */
/** @typedef {import("../types/models").BooleanMap} BooleanMap */
/** @typedef {import("../types/models").ShellPluginBuildOptions} ShellPluginBuildOptions */
/** @typedef {import("../types/models").ShellPluginRecord} ShellPluginRecord */

/** @type {BooleanMap} */
var INTERNAL_PLUGIN_IDS = {
    "omarchy.dev-gallery": true,
    "omarchy.image-picker": true,
    "omarchy.menu": true,
    "omarchy.osd": true,
    "omarchy.polkit": true
}

/** @type {Record<string, string[]>} */
var MENU_BINARIES = {
    "omarchy.emojis": ["omarchy-menu-emoji"],
    "omarchy.reminders": ["omarchy-reminder"]
}

/** @type {Record<string, string[]>} */
var COVERED_COMMAND_ROUTES = {
    "omarchy.clipboard": ["omarchy menu clipboard"],
    "omarchy.emojis": ["omarchy menu emoji"],
    "omarchy.weather": ["omarchy notification weather"]
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizedString(value) {
    return typeof value === "string" ? value.trim() : ""
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function stringList(value) {
    if (Array.isArray(value)) {
        var result = []
        for (var i = 0; i < value.length; i++) {
            var entry = normalizedString(value[i])
            if (entry)
                result.push(entry)
        }
        return result
    }
    var single = normalizedString(value)
    return single ? [single] : []
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function titleCase(value) {
    var words = normalizedString(value).replace(/[-_.]+/g, " ").split(/\s+/)
    var result = []
    for (var i = 0; i < words.length; i++) {
        var word = words[i]
        if (!word)
            continue
        result.push(word.charAt(0).toUpperCase() + word.slice(1))
    }
    return result.join(" ")
}

/**
 * @param {readonly string[]} kinds
 * @param {string} expected
 * @returns {boolean}
 */
function containsKind(kinds, expected) {
    for (var i = 0; i < kinds.length; i++) {
        if (kinds[i] === expected)
            return true
    }
    return false
}

/**
 * @param {readonly string[]} kinds
 * @returns {string}
 */
function preferredKind(kinds) {
    if (containsKind(kinds, "panel"))
        return "panel"
    if (containsKind(kinds, "overlay"))
        return "overlay"
    if (containsKind(kinds, "menu"))
        return "menu"
    if (containsKind(kinds, "bar-widget"))
        return "bar-widget"
    return kinds.length > 0 ? (kinds[0] || "plugin") : "plugin"
}

/**
 * @param {string} kind
 * @returns {string}
 */
function defaultIcon(kind) {
    if (kind === "overlay")
        return "󰍉"
    if (kind === "menu")
        return ""
    if (kind === "panel")
        return "󰕮"
    return "󰀻"
}

/**
 * @param {unknown} value
 * @returns {value is UnknownRecord}
 */
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
}

/**
 * @param {unknown} manifests
 * @param {ShellPluginBuildOptions | null | undefined} options
 * @returns {ShellPluginRecord[]}
 */
function buildRecords(manifests, options) {
    /** @type {UnknownRecord} */
    var source = isRecord(manifests) ? manifests : {}
    var settings = options || {}
    var enabledIds = settings.enabledIds || {}
    var panelIds = settings.panelIds || {}
    var launcherId = normalizedString(settings.launcherId)
    var ids = Object.keys(source).sort()
    /** @type {ShellPluginRecord[]} */
    var records = []

    for (var i = 0; i < ids.length; i++) {
        var id = ids[i]
        if (!id) continue
        var manifest = source[id]
        if (!isRecord(manifest) || id === launcherId || INTERNAL_PLUGIN_IDS[id])
            continue
        if (enabledIds[id] !== true)
            continue

        var rawMetadata = manifest["omalauncher"]
        if (rawMetadata === false)
            continue
        var metadata = isRecord(rawMetadata) ? rawMetadata : {}

        var kinds = stringList(manifest["kinds"])
        var notificationHistory = id === "omarchy.notifications"
        var hasSummonKind = containsKind(kinds, "panel") || containsKind(kinds, "overlay") || containsKind(kinds, "menu")
        var isPanelBarWidget = containsKind(kinds, "bar-widget") && panelIds[id] === true
        if (!hasSummonKind && !isPanelBarWidget && !notificationHistory && metadata["summon"] !== true)
            continue

        var barWidgetValue = manifest["barWidget"]
        var barWidget = isRecord(barWidgetValue) ? barWidgetValue : {}
        var kind = preferredKind(kinds)
        var title = normalizedString(metadata["title"])
          || (notificationHistory ? "Notification History" : "")
          || normalizedString(barWidget["displayName"])
          || normalizedString(manifest["name"])
          || titleCase(id.replace(/^omarchy\./, ""))
        var description = normalizedString(metadata["description"])
          || (notificationHistory ? "Replay recent Omarchy notifications." : "")
          || normalizedString(barWidget["description"])
          || normalizedString(manifest["description"])
          || "Open the " + title + " shell feature."
        var category = normalizedString(metadata["category"]) || normalizedString(barWidget["category"]) || titleCase(kind)
        var aliases = stringList(metadata["aliases"]).concat(stringList(barWidget["aliases"]))
        if (notificationHistory)
            aliases = aliases.concat(["Notifications", "Notification Center", "History"])
        var keywords = stringList(metadata["keywords"]).concat(aliases).concat(kinds)
        keywords.push(id)
        keywords.push("shell")
        keywords.push("panel")

        records.push({
            id: "shell-plugin:" + id,
            type: "shell-plugin",
            kind: "shell-feature",
            title: title,
            breadcrumb: "Shell Features › " + category,
            description: description,
            icon: normalizedString(metadata["icon"]) || defaultIcon(kind),
            iconFont: "",
            appIcon: "",
            appId: "",
            route: "",
            parentRoute: "",
            targetRoute: "",
            provider: "shell-registry",
            settingKey: "",
            settingValue: "",
            isChecked: false,
            aliases: aliases,
            keywords: keywords,
            executionKind: notificationHistory ? "shell-ipc" : "shell-plugin",
            sourcePluginId: id,
            shellPayloadJson: JSON.stringify(isRecord(metadata["payload"]) ? metadata["payload"] : {}),
            commandArgvJson: notificationHistory
              ? JSON.stringify(["omarchy-shell", "notifications", "showHistory"]) : "",
            commandRoute: notificationHistory ? "omarchy-shell notifications showHistory" : "",
            entryKind: kind,
            menuBinaries: MENU_BINARIES[id] || [],
            coveredCommandRoutes: COVERED_COMMAND_ROUTES[id] || [],
            emptyVisible: metadata["emptyVisible"] !== false,
            section: "Shell Features",
            providerPriority: 1,
            order: i
        })
    }

    return records
}

if (typeof module !== "undefined") {
    module.exports = {
        buildRecords: buildRecords,
        stringList: stringList,
        preferredKind: preferredKind
    }
}
