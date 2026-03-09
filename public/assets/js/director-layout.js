// Developer note from me: I wrote and maintain this file for the KGL system, and I keep this logic explicit so future updates are safer.
(() => {
  const SIDEBAR_STATE_KEY = "sidebar_collapsed";

  function resolveAppBasePath() {
    const path = window.location.pathname;
    const marker = "/pages/director/";
    const markerIndex = path.indexOf(marker);
    if (markerIndex >= 0) return path.slice(0, markerIndex + 1) || "/";
    if (path.endsWith("/index.html")) return path.slice(0, -("index.html".length));
    const slashIndex = path.lastIndexOf("/");
    return slashIndex >= 0 ? `${path.slice(0, slashIndex + 1)}` : "/";
  }

  function requireDirectorSession() {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    if (!token || role !== "Director") {
      window.location.href = `${resolveAppBasePath()}index.html`;
      return false;
    }
    return true;
  }

  function resolveApiBase() {
    const host = window.location.hostname;
    const isLocalHost = host === "localhost" || host === "127.0.0.1";
    const isBackendPort = window.location.port === "4000";
    if (isLocalHost && !isBackendPort) return "http://localhost:4000/api";
    return `${window.location.origin}/api`;
  }

  async function syncSessionUserFromDatabase() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(`${resolveApiBase()}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) return;
      const user = await response.json();
      if (user && typeof user === "object") {
        if (user.name) localStorage.setItem("name", String(user.name));
        if (user.username) localStorage.setItem("username", String(user.username));
        if (user.role) localStorage.setItem("role", String(user.role));
        if (user.branch) localStorage.setItem("branch", String(user.branch));
      }
    } catch {
      // Keep existing local values when sync fails.
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function applySidebarCollapsedState() {
    const isCollapsed = localStorage.getItem(SIDEBAR_STATE_KEY) === "true";
    document.body.classList.toggle("sidebar-collapsed", isCollapsed);
  }

  function wireSidebarToggle() {
    const button = document.getElementById("sidebarToggleBtn");
    if (!button) return;

    const syncButtonState = () => {
      const isCollapsed = document.body.classList.contains("sidebar-collapsed");
      button.setAttribute("aria-expanded", String(!isCollapsed));
      button.title = isCollapsed ? "Expand sidebar" : "Collapse sidebar";
      button.innerHTML = `<i class="fa-solid ${isCollapsed ? "fa-angles-right" : "fa-angles-left"}"></i>`;
    };

    syncButtonState();
    button.addEventListener("click", () => {
      const nextCollapsed = !document.body.classList.contains("sidebar-collapsed");
      document.body.classList.toggle("sidebar-collapsed", nextCollapsed);
      localStorage.setItem(SIDEBAR_STATE_KEY, String(nextCollapsed));
      syncButtonState();
    });
  }

  function resolveNearestHeadingTitle(element, fallbackPrefix, index) {
    const explicit = String(element?.dataset?.title || "").trim();
    if (explicit) return explicit;

    const scopes = [];
    const card = element.closest(".card");
    const section = element.closest("section");
    if (card) scopes.push(card);
    if (section && !scopes.includes(section)) scopes.push(section);
    scopes.push(document);

    for (const scope of scopes) {
      const headings = Array.from(scope.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter((heading) => {
        const text = String(heading.textContent || "").trim();
        if (!text) return false;
        const relation = heading.compareDocumentPosition(element);
        return Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      if (headings.length) {
        return String(headings[headings.length - 1].textContent || "").trim();
      }
    }

    return `${fallbackPrefix} ${index + 1}`;
  }

  function ensureTableAndChartTitles() {
    const tables = Array.from(document.querySelectorAll("main table"));
    tables.forEach((table, index) => {
      const title = resolveNearestHeadingTitle(table, "Table", index);
      let caption = Array.from(table.children).find((child) => child.tagName === "CAPTION");
      if (!caption) {
        caption = document.createElement("caption");
        caption.className = "auto-table-caption";
        table.insertBefore(caption, table.firstChild);
      }
      if (!String(caption.textContent || "").trim()) caption.textContent = title;
      table.setAttribute("aria-label", title);
    });

    const charts = Array.from(document.querySelectorAll("main canvas"));
    charts.forEach((canvas, index) => {
      const title = resolveNearestHeadingTitle(canvas, "Chart", index);
      if (!canvas.getAttribute("title")) canvas.setAttribute("title", title);
      if (!canvas.getAttribute("aria-label")) canvas.setAttribute("aria-label", title);
      canvas.setAttribute("role", "img");
    });
  }

  function enableAutoTablePagination() {
    const DEFAULT_ROWS = 5;
    const tableStates = new WeakMap();
    const observers = new WeakMap();
    let seq = 0;

    function findContainer(table) {
      return table.closest(".table-wrap") || table.parentElement;
    }

    function ensureTableId(table) {
      if (table.id) return table.id;
      seq += 1;
      table.id = `autoTable${seq}`;
      return table.id;
    }

    function ensureMoreButton(table) {
      const container = findContainer(table);
      if (!container) return null;
      const tableId = ensureTableId(table);

      let button = document.querySelector(`button.auto-table-more-btn[data-table-more-for="${tableId}"]`);
      if (!button) {
        const sibling = container.nextElementSibling;
        if (sibling instanceof HTMLButtonElement && sibling.classList.contains("auto-table-more-btn") && sibling.dataset.tableMoreFor === tableId) {
          button = sibling;
        }
      }

      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "btn auto-table-more-btn";
        button.style.width = "auto";
        button.style.marginTop = "10px";
        button.dataset.tableMoreFor = tableId;
        container.insertAdjacentElement("afterend", button);
      }
      return button;
    }

    function applyPagination(table) {
      const body = table.querySelector("tbody");
      if (!body) return;
      const rows = Array.from(body.querySelectorAll(":scope > tr"));
      const dataRows = rows.filter((row) => row.querySelector("td"));
      if (dataRows.length <= DEFAULT_ROWS) {
        dataRows.forEach((row) => { row.style.display = ""; });
        const button = ensureMoreButton(table);
        if (button) button.style.display = "none";
        return;
      }

      const state = tableStates.get(table) || { expanded: false };
      const expanded = Boolean(state.expanded);
      dataRows.forEach((row, index) => {
        row.style.display = (!expanded && index >= DEFAULT_ROWS) ? "none" : "";
      });

      const button = ensureMoreButton(table);
      if (!button) return;
      button.style.display = "inline-flex";
      button.textContent = expanded ? "Less" : "More";
      button.onclick = () => {
        tableStates.set(table, { expanded: !expanded });
        applyPagination(table);
      };
    }

    function trackTable(table) {
      if (!(table instanceof HTMLTableElement)) return;
      const body = table.querySelector("tbody");
      if (!body) return;

      applyPagination(table);
      if (observers.has(table)) return;
      const observer = new MutationObserver(() => applyPagination(table));
      observer.observe(body, { childList: true, subtree: false });
      observers.set(table, observer);
    }

    document.querySelectorAll("main table").forEach(trackTable);
  }

  function injectGlobalPrintTools() {
    if (document.getElementById("globalPrintReportBtn")) return;

    const button = document.createElement("button");
    button.id = "globalPrintReportBtn";
    button.className = "btn global-print-btn";
    button.type = "button";
    button.textContent = "Print Report";

    const modal = document.createElement("div");
    modal.id = "globalPrintModal";
    modal.className = "global-print-modal hidden";
    modal.innerHTML = `
      <div class="global-print-card">
        <div class="table-card-header">
          <h4>Print Report</h4>
          <button id="globalPrintCloseBtn" class="btn filter-toggle-btn" type="button">Close</button>
        </div>
        <div class="report-filters">
          <div class="filter-field">
            <label for="globalPrintScope">Report Type</label>
            <select id="globalPrintScope">
              <option value="entire">Entire Page/Report</option>
              <option value="tables">Tables Only</option>
            </select>
          </div>
          <div class="filter-field">
            <label for="globalPrintDateFrom">Date From</label>
            <input id="globalPrintDateFrom" type="date">
          </div>
          <div class="filter-field">
            <label for="globalPrintDateTo">Date To</label>
            <input id="globalPrintDateTo" type="date">
          </div>
          <div class="filter-field">
            <label for="globalPrintProduce">Produce</label>
            <input id="globalPrintProduce" type="text" placeholder="e.g. beans">
          </div>
        </div>
        <div class="global-print-actions">
          <button id="globalPrintRunBtn" class="btn" type="button">Print</button>
        </div>
      </div>
    `;

    document.body.appendChild(button);
    document.body.appendChild(modal);

    const closeModal = () => modal.classList.add("hidden");
    const openModal = () => modal.classList.remove("hidden");

    function parseDateSafe(value) {
      const dt = new Date(value);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function applyRowFilters(container, produce, from, to) {
      const tables = container.querySelectorAll("table");
      tables.forEach((table) => {
        const body = table.querySelector("tbody");
        if (!body) return;
        const rows = Array.from(body.querySelectorAll("tr"));
        let visibleCount = 0;

        rows.forEach((row) => {
          const text = String(row.textContent || "").toLowerCase();
          if (produce && !text.includes(produce)) {
            row.remove();
            return;
          }

          if (from || to) {
            const firstCell = row.querySelector("td");
            const parsed = parseDateSafe(firstCell ? firstCell.textContent : "");
            if (!parsed) {
              row.remove();
              return;
            }
            if (from && parsed < from) {
              row.remove();
              return;
            }
            if (to && parsed > to) {
              row.remove();
              return;
            }
          }
          visibleCount += 1;
        });

        if (!visibleCount) {
          const cols = table.querySelectorAll("thead th").length || 1;
          body.innerHTML = `<tr><td colspan="${cols}">No records match selected print filters.</td></tr>`;
        }
      });
    }

    function copyChartsAsImages(source, clone) {
      const srcCanvases = Array.from(source.querySelectorAll("canvas"));
      const cloneCanvases = Array.from(clone.querySelectorAll("canvas"));
      const limit = Math.min(srcCanvases.length, cloneCanvases.length);
      for (let i = 0; i < limit; i += 1) {
        const src = srcCanvases[i];
        const target = cloneCanvases[i];
        try {
          const img = document.createElement("img");
          img.src = src.toDataURL("image/png");
          img.style.width = "100%";
          img.style.maxHeight = "320px";
          img.style.objectFit = "contain";
          target.replaceWith(img);
        } catch {
          // Keep canvas when export fails.
        }
      }
    }

    function buildPrintableHtml() {
      const scope = String(document.getElementById("globalPrintScope")?.value || "entire");
      const produce = String(document.getElementById("globalPrintProduce")?.value || "").trim().toLowerCase();
      const fromRaw = String(document.getElementById("globalPrintDateFrom")?.value || "");
      const toRaw = String(document.getElementById("globalPrintDateTo")?.value || "");
      const from = fromRaw ? new Date(`${fromRaw}T00:00:00`) : null;
      const to = toRaw ? new Date(`${toRaw}T23:59:59`) : null;
      const main = document.querySelector("main.main");
      if (!main) return "<p>No report content available.</p>";

      const wrapper = document.createElement("div");
      if (scope === "tables") {
        const cards = Array.from(main.querySelectorAll(".card")).filter((card) => card.querySelector("table"));
        cards.forEach((card) => {
          const clone = card.cloneNode(true);
          copyChartsAsImages(card, clone);
          applyRowFilters(clone, produce, from, to);
          wrapper.appendChild(clone);
        });
      } else {
        const clone = main.cloneNode(true);
        copyChartsAsImages(main, clone);
        applyRowFilters(clone, produce, from, to);
        wrapper.appendChild(clone);
      }

      const title = escapeHtml(document.body.dataset.pageTitle || "Report");
      return `
        <h2 style="margin:0 0 10px 0;">${title}</h2>
        <p style="margin:0 0 14px 0; color:#475569; font-size:12px;">
          Filters: Type=${scope === "tables" ? "Tables Only" : "Entire Page/Report"} | Date From=${fromRaw || "Any"} | Date To=${toRaw || "Any"} | Produce=${escapeHtml(produce || "Any")}
        </p>
        ${wrapper.innerHTML}
      `;
    }

    function runPrint() {
      const win = window.open("", "_blank", "width=1100,height=800");
      if (!win) return;
      win.document.write(`
        <html>
          <head>
            <title>Report Print</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 16px; color: #0f172a; }
              .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border: 1px solid #cbd5e1; padding: 6px; font-size: 12px; text-align: left; }
              th { background: #f1f5f9; }
              .btn, button { display: none !important; }
            </style>
          </head>
          <body>${buildPrintableHtml()}</body>
        </html>
      `);
      win.document.close();
      win.focus();
      win.print();
      win.close();
    }

    button.addEventListener("click", openModal);
    document.getElementById("globalPrintCloseBtn")?.addEventListener("click", closeModal);
    document.getElementById("globalPrintRunBtn")?.addEventListener("click", runPrint);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });
  }

  function injectBackButton() {
    if (document.getElementById("globalBackBtn")) return;
    const button = document.createElement("button");
    button.id = "globalBackBtn";
    button.className = "btn global-back-btn";
    button.type = "button";
    button.textContent = "Back";
    button.style.position = "fixed";
    button.style.right = "20px";
    button.style.bottom = "20px";
    button.style.zIndex = "1200";
    button.style.width = "auto";

    const fallback = `${resolveAppBasePath()}pages/director/dashboard.html`;
    button.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      window.location.href = fallback;
    });

    document.body.appendChild(button);
  }

  async function renderDirectorLayout() {
    if (!requireDirectorSession()) return;
    await syncSessionUserFromDatabase();
    applySidebarCollapsedState();

    const topbarHost = document.getElementById("directorTopbar");
    const sidebarHost = document.getElementById("directorSidebar");
    if (!topbarHost || !sidebarHost) return;

    const pageTitle = document.body.dataset.pageTitle || "Director Dashboard";
    let activeNav = document.body.dataset.activeNav || "dashboard";
    const inUserManagement = window.location.pathname.includes("/pages/director/user_management/");
    const dashboardHref = inUserManagement ? "../dashboard.html" : "dashboard.html";
    const administrationHref = inUserManagement ? "user-management.html" : "user_management/user-management.html";
    const assetBase = inUserManagement ? "../../../assets" : "../../assets";
    const username = localStorage.getItem("username") || "Director";
    const displayName = localStorage.getItem("name") || username || "Director";
    const imageSrc = localStorage.getItem("profileImage") || `${assetBase}/images/profile.jpg`;
    const hash = window.location.hash;

    if (!inUserManagement) {
      if (hash === "#view-stock") activeNav = "view-stock";
      if (hash === "#view-cash-sales") activeNav = "view-cash-sales";
      if (hash === "#view-credit-sales") activeNav = "view-credit-sales";
      if (hash === "#general-report") activeNav = "general-report";
    }

    topbarHost.innerHTML = `
      <header class="topbar">
        <div class="topbar-left">
          <img src="${assetBase}/images/logo1.png" class="logo-img" alt="Karibu Groceries LTD Logo">
          <button id="sidebarToggleBtn" class="sidebar-toggle-btn" type="button" aria-label="Toggle sidebar"></button>
        </div>
        <h2 class="topbar-left-h2">${escapeHtml(pageTitle)}</h2>
        <div class="profile-dropdown" id="directorProfileDropdown">
          <img src="${escapeHtml(imageSrc)}" class="profile-img" alt="Profile">
          <div class="dropdown-menu" id="directorDropdownMenu">
            <a href="#" id="directorLogoutBtn">
              <i class="fa-solid fa-right-from-bracket"></i> Logout
            </a>
          </div>
        </div>
      </header>
    `;

    sidebarHost.innerHTML = `
      <aside class="sidebar">
        <div class="sidebar-scroll">
          <ul>
            <li data-nav="dashboard">
              <a href="${dashboardHref}">
                <i class="fa-solid fa-chart-line"></i>
                Dashboard
              </a>
            </li>
            <li data-nav="view-stock">
              <a href="${dashboardHref}#view-stock">
                <i class="fa-solid fa-boxes-stacked"></i>
                View Stock
              </a>
            </li>
            <li data-nav="view-cash-sales">
              <a href="${dashboardHref}#view-cash-sales">
                <i class="fa-solid fa-money-bill-wave"></i>
                View Cash Sales
              </a>
            </li>
            <li data-nav="view-credit-sales">
              <a href="${dashboardHref}#view-credit-sales">
                <i class="fa-solid fa-file-invoice-dollar"></i>
                View Credit Sales
              </a>
            </li>
            <li data-nav="general-report">
              <a href="${dashboardHref}#general-report">
                <i class="fa-solid fa-chart-pie"></i>
                General Report (Aggregated)
              </a>
            </li>
            <li data-nav="administration">
              <a href="${administrationHref}">
                <i class="fa-solid fa-users"></i>
                Administration
              </a>
            </li>
          </ul>
        </div>

        <div class="sidebar-footer">
          <img src="${escapeHtml(imageSrc)}" class="sidebar-user-img" alt="${escapeHtml(displayName)}">
          <div class="sidebar-user-meta">
            <p class="sidebar-user-name">${escapeHtml(displayName)}</p>
            <p class="sidebar-user-role">Director</p>
          </div>
        </div>
      </aside>
    `;

    const activeItem = sidebarHost.querySelector(`[data-nav="${activeNav}"]`);
    if (activeItem) activeItem.classList.add("active");

    const dropdown = document.getElementById("directorProfileDropdown");
    const menu = document.getElementById("directorDropdownMenu");
    const logoutBtn = document.getElementById("directorLogoutBtn");

    if (dropdown && menu) {
      dropdown.addEventListener("click", (event) => {
        event.stopPropagation();
        menu.classList.toggle("show");
      });

      document.addEventListener("click", (event) => {
        if (!dropdown.contains(event.target)) {
          menu.classList.remove("show");
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", (event) => {
        event.preventDefault();
        localStorage.removeItem("token");
        window.location.href = `${resolveAppBasePath()}index.html`;
      });
    }

    wireSidebarToggle();
    injectBackButton();
    injectGlobalPrintTools();
    ensureTableAndChartTitles();
    enableAutoTablePagination();
  }

  window.renderDirectorLayout = renderDirectorLayout;
  document.addEventListener("DOMContentLoaded", renderDirectorLayout);
})();

