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
    bcrypt.compare(password, user.Password, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ error: "Error comparing passwords" });
      }
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid password" });
      }
      const role = user.Email.endsWith("@ymca.org") ? "staff" : "user";
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
  const { username, password, membershipType, fname, lname, mname,
          birthday, street, houseNumber, city, state, zipCode, phone, fee } = req.body;
  if (!username || !password || !membershipType) {
    return res.status(400).json({ error: "Username, password, and membership type are required." });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(username.trim())) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (membershipType === "member") {
    const requiredFields = [fname, lname, birthday, street, houseNumber, city, state, zipCode, phone];
    if (requiredFields.some(field => field === undefined || field === null || (typeof field === "string" && field.trim() === ""))) {
      return res.status(400).json({ error: "All member details are required." });
    }
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
      const feeValue = fee === undefined || (typeof fee === "string" && fee.trim() === "") ? 0 : fee;
      sql = `INSERT INTO Member (
                FName, LName, MName, Birthday, Street, HouseNumber, City, State, ZipCode,
                PhoneNumber, Email, Password, Fee, AcctType
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      params = [
        fname.trim(), lname.trim(), mname ? mname.trim() : null, birthday.trim(),
        street.trim(), houseNumber.trim(), city.trim(), state.trim(), zipCode.trim(),
        phone.trim(), username.trim(), hashedPassword, feeValue, acctType
      ];
    } else if (membershipType === "non-member") {
      sql = `INSERT INTO NonMember (
                FName, LName, MName, Birthday, Email, PhoneNumber, Password
             ) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      params = [
        fname.trim(), lname.trim(), mname ? mname.trim() : null, birthday.trim(),
        username.trim(), phone.trim(), hashedPassword
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
   3) Add Class to Database (with conflict check)
   Frequency is stored with the record but does not cause duplicate rows.
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const classStartDate = new Date(programData.startDate);
  classStartDate.setHours(0, 0, 0, 0);
  if (classStartDate < today) {
    return res.status(400).json({ error: "Cannot set up a class before today's date." });
  }
  const startDateTime = new Date(`${programData.startDate}T${programData.startTime}`);
  const endDateTime = new Date(`${programData.endDate}T${programData.endTime}`);
  if (endDateTime <= startDateTime) {
    return res.status(400).json({ error: "End date and time must be after start date and time." });
  }
  const now = new Date();
  if (classStartDate.getTime() === today.getTime() && startDateTime < now) {
    return res.status(400).json({ error: "For classes scheduled today, the start time must be after the current time." });
  }
  // Perform a conflict check for the first occurrence.
  const conflictQuery = `
    SELECT * FROM Class 
    WHERE RoomNumber = ? AND StartDate = ? AND StartTime = ?
  `;
  db.get(conflictQuery, [programData.location, programData.startDate, programData.startTime], (err, conflict) => {
    if (err) {
      console.error("Error during conflict check:", err);
      return res.status(500).json({ error: "Database error during conflict check" });
    }
    if (conflict) {
      return res.status(400).json({ error: "Scheduling conflict: Another class is scheduled at this time in the chosen room." });
    }
    // Insert one record with the Frequency field.
    const insertSql = `
      INSERT INTO Class (
        ClassName, Description, Frequency, RoomNumber, StartDate, EndDate,
        StartTime, EndTime, MaxCapacity, MemPrice, NonMemPrice, AgeGroup, EmpID, ClassType
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(
      insertSql,
      [
        programData.name,
        programData.description,
        programData.frequency, // Frequency is stored here for calendar use
        programData.location,
        programData.startDate,
        programData.endDate,
        programData.startTime,
        programData.endTime,
        programData.capacity,
        programData.priceMember,
        programData.priceNonMember,
        programData.ageGroup,
        1, // Hard-coded EmpID; adjust as needed.
        programData.classType
      ],
      function (err) {
        if (err) {
          console.error("Error inserting class:", err);
          return res.status(500).json({ error: "Error adding class to database" });
        }
        res.json({ message: "Class added successfully", id: this.lastID });
      }
    );
  });
});

/* ----------------------------------------
   Get All Programs (Active Only) for Browsing
   This endpoint groups classes so each series shows only once.
---------------------------------------- */
app.get("/api/programs", (req, res) => {
  const sql = `
      SELECT 
        MIN(ClassID) AS id,
        ClassName AS name,
        Description AS description,
        MIN(StartDate) AS startDate,
        MAX(EndDate) AS endDate,
        StartTime AS startTime,
        EndTime AS endTime,
        RoomNumber AS location,
        MemPrice AS priceMember,
        NonMemPrice AS priceNonMember,
        MaxCapacity - CurrCapacity AS capacity,
        Frequency AS frequency,
        Status AS status
      FROM Class
      WHERE Status != 'Inactive'
      GROUP BY ClassName, Description, StartTime, EndTime, RoomNumber, MemPrice, NonMemPrice, Frequency, Status
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
        Status AS status
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
   Get Program by ID
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
        MaxCapacity - CurrCapacity AS capacity, 
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

/* ----------------------------------------
   Delete (Unregister) a Registration (Authenticated)
---------------------------------------- */
app.delete("/api/registrations/:id", authenticateToken, (req, res) => {
  const registrationClassId = req.params.id;
  const userEmail = req.user.email;
  db.get("SELECT MemID FROM Member WHERE Email = ?", [userEmail], (err, member) => {
    if (err) {
      console.error("Error fetching member info:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (member) {
      db.run("DELETE FROM Register WHERE ClassID = ? AND MemID = ?", [registrationClassId, member.MemID], function(err) {
        if (err) {
          console.error("Error deleting registration:", err);
          return res.status(500).json({ error: "Database error" });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: "Registration not found" });
        }
        db.run("UPDATE Class SET CurrCapacity = CurrCapacity - 1 WHERE ClassID = ?",
          [registrationClassId],
          function (err) {
            if (err) {
              console.error("Error updating CurrCapacity:", err);
              return res.status(500).json({ error: "Registration saved, but failed to update capacity." });
            }
            res.json({ message: "Unregistered successfully!" });
          }
        );
      });
    } else {
      db.get("SELECT NonMemID FROM NonMember WHERE Email = ?", [userEmail], (err, nonMember) => {
        if (err) {
          console.error("Error fetching non-member info:", err);
          return res.status(500).json({ error: "Database error" });
        }
        if (!nonMember) {
          return res.status(404).json({ error: "User not found" });
        }
        db.run("DELETE FROM Register WHERE ClassID = ? AND NonMemID = ?", [registrationClassId, nonMember.NonMemID], function(err) {
          if (err) {
            console.error("Error deleting registration:", err);
            return res.status(500).json({ error: "Database error" });
          }
          if (this.changes === 0) {
            return res.status(404).json({ error: "Registration not found" });
          }
          db.run("UPDATE Class SET CurrCapacity = CurrCapacity - 1 WHERE ClassID = ?",
            [registrationClassId],
            function (err) {
              if (err) {
                console.error("Error updating CurrCapacity:", err);
                return res.status(500).json({ error: "Registration saved, but failed to update capacity." });
              }
              res.json({ message: "Unregistered successfully!" });
            }
          );
        });
      });
    }
  });
});

/* ----------------------------------------
   Register for a Program (Authenticated)
---------------------------------------- */
// Helper to get a value from an object using a lowercase key or capitalized version.
function getVal(obj, key) {
  return obj[key] !== undefined ? obj[key] : obj[key.charAt(0).toUpperCase() + key.slice(1)];
}

function isTimeConflict(newClass, existingClass) {
  // Get start and end dates/times using consistent naming.
  const newStartDate = getVal(newClass, "startDate");
  const newStartTime = getVal(newClass, "startTime");
  const newEndDate = getVal(newClass, "endDate") || newStartDate;
  const newEndTime = getVal(newClass, "endTime");

  const existStartDate = getVal(existingClass, "startDate");
  const existStartTime = getVal(existingClass, "startTime");
  const existEndDate = getVal(existingClass, "endDate") || existStartDate;
  const existEndTime = getVal(existingClass, "endTime");

  const newStart = new Date(`${newStartDate}T${newStartTime}`);
  const newEnd = new Date(`${newEndDate}T${newEndTime}`);
  const existStart = new Date(`${existStartDate}T${existStartTime}`);
  const existEnd = new Date(`${existEndDate}T${existEndTime}`);

  // Check conflict only if they occur on the same day.
  if (newStart.getDay() !== existStart.getDay()) return false;

  return newStart < existEnd && existStart < newEnd;
}

app.post("/api/register", authenticateToken, (req, res) => {
  const { programId } = req.body;
  const userEmail = req.user.email;
  db.get("SELECT MemID FROM Member WHERE Email = ?", [userEmail], (err, member) => {
    if (err) {
      console.error("Error searching Member table:", err);
      return res.status(500).json({ error: "Database error" });
    }
    db.get("SELECT NonMemID FROM NonMember WHERE Email = ?", [userEmail], (err, nonMember) => {
      if (err) {
        console.error("Error searching NonMemID:", err);
        return res.status(500).json({ error: "Database error" });
      }
      if (!member && !nonMember) {
        return res.status(404).json({ error: "User not found in Member or NonMember table." });
      }
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
        let userId, idField;
        if (member) {
          userId = member.MemID;
          idField = "MemID";
        } else {
          userId = nonMember.NonMemID;
          idField = "NonMemID";
        }
        // NEW: Check if the user is already registered for this program.
        const checkRegQuery = `SELECT * FROM Register WHERE ${idField} = ? AND ClassID = ?`;
        db.get(checkRegQuery, [userId, programId], (err, existingReg) => {
          if (err) {
            console.error("Error checking registration:", err);
            return res.status(500).json({ error: "Database error" });
          }
          if (existingReg) {
            return res.status(400).json({ error: "You are already registered for this program." });
          }
          // Exclude the class being registered from conflict check.
          const registrationsQuery = `
            SELECT c.StartDate, c.EndDate, c.StartTime, c.EndTime, c.RoomNumber 
            FROM Register r
            JOIN Class c ON r.ClassID = c.ClassID
            WHERE r.${idField} = ? AND c.ClassID != ?
          `;
          db.all(registrationsQuery, [userId, programId], (err, registrations) => {
            if (err) {
              console.error("Error fetching registrations:", err);
              return res.status(500).json({ error: "Error fetching registrations" });
            }
            for (const reg of registrations) {
              if (isTimeConflict(newClass, reg)) {
                return res.status(400).json({
                  error: "Scheduling conflict: You are already registered for a class at this time."
                });
              }
            }
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
              db.run("UPDATE Class SET CurrCapacity = CurrCapacity + 1 WHERE ClassID = ?",
                [programId],
                function (err) {
                  if (err) {
                    console.error("Error updating CurrCapacity:", err);
                    return res.status(500).json({ error: "Registration saved, but failed to update capacity." });
                  }
                  res.json({ message: "Registration successful!" });
                }
              );
            });
          });
        });
      });
    });
  });
});

