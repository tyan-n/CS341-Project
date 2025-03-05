document.getElementById("login-form").addEventListener("submit", async function(event) {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        const response = await fetch("http://localhost:5000/api/login", {  // Adjust the backend URL if needed
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem("token", data.token); // Store authentication token
            localStorage.setItem("token", data.role); //Store authentication role

            //compare if credentials match user or staff login
            if(data.role === "user"){
                window.location.href = "browse.html";
            }
            else if(data.role === "staff"){
                window.location.href = "staff.html";
            }
        } else {
            document.getElementById("error-message").innerText = data.error;
        }
    } catch (error) {
        console.error("Login failed:", error);
        document.getElementById("error-message").innerText = "Error connecting to server.";
    }
});

// Signup Form Submission
document.getElementById("signup-form").addEventListener("submit", async function(event) {
    event.preventDefault();

    const username = document.getElementById("signup-username").value;
    const password = document.getElementById("signup-password").value;
    const membershipType = document.getElementById("membership-type").value;

    try {
        const response = await fetch("http://localhost:5000/api/signup", { // Adjust the backend URL
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, membershipType })
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

    const jwt = require("jsonwebtoken");

app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    const db = await openDb();

    // Check if user exists in Member table
    const member = await db.get("SELECT memberId FROM Member WHERE email = ?", [email]);

    // Check if user exists in NonMember table
    const nonMember = await db.get("SELECT nonMemberId FROM NonMember WHERE email = ?", [email]);

    if (!member && !nonMember) {
        return res.status(401).json({ error: "Invalid email or password." });
    }

    // Generate token with user email
    const token = jwt.sign({ email }, "your_secret_key", { expiresIn: "1h" });

    res.json({ token });
});

});