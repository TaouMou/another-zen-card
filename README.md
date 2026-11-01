# Another Zen Card

A solid, glass-free theme for [Zen Browser](https://zen-browser.app).

- **Fixed palettes** instead of the workspace gradient: no transparency, blur, grain or gradients
- **One card**: the top toolbar and the page share one outlined card
- **Panel sidebar**: the sidebar is its own outlined card beside the page, with a quiet space label, a segmented space switcher and plain line icons in the footer
- **Site-colored toolbar**: the toolbar takes the color of the top of the page, so it flows into the site's header (a small script; can be turned off)
- **Centered address bar**: just the domain in the middle of the toolbar, with no box until you hover or type (the domain-only part uses the script). A boxed version and Zen's full-width bar are also available
- **Window buttons in the sidebar**: minimize, maximize and close become three small dots at the start of the sidebar's top row, or stacked at the top of a collapsed sidebar (Windows and Linux, sidebar on the left; uses the script)
- **Customize Toolbar in your layout**: in the sidebar-only layout, Customize shows the toolbar where Zen puts it, in the sidebar; with the sidebar collapsed, the sidebar stays narrow (the script)
- **Compact mode**: whatever Zen hides (the sidebar, the toolbar or both) comes back as a floating card lined up with the page card, fading in with a short slide; a faint mark at the window's edge shows where the hidden sidebar is, and the address bar no longer takes focus at startup (the script)
- **Six active tab styles**: soft fill with a thin border, outline, accent tint, inverted, text only, accent dot
- **Ghost tabs**: tabs that aren't loaded yet are faded and grey
- Optional serif or mono interface font
- **Settings pages** (about:preferences, about:addons, about:config...) use the same palette. The Custom palette falls back to Warm graphite there

Private windows keep Zen's own look.

## Palettes

Each palette has a dark and a light version. By default the theme follows Zen's light/dark setting (the sun, moon and auto buttons in Zen's theme panel); the **Mode** setting can force dark or light instead.

| Palette | Dark | Light |
|---|---|---|
| Warm graphite (default) | `#1f1e1d` / `#e8e6dc`, accent `#d97757` | `#efede6` / `#1f1e1d`, accent `#c96442` |
| Neutral ink | `#141414` / `#e6e6e6`, accent `#6aa6ff` | `#ececec` / `#1a1a1a`, accent `#2f6fdb` |
| Cool slate | `#14171b` / `#e3e7ec`, accent `#5fd4a4` | `#e7ebef` / `#15181c`, accent `#168a5e` |
| Custom | your own hex codes, with its own light switch | |

## Install

1. Install [Sine](https://github.com/CosmoCreeper/Sine).
2. The site-colored toolbar is a script, and Sine only runs scripts from mods outside its store when you allow it: open Sine's settings and turn on **installing JS from unofficial sources**. Without it the theme still works; the toolbar just keeps the theme color.
3. In Sine's install box, enter `TaouMou/another-zen-card` and click **Install**, then restart Zen.
4. For the full card look, switch Zen to the **Sidebar and top toolbar** layout (or set `zen.view.use-single-toolbar` to `false` in `about:config`). In the sidebar-only layout, the page alone becomes the card and there's no toolbar to color.

The theme replaces the colors from Zen's theme picker, so changes made there won't show while it's on.

## Settings

| Setting | Default |
|---|---|
| Palette | Warm graphite |
| Mode | Follow Zen's light/dark setting |
| Custom background, text and accent colors | Warm graphite's colors |
| Custom palette is light (Custom ignores Mode) | Off |
| Active tab style | Soft fill |
| Address bar style | Centered, no background (domain only) |
| Keep the toolbar in the theme color instead of the site's color | Off |
| Interface font | System |
| Don't fade tabs that aren't loaded yet | Off |

For a separate Extensions button in the toolbar (instead of extensions inside the address bar's site panel), set `zen.theme.hide-unified-extensions-button` to `false` in `about:config` and restart Zen. The theme styles both panels.

## Works well with

- [Another Zen Load Bar](https://github.com/TaouMou/another-zen-load-bar): turn off its custom color to follow this theme's accent.
- [Zen Folder Tree Connectors](https://github.com/JustAdumbPrsn/ZenFolderTreeConnectors): tree lines in folders.

The site-colored toolbar is inspired by [Zia](https://github.com/z1n-k/zia) and [Zen Page Tint](https://github.com/caezium/zen-page-tint).

## License

MIT
