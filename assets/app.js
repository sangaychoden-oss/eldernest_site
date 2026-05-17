let sessionData = null;
let caregiverAlerts = [];
let caregiverResidents = [];
let adminDashboardData = null;

async function initCommon() {
  setActiveNav();
  initMobileMenu();
  await initAuthLinks();
  initInteractiveFeatures();
}

function initInteractiveFeatures() {
  // Add keyboard navigation for accessibility
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modals = document.querySelectorAll('.modal-bg');
      modals.forEach(modal => modal.remove());
    }
  });

  // Back to top button
  const backToTopBtn = document.getElementById('backToTop');
  if (backToTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.pageYOffset > 300) {
        backToTopBtn.style.display = 'flex';
      } else {
        backToTopBtn.style.display = 'none';
      }
    });

    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
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

async function fetchSession() {
  try {
    const response = await fetch('/api/session', {
      credentials: 'same-origin'
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch session:', error);
    return { loggedIn: false };
  }
}

async function fetchDashboardData() {
  try {
    const response = await fetch('/api/dashboard-data', {
      credentials: 'same-origin'
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
    return null;
  }
}

function renderAdminDashboard(data) {
  adminDashboardData = data;
  document.getElementById('totalResidents').textContent = data.stats.totalResidents;
  document.getElementById('activeCaregivers').textContent = data.stats.activeCaregivers;
  document.getElementById('medicationDue').textContent = data.stats.medicationDue;
  document.getElementById('criticalAlerts').textContent = data.stats.criticalAlerts;

  document.getElementById('completedDoses').textContent = 74;
  document.getElementById('pendingDoses').textContent = 19;
  document.getElementById('missedDoses').textContent = 6;

  const alertsContainer = document.getElementById('recentAlerts');
  alertsContainer.innerHTML = data.alerts.map(alert => `
    <div class="alert-item">
      <div><strong>${alert.resident}</strong><br><span class="note">${alert.issue}</span></div>
      <span class="status ${alert.level.toLowerCase()}">${alert.level}</span>
    </div>
  `).join('');

  const residentTable = document.getElementById('residentStatusTable');
  residentTable.innerHTML = data.residents.map(resident => `
    <tr>
      <td><strong>${resident.name}</strong></td>
      <td>${resident.room}</td>
      <td><span class="status ${statusClass(resident.status)}">${resident.status}</span></td>
      <td>${resident.medication}</td>
      <td><a class="btn btn-outline" href="residents.html?resident=${resident.id}">View</a></td>
    </tr>
  `).join('');

  setupAdminSearch(data);
}

function setupAdminSearch(data) {
  const searchBox = document.querySelector('.search-box');
  if (!searchBox) return;

  let resultsBox = document.getElementById('adminSearchResults');
  if (!resultsBox) {
    resultsBox = document.createElement('div');
    resultsBox.id = 'adminSearchResults';
    resultsBox.className = 'admin-search-results';
    searchBox.insertAdjacentElement('afterend', resultsBox);
  }

  const renderResults = () => {
    const term = searchBox.value.trim().toLowerCase();
    if (!term) {
      resultsBox.innerHTML = '';
      resultsBox.classList.remove('open');
      return;
    }

    const residentMatches = data.residents
      .filter(resident =>
        resident.name.toLowerCase().includes(term) ||
        resident.room.toLowerCase().includes(term) ||
        resident.status.toLowerCase().includes(term)
      )
      .map(resident => ({
        label: resident.name,
        detail: `Room ${resident.room} - ${resident.status}`,
        url: `residents.html?resident=${resident.id}`
      }));

    const alertMatches = data.alerts
      .filter(alert =>
        alert.resident.toLowerCase().includes(term) ||
        alert.issue.toLowerCase().includes(term) ||
        alert.level.toLowerCase().includes(term)
      )
      .map(alert => ({
        label: `${alert.resident} alert`,
        detail: `${alert.issue} - ${alert.level}`,
        url: `residents.html?resident=${(data.residents.find(resident => resident.name === alert.resident) || {}).id || ''}`
      }));

    const matches = [...residentMatches, ...alertMatches].slice(0, 6);
    resultsBox.innerHTML = matches.length ? matches.map(match => `
      <a href="${match.url}">
        <strong>${escapeHtml(match.label)}</strong>
        <span>${escapeHtml(match.detail)}</span>
      </a>
    `).join('') : '<p class="note">No resident or alert found.</p>';
    resultsBox.classList.add('open');
  };

  searchBox.addEventListener('input', renderResults);
  searchBox.addEventListener('focus', renderResults);
}

function renderCaregiverDashboard(data) {
  const cards = document.getElementById('caregiverStats');
  cards.innerHTML = data.caregiverAssignments.map(item => `
    <div class="card">
      <strong>${item.name}</strong>
      <p class="note">Room ${item.room}<br>Medication: ${item.medication}</p>
      <span class="status ${statusClass(item.status)}">${item.status}</span>
      <button class="view-btn" onclick="viewResidentDetails(${data.caregiverAssignments.indexOf(item)})" style="margin-top:10px;width:100%;">View Details</button>
    </div>
  `).join('');
}

function renderCaregiverResidentWorkspace(data, selectedResidentId) {
  const content = document.querySelector('.dashboard-content');
  if (!content) return;

  const residentsList = data.caregiverAssignments || [];
  const selectedResident = residentsList.find(resident => resident.id === selectedResidentId) || residentsList[0];

  content.innerHTML = `
    <div class="card panel-top">
      <div>
        <h1 style="margin:0">Assigned Residents</h1>
        <p class="note">Search your assigned residents, choose one, then complete care tasks from the same workspace.</p>
      </div>
      <input class="search-box" id="caregiverResidentSearch" placeholder="Search assigned resident">
    </div>

    <div class="residents-page-grid">
      <div class="card">
        <h2>Resident List</h2>
        <div class="resident-list" id="caregiverResidentList"></div>
      </div>
      <div id="caregiverResidentWorkspace"></div>
    </div>
  `;

  renderCaregiverResidentList(data, residentsList, selectedResident && selectedResident.id);
  if (selectedResident) {
    renderCaregiverResidentActions(data, selectedResident.id, 'notes');
  }

  document.getElementById('caregiverResidentSearch').addEventListener('input', event => {
    const term = event.target.value.trim().toLowerCase();
    const filtered = residentsList.filter(resident =>
      resident.name.toLowerCase().includes(term) ||
      resident.room.toLowerCase().includes(term) ||
      resident.status.toLowerCase().includes(term)
    );
    renderCaregiverResidentList(data, filtered, selectedResident && selectedResident.id);
  });
}

function renderCaregiverResidentList(data, residentsList, selectedResidentId) {
  const list = document.getElementById('caregiverResidentList');
  if (!list) return;

  list.innerHTML = residentsList.map(resident => `
    <button class="resident-list-item ${resident.id === selectedResidentId ? 'active' : ''}" type="button" data-care-resident="${resident.id}">
      <span>
        <strong>${escapeHtml(resident.name)}</strong>
        <small>Room ${escapeHtml(resident.room)}</small>
      </span>
      <span class="status ${statusClass(resident.status)}">${escapeHtml(resident.status)}</span>
    </button>
  `).join('') || '<p class="note">No assigned residents found.</p>';

  list.querySelectorAll('[data-care-resident]').forEach(button => {
    button.addEventListener('click', () => {
      renderCaregiverResidentActions(data, Number(button.dataset.careResident), 'notes');
      renderCaregiverResidentList(data, data.caregiverAssignments, Number(button.dataset.careResident));
    });
  });
}

function caregiverActionTabs(residentId, activeTab) {
  const tabs = [
    ['notes', 'Notes'],
    ['medication', 'Medication'],
    ['adl', 'ADL Chart'],
    ['incident', 'Incident'],
    ['alerts', 'Alerts']
  ];

  return `
    <div class="action-tabs">
      ${tabs.map(([id, label]) => `<button class="${activeTab === id ? 'active' : ''}" type="button" data-care-action="${id}" data-resident-id="${residentId}">${label}</button>`).join('')}
    </div>
  `;
}

function renderCaregiverResidentActions(data, residentId, activeTab) {
  const workspace = document.getElementById('caregiverResidentWorkspace');
  const resident = data.caregiverAssignments.find(item => item.id === residentId);
  if (!workspace || !resident) return;

  workspace.innerHTML = `
    <div class="card panel-top">
      <div>
        <h1 style="margin:0">${escapeHtml(resident.name)}</h1>
        <p class="note">Room ${escapeHtml(resident.room)} - ${escapeHtml(resident.status)}</p>
      </div>
      <button class="btn btn-outline" type="button" data-care-action="details" data-resident-id="${resident.id}">View Details</button>
    </div>
    <div class="card">
      ${caregiverActionTabs(resident.id, activeTab)}
      <div id="caregiverActionPanel" style="margin-top:20px;"></div>
    </div>
  `;

  workspace.querySelectorAll('[data-care-action]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.careAction;
      if (action === 'details') {
        viewResidentDetails(data.caregiverAssignments.findIndex(item => item.id === resident.id));
        return;
      }
      renderCaregiverResidentActions(data, resident.id, action);
    });
  });

  renderCaregiverActionPanel(data, resident, activeTab);
}

function renderCaregiverActionPanel(data, resident, activeTab) {
  const panel = document.getElementById('caregiverActionPanel');
  if (!panel) return;

  if (activeTab === 'notes') {
    panel.innerHTML = `
      <form id="careNoteForm">
        <h2>Daily Note</h2>
        <input id="noteResident" type="hidden" value="${resident.id}">
        <div class="form-group"><label for="noteCategory">Category</label><select id="noteCategory"><option>Daily Note</option><option>Medication Note</option><option>Family Update</option><option>Care Concern</option></select></div>
        <div class="form-group"><label for="noteText">Observation</label><textarea id="noteText" required></textarea></div>
        <button type="submit" class="btn">Save Note</button>
      </form>
    `;
    document.getElementById('careNoteForm').addEventListener('submit', event => submitCareNote(event, data));
    return;
  }

  if (activeTab === 'medication') {
    panel.innerHTML = `
      <h2>Medication</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Medication</th><th>Dosage</th><th>Time</th><th>Status</th><th>Update</th></tr></thead>
          <tbody>
            ${(resident.medications || []).map((medication, index) => `
              <tr>
                <td><strong>${escapeHtml(medication.name)}</strong></td>
                <td>${escapeHtml(medication.dosage)}</td>
                <td>${escapeHtml(medication.time)}</td>
                <td><span class="status ${statusClass(medication.status)}">${escapeHtml(medication.status)}</span></td>
                <td>
                  <select data-med-status="${index}">
                    <option value="Scheduled" ${medication.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option>
                    <option value="Pending" ${medication.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Completed" ${medication.status === 'Completed' ? 'selected' : ''}>Given</option>
                    <option value="Missed" ${medication.status === 'Missed' ? 'selected' : ''}>Missed</option>
                  </select>
                  <input data-med-note="${index}" placeholder="Optional note" style="margin-top:8px;">
                  <button class="view-btn" type="button" data-med-save="${index}" style="margin-top:8px;width:100%;">Save</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    panel.querySelectorAll('[data-med-save]').forEach(button => {
      button.addEventListener('click', () => updateCaregiverMedication(data, resident.id, Number(button.dataset.medSave), 'workspace'));
    });
    return;
  }

  if (activeTab === 'adl') {
    panel.innerHTML = `
      <form id="adlChartForm">
        <h2>ADL Chart</h2>
        <input id="adlResident" type="hidden" value="${resident.id}">
        <div class="grid grid-2">
          ${['Mobility', 'Bathing', 'Dressing', 'Eating', 'Toileting'].map(label => `<div class="form-group"><label for="adl${label}">${label}</label><select id="adl${label}"><option>Independent</option><option>Needs Prompting</option><option>Assisted</option><option>Dependent</option></select></div>`).join('')}
        </div>
        <div class="form-group"><label for="adlNotes">Notes</label><textarea id="adlNotes"></textarea></div>
        <button class="btn" type="submit">Submit ADL Chart</button>
      </form>
    `;
    document.getElementById('adlChartForm').addEventListener('submit', event => submitAdlChart(event, data));
    return;
  }

  if (activeTab === 'incident') {
    panel.innerHTML = `
      <form id="incidentForm">
        <h2>Incident Report</h2>
        <input id="incidentResident" type="hidden" value="${resident.id}">
        <div class="form-group"><label for="incidentType">Incident Type</label><input id="incidentType" required></div>
        <div class="form-group"><label for="incidentSeverity">Severity</label><select id="incidentSeverity"><option>Observation</option><option>High</option><option>Critical</option></select></div>
        <div class="form-group"><label for="incidentDescription">Description</label><textarea id="incidentDescription" required></textarea></div>
        <div class="form-group"><label for="incidentAction">Action Taken</label><textarea id="incidentAction"></textarea></div>
        <button class="btn" type="submit">Submit Incident</button>
      </form>
    `;
    document.getElementById('incidentForm').addEventListener('submit', event => submitIncidentReport(event, data));
    return;
  }

  if (activeTab === 'alerts') {
    const residentAlerts = getResidentAlerts(resident, { alerts: caregiverAlerts });
    panel.innerHTML = `
      <h2>Alerts</h2>
      <div class="space-y">
        ${residentAlerts.map(alert => `<div class="alert-item"><div><strong>${escapeHtml(alert.type || 'Care Alert')}</strong><br><span class="note">${escapeHtml(alert.message || alert.issue)}</span><br><small>${escapeHtml(alert.time || 'Today')}</small></div><span class="status ${statusClass(alert.level)}">${escapeHtml(alert.level)}</span></div>`).join('') || '<p class="note">No alerts for this resident.</p>'}
      </div>
    `;
  }
}

function renderFamilyDashboard(data) {
  const updates = document.getElementById('familyNotifications');
  updates.innerHTML = data.familyUpdates.map(item => `
    <div class="alert-item"><div><strong>${item.resident}</strong><br><span class="note">${item.note}</span></div><span class="status ${item.status.toLowerCase()}">${item.status}</span></div>
  `).join('');
}

function renderResidentDashboard(data) {
  document.getElementById('healthStatusText').textContent = data.residentInfo.healthStatus;
  document.getElementById('nextMedicationText').textContent = data.residentInfo.nextMedication;
  document.getElementById('remindersText').textContent = data.residentInfo.reminders;
  document.getElementById('familyContactText').textContent = data.residentInfo.familyContact;

  const scheduleList = document.getElementById('residentScheduleList');
  scheduleList.innerHTML = data.schedule.map(item => `
    <div class="mini-item">${item.time} - ${item.label}</div>
  `).join('');

  const actionsContainer = document.getElementById('residentActions');
  actionsContainer.innerHTML = data.residentInfo.quickActions.map(action => `
    <a class="btn ${action.type === 'primary' ? '' : action.type === 'secondary' ? 'btn-outline' : ''}" href="#" style="${action.type === 'danger' ? 'background:#ef4444;' : ''}">${action.label}</a>
  `).join('');
}

async function loadDashboardPage() {
  const data = await fetchDashboardData();
  if (!data) {
    return;
  }

  const page = location.pathname.split('/').pop();
  if (page === 'caregiver.html') {
    caregiverAlerts = data.alerts.map(alert => ({
      ...alert,
      responded: Boolean(alert.responded),
      response: alert.response || ''
    }));
    caregiverResidents = data.caregiverAssignments || [];
  }
  if (page === 'admin-dashboard.html') {
    renderAdminDashboard(data);
    setupAdminSidebarHandlers();
  } else if (page === 'caregiver.html') {
    renderCaregiverDashboard(data);
    setupCaregiverSidebarHandlers(data);
  } else if (page === 'family.html') {
    renderFamilyDashboard(data);
  } else if (page === 'resident.html') {
    renderResidentDashboard(data);
  }
}

function setupAdminSidebarHandlers() {
  document.querySelectorAll('.sidebar a').forEach(link => {
    link.addEventListener('click', (e) => {
      if (link.classList.contains('residents')) {
        return;
      }

      e.preventDefault();
      document.querySelectorAll('.sidebar a').forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      if (link.classList.contains('medication')) {
        showSection('medication');
      } else if (link.classList.contains('alerts')) {
        showSection('alerts');
      } else if (link.classList.contains('schedules')) {
        showSection('schedules');
      } else if (link.classList.contains('reports')) {
        showSection('reports');
      } else if (link.classList.contains('onboard')) {
        showSection('onboard');
      } else {
        location.reload();
      }
    });
  });
}

async function fetchResidents() {
  try {
    const response = await fetch('/api/residents', {
      credentials: 'same-origin'
    });
    if (!response.ok) {
      return [];
    }
    const result = await response.json();
    return result.residents || [];
  } catch (error) {
    console.error('Failed to fetch residents:', error);
    return [];
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function statusClass(status) {
  const value = String(status || '').toLowerCase();
  return value === 'observation' ? 'observe' : value;
}

async function loadResidentsAdminPage() {
  const residentsList = await fetchResidents();
  window.adminResidents = residentsList;
  renderResidentsList(residentsList);

  const requestedId = Number(new URLSearchParams(location.search).get('resident'));
  const selected = residentsList.find(resident => resident.id === requestedId) || residentsList[0];
  if (selected) {
    renderResidentEditor(selected);
  }
}

function renderResidentsList(residentsList) {
  const list = document.getElementById('residentsList');
  if (!list) return;

  list.innerHTML = residentsList.map(resident => `
    <button class="resident-list-item" type="button" data-resident-id="${resident.id}">
      <span>
        <strong>${escapeHtml(resident.name)}</strong>
        <small>Room ${escapeHtml(resident.room)}</small>
      </span>
      <span class="status ${statusClass(resident.status)}">${escapeHtml(resident.status)}</span>
    </button>
  `).join('');

  list.querySelectorAll('[data-resident-id]').forEach(button => {
    button.addEventListener('click', () => {
      const resident = window.adminResidents.find(item => item.id === Number(button.dataset.residentId));
      if (resident) {
        history.replaceState(null, '', `residents.html?resident=${resident.id}`);
        renderResidentEditor(resident);
      }
    });
  });
}

function renderChartBars(chartData) {
  return Object.entries(chartData || {}).map(([label, value]) => {
    const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
    return `
      <div class="chart-row">
        <div class="chart-label"><span>${escapeHtml(label)}</span><strong>${safeValue}%</strong></div>
        <div class="chart-track"><div class="chart-fill" style="width:${safeValue}%"></div></div>
      </div>
    `;
  }).join('');
}

function getResidentAlerts(resident, data) {
  const directAlerts = (resident.sensorAlerts || []).map(alert => ({
    ...alert,
    resident: resident.name
  }));
  const dashboardAlerts = (data.alerts || [])
    .filter(alert => alert.resident === resident.name)
    .map(alert => ({
      type: 'Care Alert',
      message: alert.issue,
      level: alert.level,
      time: 'Today',
      resident: alert.resident
    }));

  return [...directAlerts, ...dashboardAlerts];
}

function renderAdminMedicationSection(data, selectedResidentId) {
  const main = document.querySelector('.dashboard-content');
  if (!main || !data) return;

  const selectedResident = data.residents.find(resident => resident.id === selectedResidentId) || data.residents[0];
  const residentAlerts = getResidentAlerts(selectedResident, data);
  const residentMedications = selectedResident.medications || data.medications.filter(item => item.resident === selectedResident.name);

  main.innerHTML = `
    <div class="card panel-top">
      <div>
        <h1 style="margin:0">Medication</h1>
        <p class="note">Choose a resident to review sensor alerts and medication administration times.</p>
      </div>
      <select id="adminMedicationResident" class="resident-select" aria-label="Choose resident">
        ${data.residents.map(resident => `
          <option value="${resident.id}" ${resident.id === selectedResident.id ? 'selected' : ''}>
            ${escapeHtml(resident.name)} - Room ${escapeHtml(resident.room)}
          </option>
        `).join('')}
      </select>
    </div>

    <div class="grid medication-detail-grid">
      <div class="card">
        <h2>${escapeHtml(selectedResident.name)}</h2>
        <div class="mini-item"><span>Room Number</span><strong>${escapeHtml(selectedResident.room)}</strong></div>
        <div class="mini-item"><span>Health Status</span><span class="status ${statusClass(selectedResident.status)}">${escapeHtml(selectedResident.status)}</span></div>
        <div class="mini-item"><span>Care Note</span><strong>${escapeHtml(selectedResident.note)}</strong></div>
      </div>

      <div class="card">
        <h2>Alerts</h2>
        <div class="space-y">
          ${residentAlerts.map(alert => `
            <div class="alert-item">
              <div>
                <strong>${escapeHtml(alert.type)}</strong><br>
                <span class="note">${escapeHtml(alert.message)}</span><br>
                <small class="note">${escapeHtml(alert.time)}</small>
              </div>
              <span class="status ${statusClass(alert.level)}">${escapeHtml(alert.level)}</span>
            </div>
          `).join('') || '<p class="note">No active alerts for this resident.</p>'}
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:22px;">
      <h2>Medication List</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Medication</th>
              <th>Dosage</th>
              <th>Time To Administer</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${residentMedications.map(item => `
              <tr>
                <td><strong>${escapeHtml(item.name || item.medicine)}</strong></td>
                <td>${escapeHtml(item.dosage || 'As prescribed')}</td>
                <td>${escapeHtml(item.time)}</td>
                <td><span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('adminMedicationResident').addEventListener('change', event => {
    renderAdminMedicationSection(data, Number(event.target.value));
  });
}

function residentOptions(residentsList, selectedId) {
  return residentsList.map(resident => `
    <option value="${resident.id}" ${resident.id === selectedId ? 'selected' : ''}>${escapeHtml(resident.name)} (${escapeHtml(resident.room)})</option>
  `).join('');
}

function formatRecordTime(value) {
  if (!value) return 'Just now';
  return new Date(value).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

function renderCaregiverMedicationSection(data, selectedResidentId) {
  const content = document.querySelector('.dashboard-content');
  const resident = data.caregiverAssignments.find(item => item.id === selectedResidentId) || data.caregiverAssignments[0];
  if (!content || !resident) return;

  content.innerHTML = `
    <div class="card panel-top">
      <div><h1 style="margin:0">Medication</h1><p class="note">Update medication administration for assigned residents.</p></div>
      <select id="caregiverMedicationResident" class="resident-select">${residentOptions(data.caregiverAssignments, resident.id)}</select>
    </div>
    <div class="card">
      <h2>${escapeHtml(resident.name)} Medication List</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Medication</th><th>Dosage</th><th>Time</th><th>Status</th><th>Update</th></tr></thead>
          <tbody>
            ${(resident.medications || []).map((medication, index) => `
              <tr>
                <td><strong>${escapeHtml(medication.name)}</strong></td>
                <td>${escapeHtml(medication.dosage)}</td>
                <td>${escapeHtml(medication.time)}</td>
                <td><span class="status ${statusClass(medication.status)}">${escapeHtml(medication.status)}</span></td>
                <td>
                  <select data-med-status="${index}">
                    <option value="Scheduled" ${medication.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option>
                    <option value="Pending" ${medication.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Completed" ${medication.status === 'Completed' ? 'selected' : ''}>Given</option>
                    <option value="Missed" ${medication.status === 'Missed' ? 'selected' : ''}>Missed</option>
                  </select>
                  <input data-med-note="${index}" placeholder="Optional note" value="${escapeHtml(medication.note || '')}" style="margin-top:8px;">
                  <button class="view-btn" type="button" data-med-save="${index}" style="margin-top:8px;width:100%;">Save</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('caregiverMedicationResident').addEventListener('change', event => {
    renderCaregiverMedicationSection(data, Number(event.target.value));
  });
  content.querySelectorAll('[data-med-save]').forEach(button => {
    button.addEventListener('click', () => updateCaregiverMedication(data, resident.id, Number(button.dataset.medSave)));
  });
}

async function updateCaregiverMedication(data, residentId, medicationIndex, viewMode) {
  const status = document.querySelector(`[data-med-status="${medicationIndex}"]`).value;
  const note = document.querySelector(`[data-med-note="${medicationIndex}"]`).value;
  const response = await fetch(`/api/residents/${residentId}/medications/${medicationIndex}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, note })
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    alert(result.message || 'Unable to update medication.');
    return;
  }

  data.caregiverAssignments = data.caregiverAssignments.map(item => item.id === residentId ? {
    ...item,
    medication: result.resident.medication,
    medications: result.resident.medications
  } : item);
  alert('Medication updated and visible to admin.');
  if (viewMode === 'workspace') {
    renderCaregiverResidentActions(data, residentId, 'medication');
    return;
  }
  renderCaregiverMedicationSection(data, residentId);
}

function renderCaregiverNotesSection(data) {
  const content = document.querySelector('.dashboard-content');
  if (!content) return;

  content.innerHTML = `
    <div class="card panel-top">
      <div><h1 style="margin:0">Daily Notes</h1><p class="note">Record observations and care activities for residents.</p></div>
    </div>
    <div class="grid onboard-grid">
      <form class="card" id="careNoteForm">
        <h2>Add Daily Note</h2>
        <div class="form-group">
          <label for="noteResident">Resident</label>
          <select id="noteResident" required>${residentOptions(data.caregiverAssignments)}</select>
        </div>
        <div class="form-group">
          <label for="noteCategory">Category</label>
          <select id="noteCategory">
            <option>Daily Note</option>
            <option>Medication Note</option>
            <option>Family Update</option>
            <option>Care Concern</option>
          </select>
        </div>
        <div class="form-group">
          <label for="noteText">Observation</label>
          <textarea id="noteText" required></textarea>
        </div>
        <button type="submit" class="btn">Save Note</button>
        <p class="success" id="noteSaveMessage"></p>
      </form>
      <div class="card">
        <h2>Recent Notes</h2>
        <div class="space-y" id="notesList">
          ${(data.careNotes || []).map(note => `
            <div class="alert-item"><div><strong>${escapeHtml(note.resident)}</strong><br><span class="note">${escapeHtml(note.note)}</span><br><small>${escapeHtml(note.author)} - ${formatRecordTime(note.createdAt)}</small></div><span class="status scheduled">${escapeHtml(note.category)}</span></div>
          `).join('') || '<p class="note">No notes submitted yet.</p>'}
        </div>
      </div>
    </div>
  `;

  document.getElementById('careNoteForm').addEventListener('submit', event => submitCareNote(event, data));
}

async function submitCareNote(event, data) {
  event.preventDefault();
  const payload = {
    residentId: document.getElementById('noteResident').value,
    category: document.getElementById('noteCategory').value,
    note: document.getElementById('noteText').value
  };
  const response = await fetch('/api/care-notes', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    alert(result.message || 'Unable to save note.');
    return;
  }
  data.careNotes = [result.careNote, ...(data.careNotes || [])];
  renderCaregiverNotesSection(data);
}

function renderAdlChartSection(data) {
  const content = document.querySelector('.dashboard-content');
  if (!content) return;

  const scaleOptions = ['Independent', 'Needs Prompting', 'Assisted', 'Dependent'];
  const selectHtml = id => `
    <select id="${id}">${scaleOptions.map(option => `<option>${option}</option>`).join('')}</select>
  `;

  content.innerHTML = `
    <div class="card panel-top">
      <div><h1 style="margin:0">ADL Chart</h1><p class="note">Fill activities of daily living chart for admin review.</p></div>
    </div>
    <div class="grid onboard-grid">
      <form class="card" id="adlChartForm">
        <h2>New ADL Entry</h2>
        <div class="form-group"><label for="adlResident">Resident</label><select id="adlResident">${residentOptions(data.caregiverAssignments)}</select></div>
        <div class="grid grid-2">
          <div class="form-group"><label for="adlMobility">Mobility</label>${selectHtml('adlMobility')}</div>
          <div class="form-group"><label for="adlBathing">Bathing</label>${selectHtml('adlBathing')}</div>
          <div class="form-group"><label for="adlDressing">Dressing</label>${selectHtml('adlDressing')}</div>
          <div class="form-group"><label for="adlEating">Eating</label>${selectHtml('adlEating')}</div>
          <div class="form-group"><label for="adlToileting">Toileting</label>${selectHtml('adlToileting')}</div>
        </div>
        <div class="form-group"><label for="adlNotes">Notes</label><textarea id="adlNotes"></textarea></div>
        <button class="btn" type="submit">Submit ADL Chart</button>
      </form>
      <div class="card"><h2>Submitted ADL Charts</h2><div class="space-y">${(data.adlCharts || []).map(chart => `<div class="alert-item"><div><strong>${escapeHtml(chart.resident)}</strong><br><span class="note">Mobility: ${escapeHtml(chart.mobility)} | Eating: ${escapeHtml(chart.eating)}</span><br><small>${escapeHtml(chart.author)} - ${formatRecordTime(chart.createdAt)}</small></div></div>`).join('') || '<p class="note">No ADL charts submitted yet.</p>'}</div></div>
    </div>
  `;
  document.getElementById('adlChartForm').addEventListener('submit', event => submitAdlChart(event, data));
}

async function submitAdlChart(event, data) {
  event.preventDefault();
  const payload = {
    residentId: document.getElementById('adlResident').value,
    mobility: document.getElementById('adlMobility').value,
    bathing: document.getElementById('adlBathing').value,
    dressing: document.getElementById('adlDressing').value,
    eating: document.getElementById('adlEating').value,
    toileting: document.getElementById('adlToileting').value,
    notes: document.getElementById('adlNotes').value
  };
  const response = await fetch('/api/adl-charts', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    alert(result.message || 'Unable to submit ADL chart.');
    return;
  }
  data.adlCharts = [result.adlChart, ...(data.adlCharts || [])];
  renderAdlChartSection(data);
}

function renderIncidentSection(data) {
  const content = document.querySelector('.dashboard-content');
  if (!content) return;

  content.innerHTML = `
    <div class="card panel-top">
      <div><h1 style="margin:0">Incident Reports</h1><p class="note">Submit incident reports for admin review.</p></div>
    </div>
    <div class="grid onboard-grid">
      <form class="card" id="incidentForm">
        <h2>New Incident</h2>
        <div class="form-group"><label for="incidentResident">Resident</label><select id="incidentResident">${residentOptions(data.caregiverAssignments)}</select></div>
        <div class="form-group"><label for="incidentType">Incident Type</label><input id="incidentType" placeholder="Fall, medication, sensor alert" required></div>
        <div class="form-group"><label for="incidentSeverity">Severity</label><select id="incidentSeverity"><option>Observation</option><option>High</option><option>Critical</option></select></div>
        <div class="form-group"><label for="incidentDescription">Description</label><textarea id="incidentDescription" required></textarea></div>
        <div class="form-group"><label for="incidentAction">Action Taken</label><textarea id="incidentAction"></textarea></div>
        <button class="btn" type="submit">Submit Incident</button>
      </form>
      <div class="card"><h2>Submitted Incidents</h2><div class="space-y">${(data.incidentReports || []).map(report => `<div class="alert-item"><div><strong>${escapeHtml(report.resident)} - ${escapeHtml(report.type)}</strong><br><span class="note">${escapeHtml(report.description)}</span><br><small>${escapeHtml(report.author)} - ${formatRecordTime(report.createdAt)}</small></div><span class="status ${statusClass(report.severity)}">${escapeHtml(report.severity)}</span></div>`).join('') || '<p class="note">No incident reports submitted yet.</p>'}</div></div>
    </div>
  `;
  document.getElementById('incidentForm').addEventListener('submit', event => submitIncidentReport(event, data));
}

async function submitIncidentReport(event, data) {
  event.preventDefault();
  const payload = {
    residentId: document.getElementById('incidentResident').value,
    type: document.getElementById('incidentType').value,
    severity: document.getElementById('incidentSeverity').value,
    description: document.getElementById('incidentDescription').value,
    actionTaken: document.getElementById('incidentAction').value
  };
  const response = await fetch('/api/incident-reports', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    alert(result.message || 'Unable to submit incident report.');
    return;
  }
  data.incidentReports = [result.incidentReport, ...(data.incidentReports || [])];
  renderIncidentSection(data);
}

function renderOnboardSection(data) {
  const main = document.querySelector('.dashboard-content');
  if (!main) return;

  const staffList = (data && data.staff) || [];
  main.innerHTML = `
    <div class="card panel-top">
      <div>
        <h1 style="margin:0">Onboard</h1>
        <p class="note">Create new residents and staff accounts for the ElderNest system.</p>
      </div>
    </div>

    <div class="grid onboard-grid">
      <form class="card" id="onboardResidentForm">
        <h2>New Resident</h2>
        <div class="grid grid-2">
          <div class="form-group">
            <label for="newResidentName">Resident Name</label>
            <input id="newResidentName" required>
          </div>
          <div class="form-group">
            <label for="newResidentAge">Age</label>
            <input id="newResidentAge" type="number" min="1">
          </div>
          <div class="form-group">
            <label for="newResidentRoom">Room Number</label>
            <input id="newResidentRoom" required>
          </div>
          <div class="form-group">
            <label for="newResidentStatus">Health Status</label>
            <select id="newResidentStatus">
              <option value="Stable">Stable</option>
              <option value="Observation">Observation</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="newResidentMedication">Medication</label>
          <input id="newResidentMedication" placeholder="Example: Vitamin D">
        </div>
        <div class="form-group">
          <label for="newResidentCarePlan">Care Plan</label>
          <textarea id="newResidentCarePlan" placeholder="Initial care instructions"></textarea>
        </div>
        <div class="form-group">
          <label for="newResidentContact">Emergency Contact</label>
          <input id="newResidentContact" placeholder="Name, relation, phone">
        </div>
        <button class="btn" type="submit">Onboard Resident</button>
        <p class="success" id="residentOnboardMessage" aria-live="polite"></p>
      </form>

      <form class="card" id="onboardStaffForm">
        <h2>New Staff</h2>
        <div class="form-group">
          <label for="newStaffName">Staff Name</label>
          <input id="newStaffName" required>
        </div>
        <div class="form-group">
          <label for="newStaffRole">Role</label>
          <select id="newStaffRole">
            <option value="caregiver">Care Staff</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div class="form-group">
          <label for="newStaffEmail">Login Email</label>
          <input id="newStaffEmail" type="email" required>
        </div>
        <div class="form-group">
          <label for="newStaffPassword">Login Password</label>
          <input id="newStaffPassword" type="password" minlength="6" required>
        </div>
        <button class="btn" type="submit">Create Staff Login</button>
        <p class="success" id="staffOnboardMessage" aria-live="polite"></p>
        <div class="onboard-staff-list">
          <h3>Current Staff</h3>
          ${staffList.map(staff => `
            <div class="mini-item">
              <span><strong>${escapeHtml(staff.name)}</strong><br><small class="note">${escapeHtml(staff.email)}</small></span>
              <span>${escapeHtml(staff.id)} - ${escapeHtml(staff.role)}</span>
            </div>
          `).join('') || '<p class="note">No staff created yet.</p>'}
        </div>
      </form>
    </div>
  `;

  document.getElementById('onboardResidentForm').addEventListener('submit', submitResidentOnboard);
  document.getElementById('onboardStaffForm').addEventListener('submit', submitStaffOnboard);
}

async function submitResidentOnboard(event) {
  event.preventDefault();

  const payload = {
    name: document.getElementById('newResidentName').value,
    age: document.getElementById('newResidentAge').value,
    room: document.getElementById('newResidentRoom').value,
    status: document.getElementById('newResidentStatus').value,
    medication: document.getElementById('newResidentMedication').value,
    carePlan: document.getElementById('newResidentCarePlan').value,
    emergencyContact: document.getElementById('newResidentContact').value
  };

  const response = await fetch('/api/onboard/resident', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json();

  if (!response.ok || !result.success) {
    alert(result.message || 'Unable to onboard resident.');
    return;
  }

  adminDashboardData.residents.push(result.resident);
  document.getElementById('onboardResidentForm').reset();
  document.getElementById('residentOnboardMessage').textContent = `${result.resident.name} has been onboarded in room ${result.resident.room}.`;
}

async function submitStaffOnboard(event) {
  event.preventDefault();

  const payload = {
    name: document.getElementById('newStaffName').value,
    role: document.getElementById('newStaffRole').value,
    email: document.getElementById('newStaffEmail').value,
    password: document.getElementById('newStaffPassword').value
  };

  const response = await fetch('/api/onboard/staff', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json();

  if (!response.ok || !result.success) {
    alert(result.message || 'Unable to create staff login.');
    return;
  }

  adminDashboardData.staff = adminDashboardData.staff || [];
  adminDashboardData.staff.push(result.staff);
  document.getElementById('onboardStaffForm').reset();
  document.getElementById('staffOnboardMessage').textContent = `${result.staff.name} created with Staff ID ${result.staff.id}. They can now log in with the email and password you entered.`;
}

function renderResidentEditor(resident) {
  const detail = document.getElementById('residentDetailPanel');
  if (!detail) return;

  document.querySelectorAll('.resident-list-item').forEach(item => {
    item.classList.toggle('active', Number(item.dataset.residentId) === resident.id);
  });

  detail.innerHTML = `
    <div class="card panel-top">
      <div>
        <h1 style="margin:0">${escapeHtml(resident.name)}</h1>
        <p class="note">Room ${escapeHtml(resident.room)} - edit resident details, vitals, and chart values.</p>
      </div>
      <span class="status ${statusClass(resident.status)}">${escapeHtml(resident.status)}</span>
    </div>
    <div class="grid resident-detail-grid">
      <form class="card resident-form" id="residentEditForm">
        <input type="hidden" id="residentId" value="${resident.id}">
        <div class="grid grid-2">
          <div class="form-group">
            <label for="residentName">Resident Name</label>
            <input id="residentName" value="${escapeHtml(resident.name)}" required>
          </div>
          <div class="form-group">
            <label for="residentAge">Age</label>
            <input id="residentAge" type="number" min="1" value="${resident.age}" required>
          </div>
          <div class="form-group">
            <label for="residentRoom">Room Number</label>
            <input id="residentRoom" value="${escapeHtml(resident.room)}" required>
          </div>
          <div class="form-group">
            <label for="residentStatus">Health Status</label>
            <select id="residentStatus" required>
              ${['Stable', 'Observation', 'Critical'].map(status => `<option value="${status}" ${resident.status === status ? 'selected' : ''}>${status}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="residentMedication">Medication</label>
          <input id="residentMedication" value="${escapeHtml(resident.medication)}">
        </div>
        <div class="form-group">
          <label for="residentNote">Care Note</label>
          <textarea id="residentNote">${escapeHtml(resident.note)}</textarea>
        </div>
        <div class="form-group">
          <label for="residentCarePlan">Care Plan</label>
          <textarea id="residentCarePlan">${escapeHtml(resident.carePlan)}</textarea>
        </div>
        <div class="grid grid-2">
          <div class="form-group">
            <label for="residentAllergies">Allergies</label>
            <input id="residentAllergies" value="${escapeHtml(resident.allergies)}">
          </div>
          <div class="form-group">
            <label for="residentContact">Emergency Contact</label>
            <input id="residentContact" value="${escapeHtml(resident.emergencyContact)}">
          </div>
        </div>
        <button class="btn" type="submit">Save Changes</button>
        <p class="success" id="residentSaveMessage" aria-live="polite"></p>
      </form>
      <div class="space-y">
        <div class="card">
          <h2>Vitals</h2>
          <div class="vitals-grid">
            <label>Heart Rate<input id="heartRate" type="number" value="${resident.vitals.heartRate}"></label>
            <label>Blood Pressure<input id="bloodPressure" value="${escapeHtml(resident.vitals.bloodPressure)}"></label>
            <label>Oxygen %<input id="oxygen" type="number" value="${resident.vitals.oxygen}"></label>
            <label>Temperature C<input id="temperature" type="number" step="0.1" value="${resident.vitals.temperature}"></label>
          </div>
        </div>
        <div class="card">
          <h2>Charts</h2>
          <div class="chart-preview">${renderChartBars(resident.chartData)}</div>
          <div class="grid grid-2 chart-inputs">
            ${Object.entries(resident.chartData || {}).map(([label, value]) => `
              <label>${escapeHtml(label)}
                <input data-chart-field="${escapeHtml(label)}" type="number" min="0" max="100" value="${value}">
              </label>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('residentEditForm').addEventListener('submit', saveResidentChanges);
}

async function saveResidentChanges(event) {
  event.preventDefault();

  const residentId = Number(document.getElementById('residentId').value);
  const chartData = {};
  document.querySelectorAll('[data-chart-field]').forEach(input => {
    chartData[input.dataset.chartField] = Number(input.value);
  });

  const payload = {
    name: document.getElementById('residentName').value,
    age: document.getElementById('residentAge').value,
    room: document.getElementById('residentRoom').value,
    status: document.getElementById('residentStatus').value,
    medication: document.getElementById('residentMedication').value,
    note: document.getElementById('residentNote').value,
    carePlan: document.getElementById('residentCarePlan').value,
    allergies: document.getElementById('residentAllergies').value,
    emergencyContact: document.getElementById('residentContact').value,
    vitals: {
      heartRate: document.getElementById('heartRate').value,
      bloodPressure: document.getElementById('bloodPressure').value,
      oxygen: document.getElementById('oxygen').value,
      temperature: document.getElementById('temperature').value
    },
    chartData
  };

  const response = await fetch(`/api/residents/${residentId}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json();

  if (!response.ok || !result.success) {
    alert(result.message || 'Unable to save resident changes.');
    return;
  }

  window.adminResidents = window.adminResidents.map(resident => resident.id === residentId ? result.resident : resident);
  renderResidentsList(window.adminResidents);
  renderResidentEditor(result.resident);

  const message = document.getElementById('residentSaveMessage');
  if (message) {
    message.textContent = 'Resident changes saved.';
  }
}

function setupCaregiverSidebarHandlers(data) {
  const content = document.querySelector('.dashboard-content');

  document.querySelectorAll('.sidebar a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.sidebar a').forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      if (link.classList.contains('residents-nav')) {
        renderCaregiverResidentWorkspace(data);
      } else if (link.classList.contains('medication-nav')) {
        renderCaregiverMedicationSection(data);
      } else if (link.classList.contains('notes-nav')) {
        renderCaregiverNotesSection(data);
      } else if (link.classList.contains('adl-nav')) {
        renderAdlChartSection(data);
      } else if (link.classList.contains('incidents-nav')) {
        renderIncidentSection(data);
      } else if (link.classList.contains('alerts-nav')) {
        if (!caregiverAlerts.length) {
          caregiverAlerts = data.alerts.map(alert => ({ ...alert, responded: false, response: '' }));
        }
        content.innerHTML = `
          <div class="card panel-top">
            <div><h1 style="margin:0">Active Alerts</h1><p class="note">Review and respond to urgent alerts.</p></div>
          </div>
          <div class="card" style="margin-top:22px;">
            <h2>Alerts Requiring Action</h2>
            <div class="space-y">
              ${caregiverAlerts.map((alert, i) => `
                <div class="alert-item">
                  <div>
                    <strong>${alert.resident}</strong><br>
                    <span class="note">${alert.issue}</span>
                    ${alert.responded ? `<div class="note" style="margin-top:8px;"><strong>Response:</strong> ${alert.response}</div>` : ''}
                  </div>
                  <span class="status ${alert.level.toLowerCase()}">${alert.level}</span>
                  <button class="review-btn ${alert.responded ? 'responded' : ''}" onclick="respondToAlert(${i})" style="margin-top:10px;">${alert.responded ? 'Responded' : 'Respond'}</button>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } else if (link.classList.contains('schedules-nav')) {
        content.innerHTML = `
          <div class="card panel-top">
            <div><h1 style="margin:0">Care Schedule</h1><p class="note">Daily schedule for assigned residents.</p></div>
          </div>
          <div class="card" style="margin-top:22px;">
            <h2>Today's Schedule</h2>
            <div class="table-card">
              ${data.schedule.map(item => `
                <div class="alert-item"><strong>${item.time}</strong><p>${item.label}</p></div>
              `).join('')}
            </div>
          </div>
        `;
      }
    });
  });

  document.querySelector('.residents-nav').click();
}

async function initAuthLinks() {
  sessionData = await fetchSession();

  document.querySelectorAll('[data-auth-state]').forEach(node => {
    if (sessionData.loggedIn) {
      const userName = sessionData.user.name || 'User';
      const role = sessionData.user.role || '';

      node.innerHTML = `
        <span style="margin-right:10px;font-size:14px;">${userName} (${role})</span>
        <a href="#" class="btn btn-outline" data-logout>Logout</a>
      `;

      const logoutBtn = node.querySelector('[data-logout]');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async function (e) {
          e.preventDefault();
          await logout();
        });
      }
    } else {
      node.innerHTML = `<a href="login.html" class="btn btn-outline">Login</a>`;
    }
  });
}

function getDashboardUrl(user) {
  return (user && user.dashboard) || 'index.html';
}

async function requireLogin() {
  const session = await fetchSession();

  if (!session.loggedIn) {
    const currentPage = location.pathname.split('/').pop();
    window.location.href = 'login.html?redirect=' + encodeURIComponent(currentPage);
    return false;
  }

  return true;
}

async function requireRole(allowedRoles = []) {
  const session = await fetchSession();

  if (!session.loggedIn) {
    const currentPage = location.pathname.split('/').pop();
    window.location.href = 'login.html?redirect=' + encodeURIComponent(currentPage);
    return false;
  }

  const role = session.role;
  if (!allowedRoles.includes(role)) {
    alert('Access denied. You are not allowed to open this page.');
    window.location.href = getDashboardUrl(session.user);
    return false;
  }

  return true;
}

async function logout() {
  try {
    const response = await fetch('/api/logout', {
      method: 'POST',
      credentials: 'same-origin'
    });
    const result = await response.json();
    if (result.success) {
      window.location.href = 'index.html';
    }
  } catch (error) {
    console.error('Logout failed:', error);
    window.location.href = 'index.html';
  }
}

async function redirectToDashboard() {
  if (!sessionData) {
    sessionData = await fetchSession();
  }
  window.location.href = getDashboardUrl(sessionData.user);
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

function viewResidentDetails(index) {
  const resident = caregiverResidents[index] || residents[index];
  if (!resident) return;

  const modalId = 'residentDetailModal';
  const contactsHtml = (resident.contacts || resident.contactList || []).map(c => `
      <div style="margin-bottom:6px;">
        <strong>${c.name}</strong> ${c.relation ? `(${c.relation})` : ''}<br>
        <a href="tel:${c.phone || '#'}">${c.phone || 'No phone'}</a>
      </div>
    `).join('') || '<div class="note">No contacts on file.</div>';

  const allergiesHtml = (resident.allergies || []).length ? `<ul>${(resident.allergies || []).map(a => `<li>${a}</li>`).join('')}</ul>` : '<div class="note">No known allergies.</div>';

  const vitalsHtml = (resident.recentVitals || resident.vitals || []).length ? `
    <div class="vitals-grid">
      ${(resident.recentVitals || resident.vitals || []).map(v => `
        <div class="vital-item"><strong>${v.label}</strong><div>${v.value}</div><small class="note">${v.time || ''}</small></div>
      `).join('')}
    </div>
  ` : '<div class="note">No recent vitals recorded.</div>';

  const modalHtml = `
  <div class="modal-bg" id="${modalId}" role="dialog" aria-modal="true">
    <div class="modal-box" style="max-width:680px;">
      <h2>${resident.name}</h2>
      <div style="display:flex;gap:18px;align-items:flex-start;">
        <div style="flex:1;min-width:220px;">
          <p><strong>Room:</strong> ${resident.room}</p>
          <p><strong>Status:</strong> <span class="status ${resident.status.toLowerCase()}">${resident.status}</span></p>
          <p><strong>Medication:</strong> ${resident.medication}</p>
          ${resident.note ? `<p class="note">${resident.note}</p>` : ''}
          <h4 style="margin-top:12px;margin-bottom:6px;">Contacts</h4>
          ${contactsHtml}
        </div>
        <div style="flex:1;min-width:220px;">
          <h4 style="margin-top:0;margin-bottom:6px;">Allergies</h4>
          ${allergiesHtml}
          <h4 style="margin-top:12px;margin-bottom:6px;">Recent Vitals</h4>
          ${vitalsHtml}
        </div>
      </div>
      <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn" id="closeResidentDetail">Close</button>
      </div>
    </div>
  </div>
  `;

  // Remove any existing modal
  document.querySelectorAll('.modal-bg').forEach(m => m.remove());
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const closeBtn = document.getElementById('closeResidentDetail');
  if (closeBtn) closeBtn.addEventListener('click', () => {
    const modal = document.getElementById(modalId);
    if (modal) modal.remove();
  });
}

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
    renderAdminMedicationSection(adminDashboardData);
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
      <div class="card panel-top">
        <div><h1 style="margin:0">Reports</h1><p class="note">Review care staff notes, ADL charts, incidents, and medication updates.</p></div>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><h4>Total Residents</h4><p>${adminDashboardData.residents.length}</p></div>
        <div class="stat-card"><h4>Care Notes</h4><p>${(adminDashboardData.careNotes || []).length}</p></div>
        <div class="stat-card"><h4>ADL Charts</h4><p>${(adminDashboardData.adlCharts || []).length}</p></div>
        <div class="stat-card"><h4>Incidents</h4><p>${(adminDashboardData.incidentReports || []).length}</p></div>
      </div>
      <div class="grid onboard-grid" style="margin-top:22px;">
        <div class="card">
          <h2>Care Notes</h2>
          <div class="space-y">${(adminDashboardData.careNotes || []).map(note => `<div class="alert-item"><div><strong>${escapeHtml(note.resident)}</strong><br><span class="note">${escapeHtml(note.note)}</span><br><small>${escapeHtml(note.author)} - ${formatRecordTime(note.createdAt)}</small></div><span class="status scheduled">${escapeHtml(note.category)}</span></div>`).join('') || '<p class="note">No care notes submitted yet.</p>'}</div>
        </div>
        <div class="card">
          <h2>Incident Reports</h2>
          <div class="space-y">${(adminDashboardData.incidentReports || []).map(report => `<div class="alert-item"><div><strong>${escapeHtml(report.resident)} - ${escapeHtml(report.type)}</strong><br><span class="note">${escapeHtml(report.description)}</span><br><small>${escapeHtml(report.author)} - ${formatRecordTime(report.createdAt)}</small></div><span class="status ${statusClass(report.severity)}">${escapeHtml(report.severity)}</span></div>`).join('') || '<p class="note">No incident reports submitted yet.</p>'}</div>
        </div>
        <div class="card">
          <h2>ADL Charts</h2>
          <div class="space-y">${(adminDashboardData.adlCharts || []).map(chart => `<div class="alert-item"><div><strong>${escapeHtml(chart.resident)}</strong><br><span class="note">Mobility: ${escapeHtml(chart.mobility)} | Bathing: ${escapeHtml(chart.bathing)} | Eating: ${escapeHtml(chart.eating)}</span><br><small>${escapeHtml(chart.author)} - ${formatRecordTime(chart.createdAt)}</small></div></div>`).join('') || '<p class="note">No ADL charts submitted yet.</p>'}</div>
        </div>
        <div class="card">
          <h2>Medication Updates</h2>
          <div class="space-y">${adminDashboardData.residents.flatMap(resident => (resident.medications || []).filter(med => med.updatedBy).map(med => `<div class="alert-item"><div><strong>${escapeHtml(resident.name)} - ${escapeHtml(med.name)}</strong><br><span class="note">Status: ${escapeHtml(med.status)}${med.note ? ` | ${escapeHtml(med.note)}` : ''}</span><br><small>Updated by ${escapeHtml(med.updatedBy)}${med.administeredTime ? ` at ${escapeHtml(med.administeredTime)}` : ''}</small></div></div>`)).join('') || '<p class="note">No medication updates submitted yet.</p>'}</div>
        </div>
      </div>
    `;
  }

  if (section === "onboard") {
    renderOnboardSection(adminDashboardData);
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

function renderCaregiverAlertsSection() {
  const content = document.querySelector('.dashboard-content');
  if (!content) return;

  content.innerHTML = `
    <div class="card panel-top">
      <div><h1 style="margin:0">Active Alerts</h1><p class="note">Review and respond to urgent alerts.</p></div>
    </div>
    <div class="card" style="margin-top:22px;">
      <h2>Alerts Requiring Action</h2>
      <div class="space-y">
        ${caregiverAlerts.map((alert, i) => `
          <div class="alert-item">
            <div>
              <strong>${alert.resident}</strong><br>
              <span class="note">${alert.issue}</span>
              ${alert.responded ? `<div class="note" style="margin-top:8px;"><strong>Response:</strong> ${alert.response}</div>` : ''}
            </div>
            <span class="status ${alert.level.toLowerCase()}">${alert.level}</span>
            <button class="review-btn ${alert.responded ? 'responded' : ''}" onclick="respondToAlert(${i})" style="margin-top:10px;">${alert.responded ? 'Responded' : 'Respond'}</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Caregiver handlers for daily notes, alerts, and resident management


function saveDailyNote(event) {
  event.preventDefault();
  const resident = document.getElementById('noteResident').value;
  const text = document.getElementById('noteText').value;
  
  if (!resident || !text) return;
  
  alert(`Daily note saved for ${resident}`);
  document.getElementById('noteText').value = '';
  addResidentNoteUI();
}

async function respondToAlert(index) {
  const alertItem = caregiverAlerts[index];
  if (!alertItem) return;

  const isEditing = alertItem.responded;
  const modalId = 'responseModal' + index;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-bg" id="${modalId}">
      <div class="modal-box">
        <h2>${isEditing ? 'Edit Response' : 'Respond to Alert'}</h2>
        <p><strong>Resident:</strong> ${alertItem.resident}</p>
        <p><strong>Issue:</strong> ${alertItem.issue}</p>
        <div class="form-group" style="margin-top:15px;">
          <label for="responseText">Your Response</label>
          <textarea id="responseText" placeholder="Enter your response..." style="min-height:100px;width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-family:inherit;">${isEditing ? alertItem.response : ''}</textarea>
        </div>
        <div style="margin-top:15px;display:flex;gap:10px;">
          <button onclick="submitAlertResponse(${index}, '${modalId}')" style="flex:1;padding:10px;background:#10b981;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">${isEditing ? 'Update Response' : 'Submit Response'}</button>
          <button onclick="document.getElementById('${modalId}').remove()" style="flex:1;padding:10px;background:#e5e7eb;color:#333;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Cancel</button>
        </div>
      </div>
    </div>
  `);
}

async function submitAlertResponse(index, modalId) {
  const textarea = document.getElementById('responseText');
  const notes = textarea ? textarea.value.trim() : '';
  
  if (!notes) {
    alert('Please enter a response.');
    return;
  }

  const alertItem = caregiverAlerts[index];
  if (!alertItem) return;

  try {
    const response = await fetch(`/api/alerts/${alertItem.id}/respond`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ response: notes })
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to save response');
    }

    document.getElementById(modalId).remove();
    caregiverAlerts[index] = result.alert;
    renderCaregiverAlertsSection();
    alert('Alert response recorded and saved.');
  } catch (error) {
    console.error('Alert response failed:', error);
    alert('Unable to save response. Please try again.');
  }
}

function addResidentNoteUI() {
  const notesList = document.getElementById('notesList');
  if (notesList) {
    notesList.innerHTML = `
      <h3 style="margin-top:20px;">Recent Notes</h3>
      <div class="alert-item">
        <strong>Dorji Wangmo</strong>
        <p>Resident appears stable today. Completed morning medication on schedule. Slight appetite increase noted.</p>
        <small>Today at 09:30 AM</small>
      </div>
      <div class="alert-item">
        <strong>Pema Choden</strong>
        <p>Medication reminder needed. Did not take 8:00 AM dose. Will recheck at 10:00 AM.</p>
        <small>Today at 08:15 AM</small>
      </div>
    `;
  }
}
