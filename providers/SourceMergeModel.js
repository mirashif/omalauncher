/** @typedef {import("../types/models").BooleanMap} BooleanMap */
/** @typedef {import("../types/models").SearchableRecord} SearchableRecord */
/** @typedef {import("../types/models").SourceMergeOptions} SourceMergeOptions */
/** @typedef {import("../types/models").MenuCoverage} MenuCoverage */
/** @typedef {import("../types/models").MenuActionInput} MenuActionInput */

/**
 * @param {BooleanMap} target
 * @param {unknown} value
 * @returns {void}
 */
function addPluginSummons(target, value) {
    var text = typeof value === "string" ? value : ""
    var expression = /omarchy-shell\s+shell\s+summon\s+([a-z0-9][a-z0-9.-]*)/g
    var match
    while ((match = expression.exec(text)) !== null) {
        var pluginId = match[1]
        if (pluginId) target[pluginId] = true
    }
}

/**
 * @param {BooleanMap} target
 * @param {unknown} value
 * @returns {void}
 */
function addExactBinaries(target, value) {
    var text = typeof value === "string" ? value : ""
    var expression = /omarchy-[a-z0-9][a-z0-9-]*/g
    var match
    while ((match = expression.exec(text)) !== null) {
        var remainder = text.slice(expression.lastIndex).replace(/^\s+/, "")
        if (!remainder || /^(?:&&|\|\||;|\|)/.test(remainder))
            target[match[0]] = true
    }
}

/**
 * @param {readonly MenuActionInput[] | null | undefined} items
 * @returns {MenuCoverage}
 */
function menuCoverage(items) {
    /** @type {BooleanMap} */
    var binaries = {}
    /** @type {BooleanMap} */
    var pluginIds = {}
    var source = items || []

    for (var i = 0; i < source.length; i++) {
        var menuItem = source[i]
        var action = menuItem && (menuItem.action || menuItem.sourceAction)
        addExactBinaries(binaries, action)
        addPluginSummons(pluginIds, action)
    }

    return { binaries: binaries, pluginIds: pluginIds }
}

/**
 * @param {readonly string[] | null | undefined} values
 * @param {BooleanMap} covered
 * @returns {boolean}
 */
function anyCovered(values, covered) {
    var source = values || []
    for (var i = 0; i < source.length; i++) {
        var value = source[i]
        if (value && covered[value])
            return true
    }
    return false
}

/**
 * @param {SourceMergeOptions | null | undefined} options
 * @returns {SearchableRecord[]}
 */
function mergeSources(options) {
    var settings = options || {}
    var applications = settings.applications || []
    var menuRecords = settings.menuRecords || []
    var pluginRecords = settings.pluginRecords || []
    var cliRecords = settings.cliRecords || []
    var coverage = menuCoverage(settings.menuItems)
    /** @type {BooleanMap} */
    var commandRoutes = {}
    /** @type {SearchableRecord[]} */
    var visiblePlugins = []
    /** @type {SearchableRecord[]} */
    var visibleCli = []

    for (var i = 0; i < pluginRecords.length; i++) {
        var plugin = pluginRecords[i]
        if (!plugin) continue
        if (coverage.pluginIds[plugin.sourcePluginId] || anyCovered(plugin.menuBinaries, coverage.binaries))
            continue
        visiblePlugins.push(plugin)
        var coveredRoutes = Array.isArray(plugin.coveredCommandRoutes) ? plugin.coveredCommandRoutes : []
        for (var routeIndex = 0; routeIndex < coveredRoutes.length; routeIndex++) {
            var coveredRoute = coveredRoutes[routeIndex]
            if (coveredRoute) commandRoutes[coveredRoute] = true
        }
    }

    for (var j = 0; j < cliRecords.length; j++) {
        var command = cliRecords[j]
        if (!command) continue
        if (coverage.binaries[command.commandBinary] || commandRoutes[command.commandRoute])
            continue
        visibleCli.push(command)
    }

    return applications.concat(menuRecords, visiblePlugins, visibleCli)
}

if (typeof module !== "undefined") {
    module.exports = {
        menuCoverage: menuCoverage,
        mergeSources: mergeSources
    }
}
