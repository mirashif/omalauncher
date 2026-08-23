// @ts-check

const test = require("node:test")
const assert = require("node:assert/strict")

const PluginCatalogModel = require("../src/PluginCatalogModel.js")
const SearchEngine = require("../src/SearchEngine.js")

const marketplace = {
  stateSchemaVersion: 2,
  generatedAt: "2026-08-23T15:23:59.662Z",
  warnings: ["example.invalid: manifest-invalid"],
  plugins: [{
    id: "acme.weather",
    name: "Weather Panel",
    description: "Forecasts in the Omarchy bar",
    author: "Acme",
    version: "1.2.0",
    kind: "Bar widget",
    category: "Widgets",
    tags: ["weather", "bar"],
    license: "MIT",
    sourceType: "community",
    repo: "https://github.com/acme/weather",
    installAvailable: true,
    installCommand: "malicious --yes",
    previewImage: "assets/img/plugins/acme-weather.webp",
    verificationStatus: "verified",
    listingValidatedCommit: "0123456789abcdef",
    listedAt: "2026-08-20T00:00:00Z",
    stars: 12
  }, {
    id: "acme.unreviewed",
    name: "Unreviewed",
    description: "Needs source review",
    sourceType: "community",
    repo: "https://github.com/acme/unreviewed.git",
    installAvailable: true,
    verificationStatus: "unverified",
    listedAt: "2026-08-21T00:00:00Z"
  }, {
    id: "omarchy.audio",
    name: "Audio",
    description: "Audio controls",
    sourceType: "builtin",
    kind: "Bar widget",
    officialCommand: "omarchy bar plugin add omarchy.audio"
  }]
}

test("catalog reconciles marketplace listings with installed host state", () => {
  const catalog = PluginCatalogModel.buildCatalog(marketplace, [{
    id: "acme.weather",
    name: "Weather Panel",
    version: "1.3.0",
    kinds: ["bar-widget"],
    enabled: true,
    canDisable: true,
    firstParty: false,
    sourceDir: "/home/user/.config/omarchy/plugins/acme.weather"
  }, {
    id: "local.notes",
    name: "Local Notes",
    version: "0.1.0",
    kinds: ["panel"],
    enabled: false,
    canDisable: true,
    firstParty: false
  }])

  assert.equal(catalog.remoteError, "")
  assert.deepEqual(catalog.counts, {
    total: 4,
    installed: 2,
    enabled: 1,
    available: 1,
    builtin: 1,
    verified: 1
  })
  const installed = catalog.plugins.find(plugin => plugin.id === "acme.weather")
  const local = catalog.plugins.find(plugin => plugin.id === "local.notes")
  assert.ok(installed)
  assert.ok(local)
  assert.equal(installed.version, "1.3.0")
  assert.equal(installed.installAvailable, false)
  assert.equal(local.verificationStatus, "not-listed")
})

test("catalog ignores invalid records and preserves installed plugins when remote schema changes", () => {
  const catalog = PluginCatalogModel.buildCatalog({
    stateSchemaVersion: 99,
    plugins: [{ id: "../../escape", name: "Unsafe" }]
  }, [{ id: "local.safe", name: "Safe", enabled: true }])

  assert.equal(catalog.remoteError, "Plugin catalog schema is unsupported")
  assert.deepEqual(catalog.plugins.map(plugin => plugin.id), ["local.safe"])
})

