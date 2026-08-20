# Omalauncher Product Plan

Status: v0.9.0 complete
Last updated: 2026-08-21
Target platform: Omarchy 4 / Quattro

## v0.8 interaction completion

Goal: complete the existing search-and-run loop before adding new providers.
The release deliberately avoids promises the current Omarchy plugin contract
cannot fulfill: global command-hotkey recording, generic Quick Look, generic
undo, and success/failure reporting for commands delegated through the stock
menu.

Implementation rules:

- Keep Omarchy command execution delegated to the stock menu.
- Report delegated execution as a handoff, never as confirmed success.
- Use Omarchy's existing OSD for transient feedback.
- Store personalization outside the plugin checkout with versioned migration.
- Keep navigation shortcuts fixed and documented for v0.8.
- Complete and validate each todo in an independent commit.

### Ordered todos

- [x] 1. Extend persistent state for aliases, hidden results, query history, and
  compact-mode preference, including migration from the v1 state schema.
- [x] 2. Introduce structured Action Panel sections and shallow submenu
  navigation, and open the panel from a result row's right-click action.
- [x] 3. Add editable user aliases with conflict handling, search integration,
  persistent result badges, and remove-alias support.
- [x] 4. Add hide/unhide actions plus a searchable Manage Hidden Results view so
  every hidden item remains recoverable.
- [x] 5. Add favorite reordering through Action Panel actions and direct
  keyboard shortcuts.
- [x] 6. Add query-history cycling, section jumps, pop-to-root, and immediate
  close shortcuts without breaking normal text editing.
- [x] 7. Add a stable footer, persistent favorite/alias badges, and safe title
  match highlighting.
- [x] 8. Make provider warnings interactive with diagnostic detail and retry,
  and use truthful Omarchy OSD feedback for local changes and command handoff.
- [x] 9. Add compact mode, explicit accessibility metadata, final documentation,
  and full release validation.

### Deferred beyond v0.8

- Global per-command hotkey recording, pending a managed Omarchy/Hyprland
  registration contract.
- Generic Quick Look, pending preview metadata and file-like providers.
- Query-specific learned ranking, pending evidence that deterministic tiers are
  producing recurring ranking mistakes.
- Custom navigation-binding presets or an editor.
- A general third-party Action Panel custom-view SDK.

## v0.9 Raycast-style expansion

Status: Complete. Hardening and every Phase 5–8 feature shipped in separate
commits before the v0.9.0 release checkpoint.

Goal: add high-value launcher-native utilities without weakening deterministic
search, warm-open latency, or Omarchy's ownership of system actions.

### Viability decisions

| Feature | Viability | Relative effort | Decision and boundary |
| --- | --- | --- | --- |
| Quick result activation | High | Small | Add launcher-local `Ctrl+1` through `Ctrl+8` activation for the first eight results in the current filtered list. The current surface renders at most eight result rows. This is distinct from global per-command hotkeys and needs no Hyprland registration. |
| Omalauncher Settings | High | Medium | Add a searchable, keyboard-first route inside Omalauncher. Persist only plugin-owned preferences and provider configuration in the versioned state file. Do not edit Omarchy or Hyprland configuration from this screen. |
| Calculator | High with an optional backend | Medium | Use the `qalc` CLI from `libqalculate` for arithmetic, constants, and unit conversions. The installed `omacalc` application is a GUI, not a reusable expression backend. Never evaluate expressions through a shell. |
| Scoped file-name search | Medium-high | Large | Use asynchronous `fd` queries only inside user-approved roots. Do not index `/`, recurse through all of `$HOME` by default, search file contents, or place an unbounded file index in the root provider. |

In this section, `Ctrl+N` means Ctrl plus a result number, not the literal
`Ctrl+N` key. With the current eight-row viewport the supported shortcuts are
`Ctrl+1` through `Ctrl+8`. If the intended shortcut was literal `Ctrl+N`, revise
this item before implementation.

### Cross-provider rules

- Finish the v0.8.1 latency benchmarks and stale-response hardening before
  enabling another asynchronous provider.
- Keep applications and Omarchy commands searchable immediately; calculator
  and file providers may not block the unified index or launcher opening.
- Give every asynchronous request a monotonically increasing generation ID and
  ignore output from superseded requests.
- Debounce query-driven subprocesses, cancel superseded work, cap results, and
  expose provider-specific loading, unavailable, empty, and failure states.
- Pass untrusted expressions, paths, and queries as process arguments or stdin;
  never concatenate them into `bash -c` command strings.
