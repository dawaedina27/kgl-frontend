// I keep these as mutable values because I refresh them from /api/auth/me (database-backed user profile).
let branch = localStorage.getItem("branch") || "";
let username = localStorage.getItem("username") || "";
let role = localStorage.getItem("role") || "";

// I keep chart instances so I can destroy/recreate them cleanly during refreshes.
let weeklySalesChartInstance = null;
let cashCreditPieChartInstance = null;
// I keep fetched rows in one place so multiple render functions can reuse the same data.
let latestRows = [];

// Function: API base resolver.
// Why: I support both local split-host mode and same-origin deployment without hardcoding one URL.
const API_BASE = (() => {
  const host = window.location.hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  const isBackendPort = window.location.port === "4000";
  if (isLocalHost && !isBackendPort) return "http://localhost:4000/api";
  return `${window.location.origin}/api`;
})();

// Function: normalizeHex(value, fallback).
// Why: I normalize CSS color values so Chart.js always receives valid 6-digit HEX colors.
function normalizeHex(value, fallback) {
  const raw = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return fallback;
}

// Function: buildChartTheme().
// Why: I read chart colors from CSS variables so UI theme and charts stay visually consistent.
function buildChartTheme() {
  const css = window.getComputedStyle(document.documentElement);
  const readVar = (name, fallback) => normalizeHex(css.getPropertyValue(name), fallback);
  return {
    text: readVar("--chart-text", "#0F172A"),
    ticks: readVar("--chart-ticks", "#334155"),
    grid: readVar("--chart-grid", "#E2E8F0"),
    cash: readVar("--chart-cash", "#16A34A"),
    credit: readVar("--chart-credit", "#3B82F6")
  };
}

// I compute theme once because these values are static during page lifetime.
const CHART_THEME = buildChartTheme();

// Function: normalizeText(value).
// Why: I compare usernames and text fields case-insensitively and without whitespace issues.
function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

// Function: normalizeSaleType(value).
// Why: I make sale type checks reliable even if backend casing/spacing varies.
function normalizeSaleType(value) {
  return String(value || "").trim().toLowerCase();
}

// Function: toFiniteNumber(value).
// Why: I protect calculations from NaN and invalid numeric inputs.
function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

// Function: getSaleAmount(row).
// Why: I use the correct amount source depending on sale type (cash vs credit), with fallback safety.
function getSaleAmount(row) {
  const saleType = normalizeSaleType(row.saleType);
  const amountPaid = toFiniteNumber(row.amountPaid);
  const amountDue = toFiniteNumber(row.amountDue);
  const fallbackAmount = toFiniteNumber(row.amount);
  if (saleType === "cash") return amountPaid || fallbackAmount;
  if (saleType === "credit") return amountDue || fallbackAmount;
  return fallbackAmount || amountPaid || amountDue;
}

// Function: fmtUGX(value).
// Why: I standardize all money output in UGX currency format for UI consistency.
function fmtUGX(value) {
  return "UGX " + Number(value || 0).toLocaleString();
}

// Function: toDateSafe(value).
// Why: I convert date input safely and skip invalid timestamps without crashing render logic.
function toDateSafe(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Function: isSalesAgentRole().
// Why: I allow both role spellings currently used in this project.
function isSalesAgentRole() {
  return role === "sales-agent" || role === "SalesAgent";
}

// Function: getToken().
// Why: I centralize token reading so auth logic stays consistent.
function getToken() {
  return localStorage.getItem("token") || "";
}

// Function: fetchCurrentUserFromDatabase().
// Why: I load the authenticated user profile from backend so dashboard identity is sourced from DB, not defaults.
async function fetchCurrentUserFromDatabase() {
  const token = getToken();
  if (!token) throw new Error("Missing auth token.");

  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Failed to load session profile.");
  }
  return data;
}

// Function: hydrateIdentityFromDatabase().
// Why: I synchronize branch/username/role from DB and persist them to localStorage for other pages.
async function hydrateIdentityFromDatabase() {
  const me = await fetchCurrentUserFromDatabase();
  username = String(me.username || me.name || "").trim();
  branch = String(me.branch || "").trim();
  role = String(me.role || "").trim();

  if (username) localStorage.setItem("username", username);
  if (branch) localStorage.setItem("branch", branch);
  if (role) localStorage.setItem("role", role);
}

