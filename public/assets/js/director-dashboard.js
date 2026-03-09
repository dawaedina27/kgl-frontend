// Developer note from me: I wrote and maintain this file for the KGL system, and I keep this logic explicit so future updates are safer.
const API_BASE = `${window.location.origin}/api`;
const LOW_STOCK_THRESHOLD = 500;

let branchFilterEl;
let agentFilterEl;
let saleTypeFilterEl;
let dateFromFilterEl;
let dateToFilterEl;
let applyFiltersBtn;
let resetFiltersBtn;
let downloadPdfBtn;
let downloadCsvBtn;
let downloadJsonBtn;
let downloadTxtBtn;
let downloadScopeEl;
let downloadDateFromEl;
let downloadDateToEl;
let downloadProduceEl;
let aggregateRowsEl;
let stockRowsEl;
let toggleFiltersBtn;
let toggleDownloadBtn;
let filterPanelEl;
let downloadPanelEl;
let moreBtnEl;
let cashSalesRowsEl;
let creditSalesRowsEl;
let stockTotalTonnageEl;
let totalProduceProcuredEl;
let lowestProcuredProduceEl;
let highestProcuredProduceEl;
let lowStockItemsEl;
let outOfStockItemsEl;
let salesKpisPrimaryEl;
let salesKpisSecondaryEl;
let salesChartsEl;
let quickActionsEl;
let policyCardEl;
let generalReportEl;
let cashSalesSectionEl;
let creditSalesSectionEl;
let stockSectionEl;
let damagedProduceSectionEl;
let returnedGoodsSectionEl;
let cashTotalSalesEl;
let cashWeeklyTurnoverEl;
let cashTopProduceEl;
let cashTopBranchEl;
let cashTopAgentEl;
let creditTotalSalesEl;
let creditTransactionsEl;
let creditOverdueEl;
let creditTopBranchEl;
let printCashBtnEl;
let cashSalesTableEl;
let dirDamagedProduceRowsEl;
let dirReturnedGoodsRowsEl;
let dirDamagedImageModalEl;
let dirDamagedImageModalPreviewEl;
let dirCloseDamagedImageModalBtn;

let filteredSalesRows = [];
let aggregatedRows = [];
let showAllRows = false;
let branchSalesChart = null;
let produceRankingChart = null;
let stockByBranchChart = null;
let stockTypePieChart = null;
let cashBranchChart = null;
let cashProducePieChart = null;
let creditBranchChart = null;
let creditProducePieChart = null;
let financialMixPieChart = null;
let weeklyProduceLineChart = null;
let apiSalesRowsCache = [];
let dirDamagedRecordMap = new Map();

function normalizeHex(value, fallback) {
  const raw = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return fallback;
}

function hexToRgb(hex) {
  const safeHex = normalizeHex(hex, "#000000");
  const int = parseInt(safeHex.slice(1), 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255
  };
}

function rgbToHex(r, g, b) {
  const toHex = (num) => Math.max(0, Math.min(255, Math.round(num))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHex(baseHex, blendHex, ratio = 0.5) {
  const clamped = Math.max(0, Math.min(1, Number(ratio)));
  const a = hexToRgb(baseHex);
  const b = hexToRgb(blendHex);
  return rgbToHex(
    a.r + (b.r - a.r) * clamped,
    a.g + (b.g - a.g) * clamped,
    a.b + (b.b - a.b) * clamped
  );
}

function buildChartTheme() {
  const css = window.getComputedStyle(document.documentElement);
  const readVar = (name, fallback) => normalizeHex(css.getPropertyValue(name), fallback);
  const palette = [
    readVar("--chart-p1", "#0F766E"),
    readVar("--chart-p2", "#16A34A"),
    readVar("--chart-p3", "#3B82F6"),
    readVar("--chart-p4", "#F59E0B"),
    readVar("--chart-p5", "#EF4444"),
    readVar("--chart-p6", "#7C3AED"),
    readVar("--chart-p7", "#06B6D4"),
    readVar("--chart-p8", "#84CC16"),
    readVar("--chart-p9", "#F97316"),
    readVar("--chart-p10", "#14B8A6")
  ];

  return {
    text: readVar("--chart-text", "#0F172A"),
    ticks: readVar("--chart-ticks", "#334155"),
    grid: readVar("--chart-grid", "#E2E8F0"),
    neutral: readVar("--chart-neutral", "#64748B"),
    cash: readVar("--chart-cash", "#16A34A"),
    credit: readVar("--chart-credit", "#3B82F6"),
    stock: readVar("--chart-stock", "#06B6D4"),
    procurement: readVar("--chart-procurement", "#1E293B"),
    profit: readVar("--chart-profit", "#22C55E"),
    loss: readVar("--chart-loss", "#EF4444"),
    palette
  };
}

const CHART_THEME = buildChartTheme();
const CHART_PALETTE = CHART_THEME.palette;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveAppBasePath() {
  const path = window.location.pathname;
  const marker = "/pages/director/";
  const markerIndex = path.indexOf(marker);
  if (markerIndex >= 0) return path.slice(0, markerIndex + 1) || "/";
  if (path.endsWith("/index.html")) return path.slice(0, -("index.html".length));
  const slashIndex = path.lastIndexOf("/");
  return slashIndex >= 0 ? `${path.slice(0, slashIndex + 1)}` : "/";
}

// Block access when session is missing or role is not Director.
function ensureDirectorSession() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  if (!token || role !== "Director") {
    window.location.href = `${resolveAppBasePath()}index.html`;
    return false;
  }
  return true;
}

// Format amounts consistently for dashboard cards and tables.
function fmtUGX(value) {
  return "UGX " + Number(value || 0).toLocaleString();
}

function getStockStatus(value) {
  const qty = Number(value || 0);
  if (qty <= 0) return "Out of Stock";
  if (qty <= LOW_STOCK_THRESHOLD) return "Low Stock";
  return "Available";
}

function getStockStatusClass(status) {
  const key = String(status || "").trim().toLowerCase();
  if (key === "out of stock") return "stock-status-out";
  if (key === "low stock") return "stock-status-low";
  return "stock-status-available";
}

// Convert unknown date strings safely without throwing.
function toDateSafe(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function getStartOfWeek(dateValue = new Date()) {
  const date = new Date(dateValue);
  const day = date.getDay(); // 0=Sunday
  const diffToMonday = day === 0 ? 6 : day - 1;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - diffToMonday);
  return date;
}

function getToken() {
  return localStorage.getItem("token") || "";
}

async function api(path, options = {}) {
  // Include JWT token for protected backend endpoints.
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "API request failed.");
  }
  return data;
}

// Check whether a record falls inside optional date range filters.
function matchesDateFilter(rowDateValue, from, to) {
  if (!from && !to) return true;
  const rowDate = toDateSafe(rowDateValue);
  if (!rowDate) return false;

  if (from) {
    const fromDate = new Date(`${from}T00:00:00`);
    if (rowDate < fromDate) return false;
  }

  if (to) {
    const toDate = new Date(`${to}T23:59:59`);
    if (rowDate > toDate) return false;
  }

  return true;
}