- Keep new providers out of frecency until their result IDs and ranking tiers
  are stable and tested.
- Preserve the stock Omarchy launcher as the fallback and request no elevated
  privileges.

### Ordered delivery

#### Phase 5: Settings foundation and state v3

Status: Complete in `037a8a2`.

Goal: provide one safe home for all Omalauncher-owned preferences before adding
provider-specific configuration.

Deliverables:

- Add an `Omalauncher Settings` management result and an in-launcher settings
  route with the same keyboard, pointer, and accessibility behavior as other
  routes.
- Migrate state schema v2 to v3 without losing favorites, usage, aliases,
  hidden results, query history, or compact mode.
- Add settings for calculator enablement, file-search enablement, quick-result
  shortcuts, file-search scopes, and ignore patterns.
- Show backend availability and actionable diagnostics without installing
  packages or changing system configuration automatically.
- Add reset actions for provider settings and personalization with explicit
  confirmation for destructive resets.

Exit criteria:

- Settings survive shell restart and plugin reinstall.
- Invalid or missing paths are reported and never silently broaden a scope.
- A malformed future setting falls back independently without discarding the
  rest of the state file.

#### Phase 6: Quick result activation

Status: Complete in `3b8e2f6`.

Goal: run a visible search result directly by ordinal without moving selection.

Deliverables:

- Map `Ctrl+1` through `Ctrl+8` to the corresponding result in the current
  filtered result list; ignore shortcuts whose row does not exist.
- Display stable numeric shortcut hints on eligible rows.
- Route activation through the existing primary-action path so confirmation,
  query history, usage recording, OSD feedback, and stock-menu handoff remain
  consistent with Enter.
- Limit the shortcut to the main results surface. Text editors, the Action
  Panel, warnings, and Settings retain their existing input behavior.
- Add tests for filtering, missing ordinals, menus, applications, commands, and
  compact mode.

Exit criteria:

- The shortcut always activates the row whose displayed hint matches the key.
- No number shortcut inserts text, triggers twice, or bypasses an Omarchy-owned
  confirmation flow.

#### Phase 7: Calculator provider

Status: Complete in `7a91a86`.

Goal: surface safe calculator results as first-class ephemeral launcher rows.

Deliverables:

- Detect explicit calculator queries beginning with `=` and optionally
  arithmetic-looking input only when that heuristic cannot hide a stronger
  application or command match.
- Run `qalc` asynchronously with a short debounce and generation-based stale
  response rejection. Do not use JavaScript `eval`, QML dynamic evaluation, or
  shell evaluation.
- Normalize one successful response into a pinned `Calculator` result with
  Copy Result as the primary action and Copy Expression in the Action Panel.
- Support arithmetic, percentages, constants, and deterministic unit
  conversions first. Defer currency conversion unless its update and network
  behavior are explicit to the user.
- Report a missing `qalc` backend as an unavailable provider with installation
  guidance; keep every other provider healthy.
- Add parser, timeout, malformed-output, superseded-query, clipboard, and
  ranking tests.

Exit criteria:

- Calculator work never blocks typing or persists ephemeral expressions into
  the normal result index.
- Invalid expressions produce no executable row and expose a concise error only
  for explicit `=` queries.
- Expressions are passed without shell interpolation.

#### Phase 8: Scoped file-name provider

Status: Complete in `0504c07`.

Goal: find and open files quickly while making search scope and cost obvious.

Deliverables:

- Add a `Search Files` route and an explicit query mode such as `f `; do not mix
  file traversal into every root-search keystroke.
- Let users opt into one or more canonical directory roots from Settings.
  Offer detected common directories as choices, but configure no recursive
  whole-home or filesystem-root scope by default.
- Query `fd` asynchronously with fixed-string matching for file names, respect
  its ignore behavior, apply user ignore patterns, require a non-empty query,
  cap output, and impose a timeout.
- Use NUL-delimited output so unusual but valid file names remain safe. Reject
  results that resolve outside their configured canonical root.
- Normalize file rows with stable scope-relative IDs, path breadcrumbs, type
  icons where available, and deterministic ranking that prefers basename
  matches over path-only matches.
- Provide Open, Reveal in File Manager, and Copy Path actions using literal
  argument arrays or file URLs, never shell-built commands.
- Cancel superseded scans and discard late output using the shared generation
  contract.
- Add tests for scope boundaries, symlinks, ignores, hidden files, unusual
  names, result caps, timeouts, cancellation, missing `fd`, and open/reveal
  actions.

