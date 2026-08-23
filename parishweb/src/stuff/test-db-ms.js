import dotenv from 'dotenv';
import sql from 'mssql/msnodesqlv8.js';
dotenv.config();

const config = {
  server: process.env.DB_SERVER || 'localhost\\SQLEXPRESS',
  database: process.env.DB_NAME || 'ParishDB',
  driver: 'msnodesqlv8',
  options: {
    trustedConnection: true,
    trustServerCertificate: true,
  },
};

async function run() {
  try {
    console.log('Connecting with config:', config.server, config.database);
    await sql.connect(config);
    const r = await sql.query`SELECT TOP (1) * FROM Services`;
    console.log('Success:', r.recordset);
    await sql.close();
  } catch (err) {
    console.error('DB connection error:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
run();