/* ----------------------------------------
    Get Registrations for the Authenticated User
 ---------------------------------------- */
 app.get("/api/registrations", authenticateToken, (req, res) => {
  const userEmail = req.user.email;
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
            c.ClassID AS id,
            c.Frequency AS frequency
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
              c.ClassID AS id,
              c.Frequency AS frequency
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



// 9) Soft Delete a Class (Visible to Employees Only)

app.delete("/api/programs/:id", authenticateToken, (req, res) => {
  const classId = req.params.id;
  const userEmail = req.user.email;
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
    if (err || !member) {
      return res.status(500).json({ modal: true, error: "Member not found" });
    }

    const memID = member.MemID;
    const familyName = `${email.split("@")[0]}'s Family`;

    db.run("INSERT INTO FamilyAccount (FamilyName, FamilyOwnerID) VALUES (?, ?)", [familyName, memID], function (err) {
      if (err) {
        return res.status(500).json({ modal: true, error: "Failed to create family" });
      }

      const familyID = this.lastID;
      db.run("INSERT INTO FamilyMember (FamilyID, MemID) VALUES (?, ?)", [familyID, memID], (err) => {
        if (err) {
          return res.status(500).json({ modal: true, error: "Failed to join family" });
        }
        res.json({ modal: true, message: "Family created", familyID });
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
              if (err || !newMem) return res.status(404).json({ error: "User is not a YMCA Member" });

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

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
