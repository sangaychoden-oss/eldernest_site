let sessionData = null;
let caregiverAlerts = [];
let caregiverResidents = [];
let adminDashboardData = null;
let currentCaregiverShift = null;

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

  const existingPresence = document.getElementById('overviewCaregiverPresence');
  if (!existingPresence) {
    const statsGrid = document.querySelector('.stats-grid');
    if (statsGrid) {
      statsGrid.insertAdjacentHTML('afterend', `
        <div class="card" id="overviewCaregiverPresence" style="margin-top:22px;">
          <div class="panel-top" style="margin-bottom:12px;">
            <div>
              <h2 style="margin:0">Caregiver Presence</h2>
              <p class="note">Live shift view for staff currently working.</p>
            </div>
            <button class="btn btn-outline" type="button" id="viewCaregiversButton">View Caregivers</button>
          </div>
          ${renderCaregiverPresenceTable(data.caregiverStatus || [])}
        </div>
      `);
      const viewButton = document.getElementById('viewCaregiversButton');
      if (viewButton) {
        viewButton.addEventListener('click', () => renderAdminCaregiversSection(data));
      }
    }
  }

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
    renderCaregiverResidentActions(data, selectedResident.id, 'details');
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
      renderCaregiverResidentActions(data, Number(button.dataset.careResident), 'details');
      renderCaregiverResidentList(data, data.caregiverAssignments, Number(button.dataset.careResident));
    });
  });
}

function caregiverActionTabs(residentId, activeTab) {
  const tabs = [
    ['details', 'Edit Details'],
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
      <button class="btn btn-outline" type="button" data-care-action="details" data-resident-id="${resident.id}">Edit Details</button>
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
        showCaregiverResidentEditModal(data, resident.id);
        return;
      }
      renderCaregiverResidentActions(data, resident.id, action);
    });
  });

  renderCaregiverActionPanel(data, resident, activeTab);
}

function showCaregiverResidentEditModal(data, residentId) {
  const resident = (data.caregiverAssignments || []).find(item => item.id === residentId);
  if (!resident) return;

  document.querySelectorAll('.modal-bg').forEach(modal => modal.remove());
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-bg" id="caregiverResidentEditModal" role="dialog" aria-modal="true">
      <div class="modal-box caregiver-edit-modal">
        <div class="panel-top" style="margin-bottom:12px;">
          <div>
            <h2 style="margin:0">Edit Client Details</h2>
            <p class="note">${escapeHtml(resident.name)} - Room ${escapeHtml(resident.room)}</p>
          </div>
          <button class="btn btn-outline" type="button" id="closeCaregiverResidentEdit">Close</button>
        </div>
        <div id="caregiverResidentEditModalPanel"></div>
      </div>
    </div>
  `);

  renderCaregiverEditForm(data, resident, document.getElementById('caregiverResidentEditModalPanel'), true);
  document.getElementById('closeCaregiverResidentEdit').addEventListener('click', () => {
    document.getElementById('caregiverResidentEditModal').remove();
  });
}

function renderCaregiverEditForm(data, resident, panel, isModal = false) {
  panel.innerHTML = `
    <form id="caregiverResidentEditForm" class="resident-form">
      ${isModal ? '' : '<h2>Edit Client Details</h2>'}
      <input type="hidden" id="careResidentId" value="${resident.id}">
      <div class="grid grid-2">
        <div class="form-group"><label for="careResidentName">Resident Name</label><input id="careResidentName" value="${escapeHtml(resident.name)}" required></div>
        <div class="form-group"><label for="careResidentAge">Age</label><input id="careResidentAge" type="number" min="1" value="${escapeHtml(resident.age || '')}" required></div>
        <div class="form-group"><label for="careResidentRoom">Room Number</label><input id="careResidentRoom" value="${escapeHtml(resident.room)}" required></div>
        <div class="form-group"><label for="careResidentStatus">Health Status</label><select id="careResidentStatus" required>${['Stable', 'Observation', 'Critical'].map(status => `<option value="${status}" ${resident.status === status || resident.status === statusClass(status) ? 'selected' : ''}>${status}</option>`).join('')}</select></div>
      </div>
      <div class="form-group"><label for="careResidentMedication">Medication</label><input id="careResidentMedication" value="${escapeHtml(resident.medication || '')}"></div>
      <div class="form-group"><label for="careResidentNote">Care Note</label><textarea id="careResidentNote">${escapeHtml(resident.note || '')}</textarea></div>
      <div class="form-group"><label for="careResidentCarePlan">Care Plan</label><textarea id="careResidentCarePlan">${escapeHtml(resident.carePlan || '')}</textarea></div>
      <div class="grid grid-2">
        <div class="form-group"><label for="careResidentAllergies">Allergies</label><input id="careResidentAllergies" value="${escapeHtml(resident.allergies || '')}"></div>
        <div class="form-group"><label for="careResidentContact">Emergency Contact</label><input id="careResidentContact" value="${escapeHtml(resident.emergencyContact || '')}"></div>
      </div>
      <h3>Vitals</h3>
      <div class="vitals-grid">
        <label>Heart Rate<input id="careHeartRate" type="number" value="${escapeHtml((resident.vitals || {}).heartRate || '')}"></label>
        <label>Blood Pressure<input id="careBloodPressure" value="${escapeHtml((resident.vitals || {}).bloodPressure || '')}"></label>
        <label>Oxygen %<input id="careOxygen" type="number" value="${escapeHtml((resident.vitals || {}).oxygen || '')}"></label>
        <label>Temperature C<input id="careTemperature" type="number" step="0.1" value="${escapeHtml((resident.vitals || {}).temperature || '')}"></label>
      </div>
      <h3>Charts</h3>
      <div class="chart-preview">${renderChartBars(resident.chartData || {})}</div>
      <div class="grid grid-2 chart-inputs">
        ${Object.entries(resident.chartData || { wellness: 75, mobility: 75, medication: 75, sleep: 75 }).map(([label, value]) => `
          <label>${escapeHtml(label)}<input data-care-chart-field="${escapeHtml(label)}" type="number" min="0" max="100" value="${escapeHtml(value)}"></label>
        `).join('')}
      </div>
      <button class="btn" type="submit">Save Client Details</button>
      <p class="success" id="careResidentSaveMessage" aria-live="polite"></p>
    </form>
  `;
  document.getElementById('caregiverResidentEditForm').addEventListener('submit', event => saveCaregiverResidentDetails(event, data));
}

function renderCaregiverActionPanel(data, resident, activeTab) {
  const panel = document.getElementById('caregiverActionPanel');
  if (!panel) return;

  if (activeTab === 'details') {
    panel.innerHTML = `
      <div class="center-message" style="margin:20px auto;">
        <h2>Edit Client Details</h2>
        <p class="note">Open the editable client record in a popup.</p>
        <button class="btn" type="button" id="openCaregiverEditModal">Open Edit Details</button>
      </div>
    `;
    document.getElementById('openCaregiverEditModal').addEventListener('click', () => showCaregiverResidentEditModal(data, resident.id));
    return;
  }

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

async function saveCaregiverResidentDetails(event, data) {
  event.preventDefault();

  const submitButton = event.submitter || document.querySelector('#caregiverResidentEditForm button[type="submit"]');
  const message = document.getElementById('careResidentSaveMessage');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';
  }
  if (message) {
    message.textContent = '';
  }

  const residentId = Number(document.getElementById('careResidentId').value);
  const chartData = {};
  document.querySelectorAll('[data-care-chart-field]').forEach(input => {
    chartData[input.dataset.careChartField] = Number(input.value);
  });

  const payload = {
    name: document.getElementById('careResidentName').value,
    age: document.getElementById('careResidentAge').value,
    room: document.getElementById('careResidentRoom').value,
    status: document.getElementById('careResidentStatus').value,
    medication: document.getElementById('careResidentMedication').value,
    note: document.getElementById('careResidentNote').value,
    carePlan: document.getElementById('careResidentCarePlan').value,
    allergies: document.getElementById('careResidentAllergies').value,
    emergencyContact: document.getElementById('careResidentContact').value,
    vitals: {
      heartRate: document.getElementById('careHeartRate').value,
      bloodPressure: document.getElementById('careBloodPressure').value,
      oxygen: document.getElementById('careOxygen').value,
      temperature: document.getElementById('careTemperature').value
    },
    chartData
  };

  const response = await fetch(`/api/residents/${residentId}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Save Client Details';
    }
    alert(result.message || 'Unable to save client details.');
    return;
  }

  const updatedAssignment = {
    id: result.resident.id,
    name: result.resident.name,
    age: result.resident.age,
    room: result.resident.room,
    medication: result.resident.medication,
    status: result.resident.status === 'Critical' ? 'Priority' : result.resident.status === 'Observation' ? 'Monitoring' : 'Care Active',
    note: result.resident.note,
    allergies: result.resident.allergies,
    emergencyContact: result.resident.emergencyContact,
    carePlan: result.resident.carePlan,
    medications: result.resident.medications,
    sensorAlerts: result.resident.sensorAlerts,
    vitals: result.resident.vitals,
    chartData: result.resident.chartData
  };

  data.caregiverAssignments = (data.caregiverAssignments || []).map(item => item.id === residentId ? updatedAssignment : item);
  renderCaregiverResidentList(data, data.caregiverAssignments, residentId);
  renderCaregiverResidentActions(data, residentId, 'details');

  const modalPanel = document.getElementById('caregiverResidentEditModalPanel');
  if (modalPanel) {
    renderCaregiverEditForm(data, updatedAssignment, modalPanel, true);
  }
  const savedMessage = document.getElementById('careResidentSaveMessage');
  if (savedMessage) {
    savedMessage.textContent = 'Client details saved.';
  }
}

