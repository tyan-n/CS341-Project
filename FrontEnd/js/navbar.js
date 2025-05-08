document.addEventListener("DOMContentLoaded", function () {
  // ─────────────────────────────────────────────────────────────────
  // 1) Helper to show an HTML pop‑up with an OK button
  function showNotificationModal(message, onConfirm) {
    // create backdrop
    const overlay = document.createElement("div");
    overlay.style = `
      position: fixed;
      top:0; left:0; right:0; bottom:0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    // create box
    const box = document.createElement("div");
    box.style = `
      background: #fff;
      padding: 1.5rem;
      border-radius: 4px;
      max-width: 90%;
      text-align: center;
      font-size: 14px;
    `;
    box.innerHTML = `<p>${message.replace(/\n/g, "<br>")}</p>`;

    // OK button
    const btn = document.createElement("button");
    btn.innerText = "OK";
    btn.className = "ymca-button";
    btn.addEventListener("click", () => {
      document.body.removeChild(overlay);
      if (typeof onConfirm === "function") onConfirm();
    });
    box.appendChild(btn);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }
  // ─────────────────────────────────────────────────────────────────

  const nav = document.createElement("nav");
  nav.className = "ymca-navbar";

  const token      = localStorage.getItem("token");
  const role       = localStorage.getItem("role");
  const isLoggedIn = !!token;
  const isStaff    = isLoggedIn && role === "staff";

  // Path detection
  const isInPagesFolder = window.location.pathname
    .toLowerCase()
    .includes("/pages/");
  const pathPrefix = isInPagesFolder ? "" : "pages/";
  const homePath   = isInPagesFolder ? "../index.html" : "index.html";

  // Nav Buttons
  const browseLink            = `<a href="${pathPrefix}browse.html"><i class="fas fa-search"></i> Browse Classes</a>`;
  const myClassesLink         = `<a href="${pathPrefix}my-classes.html"><i class="fas fa-book-reader"></i> My Classes</a>`;
  const familyAccountLink     = `<a href="#" id="family-link"><i class="fas fa-users"></i> Family Account</a>`;
  const createClassLink       = `<a href="${pathPrefix}staff.html"><i class="fas fa-plus-circle"></i> Create a Class</a>`;
  const timesheetLink         = `<a href="${pathPrefix}employment-timesheet.html"><i class="fas fa-briefcase"></i> Employment Timesheet</a>`;
  const adminReportLink       = `<a href="${pathPrefix}report.html"><i class="fas fa-file-alt"></i> Registration Report</a>`;
  const manageUserClassesLink = `<a href="${pathPrefix}manage-user-classes.html"><i class="fas fa-user-edit"></i> Manage User Classes</a>`;
  const loginBtn              = `<a href="${pathPrefix}login.html" id="login-link"><i class="fas fa-user"></i> Sign In / Register</a>`;
  const logoutBtn             = `<button id="logout-button"><i class="fas fa-sign-out-alt"></i> Logout</button>`;
  const helpLink              = `<a href="${pathPrefix}help.html"><i class="fas fa-question-circle"></i> Help</a>`;

  // Build Nav HTML
  nav.innerHTML = `
    <div class="nav-content">
      <a href="${homePath}" class="logo">
        YMCA La-Crosse
      </a>
      <div class="nav-links">
        ${helpLink}
        ${browseLink}
        ${isLoggedIn  ? myClassesLink         : ""}
        ${isLoggedIn  ? familyAccountLink     : ""}
        ${isStaff     ? createClassLink       : ""}
        ${isStaff     ? timesheetLink         : ""}
        ${isStaff     ? manageUserClassesLink : ""}
        ${isStaff     ? adminReportLink       : ""}
        ${isLoggedIn  ? logoutBtn             : loginBtn}
      </div>
    </div>
  `;

  document.body.insertBefore(nav, document.body.firstChild);

  // Logout Handler
  if (isLoggedIn) {
    document
      .getElementById("logout-button")
      .addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("ymcaProgram");
        window.location.href = `${pathPrefix}login.html`;
      });
  }

  // Family Account Link Handler
  if (isLoggedIn) {
    const familyEl = document.getElementById("family-link");
    if (familyEl) {
      familyEl.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          const res  = await fetch("http://localhost:5000/api/account/family-status", {
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

  // Class cancellation notification popup
  if (isLoggedIn) {
    fetch("http://localhost:5000/api/cancelled", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((cancellations) => {
        if (cancellations.length > 0) {
          const summary = cancellations.map(c => `• ${c.Name}`).join("\n");
          const message =
            "📣 The following classes were removed from your schedule:\n\n" +
            summary;

          // ─────────────────────────────────────────────────────────
          // Replace native confirm with our modal
          showNotificationModal(message, () => {
            fetch("http://localhost:5000/api/cancelled", {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` }
            });
          });
          // ─────────────────────────────────────────────────────────
        }
      })
      .catch((err) => console.error("❌ Failed to fetch class notifications:", err));
  }
});
