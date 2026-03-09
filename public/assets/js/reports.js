// Developer note from me: I wrote and maintain this file for the KGL system, and I keep this logic explicit so future updates are safer.
const branch = localStorage.getItem("branch") || "Maganjo";
const managerUsername = localStorage.getItem("username") || "Manager";
const role = localStorage.getItem("role");
const isSalesAgent = role === "sales-agent" || role === "SalesAgent";
const currentAgentName = managerUsername;
const cashKey = `manager_cash_sales_${branch}`;
const creditKey = `manager_credit_sales_${branch}`;
const procurementKey = `manager_procurements_${branch}`;
const creditPaymentsKey = `manager_credit_payments_${branch}`;
const damagedProduceKey = `manager_damaged_produce_${branch}`;
const txKey = "transactions";

const allCashRows = JSON.parse(localStorage.getItem(cashKey) || "[]");
const allCreditRows = JSON.parse(localStorage.getItem(creditKey) || "[]");
const allProcurementRows = JSON.parse(localStorage.getItem(procurementKey) || "[]");
let allCreditPayments = JSON.parse(localStorage.getItem(creditPaymentsKey) || "[]");
const cashRows = isSalesAgent
  ? allCashRows.filter((row) => normalizeText(row.agent) === normalizeText(currentAgentName))
  : allCashRows;
const creditRows = isSalesAgent
  ? allCreditRows.filter((row) => normalizeText(row.agent) === normalizeText(currentAgentName))
  : allCreditRows;
const procurementRows = isSalesAgent ? [] : allProcurementRows;

const agentFilterEl = document.getElementById("agentFilter");
const saleTypeFilterEl = document.getElementById("saleTypeFilter");
const dateFromFilterEl = document.getElementById("dateFromFilter");
const dateToFilterEl = document.getElementById("dateToFilter");
const applyFiltersBtn = document.getElementById("applyFiltersBtn");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const agentAggregateRowsEl = document.getElementById("agentAggregateRows");

const toggleAgentFiltersBtn = document.getElementById("toggleAgentFiltersBtn");
const toggleCashFiltersBtn = document.getElementById("toggleCashFiltersBtn");
const toggleCreditFiltersBtn = document.getElementById("toggleCreditFiltersBtn");
const agentFilterPanel = document.getElementById("agentFilterPanel");
const cashFilterPanel = document.getElementById("cashFilterPanel");
const creditFilterPanel = document.getElementById("creditFilterPanel");

const openReportBuilderBtn = document.getElementById("openReportBuilderBtn");
const reportBuilderPanel = document.getElementById("reportBuilderPanel");
const reportFormatEl = document.getElementById("reportFormat");
const reportTypeOptionsEl = document.getElementById("reportTypeOptions");
const reportTypeOptionEls = Array.from(document.querySelectorAll('input[name="reportTypeOption"]'));
const reportPeriodEl = document.getElementById("reportPeriod");
const reportAgentFieldEl = document.getElementById("reportAgentField");
const reportAgentEl = document.getElementById("reportAgent");
const downloadCustomReportBtn = document.getElementById("downloadCustomReportBtn");
const printEntireReportBtn = document.getElementById("printEntireReportBtn");
const closeReportBuilderBtn = document.getElementById("closeReportBuilderBtn");

const cashProduceFilterEl = document.getElementById("cashProduceFilter");
const cashBuyerFilterEl = document.getElementById("cashBuyerFilter");
const cashDateFromFilterEl = document.getElementById("cashDateFromFilter");
const cashDateToFilterEl = document.getElementById("cashDateToFilter");
const applyCashFiltersBtn = document.getElementById("applyCashFiltersBtn");
const clearCashFiltersBtn = document.getElementById("clearCashFiltersBtn");
const cashMoreBtn = document.getElementById("cashMoreBtn");

const creditProduceFilterEl = document.getElementById("creditProduceFilter");
const creditBuyerFilterEl = document.getElementById("creditBuyerFilter");
const creditDateFromFilterEl = document.getElementById("creditDateFromFilter");
const creditDateToFilterEl = document.getElementById("creditDateToFilter");
const applyCreditFiltersBtn = document.getElementById("applyCreditFiltersBtn");
const clearCreditFiltersBtn = document.getElementById("clearCreditFiltersBtn");
const creditMoreBtn = document.getElementById("creditMoreBtn");
const inventoryRowsEl = document.getElementById("inventoryRows");
const inventoryMoreBtn = document.getElementById("inventoryMoreBtn");
const toggleProcurementSummaryBtn = document.getElementById("toggleProcurementSummaryBtn");
const procurementSummaryPanel = document.getElementById("procurementSummaryPanel");
const creditCollectionRowsEl = document.getElementById("creditCollectionRows");
const creditCollectionMoreBtn = document.getElementById("creditCollectionMoreBtn");
const damagedProduceRowsEl = document.getElementById("damagedProduceRows");
const damagedImageModalEl = document.getElementById("damagedImageModal");
const damagedImageModalPreviewEl = document.getElementById("damagedImageModalPreview");
const closeDamagedImageModalBtn = document.getElementById("closeDamagedImageModalBtn");

const personalPeriodFilterEl = document.getElementById("personalPeriodFilter");
const applyPersonalPeriodBtn = document.getElementById("applyPersonalPeriodBtn");
const personalSalesRowsEl = document.getElementById("personalSalesRows");
const togglePersonalReportBtn = document.getElementById("togglePersonalReportBtn");
const personalPeriodPanel = document.getElementById("personalPeriodPanel");

let filteredSalesRows = [];
let aggregatedAgentRows = [];
let visibleCashRows = [...cashRows];
let visibleCreditRows = [...creditRows];
let showAllCashRows = false;
let showAllCreditRows = false;
let showAllInventoryRows = false;
let visibleCreditCollectionRows = [];
let showAllCreditCollectionRows = false;
let reportWeeklySalesChartInstance = null;
let reportSalesMixChartInstance = null;

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
    credit: readVar("--chart-credit", "#3B82F6")
  };
}

const CHART_THEME = buildChartTheme();

function fmtUGX(value) {
  return "UGX " + Number(value || 0).toLocaleString();
}

