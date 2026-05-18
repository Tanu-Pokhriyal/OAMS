# Billboard Management System — Windows Installation Guide

A step-by-step guide to install and run the Billboard Management System on a Windows machine.

---

## Prerequisites

You need to install the following software before running the application:

### 1. Node.js (v18 or later)

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** version (Windows Installer `.msi`)
3. Run the installer — accept defaults, ensure **"Add to PATH"** is checked
4. Verify installation — open **Command Prompt** (or **PowerShell**) and run:
   ```
   node --version
   npm --version
   ```
   You should see version numbers (e.g., `v20.x.x` and `10.x.x`).

### 2. MongoDB Community Edition

1. Go to [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
2. Select **Windows**, download the `.msi` installer
3. Run the installer:
   - Choose **"Complete"** setup type
   - **Check** "Install MongoDB as a Service" (this runs MongoDB automatically on startup)
   - Optionally install **MongoDB Compass** (GUI tool)
4. Verify installation — open Command Prompt and run:
   ```
   mongosh
   ```
   If it connects successfully, MongoDB is running. Type `exit` to close.

> **Alternative**: If you prefer not to install MongoDB locally, you can use [MongoDB Atlas](https://www.mongodb.com/atlas) (free cloud tier). Create a cluster and use the connection string in the backend `.env` file.

---

## Setup Instructions

### Step 1: Extract the Project

Extract the downloaded zip file to a folder of your choice, for example:
```
C:\Projects\billboard-management-system
```

### Step 2: Configure Environment Variables

#### Backend (Optional)

The application works out of the box with default settings (localhost MongoDB on port 5001). If you need to customize, create a `.env` file:

1. Navigate to the `backend` folder
2. Copy the example environment file:
   ```
   copy backend\.env.example backend\.env
   ```
3. Open `backend\.env` in a text editor (Notepad, VS Code, etc.)
4. Edit the values if needed:
   ```
   PORT=5001
   MONGODB_URI=mongodb://localhost:27017/billboard_management
   JWT_SECRET=your_secret_key_here
   ```
   - **PORT**: The port the backend server runs on (default: 5001)
   - **MONGODB_URI**: Your MongoDB connection string (default: `mongodb://localhost:27017/billboard_management`)
   - **JWT_SECRET**: Any random string for authentication tokens

> **Note**: If you skip this step, the app will use sensible defaults and connect to MongoDB on localhost.

#### Frontend

The frontend does not require any environment configuration. It works out of the box.

### Step 3: Install Dependencies

Open **Command Prompt** or **PowerShell** and run:

```
cd C:\Projects\billboard-management-system

cd backend
npm install

cd ..\frontend
npm install
```

This will download all required packages for both backend and frontend.

### Step 4: Seed the Database (Create Demo Users)

From the project root:
```
cd backend
node src/utils/seed.js
```

This creates three demo user accounts:

| Role   | Email                | Password   |
|--------|----------------------|------------|
| Admin  | admin@billboard.com  | admin123   |
| Client | client@billboard.com | client123  |
| Vendor | vendor@billboard.com | vendor123  |

### Step 5: Start the Application

You need **two separate terminal windows** — one for the backend and one for the frontend.

**Terminal 1 — Backend:**
```
cd C:\Projects\billboard-management-system\backend
node src/app.js
```
You should see:
```
MongoDB connected
Server running on port 5001
```

**Terminal 2 — Frontend:**
```
cd C:\Projects\billboard-management-system\frontend
npm run dev
```
You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
```

### Step 6: Open the Application

Open your browser and go to:
```
http://localhost:3000
```

Log in with any of the demo credentials from Step 4.

---

## Application Workflow

The billboard management system follows this workflow:

1. **Client** creates a campaign (title, brief, budget, dates)
2. **Admin** allocates a vendor to the campaign
3. **Vendor** conducts a site survey (uploads location photos with map pins)
4. **Admin** reviews and selects survey images
5. **Vendor** uploads creative designs for selected locations
6. **Admin** processes creatives and creates a work order
7. **Vendor** uploads installation photos
8. **Admin** sends the installation report to the client
9. **Client** verifies the installation (accept / reject / rework)
10. **Vendor** submits an invoice
11. **Admin** and **Client** review/approve the invoice
12. **Admin** closes the work order

Each step generates PDF reports that accumulate details from all previous steps.

---

## User Roles

| Role     | Capabilities                                                      |
|----------|-------------------------------------------------------------------|
| **Admin**  | Allocate vendors, review surveys, manage creatives, issue work orders, send reports, close campaigns |
| **Client** | Create campaigns, verify installations, review invoices          |
| **Vendor** | Conduct site surveys, upload creatives, upload installations, submit invoices |

---

## Troubleshooting

### "MongoDB connection failed"
- Ensure MongoDB is running. Open Command Prompt and type `mongosh` to test.
- If using MongoDB as a Windows service, check it's started: open **Services** (Win + R → `services.msc`) → find "MongoDB Server" → ensure it says "Running".

### "Port 5001 already in use"
- Another process is using port 5001. Either stop that process or change the `PORT` in `backend\.env`.

### "Port 3000 already in use"
- Another process is using port 3000. Stop it, or change the port in `frontend/vite.config.js`.

### "npm install fails"
- Ensure Node.js is installed correctly: `node --version`
- Try deleting `node_modules` and `package-lock.json`, then run `npm install` again.

### Maps not loading
- The application uses OpenStreetMap (free, no API key required). Ensure your machine has internet access.

---

## Technology Stack

| Component  | Technology                          |
|------------|-------------------------------------|
| Frontend   | React 18, Vite, React Router, Leaflet (Maps) |
| Backend    | Node.js, Express 5, Socket.IO      |
| Database   | MongoDB with Mongoose ODM           |
| Auth       | JWT + bcrypt                        |
| PDF Reports| PDFKit                              |
| Real-time  | Socket.IO (in-app notifications)    |
| File Upload| Multer                              |

//"C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath="C:\data\db"
 