// Function: ensureAgentAccess().
// Why: I block unauthorized access to this page and redirect to login when session is invalid.
function ensureAgentAccess() {
  const token = getToken();
  if (!token || !isSalesAgentRole()) {
    window.location.href = "../../index.html";
    return false;
  }
  return true;
}

// Function: api(path).
// Why: I use one request helper that always applies JSON headers and optional bearer token.
async function api(path) {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = await response.json().catch(() => ([]));
  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
}

// Function: isSameDate(a, b).
// Why: I compare calendar day only (year/month/date), ignoring time portion.
function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

// Function: getLast7DayLabels().
// Why: I build date buckets for weekly chart grouping, normalized to midnight for safe matching.
function getLast7DayLabels() {
  const labels = [];
  const now = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const dt = new Date(now);
    dt.setHours(0, 0, 0, 0);
    dt.setDate(now.getDate() - i);
    labels.push(dt);
  }
  return labels;
}

// Function: getCashRows().
// Why: I isolate cash rows so KPI/chart logic stays simple and readable.
function getCashRows() {
  return latestRows.filter((row) => normalizeSaleType(row.saleType) === "cash");
}

// Function: getCreditRows().
// Why: I isolate credit rows for separate metrics and chart segments.
function getCreditRows() {
  return latestRows.filter((row) => normalizeSaleType(row.saleType) === "credit");
}

// Function: updateKpis().
// Why: I compute and render all KPI cards from current dataset in one pass.
function updateKpis() {
  const cashRows = getCashRows();
  const creditRows = getCreditRows();
  const now = new Date();

  const todayCash = cashRows
    .filter((row) => {
      const dt = toDateSafe(row.createdAt);
      return dt ? isSameDate(dt, now) : false;
    })
    .reduce((sum, row) => sum + getSaleAmount(row), 0);

  const todayCredit = creditRows
    .filter((row) => {
      const dt = toDateSafe(row.createdAt);
      return dt ? isSameDate(dt, now) : false;
    })
    .reduce((sum, row) => sum + getSaleAmount(row), 0);

  const cashTotal = cashRows.reduce((sum, row) => sum + getSaleAmount(row), 0);
  const creditTotal = creditRows.reduce((sum, row) => sum + getSaleAmount(row), 0);

  const kpiTodaySalesEl = document.getElementById("kpiTodaySales");
  const kpiCashEl = document.getElementById("kpiCash");
  const kpiCreditEl = document.getElementById("kpiCredit");
  const kpiTotalCreditGivenEl = document.getElementById("kpiTotalCreditGiven");

  if (kpiTodaySalesEl) kpiTodaySalesEl.textContent = fmtUGX(todayCash + todayCredit);
  if (kpiCashEl) kpiCashEl.textContent = fmtUGX(cashTotal);
  if (kpiCreditEl) kpiCreditEl.textContent = fmtUGX(creditTotal);
  if (kpiTotalCreditGivenEl) kpiTotalCreditGivenEl.textContent = fmtUGX(creditTotal);
}

// Function: renderWeeklySalesChart().
// Why: I show daily cash-vs-credit comparison for the last seven days.
function renderWeeklySalesChart() {
  const cashRows = getCashRows();
  const creditRows = getCreditRows();
  const canvas = document.getElementById("weeklySalesChart");
  if (!canvas || typeof Chart === "undefined") return;

  const labels = getLast7DayLabels();
  const cashTotals = labels.map((labelDate) => cashRows
    .filter((row) => {
      const dt = toDateSafe(row.createdAt);
      return dt ? isSameDate(dt, labelDate) : false;
    })
    .reduce((sum, row) => sum + getSaleAmount(row), 0));

  const creditTotals = labels.map((labelDate) => creditRows
    .filter((row) => {
      const dt = toDateSafe(row.createdAt);
      return dt ? isSameDate(dt, labelDate) : false;
    })
    .reduce((sum, row) => sum + getSaleAmount(row), 0));

  // I destroy old chart first to prevent overlapping canvases and memory leaks.
  if (weeklySalesChartInstance) weeklySalesChartInstance.destroy();
  weeklySalesChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: labels.map((d) => d.toLocaleDateString()),
      datasets: [
        { label: "Cash Sales (UGX)", data: cashTotals, backgroundColor: CHART_THEME.cash },
        { label: "Credit Sales (UGX)", data: creditTotals, backgroundColor: CHART_THEME.credit }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: CHART_THEME.ticks }, grid: { color: CHART_THEME.grid } },
        x: { ticks: { color: CHART_THEME.ticks }, grid: { display: false } }
      }
    }
  });
}

