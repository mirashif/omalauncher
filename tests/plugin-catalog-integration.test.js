// @ts-check

const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const PluginCatalogModel = require("../shared/core/src/PluginCatalogModel.js")

const projectRoot = path.resolve(__dirname, "..")

test("launcher loads the community catalog lazily through a bounded curl adapter", () => {
  const provider = fs.readFileSync(
    path.join(projectRoot, "providers", "PluginCatalogProvider.qml"), "utf8")
  assert.match(provider, /https:\/\/omarchyplugins\.com\/catalog\.json/)
  assert.match(provider, /function ensureLoaded\(\)/)
  assert.match(provider, /"--connect-timeout", "5"/)
  assert.match(provider, /"--max-time", "15"/)
  assert.match(provider, /"--max-filesize", "8388608"/)
  assert.doesNotMatch(provider, /Component\.onCompleted:[\s\S]*root\.refresh\(\)/)
  const finishRefresh = provider.slice(
    provider.indexOf("function finishRefresh"), provider.indexOf("Process {"))
  assert.ok(finishRefresh.indexOf("root.ready = true") < finishRefresh.indexOf("root.loading = false"))
})

test("launcher exposes plugin browse and lifecycle routes without automatic confirmation", () => {
  const launcher = fs.readFileSync(path.join(projectRoot, "Launcher.qml"), "utf8")
  assert.match(launcher, /PluginCatalogModel\.rootSearchRecords\(\)/)
  assert.match(launcher, /root\.rootSearchRecords\.concat\([\s\S]*?root\.managementRecords\(\)/)
  assert.match(launcher, /PluginCatalogModel\.isRoute\(requestedRoute\)/)
  assert.match(launcher, /PluginCatalogModel\.recordsForRoute/)
  assert.match(launcher, /loading: root\.pluginCatalogLoading/)
  assert.match(launcher, /PluginCatalogModel\.lifecycleIntent/)
  assert.match(launcher, /xdg-terminal-exec/)
  assert.match(launcher, /argv\.indexOf\("--yes"\) >= 0/)
  assert.match(launcher, /pluginCatalog: \{/)
})

test("plugin submenu records join root search without eagerly loading the catalog", () => {
  const records = PluginCatalogModel.rootSearchRecords()
  assert.deepEqual(records.map(record => record.title), [
    "Omarchy Plugins", "Installed Plugins", "Discover Plugins", "Built-in Plugins"
  ])
  assert.equal(records[0].description, "Search, discover, install, remove plugins.")
  assert.deepEqual(records.map(record => record.targetRoute), [
    "plugins", "plugins-installed", "plugins-available", "plugins-built-in"
  ])
})

test("plugin rows and details stay in the shared strict core", () => {
  const catalog = PluginCatalogModel.buildCatalog({
    stateSchemaVersion: 2,
    plugins: [{
      id: "example.panel",
      name: "Example Panel",
      description: "Example",
      sourceType: "community",
      repo: "https://github.com/example/panel",
      previewImage: "assets/img/plugins/example-panel.webp",
      installAvailable: true,
      verificationStatus: "verified"
    }]
  }, [])
  const browse = PluginCatalogModel.recordsForRoute(catalog, "plugins-available")
  const details = PluginCatalogModel.recordsForRoute(
    catalog, PluginCatalogModel.detailRoute("example.panel"))
  assert.equal(browse[0].kind, "plugin-open-details")
  assert.equal(details[0].previewImageUrl,
    "https://omarchyplugins.com/assets/img/plugins/example-panel.webp")
  assert.equal(details.some(record => record.settingKey === "install"), true)
})

test("plugin screenshots render only in the detail hero", () => {
  const launcher = fs.readFileSync(path.join(projectRoot, "Launcher.qml"), "utf8")
  const previewProvider = fs.readFileSync(
    path.join(projectRoot, "providers", "PluginPreviewProvider.qml"), "utf8")
  assert.match(launcher, /required property string previewImageUrl/)
  assert.match(launcher, /isHero && previewImageUrl\.length > 0/)
  assert.match(launcher, /pluginPreviewProvider\.imageSource/)
  assert.match(launcher, /previewHeroExtraHeight: Style\.space\(380\)/)
  assert.match(launcher, /Math\.min\(Style\.space\(560\), parent\.width \* 0\.94\)/)
  assert.match(launcher,
    /id: pluginPreviewFrame[\s\S]*?id: pluginPreviewImage[\s\S]*?width: resultRow\.hasPreviewImage \? pluginPreviewFrame\.width : parent\.width/)
  assert.match(launcher, /fillMode: Image\.PreserveAspectFit/)
  assert.match(launcher, /asynchronous: true/)
  assert.match(previewProvider, /XDG_CACHE_HOME/)
  assert.match(previewProvider, /https:\\\/\\\/omarchyplugins\\\.com/)
  assert.match(previewProvider, /cacheProcess\.command = \["test", "-s", root\.pngPath\]/)
  assert.match(previewProvider, /"--max-filesize", "8388608"/)
  assert.match(previewProvider, /"magick"[\s\S]*?"-thumbnail", "896x504>"/)
  assert.match(previewProvider, /root\.sourcePath \+ "\[0\]"/)
})
