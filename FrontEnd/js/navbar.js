document.addEventListener("DOMContentLoaded", function () {
    const nav = document.createElement("nav");
    nav.className = "ymca-navbar";
  
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const isLoggedIn = !!token;
    const isStaff = isLoggedIn && role === "staff";
  
    // Path detection
    const isInPagesFolder = window.location.pathname.toLowerCase().includes("/pages/");
    const pathPrefix = isInPagesFolder ? "" : "pages/";
    const homePath = isInPagesFolder ? "../index.html" : "index.html";
  
    // Nav Buttons
    const browseLink = `<a href="${pathPrefix}browse.html"><i class="fas fa-search"></i> Browse Classes</a>`;
    const myClassesLink = `<a href="${pathPrefix}my-classes.html"><i class="fas fa-book-reader"></i> My Classes</a>`;
    const familyAccountLink = `<a href="#" id="family-link"><i class="fas fa-users"></i> Family Account</a>`;
    const createClassLink = `<a href="${pathPrefix}staff.html"><i class="fas fa-plus-circle"></i> Create a Class</a>`;
    const timesheetLink = `<a href="${pathPrefix}employment-timesheet.html"><i class="fas fa-briefcase"></i> Employment Timesheet</a>`;
    const manageUserClassesLink = `<a href="${pathPrefix}manage-user-classes.html"><i class="fas fa-user-edit"></i> Manage User Classes</a>`;
    const loginBtn = `<a href="${pathPrefix}login.html" id="login-link"><i class="fas fa-user"></i> Sign In / Register</a>`;
    const logoutBtn = `<button id="logout-button"><i class="fas fa-sign-out-alt"></i> Logout</button>`;
    const helpLink = `<a href="${pathPrefix}help.html"><i class="fas fa-question-circle"></i> Help</a>`;
  
    // Build Nav HTML
    nav.innerHTML = `
      <div class="nav-content">
        <a href="${homePath}" class="logo">😊 YMCA</a>
        <div class="nav-links">
	  ${helpLink}
          ${browseLink}
          ${isLoggedIn ? myClassesLink : ""}
          ${isLoggedIn ? familyAccountLink : ""}
          ${isStaff ? createClassLink : ""}
          ${isStaff ? timesheetLink : ""}
          ${isStaff ? manageUserClassesLink : ""}
          ${isLoggedIn ? logoutBtn : loginBtn}
        </div>
      </div>
    `;
  
    document.body.insertBefore(nav, document.body.firstChild);
  
    // Logout Handler
    if (isLoggedIn) {
      const logoutBtn = document.getElementById("logout-button");
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("ymcaProgram");
        window.location.href = `${pathPrefix}login.html`;
      });
    }
  
    // Family Account Link Handler
  if (isLoggedIn) {
    const familyLink = document.getElementById("family-link");
    if (familyLink) {
      familyLink.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          const res = await fetch("http://localhost:5000/api/account/family-status", {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          const target = data.inFamily ? "family-account.html" : "create-family.html";
          window.location.href = pathPrefix + target;
        } catch (err) {
          console.error("Family status check failed:", err);
          window.location.href = pathPrefix + "create-family.html";
        }
      });
    }
  }
});
  
