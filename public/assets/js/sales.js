// Developer note from me: I wrote and maintain this file for the KGL system, and I keep this logic explicit so future updates are safer.
const saleTypeEl = document.getElementById("saleType");
const cashSection = document.getElementById("cashSection");
const creditSection = document.getElementById("creditSection");

const cashSaleForm = document.getElementById("cashSaleForm");
const creditSaleForm = document.getElementById("creditSaleForm");
const addCashBtn = document.getElementById("addCashBtn");
const addCreditBtn = document.getElementById("addCreditBtn");
const updateCashBtn = document.getElementById("updateCashBtn");
const updateCreditBtn = document.getElementById("updateCreditBtn");
const clearCashBtn = document.getElementById("clearCashBtn");
const clearCreditBtn = document.getElementById("clearCreditBtn");

const cashTableBody = document.querySelector("#cashTable tbody");
const creditTableBody = document.querySelector("#creditTable tbody");
const cartTableBody = document.querySelector("#cartTable tbody");
const cashMoreBtn = document.getElementById("cashMoreBtn");
const creditMoreBtn = document.getElementById("creditMoreBtn");
const formOverlay = document.getElementById("formOverlay");

const produceEl = document.getElementById("produce");
const stockEl = document.getElementById("stock");
const priceEl = document.getElementById("price");
const tonnageEl = document.getElementById("tonnage");
const amountPaidEl = document.getElementById("amountPaid");
const agentEl = document.getElementById("agent");
const cProduceEl = document.getElementById("cProduce");
const cStockEl = document.getElementById("cStock");
const cSellingPriceEl = document.getElementById("cSellingPrice");
const cTonnageEl = document.getElementById("cTonnage");
const amountDueEl = document.getElementById("amountDue");
const cAgentEl = document.getElementById("cAgent");
const produceTypeEl = document.getElementById("type");
const viewCashProduceImageBtn = document.getElementById("viewCashProduceImageBtn");
const viewCreditProduceImageBtn = document.getElementById("viewCreditProduceImageBtn");
const produceImageModal = document.getElementById("produceImageModal");
const produceImageModalTitle = document.getElementById("produceImageModalTitle");
const produceImagePreview = document.getElementById("produceImagePreview");
const closeProduceImageModalBtn = document.getElementById("closeProduceImageModalBtn");
const cashProduceInlineImage = document.getElementById("cashProduceInlineImage");
const creditProduceInlineImage = document.getElementById("creditProduceInlineImage");
const cashProduceImageGallery = document.getElementById("cashProduceImageGallery");
const creditProduceImageGallery = document.getElementById("creditProduceImageGallery");

const cartTotalAmount = document.getElementById("cartTotalAmount");
const completeSaleBtn = document.getElementById("completeSaleBtn");
const clearCartBtn = document.getElementById("clearCartBtn");
const printReceiptBtn = document.getElementById("printReceiptBtn");
const receiptOutput = document.getElementById("receiptOutput");
const receiptSectionEl = document.getElementById("receiptSection");
const cartSectionEl = document.getElementById("salesCartSection");
const ACTIVE_BRANCH = localStorage.getItem("branch") || "Maganjo";
const API_BASE = (() => {
  const host = window.location.hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  const isBackendPort = window.location.port === "4000";
  if (isLocalHost && !isBackendPort) return "http://localhost:4000/api";
  return `${window.location.origin}/api`;
})();
const WS_BASE = (() => {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  const isBackendPort = window.location.port === "4000";
  if (isLocalHost && !isBackendPort) return `${protocol}://localhost:4000`;
  return `${protocol}://${window.location.host}`;
})();

let liveStockMap = {};
const produceImageOptionsByProduce = {};
let selectedCashProduceImage = "";
let selectedCreditProduceImage = "";

const CASH_KEY = `manager_cash_sales_${ACTIVE_BRANCH}`;
const CREDIT_KEY = `manager_credit_sales_${ACTIVE_BRANCH}`;
const CART_KEY = `manager_sales_cart_${ACTIVE_BRANCH}`;
const INVENTORY_KEY = `manager_produce_inventory_${ACTIVE_BRANCH}`;
const PRODUCE_OPTIONS = ["Beans", "Grain Maize", "Cow peas", "G-nuts", "Soybeans"];
let stockRealtimeSocket = null;
let stockRealtimeRetryTimer = null;

function readArrayFromStorage(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let cashSales = readArrayFromStorage(CASH_KEY);
let creditSales = readArrayFromStorage(CREDIT_KEY);
let cartItems = readArrayFromStorage(CART_KEY);
let showAllCashRows = false;
let showAllCreditRows = false;
let cashEditIndex = null;
let creditEditIndex = null;

async function api(path, options = {}) {
  const token = localStorage.getItem("token") || "";
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }
  return data;
}

function ensureSaleIds() {
  let changed = false;
  cashSales = cashSales.map((row) => {
    if (row && row.id) return row;
    changed = true;
    return { ...row, id: generateSaleId("cash") };
  });
  creditSales = creditSales.map((row) => {
    if (row && row.id) return row;
    changed = true;
    return { ...row, id: generateSaleId("credit") };
  });
  if (changed) {
    localStorage.setItem(CASH_KEY, JSON.stringify(cashSales.slice(0, 200)));
    localStorage.setItem(CREDIT_KEY, JSON.stringify(creditSales.slice(0, 200)));
  }
}

function ensureSalesAccess() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const allowed = role === "Manager" || role === "sales-agent" || role === "SalesAgent";
  if (!token || !allowed) {
    alert("Please login as Manager or Sales Agent to record sales.");
    window.location.href = "../../index.html";
    return false;
  }
  return true;
}

function formatUGX(value) {
  return "UGX " + Number(value || 0).toLocaleString();
}

