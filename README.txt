ElderNest Care Platform

Updated 24 May 2026

Local setup:
1. Install and start MySQL Server.
2. Copy `.env.example` to `.env`.
3. Set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, and SESSION_SECRET.
4. Run `npm install` in the project root.
5. Run `npm run check`.
6. Run `npm start`.
7. Open http://localhost:3000 in your browser.
8. Use the demo login on login.html:
   Email: admin@eldernest.com
   Password: password123

Health check:
- Visit http://localhost:3000/api/health.
- A healthy app returns JSON with `status: "ok"` and `database: "ok"`.

Production checklist:
- Set NODE_ENV=production.
- Set SESSION_SECRET to a unique random value of at least 32 characters.
- Use a dedicated MySQL user with only the permissions ElderNest needs.
- Use a strong DB_PASSWORD and never commit `.env`.
- Serve the app behind HTTPS so secure session cookies work correctly.
- Run `npm run check` before deployment.
- Rotate the demo admin password before real users access the system.

Windows shortcut:
- Double-click `start-eldernest.bat` to install missing dependencies and start both the backend and frontend.
- If PowerShell blocks `npm start`, run `node server.js` from the project root instead.

Included pages:
- index.html
- features.html
- about.html
- login.html
- admin-dashboard.html
- caregiver.html
- family.html
- resident.html

Notes:
- Login state is now managed by the backend session.
- Production mode refuses to start if required secrets are missing or placeholders are still in use.
- The backend exposes `/api/health` for deployment monitoring.
- API requests have rate limiting and unknown API routes return a JSON 404.
- Dashboard-style pages redirect to login if not signed in.
- All pages share the same navbar, footer, styles, and JavaScript.
- `server.js` serves the static frontend and provides `/api/login`, `/api/logout`, and `/api/session`.
- App data is stored in separate MySQL tables such as `app_users`, `app_residents`, `app_staff`, `app_family_members`, `app_alerts`, `app_incident_reports`, and `app_family_messages`.
- If an older database still has `app_data`, the backend migrates those records into the separate tables automatically on startup.
