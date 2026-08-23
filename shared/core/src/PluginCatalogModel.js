// @ts-check

// Pure plugin discovery, presentation, and lifecycle intent derivation.

/** @typedef {import("../types/models").UnknownRecord} UnknownRecord */
/** @typedef {import("../types/models").InstalledPluginInput} InstalledPluginInput */
/** @typedef {import("../types/models").PluginCatalogBuildOptions} PluginCatalogBuildOptions */
/** @typedef {import("../types/models").PluginCatalogPlugin} PluginCatalogPlugin */
/** @typedef {import("../types/models").PluginCatalogCounts} PluginCatalogCounts */
/** @typedef {import("../types/models").PluginCatalog} PluginCatalog */
/** @typedef {import("../types/models").PluginCatalogRouteOptions} PluginCatalogRouteOptions */
/** @typedef {import("../types/models").PluginCatalogRecord} PluginCatalogRecord */
/** @typedef {import("../types/models").PluginLifecycleIntent} PluginLifecycleIntent */

var SUPPORTED_SCHEMA_VERSION = 2
var DEFAULT_MARKETPLACE_BASE_URL = "https://omarchyplugins.com"
var DETAIL_ROUTE_PREFIX = "plugins-detail:"

/** @param {unknown} value @returns {value is UnknownRecord} */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** @param {unknown} value @returns {string} */
function text(value) {
  return typeof value === "string" ? value.trim() : ""
}

/** @param {unknown} value @returns {number} */
function nonNegativeNumber(value) {
  var number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

/** @param {unknown} value @returns {string[]} */
function stringList(value) {
  if (!Array.isArray(value)) return []
  /** @type {string[]} */
  var output = []
  for (var i = 0; i < value.length; i++) {
    var item = text(value[i])
    if (item && output.indexOf(item) < 0) output.push(item)
  }
  return output
}

/** @param {unknown} value @returns {boolean} */
function validPluginId(value) {
  var id = text(value)
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) && id.indexOf("..") < 0
}

/** @param {unknown} value @returns {string} */
function safeHttpsUrl(value) {
  var url = text(value)
  if (!/^https:\/\/[A-Za-z0-9.-]+(?::[0-9]+)?(?:\/[^\s\0]*)?$/.test(url)) return ""
  return url
}

/** @param {unknown} value @returns {string} */
function githubCloneUrl(value) {
  var url = safeHttpsUrl(value).replace(/\/+$/, "")
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(url)) return ""
  return url.slice(-4) === ".git" ? url : url + ".git"
}

/** @param {unknown} value @returns {string} */
function marketplaceBaseUrl(value) {
  var url = safeHttpsUrl(value).replace(/\/+$/, "")
  return url || DEFAULT_MARKETPLACE_BASE_URL
}

/** @param {string} baseUrl @param {string} id @returns {string} */
function marketplacePluginUrl(baseUrl, id) {
  return validPluginId(id) ? baseUrl + "/plugin.html?id=" + encodeURIComponent(id) : ""
}

/** @param {string} baseUrl @param {unknown} value @returns {string} */
function marketplaceAssetUrl(baseUrl, value) {
  var path = text(value).replace(/^\/+/, "")
  if (!path || path.indexOf("..") >= 0 || /[\s\0]/.test(path)) return ""
  return baseUrl + "/" + path
}

/** @param {unknown} value @returns {"verified" | "unverified" | "not-listed"} */
function verificationStatus(value) {
  return text(value) === "verified" ? "verified" : "unverified"
}

/** @param {"verified" | "unverified" | "not-listed"} status @returns {string} */
function verificationLabel(status) {
  if (status === "verified") return "Registry verified"
  if (status === "unverified") return "Unverified — review source"
  return "Not listed"
}

/**
 * @param {UnknownRecord} raw
 * @param {string} baseUrl
 * @param {number} order
 * @returns {PluginCatalogPlugin | null}
 */