function generateSaleId(type) {
  const prefix = type === "credit" ? "CR" : "CS";
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function isAlphaNumericMin2(value) {
  const raw = String(value || "").trim();
  return /^[A-Za-z0-9 -]{2,}$/.test(raw);
}

function displayRole(role) {
  const compact = String(role || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (compact === "salesagent") return "Sales Agent";
  if (compact === "manager") return "Manager";
  if (compact === "director") return "Director";
  return String(role || "").trim() || "User";
}

function isValidNin(value) {
  const raw = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9]{14}$/.test(raw);
}

function isValidPhone(value) {
  const raw = String(value || "").trim();
  return /^(?:\+256|0)7\d{8}$/.test(raw);
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function addProduceImageOption(produceKey, imageData) {
  const key = normalizeKey(produceKey);
  const image = String(imageData || "").trim();
  if (!key || !image) return;
  if (!produceImageOptionsByProduce[key]) produceImageOptionsByProduce[key] = [];
  if (!produceImageOptionsByProduce[key].includes(image)) {
    produceImageOptionsByProduce[key].push(image);
  }
}

function renderProduceImageGallery(kind, produceKey) {
  const key = normalizeKey(produceKey);
  const galleryEl = kind === "cash" ? cashProduceImageGallery : creditProduceImageGallery;
  if (!galleryEl) return;
  if (key) {
    const fromCurrentData = String(getProduceData(produceKey)?.image || "").trim();
    if (fromCurrentData) addProduceImageOption(key, fromCurrentData);
  }
  const options = key ? (produceImageOptionsByProduce[key] || []) : [];
  if (!options.length) {
    galleryEl.innerHTML = "";
    galleryEl.classList.add("hidden");
    if (kind === "cash") {
      selectedCashProduceImage = "";
      setInlineProduceImage(cashProduceInlineImage, produceKey);
    } else {
      selectedCreditProduceImage = "";
      setInlineProduceImage(creditProduceInlineImage, produceKey);
    }
    return;
  }

  const selectedImage = kind === "cash" ? selectedCashProduceImage : selectedCreditProduceImage;
  const currentSelected = options.includes(selectedImage) ? selectedImage : options[0];
  if (kind === "cash") {
    selectedCashProduceImage = currentSelected;
    setInlineProduceImage(cashProduceInlineImage, produceKey, currentSelected);
  } else {
    selectedCreditProduceImage = currentSelected;
    setInlineProduceImage(creditProduceInlineImage, produceKey, currentSelected);
  }

  galleryEl.classList.remove("hidden");
  galleryEl.innerHTML = options
    .map((image, index) => `
      <button
        type="button"
        class="produce-image-option ${image === currentSelected ? "active" : ""}"
        data-kind="${kind}"
        data-image-index="${index}"
        aria-label="Select produce image ${index + 1}"
      >
        <img src="${image}" alt="Produce image option ${index + 1}">
      </button>
    `)
    .join("");
}

async function loadBranchStockFromBackend() {
  const rows = await api(`/stocks?branch=${encodeURIComponent(ACTIVE_BRANCH)}`);
  const map = {};
  Object.keys(produceImageOptionsByProduce).forEach((key) => { delete produceImageOptionsByProduce[key]; });
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = normalizeKey(row.produceName);
    if (!key) return;
    const image = String(row.produceImage || "").trim();
    map[key] = {
      stock: Number(row.availableStock || 0),
      price: Number(row.sellingPrice || 0),
      type: String(row.produceType || "").trim(),
      image
    };
    addProduceImageOption(key, image);
  });
  liveStockMap = map;
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(Object.fromEntries(Object.entries(map).map(([key, value]) => [key, {
    produceName: key,
    produceType: value.type,
    produceImage: value.image,
    availableStock: value.stock,
    sellingPrice: value.price,
    updatedAt: new Date().toISOString()
  }]))));
}

async function loadProduceImagesFromProcurements() {
  const rows = await api(`/procurements?branch=${encodeURIComponent(ACTIVE_BRANCH)}`);
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    addProduceImageOption(row.produceName, row.produceImage);
  });
}

async function refreshBranchStockForEveryone() {
  try {
    await loadBranchStockFromBackend();
    updateCashProduceDetails();
    updateCreditProduceDetails();
  } catch {
    // Keep current values when backend is temporarily unavailable.
  }
}

