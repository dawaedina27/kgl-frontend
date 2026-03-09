// Developer note from me: I wrote and maintain this file for the KGL system, and I keep this logic explicit so future updates are safer.
const branch = localStorage.getItem("branch") || "Maganjo";
const role = localStorage.getItem("role") || "";

let salesChartInstance = null;
let stockByProduceChartInstance = null;
let salesMixChartInstance = null;
let produceRevenueChartInstance = null;

let latestSalesRows = [];
let latestStockRows = [];
let latestProcurementRows = [];

const API_BASE = (() => {
  const host = window.location.hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  const isBackendPort = window.location.port === "4000";
  if (isLocalHost && !isBackendPort) return "http://localhost:4000/api";
  return `${window.location.origin}/api`;
})();

function normalizeHex(value, fallback) {
  const raw = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return fallback;
}

function buildChartTheme() {
  const css = window.getComputedStyle(document.documentElement);
  const readVar = (name, fallback) => normalizeHex(css.getPropertyValue(name), fallback);
  return {
    text: readVar("--chart-text", "#0F172A"),
    ticks: readVar("--chart-ticks", "#334155"),
    grid: readVar("--chart-grid", "#E2E8F0"),
    cash: readVar("--chart-cash", "#16A34A"),
    credit: readVar("--chart-credit", "#3B82F6"),
    stock: readVar("--chart-stock", "#06B6D4"),
    procurement: readVar("--chart-procurement", "#1E293B"),
    palette: [
      readVar("--chart-p1", "#0F766E"),
      readVar("--chart-p2", "#16A34A"),
      readVar("--chart-p3", "#3B82F6"),
      readVar("--chart-p4", "#F59E0B"),
      readVar("--chart-p5", "#EF4444"),
      readVar("--chart-p6", "#7C3AED"),
      readVar("--chart-p7", "#06B6D4"),
      readVar("--chart-p8", "#84CC16")
    ]
  };
}

const CHART_THEME = buildChartTheme();

function formatUGX(value) {
  return "UGX " + Number(value || 0).toLocaleString();
}

function normalizeSaleType(value) {
  return String(value || "").trim().toLowerCase();
}

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function getSaleAmount(row) {
  const saleType = normalizeSaleType(row.saleType);
  const amountPaid = toFiniteNumber(row.amountPaid);
  const amountDue = toFiniteNumber(row.amountDue);
  const fallbackAmount = toFiniteNumber(row.amount);
  if (saleType === "cash") return amountPaid || fallbackAmount;
  if (saleType === "credit") return amountDue || fallbackAmount;
  return fallbackAmount || amountPaid || amountDue;
}

function getToken() {
  return localStorage.getItem("token") || "";
}

function ensureManagerAccess() {
  const token = getToken();
  if (!token || role !== "Manager") {
    window.location.href = "../../index.html";
    return false;
  }
  return true;
}

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

function updateCards() {
  const totalStock = latestStockRows.reduce((sum, item) => sum + Number(item.availableStock || 0), 0);
  const lowStockCount = latestStockRows.filter((item) => Number(item.availableStock || 0) < 500).length;

  const totalCashSales = latestSalesRows
    .filter((row) => normalizeSaleType(row.saleType) === "cash")
    .reduce((sum, sale) => sum + getSaleAmount(sale), 0);
  const totalCreditSales = latestSalesRows
    .filter((row) => normalizeSaleType(row.saleType) === "credit")
    .reduce((sum, sale) => sum + getSaleAmount(sale), 0);
  const totalSales = totalCashSales + totalCreditSales;

  const totalProcurement = latestProcurementRows.reduce((sum, row) => sum + Number(row.cost || 0), 0);
  const totalProfit = totalSales - totalProcurement;
  const damagedRows = JSON.parse(localStorage.getItem(`manager_damaged_produce_${branch}`) || "[]");
  const totalDamagedStockKg = (Array.isArray(damagedRows) ? damagedRows : []).reduce(
    (sum, row) => sum + Number(row.quantity || 0),
    0
  );

  const totalStockEl = document.getElementById("totalStock");
  const lowStockEl = document.getElementById("lowStock");
  const totalSalesEl = document.getElementById("totalSales");
  const totalProfitEl = document.getElementById("totalProfit");
  const totalDamagedStockEl = document.getElementById("totalDamagedStock");

  if (totalStockEl) totalStockEl.textContent = `${totalStock} kg`;
  if (lowStockEl) lowStockEl.textContent = String(lowStockCount);
  if (totalSalesEl) totalSalesEl.textContent = formatUGX(totalSales);
  if (totalProfitEl) totalProfitEl.textContent = formatUGX(totalProfit);
  if (totalDamagedStockEl) totalDamagedStockEl.textContent = `${Number(totalDamagedStockKg || 0).toLocaleString()} kg`;
}

function aggregateTransactionsByDate() {
  const salesByDate = {};
  const procurementByDate = {};

  latestSalesRows.forEach((row) => {
    const date = row.createdAt ? new Date(row.createdAt).toLocaleDateString() : new Date().toLocaleDateString();
    const amount = getSaleAmount(row);
    salesByDate[date] = (salesByDate[date] || 0) + amount;
  });

  latestProcurementRows.forEach((row) => {
    const sourceDate = row.createdAt || row.date;
    const date = sourceDate ? new Date(sourceDate).toLocaleDateString() : new Date().toLocaleDateString();
    procurementByDate[date] = (procurementByDate[date] || 0) + Number(row.cost || 0);
  });

  const allDates = Array.from(new Set([...Object.keys(salesByDate), ...Object.keys(procurementByDate)]));
  allDates.sort((a, b) => new Date(a) - new Date(b));

  const labels = allDates.slice(-10);
  const salesPoints = labels.map((d) => salesByDate[d] || 0);
  const procurementPoints = labels.map((d) => procurementByDate[d] || 0);

  return { labels, salesPoints, procurementPoints };
}

