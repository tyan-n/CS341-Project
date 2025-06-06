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
    SELECT Email, Password, Status 
    FROM Member 
    WHERE Email = ?
    UNION
    SELECT Email, Password, Status 
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

    // Check if the user is deactivated
    if (user.Status && user.Status.toLowerCase() === "inactive") {
      return res.status(403).json({ error: "Your account has been deactivated." });
    }

    // Check password
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
   3) Add Class to Database (with ClassDays)
   Frequency removed — Days are stored in ClassDays table
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
    !programData.priceNonMember ||
    !Array.isArray(programData.days) || programData.days.length === 0
  ) {
    return res.status(400).json({ error: "Missing required fields or no days selected" });
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
  const now = new Date();

  if (endDateTime <= startDateTime) {
    return res.status(400).json({ error: "End date and time must be after start date and time." });
  }

  if (classStartDate.getTime() === today.getTime() && startDateTime < now) {
    return res.status(400).json({ error: "For classes scheduled today, the start time must be after the current time." });
  }

  const conflictQuery = `
    SELECT * FROM Class 
    WHERE RoomNumber = ? AND StartDate = ? AND StartTime = ? AND Status != 'Inactive'
  `;

  db.get(conflictQuery, [programData.location, programData.startDate, programData.startTime], (err, conflict) => {
    if (err) {
      console.error("❌ Conflict check failed:", err);
      return res.status(500).json({ error: "Database error during conflict check" });
    }

    if (conflict) {
      return res.status(400).json({ error: "Scheduling conflict: Another class is scheduled at this time in the chosen room." });
    }

    const insertClassSql = `
    INSERT INTO Class (
      EmpID, ClassName, RoomNumber, StartDate, EndDate,
      StartTime, EndTime, Description, CurrCapacity,
      MemPrice, NonMemPrice, ClassType, Status, MaxCapacity
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
  `;

  const values = [
    programData.empId || 1,
    programData.name,
    programData.location,
    programData.startDate,
    programData.endDate,
    programData.startTime,
    programData.endTime,
    programData.description,
    programData.priceMember,
    programData.priceNonMember,
    programData.classType,
    programData.status || "Open Spots",
    programData.capacity 
  ];

    db.run(insertClassSql, values, function (err) {
      if (err) {
        console.error("❌ Error inserting class:", err);
        return res.status(500).json({ error: "Error adding class to database" });
      }

      const classId = this.lastID;

      const insertDayStmt = db.prepare(`INSERT INTO ClassDays (ClassID, DayOfWeek) VALUES (?, ?)`);
      programData.days.forEach(day => {
        insertDayStmt.run(classId, day);
      });

      insertDayStmt.finalize(err => {
        if (err) {
          console.error("❌ Failed to assign class days:", err);
          return res.status(500).json({ error: "Class created, but failed to assign days." });
        }

        res.json({ message: "Class created successfully", id: classId });
      });
    });
  });
});

