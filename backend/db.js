const { Pool } = require('pg');
require('dotenv').config();

function parseBool(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return String(value).toLowerCase() === 'true';
}

function buildSsl() {
  const explicit = parseBool(process.env.DATABASE_SSL);

  if (explicit === false) return false;
  if (process.env.DATABASE_URL) return { rejectUnauthorized: false };
  return explicit ? { rejectUnauthorized: false } : false;
}

function buildConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: buildSsl(),
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'ley_rep',
    ssl: buildSsl(),
  };
}

const pool = new Pool(buildConfig());

pool.on('error', (error) => {
  console.error('Error inesperado del pool PostgreSQL:', error);
});

module.exports = pool;
