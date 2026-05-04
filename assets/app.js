const USERS = [
  {
    email: 'admin@eldernest.com',
    password: 'password123',
    role: 'admin',
    name: 'Admin User',
    dashboard: 'admin-dashboard.html'
  },
  {
    email: 'caregiver@eldernest.com',
    password: 'care123',
    role: 'caregiver',
    name: 'Caregiver User',
    dashboard: 'caregiver.html'
  },
  {
    email: 'resident@eldernest.com',
    password: 'resident123',
    role: 'resident',
    name: 'Resident User',
    dashboard: 'resident.html'
  },
  {
    email: 'family@eldernest.com',
    password: 'family123',
    role: 'family',
    name: 'Family User',
    dashboard: 'family.html'
  }
];

function initCommon() {
  setActiveNav();
  initMobileMenu();
  initAuthLinks();
}

function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('[data-page]').forEach(link => {
    if (link.getAttribute('href') === page) {
      link.classList.add('active');
    }
  });
}

function initMobileMenu() {
  const toggle = document.getElementById('mobileToggle');
  const menu = document.getElementById('mobileMenu');

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      menu.classList.toggle('open');
    });
  }
}

function isLoggedIn() {
  return localStorage.getItem('eldernestLoggedIn') === 'true';
}

function getUserRole() {
  return localStorage.getItem('eldernestRole');
}

function getUserName() {
  return localStorage.getItem('eldernestUser');
}

function getUserDashboard() {
  return localStorage.getItem('eldernestDashboard');
}

function requireLogin() {
  if (!isLoggedIn()) {
    const currentPage = location.pathname.split('/').pop();
    window.location.href = 'login.html?redirect=' + encodeURIComponent(currentPage);
    return false;
  }
  return true;
}

function requireRole(allowedRoles = []) {
  if (!isLoggedIn()) {
    const currentPage = location.pathname.split('/').pop();
    window.location.href = 'login.html?redirect=' + encodeURIComponent(currentPage);
    return false;
  }

  const role = getUserRole();

  if (!allowedRoles.includes(role)) {
    alert('Access denied. You are not allowed to open this page.');
    redirectToDashboard();
    return false;
  }

  return true;
}

function login(email, password) {
  const user = USERS.find(u => u.email === email && u.password === password);

  if (user) {
    localStorage.setItem('eldernestLoggedIn', 'true');
    localStorage.setItem('eldernestUser', user.name);
    localStorage.setItem('eldernestRole', user.role);
    localStorage.setItem('eldernestDashboard', user.dashboard);
    return true;
  }

  return false;
}

function redirectToDashboard() {
  const dashboard = getUserDashboard() || 'index.html';
  window.location.href = dashboard;
}

function logout() {
  localStorage.removeItem('eldernestLoggedIn');
  localStorage.removeItem('eldernestUser');
  localStorage.removeItem('eldernestRole');
  localStorage.removeItem('eldernestDashboard');
  window.location.href = 'index.html';
}

function initAuthLinks() {
  document.querySelectorAll('[data-auth-state]').forEach(node => {
    if (isLoggedIn()) {
      const userName = getUserName() || 'User';
      const role = getUserRole() || '';

      node.innerHTML = `
        <span style="margin-right:10px;font-size:14px;">${userName} (${role})</span>
        <a href="#" class="btn btn-outline" data-logout>Logout</a>
      `;

      const logoutBtn = node.querySelector('[data-logout]');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
          e.preventDefault();
          logout();
        });
      }
    } else {
      node.innerHTML = `<a href="login.html" class="btn btn-outline">Login</a>`;
    }
  });
}

document.addEventListener('DOMContentLoaded', initCommon);

const residents = [
  { name: "John", room: "A-12", status: "Stable", medication: "Due in 15 mins", note: "Resident is stable and under regular monitoring." },
  { name: "Melinda", room: "B-05", status: "Observation", medication: "Missed 8:00 AM", note: "Needs medication follow-up from caregiver." },
  { name: "Michael", room: "C-03", status: "Critical", medication: "Completed", note: "Requires close monitoring due to abnormal heart rate." },
  { name: "Billy", room: "A-08", status: "Stable", medication: "Due at 1:00 PM", note: "Resident condition is normal today." }
];

let medications = [
  { resident: "John", medicine: "Vitamin D", time: "1:00 PM", status: "Pending" },
  { resident: "Melinda", medicine: "Blood Pressure Tablet", time: "8:00 AM", status: "Pending" },
  { resident: "Michael", medicine: "Heart Medicine", time: "10:00 AM", status: "Completed" },
  { resident: "Billy", medicine: "Calcium Tablet", time: "1:00 PM", status: "Pending" }
];

