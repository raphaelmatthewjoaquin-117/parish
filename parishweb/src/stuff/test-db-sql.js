import dotenv from 'dotenv';
import sql from 'mssql';
dotenv.config();

const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'ParishManagementDb',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true },
  port: Number(process.env.DB_PORT || 1433),
};

async function run() {
  try {
    console.log('Connecting with config:', config.server, config.database, 'user=' + config.user);
    await sql.connect(config);
    const r = await sql.query`SELECT TOP (1) * FROM dbo.Service`;
    console.log('Success:', r.recordset);
    await sql.close();
  } catch (err) {
    console.error('DB connection error:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
run();