async function getNormalizedSalesRowsFromApi() {
  const rows = await api("/sales");
  const normalized = (Array.isArray(rows) ? rows : []).map((row) => ({
    saleType: normalizeText(row.saleType),
    branch: row.branch || "Unknown",
    agent: row.agent || "Unassigned",
    produce: row.produce || "-",
    tonnage: toFiniteNumber(row.tonnage),
    amount: (() => {
      const saleType = normalizeText(row.saleType);
      const amountPaid = toFiniteNumber(row.amountPaid);
      const amountDue = toFiniteNumber(row.amountDue);
      const fallbackAmount = toFiniteNumber(row.amount);
      if (saleType === "cash") return amountPaid || fallbackAmount;
      if (saleType === "credit") return amountDue || fallbackAmount;
      return fallbackAmount || amountPaid || amountDue;
    })(),
    dueDate: row.dueDate || "",
    createdAt: row.createdAt || null
  }));
  apiSalesRowsCache = normalized;
  return normalized;
}

function getFilterState() {
  return {
    branch: branchFilterEl ? branchFilterEl.value : "all",
    agent: agentFilterEl ? agentFilterEl.value : "all",
    saleType: saleTypeFilterEl ? saleTypeFilterEl.value : "all",
    dateFrom: dateFromFilterEl ? dateFromFilterEl.value : "",
    dateTo: dateToFilterEl ? dateToFilterEl.value : ""
  };
}

function applySalesFilters(rows) {
  const { branch, agent, saleType, dateFrom, dateTo } = getFilterState();

  return rows.filter((row) => {
    if (branch !== "all" && row.branch !== branch) return false;
    if (agent !== "all" && row.agent !== agent) return false;
    if (saleType !== "all" && row.saleType !== saleType) return false;
    if (!matchesDateFilter(row.createdAt, dateFrom, dateTo)) return false;
    return true;
  });
}

function aggregateByBranchAndAgent(rows) {
  // Aggregate totals per branch+agent for director performance table.
  const bucket = {};
  rows.forEach((row) => {
    const key = `${row.branch}__${row.agent}`;
    if (!bucket[key]) {
      bucket[key] = {
        branch: row.branch,
        agent: row.agent,
        transactions: 0,
        tonnage: 0,
        cash: 0,
        credit: 0,
        total: 0
      };
    }
    bucket[key].transactions += 1;
    bucket[key].tonnage += Number(row.tonnage || 0);
    bucket[key].total += Number(row.amount || 0);
    if (row.saleType === "cash") bucket[key].cash += Number(row.amount || 0);
    else bucket[key].credit += Number(row.amount || 0);
  });

  return Object.values(bucket).sort((a, b) => b.total - a.total);
}

function renderAggregateTable(rows) {
  if (!aggregateRowsEl) return;
  if (!rows.length) {
    aggregateRowsEl.innerHTML = '<tr><td colspan="7">No matching sales records for selected filters.</td></tr>';
    if (moreBtnEl) moreBtnEl.style.display = "none";
    return;
  }

  // Default to five rows and reveal all on "More".
  const rowsToShow = showAllRows ? rows : rows.slice(0, 5);
  aggregateRowsEl.innerHTML = rowsToShow
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.branch)}</td>
          <td>${escapeHtml(row.agent)}</td>
          <td>${row.transactions}</td>
          <td>${row.tonnage.toLocaleString()}</td>
          <td>${fmtUGX(row.cash)}</td>
          <td>${fmtUGX(row.credit)}</td>
          <td>${fmtUGX(row.total)}</td>
        </tr>
      `
    )
    .join("");

  if (moreBtnEl) {
    if (rows.length <= 5) {
      moreBtnEl.style.display = "none";
    } else {
      moreBtnEl.style.display = "inline-flex";
      moreBtnEl.textContent = showAllRows ? "Less" : "More";
    }
  }
}

function getAllDamagedProduceRows() {
  const prefix = "manager_damaged_produce_";
  const rows = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i) || "";
    if (!key.startsWith(prefix)) continue;
    const branch = key.slice(prefix.length) || "Unknown";
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(parsed)) continue;
      parsed.forEach((row) => {
        rows.push({
          ...row,
          branch: row?.branch || branch
        });
      });
    } catch {
      // Ignore malformed local records.
    }
  }
  return rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function getAllReturnedGoodsRows() {
  const prefix = "manager_returned_goods_";
  const rows = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i) || "";
    if (!key.startsWith(prefix)) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(parsed)) continue;
      parsed.forEach((row) => rows.push(row));
    } catch {
      // Ignore malformed local records.
    }
  }
  return rows.sort((a, b) => new Date(b.returnedAt || 0) - new Date(a.returnedAt || 0));
}

function closeDirectorDamagedImageModal() {
  if (!dirDamagedImageModalEl || !dirDamagedImageModalPreviewEl) return;
  dirDamagedImageModalEl.classList.add("hidden");
  dirDamagedImageModalPreviewEl.src = "";
}

function openDirectorDamagedImageModal(imageUrl) {
  if (!dirDamagedImageModalEl || !dirDamagedImageModalPreviewEl) return;
  dirDamagedImageModalPreviewEl.src = String(imageUrl || "");
  dirDamagedImageModalEl.classList.remove("hidden");
}

function renderDirectorDamagedProduceTable() {
  if (!dirDamagedProduceRowsEl) return;
  const rows = getAllDamagedProduceRows();
  dirDamagedRecordMap = new Map();

  if (!rows.length) {
    dirDamagedProduceRowsEl.innerHTML = '<tr><td colspan="8">No damaged produce records available.</td></tr>';
    return;
  }

  dirDamagedProduceRowsEl.innerHTML = rows
    .slice(0, 500)
    .map((row, index) => {
      const recordKey = `${row.id || "row"}_${index}`;
      dirDamagedRecordMap.set(recordKey, row);
      return `
        <tr>
          <td>${escapeHtml(row.damageDate || "-")}</td>
          <td>${escapeHtml(row.branch || "-")}</td>
          <td>${escapeHtml(row.produce || "-")}</td>
          <td>${escapeHtml(row.lotNumber || "-")}</td>
          <td>${Number(row.quantity || 0).toLocaleString()}</td>
          <td>${escapeHtml(row.cause || "-")}</td>
          <td>${escapeHtml(row.recordedBy || "-")}</td>
          <td>
            ${row.imageDataUrl
              ? `<button class="row-btn collect-btn" data-dir-damage-image-id="${recordKey}">View Image</button>`
              : "No image"}
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderDirectorReturnedGoodsTable() {
  if (!dirReturnedGoodsRowsEl) return;
  const rows = getAllReturnedGoodsRows();

  if (!rows.length) {
    dirReturnedGoodsRowsEl.innerHTML = '<tr><td colspan="12">No returned goods records available.</td></tr>';
    return;
  }

  dirReturnedGoodsRowsEl.innerHTML = rows
    .slice(0, 1000)
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.returnId || "-")}</td>
        <td>${escapeHtml(row.originalSaleId || "-")}</td>
        <td>${escapeHtml(row.saleType === "credit" ? "Credit" : "Cash")}</td>
        <td>${escapeHtml(formatDateTime(row.returnedAt))}</td>
        <td>${escapeHtml(row.branch || "-")}</td>
        <td>${escapeHtml(row.buyer || "-")}</td>
        <td>${escapeHtml(row.produce || "-")}</td>
        <td>${Number(row.tonnage || 0).toLocaleString()}</td>
        <td>${fmtUGX(row.amount || 0)}</td>
        <td>${escapeHtml(row.returnedBy || "-")}</td>
        <td>${escapeHtml(row.condition || "-")}</td>
        <td>${escapeHtml(row.reason || "-")}</td>
      </tr>
    `)
    .join("");
}

function formatDateTime(value) {
  const date = toDateSafe(value);
  return date ? date.toLocaleString() : "-";
}

function renderCashSalesTable(rows) {
  if (!cashSalesRowsEl) return;
  const cashRows = rows.filter((row) => row.saleType === "cash");
  if (!cashRows.length) {
    cashSalesRowsEl.innerHTML = '<tr><td colspan="6">No cash sales found for current filters.</td></tr>';
    return;
  }

  cashSalesRowsEl.innerHTML = cashRows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(formatDateTime(row.createdAt))}</td>
          <td>${escapeHtml(row.branch)}</td>
          <td>${escapeHtml(row.agent)}</td>
          <td>${escapeHtml(row.produce)}</td>
          <td>${Number(row.tonnage || 0).toLocaleString()}</td>
          <td>${fmtUGX(row.amount)}</td>
        </tr>
      `
    )
    .join("");
}