/* ----------------------------------------
   Get All Programs (Active Only) for Browsing
   Includes Days, Capacity, Prices
---------------------------------------- */
app.get("/api/programs", authenticateToken, (req, res) => {
  const sql = `
    SELECT 
      c.ClassID AS id,
      c.ClassName AS name,
      c.Description AS description,
      c.StartDate AS startDate,
      c.EndDate AS endDate,
      c.StartTime AS startTime,
      c.EndTime AS endTime,
      c.RoomNumber AS location,
      c.MaxCapacity - c.CurrCapacity AS capacity,
      c.MaxCapacity AS maxCapacity,
      c.MemPrice AS priceMember,
      c.NonMemPrice AS priceNonMember,
      c.Status AS status,
      GROUP_CONCAT(cd.DayOfWeek) AS days
    FROM Class c
    JOIN Room r ON c.RoomNumber = r.RoomNumber
    LEFT JOIN ClassDays cd ON c.ClassID = cd.ClassID
    WHERE c.Status != 'Inactive'
    GROUP BY c.ClassID
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("❌ Failed to fetch programs:", err);
      return res.status(500).json({ error: "Failed to fetch programs" });
    }
    res.json(rows);
  });
});

/* ----------------------------------------
   Get Inactive Classes (Secured)
---------------------------------------- */
app.get("/api/programs/inactive", authenticateToken, (req, res) => {
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
      console.error("❌ Failed to fetch inactive classes:", err);
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
   Get Program by ID (JOIN Room for MaxCapacity)
---------------------------------------- */
app.get("/api/programs/:id", (req, res) => {
  const programId = req.params.id;
  console.log("🔍 Fetching program with ID:", programId);

  const sql = `
    SELECT 
      Class.ClassID AS id,
      Class.ClassName AS name,
      Class.Description AS description,
      Class.StartTime AS startTime,
      Class.EndTime AS endTime,
      Class.RoomNumber AS location,
      Class.MaxCapacity - Class.CurrCapacity AS capacity,
      Class.MaxCapacity AS maxCapacity,
      Class.MemPrice AS priceMember,
      Class.NonMemPrice AS priceNonMember
    FROM Class
    JOIN Room ON Class.RoomNumber = Room.RoomNumber
    WHERE Class.ClassID = ?
  `;

  db.get(sql, [programId], (err, program) => {
    if (err) {
      console.error("Error fetching program:", err);
      return res.status(500).json({ error: "Server error" });
    }
    if (!program) {
      console.log("Program not found in database");
      return res.status(404).json({ error: "Program not found" });
    }
    res.json(program);
  });
});

/* ----------------------------------------
    MANAGE USERS & CLASS ASSIGNMENT (MEMBER + NONMEMBER)
---------------------------------------- */

// Get user profile (status or nonmember flag)
app.get("/api/users/:email/profile", authenticateToken, (req, res) => {
  const email = req.params.email.trim();

  db.get("SELECT Status FROM Member WHERE Email = ?", [email], (err, member) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (member) return res.json({ type: "member", email, status: member.Status.toLowerCase() });

    db.get("SELECT * FROM NonMember WHERE Email = ?", [email], (err, nonmem) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (nonmem) return res.json({ type: "nonmember", email, status: "nonmember" });

      res.status(404).json({ error: "User not found" });
    });
  });
});

// Update status and remove registrations if deactivating
app.patch("/api/users/:email/status", authenticateToken, (req, res) => {
  const email = req.params.email.trim();
  const { status } = req.body;

  if (!["active", "inactive"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const newStatus = status.charAt(0).toUpperCase() + status.slice(1);

  db.get("SELECT MemID FROM Member WHERE Email = ?", [email], (err, member) => {
    if (err) return res.status(500).json({ error: "Database error" });

    if (member) {
      const memID = member.MemID;

      db.run(
        "UPDATE Member SET Status = ?, StatusDate = CURRENT_DATE WHERE MemID = ?",
        [newStatus, memID],
        function (err) {
          if (err) return res.status(500).json({ error: "Failed to update member status" });
      
          if (newStatus === "Inactive") {
            db.all("SELECT ClassID FROM Register WHERE MemID = ?", [memID], (err2, rows) => {
              if (!err2 && rows.length > 0) {
                const insert = db.prepare(`
                  INSERT INTO Cancelled (ClassID, MemID, NonMemID, DateCancelled, Notified)
                  VALUES (?, ?, NULL, CURRENT_DATE, 0)
                `);
      
                rows.forEach(row => {
                  insert.run(row.ClassID, memID);
      
                  db.run(
                    "UPDATE Class SET CurrCapacity = CurrCapacity - 1 WHERE ClassID = ? AND CurrCapacity > 0",
                    [row.ClassID]
                  );
                });
      
                insert.finalize();
              }
      
              db.run("DELETE FROM Register WHERE MemID = ?", [memID]);
            });
          }
      
          return res.json({ message: `Status updated to ${newStatus}` });
        }
      );

      return;
    }

    // If not a member, try nonmember
    db.get("SELECT NonMemID FROM NonMember WHERE Email = ?", [email], (err2, nonmem) => {
      if (err2 || !nonmem) return res.status(404).json({ error: "User not found" });

      const nonMemID = nonmem.NonMemID;

      db.run("UPDATE NonMember SET Status = ? WHERE NonMemID = ?", [newStatus, nonMemID], function (err3) {
        if (err3) return res.status(500).json({ error: "Failed to update nonmember status" });

        if (newStatus === "Inactive") {
          db.all("SELECT ClassID FROM Register WHERE NonMemID = ?", [nonMemID], (err4, rows) => {
            if (!err4 && rows.length > 0) {
              const insert = db.prepare(`INSERT INTO Cancelled (ClassID, MemID, NonMemID, DateCancelled, Notified) VALUES (?, NULL, ?, CURRENT_DATE, 0)`);
              rows.forEach(row => insert.run(row.ClassID, nonMemID));
              insert.finalize();
            }
            db.run("DELETE FROM Register WHERE NonMemID = ?", [nonMemID]);
          });
        }

        return res.json({ message: `Status updated to ${newStatus}` });
      });
    });
  });
});

// Get all registrations for a user (member or nonmember) including recurring days
app.get("/api/users/:email/registrations", authenticateToken, (req, res) => {
  const email = req.params.email.trim();

  db.get("SELECT MemID FROM Member WHERE Email = ?", [email], (err, member) => {
    if (err) return res.status(500).json({ error: "Database error" });

    if (member) {
      return db.all(`
        SELECT 
          c.ClassID AS id,
          c.ClassName AS name,
          c.StartDate, c.EndDate,
          c.StartTime, c.EndTime,
          c.RoomNumber AS location,
          GROUP_CONCAT(cd.DayOfWeek) AS days
        FROM Register r
        JOIN Class c ON r.ClassID = c.ClassID
        LEFT JOIN ClassDays cd ON c.ClassID = cd.ClassID
        WHERE r.MemID = ?
        GROUP BY c.ClassID
      `, [member.MemID], (err, rows) => {
        if (err) return res.status(500).json({ error: "Failed to fetch member classes" });
        return res.json(rows);
      });
    }

    db.get("SELECT NonMemID FROM NonMember WHERE Email = ?", [email], (err, nonmem) => {
      if (err || !nonmem) return res.status(404).json({ error: "User not found" });

      db.all(`
        SELECT 
          c.ClassID AS id,
          c.ClassName AS name,
          c.StartDate, c.EndDate,
          c.StartTime, c.EndTime,
          c.RoomNumber AS location,
          GROUP_CONCAT(cd.DayOfWeek) AS days
        FROM Register r
        JOIN Class c ON r.ClassID = c.ClassID
        LEFT JOIN ClassDays cd ON c.ClassID = cd.ClassID
        WHERE r.NonMemID = ?
        GROUP BY c.ClassID
      `, [nonmem.NonMemID], (err, rows) => {
        if (err) return res.status(500).json({ error: "Failed to fetch nonmember classes" });
        return res.json(rows);
      });
    });
  });
});

// Assign class to MEMBER or NONMEMBER with status check
app.post("/api/users/:email/register/:classId", authenticateToken, (req, res) => {
  const email = req.params.email.trim();
  const classId = req.params.classId;

  // Check Member first
  db.get("SELECT MemID, Status FROM Member WHERE Email = ?", [email], (err, member) => {
    if (err) return res.status(500).json({ error: "Database error" });

    if (member) {
      if (member.Status.toLowerCase() === "inactive") {
        return res.status(403).json({ error: "Cannot assign class: user is inactive." });
      }

      // Capacity check before registration
      return db.get("SELECT CurrCapacity, MaxCapacity FROM Class WHERE ClassID = ?", [classId], (err, row) => {
        if (err) return res.status(500).json({ error: "Error checking class capacity" });
        if (!row) return res.status(404).json({ error: "Class not found" });
        if (row.CurrCapacity >= row.MaxCapacity) {
          return res.status(400).json({ error: "Class is full. Cannot register." });
        }

        const sql = "INSERT INTO Register (MemID, ClassID) VALUES (?, ?)";
        db.run(sql, [member.MemID, classId], function (err) {
          if (err) return res.status(500).json({ error: "Failed to assign class" });

          db.run("UPDATE Class SET CurrCapacity = CurrCapacity + 1 WHERE ClassID = ?", [classId]);
          res.json({ message: "Class assigned", classId: parseInt(classId) });
        });
      });
    }

    // Check NonMember
    db.get("SELECT NonMemID, Status FROM NonMember WHERE Email = ?", [email], (err2, nonmem) => {
      if (err2 || !nonmem) return res.status(404).json({ error: "User not found" });

      if (nonmem.Status.toLowerCase() === "inactive") {
        return res.status(403).json({ error: "Cannot assign class: user is inactive." });
      }

      // Capacity check before registration
      db.get("SELECT CurrCapacity, MaxCapacity FROM Class WHERE ClassID = ?", [classId], (err, row) => {
        if (err) return res.status(500).json({ error: "Error checking class capacity" });
        if (!row) return res.status(404).json({ error: "Class not found" });
        if (row.CurrCapacity >= row.MaxCapacity) {
          return res.status(400).json({ error: "Class is full. Cannot register." });
        }

        const sql = "INSERT INTO Register (NonMemID, ClassID) VALUES (?, ?)";
        db.run(sql, [nonmem.NonMemID, classId], function (err3) {
          if (err3) return res.status(500).json({ error: "Failed to assign class" });

          db.run("UPDATE Class SET CurrCapacity = CurrCapacity + 1 WHERE ClassID = ?", [classId]);
          res.json({ message: "Class assigned", classId: parseInt(classId) });
        });
      });
    });
  });
});

// Unregister class for MEMBER or NONMEMBER and log in Cancelled
app.delete("/api/users/:email/register/:classId", authenticateToken, (req, res) => {
  const email = req.params.email.trim();
  const classId = req.params.classId;

  db.get("SELECT MemID FROM Member WHERE Email = ?", [email], (err, member) => {
    if (err) return res.status(500).json({ error: "Database error" });

    if (member) {
      const sql = "DELETE FROM Register WHERE MemID = ? AND ClassID = ?";
      return db.run(sql, [member.MemID, classId], function (err) {
        if (err) return res.status(500).json({ error: "Unregistration failed" });

        db.run("UPDATE Class SET CurrCapacity = CurrCapacity - 1 WHERE ClassID = ?", [classId]);

        // Log into Cancelled table
        db.run(
          `INSERT INTO Cancelled (ClassID, MemID, NonMemID, DateCancelled, Notified)
           VALUES (?, ?, NULL, CURRENT_DATE, 0)`,
          [classId, member.MemID]
        );

        res.json({ message: "Class unregistered and user notified." });
      });
    }

    // Try NonMember
    db.get("SELECT NonMemID FROM NonMember WHERE Email = ?", [email], (err2, nonmem) => {
      if (err2 || !nonmem) return res.status(404).json({ error: "User not found" });

      const sql = "DELETE FROM Register WHERE NonMemID = ? AND ClassID = ?";
      db.run(sql, [nonmem.NonMemID, classId], function (err3) {
        if (err3) return res.status(500).json({ error: "Unregistration failed" });

        db.run("UPDATE Class SET CurrCapacity = CurrCapacity - 1 WHERE ClassID = ?", [classId]);

        // Log into Cancelled table
        db.run(
          `INSERT INTO Cancelled (ClassID, MemID, NonMemID, DateCancelled, Notified)
           VALUES (?, ?, NULL, CURRENT_DATE, 0)`,
          [classId, member.MemID]
        );             

        res.json({ message: "Class unregistered and user notified." });
      });
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
  const getVal = (obj, key) => obj[key] ?? obj[key.charAt(0).toUpperCase() + key.slice(1)];

  const newStartTime = getVal(newClass, "startTime");
  const newEndTime = getVal(newClass, "endTime");
  const newDays = getVal(newClass, "days")?.split(",") || [];

  const existStartTime = getVal(existingClass, "startTime");
  const existEndTime = getVal(existingClass, "endTime");
  const existDays = getVal(existingClass, "days")?.split(",") || [];

  const hasDayOverlap = newDays.some(day => existDays.includes(day));
  if (!hasDayOverlap) return false;

  const newStart = new Date(`1970-01-01T${newStartTime}`);
  const newEnd = new Date(`1970-01-01T${newEndTime}`);
  const existStart = new Date(`1970-01-01T${existStartTime}`);
  const existEnd = new Date(`1970-01-01T${existEndTime}`);

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
      SELECT StartDate, EndDate, StartTime, EndTime, RoomNumber,
             GROUP_CONCAT(ClassDays.DayOfWeek) AS days
      FROM Class
      LEFT JOIN ClassDays ON Class.ClassID = ClassDays.ClassID
      WHERE Class.ClassID = ?
      GROUP BY Class.ClassID
    `;    

      db.get(newClassQuery, [programId], (err, newClass) => {
        if (err) {
          console.error("Error fetching new class details:", err);
          return res.status(500).json({ error: "Error fetching class details" });
        }

        if (!newClass) {
          return res.status(404).json({ error: "Class not found" });
        }

        // Capacity check
        db.get("SELECT CurrCapacity, MaxCapacity FROM Class WHERE ClassID = ?", [programId], (err, capRow) => {
          if (err) {
            console.error("Error checking class capacity:", err);
            return res.status(500).json({ error: "Error checking capacity" });
          }

          if (!capRow) {
            return res.status(404).json({ error: "Class not found" });
          }

          if (capRow.CurrCapacity >= capRow.MaxCapacity) {
            return res.status(400).json({ error: "Class is full. Cannot register." });
          }

          let userId, idField;
          if (member) {
            userId = member.MemID;
            idField = "MemID";
          } else {
            userId = nonMember.NonMemID;
            idField = "NonMemID";
          }

          // Check for duplicate registration
          const checkRegQuery = `SELECT * FROM Register WHERE ${idField} = ? AND ClassID = ?`;
          db.get(checkRegQuery, [userId, programId], (err, existingReg) => {
            if (err) {
              console.error("Error checking registration:", err);
              return res.status(500).json({ error: "Database error" });
            }

            if (existingReg) {
              return res.status(400).json({ error: "You are already registered for this program." });
            }

            // Time conflict check
            const registrationsQuery = `
              SELECT 
                c.StartDate, c.EndDate, c.StartTime, c.EndTime, c.RoomNumber,
                GROUP_CONCAT(cd.DayOfWeek) AS days
              FROM Register r
              JOIN Class c ON r.ClassID = c.ClassID
              LEFT JOIN ClassDays cd ON c.ClassID = cd.ClassID
              WHERE r.${idField} = ? AND c.ClassID != ?
              GROUP BY c.ClassID
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

              // Register and update capacity
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
          c.ClassID AS id,
          c.ClassName AS name,
          c.Description AS description,
          c.StartDate AS startDate,
          c.EndDate AS endDate,
          c.StartTime AS startTime,
          c.EndTime AS endTime,
          c.RoomNumber AS location,
          c.Status AS status,
          GROUP_CONCAT(d.DayOfWeek) AS days
        FROM Register r
        JOIN Class c ON r.ClassID = c.ClassID
        LEFT JOIN ClassDays d ON c.ClassID = d.ClassID
        WHERE r.MemID = ? AND c.Status != 'Inactive'
        GROUP BY c.ClassID
      `;
      return db.all(query, [member.MemID], (err, rows) => {
        if (err) {
          console.error("Error fetching member registrations:", err);
          return res.status(500).json({ error: "Failed to fetch registrations" });
        }
        res.json(rows);
      });
    }

    // If not a member, check NonMember
    db.get("SELECT NonMemID FROM NonMember WHERE Email = ?", [userEmail], (err, nonmem) => {
      if (err) {
        console.error("Error fetching nonmember info:", err);
        return res.status(500).json({ error: "Database error" });
      }

      if (!nonmem) {
        return res.json([]);
      }

      const query = `
        SELECT 
          c.ClassID AS id,
          c.ClassName AS name,
          c.Description AS description,
          c.StartDate AS startDate,
          c.EndDate AS endDate,
          c.StartTime AS startTime,
          c.EndTime AS endTime,
          c.RoomNumber AS location,
          c.Status AS status,
          GROUP_CONCAT(d.DayOfWeek) AS days
        FROM Register r
        JOIN Class c ON r.ClassID = c.ClassID
        LEFT JOIN ClassDays d ON c.ClassID = d.ClassID
        WHERE r.NonMemID = ? AND c.Status != 'Inactive'
        GROUP BY c.ClassID
      `;
      db.all(query, [nonmem.NonMemID], (err, rows) => {
        if (err) {
          console.error("Error fetching nonmember registrations:", err);
          return res.status(500).json({ error: "Failed to fetch registrations" });
        }
        res.json(rows);
      });
    });
  });
});

// 9) Soft Delete a Class (Visible to Employees Only)
app.delete("/api/programs/:id", authenticateToken, (req, res) => {
  const classId = req.params.id;

  if (req.user.role !== "staff") {
    return res.status(403).json({ error: "Only staff can delete classes." });
  }

  db.serialize(() => {
    // Step 1: Get all Members and NonMembers registered for this class
    db.all(`
      SELECT r.MemID, r.NonMemID
      FROM Register r
      WHERE r.ClassID = ?`, [classId], (err, rows) => {
      if (err) {
        console.error("Failed to fetch registered users:", err.message);
        return res.status(500).json({ error: "Failed to gather user list." });
      }

      // Step 2: For each user, insert into Cancelled
      const insert = db.prepare(`
        INSERT INTO Cancelled (ClassID, MemID, NonMemID, DateCancelled, Notified)
        VALUES (?, ?, ?, CURRENT_DATE, 0)
      `);

      for (const row of rows) {
        insert.run(classId, row.MemID || null, row.NonMemID || null);
      }      

      insert.finalize();

      // Step 3: Delete from Register
      db.run("DELETE FROM Register WHERE ClassID = ?", [classId], (err2) => {
        if (err2) {
          console.error("Failed to remove from schedules:", err2.message);
          return res.status(500).json({ error: "Failed to remove class from all schedules" });
        }

        // Step 4: Mark class as inactive
        db.run("UPDATE Class SET Status = 'Inactive' WHERE ClassID = ?", [classId], function (err3) {
          if (err3) {
            console.error("Failed to deactivate class:", err3.message);
            return res.status(500).json({ error: "Failed to deactivate class" });
          }

          if (this.changes === 0) {
            return res.status(404).json({ error: "Class not found" });
          }

          res.json({ message: "Class deactivated and users notified." });
        });
      });
    });
  });
});

/* ----------------------------------------
    FAMILY ACCOUNT ROUTES
 ---------------------------------------- */
 
// Create a new family account
app.post("/api/family/create", authenticateToken, (req, res) => {
  const email = req.user.email;

  db.get("SELECT MemID FROM Member WHERE Email = ?", [email], (err, member) => {
    if (err || !member) {
      return res.status(500).json({ modal: true, error: "Member not found" });
    }

    const memID = member.MemID;
    const familyName = `${email.split("@")[0]}'s Family`;

    db.run("INSERT INTO FamilyAccount (FamilyName, OwnerMemID) VALUES (?, ?)", [familyName, memID], function (err) {
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

// Get family status for logged-in user and return all member info
app.get("/api/account/family-status", authenticateToken, (req, res) => {
  const email = req.user.email;

  db.get("SELECT MemID FROM Member WHERE Email = ?", [email], (err, member) => {
      if (err || !member) return res.status(404).json({ inFamily: false });

      const memID = member.MemID;

      const findFamilyQuery = `
          SELECT f.FamilyID, f.FamilyName, f.OwnerMemID
          FROM FamilyAccount f
          JOIN FamilyMember fm ON f.FamilyID = fm.FamilyID
          WHERE fm.MemID = ?
      `;

      db.get(findFamilyQuery, [memID], (err, family) => {
          if (err || !family) return res.json({ inFamily: false });

          const isOwner = family.OwnerMemID === memID;

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


// Add a user to family
app.post("/api/family/add", authenticateToken, (req, res) => {
  const ownerEmail = req.user.email;
  const { username } = req.body;

  if (!username) return res.status(400).json({ error: "Missing username" });

  db.get("SELECT MemID FROM Member WHERE Email = ?", [ownerEmail], (err, owner) => {
      if (err || !owner) return res.status(400).json({ error: "Owner not found" });

      db.get("SELECT FamilyID FROM FamilyAccount WHERE OwnerMemID = ?", [owner.MemID], (err, family) => {
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

// Remove a user from family (owner-only)
app.delete("/api/family/remove/:username", authenticateToken, (req, res) => {
  const ownerEmail = req.user.email;
  const targetEmail = req.params.username;

  db.get("SELECT MemID FROM Member WHERE Email = ?", [ownerEmail], (err, owner) => {
      if (err || !owner) return res.status(400).json({ error: "Owner not found" });

      db.get("SELECT FamilyID, OwnerMemID FROM FamilyAccount WHERE OwnerMemID = ?", [owner.MemID], (err, family) => {
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


// Delete the entire family (owner only)
app.delete("/api/family/delete/:id", authenticateToken, (req, res) => {
  const ownerEmail = req.user.email;
  const familyID = parseInt(req.params.id, 10);

  db.get("SELECT MemID FROM Member WHERE Email = ?", [ownerEmail], (err, owner) => {
    if (err || !owner) return res.status(400).json({ error: "Owner not found" });

    db.get("SELECT * FROM FamilyAccount WHERE FamilyID = ? AND OwnerMemID = ?", [familyID, owner.MemID], (err, fam) => {
      if (err || !fam) return res.status(403).json({ error: "Not authorized to delete this family" });

      // Step 1: Remove dependent class registrations
      const getDepsQuery = `SELECT DepID FROM Dependent WHERE FamilyID = ?`;
      db.all(getDepsQuery, [familyID], (err, dependents) => {
        if (err) return res.status(500).json({ error: "Failed to lookup dependents" });

        const depIds = dependents.map(dep => dep.DepID);
        if (depIds.length === 0) return proceedToDeleteFamily(); // Skip if no dependents

        const placeholders = depIds.map(() => '?').join(',');
        db.run(`DELETE FROM Register WHERE DepID IN (${placeholders})`, depIds, (err) => {
          if (err) return res.status(500).json({ error: "Failed to remove dependent registrations" });
          proceedToDeleteFamily(); // Continue if success
        });
      });

      function proceedToDeleteFamily() {
        // Step 2: Delete dependents
        db.run("DELETE FROM Dependent WHERE FamilyID = ?", [familyID], function(err) {
          if (err) return res.status(500).json({ error: "Failed to delete dependents" });

          // Step 3: Delete family members
          db.run("DELETE FROM FamilyMember WHERE FamilyID = ?", [familyID], function(err) {
            if (err) return res.status(500).json({ error: "Failed to delete family members" });

            // Step 4: Delete the account
            db.run("DELETE FROM FamilyAccount WHERE FamilyID = ?", [familyID], function(err) {
              if (err) return res.status(500).json({ error: "Failed to delete family account" });

              res.json({ message: "Family, members, dependents, and class registrations deleted successfully." });
            });
          });
        });
      }
    });
  });
});

// Add a dependent (non-user) to the family
app.post("/api/family/add-dependent", authenticateToken, (req, res) => {
  const email = req.user.email;
  const { fName, lName, mName, birthday } = req.body;

  if (!fName || !lName || !birthday) {
    return res.status(400).json({ error: "Missing required dependent fields." });
  }

  // Validate age
  const birthDate = new Date(birthday);
  const today = new Date();
  if (birthDate > today) {
    return res.status(400).json({ error: "Birthday cannot be in the future." });
  }
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  const dayDelta = today.getDate() - birthDate.getDate();
  const exactAge = monthDelta < 0 || (monthDelta === 0 && dayDelta < 0) ? age - 1 : age;
  if (exactAge > 18) {
    return res.status(400).json({ error: "Dependents must be 18 years old or younger." });
  }

  const query = `
    SELECT m.MemID, fa.FamilyID
    FROM Member m
    JOIN FamilyAccount fa ON fa.OwnerMemID = m.MemID
    WHERE m.Email = ?
  `;

  db.get(query, [email], (err, owner) => {
    if (err || !owner || !owner.FamilyID) {
      return res.status(403).json({ error: "Only family owner can add dependents." });
    }

    const insertQuery = `
      INSERT INTO Dependent (FName, LName, MName, Birthday, ParentMemID, FamilyID)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.run(insertQuery, [
      fName,
      lName,
      mName || null,
      birthday,
      owner.MemID,
      owner.FamilyID
    ], function (err) {
      if (err) {
        console.error("Dependent insert failed:", err);
        return res.status(500).json({ error: "Failed to add dependent." });
      }

      const depID = this.lastID;

      //  Add to FamilyMember table
      db.run("INSERT INTO FamilyMember (FamilyID, DepID) VALUES (?, ?)", [owner.FamilyID, depID], (err2) => {
        if (err2) {
          console.error("Failed to link dependent to FamilyMember:", err2);
          return res.status(500).json({ error: "Dependent added, but FamilyMember link failed." });
        }

        res.json({ message: "Dependent added successfully", depID });
      });
    });
  });
});

// Get dependents in the family
app.get("/api/family/dependents", authenticateToken, (req, res) => {
  const email = req.user.email;

    const sql = `
    SELECT m.MemID, fm.FamilyID
    FROM Member m
    JOIN FamilyMember fm ON m.MemID = fm.MemID
    WHERE m.Email = ?
  `;
  db.get(sql, [email], (err, member) => {
    if (err || !member || !member.FamilyID) {
      return res.status(400).json({ error: "Not in a family." });
    }

    db.all(`
      SELECT DepID, FName, LName, MName, Birthday
      FROM Dependent
      WHERE FamilyID = ?
     `, [member.FamilyID], (err, dependents) => {
      if (err) return res.status(500).json({ error: "Failed to fetch dependents." });
      res.json({ dependents });
    });
  });
});

// Remove a dependent (owner only)
app.delete("/api/family/remove-dependent/:id", authenticateToken, (req, res) => {
  const email = req.user.email;
  const depID = parseInt(req.params.id, 10);

  const query = `
    SELECT m.MemID, fa.FamilyID
    FROM Member m
    JOIN FamilyAccount fa ON fa.OwnerMemID = m.MemID
    WHERE m.Email = ?
  `;

  db.get(query, [email], (err, owner) => {
    if (err || !owner) return res.status(403).json({ error: "Unauthorized" });

    // Step 1: Remove from Register (if exists)
    db.run("DELETE FROM Register WHERE DepID = ?", [depID], function(err) {
      if (err) return res.status(500).json({ error: "Failed to remove registrations for dependent" });

      // Step 2: Remove from FamilyMember
      db.run("DELETE FROM FamilyMember WHERE FamilyID = ? AND DepID = ?", [owner.FamilyID, depID], function(err) {
        if (err) return res.status(500).json({ error: "Failed to remove dependent from family" });

        // Step 3: Remove from Dependent table
        db.run("DELETE FROM Dependent WHERE DepID = ? AND FamilyID = ?", [depID, owner.FamilyID], function(err) {
          if (err || this.changes === 0) {
            return res.status(500).json({ error: "Failed to fully delete dependent" });
          }

          res.json({ message: "Dependent fully removed" });
        });
      });
    });
  });
});

// Sign a dependent up for classes (owner only)
app.post("/api/family/dependent/register/:depId/:classId", authenticateToken, (req, res) => {
  const email = req.user.email;
  const depId = parseInt(req.params.depId, 10);
  const classId = parseInt(req.params.classId, 10);

  if (isNaN(depId) || isNaN(classId)) {
    return res.status(400).json({ error: "Invalid dependent or class ID." });
  }

  // Verify this user owns a family and is its owner
  const ownerQuery = `
    SELECT fa.FamilyID
    FROM Member m
    JOIN FamilyAccount fa ON fa.OwnerMemID = m.MemID
    WHERE m.Email = ?
  `;

  db.get(ownerQuery, [email], (err, owner) => {
    if (err || !owner) return res.status(403).json({ error: "Unauthorized to register dependent." });

    // Confirm dependent belongs to that family
    db.get("SELECT * FROM Dependent WHERE DepID = ? AND FamilyID = ?", [depId, owner.FamilyID], (err, dep) => {
      if (err || !dep) return res.status(404).json({ error: "Dependent not found in your family." });

      // Check for time conflicts
      const newClassQuery = `SELECT StartDate, EndDate, StartTime, EndTime FROM Class WHERE ClassID = ?`;
      db.get(newClassQuery, [classId], (err, newClass) => {
        if (err || !newClass) return res.status(404).json({ error: "Class not found." });

        const existingQuery = `
          SELECT c.StartDate, c.EndDate, c.StartTime, c.EndTime
          FROM Register r
          JOIN Class c ON r.ClassID = c.ClassID
          WHERE r.DepID = ?
        `;
        db.all(existingQuery, [depId], (err, registrations) => {
          if (err) return res.status(500).json({ error: "Error checking class schedule." });

          const isTimeConflict = registrations.some(reg => {
            const aStart = new Date(`${newClass.StartDate}T${newClass.StartTime}`);
            const aEnd = new Date(`${newClass.EndDate}T${newClass.EndTime}`);
            const bStart = new Date(`${reg.StartDate}T${reg.StartTime}`);
            const bEnd = new Date(`${reg.EndDate}T${reg.EndTime}`);
            return aStart < bEnd && bStart < aEnd;
          });

          if (isTimeConflict) {
            return res.status(400).json({ error: "Schedule conflict for dependent." });
          }

          // Register dependent
          const insert = `INSERT INTO Register (DepID, ClassID) VALUES (?, ?)`;
          db.run(insert, [depId, classId], function (err) {
            if (err) return res.status(500).json({ error: "Failed to register dependent." });

            db.run("UPDATE Class SET CurrCapacity = CurrCapacity + 1 WHERE ClassID = ?", [classId]);
            res.json({ message: "Dependent registered for class." });
          });
        });
      });
    });
  });
});

// Remove a dependent from a class
app.delete("/api/family/dependent/register/:depId/:classId", authenticateToken, (req, res) => {
  const email = req.user.email;
  const depId = parseInt(req.params.depId, 10);
  const classId = parseInt(req.params.classId, 10);

  const ownerQuery = `
    SELECT fa.FamilyID
    FROM Member m
    JOIN FamilyAccount fa ON fa.OwnerMemID = m.MemID
    WHERE m.Email = ?
  `;
  db.get(ownerQuery, [email], (err, owner) => {
    if (err || !owner) return res.status(403).json({ error: "Unauthorized" });

    db.get("SELECT * FROM Dependent WHERE DepID = ? AND FamilyID = ?", [depId, owner.FamilyID], (err, dep) => {
      if (err || !dep) return res.status(404).json({ error: "Dependent not found in your family." });

      const del = `DELETE FROM Register WHERE DepID = ? AND ClassID = ?`;
      db.run(del, [depId, classId], function (err) {
        if (err || this.changes === 0) return res.status(500).json({ error: "Could not remove registration." });

        db.run("UPDATE Class SET CurrCapacity = CurrCapacity - 1 WHERE ClassID = ?", [classId]);
        res.json({ message: "Dependent unregistered from class." });
      });
    });
  });
});

// Show dependent's registered classes
app.get("/api/family/dependent/classes/:depId", authenticateToken, (req, res) => {
  const depId = parseInt(req.params.depId, 10);
  const email = req.user.email;

  if (isNaN(depId)) return res.status(400).json({ error: "Invalid Dependent ID." });

  const ownerQuery = `
    SELECT fa.FamilyID
    FROM Member m
    JOIN FamilyAccount fa ON fa.OwnerMemID = m.MemID
    WHERE m.Email = ?
  `;

  db.get(ownerQuery, [email], (err, owner) => {
    if (err || !owner) return res.status(403).json({ error: "Unauthorized." });

    db.get("SELECT * FROM Dependent WHERE DepID = ? AND FamilyID = ?", [depId, owner.FamilyID], (err, dep) => {
      if (err || !dep) return res.status(404).json({ error: "Dependent not found in your family." });

      const query = `
        SELECT 
          c.ClassName, 
          c.StartDate, 
          c.EndDate, 
          c.StartTime, 
          c.EndTime,
          GROUP_CONCAT(cd.DayOfWeek, ', ') AS Days
        FROM Register r
        JOIN Class c ON r.ClassID = c.ClassID
        LEFT JOIN ClassDays cd ON c.ClassID = cd.ClassID
        WHERE r.DepID = ?
        GROUP BY c.ClassID
      `;

      db.all(query, [depId], (err, classes) => {
        if (err) return res.status(500).json({ error: "Failed to fetch registered classes." });
        res.json({ classes });
      });
    });
  });
});

/* ----------------------------------------
    Cancelled Class Notifications
 ---------------------------------------- */

// Show Cancelled Notifications (on login)
app.get("/api/cancelled", authenticateToken, (req, res) => {
  const email = req.user.email;

  db.get("SELECT MemID FROM Member WHERE Email = ?", [email], (err, member) => {
    if (err) return res.status(500).json({ error: "Database error" });

    if (member) {
      const sql = `
        SELECT c.ClassID, cls.ClassName AS Name
        FROM Cancelled c
        JOIN Class cls ON c.ClassID = cls.ClassID
        WHERE c.MemID = ? AND c.Notified = 0
      `;
      return db.all(sql, [member.MemID], (err, rows) => {
        if (err) return res.status(500).json({ error: "Failed to fetch cancellations." });
        return res.json(rows);
      });
    }

    db.get("SELECT NonMemID FROM NonMember WHERE Email = ?", [email], (err2, nonmem) => {
      if (err2 || !nonmem) return res.json([]);

      const sql = `
        SELECT c.ClassID, cls.ClassName AS Name
        FROM Cancelled c
        JOIN Class cls ON c.ClassID = cls.ClassID
        WHERE c.NonMemID = ? AND c.Notified = 0
      `;
      db.all(sql, [nonmem.NonMemID], (err3, rows) => {
        if (err3) return res.status(500).json({ error: "Failed to fetch cancellations." });
        return res.json(rows);
      });
    });
  });
});

// Dismiss Notifications
app.delete("/api/cancelled", authenticateToken, (req, res) => {
  const email = req.user.email;

  db.get("SELECT MemID FROM Member WHERE Email = ?", [email], (err, member) => {
    if (err) return res.status(500).json({ error: "Database error" });

    if (member) {
      return db.run(
        "UPDATE Cancelled SET Notified = 1 WHERE MemID = ? AND Notified = 0",
        [member.MemID],
        function (err2) {
          if (err2) return res.status(500).json({ error: "Failed to update notifications" });
          return res.json({ message: "Notifications dismissed." });
        }
      );
    }

    db.get("SELECT NonMemID FROM NonMember WHERE Email = ?", [email], (err2, nonmem) => {
      if (err2 || !nonmem) return res.status(404).json({ error: "User not found" });

      db.run(
        "UPDATE Cancelled SET Notified = 1 WHERE NonMemID = ? AND Notified = 0",
        [nonmem.NonMemID],
        function (err3) {
          if (err3) return res.status(500).json({ error: "Failed to update notifications" });
          return res.json({ message: "Notifications dismissed." });
        }
      );
    });
  });
});

/* ----------------------------------------
    Admin Registration Report by User
 ---------------------------------------- */
 app.get("/api/reports/registrations", authenticateToken, (req, res) => {
  if (req.user.role !== "staff") {
    return res.status(403).json({ error: "Access denied" });
  }

  const { from, to, email } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: "Missing date range" });
  }

  let sql = `
    SELECT 
      r.ClassID,
      c.ClassName,
      c.StartDate,
      c.EndDate,
      COALESCE(m.Email, n.Email) AS Email,
      COALESCE(m.FName || ' ' || m.LName, n.FName || ' ' || n.LName) AS FullName
    FROM Register r
    JOIN Class c ON r.ClassID = c.ClassID
    LEFT JOIN Member m ON r.MemID = m.MemID
    LEFT JOIN NonMember n ON r.NonMemID = n.NonMemID
    WHERE DATE(c.StartDate) >= DATE(?) AND DATE(c.EndDate) <= DATE(?)
  `;
  const params = [from, to];

  if (email) {
    sql += ` AND COALESCE(m.Email, n.Email) = ?`;
    params.push(email);
  }

  sql += ` ORDER BY c.StartDate, FullName`;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json(rows);
  });
});

/* ----------------------------------------
    Admin Registration Report by Class
 ---------------------------------------- */

 app.get("/api/classes/search", authenticateToken, (req, res) => {
  if (req.user.role !== "staff") return res.status(403).json({ error: "Access denied" });

  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "Missing class name" });

  db.all(`
    SELECT ClassID, ClassName, StartDate, EndDate
    FROM Class
    WHERE LOWER(ClassName) LIKE LOWER(?)
    ORDER BY StartDate DESC
  `, [`%${name}%`], (err, rows) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json(rows);
  });
});

app.get("/api/classes/:id/roster", authenticateToken, (req, res) => {
  if (req.user.role !== "staff") return res.status(403).json({ error: "Access denied" });

  const classId = req.params.id;

  db.all(`
    SELECT 
      COALESCE(m.FName || ' ' || m.LName, n.FName || ' ' || n.LName) AS FullName,
      COALESCE(m.Email, n.Email) AS Email
    FROM Register r
    LEFT JOIN Member m ON r.MemID = m.MemID
    LEFT JOIN NonMember n ON r.NonMemID = n.NonMemID
    WHERE r.ClassID = ?
    ORDER BY FullName
  `, [classId], (err, rows) => {
    if (err) return res.status(500).json({ error: "Failed to get roster" });
    res.json(rows);
  });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

/* ----------------------------------------
    Employment Timetable
 ---------------------------------------- */

app.get("/api/staff/teaching", authenticateToken, (req, res) => {
  const email = req.user.email;

  const sql = `
    SELECT 
      c.ClassID AS id,
      c.ClassName AS name,
      c.Description,
      c.StartDate,
      c.EndDate,
      c.StartTime,
      c.EndTime,
      c.RoomNumber AS location,
      GROUP_CONCAT(cd.DayOfWeek) AS days
    FROM Teach t
    JOIN Employee e ON t.EmpID = e.EmpID
    JOIN Member m ON e.MemID = m.MemID
    JOIN Class c ON c.ClassID = t.ClassID
    LEFT JOIN ClassDays cd ON cd.ClassID = c.ClassID
    WHERE m.Email = ?
    GROUP BY c.ClassID
  `;

  db.all(sql, [email], (err, rows) => {
    if (err) {
      console.error("❌ Failed to fetch teaching assignments:", err);
      return res.status(500).json({ error: "Could not load teaching schedule." });
    }
    res.json(rows);
  });
});

//Staff register to teach class
app.post("/api/staff/teaching/:id", authenticateToken, (req, res) => {
  if (req.user.role !== "staff") {
    return res.status(403).json({ error: "Access denied. Staff only." });
  }

  const classId = req.params.id;
  const staffEmail = req.user.email;

  const findEmpSql = `
    SELECT EmpID
    FROM Employee
    WHERE MemID = (SELECT MemID FROM Member WHERE Email = ?)
  `;

  db.get(findEmpSql, [staffEmail], (err, employee) => {
    if (err || !employee) {
      console.error("Error finding employee:", err);
      return res.status(500).json({ error: "Could not find matching staff account." });
    }

    const empId = employee.EmpID;

    const getClassDetails = `
      SELECT StartDate, EndDate, StartTime, EndTime
      FROM Class
      WHERE ClassID = ?
    `;
    db.get(getClassDetails, [classId], (err, newClass) => {
      if (err || !newClass) {
        return res.status(500).json({ error: "Class not found." });
      }

      const getCurrentAssignments = `
        SELECT c.StartDate, c.EndDate, c.StartTime, c.EndTime
        FROM Teach t
        JOIN Class c ON t.ClassID = c.ClassID
        WHERE t.EmpID = ?
      `;
      db.all(getCurrentAssignments, [empId], (err, assignedClasses) => {
        if (err) {
          console.error("Error checking conflicts:", err);
          return res.status(500).json({ error: "Conflict check failed." });
        }

        const newStart = new Date(`${newClass.StartDate}T${newClass.StartTime}`);
        const newEnd = new Date(`${newClass.EndDate}T${newClass.EndTime}`);

        const hasConflict = assignedClasses.some(cls => {
          const clsStart = new Date(`${cls.StartDate}T${cls.StartTime}`);
          const clsEnd = new Date(`${cls.EndDate}T${cls.EndTime}`);
          return newStart < clsEnd && clsStart < newEnd;
        });

        if (hasConflict) {
          return res.status(400).json({ error: "You already teach another class during this time." });
        }

        // Insert into Teach table
        const insertTeach = "INSERT INTO Teach (ClassID, EmpID) VALUES (?, ?)";
        db.run(insertTeach, [classId, empId], function (err) {
          if (err) {
            console.error("Teach insert failed:", err);
            return res.status(500).json({ error: "Assignment failed." });
          }

          res.json({ message: "Class assigned to you.", classId });
        });
      });
    });
  });
});

//Staff Deletes Teaching Assignment
app.delete("/api/staff/teaching/:id", authenticateToken, (req, res) => {
  if (req.user.role !== "staff") {
    return res.status(403).json({ error: "Only staff can unassign classes." });
  }
  const classId   = req.params.id;
  const userEmail = req.user.email;

  // Find this staff’s EmpID
  const findEmp = `
    SELECT EmpID FROM Employee
    WHERE MemID = (
      SELECT MemID FROM Member WHERE Email = ?
    )`;
  db.get(findEmp, [userEmail], (err, row) => {
    if (err || !row) {
      return res.status(500).json({ error: "Could not find staff account" });
    }
    const empId = row.EmpID;

    // Delete from Teach
    db.run(
      "DELETE FROM Teach WHERE ClassID = ? AND EmpID = ?",
      [classId, empId],
      function(err) {
        if (err) {
          console.error("Teach delete failed:", err);
          return res.status(500).json({ error: "Unassign failed." });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: "Assignment not found." });
        }
        res.json({ message: "Unassigned successfully." });
      }
    );
  });
});