function connectStockRealtime() {
  if (!ensureSalesAccess()) return;
  if (stockRealtimeSocket && (stockRealtimeSocket.readyState === WebSocket.OPEN || stockRealtimeSocket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const wsUrl = `${WS_BASE}/ws/stock-updates?branch=${encodeURIComponent(ACTIVE_BRANCH)}`;

  try {
    stockRealtimeSocket = new WebSocket(wsUrl);
  } catch {
    return;
  }

  stockRealtimeSocket.onmessage = (event) => {
    try {
      const payload = JSON.parse(String(event.data || "{}"));
      if (payload.type === "stock:update") refreshBranchStockForEveryone();
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

function populateProduceSelectors() {
  const selectedCash = String(produceEl?.value || "");
  const selectedCredit = String(cProduceEl?.value || "");
  const options = PRODUCE_OPTIONS
    .map((name) => `<option value="${name}">${name}</option>`)
    .join("");
  const base = `<option value="">-- Select Produce --</option>${options}`;
  if (produceEl) {
    produceEl.innerHTML = base;
    produceEl.value = PRODUCE_OPTIONS.includes(selectedCash) ? selectedCash : "";
  }
  if (cProduceEl) {
    cProduceEl.innerHTML = base;
    cProduceEl.value = PRODUCE_OPTIONS.includes(selectedCredit) ? selectedCredit : "";
  }
}

function syncPageTitle() {
  const titleEl = document.querySelector(".page-title");
  if (titleEl) {
    titleEl.textContent = `Produce Sales - ${ACTIVE_BRANCH}`;
  }
}

function syncAgentFields() {
  const username = localStorage.getItem("username") || "Manager";
  const role = displayRole(localStorage.getItem("role"));
  const recordedBy = `${role} - ${username}`;
  agentEl.value = recordedBy;
  cAgentEl.value = recordedBy;
}

function getInventoryMap() {
  return JSON.parse(localStorage.getItem(INVENTORY_KEY) || "{}");
}

function getProduceData(produceKey) {
  if (!produceKey) return null;
  const key = normalizeKey(produceKey);
  if (liveStockMap[key]) return { ...liveStockMap[key] };
  const inventoryMap = getInventoryMap();
  if (!inventoryMap[key]) return null;
  return {
    stock: Number(inventoryMap[key].availableStock || 0),
    price: Number(inventoryMap[key].sellingPrice || 0),
    type: String(inventoryMap[key].produceType || ""),
    image: String(inventoryMap[key].produceImage || "")
  };
}

function setInlineProduceImage(imgEl, produceKey, preferredImage = "") {
  if (!imgEl) return;
  const preferred = String(preferredImage || "").trim();
  const selected = getProduceData(produceKey);
  const image = preferred || String(selected?.image || "").trim();
  if (!image) {
    imgEl.removeAttribute("src");
    imgEl.classList.add("hidden");
    imgEl.setAttribute("aria-hidden", "true");
    return;
  }

  imgEl.src = image;
  imgEl.classList.remove("hidden");
  imgEl.setAttribute("aria-hidden", "false");
}

function closeProduceImageModal() {
  if (!produceImageModal) return;
  produceImageModal.classList.add("hidden");
  produceImageModal.setAttribute("aria-hidden", "true");
}

function showProduceImageModal(produceKey, preferredImage = "") {
  if (!produceImageModal || !produceImagePreview) return;
  const selected = getProduceData(produceKey);
  const label = String(produceKey || "").trim() || "Produce";
  if (produceImageModalTitle) produceImageModalTitle.textContent = `${label} Image`;
  const image = String(preferredImage || "").trim() || String(selected?.image || "").trim();
  if (image) {
    produceImagePreview.src = image;
    produceImagePreview.classList.remove("hidden");
  } else {
    produceImagePreview.removeAttribute("src");
    produceImagePreview.classList.add("hidden");
  }
  produceImageModal.classList.remove("hidden");
  produceImageModal.setAttribute("aria-hidden", "false");
}

function setSaleType(value) {
  const isCash = value === "cash";
  const isCredit = value === "credit";

  const activeEl = document.activeElement;
  if (!isCash && activeEl instanceof HTMLElement && cashSection.contains(activeEl)) {
    activeEl.blur();
  }
  if (!isCredit && activeEl instanceof HTMLElement && creditSection.contains(activeEl)) {
    activeEl.blur();
  }

  cashSection.classList.toggle("hidden", !isCash);
  creditSection.classList.toggle("hidden", !isCredit);
  cashSection.setAttribute("aria-hidden", String(!isCash));
  creditSection.setAttribute("aria-hidden", String(!isCredit));
  cashSection.inert = !isCash;
  creditSection.inert = !isCredit;
}

function updateCashProduceDetails() {
  const selected = getProduceData(produceEl.value);
  stockEl.value = selected ? selected.stock : "";
  priceEl.value = selected ? selected.price : "";
  addProduceImageOption(produceEl.value, selected?.image || "");
  renderProduceImageGallery("cash", produceEl.value);
  updateCashAmountPaid();
}

function updateCashAmountPaid() {
  const tonnage = Number(tonnageEl.value || 0);
  const unitPrice = Number(priceEl.value || 0);
  amountPaidEl.value = tonnage > 0 && unitPrice > 0 ? tonnage * unitPrice : "";
}

function updateCreditProduceDetails() {
  const selected = getProduceData(cProduceEl.value);
  cStockEl.value = selected ? selected.stock : "";
  cSellingPriceEl.value = selected ? selected.price : "";
  produceTypeEl.value = selected ? selected.type : "";
  addProduceImageOption(cProduceEl.value, selected?.image || "");
  renderProduceImageGallery("credit", cProduceEl.value);
  updateCreditAmountDue();
}

function updateCreditAmountDue() {
  const tonnage = Number(cTonnageEl.value || 0);
  const sellingPrice = Number(cSellingPriceEl.value || 0);
  amountDueEl.value = tonnage > 0 && sellingPrice > 0 ? tonnage * sellingPrice : "";
}

function renderCashTable() {
  if (cashSales.length === 0) {
    cashTableBody.innerHTML = `<tr><td colspan="7">No cash sales recorded.</td></tr>`;
    if (cashMoreBtn) cashMoreBtn.classList.add("hidden");
    return;
  }
  const rowsToRender = showAllCashRows ? cashSales : cashSales.slice(0, 5);
  cashTableBody.innerHTML = rowsToRender.map((row, index) => `
    <tr>
      <td>${row.id || "-"}</td>
      <td>${row.produce}</td>
      <td>${row.tonnage} kg</td>
      <td>${formatUGX(row.amountPaid)}</td>
      <td>${row.buyer}</td>
      <td>${row.agent}</td>
      <td>
        <button class="mini-btn edit-btn" data-cash-edit-index="${index}"><i class="fa-regular fa-image"></i> Edit</button>
        <button class="mini-btn print-btn" data-cash-print-index="${index}"><i class="fa-solid fa-print"></i> Print</button>
      </td>
    </tr>
  `).join("");

  if (cashMoreBtn) {
    if (cashSales.length <= 5) {
      cashMoreBtn.classList.add("hidden");
    } else {
      cashMoreBtn.classList.remove("hidden");
      cashMoreBtn.textContent = showAllCashRows ? "Less" : "More";
    }
  }
}

function renderCreditTable() {
  if (creditSales.length === 0) {
    creditTableBody.innerHTML = `<tr><td colspan="7">No credit sales recorded.</td></tr>`;
    if (creditMoreBtn) creditMoreBtn.classList.add("hidden");
    return;
  }
  const rowsToRender = showAllCreditRows ? creditSales : creditSales.slice(0, 5);
  creditTableBody.innerHTML = rowsToRender.map((row, index) => `
    <tr>
      <td>${row.id || "-"}</td>
      <td>${row.buyer}</td>
      <td>${row.produce}</td>
      <td>${row.tonnage} kg</td>
      <td>${formatUGX(row.amountDue)}</td>
      <td>${row.dueDate}</td>
      <td>
        <button class="mini-btn edit-btn" data-credit-edit-index="${index}"><i class="fa-regular fa-image"></i> Edit</button>
        <button class="mini-btn print-btn" data-credit-print-index="${index}"><i class="fa-solid fa-print"></i> Print</button>
      </td>
    </tr>
  `).join("");

  if (creditMoreBtn) {
    if (creditSales.length <= 5) {
      creditMoreBtn.classList.add("hidden");
    } else {
      creditMoreBtn.classList.remove("hidden");
      creditMoreBtn.textContent = showAllCreditRows ? "Less" : "More";
    }
  }
}

function getCartTotal() {
  return cartItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
}

function renderCartTable() {
  if (!cartTableBody || !cartTotalAmount) return;
  if (!Array.isArray(cartItems)) {
    cartItems = [];
    saveCart();
  }

  if (cartItems.length === 0) {
    cartTableBody.innerHTML = `<tr><td colspan="6">Cart is empty.</td></tr>`;
    cartTotalAmount.textContent = formatUGX(0);
    return;
  }

  cartTableBody.innerHTML = cartItems.map((item, index) => `
    <tr>
      <td>${item.saleType === "cash" ? "Cash" : "Credit"}</td>
      <td>${item.produce}</td>
      <td>${item.tonnage} kg</td>
      <td>${item.customer}</td>
      <td>${formatUGX(item.amount)}</td>
      <td>
        <button class="mini-btn" data-edit-index="${index}">Edit</button>
        <button class="mini-btn" data-remove-index="${index}">Remove</button>
      </td>
    </tr>
  `).join("");

  cartTotalAmount.textContent = formatUGX(getCartTotal());
}

function focusCartSection() {
  if (!cartSectionEl) return;
  cartSectionEl.classList.remove("hidden");
  cartSectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildDocTableRows(items) {
  return items.map((item) => `
    <tr>
      <td>${item.saleType === "cash" ? "Cash" : "Credit"}</td>
      <td>${item.produce}</td>
      <td>${item.tonnage} kg</td>
      <td>${item.customer}</td>
      <td>${formatUGX(item.amount)}</td>
    </tr>
  `).join("");
}

function buildDocumentHtml(title, docId) {
  return `
    <div class="doc">
      <div class="doc-brand">
        <img src="../../assets/images/logo1.png" alt="Karibu Groceries LTD Logo" class="doc-logo">
      </div>
      <h5 class="doc-title">${title}</h5>
      <p class="doc-meta">ID: ${docId}</p>
      <p class="doc-meta">Branch: ${ACTIVE_BRANCH}</p>
      <p class="doc-meta">Date: ${new Date().toLocaleString()}</p>
      <div class="table-wrap">
        <table id="docTable">
          <thead>
            <tr>
              <th>Type</th>
              <th>Produce</th>
              <th>Tonnage</th>
              <th>Customer</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${buildDocTableRows(cartItems)}
          </tbody>
        </table>
      </div>
      <p class="cart-total">Total: <b>${formatUGX(getCartTotal())}</b></p>
    </div>
  `;
}

function printOutputDoc(outputEl, title) {
  if (!outputEl || outputEl.classList.contains("doc-muted")) {
    alert(`${title} has not been generated yet.`);
    return;
  }

  const resolvedHtml = outputEl.innerHTML.replace(/src="([^"]+)"/g, (match, src) => {
    const absoluteSrc = new URL(src, window.location.href).href;
    return `src="${absoluteSrc}"`;
  });

  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    alert("Unable to open print window. Please allow pop-ups and try again.");
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: "Segoe UI", Tahoma, sans-serif; padding: 24px; color: #0f172a; }
          .doc-logo { width: 56px; height: auto; display: block; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 13px; }
          th { background: #f8fafc; }
          .doc-title { font-size: 18px; margin: 0 0 8px 0; }
          .doc-meta { margin: 0 0 6px 0; font-size: 12px; color: #334155; }
          .cart-total { margin-top: 12px; font-size: 14px; }
        </style>
      </head>
      <body>${resolvedHtml}</body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
    printWindow.onafterprint = () => printWindow.close();
  };
}

function buildSingleSaleReceiptHtml(row, saleType) {
  const saleLabel = saleType === "credit" ? "Credit Sale Receipt" : "Cash Sale Receipt";
  const amount = saleType === "credit" ? Number(row.amountDue || 0) : Number(row.amountPaid || 0);
  return `
    <div class="doc">
      <div class="doc-brand">
        <img src="../../assets/images/logo1.png" alt="Karibu Groceries LTD Logo" class="doc-logo">
      </div>
      <h5 class="doc-title">${saleLabel}</h5>
      <p class="doc-meta">Sale ID: ${row.id || "-"}</p>
      <p class="doc-meta">Branch: ${row.branch || ACTIVE_BRANCH}</p>
      <p class="doc-meta">Date: ${row.createdAt ? new Date(row.createdAt).toLocaleString() : new Date().toLocaleString()}</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Buyer</th>
              <th>Produce</th>
              <th>Tonnage</th>
              <th>Amount</th>
              <th>Agent</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${saleType === "credit" ? "Credit" : "Cash"}</td>
              <td>${row.buyer || "-"}</td>
              <td>${row.produce || "-"}</td>
              <td>${Number(row.tonnage || 0)} kg</td>
              <td>${formatUGX(amount)}</td>
              <td>${row.agent || "-"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      ${saleType === "credit" ? `<p class="doc-meta">Due Date: ${row.dueDate || "-"}</p>` : ""}
      <p class="cart-total">Total: <b>${formatUGX(amount)}</b></p>
    </div>
  `;
}

function printSaleReceiptByIndex(type, index) {
  const rows = type === "credit" ? creditSales : cashSales;
  const row = rows[index];
  if (!row) {
    alert("Sale record not found.");
    return;
  }

  const title = type === "credit" ? "Credit Receipt" : "Cash Receipt";
  const html = buildSingleSaleReceiptHtml(row, type);

  if (receiptSectionEl) {
    receiptSectionEl.classList.remove("hidden");
  }
  if (receiptOutput) {
    receiptOutput.classList.remove("doc-muted");
    receiptOutput.innerHTML = html;
  }
  printOutputDoc({ innerHTML: html, classList: { contains: () => false } }, title);
}

function editCartItem(index) {
  const item = cartItems[index];
  if (!item) return;

  const nextProduce = (prompt("Produce:", item.produce) || "").trim().toLowerCase();
  const nextTonnage = Number(prompt("Tonnage (kg):", String(item.tonnage)) || 0);
  const nextCustomer = (prompt("Customer name:", item.customer) || "").trim();

  if (!nextProduce || !getProduceData(nextProduce)) {
    alert("Invalid produce.");
    return;
  }
  if (nextTonnage <= 0 || !nextCustomer) {
    alert("Invalid values. Ensure produce, tonnage, and customer are valid.");
    return;
  }

  const selected = getProduceData(nextProduce);
  if (!selected) {
    alert("Invalid produce.");
    return;
  }

  const computedAmount = nextTonnage * Number(selected.price || 0);

  if (item.saleType === "cash") {
    if (nextTonnage > selected.stock) {
      alert("Tonnage exceeds available stock.");
      return;
    }
  } else if (nextTonnage > selected.stock) {
    alert("Tonnage exceeds available stock.");
    return;
  }

  item.produce = nextProduce;
  item.tonnage = nextTonnage;
  item.customer = nextCustomer;
  item.amount = computedAmount;

  if (item.saleType === "credit") {
    item.buyer = nextCustomer;
    item.amountDue = computedAmount;
    item.type = selected.type || "";
    const nextDueDate = prompt("Due date (YYYY-MM-DD):", item.dueDate || "");
    if (nextDueDate) item.dueDate = nextDueDate;
  }

  saveCart();
  renderCartTable();
}

function collapseSalesForms() {
  saleTypeEl.value = "";
  setSaleType("");
}

function openFormPopup(sectionEl) {
  if (!sectionEl) return;
  sectionEl.classList.add("popup-mode");
  if (formOverlay) {
    formOverlay.classList.remove("hidden");
    formOverlay.setAttribute("aria-hidden", "false");
  }
}

function closeFormPopup() {
  cashSection.classList.remove("popup-mode");
  creditSection.classList.remove("popup-mode");
  if (formOverlay) {
    formOverlay.classList.add("hidden");
    formOverlay.setAttribute("aria-hidden", "true");
  }
}

function showCashEditMode() {
  if (addCashBtn) addCashBtn.classList.add("hidden");
  if (updateCashBtn) updateCashBtn.classList.remove("hidden");
}

function hideCashEditMode() {
  cashEditIndex = null;
  if (addCashBtn) addCashBtn.classList.remove("hidden");
  if (updateCashBtn) updateCashBtn.classList.add("hidden");
}

function showCreditEditMode() {
  if (addCreditBtn) addCreditBtn.classList.add("hidden");
  if (updateCreditBtn) updateCreditBtn.classList.remove("hidden");
}

function hideCreditEditMode() {
  creditEditIndex = null;
  if (addCreditBtn) addCreditBtn.classList.remove("hidden");
  if (updateCreditBtn) updateCreditBtn.classList.add("hidden");
}

function applyInventoryDelta(oldProduce, oldTonnage, newProduce, newTonnage) {
  const inventoryMap = getInventoryMap();
  const oldKey = String(oldProduce || "").trim().toLowerCase();
  const newKey = String(newProduce || "").trim().toLowerCase();
  const oldQty = Number(oldTonnage || 0);
  const newQty = Number(newTonnage || 0);

  const oldTracked = Boolean(oldKey && inventoryMap[oldKey]);
  const newTracked = Boolean(newKey && inventoryMap[newKey]);

  if (!oldTracked && !newTracked) return true;

  if (oldTracked) {
    const oldStock = Number(inventoryMap[oldKey].availableStock || 0);
    inventoryMap[oldKey].availableStock = oldStock + oldQty;
    inventoryMap[oldKey].updatedAt = new Date().toISOString();
  }

  if (newTracked) {
    const newStock = Number(inventoryMap[newKey].availableStock || 0);
    const nextStock = newStock - newQty;
    if (nextStock < 0) {
      if (oldTracked) {
        inventoryMap[oldKey].availableStock = Number(inventoryMap[oldKey].availableStock || 0) - oldQty;
      }
      alert("Cannot update record: insufficient stock for this change.");
      return false;
    }
    inventoryMap[newKey].availableStock = nextStock;
    inventoryMap[newKey].updatedAt = new Date().toISOString();
  }

  localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventoryMap));
  return true;
}

function restoreInventory(produce, tonnage) {
  const inventoryMap = getInventoryMap();
  const key = String(produce || "").trim().toLowerCase();
  if (!key || !inventoryMap[key]) return true;
  inventoryMap[key].availableStock = Number(inventoryMap[key].availableStock || 0) + Number(tonnage || 0);
  inventoryMap[key].updatedAt = new Date().toISOString();
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventoryMap));
  return true;
}