function renderCashSalesCharts(rows) {
  const cashRows = rows.filter((row) => row.saleType === "cash");
  const branchCanvas = document.getElementById("dirCashBranchChart");
  const produceCanvas = document.getElementById("dirCashProducePieChart");
  if (typeof Chart === "undefined") return;

  if (branchCanvas) {
    const byBranch = {};
    cashRows.forEach((row) => {
      const key = String(row.branch || "Unknown");
      byBranch[key] = (byBranch[key] || 0) + Number(row.amount || 0);
    });
    const branchLabels = Object.keys(byBranch);
    const branchValues = branchLabels.map((label) => byBranch[label]);

    if (cashBranchChart) cashBranchChart.destroy();
    cashBranchChart = new Chart(branchCanvas, {
      type: "bar",
      data: {
        labels: branchLabels.length ? branchLabels : ["No Data"],
        datasets: [
          {
            label: "Cash Sales (UGX)",
            data: branchLabels.length ? branchValues : [0],
            backgroundColor: CHART_THEME.cash,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: CHART_THEME.text } } },
        scales: {
          y: { beginAtZero: true, ticks: { color: CHART_THEME.ticks }, grid: { color: CHART_THEME.grid } },
          x: { ticks: { color: CHART_THEME.ticks }, grid: { display: false } }
        }
      }
    });
  }

  if (produceCanvas) {
    const byProduce = {};
    cashRows.forEach((row) => {
      const key = String(row.produce || "Unknown");
      byProduce[key] = (byProduce[key] || 0) + Number(row.amount || 0);
    });
    const produceLabels = Object.keys(byProduce);
    const produceValues = produceLabels.map((label) => byProduce[label]);

    if (cashProducePieChart) cashProducePieChart.destroy();
    cashProducePieChart = new Chart(produceCanvas, {
      type: "pie",
      data: {
        labels: produceLabels.length ? produceLabels : ["No Data"],
        datasets: [
          {
            data: produceLabels.length ? produceValues : [1],
            backgroundColor: CHART_PALETTE
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { color: CHART_THEME.text } } }
      }
    });
  }
}

function applyCashSalesKpis(rows) {
  const cashRows = rows.filter((row) => row.saleType === "cash");
  const totalSales = cashRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const weekStart = getStartOfWeek();
  const weekCashTotal = cashRows.reduce((sum, row) => {
    const createdAt = toDateSafe(row.createdAt);
    if (!createdAt || createdAt < weekStart) return sum;
    return sum + Number(row.amount || 0);
  }, 0);

  const byBranch = {};
  cashRows.forEach((row) => {
    const branch = String(row.branch || "Unknown");
    byBranch[branch] = (byBranch[branch] || 0) + Number(row.amount || 0);
  });
  const topBranch = Object.entries(byBranch).sort((a, b) => b[1] - a[1])[0];

  const byProduce = {};
  cashRows.forEach((row) => {
    const produce = String(row.produce || "Unknown");
    byProduce[produce] = (byProduce[produce] || 0) + Number(row.amount || 0);
  });
  const topProduce = Object.entries(byProduce).sort((a, b) => b[1] - a[1])[0];

  const byAgent = {};
  cashRows.forEach((row) => {
    const agent = String(row.agent || "Unassigned");
    byAgent[agent] = (byAgent[agent] || 0) + Number(row.amount || 0);
  });
  const topAgent = Object.entries(byAgent).sort((a, b) => b[1] - a[1])[0];

  if (cashTotalSalesEl) cashTotalSalesEl.textContent = fmtUGX(totalSales);
  if (cashWeeklyTurnoverEl) cashWeeklyTurnoverEl.textContent = fmtUGX(weekCashTotal);
  if (cashTopProduceEl) cashTopProduceEl.textContent = topProduce ? `${topProduce[0]} (${fmtUGX(topProduce[1])})` : "-";
  if (cashTopBranchEl) cashTopBranchEl.textContent = topBranch ? `${topBranch[0]} (${fmtUGX(topBranch[1])})` : "-";
  if (cashTopAgentEl) cashTopAgentEl.textContent = topAgent ? `${topAgent[0]} (${fmtUGX(topAgent[1])})` : "-";
}