Exit criteria:

- No query can escape configured roots or scan `/` implicitly.
- File search stays responsive on a representative large development tree and
  does not regress the 100 ms warm-open or 16 ms local-search budgets.
- Disabling file search terminates active work and removes its records without
  affecting applications or Omarchy commands.

## Product thesis

Omalauncher is a keyboard-first command launcher for Omarchy. Its first job is
to make every installed application and every Omarchy command discoverable from
one search field, including commands currently buried several submenu levels
deep.

The MVP is inspired by Raycast's Root Search and Action Panel interaction
models, but it is not intended to reproduce Raycast's complete feature set.

## Current release

Version 0.9.0 is complete in this checkout. The release check covers 87
automated tests, manifest validation, QML linting, and an isolated
install/remove cycle.

The implementation has moved beyond the original MVP in three areas:

- An empty query shows the complete visible index after favorites and recents.
- Static Omarchy submenus, links, and the Apps provider navigate inside
  Omalauncher.
- Checked menu state is displayed, while an explicit Action Panel fallback can
  still open the stock Omarchy menu.

## Problem

The stock Omarchy menu is organized as a hierarchy. Its current search can find
a nested item by its own label, but does not search the item's ancestor path.
This prevents users from expressing intent naturally.

The Omarchy 4.0 menu installed during planning contained:

- 318 static entries
- 261 executable actions
- 57 submenus
- Four hierarchy levels
- 141 conditionally visible entries
- Only 20 entries with aliases

Examples from the current search implementation:

| Query | Stock behavior at planning | Required Omalauncher behavior |
| --- | --- | --- |
| `docker` | Finds Docker DB | Finds Docker DB |
| `install docker` | No result | Docker DB — Install > Development |
| `firefox` | Finds several Firefox rows | Distinguishes each row by its path |
| `remove firefox` | No result | Firefox — Remove > Browser |
| `update hyprland` | No result | Hyprland — Update > Config |
| `style screensaver` | No result | Screensaver — Style |
| `browser default` | No result | Browser — Setup > Defaults |

The product should therefore flatten the hierarchy for discovery while keeping
the path as visible context.

## Product principles

1. Search globally; navigate hierarchically only when useful.
2. Treat every executable operation as a first-class command.
3. Keep ranking predictable before making it personalized.
4. Make the primary action immediate and secondary actions discoverable.
5. Delegate system behavior to Omarchy instead of reimplementing it.
6. Preserve the stock launcher as a reliable fallback.
7. Stay fast enough that opening the launcher feels instantaneous.

## Hotkey and coexistence

Omalauncher uses `SUPER + R`, which was unbound on the development machine when
this plan was created.

The existing bindings remain unchanged:

- `SUPER + SPACE`: stock Omarchy menu
- `SUPER + ALT + SPACE`: stock Omarchy Apps menu

The installed user override has this shape:

```lua
o.bind(
  "SUPER + R",
  "Omalauncher",
  "omarchy-shell shell toggle io.github.omalauncher '{}'"
)
```

The published plugin ID is `io.github.omalauncher`.

## MVP experience

### Opening

- `SUPER + R` toggles Omalauncher.
- The search field receives focus immediately.
- The surface opens on the currently focused monitor.
- With an empty query, it shows favorites and recent selections first, followed
  by every remaining visible application and Omarchy record exactly once.
- The plugin uses `keepLoaded: true` to avoid repeated QML startup cost.

### Searching

MVP results come from two providers:

1. Installed desktop applications
2. Omarchy menu commands and submenus

An Omarchy command is normalized into a record such as:

```text
id:          remove.browser.firefox
title:       Firefox
subtitle:    Remove > Browser
searchText:  firefox remove browser remove browser firefox
route:       remove.browser.firefox
type:        omarchy-command
```

Search text includes:

- Display title
- Every ancestor label
- Description
- Existing aliases
- Tokenized command ID
- Provider-specific keywords

### Result presentation

Each result row contains:

- Icon
- Title
- Breadcrumb or short description
- Result type when clarification is useful
- Primary-action shortcut on the selected row

Duplicate labels must always be distinguishable. For example:

```text
Firefox    Setup > Defaults > Browser
Firefox    Install > Browser
Firefox    Remove > Browser
```

### Keyboard behavior

