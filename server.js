const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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

const ALERTS = [
  { id: 1, resident: 'Dorji Wangmo', issue: 'Fall detected in Room A-12', level: 'Critical' },
  { id: 2, resident: 'Pema Choden', issue: 'Medication missed', level: 'High' },
  { id: 3, resident: 'Sonam Tashi', issue: 'Abnormal heart rate', level: 'Critical' }
];

const ALERT_RESPONSES = {};
const STAFF = [
  {
    id: 'STF-1001',
    name: 'Caregiver User',
    email: 'caregiver@eldernest.com',
    role: 'caregiver'
  }
];
const CARE_NOTES = [];
const ADL_CHARTS = [];
const INCIDENT_REPORTS = [];

const RESIDENTS = [
  {
    id: 1,
    name: 'Dorji Wangmo',
    age: 78,
    room: 'A-12',
    status: 'Stable',
    medication: 'Vitamin D due in 15 mins',
    note: 'Resident is stable and under regular monitoring.',
    carePlan: 'Hydration reminder, light mobility support, and afternoon medication review.',
    allergies: 'None recorded',
    emergencyContact: 'Tashi Wangmo, Daughter, +61 400 111 201',
    sensorAlerts: [
      { type: 'Sensor Mat', message: 'Bed sensor mat active with normal movement pattern.', level: 'Stable', time: '09:20 AM' },
      { type: 'Door Sensor', message: 'No unusual room exit activity detected.', level: 'Stable', time: '10:05 AM' }
    ],
    medications: [
      { name: 'Vitamin D', dosage: '1000 IU', time: '1:00 PM', status: 'Pending' },
      { name: 'Calcium Tablet', dosage: '500 mg', time: '7:00 PM', status: 'Scheduled' }
    ],
    vitals: {
      heartRate: 74,
      bloodPressure: '122/78',
      oxygen: 97,
      temperature: 36.7
    },
    chartData: {
      wellness: 86,
      mobility: 72,
      medication: 91,
      sleep: 78
    }
  },
  {
    id: 2,
    name: 'Pema Choden',
    age: 82,
    room: 'B-05',
    status: 'Observation',
    medication: 'Blood Pressure Tablet missed 8:00 AM',
    note: 'Needs medication follow-up from caregiver.',
    carePlan: 'Medication follow-up, blood pressure observation, and family update after review.',
    allergies: 'Penicillin',
    emergencyContact: 'Karma Choden, Son, +61 400 111 202',
    sensorAlerts: [
      { type: 'Sensor Mat', message: 'Sensor mat detected reduced morning movement.', level: 'Observation', time: '08:40 AM' },
      { type: 'Medication Alert', message: 'Blood pressure tablet was missed at 8:00 AM.', level: 'High', time: '08:00 AM' }
    ],
    medications: [
      { name: 'Blood Pressure Tablet', dosage: '5 mg', time: '8:00 AM', status: 'Missed' },
      { name: 'Evening BP Tablet', dosage: '5 mg', time: '8:00 PM', status: 'Scheduled' }
    ],
    vitals: {
      heartRate: 88,
      bloodPressure: '148/88',
      oxygen: 95,
      temperature: 36.9
    },
    chartData: {
      wellness: 68,
      mobility: 61,
      medication: 54,
      sleep: 70
    }
  },
  {
    id: 3,
    name: 'Sonam Tashi',
    age: 75,
    room: 'C-03',
    status: 'Critical',
    medication: 'Heart Medicine completed',
    note: 'Requires close monitoring due to abnormal heart rate.',
    carePlan: 'Close cardiac monitoring, hourly vitals, and immediate nurse review for abnormal readings.',
    allergies: 'Sulfa medication',
    emergencyContact: 'Lhamo Tashi, Sister, +61 400 111 203',
    sensorAlerts: [
      { type: 'Sensor Mat', message: 'Sensor mat flagged prolonged rest period.', level: 'Critical', time: '07:55 AM' },
      { type: 'Heart Rate Sensor', message: 'Abnormal heart rate detected by wearable sensor.', level: 'Critical', time: '10:10 AM' }
    ],
    medications: [
      { name: 'Heart Medicine', dosage: '10 mg', time: '10:00 AM', status: 'Completed' },
      { name: 'Blood Thinner', dosage: '2 mg', time: '6:00 PM', status: 'Scheduled' }
    ],
    vitals: {
      heartRate: 106,
      bloodPressure: '138/84',
      oxygen: 93,
      temperature: 37.4
    },
    chartData: {
      wellness: 48,
      mobility: 52,
      medication: 88,
      sleep: 43
    }
  },
  {
    id: 4,
    name: 'Karma Dema',
    age: 80,
    room: 'A-08',
    status: 'Stable',
    medication: 'Calcium Tablet due at 1:00 PM',
    note: 'Resident condition is normal today.',
    carePlan: 'Routine medication, daily walk support, and weekly family wellbeing report.',
    allergies: 'Lactose intolerance',
    emergencyContact: 'Dawa Dema, Nephew, +61 400 111 204',
    sensorAlerts: [
      { type: 'Sensor Mat', message: 'Sensor mat active with normal transfer activity.', level: 'Stable', time: '09:45 AM' },
      { type: 'Motion Sensor', message: 'Normal room movement recorded.', level: 'Stable', time: '11:15 AM' }
    ],
    medications: [
      { name: 'Calcium Tablet', dosage: '500 mg', time: '1:00 PM', status: 'Pending' },
      { name: 'Sleep Support', dosage: '1 tablet', time: '9:00 PM', status: 'Scheduled' }
    ],
    vitals: {
      heartRate: 71,
      bloodPressure: '118/76',
      oxygen: 98,
      temperature: 36.5
    },
    chartData: {
      wellness: 89,
      mobility: 80,
      medication: 76,
      sleep: 84
    }
  }
];

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'eldernest-demo-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 4
    }
  })
);

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const user = USERS.find(u => u.email === email && u.password === password);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  req.session.user = {
    email: user.email,
    name: user.name,
    role: user.role,
    dashboard: user.dashboard
  };
  req.session.loggedIn = true;

  res.json({ success: true, user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Logout failed.' });
    }

    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

function requireAuth(req, res, next) {
  if (req.session && req.session.loggedIn && req.session.user) {
    return next();
  }

  res.status(401).json({ success: false, message: 'Not authenticated' });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }

  res.status(403).json({ success: false, message: 'Admin access required' });
}

