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
    const createClassLink = `<a href="${pathPrefix}staff.html"><i class="fas fa-plus-circle"></i> Create a Class</a>`;
    const timesheetLink = `<a href="${pathPrefix}employment-timesheet.html"><i class="fas fa-briefcase"></i> Employment Timesheet</a>`;
    const loginBtn = `<a href="${pathPrefix}login.html" id="login-link"><i class="fas fa-user"></i> Sign In / Register</a>`;
    const logoutBtn = `<button id="logout-button"><i class="fas fa-sign-out-alt"></i> Logout</button>`;

    // Build Nav HTML
    nav.innerHTML = `
        <div class="nav-content">
            <a href="${homePath}" class="logo">😊 YMCA</a>
            <div class="nav-links">
                ${browseLink}
                ${isLoggedIn ? myClassesLink : ""}
                ${isStaff ? createClassLink : ""}
                ${isStaff ? timesheetLink : ""}
                ${isLoggedIn ? logoutBtn : loginBtn}
            </div>
        </div>
    `;

    document.body.insertBefore(nav, document.body.firstChild);

    // Logout
    if (isLoggedIn) {
        document.getElementById("logout-button").addEventListener("click", () => {
            localStorage.removeItem("token");
            localStorage.removeItem("role");
            localStorage.removeItem("ymcaProgram");
            window.location.href = `${pathPrefix}login.html`;
        });
    }
});
