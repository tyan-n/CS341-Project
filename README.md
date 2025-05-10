# YMCA Registration Website

This project simulates a YMCA registration and class management system. Users can create accounts, browse and register for classes, manage family members, and view upcoming schedules. It is built with a Node.js backend and a frontend served over a static HTML/CSS/JavaScript interface.

## Features

Secure User Account System
Users can create accounts with secure credentials, log in to manage personal or family registrations, and securely log out when finished.

Class Browsing and Registration with Capacity Enforcement
Users can browse available classes, view detailed descriptions, and register. Full or canceled classes are clearly marked and cannot be joined.
A user will be notified if a class they are registered for has been cancelled upon account login.

Family Account Support
The Family Owner can create a family group, add or remove dependents, and register them for classes from a single shared account view.

My Classes Dashboard
Users can view, track, and cancel their upcoming class registrations through a centralized dashboard.

Employee Tools
Employees can browse class offerings, sign up to teach classes, and view their teaching schedules

Administrative Features
Admins have elevated control, including:

Running detailed reports on users and their registrations

Managing all users and accounts

Creating new classes and removing existing ones

Deactivating user accounts as needed

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