function renderFamilyDashboard(data) {
  const linkedResidents = data.linkedResidents || [];
  const cards = document.getElementById('familyCards');
  if (cards) {
    cards.innerHTML = linkedResidents.map(resident => `
      <div class="card">
        <h3>${escapeHtml(resident.name)}</h3>
        <p class="note">Room ${escapeHtml(resident.room)}<br>Wellness update: ${escapeHtml(resident.note)}<br>Medication status: ${escapeHtml(resident.medication)}</p>
        <button class="btn" type="button" data-family-resident="${resident.id}">View Full Update</button>
      </div>
    `).join('') || '<div class="card"><p class="note">No linked resident is available for this family account.</p></div>';

    cards.querySelectorAll('[data-family-resident]').forEach(button => {
      button.addEventListener('click', () => showFamilyResidentUpdate(data, Number(button.dataset.familyResident)));
    });
  }

  const updates = document.getElementById('familyNotifications');
  updates.innerHTML = data.familyUpdates.map(item => `
    <div class="alert-item"><div><strong>${escapeHtml(item.resident)}</strong><br><span class="note">${escapeHtml(item.note)}</span></div><span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span></div>
  `).join('') || '<p class="note">No notifications for your linked resident yet.</p>';

  renderFamilyMessagePanel(data, 'family');
}

function showFamilyResidentUpdate(data, residentId) {
  const resident = (data.linkedResidents || []).find(item => item.id === residentId);
  if (!resident) return;

  const residentAlerts = getResidentAlerts(resident, data);
  const notifications = (data.familyUpdates || []).filter(update => update.resident === resident.name);

  document.querySelectorAll('.modal-bg').forEach(modal => modal.remove());
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-bg" id="familyResidentUpdateModal" role="dialog" aria-modal="true">
      <div class="modal-box resident-update-modal">
        <div class="panel-top" style="margin-bottom:14px;">
          <div>
            <h2 style="margin:0">${escapeHtml(resident.name)}</h2>
            <p class="note">Room ${escapeHtml(resident.room)} - latest family update</p>
          </div>
          <span class="status ${statusClass(resident.status)}">${escapeHtml(resident.status)}</span>
        </div>
        <div class="grid grid-2">
          <div>
            <h3>Care Summary</h3>
            <div class="space-y">
              <div class="mini-item"><span>Medication</span><strong>${escapeHtml(resident.medication)}</strong></div>
              <div class="mini-item"><span>Care Plan</span><strong>${escapeHtml(resident.carePlan || resident.note)}</strong></div>
              <div class="mini-item"><span>Emergency Contact</span><strong>${escapeHtml(resident.emergencyContact || 'Not recorded')}</strong></div>
            </div>
          </div>
          <div>
            <h3>Vitals</h3>
            <div class="vitals-grid">
              <div class="mini-item"><span>Heart Rate</span><strong>${escapeHtml((resident.vitals || {}).heartRate || '-')} bpm</strong></div>
              <div class="mini-item"><span>Blood Pressure</span><strong>${escapeHtml((resident.vitals || {}).bloodPressure || '-')}</strong></div>
              <div class="mini-item"><span>Oxygen</span><strong>${escapeHtml((resident.vitals || {}).oxygen || '-')}%</strong></div>
              <div class="mini-item"><span>Temperature</span><strong>${escapeHtml((resident.vitals || {}).temperature || '-')} C</strong></div>
            </div>
          </div>
        </div>
        <div class="grid grid-2" style="margin-top:18px;">
          <div>
            <h3>Medications</h3>
            <div class="space-y">
              ${(resident.medications || []).map(medication => `
                <div class="alert-item">
                  <div><strong>${escapeHtml(medication.name)}</strong><br><span class="note">${escapeHtml(medication.dosage)} - ${escapeHtml(medication.time)}</span></div>
                  <span class="status ${statusClass(medication.status)}">${escapeHtml(medication.status)}</span>
                </div>
              `).join('') || '<p class="note">No medications recorded.</p>'}
            </div>
          </div>
          <div>
            <h3>Notifications</h3>
            <div class="space-y">
              ${notifications.map(update => `
                <div class="alert-item">
                  <div><strong>${escapeHtml(update.resident)}</strong><br><span class="note">${escapeHtml(update.note)}</span></div>
                  <span class="status ${statusClass(update.status)}">${escapeHtml(update.status)}</span>
                </div>
              `).join('') || '<p class="note">No notifications yet.</p>'}
            </div>
          </div>
        </div>
        <div style="margin-top:18px;">
          <h3>Alerts</h3>
          <div class="space-y">
            ${residentAlerts.map(alert => `
              <div class="alert-item">
                <div><strong>${escapeHtml(alert.type || 'Care Alert')}</strong><br><span class="note">${escapeHtml(alert.message || alert.issue)}</span><br><small class="note">${escapeHtml(alert.time || 'Today')}</small></div>
                <span class="status ${statusClass(alert.level)}">${escapeHtml(alert.level)}</span>
              </div>
            `).join('') || '<p class="note">No active alerts for this resident.</p>'}
          </div>
        </div>
        <div style="margin-top:18px;display:flex;justify-content:flex-end;">
          <button class="btn" type="button" id="closeFamilyResidentUpdate">Close</button>
        </div>
      </div>
    </div>
  `);

  document.getElementById('closeFamilyResidentUpdate').addEventListener('click', () => {
    document.getElementById('familyResidentUpdateModal').remove();
  });
}

function renderResidentDashboard(data) {
  document.getElementById('healthStatusText').textContent = data.residentInfo.healthStatus;
  document.getElementById('nextMedicationText').textContent = data.residentInfo.nextMedication;
  document.getElementById('remindersText').textContent = data.residentInfo.reminders;
  document.getElementById('familyContactText').textContent = data.residentInfo.familyContact;
  setupResidentSummaryCards(data);

  const scheduleList = document.getElementById('residentScheduleList');
  scheduleList.innerHTML = data.schedule.map(item => `
    ${renderScheduleMiniItem(item)}
  `).join('');

  const actionsContainer = document.getElementById('residentActions');
  actionsContainer.innerHTML = data.residentInfo.quickActions.map(action => `
    <button class="btn ${action.type === 'primary' ? '' : action.type === 'secondary' ? 'btn-outline' : ''}" type="button" data-resident-action="${escapeHtml(action.label)}" style="${action.type === 'danger' ? 'background:#ef4444;' : ''}">${action.label}</button>
  `).join('');
  setupResidentQuickActions(data);
}

function setupResidentSummaryCards(data) {
  const details = [
    {
      id: 'healthStatusText',
      title: 'Health Status',
      detail: residentHealthDetail(data)
    },
    {
      id: 'nextMedicationText',
      title: 'Next Medication',
      detail: residentMedicationDetail(data)
    },
    {
      id: 'remindersText',
      title: 'Reminders',
      detail: residentReminderDetail(data)
    },
    {
      id: 'familyContactText',
      title: 'Family Contact',
      detail: residentFamilyContactDetail(data)
    }
  ];

  details.forEach(item => {
    const textNode = document.getElementById(item.id);
    const card = textNode && textNode.closest('.card');
    if (!card) return;
    card.classList.add('clickable-card');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', () => showResidentDetailModal(item.title, item.detail));
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showResidentDetailModal(item.title, item.detail);
      }
    });
  });
}

function setupResidentQuickActions(data) {
  document.querySelectorAll('[data-resident-action]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.residentAction;
      if (action === 'Call Caregiver') {
        showCallCaregiverModal(data);
      } else if (action === 'View Medication') {
        showResidentDetailModal('Medication Details', residentMedicationDetail(data));
      } else if (action === 'Open Messages') {
        showResidentMessagesModal(data);
      } else if (action === 'Emergency Help') {
        showEmergencyHelpModal(data);
      }
    });
  });
}

function showEmergencyHelpModal(data) {
  const resident = (data.linkedResidents || [])[0] || {};
  document.querySelectorAll('.modal-bg').forEach(modal => modal.remove());
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-bg" id="emergencyHelpModal" role="dialog" aria-modal="true">
      <div class="modal-box">
        <h2>Emergency Help</h2>
        <p class="note">Use this if urgent help is needed. The care team and admin will be contacted immediately.</p>
        <div class="space-y">
          <button class="mini-item care-desk-button emergency-desk-button" type="button" id="emergencyDeskRequestButton">
            <span>Emergency Desk</span>
            <strong>Send emergency alert</strong>
          </button>
          <div class="mini-item"><span>Emergency Phone</span><strong>+61 400 123 456</strong></div>
          <div class="mini-item"><span>Room</span><strong>${escapeHtml(resident.room || 'Resident room')}</strong></div>
        </div>
        <p class="success" id="emergencyDeskRequestMessage" aria-live="polite"></p>
        <div style="margin-top:18px;display:flex;justify-content:flex-end;">
          <button class="btn" type="button" id="closeEmergencyHelpModal">Close</button>
        </div>
      </div>
    </div>
  `);

  document.getElementById('emergencyDeskRequestButton').addEventListener('click', () => sendEmergencyDeskRequest(data));
  document.getElementById('closeEmergencyHelpModal').addEventListener('click', () => {
    document.getElementById('emergencyHelpModal').remove();
  });
}