app.get('/api/session', (req, res) => {
  if (req.session && req.session.loggedIn && req.session.user) {
    return res.json({
      loggedIn: true,
      user: req.session.user,
      role: req.session.user.role,
      dashboard: req.session.user.dashboard
    });
  }

  res.json({ loggedIn: false });
});

app.get('/api/dashboard-data', requireAuth, (req, res) => {
  const user = req.session.user;

  const residents = RESIDENTS;

  const medications = RESIDENTS.flatMap(resident =>
    resident.medications.map(medication => ({
      resident: resident.name,
      medicine: medication.name,
      dosage: medication.dosage,
      time: medication.time,
      status: medication.status
    }))
  );

  const alerts = ALERTS.map(alert => ({
    ...alert,
    responded: Boolean(ALERT_RESPONSES[alert.id]),
    response: ALERT_RESPONSES[alert.id] || ''
  }));

  const schedule = [
    { time: '09:00 AM', label: 'Morning health check' },
    { time: '11:00 AM', label: 'Medication round' },
    { time: '02:00 PM', label: 'Family visit' },
    { time: '05:00 PM', label: 'Evening wellness report' }
  ];

  const familyUpdates = [
    { resident: 'Dorji Wangmo', note: 'Stable and under regular observation.', status: 'Important' },
    { resident: 'Pema Choden', note: 'Medication missed this morning.', status: 'Attention' }
  ];

  const caregiverAssignments = RESIDENTS.map(resident => ({
    id: resident.id,
    name: resident.name,
    room: resident.room,
    medication: resident.medication,
    status: resident.status === 'Critical' ? 'Priority' : resident.status === 'Observation' ? 'Monitoring' : 'Care Active',
    note: resident.note,
    medications: resident.medications,
    sensorAlerts: resident.sensorAlerts,
    vitals: resident.vitals,
    chartData: resident.chartData
  }));

  const residentInfo = {
    healthStatus: 'Stable',
    nextMedication: 'Vitamin D tablet due at 1:00 PM with meal.',
    reminders: 'Hydration reminder and light exercise session scheduled.',
    familyContact: 'Family members can be reached directly through the portal.',
    schedule,
    quickActions: [
      { label: 'Call Caregiver', type: 'primary' },
      { label: 'View Medication', type: 'secondary' },
      { label: 'Open Messages', type: 'secondary' },
      { label: 'Emergency Help', type: 'danger' }
    ]
  };

  const baseResponse = {
    success: true,
    user,
    stats: {
      totalResidents: residents.length,
      activeCaregivers: 24,
      medicationDue: 19,
      criticalAlerts: alerts.filter(a => a.level === 'Critical').length
    },
    residents,
    medications,
    alerts,
    schedule,
    familyUpdates,
    caregiverAssignments,
    residentInfo,
    staff: STAFF,
    careNotes: CARE_NOTES,
    adlCharts: ADL_CHARTS,
    incidentReports: INCIDENT_REPORTS
  };

  res.json(baseResponse);
});

