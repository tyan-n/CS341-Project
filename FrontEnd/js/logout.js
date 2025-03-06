// logout.js
document.addEventListener("DOMContentLoaded", function() {
  const logoutBtn = document.getElementById("logout-button");
  if (logoutBtn) {
      logoutBtn.addEventListener("click", function() {
          // Remove token and role from localStorage
          localStorage.removeItem("token");
          localStorage.removeItem("role");

          // Redirect to login page
          window.location.href = "login.html";
      });
  }
});