function renderCreditSalesTable(rows) {
  if (!creditSalesRowsEl) return;
  const creditRows = rows.filter((row) => row.saleType === "credit");
  if (!creditRows.length) {
    creditSalesRowsEl.innerHTML = '<tr><td colspan="7">No credit sales found for current filters.</td></tr>';
    return;
  }

  creditSalesRowsEl.innerHTML = creditRows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(formatDateTime(row.createdAt))}</td>
          <td>${escapeHtml(row.branch)}</td>
          <td>${escapeHtml(row.agent)}</td>
          <td>${escapeHtml(row.produce)}</td>
          <td>${Number(row.tonnage || 0).toLocaleString()}</td>
          <td>${fmtUGX(row.amount)}</td>
          <td>${escapeHtml(row.dueDate || "-")}</td>
        </tr>
      `
    )
    .join("");
}

function renderCreditSalesCharts(rows) {
  const creditRows = rows.filter((row) => row.saleType === "credit");
  const branchCanvas = document.getElementById("dirCreditBranchChart");
  const produceCanvas = document.getElementById("dirCreditProducePieChart");
  if (typeof Chart === "undefined") return;

  if (branchCanvas) {
    const byBranch = {};
    creditRows.forEach((row) => {
      const key = String(row.branch || "Unknown");
      byBranch[key] = (byBranch[key] || 0) + Number(row.amount || 0);
    });
    const branchLabels = Object.keys(byBranch);
    const branchValues = branchLabels.map((label) => byBranch[label]);

    if (creditBranchChart) creditBranchChart.destroy();
    creditBranchChart = new Chart(branchCanvas, {
      type: "bar",
      data: {
        labels: branchLabels.length ? branchLabels : ["No Data"],
        datasets: [
          {
            label: "Credit Sales (UGX)",
            data: branchLabels.length ? branchValues : [0],
            backgroundColor: CHART_THEME.credit,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: CHART_THEME.text } } },
        scales: {
          y: { beginAtZero: true, ticks: { color: CHART_THEME.ticks }, grid: { color: CHART_THEME.grid } },
          x: { ticks: { color: CHART_THEME.ticks }, grid: { display: false } }
        }
      }
    });
  }

  if (produceCanvas) {
    const byProduce = {};
    creditRows.forEach((row) => {
      const key = String(row.produce || "Unknown");
      byProduce[key] = (byProduce[key] || 0) + Number(row.amount || 0);
    });
    const produceLabels = Object.keys(byProduce);
    const produceValues = produceLabels.map((label) => byProduce[label]);

    if (creditProducePieChart) creditProducePieChart.destroy();
    creditProducePieChart = new Chart(produceCanvas, {
      type: "pie",
      data: {
        labels: produceLabels.length ? produceLabels : ["No Data"],
        datasets: [
          {
            data: produceLabels.length ? produceValues : [1],
            backgroundColor: CHART_PALETTE
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { color: CHART_THEME.text } } }
      }
    });
  }
}

function applyCreditSalesKpis(rows) {
  const creditRows = rows.filter((row) => row.saleType === "credit");
  const totalCredit = creditRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const transactions = creditRows.length;
  const today = new Date();

  let overdueCount = 0;
  const byBranch = {};
  creditRows.forEach((row) => {
    const branch = String(row.branch || "Unknown");
    byBranch[branch] = (byBranch[branch] || 0) + Number(row.amount || 0);

    const dueDate = toDateSafe(row.dueDate);
    if (dueDate && dueDate < today) overdueCount += 1;
  });
  const topBranch = Object.entries(byBranch).sort((a, b) => b[1] - a[1])[0];

  if (creditTotalSalesEl) creditTotalSalesEl.textContent = fmtUGX(totalCredit);
  if (creditTransactionsEl) creditTransactionsEl.textContent = String(transactions);
  if (creditOverdueEl) creditOverdueEl.textContent = String(overdueCount);
  if (creditTopBranchEl) creditTopBranchEl.textContent = topBranch ? `${topBranch[0]} (${fmtUGX(topBranch[1])})` : "-";
}

function applySummaryToKpis(summary, allSalesRows) {
  // Derive additional insights not returned directly by the summary endpoint.
  const totalCashSales = allSalesRows
    .filter((row) => row.saleType === "cash")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const totalProcurement = Number(summary.totalProcurement || 0);
  const totalDamagedValue = getAllDamagedProduceRows()
    .reduce((sum, row) => sum + (Number(row.quantity || 0) * Number(row.buyingPrice || 0)), 0);
  const totalReturnedGoodsValue = getAllReturnedGoodsRows()
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const atHandProfit = totalCashSales - totalProcurement - totalDamagedValue - totalReturnedGoodsValue;

  const byBranch = {};
  allSalesRows.forEach((row) => {
    byBranch[row.branch] = (byBranch[row.branch] || 0) + Number(row.amount || 0);
  });
  const topBranch = Object.entries(byBranch).sort((a, b) => b[1] - a[1])[0];

  const byProduce = {};
  allSalesRows.forEach((row) => {
    const key = String(row.produce || "-");
    byProduce[key] = (byProduce[key] || 0) + Number(row.amount || 0);
  });
  const topProduce = Object.entries(byProduce).sort((a, b) => b[1] - a[1])[0];

  const totalSalesEl = document.getElementById("dirTotalSales");
  const totalCashSalesEl = document.getElementById("dirTotalCashSales");
  const totalProcurementEl = document.getElementById("dirTotalProcurement");
  const totalProfitEl = document.getElementById("dirTotalProfit");
  const atHandProfitEl = document.getElementById("dirAtHandProfit");
  const outstandingEl = document.getElementById("dirOutstandingCredit");
  const topBranchEl = document.getElementById("dirTopBranch");
  const topProduceEl = document.getElementById("dirTopProduce");
  const overdueEl = document.getElementById("dirOverdueCredits");
  const totalDamagedStockEl = document.getElementById("dirTotalDamagedStock");
  const damagedStockAmountEl = document.getElementById("dirDamagedStockAmount");
  const totalDamagedStockKg = getAllDamagedProduceRows().reduce((sum, row) => sum + Number(row.quantity || 0), 0);

  if (totalSalesEl) totalSalesEl.textContent = fmtUGX(summary.totalSales || 0);
  if (totalCashSalesEl) totalCashSalesEl.textContent = fmtUGX(totalCashSales);
  if (totalProcurementEl) totalProcurementEl.textContent = fmtUGX(totalProcurement);
  if (totalProfitEl) totalProfitEl.textContent = fmtUGX(summary.totalProfit || 0);
  if (atHandProfitEl) atHandProfitEl.textContent = fmtUGX(atHandProfit);
  if (outstandingEl) outstandingEl.textContent = fmtUGX(summary.outstandingCredit || 0);
  if (topBranchEl) topBranchEl.textContent = topBranch ? `${topBranch[0]} (${fmtUGX(topBranch[1])})` : "-";
  if (topProduceEl) topProduceEl.textContent = topProduce ? `${topProduce[0]} (${fmtUGX(topProduce[1])})` : "-";
  if (overdueEl) overdueEl.textContent = String(summary.overdueCredits || 0);
  if (totalDamagedStockEl) totalDamagedStockEl.textContent = `${Number(totalDamagedStockKg || 0).toLocaleString()} kg`;
  if (damagedStockAmountEl) damagedStockAmountEl.textContent = fmtUGX(totalDamagedValue);
}

function computeKpisFallback(allSalesRows, procurementRows = []) {
  // Compute minimum viable KPIs from backend rows when summary API is unavailable.
  const salesTotal = allSalesRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const procurementTotal = procurementRows.reduce((sum, row) => sum + Number(row.cost || 0), 0);
  const profitTotal = salesTotal - procurementTotal;
  applySummaryToKpis(
    { totalSales: salesTotal, totalProcurement: procurementTotal, totalProfit: profitTotal, outstandingCredit: 0, overdueCredits: 0 },
    allSalesRows
  );
}

function renderBranchSalesChart(allSalesRows) {
  // Compare cash and credit value by branch.
  const canvas = document.getElementById("dirBranchSalesChart");
  if (!canvas || typeof Chart === "undefined") return;

  const bucket = {};
  allSalesRows.forEach((row) => {
    const key = row.branch || "Unknown";
    if (!bucket[key]) bucket[key] = { cash: 0, credit: 0 };
    if (row.saleType === "cash") bucket[key].cash += Number(row.amount || 0);
    else bucket[key].credit += Number(row.amount || 0);
  });

  const labels = Object.keys(bucket);
  const cashValues = labels.map((label) => bucket[label].cash);
  const creditValues = labels.map((label) => bucket[label].credit);

  if (branchSalesChart) branchSalesChart.destroy();
  branchSalesChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: labels.length ? labels : ["No Data"],
      datasets: [
        { label: "Cash Sales", data: labels.length ? cashValues : [0], backgroundColor: CHART_THEME.cash, borderRadius: 6 },
        { label: "Credit Sales", data: labels.length ? creditValues : [0], backgroundColor: CHART_THEME.credit, borderRadius: 6 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: CHART_THEME.text } } },
      scales: {
        y: { beginAtZero: true, ticks: { color: CHART_THEME.ticks }, grid: { color: CHART_THEME.grid } },
        x: { ticks: { color: CHART_THEME.ticks }, grid: { display: false } }
      }
    }
  });
}

function renderProduceRankingChart(allSalesRows) {
  // Rank produce by total sales value from highest to lowest.
  const canvas = document.getElementById("dirProduceRankingChart");
  if (!canvas || typeof Chart === "undefined") return;

  const bucket = {};
  allSalesRows.forEach((row) => {
    const key = String(row.produce || "Unknown");
    bucket[key] = (bucket[key] || 0) + Number(row.amount || 0);
  });
  const sorted = Object.entries(bucket).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map((r) => r[0]).slice(0, 10);
  const values = sorted.map((r) => r[1]).slice(0, 10);
  const barColors = (labels.length ? labels : ["No Data"]).map((_, index) => CHART_PALETTE[index % CHART_PALETTE.length]);

  if (produceRankingChart) produceRankingChart.destroy();
  produceRankingChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: labels.length ? labels : ["No Data"],
      datasets: [
        {
          label: "Sales Value (UGX)",
          data: labels.length ? values : [0],
          backgroundColor: barColors
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { color: CHART_THEME.ticks }, grid: { color: CHART_THEME.grid } },
        y: { ticks: { color: CHART_THEME.ticks }, grid: { display: false } }
      }
    }
  });
}

function renderFinancialMixPieChart(allSalesRows, procurementRows = []) {
  const canvas = document.getElementById("dirFinancialMixPieChart");
  if (!canvas || typeof Chart === "undefined") return;

  const cashTotal = allSalesRows
    .filter((row) => row.saleType === "cash")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const creditTotal = allSalesRows
    .filter((row) => row.saleType === "credit")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const procurementTotal = (Array.isArray(procurementRows) ? procurementRows : [])
    .reduce((sum, row) => sum + Number(row.cost || 0), 0);
  const totalSales = cashTotal + creditTotal;
  const profit = Math.max(totalSales - procurementTotal, 0);
  const loss = Math.max(procurementTotal - totalSales, 0);

  const labels = ["Procurement", "Cash Sales", "Credit Sales", "Profit", "Loss"];
  const values = [procurementTotal, cashTotal, creditTotal, profit, loss];

  if (financialMixPieChart) financialMixPieChart.destroy();
  financialMixPieChart = new Chart(canvas, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: [
            CHART_THEME.procurement,
            CHART_THEME.cash,
            CHART_THEME.credit,
            CHART_THEME.profit,
            CHART_THEME.loss
          ]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: CHART_THEME.text } } }
    }
  });
}

function getWeekStartKey(value) {
  const dt = toDateSafe(value);
  if (!dt) return "";
  const day = dt.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() - diffToMonday);
  return dt.toISOString().slice(0, 10);
}

function renderWeeklyProduceLineChart(allSalesRows) {
  const canvas = document.getElementById("dirWeeklyProduceLineChart");
  if (!canvas || typeof Chart === "undefined") return;

  const byProduceTotal = {};
  allSalesRows.forEach((row) => {
    const produce = String(row.produce || "Unknown");
    byProduceTotal[produce] = (byProduceTotal[produce] || 0) + Number(row.amount || 0);
  });
  const topProduces = Object.entries(byProduceTotal)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((entry) => entry[0]);

  const weekSet = new Set();
  allSalesRows.forEach((row) => {
    const key = getWeekStartKey(row.createdAt);
    if (key) weekSet.add(key);
  });
  const allWeekLabels = Array.from(weekSet).sort((a, b) => new Date(a) - new Date(b));
  const labels = allWeekLabels.slice(-8);
  const displayLabels = labels.map((label) => {
    const dt = new Date(`${label}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return label;
    return dt.toLocaleDateString("en-UG", { month: "short", day: "numeric" });
  });

  const datasets = topProduces.map((produce, index) => {
    const byWeek = {};
    allSalesRows.forEach((row) => {
      if (String(row.produce || "Unknown") !== produce) return;
      const key = getWeekStartKey(row.createdAt);
      if (!key) return;
      byWeek[key] = (byWeek[key] || 0) + Number(row.amount || 0);
    });
    return {
      label: produce,
      data: labels.map((label) => byWeek[label] || 0),
      backgroundColor: CHART_PALETTE[index % CHART_PALETTE.length],
      borderRadius: 6,
      borderSkipped: false
    };
  });

  if (!datasets.length || !labels.length) {
    datasets.push({
      label: "No Data",
      data: [0],
      backgroundColor: CHART_THEME.neutral,
      borderRadius: 6,
      borderSkipped: false
    });
  }

  if (weeklyProduceLineChart) weeklyProduceLineChart.destroy();
  weeklyProduceLineChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: displayLabels.length ? displayLabels : ["No Data"],
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: CHART_THEME.text } } },
      scales: {
        y: { beginAtZero: true, ticks: { color: CHART_THEME.ticks }, grid: { color: CHART_THEME.grid } },
        x: { ticks: { color: CHART_THEME.ticks }, grid: { display: false } }
      }
    }
  });
}

