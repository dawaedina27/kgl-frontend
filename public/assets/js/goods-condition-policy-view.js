// Developer note from me: I wrote and maintain this file for the KGL system, and I keep this logic explicit so future updates are safer.
(() => {
  const POLICY_KEY = "director_goods_condition_policies";
  const listEl = document.getElementById("directorPolicyList");
  const RETURNED_TYPE = "returnedGoods";
  const DAMAGED_TYPE = "damagedProduce";
  let visibleRows = [];
  let modalEl = null;
  let modalTitleEl = null;
  let modalTextEl = null;
  let modalMetaEl = null;
  let modalCloseBtn = null;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function generatePolicyId(type) {
    const prefix = type === RETURNED_TYPE ? "RET-POL" : "DMG-POL";
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  function buildDefaultTitle(type, index) {
    if (type === RETURNED_TYPE) return `Return Policy ${index + 1}`;
    return `Damaged Produce Policy ${index + 1}`;
  }

  function normalizePolicyRow(type, row, index) {
    if (typeof row === "string") {
      const text = String(row || "").trim();
      if (!text) return null;
      return {
        id: generatePolicyId(type),
        title: buildDefaultTitle(type, index),
        text,
        createdAt: "",
        createdBy: "Director"
      };
    }

    if (!row || typeof row !== "object") return null;
    const text = String(
      row.text
      || row.policyText
      || row.policy
      || row.description
      || ""
    ).trim();
    if (!text) return null;

    const fallbackTitle = buildDefaultTitle(type, index);
    return {
      id: String(row.id || generatePolicyId(type)).trim(),
      title: String(row.title || fallbackTitle).trim() || fallbackTitle,
      text,
      createdAt: String(row.createdAt || "").trim(),
      createdBy: String(row.createdBy || "Director").trim() || "Director"
    };
  }

  function normalizePolicyList(type, rows) {
    if (!Array.isArray(rows)) return [];
    const normalized = [];
    rows.forEach((row, index) => {
      const parsed = normalizePolicyRow(type, row, index);
      if (parsed) normalized.push(parsed);
    });
    return normalized;
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
  }

  function buildPreview(text, maxChars = 100) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (clean.length <= maxChars) return clean;
    return `${clean.slice(0, maxChars - 1)}...`;
  }

  function getPolicyTypeLabel(type) {
    if (type === RETURNED_TYPE) return "Return Policy";
    if (type === DAMAGED_TYPE) return "Damaged Produce Policy";
    return "Policy";
  }

  function readPolicies() {
    try {
      const parsed = JSON.parse(localStorage.getItem(POLICY_KEY) || "{}");
      return {
        returnedGoods: normalizePolicyList(RETURNED_TYPE, parsed.returnedGoods),
        damagedProduce: normalizePolicyList(DAMAGED_TYPE, parsed.damagedProduce)
      };
    } catch {
      return { returnedGoods: [], damagedProduce: [] };
    }
  }

  function ensureModal() {
    if (modalEl && modalTitleEl && modalTextEl && modalMetaEl && modalCloseBtn) return;

    modalEl = document.createElement("div");
    modalEl.id = "directorPolicyReadonlyModal";
    modalEl.className = "edit-modal hidden";
    modalEl.innerHTML = `
      <div class="edit-modal-card">
        <div class="table-card-header">
          <h4 id="directorPolicyReadonlyTitle">Policy</h4>
          <button id="directorPolicyReadonlyCloseBtn" class="btn filter-toggle-btn" type="button">Close</button>
        </div>
        <div class="filter-field">
          <label for="directorPolicyReadonlyText">Policy Text</label>
          <textarea id="directorPolicyReadonlyText" class="policy-readonly-text" rows="7" readonly></textarea>
        </div>
        <p id="directorPolicyReadonlyMeta" class="section-note"></p>
      </div>
    `;
    document.body.appendChild(modalEl);

    modalTitleEl = modalEl.querySelector("#directorPolicyReadonlyTitle");
    modalTextEl = modalEl.querySelector("#directorPolicyReadonlyText");
    modalMetaEl = modalEl.querySelector("#directorPolicyReadonlyMeta");
    modalCloseBtn = modalEl.querySelector("#directorPolicyReadonlyCloseBtn");

    if (modalCloseBtn) {
      modalCloseBtn.addEventListener("click", () => {
        if (modalEl) modalEl.classList.add("hidden");
      });
    }
    modalEl.addEventListener("click", (event) => {
      if (event.target === modalEl) modalEl.classList.add("hidden");
    });
  }

  function openPolicyModal(policyType, row) {
    if (!row) return;
    ensureModal();
    if (!modalEl || !modalTitleEl || !modalTextEl || !modalMetaEl) return;

    modalTitleEl.textContent = row.title || getPolicyTypeLabel(policyType);
    modalTextEl.value = row.text || "";
    modalMetaEl.textContent = `Type: ${getPolicyTypeLabel(policyType)} | Created By: ${row.createdBy || "Director"} | Created At: ${formatDate(row.createdAt)}`;
    modalEl.classList.remove("hidden");
  }

  function renderPolicies() {
    if (!listEl) return;
    const policyType = String(listEl.dataset.policyType || "returnedGoods").trim();
    const policies = readPolicies();
    const rows = Array.isArray(policies[policyType]) ? policies[policyType] : [];
    visibleRows = rows;

    if (!rows.length) {
      listEl.innerHTML = '<li class="policy-text">No policy provided by Director yet.</li>';
      return;
    }

    listEl.innerHTML = rows
      .map((row, index) => `
        <li class="policy-item">
          <div class="policy-content">
            <strong class="policy-title">${escapeHtml(row.title)}</strong>
            <span class="policy-text">${escapeHtml(buildPreview(row.text))}</span>
          </div>
          <button class="btn filter-toggle-btn" type="button" data-view-policy-index="${index}">View Policy</button>
        </li>
      `)
      .join("");
  }

  function wireEvents() {
    if (!listEl) return;
    listEl.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const indexRaw = target.dataset.viewPolicyIndex;
      if (indexRaw === undefined) return;
      const index = Number(indexRaw);
      if (!Number.isInteger(index) || index < 0 || index >= visibleRows.length) return;

      const policyType = String(listEl.dataset.policyType || RETURNED_TYPE).trim();
      openPolicyModal(policyType, visibleRows[index]);
    });
  }

  renderPolicies();
  wireEvents();
  window.addEventListener("storage", (event) => {
    if (!event.key || event.key === POLICY_KEY) renderPolicies();
  });
})();
