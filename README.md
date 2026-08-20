# Omalauncher

Omalauncher is a keyboard-first command palette for Omarchy 4. It searches
installed applications and flattens the stock JSONC menu into a unified index,
while keeping each command's ancestor path as context.

The current implementation includes:

- Installed applications from Omarchy's shared application library
- A `DesktopEntries` fallback isolated behind the application adapter
- Application names, generic names, comments, keywords, categories, and IDs
- Stock and user menu JSONC parsing with hot reload
- Per-field user overrides
- Breadcrumb-aware command records
- One batched `when`/`checked` visibility process
- Deterministic semantic ranking
- Persistent favorites and usage history
- Frecency as a tie-breaker within equal semantic matches
- Favorites and recent applications/commands before typing
- A minimal focused Quickshell menu surface
- Native application icons and launch feedback
- Delegated execution through `omarchy menu summon <route>`

The Action Panel remains planned MVP work.

Press `Ctrl+F` on the selected row to add or remove a favorite. Selecting a
result updates its usage history; stronger semantic matches always remain
ahead of frecency. State is written atomically to:

```text
${XDG_STATE_HOME:-~/.local/state}/omalauncher/state.json
```

## Validate

```bash
npm test
omarchy plugin validate .
npm run spike
```

Use `npm run spike -- --all` to inspect static discovery without applying
`when` visibility. This is useful for proving paths for software that is not
currently installed.

## Local installation

Third-party Omarchy plugins live at:

```text
~/.config/omarchy/plugins/io.github.omalauncher/
```

Copy this checkout there, rescan the shell plugins, and enable it:

```bash
mkdir -p ~/.config/omarchy/plugins/io.github.omalauncher
rsync -a --exclude=.git --exclude=node_modules \
  ./ ~/.config/omarchy/plugins/io.github.omalauncher/
omarchy-shell shell rescanPlugins
omarchy plugin enable io.github.omalauncher
```

Then add this user binding to `~/.config/hypr/bindings.lua`:

```lua
o.bind(
  "SUPER + R",
  "Omalauncher",
  "omarchy-shell shell toggle io.github.omalauncher '{}'"
)
```

`SUPER + SPACE` and `SUPER + ALT + SPACE` remain owned by the stock Omarchy
menu. After changing the binding, validate Hyprland with:

```bash
hyprctl reload
hyprctl configerrors
```

## Remove

Remove the `SUPER + R` stanza, then run:

```bash
omarchy plugin disable io.github.omalauncher
omarchy plugin remove io.github.omalauncher
```

No packaged file below `/usr/share/omarchy` is modified.