app.post('/api/alerts/:id/respond', requireAuth, (req, res) => {
  const alertId = Number(req.params.id);
  const { response } = req.body;

  if (!response || !response.toString().trim()) {
    return res.status(400).json({ success: false, message: 'Response text is required.' });
  }

  const alert = ALERTS.find(a => a.id === alertId);
  if (!alert) {
    return res.status(404).json({ success: false, message: 'Alert not found.' });
  }

  ALERT_RESPONSES[alertId] = response.toString().trim();

  res.json({
    success: true,
    alert: {
      ...alert,
      responded: true,
      response: ALERT_RESPONSES[alertId]
    }
  });
});

app.get('/api/residents', requireAuth, (req, res) => {
  res.json({ success: true, residents: RESIDENTS });
});

app.post('/api/onboard/resident', requireAuth, requireAdmin, (req, res) => {
  const { name, age, room, status, medication, carePlan, emergencyContact } = req.body;

  if (!name || !room) {
    return res.status(400).json({ success: false, message: 'Resident name and room number are required.' });
  }

  const resident = {
    id: RESIDENTS.reduce((max, item) => Math.max(max, item.id), 0) + 1,
    name: name.toString().trim(),
    age: Number(age) || 70,
    room: room.toString().trim(),
    status: status || 'Stable',
    medication: (medication || 'No medication scheduled yet').toString().trim(),
    note: 'New resident onboarded by admin.',
    carePlan: (carePlan || 'Initial care plan pending assessment.').toString().trim(),
    allergies: 'None recorded',
    emergencyContact: (emergencyContact || 'Not provided').toString().trim(),
    sensorAlerts: [
      { type: 'Sensor Mat', message: 'Sensor mat setup pending.', level: 'Observation', time: 'New' }
    ],
    medications: medication ? [
      { name: medication.toString().trim(), dosage: 'As prescribed', time: 'To be scheduled', status: 'Scheduled' }
    ] : [],
    vitals: {
      heartRate: 72,
      bloodPressure: '120/80',
      oxygen: 97,
      temperature: 36.6
    },
    chartData: {
      wellness: 75,
      mobility: 75,
      medication: 75,
      sleep: 75
    }
  };

  RESIDENTS.push(resident);
  res.status(201).json({ success: true, resident });
});

app.post('/api/onboard/staff', requireAuth, requireAdmin, (req, res) => {
  const { name, email, password, role } = req.body;
  const staffRole = role || 'caregiver';

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Staff name, email, and password are required.' });
  }

  if (!['caregiver', 'admin'].includes(staffRole)) {
    return res.status(400).json({ success: false, message: 'Staff role must be caregiver or admin.' });
  }

  const normalizedEmail = email.toString().trim().toLowerCase();
  if (USERS.some(user => user.email.toLowerCase() === normalizedEmail)) {
    return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
  }

  const staffId = `STF-${1001 + STAFF.length}`;
  const dashboard = staffRole === 'admin' ? 'admin-dashboard.html' : 'caregiver.html';
  const user = {
    email: normalizedEmail,
    password: password.toString(),
    role: staffRole,
    name: name.toString().trim(),
    dashboard
  };
  const staff = {
    id: staffId,
    name: user.name,
    email: user.email,
    role: staffRole
  };

  USERS.push(user);
  STAFF.push(staff);

  res.status(201).json({ success: true, staff });
});

app.post('/api/care-notes', requireAuth, (req, res) => {
  const { residentId, note, category } = req.body;
  const resident = RESIDENTS.find(item => item.id === Number(residentId));

  if (!resident || !note || !note.toString().trim()) {
    return res.status(400).json({ success: false, message: 'Resident and note text are required.' });
  }

  const careNote = {
    id: CARE_NOTES.length + 1,
    residentId: resident.id,
    resident: resident.name,
    category: category || 'Daily Note',
    note: note.toString().trim(),
    author: req.session.user.name,
    createdAt: new Date().toISOString()
  };

  CARE_NOTES.unshift(careNote);
  res.status(201).json({ success: true, careNote });
});