| Input | Behavior |
| --- | --- |
| Typing | Update results immediately |
| Up / Down | Move the selection |
| Enter | Run the primary action |
| Ctrl + Enter | Open the selected command's parent inside Omalauncher |
| Ctrl + K | Open or close the Action Panel |
| Escape | Close Action Panel, clear query, return from submenu, then close |
| Backspace / Left | Return from a submenu when the query is empty |
| Page Up / Page Down | Move by one result page |

### Action Panel

The MVP Action Panel contains only:

- Open or run
- Open the command's parent inside Omalauncher
- Open the relevant route in the stock Omarchy menu as a fallback
- Add to or remove from favorites
- Reset learned ranking for the result

Actions are searchable while the panel is open. Destructive actions remain
owned by Omarchy and retain any confirmation flow Omarchy provides.

## Search and ranking

Ranking uses explicit tiers, from strongest to weakest:

1. Exact alias match
2. Exact title match
3. Title prefix match
4. All query terms match across title and breadcrumb
5. Keyword, description, or command-ID match
6. Fuzzy character match
7. Frecency as a tie-breaker within the same semantic tier

Frecency must never cause a weak semantic match to outrank an exact or strong
contextual match.

Search implementation requirements:

- Normalize case, punctuation, dots, dashes, underscores, and repeated spaces.
- Tokenize breadcrumbs so `remove firefox` matches a Firefox leaf below Remove.
- Support compact fuzzy input such as `ffx` or `rm fire`.
- Limit rendered results while retaining the complete in-memory index.
- Recompute only when the query or provider revision changes.
- Ignore stale asynchronous provider responses.

## Command discovery and execution

### Menu sources

The command provider reads and merges:

```text
$OMARCHY_PATH/default/omarchy/omarchy-menu.jsonc
~/.config/omarchy/extensions/omarchy-menu.jsonc
```

It follows Omarchy's existing rules:

- Dotted IDs imply hierarchy.
- User definitions can add entries or override stock entries.
- `action` identifies an executable leaf.
- `target` identifies a link to another menu.
- `provider` identifies dynamic submenu contents.
- `when` controls visibility.
- `checked` represents current state.

Both files must be watched so menu changes appear without restarting the shell.

### Visibility

The 141 conditional stock entries make visibility part of the MVP, not an
optional enhancement.

Omalauncher evaluates `when` and `checked` expressions in one batched
subprocess, following Omarchy's current menu approach. It must not launch a
separate process for every row or every keystroke.

Visibility results are cached and refreshed when:

- The menu source changes
- The launcher opens
- A state-changing command has run and the launcher is opened again
- The explicit refresh IPC method is called

### Execution delegation

Omalauncher discovers, ranks, and navigates commands but continues to delegate
leaf execution to the stock menu route:

```text
omarchy menu summon <route-id>
```

Leaf execution flow:

1. Record the selection for ranking.
2. Close Omalauncher.
3. Send the selected route to the stock Omarchy menu.
4. Let Omarchy execute the action and retain any confirmation flow.

Menu navigation flow:

1. Static menus and links open inside Omalauncher.
2. The Apps provider reuses the application adapter inside Omalauncher.
3. Unsupported dynamic providers open their stock Omarchy submenu.
4. The Action Panel always exposes an explicit stock-menu fallback.

This avoids copying hundreds of shell action strings into Omalauncher and
allows upstream and user-defined commands to retain their existing behavior.

### Dynamic providers

The stock menu currently has native Apps and dynamic Font providers.

- Apps are indexed directly through the application provider.
- A dynamic submenu such as Font appears as a searchable command and opens the
  correct stock submenu because its generated leaves have no stable routes.
- Flattening arbitrary dynamic provider output is deferred until a stable
  provider contract exists.

## Application provider

On Omarchy 4, the application adapter uses `shell.appLibrary` for:

- Visible desktop entries
- Hidden-entry filtering
- Application icons
- Launch feedback
- Application launching

Because `shell.appLibrary` is not a documented third-party stability contract,
it sits behind an adapter with a fallback based on Quickshell
`DesktopEntries`.

Application records include:

- Desktop ID
- Name
- Generic name
- Comment
- Keywords
- Icon
- Launch action

## State

User state lives outside the plugin checkout so updates do not overwrite it:

```text
${XDG_STATE_HOME:-~/.local/state}/omalauncher/state.json
```

Current state schema (v1 and v2 migrate into this shape):

```json
{
  "version": 3,
  "favorites": [],
  "usage": {},
  "aliases": {},
  "hidden": [],
  "queryHistory": [],
  "preferences": {
    "compactMode": false,
    "calculatorEnabled": true,
    "fileSearchEnabled": false,
    "quickActivationEnabled": true,
    "fileSearchScopes": [],
    "fileSearchIgnores": []
  }
}
```

