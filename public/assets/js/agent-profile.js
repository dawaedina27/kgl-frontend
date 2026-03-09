// Developer note from me: I wrote and maintain this file for the KGL system, and I keep this logic explicit so future updates are safer.
(() => {
  const username = localStorage.getItem("username") || "Sales Agent";
  const branch = localStorage.getItem("branch") || "Maganjo";
  const role = localStorage.getItem("role") || "Sales Agent";
  const profileImgSrc = localStorage.getItem("profileImage") || "../../assets/images/profile.jpg";

  const nameEl = document.getElementById("profileName");
  const roleEl = document.getElementById("profileRole");
  const branchEl = document.getElementById("profileBranch");
  const imgEl = document.getElementById("profileImageDisplay");
  
  const displayUserEl = document.getElementById("displayUsername");
  const displayBranchEl = document.getElementById("displayBranch");

  if (nameEl) nameEl.textContent = username;
  if (roleEl) roleEl.textContent = role;
  if (branchEl) branchEl.textContent = branch;
  if (imgEl) imgEl.src = profileImgSrc;

  if (displayUserEl) displayUserEl.value = username;
  if (displayBranchEl) displayBranchEl.value = branch;
})();
