// Developer note from me: I wrote and maintain this file for the KGL system, and I keep this logic explicit so future updates are safer.
const profileName = document.getElementById("profileName");
const profileBranch = document.getElementById("profileBranch");
const profileImageEl = document.querySelector(".profile-preview");

const username = localStorage.getItem("username") || "Manager";
const branch = localStorage.getItem("branch") || "Maganjo";
const profileImage = localStorage.getItem("profileImage") || "../../assets/images/profile.jpg";

profileName.textContent = username;
profileBranch.textContent = branch;
if (profileImageEl) profileImageEl.src = profileImage;

