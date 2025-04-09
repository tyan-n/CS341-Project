// server.js

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
            // Determine the role (staff if email ends with "@ymca.org", otherwise "user")
            const role = user.Email.endsWith("@ymca.org") ? "staff" : "user";
            // Generate JWT token
            const token = jwt.sign({ email: user.Email, role }, JWT_SECRET, { expiresIn: "1h" });
            res.json({ message: "Login successful", role, token });
        });
    });
});

/* ----------------------------------------
   2) Register (Sign Up)
---------------------------------------- */
app.post("/api/signup", async (req, res) => {
    console.log("Signup request body:", req.body);
  
    const {
      username,     // used as email
      password,
      membershipType,
      fname,
      lname,
      mname,
      birthday,
      street,
      houseNumber,
      city,
      state,
      zipCode,
      phone,
      fee
    } = req.body;
  
    // Basic required fields check
    if (!username || !password || !membershipType) {
      return res.status(400).json({ error: "Username, password, and membership type are required." });
    }
  
    // Validate email using a flexible pattern (allows any valid email domain)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(username.trim())) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
  
    // For members, check that all additional required details are provided
    if (membershipType === "member") {
      const requiredFields = [fname, lname, birthday, street, houseNumber, city, state, zipCode, phone];
      if (requiredFields.some(field => field === undefined || field === null || (typeof field === "string" && field.trim() === ""))) {
        return res.status(400).json({ error: "All member details are required." });
      }
      // Validate phone number to enforce the fixed US format: (123)-456-7890
      const phoneRegex = /^\(\d{3}\)-\d{3}-\d{4}$/;
      if (!phoneRegex.test(phone.trim())) {
        return res.status(400).json({ error: "Phone number must be in the format (123)-456-7890." });
      }
    }
  
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      let sql, params;
  
      if (membershipType === "member") {
        const acctType = username.trim().endsWith("@ymca.org") ? "Employee" : "Single";
        // Default fee to 0 if not provided
        const feeValue = fee === undefined || (typeof fee === "string" && fee.trim() === "") ? 0 : fee;
        
        sql = `INSERT INTO Member (
                  FName, 
                  LName, 
                  MName, 
                  Birthday, 
                  Street, 
                  HouseNumber, 
                  City, 
                  State, 
                  ZipCode, 
                  PhoneNumber, 
                  Email, 
                  Password, 
                  Fee, 
                  AcctType
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        params = [
          fname.trim(),
          lname.trim(),
          mname ? mname.trim() : null,
          birthday.trim(),
          street.trim(),
          houseNumber.trim(),
          city.trim(),
          state.trim(),
          zipCode.trim(),
          phone.trim(),
          username.trim(),
          hashedPassword,
          feeValue,
          acctType
        ];
      } else if (membershipType === "non-member") {
        // For non-members, insert additional details into NonMember table.
        // Ensure your NonMember table schema includes FName, LName, MName, Birthday, Email, PhoneNumber, and Password.
        sql = `INSERT INTO NonMember (
                  FName,
                  LName,
                  MName,
                  Birthday,
                  Email,
                  PhoneNumber,
                  Password
               ) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        params = [
          fname.trim(),
          lname.trim(),
          mname ? mname.trim() : null,
          birthday.trim(),
          username.trim(),
          phone.trim(),
          hashedPassword
        ];
      } else {
        return res.status(400).json({ error: "Invalid membership type" });
      }
  
      db.run(sql, params, function(err) {
        if (err) {
          console.error("Error inserting user:", err);
          return res.status(500).json({ error: "Error inserting user" });
        }
        console.log("User successfully inserted, new ID:", this.lastID);
        res.json({ message: `${membershipType} registered successfully`, id: this.lastID });
      });
    } catch (error) {
      console.error("Error in signup:", error);
      res.status(500).json({ error: "Server error" });
    }
});
  
