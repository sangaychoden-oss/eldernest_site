const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const MySQLSessionStore = require('express-mysql-session')(session);
const path = require('path');
const { loadSnapshot, saveSnapshot, checkConnection, closePool, DB_CONFIG } = require('./mysqlStore');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || 'eldernest-demo-secret';

let db;
let
  USERS,
  ALERTS,
  ALERT_RESPONSES,
  STAFF,
  FAMILY_MEMBERS,
  CAREGIVER_SHIFTS,
  OPEN_SHIFTS,
  CARE_NOTES,
  ADL_CHARTS,
  INCIDENT_REPORTS,
  CARE_SCHEDULE,
  FAMILY_MESSAGES,
  RESIDENTS;

function assignCollections(snapshot) {
  db = snapshot;
  ({
    USERS,
    ALERTS,
    ALERT_RESPONSES,
    STAFF,
    FAMILY_MEMBERS,
    CAREGIVER_SHIFTS,
    OPEN_SHIFTS,
    CARE_NOTES,
    ADL_CHARTS,
    INCIDENT_REPORTS,
    CARE_SCHEDULE,
    FAMILY_MESSAGES,
    RESIDENTS
  } = db);
}

async function saveDatabase() {
  await saveSnapshot(db);
}

const sessionStore = new MySQLSessionStore({
  host: DB_CONFIG.host,
  port: DB_CONFIG.port,
  user: DB_CONFIG.user,
  password: DB_CONFIG.password,
  database: DB_CONFIG.database,
  clearExpired: true,
  checkExpirationInterval: 1000 * 60 * 15,
  expiration: 1000 * 60 * 60 * 4
});

const loginLimiter = rateLimit({
  windowMs: 1000 * 60 * 15,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please wait and try again.' }
});

const apiLimiter = rateLimit({
  windowMs: 1000 * 60 * 15,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please wait and try again.' }
});

function validateProductionConfig() {
  if (!isProduction) return;

  const errors = [];

  if (!process.env.SESSION_SECRET || sessionSecret.length < 32 || sessionSecret === 'eldernest-demo-secret') {
    errors.push('SESSION_SECRET must be set to a unique value of at least 32 characters.');
  }

  if (!process.env.DB_USER) {
    errors.push('DB_USER must be set.');
  }

  if (!process.env.DB_NAME) {
    errors.push('DB_NAME must be set.');
  }

  if (!process.env.DB_PASSWORD || process.env.DB_PASSWORD.includes('replace-with')) {
    errors.push('DB_PASSWORD must be set to the production database password.');
  }

  if (errors.length) {
    throw new Error(`Production configuration is incomplete: ${errors.join(' ')}`);
  }
}

validateProductionConfig();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(express.json({ limit: '200kb' }));
app.use('/api', apiLimiter);
app.use(
  session({
    secret: sessionSecret,
    store: sessionStore,
    name: 'eldernest.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 4
    }
  })
);

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = body => {
    if (req.method !== 'GET' && res.statusCode < 400) {
      return saveDatabase()
        .then(() => originalJson(body))
        .catch(error => {
          console.error('Database save failed:', error);
          return res.status(500).send('Database save failed');
        });
    }
    return originalJson(body);
  };
  next();
});

app.get('/api/health', async (req, res) => {
  try {
    await checkConnection();
    res.json({
      status: 'ok',
      database: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'unavailable',
      message: 'Database health check failed.'
    });
  }
});

