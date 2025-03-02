const express = require("express");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt"); // Import bcrypt for password hashing

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

const db = new sqlite3.Database("../database/YMCA_DB_cs341.db", sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error("Error connecting to SQLite:", err.message);
    } else {
        console.log("Connected to the SQLite database.");
    }
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../FrontEnd")));

// Serve HTML files
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../FrontEnd", "index.html"));
});

//login user
app.post("/api/login", (req, res) => {
    const { username, password } = req.body;

    // SQL query to search both the Member and NonMember tables for the given email
    const sql = `
        SELECT Email, Password FROM Member WHERE Email = ?
        UNION
        SELECT Email, Password FROM NonMember WHERE Email = ?
    `;

    db.get(sql, [username, username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        if (!user) {
            return res.status(401).json({ error: "Invalid email" });
        }

        // Compare the entered password with the hashed password in the database
        bcrypt.compare(password, user.Password, (err, isMatch) => {
            if (err) {
                return res.status(500).json({ error: "Error comparing passwords" });
            }

            if (!isMatch) {
                return res.status(401).json({ error: "Invalid password" });
            }

            // If password matches, determine the role (assuming Member and NonMember have different roles)
            const role = user.Email.endsWith("@ymca.org") ? "staff" : "user";

            res.json({ message: "Login successful", role });
        });
    });
});

//register account
app.post("/api/signup", async (req, res) => {
    const { username, password, membershipType } = req.body;

    if (!username || !password || !membershipType) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        let sql;
        if (membershipType === "member") {
            sql = "INSERT INTO Member (Email, Password, AcctType) VALUES (?, ?, ?)";
            const acctType = username.endsWith("@ymca.org") ? "Employee" : "Single";

        } else if (membershipType === "non-member") {
            sql = "INSERT INTO NonMember (Email, Password) VALUES (?, ?)";
        } else {
            return res.status(400).json({ error: "Invalid membership type" });
        }

        db.run(sql, [username, hashedPassword], function (err) {
            if (err) {
                return res.status(500).json({ error: "Error inserting user" });
            }
            res.json({ message: `${membershipType} registered successfully` });
        });

    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

//add class to database
app.post("/api/programs", async (req, res) => {
    const programData = req.body;
    
    // Validate the programData object to check if it has all required fields
    if (!programData.name || !programData.description || !programData.location || !programData.startDate || !programData.startTime || !programData.capacity || !programData.priceMember || !programData.priceNonMember) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const sql = "INSERT INTO Class (ClassName, Description, RoomNumber, Date, Time, CurrCapacity, MemPrice, NonMemPrice) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

    db.run(sql, [
        programData.name, 
        programData.description, 
        programData.location, 
        programData.startDate, 
        programData.startTime, 
        programData.capacity, 
        programData.priceMember, 
        programData.priceNonMember
    ], function (err) {
        if (err) {
            console.error("Error inserting into database:", err);
            return res.status(500).json({ error: "Error adding class to database" });
        }
        res.json({ message: "Class added successfully" });
    });
});

app.get("/api/programs", (req, res) => {
    const sql = `SELECT 
        ClassName AS name, 
        Description AS description, 
        Time AS startTime, 
        RoomNumber AS location, 
        CurrCapacity AS capacity, 
        MemPrice AS priceMember, 
        NonMemPrice AS priceNonMember
        FROM Class`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("❌ Error fetching programs:", err);
            return res.status(500).json({ error: "Database fetch failed" });
        }

        console.log("✅ Programs fetched from database:", rows); // Debugging output

        res.json(rows);
    });
});


app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