function applyStockKpis(stockRows) {
  const totalStock = stockRows.reduce((sum, row) => sum + Number(row.availableStock || 0), 0);
  const totalProduceProcured = new Set(stockRows.map((row) => String(row.produceName || "").trim().toLowerCase()).filter(Boolean)).size;
  const sortedByStock = [...stockRows].sort((a, b) => Number(a.availableStock || 0) - Number(b.availableStock || 0));
  const lowestProduce = sortedByStock[0] || null;
  const highestProduce = sortedByStock[sortedByStock.length - 1] || null;
  const lowStockCount = stockRows.filter((row) => {
    const qty = Number(row.availableStock || 0);
    return qty > 0 && qty <= LOW_STOCK_THRESHOLD;
  }).length;
  const outOfStockCount = stockRows.filter((row) => Number(row.availableStock || 0) <= 0).length;

  if (stockTotalTonnageEl) stockTotalTonnageEl.textContent = `${Number(totalStock).toLocaleString()} kg`;
  if (totalProduceProcuredEl) totalProduceProcuredEl.textContent = String(totalProduceProcured);
  if (lowestProcuredProduceEl) {
    lowestProcuredProduceEl.textContent = lowestProduce
      ? `${String(lowestProduce.produceName || "-")} (${Number(lowestProduce.availableStock || 0).toLocaleString()} kg)`
      : "-";
  }
  if (highestProcuredProduceEl) {
    highestProcuredProduceEl.textContent = highestProduce
      ? `${String(highestProduce.produceName || "-")} (${Number(highestProduce.availableStock || 0).toLocaleString()} kg)`
      : "-";
  }
  if (lowStockItemsEl) lowStockItemsEl.textContent = String(lowStockCount);
  if (outOfStockItemsEl) outOfStockItemsEl.textContent = String(outOfStockCount);
}