function toDateSafe(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeSaleType(value) {
  return String(value || "").trim().toLowerCase();
}

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function getSaleAmount(row) {
  const saleType = normalizeSaleType(row?.saleType);
  const amountPaid = toFiniteNumber(row?.amountPaid);
  const amountDue = toFiniteNumber(row?.amountDue);
  const fallbackAmount = toFiniteNumber(row?.amount);
  if (saleType === "cash") return amountPaid || fallbackAmount;
  if (saleType === "credit") return amountDue || fallbackAmount;
  return fallbackAmount || amountPaid || amountDue;
}

function getCreditSaleId(row) {
  if (row && row.id) return String(row.id);
  const createdAt = row?.createdAt || "";
  const buyer = row?.buyer || "";
  const produce = row?.produce || "";
  const amountDue = getSaleAmount({ ...row, saleType: "credit" });
  const dueDate = row?.dueDate || "";
  const dispatchDate = row?.dispatchDate || "";
  const agent = row?.agent || "";
  return `${createdAt}|${buyer}|${produce}|${amountDue}|${dueDate}|${dispatchDate}|${agent}`;
}

function getCreditPayments() {
  return Array.isArray(allCreditPayments) ? allCreditPayments : [];
}

function getPaidAmountForSale(creditSaleId) {
  return getCreditPayments()
    .filter((payment) => String(payment.creditSaleId || "") === String(creditSaleId))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

function getDaysOverdue(dueDate, balance) {
  if (balance <= 0) return 0;
  const due = toDateSafe(dueDate);
  if (!due) return 0;
  due.setHours(23, 59, 59, 999);
  const now = new Date();
  const diff = now.getTime() - due.getTime();
  if (diff <= 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getAgingBucket(daysOverdue, balance) {
  if (balance <= 0) return "Paid";
  if (daysOverdue <= 0) return "Current";
  if (daysOverdue <= 30) return "1-30 Days";
  if (daysOverdue <= 60) return "31-60 Days";
  if (daysOverdue <= 90) return "61-90 Days";
  return "90+ Days";
}

function getCreditLedgerRows(rows = creditRows) {
  return rows
    .map((row) => {
      const saleId = getCreditSaleId(row);
      const originalAmount = Number(row.amountDue || 0);
      const paidAmount = Math.min(getPaidAmountForSale(saleId), originalAmount);
      const balance = Math.max(originalAmount - paidAmount, 0);
      const daysOverdue = getDaysOverdue(row.dueDate, balance);
      return {
        saleId,
        row,
        originalAmount,
        paidAmount,
        balance,
        daysOverdue,
        agingBucket: getAgingBucket(daysOverdue, balance)
      };
    })
    .sort((a, b) => b.balance - a.balance);
}

function getCreditCollectionsSummary(rows = creditRows) {
  const ledger = getCreditLedgerRows(rows);
  const summary = {
    collectedToDate: 0,
    outstandingTotal: 0,
    overdueCount: 0,
    current: 0,
    d1To30: 0,
    d31To60: 0,
    d61To90: 0,
    above90: 0
  };

  ledger.forEach((entry) => {
    summary.collectedToDate += entry.paidAmount;
    summary.outstandingTotal += entry.balance;
    if (entry.balance > 0 && entry.daysOverdue > 0) summary.overdueCount += 1;
    if (entry.balance <= 0) return;
    if (entry.daysOverdue <= 0) summary.current += entry.balance;
    else if (entry.daysOverdue <= 30) summary.d1To30 += entry.balance;
    else if (entry.daysOverdue <= 60) summary.d31To60 += entry.balance;
    else if (entry.daysOverdue <= 90) summary.d61To90 += entry.balance;
    else summary.above90 += entry.balance;
  });

  return { ledger, summary };
}

function togglePanel(panelEl) {
  if (!panelEl) return;
  panelEl.classList.toggle("hidden");
}

function getWeekStart(date) {
  const dt = new Date(date);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() + diff);
  return dt;
}

function inSelectedPeriod(dateValue, period) {
  if (period === "all_time") return true;
  const date = toDateSafe(dateValue);
  if (!date) return false;

  const now = new Date();
  if (period === "hourly") {
    return date.getFullYear() === now.getFullYear()
      && date.getMonth() === now.getMonth()
      && date.getDate() === now.getDate()
      && date.getHours() === now.getHours();
  }
  if (period === "daily") {
    return date.getFullYear() === now.getFullYear()
      && date.getMonth() === now.getMonth()
      && date.getDate() === now.getDate();
  }
  if (period === "weekly") {
    return getWeekStart(date).getTime() === getWeekStart(now).getTime();
  }
  if (period === "monthly") {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }
  if (period === "quarterly") {
    return date.getFullYear() === now.getFullYear()
      && Math.floor(date.getMonth() / 3) === Math.floor(now.getMonth() / 3);
  }
  if (period === "yearly") {
    return date.getFullYear() === now.getFullYear();
  }

  return true;
}

function normalizeSalesRows() {
  const normalizedCash = cashRows.map((row) => ({
    saleType: "cash",
    agent: row.agent || "Unassigned",
    produce: row.produce || "-",
    buyer: row.buyer || "-",
    tonnage: Number(row.tonnage || 0),
    amount: getSaleAmount({ ...row, saleType: "cash" }),
    createdAt: row.createdAt || null
  }));

  const normalizedCredit = creditRows.map((row) => ({
    saleType: "credit",
    agent: row.agent || "Unassigned",
    produce: row.produce || "-",
    buyer: row.buyer || "-",
    tonnage: Number(row.tonnage || 0),
    amount: getSaleAmount({ ...row, saleType: "credit" }),
    createdAt: row.createdAt || null
  }));

  return [...normalizedCash, ...normalizedCredit];
}

function getFilterState() {
  return {
    agent: agentFilterEl ? agentFilterEl.value : "all",
    saleType: saleTypeFilterEl ? saleTypeFilterEl.value : "all",
    dateFrom: dateFromFilterEl ? dateFromFilterEl.value : "",
    dateTo: dateToFilterEl ? dateToFilterEl.value : ""
  };
}

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

function applySalesFilters(rows) {
  const { agent, saleType, dateFrom, dateTo } = getFilterState();

  return rows.filter((row) => {
    if (agent !== "all" && row.agent !== agent) return false;
    if (saleType !== "all" && row.saleType !== saleType) return false;
    if (!matchesDateFilter(row.createdAt, dateFrom, dateTo)) return false;
    return true;
  });
}

function aggregateByAgent(rows) {
  const bucket = {};

  rows.forEach((row) => {
    const key = row.agent || "Unassigned";
    if (!bucket[key]) {
      bucket[key] = {
        agent: key,
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

    if (row.saleType === "cash") {
      bucket[key].cash += Number(row.amount || 0);
    } else {
      bucket[key].credit += Number(row.amount || 0);
    }
  });

  return Object.values(bucket).sort((a, b) => b.total - a.total);
}

function renderAgentAggregateTable(rows) {
  if (!agentAggregateRowsEl) return;
  if (!rows.length) {
    agentAggregateRowsEl.innerHTML = `
      <tr>
        <td colspan="6">No matching sales records for selected filters.</td>
      </tr>
    `;
    return;
  }

  agentAggregateRowsEl.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${row.agent}</td>
          <td>${row.transactions}</td>
          <td>${row.tonnage.toLocaleString()}</td>
          <td>${fmtUGX(row.cash)}</td>
          <td>${fmtUGX(row.credit)}</td>
          <td>${fmtUGX(row.total)}</td>
        </tr>
      `
    )
    .join("");
}

function refreshAgentReport() {
  if (!agentAggregateRowsEl) return;
  const allSales = normalizeSalesRows();
  filteredSalesRows = applySalesFilters(allSales);
  aggregatedAgentRows = aggregateByAgent(filteredSalesRows);
  renderAgentAggregateTable(aggregatedAgentRows);
}

function getPersonalRowsByPeriod(period) {
  const me = normalizeText(currentAgentName);
  return normalizeSalesRows()
    .filter((row) => normalizeText(row.agent) === me)
    .filter((row) => inSelectedPeriod(row.createdAt, period))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function renderPersonalPeriodReport() {
  if (!personalPeriodFilterEl || !personalSalesRowsEl) return;

  const period = personalPeriodFilterEl.value || "daily";
  const rows = getPersonalRowsByPeriod(period);
  const cashTotal = rows
    .filter((row) => row.saleType === "cash")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const creditTotal = rows
    .filter((row) => row.saleType === "credit")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  document.getElementById("personalTxCount").textContent = String(rows.length);
  document.getElementById("personalCashTotal").textContent = fmtUGX(cashTotal);
  document.getElementById("personalCreditTotal").textContent = fmtUGX(creditTotal);
  document.getElementById("personalSalesTotal").textContent = fmtUGX(cashTotal + creditTotal);

  if (!rows.length) {
    personalSalesRowsEl.innerHTML = '<tr><td colspan="6">No sales found for selected period.</td></tr>';
    return;
  }

  personalSalesRowsEl.innerHTML = rows
    .slice(0, 100)
    .map((row) => `
      <tr>
        <td>${row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</td>
        <td>${row.saleType === "cash" ? "Cash" : "Credit"}</td>
        <td>${row.produce}</td>
        <td>${row.tonnage} kg</td>
        <td>${row.buyer}</td>
        <td>${fmtUGX(row.amount)}</td>
      </tr>
    `)
    .join("");
}

function populateAgentFilter() {
  const allSales = normalizeSalesRows();
  const agents = isSalesAgent
    ? [currentAgentName]
    : Array.from(new Set(allSales.map((row) => row.agent || "Unassigned"))).sort();

  agents.forEach((agent) => {
    if (agentFilterEl) {
      const option = document.createElement("option");
      option.value = agent;
      option.textContent = agent;
      agentFilterEl.appendChild(option);
    }
    if (reportAgentEl) {
      const reportOption = document.createElement("option");
      reportOption.value = agent;
      reportOption.textContent = agent;
      reportAgentEl.appendChild(reportOption);
    }
  });

  if (isSalesAgent) {
    if (agentFilterEl) {
      agentFilterEl.value = currentAgentName;
      agentFilterEl.disabled = true;
    }
    if (reportAgentEl) {
      reportAgentEl.value = currentAgentName;
    }
  }
}

function renderRecentCashTable(rows) {
  const recentCashRows = document.getElementById("recentCashRows");
  visibleCashRows = Array.isArray(rows) ? [...rows] : [];
  if (!recentCashRows) return;

  const rowsToRender = showAllCashRows ? visibleCashRows : visibleCashRows.slice(0, 5);

  if (!rows.length) {
    recentCashRows.innerHTML = `<tr><td colspan="6">No cash sales records for current filter.</td></tr>`;
    if (cashMoreBtn) cashMoreBtn.style.display = "none";
    return;
  }

  recentCashRows.innerHTML = rowsToRender
    .map(
      (row) => `
      <tr>
        <td>${row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</td>
        <td>${row.produce}</td>
        <td>${row.tonnage} kg</td>
        <td>${row.buyer}</td>
        <td>${row.agent || "-"}</td>
        <td>${fmtUGX(row.amountPaid)}</td>
      </tr>
    `
    )
    .join("");

  if (cashMoreBtn) {
    if (visibleCashRows.length <= 5) {
      cashMoreBtn.style.display = "none";
    } else {
      cashMoreBtn.style.display = "inline-flex";
      cashMoreBtn.textContent = showAllCashRows ? "Less" : "More";
    }
  }
}

function renderRecentCreditTable(rows) {
  const recentCreditRows = document.getElementById("recentCreditRows");
  visibleCreditRows = Array.isArray(rows) ? [...rows] : [];
  if (!recentCreditRows) return;

  const rowsToRender = showAllCreditRows ? visibleCreditRows : visibleCreditRows.slice(0, 5);

  if (!visibleCreditRows.length) {
    recentCreditRows.innerHTML = `<tr><td colspan="8">No credit sales records for current filter.</td></tr>`;
    if (creditMoreBtn) creditMoreBtn.style.display = "none";
    return;
  }

  recentCreditRows.innerHTML = rowsToRender
    .map(
      (row) => `
      <tr>
        <td>${row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</td>
        <td>${row.buyer}</td>
        <td>${row.produce}</td>
        <td>${row.tonnage} kg</td>
        <td>${row.agent || "-"}</td>
        <td>${row.contact || "-"}</td>
        <td>${fmtUGX(row.amountDue)}</td>
        <td>${row.dueDate}</td>
      </tr>
    `
    )
    .join("");

  if (creditMoreBtn) {
    if (visibleCreditRows.length <= 5) {
      creditMoreBtn.style.display = "none";
    } else {
      creditMoreBtn.style.display = "inline-flex";
      creditMoreBtn.textContent = showAllCreditRows ? "Less" : "More";
    }
  }
}

function renderCreditCollectionModule() {
  const totalOutstandingEl = document.getElementById("ccTotalOutstanding");
  const collectedToDateEl = document.getElementById("ccCollectedToDate");
  const overdueCountEl = document.getElementById("ccOverdueCount");
  const agingCurrentEl = document.getElementById("ccAgingCurrent");
  const aging1To30El = document.getElementById("ccAging1To30");
  const aging31To60El = document.getElementById("ccAging31To60");
  const aging61To90El = document.getElementById("ccAging61To90");
  const agingAbove90El = document.getElementById("ccAgingAbove90");

  if (
    !creditCollectionRowsEl
    || !totalOutstandingEl
    || !collectedToDateEl
    || !overdueCountEl
    || !agingCurrentEl
    || !aging1To30El
    || !aging31To60El
    || !aging61To90El
    || !agingAbove90El
  ) {
    return;
  }

  const { ledger, summary } = getCreditCollectionsSummary(creditRows);
  visibleCreditCollectionRows = [...ledger];
  const rowsToRender = showAllCreditCollectionRows ? visibleCreditCollectionRows : visibleCreditCollectionRows.slice(0, 5);

  totalOutstandingEl.textContent = fmtUGX(summary.outstandingTotal);
  collectedToDateEl.textContent = fmtUGX(summary.collectedToDate);
  overdueCountEl.textContent = String(summary.overdueCount);
  agingCurrentEl.textContent = fmtUGX(summary.current);
  aging1To30El.textContent = fmtUGX(summary.d1To30);
  aging31To60El.textContent = fmtUGX(summary.d31To60);
  aging61To90El.textContent = fmtUGX(summary.d61To90);
  agingAbove90El.textContent = fmtUGX(summary.above90);

  if (!visibleCreditCollectionRows.length) {
    creditCollectionRowsEl.innerHTML = '<tr><td colspan="10">No credit records available for collection.</td></tr>';
    if (creditCollectionMoreBtn) creditCollectionMoreBtn.style.display = "none";
    return;
  }

  creditCollectionRowsEl.innerHTML = rowsToRender
    .map((entry) => `
      <tr>
        <td>${entry.row.createdAt ? new Date(entry.row.createdAt).toLocaleString() : "-"}</td>
        <td>${entry.row.buyer || "-"}</td>
        <td>${entry.row.produce || "-"}</td>
        <td>${fmtUGX(entry.originalAmount)}</td>
        <td>${fmtUGX(entry.paidAmount)}</td>
        <td>${fmtUGX(entry.balance)}</td>
        <td>${entry.row.dueDate || "-"}</td>
        <td>${entry.daysOverdue}</td>
        <td>${entry.agingBucket}</td>
        <td>
          ${entry.balance > 0 ? `<button class="row-btn" data-collect-id="${entry.saleId}">Record Payment</button>` : "Settled"}
        </td>
      </tr>
    `)
    .join("");

  if (creditCollectionMoreBtn) {
    if (visibleCreditCollectionRows.length <= 5) {
      creditCollectionMoreBtn.style.display = "none";
    } else {
      creditCollectionMoreBtn.style.display = "inline-flex";
      creditCollectionMoreBtn.textContent = showAllCreditCollectionRows ? "Less" : "More";
    }
  }
}

function recordCreditPayment(creditSaleId) {
  const { ledger } = getCreditCollectionsSummary(creditRows);
  const target = ledger.find((entry) => String(entry.saleId) === String(creditSaleId));
  if (!target) {
    alert("Credit sale record not found.");
    return;
  }
  if (target.balance <= 0) {
    alert("This credit sale is already fully paid.");
    return;
  }

  const amountInput = prompt(`Enter payment amount (max ${target.balance}):`, String(target.balance));
  if (amountInput === null) return;
  const amount = Number(String(amountInput).trim());
  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Payment amount must be a positive number.");
    return;
  }
  if (amount > target.balance) {
    alert("Payment amount cannot exceed outstanding balance.");
    return;
  }

  const defaultDate = new Date().toISOString().slice(0, 10);
  const paymentDateInput = prompt("Enter payment date (YYYY-MM-DD):", defaultDate);
  if (paymentDateInput === null) return;
  const paymentDate = String(paymentDateInput).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) || !toDateSafe(`${paymentDate}T00:00:00`)) {
    alert("Payment date must be in YYYY-MM-DD format.");
    return;
  }

  const noteInput = prompt("Payment note (optional):", "") || "";

  const paymentRow = {
    id: `PMT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    creditSaleId: target.saleId,
    amount,
    paymentDate,
    buyer: target.row.buyer || "",
    produce: target.row.produce || "",
    collectedBy: managerUsername,
    note: noteInput.trim(),
    createdAt: new Date().toISOString()
  };

  const payments = getCreditPayments();
  payments.unshift(paymentRow);
  allCreditPayments = payments.slice(0, 2000);
  localStorage.setItem(creditPaymentsKey, JSON.stringify(allCreditPayments));

  renderCreditCollectionModule();
  renderSalesSummaryCards();
  alert("Payment recorded successfully.");
}

function getInventoryEntries() {
  const inventoryMap = JSON.parse(localStorage.getItem(`manager_produce_inventory_${branch}`) || "{}");
  return Object.entries(inventoryMap).sort((a, b) => {
    const aDate = new Date(a[1]?.updatedAt || 0).getTime();
    const bDate = new Date(b[1]?.updatedAt || 0).getTime();
    return bDate - aDate;
  });
}

function renderInventoryTable() {
  if (!inventoryRowsEl) return;

  const entries = getInventoryEntries();
  const rowsToRender = showAllInventoryRows ? entries : entries.slice(0, 5);

  if (!entries.length) {
    inventoryRowsEl.innerHTML = `<tr><td colspan="6">No inventory records available.</td></tr>`;
    if (inventoryMoreBtn) inventoryMoreBtn.style.display = "none";
    return;
  }

  inventoryRowsEl.innerHTML = rowsToRender
    .map(([produceKey, item]) => `
      <tr>
        <td>${item.produceName || produceKey}</td>
        <td>${item.produceType || "-"}</td>
        <td>${Number(item.availableStock || 0).toLocaleString()}</td>
        <td>${fmtUGX(item.sellingPrice || 0)}</td>
        <td>${item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "-"}</td>
        <td>
          <button class="row-btn" data-inv-edit="${produceKey}">Edit</button>
          <button class="row-btn" data-inv-delete="${produceKey}">Delete</button>
        </td>
      </tr>
    `)
    .join("");

  if (inventoryMoreBtn) {
    if (entries.length <= 5) {
      inventoryMoreBtn.style.display = "none";
    } else {
      inventoryMoreBtn.style.display = "inline-flex";
      inventoryMoreBtn.textContent = showAllInventoryRows ? "Less" : "More";
    }
  }
}

function getDamagedProduceRows() {
  const rows = JSON.parse(localStorage.getItem(damagedProduceKey) || "[]");
  if (!Array.isArray(rows)) return [];
  const sorted = rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  if (!isSalesAgent) return sorted;
  const me = normalizeText(currentAgentName);
  return sorted.filter((row) => normalizeText(row.recordedBy) === me);
}

function closeDamagedImageModal() {
  if (!damagedImageModalEl || !damagedImageModalPreviewEl) return;
  damagedImageModalEl.classList.add("hidden");
  damagedImageModalPreviewEl.src = "";
}

function openDamagedImageModal(imageUrl) {
  if (!damagedImageModalEl || !damagedImageModalPreviewEl) return;
  damagedImageModalPreviewEl.src = String(imageUrl || "");
  damagedImageModalEl.classList.remove("hidden");
}

function renderDamagedProduceTable() {
  if (!damagedProduceRowsEl) return;
  const rows = getDamagedProduceRows();
  if (!rows.length) {
    damagedProduceRowsEl.innerHTML = '<tr><td colspan="7">No damaged produce records yet.</td></tr>';
    return;
  }

  damagedProduceRowsEl.innerHTML = rows
    .slice(0, 200)
    .map((row) => `
      <tr>
        <td>${row.damageDate || "-"}</td>
        <td>${row.produce || "-"}</td>
        <td>${row.lotNumber || "-"}</td>
        <td>${Number(row.quantity || 0).toLocaleString()}</td>
        <td>${row.cause || "-"}</td>
        <td>${row.recordedBy || "-"}</td>
        <td>
          ${row.imageDataUrl
            ? `<button class="row-btn collect-btn" data-damage-image-id="${row.id}">View Image</button>`
            : "No image"}
        </td>
      </tr>
    `)
    .join("");
}

function updateInventoryItem(produceKey) {
  const inventoryMap = JSON.parse(localStorage.getItem(`manager_produce_inventory_${branch}`) || "{}");
  const current = inventoryMap[produceKey];
  if (!current) return;

  const nextType = prompt("Produce type:", current.produceType || "") ?? "";
  const nextStock = Number(prompt("Available stock (kg):", String(current.availableStock || 0)));
  const nextSellingPrice = Number(prompt("Selling price (UGX):", String(current.sellingPrice || 0)));

  if (!Number.isFinite(nextStock) || nextStock < 0 || !Number.isFinite(nextSellingPrice) || nextSellingPrice <= 0) {
    alert("Invalid stock or selling price.");
    return;
  }

  inventoryMap[produceKey] = {
    ...current,
    produceType: String(nextType).trim(),
    availableStock: nextStock,
    sellingPrice: nextSellingPrice,
    updatedAt: new Date().toISOString()
  };

  localStorage.setItem(`manager_produce_inventory_${branch}`, JSON.stringify(inventoryMap));
  renderInventoryTable();
}

function deleteInventoryItem(produceKey) {
  if (!confirm("Delete this inventory item?")) return;
  const inventoryMap = JSON.parse(localStorage.getItem(`manager_produce_inventory_${branch}`) || "{}");
  delete inventoryMap[produceKey];
  localStorage.setItem(`manager_produce_inventory_${branch}`, JSON.stringify(inventoryMap));
  renderInventoryTable();
}

function applyCashTableFilters() {
  if (!cashProduceFilterEl || !cashBuyerFilterEl || !cashDateFromFilterEl || !cashDateToFilterEl) {
    renderRecentCashTable(cashRows);
    return;
  }

  const produce = normalizeText(cashProduceFilterEl.value);
  const buyer = normalizeText(cashBuyerFilterEl.value);
  const dateFrom = cashDateFromFilterEl.value;
  const dateTo = cashDateToFilterEl.value;

  const filtered = cashRows.filter((row) => {
    if (produce && !normalizeText(row.produce).includes(produce)) return false;
    if (buyer && !normalizeText(row.buyer).includes(buyer)) return false;
    if (!matchesDateFilter(row.createdAt, dateFrom, dateTo)) return false;
    return true;
  });

  renderRecentCashTable(filtered);
}

function clearCashTableFilters() {
  if (!cashProduceFilterEl || !cashBuyerFilterEl || !cashDateFromFilterEl || !cashDateToFilterEl) {
    showAllCashRows = false;
    renderRecentCashTable(cashRows);
    return;
  }

  cashProduceFilterEl.value = "";
  cashBuyerFilterEl.value = "";
  cashDateFromFilterEl.value = "";
  cashDateToFilterEl.value = "";
  showAllCashRows = false;
  renderRecentCashTable(cashRows);
}

function applyCreditTableFilters() {
  if (!creditProduceFilterEl || !creditBuyerFilterEl || !creditDateFromFilterEl || !creditDateToFilterEl) {
    renderRecentCreditTable(creditRows);
    return;
  }

  const produce = normalizeText(creditProduceFilterEl.value);
  const buyer = normalizeText(creditBuyerFilterEl.value);
  const dateFrom = creditDateFromFilterEl.value;
  const dateTo = creditDateToFilterEl.value;

  const filtered = creditRows.filter((row) => {
    if (produce && !normalizeText(row.produce).includes(produce)) return false;
    if (buyer && !normalizeText(row.buyer).includes(buyer)) return false;
    if (!matchesDateFilter(row.createdAt, dateFrom, dateTo)) return false;
    return true;
  });

  renderRecentCreditTable(filtered);
}

function clearCreditTableFilters() {
  if (!creditProduceFilterEl || !creditBuyerFilterEl || !creditDateFromFilterEl || !creditDateToFilterEl) {
    showAllCreditRows = false;
    renderRecentCreditTable(creditRows);
    return;
  }

  creditProduceFilterEl.value = "";
  creditBuyerFilterEl.value = "";
  creditDateFromFilterEl.value = "";
  creditDateToFilterEl.value = "";
  showAllCreditRows = false;
  renderRecentCreditTable(creditRows);
}

function getLast7Dates() {
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

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function renderWeeklySalesChart() {
  const canvas = document.getElementById("reportWeeklySalesChart");
  if (!canvas || typeof Chart === "undefined") return;

  const labels = getLast7Dates();
  const cashTotals = labels.map((labelDate) => cashRows
    .filter((row) => {
      const dt = toDateSafe(row.createdAt);
      return dt ? isSameDay(dt, labelDate) : false;
    })
    .reduce((sum, row) => sum + getSaleAmount({ ...row, saleType: "cash" }), 0));
  const creditTotals = labels.map((labelDate) => creditRows
    .filter((row) => {
      const dt = toDateSafe(row.createdAt);
      return dt ? isSameDay(dt, labelDate) : false;
    })
    .reduce((sum, row) => sum + getSaleAmount({ ...row, saleType: "credit" }), 0));

  if (reportWeeklySalesChartInstance) reportWeeklySalesChartInstance.destroy();
  reportWeeklySalesChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: labels.map((d) => d.toLocaleDateString()),
      datasets: [
        {
          label: "Cash Sales (UGX)",
          data: cashTotals,
          backgroundColor: CHART_THEME.cash
        },
        {
          label: "Credit Sales (UGX)",
          data: creditTotals,
          backgroundColor: CHART_THEME.credit
        }
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

function renderSalesMixChart() {
  const canvas = document.getElementById("reportSalesMixChart");
  if (!canvas || typeof Chart === "undefined") return;

  const cashTotal = cashRows.reduce((sum, row) => sum + getSaleAmount({ ...row, saleType: "cash" }), 0);
  const creditTotal = creditRows.reduce((sum, row) => sum + getSaleAmount({ ...row, saleType: "credit" }), 0);

  if (reportSalesMixChartInstance) reportSalesMixChartInstance.destroy();
  reportSalesMixChartInstance = new Chart(canvas, {
    type: "pie",
    data: {
      labels: ["Cash Sales", "Credit Sales"],
      datasets: [
        {
          data: [cashTotal, creditTotal],
          backgroundColor: [CHART_THEME.cash, CHART_THEME.credit]
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

function renderReportCharts() {
  renderWeeklySalesChart();
  renderSalesMixChart();
}


function renderSalesSummaryCards() {
  const cashTotal = cashRows.reduce((sum, row) => sum + getSaleAmount({ ...row, saleType: "cash" }), 0);
  const creditTotal = creditRows.reduce((sum, row) => sum + getSaleAmount({ ...row, saleType: "credit" }), 0);
  const outstandingTotal = getCreditCollectionsSummary(creditRows).summary.outstandingTotal;
  const procurementTotal = isSalesAgent
    ? 0
    : JSON.parse(localStorage.getItem(txKey) || "[]")
      .filter((tx) => tx.type === "procurement")
      .reduce((sum, tx) => sum + Number(tx.value || 0), 0);
  const profitTotal = cashTotal + creditTotal - procurementTotal;

  document.getElementById("cashTotal").textContent = fmtUGX(cashTotal);
  document.getElementById("creditTotal").textContent = fmtUGX(creditTotal);
  document.getElementById("creditOutstanding").textContent = fmtUGX(outstandingTotal);
  document.getElementById("profitTotal").textContent = fmtUGX(profitTotal);
  renderReportCharts();
}

function renderProcurementExpenditureSummary() {
  const dailyEl = document.getElementById("expDaily");
  const weeklyEl = document.getElementById("expWeekly");
  const monthlyEl = document.getElementById("expMonthly");
  const quarterlyEl = document.getElementById("expQuarterly");
  const annualEl = document.getElementById("expAnnual");
  const tableBody = document.getElementById("expenditureByProduceRows");

  if (!dailyEl || !weeklyEl || !monthlyEl || !quarterlyEl || !annualEl || !tableBody) return;

  const totals = procurementRows.reduce((acc, row) => {
    const amount = Number(row.amount || 0);
    const createdAt = row.createdAt || "";
    if (inSelectedPeriod(createdAt, "daily")) acc.daily += amount;
    if (inSelectedPeriod(createdAt, "weekly")) acc.weekly += amount;
    if (inSelectedPeriod(createdAt, "monthly")) acc.monthly += amount;
    if (inSelectedPeriod(createdAt, "quarterly")) acc.quarterly += amount;
    if (inSelectedPeriod(createdAt, "yearly")) acc.annual += amount;
    return acc;
  }, { daily: 0, weekly: 0, monthly: 0, quarterly: 0, annual: 0 });

  dailyEl.textContent = fmtUGX(totals.daily);
  weeklyEl.textContent = fmtUGX(totals.weekly);
  monthlyEl.textContent = fmtUGX(totals.monthly);
  quarterlyEl.textContent = fmtUGX(totals.quarterly);
  annualEl.textContent = fmtUGX(totals.annual);

  const byProduce = {};
  procurementRows.forEach((row) => {
    const produce = String(row.produceName || "Unknown").trim() || "Unknown";
    if (!byProduce[produce]) byProduce[produce] = { produce, tonnage: 0, amount: 0 };
    byProduce[produce].tonnage += Number(row.tonnage || 0);
    byProduce[produce].amount += Number(row.amount || 0);
  });

  const rows = Object.values(byProduce).sort((a, b) => b.amount - a.amount);
  if (!rows.length) {
    tableBody.innerHTML = '<tr><td colspan="3">No procurement records yet.</td></tr>';
    return;
  }

  tableBody.innerHTML = rows
    .map((row) => `
      <tr>
        <td>${row.produce}</td>
        <td>${Number(row.tonnage || 0).toLocaleString()}</td>
        <td>${fmtUGX(row.amount)}</td>
      </tr>
    `)
    .join("");
}

function buildReportDataset(reportType, period, selectedAgent) {
  const cashPeriod = cashRows.filter((r) => inSelectedPeriod(r.createdAt, period));
  const creditPeriod = creditRows.filter((r) => inSelectedPeriod(r.createdAt, period));
  const procurementPeriod = procurementRows.filter((r) => inSelectedPeriod(r.createdAt, period));

  if (isSalesAgent) {
    return {
      title: `Personal Sales Report - ${currentAgentName}`,
      cash: cashPeriod,
      credit: creditPeriod,
      procurement: [],
      scope: "sales_agent_personal"
    };
  }

  if (reportType === "sales_agent") {
    const agent = normalizeText(selectedAgent);
    const cash = cashPeriod.filter((r) => normalizeText(r.agent) === agent);
    const credit = creditPeriod.filter((r) => normalizeText(r.agent) === agent);
    return { title: `Sales Agent Report - ${selectedAgent}`, cash, credit, procurement: [], scope: "sales_agent" };
  }

  if (reportType === "manager_personal") {
    const manager = normalizeText(managerUsername);
    const cash = cashPeriod.filter((r) => normalizeText(r.agent) === manager);
    const credit = creditPeriod.filter((r) => normalizeText(r.agent) === manager);
    return { title: `Manager Personal Report - ${managerUsername}`, cash, credit, procurement: procurementPeriod, scope: "manager_personal" };
  }

  if (reportType === "cash") {
    return { title: "Cash Sales Report", cash: cashPeriod, credit: [], procurement: [], scope: "cash" };
  }

  if (reportType === "credit") {
    return { title: "Credit Sales Report", cash: [], credit: creditPeriod, procurement: [], scope: "credit" };
  }

  if (reportType === "procurement") {
    return { title: "Procurement Report", cash: [], credit: [], procurement: procurementPeriod, scope: "procurement" };
  }

  return {
    title: "General Report",
    cash: cashPeriod,
    credit: creditPeriod,
    procurement: procurementPeriod,
    scope: "general"
  };
}

function buildReportSummary(dataset, period) {
  const cashTotal = dataset.cash.reduce((sum, r) => sum + getSaleAmount({ ...r, saleType: "cash" }), 0);
  const creditTotal = dataset.credit.reduce((sum, r) => sum + getSaleAmount({ ...r, saleType: "credit" }), 0);
  const creditOutstandingTotal = getCreditCollectionsSummary(dataset.credit).summary.outstandingTotal;
  const procurementTotal = dataset.procurement.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const net = cashTotal + creditTotal - procurementTotal;

  return {
    branch,
    generatedBy: managerUsername,
    generatedAt: new Date().toISOString(),
    period,
    reportType: dataset.scope,
    cashSalesTotal: cashTotal,
    creditSalesTotal: creditTotal,
    creditOutstandingTotal,
    procurementExpensesTotal: procurementTotal,
    netProfitOrLoss: net,
    profit: net > 0 ? net : 0,
    loss: net < 0 ? Math.abs(net) : 0,
    records: {
      cashCount: dataset.cash.length,
      creditCount: dataset.credit.length,
      procurementCount: dataset.procurement.length
    }
  };
}

function downloadBlob(filename, content, type) {
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

function toCsvRows(dataset, summary) {
  const lines = [];
  lines.push("Section,Date,Name,Produce,Tonnage,Amount,Extra");

  dataset.cash.forEach((r) => {
    lines.push(`Cash,${r.createdAt || ""},${(r.buyer || "").replace(/,/g, " ")},${(r.produce || "").replace(/,/g, " ")},${r.tonnage || 0},${getSaleAmount({ ...r, saleType: "cash" })},Agent:${(r.agent || "").replace(/,/g, " ")}`);
  });

  dataset.credit.forEach((r) => {
    lines.push(`Credit,${r.createdAt || ""},${(r.buyer || "").replace(/,/g, " ")},${(r.produce || "").replace(/,/g, " ")},${r.tonnage || 0},${getSaleAmount({ ...r, saleType: "credit" })},Due:${r.dueDate || ""}`);
  });

  dataset.procurement.forEach((r) => {
    lines.push(`Procurement,${r.createdAt || ""},${(r.dealerName || "").replace(/,/g, " ")},${(r.produceName || "").replace(/,/g, " ")},${r.tonnage || 0},${r.amount || 0},Cost/Kg:${r.unitCost || 0}`);
  });

  lines.push("");
  lines.push("Summary,Value");
  lines.push(`Cash Sales Total,${summary.cashSalesTotal}`);
  lines.push(`Credit Sales Total,${summary.creditSalesTotal}`);
  lines.push(`Credit Outstanding Total,${summary.creditOutstandingTotal}`);
  lines.push(`Procurement Expenses Total,${summary.procurementExpensesTotal}`);
  lines.push(`Net Profit or Loss,${summary.netProfitOrLoss}`);
  lines.push(`Profit,${summary.profit}`);
  lines.push(`Loss,${summary.loss}`);

  return lines.join("\n");
}

function toTxt(dataset, summary, title) {
  const lines = [];
  lines.push(title);
  lines.push(`Branch: ${summary.branch}`);
  lines.push(`Generated By: ${summary.generatedBy}`);
  lines.push(`Generated At: ${new Date(summary.generatedAt).toLocaleString()}`);
  lines.push(`Period: ${summary.period}`);
  lines.push("");
  lines.push(`Cash Sales Total: ${fmtUGX(summary.cashSalesTotal)}`);
  lines.push(`Credit Sales Total: ${fmtUGX(summary.creditSalesTotal)}`);
  lines.push(`Credit Outstanding Total: ${fmtUGX(summary.creditOutstandingTotal)}`);
  lines.push(`Procurement Expenses Total: ${fmtUGX(summary.procurementExpensesTotal)}`);
  lines.push(`Net Profit/Loss: ${fmtUGX(summary.netProfitOrLoss)}`);
  lines.push(`Profit: ${fmtUGX(summary.profit)}`);
  lines.push(`Loss: ${fmtUGX(summary.loss)}`);
  lines.push("");

  lines.push("Cash Records:");
  dataset.cash.forEach((r) => lines.push(`- ${r.createdAt || ""} | ${r.produce} | ${r.tonnage}kg | ${r.buyer} | ${fmtUGX(getSaleAmount({ ...r, saleType: "cash" }))}`));
  lines.push("");

  lines.push("Credit Records:");
  dataset.credit.forEach((r) => lines.push(`- ${r.createdAt || ""} | ${r.produce} | ${r.tonnage}kg | ${r.buyer} | ${fmtUGX(getSaleAmount({ ...r, saleType: "credit" }))} | Due ${r.dueDate || ""}`));
  lines.push("");

  lines.push("Procurement Records:");
  dataset.procurement.forEach((r) => lines.push(`- ${r.createdAt || ""} | ${r.produceName} | ${r.tonnage}kg | ${fmtUGX(r.amount)} | Dealer ${r.dealerName || ""}`));

  return lines.join("\n");
}

function toPdfPrint(title, dataset, summary) {
  const html = `
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #0f172a; }
          h1 { margin: 0 0 8px 0; font-size: 20px; }
          h2 { margin-top: 18px; font-size: 16px; }
          p { margin: 4px 0; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px; font-size: 12px; text-align: left; }
          th { background: #f8fafc; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>Branch: ${summary.branch}</p>
        <p>Generated By: ${summary.generatedBy}</p>
        <p>Generated At: ${new Date(summary.generatedAt).toLocaleString()}</p>
        <p>Period: ${summary.period}</p>
        <h2>Summary</h2>
        <p>Cash Sales Total: ${fmtUGX(summary.cashSalesTotal)}</p>
        <p>Credit Sales Total: ${fmtUGX(summary.creditSalesTotal)}</p>
        <p>Credit Outstanding Total: ${fmtUGX(summary.creditOutstandingTotal)}</p>
        <p>Procurement Expenses Total: ${fmtUGX(summary.procurementExpensesTotal)}</p>
        <p>Net Profit/Loss: ${fmtUGX(summary.netProfitOrLoss)}</p>
        <p>Profit: ${fmtUGX(summary.profit)}</p>
        <p>Loss: ${fmtUGX(summary.loss)}</p>
      </body>
    </html>
  `;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("Unable to open print window. Allow pop-ups and try again.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.onload = () => {
    win.print();
  };
}

function toPdfPrintMultiple(sections, period) {
  const blocks = sections
    .map((section) => `
      <section>
        <h2>${section.title}</h2>
        <p>Period: ${period}</p>
        <p>Cash Sales Total: ${fmtUGX(section.summary.cashSalesTotal)}</p>
        <p>Credit Sales Total: ${fmtUGX(section.summary.creditSalesTotal)}</p>
        <p>Credit Outstanding Total: ${fmtUGX(section.summary.creditOutstandingTotal)}</p>
        <p>Procurement Expenses Total: ${fmtUGX(section.summary.procurementExpensesTotal)}</p>
        <p>Net Profit/Loss: ${fmtUGX(section.summary.netProfitOrLoss)}</p>
      </section>
    `)
    .join('<hr style="margin:16px 0;border:none;border-top:1px solid #cbd5e1;">');

  const html = `
    <!doctype html>
    <html>
      <head>
        <title>Combined Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #0f172a; }
          h1 { margin: 0 0 12px 0; font-size: 20px; }
          h2 { margin: 0 0 8px 0; font-size: 16px; }
          p { margin: 4px 0; font-size: 13px; }
        </style>
      </head>
      <body>
        <h1>Combined Report (${branch} Branch)</h1>
        <p>Generated By: ${managerUsername}</p>
        <p>Generated At: ${new Date().toLocaleString()}</p>
        ${blocks}
      </body>
    </html>
  `;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("Unable to open print window. Allow pop-ups and try again.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.onload = () => {
    win.print();
  };
}

function updateReportBuilderAgentVisibility() {
  if (!reportAgentFieldEl) return;
  const selectedTypes = getSelectedReportTypes();
  const showAgent = selectedTypes.includes("sales_agent") && !isSalesAgent;
  reportAgentFieldEl.classList.toggle("hidden", !showAgent);
}

function getSelectedReportTypes() {
  if (!reportTypeOptionEls.length) {
    return isSalesAgent ? ["cash", "credit"] : ["general"];
  }
  const selected = reportTypeOptionEls
    .filter((input) => input.checked)
    .map((input) => String(input.value || "").trim())
    .filter(Boolean);
  if (!selected.length && isSalesAgent) return ["cash", "credit"];
  return selected;
}

function configureSalesAgentView() {
  if (!isSalesAgent) return;

  const profitLabel = document.getElementById("profitTotal");
  if (profitLabel) {
    const profitCard = profitLabel.closest(".card");
    const titleEl = profitCard ? profitCard.querySelector("h4") : null;
    if (titleEl) titleEl.textContent = "Net Sales";
  }

  if (toggleAgentFiltersBtn) {
    toggleAgentFiltersBtn.style.display = "none";
  }

  if (reportAgentFieldEl) {
    reportAgentFieldEl.classList.add("hidden");
  }

  if (reportTypeOptionEls.length) {
    reportTypeOptionEls.forEach((input) => {
      input.checked = input.value === "cash" || input.value === "credit";
    });
  }
}

function runCustomReportDownload() {
  const format = reportFormatEl ? reportFormatEl.value : "pdf";
  const period = reportPeriodEl ? reportPeriodEl.value : "all_time";
  const selectedTypes = getSelectedReportTypes();
  const selectedAgent = isSalesAgent ? currentAgentName : (reportAgentEl ? reportAgentEl.value : "");

  if (!selectedTypes.length) {
    alert("Select at least one report option.");
    return;
  }

  if (!isSalesAgent && selectedTypes.includes("sales_agent") && !selectedAgent) {
    alert("Select a sales agent for agent-specific report.");
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  if (format === "pdf" && selectedTypes.length > 1) {
    const sections = selectedTypes.map((reportType) => {
      const dataset = buildReportDataset(reportType, period, selectedAgent);
      const summary = buildReportSummary(dataset, period);
      return { reportType, title: dataset.title, summary };
    });
    toPdfPrintMultiple(sections, period);
    return;
  }

  selectedTypes.forEach((reportType) => {
    const dataset = buildReportDataset(reportType, period, selectedAgent);
    const summary = buildReportSummary(dataset, period);
    const title = dataset.title;
    const baseName = `${reportType}_${period}_${stamp}`;

    if (format === "json") {
      const payload = { title, summary, dataset };
      downloadBlob(`${baseName}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
      return;
    }

    if (format === "csv") {
      const csv = toCsvRows(dataset, summary);
      downloadBlob(`${baseName}.csv`, csv, "text/csv;charset=utf-8");
      return;
    }

    if (format === "txt") {
      const txt = toTxt(dataset, summary, title);
      downloadBlob(`${baseName}.txt`, txt, "text/plain;charset=utf-8");
      return;
    }

    toPdfPrint(title, dataset, summary);
  });
}

function printEntireReportPage() {
  const dashboardSection = document.querySelector("main .dashboard");
  if (!dashboardSection) {
    window.print();
    return;
  }

  const clone = dashboardSection.cloneNode(true);
  clone.querySelectorAll("button, .filter-panel, .report-download-block").forEach((el) => el.remove());

  const stylesheetHrefs = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((link) => new URL(link.getAttribute("href") || "", window.location.href).href)
    .filter(Boolean);

  const styles = stylesheetHrefs.map((href) => `<link rel="stylesheet" href="${href}">`).join("");
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Sales Agent Report</title>
        ${styles}
      </head>
      <body>
        <main class="main" style="margin-left:0;margin-top:0;padding:20px;">
          ${clone.outerHTML}
        </main>
      </body>
    </html>
  `;

  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) {
    alert("Unable to open print window. Allow pop-ups and try again.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.onload = () => win.print();
}

function wireEvents() {
  if (toggleAgentFiltersBtn) {
    toggleAgentFiltersBtn.addEventListener("click", () => togglePanel(agentFilterPanel));
  }
  if (toggleCashFiltersBtn) {
    toggleCashFiltersBtn.addEventListener("click", () => togglePanel(cashFilterPanel));
  }
  if (toggleCreditFiltersBtn) {
    toggleCreditFiltersBtn.addEventListener("click", () => togglePanel(creditFilterPanel));
  }
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener("click", refreshAgentReport);
  }
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", () => {
      if (agentFilterEl) agentFilterEl.value = "all";
      if (saleTypeFilterEl) saleTypeFilterEl.value = "all";
      if (dateFromFilterEl) dateFromFilterEl.value = "";
      if (dateToFilterEl) dateToFilterEl.value = "";
      refreshAgentReport();
    });
  }

  if (applyCashFiltersBtn) applyCashFiltersBtn.addEventListener("click", applyCashTableFilters);
  if (clearCashFiltersBtn) clearCashFiltersBtn.addEventListener("click", clearCashTableFilters);
  if (applyCreditFiltersBtn) applyCreditFiltersBtn.addEventListener("click", applyCreditTableFilters);
  if (clearCreditFiltersBtn) clearCreditFiltersBtn.addEventListener("click", clearCreditTableFilters);

  if (cashMoreBtn) {
    cashMoreBtn.addEventListener("click", () => {
      showAllCashRows = !showAllCashRows;
      renderRecentCashTable(visibleCashRows);
    });
  }

  if (creditMoreBtn) {
    creditMoreBtn.addEventListener("click", () => {
      showAllCreditRows = !showAllCreditRows;
      renderRecentCreditTable(visibleCreditRows);
    });
  }

  if (creditCollectionMoreBtn) {
    creditCollectionMoreBtn.addEventListener("click", () => {
      showAllCreditCollectionRows = !showAllCreditCollectionRows;
      renderCreditCollectionModule();
    });
  }

  if (creditCollectionRowsEl) {
    creditCollectionRowsEl.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const saleId = target.dataset.collectId;
      if (!saleId) return;
      recordCreditPayment(saleId);
    });
  }

  if (inventoryMoreBtn) {
    inventoryMoreBtn.addEventListener("click", () => {
      showAllInventoryRows = !showAllInventoryRows;
      renderInventoryTable();
    });
  }

  if (inventoryRowsEl) {
    inventoryRowsEl.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const editKey = target.dataset.invEdit;
      const deleteKey = target.dataset.invDelete;
      if (editKey) {
        updateInventoryItem(editKey);
        return;
      }
      if (deleteKey) {
        deleteInventoryItem(deleteKey);
      }
    });
  }

  if (toggleProcurementSummaryBtn && procurementSummaryPanel) {
    toggleProcurementSummaryBtn.addEventListener("click", () => {
      togglePanel(procurementSummaryPanel);
      const isOpen = !procurementSummaryPanel.classList.contains("hidden");
      toggleProcurementSummaryBtn.textContent = isOpen ? "Hide Summary" : "View Summary";
      if (isOpen) renderProcurementExpenditureSummary();
    });
  }

  if (openReportBuilderBtn && reportBuilderPanel) {
    openReportBuilderBtn.addEventListener("click", () => {
      reportBuilderPanel.classList.remove("hidden");
      updateReportBuilderAgentVisibility();
    });
  }
  if (closeReportBuilderBtn && reportBuilderPanel) {
    closeReportBuilderBtn.addEventListener("click", () => {
      reportBuilderPanel.classList.add("hidden");
    });
  }
  if (reportTypeOptionsEl) reportTypeOptionsEl.addEventListener("change", updateReportBuilderAgentVisibility);
  if (downloadCustomReportBtn) downloadCustomReportBtn.addEventListener("click", runCustomReportDownload);
  if (printEntireReportBtn) printEntireReportBtn.addEventListener("click", printEntireReportPage);

  if (applyPersonalPeriodBtn) {
    applyPersonalPeriodBtn.addEventListener("click", renderPersonalPeriodReport);
  }

  if (togglePersonalReportBtn && personalPeriodPanel) {
    togglePersonalReportBtn.addEventListener("click", () => {
      togglePanel(personalPeriodPanel);
      const isOpen = !personalPeriodPanel.classList.contains("hidden");
      togglePersonalReportBtn.textContent = isOpen ? "Hide My Report" : "View My Report";
      if (isOpen) renderPersonalPeriodReport();
    });
  }

  if (damagedProduceRowsEl) {
    damagedProduceRowsEl.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const imageId = target.dataset.damageImageId;
      if (!imageId) return;
      const rows = getDamagedProduceRows();
      const row = rows.find((item) => String(item.id) === String(imageId));
      if (!row?.imageDataUrl) return;
      openDamagedImageModal(row.imageDataUrl);
    });
  }

  if (closeDamagedImageModalBtn) {
    closeDamagedImageModalBtn.addEventListener("click", closeDamagedImageModal);
  }
  if (damagedImageModalEl) {
    damagedImageModalEl.addEventListener("click", (event) => {
      if (event.target === damagedImageModalEl) closeDamagedImageModal();
    });
  }

  window.addEventListener("storage", (event) => {
    const inventoryKey = `manager_produce_inventory_${branch}`;
    if (!event.key || event.key === inventoryKey) {
      renderInventoryTable();
    }
    if (!event.key || event.key === damagedProduceKey) {
      renderDamagedProduceTable();
    }
    if (!event.key || event.key === creditKey || event.key === creditPaymentsKey) {
      allCreditPayments = JSON.parse(localStorage.getItem(creditPaymentsKey) || "[]");
      renderSalesSummaryCards();
      renderRecentCreditTable(creditRows);
      renderCreditCollectionModule();
    }
  });
}

configureSalesAgentView();
populateAgentFilter();
renderSalesSummaryCards();
renderRecentCashTable(cashRows);
renderRecentCreditTable(creditRows);
renderInventoryTable();
renderDamagedProduceTable();
renderCreditCollectionModule();
renderProcurementExpenditureSummary();
refreshAgentReport();
renderPersonalPeriodReport();
wireEvents();