function normalizeEmail(email) {
  return (email || '').toString().trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongEnoughPassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(user, password) {
  if (user.passwordHash) {
    return bcrypt.compare(password, user.passwordHash);
  }

  return user.password === password;
}

async function migrateUserPasswords() {
  let changed = false;

  for (const user of USERS) {
    if (user.password && !user.passwordHash) {
      user.passwordHash = await hashPassword(user.password.toString());
      delete user.password;
      changed = true;
    }
  }

  if (changed) {
    await saveDatabase();
  }
}

app.post('/api/login', loginLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const user = USERS.find(u => u.email.toLowerCase() === email);

  if (!user || !(await verifyPassword(user, password))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  req.session.regenerate(error => {
    if (error) {
      return res.status(500).json({ success: false, message: 'Login session could not be created.' });
    }

    req.session.user = {
      email: user.email,
      name: user.name,
      role: user.role,
      dashboard: user.dashboard,
      residentId: user.residentId || null
    };
    req.session.loggedIn = true;

    res.json({ success: true, user: req.session.user });
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Logout failed.' });
    }

    res.clearCookie('eldernest.sid');
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

function formatShiftTime(value) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}

function getCaregiverShiftStatus(staff) {
  const latestShift = CAREGIVER_SHIFTS
    .filter(shift => shift.caregiverEmail === staff.email)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0];

  return {
    ...staff,
    assignedResidentIds: staff.assignedResidentIds || [],
    status: latestShift && !latestShift.endedAt ? 'Working' : 'Off Duty',
    startedAt: latestShift ? latestShift.startedAt : null,
    endedAt: latestShift ? latestShift.endedAt : null,
    shiftLabel: latestShift && !latestShift.endedAt
      ? `${formatShiftTime(latestShift.startedAt)} - Now`
      : staff.plannedShift || 'Not scheduled',
    activeShiftId: latestShift && !latestShift.endedAt ? latestShift.id : null
  };
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
  const caregiverStatus = STAFF
    .filter(staff => staff.role === 'caregiver')
    .map(getCaregiverShiftStatus);
  const currentCaregiverShift = caregiverStatus.find(staff => staff.email === user.email) || null;

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

  const schedule = CARE_SCHEDULE;

  const allFamilyUpdates = RESIDENTS.map(resident => ({
    resident: resident.name,
    note: `${resident.status}: ${resident.note}`,
    status: resident.status === 'Critical' || resident.status === 'Observation' ? 'Attention' : 'Important'
  }));
  const familyMember = FAMILY_MEMBERS.find(member => member.email === user.email);
  const linkedFamilyResident = familyMember
    ? RESIDENTS.find(resident => resident.id === familyMember.residentId)
    : null;
  const linkedResident = user.role === 'resident'
    ? RESIDENTS.find(resident => resident.id === user.residentId)
    : linkedFamilyResident;
  const linkedResidents = linkedResident ? [linkedResident] : RESIDENTS;
  const familyUpdates = (user.role === 'family' || user.role === 'resident') && linkedResident
    ? allFamilyUpdates.filter(update => update.resident === linkedResident.name)
    : allFamilyUpdates;
  const familyMessages = user.role === 'family' && linkedResident
    ? FAMILY_MESSAGES.filter(message => message.residentId === linkedResident.id && message.familyEmail === user.email)
    : user.role === 'resident' && linkedResident
      ? FAMILY_MESSAGES.filter(message => message.residentId === linkedResident.id)
      : [];

  const currentStaff = STAFF.find(staff => staff.email === user.email);
  const assignedResidentIds = currentStaff && currentStaff.assignedResidentIds && currentStaff.assignedResidentIds.length
    ? currentStaff.assignedResidentIds
    : null;
  const caregiverResidentSource = user.role === 'caregiver' && assignedResidentIds
    ? RESIDENTS.filter(resident => assignedResidentIds.includes(resident.id))
    : RESIDENTS;

  const caregiverAssignments = caregiverResidentSource.map(resident => ({
    id: resident.id,
    name: resident.name,
    age: resident.age,
    room: resident.room,
    medication: resident.medication,
    status: resident.status === 'Critical' ? 'Priority' : resident.status === 'Observation' ? 'Monitoring' : 'Care Active',
    note: resident.note,
    allergies: resident.allergies,
    emergencyContact: resident.emergencyContact,
    carePlan: resident.carePlan,
    medications: resident.medications,
    sensorAlerts: resident.sensorAlerts,
    vitals: resident.vitals,
    chartData: resident.chartData
  }));

  const residentPortalResident = linkedResident || RESIDENTS[0];
  const residentInfo = {
    healthStatus: residentPortalResident.status,
    nextMedication: residentPortalResident.medication,
    reminders: residentPortalResident.carePlan,
    familyContact: residentPortalResident.emergencyContact,
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
      activeCaregivers: caregiverStatus.filter(staff => staff.status === 'Working').length,
      medicationDue: 19,
      criticalAlerts: alerts.filter(a => a.level === 'Critical').length
    },
    residents,
    medications,
    alerts,
    schedule,
    familyUpdates,
    linkedResidents,
    familyMessages,
    caregiverAssignments,
    residentInfo,
    staff: STAFF,
    families: FAMILY_MEMBERS.map(member => ({
      ...member,
      resident: (RESIDENTS.find(resident => resident.id === member.residentId) || {}).name || 'Unassigned'
    })),
    users: USERS.map(({ password, passwordHash, ...safeUser }) => ({
      ...safeUser,
      resident: safeUser.residentId ? (RESIDENTS.find(resident => resident.id === safeUser.residentId) || {}).name || 'Unassigned' : ''
    })),
    careNotes: CARE_NOTES,
    adlCharts: ADL_CHARTS,
    incidentReports: INCIDENT_REPORTS,
    caregiverStatus,
    currentCaregiverShift,
    shiftHistory: CAREGIVER_SHIFTS,
    openShifts: OPEN_SHIFTS
  };

  res.json(baseResponse);
});

