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

const jwt = require("jsonwebtoken");

// Middleware to authenticate token
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Extract token from "Bearer <token>"

    if (!token) {
        return res.status(401).json({ error: "Access denied. No token provided." });
    }

    jwt.verify(token, "your_secret_key", (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid or expired token." });

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

    const sql = "INSERT INTO Class (ClassName, Description, Frequency, RoomNumber, StartDate, EndDate, StartTime, EndTime, CurrCapacity, MemPrice, NonMemPrice, AgeGroup, EmpID, ClassType) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    db.run(sql, [
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
        1,
        programData.classType
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
        ClassID AS programId,
        ClassName AS name, 
        Description AS description, 
        StartTime AS startTime, 
        EndTime AS endTime,
        RoomNumber AS location, 
        CurrCapacity AS capacity, 
        MemPrice AS priceMember, 
        NonMemPrice AS priceNonMember
        FROM Class`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Error fetching programs:", err);
            return res.status(500).json({ error: "Database fetch failed" });
        }

        console.log("Programs fetched from database:", rows); // Debugging output

        res.json(rows);
    });
});

app.get("/api/programs/:id", async (req, res) => {
    const programId = req.params.id;
    console.log("🔍 Fetching program with ID:", programId); // Debugging

    try {
        const program = await db.get(`SELECT 
        ClassID AS programId,
        ClassName AS name, 
        Description AS description, 
        StartTime AS startTime, 
        EndTime AS endTime,
        RoomNumber AS location, 
        CurrCapacity AS capacity, 
        MemPrice AS priceMember, 
        NonMemPrice AS priceNonMember
        FROM Class WHERE ClassID = ?`, [programId]);

        if (!program) {
            console.log("❌ Program not found in database");
            return res.status(404).json({ error: "Program not found" });
        }

        console.log("✅ Sending program:", program);
        res.json(program);
    } catch (error) {
        console.error("❌ Error fetching program:", error);
        res.status(500).json({ error: "Server error" });
    }
});

app.post("/api/register", authenticateToken, async (req, res) => {
    const { programId } = req.body;
    const userEmail = req.user.email; // Extract user email from token

    try {
        const db = await openDb();

        // Check if user is a Member
        const member = await db.get("SELECT MemID FROM Member WHERE Email = ?", [userEmail]);

        // Check if user is a Non-Member
        const nonMember = await db.get("SELECT NonMemID FROM NonMember WHERE Email = ?", [userEmail]);

        if (!member && !nonMember) {
            return res.status(404).json({ error: "User not found in Member or NonMember table." });
        }

        // Register based on user type
        if (member) {
            await db.run(
                "INSERT INTO Registrations (MemID, ClassID) VALUES (?, ?)",
                [member.memberId, programId]
            );
        } else if (nonMember) {
            await db.run(
                "INSERT INTO Registrations (NonMemID, ClassID) VALUES (?, ?)",
                [nonMember.nonMemberId, programId]
            );
        }

        res.json({ message: "Registration successful!" });

    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT") {
            res.status(400).json({ error: "You are already registered for this program." });
        } else {
            console.error("Error registering user:", error);
            res.status(500).json({ error: "Database error" });
        }
    }
});


app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
