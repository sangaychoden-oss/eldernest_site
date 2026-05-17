ElderNest Ready-Made Website

update 05 May 2026

How to run:
1. Run `npm install` in the project root.
2. Run `npm start`.
3. Open http://localhost:3000 in your browser.
4. Use the demo login on login.html:
   Email: admin@eldernest.com
   Password: password123

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
- Dashboard-style pages redirect to login if not signed in.
- All pages share the same navbar, footer, styles, and JavaScript.
- `server.js` serves the static frontend and provides `/api/login`, `/api/logout`, and `/api/session`.
