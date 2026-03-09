// Developer note from me: I wrote and maintain this file for the KGL system, and I keep this logic explicit so future updates are safer.
/* =========================================
   FORM REFERENCES
========================================= */
const form = document.getElementById("procurementForm");
const branchName = (localStorage.getItem("branch") || "Maganjo").trim();
const PROCUREMENT_KEY = `manager_procurements_${branchName}`;
const SUPPLIERS_KEY = `manager_suppliers_${branchName}`;

const tonnageEl = form.elements["tonnage"];
const unitCostEl = form.elements["unitCost"];
const sellingPriceEl = form.elements["sellingPrice"];
const produceNameEl = form.elements["produceName"];
const produceTypeEl = form.elements["produceType"];
const produceTypeOtherEl = form.elements["produceTypeOther"];
const CUSTOM_PRODUCE_TYPES_KEY = "custom_produce_types";
const produceImageEl = form.elements["produceImage"];
const produceImagePreviewEl = document.getElementById("produceImagePreview");
const ALLOWED_PRODUCE_NAMES = new Set(["beans", "grain maize", "cow peas", "g-nuts", "soybeans"]);
const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;
const PROCUREMENT_IMAGE_PLACEHOLDER = "../../assets/images/profile.jpg";
const amountEl = form.elements["amount"];
const totalSellingPriceEl = form.elements["totalSellingPrice"];
const profitEl = form.elements["profit"];
const clearProcurementBtn = document.getElementById("clearProcurementBtn");
const API_BASE = `${window.location.origin}/api`;

function ensureManagerRole() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  if (!token || role !== "Manager") {
    alert("Please login as Manager to record procurement.");
    window.location.href = "../../index.html";
    return false;
  }
  return true;
}

if (!ensureManagerRole()) {
  throw new Error("Manager role required for procurement page.");
}

const branchField = document.getElementById("branch");
if (branchField) {
  branchField.value = localStorage.getItem("branch") || "Maganjo";
}

function isAlphaNumericSpace(value) {
  return /^[A-Za-z0-9 -]+$/.test(String(value || "").trim());
}

function isAlphabeticMin2(value) {
  return /^[A-Za-z ]{2,}$/.test(String(value || "").trim());
}

function isValidDealerPhone(value) {
  const raw = String(value || "").trim();
  return /^07\d{8}$/.test(raw);
}

function formatUGX(value) {
  return "UGX " + Number(value || 0).toLocaleString();
}

function toggleOtherInput(selectEl, inputEl) {
  if (!selectEl || !inputEl) return;
  const isOther = selectEl.value === "other";
  inputEl.style.display = isOther ? "block" : "none";
  inputEl.required = isOther;
  if (!isOther) inputEl.value = "";
}

function getSelectedOrOther(selectEl, inputEl) {
  if (!selectEl) return "";
  if (selectEl.value !== "other") return String(selectEl.value || "").trim();
  return String(inputEl?.value || "").trim();
}

function getCustomItems(key) {
  const rows = JSON.parse(localStorage.getItem(key) || "[]");
  return Array.isArray(rows) ? rows : [];
}

function setCustomItems(key, values) {
  localStorage.setItem(key, JSON.stringify(values.slice(0, 200)));
}

function appendOptionBeforeOther(selectEl, value) {
  if (!selectEl) return;
  const clean = String(value || "").trim();
  if (!clean) return;

  const exists = Array.from(selectEl.options).some(
    (opt) => String(opt.value || "").trim().toLowerCase() === clean.toLowerCase()
  );
  if (exists) return;

  const option = document.createElement("option");
  option.value = clean;
  option.textContent = clean;

  const otherOption = Array.from(selectEl.options).find((opt) => opt.value === "other");
  if (otherOption) {
    selectEl.insertBefore(option, otherOption);
  } else {
    selectEl.appendChild(option);
  }
}

function saveCustomOption(selectEl, storageKey, value) {
  const clean = String(value || "").trim();
  if (!clean) return;

  const items = getCustomItems(storageKey);
  const exists = items.some((item) => String(item || "").trim().toLowerCase() === clean.toLowerCase());
  if (!exists) {
    items.push(clean);
    setCustomItems(storageKey, items);
  }
  appendOptionBeforeOther(selectEl, clean);
}