function editCashRecord(index) {
  const row = cashSales[index];
  if (!row) return;
  cashEditIndex = index;
  saleTypeEl.value = "cash";
  setSaleType("cash");
  produceEl.value = row.produce || "";
  updateCashProduceDetails();
  tonnageEl.value = Number(row.tonnage || 0);
  document.getElementById("buyer").value = row.buyer || "";
  agentEl.value = row.agent || localStorage.getItem("username") || "Manager";
  updateCashAmountPaid();
  showCashEditMode();
  openFormPopup(cashSection);
}

function deleteCashRecord(index) {
  const row = cashSales[index];
  if (!row) return;
  if (!confirm("Delete this cash sale record?")) return;

  if (!restoreInventory(row.produce, row.tonnage)) {
    alert("Could not restore stock for this record.");
    return;
  }

  cashSales.splice(index, 1);
  localStorage.setItem(CASH_KEY, JSON.stringify(cashSales.slice(0, 200)));
  renderCashTable();
  updateCashProduceDetails();
  updateCreditProduceDetails();
}

function editCreditRecord(index) {
  const row = creditSales[index];
  if (!row) return;
  creditEditIndex = index;
  saleTypeEl.value = "credit";
  setSaleType("credit");
  document.getElementById("cBuyer").value = row.buyer || "";
  document.getElementById("nin").value = row.nin || "";
  document.getElementById("location").value = row.location || "";
  document.getElementById("contact").value = row.contact || "";
  cProduceEl.value = row.produce || "";
  updateCreditProduceDetails();
  cTonnageEl.value = Number(row.tonnage || 0);
  cAgentEl.value = row.agent || localStorage.getItem("username") || "Manager";
  document.getElementById("dueDate").value = row.dueDate || "";
  document.getElementById("dispatchDate").value = row.dispatchDate || "";
  updateCreditAmountDue();
  showCreditEditMode();
  openFormPopup(creditSection);
}