/* ----------------------------------------
   3) Add Class to Database (with conflict check for staff)
---------------------------------------- */
app.post("/api/programs", (req, res) => {
    const programData = req.body;
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

    // --- Date & Time Validations ---
    // Normalize today's date to midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Normalize the provided start date to midnight for comparison
    const classStartDate = new Date(programData.startDate);
    classStartDate.setHours(0, 0, 0, 0);

    // Prevent staff from setting up a class before today
    if (classStartDate < today) {
        return res.status(400).json({ error: "Cannot set up a class before today's date." });
    }

    // Build full start and end DateTime objects using the provided values
    // (Assumes front-end sends lower-case property names)
    const startDateTime = new Date(`${programData.startDate}T${programData.startTime}`);
    const endDateTime = new Date(`${programData.endDate}T${programData.endTime}`);

    // Validate that the end date/time is strictly after the start date/time
    if (endDateTime <= startDateTime) {
        return res.status(400).json({ error: "End date and time must be after start date and time." });
    }

    // If the class is scheduled for today, ensure the start time is after the current time
    const now = new Date();
    if (classStartDate.getTime() === today.getTime() && startDateTime < now) {
        return res.status(400).json({ error: "For classes scheduled today, the start time must be after the current time." });
    }
    // --- End Date & Time Validations ---

    // Conflict check: only classes in the same room need to be checked.
    const conflictQuery = "SELECT * FROM Class WHERE RoomNumber = ?";
    
    // Helper function supports both lower-case and upper-case keys for date/time values:
    function isClassTimeConflict(newClass, existingClass) {
        const newStartDate = newClass.startDate || newClass.StartDate;
        const newStartTime = newClass.startTime || newClass.StartTime;
        const newEndDate = newClass.endDate || newClass.EndDate || newStartDate;
        const newEndTime = newClass.endTime || newClass.EndTime;
        const existStartDate = existingClass.startDate || existingClass.StartDate;
        const existStartTime = existingClass.startTime || existingClass.StartTime;
        const existEndDate = existingClass.endDate || existingClass.EndDate || existStartDate;
        const existEndTime = existingClass.endTime || existingClass.EndTime;
      
        const newStart = new Date(`${newStartDate}T${newStartTime}`);
        const newEnd = new Date(`${newEndDate}T${newEndTime}`);
        const existStart = new Date(`${existStartDate}T${existStartTime}`);
        const existEnd = new Date(`${existEndDate}T${existEndTime}`);
      
        // Returns true if new class overlaps with the existing class.
        return newStart < existEnd && existStart < newEnd && newStart.getDay() == existStart.getDay();
    }

    db.all(conflictQuery, [programData.location], (err, existingClasses) => {
        if (err) {
            console.error("Error checking for class conflicts:", err);
            return res.status(500).json({ error: "Database error during conflict check" });
        }
        // Loop through existing classes in the same room
        for (const existing of existingClasses) {
            if (isClassTimeConflict(programData, existing)) {
                return res.status(400).json({
                    error: "Scheduling conflict: Another class is already scheduled in this room at the same time."
                });
            }
        }
        // If no conflict, insert the new class.
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
                MaxCapacity, 
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
});
  
/* ----------------------------------------
   4) Get All Programs
---------------------------------------- */
app.get("/api/programs", (req, res) => {
    const sql = `
      SELECT 
        ClassID AS id,
        ClassName AS name,
        StartDate AS startDate,
        EndDate AS endDate,
        StartTime AS startTime,
        EndTime AS endTime,
        RoomNumber AS location,
        MemPrice AS priceMember,
        NonMemPrice AS priceNonMember,
        CurrCapacity AS capacity,
        Status
      FROM Class
      WHERE Status != 'Inactive'
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Failed to fetch active classes:", err);
            return res.status(500).json({ error: "Could not load programs" });
        }
        res.json(rows);
    });
});

/* ----------------------------------------
   Get Inactive Classes
---------------------------------------- */
app.get("/api/programs/inactive", (req, res) => {
    const sql = `
      SELECT 
        ClassID AS id,
        ClassName AS name,
        StartDate AS startDate,
        EndDate AS endDate,
        StartTime AS startTime,
        EndTime AS endTime,
        RoomNumber AS location,
        Status
      FROM Class
      WHERE Status = 'Inactive'
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Failed to fetch inactive classes:", err);
            return res.status(500).json({ error: "Could not load inactive classes" });
        }
        res.json(rows);
    });
});