app.post('/api/adl-charts', requireAuth, (req, res) => {
  const { residentId, mobility, bathing, dressing, eating, toileting, notes } = req.body;
  const resident = RESIDENTS.find(item => item.id === Number(residentId));

  if (!resident) {
    return res.status(400).json({ success: false, message: 'Resident is required.' });
  }

  const adlChart = {
    id: ADL_CHARTS.length + 1,
    residentId: resident.id,
    resident: resident.name,
    mobility: mobility || 'Not recorded',
    bathing: bathing || 'Not recorded',
    dressing: dressing || 'Not recorded',
    eating: eating || 'Not recorded',
    toileting: toileting || 'Not recorded',
    notes: (notes || '').toString().trim(),
    author: req.session.user.name,
    createdAt: new Date().toISOString()
  };

  ADL_CHARTS.unshift(adlChart);
  res.status(201).json({ success: true, adlChart });
});

app.post('/api/incident-reports', requireAuth, (req, res) => {
  const { residentId, type, severity, description, actionTaken } = req.body;
  const resident = RESIDENTS.find(item => item.id === Number(residentId));

  if (!resident || !type || !description) {
    return res.status(400).json({ success: false, message: 'Resident, incident type, and description are required.' });
  }

  const incidentReport = {
    id: INCIDENT_REPORTS.length + 1,
    residentId: resident.id,
    resident: resident.name,
    type: type.toString().trim(),
    severity: severity || 'Observation',
    description: description.toString().trim(),
    actionTaken: (actionTaken || '').toString().trim(),
    author: req.session.user.name,
    createdAt: new Date().toISOString()
  };

  INCIDENT_REPORTS.unshift(incidentReport);
  res.status(201).json({ success: true, incidentReport });
});

app.put('/api/residents/:id/medications/:medicationIndex', requireAuth, (req, res) => {
  const resident = RESIDENTS.find(item => item.id === Number(req.params.id));
  const medicationIndex = Number(req.params.medicationIndex);
  const { status, administeredTime, note } = req.body;

  if (!resident || !resident.medications[medicationIndex]) {
    return res.status(404).json({ success: false, message: 'Medication not found.' });
  }

  const medication = resident.medications[medicationIndex];
  medication.status = status || medication.status;
  medication.administeredTime = administeredTime || new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  medication.updatedBy = req.session.user.name;
  medication.note = (note || '').toString().trim();
  resident.medication = `${medication.name} ${medication.status}`;

  res.json({ success: true, resident, medication });
});

app.put('/api/residents/:id', requireAuth, (req, res) => {
  const residentId = Number(req.params.id);
  const resident = RESIDENTS.find(item => item.id === residentId);

  if (!resident) {
    return res.status(404).json({ success: false, message: 'Resident not found.' });
  }

  const allowedStatuses = ['Stable', 'Observation', 'Critical'];
  const {
    name,
    age,
    room,
    status,
    medication,
    note,
    carePlan,
    allergies,
    emergencyContact,
    vitals,
    chartData
  } = req.body;

  if (!name || !room || !status || !allowedStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Name, room, and a valid status are required.' });
  }

  resident.name = name.toString().trim();
  resident.age = Number(age) || resident.age;
  resident.room = room.toString().trim();
  resident.status = status;
  resident.medication = (medication || '').toString().trim();
  resident.note = (note || '').toString().trim();
  resident.carePlan = (carePlan || '').toString().trim();
  resident.allergies = (allergies || '').toString().trim();
  resident.emergencyContact = (emergencyContact || '').toString().trim();
  resident.vitals = {
    heartRate: Number(vitals && vitals.heartRate) || resident.vitals.heartRate,
    bloodPressure: (vitals && vitals.bloodPressure ? vitals.bloodPressure : resident.vitals.bloodPressure).toString().trim(),
    oxygen: Number(vitals && vitals.oxygen) || resident.vitals.oxygen,
    temperature: Number(vitals && vitals.temperature) || resident.vitals.temperature
  };
  resident.chartData = {
    wellness: Math.max(0, Math.min(100, Number(chartData && chartData.wellness) || resident.chartData.wellness)),
    mobility: Math.max(0, Math.min(100, Number(chartData && chartData.mobility) || resident.chartData.mobility)),
    medication: Math.max(0, Math.min(100, Number(chartData && chartData.medication) || resident.chartData.medication)),
    sleep: Math.max(0, Math.min(100, Number(chartData && chartData.sleep) || resident.chartData.sleep))
  };

  res.json({ success: true, resident });
});

app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`ElderNest backend running at http://localhost:${PORT}`);
});