function renderStockByBranchChart(stockRows) {
  const canvas = document.getElementById("dirStockByBranchChart");
  if (!canvas || typeof Chart === "undefined") return;

  const bucket = {};
  stockRows.forEach((row) => {
    const branch = String(row.branch || "Unknown");
    bucket[branch] = (bucket[branch] || 0) + Number(row.availableStock || 0);
  });
  const labels = Object.keys(bucket);
  const values = labels.map((label) => bucket[label]);

  if (stockByBranchChart) stockByBranchChart.destroy();
  stockByBranchChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: labels.length ? labels : ["No Data"],
      datasets: [
        {
          label: "Stock (kg)",
          data: labels.length ? values : [0],
          backgroundColor: CHART_THEME.stock,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: CHART_THEME.text } } },
      scales: {
        y: { beginAtZero: true, ticks: { color: CHART_THEME.ticks }, grid: { color: CHART_THEME.grid } },
        x: { ticks: { color: CHART_THEME.ticks }, grid: { display: false } }
      }
    }
  });
}

function renderStockTypePieChart(stockRows) {
  const canvas = document.getElementById("dirStockTypePieChart");
  if (!canvas || typeof Chart === "undefined") return;

  const bucket = {};
  stockRows.forEach((row) => {
    const produceType = String(row.produceType || "Unknown");
    bucket[produceType] = (bucket[produceType] || 0) + Number(row.availableStock || 0);
  });
  const labels = Object.keys(bucket);
  const values = labels.map((label) => bucket[label]);

  if (stockTypePieChart) stockTypePieChart.destroy();
  stockTypePieChart = new Chart(canvas, {
    type: "pie",
    data: {
      labels: labels.length ? labels : ["No Data"],
      datasets: [
        {
          data: labels.length ? values : [1],
          backgroundColor: CHART_PALETTE
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: CHART_THEME.text } } }
    }
  });
}

async function refreshStockReport() {
  if (!stockRowsEl) return;

  try {
    const rows = await api("/stocks");
    const sortedRows = (Array.isArray(rows) ? rows : []).sort((a, b) => {
      const byBranch = String(a.branch || "").localeCompare(String(b.branch || ""));
      if (byBranch !== 0) return byBranch;
      return String(a.produceName || "").localeCompare(String(b.produceName || ""));
    });

    if (!sortedRows.length) {
      stockRowsEl.innerHTML = '<tr><td colspan="7">No stock records available.</td></tr>';
      applyStockKpis([]);
      renderStockByBranchChart([]);
      renderStockTypePieChart([]);
      return;
    }

    stockRowsEl.innerHTML = sortedRows
      .map((row) => {
        const status = getStockStatus(row.availableStock);
        return `
        <tr>
          <td>${escapeHtml(row.branch || "-")}</td>
          <td>${escapeHtml(row.produceName || "-")}</td>
          <td>${escapeHtml(row.produceType || "-")}</td>
          <td>${Number(row.availableStock || 0).toLocaleString()}</td>
          <td><span class="stock-status-chip ${getStockStatusClass(status)}">${status}</span></td>
          <td>${fmtUGX(row.sellingPrice || 0)}</td>
          <td>${row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "-"}</td>
        </tr>
      `;
      })
      .join("");

    applyStockKpis(sortedRows);
    renderStockByBranchChart(sortedRows);
    renderStockTypePieChart(sortedRows);
  } catch {
    stockRowsEl.innerHTML = '<tr><td colspan="7">Unable to load stock report.</td></tr>';
    applyStockKpis([]);
    renderStockByBranchChart([]);
    renderStockTypePieChart([]);
  }
}

async function refreshDirectorDashboard() {
  // Recompute table, KPIs, and charts from current filter state.
  const allSalesRows = await getNormalizedSalesRowsFromApi();
  let procurements = [];
  try {
    const rows = await api("/procurements");
    procurements = Array.isArray(rows) ? rows : [];
  } catch {
    procurements = [];
  }
  filteredSalesRows = applySalesFilters(allSalesRows);
  aggregatedRows = aggregateByBranchAndAgent(filteredSalesRows);
  renderAggregateTable(aggregatedRows);
  renderCashSalesTable(filteredSalesRows);
  applyCashSalesKpis(filteredSalesRows);
  renderCashSalesCharts(filteredSalesRows);
  renderCreditSalesTable(filteredSalesRows);
  applyCreditSalesKpis(filteredSalesRows);
  renderCreditSalesCharts(filteredSalesRows);
  try {
    const summary = await api("/reports/director-summary");
    applySummaryToKpis(summary, allSalesRows);
  } catch {
    computeKpisFallback(allSalesRows, procurements);
  }
  renderBranchSalesChart(allSalesRows);
  renderProduceRankingChart(allSalesRows);
  renderFinancialMixPieChart(allSalesRows, procurements);
  renderWeeklyProduceLineChart(allSalesRows);
  await refreshStockReport();
  renderDirectorDamagedProduceTable();
  renderDirectorReturnedGoodsTable();
}

function populateBranchAndAgentFilters() {
  const allSalesRows = apiSalesRowsCache;
  const branches = Array.from(new Set(allSalesRows.map((row) => row.branch))).sort();
  const agents = Array.from(new Set(allSalesRows.map((row) => row.agent))).sort();

  branches.forEach((branch) => {
    const option = document.createElement("option");
    option.value = branch;
    option.textContent = branch;
    branchFilterEl.appendChild(option);
  });

  agents.forEach((agent) => {
    const option = document.createElement("option");
    option.value = agent;
    option.textContent = agent;
    agentFilterEl.appendChild(option);
  });
}

