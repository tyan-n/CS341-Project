document.getElementById("signup-form").addEventListener("submit", async function(event) {
    event.preventDefault();

    const username = document.getElementById("signup-username").value;
    const password = document.getElementById("signup-password").value;
    const membershipType = document.getElementById("membership-type").value;
    const birthday = document.getElementById("birthday").value;

    try {
        const response = await fetch("http://localhost:5000/api/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, membershipType, birthday })
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById("signup-message").innerText = "Account created! Redirecting...";
            setTimeout(() => window.location.href = "login.html", 2000);
        } else {
            document.getElementById("signup-message").innerText = data.error;
        }
    } catch (error) {
        console.error("Signup failed:", error);
        document.getElementById("signup-message").innerText = "Error connecting to server.";
    }
});
