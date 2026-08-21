/** @typedef {import("../types/models").UnknownRecord} UnknownRecord */
/** @typedef {import("../types/models").BooleanMap} BooleanMap */
/** @typedef {import("../types/models").StringMap} StringMap */
/** @typedef {import("../types/models").CatalogCommand} CatalogCommand */
/** @typedef {import("../types/models").CatalogCommandInput} CatalogCommandInput */
/** @typedef {import("../types/models").CatalogParseResult} CatalogParseResult */
/** @typedef {import("../types/models").CliRecord} CliRecord */

/** @type {BooleanMap} */
var DIRECT_ROUTES = {
    "omarchy agent": true,
    "omarchy audio input mute": true,
    "omarchy audio output switch": true,
    "omarchy audio source switch": true,
    "omarchy hyprland window pop": true,
    "omarchy hyprland window tiled fullscreen toggle": true,
    "omarchy hyprland window transparency toggle": true,
    "omarchy menu clipboard": true,
    "omarchy notification battery": true,
    "omarchy notification time": true,
    "omarchy notification weather": true
}

/** @type {StringMap} */
var TITLE_OVERRIDES = {
    "omarchy agent": "Open Agent",
    "omarchy audio input mute": "Mute Microphone",
    "omarchy audio output switch": "Switch Audio Output",
    "omarchy audio source switch": "Switch Media Source",
    "omarchy hyprland window pop": "Pop Window Out",
    "omarchy hyprland window tiled fullscreen toggle": "Toggle Tiled Fullscreen",
    "omarchy hyprland window transparency toggle": "Toggle Window Transparency",
    "omarchy menu clipboard": "Clipboard Manager",
    "omarchy notification battery": "Battery Remaining",
    "omarchy notification time": "Current Time",
    "omarchy notification weather": "Weather"
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
 * @returns {string}
 */
function titleCase(value) {
    /** @type {string[]} */
    var words = normalizedString(value).replace(/[-_]+/g, " ").split(/\s+/)
    /** @type {string[]} */
    var result = []
    for (var i = 0; i < words.length; i++) {
        var word = words[i]
        if (!word)
            continue
        var lower = word.toLowerCase()
        if (lower === "cli" || lower === "dns" || lower === "gpu" || lower === "qr" || lower === "ssh" || lower === "url")
            result.push(lower.toUpperCase())
        else
            result.push(lower.charAt(0).toUpperCase() + lower.slice(1))
    }
    return result.join(" ")
}

/**
 * @param {unknown} args
 * @returns {boolean}
 */
function requiredArguments(args) {
    var withoutOptional = normalizedString(args).replace(/\[[^\]]*\]/g, "")
    return /<[^>]+>/.test(withoutOptional)
}

/**
 * @param {unknown} route
 * @returns {string[]}
 */
function commandArgv(route) {
    var parts = normalizedString(route).split(/\s+/)
    if (parts.length === 0 || parts[0] !== "omarchy")
        return []
    return parts
}

/**
 * @param {unknown} value
 * @returns {value is UnknownRecord}
 */
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
}

/**
 * @param {unknown} value
 * @returns {value is unknown[]}
 */