function normalizeRemotePlugin(raw, baseUrl, order) {
  var id = text(raw["id"])
  if (!validPluginId(id)) return null
  var rawSourceType = text(raw["sourceType"])
  /** @type {"builtin" | "community"} */
  var sourceType = rawSourceType === "builtin" ? "builtin" : "community"
  var repositoryUrl = safeHttpsUrl(raw["repo"])
  var cloneUrl = sourceType === "community" ? githubCloneUrl(repositoryUrl) : ""
  var status = sourceType === "builtin" ? "not-listed" : verificationStatus(raw["verificationStatus"])
  var name = text(raw["name"]) || id
  var kinds = stringList(raw["kinds"])
  var kind = text(raw["kind"])
  if (kinds.length === 0 && kind) kinds.push(kind)
  return {
    id: id,
    name: name,
    description: text(raw["description"]) || "Omarchy plugin",
    author: text(raw["author"]),
    version: text(raw["version"]),
    kinds: kinds,
    category: text(raw["category"]) || "Other",
    tags: stringList(raw["tags"]),
    license: text(raw["license"]),
    sourceType: sourceType,
    repositoryUrl: repositoryUrl,
    cloneUrl: cloneUrl,
    marketplaceUrl: marketplacePluginUrl(baseUrl, id),
    previewUrl: marketplaceAssetUrl(baseUrl, raw["previewImage"]),
    verificationStatus: status,
    verificationLabel: verificationLabel(status),
    verificationCommit: text(raw["verificationCommit"])
      || text(raw["listingValidatedCommit"]),
    listedAt: text(raw["listedAt"]) || text(raw["addedAt"]),
    updatedAt: text(raw["repositoryUpdatedAt"]) || text(raw["versionUpdatedAt"]),
    stars: Math.floor(nonNegativeNumber(raw["stars"])),
    installed: false,
    enabled: false,
    canDisable: true,
    firstParty: sourceType === "builtin",
    clonedFrom: "",
    sourceDir: "",
    installAvailable: sourceType === "community"
      && raw["installAvailable"] === true && cloneUrl.length > 0,
    installNote: text(raw["installNote"]),
    order: order
  }
}

/**
 * @param {InstalledPluginInput} raw
 * @param {number} order
 * @returns {PluginCatalogPlugin | null}
 */
function normalizeInstalledPlugin(raw, order) {
  var id = text(raw.id)
  if (!validPluginId(id)) return null
  var firstParty = raw.firstParty === true
  var status = /** @type {"not-listed"} */ ("not-listed")
  return {
    id: id,
    name: text(raw.name) || id,
    description: text(raw.description) || "Installed Omarchy plugin",
    author: firstParty ? "Omarchy" : "",
    version: text(raw.version),
    kinds: stringList(raw.kinds),
    category: firstParty ? "Built in" : "Local",
    tags: [],
    license: "",
    sourceType: firstParty ? "builtin" : "local",
    repositoryUrl: "",
    cloneUrl: "",
    marketplaceUrl: "",
    previewUrl: "",
    verificationStatus: status,
    verificationLabel: verificationLabel(status),
    verificationCommit: "",
    listedAt: "",
    updatedAt: "",
    stars: 0,
    installed: true,
    enabled: raw.enabled === true,
    canDisable: raw.canDisable !== false,
    firstParty: firstParty,
    clonedFrom: text(raw.clonedFrom),
    sourceDir: text(raw.sourceDir),
    installAvailable: false,
    installNote: "",
    order: order
  }
}

/** @param {PluginCatalogPlugin} remote @param {PluginCatalogPlugin} installed @returns {PluginCatalogPlugin} */
function mergeInstalledState(remote, installed) {
  return Object.assign({}, remote, {
    name: installed.name || remote.name,
    description: remote.description || installed.description,
    version: installed.version || remote.version,
    kinds: installed.kinds.length > 0 ? installed.kinds : remote.kinds,
    installed: true,
    enabled: installed.enabled,
    canDisable: installed.canDisable,
    firstParty: installed.firstParty || remote.sourceType === "builtin",
    clonedFrom: installed.clonedFrom,
    sourceDir: installed.sourceDir,
    installAvailable: false
  })
}

/** @returns {PluginCatalogCounts} */
function emptyCounts() {
  return { total: 0, installed: 0, enabled: 0, available: 0, builtin: 0, verified: 0 }
}

/** @param {readonly PluginCatalogPlugin[]} plugins @returns {PluginCatalogCounts} */
function countPlugins(plugins) {
  var counts = emptyCounts()
  counts.total = plugins.length
  for (var i = 0; i < plugins.length; i++) {
    var plugin = plugins[i]
    if (!plugin) continue
    if (plugin.installed) counts.installed += 1
    if (plugin.enabled) counts.enabled += 1
    if (!plugin.installed && plugin.installAvailable) counts.available += 1
    if (plugin.sourceType === "builtin") counts.builtin += 1
    if (plugin.verificationStatus === "verified") counts.verified += 1
  }
  return counts
}