/* ----------------------------------------
   Reactivate a Class
---------------------------------------- */
app.patch("/api/programs/:id/reactivate", authenticateToken, (req, res) => {
    const classId = req.params.id;

    const sql = `UPDATE Class SET Status = 'Open Spots' WHERE ClassID = ?`;
    db.run(sql, [classId], function (err) {
        if (err) {
            console.error("Error reactivating class:", err);
            return res.status(500).json({ error: "Could not reactivate class" });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: "Class not found" });
        }
        res.json({ message: "Class reactivated" });
    });
});

/* ----------------------------------------
   Get All Programs (Active Only)
---------------------------------------- */
app.get("/api/programs", (req, res) => {
    const sql = `
      SELECT 
        ClassID AS id,
        ClassName AS name,
        StartDate AS startDate,
        EndDate AS endDate,
        StartTime AS startTime,
        EndTime AS endTime,
        RoomNumber AS location,
        Description,
        MemPrice AS priceMember,
        NonMemPrice AS priceNonMember,
        CurrCapacity AS capacity,
        Status
      FROM Class
      WHERE Status != 'Inactive'
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Failed to fetch classes:", err);
            return res.status(500).json({ error: "Could not load classes" });
        }
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
   6) Get Registrations for the Authenticated User
---------------------------------------- */
app.get("/api/registrations", authenticateToken, (req, res) => {
    const userEmail = req.user.email;
    // Check if the user is a member first
    db.get("SELECT MemID FROM Member WHERE Email = ?", [userEmail], (err, member) => {
        if (err) {
            console.error("Error fetching member info:", err);
            return res.status(500).json({ error: "Database error" });
        }
        if (member) {
            const query = `
                SELECT 
                    c.StartDate AS startDate, 
                    c.EndDate AS endDate, 
                    c.StartTime AS startTime, 
                    c.EndTime AS endTime, 
                    c.RoomNumber AS location, 
                    c.ClassName AS name, 
                    c.ClassID AS id
                FROM Register r
                JOIN Class c ON r.ClassID = c.ClassID
                WHERE r.MemID = ?
            `;
            db.all(query, [member.MemID], (err, rows) => {
                if (err) {
                    console.error("Error fetching registrations:", err);
                    return res.status(500).json({ error: "Database error" });
                }
                res.json(rows);
            });
        } else {
            // If not a member, check if the user is a non-member
            db.get("SELECT NonMemID FROM NonMember WHERE Email = ?", [userEmail], (err, nonMember) => {
                if (err) {
                    console.error("Error fetching non-member info:", err);
                    return res.status(500).json({ error: "Database error" });
                }
                if (!nonMember) {
                    return res.status(404).json({ error: "User not found in Member or NonMember table." });
                }
                const query = `
                    SELECT 
                        c.StartDate AS startDate, 
                        c.EndDate AS endDate, 
                        c.StartTime AS startTime, 
                        c.EndTime AS endTime, 
                        c.RoomNumber AS location, 
                        c.ClassName AS name, 
                        c.ClassID AS id
                    FROM Register r
                    JOIN Class c ON r.ClassID = c.ClassID
                    WHERE r.NonMemID = ?
                `;
                db.all(query, [nonMember.NonMemID], (err, rows) => {
                    if (err) {
                        console.error("Error fetching registrations:", err);
                        return res.status(500).json({ error: "Database error" });
                    }
                    res.json(rows);
                });
            });
        }
    });
});
  
/* ----------------------------------------
   7) Delete (Unregister) a Registration (Authenticated)
---------------------------------------- */
app.delete("/api/registrations/:id", authenticateToken, (req, res) => {
    const registrationClassId = req.params.id;
    const userEmail = req.user.email;
  
    // Check if the user is a member first
    db.get("SELECT MemID FROM Member WHERE Email = ?", [userEmail], (err, member) => {
        if (err) {
            console.error("Error fetching member info:", err);
            return res.status(500).json({ error: "Database error" });
        }
        if (member) {
            db.run(
                "DELETE FROM Register WHERE ClassID = ? AND MemID = ?",
                [registrationClassId, member.MemID],
                function(err) {
                    if (err) {
                        console.error("Error deleting registration:", err);
                        return res.status(500).json({ error: "Database error" });
                    }
                    if (this.changes === 0) {
                        return res.status(404).json({ error: "Registration not found" });
                    }
                    res.json({ message: "Unregistered successfully!" });
                }
            );
        } else {
            // Check if the user is a non-member
            db.get("SELECT NonMemID FROM NonMember WHERE Email = ?", [userEmail], (err, nonMember) => {
                if (err) {
                    console.error("Error fetching non-member info:", err);
                    return res.status(500).json({ error: "Database error" });
                }
                if (!nonMember) {
                    return res.status(404).json({ error: "User not found" });
                }
                db.run(
                    "DELETE FROM Register WHERE ClassID = ? AND NonMemID = ?",
                    [registrationClassId, nonMember.NonMemID],
                    function(err) {
                        if (err) {
                            console.error("Error deleting registration:", err);
                            return res.status(500).json({ error: "Database error" });
                        }
                        if (this.changes === 0) {
                            return res.status(404).json({ error: "Registration not found" });
                        }
                        res.json({ message: "Unregistered successfully!" });
                    }
                );
            });
        }
    });
});
  
/* ----------------------------------------
   8) Register for a Program (Authenticated)
---------------------------------------- */
// Helper function to check if two classes overlap in time
function isTimeConflict(newClass, existingClass) {
    const newEndDate = newClass.EndDate || newClass.StartDate;
    const existEndDate = existingClass.EndDate || existingClass.StartDate;
    const newStart = new Date(`${newClass.StartDate}T${newClass.StartTime}`);
    const newEnd = new Date(`${newEndDate}T${newClass.EndTime}`);
    const existStart = new Date(`${existingClass.StartDate}T${existingClass.StartTime}`);
    const existEnd = new Date(`${existEndDate}T${existingClass.EndTime}`);
    return newStart < existEnd && existStart < newEnd && newStart.getDay() == existStart.getDay();
}
  
app.post("/api/register", authenticateToken, (req, res) => {
    const { programId } = req.body;
    const userEmail = req.user.email;
  
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
                return res.status(404).json({ error: "User not found in Member or NonMember table." });
            }
  
            // 3) Fetch the schedule details for the new class
            const newClassQuery = `
                SELECT StartDate, EndDate, StartTime, EndTime, RoomNumber 
                FROM Class 
                WHERE ClassID = ?
            `;
            db.get(newClassQuery, [programId], (err, newClass) => {
                if (err) {
                    console.error("Error fetching new class details:", err);
                    return res.status(500).json({ error: "Error fetching class details" });
                }
                if (!newClass) {
                    return res.status(404).json({ error: "Class not found" });
                }
  
                // Determine the user's ID and which column to check based on membership type
                let userId, idField;
                if (member) {
                    userId = member.MemID;
                    idField = "MemID";
                } else {
                    userId = nonMember.NonMemID;
                    idField = "NonMemID";
                }
  
                // 4) Query for all current registrations of the user, with class schedule info
                const registrationsQuery = `
                    SELECT c.StartDate, c.EndDate, c.StartTime, c.EndTime, c.RoomNumber 
                    FROM Register r
                    JOIN Class c ON r.ClassID = c.ClassID
                    WHERE r.${idField} = ?
                `;
                db.all(registrationsQuery, [userId], (err, registrations) => {
                    if (err) {
                        console.error("Error fetching registrations:", err);
                        return res.status(500).json({ error: "Error fetching registrations" });
                    }
  
                    // 5) Check each registered class for a time conflict
                    for (const reg of registrations) {
                        if (isTimeConflict(newClass, reg)) {
                            return res.status(400).json({
                                error: "Scheduling conflict: You are already registered for a class at this time."
                            });
                        }
                    }
  
                    // 6) If no conflicts, insert the registration
                    const query = member
                        ? "INSERT INTO Register (MemID, ClassID) VALUES (?, ?)"
                        : "INSERT INTO Register (NonMemID, ClassID) VALUES (?, ?)";
                    const params = member ? [member.MemID, programId] : [nonMember.NonMemID, programId];
                    db.run(query, params, function (err) {
                        if (err) {
                            if (err.code === "SQLITE_CONSTRAINT") {
                                return res.status(400).json({ error: "You are already registered for this program." });
                            } else {
                                console.error("Error registering user:", err);
                                return res.status(500).json({ error: "Database error" });
                            }
                        }

                    
                    db.run(
                        "UPDATE Class SET CurrCapacity = CurrCapacity + 1 WHERE ClassID = ?",
                        [programId],
                        function (err) {
                            if (err) {
                                console.error("Error updating CurrCapacity:", err);
                                return res.status(500).json({ error: "Registration saved, but failed to update capacity." });
                            }

                        res.json({ message: "Registration successful!" });
                    });
                });
            });
        });
    });
});
});
  
/* ----------------------------------------
   9) Soft Delete a Class (Visible to Employees Only)
---------------------------------------- */
app.delete("/api/programs/:id", authenticateToken, (req, res) => {
    const classId = req.params.id;
    const userEmail = req.user.email;

    console.log("🔐 DELETE requested by:", userEmail);

    //  Removed AcctType check — assumed frontend controls this
    const sql = "UPDATE Class SET Status = 'Inactive' WHERE ClassID = ?";
    db.run(sql, [classId], function (err) {
        if (err) {
            console.error("❌ Error updating class status:", err.message);
            return res.status(500).json({ error: "Failed to mark class inactive" });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: "Class not found" });
        }

        res.json({ message: "✅ Class marked as inactive." });
    });
});

/* ----------------------------------------
   FAMILY ACCOUNT ROUTES
---------------------------------------- */

// 1. Create a new family account
app.post("/api/family/create", authenticateToken, (req, res) => {
    const email = req.user.email;

    db.get("SELECT MemID FROM Member WHERE Email = ?", [email], (err, member) => {
        if (err || !member) return res.status(500).json({ error: "Member not found" });

        const memID = member.MemID;
        const familyName = `${email.split("@")[0]}'s Family`;

        db.run("INSERT INTO FamilyAccount (FamilyName, FamilyOwnerID) VALUES (?, ?)", [familyName, memID], function (err) {
            if (err) return res.status(500).json({ error: "Failed to create family" });

            const familyID = this.lastID;
            db.run("INSERT INTO FamilyMember (FamilyID, MemID) VALUES (?, ?)", [familyID, memID], (err) => {
                if (err) return res.status(500).json({ error: "Failed to join family" });
                res.json({ message: "Family created", familyID });
            });
        });
    });
});

