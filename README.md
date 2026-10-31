# Another Zen Card

A solid, glass-free theme for [Zen Browser](https://zen-browser.app).

- **Fixed palettes** instead of the workspace gradient: no transparency, blur, grain or gradients
- **One card**: the top toolbar and the page share one outlined card
- **Site-colored toolbar**: the toolbar takes the color of the top of the page, so it flows into the site's header (a small script; can be turned off)
- **Six active tab styles**: soft fill with a thin border, outline, accent tint, inverted, text only, accent dot
- **Ghost tabs**: tabs that aren't loaded yet are faded and grey
- Optional serif or mono interface font

Private windows keep Zen's own look.

## Palettes

| Palette | Background | Text | Accent |
|---|---|---|---|
| Warm graphite (default) | `#1f1e1d` | `#e8e6dc` | `#d97757` |
| Neutral ink | `#141414` | `#e6e6e6` | `#6aa6ff` |
| Cool slate | `#14171b` | `#e3e7ec` | `#5fd4a4` |
| Paper (light) | `#e9e7df` | `#1f1e1d` | `#c96442` |
| Custom | your own hex codes | | |

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
| Custom background, text and accent colors | Warm graphite's colors |
| Custom palette is light | Off |
| Active tab style | Soft fill |
| Keep the toolbar in the theme color instead of the site's color | Off |
| Interface font | System |
| Don't fade tabs that aren't loaded yet | Off |

## Works well with

- [Another Zen Load Bar](https://github.com/TaouMou/another-zen-load-bar): turn off its custom color to follow this theme's accent.
- [Zen Folder Tree Connectors](https://github.com/JustAdumbPrsn/ZenFolderTreeConnectors): tree lines in folders.

The site-colored toolbar is inspired by [Zia](https://github.com/z1n-k/zia) and [Zen Page Tint](https://github.com/caezium/zen-page-tint).

## License

MIT