Usage entries track selection count and last-selected timestamp. Writes are
debounced and atomic.

## Plugin architecture

```text
SUPER + R
    |
    v
Omarchy shell IPC
    |
    v
Launcher.qml
    |
    +-- AppProvider + AppIndex
    +-- MenuIndex
    +-- CalculatorProvider + CalculatorModel
    +-- FileSearchProvider + FileSearchModel
    +-- SearchEngine
    +-- StateStore + StateModel
    +-- ActionModel + SettingsModel + navigation/layout helpers
    |
    v
Unified result model
    |
    +-- launch application
    +-- invoke Omarchy route
    +-- calculate or search configured file scopes
    +-- open Action Panel
```

Current repository structure:

```text
omalauncher/
├── PLAN.md
├── README.md
├── LICENSE
├── manifest.json
├── Launcher.qml
├── SearchEngine.js
├── providers/
│   ├── AppIndex.js
│   ├── AppProvider.qml
│   ├── CalculatorModel.js
│   ├── CalculatorProvider.qml
│   ├── FileSearchModel.js
│   ├── FileSearchProvider.qml
│   └── MenuIndex.js
├── services/
│   ├── ActionModel.js
│   ├── GenerationModel.js
│   ├── HighlightModel.js
│   ├── LayoutModel.js
│   ├── NavigationModel.js
│   ├── QuickActivationModel.js
│   ├── SettingsModel.js
│   ├── StateModel.js
│   ├── StateStore.qml
│   └── StatusModel.js
├── tests/
│   ├── fixtures/
│   └── *.test.js
├── scripts/
│   ├── index-spike.js
│   ├── package-smoke-test.sh
│   ├── performance-benchmark.js
│   └── release-check.sh
└── assets/preview.png
```

The v0.9.0 manifest declares:

```json
{
  "schemaVersion": 1,
  "id": "io.github.omalauncher",
  "name": "Omalauncher",
  "version": "0.9.0",
  "author": "Omalauncher contributors",
  "description": "A keyboard-first command palette for Omarchy.",
  "kinds": ["menu"],
  "keepLoaded": true,
  "entryPoints": {
    "menu": "Launcher.qml"
  }
}
```

## Delivery phases

### Phase 0: Contract spike

Status: Complete in `f42ff3d`.

Goal: prove that an independent menu plugin can open on `SUPER + R` without
affecting the stock launcher.

Deliverables:

- Minimal valid manifest
- Open and close lifecycle
- Focused input surface
- Active-monitor placement
- Temporary result list
- Hot reload and clean shell logs

Exit criteria:

- `SUPER + R` toggles Omalauncher.
- `SUPER + SPACE` still opens the stock menu.
- Escape and repeated toggles never strand keyboard focus.

### Phase 1: Command index

Status: Complete in `f42ff3d`.

Goal: solve submenu discovery before adding visual polish.

Deliverables:

- Default and user JSONC parsing
- Merged hierarchy
- Breadcrumb generation
- Batched visibility evaluation
- Searchable action and submenu records
- Route delegation
- Unit tests for normalization and hierarchy

Required query tests:

- `install docker`
- `remove firefox`
- `update hyprland`
- `style screensaver`
- `browser default`

### Phase 2: Unified launcher

Status: Complete in `a4f8bf7` and `8d0ec2f`.

Goal: search applications and Omarchy commands together.

Deliverables:

- Application adapter
- Unified result schema
- Ranking tiers
- Sections and empty state
- Icons and breadcrumbs
- Complete keyboard navigation

### Phase 3: Raycast-style actions and learning

Status: Complete in `f818800` and `ca72bc2`.

Goal: improve repeat use without making ranking unpredictable.

Deliverables:

- Minimal Action Panel
- Favorites
- Frecency tie-breaking
- Recent selections
- Reset-ranking action
- Persistent state

### Phase 4: Polish and packaging

Status: Complete in `7e3ce33`, with follow-up navigation and layout polish in
`e589993` and `1de314e`.

Goal: make the MVP safe to install, update, and remove.

Deliverables:

- Omarchy theme integration
- Multi-monitor and fractional-scale verification
- Empty, loading, and error states
- Manifest validation and QML linting
- README installation, binding, rollback, and troubleshooting instructions
- License attribution
- Preview image
- Clean-install and clean-removal tests

