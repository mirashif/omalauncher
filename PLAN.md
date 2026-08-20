# Omalauncher MVP Plan

Status: MVP complete (v0.7.1)
Last updated: 2026-08-20
Target platform: Omarchy 4 / Quattro

## Product thesis

Omalauncher is a keyboard-first command launcher for Omarchy. Its first job is
to make every installed application and every Omarchy command discoverable from
one search field, including commands currently buried several submenu levels
deep.

The MVP is inspired by Raycast's Root Search and Action Panel interaction
models, but it is not intended to reproduce Raycast's complete feature set.

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

| Query | Current behavior | Required Omalauncher behavior |
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

Omalauncher will use `SUPER + R`, which was unbound on the development machine
when this plan was created.

The existing bindings remain unchanged:

- `SUPER + SPACE`: stock Omarchy menu
- `SUPER + ALT + SPACE`: stock Omarchy Apps menu

The eventual user override will have this shape:

```lua
o.bind(
  "SUPER + R",
  "Omalauncher",
  "omarchy-shell shell toggle io.github.yourname.omalauncher '{}'"
)
```

The exact permanent plugin ID will be chosen before publishing.

## MVP experience

### Opening

- `SUPER + R` toggles Omalauncher.
- The search field receives focus immediately.
- The surface opens on the currently focused monitor.
- With an empty query, it shows favorites and recent selections.
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
| Ctrl + Enter | Run the secondary action |
| Ctrl + K | Open or close the Action Panel |
| Escape | Close Action Panel, then clear query, then close launcher |
| Page Up / Page Down | Move by one result page |

### Action Panel

The MVP Action Panel contains only:

- Open or run
- Open the command's parent in the stock Omarchy menu
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

Omalauncher will evaluate `when` and `checked` expressions in one batched
subprocess, following Omarchy's current menu approach. It must not launch a
separate process for every row or every keystroke.

Visibility results are cached and refreshed when:

- The menu source changes
- The launcher is opened after a reasonable stale interval
- A command that may change system state completes
- The user explicitly requests refresh later

### Execution delegation

Omalauncher discovers and ranks commands but delegates execution to the stock
menu route:

```text
omarchy menu summon <route-id>
```

Execution flow:

1. Record the selection for ranking.
2. Close Omalauncher.
3. Send the selected route to the stock Omarchy menu.
4. Let Omarchy execute the action or open the target submenu.

This avoids copying hundreds of shell action strings into Omalauncher and
allows upstream and user-defined commands to retain their existing behavior.

### Dynamic providers

The stock menu currently has native Apps and dynamic Font providers.

- Apps are indexed directly through the application provider.
- A dynamic submenu such as Font appears as a searchable command that opens the
  correct stock submenu.
- Flattening arbitrary dynamic provider output is deferred until a stable
  provider contract exists.

## Application provider

For Omarchy 4, the first implementation may use `shell.appLibrary` for:

- Visible desktop entries
- Hidden-entry filtering
- Application icons
- Launch feedback
- Application launching

Because `shell.appLibrary` is not a documented third-party stability contract,
it must sit behind an adapter with a fallback based on Quickshell
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

User state should live outside the plugin checkout so updates do not overwrite
it:

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

Usage entries track selection count, last-selected timestamp, and optionally
query-specific selections. Writes should be debounced and atomic.

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
    +-- AppProvider
    +-- OmarchyCommandProvider
    +-- SearchEngine
    +-- StateStore
    |
    v
Unified result model
    |
    +-- launch application
    +-- invoke Omarchy route
    +-- open Action Panel
```

Proposed repository structure:

```text
omalauncher/
├── PLAN.md
├── README.md
├── LICENSE
├── manifest.json
├── Launcher.qml
├── SearchEngine.js
├── components/
│   ├── ActionPanel.qml
│   ├── ResultList.qml
│   ├── ResultRow.qml
│   └── SearchField.qml
├── providers/
│   ├── AppProvider.qml
│   ├── MenuIndex.js
│   └── OmarchyCommandProvider.qml
├── services/
│   └── StateStore.qml
├── tests/
│   ├── fixtures/
│   ├── menu-index.test.js
│   └── search-engine.test.js
└── preview.png
```

The MVP manifest is expected to declare:

```json
{
  "schemaVersion": 1,
  "id": "io.github.yourname.omalauncher",
  "name": "Omalauncher",
  "version": "0.1.0",
  "author": "Your Name",
  "description": "A keyboard-first command launcher for Omarchy.",
  "kinds": ["menu"],
  "keepLoaded": true,
  "entryPoints": {
    "menu": "Launcher.qml"
  }
}
```

## Delivery phases

### Phase 0: Contract spike

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

Goal: search applications and Omarchy commands together.

Deliverables:

- Application adapter
- Unified result schema
- Ranking tiers
- Sections and empty state
- Icons and breadcrumbs
- Complete keyboard navigation

### Phase 3: Raycast-style actions and learning

Goal: improve repeat use without making ranking unpredictable.

Deliverables:

- Minimal Action Panel
- Favorites
- Frecency tie-breaking
- Recent selections
- Reset-ranking action
- Persistent state

### Phase 4: Polish and packaging

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

## Acceptance criteria

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
omarchy plugin validate ./omalauncher

qmllint -I "$OMARCHY_PATH/shell" \
  Launcher.qml components/*.qml providers/*.qml services/*.qml
```

Shell verification should also inspect:

```bash
qs log -p "$OMARCHY_PATH/shell" --tail 100
```

## Explicit non-goals for v0.1

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
| Conditional commands become stale | Batch evaluation, cache briefly, and refresh after state-changing actions. |
| Opaque frecency produces surprising results | Apply frecency only within an existing semantic tier and provide Reset Ranking. |
| Dynamic providers cannot be flattened safely | Index the provider submenu and delegate to the stock menu for v0.1. |
| Large QML work blocks the shared shell | Keep indexing incremental, subprocess work asynchronous, and render only limited results. |
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
