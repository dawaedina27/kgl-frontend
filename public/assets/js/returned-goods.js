// Developer note from me: I wrote and maintain this file for the KGL system, and I keep this logic explicit so future updates are safer.
const activeBranch = localStorage.getItem("branch") || "Maganjo";
const currentUser = localStorage.getItem("username") || "User";
const currentRole = localStorage.getItem("role") || "";

const cashKey = `manager_cash_sales_${activeBranch}`;
const creditKey = `manager_credit_sales_${activeBranch}`;
const inventoryKey = `manager_produce_inventory_${activeBranch}`;
const returnedKey = `manager_returned_goods_${activeBranch}`;

const returnableSalesRowsEl = document.getElementById("returnableSalesRows");
const returnedGoodsRowsEl = document.getElementById("returnedGoodsRows");

let cashRows = [];
let creditRows = [];
let returnedRows = [];
const RETURN_WINDOW_DAYS = 3;

function readArray(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readObject(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function fmtUGX(value) {
  return "UGX " + Number(value || 0).toLocaleString();
}

function generateSaleId(type) {
  const prefix = type === "credit" ? "CR" : "CS";
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function generateReturnId() {
  return `RT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function ensureIds() {
  let changed = false;
  cashRows = cashRows.map((row) => {
    if (row?.id) return row;
    changed = true;
    return { ...row, id: generateSaleId("cash") };
  });
  creditRows = creditRows.map((row) => {
    if (row?.id) return row;
    changed = true;
    return { ...row, id: generateSaleId("credit") };
  });
  if (changed) {
    localStorage.setItem(cashKey, JSON.stringify(cashRows.slice(0, 200)));
    localStorage.setItem(creditKey, JSON.stringify(creditRows.slice(0, 200)));
  }
}

function isAllowed() {
  const token = localStorage.getItem("token");
  const isManager = currentRole === "Manager";
  const isSalesAgent = currentRole === "SalesAgent" || currentRole === "sales-agent";
  if (!token || (!isManager && !isSalesAgent)) {
    window.location.href = "../../index.html";
    return false;
  }
  return true;
}

function getVisibleSales() {
  const isSalesAgent = currentRole === "SalesAgent" || currentRole === "sales-agent";
  const cash = cashRows.map((row) => ({ ...row, saleType: "cash" }));
  const credit = creditRows.map((row) => ({ ...row, saleType: "credit" }));
  const merged = [...cash, ...credit].filter(isStillReturnable);
  if (!isSalesAgent) return merged;
  const me = String(currentUser).trim().toLowerCase();
  return merged.filter((row) => String(row.agent || "").trim().toLowerCase() === me);
}

function isStillReturnable(row) {
  const purchaseDate = row?.createdAt ? new Date(row.createdAt) : null;
  if (!purchaseDate || Number.isNaN(purchaseDate.getTime())) return false;
  const now = Date.now();
  const ageDays = Math.floor((now - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
  return ageDays <= RETURN_WINDOW_DAYS;
}

function purgeExpiredReturnableSales() {
  const nextCash = cashRows.filter(isStillReturnable);
  const nextCredit = creditRows.filter(isStillReturnable);

  if (nextCash.length !== cashRows.length) {
    cashRows = nextCash;
    localStorage.setItem(cashKey, JSON.stringify(cashRows.slice(0, 200)));
  }

  if (nextCredit.length !== creditRows.length) {
    creditRows = nextCredit;
    localStorage.setItem(creditKey, JSON.stringify(creditRows.slice(0, 200)));
  }
}

function renderReturnableSalesTable() {
  if (!returnableSalesRowsEl) return;
  const rows = getVisibleSales();
  if (!rows.length) {
    returnableSalesRowsEl.innerHTML = '<tr><td colspan="9">No sales available for return.</td></tr>';
    return;
  }

  returnableSalesRowsEl.innerHTML = rows
    .map((row) => `
      <tr>
        <td>${row.id || "-"}</td>
        <td>${row.saleType === "credit" ? "Credit" : "Cash"}</td>
        <td>${row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</td>
        <td>${row.buyer || "-"}</td>
        <td>${row.produce || "-"}</td>
        <td>${Number(row.tonnage || 0)} kg</td>
        <td>${fmtUGX(row.saleType === "credit" ? row.amountDue : row.amountPaid)}</td>
        <td>${row.agent || "-"}</td>
        <td><button class="row-btn collect-btn" data-return-id="${row.id}" data-return-type="${row.saleType}">Record Return</button></td>
      </tr>
    `)
    .join("");
}

function renderReturnedGoodsTable() {
  if (!returnedGoodsRowsEl) return;
  const isSalesAgent = currentRole === "SalesAgent" || currentRole === "sales-agent";
  const rows = isSalesAgent
    ? returnedRows.filter((row) => String(row.agent || "").trim().toLowerCase() === String(currentUser).trim().toLowerCase())
    : returnedRows;

  if (!rows.length) {
    returnedGoodsRowsEl.innerHTML = '<tr><td colspan="11">No returned goods recorded yet.</td></tr>';
    return;
  }

  returnedGoodsRowsEl.innerHTML = rows
    .map((row) => `
      <tr>
        <td>${row.returnId || "-"}</td>
        <td>${row.originalSaleId || "-"}</td>
        <td>${row.saleType === "credit" ? "Credit" : "Cash"}</td>
        <td>${row.returnedAt ? new Date(row.returnedAt).toLocaleString() : "-"}</td>
        <td>${row.buyer || "-"}</td>
        <td>${row.produce || "-"}</td>
        <td>${Number(row.tonnage || 0)} kg</td>
        <td>${fmtUGX(row.amount || 0)}</td>
        <td>${row.returnedBy || "-"}</td>
        <td>${row.condition || "-"}</td>
        <td>${row.reason || "-"}</td>
      </tr>
    `)
    .join("");
}

function restoreStock(produce, tonnage) {
  const inventoryMap = readObject(inventoryKey);
  const key = String(produce || "").trim().toLowerCase();
  if (!key || !inventoryMap[key]) return;
  inventoryMap[key].availableStock = Number(inventoryMap[key].availableStock || 0) + Number(tonnage || 0);
  inventoryMap[key].updatedAt = new Date().toISOString();
  localStorage.setItem(inventoryKey, JSON.stringify(inventoryMap));
}

function recordReturn(saleId, saleType) {
  const sourceRows = saleType === "credit" ? creditRows : cashRows;
  const index = sourceRows.findIndex((row) => String(row.id) === String(saleId));
  if (index < 0) {
    alert("Sale record not found.");
    return;
  }

  const row = sourceRows[index];
  const purchaseDate = row?.createdAt ? new Date(row.createdAt) : null;
  if (!purchaseDate || Number.isNaN(purchaseDate.getTime())) {
    alert("Cannot process return: purchase date is missing.");
    return;
  }
  const now = new Date();
  const ageDays = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
  if (ageDays > RETURN_WINDOW_DAYS) {
    alert("Return rejected: goods must be returned within 3 days from purchase date.");
    return;
  }

  const conditionInput = (prompt("Condition check (good/damaged):", "good") || "").trim().toLowerCase();
  const isGoodCondition = conditionInput === "good";
  if (!isGoodCondition) {
    alert("Return rejected: only goods in good condition can be accepted.");
    return;
  }

  const reason = (prompt("Reason for return:", "Returned by buyer") || "").trim();
  if (!reason) {
    alert("Return reason is required.");
    return;
  }

  sourceRows.splice(index, 1);
  if (saleType === "credit") {
    creditRows = sourceRows;
    localStorage.setItem(creditKey, JSON.stringify(creditRows.slice(0, 200)));
  } else {
    cashRows = sourceRows;
    localStorage.setItem(cashKey, JSON.stringify(cashRows.slice(0, 200)));
  }

  const amount = saleType === "credit" ? Number(row.amountDue || 0) : Number(row.amountPaid || 0);
  returnedRows.unshift({
    returnId: generateReturnId(),
    originalSaleId: row.id,
    saleType,
    buyer: row.buyer || "",
    produce: row.produce || "",
    tonnage: Number(row.tonnage || 0),
    amount,
    agent: row.agent || "",
    returnedBy: currentUser,
    condition: "Good",
    reason,
    returnedAt: new Date().toISOString(),
    branch: activeBranch
  });
  returnedRows = returnedRows.slice(0, 1000);
  localStorage.setItem(returnedKey, JSON.stringify(returnedRows));

  restoreStock(row.produce, row.tonnage);
  renderReturnableSalesTable();
  renderReturnedGoodsTable();
  alert("Returned goods recorded and stock updated.");
}

function wireEvents() {
  if (!returnableSalesRowsEl) return;
  returnableSalesRowsEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const saleId = target.dataset.returnId;
    const saleType = target.dataset.returnType;
    if (!saleId || !saleType) return;
    recordReturn(saleId, saleType);
  });
}

function init() {
  if (!isAllowed()) return;
  cashRows = readArray(cashKey);
  creditRows = readArray(creditKey);
  returnedRows = readArray(returnedKey);
  ensureIds();
  purgeExpiredReturnableSales();
  renderReturnableSalesTable();
  renderReturnedGoodsTable();
  wireEvents();
}

init();

