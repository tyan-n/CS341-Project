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
  const {
    username, password, membershipType, fname, lname, mname,
    birthday, street, houseNumber, city, state, zipCode, phone, fee
  } = req.body;
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

        db.run("UPDATE Class SET CurrCapacity = CurrCapacity + 1 WHERE ClassID = ?",
          [registrationClassId],
          function (err) {
            if (err) {
              console.error("Error updating CurrCapacity:", err);
              return res.status(500).json({ error: "Registration saved, but failed to update capacity." });
            }
        res.json({ message: "Unregistered successfully!" });
          });
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

          db.run("UPDATE Class SET CurrCapacity = CurrCapacity + 1 WHERE ClassID = ?",
            [registrationClassId],
            function (err) {
              if (err) {
                console.error("Error updating CurrCapacity:", err);
                return res.status(500).json({ error: "Registration saved, but failed to update capacity." });
              }
            res.json({ message: "Unregistered successfully!" });
            });
        });
      });
    }
  });
});

/* ----------------------------------------
   Register for a Program (Authenticated)
---------------------------------------- */
function isTimeConflict(newClass, existingClass) {
  const newEndDate = newClass.EndDate || newClass.StartDate;
  const existEndDate = existingClass.EndDate || existingClass.StartDate;
  const newStart = new Date(`${newClass.StartDate}T${newClass.StartTime}`);
  const newEnd = new Date(`${newEndDate}T${newClass.EndTime}`);
  const existStart = new Date(`${existingClass.StartDate}T${existingClass.StartTime}`);
  const existEnd = new Date(`${existEndDate}T${existingClass.EndTime}`);
  return newStart < existEnd && existStart < newEnd && newStart.getDay() === existStart.getDay();
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

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
