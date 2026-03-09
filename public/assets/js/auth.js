// Developer note from me: I wrote and maintain this file for the KGL system, and I keep this logic explicit so future updates are safer.
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const errorEl = document.getElementById("error");
const togglePassword = document.getElementById("togglePassword");
const API_BASE = (() => {
  const host = window.location.hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  const isBackendPort = window.location.port === "4000";
  if (isLocalHost && !isBackendPort) return "http://localhost:4000/api";
  return `${window.location.origin}/api`;
})();

// Normalize role strings so redirects always use a known role value.
function normalizeRole(role) {
  const compact = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  if (compact === "manager") return "Manager";
  if (compact === "director") return "Director";
  if (compact === "salesagent") return "SalesAgent";
  return String(role || "").trim();
}

// Primary login path using backend auth endpoint.
async function loginViaBackend(username, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Login failed.");
  }
  return payload;
}

// Resolve frontend base path so redirects work in nested deployments.
function resolveAppBasePath() {
  const scriptPath = new URL(document.currentScript?.src || window.location.href, window.location.href).pathname;
  const marker = "/assets/js/auth.js";
  const markerIndex = scriptPath.lastIndexOf(marker);
  if (markerIndex >= 0) {
    const base = scriptPath.slice(0, markerIndex + 1);
    return base || "/";
  }

  const path = window.location.pathname;
  if (path.endsWith("/index.html")) {
    return path.slice(0, -("index.html".length));
  }
  if (path.endsWith("/")) return path;
  const slashIndex = path.lastIndexOf("/");
  return slashIndex >= 0 ? `${path.slice(0, slashIndex + 1)}` : "/";
}

/* Toggle password visibility */
togglePassword.addEventListener("click", () => {
  passwordInput.type =
    passwordInput.type === "password" ? "text" : "password";
});

/* Handle login */
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  errorEl.textContent = "";

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  const basePath = resolveAppBasePath();

  const handleSuccess = (sessionToken, user) => {
    // Persist current session identity in local storage for page-level guards.
    const role = normalizeRole(user.role);
    localStorage.setItem("token", sessionToken);
    localStorage.setItem("name", user.name || user.username || "");
    localStorage.setItem("username", user.username);
    localStorage.setItem("role", role);
    localStorage.setItem("branch", user.branch || "Maganjo");
    const profileImage = String(user.profileImage || "").trim();
    if (profileImage) {
      localStorage.setItem("profileImage", profileImage);
    } else {
      localStorage.removeItem("profileImage");
    }

    switch (role) {
      case "Manager":
        window.location.href = `${basePath}pages/manager/dashboard.html`;
        break;
      case "Director":
        window.location.href = `${basePath}pages/director/dashboard.html`;
        break;
      case "SalesAgent":
        window.location.href = `${basePath}pages/sales-agent/dashboard.html`;
        break;
      default:
        errorEl.textContent = "Cannot redirect: unknown user role.";
        break;
    }
  };

  loginViaBackend(username, password)
    .then((payload) => {
      if (!payload?.token || !payload?.user) {
        throw new Error("Invalid login response.");
      }
      handleSuccess(payload.token, payload.user);
    })
    .catch((error) => {
      errorEl.textContent = error.message || "Login failed.";
    });
});