/**
 * @param {unknown} payload
 * @param {readonly InstalledPluginInput[] | null | undefined} installedPlugins
 * @param {PluginCatalogBuildOptions | null} [options]
 * @returns {PluginCatalog}
 */
function buildCatalog(payload, installedPlugins, options) {
  var opts = options || {}
  var baseUrl = marketplaceBaseUrl(opts.marketplaceBaseUrl)
  /** @type {PluginCatalogPlugin[]} */
  var remote = []
  /** @type {string[]} */
  var warnings = []
  var schemaVersion = 0
  var generatedAt = ""
  var remoteError = ""

  if (payload !== null && payload !== undefined) {
    if (!isRecord(payload)) {
      remoteError = "Plugin catalog response is invalid"
    } else {
      schemaVersion = Math.floor(nonNegativeNumber(payload["stateSchemaVersion"]))
      generatedAt = text(payload["generatedAt"])
      warnings = stringList(payload["warnings"])
      if (schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
        remoteError = "Plugin catalog schema is unsupported"
      } else if (!Array.isArray(payload["plugins"])) {
        remoteError = "Plugin catalog does not contain plugin records"
      } else {
        var rawPlugins = /** @type {unknown[]} */ (payload["plugins"])
        /** @type {Record<string, boolean>} */
        var seenRemote = {}
        for (var remoteIndex = 0; remoteIndex < rawPlugins.length; remoteIndex++) {
          var rawRemote = rawPlugins[remoteIndex]
          if (!isRecord(rawRemote)) continue
          var normalizedRemote = normalizeRemotePlugin(rawRemote, baseUrl, remoteIndex)
          if (!normalizedRemote || seenRemote[normalizedRemote.id]) continue
          seenRemote[normalizedRemote.id] = true
          remote.push(normalizedRemote)
        }
      }
    }
  }

  /** @type {Record<string, PluginCatalogPlugin>} */
  var installedById = {}
  var installedSource = installedPlugins || []
  for (var installedIndex = 0; installedIndex < installedSource.length; installedIndex++) {
    var installed = normalizeInstalledPlugin(installedSource[installedIndex] || {}, installedIndex)
    if (installed && !installedById[installed.id]) installedById[installed.id] = installed
  }

  /** @type {PluginCatalogPlugin[]} */
  var merged = []
  /** @type {Record<string, boolean>} */
  var mergedIds = {}
  for (var remoteMergeIndex = 0; remoteMergeIndex < remote.length; remoteMergeIndex++) {
    var remotePlugin = remote[remoteMergeIndex]
    if (!remotePlugin) continue
    var installedMatch = installedById[remotePlugin.id]
    merged.push(installedMatch ? mergeInstalledState(remotePlugin, installedMatch) : remotePlugin)
    mergedIds[remotePlugin.id] = true
  }
  var installedIds = Object.keys(installedById).sort()
  for (var localIndex = 0; localIndex < installedIds.length; localIndex++) {
    var installedId = installedIds[localIndex]
    if (!installedId || mergedIds[installedId]) continue
    var localPlugin = installedById[installedId]
    if (localPlugin) merged.push(localPlugin)
  }

  merged.sort(function(left, right) {
    var byName = left.name.toLocaleLowerCase().localeCompare(right.name.toLocaleLowerCase())
    return byName !== 0 ? byName : left.id.localeCompare(right.id)
  })
  for (var order = 0; order < merged.length; order++) {
    var ordered = merged[order]
    if (ordered) ordered.order = order
  }
  return {
    schemaVersion: schemaVersion,
    generatedAt: generatedAt,
    warnings: warnings,
    remoteError: remoteError,
    marketplaceBaseUrl: baseUrl,
    plugins: merged,
    counts: countPlugins(merged)
  }
}

/** @param {unknown} value @returns {string} */
function detailRoute(value) {
  var id = text(value)
  return validPluginId(id) ? DETAIL_ROUTE_PREFIX + encodeURIComponent(id) : ""
}

/** @param {unknown} value @returns {string} */
function pluginIdForRoute(value) {
  var route = text(value)
  if (route.indexOf(DETAIL_ROUTE_PREFIX) !== 0) return ""
  var encoded = route.slice(DETAIL_ROUTE_PREFIX.length)
  var id = ""
  try { id = decodeURIComponent(encoded) } catch (error) { return "" }
  return validPluginId(id) ? id : ""
}

