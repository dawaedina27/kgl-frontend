// Developer note from me: I wrote and maintain this file for the KGL system, and I keep this logic explicit so future updates are safer.
(() => {
  const branch = localStorage.getItem("branch") || "Maganjo";
  const role = localStorage.getItem("role") || "";
  const username = localStorage.getItem("username") || "User";
  const damagedKey = `manager_damaged_produce_${branch}`;
  const inventoryKey = `manager_produce_inventory_${branch}`;
  const isSalesAgent = role === "sales-agent" || role === "SalesAgent";

  const panelEl = document.getElementById("damagedFormPanel");
  const toggleBtn = document.getElementById("toggleDamagedFormBtn");
  const formEl = document.getElementById("damagedProduceForm");
  const rowsEl = document.getElementById("damagedProduceRows");
  const produceSelectEl = document.getElementById("damageProduce");
  const imageInputEl = document.getElementById("damageImage");
  const imagePreviewEl = document.getElementById("damageImagePreview");
  const modalEl = document.getElementById("damagedImageModal");
  const modalPreviewEl = document.getElementById("damagedImageModalPreview");
  const closeModalBtn = document.getElementById("closeDamagedImageModalBtn");

  const defaultPreview = "../../assets/images/profile.jpg";
  let selectedImageDataUrl = "";
  let damagedRows = [];

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

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function renderRows() {
    if (!rowsEl) return;

    const visibleRows = isSalesAgent
      ? damagedRows.filter((row) => normalizeText(row.recordedBy) === normalizeText(username))
      : damagedRows;

    if (!visibleRows.length) {
      rowsEl.innerHTML = '<tr><td colspan="8">No damaged produce records yet.</td></tr>';
      return;
    }

    rowsEl.innerHTML = visibleRows
      .map((row) => `
        <tr>
          <td>${row.damageDate || "-"}</td>
          <td>${row.produce || "-"}</td>
          <td>${row.lotNumber || "-"}</td>
          <td>${Number(row.quantity || 0).toLocaleString()}</td>
          <td>${Number(row.buyingPrice || 0).toLocaleString()}</td>
          <td>${row.cause || "-"}</td>
          <td>${row.recordedBy || "-"}</td>
          <td>
            ${row.imageDataUrl
              ? `<button class="row-btn collect-btn" data-view-image="${row.id}">View Image</button>`
              : "No image"}
          </td>
        </tr>
      `)
      .join("");
  }

  function generateId() {
    return `DMG-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  function deductStock(produceName, quantity) {
    const inventoryMap = readObject(inventoryKey);
    const key = normalizeText(produceName);
    if (!key || !inventoryMap[key]) {
      return { ok: false, message: "Produce does not exist in stock." };
    }

    const current = Number(inventoryMap[key].availableStock || 0);
    const qty = Number(quantity || 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, message: "Invalid damaged quantity." };
    }
    if (current < qty) {
      return { ok: false, message: `Damaged quantity exceeds available stock (${current} kg).` };
    }

    inventoryMap[key].availableStock = current - qty;
    inventoryMap[key].updatedAt = new Date().toISOString();
    localStorage.setItem(inventoryKey, JSON.stringify(inventoryMap));
    return { ok: true };
  }

  function resetForm() {
    if (!formEl) return;
    formEl.reset();
    selectedImageDataUrl = "";
    if (imagePreviewEl) imagePreviewEl.src = defaultPreview;
    if (imageInputEl) imageInputEl.value = "";
    const dateEl = document.getElementById("damageDate");
    if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
  }

  function populateProduceOptions() {
    if (!produceSelectEl) return;
    const inventoryMap = readObject(inventoryKey);
    const options = Object.values(inventoryMap)
      .map((item) => String(item?.produceName || "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    produceSelectEl.innerHTML = '<option value="">-- Select Produce --</option>';
    options.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      produceSelectEl.appendChild(option);
    });
  }

  function saveRecord(event) {
    event.preventDefault();

    const produce = String(document.getElementById("damageProduce")?.value || "").trim();
    const lotNumber = String(document.getElementById("damageLotNumber")?.value || "").trim();
    const quantity = Number(document.getElementById("damageQty")?.value || 0);
    const buyingPrice = Number(document.getElementById("damageBuyingPrice")?.value || 0);
    const damageDate = String(document.getElementById("damageDate")?.value || "").trim();
    const cause = String(document.getElementById("damageReason")?.value || "").trim();
    const notes = String(document.getElementById("damageNotes")?.value || "").trim();

    if (!produce || !lotNumber || !damageDate || !cause || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(buyingPrice) || buyingPrice <= 0) {
      alert("Fill all required fields with valid values.");
      return;
    }
    if (!selectedImageDataUrl) {
      alert("Image is required.");
      return;
    }

    const stockResult = deductStock(produce, quantity);
    if (!stockResult.ok) {
      alert(stockResult.message);
      return;
    }

    const record = {
      id: generateId(),
      produce,
      lotNumber,
      quantity,
      buyingPrice,
      damageDate,
      cause,
      notes,
      imageDataUrl: selectedImageDataUrl || "",
      branch,
      recordedBy: username,
      createdAt: new Date().toISOString()
    };

    damagedRows.unshift(record);
    damagedRows = damagedRows.slice(0, 2000);
    localStorage.setItem(damagedKey, JSON.stringify(damagedRows));

    renderRows();
    resetForm();
    if (panelEl) panelEl.classList.add("hidden");
    if (toggleBtn) toggleBtn.textContent = "Record Damaged Produce";
    alert("Damaged produce recorded and stock updated.");
  }

  function wireImagePreview() {
    if (!imageInputEl) return;
    imageInputEl.addEventListener("change", () => {
      const file = imageInputEl.files?.[0];
      if (!file) {
        selectedImageDataUrl = "";
        if (imagePreviewEl) imagePreviewEl.src = defaultPreview;
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        selectedImageDataUrl = String(reader.result || "");
        if (imagePreviewEl) imagePreviewEl.src = selectedImageDataUrl || defaultPreview;
      };
      reader.readAsDataURL(file);
    });
  }

  function openImageModal(imageUrl) {
    if (!modalEl || !modalPreviewEl) return;
    modalPreviewEl.src = imageUrl;
    modalEl.classList.remove("hidden");
  }

  function closeImageModal() {
    if (!modalEl || !modalPreviewEl) return;
    modalEl.classList.add("hidden");
    modalPreviewEl.src = "";
  }

  function wireEvents() {
    if (toggleBtn && panelEl) {
      toggleBtn.addEventListener("click", () => {
        panelEl.classList.toggle("hidden");
        const isHidden = panelEl.classList.contains("hidden");
        toggleBtn.textContent = isHidden ? "Record Damaged Produce" : "Close Form";
      });
    }

    if (formEl) formEl.addEventListener("submit", saveRecord);

    if (rowsEl) {
      rowsEl.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const id = target.dataset.viewImage;
        if (!id) return;
        const row = damagedRows.find((item) => String(item.id) === String(id));
        if (!row?.imageDataUrl) return;
        openImageModal(row.imageDataUrl);
      });
    }

    if (closeModalBtn) closeModalBtn.addEventListener("click", closeImageModal);
    if (modalEl) {
      modalEl.addEventListener("click", (event) => {
        if (event.target === modalEl) closeImageModal();
      });
    }
  }

  function init() {
    damagedRows = readArray(damagedKey);
    populateProduceOptions();
    resetForm();
    renderRows();
    wireImagePreview();
    wireEvents();
  }

  init();
})();
