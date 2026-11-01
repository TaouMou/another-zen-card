// ==UserScript==
// @name           Another Zen Card: site-colored toolbar
// @description    Colors the card's toolbar with the color along the top edge of the page,
//                 shows only the domain in the centered address bar, cross-fades the
//                 Library, moves the window buttons into the sidebar-only layout's top row,
//                 opens extension popups from the Extensions button, themes the
//                 settings dialogs, and leaves the address bar unfocused at startup.
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

  // Resolves to the color found (null for none), or undefined when no
  // sample was taken
  async function sample(browser, host) {
    if (isOff() || browser !== gBrowser.selectedBrowser || hostOf(browser) !== host) {
      return undefined;
    }
    const width = browser.clientWidth;
    if (!width) {
      return undefined;
    }
    // Only the strip that becomes the rows we read, not the whole page
    const scale = SAMPLE_WIDTH / width;
    const stripHeight = Math.ceil(SAMPLE_ROWS / scale) + 1;
    let bitmap;
    try {
      bitmap = await browser.drawSnapshot(0, 0, width, stripHeight, scale, "transparent", true);
    } catch {
      return undefined; // page not ready, crashed, or not snapshot-able
    }
    if (!bitmap) {
      return undefined;
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
        return undefined;
      }
      if (color) {
        cache.delete(host);
        cache.set(host, color);
        if (cache.size > CACHE_MAX) {
          cache.delete(cache.keys().next().value);
        }
      }
      apply(color);
      return color;
    } finally {
      bitmap.close();
    }
  }

  const sameColor = (a, b) => a === b || (!!a && !!b && a.r === b.r && a.g === b.g && a.b === b.b);

  function clearTimers() {
    for (const t of timers) {
      clearTimeout(t);
    }
    timers = [];
  }

  // Pages often paint their header late, so sample a few times; once two
  // samples in a row agree, the header has settled and the rest are
  // dropped
  function schedule(browser, delays) {
    clearTimers();
    const host = hostOf(browser);
    apply(host ? cache.get(host) : null);
    if (!host) {
      return;
    }
    const run = [];
    timers = run;
    let previous;
    for (const d of delays) {
      run.push(
        setTimeout(async () => {
          const color = await sample(browser, host);
          if (color === undefined) {
            return;
          }
          // Only if no newer run has started meanwhile
          if (timers === run && previous !== undefined && sameColor(color, previous)) {
            clearTimers();
          }
          previous = color;
        }, d)
      );
    }
  }

  const progressListener = {
    onLocationChange(browser, webProgress, request, location, flags) {
      if (webProgress.isTopLevel && browser === gBrowser.selectedBrowser) {
        // Sites that change the address without loading a new page
        // (YouTube, Gmail...) keep their header; one look is enough
        const sameDocument = flags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT;
        schedule(browser, sameDocument ? [150] : [150, 700, 1600]);
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
  // fade the Library in over the page instead of sliding it. In compact
  // mode Zen slides the floating sidebar out instead, with an inline
  // translateX(calc(-100% * progress)), which the style may read back
  // simplified (translateX(-40%)); read the progress from it, mark
  // the sidebar [zc-library-fading] and give chrome.css the sidebar's
  // opacity as --zc-toolbox-fade on :root (not on the sidebar, whose
  // style this observer watches).
  let libraryElement = null;

  function syncLibraryFade() {
    if (!libraryElement?.isConnected) {
      libraryElement = document.querySelector("zen-library");
    }
    const library = libraryElement;
    if (!library) {
      return;
    }
    let progress = null;
    const sidebarOpacity = gNavToolbox.style.opacity;
    const transform = gNavToolbox.style.transform;
    const slide = transform.startsWith("translateX(")
      ? /\*\s*([\d.e-]+)/.exec(transform) || /([-\d.e]+)%/.exec(transform)
      : null;
    if (sidebarOpacity !== "") {
      progress = 1 - parseFloat(sidebarOpacity);
    } else if (slide) {
      const value = Math.abs(parseFloat(slide[1]));
      progress = slide[0].endsWith("%") ? value / 100 : value;
    }

    if (progress === null) {
      library.style.removeProperty("--zc-library-fade");
    } else {
      library.style.setProperty("--zc-library-fade", String(progress));
    }

    if (progress !== null && slide) {
      root.style.setProperty("--zc-toolbox-fade", String(1 - progress));
      gNavToolbox.setAttribute("zc-library-fading", "true");
    } else {
      root.style.removeProperty("--zc-toolbox-fade");
      gNavToolbox.removeAttribute("zc-library-fading");
    }
  }

  const libraryFadeObserver = new MutationObserver(syncLibraryFade);

  // ---- No address bar focus at startup ----
  // The startup page is treated like a new tab, so Firefox puts the
  // cursor in the address bar, and in compact mode a hidden toolbar
  // stays shown while it has focus. In the first window, give the focus
  // back to the page during the first moments, unless you have already
  // clicked or typed (Ctrl+L or a click on the bar still work).
  const STARTUP_FOCUS_WINDOW_MS = 3000;

  function releaseStartupFocus() {
    const windows = Services.wm.getEnumerator("navigator:browser");
    windows.getNext();
    if (windows.hasMoreElements()) {
      return; // not the first window
    }

    let userActed = false;
    const onUserInput = () => {
      userActed = true;
    };
    const release = () =>
      setTimeout(() => {
        if (!userActed && gURLBar.focused) {
          gBrowser.selectedBrowser.focus();
        }
      }, 0);

    window.addEventListener("mousedown", onUserInput, { capture: true });
    window.addEventListener("keydown", onUserInput, { capture: true });
    gURLBar.inputField.addEventListener("focus", release);
    release();

    setTimeout(() => {
      window.removeEventListener("mousedown", onUserInput, { capture: true });
      window.removeEventListener("keydown", onUserInput, { capture: true });
      gURLBar.inputField.removeEventListener("focus", release);
    }, STARTUP_FOCUS_WINDOW_MS);
  }

  // ---- Customize Toolbar: items Zen hides with CSS ----
  // While an item is dragged, Firefox shifts the palette items with
  // transforms measured from each one's box, skipping only [hidden] ones.
  // Zen hides some (Firefox View) with display: none instead, which
  // measures as the window's corner, so the item before it was shifted
  // there for the whole drag. Mark those wrappers hidden before each drag.
  function hideUndisplayedPaletteItems() {
    const palette = document.getElementById("customization-palette");
    if (!palette) {
      return;
    }
    for (const item of palette.children) {
      if (!item.hidden && getComputedStyle(item).display == "none") {
        item.hidden = true;
      }
    }
  }

  const onCustomizeDragStart = () => {
    if (root.hasAttribute("customizing")) {
      hideUndisplayedPaletteItems();
    }
  };

  // Items from Zen's hidden tab strip show up wrapped twice in the
  // palette (chrome.css now hides them). Dragging one into a toolbar
  // saved its inner wrapper ("wrapper-...") as a toolbar item: an
  // invisible node that makes Firefox refuse every later drop there.
  // No real item id starts with "wrapper-", so drop those from the
  // saved layout. Firefox only removes items marked removable.
  function removeStrayWrappers() {
    for (const area of CustomizableUI.areas) {
      for (const id of CustomizableUI.getWidgetIdsInArea(area)) {
        if (!id.startsWith("wrapper-")) {
          continue;
        }
        const node = document.getElementById(id);
        node?.setAttribute("removable", "true");
        CustomizableUI.removeWidgetFromArea(id);
        node?.remove();
      }
    }
  }

  // ---- Closing tabs in the collapsed sidebar ----
  // chrome.css shows a tab's close mark over its icon while hovered, in
  // the middle of the tab, but Firefox won't start a drag on the close
  // button. With [zc-collapsed-tab-close] the mark lets the mouse through,
  // so the whole tab drags, and a plain click on it closes the tab here.
  // A click doesn't follow a drag. The press on the mark is kept from the
  // tab so it doesn't select the tab first, as Firefox's own close button
  // does.
  const COLLAPSED_TAB =
    ':root:not([zen-private-window="true"]) #navigator-toolbox:not([zen-sidebar-expanded="true"]) .tabbrowser-tab:not([pinned], [zen-essential])';

  function closeMarkTab(event) {
    if (event.button != 0 || event.ctrlKey || event.shiftKey || event.metaKey || event.altKey) {
      return null;
    }
    const tab = event.target.closest?.(".tabbrowser-tab");
    if (!tab?.matches(COLLAPSED_TAB)) {
      return null;
    }
    const mark = tab.querySelector(".tab-close-button")?.getBoundingClientRect();
    if (
      !mark ||
      event.clientX < mark.left ||
      event.clientX > mark.right ||
      event.clientY < mark.top ||
      event.clientY > mark.bottom
    ) {
      return null;
    }
    return tab;
  }

  const onCloseMarkMouseDown = event => {
    if (closeMarkTab(event)) {
      event.stopPropagation();
    }
  };

  const onCloseMarkClick = event => {
    const tab = closeMarkTab(event);
    if (tab) {
      event.stopPropagation();
      event.preventDefault();
      gBrowser.removeTab(tab, { animate: true, triggeringEvent: event });
    }
  };

  // ---- Menu separators ----
  // Firefox and Zen hide menu items that don't fit the click (the tab
  // items when a toolbar is right-clicked), which can leave two
  // separators in a row, or one at either end. Their handlers run on the
  // popup itself, before this one; mark the leftovers for chrome.css.
  function tidySeparators(popup) {
    const items = [...popup.children];
    for (const item of items) {
      if (item.localName == "menuseparator") {
        item.removeAttribute("zc-redundant");
      }
    }
    let previous = null;
    for (const item of items) {
      if (item.hidden || getComputedStyle(item).display == "none") {
        continue;
      }
      if (item.localName == "menuseparator" && (!previous || previous.localName == "menuseparator")) {
        item.setAttribute("zc-redundant", "true");
        continue;
      }
      previous = item;
    }
    if (previous?.localName == "menuseparator") {
      previous.setAttribute("zc-redundant", "true");
    }
  }

  const onPopupShowing = event => {
    if (event.target.localName == "menupopup") {
      tidySeparators(event.target);
    }
  };

  // ---- Window buttons in the sidebar ----
  // Zen puts the window buttons at the end of the top toolbar, or in a
  // strip above the page in the sidebar-only layout. Move them to the
  // start of the sidebar's top row; with the sidebar collapsed, which is
  // too narrow for a row, stack them at the top of the sidebar instead
  // ([zc-window-controls="stacked"]). In the sidebar-only layout, mark
  // :root so chrome.css can close the emptied strip. Zen puts them back
  // whenever it rebuilds the layout, so watch for that. Only for a left
  // sidebar with the buttons on the right (Windows), outside compact
  // mode; private windows keep Zen's layout.
  let windowButtonsHome = null;

  const controlsInSidebar = () =>
    root.getAttribute("zen-compact-mode") !== "true" &&
    root.getAttribute("zen-right-side") !== "true" &&
    root.getAttribute("zen-window-buttons-reversed") !== "true" &&
    root.getAttribute("zen-private-window") !== "true";

  function placeWindowButtons() {
    const buttons = window.gZenVerticalTabsManager?.actualWindowButtons;
    const topButtons = document.getElementById("zen-sidebar-top-buttons");
    const titlebar = document.getElementById("titlebar");
    if (!buttons || !topButtons || !titlebar) {
      return;
    }
    const placed = buttons.parentElement === topButtons || buttons.parentElement === titlebar;
    if (controlsInSidebar()) {
      const stacked = root.getAttribute("zen-sidebar-expanded") !== "true";
      const home = stacked ? titlebar : topButtons;
      if (buttons.parentElement !== home || home.firstElementChild !== buttons) {
        if (!placed) {
          windowButtonsHome = buttons.parentElement;
        }
        home.prepend(buttons);
      }
      root.setAttribute("zc-window-controls", stacked ? "stacked" : "row");
      root.toggleAttribute("zc-window-dots-in-sidebar", root.getAttribute("zen-single-toolbar") === "true");
    } else {
      if (placed && windowButtonsHome) {
        windowButtonsHome.append(buttons);
      }
      root.removeAttribute("zc-window-controls");
      root.removeAttribute("zc-window-dots-in-sidebar");
    }
  }

  // The sidebar's top row holds only the window buttons: refuse drops
  // there in Customize Toolbar. This runs before Customize mode's own
  // handlers, which then never accept the drop.
  const onCustomizeDragOver = event => {
    if (root.hasAttribute("customizing") && event.target.closest?.("#zen-sidebar-top-buttons")) {
      event.stopPropagation();
    }
  };

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

  // ---- Settings dialogs and prompts ----
  // Sine only loads content.css into content pages. The dialogs opened
  // from settings and the browser's prompts are chrome:// pages in
  // their own frames, so register the installed content.css for every
  // document once; its @-moz-document rule limits it to the settings
  // pages and these dialogs. It stays registered until Zen restarts.
  const MOD_ID = "2bf83ae5-3622-4522-9174-fe2d6825a333";

  function registerDialogStyles() {
    try {
      const file = Services.dirsvc.get("UChrm", Ci.nsIFile);
      file.append("sine-mods");
      file.append(MOD_ID);
      file.append("content.css");
      if (!file.exists()) {
        return;
      }
      const sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(
        Ci.nsIStyleSheetService
      );
      const uri = Services.io.newFileURI(file);
      if (!sss.sheetRegistered(uri, sss.USER_SHEET)) {
        sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
      }
    } catch (e) {
      console.error("Another Zen Card: couldn't style the settings dialogs", e);
    }
  }

  function init() {
    releaseStartupFocus();
    anchorExtensionPopups();
    registerDialogStyles();

    windowButtonsObserver.observe(root, {
      attributes: true,
      attributeFilter: [
        "zen-single-toolbar",
        "zen-compact-mode",
        "zen-right-side",
        "zen-sidebar-expanded",
        "zen-window-buttons-reversed",
      ],
    });
    // Where Zen puts the buttons back, and where they go
    for (const id of ["zen-appcontent-navbar-container", "nav-bar", "zen-sidebar-top-buttons", "titlebar"]) {
      const element = document.getElementById(id);
      if (element) {
        windowButtonsObserver.observe(element, { childList: true });
      }
    }
    placeWindowButtons();

    libraryFadeObserver.observe(gNavToolbox, { attributes: true, attributeFilter: ["style"] });
    root.setAttribute("zc-library-fade", "true");

    // Capturing, so it runs before Customize mode's own dragstart handler
    window.addEventListener("dragstart", onCustomizeDragStart, true);
    for (const type of ["dragenter", "dragover", "drop"]) {
      window.addEventListener(type, onCustomizeDragOver, true);
    }
    window.addEventListener("popupshowing", onPopupShowing);
    gBrowser.tabContainer.addEventListener("mousedown", onCloseMarkMouseDown, true);
    gBrowser.tabContainer.addEventListener("click", onCloseMarkClick, true);
    root.setAttribute("zc-collapsed-tab-close", "true");
    try {
      removeStrayWrappers();
    } catch (e) {
      console.error("Another Zen Card: couldn't clean up the toolbar layout", e);
    }

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
        window.removeEventListener("dragstart", onCustomizeDragStart, true);
        for (const type of ["dragenter", "dragover", "drop"]) {
          window.removeEventListener(type, onCustomizeDragOver, true);
        }
        window.removeEventListener("popupshowing", onPopupShowing);
        gBrowser.tabContainer.removeEventListener("mousedown", onCloseMarkMouseDown, true);
        gBrowser.tabContainer.removeEventListener("click", onCloseMarkClick, true);
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
