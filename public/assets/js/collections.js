// Developer note from me: I wrote and maintain this file for the KGL system, and I keep this logic explicit so future updates are safer.
const branch = localStorage.getItem("branch") || "Maganjo";
const currentUsername = localStorage.getItem("username") || "User";
const role = localStorage.getItem("role");
const isManager = role === "Manager";
const isSalesAgent = role === "sales-agent" || role === "SalesAgent";
const creditKey = `manager_credit_sales_${branch}`;
const creditPaymentsKey = `manager_credit_payments_${branch}`;

const creditCollectionRowsEl = document.getElementById("creditCollectionRows");
const creditCollectionMoreBtn = document.getElementById("creditCollectionMoreBtn");
const ccTotalAmountEl = document.getElementById("ccTotalAmount");
const settledCreditRowsEl = document.getElementById("settledCreditRows");
const settledCreditMoreBtn = document.getElementById("settledCreditMoreBtn");

let allCreditRows = JSON.parse(localStorage.getItem(creditKey) || "[]");
let allCreditPayments = JSON.parse(localStorage.getItem(creditPaymentsKey) || "[]");
let showAllCreditCollectionRows = false;
let showAllSettledRows = false;
let visibleCreditCollectionRows = [];
let visibleSettledRows = [];

function generateCreditSaleId() {
  return `CR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function ensureCollectionsAccess() {
  const token = localStorage.getItem("token");
  if (!token || (!isManager && !isSalesAgent)) {
    alert("Please login as Manager or Sales Agent.");
    window.location.href = "../../index.html";
    return false;
  }
  return true;
}

function fmtUGX(value) {
  return "UGX " + Number(value || 0).toLocaleString();
}

function toDateSafe(value) {
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function getCreditSaleId(row) {
  if (row && row.id) return String(row.id);
  const createdAt = row?.createdAt || "";
  const buyer = row?.buyer || "";
  const produce = row?.produce || "";
  const amountDue = Number(row?.amountDue || 0);
  const dueDate = row?.dueDate || "";
  const dispatchDate = row?.dispatchDate || "";
  const agent = row?.agent || "";
  return `${createdAt}|${buyer}|${produce}|${amountDue}|${dueDate}|${dispatchDate}|${agent}`;
}

function ensureCreditIdsAndMigratePayments() {
  const idMap = {};
  let rowsChanged = false;
  allCreditRows = allCreditRows.map((row) => {
    if (row?.id) return row;
    const oldId = getCreditSaleId(row);
    const newId = generateCreditSaleId();
    idMap[oldId] = newId;
    rowsChanged = true;
    return { ...row, id: newId };
  });

  let paymentsChanged = false;
  allCreditPayments = allCreditPayments.map((payment) => {
    const currentId = String(payment?.creditSaleId || "");
    if (!idMap[currentId]) return payment;
    paymentsChanged = true;
    return { ...payment, creditSaleId: idMap[currentId] };
  });

  if (rowsChanged) localStorage.setItem(creditKey, JSON.stringify(allCreditRows.slice(0, 200)));
  if (paymentsChanged) localStorage.setItem(creditPaymentsKey, JSON.stringify(allCreditPayments.slice(0, 2000)));
}

function getCreditPayments() {
  return Array.isArray(allCreditPayments) ? allCreditPayments : [];
}

function getAccessibleCreditRows() {
  if (isSalesAgent) {
    const me = String(currentUsername || "").trim().toLowerCase();
    return allCreditRows.filter((row) => String(row?.agent || "").trim().toLowerCase() === me);
  }
  return allCreditRows;
}

function getPaidAmountForSale(creditSaleId) {
  return getCreditPayments()
    .filter((payment) => String(payment.creditSaleId || "") === String(creditSaleId))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

function getLatestPaymentDateForSale(creditSaleId) {
  const payments = getCreditPayments()
    .filter((payment) => String(payment.creditSaleId || "") === String(creditSaleId))
    .sort((a, b) => new Date(b.paymentDate || b.createdAt || 0) - new Date(a.paymentDate || a.createdAt || 0));
  if (!payments.length) return "";
  return payments[0].paymentDate || payments[0].createdAt || "";
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

function getStatus(daysOverdue, balance, paidAmount) {
  if (balance <= 0) return "Paid";
  if (daysOverdue > 0) return "Overdue";
  if (Number(paidAmount || 0) > 0) return "Partial";
  return "Pending";
}

function getStatusClass(status) {
  const key = String(status || "").trim().toLowerCase();
  if (key === "paid") return "status-paid";
  if (key === "overdue") return "status-overdue";
  if (key === "partial") return "status-partial";
  return "status-pending";
}

function getCreditLedgerRows(rows = allCreditRows) {
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
        status: getStatus(daysOverdue, balance, paidAmount),
        settledOn: getLatestPaymentDateForSale(saleId)
      };
    })
    .sort((a, b) => b.balance - a.balance);
}

function getCreditCollectionsSummary(rows = allCreditRows) {
  const ledger = getCreditLedgerRows(rows);
  const summary = {
    collectedToDate: 0,
    outstandingTotal: 0,
    overdueCount: 0,
    totalAmount: 0,
    settledCount: 0
  };

  ledger.forEach((entry) => {
    if (entry.balance > 0) summary.totalAmount += entry.originalAmount;
    summary.collectedToDate += entry.paidAmount;
    summary.outstandingTotal += entry.balance;
    if (entry.balance > 0 && entry.daysOverdue > 0) summary.overdueCount += 1;
    if (entry.balance <= 0) summary.settledCount += 1;
  });

  return { ledger, summary };
}

function renderCreditCollectionModule() {
  const totalOutstandingEl = document.getElementById("ccTotalOutstanding");
  const collectedToDateEl = document.getElementById("ccCollectedToDate");
  const overdueCountEl = document.getElementById("ccOverdueCount");

  if (
    !creditCollectionRowsEl
    || !settledCreditRowsEl
    || !totalOutstandingEl
    || !collectedToDateEl
    || !overdueCountEl
  ) {
    return;
  }

  const accessibleRows = getAccessibleCreditRows();
  const { ledger, summary } = getCreditCollectionsSummary(accessibleRows);
  visibleCreditCollectionRows = ledger.filter((entry) => entry.balance > 0);
  visibleSettledRows = ledger.filter((entry) => entry.balance <= 0);
  const rowsToRender = showAllCreditCollectionRows ? visibleCreditCollectionRows : visibleCreditCollectionRows.slice(0, 5);
  const settledRowsToRender = showAllSettledRows ? visibleSettledRows : visibleSettledRows.slice(0, 5);

  totalOutstandingEl.textContent = fmtUGX(summary.outstandingTotal);
  collectedToDateEl.textContent = fmtUGX(summary.collectedToDate);
  overdueCountEl.textContent = String(summary.overdueCount);
  if (ccTotalAmountEl) ccTotalAmountEl.textContent = fmtUGX(summary.totalAmount);

  if (!visibleCreditCollectionRows.length) {
    creditCollectionRowsEl.innerHTML = '<tr><td colspan="11">No credit records available for collection.</td></tr>';
    if (creditCollectionMoreBtn) creditCollectionMoreBtn.style.display = "none";
  } else {
    creditCollectionRowsEl.innerHTML = rowsToRender
      .map((entry) => `
        <tr>
          <td>${entry.saleId}</td>
          <td>${entry.row.createdAt ? new Date(entry.row.createdAt).toLocaleString() : "-"}</td>
          <td>${entry.row.buyer || "-"}</td>
          <td>${entry.row.produce || "-"}</td>
          <td>${fmtUGX(entry.originalAmount)}</td>
          <td>${fmtUGX(entry.paidAmount)}</td>
          <td>${fmtUGX(entry.balance)}</td>
          <td>${entry.row.dueDate || "-"}</td>
          <td>${entry.daysOverdue}</td>
          <td><span class="status-chip ${getStatusClass(entry.status)}">${entry.status}</span></td>
          <td>
            <button class="row-btn collect-btn" data-collect-id="${entry.saleId}">Record Payment</button>
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

  if (!visibleSettledRows.length) {
    settledCreditRowsEl.innerHTML = '<tr><td colspan="8">No settled credit records yet.</td></tr>';
    if (settledCreditMoreBtn) settledCreditMoreBtn.style.display = "none";
  } else {
    settledCreditRowsEl.innerHTML = settledRowsToRender
      .map((entry) => `
      <tr>
        <td>${entry.saleId}</td>
        <td>${entry.row.createdAt ? new Date(entry.row.createdAt).toLocaleString() : "-"}</td>
        <td>${entry.row.buyer || "-"}</td>
        <td>${entry.row.produce || "-"}</td>
        <td>${fmtUGX(entry.originalAmount)}</td>
        <td>${fmtUGX(entry.paidAmount)}</td>
        <td><span class="status-chip ${getStatusClass(entry.status)}">${entry.status}</span></td>
        <td>${entry.settledOn ? new Date(entry.settledOn).toLocaleString() : "-"}</td>
      </tr>
    `)
    .join("");

    if (settledCreditMoreBtn) {
      if (visibleSettledRows.length <= 5) {
        settledCreditMoreBtn.style.display = "none";
      } else {
        settledCreditMoreBtn.style.display = "inline-flex";
        settledCreditMoreBtn.textContent = showAllSettledRows ? "Less" : "More";
      }
    }
  }
}