app.post('/api/shifts/start', requireAuth, (req, res) => {
  const user = req.session.user;
  if (user.role !== 'caregiver') {
    return res.status(403).json({ success: false, message: 'Only caregivers can start a shift.' });
  }

  const staff = STAFF.find(item => item.email === user.email);
  if (!staff) {
    return res.status(404).json({ success: false, message: 'Caregiver staff record not found.' });
  }

  const activeShift = CAREGIVER_SHIFTS.find(shift => shift.caregiverEmail === user.email && !shift.endedAt);
  if (activeShift) {
    return res.json({ success: true, shift: activeShift, caregiver: getCaregiverShiftStatus(staff) });
  }

  const shift = {
    id: CAREGIVER_SHIFTS.length + 1,
    caregiverEmail: user.email,
    caregiverName: user.name,
    role: 'caregiver',
    assignedArea: staff.assignedArea || 'General Care',
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: 'Working'
  };

  CAREGIVER_SHIFTS.unshift(shift);
  res.status(201).json({ success: true, shift, caregiver: getCaregiverShiftStatus(staff) });
});

app.post('/api/shifts/end', requireAuth, (req, res) => {
  const user = req.session.user;
  if (user.role !== 'caregiver') {
    return res.status(403).json({ success: false, message: 'Only caregivers can end a shift.' });
  }

  const staff = STAFF.find(item => item.email === user.email);
  const activeShift = CAREGIVER_SHIFTS.find(shift => shift.caregiverEmail === user.email && !shift.endedAt);
  if (!activeShift) {
    return res.status(404).json({ success: false, message: 'No active shift found.' });
  }

  activeShift.endedAt = new Date().toISOString();
  activeShift.status = 'Completed';
  res.json({ success: true, shift: activeShift, caregiver: staff ? getCaregiverShiftStatus(staff) : null });
});

app.post('/api/shifts/assign', requireAuth, requireAdmin, (req, res) => {
  const { staffId, shiftId, title, day, assignedArea, plannedShift, details, residentIds } = req.body;
  const staff = STAFF.find(item => item.id === staffId && item.role === 'caregiver');

  if (!staff) {
    return res.status(400).json({ success: false, message: 'Choose a caregiver to assign.' });
  }

  const shift = OPEN_SHIFTS.find(item => item.id === shiftId);
  if (!shift) {
    return res.status(400).json({ success: false, message: 'Choose an open shift.' });
  }

  const previousShift = OPEN_SHIFTS.find(item => item.assignedStaffId === staff.id);
  if (previousShift && previousShift.id !== shift.id) {
    previousShift.assignedStaffId = null;
  }

  shift.assignedStaffId = staff.id;
  shift.title = (title || shift.title).toString().trim();
  shift.day = (day || shift.day || 'Today').toString().trim();
  staff.assignedArea = (assignedArea || shift.assignedArea || staff.assignedArea || 'General Care').toString().trim();
  staff.plannedShift = (plannedShift || shift.plannedShift || staff.plannedShift || 'To be scheduled').toString().trim();
  const selectedResidentIds = Array.isArray(residentIds)
    ? residentIds.map(Number).filter(id => RESIDENTS.some(resident => resident.id === id))
    : [];
  staff.assignedResidentIds = selectedResidentIds;
  shift.assignedArea = staff.assignedArea;
  shift.plannedShift = staff.plannedShift;
  shift.details = (details || shift.details || '').toString().trim();
  shift.assignedResidentIds = selectedResidentIds;
  shift.status = 'Assigned';

  res.json({
    success: true,
    staff: getCaregiverShiftStatus(staff),
    openShifts: OPEN_SHIFTS,
    staffList: STAFF
  });
});