function downloadBlob(filename, content, type) {
  // Client-side file generation for CSV/JSON/TXT report exports.
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getDownloadFilterState() {
  return {
    scope: String(downloadScopeEl?.value || "entire"),
    dateFrom: String(downloadDateFromEl?.value || "").trim(),
    dateTo: String(downloadDateToEl?.value || "").trim(),
    produce: normalizeText(downloadProduceEl?.value || "")
  };
}

function applyDownloadFilters(rows) {
  const { dateFrom, dateTo, produce } = getDownloadFilterState();
  return rows.filter((row) => {
    if (produce && !normalizeText(row.produce).includes(produce)) return false;
    if (!matchesDateFilter(row.createdAt, dateFrom, dateTo)) return false;
    return true;
  });
}

function getDownloadData() {
  const { scope } = getDownloadFilterState();
  const records = applyDownloadFilters(filteredSalesRows);
  const aggregate = aggregateByBranchAndAgent(records);
  return { scope, records, aggregate };
}

function downloadCsv() {
  const { scope, aggregate, records } = getDownloadData();
  const aggregateHeader = "Branch,Agent,Transactions,Total Tonnage (kg),Cash (UGX),Credit (UGX),Total Sales (UGX)";
  const aggregateRows = aggregate.map((r) => `"${r.branch}","${r.agent}",${r.transactions},${r.tonnage},${r.cash},${r.credit},${r.total}`);
  const detailHeader = "Date,Branch,Agent,Produce,Type,Tonnage (kg),Amount (UGX),Due Date";
  const detailRows = records.map((r) => `"${formatDateTime(r.createdAt)}","${r.branch}","${r.agent}","${r.produce}","${r.saleType}",${r.tonnage},${r.amount},"${r.dueDate || ""}"`);

  const lines = [];
  if (scope !== "detailed") {
    lines.push(aggregateHeader, ...aggregateRows);
  }
  if (scope === "entire") lines.push("");
  if (scope !== "aggregate") {
    lines.push(detailHeader, ...detailRows);
  }

  downloadBlob(`director_sales_report_${Date.now()}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
}

function downloadJson() {
  const { scope, aggregate, records } = getDownloadData();
  const payload = {
    generatedAt: new Date().toISOString(),
    filters: getFilterState(),
    downloadFilters: getDownloadFilterState(),
    scope,
    aggregate,
    records
  };
  downloadBlob(`director_sales_report_${Date.now()}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
}

function downloadTxt() {
  const { scope, aggregate, records } = getDownloadData();
  const lines = [
    "Director Aggregated Sales Report",
    `Generated: ${new Date().toLocaleString()}`,
    `Filters: ${JSON.stringify(getFilterState())}`,
    `Download Filters: ${JSON.stringify(getDownloadFilterState())}`,
    "",
    "Branch | Agent | Transactions | Tonnage | Cash | Credit | Total"
  ];
  if (scope !== "detailed") {
    aggregate.forEach((r) => {
      lines.push(`${r.branch} | ${r.agent} | ${r.transactions} | ${r.tonnage}kg | ${r.cash} | ${r.credit} | ${r.total}`);
    });
  }
  if (scope !== "aggregate") {
    lines.push("", "Date | Branch | Agent | Produce | Type | Tonnage | Amount | Due Date");
    records.forEach((r) => {
      lines.push(`${formatDateTime(r.createdAt)} | ${r.branch} | ${r.agent} | ${r.produce} | ${r.saleType} | ${r.tonnage}kg | ${r.amount} | ${r.dueDate || "-"}`);
    });
  }
  downloadBlob(`director_sales_report_${Date.now()}.txt`, lines.join("\n"), "text/plain;charset=utf-8");
}

function downloadPdf() {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    alert("PDF library not loaded.");
    return;
  }

  const { scope, aggregate, records } = getDownloadData();
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 40;
  const lineHeight = 16;
  const pageHeight = pdf.internal.pageSize.getHeight();
  let y = 42;

  const addLine = (text = "") => {
    if (y > pageHeight - 40) {
      pdf.addPage();
      y = 42;
    }
    pdf.text(String(text), marginX, y);
    y += lineHeight;
  };

  pdf.setFontSize(14);
  addLine("Director Sales Report");
  pdf.setFontSize(10);
  addLine(`Generated: ${new Date().toLocaleString()}`);
  addLine(`Filters: ${JSON.stringify(getFilterState())}`);
  addLine(`Download Filters: ${JSON.stringify(getDownloadFilterState())}`);
  addLine("");

  if (scope !== "detailed") {
    addLine("Aggregated Summary");
    addLine("Branch | Agent | Txns | Tonnage | Cash | Credit | Total");
    aggregate.forEach((r) => {
      addLine(`${r.branch} | ${r.agent} | ${r.transactions} | ${r.tonnage}kg | ${fmtUGX(r.cash)} | ${fmtUGX(r.credit)} | ${fmtUGX(r.total)}`);
    });
    addLine("");
  }

  if (scope !== "aggregate") {
    addLine("Detailed Records");
    addLine("Date | Branch | Agent | Produce | Type | Tonnage | Amount | Due Date");
    records.forEach((r) => {
      addLine(`${formatDateTime(r.createdAt)} | ${r.branch} | ${r.agent} | ${r.produce} | ${r.saleType} | ${r.tonnage}kg | ${fmtUGX(r.amount)} | ${r.dueDate || "-"}`);
    });
  }

  pdf.save(`director_sales_report_${Date.now()}.pdf`);
}

function wireEvents() {
  // Toggle filter/download panels on demand to keep UI compact.
  if (toggleFiltersBtn && filterPanelEl) {
    toggleFiltersBtn.addEventListener("click", () => {
      filterPanelEl.classList.toggle("hidden");
    });
  }

  if (toggleDownloadBtn && downloadPanelEl) {
    toggleDownloadBtn.addEventListener("click", () => {
      downloadPanelEl.classList.toggle("hidden");
    });
  }

  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener("click", async () => {
      showAllRows = false;
      await refreshDirectorDashboard();
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", async () => {
      if (branchFilterEl) branchFilterEl.value = "all";
      if (agentFilterEl) agentFilterEl.value = "all";
      if (saleTypeFilterEl) saleTypeFilterEl.value = "all";
      if (dateFromFilterEl) dateFromFilterEl.value = "";
      if (dateToFilterEl) dateToFilterEl.value = "";
      showAllRows = false;
      await refreshDirectorDashboard();
    });
  }

  if (downloadCsvBtn) downloadCsvBtn.addEventListener("click", downloadCsv);
  if (downloadJsonBtn) downloadJsonBtn.addEventListener("click", downloadJson);
  if (downloadTxtBtn) downloadTxtBtn.addEventListener("click", downloadTxt);
  if (downloadPdfBtn) downloadPdfBtn.addEventListener("click", downloadPdf);

  if (moreBtnEl) {
    moreBtnEl.addEventListener("click", () => {
      showAllRows = !showAllRows;
      renderAggregateTable(aggregatedRows);
    });
  }

  if (printCashBtnEl) {
    printCashBtnEl.addEventListener("click", () => {
      const tableMarkup = cashSalesTableEl ? cashSalesTableEl.outerHTML : "<p>No cash sales table found.</p>";
      const printWindow = window.open("", "_blank", "width=900,height=700");
      if (!printWindow) return;
      printWindow.document.write(`
        <html>
          <head>
            <title>Cash Sales Report</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h2 { margin: 0 0 12px 0; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 12px; }
              th { background: #f1f5f9; }
            </style>
          </head>
          <body>
            <h2>Cash Sales Report</h2>
            ${tableMarkup}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    });
  }

  if (dirDamagedProduceRowsEl) {
    dirDamagedProduceRowsEl.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const imageId = target.dataset.dirDamageImageId;
      if (!imageId) return;
      const row = dirDamagedRecordMap.get(String(imageId));
      if (!row?.imageDataUrl) return;
      openDirectorDamagedImageModal(row.imageDataUrl);
    });
  }

  if (dirCloseDamagedImageModalBtn) {
    dirCloseDamagedImageModalBtn.addEventListener("click", closeDirectorDamagedImageModal);
  }

  if (dirDamagedImageModalEl) {
    dirDamagedImageModalEl.addEventListener("click", (event) => {
      if (event.target === dirDamagedImageModalEl) closeDirectorDamagedImageModal();
    });
  }

  const qaStockBtn = document.getElementById("dirQaStockBtn");
  const qaCashBtn = document.getElementById("dirQaCashBtn");
  const qaCreditBtn = document.getElementById("dirQaCreditBtn");
  const qaAdminBtn = document.getElementById("dirQaAdminBtn");
  const basePath = resolveAppBasePath();

  if (qaStockBtn) qaStockBtn.addEventListener("click", () => { window.location.hash = "#view-stock"; });
  if (qaCashBtn) qaCashBtn.addEventListener("click", () => { window.location.hash = "#view-cash-sales"; });
  if (qaCreditBtn) qaCreditBtn.addEventListener("click", () => { window.location.hash = "#view-credit-sales"; });
  if (qaAdminBtn) qaAdminBtn.addEventListener("click", () => { window.location.href = `${basePath}pages/director/user_management/user-management.html`; });

  window.addEventListener("hashchange", () => {
    syncDirectorPageMode();
  });
}

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle("hidden", hidden);
}

function syncDirectorPageMode() {
  const hash = window.location.hash;
  const isStockMode = hash === "#view-stock";
  const isCashMode = hash === "#view-cash-sales";
  const isCreditMode = hash === "#view-credit-sales";
  const isGeneralMode = hash === "#general-report";
  document.body.dataset.pageTitle = isStockMode
    ? "Stock Report"
    : (isCashMode ? "Cash Sales Report" : (isCreditMode ? "Credit Sales Report" : (isGeneralMode ? "General Report" : "Director Dashboard")));
  if (typeof window.renderDirectorLayout === "function") window.renderDirectorLayout();

  setHidden(salesKpisPrimaryEl, isStockMode || isCashMode || isCreditMode);
  setHidden(salesKpisSecondaryEl, isStockMode || isCashMode || isCreditMode);
  setHidden(salesChartsEl, isStockMode || isCashMode || isCreditMode);
  setHidden(quickActionsEl, isStockMode || isCashMode || isCreditMode);
  setHidden(policyCardEl, true);
  setHidden(generalReportEl, isStockMode || isCashMode || isCreditMode);
  setHidden(damagedProduceSectionEl, isStockMode || isCashMode || isCreditMode);
  setHidden(returnedGoodsSectionEl, isStockMode || isCashMode || isCreditMode);
  setHidden(cashSalesSectionEl, !isCashMode);
  setHidden(creditSalesSectionEl, !isCreditMode);
  setHidden(stockSectionEl, !isStockMode);

  // Re-render charts after visibility changes so canvases get correct size/data.
  if (isCashMode) {
    requestAnimationFrame(() => {
      renderCashSalesCharts(filteredSalesRows);
    });
  }
  if (isCreditMode) {
    requestAnimationFrame(() => {
      renderCreditSalesCharts(filteredSalesRows);
    });
  }
}

function bindElements() {
  branchFilterEl = document.getElementById("dirBranchFilter");
  agentFilterEl = document.getElementById("dirAgentFilter");
  saleTypeFilterEl = document.getElementById("dirSaleTypeFilter");
  dateFromFilterEl = document.getElementById("dirDateFromFilter");
  dateToFilterEl = document.getElementById("dirDateToFilter");
  applyFiltersBtn = document.getElementById("dirApplyFiltersBtn");
  resetFiltersBtn = document.getElementById("dirResetFiltersBtn");
  downloadPdfBtn = document.getElementById("dirDownloadPdfBtn");
  downloadCsvBtn = document.getElementById("dirDownloadCsvBtn");
  downloadJsonBtn = document.getElementById("dirDownloadJsonBtn");
  downloadTxtBtn = document.getElementById("dirDownloadTxtBtn");
  downloadScopeEl = document.getElementById("dirDownloadScope");
  downloadDateFromEl = document.getElementById("dirDownloadDateFrom");
  downloadDateToEl = document.getElementById("dirDownloadDateTo");
  downloadProduceEl = document.getElementById("dirDownloadProduce");
  aggregateRowsEl = document.getElementById("dirAggregateRows");
  stockRowsEl = document.getElementById("dirStockRows");
  toggleFiltersBtn = document.getElementById("dirToggleFiltersBtn");
  toggleDownloadBtn = document.getElementById("dirToggleDownloadBtn");
  filterPanelEl = document.getElementById("dirFilterPanel");
  downloadPanelEl = document.getElementById("dirDownloadPanel");
  moreBtnEl = document.getElementById("dirMoreBtn");
  cashSalesRowsEl = document.getElementById("dirCashSalesRows");
  creditSalesRowsEl = document.getElementById("dirCreditSalesRows");
  stockTotalTonnageEl = document.getElementById("dirStockTotalTonnage");
  totalProduceProcuredEl = document.getElementById("dirTotalProduceProcured");
  lowestProcuredProduceEl = document.getElementById("dirLowestProcuredProduce");
  highestProcuredProduceEl = document.getElementById("dirHighestProcuredProduce");
  lowStockItemsEl = document.getElementById("dirLowStockItems");
  outOfStockItemsEl = document.getElementById("dirOutOfStockItems");
  salesKpisPrimaryEl = document.getElementById("dirSalesKpisPrimary");
  salesKpisSecondaryEl = document.getElementById("dirSalesKpisSecondary");
  salesChartsEl = document.getElementById("dirSalesCharts");
  quickActionsEl = document.getElementById("dirQuickActions");
  policyCardEl = document.getElementById("dirPolicyCard");
  generalReportEl = document.getElementById("general-report");
  cashSalesSectionEl = document.getElementById("view-cash-sales");
  creditSalesSectionEl = document.getElementById("view-credit-sales");
  stockSectionEl = document.getElementById("view-stock");
  damagedProduceSectionEl = document.getElementById("dirDamagedProduceReport");
  returnedGoodsSectionEl = document.getElementById("dirReturnedGoodsReport");
  cashTotalSalesEl = document.getElementById("dirCashTotalSales");
  cashWeeklyTurnoverEl = document.getElementById("dirCashWeeklyTurnover");
  cashTopProduceEl = document.getElementById("dirCashTopProduce");
  cashTopBranchEl = document.getElementById("dirCashTopBranch");
  cashTopAgentEl = document.getElementById("dirCashTopAgent");
  creditTotalSalesEl = document.getElementById("dirCreditTotalSales");
  creditTransactionsEl = document.getElementById("dirCreditTransactions");
  creditOverdueEl = document.getElementById("dirCreditOverdue");
  creditTopBranchEl = document.getElementById("dirCreditTopBranch");
  printCashBtnEl = document.getElementById("dirPrintCashBtn");
  cashSalesTableEl = document.getElementById("dirCashSalesTable");
  dirDamagedProduceRowsEl = document.getElementById("dirDamagedProduceRows");
  dirReturnedGoodsRowsEl = document.getElementById("dirReturnedGoodsRows");
  dirDamagedImageModalEl = document.getElementById("dirDamagedImageModal");
  dirDamagedImageModalPreviewEl = document.getElementById("dirDamagedImageModalPreview");
  dirCloseDamagedImageModalBtn = document.getElementById("dirCloseDamagedImageModalBtn");
}

async function initDirectorDashboard() {
  if (!ensureDirectorSession()) return;
  if (typeof window.renderDirectorLayout === "function") window.renderDirectorLayout();
  bindElements();
  await getNormalizedSalesRowsFromApi();
  populateBranchAndAgentFilters();
  await refreshDirectorDashboard();
  wireEvents();
  syncDirectorPageMode();
}

initDirectorDashboard();

