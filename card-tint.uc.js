// ==UserScript==
// @name           Another Zen Card: site-colored toolbar
// @description    Colors the card's toolbar with the color along the top edge of the page,
//                 shows only the domain in the centered address bar, cross-fades the
//                 Library, moves the window buttons into the sidebar-only layout's top row,
//                 and opens extension popups from the Extensions button.
// @include        main
// ==/UserScript==

// How it works: after a page loads or a tab is selected, take a tiny
// snapshot of the visible page, find the most common color in its top
// rows (usually the site's header) and expose it to chrome.css as
// --zc-site / --zc-site-text plus a [zc-site-tint] attribute on :root.
// Colors are remembered per site so switching tabs is instant.

(() => {
  "use strict";

  if (window.__zenCardTint || PrivateBrowsingUtils.isWindowPrivate(window)) {
    return;
  }
  window.__zenCardTint = true;

  const PREF_OFF = "mod.zencard.nositetint";
  const SAMPLE_WIDTH = 96; // snapshot is scaled down to about this many pixels wide
  const SAMPLE_ROWS = 2; // top rows of the snapshot to read
  const CACHE_MAX = 200;
  const { STATE_STOP, STATE_IS_WINDOW } = Ci.nsIWebProgressListener;

  const root = document.documentElement;
  const cache = new Map();
  let timers = [];

  const isOff = () => Services.prefs.getBoolPref(PREF_OFF, false);

  function hostOf(browser) {
    try {
      return browser.currentURI.host || null;
    } catch {
      return null; // about: and similar pages have no host
    }
  }

  function apply(color) {
    if (!color || isOff()) {
      root.removeAttribute("zc-site-tint");
      root.style.removeProperty("--zc-site");
      root.style.removeProperty("--zc-site-text");
      return;
    }
    root.style.setProperty("--zc-site", `rgb(${color.r}, ${color.g}, ${color.b})`);
    root.style.setProperty("--zc-site-text", color.dark ? "#f2f1ec" : "#1c1b1a");
    root.setAttribute("zc-site-tint", color.dark ? "dark" : "light");
  }

  // Most common color in the top rows, so a logo or a button in the header
  // doesn't skew it the way a plain average would.
  function dominantTopColor(data, width) {
    const buckets = new Map();
    let opaque = 0;
    for (let i = 0; i < width * SAMPLE_ROWS * 4; i += 4) {
      if (data[i + 3] < 200) {
        continue;
      }
      opaque++;
      const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
      const b = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      b.n++;
      b.r += data[i];
      b.g += data[i + 1];
      b.b += data[i + 2];
      buckets.set(key, b);
    }
    if (opaque < width * SAMPLE_ROWS * 0.5) {
      return null;
    }
    let best = null;
    for (const b of buckets.values()) {
      if (!best || b.n > best.n) {
        best = b;
      }
    }
    const r = Math.round(best.r / best.n);
    const g = Math.round(best.g / best.n);
    const bl = Math.round(best.b / best.n);
    const luma = (0.2126 * r + 0.7152 * g + 0.0722 * bl) / 255;
    return { r, g, b: bl, dark: luma < 0.55 };
  }

  async function sample(browser, host) {
    if (isOff() || browser !== gBrowser.selectedBrowser || hostOf(browser) !== host) {
      return;
    }
    const width = browser.clientWidth;
    if (!width) {
      return;
    }
    let bitmap;
    try {
      bitmap = await browser.drawSnapshot(0, 0, 0, 0, SAMPLE_WIDTH / width, "transparent", true);
    } catch {
      return; // page not ready, crashed, or not snapshot-able
    }
    if (!bitmap) {
      return;
    }
    try {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      const rows = Math.min(SAMPLE_ROWS, bitmap.height);
      const { data } = ctx.getImageData(0, 0, bitmap.width, rows);
      const color = dominantTopColor(data, bitmap.width);
      // The user may have moved on while we were sampling
      if (browser !== gBrowser.selectedBrowser || hostOf(browser) !== host) {
        return;
      }
      if (color) {
        cache.delete(host);
        cache.set(host, color);
        if (cache.size > CACHE_MAX) {
          cache.delete(cache.keys().next().value);
        }
      }
      apply(color);
    } finally {
      bitmap.close();
    }
  }

  // Pages often paint their header late, so sample a few times
  function schedule(browser, delays) {
    for (const t of timers) {
      clearTimeout(t);
    }
    const host = hostOf(browser);
    apply(host ? cache.get(host) : null);
    if (!host) {
      timers = [];
      return;
    }
    timers = delays.map(d => setTimeout(() => sample(browser, host), d));
  }

  const progressListener = {
    onLocationChange(browser, webProgress, request, location, flags) {
      if (webProgress.isTopLevel && browser === gBrowser.selectedBrowser) {
        schedule(browser, [150, 700, 1600]);
      }
    },
    onStateChange(browser, webProgress, request, flags) {
      if (
        webProgress.isTopLevel &&
        flags & STATE_STOP &&
        flags & STATE_IS_WINDOW &&
        browser === gBrowser.selectedBrowser
      ) {
        schedule(browser, [100, 900]);
      }
    },
  };

  const onTabSelect = () => schedule(gBrowser.selectedBrowser, [60, 500]);

  const prefObserver = {
    observe() {
      if (isOff()) {
        apply(null);
      } else {
        onTabSelect();
      }
    },
  };

  // ---- Domain-only address bar ----
  // Zen shows only the domain in the sidebar layout by trimming through
  // gURLBar._zenTrimURL. Wrap it to do the same for the centered address
  // bar in the top toolbar. Like Zen, only https addresses are shortened,
  // and the full address comes back while you edit it.
  const PREF_URLBAR = "mod.zencard.urlbar";
  let originalTrim = null;

  const domainOnly = () =>
    Services.prefs.getStringPref(PREF_URLBAR, "centered") !== "full" &&
    root.getAttribute("zen-single-toolbar") !== "true";

  function trimToDomain(url) {
    if (!domainOnly() || gURLBar.hasAttribute("breakout-extend")) {
      return originalTrim(url);
    }
    try {
      const uri = Services.io.newURI(url);
      if (uri.scheme !== "https" || !uri.host) {
        return originalTrim(url);
      }
      return uri.host.replace(/^www\./, "");
    } catch {
      return originalTrim(url);
    }
  }

  function refreshUrlbar() {
    try {
      gURLBar.setURI();
    } catch {}
  }

  const urlbarPrefObserver = { observe: refreshUrlbar };

  // ---- Library cross-fade ----
  // As the Library opens, Zen fades the sidebar out with an inline opacity
  // (1 to 0 during its spring) and back in as it closes, then clears it.
  // Mirror that onto the Library as --zc-library-fade so chrome.css can
  // fade the Library in over the page instead of sliding it.
  function syncLibraryFade() {
    const library = document.querySelector("zen-library");
    if (!library) {
      return;
    }
    const sidebarOpacity = gNavToolbox.style.opacity;
    if (sidebarOpacity === "") {
      library.style.removeProperty("--zc-library-fade");
    } else {
      library.style.setProperty("--zc-library-fade", String(1 - parseFloat(sidebarOpacity)));
    }
  }

  const libraryFadeObserver = new MutationObserver(syncLibraryFade);

  // ---- Window buttons in the sidebar ----
  // In the sidebar-only layout Zen puts the window buttons in a strip
  // above the page. Move them into the sidebar's top row, beside back,
  // forward and reload, and mark :root so chrome.css can close that
  // strip. Zen puts them back whenever it rebuilds the layout, so watch
  // for that. Only for a left sidebar with the buttons on the right
  // (Windows), outside compact mode.
  let windowButtonsHome = null;

  const dotsInSidebar = () =>
    root.getAttribute("zen-single-toolbar") === "true" &&
    root.getAttribute("zen-compact-mode") !== "true" &&
    root.getAttribute("zen-right-side") !== "true" &&
    root.getAttribute("zen-window-buttons-reversed") !== "true";

  function placeWindowButtons() {
    const buttons = window.gZenVerticalTabsManager?.actualWindowButtons;
    const topButtons = document.getElementById("zen-sidebar-top-buttons");
    if (!buttons || !topButtons) {
      return;
    }
    if (dotsInSidebar()) {
      if (buttons.parentElement !== topButtons) {
        windowButtonsHome = buttons.parentElement;
        topButtons.append(buttons);
      }
      root.setAttribute("zc-window-dots-in-sidebar", "true");
    } else {
      if (buttons.parentElement === topButtons && windowButtonsHome) {
        windowButtonsHome.append(buttons);
      }
      root.removeAttribute("zc-window-dots-in-sidebar");
    }
  }

  const windowButtonsObserver = new MutationObserver(placeWindowButtons);

  // ---- Extension popups ----
  // With Zen's zen.theme.hide-unified-extensions-button off, extensions
  // get their own toolbar button, but Zen still anchors extension popups
  // to its site button in the address bar, so they open in the middle of
  // the toolbar. Zen sets that anchor on CustomizableUI's extensions area
  // (and on the nav bar, for extensions that overflow the toolbar);
  // registering the area again with the Extensions button updates it.
  function anchorExtensionPopups() {
    if (
      Services.prefs.getBoolPref("zen.theme.hide-unified-extensions-button", true) ||
      !document.getElementById("unified-extensions-button")
    ) {
      return;
    }
    try {
      CustomizableUI.registerArea(CustomizableUI.AREA_ADDONS, {
        type: CustomizableUI.TYPE_PANEL,
        anchor: "unified-extensions-button",
      });
    } catch (e) {
      console.error("Another Zen Card: couldn't re-anchor extension popups", e);
    }
    document
      .getElementById("nav-bar")
      ?.setAttribute("addon-webext-overflowbutton", "unified-extensions-button");
  }

  function init() {
    anchorExtensionPopups();

    windowButtonsObserver.observe(root, {
      attributes: true,
      attributeFilter: ["zen-single-toolbar", "zen-compact-mode", "zen-right-side"],
    });
    const navbarContainer = document.getElementById("zen-appcontent-navbar-container");
    if (navbarContainer) {
      windowButtonsObserver.observe(navbarContainer, { childList: true });
    }
    placeWindowButtons();

    libraryFadeObserver.observe(gNavToolbox, { attributes: true, attributeFilter: ["style"] });
    root.setAttribute("zc-library-fade", "true");

    gBrowser.addTabsProgressListener(progressListener);
    gBrowser.tabContainer.addEventListener("TabSelect", onTabSelect);
    Services.prefs.addObserver(PREF_OFF, prefObserver);

    if (typeof gURLBar._zenTrimURL === "function") {
      originalTrim = gURLBar._zenTrimURL;
      gURLBar._zenTrimURL = trimToDomain;
      Services.prefs.addObserver(PREF_URLBAR, urlbarPrefObserver);
      refreshUrlbar();
    }

    window.addEventListener(
      "unload",
      () => {
        gBrowser.removeTabsProgressListener(progressListener);
        gBrowser.tabContainer.removeEventListener("TabSelect", onTabSelect);
        Services.prefs.removeObserver(PREF_OFF, prefObserver);
        libraryFadeObserver.disconnect();
        windowButtonsObserver.disconnect();
        if (originalTrim) {
          gURLBar._zenTrimURL = originalTrim;
          Services.prefs.removeObserver(PREF_URLBAR, urlbarPrefObserver);
        }
      },
      { once: true }
    );
    onTabSelect();
  }

  if (window.gBrowserInit?.delayedStartupFinished) {
    init();
  } else {
    const onStartup = subject => {
      if (subject === window) {
        Services.obs.removeObserver(onStartup, "browser-delayed-startup-finished");
        init();
      }
    };
    Services.obs.addObserver(onStartup, "browser-delayed-startup-finished");
  }
})();