function loadCustomOptions() {
  getCustomItems(CUSTOM_PRODUCE_TYPES_KEY).forEach((item) => appendOptionBeforeOther(produceTypeEl, item));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read selected image."));
    reader.readAsDataURL(file);
  });
}

async function readOptionalProduceImage() {
  const file = produceImageEl?.files?.[0];
  if (!file) return "";
  if (!String(file.type || "").startsWith("image/")) {
    throw new Error("Only image files are allowed for produce image.");
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Produce image must be 3MB or less.");
  }
  return readFileAsDataUrl(file);
}

function setProcurementImagePreview(imageSrc = "") {
  if (!produceImagePreviewEl) return;
  produceImagePreviewEl.src = imageSrc || PROCUREMENT_IMAGE_PLACEHOLDER;
}

/* =========================================
   CALCULATIONS
========================================= */
function calculateValues() {
  const tonnage = Number(tonnageEl.value);
  const unitCost = Number(unitCostEl.value);
  const sellingPrice = Number(sellingPriceEl.value);

  amountEl.value = tonnage > 0 && unitCost > 0 ? tonnage * unitCost : "";
  totalSellingPriceEl.value = tonnage > 0 && sellingPrice > 0 ? tonnage * sellingPrice : "";
  profitEl.value =
    tonnage > 0 && unitCost > 0 && sellingPrice > 0 ? (sellingPrice - unitCost) * tonnage : "";
}

function enforceSellingPriceRule() {
  const unitCost = Number(unitCostEl.value || 0);
  const sellingPrice = Number(sellingPriceEl.value || 0);

  if (unitCost > 0) {
    sellingPriceEl.min = String(unitCost + 1);
  }

  if (sellingPrice > 0 && unitCost > 0 && sellingPrice <= unitCost) {
    sellingPriceEl.setCustomValidity("Selling price must be higher than unit/buying price.");
  } else {
    sellingPriceEl.setCustomValidity("");
  }
}

tonnageEl.addEventListener("input", calculateValues);
unitCostEl.addEventListener("input", () => {
  enforceSellingPriceRule();
  calculateValues();
});
sellingPriceEl.addEventListener("input", () => {
  enforceSellingPriceRule();
  calculateValues();
});

/* =========================================
   LOCAL STORAGE HELPERS
========================================= */
function saveTransaction(procurementAmount) {
  const transactions = JSON.parse(localStorage.getItem("transactions") || "[]");
  transactions.push({
    type: "procurement",
    date: new Date().toLocaleDateString(),
    value: Number(procurementAmount || 0)
  });
  localStorage.setItem("transactions", JSON.stringify(transactions));
}

function updateInventoryMap(produceImage = "") {
  const branchName = (document.getElementById("branch")?.value || "Maganjo").trim();
  const inventoryKey = `manager_produce_inventory_${branchName}`;

  const produceNameRaw = String(produceNameEl?.value || "").trim();
  const produceTypeRaw = getSelectedOrOther(produceTypeEl, produceTypeOtherEl);
  const tonnageValue = Number(document.getElementById("tonnage")?.value || 0);
  const sellingPriceValue = Number(document.getElementById("sellingPrice")?.value || 0);

  if (!produceNameRaw || tonnageValue <= 0 || sellingPriceValue <= 0) return;

  const produceKey = produceNameRaw.toLowerCase();
  const inventoryMap = JSON.parse(localStorage.getItem(inventoryKey) || "{}");
  const existing = inventoryMap[produceKey] || {};

  inventoryMap[produceKey] = {
    produceName: produceNameRaw,
    produceType: produceTypeRaw || existing.produceType || "",
    produceImage: produceImage || existing.produceImage || "",
    availableStock: Number(existing.availableStock || 0) + tonnageValue,
    sellingPrice: sellingPriceValue,
    updatedAt: new Date().toISOString()
  };

  localStorage.setItem(inventoryKey, JSON.stringify(inventoryMap));
}