// 2. Get family status for logged-in user and return all member info
app.get("/api/account/family-status", authenticateToken, (req, res) => {
    const email = req.user.email;

    db.get("SELECT MemID FROM Member WHERE Email = ?", [email], (err, member) => {
        if (err || !member) return res.status(404).json({ inFamily: false });

        const memID = member.MemID;

        const findFamilyQuery = `
            SELECT f.FamilyID, f.FamilyName, f.FamilyOwnerID
            FROM FamilyAccount f
            JOIN FamilyMember fm ON f.FamilyID = fm.FamilyID
            WHERE fm.MemID = ?
        `;

        db.get(findFamilyQuery, [memID], (err, family) => {
            if (err || !family) return res.json({ inFamily: false });

            const isOwner = family.FamilyOwnerID === memID;

            const getMembersQuery = `
                SELECT m.Email AS email, m.MemID AS memID, m.FName || ' ' || m.LName AS fullName
                FROM FamilyMember fm
                JOIN Member m ON fm.MemID = m.MemID
                WHERE fm.FamilyID = ?
            `;

            db.all(getMembersQuery, [family.FamilyID], (err, members) => {
                if (err) return res.status(500).json({ error: "Error loading family members" });

                res.json({
                    inFamily: true,
                    isOwner,
                    owner: family.FamilyName,
                    id: family.FamilyID,
                    members: members.map(m => ({
                        memID: m.memID,
                        email: m.email,
                        fullName: m.fullName
                    }))
                });
            });
        });
    });
});