async function sendEmergencyDeskRequest(data) {
  const button = document.getElementById('emergencyDeskRequestButton');
  const message = document.getElementById('emergencyDeskRequestMessage');
  if (button) button.disabled = true;

  const response = await fetch('/api/emergency-requests', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }
  });
  const result = await response.json();

  if (!response.ok || !result.success) {
    if (button) button.disabled = false;
    alert(result.message || 'Unable to send emergency alert.');
    return;
  }

  data.alerts = [result.alert, ...(data.alerts || [])];
  if (message) {
    message.textContent = 'Emergency alert sent to caregiver and admin alerts.';
  }
}

function showCallCaregiverModal(data) {
  const resident = (data.linkedResidents || [])[0] || {};
  document.querySelectorAll('.modal-bg').forEach(modal => modal.remove());
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-bg" id="callCaregiverModal" role="dialog" aria-modal="true">
      <div class="modal-box">
        <h2>Call Caregiver</h2>
        <p class="note">Caregiver support is available from the care desk.</p>
        <div class="space-y">
          <button class="mini-item care-desk-button" type="button" id="careDeskRequestButton">
            <span>Care Desk</span>
            <strong>Request caregiver</strong>
          </button>
          <div class="mini-item"><span>Care Desk Phone</span><strong>+61 400 123 456</strong></div>
          <div class="mini-item"><span>Resident Room</span><strong>${escapeHtml(resident.room || 'Resident room')}</strong></div>
          <div class="mini-item"><span>Current Schedule</span><strong>${escapeHtml((data.schedule || [])[0] ? data.schedule[0].label : 'Daily care round')}</strong></div>
        </div>
        <p class="success" id="careDeskRequestMessage" aria-live="polite"></p>
        <div style="margin-top:18px;display:flex;justify-content:flex-end;">
          <button class="btn" type="button" id="closeCallCaregiverModal">Close</button>
        </div>
      </div>
    </div>
  `);

  document.getElementById('careDeskRequestButton').addEventListener('click', () => sendCareDeskRequest(data));
  document.getElementById('closeCallCaregiverModal').addEventListener('click', () => {
    document.getElementById('callCaregiverModal').remove();
  });
}

async function sendCareDeskRequest(data) {
  const button = document.getElementById('careDeskRequestButton');
  const message = document.getElementById('careDeskRequestMessage');
  if (button) button.disabled = true;

  const response = await fetch('/api/care-requests', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }
  });
  const result = await response.json();

  if (!response.ok || !result.success) {
    if (button) button.disabled = false;
    alert(result.message || 'Unable to request caregiver help.');
    return;
  }

  data.alerts = [result.alert, ...(data.alerts || [])];
  if (message) {
    message.textContent = 'Caregiver has been notified in alerts.';
  }
}

function residentHealthDetail(data) {
  const resident = (data.linkedResidents || [])[0] || {};
  const vitals = resident.vitals || {};
  const alerts = getResidentAlerts(resident, data);
  return `
    <p class="note">${escapeHtml(resident.note || data.residentInfo.healthStatus)}</p>
    <div class="vitals-grid">
      <div class="mini-item"><span>Heart Rate</span><strong>${escapeHtml(vitals.heartRate || '-')} bpm</strong></div>
      <div class="mini-item"><span>Blood Pressure</span><strong>${escapeHtml(vitals.bloodPressure || '-')}</strong></div>
      <div class="mini-item"><span>Oxygen</span><strong>${escapeHtml(vitals.oxygen || '-')}%</strong></div>
      <div class="mini-item"><span>Temperature</span><strong>${escapeHtml(vitals.temperature || '-')} C</strong></div>
    </div>
    <h3>Recent Alerts</h3>
    <div class="space-y">
      ${alerts.map(alert => `<div class="alert-item"><div><strong>${escapeHtml(alert.type || 'Care Alert')}</strong><br><span class="note">${escapeHtml(alert.message || alert.issue)}</span></div><span class="status ${statusClass(alert.level)}">${escapeHtml(alert.level)}</span></div>`).join('') || '<p class="note">No active alerts.</p>'}
    </div>
  `;
}

function residentMedicationDetail(data) {
  const resident = (data.linkedResidents || [])[0] || {};
  return `
    <p class="note">${escapeHtml(data.residentInfo.nextMedication)}</p>
    <div class="space-y">
      ${(resident.medications || []).map(medication => `
        <div class="alert-item">
          <div><strong>${escapeHtml(medication.name)}</strong><br><span class="note">${escapeHtml(medication.dosage)} - ${escapeHtml(medication.time)}</span></div>
          <span class="status ${statusClass(medication.status)}">${escapeHtml(medication.status)}</span>
        </div>
      `).join('') || '<p class="note">No medication schedule recorded.</p>'}
    </div>
  `;
}

function residentReminderDetail(data) {
  return `
    <p class="note">${escapeHtml(data.residentInfo.reminders)}</p>
    <div class="space-y">
      ${(data.schedule || []).map(item => renderScheduleMiniItem(item)).join('')}
    </div>
  `;
}

function residentFamilyContactDetail(data) {
  const resident = (data.linkedResidents || [])[0] || {};
  return `
    <p class="note">Family and emergency contact information for this resident.</p>
    <div class="space-y">
      <div class="mini-item"><span>Primary Contact</span><strong>${escapeHtml(data.residentInfo.familyContact)}</strong></div>
      <div class="mini-item"><span>Resident</span><strong>${escapeHtml(resident.name || 'Resident')}</strong></div>
      <div class="mini-item"><span>Room</span><strong>${escapeHtml(resident.room || '-')}</strong></div>
    </div>
  `;
}

function renderScheduleMiniItem(item) {
  return `
    <div class="mini-item">
      <span>${escapeHtml(item.time)} - ${escapeHtml(item.label)}</span>
      <span>
        <span class="status ${statusClass(item.status || 'Pending')}">${escapeHtml(item.status || 'Pending')}</span>
        ${item.completedBy ? `<small class="note"> by ${escapeHtml(item.completedBy)}</small>` : ''}
      </span>
    </div>
  `;
}

function renderScheduleRows(schedule, options = {}) {
  return (schedule || []).map(item => `
    <div class="alert-item schedule-row ${item.status === 'Completed' ? 'schedule-done' : ''}">
      <div>
        <strong>${escapeHtml(item.time)}</strong><br>
        <span>${escapeHtml(item.label)}</span>
        ${item.details ? `<br><span class="note">${escapeHtml(item.details)}</span>` : ''}
        ${item.resident ? `<br><small class="note">For ${escapeHtml(item.resident)}</small>` : ''}
        ${item.completedAt ? `<br><small class="note">Completed by ${escapeHtml(item.completedBy)} - ${formatRecordTime(item.completedAt)}</small>` : ''}
      </div>
      <div class="schedule-actions">
        <span class="status ${statusClass(item.status || 'Pending')}">${escapeHtml(item.status || 'Pending')}</span>
        ${options.canComplete ? `<button class="view-btn" type="button" data-schedule-done="${item.id}" ${item.status === 'Completed' ? 'disabled' : ''}>${item.status === 'Completed' ? 'Done' : 'Mark Done'}</button>` : ''}
      </div>
    </div>
  `).join('') || '<p class="note">No schedule items available.</p>';
}

function attachScheduleDoneHandlers(data) {
  document.querySelectorAll('[data-schedule-done]').forEach(button => {
    button.addEventListener('click', () => markScheduleDone(data, Number(button.dataset.scheduleDone)));
  });
}

async function markScheduleDone(data, scheduleId) {
  const response = await fetch(`/api/schedule/${scheduleId}/done`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    alert(result.message || 'Unable to complete schedule item.');
    return;
  }

  data.schedule = result.schedule;
  renderCaregiverScheduleSection(data);
}

function showResidentDetailModal(title, detailHtml) {
  document.querySelectorAll('.modal-bg').forEach(modal => modal.remove());
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-bg" id="residentSummaryModal" role="dialog" aria-modal="true">
      <div class="modal-box resident-update-modal">
        <h2>${escapeHtml(title)}</h2>
        <div>${detailHtml}</div>
        <div style="margin-top:18px;display:flex;justify-content:flex-end;">
          <button class="btn" type="button" id="closeResidentSummaryModal">Close</button>
        </div>
      </div>
    </div>
  `);
  document.getElementById('closeResidentSummaryModal').addEventListener('click', () => {
    document.getElementById('residentSummaryModal').remove();
  });
}