app.delete('/api/open-shifts/:id', requireAuth, requireAdmin, (req, res) => {
  const shift = OPEN_SHIFTS.find(item => item.id === req.params.id);
  if (!shift) {
    return res.status(404).json({ success: false, message: 'Shift not found.' });
  }

  if (shift.assignedStaffId) {
    const staff = STAFF.find(item => item.id === shift.assignedStaffId);
    if (staff) {
      staff.assignedResidentIds = [];
    }
  }

  shift.status = 'Cancelled';
  shift.assignedStaffId = null;
  shift.assignedResidentIds = [];
  res.json({ success: true, shift, openShifts: OPEN_SHIFTS, staffList: STAFF });
});

app.put('/api/shift-history/:id', requireAuth, requireAdmin, (req, res) => {
  const shift = CAREGIVER_SHIFTS.find(item => item.id === Number(req.params.id));
  const { day, assignedArea, details, startedAt, endedAt, status } = req.body;

  if (!shift) {
    return res.status(404).json({ success: false, message: 'Shift history item not found.' });
  }

  shift.day = (day || shift.day || 'Today').toString().trim();
  shift.assignedArea = (assignedArea || shift.assignedArea).toString().trim();
  shift.details = (details || shift.details || '').toString().trim();
  shift.startedAt = startedAt || shift.startedAt;
  shift.endedAt = endedAt || null;
  shift.status = status || (shift.endedAt ? 'Completed' : 'Working');

  res.json({ success: true, shift, shiftHistory: CAREGIVER_SHIFTS });
});

app.delete('/api/shift-history/:id', requireAuth, requireAdmin, (req, res) => {
  const shift = CAREGIVER_SHIFTS.find(item => item.id === Number(req.params.id));
  if (!shift) {
    return res.status(404).json({ success: false, message: 'Shift history item not found.' });
  }

  shift.status = 'Cancelled';
  shift.endedAt = shift.endedAt || new Date().toISOString();
  res.json({ success: true, shift, shiftHistory: CAREGIVER_SHIFTS });
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

app.delete('/api/residents/:id', requireAuth, requireAdmin, (req, res) => {
  const residentId = Number(req.params.id);
  const residentIndex = RESIDENTS.findIndex(item => item.id === residentId);

  if (residentIndex === -1) {
    return res.status(404).json({ success: false, message: 'Resident not found.' });
  }

  const [removedResident] = RESIDENTS.splice(residentIndex, 1);
  FAMILY_MEMBERS.forEach(member => {
    if (member.residentId === residentId) {
      member.residentId = null;
    }
  });
  USERS.forEach(user => {
    if (user.residentId === residentId) {
      user.residentId = null;
    }
  });

  res.json({ success: true, removedResident });
});

app.post('/api/onboard/resident', requireAuth, requireAdmin, (req, res) => {
  const { name, age, room, status, medication, carePlan, emergencyContact, familyEmail } = req.body;

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

  let linkedFamily = null;
  if (familyEmail) {
    const normalizedEmail = familyEmail.toString().trim().toLowerCase();
    const family = FAMILY_MEMBERS.find(member => member.email.toLowerCase() === normalizedEmail);
    const user = USERS.find(item => item.email.toLowerCase() === normalizedEmail && item.role === 'family');

    if (family && user) {
      family.residentId = resident.id;
      user.residentId = resident.id;
      linkedFamily = {
        ...family,
        resident: resident.name
      };
    }
  }

  res.status(201).json({ success: true, resident, linkedFamily });
});

app.post('/api/onboard/staff', requireAuth, requireAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;
  const staffRole = role || 'caregiver';

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Staff name, email, and password are required.' });
  }

  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ success: false, message: 'Enter a valid login email.' });
  }

  if (!isStrongEnoughPassword(password.toString())) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
  }

  if (!['caregiver', 'admin'].includes(staffRole)) {
    return res.status(400).json({ success: false, message: 'Staff role must be caregiver or admin.' });
  }

  if (USERS.some(user => user.email.toLowerCase() === normalizedEmail)) {
    return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
  }

  const staffId = `STF-${1001 + STAFF.length}`;
  const dashboard = staffRole === 'admin' ? 'admin-dashboard.html' : 'caregiver.html';
  const user = {
    email: normalizedEmail,
    passwordHash: await hashPassword(password.toString()),
    role: staffRole,
    name: name.toString().trim(),
    dashboard
  };
  const staff = {
    id: staffId,
    name: user.name,
    email: user.email,
    role: staffRole,
    assignedArea: staffRole === 'caregiver' ? 'General Care' : 'Administration',
    plannedShift: staffRole === 'caregiver' ? 'To be scheduled' : 'Office Hours'
  };

  USERS.push(user);
  STAFF.push(staff);

  res.status(201).json({ success: true, staff });
});

