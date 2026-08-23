# Omalauncher Core

Pure JavaScript models shared by Omalauncher-family Quickshell plugins.

The core has no QML, shell, filesystem, or installation-time dependencies. A
consumer vendors a tagged version into `shared/core` with `git subtree`, making
the final plugin repository self-contained.

## Modules

- `src/AppIndex.js` converts desktop entries into provider-neutral records.
- `src/SearchEngine.js` provides fuzzy semantic search with deterministic
  provider and usage tie-breaking.
- `src/PluginCatalogModel.js` reconciles marketplace listings with installed
  Omarchy plugins, builds root-search navigation plus discovery/detail routes,
  carries validated preview metadata, and derives lifecycle intents without
  performing I/O.

The plugin catalog module accepts unknown remote payloads at its interface and
narrows them into strict records. It does not trust catalog command strings;
install intents are derived from validated GitHub repository URLs, and no
intent includes `--yes`.

## Validate

```bash
npm install
npm run validate
```

## Add to a consumer

```bash
git remote add omalauncher-core \
  https://github.com/mirashif/omalauncher-core.git
git fetch omalauncher-core
git subtree add --prefix=shared/core omalauncher-core main --squash
```

The vendored files are committed to the consumer. Users do not install this
repository separately.
