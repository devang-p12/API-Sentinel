import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

async function initDatabase() {
  console.log('Connecting to PostgreSQL to verify database and schema...');

  const appClient = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: String(process.env.DB_PASSWORD || ''),
    database: process.env.DB_NAME || 'api_sentinel',
  });

  try {
    await appClient.connect();
    console.log("Connected to 'api_sentinel' database.");

    // Inspect existing tables and columns
    const columnsRes = await appClient.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);

    console.log('Existing columns in public schema:');
    columnsRes.rows.forEach((r) => {
      console.log(` - ${r.table_name}.${r.column_name} (${r.data_type})`);
    });

    // 1. Ensure applications table exists
    await appClient.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Ensure environments table exists
    await appClient.query(`
      CREATE TABLE IF NOT EXISTS environments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Ensure apis table exists
    await appClient.query(`
      CREATE TABLE IF NOT EXISTS apis (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        base_url TEXT NOT NULL,
        version VARCHAR(50) DEFAULT 'v1',
        environment VARCHAR(50) NOT NULL DEFAULT 'development',
        authentication VARCHAR(50) NOT NULL DEFAULT 'api-key',
        auth_config JSONB DEFAULT '{}'::jsonb,
        scopes JSONB DEFAULT '{"read": true, "write": false, "delete": false}'::jsonb,
        api_key VARCHAR(255),
        status VARCHAR(50) NOT NULL DEFAULT 'Active',
        headers JSONB DEFAULT '[]'::jsonb,
        request_body JSONB DEFAULT NULL,
        expected_status INT DEFAULT 200,
        application_id INT REFERENCES applications(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. In case apis table already existed with fewer columns, add missing ones safely
    await appClient.query(`
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS base_url TEXT;
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS version VARCHAR(50) DEFAULT 'v1';
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS environment VARCHAR(50) DEFAULT 'development';
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS authentication VARCHAR(50) DEFAULT 'api-key';
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS auth_config JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS scopes JSONB DEFAULT '{"read": true, "write": false, "delete": false}'::jsonb;
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS api_key VARCHAR(255);
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS headers JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS request_body JSONB DEFAULT NULL;
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS expected_status INT DEFAULT 200;
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS application_id INT REFERENCES applications(id) ON DELETE SET NULL;
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `);

    // 5. Create Indexes
    await appClient.query(`
      CREATE INDEX IF NOT EXISTS idx_apis_name ON apis(name);
      CREATE INDEX IF NOT EXISTS idx_apis_environment ON apis(environment);
      CREATE INDEX IF NOT EXISTS idx_apis_status ON apis(status);
      CREATE INDEX IF NOT EXISTS idx_apis_created_at ON apis(created_at DESC);
    `);

    // 6. Seeds
    await appClient.query(`
      INSERT INTO environments (name, description)
      VALUES 
        ('development', 'Local & Development Environment'),
        ('staging', 'Staging / Pre-production Environment'),
        ('production', 'Live Production Environment')
      ON CONFLICT (name) DO NOTHING;

      INSERT INTO applications (name, description)
      VALUES 
        ('Default Application', 'Default application container for registered APIs')
      ON CONFLICT (name) DO NOTHING;
    `);

    console.log('✅ All tables, columns, indexes, and seeds are verified and up to date!');
  } catch (err: any) {
    console.error('Error initializing database:', err.message);
    throw err;
  } finally {
    await appClient.end();
  }
}

initDatabase()
  .then(() => {
    console.log('Database initialization complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Initialization failed:', err.message);
    process.exit(1);
  });
