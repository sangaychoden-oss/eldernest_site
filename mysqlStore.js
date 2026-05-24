const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'eldernest_db'
};

const COLLECTION_TABLES = {
  USERS: { table: 'app_users', keyColumn: 'email', keyType: 'VARCHAR(191)', sourceKey: 'email' },
  ALERTS: { table: 'app_alerts', keyColumn: 'id', keyType: 'BIGINT', sourceKey: 'id' },
  ALERT_RESPONSES: { table: 'app_alert_responses', keyColumn: 'alert_id', keyType: 'VARCHAR(64)', objectMap: true },
  STAFF: { table: 'app_staff', keyColumn: 'id', keyType: 'VARCHAR(64)', sourceKey: 'id' },
  FAMILY_MEMBERS: { table: 'app_family_members', keyColumn: 'id', keyType: 'VARCHAR(64)', sourceKey: 'id' },
  CAREGIVER_SHIFTS: { table: 'app_caregiver_shifts', keyColumn: 'id', keyType: 'BIGINT', sourceKey: 'id' },
  OPEN_SHIFTS: { table: 'app_open_shifts', keyColumn: 'id', keyType: 'VARCHAR(64)', sourceKey: 'id' },
  CARE_NOTES: { table: 'app_care_notes', keyColumn: 'id', keyType: 'BIGINT', sourceKey: 'id' },
  ADL_CHARTS: { table: 'app_adl_charts', keyColumn: 'id', keyType: 'BIGINT', sourceKey: 'id' },
  INCIDENT_REPORTS: { table: 'app_incident_reports', keyColumn: 'id', keyType: 'BIGINT', sourceKey: 'id' },
  CARE_SCHEDULE: { table: 'app_care_schedule', keyColumn: 'id', keyType: 'BIGINT', sourceKey: 'id' },
  FAMILY_MESSAGES: { table: 'app_family_messages', keyColumn: 'id', keyType: 'BIGINT', sourceKey: 'id' },
  RESIDENTS: { table: 'app_residents', keyColumn: 'id', keyType: 'BIGINT', sourceKey: 'id' }
};

const COLLECTIONS = Object.keys(COLLECTION_TABLES);

let pool;

function emptyCollection(collection) {
  return COLLECTION_TABLES[collection].objectMap ? {} : [];
}

function parseJson(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function tableName(name) {
  return `\`${name}\``;
}

function columnName(name) {
  return `\`${name}\``;
}

async function ensureDatabase() {
  const connection = await mysql.createConnection({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    multipleStatements: true
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\``);
  await connection.end();

  pool = mysql.createPool({
    ...DB_CONFIG,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true
  });

  for (const config of Object.values(COLLECTION_TABLES)) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableName(config.table)} (
        ${columnName(config.keyColumn)} ${config.keyType} PRIMARY KEY,
        data JSON NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  }

  await migrateAppDataIfNeeded();
}

async function collectionTablesHaveRows() {
  for (const config of Object.values(COLLECTION_TABLES)) {
    const [rows] = await pool.query(`SELECT COUNT(*) AS count FROM ${tableName(config.table)}`);
    if (Number(rows[0].count) > 0) {
      return true;
    }
  }

  return false;
}

async function legacyAppDataExists() {
  const [rows] = await pool.query('SHOW TABLES LIKE "app_data"');
  return rows.length > 0;
}

async function migrateAppDataIfNeeded() {
  if (await collectionTablesHaveRows()) return;
  if (!(await legacyAppDataExists())) return;

  const [rows] = await pool.query('SELECT collection_name, data FROM app_data');
  if (!rows.length) return;

  const snapshot = {};
  rows.forEach(row => {
    snapshot[row.collection_name] = parseJson(row.data);
  });

  await saveSnapshotToTables(snapshot);
}

function recordsForCollection(collection, value) {
  const config = COLLECTION_TABLES[collection];

  if (config.objectMap) {
    return Object.entries(value || {}).map(([key, item]) => [key, JSON.stringify(item)]);
  }

  return (Array.isArray(value) ? value : []).map((item, index) => {
    const key = item[config.sourceKey] === undefined || item[config.sourceKey] === null
      ? index + 1
      : item[config.sourceKey];
    return [key, JSON.stringify(item)];
  });
}

async function saveSnapshotToTables(snapshot) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    for (const collection of COLLECTIONS) {
      const config = COLLECTION_TABLES[collection];
      const records = recordsForCollection(collection, snapshot[collection] || emptyCollection(collection));

      await connection.query(`DELETE FROM ${tableName(config.table)}`);

      if (records.length) {
        await connection.query(
          `INSERT INTO ${tableName(config.table)} (${columnName(config.keyColumn)}, data) VALUES ?`,
          [records]
        );
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function loadSnapshot() {
  await ensureDatabase();

  const snapshot = {};

  for (const collection of COLLECTIONS) {
    const config = COLLECTION_TABLES[collection];
    const [rows] = await pool.query(
      `SELECT ${columnName(config.keyColumn)} AS record_key, data
       FROM ${tableName(config.table)}
       ORDER BY ${columnName(config.keyColumn)}`
    );

    if (config.objectMap) {
      snapshot[collection] = {};
      rows.forEach(row => {
        snapshot[collection][row.record_key] = parseJson(row.data);
      });
    } else {
      snapshot[collection] = rows.map(row => parseJson(row.data));
    }
  }

  COLLECTIONS.forEach(collection => {
    if (snapshot[collection] === undefined) {
      snapshot[collection] = emptyCollection(collection);
    }
  });

  return snapshot;
}

async function saveSnapshot(snapshot) {
  if (!pool) {
    await ensureDatabase();
  }

  await saveSnapshotToTables(snapshot);
}

async function checkConnection() {
  if (!pool) {
    await ensureDatabase();
  }

  await pool.query('SELECT 1');
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  loadSnapshot,
  saveSnapshot,
  checkConnection,
  closePool,
  DB_CONFIG
};