let alerts = [
  { resident: "John", issue: "Fall detected in Room A-12", level: "Critical" },
  { resident: "Melinda", issue: "Medication missed", level: "High" },
  { resident: "Michael", issue: "Abnormal heart rate", level: "Critical" }
];

function showSection(section) {
  const main = document.querySelector(".dashboard-content");

  if (section === "overview") {
    location.reload();
  }

  if (section === "residents") {
    main.innerHTML = `
      <div class="dashboard-top">
        <h2>Residents</h2>
        <p>View and manage resident information.</p>
      </div>

      <div class="table-card">
        <h3>Resident List</h3>
        <table>
          <thead>
            <tr>
              <th>Resident</th>
              <th>Room</th>
              <th>Health Status</th>
              <th>Medication</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${residents.map((r, i) => `
              <tr>
                <td>${r.name}</td>
                <td>${r.room}</td>
                <td><span class="badge ${r.status.toLowerCase()}">${r.status}</span></td>
                <td>${r.medication}</td>
                <td><button class="view-btn" onclick="viewResident(${i})">View</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  if (section === "medication") {
    main.innerHTML = `
      <div class="dashboard-top">
        <h2>Medication</h2>
        <p>Track and update resident medication status.</p>
      </div>

      <div class="table-card">
        <h3>Medication List</h3>
        <table>
          <thead>
            <tr>
              <th>Resident</th>
              <th>Medicine</th>
              <th>Time</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${medications.map((m, i) => `
              <tr>
                <td>${m.resident}</td>
                <td>${m.medicine}</td>
                <td>${m.time}</td>
                <td><span class="badge ${m.status === "Completed" ? "stable" : "high"}">${m.status}</span></td>
                <td>
                  <button class="view-btn" onclick="markTaken(${i})">Mark Taken</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  if (section === "alerts") {
    main.innerHTML = `
      <div class="dashboard-top">
        <h2>Alerts</h2>
        <p>View and resolve emergency alerts.</p>
      </div>

      <div class="table-card">
        <h3>Active Alerts</h3>
        ${alerts.map((a, i) => `
          <div class="alert-item">
            <strong>${a.resident}</strong>
            <p>${a.issue}</p>
            <span class="badge ${a.level === "Critical" ? "critical" : "high"}">${a.level}</span>
            <button class="review-btn" onclick="resolveAlert(${i})">Resolve</button>
          </div>
        `).join("")}
      </div>
    `;
  }

  if (section === "schedules") {
    main.innerHTML = `
      <div class="dashboard-top">
        <h2>Schedules</h2>
        <p>Daily care schedule for residents.</p>
      </div>

      <div class="table-card">
        <h3>Today’s Schedule</h3>
        <div class="alert-item"><strong>09:00 AM</strong><p>Morning health check</p></div>
        <div class="alert-item"><strong>11:00 AM</strong><p>Medication round</p></div>
        <div class="alert-item"><strong>02:00 PM</strong><p>Family visit</p></div>
        <div class="alert-item"><strong>05:00 PM</strong><p>Evening wellness report</p></div>
      </div>
    `;
  }

  if (section === "reports") {
    main.innerHTML = `
      <div class="dashboard-top">
        <h2>Reports</h2>
        <p>Summary of care activities and system records.</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><h4>Total Residents</h4><p>128</p></div>
        <div class="stat-card"><h4>Completed Medication</h4><p>74</p></div>
        <div class="stat-card"><h4>Active Alerts</h4><p>${alerts.length}</p></div>
        <div class="stat-card"><h4>Caregiver Notes</h4><p>36</p></div>
      </div>
    `;
  }
}

function viewResident(index) {
  const r = residents[index];

  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-bg" id="residentModal">
      <div class="modal-box">
        <h2>${r.name}</h2>
        <p><strong>Room:</strong> ${r.room}</p>
        <p><strong>Health Status:</strong> ${r.status}</p>
        <p><strong>Medication:</strong> ${r.medication}</p>
        <p><strong>Care Note:</strong> ${r.note}</p>
        <button class="view-btn" onclick="closeModal()">Close</button>
      </div>
    </div>
  `);
}

function closeModal() {
  document.getElementById("residentModal").remove();
}

function markTaken(index) {
  medications[index].status = "Completed";
  showSection("medication");
}

function resolveAlert(index) {
  alerts.splice(index, 1);
  showSection("alerts");
}