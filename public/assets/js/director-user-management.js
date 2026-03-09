// Developer note from me: I wrote and maintain this file for the KGL system, and I keep this logic explicit so future updates are safer.
const API_BASE = `${window.location.origin}/api`;

const createUserFormEl = document.getElementById("dirCreateUserForm");
const createUserStatusEl = document.getElementById("dirCreateUserStatus");
const usersRowsEl = document.getElementById("dirUsersRows");
const usersMoreBtnEl = document.getElementById("dirUsersMoreBtn");
const toggleCreateUserBtn = document.getElementById("dirToggleCreateUserBtn");
const showUserManagementBtnEl = document.getElementById("dirShowUserManagementBtn");
const showBranchManagementBtnEl = document.getElementById("dirShowBranchManagementBtn");
const showPolicyManagementBtnEl = document.getElementById("dirShowPolicyManagementBtn");
const userManagementSectionEl = document.getElementById("dirUserManagementSection");
const branchManagementSectionEl = document.getElementById("dirBranchManagementSection");
const policyManagementSectionEl = document.getElementById("dirPolicyManagementSection");
const showReturnedPolicyBtnEl = document.getElementById("dirShowReturnedPolicyBtn");
const showDamagedPolicyBtnEl = document.getElementById("dirShowDamagedPolicyBtn");
const returnedPolicyPanelEl = document.getElementById("dirReturnedPolicyPanel");
const damagedPolicyPanelEl = document.getElementById("dirDamagedPolicyPanel");
const branchRowsEl = document.getElementById("dirBranchRows");
const totalBranchesEl = document.getElementById("dirTotalBranches");
const toggleAddBranchBtnEl = document.getElementById("dirToggleAddBranchBtn");
const addBranchFormEl = document.getElementById("dirAddBranchForm");
const branchNameInputEl = document.getElementById("dirBranchNameInput");
const branchAddressInputEl = document.getElementById("dirBranchAddressInput");
const addBranchStatusEl = document.getElementById("dirAddBranchStatus");
const editUserModalEl = document.getElementById("dirEditUserModal");
const closeEditUserModalBtnEl = document.getElementById("dirCloseEditUserModalBtn");
const editUserFormEl = document.getElementById("dirEditUserForm");
const editUserNameEl = document.getElementById("dirEditUserName");
const editUserEmailEl = document.getElementById("dirEditUserEmail");
const editUserPhoneEl = document.getElementById("dirEditUserPhone");
const editUsernameEl = document.getElementById("dirEditUsername");
const editPasswordEl = document.getElementById("dirEditPassword");
const editRoleEl = document.getElementById("dirEditRole");
const editBranchEl = document.getElementById("dirEditBranch");
const editUserStatusEl = document.getElementById("dirEditUserStatus");
const editUserProfileImageInputEl = document.getElementById("dirEditUserProfileImage");
const editUserProfilePreviewEl = document.getElementById("dirEditUserProfilePreview");
const newUserBranchEl = document.getElementById("newBranch");
const newUserProfileImageInputEl = document.getElementById("newUserProfileImage");
const newUserProfilePreviewEl = document.getElementById("newUserProfilePreview");

let usersCache = [];
let branchesCache = [];
let showAllUsers = false;
let editingUserId = "";
let newUserProfileImageData = "";
let editUserProfileImageData = "";
const PROFILE_IMAGE_PLACEHOLDER = "../../../assets/images/profile.jpg";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Read active JWT used for protected user-management endpoints.
function getToken() {
  return localStorage.getItem("token") || "";
}

async function api(path, options = {}) {
  // Shared API helper with auth header and normalized error handling.
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  const token = getToken();
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

function fmtDate(value) {
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? "-" : dt.toLocaleDateString();
}

function normalizeRole(role) {
  // Accept role variants and map them to backend-supported values.
  const compact = String(role || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (compact === "manager") return "Manager";
  if (compact === "director") return "Director";
  if (compact === "salesagent") return "SalesAgent";
  return "";
}

function normalizeBranch(branch) {
  return String(branch || "").trim().toLowerCase();
}

function normalizePhone(phone) {
  return String(phone || "").trim().replace(/[\s()-]/g, "");
}

function isValidImageFile(file) {
  const allowedTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);
  return Boolean(file && allowedTypes.has(String(file.type || "").toLowerCase()));
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read selected image."));
    reader.readAsDataURL(file);
  });
}