// Function: renderCashCreditPieChart().
// Why: I show overall proportional split between cash and credit sales totals.
function renderCashCreditPieChart() {
  const cashRows = getCashRows();
  const creditRows = getCreditRows();
  const canvas = document.getElementById("cashCreditPieChart");
  if (!canvas || typeof Chart === "undefined") return;

  const cashTotal = cashRows.reduce((sum, row) => sum + getSaleAmount(row), 0);
  const creditTotal = creditRows.reduce((sum, row) => sum + getSaleAmount(row), 0);

  // I destroy old chart first so updated data always renders correctly.
  if (cashCreditPieChartInstance) cashCreditPieChartInstance.destroy();
  cashCreditPieChartInstance = new Chart(canvas, {
    type: "pie",
    data: {
      labels: ["Cash Sales", "Credit Sales"],
      datasets: [{ data: [cashTotal, creditTotal], backgroundColor: [CHART_THEME.cash, CHART_THEME.credit] }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: CHART_THEME.text } } }
    }
  });
}

// Function: renderRecentTransactions().
// Why: I show latest 10 transactions to give a quick recent-activity snapshot.
function renderRecentTransactions() {
  const recentTxRowsEl = document.getElementById("recentTxRows");
  if (!recentTxRowsEl) return;

  const rows = latestRows
    .map((row) => ({
      time: row.createdAt,
      type: row.saleType === "cash" ? "Cash" : "Credit",
      produce: row.produce || "-",
      amount: getSaleAmount(row),
      buyer: row.buyer || "-"
    }))
    .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
    .slice(0, 10);

  if (!rows.length) {
    recentTxRowsEl.innerHTML = '<tr><td colspan="5" class="empty-row">No transactions found.</td></tr>';
    return;
  }

  recentTxRowsEl.innerHTML = rows
    .map((row) => `
      <tr>
        <td>${row.time ? new Date(row.time).toLocaleString() : "-"}</td>
        <td>${row.type}</td>
        <td>${row.produce}</td>
        <td>${fmtUGX(row.amount)}</td>
        <td>${row.buyer}</td>
      </tr>
    `)
    .join("");
}

// Function: loadAgentDashboard().
// Why: I orchestrate access check, data fetch, filtering, and all dashboard renders here.
async function loadAgentDashboard() {
  if (!getToken()) {
    window.location.href = "../../index.html";
    return;
  }

  try {
    await hydrateIdentityFromDatabase();
  } catch (error) {
    console.error(error);
    window.location.href = "../../index.html";
    return;
  }

  if (!ensureAgentAccess()) return;
  const agentNameEl = document.getElementById("agentName");
  if (agentNameEl) agentNameEl.textContent = username || "Sales Agent";

  try {
    const rows = await api(`/sales?branch=${encodeURIComponent(branch || "Maganjo")}`);
    const me = normalizeText(username);
    latestRows = (Array.isArray(rows) ? rows : []).filter((row) => normalizeText(row.agent) === me);

    updateKpis();
    renderWeeklySalesChart();
    renderCashCreditPieChart();
    renderRecentTransactions();
  } catch (error) {
    console.error(error);
  }
}

// Function: wireQuickActions().
// Why: I keep all dashboard shortcut-button wiring in one place.
function wireQuickActions() {
  const recordSaleBtn = document.getElementById("qaRecordSaleBtn");
  const trackCreditBtn = document.getElementById("qaTrackCreditBtn");
  const viewReportsBtn = document.getElementById("qaViewReportsBtn");

  if (recordSaleBtn) recordSaleBtn.addEventListener("click", () => { window.location.href = "salesAgent.html"; });
  if (trackCreditBtn) trackCreditBtn.addEventListener("click", () => { window.location.href = "collections.html"; });
  if (viewReportsBtn) viewReportsBtn.addEventListener("click", () => { window.location.href = "reports.html"; });
}

// I run initial dashboard data load when DOM is ready.
window.addEventListener("DOMContentLoaded", loadAgentDashboard);
// I wire button actions on DOM ready so elements already exist.
window.addEventListener("DOMContentLoaded", wireQuickActions);

