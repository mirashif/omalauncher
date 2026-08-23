# Raycast footer: left-side item

Research date: 2026-08-23

## Answer

In current Raycast v2 Root Search, the item at the far left of the footer is an **About Menu button**. In production it is intentionally label-less and uses Raycast's `menu` glyph; its tooltip says `About Menu`. Clicking it, or pressing `Cmd+Shift+K` on macOS / `Ctrl+Shift+K` on Windows, toggles Raycast's app-level About Menu. It is not a second action for the selected search result.

This was verified in Raycast 2.0.5.0's shipped frontend bundle, obtained through Raycast's [official download endpoint](https://www.raycast.com/download). Raycast's current macOS imagery shows the same circular menu control in Root Search in [The New Raycast](https://www.raycast.com/blog/the-new-raycast). The bundle also shows that non-production builds can place their environment name beside the glyph, while production does not.

## Confirmed current menu contents

The current v2 bundle builds a menu headed `Raycast v<version>` with these entries:

- General
  - Send Feedback
  - Manual
  - Changelog
  - About Raycast
  - Settings (`Cmd+,` on macOS / `Ctrl+,` on Windows)
- Community
  - Subscribe for Updates
  - Join our Community
  - Follow us on X
  - Subscribe to our Channel
  - Follow us on Instagram
  - Other Socials…
    - Threads
    - Mastodon
    - Bluesky
    - Reddit
- Other
  - Quit Raycast

Internal builds additionally expose `Toggle WebView Inspection`; the bundle marks that item internal-only.

The current bundle assigns `Cmd+Shift+K` / `Ctrl+Shift+K` to toggle this About Menu, although Raycast's public [shortcut reference](https://manual.raycast.com/keyboard-shortcuts) does not currently list it. Individual destinations can also have shortcuts: Settings is `Cmd+,` / `Ctrl+,`.

## Why older screenshots look different

Raycast treats the left footer as a contextual slot, not a permanently fixed label:

- **Root Search, Raycast v2:** menu glyph/button, as described above.
- **Root Search, Raycast v1:** the same entry point used the Raycast logo. Raycast's v1.39 changelog explicitly says it added a navigation menu "when clicking on Raycast logo in Root Search." See the [official v1.39 changelog](https://www.raycast.com/changelog/1-39-0).
- **Inside a command or extension view:** it shows that view's icon and navigation title. Clicking it or using `Cmd+Shift+K` / `Ctrl+Shift+K` opens an About Menu for that command/extension. For a third-party extension, the current menu can conditionally include View README, View Source Code, Configure Command, Configure Extension, Report Bug, and Request Feature. Built-in commands typically expose configuration and feedback actions. Raycast's developer guidance says the root command title is supplied automatically, while nested screens may set a custom `navigationTitle`. See [Prepare an Extension for Store — Navigation Title](https://developers.raycast.com/basics/prepare-an-extension-for-store#navigation-title) and the [List API](https://developers.raycast.com/api-reference/user-interface/list).
- **While reporting feedback:** a toast temporarily occupies the left side. Raycast describes the left part as showing "the navigation title of the active command and any toast" in its [official action-bar design article](https://www.raycast.com/blog/a-fresh-look-and-feel). In the current bundle, an expandable toast uses `Cmd+T` on macOS / `Ctrl+T` on Windows and can also be clicked; that shortcut appears only when the toast has expandable content/actions.

Raycast's own summary describes the bar as consolidating primary/secondary actions, navigation context, and toasts, rather than being only a shortcut legend. See the [Launch Week summary](https://www.raycast.com/blog/launch-week-summary).

The interaction predates v2: Raycast v1.46 explicitly added links such as command preferences and extension README when clicking the command name in the bottom-left corner. See the [official v1.46 changelog](https://www.raycast.com/changelog/1-46-0). Raycast for Windows later added the same extension About actions model; see the [official Windows v0.41 changelog](https://www.raycast.com/changelog/windows/0-41).

## Implication for Omalauncher

The closest Raycast-equivalent behavior would be a left-side launcher/About Menu in the root view, then reuse that space for the active feature's identity and feature-level settings/help links, or for transient status feedback. Copying only the circular icon without its menu would reproduce the appearance but miss its purpose.

The exact menu contents above are verified from the current v2 Windows package. The current macOS v2 official imagery confirms the same control visually; the macOS package internals were not used to independently re-enumerate every menu entry.