function deleteCreditRecord(index) {
  const row = creditSales[index];
  if (!row) return;
  if (!confirm("Delete this credit sale record?")) return;

  if (!restoreInventory(row.produce, row.tonnage)) {
    alert("Could not restore stock for this record.");
    return;
  }

  creditSales.splice(index, 1);
  localStorage.setItem(CREDIT_KEY, JSON.stringify(creditSales.slice(0, 200)));
  renderCreditTable();
  updateCashProduceDetails();
  updateCreditProduceDetails();
}

function saveCashRecordChanges() {
  if (cashEditIndex === null) return;
  const row = cashSales[cashEditIndex];
  if (!row) return;

  const produce = produceEl.value;
  const tonnage = Number(tonnageEl.value);
  const amountPaid = Number(amountPaidEl.value);
  const buyer = document.getElementById("buyer").value.trim();
  const agent = agentEl.value.trim();

  if (!produce || tonnage <= 0 || amountPaid <= 0 || !buyer || !agent) {
    alert("Fill all cash sale fields correctly.");
    return;
  }
  if (!isAlphaNumericMin2(buyer) || !isAlphaNumericMin2(agent)) {
    alert("Buyer and agent names must be alphanumeric and at least 2 characters.");
    return;
  }
  if (amountPaid < 10000) {
    alert("Amount paid must be at least 5 digits.");
    return;
  }

  const selected = getProduceData(produce);
  if (!selected) {
    alert("Select a produce.");
    return;
  }
  if (!applyInventoryDelta(row.produce, row.tonnage, produce, tonnage)) return;

  cashSales[cashEditIndex] = {
    ...row,
    produce,
    produceImage: selectedCashProduceImage || String(selected?.image || "").trim() || String(row.produceImage || ""),
    tonnage,
    amountPaid,
    buyer,
    agent
  };

  localStorage.setItem(CASH_KEY, JSON.stringify(cashSales.slice(0, 200)));
  renderCashTable();
  cashSaleForm.reset();
  syncAgentFields();
  updateCashProduceDetails();
  hideCashEditMode();
  collapseSalesForms();
  closeFormPopup();
  alert("Cash sale updated.");
}

