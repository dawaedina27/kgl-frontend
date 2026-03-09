// Developer note from me: I wrote and maintain this file for the KGL system, and I keep this logic explicit so future updates are safer.
const branch = localStorage.getItem("branch") || "Maganjo";
const role = localStorage.getItem("role") || "";
const token = localStorage.getItem("token") || "";
const INVENTORY_KEY = `manager_produce_inventory_${branch}`;
const API_BASE = `${window.location.origin}/api`;
const WS_BASE = (() => {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  const isBackendPort = window.location.port === "4000";
  if (isLocalHost && !isBackendPort) return `${protocol}://localhost:4000`;
  return `${protocol}://${window.location.host}`;
})();
const LOW_STOCK_THRESHOLD = 500;
const stockRowsEl = document.getElementById("stockRows");
let stockRealtimeSocket = null;
let stockRealtimeRetryTimer = null;

function formatUGX(value) {
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

function ensureStockAccess() {
  const allowedRoles = new Set(["Manager", "SalesAgent", "Director"]);
  if (!token || !allowedRoles.has(role)) {
    window.location.href = "../../index.html";
    return false;
  }
  return true;
}

async function fetchStockRowsFromApi() {
  const query = role === "Director" ? "" : `?branch=${encodeURIComponent(branch)}`;
  const response = await fetch(`${API_BASE}/stocks${query}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Failed to load stock.");
  }
  return response.json();
}

function fetchStockRowsFromLocal() {
  const inventoryMap = JSON.parse(localStorage.getItem(INVENTORY_KEY) || "{}");
  return Object.values(inventoryMap).map((row) => ({
    ...row,
    branch,
    updatedAt: row.updatedAt || null
  }));
}

async function getStockRows() {
  try {
    const rows = await fetchStockRowsFromApi();
    if (Array.isArray(rows)) return rows;
    return [];
  } catch {
    return fetchStockRowsFromLocal();
  }
}

async function renderStockRows() {
  if (!ensureStockAccess()) return;
  if (!stockRowsEl) return;

  const rows = (await getStockRows()).sort((a, b) => {
    const byBranch = String(a.branch || "").localeCompare(String(b.branch || ""));
    if (byBranch !== 0) return byBranch;
    return String(a.produceName || "").localeCompare(String(b.produceName || ""));
  });

  if (!rows.length) {
    stockRowsEl.innerHTML = `<tr><td colspan="7">No stock records yet.</td></tr>`;
    return;
  }

  stockRowsEl.innerHTML = rows
    .map((row) => {
      const status = getStockStatus(row.availableStock);
      return `
        <tr>
          <td>${row.branch || "-"}</td>
          <td>${row.produceName || "-"}</td>
          <td>${row.produceType || "-"}</td>
          <td>${Number(row.availableStock || 0).toLocaleString()}</td>
          <td><span class="stock-status-chip ${getStockStatusClass(status)}">${status}</span></td>
          <td>${formatUGX(row.sellingPrice || 0)}</td>
          <td>${row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "-"}</td>
        </tr>
      `;
    })
    .join("");
}

function connectStockRealtime() {
  if (!ensureStockAccess()) return;
  if (stockRealtimeSocket && (stockRealtimeSocket.readyState === WebSocket.OPEN || stockRealtimeSocket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const branchScope = role === "Director" ? "all" : branch;
  const wsUrl = `${WS_BASE}/ws/stock-updates?branch=${encodeURIComponent(branchScope)}`;

  try {
    stockRealtimeSocket = new WebSocket(wsUrl);
  } catch {
    return;
  }

  stockRealtimeSocket.onmessage = (event) => {
    try {
      const payload = JSON.parse(String(event.data || "{}"));
      if (payload.type === "stock:update") renderStockRows();
    } catch {
      // Ignore non-JSON frames.
    }
  };

  stockRealtimeSocket.onclose = () => {
    stockRealtimeSocket = null;
    if (stockRealtimeRetryTimer) window.clearTimeout(stockRealtimeRetryTimer);
    stockRealtimeRetryTimer = window.setTimeout(connectStockRealtime, 1500);
  };

  stockRealtimeSocket.onerror = () => {
    try {
      stockRealtimeSocket?.close();
    } catch {
      // Ignore close errors.
    }
  };
}

window.addEventListener("DOMContentLoaded", () => {
  renderStockRows();
  connectStockRealtime();
});
window.addEventListener("focus", renderStockRows);
window.addEventListener("storage", (event) => {
  if (!event.key || event.key === INVENTORY_KEY) renderStockRows();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    renderStockRows();
    connectStockRealtime();
  }
});
window.addEventListener("beforeunload", () => {
  if (stockRealtimeRetryTimer) window.clearTimeout(stockRealtimeRetryTimer);
  if (stockRealtimeSocket && stockRealtimeSocket.readyState === WebSocket.OPEN) {
    stockRealtimeSocket.close();
  }
});