function resetCreateUserProfilePreview() {
  newUserProfileImageData = "";
  if (newUserProfilePreviewEl) {
    newUserProfilePreviewEl.src = PROFILE_IMAGE_PLACEHOLDER;
  }
  if (newUserProfileImageInputEl) {
    newUserProfileImageInputEl.value = "";
  }
}

function resetEditUserProfilePreview(imageData = "") {
  editUserProfileImageData = String(imageData || "").trim();
  if (editUserProfilePreviewEl) {
    editUserProfilePreviewEl.src = editUserProfileImageData || PROFILE_IMAGE_PLACEHOLDER;
  }
  if (editUserProfileImageInputEl) {
    editUserProfileImageInputEl.value = "";
  }
}

function isValidPhone(phone) {
  return /^\+?[0-9]{7,15}$/.test(String(phone || ""));
}

function getPhoneValue(user) {
  return String(user?.phone || user?.contact || user?.phoneNumber || "").trim();
}

function getEntityId(row, businessKey = "") {
  const primary = String(row?._id || row?.id || "").trim();
  if (primary) return primary;
  const business = String((businessKey && row?.[businessKey]) || "").trim();
  return business;
}

function getUserById(userId) {
  return usersCache.find((u) => String(getEntityId(u, "userId")) === String(userId));
}

function closeEditModal() {
  if (editUserModalEl) editUserModalEl.classList.add("hidden");
  if (editUserFormEl) editUserFormEl.reset();
  if (editUserStatusEl) editUserStatusEl.textContent = "";
  resetEditUserProfilePreview("");
  editingUserId = "";
}

function openEditModal(userId) {
  const target = getUserById(userId);
  if (!target || !editUserModalEl) return;
  editingUserId = String(userId);
  if (editUserNameEl) editUserNameEl.value = String(target.name || "");
  if (editUserEmailEl) editUserEmailEl.value = String(target.email || "");
  if (editUserPhoneEl) editUserPhoneEl.value = getPhoneValue(target);
  if (editUsernameEl) editUsernameEl.value = String(target.username || "");
  if (editPasswordEl) editPasswordEl.value = "";
  if (editRoleEl) editRoleEl.value = String(target.role || "");
  if (editBranchEl) editBranchEl.value = String(target.branch || "");
  resetEditUserProfilePreview(String(target.profileImage || ""));
  if (editUserStatusEl) editUserStatusEl.textContent = "";
  editUserModalEl.classList.remove("hidden");
}