/** @param {unknown} value @returns {boolean} */
function isRoute(value) {
  var route = text(value)
  return route === "plugins" || route === "plugins-installed"
    || route === "plugins-available" || route === "plugins-built-in"
    || pluginIdForRoute(route).length > 0
}

/** @param {PluginCatalog} catalog @param {string} id @returns {PluginCatalogPlugin | null} */
function findPlugin(catalog, id) {
  for (var i = 0; i < catalog.plugins.length; i++) {
    var plugin = catalog.plugins[i]
    if (plugin && plugin.id === id) return plugin
  }
  return null
}

/** @param {number} count @param {string} singular @returns {string} */
function countLabel(count, singular) {
  return count + " " + singular + (count === 1 ? "" : "s")
}

/** @param {PluginCatalogPlugin} plugin @returns {string} */
function pluginStateLabel(plugin) {
  if (plugin.enabled) return "Enabled"
  if (plugin.installed) return "Installed"
  if (plugin.sourceType === "builtin") return "Built in"
  return plugin.verificationStatus === "verified" ? "Registry verified" : "Review source"
}

/** @param {PluginCatalogPlugin} plugin @returns {string} */
function pluginBreadcrumb(plugin) {
  var source = plugin.firstParty || plugin.sourceType === "builtin" ? "Built-in Plugins" : "Community Plugins"
  return source + " › " + plugin.category
}

/**
 * @param {string} id
 * @param {string} kind
 * @param {string} title
 * @param {string} description
 * @param {string} icon
 * @param {number} order
 * @param {string} section
 * @param {string} controlType
 * @returns {PluginCatalogRecord}
 */
function record(id, kind, title, description, icon, order, section, controlType) {
  return {
    id: id,
    type: "plugin-catalog",
    kind: kind,
    title: title,
    breadcrumb: "",
    description: description,
    icon: icon,
    iconFont: "",
    appIcon: "",
    appId: "",
    aliases: [],
    keywords: ["plugin", "plugins", "omarchy", title, description],
    route: "",
    parentRoute: "plugins",
    targetRoute: "",
    provider: "omarchyplugins.com",
    searchText: [title, description, "plugin plugins omarchy"].join(" "),
    providerPriority: -1,
    order: order,
    section: section,
    settingKey: "",
    settingValue: "",
    previewImageUrl: "",
    controlType: controlType,
    checked: false,
    trailingText: "",
    destructive: false
  }
}

/** @param {PluginCatalogPlugin} plugin @param {number} order @param {string} section @returns {PluginCatalogRecord} */
function pluginRecord(plugin, order, section) {
  var result = record("plugin-catalog:entry:" + plugin.id, "plugin-open-details",
    plugin.name, plugin.description, plugin.firstParty ? "󰏖" : "󰀻",
    order, section, "navigation")
  result.breadcrumb = pluginBreadcrumb(plugin)
  result.aliases = plugin.author ? [plugin.author] : []
  result.keywords = plugin.tags.concat(plugin.kinds, [plugin.id, plugin.author, plugin.category,
    plugin.verificationLabel, pluginStateLabel(plugin)])
  result.searchText = [plugin.name, plugin.description, plugin.id, plugin.author,
    plugin.category, plugin.tags.join(" "), plugin.kinds.join(" "),
    plugin.verificationLabel, pluginStateLabel(plugin)].join(" ")
  result.route = detailRoute(plugin.id)
  result.targetRoute = result.route
  result.settingValue = plugin.id
  result.trailingText = pluginStateLabel(plugin)
  return result
}

/**
 * @param {string} id
 * @param {string} action
 * @param {string} title
 * @param {string} description
 * @param {string} icon
 * @param {number} order
 * @param {string} section
 * @param {string} trailingText
 * @param {boolean} destructive
 * @returns {PluginCatalogRecord}
 */
function actionRecord(id, action, title, description, icon, order, section, trailingText, destructive) {
  var result = record("plugin-catalog:action:" + action + ":" + id,
    "plugin-action", title, description, icon, order, section, "action")
  result.settingKey = action
  result.settingValue = id
  result.trailingText = trailingText
  result.destructive = destructive
  return result
}