// 3. Add a user to family
app.post("/api/family/add", authenticateToken, (req, res) => {
    const ownerEmail = req.user.email;
    const { username } = req.body;

    if (!username) return res.status(400).json({ error: "Missing username" });

    db.get("SELECT MemID FROM Member WHERE Email = ?", [ownerEmail], (err, owner) => {
        if (err || !owner) return res.status(400).json({ error: "Owner not found" });

        db.get("SELECT FamilyID FROM FamilyAccount WHERE FamilyOwnerID = ?", [owner.MemID], (err, family) => {
            if (err || !family) return res.status(400).json({ error: "Family not found" });

            db.get("SELECT MemID FROM Member WHERE Email = ?", [username], (err, newMem) => {
                if (err || !newMem) return res.status(404).json({ error: "User not found" });

                db.run("INSERT INTO FamilyMember (FamilyID, MemID) VALUES (?, ?)", [family.FamilyID, newMem.MemID], (err) => {
                    if (err) return res.status(500).json({ error: "Failed to add user to family" });
                    res.json({ message: "User added to family" });
                });
            });
        });
    });
});

// 4. Remove a user from family (owner-only)
app.delete("/api/family/remove/:username", authenticateToken, (req, res) => {
    const ownerEmail = req.user.email;
    const targetEmail = req.params.username;

    db.get("SELECT MemID FROM Member WHERE Email = ?", [ownerEmail], (err, owner) => {
        if (err || !owner) return res.status(400).json({ error: "Owner not found" });

        db.get("SELECT FamilyID, FamilyOwnerID FROM FamilyAccount WHERE FamilyOwnerID = ?", [owner.MemID], (err, family) => {
            if (err || !family) return res.status(400).json({ error: "Not family owner" });

            db.get("SELECT MemID FROM Member WHERE Email = ?", [targetEmail], (err, member) => {
                if (err || !member) return res.status(404).json({ error: "Target not found" });

                // Prevent removing the owner themselves
                if (member.MemID === family.FamilyOwnerID) {
                    return res.status(400).json({ error: "Cannot remove the family owner. Please delete the family instead." });
                }

                db.run("DELETE FROM FamilyMember WHERE FamilyID = ? AND MemID = ?", [family.FamilyID, member.MemID], function (err) {
                    if (err || this.changes === 0) {
                        return res.status(500).json({ error: "Removal failed" });
                    }
                    res.json({ message: "User removed from family" });
                });
            });
        });
    });
});