test("discovery routes expose installed, available, built-in, and detail records", () => {
  const catalog = PluginCatalogModel.buildCatalog(marketplace, [{
    id: "acme.weather",
    name: "Weather Panel",
    enabled: true
  }])
  const root = PluginCatalogModel.recordsForRoute(catalog, "plugins")
  assert.deepEqual(root.slice(1, 4).map(record => record.targetRoute), [
    "plugins-installed",
    "plugins-available",
    "plugins-built-in"
  ])
  const available = PluginCatalogModel.recordsForRoute(catalog, "plugins-available")
  assert.equal(available.some(record => record.settingValue === "acme.unreviewed"), true)
  const details = PluginCatalogModel.recordsForRoute(
    catalog, PluginCatalogModel.detailRoute("acme.unreviewed"))
  const install = details.find(record => record.settingKey === "install")
  assert.ok(install)
  assert.equal(install.destructive, true)
  assert.match(install.title, /Unverified/)
  const weatherDetails = PluginCatalogModel.recordsForRoute(
    catalog, PluginCatalogModel.detailRoute("acme.weather"))
  assert.equal(weatherDetails[0].previewImageUrl,
    "https://omarchyplugins.com/assets/img/plugins/acme-weather.webp")
})

test("plugin submenus are first-class root search records", () => {
  const records = PluginCatalogModel.rootSearchRecords()
  assert.deepEqual(records.map(record => record.targetRoute), [
    "plugins", "plugins-installed", "plugins-available", "plugins-built-in"
  ])
  assert.equal(SearchEngine.search(records, "uninstall plugins")[0].targetRoute,
    "plugins-installed")
  assert.equal(SearchEngine.search(records, "available plugins")[0].targetRoute,
    "plugins-available")
  assert.equal(SearchEngine.search(records, "first party plugins")[0].targetRoute,
    "plugins-built-in")
})

test("lifecycle intents derive literal Omarchy argv and never trust catalog command strings", () => {
  const catalog = PluginCatalogModel.buildCatalog(marketplace, [])
  const install = PluginCatalogModel.lifecycleIntent(catalog, "acme.weather", "install")
  assert.deepEqual(install.argv, [
    "omarchy", "plugin", "add", "https://github.com/acme/weather.git", "--enable"
  ])
  assert.equal(install.argv.includes("--yes"), false)
  assert.equal(install.value.includes("malicious"), false)

  const installedCatalog = PluginCatalogModel.buildCatalog(marketplace, [{
    id: "acme.weather",
    name: "Weather Panel",
    enabled: true,
    firstParty: false
  }])
  assert.deepEqual(
    PluginCatalogModel.lifecycleIntent(installedCatalog, "acme.weather", "disable").argv,
    ["omarchy", "plugin", "disable", "acme.weather"])
  assert.deepEqual(
    PluginCatalogModel.lifecycleIntent(installedCatalog, "acme.weather", "update").argv,
    ["omarchy", "plugin", "update", "acme.weather"])
  assert.deepEqual(
    PluginCatalogModel.lifecycleIntent(installedCatalog, "acme.weather", "remove").argv,
    ["omarchy", "plugin", "remove", "acme.weather"])
})

test("available browse is bounded until a search query requests the complete source", () => {
  const plugins = []
  for (let index = 0; index < 140; index += 1) {
    plugins.push({
      id: "example.plugin-" + index,
      name: "Plugin " + index,
      sourceType: "community",
      repo: "https://github.com/example/plugin-" + index,
      installAvailable: true,
      verificationStatus: "verified"
    })
  }
  const catalog = PluginCatalogModel.buildCatalog({ stateSchemaVersion: 2, plugins }, [])
  const bounded = PluginCatalogModel.recordsForRoute(catalog, "plugins-available", { limit: 20 })
  const searchable = PluginCatalogModel.recordsForRoute(catalog, "plugins-available", {
    limit: 20,
    query: "plugin 139"
  })
  assert.equal(bounded.length, 21)
  assert.equal(searchable.length, 140)
})

test("root records disclose an in-progress catalog refresh", () => {
  const catalog = PluginCatalogModel.buildCatalog(null, [{
    id: "local.notes",
    name: "Local Notes",
    enabled: true
  }])
  const records = PluginCatalogModel.recordsForRoute(catalog, "plugins", { loading: true })
  assert.equal(records[1].id, "plugin-catalog:loading")
  assert.match(String(records[1].description || ""), /Installed plugin controls remain available/)
})