function recordCreditPayment(creditSaleId) {
  const { ledger } = getCreditCollectionsSummary(getAccessibleCreditRows());
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
    collectedBy: currentUsername,
    note: noteInput.trim(),
    createdAt: new Date().toISOString()
  };

  allCreditPayments.unshift(paymentRow);
  allCreditPayments = allCreditPayments.slice(0, 2000);
  localStorage.setItem(creditPaymentsKey, JSON.stringify(allCreditPayments));
  renderCreditCollectionModule();
  alert("Payment recorded successfully.");
}

function wireEvents() {
  if (creditCollectionMoreBtn) {
    creditCollectionMoreBtn.addEventListener("click", () => {
      showAllCreditCollectionRows = !showAllCreditCollectionRows;
      renderCreditCollectionModule();
    });
  }
  if (settledCreditMoreBtn) {
    settledCreditMoreBtn.addEventListener("click", () => {
      showAllSettledRows = !showAllSettledRows;
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

  window.addEventListener("storage", (event) => {
    if (!event.key || event.key === creditKey) {
      allCreditRows = JSON.parse(localStorage.getItem(creditKey) || "[]");
      renderCreditCollectionModule();
    }
    if (!event.key || event.key === creditPaymentsKey) {
      allCreditPayments = JSON.parse(localStorage.getItem(creditPaymentsKey) || "[]");
      renderCreditCollectionModule();
    }
  });
}

if (ensureCollectionsAccess()) {
  ensureCreditIdsAndMigratePayments();
  renderCreditCollectionModule();
  wireEvents();
}