/** @param {PluginCatalog} catalog @param {PluginCatalogRouteOptions} options @returns {PluginCatalogRecord[]} */
function rootRecords(catalog, options) {
  var counts = catalog.counts
  var hero = record("plugin-catalog:hero", "plugin-status", "Omarchy Plugins",
    "Discover community plugins and manage what is installed.", "󰀻", 0, "", "hero")
  hero.trailingText = countLabel(counts.installed, "installed") + " · "
    + countLabel(counts.available, "available")
  var installed = record("plugin-catalog:navigate:installed", "plugin-open-route", "Installed",
    "Enable, disable, update, or remove plugins already on this system.", "󰏖", 10,
    "Library", "navigation")
  installed.targetRoute = "plugins-installed"
  installed.trailingText = String(counts.installed)
  var available = record("plugin-catalog:navigate:available", "plugin-open-route", "Discover",
    "Browse installable community plugins from omarchyplugins.com.", "󰚰", 11,
    "Library", "navigation")
  available.targetRoute = "plugins-available"
  available.trailingText = String(counts.available)
  var builtIn = record("plugin-catalog:navigate:built-in", "plugin-open-route", "Built in",
    "Review the plugins included with Omarchy.", "󰏖", 12, "Library", "navigation")
  builtIn.targetRoute = "plugins-built-in"
  builtIn.trailingText = String(counts.builtin)
  var refresh = actionRecord("catalog", "refresh", "Refresh Catalog",
    "Reload discovery metadata and installed plugin state.", "󰑐", 20, "Catalog", "", false)
  var website = actionRecord("catalog", "open-marketplace", "Open Plugin Marketplace",
    "Visit the independent community registry in your browser.", "󰖟", 21, "Catalog", "↗", false)
  /** @type {PluginCatalogRecord[]} */
  var output = [hero, installed, available, builtIn, refresh, website]
  if (options.loading === true) {
    var loading = record("plugin-catalog:loading", "plugin-status", "Refreshing Catalog…",
      "Installed plugin controls remain available while discovery metadata loads.", "󰑐", 1,
      "Catalog", "status")
    loading.trailingText = "Working"
    output.splice(1, 0, loading)
  } else if (catalog.remoteError) {
    var failure = actionRecord("catalog", "refresh", "Catalog unavailable",
      catalog.remoteError + ". Installed plugins are still available.", "", 1,
      "Catalog", "Retry", true)
    output.splice(1, 0, failure)
  }
  var recent = catalog.plugins.filter(function(plugin) {
    return !plugin.installed && plugin.installAvailable
  }).sort(function(left, right) {
    var byDate = right.listedAt.localeCompare(left.listedAt)
    return byDate !== 0 ? byDate : left.name.localeCompare(right.name)
  }).slice(0, 6)
  for (var i = 0; i < recent.length; i++) {
    var recentPlugin = recent[i]
    if (recentPlugin) output.push(pluginRecord(recentPlugin, 30 + i, "Recently Added"))
  }
  return output
}

/** @param {PluginCatalog} catalog @param {string} route @param {PluginCatalogRouteOptions} options @returns {PluginCatalogRecord[]} */
function listRecords(catalog, route, options) {
  var query = text(options.query)
  var limit = Math.max(1, Math.floor(nonNegativeNumber(options.limit) || 120))
  var plugins = catalog.plugins.filter(function(plugin) {
    if (route === "plugins-installed") return plugin.installed
    if (route === "plugins-built-in") return plugin.sourceType === "builtin"
    return !plugin.installed && plugin.installAvailable && plugin.sourceType === "community"
  })
  plugins.sort(function(left, right) {
    if (route === "plugins-installed" && left.enabled !== right.enabled) return left.enabled ? -1 : 1
    if (route === "plugins-available" && left.verificationStatus !== right.verificationStatus) {
      return left.verificationStatus === "verified" ? -1 : 1
    }
    if (route === "plugins-available") {
      var byDate = right.listedAt.localeCompare(left.listedAt)
      if (byDate !== 0) return byDate
    }
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
  })
  var visible = query ? plugins : plugins.slice(0, limit)
  /** @type {PluginCatalogRecord[]} */
  var output = []
  if (!query && plugins.length > limit) {
    var status = record("plugin-catalog:list-status:" + route, "plugin-status",
      "Showing " + limit + " of " + plugins.length,
      "Type to search the complete catalog.", "", -1, "", "status")
    status.trailingText = "Search all"
    output.push(status)
  }
  for (var i = 0; i < visible.length; i++) {
    var plugin = visible[i]
    if (!plugin) continue
    var section = route === "plugins-installed"
      ? (plugin.enabled ? "Enabled" : "Installed")
      : (route === "plugins-built-in" ? "Built in"
        : (plugin.verificationStatus === "verified" ? "Registry Verified" : "Review Source"))
    output.push(pluginRecord(plugin, i, section))
  }
  if (output.length === 0) {
    output.push(record("plugin-catalog:empty:" + route, "plugin-status", "Nothing here yet",
      route === "plugins-installed" ? "Install a community plugin or enable a built-in plugin."
        : "No plugins match this view.", "󰀻", 0, "", "status"))
  }
  return output
}

