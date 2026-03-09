// Developer note from me: I wrote and maintain this file for the KGL system, and I keep this logic explicit so future updates are safer.
const settingsForm = document.getElementById("managerSettingsForm");
const settingUsername = document.getElementById("settingUsername");
const settingBranch = document.getElementById("settingBranch");
const settingTheme = document.getElementById("settingTheme");
const settingProfileImageInput = document.getElementById("settingProfileImage");
const settingProfilePreview = document.getElementById("settingProfilePreview");
const passwordResetRequestForm = document.getElementById("passwordResetRequestForm");
const resetRequestStatus = document.getElementById("resetRequestStatus");
const currentPasswordEl = document.getElementById("currentPassword");
const newPasswordEl = document.getElementById("newPassword");
const confirmNewPasswordEl = document.getElementById("confirmNewPassword");

const RESET_REQUESTS_KEY = "managerPasswordResetRequests";
const DEFAULT_PROFILE_IMAGE = "../../assets/images/profile.jpg";
let nextProfileImageData = "";

function resolveApiBase() {
  const host = window.location.hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  const isBackendPort = window.location.port === "4000";
  if (isLocalHost && !isBackendPort) return "http://localhost:4000/api";
  return `${window.location.origin}/api`;
}

function getToken() {
  return localStorage.getItem("token") || "";
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

async function saveMyProfileImage(profileImage) {
  const token = getToken();
  if (!token) throw new Error("Please login again.");

  const response = await fetch(`${resolveApiBase()}/auth/me/profile-image`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ profileImage })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Failed to update profile image.");
  return data;
}

settingUsername.value = localStorage.getItem("username") || "Manager";
settingBranch.value = localStorage.getItem("branch") || "Maganjo";
settingTheme.value = localStorage.getItem("themeMode") || "light";

const initialProfileImage = localStorage.getItem("profileImage") || "";
if (settingProfilePreview) {
  settingProfilePreview.src = initialProfileImage || DEFAULT_PROFILE_IMAGE;
}

if (settingProfileImageInput) {
  settingProfileImageInput.addEventListener("change", async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files && input.files[0];
    if (!file) {
      nextProfileImageData = "";
      if (settingProfilePreview) settingProfilePreview.src = localStorage.getItem("profileImage") || DEFAULT_PROFILE_IMAGE;
      return;
    }

    if (!isValidImageFile(file)) {
      alert("Select a valid image file (png, jpg, webp, gif).");
      input.value = "";
      nextProfileImageData = "";
      if (settingProfilePreview) settingProfilePreview.src = localStorage.getItem("profileImage") || DEFAULT_PROFILE_IMAGE;
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("Profile image must be 2 MB or less.");
      input.value = "";
      nextProfileImageData = "";
      if (settingProfilePreview) settingProfilePreview.src = localStorage.getItem("profileImage") || DEFAULT_PROFILE_IMAGE;
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      nextProfileImageData = dataUrl;
      if (settingProfilePreview) settingProfilePreview.src = dataUrl;
    } catch (error) {
      alert(error.message || "Failed to preview selected image.");
    }
  });
}

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = settingUsername.value.trim();
  const branch = settingBranch.value.trim();
  const themeMode = settingTheme.value;

  if (!username || !branch) {
    alert("Display name and branch are required.");
    return;
  }

  localStorage.setItem("username", username);
  localStorage.setItem("branch", branch);
  localStorage.setItem("themeMode", themeMode);
  try {
    if (nextProfileImageData) {
      const updated = await saveMyProfileImage(nextProfileImageData);
      const savedProfileImage = String(updated.profileImage || "");
      if (savedProfileImage) {
        localStorage.setItem("profileImage", savedProfileImage);
        if (settingProfilePreview) settingProfilePreview.src = savedProfileImage;
      }
      nextProfileImageData = "";
      if (settingProfileImageInput) settingProfileImageInput.value = "";
    }
  } catch (error) {
    alert(error.message || "Unable to save profile image.");
    return;
  }

  if (typeof window.renderManagerLayout === "function") {
    await window.renderManagerLayout();
  }

  alert("Settings saved.");
});

function renderResetRequestStatus() {
  const username = localStorage.getItem("username") || "Manager";
  const branch = localStorage.getItem("branch") || "Maganjo";
  const requests = JSON.parse(localStorage.getItem(RESET_REQUESTS_KEY) || "[]");

  const latestRequest = requests.find((req) => req.username === username && req.branch === branch);

  if (!latestRequest) {
    resetRequestStatus.textContent = "No pending reset request.";
    return;
  }

  const requestDate = new Date(latestRequest.requestedAt).toLocaleString();
  resetRequestStatus.textContent =
    `Latest request: ${latestRequest.statusLabel} (${requestDate})`;
}

passwordResetRequestForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const currentPassword = currentPasswordEl.value;
  const newPassword = newPasswordEl.value;
  const confirmNewPassword = confirmNewPasswordEl.value;

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    alert("All password fields are required.");
    return;
  }

  if (newPassword.length < 6) {
    alert("New password must be at least 6 characters.");
    return;
  }

  if (newPassword !== confirmNewPassword) {
    alert("New password and confirmation do not match.");
    return;
  }

  const username = localStorage.getItem("username") || "Manager";
  const branch = localStorage.getItem("branch") || "Maganjo";
  const requests = JSON.parse(localStorage.getItem(RESET_REQUESTS_KEY) || "[]");

  requests.unshift({
    username,
    branch,
    status: "pending_director_approval",
    statusLabel: "Pending Director Approval",
    requestedAt: new Date().toISOString()
  });

  localStorage.setItem(RESET_REQUESTS_KEY, JSON.stringify(requests.slice(0, 200)));
  passwordResetRequestForm.reset();
  renderResetRequestStatus();
  alert("Password reset request submitted. Await director approval.");
});

renderResetRequestStatus();

