# Omalauncher Product Plan

Status: MVP shipped (v0.7.1); v0.8 interaction completion in progress
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
- [ ] 9. Add compact mode, explicit accessibility metadata, final documentation,
  and full release validation.

### Deferred beyond v0.8

- Global per-command hotkey recording, pending a managed Omarchy/Hyprland
  registration contract.
- Generic Quick Look, pending preview metadata and file-like providers.
- Query-specific learned ranking, pending evidence that deterministic tiers are
  producing recurring ranking mistakes.
- Custom navigation-binding presets or an editor.
- A general third-party Action Panel custom-view SDK.

## Product thesis

Omalauncher is a keyboard-first command launcher for Omarchy. Its first job is
to make every installed application and every Omarchy command discoverable from
one search field, including commands currently buried several submenu levels
deep.

The MVP is inspired by Raycast's Root Search and Action Panel interaction
models, but it is not intended to reproduce Raycast's complete feature set.

## Current release

Version 0.7.1 is installed on the development machine and published to the
private `mirashif/omalauncher` GitHub repository. The current live index
contains 45 installed applications and 244 conditionally visible Omarchy
records. The release check currently passes 38 automated tests, manifest
validation, QML linting, and an isolated install/remove cycle.

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

Initial state schema:

```json
{
  "version": 1,
  "favorites": [],
  "usage": {}
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
    +-- SearchEngine
    +-- StateStore + StateModel
    +-- ActionModel + StatusModel + LayoutModel
    |
    v
Unified result model
    |
    +-- launch application
    +-- invoke Omarchy route
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
│   └── MenuIndex.js
├── services/
│   ├── ActionModel.js
│   ├── LayoutModel.js
│   ├── StateModel.js
│   ├── StateStore.qml
│   └── StatusModel.js
├── tests/
│   ├── fixtures/
│   └── *.test.js
├── scripts/
│   ├── index-spike.js
│   ├── package-smoke-test.sh
│   └── release-check.sh
└── assets/preview.png
```

The v0.7.1 manifest declares:

```json
{
  "schemaVersion": 1,
  "id": "io.github.omalauncher",
  "name": "Omalauncher",
  "version": "0.7.1",
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

All five delivery phases are complete. The remaining work below concerns
measuring or hardening acceptance properties rather than missing MVP features.

## Acceptance criteria

### Current acceptance status

Discovery, core interaction, safety, compatibility, and packaging are covered
by the installed build and automated release check. The following items still
need explicit proof or hardening:

- Benchmark warm-open latency against the 100 ms budget.
- Benchmark worst-case search updates against the 16 ms budget.
- Add a generation identifier so a completed guard subprocess cannot briefly
  apply results from a superseded menu revision before the queued refresh runs.
- Add a focused regression test for pointer movement and selection ownership.
- Add instrumentation or caching if benchmarks show unnecessary result-model
  rebuilds are material.

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

`npm run validate` runs the 38 Node tests, manifest validation, QML linting,
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
- Calculator or natural-language conversions
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

## Post-MVP opportunity order

1. User-managed aliases and direct command hotkeys
2. Quicklinks and URL detection
3. Calculator through an existing local calculator backend
4. Script-command folders with explicit metadata
5. Clipboard and window providers using existing Omarchy/Quickshell services
6. File-name search with explicit scopes and ignore rules
7. A documented provider contract for third-party Omalauncher extensions

File search should not begin until ranking, index freshness, ignore behavior,
and performance budgets are defined; public Raycast feedback shows that file
search quality can easily weaken trust in the entire root-search experience.

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
