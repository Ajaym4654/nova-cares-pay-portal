(() => {
  // Register the service worker where supported; do not block the install UI
  // in browsers that do not expose service workers.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/service-worker.js").catch((error) => {
        console.warn("Nova PWA service worker registration failed:", error);
      });
    });
  }

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true;
  let dismissed = false;
  try {
    dismissed = sessionStorage.getItem("nova-pwa-dismissed") === "1";
  } catch (_) {}
  if (isStandalone || dismissed) return;

  let deferredPrompt = null;
  const ua = window.navigator.userAgent || "";
  const isIOS = /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(ua);
  const isEdge = /edg\//i.test(ua);
  const isSamsung = /samsungbrowser/i.test(ua);

  const banner = document.createElement("aside");
  banner.className = "nova-install-banner";
  banner.setAttribute("aria-label", "Install Nova Cares Payroll Portal");
  banner.innerHTML = `
    <img src="/icons/nova-app-icon.svg" alt="" width="42" height="42">
    <div class="nova-install-copy">
      <strong>Nova Payroll App</strong>
      <span>Add secure, quick access to your Home Screen.</span>
    </div>
    <button type="button" class="nova-install-action">Install</button>
    <button type="button" class="nova-install-close" aria-label="Dismiss">×</button>
  `;

  const style = document.createElement("style");
  style.textContent = `
    .nova-install-banner{position:fixed;z-index:99999;left:16px;right:16px;bottom:calc(88px + env(safe-area-inset-bottom));max-width:520px;margin:auto;display:flex;align-items:center;gap:12px;padding:12px 14px;background:#fff;border:1px solid #dce5ed;border-radius:14px;box-shadow:0 12px 36px #142b4526;font-family:Arial,sans-serif;color:#172c43}
    .nova-install-banner img{flex:0 0 42px;border-radius:10px}
    .nova-install-copy{min-width:0;flex:1;display:grid;gap:3px}
    .nova-install-copy strong{font-size:13px}
    .nova-install-copy span{font-size:11px;line-height:1.4;color:#687b8d}
    .nova-install-action{border:0;border-radius:8px;padding:9px 12px;background:#142b45;color:#fff;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
    .nova-install-close{border:0;background:transparent;color:#738395;font-size:22px;cursor:pointer;padding:2px 4px}
    @media(min-width:700px){.nova-install-banner{left:auto;right:22px;bottom:22px}}
  `;
  document.head.appendChild(style);
  document.body.appendChild(banner);

  const installButton = banner.querySelector(".nova-install-action");
  const closeButton = banner.querySelector(".nova-install-close");

  const hideBanner = (remember = true) => {
    banner.remove();
    style.remove();
    if (remember) {
      try { sessionStorage.setItem("nova-pwa-dismissed", "1"); } catch (_) {}
    }
  };

  closeButton.addEventListener("click", () => hideBanner());

  const showManualInstructions = () => {
    if (isIOS) {
      window.alert('To add Nova Payroll to your iPhone Home Screen:\n1. Tap Share in your browser.\n2. Choose "Add to Home Screen".\n3. Tap "Add".');
    } else if (isAndroid && isSamsung) {
      window.alert('To add Nova Payroll to your Home Screen:\n1. Open the browser menu (☰ or ⋮).\n2. Choose "Add page to" or "Add to Home screen".\n3. Confirm Add.');
    } else if (isAndroid && isEdge) {
      window.alert('To install Nova Payroll:\n1. Open the Edge menu (⋯).\n2. Choose "Add to phone" or "Install".\n3. Confirm the install.');
    } else if (isAndroid) {
      window.alert('To install Nova Payroll:\n1. Open your browser menu (⋮).\n2. Choose "Install app" or "Add to Home screen".\n3. Confirm Add/Install.');
    } else {
      window.alert('Open your browser menu and choose "Install app" or "Add to Home Screen", if your browser offers that option.');
    }
  };

  if (isIOS) {
    installButton.textContent = "Add";
    installButton.addEventListener("click", showManualInstructions);
  } else {
    // Keep an install path visible even before Chromium fires beforeinstallprompt.
    installButton.addEventListener("click", async () => {
      if (!deferredPrompt) {
        showManualInstructions();
        return;
      }
      deferredPrompt.prompt();
      try {
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === "accepted") hideBanner();
      } catch (error) {
        console.warn("Nova PWA install prompt failed:", error);
        showManualInstructions();
      }
      deferredPrompt = null;
    });

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredPrompt = event;
      installButton.textContent = "Install";
    });
  }

  window.addEventListener("appinstalled", () => hideBanner());
})();
