// Developer note from me: I wrote and maintain this file for the KGL system, and I keep this logic explicit so future updates are safer.
(() => {
  const POLICY_KEY = "director_goods_condition_policies";
  const MAX_POLICIES_PER_TYPE = 100;
  const RETURNED_TYPE = "returnedGoods";
  const DAMAGED_TYPE = "damagedProduce";
  const RETURN_POLICY_TEMPLATES = [
    {
      title: "Return Window",
      text: "Goods are eligible for return within 3 calendar days from the original sale date."
    },
    {
      title: "Accepted Condition",
      text: "Returned goods must be in good condition. Damaged or spoiled goods are not accepted under return policy."
    },
    {
      title: "Proof Of Sale",
      text: "A valid sale record (sale ID, buyer details, and product details) must be available before recording a return."
    },
    {
      title: "Stock Reversal",
      text: "When a return is accepted, stock must be updated immediately and a return record must include reason and receiver."
    }
  ];
  const DAMAGED_POLICY_TEMPLATES = [
    {
      title: "Damage Reporting Window",
      text: "All damaged produce must be recorded immediately after discovery and not later than end of business day."
    },
    {
      title: "Evidence Requirement",
      text: "Each damaged produce record must include clear evidence such as image, lot number, quantity, and probable cause."
    },
    {
      title: "Stock Adjustment",
      text: "Damaged quantities must be deducted from available stock as part of the same recording process."
    },
    {
      title: "Manager Review",
      text: "Significant damaged stock incidents should be reviewed by the Manager and escalated to Director where necessary."
    }
  ];

  const returnedInputEl = document.getElementById("returnedPolicyText");
  const damagedInputEl = document.getElementById("damagedPolicyText");
  const addReturnedBtn = document.getElementById("addReturnedPolicyBtn");
  const generateReturnedBtn = document.getElementById("generateReturnedPoliciesBtn");
  const addDamagedBtn = document.getElementById("addDamagedPolicyBtn");
  const generateDamagedBtn = document.getElementById("generateDamagedPoliciesBtn");
  const returnedRowsEl = document.getElementById("returnedPolicyRows");
  const damagedRowsEl = document.getElementById("damagedPolicyRows");

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
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
    const title = String(row.title || fallbackTitle).trim() || fallbackTitle;
    return {
      id: String(row.id || generatePolicyId(type)).trim(),
      title,
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

  function writePolicies(data) {
    const returnedGoods = normalizePolicyList(RETURNED_TYPE, data.returnedGoods)
      .slice(0, MAX_POLICIES_PER_TYPE);
    const damagedProduce = normalizePolicyList(DAMAGED_TYPE, data.damagedProduce)
      .slice(0, MAX_POLICIES_PER_TYPE);

    localStorage.setItem(POLICY_KEY, JSON.stringify({
      returnedGoods,
      damagedProduce
    }));
  }

  function renderPolicyList(listEl, rows, type) {
    if (!listEl) return;
    if (!rows.length) {
      listEl.innerHTML = `<li class="policy-text">No policy added yet.</li>`;
      return;
    }

    listEl.innerHTML = rows
      .map((row, index) => `
        <li class="policy-item">
          <div class="policy-content">
            <strong class="policy-title">${escapeHtml(row.title)}</strong>
            <span class="policy-text">${escapeHtml(row.text)}</span>
          </div>
          <div class="table-action-stack">
            <button class="btn filter-toggle-btn" type="button" data-edit-policy="${type}" data-edit-index="${index}">Edit</button>
            <button class="btn filter-toggle-btn" type="button" data-delete-policy="${type}" data-delete-index="${index}">Delete</button>
          </div>
        </li>
      `)
      .join("");
  }

  function renderAll() {
    const policies = readPolicies();
    renderPolicyList(returnedRowsEl, policies.returnedGoods, "returnedGoods");
    renderPolicyList(damagedRowsEl, policies.damagedProduce, "damagedProduce");
  }

  function addPolicy(type, text) {
    const clean = String(text || "").trim();
    if (!clean) {
      alert("Policy text is required.");
      return;
    }

    const policies = readPolicies();
    const rows = Array.isArray(policies[type]) ? policies[type] : [];
    rows.unshift({
      id: generatePolicyId(type),
      title: buildDefaultTitle(type, rows.length),
      text: clean,
      createdAt: new Date().toISOString(),
      createdBy: "Director"
    });
    policies[type] = rows;
    writePolicies(policies);
    renderAll();
  }

  function generateReturnedPolicies() {
    const policies = readPolicies();
    const rows = Array.isArray(policies.returnedGoods) ? policies.returnedGoods : [];
    const existingTexts = new Set(rows.map((row) => normalizeText(row.text)));
    let added = 0;

    for (let index = RETURN_POLICY_TEMPLATES.length - 1; index >= 0; index -= 1) {
      const template = RETURN_POLICY_TEMPLATES[index];
      const cleanText = String(template.text || "").trim();
      if (!cleanText || existingTexts.has(normalizeText(cleanText))) continue;
      rows.unshift({
        id: generatePolicyId(RETURNED_TYPE),
        title: String(template.title || buildDefaultTitle(RETURNED_TYPE, index)).trim(),
        text: cleanText,
        createdAt: new Date().toISOString(),
        createdBy: "Director"
      });
      existingTexts.add(normalizeText(cleanText));
      added += 1;
    }

    if (!added) {
      alert("Return policies are already generated.");
      return;
    }

    policies.returnedGoods = rows;
    writePolicies(policies);
    renderAll();
    alert(`${added} return polic${added === 1 ? "y" : "ies"} generated.`);
  }

  function generateDamagedPolicies() {
    const policies = readPolicies();
    const rows = Array.isArray(policies.damagedProduce) ? policies.damagedProduce : [];
    const existingTexts = new Set(rows.map((row) => normalizeText(row.text)));
    let added = 0;

    for (let index = DAMAGED_POLICY_TEMPLATES.length - 1; index >= 0; index -= 1) {
      const template = DAMAGED_POLICY_TEMPLATES[index];
      const cleanText = String(template.text || "").trim();
      if (!cleanText || existingTexts.has(normalizeText(cleanText))) continue;
      rows.unshift({
        id: generatePolicyId(DAMAGED_TYPE),
        title: String(template.title || buildDefaultTitle(DAMAGED_TYPE, index)).trim(),
        text: cleanText,
        createdAt: new Date().toISOString(),
        createdBy: "Director"
      });
      existingTexts.add(normalizeText(cleanText));
      added += 1;
    }

    if (!added) {
      alert("Damaged produce policies are already generated.");
      return;
    }

    policies.damagedProduce = rows;
    writePolicies(policies);
    renderAll();
    alert(`${added} damaged produce polic${added === 1 ? "y" : "ies"} generated.`);
  }

  function editPolicy(type, index) {
    const policies = readPolicies();
    const rows = policies[type];
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= rows.length) return;

    const current = rows[i] || {};
    const nextTitle = prompt("Edit policy title:", String(current.title || ""));
    if (nextTitle === null) return;
    const cleanTitle = String(nextTitle || "").trim();
    if (!cleanTitle) {
      alert("Policy title is required.");
      return;
    }

    const nextText = prompt("Edit policy text:", String(current.text || ""));
    if (nextText === null) return;
    const cleanText = String(nextText || "").trim();
    if (!cleanText) {
      alert("Policy text is required.");
      return;
    }

    rows[i] = {
      ...current,
      title: cleanTitle,
      text: cleanText
    };
    writePolicies(policies);
    renderAll();
  }

  function deletePolicy(type, index) {
    const policies = readPolicies();
    const rows = policies[type];
    const i = Number(index);
    if (!Array.isArray(rows)) return;
    if (!Number.isInteger(i) || i < 0 || i >= rows.length) return;

    const confirmed = confirm("Delete this policy?");
    if (!confirmed) return;

    rows.splice(i, 1);
    writePolicies(policies);
    renderAll();
  }

  function wireEvents() {
    if (addReturnedBtn) {
      addReturnedBtn.addEventListener("click", () => {
        addPolicy("returnedGoods", returnedInputEl?.value || "");
        if (returnedInputEl) returnedInputEl.value = "";
      });
    }

    if (generateReturnedBtn) {
      generateReturnedBtn.addEventListener("click", generateReturnedPolicies);
    }

    if (addDamagedBtn) {
      addDamagedBtn.addEventListener("click", () => {
        addPolicy("damagedProduce", damagedInputEl?.value || "");
        if (damagedInputEl) damagedInputEl.value = "";
      });
    }

    if (generateDamagedBtn) {
      generateDamagedBtn.addEventListener("click", generateDamagedPolicies);
    }

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const type = target.dataset.editPolicy;
      const index = target.dataset.editIndex;
      if (type && index !== undefined) {
        editPolicy(type, index);
        return;
      }

      const deleteType = target.dataset.deletePolicy;
      const deleteIndex = target.dataset.deleteIndex;
      if (!deleteType || deleteIndex === undefined) return;
      deletePolicy(deleteType, deleteIndex);
    });
  }

  function init() {
    if (!returnedRowsEl || !damagedRowsEl) return;
    renderAll();
    wireEvents();
  }

  init();
})();