// 5. Delete the entire family (owner only)
app.delete("/api/family/delete/:id", authenticateToken, (req, res) => {
    const ownerEmail = req.user.email;
    const familyID = req.params.id;

    db.get("SELECT MemID FROM Member WHERE Email = ?", [ownerEmail], (err, owner) => {
        if (err || !owner) return res.status(400).json({ error: "Owner not found" });

        db.get("SELECT * FROM FamilyAccount WHERE FamilyID = ? AND FamilyOwnerID = ?", [familyID, owner.MemID], (err, fam) => {
            if (err || !fam) return res.status(403).json({ error: "Not authorized to delete this family" });

            db.run("DELETE FROM FamilyMember WHERE FamilyID = ?", [familyID], () => {
                db.run("DELETE FROM FamilyAccount WHERE FamilyID = ?", [familyID], function (err) {
                    if (err) return res.status(500).json({ error: "Failed to delete family" });
                    res.json({ message: "Family deleted" });
                });
            });
        });
    });
});


/* ----------------------------------------
   MANAGE USERS & CLASS ASSIGNMENT (MEMBER + NONMEMBER)
---------------------------------------- */

// Get user profile (status or nonmember flag)
app.get("/api/users/:email/profile", authenticateToken, (req, res) => {
    const email = req.params.email.trim().toLowerCase();

    db.get("SELECT Status FROM Member WHERE LOWER(Email) = ?", [email], (err, member) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (member) return res.json({ type: "member", email, status: member.Status.toLowerCase() });

        db.get("SELECT * FROM NonMember WHERE LOWER(Email) = ?", [email], (err, nonmem) => {
            if (err) return res.status(500).json({ error: "Database error" });
            if (nonmem) return res.json({ type: "nonmember", email, status: "nonmember" });

            res.status(404).json({ error: "User not found" });
        });
    });
});

