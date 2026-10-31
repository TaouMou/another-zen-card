# Another Zen Card

A solid, glass-free theme for Zen Browser, installed through the Sine mod manager. Repo: `TaouMou/another-zen-card`. Built against Zen 1.24b (Oct 2026).

## Files

- `chrome.css`: the whole theme (palettes, card, site-colored strip, address bar, tab styles, fonts)
- `card-tint.uc.js`: chrome script that samples the top edge of the page to color the toolbar strip, makes the address bar show only the domain, cross-fades the Library, and moves the window buttons into the sidebar's top row in the sidebar-only layout (Zen otherwise puts them in a strip above the page, `#zen-appcontent-navbar-container`, and re-appends them there on every layout rebuild)
- `preferences.json`: the settings Sine shows
- `theme.json`: Sine's manifest

## How Sine treats this mod

- Mod CSS is loaded as a **user sheet**. Zen's own rules are author rules, so every override of Zen needs `!important`; a normal declaration loses even to a less specific Zen rule.
- **Dropdown** settings appear as attributes on `.sine-theme-strings` (`mod.zencard.palette` → `[mod-zencard-palette="warm"]`); match them with `:root:has(.sine-theme-strings[...])`. **String** settings become `--mod-zencard-*` variables on `:root`. **Checkboxes** are read with `@media -moz-pref("...")`.
- Text prefs can also be compared in CSS with `-moz-pref("name", "value")` (allowed in Sine's sheets because user-origin sheets get chrome rules). `content.css` relies on this, since Sine's attributes and variables don't reach content pages. Light/dark uses one media query in both files: `mod.zencard.mode`, else Zen's `zen.view.window.scheme` (0 dark, 1 light, 2 auto with `-moz-system-dark-theme`).
- Write CSS so the state before Sine has saved any pref is the intended default (checkbox names are phrased so "off" is the default; dropdown defaults are the selectors' fallback).
- Scripts only run for mods outside Sine's store when `sine.allow-unsafe-js` is on. The CSS must still look right without the script.
- Sine updates a mod only when `updatedAt` in `theme.json` is newer than the installed copy. **On every push, set `updatedAt` to the current UTC time as a full ISO timestamp** and bump `version`.

## Zen structure the theme relies on

- Window: `#zen-main-app-wrapper`, `.zen-browser-generic-background` (`#zen-browser-background`, `#zen-toolbar-background`), Zen sets `--zen-main-browser-background*` inline on those.
- Top toolbar layout: `#zen-appcontent-wrapper` > `#zen-appcontent-navbar-wrapper` (> `#zen-appcontent-navbar-container` > `#nav-bar`) and `#zen-tabbox-wrapper` > `#tabbrowser-tabbox` > `#tabbrowser-tabpanels` > `.browserSidebarContainer`.
- Root attributes: `zen-single-toolbar`, `zen-compact-mode`, `zen-right-side`, `zen-private-window`, `inDOMFullscreen`, `popup-window`.
- Selected tab colors come from variables on `zen-workspace`; tabs are `.tabbrowser-tab > .tab-stack > .tab-background`; unloaded tabs have `[pending="true"]`.
- Address bar: `#urlbar` with `.urlbar-background` (a class, not an id), `[breakout-extend]` while open, `[focused="true"]`; the site-data button is `#zen-site-data-icon-button`. Zen trims the shown URL through `gURLBar._zenTrimURL`.
- Page pixels: `browser.drawSnapshot(0, 0, 0, 0, scale, "transparent", true)` captures the visible viewport (returns `false` on failure).

Zen's source (`zen-browser/desktop`) is the reference: check selectors there before relying on them.

## Pitfalls already hit

- The card rule's selector outranked the site-tint rule; the tint selector repeats every condition of the card rule so it wins.
- Firefox paints `#nav-bar` with `--toolbar-bgcolor`, which covered the strip; it is made transparent while tinted.
- Variables like `--toolbar-field-color` resolve on `:root`, so they must be redeclared on the strip to follow the site text color.
- With `layout.css.corner-shape.enabled`, Zen gives every element squircle corners; anything along a card edge needs `corner-shape: round`, and children inside a 1px border need `radius - 1px`.
- Firefox's own styles aren't in Zen's repo. The installed build is the reference: `C:\Program Files\Zen Browser\browser\omni.ja` is a zip (Windows theme at `chrome/browser/skin/classic/browser/browser.css`, Zen's at `chrome/browser/content/browser/zen-styles/`). Example: window buttons draw their glyph as a font character in `::before`, not as an icon.
- In the sidebar-only layout, hovering the strip above the page sets `[has-toolbar-hovered]` on `#tabbrowser-tabpanels`, and Zen pulls `.browserContainer` up with a negative `margin-top` (only with `zen.view.hide-window-controls`).
- Extension popups anchor to the anchor of CustomizableUI's addons area, which Zen's build registers as `zen-site-data-icon-button` (the address bar's site button), not to the `addon-webext-overflowbutton` attribute (that one is only for extensions overflowing the toolbar). `card-tint.uc.js` re-registers the area with `unified-extensions-button` when `zen.theme.hide-unified-extensions-button` is off.
- Firefox's `moz-*` components (moz-select, moz-button, moz-toggle...) redeclare the design tokens on `:host`, so tokens set only on `:root` never reach them. The Components blocks set the tokens on the components themselves (every element in `content.css`).
- `#zen-sidebar-splitter` is absolutely positioned and takes no space; the gap between sidebar and page comes from margins.
- Moving this folder with the app dropped the `.git` folders; reconnect with `git init`, `git remote add`, `git fetch` and `git reset origin/main` (keeps files).

## Working with the user

- Commit locally and **push only when the user says so**; they batch several changes into one Sine update.
- Show mockups before building anything visual.
- Private windows keep Zen's own look.
- The user wants **one unified set of components across Zen** (buttons, fields, dropdowns, checkboxes, toggles, boxes, dialogs, menus, panels), not per-screen fixes. Extend the "Components" sections (Firefox design tokens such as `--button-*`, `--input-*`, `--select-*`, `--checkbox-*`, `--toggle-*`, `--box-*`, `--card-*`) in both `chrome.css` and `content.css` first, and only add element rules for what ignores the tokens. Corners are plain round everywhere (`corner-shape: round`).
- Related mod: `TaouMou/another-zen-load-bar` (loading bar; its default color follows `--zen-primary-color`, which this theme sets to the accent).
