-- Create Employee table
CREATE TABLE IF NOT EXISTS Employee (
    EmpID        INTEGER PRIMARY KEY AUTOINCREMENT,
    MemID	 INTEGER,
    FName        TEXT NOT NULL,
    LName        TEXT NOT NULL,
    MName        TEXT,
    SSN          TEXT NOT NULL UNIQUE,
    PhoneNumber  TEXT NOT NULL UNIQUE CHECK (PhoneNumber GLOB '[0-9()-]*'), --only digits, dashes, and parenthesis
    Street 		 TEXT NOT NULL,
    HouseNumber  TEXT NOT NULL,
    City 		 TEXT NOT NULL,
    State 		 TEXT NOT NULL,
    ZipCode 	 TEXT NOT NULL,
    Birthday     DATE NOT NULL,
    Wage         REAL NOT NULL CHECK (Wage >= 0),
    Email        TEXT NOT NULL UNIQUE,
    StartDate    DATE NOT NULL DEFAULT CURRENT_DATE,
    Role         TEXT NOT NULL CHECK (Role IN ('Admin', 'Receptionist', 'Trainer', 'Janitor')),
    FOREIGN KEY (MemID) REFERENCES Member(MemID)
);

CREATE TABLE IF NOT EXISTS Member (
    MemID 		 INTEGER PRIMARY KEY AUTOINCREMENT,
    FName 		 TEXT NOT NULL,
    LName 		 TEXT NOT NULL,
    MName 		 TEXT,
    Birthday 	 DATE NOT NULL,
    Street 		 TEXT NOT NULL,
    HouseNumber  TEXT NOT NULL,
    City 		 TEXT NOT NULL,
    State 		 TEXT NOT NULL,
    ZipCode 	 TEXT NOT NULL,
    PhoneNumber  TEXT NOT NULL UNIQUE CHECK (PhoneNumber GLOB '[0-9()-]*'),
    Email 		 TEXT NOT NULL UNIQUE,
    Status    	 TEXT NOT NULL CHECK (Status IN ('Active', 'Inactive', 'Transferred')) DEFAULT 'Active', --all members start as active
    StatusDate   DATE NOT NULL DEFAULT CURRENT_DATE,
    Fee          REAL NOT NULL CHECK (Fee >= 0),
    AcctType     TEXT CHECK (AcctType IN ('Single', 'Family', 'Employee')) -- NULL allowed, to be changed
);

CREATE TABLE IF NOT EXISTS NonMember (
    NonMemID 		 INTEGER PRIMARY KEY AUTOINCREMENT,
    FName 		 TEXT NOT NULL,
    LName 		 TEXT NOT NULL,
    MName 		 TEXT,
    Birthday 	 DATE NOT NULL,
    Email 		 TEXT NOT NULL UNIQUE,
    PhoneNumber  TEXT NOT NULL CHECK (PhoneNumber GLOB '[0-9()-]*')
);

CREATE TABLE IF NOT EXISTS Room (
    RoomNumber   INTEGER PRIMARY KEY,
    RoomName 	 TEXT NOT NULL, -- ex: Gym 1, Large Pool, Basketball Court 1 etc
    MaxCapacity  INTEGER NOT NULL,
    Status 		 TEXT NOT NULL CHECK (Status IN ('Open', 'In Use', 'Closed')),
    RoomType 	 TEXT NOT NULL CHECK (RoomType IN ('Gym', 'Pool', 'Weight', 'Cardio', 'Studio', 'Spin', 'Multi-Purpose')) -- Room type
);

CREATE TABLE IF NOT EXISTS Class (
    ClassID       INTEGER PRIMARY KEY AUTOINCREMENT,
    EmpID         INTEGER NOT NULL,
    ClassName     TEXT NOT NULL,
    RoomNumber    INTEGER NOT NULL,
    StartDate     DATE NOT NULL,
    EndDate       DATE NOT NULL,
    StartTime     TIME NOT NULL,
    EndTime       TIME NOT NULL,
    Frequency     INTEGER NOT NULL CHECK (Frequency > 0), -- Number of occurrences
    Description   TEXT,
    CurrCapacity  INTEGER DEFAULT 0,
    MemPrice      REAL NOT NULL, -- set automatically based on ClassSpec
    NonMemPrice   REAL NOT NULL, -- set automatically
    ClassType     TEXT NOT NULL CHECK (ClassType IN ('Yoga', 'Fitness', 'Aquatics', 'Family', 'Sports')),
    AgeGroup      TEXT NOT NULL CHECK (AgeGroup IN ('Child', 'Teen', 'Adult', 'Senior', 'All ages')),
    Status        TEXT CHECK (Status IN ('Open Spots', 'Fully Booked')) DEFAULT 'Open Spots',
    FOREIGN KEY (EmpID) REFERENCES Employee(EmpID),
    FOREIGN KEY (RoomNumber) REFERENCES Room(RoomNumber)
);

CREATE TABLE IF NOT EXISTS Register ( --relationship between member/nonmember and class
    RegisterID    INTEGER PRIMARY KEY AUTOINCREMENT,
    ClassID       INTEGER NOT NULL,
    MemID         INTEGER,
    NonMemID      INTEGER,
    RegDate 	  DATE DEFAULT CURRENT_DATE,
    FOREIGN KEY (ClassID) REFERENCES Class(ClassID),
    FOREIGN KEY (MemID) REFERENCES Member(MemID),
    FOREIGN KEY (NonMemID) REFERENCES NonMember(NonMemID),
    CHECK (MemID IS NOT NULL AND NonMemID IS NULL OR MemID IS NULL AND NonMemID IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS HeldIn ( --relationship between class and room
    ClassID 	 INTEGER, 
    RoomNumber   INTEGER, 
    PRIMARY KEY (ClassID, RoomNumber),
    FOREIGN KEY (ClassID) REFERENCES Class(ClassID),
    FOREIGN KEY (RoomNumber) REFERENCES Room(RoomNumber)
);

CREATE TABLE IF NOT EXISTS Teach ( --relationship between employee and class
    ClassID 	 INTEGER, 
    EmpID 		 INTEGER, 
    PRIMARY KEY (ClassID, EmpID),
    FOREIGN KEY (ClassID) REFERENCES Class(ClassID),
    FOREIGN KEY (EmpID) REFERENCES Employee(EmpID)
);

CREATE TRIGGER update_capacity_after_reg
AFTER INSERT ON Register
FOR EACH ROW
BEGIN
    UPDATE Class --update CurrCapacity in class table after someone registers
    SET CurrCapacity = CurrCapacity + 1
    WHERE ClassID = NEW.ClassID;

	UPDATE Class --fully booked if CurrCapacity = MaxCapacity from room table
    SET Status = 'Fully Booked'
    WHERE ClassID = NEW.ClassID
    AND CurrCapacity + 1 > (SELECT MaxCapacity FROM Room
                                WHERE RoomNumber = (SELECT RoomNumber 
                                                     FROM HeldIn 
                                                     WHERE ClassID = NEW.ClassID));

    UPDATE Class --open spots if CurrCapacity less than MaxCapacity
    SET Status = 'Open Spots'
    WHERE ClassID = NEW.ClassID
    AND CurrCapacity + 1 <= (SELECT MaxCapacity FROM Room
                                 WHERE RoomNumber = (SELECT RoomNumber 
                                                      FROM HeldIn 
                                                      WHERE ClassID = NEW.ClassID));
END;