app.post('/api/onboard/family', requireAuth, requireAdmin, async (req, res) => {
  const { name, email, password, residentId, relation } = req.body;
  const resident = RESIDENTS.find(item => item.id === Number(residentId));

  if (!name || !email || !password || !resident) {
    return res.status(400).json({ success: false, message: 'Family name, email, password, and linked resident are required.' });
  }

  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ success: false, message: 'Enter a valid login email.' });
  }

  if (!isStrongEnoughPassword(password.toString())) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
  }

  if (USERS.some(user => user.email.toLowerCase() === normalizedEmail)) {
    return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
  }

  const familyId = `FAM-${1001 + FAMILY_MEMBERS.length}`;
  const user = {
    email: normalizedEmail,
    passwordHash: await hashPassword(password.toString()),
    role: 'family',
    name: name.toString().trim(),
    dashboard: 'family.html',
    residentId: resident.id
  };
  const family = {
    id: familyId,
    name: user.name,
    email: user.email,
    residentId: resident.id,
    relation: (relation || 'Family').toString().trim()
  };

  USERS.push(user);
  FAMILY_MEMBERS.push(family);

  res.status(201).json({
    success: true,
    family: {
      ...family,
      resident: resident.name
    },
    user: {
      email: user.email,
      role: user.role,
      name: user.name,
      dashboard: user.dashboard,
      residentId: user.residentId,
      resident: resident.name
    }
  });
});

app.delete('/api/users/:email', requireAuth, requireAdmin, (req, res) => {
  const email = decodeURIComponent(req.params.email).toLowerCase();

  if (email === req.session.user.email.toLowerCase()) {
    return res.status(400).json({ success: false, message: 'You cannot remove your own active admin account.' });
  }

  const userIndex = USERS.findIndex(user => user.email.toLowerCase() === email);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const [removedUser] = USERS.splice(userIndex, 1);

  if (removedUser.role === 'caregiver' || removedUser.role === 'admin') {
    const staffIndex = STAFF.findIndex(staff => staff.email.toLowerCase() === email);
    const removedStaff = staffIndex >= 0 ? STAFF.splice(staffIndex, 1)[0] : null;
    if (removedStaff) {
      OPEN_SHIFTS.forEach(shift => {
        if (shift.assignedStaffId === removedStaff.id) {
          shift.assignedStaffId = null;
        }
      });
    }
    CAREGIVER_SHIFTS.forEach(shift => {
      if (shift.caregiverEmail.toLowerCase() === email && !shift.endedAt) {
        shift.endedAt = new Date().toISOString();
        shift.status = 'Completed';
      }
    });
  }

  if (removedUser.role === 'family') {
    const familyIndex = FAMILY_MEMBERS.findIndex(member => member.email.toLowerCase() === email);
    if (familyIndex >= 0) {
      FAMILY_MEMBERS.splice(familyIndex, 1);
    }
  }

  res.json({
    success: true,
    removed: {
      email: removedUser.email,
      name: removedUser.name,
      role: removedUser.role
    }
  });
});

app.post('/api/messages', requireAuth, (req, res) => {
  const user = req.session.user;
  const { residentId, familyEmail, message } = req.body;
  const resident = RESIDENTS.find(item => item.id === Number(residentId || user.residentId));

  if (!resident || !message || !message.toString().trim()) {
    return res.status(400).json({ success: false, message: 'Resident and message text are required.' });
  }

  let conversationFamilyEmail = familyEmail;
  if (user.role === 'family') {
    const familyMember = FAMILY_MEMBERS.find(member => member.email === user.email && member.residentId === resident.id);
    if (!familyMember) {
      return res.status(403).json({ success: false, message: 'You can only message your linked resident.' });
    }
    conversationFamilyEmail = user.email;
  } else if (user.role === 'resident') {
    const linkedFamily = FAMILY_MEMBERS.find(member => member.email === familyEmail && member.residentId === resident.id);
    if (!linkedFamily) {
      return res.status(403).json({ success: false, message: 'Choose a linked family member.' });
    }
  } else {
    return res.status(403).json({ success: false, message: 'Only families and residents can send portal messages.' });
  }

  const portalMessage = {
    id: FAMILY_MESSAGES.length + 1,
    residentId: resident.id,
    familyEmail: conversationFamilyEmail,
    senderRole: user.role,
    senderName: user.role === 'resident' ? resident.name : user.name,
    message: message.toString().trim(),
    createdAt: new Date().toISOString()
  };

  FAMILY_MESSAGES.push(portalMessage);
  res.status(201).json({ success: true, message: portalMessage });
});