// Update status (members only)
app.patch("/api/users/:email/status", authenticateToken, (req, res) => {
    const email = req.params.email.trim().toLowerCase();
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
    }

    const newStatus = status.charAt(0).toUpperCase() + status.slice(1);
    db.run("UPDATE Member SET Status = ?, StatusDate = CURRENT_DATE WHERE LOWER(Email) = LOWER(?)",
        [newStatus, email],
        function (err) {
            if (err) return res.status(500).json({ error: "Failed to update status" });
            if (this.changes === 0) return res.status(404).json({ error: "User not found or not a member" });
            res.json({ message: `Status updated to ${newStatus}` });
        }
    );
});

// Get all registrations for a user (member or nonmember)
app.get("/api/users/:email/registrations", authenticateToken, (req, res) => {
    const email = req.params.email.trim().toLowerCase();

    db.get("SELECT MemID FROM Member WHERE LOWER(Email) = ?", [email], (err, member) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (member) {
            return db.all(`
                SELECT 
                    c.ClassID AS id,
                    c.ClassName AS name,
                    c.StartDate, c.EndDate,
                    c.StartTime, c.EndTime,
                    c.RoomNumber AS location
                FROM Register r
                JOIN Class c ON r.ClassID = c.ClassID
                WHERE r.MemID = ?
            `, [member.MemID], (err, rows) => {
                if (err) return res.status(500).json({ error: "Failed to fetch member classes" });
                return res.json(rows);
            });
        }

        // Try nonmember
        db.get("SELECT NonMemID FROM NonMember WHERE LOWER(Email) = ?", [email], (err, nonmem) => {
            if (err || !nonmem) return res.status(404).json({ error: "User not found" });

            db.all(`
                SELECT 
                    c.ClassID AS id,
                    c.ClassName AS name,
                    c.StartDate, c.EndDate,
                    c.StartTime, c.EndTime,
                    c.RoomNumber AS location
                FROM Register r
                JOIN Class c ON r.ClassID = c.ClassID
                WHERE r.NonMemID = ?
            `, [nonmem.NonMemID], (err, rows) => {
                if (err) return res.status(500).json({ error: "Failed to fetch nonmember classes" });
                return res.json(rows);
            });
        });
    });
});

// Assign class to MEMBER
app.post("/api/users/:email/register/:classId", authenticateToken, (req, res) => {
    const email = req.params.email.trim().toLowerCase();
    const classId = req.params.classId;

    db.get("SELECT MemID FROM Member WHERE LOWER(Email) = ?", [email], (err, member) => {
        if (err || !member) return res.status(404).json({ error: "Member not found" });

        const sql = "INSERT INTO Register (MemID, ClassID) VALUES (?, ?)";
        db.run(sql, [member.MemID, classId], function (err) {
            if (err) return res.status(500).json({ error: "Failed to assign class" });
            res.json({ message: "Class assigned", classId: parseInt(classId) });
        });
    });
});

// Unregister class for MEMBER
app.delete("/api/users/:email/register/:classId", authenticateToken, (req, res) => {
    const email = req.params.email.trim().toLowerCase();
    const classId = req.params.classId;

    db.get("SELECT MemID FROM Member WHERE LOWER(Email) = ?", [email], (err, member) => {
        if (err || !member) return res.status(404).json({ error: "Member not found" });

        const sql = "DELETE FROM Register WHERE MemID = ? AND ClassID = ?";
        db.run(sql, [member.MemID, classId], function (err) {
            if (err) return res.status(500).json({ error: "Unregistration failed" });
            res.json({ message: "Class unregistered" });
        });
    });
});

// Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