function showResidentMessagesModal(data) {
  document.querySelectorAll('.modal-bg').forEach(modal => modal.remove());
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-bg" id="residentMessagesModal" role="dialog" aria-modal="true">
      <div class="modal-box resident-update-modal">
        <div id="residentMessagesModalContent"></div>
      </div>
    </div>
  `);
  renderFamilyMessagePanel(data, 'resident', {
    container: document.getElementById('residentMessagesModalContent'),
    modal: true
  });
}

function renderFamilyMessagePanel(data, viewerRole, options = {}) {
  const container = options.container || document.querySelector('.page .container');
  if (!container) return;

  const existing = document.getElementById('familyMessagePanel');
  if (existing) existing.remove();

  const linkedResident = (data.linkedResidents || [])[0];
  if (!linkedResident) return;

  const familyOptions = viewerRole === 'resident'
    ? [...new Map((data.familyMessages || []).map(message => [message.familyEmail, message])).values()]
    : [];
  const defaultFamilyEmail = viewerRole === 'resident' && familyOptions[0] ? familyOptions[0].familyEmail : '';

  container.insertAdjacentHTML('beforeend', `
    <section class="card" id="familyMessagePanel" style="margin-top:22px;">
      <div class="panel-top" style="margin-bottom:12px;">
        <div>
          <h2 style="margin:0">Messages</h2>
          <p class="note">${viewerRole === 'family' ? `Message ${escapeHtml(linkedResident.name)} directly.` : 'Reply to linked family members.'}</p>
        </div>
        ${options.modal ? '<button class="btn btn-outline" type="button" id="closeMessagePanel">Close</button>' : ''}
      </div>
      <div class="message-thread" id="familyMessageThread">
        ${(data.familyMessages || []).map(message => `
          <div class="message-bubble ${message.senderRole === viewerRole ? 'own' : ''}">
            <strong>${escapeHtml(message.senderName)}</strong>
            <p>${escapeHtml(message.message)}</p>
            <small>${formatRecordTime(message.createdAt)}</small>
          </div>
        `).join('') || '<p class="note">No messages yet.</p>'}
      </div>
      <form id="familyMessageForm" class="message-form">
        <input id="familyMessageResident" type="hidden" value="${linkedResident.id}">
        ${viewerRole === 'resident' ? `
          <div class="form-group">
            <label for="familyMessageRecipient">Family Member</label>
            <select id="familyMessageRecipient" ${familyOptions.length ? '' : 'disabled'}>
              ${familyOptions.map(option => `<option value="${escapeHtml(option.familyEmail)}">${escapeHtml(option.familyEmail)}</option>`).join('')}
            </select>
          </div>
        ` : `<input id="familyMessageRecipient" type="hidden" value="${escapeHtml(defaultFamilyEmail)}">`}
        <div class="form-group">
          <label for="familyMessageText">Message</label>
          <textarea id="familyMessageText" required placeholder="Write a message"></textarea>
        </div>
        <button class="btn" type="submit" ${viewerRole === 'resident' && !familyOptions.length ? 'disabled' : ''}>Send Message</button>
        <p class="success" id="familyMessageStatus" aria-live="polite"></p>
      </form>
    </section>
  `);

  const closeButton = document.getElementById('closeMessagePanel');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      const modal = document.getElementById('residentMessagesModal');
      if (modal) modal.remove();
    });
  }

  document.getElementById('familyMessageForm').addEventListener('submit', event => submitFamilyMessage(event, data, viewerRole));
}

async function submitFamilyMessage(event, data, viewerRole) {
  event.preventDefault();

  const payload = {
    residentId: document.getElementById('familyMessageResident').value,
    familyEmail: document.getElementById('familyMessageRecipient').value,
    message: document.getElementById('familyMessageText').value
  };

  const response = await fetch('/api/messages', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    alert(result.message || 'Unable to send message.');
    return;
  }

  data.familyMessages = [...(data.familyMessages || []), result.message];
  if (viewerRole === 'resident' && document.getElementById('residentMessagesModal')) {
    showResidentMessagesModal(data);
  } else {
    renderFamilyMessagePanel(data, viewerRole);
  }
  const status = document.getElementById('familyMessageStatus');
  if (status) status.textContent = 'Message sent.';
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
    currentCaregiverShift = data.currentCaregiverShift || null;
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
    link.addEventListener('click', async (e) => {
      if (link.classList.contains('residents')) {
        return;
      }

      e.preventDefault();
      if (!link.classList.contains('shift-nav') && currentCaregiverShift && currentCaregiverShift.status !== 'Working') {
        alert('Please start your shift before opening caregiver work areas.');
        renderCaregiverShiftDashboard(data);
        return;
      }
      document.querySelectorAll('.sidebar a').forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      if (link.classList.contains('medication')) {
        showSection('medication');
      } else if (link.classList.contains('caregivers')) {
        renderAdminCaregiversSection(adminDashboardData);
      } else if (link.classList.contains('alerts')) {
        const refreshedData = await fetchDashboardData();
        if (refreshedData) {
          adminDashboardData = refreshedData;
        }
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

function formatShiftDateTime(value) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function shiftDuration(startedAt, endedAt) {
  if (!startedAt) return '0 min';
  const end = endedAt ? new Date(endedAt) : new Date();
  const minutes = Math.max(0, Math.round((end - new Date(startedAt)) / 60000));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
}

function caregiverShiftStatusClass(status) {
  return String(status || '').toLowerCase() === 'working' ? 'completed' : 'scheduled';
}

function renderCaregiverPresenceTable(caregivers) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Caregiver</th><th>Area</th><th>Status</th><th>Working Time</th><th>Duration</th></tr>
        </thead>
        <tbody>
          ${(caregivers || []).map(caregiver => `
            <tr>
              <td><strong>${escapeHtml(caregiver.name)}</strong><br><small class="note">${escapeHtml(caregiver.email)}</small></td>
              <td>${escapeHtml(caregiver.assignedArea || 'General Care')}</td>
              <td><span class="status ${caregiverShiftStatusClass(caregiver.status)}">${escapeHtml(caregiver.status)}</span></td>
              <td>${escapeHtml(caregiver.shiftLabel || 'Not scheduled')}</td>
              <td>${caregiver.startedAt ? escapeHtml(shiftDuration(caregiver.startedAt, caregiver.endedAt)) : '-'}</td>
            </tr>
          `).join('') || '<tr><td colspan="5">No caregivers have been onboarded yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminCaregiversSection(data) {
  const main = document.querySelector('.dashboard-content');
  if (!main || !data) return;

  const caregivers = data.caregiverStatus || [];
  const activeCount = caregivers.filter(caregiver => caregiver.status === 'Working').length;
  const offDutyCount = Math.max(0, caregivers.length - activeCount);
  const openShiftCount = (data.openShifts || []).filter(shift => !shift.assignedStaffId && shift.status !== 'Cancelled').length;

  main.innerHTML = `
    <div class="card panel-top">
      <div>
        <h1 style="margin:0">Caregivers</h1>
        <p class="note">See who is present, where they are assigned, and when their shift started or finished.</p>
      </div>
    </div>
    <div class="stats-grid caregiver-filter-grid">
      ${renderCaregiverStatButton('working', 'Working Now', activeCount, 'ON', true)}
      ${renderCaregiverStatButton('off', 'Off Duty', offDutyCount, 'OFF')}
      ${renderCaregiverStatButton('total', 'Total Caregivers', caregivers.length, 'CG')}
      ${renderCaregiverStatButton('open', 'Open Shifts', openShiftCount, 'HR')}
    </div>
    <div id="caregiverListPanel"></div>
  `;

  main.querySelectorAll('[data-caregiver-view]').forEach(button => {
    button.addEventListener('click', () => renderAdminCaregiverList(data, button.dataset.caregiverView));
  });

  renderAdminCaregiverList(data, 'working');
}

function renderCaregiverStatButton(view, label, count, icon, active) {
  return `
    <button class="card stat-card stat-button ${active ? 'active' : ''}" type="button" data-caregiver-view="${view}">
      <div><h3>${label}</h3><strong>${count}</strong></div>
      <div class="icon-box">${icon}</div>
    </button>
  `;
}

function setCaregiverStatActive(view) {
  document.querySelectorAll('[data-caregiver-view]').forEach(button => {
    button.classList.toggle('active', button.dataset.caregiverView === view);
  });
}

function renderAdminCaregiverList(data, view) {
  const panel = document.getElementById('caregiverListPanel');
  if (!panel) return;

  const caregivers = data.caregiverStatus || [];
  const list = view === 'working'
    ? caregivers.filter(caregiver => caregiver.status === 'Working')
    : view === 'off'
      ? caregivers.filter(caregiver => caregiver.status !== 'Working')
      : caregivers;

  setCaregiverStatActive(view);

  if (view === 'open') {
    renderOpenShiftList(panel, data);
    return;
  }

  const titles = {
    working: 'Working Now',
    off: 'Off Duty Caregivers',
    total: 'Total Caregivers'
  };

  panel.innerHTML = `
    <div class="card" style="margin-top:22px;">
      <h2>${titles[view] || 'Caregivers'}</h2>
      ${renderCaregiverPresenceTable(list)}
    </div>
    <div class="card" style="margin-top:22px;">
      <h2>Recent Shift History</h2>
      <div class="space-y">
        ${(data.shiftHistory || []).slice(0, 6).map(shift => `
          <div class="mini-item">
            <span><strong>${escapeHtml(shift.caregiverName)}</strong><br><small class="note">${escapeHtml(shift.assignedArea)} - ${escapeHtml(shift.status)}${shift.day ? ` - ${escapeHtml(shift.day)}` : ''}</small>${shift.details ? `<br><small class="note">${escapeHtml(shift.details)}</small>` : ''}</span>
            <span>${formatShiftDateTime(shift.startedAt)} - ${shift.endedAt ? formatShiftDateTime(shift.endedAt) : 'Now'}</span>
            <span class="schedule-actions">
              <button class="view-btn" type="button" data-edit-history-shift="${shift.id}">Edit</button>
              <button class="review-btn danger-action" type="button" data-cancel-history-shift="${shift.id}">Cancel</button>
            </span>
          </div>
        `).join('') || '<p class="note">No shift history yet.</p>'}
      </div>
    </div>
  `;

  panel.querySelectorAll('[data-edit-history-shift]').forEach(button => {
    button.addEventListener('click', () => showShiftHistoryEditor(data, Number(button.dataset.editHistoryShift)));
  });
  panel.querySelectorAll('[data-cancel-history-shift]').forEach(button => {
    button.addEventListener('click', () => cancelShiftHistory(data, Number(button.dataset.cancelHistoryShift)));
  });
}

function renderOpenShiftList(panel, data, selectedShiftId) {
  const shifts = data.openShifts || [];
  const caregivers = data.caregiverStatus || [];
  const selectedShift = shifts.find(shift => shift.id === selectedShiftId) || shifts.find(shift => !shift.assignedStaffId) || shifts[0];

  panel.innerHTML = `
    <div class="grid onboard-grid" style="margin-top:22px;">
      <div class="card">
        <h2>Open Shift List</h2>
        <div class="space-y">
          ${shifts.map(shift => {
            const assigned = caregivers.find(caregiver => caregiver.id === shift.assignedStaffId);
            return `
              <button class="shift-list-item ${selectedShift && selectedShift.id === shift.id ? 'active' : ''}" type="button" data-select-shift="${shift.id}">
                <span><strong>${escapeHtml(shift.title)}</strong><br><small>${escapeHtml(shift.day || 'Today')} - ${escapeHtml(shift.assignedArea)} - ${escapeHtml(shift.plannedShift)}</small>${shift.details ? `<br><small>${escapeHtml(shift.details)}</small>` : ''}${renderShiftClientsSummary(data, shift)}</span>
                <span class="status ${shift.status === 'Cancelled' ? 'critical' : assigned ? 'completed' : 'pending'}">${shift.status === 'Cancelled' ? 'Cancelled' : assigned ? escapeHtml(assigned.name) : 'Open'}</span>
              </button>
            `;
          }).join('') || '<p class="note">No shifts configured yet.</p>'}
        </div>
      </div>
      <form class="card" id="assignShiftForm">
        <h2>Assign Shift</h2>
        ${selectedShift ? `
          <input id="assignShiftId" type="hidden" value="${escapeHtml(selectedShift.id)}">
          <div class="form-group" style="margin-top:16px;">
            <label for="assignShiftTitle">Shift Title</label>
            <input id="assignShiftTitle" value="${escapeHtml(selectedShift.title || '')}" required>
          </div>
          <div class="form-group">
            <label for="assignDay">Day</label>
            <input id="assignDay" value="${escapeHtml(selectedShift.day || 'Today')}" placeholder="Today, Tomorrow, Monday" required>
          </div>
          <div class="form-group" style="margin-top:16px;">
            <label for="assignStaffId">Caregiver</label>
            <select id="assignStaffId" required>
              <option value="">Choose caregiver</option>
              ${caregivers.map(caregiver => `<option value="${escapeHtml(caregiver.id)}" ${selectedShift.assignedStaffId === caregiver.id ? 'selected' : ''}>${escapeHtml(caregiver.name)} - ${escapeHtml(caregiver.status)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="assignArea">Area</label>
            <input id="assignArea" value="${escapeHtml(selectedShift.assignedArea || '')}" required>
          </div>
          <div class="form-group">
            <label for="assignTime">Shift Time</label>
            <input id="assignTime" value="${escapeHtml(selectedShift.plannedShift || '')}" placeholder="07:00 AM - 03:00 PM" required>
          </div>
          <div class="form-group">
            <label for="assignDetails">Details</label>
            <textarea id="assignDetails" placeholder="Shift notes, handover details, care focus">${escapeHtml(selectedShift.details || '')}</textarea>
          </div>
          <div class="form-group">
            <label>Assigned Clients</label>
            <div class="client-checklist">
              ${(data.residents || []).map(resident => `
                <label class="client-check">
                  <input type="checkbox" value="${resident.id}" data-assign-client ${selectedShift.assignedResidentIds && selectedShift.assignedResidentIds.includes(resident.id) ? 'checked' : ''}>
                  <span>${escapeHtml(resident.name)} <small>Room ${escapeHtml(resident.room)}</small></span>
                </label>
              `).join('')}
            </div>
          </div>
          <div class="shift-actions">
            <button class="btn" type="submit">Save Shift</button>
            <button class="btn btn-outline danger-outline" type="button" id="cancelOpenShiftButton">Cancel Shift</button>
          </div>
          <p class="success" id="assignShiftMessage" aria-live="polite"></p>
        ` : '<p class="note">Add an open shift before assigning staff.</p>'}
      </form>
    </div>
  `;

  panel.querySelectorAll('[data-select-shift]').forEach(button => {
    button.addEventListener('click', () => renderOpenShiftList(panel, data, button.dataset.selectShift));
  });

  const form = document.getElementById('assignShiftForm');
  if (form && selectedShift) {
    form.addEventListener('submit', event => submitShiftAssignment(event, data));
    document.getElementById('cancelOpenShiftButton').addEventListener('click', () => cancelOpenShift(data, selectedShift.id));
  }
}

function renderShiftClientsSummary(data, shift) {
  const ids = shift.assignedResidentIds || [];
  if (!ids.length) return '';
  const names = ids
    .map(id => (data.residents || []).find(resident => resident.id === id))
    .filter(Boolean)
    .map(resident => resident.name);
  return names.length ? `<br><small>Clients: ${escapeHtml(names.join(', '))}</small>` : '';
}

async function submitShiftAssignment(event, data) {
  event.preventDefault();

  const payload = {
    shiftId: document.getElementById('assignShiftId').value,
    title: document.getElementById('assignShiftTitle').value,
    day: document.getElementById('assignDay').value,
    staffId: document.getElementById('assignStaffId').value,
    assignedArea: document.getElementById('assignArea').value,
    plannedShift: document.getElementById('assignTime').value,
    details: document.getElementById('assignDetails').value,
    residentIds: Array.from(document.querySelectorAll('[data-assign-client]:checked')).map(input => Number(input.value))
  };

  const response = await fetch('/api/shifts/assign', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    alert(result.message || 'Unable to assign shift.');
    return;
  }

  data.openShifts = result.openShifts || data.openShifts;
  data.staff = result.staffList || data.staff;
  data.caregiverStatus = (data.caregiverStatus || []).map(caregiver => caregiver.id === result.staff.id ? result.staff : caregiver);
  renderAdminCaregiversSection(data);
  renderAdminCaregiverList(data, 'open');
  const message = document.getElementById('assignShiftMessage');
  if (message) {
    message.textContent = `${result.staff.name} has been assigned to ${payload.plannedShift}.`;
  }
}

async function cancelOpenShift(data, shiftId) {
  if (!confirm('Cancel this shift?')) return;
  const response = await fetch(`/api/open-shifts/${encodeURIComponent(shiftId)}`, {
    method: 'DELETE',
    credentials: 'same-origin'
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    alert(result.message || 'Unable to cancel shift.');
    return;
  }
  data.openShifts = result.openShifts || data.openShifts;
  data.staff = result.staffList || data.staff;
  renderAdminCaregiversSection(data);
  renderAdminCaregiverList(data, 'open');
}

function showShiftHistoryEditor(data, shiftId) {
  const shift = (data.shiftHistory || []).find(item => item.id === shiftId);
  if (!shift) return;
  document.querySelectorAll('.modal-bg').forEach(modal => modal.remove());
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-bg" id="shiftHistoryEditorModal" role="dialog" aria-modal="true">
      <div class="modal-box">
        <h2>Edit Shift</h2>
        <form id="shiftHistoryEditorForm">
          <div class="form-group"><label for="historyShiftDay">Day</label><input id="historyShiftDay" value="${escapeHtml(shift.day || 'Today')}" required></div>
          <div class="form-group"><label for="historyShiftArea">Area</label><input id="historyShiftArea" value="${escapeHtml(shift.assignedArea || '')}" required></div>
          <div class="form-group"><label for="historyShiftStarted">Started</label><input id="historyShiftStarted" value="${escapeHtml(shift.startedAt || '')}" required></div>
          <div class="form-group"><label for="historyShiftEnded">Ended</label><input id="historyShiftEnded" value="${escapeHtml(shift.endedAt || '')}" placeholder="Leave blank if still working"></div>
          <div class="form-group"><label for="historyShiftStatus">Status</label><select id="historyShiftStatus"><option ${shift.status === 'Working' ? 'selected' : ''}>Working</option><option ${shift.status === 'Completed' ? 'selected' : ''}>Completed</option><option ${shift.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option></select></div>
          <div class="form-group"><label for="historyShiftDetails">Details</label><textarea id="historyShiftDetails">${escapeHtml(shift.details || '')}</textarea></div>
          <div class="shift-actions">
            <button class="btn" type="submit">Save Shift</button>
            <button class="btn btn-outline" type="button" id="closeShiftHistoryEditor">Close</button>
          </div>
        </form>
      </div>
    </div>
  `);
  document.getElementById('closeShiftHistoryEditor').addEventListener('click', () => document.getElementById('shiftHistoryEditorModal').remove());
  document.getElementById('shiftHistoryEditorForm').addEventListener('submit', event => submitShiftHistoryEdit(event, data, shiftId));
}

async function submitShiftHistoryEdit(event, data, shiftId) {
  event.preventDefault();
  const payload = {
    day: document.getElementById('historyShiftDay').value,
    assignedArea: document.getElementById('historyShiftArea').value,
    startedAt: document.getElementById('historyShiftStarted').value,
    endedAt: document.getElementById('historyShiftEnded').value,
    status: document.getElementById('historyShiftStatus').value,
    details: document.getElementById('historyShiftDetails').value
  };
  const response = await fetch(`/api/shift-history/${shiftId}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    alert(result.message || 'Unable to save shift.');
    return;
  }
  data.shiftHistory = result.shiftHistory || data.shiftHistory;
  document.getElementById('shiftHistoryEditorModal').remove();
  renderAdminCaregiverList(data, 'working');
}

async function cancelShiftHistory(data, shiftId) {
  if (!confirm('Cancel this shift record?')) return;
  const response = await fetch(`/api/shift-history/${shiftId}`, {
    method: 'DELETE',
    credentials: 'same-origin'
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    alert(result.message || 'Unable to cancel shift.');
    return;
  }
  data.shiftHistory = result.shiftHistory || data.shiftHistory;
  renderAdminCaregiverList(data, 'working');
}

function renderCaregiverShiftDashboard(data) {
  const content = document.querySelector('.dashboard-content');
  if (!content) return;

  currentCaregiverShift = data.currentCaregiverShift || currentCaregiverShift;
  const shift = currentCaregiverShift || {};
  const isWorking = shift.status === 'Working';
  updateCaregiverShiftGate(isWorking);

  content.innerHTML = `
    <div class="card panel-top">
      <div>
        <h1 style="margin:0">My Shift</h1>
        <p class="note">Start your shift when you arrive and end it when your handover is complete.</p>
      </div>
      <span class="status ${caregiverShiftStatusClass(shift.status)}">${escapeHtml(shift.status || 'Off Duty')}</span>
    </div>
    <div class="grid ${isWorking ? 'onboard-grid' : ''}">
      <div class="card shift-card">
        <h2>${isWorking ? 'Shift in Progress' : 'Ready to Start'}</h2>
        <div class="shift-clock">${isWorking ? escapeHtml(shiftDuration(shift.startedAt)) : 'Off duty'}</div>
        <div class="space-y">
          <div class="mini-item"><span>Assigned Area</span><strong>${escapeHtml(shift.assignedArea || 'General Care')}</strong></div>
          <div class="mini-item"><span>Started</span><strong>${shift.startedAt ? formatShiftDateTime(shift.startedAt) : 'Not started'}</strong></div>
          <div class="mini-item"><span>Working Time</span><strong>${escapeHtml(shift.shiftLabel || 'No active shift')}</strong></div>
        </div>
        <div class="shift-actions">
          <button class="btn" id="startShiftButton" type="button" ${isWorking ? 'disabled' : ''}>Start Shift</button>
          <button class="btn btn-outline" id="endShiftButton" type="button" ${isWorking ? '' : 'disabled'}>End Shift</button>
        </div>
        <p class="success" id="shiftMessage" aria-live="polite"></p>
      </div>
      ${isWorking ? `<div class="card">
        <h2>Today's Focus</h2>
        <div class="space-y">
          ${(data.caregiverAssignments || []).slice(0, 4).map(resident => `
            <div class="alert-item">
              <div><strong>${escapeHtml(resident.name)}</strong><br><span class="note">Room ${escapeHtml(resident.room)} - ${escapeHtml(resident.medication)}</span></div>
              <span class="status ${statusClass(resident.status)}">${escapeHtml(resident.status)}</span>
            </div>
          `).join('')}
        </div>
      </div>` : ''}
    </div>
  `;

  document.getElementById('startShiftButton').addEventListener('click', () => updateCaregiverShift(data, 'start'));
  document.getElementById('endShiftButton').addEventListener('click', () => updateCaregiverShift(data, 'end'));
}

function updateCaregiverShiftGate(isWorking) {
  document.querySelectorAll('.sidebar a:not(.shift-nav)').forEach(link => {
    link.classList.toggle('shift-locked', !isWorking);
    link.setAttribute('aria-disabled', isWorking ? 'false' : 'true');
  });
}

async function updateCaregiverShift(data, action) {
  const response = await fetch(`/api/shifts/${action}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    alert(result.message || 'Unable to update shift.');
    return;
  }

  currentCaregiverShift = result.caregiver;
  data.currentCaregiverShift = result.caregiver;
  const existing = (data.caregiverStatus || []).filter(caregiver => caregiver.email !== result.caregiver.email);
  data.caregiverStatus = [result.caregiver, ...existing];
  renderCaregiverShiftDashboard(data);
  const message = document.getElementById('shiftMessage');
  if (message) {
    message.textContent = action === 'start' ? 'Shift started. Admin can see you are working now.' : 'Shift ended and saved for admin review.';
  }
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

function renderCaregiverScheduleSection(data) {
  const content = document.querySelector('.dashboard-content');
  if (!content) return;

  content.innerHTML = `
    <div class="card panel-top">
      <div><h1 style="margin:0">Care Schedule</h1><p class="note">Daily schedule for assigned residents.</p></div>
    </div>
    <div class="card" style="margin-top:22px;">
      <h2>Today's Schedule</h2>
      <div class="space-y">
        ${renderScheduleRows(data.schedule, { canComplete: true })}
      </div>
    </div>
  `;
  attachScheduleDoneHandlers(data);
}

function renderAdminScheduleSection(data) {
  const main = document.querySelector('.dashboard-content');
  if (!main) return;

  main.innerHTML = `
    <div class="card panel-top">
      <div><h1 style="margin:0">Schedules</h1><p class="note">Create and monitor care schedules for residents.</p></div>
    </div>

    <div class="grid onboard-grid" style="margin-top:22px;">
      <form class="card" id="adminScheduleForm">
        <h2>Create Schedule</h2>
        <div class="form-group">
          <label for="newScheduleTime">Time</label>
          <input id="newScheduleTime" placeholder="Example: 03:30 PM" required>
        </div>
        <div class="form-group">
          <label for="newScheduleTitle">Title</label>
          <input id="newScheduleTitle" placeholder="Example: Afternoon mobility walk" required>
        </div>
        <div class="form-group">
          <label for="newScheduleResident">Resident</label>
          <select id="newScheduleResident">
            <option value="">All residents</option>
            ${(data.residents || []).map(resident => `<option value="${resident.id}">${escapeHtml(resident.name)} - Room ${escapeHtml(resident.room)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="newScheduleDetails">Details</label>
          <textarea id="newScheduleDetails" placeholder="Add instructions for caregivers and residents"></textarea>
        </div>
        <button class="btn" type="submit">Create Schedule</button>
        <p class="success" id="scheduleCreateMessage" aria-live="polite"></p>
      </form>

      <div class="card">
        <h2>Today's Schedule</h2>
        <div class="space-y">
          ${renderScheduleRows(data.schedule)}
        </div>
      </div>
    </div>
  `;

  document.getElementById('adminScheduleForm').addEventListener('submit', event => submitAdminSchedule(event, data));
}

function renderAdminAlertsSection(data) {
  const main = document.querySelector('.dashboard-content');
  if (!main || !data) return;

  main.innerHTML = `
    <div class="card panel-top">
      <div><h1 style="margin:0">Alerts</h1><p class="note">View and resolve emergency alerts.</p></div>
    </div>

    <div class="card" style="margin-top:22px;">
      <h2>Active Alerts</h2>
      <div class="space-y">
        ${(data.alerts || []).map((alert, index) => `
          <div class="alert-item ${alert.responded ? 'alert-resolved' : ''}">
            <div>
              <strong>${escapeHtml(alert.resident)}</strong><br>
              <span class="note">${escapeHtml(alert.issue)}</span>
              ${alert.responded ? `<div class="note" style="margin-top:8px;"><strong>Resolved note:</strong> ${escapeHtml(alert.response)}</div>` : ''}
            </div>
            <div class="schedule-actions">
              <span class="status ${alert.responded ? 'completed' : 'pending'}">${alert.responded ? 'Resolved' : 'Open'}</span>
              <span class="status ${statusClass(alert.level)}">${escapeHtml(alert.level)}</span>
              <button class="review-btn ${alert.responded ? 'responded' : ''}" type="button" data-admin-alert="${index}">${alert.responded ? 'View / Edit' : 'Resolve'}</button>
            </div>
          </div>
        `).join('') || '<p class="note">No active alerts.</p>'}
      </div>
    </div>
  `;

  main.querySelectorAll('[data-admin-alert]').forEach(button => {
    button.addEventListener('click', () => respondToAdminAlert(data, Number(button.dataset.adminAlert)));
  });
}

async function respondToAdminAlert(data, index) {
  const alertItem = (data.alerts || [])[index];
  if (!alertItem) return;
  const response = prompt(`Resolve alert for ${alertItem.resident}`, alertItem.response || 'Reviewed by admin.');
  if (!response) return;

  const request = await fetch(`/api/alerts/${alertItem.id}/respond`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response })
  });
  const result = await request.json();
  if (!request.ok || !result.success) {
    alert(result.message || 'Unable to resolve alert.');
    return;
  }

  data.alerts[index] = result.alert;
  renderAdminAlertsSection(data);
}

async function submitAdminSchedule(event, data) {
  event.preventDefault();

  const payload = {
    time: document.getElementById('newScheduleTime').value,
    label: document.getElementById('newScheduleTitle').value,
    residentId: document.getElementById('newScheduleResident').value,
    details: document.getElementById('newScheduleDetails').value
  };

  const response = await fetch('/api/schedule', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    alert(result.message || 'Unable to create schedule.');
    return;
  }

  data.schedule = result.schedule;
  renderAdminScheduleSection(data);
  const message = document.getElementById('scheduleCreateMessage');
  if (message) {
    message.textContent = `${result.scheduleItem.label} has been added.`;
  }
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
  const familyList = (data && data.families) || [];
  const usersList = (data && data.users) || [];
  const familyOptions = familyList.map(family => `
    <option value="${escapeHtml(family.email)}">${escapeHtml(family.name)} - ${escapeHtml(family.email)}</option>
  `).join('');
  main.innerHTML = `
    <div class="card panel-top">
      <div>
        <h1 style="margin:0">Onboard</h1>
        <p class="note">Create resident, staff, and family accounts, then manage access from one place.</p>
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
        <div class="form-group">
          <label for="newResidentFamily">Link Family</label>
          <select id="newResidentFamily">
            <option value="">No family linked yet</option>
            ${familyOptions}
          </select>
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

      <form class="card" id="onboardFamilyForm">
        <h2>New Family</h2>
        <div class="form-group">
          <label for="newFamilyName">Family Name</label>
          <input id="newFamilyName" required>
        </div>
        <div class="form-group">
          <label for="newFamilyRelation">Relation</label>
          <input id="newFamilyRelation" placeholder="Daughter, son, spouse">
        </div>
        <div class="form-group">
          <label for="newFamilyResident">Relative Resident</label>
          <select id="newFamilyResident" required>${residentOptions(data.residents || [])}</select>
        </div>
        <div class="form-group">
          <label for="newFamilyEmail">Login Email</label>
          <input id="newFamilyEmail" type="email" required>
        </div>
        <div class="form-group">
          <label for="newFamilyPassword">Login Password</label>
          <input id="newFamilyPassword" type="password" minlength="6" required>
        </div>
        <button class="btn" type="submit">Create Family Login</button>
        <p class="success" id="familyOnboardMessage" aria-live="polite"></p>
        <div class="onboard-staff-list">
          <h3>Current Families</h3>
          ${familyList.map(family => `
            <div class="mini-item">
              <span><strong>${escapeHtml(family.name)}</strong><br><small class="note">${escapeHtml(family.email)}</small></span>
              <span>${escapeHtml(family.relation)} - ${escapeHtml(family.resident)}</span>
            </div>
          `).join('') || '<p class="note">No family accounts created yet.</p>'}
        </div>
      </form>

      <div class="card">
        <h2>Remove User</h2>
        <div class="space-y">
          ${usersList.map(user => `
            <div class="mini-item">
              <span>
                <strong>${escapeHtml(user.name)}</strong><br>
                <small class="note">${escapeHtml(user.email)} - ${escapeHtml(user.role)}${user.resident ? ` - ${escapeHtml(user.resident)}` : ''}</small>
              </span>
              <button class="review-btn danger-action" type="button" data-remove-user="${escapeHtml(user.email)}" ${sessionData && sessionData.user && sessionData.user.email === user.email ? 'disabled' : ''}>Remove</button>
            </div>
          `).join('') || '<p class="note">No users found.</p>'}
        </div>
        <p class="success" id="removeUserMessage" aria-live="polite"></p>
      </div>
    </div>
  `;

  document.getElementById('onboardResidentForm').addEventListener('submit', submitResidentOnboard);
  document.getElementById('onboardStaffForm').addEventListener('submit', submitStaffOnboard);
  document.getElementById('onboardFamilyForm').addEventListener('submit', submitFamilyOnboard);
  document.querySelectorAll('[data-remove-user]').forEach(button => {
    button.addEventListener('click', () => removeSystemUser(button.dataset.removeUser));
  });
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
    emergencyContact: document.getElementById('newResidentContact').value,
    familyEmail: document.getElementById('newResidentFamily').value
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
  if (result.linkedFamily) {
    adminDashboardData.families = (adminDashboardData.families || []).map(family =>
      family.email === result.linkedFamily.email ? result.linkedFamily : family
    );
    adminDashboardData.users = (adminDashboardData.users || []).map(user =>
      user.email === result.linkedFamily.email ? { ...user, residentId: result.resident.id, resident: result.resident.name } : user
    );
  }
  document.getElementById('onboardResidentForm').reset();
  document.getElementById('residentOnboardMessage').textContent = result.linkedFamily
    ? `${result.resident.name} has been onboarded and linked with ${result.linkedFamily.name}.`
    : `${result.resident.name} has been onboarded in room ${result.resident.room}.`;
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
  adminDashboardData.users = adminDashboardData.users || [];
  adminDashboardData.users.push({
    email: payload.email.toLowerCase(),
    role: payload.role,
    name: payload.name,
    dashboard: payload.role === 'admin' ? 'admin-dashboard.html' : 'caregiver.html',
    resident: ''
  });
  document.getElementById('onboardStaffForm').reset();
  document.getElementById('staffOnboardMessage').textContent = `${result.staff.name} created with Staff ID ${result.staff.id}. They can now log in with the email and password you entered.`;
}

async function submitFamilyOnboard(event) {
  event.preventDefault();

  const payload = {
    name: document.getElementById('newFamilyName').value,
    relation: document.getElementById('newFamilyRelation').value,
    residentId: document.getElementById('newFamilyResident').value,
    email: document.getElementById('newFamilyEmail').value,
    password: document.getElementById('newFamilyPassword').value
  };

  const response = await fetch('/api/onboard/family', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json();

  if (!response.ok || !result.success) {
    alert(result.message || 'Unable to create family login.');
    return;
  }

  adminDashboardData.families = adminDashboardData.families || [];
  adminDashboardData.families.push(result.family);
  adminDashboardData.users = adminDashboardData.users || [];
  adminDashboardData.users.push(result.user);
  document.getElementById('onboardFamilyForm').reset();
  document.getElementById('familyOnboardMessage').textContent = `${result.family.name} can now view updates for ${result.family.resident}.`;
}

async function removeSystemUser(email) {
  if (!email) return;
  const confirmed = confirm(`Remove ${email} from the ElderNest system?`);
  if (!confirmed) return;

  const response = await fetch(`/api/users/${encodeURIComponent(email)}`, {
    method: 'DELETE',
    credentials: 'same-origin'
  });
  const result = await response.json();

  if (!response.ok || !result.success) {
    alert(result.message || 'Unable to remove user.');
    return;
  }

  adminDashboardData.users = (adminDashboardData.users || []).filter(user => user.email !== result.removed.email);
  adminDashboardData.staff = (adminDashboardData.staff || []).filter(staff => staff.email !== result.removed.email);
  adminDashboardData.families = (adminDashboardData.families || []).filter(family => family.email !== result.removed.email);
  adminDashboardData.caregiverStatus = (adminDashboardData.caregiverStatus || []).filter(caregiver => caregiver.email !== result.removed.email);
  renderOnboardSection(adminDashboardData);
  const message = document.getElementById('removeUserMessage');
  if (message) {
    message.textContent = `${result.removed.name} has been removed.`;
  }
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

      if (link.classList.contains('shift-nav')) {
        renderCaregiverShiftDashboard(data);
      } else if (link.classList.contains('residents-nav')) {
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
        renderCaregiverScheduleSection(data);
      }
    });
  });

  document.querySelector('.shift-nav').click();
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
  { name: "Dorji Wangmo", room: "A-12", status: "Stable", medication: "Vitamin D due in 15 mins", note: "Resident is stable and under regular monitoring." },
  { name: "Pema Choden", room: "B-05", status: "Observation", medication: "Blood Pressure Tablet missed 8:00 AM", note: "Needs medication follow-up from caregiver." },
  { name: "Sonam Tashi", room: "C-03", status: "Critical", medication: "Heart Medicine completed", note: "Requires close monitoring due to abnormal heart rate." },
  { name: "Karma Dema", room: "A-08", status: "Stable", medication: "Calcium Tablet due at 1:00 PM", note: "Resident condition is normal today." }
];

let medications = [
  { resident: "Dorji Wangmo", medicine: "Vitamin D", time: "1:00 PM", status: "Pending" },
  { resident: "Pema Choden", medicine: "Blood Pressure Tablet", time: "8:00 AM", status: "Missed" },
  { resident: "Sonam Tashi", medicine: "Heart Medicine", time: "10:00 AM", status: "Completed" },
  { resident: "Karma Dema", medicine: "Calcium Tablet", time: "1:00 PM", status: "Pending" }
];

let alerts = [
  { resident: "Dorji Wangmo", issue: "Fall detected in Room A-12", level: "Critical" },
  { resident: "Pema Choden", issue: "Medication missed", level: "High" },
  { resident: "Sonam Tashi", issue: "Abnormal heart rate", level: "Critical" }
];

function viewResidentDetails(index) {
  const resident = caregiverResidents[index] || residents[index];
  if (!resident) return;

  const modalId = 'residentDetailModal';
  const contactList = resident.contacts || resident.contactList || [];
  const contactsHtml = contactList.length ? contactList.map(c => `
      <div style="margin-bottom:6px;">
        <strong>${escapeHtml(c.name)}</strong> ${c.relation ? `(${escapeHtml(c.relation)})` : ''}<br>
        <a href="tel:${escapeHtml(c.phone || '#')}">${escapeHtml(c.phone || 'No phone')}</a>
      </div>
    `).join('') : `<div class="note">${escapeHtml(resident.emergencyContact || 'No contacts on file.')}</div>`;

  const allergies = Array.isArray(resident.allergies)
    ? resident.allergies
    : String(resident.allergies || '').split(',').map(item => item.trim()).filter(Boolean);
  const allergiesHtml = allergies.length
    ? `<ul class="detail-list">${allergies.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>`
    : '<div class="note">No known allergies.</div>';

  const vitalsList = Array.isArray(resident.recentVitals)
    ? resident.recentVitals
    : resident.vitals ? [
      { label: 'Heart Rate', value: `${resident.vitals.heartRate} bpm` },
      { label: 'Blood Pressure', value: resident.vitals.bloodPressure },
      { label: 'Oxygen', value: `${resident.vitals.oxygen}%` },
      { label: 'Temperature', value: `${resident.vitals.temperature} C` }
    ] : [];
  const vitalsHtml = vitalsList.length ? `
    <div class="vitals-grid">
      ${vitalsList.map(v => `
        <div class="vital-item"><strong>${escapeHtml(v.label)}</strong><div>${escapeHtml(v.value)}</div><small class="note">${escapeHtml(v.time || '')}</small></div>
      `).join('')}
    </div>
  ` : '<div class="note">No recent vitals recorded.</div>';

  const modalHtml = `
  <div class="modal-bg" id="${modalId}" role="dialog" aria-modal="true">
    <div class="modal-box caregiver-resident-modal">
      <h2>${escapeHtml(resident.name)}</h2>
      <div class="caregiver-resident-detail-grid">
        <div>
          <p><strong>Room:</strong> ${escapeHtml(resident.room)}</p>
          <p><strong>Status:</strong> <span class="status ${statusClass(resident.status)}">${escapeHtml(resident.status)}</span></p>
          <p><strong>Medication:</strong> ${escapeHtml(resident.medication)}</p>
          ${resident.note ? `<p class="note">${escapeHtml(resident.note)}</p>` : ''}
          ${resident.carePlan ? `<h4 style="margin-top:12px;margin-bottom:6px;">Care Plan</h4><p class="note">${escapeHtml(resident.carePlan)}</p>` : ''}
          <h4 style="margin-top:12px;margin-bottom:6px;">Contacts</h4>
          ${contactsHtml}
        </div>
        <div>
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
    renderAdminAlertsSection(adminDashboardData);
  }

  if (section === "schedules") {
    renderAdminScheduleSection(adminDashboardData);
    return;

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