app.post('/api/care-requests', requireAuth, (req, res) => {
  const user = req.session.user;
  if (user.role !== 'resident') {
    return res.status(403).json({ success: false, message: 'Only residents can request caregiver help.' });
  }

  const resident = RESIDENTS.find(item => item.id === Number(user.residentId)) || RESIDENTS[0];
  const alert = {
    id: ALERTS.reduce((max, item) => Math.max(max, item.id), 0) + 1,
    resident: resident.name,
    issue: `Care desk request from Room ${resident.room}`,
    level: 'High',
    createdAt: new Date().toISOString()
  };

  ALERTS.unshift(alert);
  res.status(201).json({ success: true, alert });
});

app.post('/api/emergency-requests', requireAuth, (req, res) => {
  const user = req.session.user;
  if (user.role !== 'resident') {
    return res.status(403).json({ success: false, message: 'Only residents can send an emergency request.' });
  }

  const resident = RESIDENTS.find(item => item.id === Number(user.residentId)) || RESIDENTS[0];
  const alert = {
    id: ALERTS.reduce((max, item) => Math.max(max, item.id), 0) + 1,
    resident: resident.name,
    issue: `Emergency desk request from Room ${resident.room}`,
    level: 'Critical',
    createdAt: new Date().toISOString(),
    audience: 'caregiver-admin'
  };

  ALERTS.unshift(alert);
  res.status(201).json({ success: true, alert });
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

app.put('/api/schedule/:id/done', requireAuth, (req, res) => {
  if (req.session.user.role !== 'caregiver') {
    return res.status(403).json({ success: false, message: 'Only caregivers can complete schedule items.' });
  }

  const scheduleItem = CARE_SCHEDULE.find(item => item.id === Number(req.params.id));
  if (!scheduleItem) {
    return res.status(404).json({ success: false, message: 'Schedule item not found.' });
  }

  scheduleItem.status = 'Completed';
  scheduleItem.completedBy = req.session.user.name;
  scheduleItem.completedAt = new Date().toISOString();

  res.json({ success: true, scheduleItem, schedule: CARE_SCHEDULE });
});

app.post('/api/schedule', requireAuth, requireAdmin, (req, res) => {
  const { time, label, details, residentId } = req.body;
  const resident = residentId ? RESIDENTS.find(item => item.id === Number(residentId)) : null;

  if (!time || !label) {
    return res.status(400).json({ success: false, message: 'Schedule time and title are required.' });
  }

  const scheduleItem = {
    id: CARE_SCHEDULE.reduce((max, item) => Math.max(max, item.id), 0) + 1,
    time: time.toString().trim(),
    label: label.toString().trim(),
    details: (details || '').toString().trim(),
    residentId: resident ? resident.id : null,
    resident: resident ? resident.name : 'All residents',
    status: 'Pending',
    completedBy: '',
    completedAt: null,
    createdBy: req.session.user.name,
    createdAt: new Date().toISOString()
  };

  CARE_SCHEDULE.push(scheduleItem);
  res.status(201).json({ success: true, scheduleItem, schedule: CARE_SCHEDULE });
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

app.use(express.static(path.join(__dirname), {
  dotfiles: 'deny',
  etag: true,
  maxAge: isProduction ? '1h' : 0,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found.' });
});

app.use((error, req, res, next) => {
  console.error('Unhandled request error:', error);
  res.status(500).json({ success: false, message: 'Unexpected server error.' });
});

async function startServer() {
  try {
    assignCollections(await loadSnapshot());
    await migrateUserPasswords();
    const server = app.listen(PORT, () => {
      console.log(`ElderNest backend running at http://localhost:${PORT}`);
      console.log(`Using MySQL database ${DB_CONFIG.database} at ${DB_CONFIG.host}:${DB_CONFIG.port}`);
    });

    async function shutdown(signal) {
      console.log(`${signal} received. Shutting down ElderNest...`);
      server.close(async () => {
        try {
          await closePool();
          process.exit(0);
        } catch (error) {
          console.error('Failed during shutdown:', error);
          process.exit(1);
        }
      });
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start ElderNest backend with MySQL:', error.message);
    process.exit(1);
  }
}

startServer();
