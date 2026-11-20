(() => {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      console.warn("Nova PWA service worker registration failed:", error);
    });
  });

  const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (isStandalone || sessionStorage.getItem("nova-pwa-dismissed") === "1") return;

  let deferredPrompt = null;
  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
    !window.MSStream;

  const banner = document.createElement("aside");
  banner.className = "nova-install-banner";
  banner.setAttribute("aria-label", "Install Nova Cares Payroll Portal");
  banner.innerHTML = `
    <img src="/icons/nova-app-icon.svg" alt="" width="42" height="42">
    <div class="nova-install-copy">
      <strong>Install Nova Payroll</strong>
      <span>Quick access from your phone's home screen.</span>
    </div>
    <button type="button" class="nova-install-action">Install</button>
    <button type="button" class="nova-install-close" aria-label="Dismiss">×</button>
  `;

  const style = document.createElement("style");
  style.textContent = `
    .nova-install-banner{position:fixed;z-index:9999;left:16px;right:16px;bottom:16px;max-width:520px;margin:auto;display:flex;align-items:center;gap:12px;padding:12px 14px;background:#fff;border:1px solid #dce5ed;border-radius:14px;box-shadow:0 12px 36px #142b4526;font-family:Arial,sans-serif;color:#172c43}
    .nova-install-banner img{flex:0 0 42px;border-radius:10px}
    .nova-install-copy{min-width:0;flex:1;display:grid;gap:3px}
    .nova-install-copy strong{font-size:13px}
    .nova-install-copy span{font-size:11px;line-height:1.4;color:#687b8d}
    .nova-install-action{border:0;border-radius:8px;padding:9px 12px;background:#142b45;color:#fff;font-size:12px;font-weight:700;cursor:pointer}
    .nova-install-close{border:0;background:transparent;color:#738395;font-size:22px;cursor:pointer;padding:2px 4px}
    @media(min-width:700px){.nova-install-banner{left:auto;right:22px;bottom:22px}}
  `;
  document.head.appendChild(style);
  document.body.appendChild(banner);

  const installButton = banner.querySelector(".nova-install-action");
  const closeButton = banner.querySelector(".nova-install-close");
  const hideBanner = () => {
    banner.remove();
    style.remove();
    sessionStorage.setItem("nova-pwa-dismissed", "1");
  };

  closeButton.addEventListener("click", hideBanner);

  if (isIOS) {
    installButton.addEventListener("click", () => {
      window.alert('To install Nova Payroll on iPhone:\n1. Tap the Share button in Safari.\n2. Scroll down and choose "Add to Home Screen".\n3. Tap "Add".');
    });
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installButton.textContent = "Install";
  });

  installButton.addEventListener("click", async () => {
    if (!deferredPrompt) {
      window.alert("Open this portal in Chrome or your phone's browser menu and choose Install app or Add to Home Screen.");
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    hideBanner();
  });

  window.addEventListener("appinstalled", hideBanner);
})();
