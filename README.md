# Omalauncher

Omalauncher is a keyboard-first command palette for Omarchy 4. It flattens the
stock JSONC menu into a searchable command index while keeping each command's
ancestor path as context.

This repository currently contains the command-index spike:

- Stock and user menu JSONC parsing with hot reload
- Per-field user overrides
- Breadcrumb-aware command records
- One batched `when`/`checked` visibility process
- Deterministic semantic ranking
- A minimal focused Quickshell menu surface
- Delegated execution through `omarchy menu summon <route>`

Applications, favorites, history, and the Action Panel remain planned MVP work.

## Validate the spike

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
cp -a ./. ~/.config/omarchy/plugins/io.github.omalauncher/
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