/** @param {PluginCatalogPlugin} plugin @returns {PluginCatalogRecord[]} */
function detailRecords(plugin) {
  var hero = record("plugin-catalog:detail-hero:" + plugin.id, "plugin-status", plugin.name,
    plugin.description, plugin.firstParty ? "󰏖" : "󰀻", 0, "", "hero")
  hero.settingValue = plugin.id
  hero.previewImageUrl = plugin.previewUrl
  hero.trailingText = [pluginStateLabel(plugin), plugin.author, plugin.version ? "v" + plugin.version : ""]
    .filter(function(value) { return value.length > 0 }).join(" · ")
  /** @type {PluginCatalogRecord[]} */
  var output = [hero]
  if (!plugin.installed && plugin.installAvailable) {
    var unverified = plugin.verificationStatus !== "verified"
    output.push(actionRecord(plugin.id, "install",
      unverified ? "Install Unverified Plugin…" : "Install and Enable…",
      unverified
        ? "Review the source first. Omarchy will repeat its unsandboxed-code warning in a terminal."
        : "Opens Omarchy's interactive installer; the reviewed snapshot may differ from current upstream HEAD.",
      "󰏗", 10, "Actions", "Terminal", unverified))
  }
  if (plugin.installed && !plugin.enabled) {
    output.push(actionRecord(plugin.id, "enable", "Enable Plugin",
      "Load this plugin into the long-lived Omarchy shell process.", "", 10,
      "Actions", "", false))
  } else if (plugin.installed && plugin.enabled && plugin.canDisable) {
    output.push(actionRecord(plugin.id, "disable", "Disable Plugin",
      "Unload this plugin and remove it from the active shell configuration.", "", 10,
      "Actions", "", false))
  }
  if (plugin.installed && !plugin.firstParty) {
    output.push(actionRecord(plugin.id, "update", "Check for Updates…",
      "Review upstream changes in a terminal before fast-forwarding.", "󰚰", 11,
      "Actions", "Terminal", false))
    output.push(actionRecord(plugin.id, "remove", "Remove Plugin…",
      "Omarchy confirms, disables, and removes or backs up the local plugin.", "", 12,
      "Actions", "Terminal", true))
  }
  if (plugin.marketplaceUrl) {
    output.push(actionRecord(plugin.id, "open-marketplace", "View Marketplace Listing",
      "See preview images, registry metadata, and verification details.", "󰖟", 20,
      "Links", "↗", false))
  }
  if (plugin.repositoryUrl) {
    output.push(actionRecord(plugin.id, "open-repository", "Review Source Repository",
      plugin.repositoryUrl, "󰊤", 21, "Links", "↗", false))
  }
  if (!plugin.installed && plugin.installAvailable) {
    output.push(actionRecord(plugin.id, "copy-install-command", "Copy Install Command",
      "Copy the same interactive Omarchy command used by Install and Enable.", "", 22,
      "Links", "Copy", false))
  }
  var verificationDescription = plugin.verificationStatus === "verified"
    ? "Reviewed snapshot " + (plugin.verificationCommit || "recorded by the registry")
      + "; current upstream code is not guaranteed to match."
    : (plugin.verificationStatus === "unverified"
      ? "No reviewed registry snapshot. Inspect the source before installing."
      : "This installed plugin has no matching marketplace listing.")
  var verification = record("plugin-catalog:verification:" + plugin.id, "plugin-status",
    plugin.verificationLabel, verificationDescription,
    plugin.verificationStatus === "verified" ? "󰄬" : "", 30,
    "Details", "status")
  verification.trailingText = plugin.verificationCommit
    ? plugin.verificationCommit.slice(0, 8) : ""
  output.push(verification)
  if (plugin.author) output.push(actionRecord(plugin.id, "copy-author", "Author",
    plugin.author, "󰀄", 31, "Details", plugin.author, false))
  if (plugin.version) output.push(actionRecord(plugin.id, "copy-version", "Version",
    plugin.version, "󰓹", 32, "Details", plugin.version, false))
  if (plugin.license) output.push(actionRecord(plugin.id, "copy-license", "License",
    plugin.license, "󰿃", 33, "Details", plugin.license, false))
  output.push(actionRecord(plugin.id, "copy-id", "Plugin ID", plugin.id, "󰌷", 34,
    "Details", plugin.id, false))
  return output
}

