# Omalauncher Product Plan

Status: v0.10.0 implemented and validated locally

Last updated: 2026-08-21

Target: Omarchy 4 / Quattro with Quickshell 0.3

## Product direction

Omalauncher is a keyboard-first command palette for Omarchy. It combines
installed applications, the nested Omarchy command menu, live summonable shell
features, and the CLI catalog in one searchable surface while preserving each
source's execution and confirmation contracts.

The product should remain:

1. Fast enough to feel instantaneous.
2. Predictable before personalized ranking is applied.
3. Keyboard-first without weakening pointer or accessibility behavior.
4. Safe around commands, expressions, paths, and plugin updates.
5. Additive: the stock Omarchy launchers remain available as fallbacks.

## Current release: v0.10.0

### First-run access

- Theme-native two-step welcome setup inspired by Raycast's focused first-run
  flow: choose a launcher shortcut, then close and verify it from the desktop.
- Secure shortcut capture through Wayland keyboard-shortcut inhibition so an
  existing global binding does not fire while a new chord is recorded.
- Conflict inspection, explicit replacement, atomic backup, Hyprland reload,
  config-error validation, rollback, and concurrent-edit protection.
- Recommended atomic shortcut swap: Omalauncher takes `SUPER + SPACE` while
  Omarchy Menu moves to the validated `SUPER + R` fallback.
- Right-side Omarchy bar widget with left-click launcher access and right-click
  Settings.
- Version 1 state schema with first-run setup and a one-time post-setup
  coaching result.
- Settings entries to change or remove a managed launcher shortcut and rerun
  welcome setup.

### Search and navigation

- Unified discovery for installed desktop applications and visible static
  Omarchy commands, menus, and links.
- Breadcrumb-aware matching for nested commands and duplicate titles.
- Deterministic semantic tiers with frecency only as a tie-breaker.
- Favorites, recents, aliases, hidden-result recovery, and wrapping result
  navigation.
- Native route navigation for static menus and applications.
- `Ctrl+1` through `Ctrl+9`, plus `Ctrl+0` for result 10, including off-screen results.
- Compact Mode, section jumps, pop-to-root, and immediate-close shortcuts.

### Actions and settings

- Searchable Action Panel with shallow submenus and a stock-menu fallback.
- Favorite reordering, alias editing, hide/unhide, and ranking reset actions.
- In-launcher Settings for launcher behavior and provider configuration.
- Versioned state with independent preferences and onboarding state.
- Confirmed resets for provider settings and personalization.

### Providers

- Live discovery of enabled shell panels, overlays, menus, and panel-capable bar
  widgets through Omarchy's plugin registry and summon API.
- Asynchronous discovery of the complete `omarchy commands --json` catalog,
  with command-directory watching, last-valid fallback, and stale refresh.
- Source-aware deduplication across static menu actions, shell features, and
  canonical CLI routes.
- Optional asynchronous calculator backed by `qalc`, with explicit `=` queries,
  safe argument passing, Copy Result, and Copy Expression.
- Opt-in file-name search backed by `fd`, limited to canonical user-approved
  scopes with ignore patterns, result caps, timeouts, and symlink containment.
- File actions for Open, Reveal in File Manager, and Copy Path.
- Provider-specific loading, unavailable, empty, and error states.

### Reliability and presentation

- Generation-based rejection of stale asynchronous output.
- Debounced subprocess work and cancellation of superseded requests.
- Cached normalized search fields and coalesced result-model rebuilds.
- Interactive provider diagnostics and retry.
- Theme-native UI, high-contrast shortcut badges, focused-monitor placement,
  and explicit Qt accessibility metadata.
- Instrumented warm-open and search-update timings.

## Maintained boundaries

- Static menu commands are delegated to `omarchy menu summon <route>`; shell
  features use `shell.summon`. Neither path is reported as confirmed success.
- Only reviewed context-free, non-privileged CLI routes execute directly.
  Argument-taking, privileged, and unknown routes open `--help` in a terminal.
- CLI catalog and shell registry changes refresh without restarting the
  launcher; invalid refreshes preserve the last valid index.
- Calculator expressions, file queries, and paths are passed as literal process
  arguments. They are never evaluated through a shell.
- File search is disabled and unconfigured by default. It never scans `/`, all
  of `$HOME`, file contents, or every root-search keystroke implicitly.
- Calculator and file results remain ephemeral and outside learned ranking.
- Omalauncher edits only its marked Hyprland hotkey block, using backup,
  reload, validation, rollback, and race protection. Other configuration is
  preserved byte-for-byte.
- No file below `/usr/share/omarchy` is modified.
- Launcher and per-application hotkeys share one owned block so a chord cannot
  be claimed by both. Numbered activation remains launcher-local.

## Quality contract

The release check currently covers 135 Node tests, manifest validation, QML
linting, a clean install/remove smoke test, and whitespace validation.

```bash
npm run validate
npm run benchmark
npm run benchmark:runtime
```

Performance budgets on the development system:

- Warm open: at most 100 ms.
- Local root-search update: at most 16 ms.

User state is stored outside the plugin checkout at:

```text
${XDG_STATE_HOME:-~/.local/state}/omalauncher/state.json
```

Releases must preserve existing state, keep the stock launcher usable, avoid
elevated privileges in plugin code, and leave the installed plugin and shell
logs healthy after an update.

## Remaining roadmap

| Priority | Candidate | Viability | Required proof before implementation |
| --- | --- | --- | --- |
| 1 | Quicklinks and URL detection | High | Define explicit detection, escaping, browser handoff, and false-positive tests. |
| 2 | Script-command folders | Medium-high | Define trusted metadata, argument handling, refresh behavior, and failure reporting. |
| 3 | Context-aware command arguments | Medium | Define typed prompts and confirmation boundaries without evaluating shell text. |
| 4 | General third-party result contract | Medium | Stabilize result IDs, actions, async cancellation, diagnostics, and compatibility rules first. |

Deferred without a platform contract or stronger user evidence:

- Global per-command hotkey registration.
- Generic Quick Look or arbitrary file previews.
- File-content or whole-disk indexing.
- Currency conversion with implicit network updates.
- AI chat, cloud sync, or a provider marketplace.

## Delivery rules

For each accepted roadmap item:

1. Record the user problem, viability decision, and explicit boundary here.
2. Add pure model tests before or with UI/provider integration.
3. Keep untrusted input out of shell-built commands.
4. Debounce, cancel, cap, and generation-guard asynchronous work.
5. Validate failure, missing-backend, stale-output, and accessibility states.
6. Run the complete release and performance checks.
7. Commit the feature independently, update the installed plugin, and verify
   live IPC, state, performance, and shell logs.

## Completed milestones

| Milestone | Commit |
| --- | --- |
| v0.8 interaction release | `579bf70` |
| v0.9 roadmap | `c9d9c9a` |
| Async hardening and performance instrumentation | `279dff0` |
| Settings and state v3 | `037a8a2` |
| Numbered result activation | `3b8e2f6` |
| Optional calculator provider | `7a91a86` |
| Scoped file search | `0504c07` |
| v0.9.0 release checkpoint | `3858438` |
| Live initialization and persisted migration fixes | `eb0fdc1` |
| Root-search caching and normalized search fields | `26b3ab1`, `24d448d` |
| Provider rebuild coalescing | `dcbbf43` |
| Shortcut badge contrast | `eecb765` |
