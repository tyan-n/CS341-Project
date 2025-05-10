# YMCA Registration Website

This project simulates a YMCA registration and class management system. Users can create accounts, browse and register for classes, manage family members, and view upcoming schedules. It is built with a Node.js backend and a frontend served over a static HTML/CSS/JavaScript interface.

## Features

- **Secure User Account System**  
  Users can create accounts with secure credentials, log in to manage personal or family registrations, and securely log out when finished.

- **Class Browsing and Registration with Capacity Enforcement**  
  Users can browse available classes, view detailed descriptions, and register for sessions. Full or canceled classes are clearly marked and cannot be joined. Upon login, users are notified if a class they were registered for has been canceled.

- **Family Account Support**  
  Family Owners can create a family group, add or remove dependents, and register them for classes under a shared account.

- **My Classes Dashboard**  
  Users can view, track, and cancel their upcoming class registrations through a centralized and easy-to-navigate dashboard.

- **Employee Tools**  
  Employees can:
  - Browse available classes
  - Sign up to teach sessions
  - View and manage their teaching schedules

- **Administrative Features**  
  Admins have elevated permissions to:
  - Run detailed reports on users and their registration history
  - Manage all user and staff accounts
  - Create and remove classes as needed
  - Deactivate user accounts when necessary

## Technologies Used

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express
- **Database:** SQLite (`YMCA_DB_cs341.db`)
- **Port:** Runs on `localhost:5000`

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/tyan-n/CS341-Project.git
   cd CS341-Project

2. Install BackEnd dependencies:
   ```bash
   cd BackEnd
   npm install

3. Start the server:
   ```bash
   node server.js

4. Open browser and visit:
   ```bash
   http://localhost:5000
