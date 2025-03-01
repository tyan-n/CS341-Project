const express = require("express");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../FrontEnd")));

// Serve HTML files
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../FrontEnd", "index.html"));
});

// Mock login API for both users and staff
app.post("/api/login", (req, res) => {
    const { username, password } = req.body;

    // Mock credentials for regular users
    const mockUserCredentials = {
        "user@domain.com": "userPassword"
    };

    // Mock credentials for staff
    const mockStaffCredentials = {
        "staff@domain.com": "staffPassword"
    };

    // Check if username belongs to a regular user
    if (mockUserCredentials[username] && mockUserCredentials[username] === password) {
        res.status(200).json({ token: "mock-jwt-token-user", role: "user" });
    }
    // Check if username belongs to staff
    else if (mockStaffCredentials[username] && mockStaffCredentials[username] === password) {
        res.status(200).json({ token: "mock-jwt-token-staff", role: "staff" });
    }
    else {
        res.status(401).json({ error: "Invalid username or password" });
    }
});


// Start the server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