Estimated effort: four to six focused development days for a polished MVP.

All original MVP phases and the v0.9 expansion phases are complete. The
acceptance criteria below describe the maintained release contract.

## Acceptance criteria

### Current acceptance status

Discovery, core interaction, safety, compatibility, packaging, stale-response
handling, and performance budgets are covered by the automated release check,
focused regression tests, and benchmark scripts. Runtime instrumentation is
available through `performanceStats()` and `npm run benchmark:runtime`.

### Discovery

- All visible static Omarchy actions are indexed.
- User menu extensions appear after a source-file change.
- Breadcrumb terms are searchable.
- Duplicate titles remain distinguishable.
- Conditional entries match stock menu visibility.

### Interaction

- Search is focused immediately on open.
- Arrow navigation, Enter, Ctrl+K, and Escape behave consistently.
- Selection remains valid as results update.
- Pointer interaction does not steal selection before deliberate movement.
- The launcher appears on the focused monitor.

### Performance

- A warm open should become visible within 100 ms on the development machine.
- Search updates should complete within one 16 ms frame for the expected local
  index under normal conditions.
- No subprocess is started per result or per keystroke.
- Provider refreshes do not block typing or animation.

### Safety and compatibility

- The stock Omarchy launchers remain available.
- No packaged file under `/usr/share/omarchy` is modified.
- Disabling or removing Omalauncher does not affect the stock menu.
- A malformed user menu entry is skipped with an actionable log message.
- Commands remain owned by Omarchy rather than duplicated in the plugin.
- Plugin code never requests elevated privileges.

### Validation

```bash
npm run validate
npm run spike
```

`npm run validate` runs the 87 Node tests, manifest validation, QML linting,
the packaging smoke test, and whitespace validation.

Shell verification should also inspect:

```bash
qs log -p "$OMARCHY_PATH/shell" -t 100
```

## Explicit non-goals for the MVP

- Replacing `SUPER + SPACE`
- Replacing the stock menu bar widget
- Full file or file-content indexing
- Clipboard history search
- Window switching
- Currency conversion with implicit network updates
- Quicklink editor
- Script-command authoring UI
- Third-party provider SDK or marketplace
- AI chat or agent integrations
- Cloud synchronization

These remain candidates after the command-discovery loop is demonstrably fast
and useful.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Omarchy internal APIs change | Isolate `shell.appLibrary` behind an adapter and set a minimum tested Omarchy version. |
| Conditional commands become stale | Batch evaluation on source changes and launcher open; add generation-based stale-response rejection during hardening. |
| Opaque frecency produces surprising results | Apply frecency only within an existing semantic tier and provide Reset Ranking. |
| Dynamic providers cannot be flattened safely | Index the provider submenu and delegate to the stock menu for the MVP. |
| Large QML work blocks the shared shell | Keep subprocess work asynchronous and rendered search results limited; verify the frame budget with benchmarks. |
| A plugin failure affects the shared shell process | Keep the stock launcher bindings untouched and test malformed-source behavior. |
| User actions contain shell commands | Treat menu sources as trusted Omarchy/user configuration and delegate execution to stock routes. |

## Post-v0.9 opportunity order

1. Quicklinks and URL detection
2. Script-command folders with explicit metadata
3. Clipboard and window providers using existing Omarchy/Quickshell services
4. A documented provider contract for third-party Omalauncher extensions

User-managed aliases shipped in v0.8. Performance hardening, Settings, numbered
quick-result activation, optional calculator results, and scoped file search
shipped in v0.9. Global per-command hotkeys remain blocked on a managed
Omarchy/Hyprland registration contract; `Ctrl+1` through `Ctrl+8` remain local
to the open launcher and do not have that dependency.

## Research references

- [Raycast Search Bar](https://manual.raycast.com/search-bar)
- [Raycast Action Panel](https://manual.raycast.com/action-panel)
- [Raycast Command Aliases and Hotkeys](https://manual.raycast.com/command-aliases-and-hotkeys)
- [Raycast Extensions](https://manual.raycast.com/extensions)
- [Raycast Quicklinks](https://manual.raycast.com/quicklinks)
- [Raycast Calculator](https://manual.raycast.com/calculator)
- [Raycast File Search](https://manual.raycast.com/file-search)
- [Raycast Script Commands](https://manual.raycast.com/script-commands)
- [Omarchy shell plugin documentation](https://omarchy.org/manual/shell-plugins/)
- [Omarchy plugin development guide](https://omarchyplugins.com/develop.html)
