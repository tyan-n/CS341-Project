// =========================
// auth.js (Client-Side)
// =========================

// 1) Login Form Submission
document.getElementById("login-form").addEventListener("submit", async function(event) {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        const response = await fetch("http://localhost:5000/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Store token and role separately so we don't overwrite the token
            localStorage.setItem("token", data.token); 
            localStorage.setItem("role", data.role);

            // Check if there's a "redirect" parameter in the current URL
            const urlParams = new URLSearchParams(window.location.search);
            const redirect = urlParams.get("redirect");

            if (redirect) {
                // If there's a redirect parameter, go there
                window.location.href = redirect;
            } else {
                // Otherwise, compare role for normal login flow
                if (data.role === "user") {
                    window.location.href = "browse.html";
                } else if (data.role === "staff") {
                    window.location.href = "staff.html";
                }
            }
        } else {
            document.getElementById("error-message").innerText = data.error || "Login failed.";
        }
    } catch (error) {
        console.error("Login failed:", error);
        document.getElementById("error-message").innerText = "Error connecting to server.";
    }
});

// 2) Signup Form Submission
document.getElementById("signup-form").addEventListener("submit", async function(event) {
    event.preventDefault();

    const username = document.getElementById("signup-username").value;
    const password = document.getElementById("signup-password").value;
    const membershipType = document.getElementById("membership-type").value;

    try {
        const response = await fetch("http://localhost:5000/api/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, membershipType })
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById("signup-message").innerText = "Account created! Redirecting...";
            setTimeout(() => window.location.href = "login.html", 2000);
        } else {
            document.getElementById("signup-message").innerText = data.error || "Signup failed.";
        }
    } catch (error) {
        console.error("Signup failed:", error);
        document.getElementById("signup-message").innerText = "Error connecting to server.";
    }
});