function upsertSupplierDetails({ dealerName, dealerContact, produceName, tonnage, amount, createdAt }) {
  const supplierName = String(dealerName || "").trim();
  const supplierContact = String(dealerContact || "").trim();
  if (!supplierName || !supplierContact) return;

  const supplierId = `${supplierName.toLowerCase()}|${supplierContact}`;
  const rows = JSON.parse(localStorage.getItem(SUPPLIERS_KEY) || "[]");
  const suppliers = Array.isArray(rows) ? rows : [];
  const existingIndex = suppliers.findIndex((row) => String(row.supplierId || "") === supplierId);

  if (existingIndex >= 0) {
    const current = suppliers[existingIndex];
    const currentLast = new Date(current.lastSuppliedAt || 0).getTime();
    const nextLast = new Date(createdAt || 0).getTime();
    suppliers[existingIndex] = {
      ...current,
      supplierName,
      supplierContact,
      totalProcurements: Number(current.totalProcurements || 0) + 1,
      totalTonnage: Number(current.totalTonnage || 0) + Number(tonnage || 0),
      totalExpenditure: Number(current.totalExpenditure || 0) + Number(amount || 0),
      lastProduce: nextLast >= currentLast ? String(produceName || "") : String(current.lastProduce || ""),
      lastSuppliedAt: nextLast >= currentLast ? createdAt : current.lastSuppliedAt,
      updatedAt: new Date().toISOString()
    };
  } else {
    suppliers.unshift({
      supplierId,
      supplierName,
      supplierContact,
      totalProcurements: 1,
      totalTonnage: Number(tonnage || 0),
      totalExpenditure: Number(amount || 0),
      lastProduce: String(produceName || ""),
      lastSuppliedAt: createdAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(suppliers.slice(0, 2000)));
}

function saveLocalProcurement(produceImage = "") {
  const tonnage = Number(tonnageEl.value || 0);
  const amount = Number(amountEl.value || 0);
  const totalSellingPrice = Number(totalSellingPriceEl.value || 0);
  const profit = Number(profitEl.value || 0);

  let stock = Number(localStorage.getItem("stock") || "0");
  stock += tonnage;
  localStorage.setItem("stock", String(stock));

  let totalProfit = Number(localStorage.getItem("profit") || "0");
  totalProfit += profit;
  localStorage.setItem("profit", String(totalProfit));

  const produceName = String(produceNameEl?.value || "").trim();
  const produceType = getSelectedOrOther(produceTypeEl, produceTypeOtherEl);
  const date = (form.elements["date"]?.value || "").trim();
  const time = (form.elements["time"]?.value || "").trim();
  const dealerName = (form.elements["dealerName"]?.value || "").trim();
  const dealerContact = (form.elements["dealerContact"]?.value || "").trim();
  const createdAt = new Date().toISOString();

  const procurements = JSON.parse(localStorage.getItem(PROCUREMENT_KEY) || "[]");
  procurements.unshift({
    produceName,
    produceType,
    produceImage,
    tonnage,
    unitCost: Number(unitCostEl.value || 0),
    amount,
    sellingPrice: Number(sellingPriceEl.value || 0),
    totalSellingPrice,
    profit,
    dealerName,
    dealerContact,
    branch: branchName,
    date,
    time,
    createdAt
  });
  localStorage.setItem(PROCUREMENT_KEY, JSON.stringify(procurements.slice(0, 1000)));

  upsertSupplierDetails({
    dealerName,
    dealerContact,
    produceName,
    tonnage,
    amount,
    createdAt
  });

  saveTransaction(amount);
  updateInventoryMap(produceImage);

  // Keep values in sync in case user typed quickly and submit fired immediately.
  amountEl.value = amount;
  totalSellingPriceEl.value = totalSellingPrice;
  profitEl.value = profit;
}

/* =========================================
   OPTIONAL API SYNC
========================================= */
async function trySyncToApi(produceImage = "") {
  const token = localStorage.getItem("token") || "";
  if (!token) return false;

  const produceName = String(produceNameEl?.value || "").trim().toLowerCase();
  const produceType = getSelectedOrOther(produceTypeEl, produceTypeOtherEl);
  const tonnage = Number(tonnageEl.value || 0);
  const totalCost = Number(amountEl.value || 0);
  const sellingPrice = Number(sellingPriceEl.value || 0);
  const dealerName = (form.elements["dealerName"]?.value || "").trim();
  const dealerContact = (form.elements["dealerContact"]?.value || "").trim();
  const date = (form.elements["date"]?.value || "").trim();
  const time = (form.elements["time"]?.value || "").trim();
  const branch = (document.getElementById("branch")?.value || branchName).trim();

  try {
    const response = await fetch(`${API_BASE}/procurements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        produceName,
        produceType,
        produceImage,
        tonnage,
        cost: totalCost,
        dealerName,
        dealerContact,
        date,
        time,
        sellingPrice,
        branch
      })
    });

    if (!response.ok) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/* =========================================
   FORM SUBMIT
========================================= */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!ensureManagerRole()) return;

  const produceName = String(produceNameEl?.value || "").trim();
  const produceType = getSelectedOrOther(produceTypeEl, produceTypeOtherEl);
  const dateValue = (form.elements["date"]?.value || "").trim();
  const timeValue = (form.elements["time"]?.value || "").trim();
  const dealerName = (form.elements["dealerName"]?.value || "").trim();
  const dealerContact = (form.elements["dealerContact"]?.value || "").trim();
  const tonnage = Number(tonnageEl.value);
  const unitCost = Number(unitCostEl.value);
  const sellingPrice = Number(sellingPriceEl.value);
  const normalizedProduceName = String(produceName || "").trim().toLowerCase();

  if (!isAlphaNumericSpace(produceName)) {
    alert("Produce name must contain only letters, numbers, spaces, or hyphens.");
    return;
  }
  if (normalizedProduceName.length < 2) {
    alert("Produce name must be at least 2 characters.");
    return;
  }
  if (!ALLOWED_PRODUCE_NAMES.has(normalizedProduceName)) {
    alert("Select a produce from the dropdown list.");
    return;
  }
  if (!isAlphabeticMin2(produceType)) {
    alert("Produce type must contain only letters and be at least 2 characters.");
    return;
  }

  if (produceTypeEl.value === "other") {
    saveCustomOption(produceTypeEl, CUSTOM_PRODUCE_TYPES_KEY, produceType);
    produceTypeEl.value = produceType;
  }

  if (!dateValue || !timeValue) {
    alert("Date and time are required.");
    return;
  }
  if (tonnage < 1000) {
    alert("Tonnage must be at least 1000 kg.");
    return;
  }
  if (unitCost < 10000) {
    alert("Unit cost must be at least 5 digits.");
    return;
  }
  if (!isAlphaNumericSpace(dealerName) || dealerName.length < 2) {
    alert("Dealer name must be alphanumeric and at least 2 characters.");
    return;
  }
  if (!isValidDealerPhone(dealerContact)) {
    alert("Dealer contact must be in 07XXXXXXXX format (10 digits).");
    return;
  }

  if (sellingPrice <= unitCost) {
    alert("Selling price must be higher than unit/buying price.");
    return;
  }

  calculateValues();
  let produceImage = "";
  try {
    produceImage = await readOptionalProduceImage();
    setProcurementImagePreview(produceImage);
  } catch (error) {
    alert(error.message || "Invalid produce image.");
    return;
  }

  const synced = await trySyncToApi(produceImage);
  saveLocalProcurement(produceImage);
  if (synced) {
    alert("Procurement recorded successfully.");
  } else {
    alert("Procurement saved locally.");
  }

  form.reset();
  amountEl.value = "";
  totalSellingPriceEl.value = "";
  profitEl.value = "";
  setProcurementImagePreview("");
});

/* =========================================
   CLEAR FORM ACTION
========================================= */
if (clearProcurementBtn) {
  clearProcurementBtn.addEventListener("click", () => {
    form.reset();
    toggleOtherInput(produceTypeEl, produceTypeOtherEl);
    amountEl.value = "";
    totalSellingPriceEl.value = "";
    profitEl.value = "";
    setProcurementImagePreview("");
  });
}

if (produceTypeEl) {
  produceTypeEl.addEventListener("change", () => toggleOtherInput(produceTypeEl, produceTypeOtherEl));
}
if (produceImageEl) {
  produceImageEl.addEventListener("change", async () => {
    try {
      const selected = await readOptionalProduceImage();
      setProcurementImagePreview(selected);
    } catch (error) {
      alert(error.message || "Invalid produce image.");
      if (produceImageEl) produceImageEl.value = "";
      setProcurementImagePreview("");
    }
  });
}
loadCustomOptions();
toggleOtherInput(produceTypeEl, produceTypeOtherEl);
setProcurementImagePreview("");