function isUnknownArray(value) {
    return Array.isArray(value)
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizedStrings(value) {
    if (!Array.isArray(value)) return []
    var strings = []
    for (var i = 0; i < value.length; i++) {
        var entry = normalizedString(value[i])
        if (entry) strings.push(entry)
    }
    return strings
}

/**
 * @param {unknown} raw
 * @returns {CatalogParseResult}
 */
function parseCatalog(raw) {
    /** @type {unknown} */
    var parsed
    try {
        parsed = JSON.parse(String(raw || ""))
    } catch (error) {
        return { commands: [], error: "The Omarchy CLI catalog returned invalid JSON." }
    }

    if (!isRecord(parsed) || parsed["ok"] !== true || !isUnknownArray(parsed["commands"]))
        return { commands: [], error: "The Omarchy CLI catalog has an unsupported shape." }

    var parsedCommands = parsed["commands"]
    /** @type {CatalogCommand[]} */
    var commands = []
    for (var i = 0; i < parsedCommands.length; i++) {
        var command = parsedCommands[i]
        if (!isRecord(command))
            continue
        var route = normalizedString(command["route"])
        var binary = normalizedString(command["binary"])
        if (!route || !binary || commandArgv(route).length === 0)
            continue
        commands.push({
            route: route,
            binary: binary,
            group: normalizedString(command["group"]),
            name: normalizedString(command["name"]),
            summary: normalizedString(command["summary"]),
            requires_sudo: command["requires_sudo"] === true,
            hidden: command["hidden"] === true,
            args: normalizedString(command["args"]),
            examples: normalizedStrings(command["examples"]),
            aliases: normalizedStrings(command["aliases"])
        })
    }

    if (parsedCommands.length > 0 && commands.length === 0)
        return { commands: [], error: "The Omarchy CLI catalog did not contain any usable commands." }

    return { commands: commands, error: "" }
}

/**
 * @param {CatalogCommandInput} command
 * @returns {string[]}
 */
function commandAliases(command) {
    /** @type {string[]} */
    var aliases = []
    /** @type {BooleanMap} */
    var seen = {}
    var rawAliases = command.aliases || []
    for (var i = 0; i < rawAliases.length; i++) {
        var alias = normalizedString(rawAliases[i])
        if (!alias)
            continue
        var shortAlias = alias.indexOf("omarchy ") === 0 ? alias.slice(8) : alias
        var key = shortAlias.toLowerCase()
        if (!seen[key]) {
            seen[key] = true
            aliases.push(shortAlias)
        }
    }
    return aliases
}

/**
 * @param {readonly CatalogCommandInput[] | null | undefined} commands
 * @returns {CliRecord[]}
 */
function buildRecords(commands) {
    /** @type {CliRecord[]} */
    var records = []
    var input = commands || []

    for (var i = 0; i < input.length; i++) {
        var command = input[i]
        if (!command || command.hidden === true)
            continue

        var route = normalizedString(command.route)
        var binary = normalizedString(command.binary)
        var argv = commandArgv(route)
        if (!route || !binary || argv.length === 0)
            continue

        var group = normalizedString(command.group)
        var name = normalizedString(command.name) || group || route.slice(8)
        var args = normalizedString(command.args)
        var requiresSudo = command.requires_sudo === true
        var canRunDirectly = DIRECT_ROUTES[route] === true && !requiresSudo && !requiredArguments(args)
        var examples = command.examples ? command.examples.join(" ") : ""
        var aliases = commandAliases(command)
        var keywords = [route, binary, args, examples, group, "cli", "terminal"]
        for (var aliasIndex = 0; aliasIndex < aliases.length; aliasIndex++) {
            var alias = aliases[aliasIndex]
            if (alias) keywords.push(alias)
        }

        records.push({
            id: "omarchy-cli:" + binary,
            type: "omarchy-cli",
            kind: canRunDirectly ? "cli-command" : "cli-help",
            title: TITLE_OVERRIDES[route] || titleCase(name),
            breadcrumb: group ? "Omarchy CLI › " + titleCase(group) : "Omarchy CLI",
            description: normalizedString(command.summary) || "Omarchy command: " + route,
            icon: "",
            iconFont: "",
            appIcon: "",
            appId: "",
            route: route,
            parentRoute: "",
            targetRoute: "",
            provider: "cli-catalog",
            settingKey: "",
            settingValue: "",
            isChecked: false,
            aliases: aliases,
            keywords: keywords,
            executionKind: canRunDirectly ? "cli-direct" : "cli-help",
            commandArgvJson: JSON.stringify(argv),
            commandBinary: binary,
            commandRoute: route,
            requiresSudo: requiresSudo,
            emptyVisible: false,
            section: "Omarchy CLI",
            providerPriority: 3,
            order: i
        })

        if (route === "omarchy agent" && !requiresSudo) {
            records.push({
                id: "omarchy-cli:" + binary + ":picker",
                type: "omarchy-cli",
                kind: "cli-command",
                title: "Choose Coding Agent",
                breadcrumb: "Omarchy CLI › Agent",
                description: "Pick a coding agent and launch it in a terminal.",
                icon: "󰚩",
                iconFont: "",
                appIcon: "",
                appId: "",
                route: "omarchy agent --pick",
                parentRoute: "",
                targetRoute: "",
                provider: "cli-catalog",
                settingKey: "",
                settingValue: "",
                isChecked: false,
                aliases: ["Agent Picker", "Pick Agent"],
                keywords: ["omarchy agent --pick", "coding agent", "choose", "picker", "terminal", "cli"],
                executionKind: "cli-direct",
                commandArgvJson: JSON.stringify(["omarchy", "agent", "--pick"]),
                commandBinary: binary + ":picker",
                commandRoute: "omarchy agent --pick",
                requiresSudo: false,
                emptyVisible: true,
                section: "Shell Features",
                providerPriority: 1,
                order: i
            })
        }
    }

    return records
}

if (typeof module !== "undefined") {
    module.exports = {
        parseCatalog: parseCatalog,
        buildRecords: buildRecords,
        requiredArguments: requiredArguments,
        commandArgv: commandArgv
    }
}