function saveCreditRecordChanges() {
  if (creditEditIndex === null) return;
  const row = creditSales[creditEditIndex];
  if (!row) return;

  const buyer = document.getElementById("cBuyer").value.trim();
  const nin = document.getElementById("nin").value.trim();
  const location = document.getElementById("location").value.trim();
  const contact = document.getElementById("contact").value.trim();
  const produce = cProduceEl.value;
  const tonnage = Number(cTonnageEl.value);
  const amountDue = Number(amountDueEl.value);
  const agent = cAgentEl.value.trim();
  const dueDate = document.getElementById("dueDate").value;
  const dispatchDate = document.getElementById("dispatchDate").value;

  if (!buyer || !nin || !location || !contact || !produce || tonnage <= 0 || amountDue <= 0 || !agent || !dueDate || !dispatchDate) {
    alert("Fill all credit sale fields correctly.");
    return;
  }
  if (!isAlphaNumericMin2(buyer) || !isAlphaNumericMin2(location) || !isAlphaNumericMin2(agent)) {
    alert("Buyer, location and agent must be alphanumeric and at least 2 characters.");
    return;
  }
  if (!isValidNin(nin) || !isValidPhone(contact)) {
    alert("Provide a valid NIN and phone contact.");
    return;
  }
  if (amountDue < 10000) {
    alert("Amount due must be at least 5 digits.");
    return;
  }
  if (new Date(dispatchDate) > new Date(dueDate)) {
    alert("Dispatch date cannot be later than due date.");
    return;
  }

  const selected = getProduceData(produce);
  if (!selected) {
    alert("Select a produce.");
    return;
  }
  if (!applyInventoryDelta(row.produce, row.tonnage, produce, tonnage)) return;

  creditSales[creditEditIndex] = {
    ...row,
    buyer,
    nin: nin.toUpperCase(),
    location,
    contact,
    produce,
    produceImage: selectedCreditProduceImage || String(selected?.image || "").trim() || String(row.produceImage || ""),
    type: selected.type || row.type || "",
    tonnage,
    amountDue,
    agent,
    dueDate,
    dispatchDate
  };

  localStorage.setItem(CREDIT_KEY, JSON.stringify(creditSales.slice(0, 200)));
  renderCreditTable();
  creditSaleForm.reset();
  syncAgentFields();
  updateCreditProduceDetails();
  hideCreditEditMode();
  collapseSalesForms();
  closeFormPopup();
  alert("Credit sale updated.");
}

saleTypeEl.addEventListener("change", () => {
  setSaleType(saleTypeEl.value);
  if (!saleTypeEl.value) {
    closeFormPopup();
    hideCashEditMode();
    hideCreditEditMode();
  }
});
produceEl.addEventListener("change", updateCashProduceDetails);
tonnageEl.addEventListener("input", updateCashAmountPaid);
cProduceEl.addEventListener("change", updateCreditProduceDetails);
cTonnageEl.addEventListener("input", updateCreditAmountDue);
if (cashProduceImageGallery) {
  cashProduceImageGallery.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest("[data-image-index]");
    if (!(btn instanceof HTMLElement)) return;
    const index = Number(btn.dataset.imageIndex);
    const key = normalizeKey(produceEl.value);
    const options = produceImageOptionsByProduce[key] || [];
    if (!Number.isFinite(index) || !options[index]) return;
    selectedCashProduceImage = options[index];
    renderProduceImageGallery("cash", produceEl.value);
  });
}
if (creditProduceImageGallery) {
  creditProduceImageGallery.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest("[data-image-index]");
    if (!(btn instanceof HTMLElement)) return;
    const index = Number(btn.dataset.imageIndex);
    const key = normalizeKey(cProduceEl.value);
    const options = produceImageOptionsByProduce[key] || [];
    if (!Number.isFinite(index) || !options[index]) return;
    selectedCreditProduceImage = options[index];
    renderProduceImageGallery("credit", cProduceEl.value);
  });
}

cashSaleForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!ensureSalesAccess()) return;
  if (cashEditIndex !== null) {
    saveCashRecordChanges();
    return;
  }

  const produce = produceEl.value;
  const tonnage = Number(tonnageEl.value);
  const amountPaid = Number(amountPaidEl.value);
  const buyer = document.getElementById("buyer").value.trim();
  const agent = agentEl.value.trim();

  if (!produce || tonnage <= 0 || amountPaid <= 0 || !buyer || !agent) {
    alert("Fill all cash sale fields correctly.");
    return;
  }
  if (!isAlphaNumericMin2(buyer)) {
    alert("Buyer name must be alphanumeric and at least 2 characters.");
    return;
  }
  if (!isAlphaNumericMin2(agent)) {
    alert("Sales agent name must be alphanumeric and at least 2 characters.");
    return;
  }
  if (amountPaid < 10000) {
    alert("Amount paid must be at least 5 digits.");
    return;
  }

  const selected = getProduceData(produce);
  if (!selected) {
    alert("Select a produce.");
    return;
  }

  if (tonnage > selected.stock) {
    alert("Tonnage exceeds available stock.");
    return;
  }

  const expectedAmount = tonnage * selected.price;
  if (amountPaid < expectedAmount) {
    alert(`Amount paid is below expected total of ${formatUGX(expectedAmount)}.`);
    return;
  }

  cartItems.push({
    id: generateSaleId("cash"),
    saleType: "cash",
    produce,
    produceImage: selectedCashProduceImage || String(selected?.image || "").trim(),
    tonnage,
    amount: amountPaid,
    customer: buyer,
    agent,
    createdAt: new Date().toISOString()
  });
  saveCart();
  renderCartTable();
  focusCartSection();
  cashSaleForm.reset();
  syncAgentFields();
  updateCashProduceDetails();
  collapseSalesForms();
  alert("Cash item added to cart.");
});

creditSaleForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!ensureSalesAccess()) return;
  if (creditEditIndex !== null) {
    saveCreditRecordChanges();
    return;
  }

  const buyer = document.getElementById("cBuyer").value.trim();
  const nin = document.getElementById("nin").value.trim();
  const location = document.getElementById("location").value.trim();
  const contact = document.getElementById("contact").value.trim();
  const produce = cProduceEl.value;
  const tonnage = Number(document.getElementById("cTonnage").value);
  const amountDue = Number(amountDueEl.value);
  const agent = cAgentEl.value.trim();
  const dueDate = document.getElementById("dueDate").value;
  const dispatchDate = document.getElementById("dispatchDate").value;

  if (!buyer || !nin || !location || !contact || !produce || tonnage <= 0 || amountDue <= 0 || !agent || !dueDate || !dispatchDate) {
    alert("Fill all credit sale fields correctly.");
    return;
  }
  if (!isAlphaNumericMin2(buyer)) {
    alert("Buyer name must be alphanumeric and at least 2 characters.");
    return;
  }
  if (!isValidNin(nin)) {
    alert("NIN must be a valid 14-character alphanumeric format.");
    return;
  }
  if (!isAlphaNumericMin2(location)) {
    alert("Location must be alphanumeric and at least 2 characters.");
    return;
  }
  if (!isValidPhone(contact)) {
    alert("Contact must be a valid phone number.");
    return;
  }
  if (!isAlphaNumericMin2(agent)) {
    alert("Sales agent name must be alphanumeric and at least 2 characters.");
    return;
  }
  if (amountDue < 10000) {
    alert("Amount due must be at least 5 digits.");
    return;
  }
  if (new Date(dispatchDate) > new Date(dueDate)) {
    alert("Dispatch date cannot be later than due date.");
    return;
  }

  const selected = getProduceData(produce);
  if (!selected) {
    alert("Select a produce.");
    return;
  }
  if (tonnage > Number(selected.stock || 0)) {
    alert("Tonnage exceeds available stock.");
    return;
  }
  const type = selected ? selected.type : "";

  cartItems.push({
    id: generateSaleId("credit"),
    saleType: "credit",
    buyer,
    nin,
    location,
    contact,
    produce,
    produceImage: selectedCreditProduceImage || String(selected?.image || "").trim(),
    type,
    tonnage,
    amount: amountDue,
    amountDue,
    agent,
    dueDate,
    dispatchDate,
    customer: buyer,
    createdAt: new Date().toISOString()
  });
  saveCart();
  renderCartTable();
  focusCartSection();
  creditSaleForm.reset();
  syncAgentFields();
  updateCreditProduceDetails();
  collapseSalesForms();
  alert("Credit item added to cart.");
});

cartTableBody.addEventListener("click", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const editIndex = target.dataset.editIndex;
  const removeIndex = target.dataset.removeIndex;
  if (editIndex !== undefined) {
    editCartItem(Number(editIndex));
    return;
  }
  if (removeIndex === undefined) return;

  const index = Number(removeIndex);
  cartItems.splice(index, 1);
  saveCart();
  renderCartTable();
});

cashTableBody.addEventListener("click", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  const editIndex = target.dataset.cashEditIndex;
  const printIndex = target.dataset.cashPrintIndex;
  if (printIndex !== undefined) {
    printSaleReceiptByIndex("cash", Number(printIndex));
    return;
  }
  if (editIndex !== undefined) {
    editCashRecord(Number(editIndex));
  }
});

creditTableBody.addEventListener("click", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  const editIndex = target.dataset.creditEditIndex;
  const printIndex = target.dataset.creditPrintIndex;
  if (printIndex !== undefined) {
    printSaleReceiptByIndex("credit", Number(printIndex));
    return;
  }
  if (editIndex !== undefined) {
    editCreditRecord(Number(editIndex));
  }
});

if (cashMoreBtn) {
  cashMoreBtn.addEventListener("click", () => {
    showAllCashRows = !showAllCashRows;
    renderCashTable();
  });
}

if (creditMoreBtn) {
  creditMoreBtn.addEventListener("click", () => {
    showAllCreditRows = !showAllCreditRows;
    renderCreditTable();
  });
}

if (updateCashBtn) {
  updateCashBtn.addEventListener("click", saveCashRecordChanges);
}

if (updateCreditBtn) {
  updateCreditBtn.addEventListener("click", saveCreditRecordChanges);
}

if (formOverlay) {
  formOverlay.addEventListener("click", () => {
    hideCashEditMode();
    hideCreditEditMode();
    closeFormPopup();
    collapseSalesForms();
  });
}

