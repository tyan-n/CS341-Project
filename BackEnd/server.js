const express = require("express");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connect to SQLite database (callback style)
const db = new sqlite3.Database("../database/YMCA_DB_cs341.db", sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error("Error connecting to SQLite:", err.message);
    } else {
        console.log("Connected to the SQLite database.");
    }
});

// JWT Secret Key
const JWT_SECRET = "your_secret_key";

// Middleware to authenticate token
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Extract token from "Bearer <token>"

    if (!token) {
        return res.status(401).json({ error: "Access denied. No token provided." });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Invalid or expired token." });
        }

        req.user = user; // Store user data in request
        next();
    });
}

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../FrontEnd")));

// Serve HTML files
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../FrontEnd", "index.html"));
});

/* ----------------------------------------
   1) Login User
---------------------------------------- */
app.post("/api/login", (req, res) => {
    const { username, password } = req.body;

    // SQL query to search both the Member and NonMember tables for the given email
    const sql = `
        SELECT Email, Password 
        FROM Member 
        WHERE Email = ?
        UNION
        SELECT Email, Password 
        FROM NonMember 
        WHERE Email = ?
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

            // If password matches, determine the role
            // (Assuming staff has a YMCA org email; otherwise treat as "user")
            const role = user.Email.endsWith("@ymca.org") ? "staff" : "user";

            // Optionally generate a token here if you need it:
            // const token = jwt.sign({ email: user.Email, role }, JWT_SECRET, { expiresIn: "1h" });
            // return res.json({ message: "Login successful", role, token });

            res.json({ message: "Login successful", role });
        });
    });
});

/* ----------------------------------------
   2) Register (Sign Up)
---------------------------------------- */
app.post("/api/signup", async (req, res) => {
    const { username, password, membershipType } = req.body;

    if (!username || !password || !membershipType) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        let sql;
        let params;

        if (membershipType === "member") {
            // Decide the account type for a member (Employee or Single)
            const acctType = username.endsWith("@ymca.org") ? "Employee" : "Single";

            sql = "INSERT INTO Member (Email, Password, AcctType) VALUES (?, ?, ?)";
            params = [username, hashedPassword, acctType];

        } else if (membershipType === "non-member") {
            sql = "INSERT INTO NonMember (Email, Password) VALUES (?, ?)";
            params = [username, hashedPassword];

        } else {
            return res.status(400).json({ error: "Invalid membership type" });
        }

        db.run(sql, params, function (err) {
            if (err) {
                console.error("Error inserting user:", err);
                return res.status(500).json({ error: "Error inserting user" });
            }
            res.json({ message: `${membershipType} registered successfully` });
        });

    } catch (error) {
        console.error("Error in signup:", error);
        res.status(500).json({ error: "Server error" });
    }
});

/* ----------------------------------------
   3) Add Class to Database
---------------------------------------- */
app.post("/api/programs", (req, res) => {
    const programData = req.body;

    // Validate the programData object
    if (
        !programData.name ||
        !programData.description ||
        !programData.location ||
        !programData.startDate ||
        !programData.startTime ||
        !programData.capacity ||
        !programData.priceMember ||
        !programData.priceNonMember
    ) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const sql = `
        INSERT INTO Class (
            ClassName, 
            Description, 
            Frequency, 
            RoomNumber, 
            StartDate, 
            EndDate, 
            StartTime, 
            EndTime, 
            CurrCapacity, 
            MemPrice, 
            NonMemPrice, 
            AgeGroup, 
            EmpID, 
            ClassType
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(
        sql,
        [
            programData.name,
            programData.description,
            programData.frequency,
            programData.location,
            programData.startDate,
            programData.endDate,
            programData.startTime,
            programData.endTime,
            programData.capacity,
            programData.priceMember,
            programData.priceNonMember,
            programData.ageGroup,
            1, // Hard-coded EmpID for now, or pass from front-end
            programData.classType
        ],
        function (err) {
            if (err) {
                console.error("Error inserting into database:", err);
                return res.status(500).json({ error: "Error adding class to database" });
            }
            res.json({ message: "Class added successfully" });
        }
    );
});

/* ----------------------------------------
   4) Get All Programs
---------------------------------------- */
app.get("/api/programs", (req, res) => {
    const sql = `
        SELECT 
            ClassID AS id,
            ClassName AS name, 
            Description AS description, 
            StartTime AS startTime, 
            EndTime AS endTime,
            RoomNumber AS location, 
            CurrCapacity AS capacity, 
            MemPrice AS priceMember, 
            NonMemPrice AS priceNonMember
        FROM Class
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Error fetching programs:", err);
            return res.status(500).json({ error: "Database fetch failed" });
        }
        console.log("Programs fetched from database:", rows); // Debugging output
        res.json(rows);
    });
});

/* ----------------------------------------
   5) Get Program by ID
---------------------------------------- */
app.get("/api/programs/:id", (req, res) => {
    const programId = req.params.id;
    console.log("🔍 Fetching program with ID:", programId);

    const sql = `
        SELECT 
            ClassID AS id,
            ClassName AS name, 
            Description AS description, 
            StartTime AS startTime, 
            EndTime AS endTime,
            RoomNumber AS location, 
            CurrCapacity AS capacity, 
            MemPrice AS priceMember, 
            NonMemPrice AS priceNonMember
        FROM Class
        WHERE ClassID = ?
    `;

    db.get(sql, [programId], (err, program) => {
        if (err) {
            console.error("❌ Error fetching program:", err);
            return res.status(500).json({ error: "Server error" });
        }
        if (!program) {
            console.log("❌ Program not found in database");
            return res.status(404).json({ error: "Program not found" });
        }
        console.log("✅ Sending program:", program);
        res.json(program);
    });
});

/* ----------------------------------------
   6) Register for a Program (Authenticated)
---------------------------------------- */
app.post("/api/register", authenticateToken, (req, res) => {
    const { programId } = req.body;
    const userEmail = req.user.email; // Extract user email from token

    // 1) Check if user is a Member
    db.get("SELECT MemID FROM Member WHERE Email = ?", [userEmail], (err, member) => {
        if (err) {
            console.error("Error searching Member table:", err);
            return res.status(500).json({ error: "Database error" });
        }

        // 2) Check if user is a NonMember
        db.get("SELECT NonMemID FROM NonMember WHERE Email = ?", [userEmail], (err, nonMember) => {
            if (err) {
                console.error("Error searching NonMember table:", err);
                return res.status(500).json({ error: "Database error" });
            }

            if (!member && !nonMember) {
                return res.status(404).json({
                    error: "User not found in Member or NonMember table."
                });
            }

            // 3) Insert into Register table
            if (member) {
                db.run(
                    "INSERT INTO Register (MemID, ClassID) VALUES (?, ?)",
                    [member.MemID, programId],
                    function (err) {
                        if (err) {
                            if (err.code === "SQLITE_CONSTRAINT") {
                                return res.status(400).json({
                                    error: "You are already registered for this program."
                                });
                            } else {
                                console.error("Error registering user:", err);
                                return res.status(500).json({ error: "Database error" });
                            }
                        }
                        res.json({ message: "Registration successful!" });
                    }
                );
            } else {
                db.run(
                    "INSERT INTO Register (NonMemID, ClassID) VALUES (?, ?)",
                    [nonMember.NonMemID, programId],
                    function (err) {
                        if (err) {
                            if (err.code === "SQLITE_CONSTRAINT") {
                                return res.status(400).json({
                                    error: "You are already registered for this program."
                                });
                            } else {
                                console.error("Error registering user:", err);
                                return res.status(500).json({ error: "Database error" });
                            }
                        }
                        res.json({ message: "Registration successful!" });
                    }
                );
            }
        });
    });
});

// Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