/**
 * Search-only navigation records that let consumers expose every plugin
 * library route without fetching the remote catalog.
 * @returns {PluginCatalogRecord[]}
 */
function rootSearchRecords() {
  var browse = record("plugin-catalog:search:browse", "plugin-open-route",
    "Omarchy Plugins", "Discover community plugins and manage what is installed.",
    "󰀻", -4, "Launcher", "navigation")
  browse.breadcrumb = "Omalauncher"
  browse.targetRoute = "plugins"
  browse.route = "plugins"
  browse.parentRoute = "root"
  browse.intentQueries = ["plugin", "plugins"]
  browse.aliases = ["plugin marketplace"]
  browse.exactKeywords = ["plugins"]
  browse.keywords = ["plugins", "marketplace", "catalog", "browse"]
  browse.searchText = "browse omarchy plugins marketplace catalog"

  var installed = record("plugin-catalog:search:installed", "plugin-open-route",
    "Installed Plugins", "Enable, disable, update, or remove plugins on this system.",
    "󰏖", -3, "Launcher", "navigation")
  installed.breadcrumb = "Omalauncher › Plugins"
  installed.targetRoute = "plugins-installed"
  installed.route = "plugins-installed"
  installed.exactKeywords = ["plugins"]
  installed.keywords = ["installed", "enabled", "disabled", "update", "remove", "uninstall"]
  installed.searchText = "installed enabled disabled update remove uninstall manage omarchy plugins"

  var discover = record("plugin-catalog:search:discover", "plugin-open-route",
    "Discover Plugins", "Search installable community plugins from the marketplace.",
    "󰚰", -2, "Launcher", "navigation")
  discover.breadcrumb = "Omalauncher › Plugins"
  discover.targetRoute = "plugins-available"
  discover.route = "plugins-available"
  discover.aliases = ["plugin marketplace", "available plugins"]
  discover.exactKeywords = ["plugins"]
  discover.keywords = ["discover", "available", "community", "marketplace", "install"]
  discover.searchText = "discover available community marketplace install browse omarchy plugins"

  var builtIn = record("plugin-catalog:search:built-in", "plugin-open-route",
    "Built-in Plugins", "Browse the plugins included with Omarchy.",
    "󰏖", -1, "Launcher", "navigation")
  builtIn.breadcrumb = "Omalauncher › Plugins"
  builtIn.targetRoute = "plugins-built-in"
  builtIn.route = "plugins-built-in"
  builtIn.aliases = ["builtin plugins", "first-party plugins"]
  builtIn.exactKeywords = ["plugins"]
  builtIn.keywords = ["built-in", "builtin", "first-party", "included", "official"]
  builtIn.searchText = "built-in builtin first-party included official omarchy plugins"
  return [browse, installed, discover, builtIn]
}

/**
 * @param {PluginCatalog} catalog
 * @param {unknown} routeValue
 * @param {PluginCatalogRouteOptions | null} [options]
 * @returns {PluginCatalogRecord[]}
 */
function recordsForRoute(catalog, routeValue, options) {
  var route = text(routeValue)
  var opts = options || {}
  if (route === "plugins") return rootRecords(catalog, opts)
  if (route === "plugins-installed" || route === "plugins-available" || route === "plugins-built-in") {
    return listRecords(catalog, route, opts)
  }
  var pluginId = pluginIdForRoute(route)
  var plugin = pluginId ? findPlugin(catalog, pluginId) : null
  if (plugin) return detailRecords(plugin)
  return [record("plugin-catalog:not-found", "plugin-status", "Plugin not found",
    "Refresh the catalog or return to Plugins.", "", 0, "", "status")]
}

/** @param {PluginCatalog} catalog @param {unknown} routeValue @returns {string} */
function routeTitle(catalog, routeValue) {
  var route = text(routeValue)
  if (route === "plugins") return "Plugins"
  if (route === "plugins-installed") return "Installed Plugins"
  if (route === "plugins-available") return "Discover Plugins"
  if (route === "plugins-built-in") return "Built-in Plugins"
  var plugin = findPlugin(catalog, pluginIdForRoute(route))
  return plugin ? plugin.name : "Plugins"
}

