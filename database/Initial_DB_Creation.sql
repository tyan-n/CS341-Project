-- Create Employee table
CREATE TABLE IF NOT EXISTS Employee (
    EmpID        INTEGER PRIMARY KEY AUTOINCREMENT,
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
    Role         TEXT NOT NULL CHECK (Role IN ('Admin', 'Receptionist', 'Trainer', 'Janitor'))
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
    ClassID  	 INTEGER PRIMARY KEY AUTOINCREMENT,
    EmpID 		 INTEGER NOT NULL,
    ClassSpec 	 TEXT NOT NULL CHECK (ClassSpec IN ('Basic', 'Premium')),
    ClassName    TEXT NOT NULL,
    RoomNumber   INTEGER NOT NULL,
    Date DATE    NOT NULL,
    Time TIME    NOT NULL,
    Description  TEXT,
	CurrCapacity INTEGER DEFAULT 0,
    MemPrice     REAL NOT NULL, -- set automatically based on ClassSpec
    NonMemPrice  REAL NOT NULL, -- set automatically
    ClassType    TEXT NOT NULL CHECK (ClassType IN ('Yoga', 'Fitness', 'Aquatics', 'Family', 'Sports')),
    AgeGroup     TEXT NOT NULL CHECK (AgeGroup IN ('Child', 'Teen', 'Adult', 'Senior', 'All ages')),
	Status       TEXT CHECK (Status IN ('Open Spots', 'Fully Booked')) DEFAULT 'Open Spots',
    FOREIGN KEY (EmpID) REFERENCES Employee(EmpID),
    FOREIGN KEY (RoomNumber) REFERENCES Room(RoomNumber)
);

CREATE TABLE IF NOT EXISTS Payment (
    PaymentID    INTEGER PRIMARY KEY AUTOINCREMENT,
    MemID		 INTEGER,
	NonMemID 	 INTEGER,
    Amount 		 REAL NOT NULL,
    DueDate 	 DATE NOT NULL,
    PaymentType  TEXT CHECK (PaymentType IN ('Membership Fee', 'Class Fee', 'Late Fee')) NOT NULL,
    Status 		 TEXT CHECK (Status IN ('Paid', 'Owed', 'Past Due')) NOT NULL,
    FOREIGN KEY (MemID) REFERENCES Member(MemID),
    FOREIGN KEY (NonMemID) REFERENCES NonMember(NonMemID),
    CHECK (MemID IS NOT NULL AND NonMemID IS NULL OR MemID IS NULL AND NonMemID IS NOT NULL)--only one filled at a time
);

CREATE TABLE IF NOT EXISTS Login (
    LoginID     INTEGER PRIMARY KEY AUTOINCREMENT,
    MemID       INTEGER,                -- Foreign key to Member table
    Username    TEXT NOT NULL UNIQUE,   -- Username for login
    Password    TEXT NOT NULL,          -- Hashed password
    UserType    TEXT CHECK(UserType IN ('Member', 'Employee', 'Admin')) NOT NULL,  -- Role of user
    FOREIGN KEY (MemID) REFERENCES Member(MemID)
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

CREATE TABLE IF NOT EXISTS Pay ( --relationship between member/nonmember and payment
    PaymentID 	 INTEGER,
    MemID 		 INTEGER,
	NonMemID  	 INTEGER, 
    PaidOnDate   DATE NOT NULL,
    Amount 		 REAL NOT NULL,
    PRIMARY KEY (PaymentID, MemID),
    FOREIGN KEY (PaymentID) REFERENCES Payment(PaymentID),
    FOREIGN KEY (MemID) REFERENCES Member(MemID),
    FOREIGN KEY (NonMemID) REFERENCES NonMember(NonMemID),
    CHECK (MemID IS NOT NULL AND NonMemID IS NULL OR MemID IS NULL AND NonMemID IS NOT NULL)
);

CREATE TRIGGER SetClassPrices
AFTER INSERT ON Class
FOR EACH ROW
BEGIN
    UPDATE Class
    SET MemPrice = CASE
        WHEN NEW.ClassSpec = 'Basic' THEN 0
        WHEN NEW.ClassSpec = 'Premium' THEN 20
        ELSE MemPrice
    END,
    NonMemPrice = CASE
        WHEN NEW.ClassSpec = 'Basic' THEN 20
        WHEN NEW.ClassSpec = 'Premium' THEN 40
        ELSE NonMemPrice
    END
    WHERE ClassID = NEW.ClassID;
END;

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
    AND CurrentCapacity + 1 > (SELECT MaxCapacity FROM Room
                                WHERE RoomNumber = (SELECT RoomNumber 
                                                     FROM HeldIn 
                                                     WHERE ClassID = NEW.ClassID));

    UPDATE Class --open spots if CurrCapacity less than MaxCapacity
    SET Status = 'Open Spots'
    WHERE ClassID = NEW.ClassID
    AND CurrentCapacity + 1 <= (SELECT MaxCapacity FROM Room
                                 WHERE RoomNumber = (SELECT RoomNumber 
                                                      FROM HeldIn 
                                                      WHERE ClassID = NEW.ClassID));
END;
