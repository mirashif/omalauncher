# Contributing to Omalauncher

Thanks for helping improve Omalauncher. This guide covers local installation,
validation, and the implementation details intentionally kept out of the
user-facing README.

## Local development setup

Omalauncher targets Omarchy 4.0 and Quickshell 0.3. Copy a checkout into the
third-party plugin directory:

```bash
mkdir -p ~/.config/omarchy/plugins/io.github.omalauncher
rsync -a --exclude=.git --exclude=node_modules \
  ./ ~/.config/omarchy/plugins/io.github.omalauncher/
omarchy-shell shell rescanPlugins
omarchy plugin enable io.github.omalauncher
```

Plugin files below `~/.config/omarchy/plugins/` reload automatically. If a
keep-loaded instance becomes stale, run:

```bash
omarchy restart shell
```

Use the installation instructions in [README.md](README.md#2-choose-a-shortcut)
to add and validate a launcher binding.

## Validation

Install the pinned development tools once with `npm ci`. Run the JavaScript
type and safety checks directly with:

```bash
npm run typecheck
npm run lint:types
```

Run the complete release check before submitting a change:

```bash
npm run validate
```

It runs both JavaScript checks, the Node test suite, plugin-manifest validation,
`qmllint`, the real onboarding journey in an isolated nested compositor when a
Wayland session is available, and an isolated clean install/enable/remove cycle
through the Omarchy plugin CLI.
Run only the packaging smoke test with:

```bash
npm run package:smoke
```

Run the onboarding journey by itself without showing a test window:

```bash
npm run test:onboarding
```

To watch the test choose the recommended shortcut, replace Omarchy Menu, close,
and reopen the launcher, run:

```bash
npm run test:onboarding:visible
```

Both modes use temporary config and state directories. A failed onboarding run
keeps that directory and prints its path; it contains the Quickshell and
Hyprland logs plus a screenshot of the failing stage.

Inspect static application and menu discovery with:

```bash
npm run spike
npm run spike -- --all
```

The `--all` form ignores `when` visibility checks and is useful for inspecting
routes for software that is not currently installed.

Check representative empty-state and search work against the 100 ms warm-open
and 16 ms search-update budgets with:

```bash
npm run benchmark
npm run benchmark:runtime
```

The runtime benchmark expects the development copy to be loaded in the running
Omarchy shell.

## Implementation overview

- `Launcher.qml` owns the launcher surface, routing, provider coordination, and
  execution handoff.
- `providers/` adapts installed applications, Omarchy menus, live shell
  features, the CLI catalog, calculator results, and scoped file searches into
  searchable records.
- `services/` contains ranking, navigation, state migration, actions, layout,
  highlighting, and status behavior. `services/SearchEngine.js` applies
  deterministic semantic ranking; usage frequency and recency only break ties
  between equally strong matches.
- `tests/` exercises the provider and service models independently of the QML
  surface.

### JavaScript type safety

Runtime modules stay as JavaScript because QML loads them directly. They use
JSDoc imports from `types/models.d.ts`, and TypeScript checks them with
`allowJs`, `checkJs`, and strict mode without emitting replacement files.

Treat filesystem, JSON, process, QML, and plugin-registry values as `unknown`
until a local type guard validates their shape. Do not introduce explicit or
implicit `any`, unsafe `any` flows, `@ts-ignore`, or `@ts-nocheck`. The
type-aware ESLint rules enforce that policy in production code, scripts, and
tests.

`tsconfig.json` applies unchecked-index protection to runtime code and scripts.
`tsconfig.tests.json` checks test fixtures under the same strict contracts while
allowing ordinary assertion-driven array access. Add reusable provider and
service contracts to `types/models.d.ts`; keep one-off local shapes in JSDoc
beside the code that owns them.

The application adapter prefers Omarchy's shared application library and keeps
a Quickshell `DesktopEntries` fallback behind the same interface. Stock and
user JSONC menus are parsed with per-field overrides, breadcrumbs, visibility
checks, and hot reload.

`ShellPluginProvider.qml` consumes the injected live plugin registry. Enabled
panel, overlay, and menu plugins are automatically searchable. Bar widgets are
included only when their live widget exposes the panel contract used by
Omarchy's own `shell.summon`; service-only and internal surfaces are excluded.
Registry and shell-configuration changes rebuild this source, and opening the
launcher rechecks live bar widgets.

Third-party plugins can set `"omalauncher": false` in their manifest to opt
out. A service-only plugin can explicitly expose a summonable surface with an
object such as:

```json
{
  "omalauncher": {
    "summon": true,
    "title": "My Tool",
    "description": "Open my tool",
    "aliases": ["utility"],
    "keywords": ["example"],
    "category": "Tools",
    "icon": "󰒓",
    "payload": {}
  }
}
```

`CommandCatalogProvider.qml` loads `omarchy commands --json` asynchronously,
watches Omarchy's command directory, retains the last valid catalog on errors,
and refreshes stale data when the launcher opens. Only reviewed, context-free,
non-privileged routes can run directly. Every other catalog record opens its
help in a terminal. Both paths use literal argument arrays and never construct
a shell command from catalog data.

`SourceMergeModel.js` removes exact stock-menu duplicates and lets a live shell
surface own an equivalent CLI route. CLI-only entries are search-only in the
empty view, but become visible there when favorited or recently used.

Personalization is written atomically to:

```text
${XDG_STATE_HOME:-~/.local/state}/omalauncher/state.json
```

Omalauncher delegates static menu execution through `omarchy menu summon
<route>`, shell features through the injected shell API, and reviewed CLI
execution through literal argument arrays. It does not modify files below
`/usr/share/omarchy`.

## Product boundaries

Read [PLAN.md](PLAN.md) before expanding provider scope or changing interaction
contracts. In particular:

- Keep application and command search responsive while optional providers work
  asynchronously.
- Treat late asynchronous responses as stale and discard them.
- Never build shell command strings from calculator expressions, paths, or
  search queries.
- Restrict file search to explicit, canonical user-approved roots.
- Preserve the stock Omarchy launchers as a fallback.