/** @param {string} action @param {string} pluginId @returns {PluginLifecycleIntent} */
function emptyIntent(action, pluginId) {
  return {
    kind: "none",
    action: action,
    pluginId: pluginId,
    argv: [],
    url: "",
    value: "",
    message: "Plugin action is no longer available",
    destructive: false
  }
}

/**
 * @param {PluginCatalog} catalog
 * @param {unknown} pluginIdValue
 * @param {unknown} actionValue
 * @returns {PluginLifecycleIntent}
 */
function lifecycleIntent(catalog, pluginIdValue, actionValue) {
  var pluginId = text(pluginIdValue)
  var action = text(actionValue)
  var intent = emptyIntent(action, pluginId)
  if (pluginId === "catalog" && action === "open-marketplace") {
    intent.kind = "url"
    intent.url = catalog.marketplaceBaseUrl + "/index.html#catalog"
    intent.message = "Opening the plugin marketplace"
    return intent
  }
  var plugin = validPluginId(pluginId) ? findPlugin(catalog, pluginId) : null
  if (!plugin) return intent
  if (action === "install" && !plugin.installed && plugin.installAvailable && plugin.cloneUrl) {
    intent.kind = "terminal"
    intent.argv = ["omarchy", "plugin", "add", plugin.cloneUrl, "--enable"]
    intent.message = "Continue plugin installation in the terminal"
    intent.destructive = plugin.verificationStatus !== "verified"
  } else if (action === "enable" && plugin.installed && !plugin.enabled) {
    intent.kind = "direct"
    intent.argv = ["omarchy", "plugin", "enable", plugin.id]
    intent.message = "Enabling " + plugin.name
  } else if (action === "disable" && plugin.installed && plugin.enabled && plugin.canDisable) {
    intent.kind = "direct"
    intent.argv = ["omarchy", "plugin", "disable", plugin.id]
    intent.message = "Disabling " + plugin.name
  } else if (action === "update" && plugin.installed && !plugin.firstParty) {
    intent.kind = "terminal"
    intent.argv = ["omarchy", "plugin", "update", plugin.id]
    intent.message = "Review plugin updates in the terminal"
  } else if (action === "remove" && plugin.installed && !plugin.firstParty) {
    intent.kind = "terminal"
    intent.argv = ["omarchy", "plugin", "remove", plugin.id]
    intent.message = "Confirm plugin removal in the terminal"
    intent.destructive = true
  } else if (action === "open-repository" && plugin.repositoryUrl) {
    intent.kind = "url"
    intent.url = plugin.repositoryUrl
    intent.message = "Opening the source repository"
  } else if (action === "open-marketplace" && plugin.marketplaceUrl) {
    intent.kind = "url"
    intent.url = plugin.marketplaceUrl
    intent.message = "Opening the marketplace listing"
  } else if (action === "copy-install-command" && !plugin.installed
      && plugin.installAvailable && plugin.cloneUrl) {
    intent.kind = "copy"
    intent.value = ["omarchy", "plugin", "add", plugin.cloneUrl, "--enable"].join(" ")
    intent.message = "Copied interactive install command"
  } else if (action === "copy-author" && plugin.author) {
    intent.kind = "copy"
    intent.value = plugin.author
    intent.message = "Copied plugin author"
  } else if (action === "copy-version" && plugin.version) {
    intent.kind = "copy"
    intent.value = plugin.version
    intent.message = "Copied plugin version"
  } else if (action === "copy-license" && plugin.license) {
    intent.kind = "copy"
    intent.value = plugin.license
    intent.message = "Copied plugin license"
  } else if (action === "copy-id") {
    intent.kind = "copy"
    intent.value = plugin.id
    intent.message = "Copied plugin ID"
  }
  return intent
}

if (typeof module !== "undefined") {
  module.exports = {
    SUPPORTED_SCHEMA_VERSION: SUPPORTED_SCHEMA_VERSION,
    buildCatalog: buildCatalog,
    detailRoute: detailRoute,
    pluginIdForRoute: pluginIdForRoute,
    isRoute: isRoute,
    recordsForRoute: recordsForRoute,
    rootSearchRecords: rootSearchRecords,
    routeTitle: routeTitle,
    lifecycleIntent: lifecycleIntent,
    validPluginId: validPluginId,
    githubCloneUrl: githubCloneUrl
  }
}
