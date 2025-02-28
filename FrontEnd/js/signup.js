document.getElementById("signup-form").addEventListener("submit", function(event) {
    event.preventDefault();

    const username = document.getElementById("signup-username").value;
    const password = document.getElementById("signup-password").value;
    const membershipType = document.getElementById("membership-type").value;

    // Mock database (store users in localStorage for now)
    let users = JSON.parse(localStorage.getItem("users")) || [];

    // Check if username already exists
    if (users.some(user => user.username === username)) {
        document.getElementById("signup-message").innerText = "Username already exists!";
        return;
    }

    // Save new user
    users.push({ username, password, membershipType });
    localStorage.setItem("users", JSON.stringify(users));

    document.getElementById("signup-message").innerText = "Account created! Redirecting to login...";
    
    setTimeout(() => {
        window.location.href = "login.html"; // Redirect back to login page
    }, 2000);
});
