// Developer note from me: I wrote and maintain this file for the KGL system, and I keep this logic explicit so future updates are safer.
const branch = (localStorage.getItem("branch") || "Maganjo").trim();
const role = localStorage.getItem("role");
const suppliersKey = `manager_suppliers_${branch}`;
const procurementKey = `manager_procurements_${branch}`;

function ensureManagerRole() {
  const token = localStorage.getItem("token");
  if (!token || role !== "Manager") {
    alert("Please login as Manager.");
    window.location.href = "../../index.html";
    return false;
  }
  return true;
}

function fmtUGX(value) {
  return "UGX " + Number(value || 0).toLocaleString();
}

function normalizeKey(name, contact) {
  return `${String(name || "").trim().toLowerCase()}|${String(contact || "").trim()}`;
}

function loadSuppliers() {
  const rows = JSON.parse(localStorage.getItem(suppliersKey) || "[]");
  return Array.isArray(rows) ? rows : [];
}

function saveSuppliers(rows) {
  localStorage.setItem(suppliersKey, JSON.stringify(rows.slice(0, 2000)));
}

function rebuildSuppliersFromProcurementsIfNeeded() {
  const existing = loadSuppliers();
  if (existing.length) return;

  const procurements = JSON.parse(localStorage.getItem(procurementKey) || "[]");
  if (!Array.isArray(procurements) || !procurements.length) return;

  const map = {};
  procurements.forEach((row) => {
    const supplierName = String(row.dealerName || "").trim();
    const supplierContact = String(row.dealerContact || "").trim();
    if (!supplierName || !supplierContact) return;

    const key = normalizeKey(supplierName, supplierContact);
    if (!map[key]) {
      map[key] = {
        supplierId: key,
        supplierName,
        supplierContact,
        totalProcurements: 0,
        totalTonnage: 0,
        totalExpenditure: 0,
        lastProduce: "",
        lastSuppliedAt: "",
        createdAt: row.createdAt || new Date().toISOString(),
        updatedAt: row.createdAt || new Date().toISOString()
      };
    }

    const suppliedAt = row.createdAt || new Date().toISOString();
    const current = map[key];
    current.totalProcurements += 1;
    current.totalTonnage += Number(row.tonnage || 0);
    current.totalExpenditure += Number(row.amount || 0);
    if (!current.lastSuppliedAt || new Date(suppliedAt).getTime() >= new Date(current.lastSuppliedAt).getTime()) {
      current.lastSuppliedAt = suppliedAt;
      current.lastProduce = String(row.produceName || "").trim();
    }
    current.updatedAt = new Date().toISOString();
  });

  saveSuppliers(Object.values(map));
}

function renderSuppliersTable() {
  const tbody = document.getElementById("suppliersRows");
  if (!tbody) return;

  const suppliers = loadSuppliers().sort((a, b) => {
    const aDate = new Date(a.lastSuppliedAt || 0).getTime();
    const bDate = new Date(b.lastSuppliedAt || 0).getTime();
    return bDate - aDate;
  });

  if (!suppliers.length) {
    tbody.innerHTML = '<tr><td colspan="7">No suppliers recorded yet.</td></tr>';
    return;
  }

  tbody.innerHTML = suppliers
    .map((row) => `
      <tr>
        <td>${row.supplierName || "-"}</td>
        <td>${row.supplierContact || "-"}</td>
        <td>${Number(row.totalProcurements || 0).toLocaleString()}</td>
        <td>${Number(row.totalTonnage || 0).toLocaleString()}</td>
        <td>${fmtUGX(row.totalExpenditure || 0)}</td>
        <td>${row.lastProduce || "-"}</td>
        <td>${row.lastSuppliedAt ? new Date(row.lastSuppliedAt).toLocaleString() : "-"}</td>
      </tr>
    `)
    .join("");
}

if (ensureManagerRole()) {
  rebuildSuppliersFromProcurementsIfNeeded();
  renderSuppliersTable();

  window.addEventListener("storage", (event) => {
    if (!event.key || event.key === suppliersKey || event.key === procurementKey) {
      rebuildSuppliersFromProcurementsIfNeeded();
      renderSuppliersTable();
    }
  });
}