completeSaleBtn.addEventListener("click", async () => {
  if (!ensureSalesAccess()) return;

  if (cartItems.length === 0) {
    alert("Add items to cart first.");
    return;
  }

  try {
    await loadBranchStockFromBackend();
  } catch (error) {
    alert(error.message || "Unable to load current stock from backend.");
    return;
  }

  const requestedByProduce = {};
  cartItems.forEach((item) => {
    const key = normalizeKey(item.produce);
    requestedByProduce[key] = (requestedByProduce[key] || 0) + Number(item.tonnage || 0);
  });

  const insufficient = Object.entries(requestedByProduce).find(([key, qty]) => {
    const available = Number(liveStockMap[key]?.stock || 0);
    return qty > available;
  });
  if (insufficient) {
    const [produce, qty] = insufficient;
    const available = Number(liveStockMap[produce]?.stock || 0);
    alert(`Insufficient stock for ${produce}. Requested ${qty}kg, available ${available}kg.`);
    return;
  }

  const totalCompletedSaleAmount = getCartTotal();
  const createdRows = [];

  for (const item of cartItems) {
    const payload = {
      saleType: item.saleType,
      produce: normalizeKey(item.produce),
      tonnage: Number(item.tonnage || 0),
      buyer: String(item.customer || item.buyer || "").trim(),
      agent: String(item.agent || "").trim(),
      amountPaid: item.saleType === "cash" ? Number(item.amount || 0) : 0,
      amountDue: item.saleType === "credit" ? Number(item.amountDue || item.amount || 0) : 0,
      nin: item.saleType === "credit" ? String(item.nin || "") : "",
      location: item.saleType === "credit" ? String(item.location || "") : "",
      contact: item.saleType === "credit" ? String(item.contact || "") : "",
      dueDate: item.saleType === "credit" ? String(item.dueDate || "") : "",
      dispatchDate: item.saleType === "credit" ? String(item.dispatchDate || "") : "",
      branch: ACTIVE_BRANCH
    };

    try {
      const created = await api("/sales", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      createdRows.push(created);
    } catch (error) {
      alert(error.message || "Failed to complete sale. No further items were submitted.");
      return;
    }
  }

  createdRows.forEach((row) => {
    if (row.saleType === "cash") {
      cashSales.unshift({
        id: row.saleId || row.id || String(row._id || ""),
        produce: row.produce,
        tonnage: row.tonnage,
        amountPaid: row.amountPaid,
        buyer: row.buyer,
        agent: row.agent,
        branch: row.branch || ACTIVE_BRANCH,
        createdAt: row.createdAt
      });
    } else {
      creditSales.unshift({
        id: row.saleId || row.id || String(row._id || ""),
        buyer: row.buyer,
        nin: row.nin,
        location: row.location,
        contact: row.contact,
        produce: row.produce,
        type: row.type || "",
        tonnage: row.tonnage,
        amountDue: row.amountDue,
        agent: row.agent,
        dueDate: row.dueDate,
        dispatchDate: row.dispatchDate,
        branch: row.branch || ACTIVE_BRANCH,
        createdAt: row.createdAt
      });
    }
  });

  localStorage.setItem(CASH_KEY, JSON.stringify(cashSales.slice(0, 200)));
  localStorage.setItem(CREDIT_KEY, JSON.stringify(creditSales.slice(0, 200)));
  try {
    await loadBranchStockFromBackend();
  } catch {
    // Keep latest known stock map from current session.
  }

  const transactions = JSON.parse(localStorage.getItem("transactions") || "[]");
  transactions.push({
    type: "sale",
    date: new Date().toLocaleDateString(),
    value: totalCompletedSaleAmount
  });
  localStorage.setItem("transactions", JSON.stringify(transactions));

  cartItems = [];
  saveCart();
  renderCartTable();
  renderCashTable();
  renderCreditTable();
  updateCashProduceDetails();
  updateCreditProduceDetails();
  alert("Sale completed and receipt generated.");
});

clearCartBtn.addEventListener("click", () => {
  cartItems = [];
  saveCart();
  renderCartTable();
});

if (printReceiptBtn) {
  printReceiptBtn.addEventListener("click", () => {
    printOutputDoc(receiptOutput, "Receipt");
  });
}

clearCashBtn.addEventListener("click", () => {
  hideCashEditMode();
  closeFormPopup();
  cashSaleForm.reset();
  syncAgentFields();
  updateCashProduceDetails();
  collapseSalesForms();
});

clearCreditBtn.addEventListener("click", () => {
  hideCreditEditMode();
  closeFormPopup();
  creditSaleForm.reset();
  syncAgentFields();
  updateCreditProduceDetails();
  collapseSalesForms();
});

if (viewCashProduceImageBtn) {
  viewCashProduceImageBtn.addEventListener("click", () => {
    if (!produceEl.value) {
      alert("Select produce first.");
      return;
    }
    showProduceImageModal(produceEl.value, selectedCashProduceImage);
  });
}

if (viewCreditProduceImageBtn) {
  viewCreditProduceImageBtn.addEventListener("click", () => {
    if (!cProduceEl.value) {
      alert("Select produce first.");
      return;
    }
    showProduceImageModal(cProduceEl.value, selectedCreditProduceImage);
  });
}

if (closeProduceImageModalBtn) {
  closeProduceImageModalBtn.addEventListener("click", closeProduceImageModal);
}

if (produceImageModal) {
  produceImageModal.addEventListener("click", (event) => {
    if (event.target === produceImageModal) closeProduceImageModal();
  });
}

ensureSaleIds();
renderCashTable();
renderCreditTable();
renderCartTable();
syncPageTitle();
syncAgentFields();

async function initSalesPage() {
  if (!ensureSalesAccess()) return;
  try {
    await loadBranchStockFromBackend();
    await loadProduceImagesFromProcurements();
  } catch (error) {
    alert(error.message || "Unable to load stock from backend.");
  }
  populateProduceSelectors();
  updateCashProduceDetails();
  updateCashAmountPaid();
  updateCreditProduceDetails();
  updateCreditAmountDue();
  setSaleType("");
  connectStockRealtime();
}

initSalesPage();

window.addEventListener("focus", refreshBranchStockForEveryone);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshBranchStockForEveryone();
    connectStockRealtime();
  }
});
window.addEventListener("beforeunload", () => {
  if (stockRealtimeRetryTimer) window.clearTimeout(stockRealtimeRetryTimer);
  if (stockRealtimeSocket && stockRealtimeSocket.readyState === WebSocket.OPEN) {
    stockRealtimeSocket.close();
  }
});