function renderSalesChart() {
  const canvas = document.getElementById("salesChart");
  if (!canvas || typeof Chart === "undefined") return;

  const { labels, salesPoints, procurementPoints } = aggregateTransactionsByDate();
  const safeLabels = labels.length ? labels : ["No Data"];
  const safeSales = labels.length ? salesPoints : [0];
  const safeProcurement = labels.length ? procurementPoints : [0];

  if (salesChartInstance) salesChartInstance.destroy();

  salesChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: safeLabels,
      datasets: [
        { label: "Sales (UGX)", data: safeSales, backgroundColor: CHART_THEME.cash },
        { label: "Procurement (UGX)", data: safeProcurement, backgroundColor: CHART_THEME.procurement }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top", labels: { color: CHART_THEME.text } } },
      scales: {
        y: { beginAtZero: true, ticks: { color: CHART_THEME.ticks }, grid: { color: CHART_THEME.grid } },
        x: { ticks: { color: CHART_THEME.ticks }, grid: { display: false } }
      }
    }
  });
}

function renderStockByProduceChart() {
  const canvas = document.getElementById("stockByProduceChart");
  if (!canvas || typeof Chart === "undefined") return;

  const labels = latestStockRows.map((row) => row.produceName || "Unknown");
  const values = latestStockRows.map((row) => Number(row.availableStock || 0));
  const safeLabels = labels.length ? labels : ["No Data"];
  const safeValues = values.length ? values : [0];

  if (stockByProduceChartInstance) stockByProduceChartInstance.destroy();

  stockByProduceChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: safeLabels,
      datasets: [{ label: "Stock (kg)", data: safeValues, backgroundColor: CHART_THEME.stock }]
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

function renderSalesMixChart() {
  const canvas = document.getElementById("salesMixChart");
  if (!canvas || typeof Chart === "undefined") return;

  const cashTotal = latestSalesRows
    .filter((row) => normalizeSaleType(row.saleType) === "cash")
    .reduce((sum, sale) => sum + getSaleAmount(sale), 0);
  const creditTotal = latestSalesRows
    .filter((row) => normalizeSaleType(row.saleType) === "credit")
    .reduce((sum, sale) => sum + getSaleAmount(sale), 0);

  if (salesMixChartInstance) salesMixChartInstance.destroy();

  salesMixChartInstance = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Cash", "Credit"],
      datasets: [{ data: [cashTotal, creditTotal], backgroundColor: [CHART_THEME.cash, CHART_THEME.credit] }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: CHART_THEME.text } } }
    }
  });
}

function renderProduceRevenueChart() {
  const canvas = document.getElementById("produceRevenueChart");
  if (!canvas || typeof Chart === "undefined") return;

  const bucket = {};
  latestSalesRows.forEach((row) => {
    const key = String(row.produce || "Unknown");
    const amount = getSaleAmount(row);
    bucket[key] = (bucket[key] || 0) + amount;
  });

  const top = Object.entries(bucket).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const labels = top.map((row) => row[0]);
  const values = top.map((row) => row[1]);
  const safeLabels = labels.length ? labels : ["No Data"];
  const safeValues = values.length ? values : [0];

  if (produceRevenueChartInstance) produceRevenueChartInstance.destroy();

  produceRevenueChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: safeLabels,
      datasets: [{
        label: "Revenue (UGX)",
        data: safeValues,
        backgroundColor: safeLabels.map((_, index) => CHART_THEME.palette[index % CHART_THEME.palette.length])
      }]
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

async function loadDashboard() {
  if (!ensureManagerAccess()) return;
  try {
    const [stocks, sales, procurements] = await Promise.all([
      api("/stocks"),
      api(`/sales?branch=${encodeURIComponent(branch)}`),
      api(`/procurements?branch=${encodeURIComponent(branch)}`)
    ]);
    latestStockRows = Array.isArray(stocks) ? stocks : [];
    latestSalesRows = Array.isArray(sales) ? sales : [];
    latestProcurementRows = Array.isArray(procurements) ? procurements : [];

    updateCards();
    renderSalesChart();
    renderStockByProduceChart();
    renderSalesMixChart();
    renderProduceRevenueChart();
  } catch (error) {
    console.error(error);
  }
}

function wireQuickActions() {
  const procurementBtn = document.getElementById("mgrQaProcurementBtn");
  const salesBtn = document.getElementById("mgrQaSalesBtn");
  const reportsBtn = document.getElementById("mgrQaReportsBtn");

  if (procurementBtn) procurementBtn.addEventListener("click", () => { window.location.href = "procurement.html"; });
  if (salesBtn) salesBtn.addEventListener("click", () => { window.location.href = "sales.html"; });
  if (reportsBtn) reportsBtn.addEventListener("click", () => { window.location.href = "reports.html"; });
}

window.addEventListener("DOMContentLoaded", loadDashboard);
window.addEventListener("DOMContentLoaded", wireQuickActions);

