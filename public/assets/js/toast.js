// Function: global toast utility.
// Why: I need one consistent place to show success, warning, and error feedback across the app.
(function toastBootstrap() {
  const TYPE_TO_TITLE = {
    success: "Success",
    error: "Error",
    warning: "Warning",
    info: "Info"
  };
  const SHOWN_STATUS_MESSAGES = new Set();
  let container = null;

  function getContainer() {
    if (container && document.body.contains(container)) return container;
    container = document.getElementById("toastContainer");
    if (container) return container;
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
    return container;
  }

  function classifyMessage(message) {
    const text = String(message || "").trim().toLowerCase();
    if (!text) return "info";
    if (
      /(success|saved|completed|created|updated|deleted|recorded|added|approved|synced|loaded)/.test(text)
    ) {
      return "success";
    }
    if (
      /(error|fail|failed|invalid|unable|cannot|forbidden|rejected|missing|not found|expired|insufficient|blocked|denied)/.test(text)
    ) {
      return "error";
    }
    if (
      /(warning|required|please|select|already|must|empty|pending|confirm)/.test(text)
    ) {
      return "warning";
    }
    return "info";
  }

  function showToast(message, type = "info", timeoutMs = 3600) {
    const msg = String(message || "").trim();
    if (!msg) return;

    const safeType = ["success", "error", "warning", "info"].includes(type) ? type : "info";
    const parent = getContainer();

    const toastEl = document.createElement("div");
    toastEl.className = "toast";
    toastEl.dataset.type = safeType;
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");

    const textWrap = document.createElement("div");
    const titleEl = document.createElement("p");
    titleEl.className = "toast-title";
    titleEl.textContent = TYPE_TO_TITLE[safeType];
    const msgEl = document.createElement("p");
    msgEl.className = "toast-message";
    msgEl.textContent = msg;
    textWrap.appendChild(titleEl);
    textWrap.appendChild(msgEl);

    const closeBtn = document.createElement("button");
    closeBtn.className = "toast-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close notification");
    closeBtn.textContent = "x";

    const removeToast = () => {
      toastEl.classList.add("toast-out");
      window.setTimeout(() => {
        if (toastEl.parentElement) toastEl.parentElement.removeChild(toastEl);
      }, 180);
    };

    closeBtn.addEventListener("click", removeToast);
    toastEl.appendChild(textWrap);
    toastEl.appendChild(closeBtn);
    parent.appendChild(toastEl);

    if (timeoutMs > 0) window.setTimeout(removeToast, timeoutMs);
  }

  function mirrorStatusElementsToToast() {
    const targets = document.querySelectorAll('[id*="Status"], .error-msg, [data-toast-status]');
    for (const el of targets) {
      if (!(el instanceof HTMLElement)) continue;
      const text = (el.textContent || "").trim();
      if (!text) continue;
      const key = `${el.id || el.className}:${text}`;
      if (SHOWN_STATUS_MESSAGES.has(key)) continue;
      SHOWN_STATUS_MESSAGES.add(key);
      showToast(text, classifyMessage(text));
    }
  }

  function wireStatusObserver() {
    const observer = new MutationObserver(() => {
      mirrorStatusElementsToToast();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
    mirrorStatusElementsToToast();
  }

  // Public API.
  window.showToast = showToast;
  window.notifySuccess = (message) => showToast(message, "success");
  window.notifyError = (message) => showToast(message, "error");
  window.notifyWarning = (message) => showToast(message, "warning");
  window.notifyInfo = (message) => showToast(message, "info");

  // Make existing alert(...) calls toast-based without rewriting every file.
  window.alert = function alertAsToast(message) {
    showToast(message, classifyMessage(message));
  };

  // Surface unexpected runtime problems as error toasts.
  window.addEventListener("error", (event) => {
    const message = event?.error?.message || event?.message || "Unexpected application error.";
    showToast(message, "error");
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const message = reason?.message || String(reason || "Unhandled async error.");
    showToast(message, "error");
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireStatusObserver);
  } else {
    wireStatusObserver();
  }
})();
