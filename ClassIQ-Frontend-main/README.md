# ClassIQ — React/Vite + PHP REST API

A full-stack smart attendance system with GPS verification, QR codes, device fingerprinting, and admin dashboard.

---

## Project Structure

```
classiq/
├── src/                        # React/Vite frontend
│   ├── components/
│   │   ├── ui/                 # Reusable UI components + styles
│   │   └── layout/             # Sidebar layouts (classrep + admin)
│   ├── context/
│   │   └── AuthContext.jsx     # Global auth state
│   ├── lib/
│   │   └── api.js              # Axios client + all API calls
│   └── pages/
│       ├── classrep/           # Login, Register, Dashboard, QR, Attendance, Report
│       ├── admin/              # Admin dashboard + all admin pages
│       └── student/            # Mark Attendance, Student Register
├── api/                        # PHP REST API (upload to your host)
│   ├── bootstrap.php           # DB, CORS, helpers
│   ├── db.php                  # DB credentials
│   ├── migration.sql           # Run once on your DB
│   ├── auth/                   # login, register, logout, admin_login
│   ├── classrep/               # dashboard, students, generate_qr, attendance...
│   ├── student/                # mark_attendance, verify_session, register
│   └── admin/                  # dashboard, classreps, students, issues...
├── .env.example                # Environment variable template
├── netlify.toml                # Netlify SPA config
└── vite.config.js
```

---

## Quick Setup

### Step 1 — Database Migration
Run `api/migration.sql` on your existing MySQL database:
```sql
-- In phpMyAdmin or MySQL CLI:
source /path/to/migration.sql
```
This adds `session_token` to `users`, creates the `admins` table, and normalises status values. **Your existing data is preserved.**

### Step 2 — PHP API Setup
1. Upload the entire `api/` folder to your web host (e.g. `public_html/api/`)
2. Edit `api/db.php` with your database credentials
3. Edit `api/bootstrap.php` — add your Netlify URL to `$allowed_origins`
4. Edit `api/classrep/generate_qr.php` — set `FRONTEND_URL` to your Netlify URL

### Step 3 — Frontend Setup
```bash
# Clone/copy project
cd classiq

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env and set:
# VITE_API_URL=https://your-php-host.com/api

# Run locally
npm run dev

# Build for production
npm run build
```

### Step 4 — Deploy to Netlify
1. Push to GitHub
2. Connect repo to Netlify
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variable: `VITE_API_URL=https://your-host.com/api`

---

## Default Admin Login
- **Email:** `admin@classiq.app`
- **Password:** `password` ← **Change this immediately!**

To change the admin password, run:
```sql
UPDATE admins SET password = '$2y$10$...' WHERE email = 'admin@classiq.app';
```
Generate hash with PHP: `echo password_hash('YourNewPassword', PASSWORD_DEFAULT);`

---

## Environment Variables

| Variable        | Description                          | Example                              |
|-----------------|--------------------------------------|--------------------------------------|
| `VITE_API_URL`  | Your PHP API base URL                | `https://classiq.free.nf/api`        |

In `api/bootstrap.php`, also update:
```php
$allowed_origins = [
    'https://your-app.netlify.app',  // your Netlify URL
    'http://localhost:5173',          // local dev
];
```

In `api/classrep/generate_qr.php`:
```php
$frontend_base = 'https://your-app.netlify.app';
```

---

## Features

### Classrep
- ✅ Register & login
- ✅ Dashboard with 7-day attendance chart
- ✅ Generate QR with interactive map (pin classroom location)
- ✅ Adjustable allowed radius (10m–200m)
- ✅ View & manage attendance history
- ✅ Add students manually
- ✅ Remove flagged/outside students
- ✅ Report issues to admin

### Student (no login required)
- ✅ Scan QR → GPS verified → mark attendance
- ✅ Blocked if outside allowed radius
- ✅ Flagged if same device used by multiple students
- ✅ Self-registration via classrep link

### Admin
- ✅ System-wide dashboard with stats & charts
- ✅ View all classreps, students, QR sessions
- ✅ Daily attendance overview
- ✅ View & resolve reported issues
- ✅ View error logs
- ✅ Send email messages to classreps

---

## Status Logic

| Situation                        | Status    |
|----------------------------------|-----------|
| Inside radius, unique device     | ✅ Present |
| Inside radius, shared device     | ⚠️ Flagged (both students) |
| Outside radius                   | ❌ Blocked (not recorded) |
| Manually added by classrep       | ✅ Present |

---

## Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Frontend  | React 18, Vite, React Router v6   |
| Styling   | Custom CSS with design tokens     |
| Charts    | Recharts                          |
| Maps      | Leaflet + React-Leaflet           |
| QR        | qrcode npm package                |
| HTTP      | Axios                             |
| Backend   | PHP 8+ REST API                   |
| Database  | MySQL (existing)                  |
| Deploy    | Netlify (frontend) + your host    |