function renderBranchManagementDirectory() {
  if (!branchRowsEl) return;
  if (totalBranchesEl) totalBranchesEl.textContent = String(branchesCache.length);

  if (!branchesCache.length) {
    branchRowsEl.innerHTML = '<tr><td colspan="6">No branches available.</td></tr>';
    return;
  }

  branchRowsEl.innerHTML = branchesCache
    .map((branch) => {
      const branchRowId = getEntityId(branch, "branchId");
      const branchName = String(branch.name || "");
      const managers = usersCache.filter(
        (user) => normalizeRole(user.role) === "Manager" && normalizeBranch(user.branch) === normalizeBranch(branchName)
      );
      const managerNames = managers.length
        ? managers.map((manager) => escapeHtml(manager.name || "-")).join("<br>")
        : "No manager assigned";
      const managerContacts = managers.length
        ? managers
            .map((manager) => `${escapeHtml(manager.email || "-")} | ${escapeHtml(getPhoneValue(manager) || "-")}`)
            .join("<br>")
        : "-";
      const isActive = branch.active !== false;

      return `
        <tr>
          <td>${escapeHtml(branchName || "-")}</td>
          <td>${escapeHtml(branch.address || "-")}</td>
          <td>${managerNames}</td>
          <td>${managerContacts}</td>
          <td>${isActive ? "Active" : "Inactive"}</td>
          <td>
            <div class="table-action-stack">
              <button class="row-btn" data-branch-edit="${escapeHtml(branchRowId)}">Edit</button>
              <button class="row-btn" data-branch-toggle="${escapeHtml(branchRowId)}" data-next="${isActive ? "false" : "true"}">
                ${isActive ? "Deactivate" : "Activate"}
              </button>
              <button class="row-btn" data-branch-delete="${escapeHtml(branchRowId)}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderCreateUserBranchOptions() {
  if (!newUserBranchEl) return;

  const currentValue = String(newUserBranchEl.value || "");
  const options = branchesCache
    .filter((branch) => branch && branch.active !== false)
    .map((branch) => String(branch.name || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  newUserBranchEl.innerHTML = [
    '<option value="">Select branch</option>',
    ...options.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
  ].join("");

  if (currentValue && options.includes(currentValue)) {
    newUserBranchEl.value = currentValue;
  }
}

function setAdministrationView(view) {
  const showUsers = view === "user";
  const showBranches = view === "branch";
  const showPolicies = view === "policy";
  if (userManagementSectionEl) userManagementSectionEl.classList.toggle("hidden", !showUsers);
  if (branchManagementSectionEl) branchManagementSectionEl.classList.toggle("hidden", !showBranches);
  if (policyManagementSectionEl) policyManagementSectionEl.classList.toggle("hidden", !showPolicies);

  if (showUserManagementBtnEl) {
    showUserManagementBtnEl.disabled = showUsers;
    showUserManagementBtnEl.setAttribute("aria-pressed", showUsers ? "true" : "false");
  }

  if (showBranchManagementBtnEl) {
    showBranchManagementBtnEl.disabled = showBranches;
    showBranchManagementBtnEl.setAttribute("aria-pressed", showBranches ? "true" : "false");
  }

  if (showPolicyManagementBtnEl) {
    showPolicyManagementBtnEl.disabled = showPolicies;
    showPolicyManagementBtnEl.setAttribute("aria-pressed", showPolicies ? "true" : "false");
  }
}

function setPolicyTypeView(type) {
  const showReturned = type !== "damaged";
  if (returnedPolicyPanelEl) returnedPolicyPanelEl.classList.toggle("hidden", !showReturned);
  if (damagedPolicyPanelEl) damagedPolicyPanelEl.classList.toggle("hidden", showReturned);

  if (showReturnedPolicyBtnEl) {
    showReturnedPolicyBtnEl.disabled = showReturned;
    showReturnedPolicyBtnEl.setAttribute("aria-pressed", showReturned ? "true" : "false");
  }

  if (showDamagedPolicyBtnEl) {
    showDamagedPolicyBtnEl.disabled = !showReturned;
    showDamagedPolicyBtnEl.setAttribute("aria-pressed", showReturned ? "false" : "true");
  }
}

function renderUsersTable() {
  if (!usersRowsEl) return;
  if (!usersCache.length) {
    usersRowsEl.innerHTML = '<tr><td colspan="10">No users found.</td></tr>';
    if (usersMoreBtnEl) usersMoreBtnEl.style.display = "none";
    return;
  }

  // Show five rows by default; expand with the "More" button.
  const rows = showAllUsers ? usersCache : usersCache.slice(0, 5);
  usersRowsEl.innerHTML = rows
    .map((user) => {
      const userRowId = getEntityId(user, "userId");
      const userProfileImage = String(user.profileImage || "").trim() || PROFILE_IMAGE_PLACEHOLDER;
      return `
        <tr>
          <td><img src="${escapeHtml(userProfileImage)}" alt="${escapeHtml(user.username || "user")} profile" class="user-table-avatar"></td>
          <td>${escapeHtml(user.name || "-")}</td>
          <td>${escapeHtml(user.email || "-")}</td>
          <td>${escapeHtml(getPhoneValue(user) || "-")}</td>
          <td>${escapeHtml(user.username || "-")}</td>
          <td>${escapeHtml(user.role || "-")}</td>
          <td>${escapeHtml(user.branch || "-")}</td>
          <td>${user.active ? "Active" : "Inactive"}</td>
          <td>${escapeHtml(fmtDate(user.createdAt))}</td>
          <td>
            <div class="table-action-stack">
              <button class="row-btn" data-user-edit="${escapeHtml(userRowId)}"><i class="fa-regular fa-image"></i> Edit</button>
              <button class="row-btn" data-user-toggle="${escapeHtml(userRowId)}" data-next="${user.active ? "false" : "true"}">
                ${user.active ? "Deactivate" : "Activate"}
              </button>
              <button class="row-btn" data-user-delete="${escapeHtml(userRowId)}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  if (usersMoreBtnEl) {
    if (usersCache.length <= 5) {
      usersMoreBtnEl.style.display = "none";
    } else {
      usersMoreBtnEl.style.display = "inline-flex";
      usersMoreBtnEl.textContent = showAllUsers ? "Less" : "More";
    }
  }
}

async function loadUsers() {
  // Refresh user list from backend and re-render the table.
  usersCache = await api("/users");
  renderUsersTable();
  renderBranchManagementDirectory();
}

async function loadBranches() {
  branchesCache = await api("/branches");
  renderBranchManagementDirectory();
  renderCreateUserBranchOptions();
}

async function onCreateUser(event) {
  event.preventDefault();
  if (!createUserStatusEl) return;

  // Collect and sanitize form inputs before submission.
  const payload = {
    name: String(document.getElementById("newUserName")?.value || "").trim(),
    email: String(document.getElementById("newUserEmail")?.value || "").trim(),
    phone: normalizePhone(document.getElementById("newUserPhone")?.value || ""),
    username: String(document.getElementById("newUsername")?.value || "").trim(),
    password: String(document.getElementById("newPassword")?.value || ""),
    role: normalizeRole(document.getElementById("newRole")?.value || ""),
    branch: String(document.getElementById("newBranch")?.value || "").trim(),
    profileImage: newUserProfileImageData
  };

  if (!payload.name || !payload.email || !payload.phone || !payload.username || !payload.password || !payload.role || !payload.branch) {
    createUserStatusEl.textContent = "All fields are required.";
    return;
  }
  if (!isValidPhone(payload.phone)) {
    createUserStatusEl.textContent = "Phone format is invalid.";
    return;
  }

  try {
    await api("/users", { method: "POST", body: JSON.stringify(payload) });
    createUserStatusEl.textContent = `User "${payload.username}" created successfully.`;
    if (createUserFormEl) createUserFormEl.reset();
    resetCreateUserProfilePreview();
    await loadUsers();
  } catch (error) {
    createUserStatusEl.textContent = error.message;
  }
}

async function onCreateUserProfileImageChange(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const selectedFile = input.files && input.files[0];
  if (!selectedFile) {
    resetCreateUserProfilePreview();
    return;
  }

  if (!isValidImageFile(selectedFile)) {
    if (createUserStatusEl) createUserStatusEl.textContent = "Select a valid image file (png, jpg, webp, gif).";
    resetCreateUserProfilePreview();
    return;
  }

  if (selectedFile.size > 2 * 1024 * 1024) {
    if (createUserStatusEl) createUserStatusEl.textContent = "Image must be 2 MB or less.";
    resetCreateUserProfilePreview();
    return;
  }

  try {
    const dataUrl = await fileToDataUrl(selectedFile);
    newUserProfileImageData = dataUrl;
    if (newUserProfilePreviewEl) newUserProfilePreviewEl.src = dataUrl;
    if (createUserStatusEl) createUserStatusEl.textContent = "";
  } catch (error) {
    if (createUserStatusEl) createUserStatusEl.textContent = error.message;
    resetCreateUserProfilePreview();
  }
}

async function onEditUserProfileImageChange(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const selectedFile = input.files && input.files[0];
  if (!selectedFile) {
    resetEditUserProfilePreview(editUserProfileImageData);
    return;
  }

  if (!isValidImageFile(selectedFile)) {
    if (editUserStatusEl) editUserStatusEl.textContent = "Select a valid image file (png, jpg, webp, gif).";
    resetEditUserProfilePreview("");
    return;
  }

  if (selectedFile.size > 2 * 1024 * 1024) {
    if (editUserStatusEl) editUserStatusEl.textContent = "Image must be 2 MB or less.";
    resetEditUserProfilePreview("");
    return;
  }

  try {
    const dataUrl = await fileToDataUrl(selectedFile);
    editUserProfileImageData = dataUrl;
    if (editUserProfilePreviewEl) editUserProfilePreviewEl.src = dataUrl;
    if (editUserStatusEl) editUserStatusEl.textContent = "";
  } catch (error) {
    if (editUserStatusEl) editUserStatusEl.textContent = error.message;
    resetEditUserProfilePreview("");
  }
}

async function onToggleUserActive(userId, nextValue) {
  // Soft-toggle active status instead of deleting account.
  await api(`/users/${userId}/active`, {
    method: "PATCH",
    body: JSON.stringify({ active: nextValue === "true" })
  });
  await loadUsers();
}

async function onDeleteUser(userId) {
  // Hard delete user after confirmation.
  const confirmed = confirm("Delete this user?");
  if (!confirmed) return;
  await api(`/users/${userId}`, { method: "DELETE" });
  await loadUsers();
}

async function onAddBranch(event) {
  event.preventDefault();
  const payload = {
    name: String(branchNameInputEl?.value || "").trim(),
    address: String(branchAddressInputEl?.value || "").trim()
  };

  if (!payload.name || !payload.address) {
    if (addBranchStatusEl) addBranchStatusEl.textContent = "Branch name and address are required.";
    return;
  }

  try {
    await api("/branches", { method: "POST", body: JSON.stringify(payload) });
    if (addBranchStatusEl) addBranchStatusEl.textContent = `Branch "${payload.name}" added successfully.`;
    if (addBranchFormEl) addBranchFormEl.reset();
    await loadBranches();
  } catch (error) {
    if (addBranchStatusEl) addBranchStatusEl.textContent = error.message;
  }
}

async function onEditBranch(branchId) {
  const target = branchesCache.find((row) => String(getEntityId(row, "branchId")) === String(branchId));
  if (!target) return;

  const nextName = (prompt("Branch Name:", target.name || "") || "").trim();
  const nextAddress = (prompt("Address:", target.address || "") || "").trim();
  if (!nextName || !nextAddress) {
    if (addBranchStatusEl) addBranchStatusEl.textContent = "Branch name and address are required.";
    return;
  }

  try {
    await api(`/branches/${branchId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: nextName, address: nextAddress })
    });
    if (addBranchStatusEl) addBranchStatusEl.textContent = `Branch "${nextName}" updated.`;
    await loadBranches();
  } catch (error) {
    if (addBranchStatusEl) addBranchStatusEl.textContent = error.message;
  }
}

async function onToggleBranchActive(branchId, nextValue) {
  try {
    await api(`/branches/${branchId}/active`, {
      method: "PATCH",
      body: JSON.stringify({ active: nextValue === "true" })
    });
    await loadBranches();
  } catch (error) {
    if (addBranchStatusEl) addBranchStatusEl.textContent = error.message;
  }
}

async function onDeleteBranch(branchId) {
  const confirmed = confirm("Delete this branch?");
  if (!confirmed) return;
  try {
    await api(`/branches/${branchId}`, { method: "DELETE" });
    if (addBranchStatusEl) addBranchStatusEl.textContent = "Branch deleted.";
    await loadBranches();
  } catch (error) {
    if (addBranchStatusEl) addBranchStatusEl.textContent = error.message;
  }
}

async function onEditUser(userId) {
  openEditModal(userId);
}

async function onEditUserSubmit(event) {
  event.preventDefault();
  if (!editingUserId) return;

  const payload = {
    name: String(editUserNameEl?.value || "").trim(),
    email: String(editUserEmailEl?.value || "").trim(),
    phone: normalizePhone(editUserPhoneEl?.value || ""),
    username: String(editUsernameEl?.value || "").trim(),
    role: normalizeRole(editRoleEl?.value || ""),
    branch: String(editBranchEl?.value || "").trim(),
    profileImage: editUserProfileImageData
  };
  const nextPassword = String(editPasswordEl?.value || "");

  if (!payload.name || !payload.email || !payload.phone || !payload.username || !payload.role || !payload.branch) {
    if (editUserStatusEl) editUserStatusEl.textContent = "All fields except password are required.";
    return;
  }
  if (!isValidPhone(payload.phone)) {
    if (editUserStatusEl) editUserStatusEl.textContent = "Contact format is invalid.";
    return;
  }
  if (nextPassword && nextPassword.length < 8) {
    if (editUserStatusEl) editUserStatusEl.textContent = "Password must be at least 8 characters.";
    return;
  }
  if (nextPassword) payload.password = nextPassword;

  try {
    const updated = await api(`/users/${editingUserId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    const currentUsername = String(localStorage.getItem("username") || "").trim().toLowerCase();
    const updatedUsername = String(updated?.username || payload.username || "").trim().toLowerCase();
    if (currentUsername && updatedUsername && currentUsername === updatedUsername) {
      const nextProfileImage = String(updated?.profileImage || "").trim();
      if (nextProfileImage) {
        localStorage.setItem("profileImage", nextProfileImage);
      } else {
        localStorage.removeItem("profileImage");
      }
    }
    closeEditModal();
    await loadUsers();
  } catch (error) {
    if (editUserStatusEl) editUserStatusEl.textContent = error.message;
  }
}

function wireEvents() {
  if (showUserManagementBtnEl) {
    showUserManagementBtnEl.addEventListener("click", () => {
      setAdministrationView("user");
    });
  }

  if (showBranchManagementBtnEl) {
    showBranchManagementBtnEl.addEventListener("click", () => {
      setAdministrationView("branch");
    });
  }

  if (showPolicyManagementBtnEl) {
    showPolicyManagementBtnEl.addEventListener("click", () => {
      setAdministrationView("policy");
    });
  }

  if (showReturnedPolicyBtnEl) {
    showReturnedPolicyBtnEl.addEventListener("click", () => {
      setPolicyTypeView("returned");
    });
  }

  if (showDamagedPolicyBtnEl) {
    showDamagedPolicyBtnEl.addEventListener("click", () => {
      setPolicyTypeView("damaged");
    });
  }

  if (toggleAddBranchBtnEl && addBranchFormEl) {
    toggleAddBranchBtnEl.addEventListener("click", () => {
      addBranchFormEl.classList.toggle("hidden");
      const isHidden = addBranchFormEl.classList.contains("hidden");
      toggleAddBranchBtnEl.textContent = isHidden ? "Add Branch" : "Hide Form";
    });
  }

  if (addBranchFormEl) {
    addBranchFormEl.addEventListener("submit", onAddBranch);
  }

  if (branchRowsEl) {
    branchRowsEl.addEventListener("click", async (event) => {
      const clickTarget = event.target;
      if (!(clickTarget instanceof HTMLElement)) return;
      const target = clickTarget.closest("button");
      if (!(target instanceof HTMLElement)) return;
      const editId = target.dataset.branchEdit;
      const toggleId = target.dataset.branchToggle;
      const next = target.dataset.next;
      const deleteId = target.dataset.branchDelete;

      if (editId) {
        await onEditBranch(editId);
        return;
      }
      if (deleteId) {
        await onDeleteBranch(deleteId);
        return;
      }
      if (toggleId && next) {
        await onToggleBranchActive(toggleId, next);
      }
    });
  }

  if (toggleCreateUserBtn && createUserFormEl) {
    toggleCreateUserBtn.addEventListener("click", () => {
      createUserFormEl.classList.toggle("hidden");
      const isHidden = createUserFormEl.classList.contains("hidden");
      toggleCreateUserBtn.textContent = isHidden ? "Add User" : "Hide Form";
    });
  }

  if (createUserFormEl) {
    createUserFormEl.addEventListener("submit", onCreateUser);
  }

  if (newUserProfileImageInputEl) {
    newUserProfileImageInputEl.addEventListener("change", onCreateUserProfileImageChange);
  }
  if (editUserProfileImageInputEl) {
    editUserProfileImageInputEl.addEventListener("change", onEditUserProfileImageChange);
  }

  if (usersMoreBtnEl) {
    usersMoreBtnEl.addEventListener("click", () => {
      showAllUsers = !showAllUsers;
      renderUsersTable();
    });
  }

  if (usersRowsEl) {
    // Event delegation for edit/activate/delete row actions.
    usersRowsEl.addEventListener("click", async (event) => {
      const clickTarget = event.target;
      if (!(clickTarget instanceof HTMLElement)) return;
      const target = clickTarget.closest("button");
      if (!(target instanceof HTMLElement)) return;
      const userId = target.dataset.userToggle;
      const next = target.dataset.next;
      const editId = target.dataset.userEdit;
      const deleteId = target.dataset.userDelete;
      if (editId) {
        await onEditUser(editId);
        return;
      }
      if (deleteId) {
        await onDeleteUser(deleteId);
        return;
      }
      if (!userId || !next) return;
      await onToggleUserActive(userId, next);
    });
  }

  if (closeEditUserModalBtnEl) {
    closeEditUserModalBtnEl.addEventListener("click", () => {
      closeEditModal();
    });
  }

  if (editUserModalEl) {
    editUserModalEl.addEventListener("click", (event) => {
      if (event.target === editUserModalEl) closeEditModal();
    });
  }

  if (editUserFormEl) {
    editUserFormEl.addEventListener("submit", onEditUserSubmit);
  }
}

async function init() {
  wireEvents();
  setAdministrationView("user");
  setPolicyTypeView("returned");
  resetCreateUserProfilePreview();
  try {
    await Promise.all([loadUsers(), loadBranches()]);
  } catch (error) {
    if (createUserStatusEl) createUserStatusEl.textContent = error.message;
  }
}

init();

