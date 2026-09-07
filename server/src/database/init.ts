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
        monitoring_enabled BOOLEAN DEFAULT false,
        monitoring_interval INT DEFAULT 60,
        timeout INT DEFAULT 5000,
        degraded_threshold_ms INT DEFAULT 1000,
        health_status VARCHAR(20) DEFAULT 'HEALTHY',
        consecutive_failures INT DEFAULT 0,
        last_monitored_at TIMESTAMP WITH TIME ZONE,
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
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS monitoring_enabled BOOLEAN DEFAULT false;
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS monitoring_interval INT DEFAULT 60;
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS timeout INT DEFAULT 5000;
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS degraded_threshold_ms INT DEFAULT 1000;
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS health_status VARCHAR(20) DEFAULT 'HEALTHY';
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS consecutive_failures INT DEFAULT 0;
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS last_monitored_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE apis ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `);

    // 5. Create Indexes
    await appClient.query(`
      CREATE INDEX IF NOT EXISTS idx_apis_name ON apis(name);
      CREATE INDEX IF NOT EXISTS idx_apis_environment ON apis(environment);
      CREATE INDEX IF NOT EXISTS idx_apis_status ON apis(status);
      CREATE INDEX IF NOT EXISTS idx_apis_health_status ON apis(health_status);
      CREATE INDEX IF NOT EXISTS idx_apis_created_at ON apis(created_at DESC);
    `);

    // 5.1 Ensure monitoring_logs table exists
    await appClient.query(`
      CREATE TABLE IF NOT EXISTS monitoring_logs (
        id SERIAL PRIMARY KEY,
        api_id INT REFERENCES apis(id) ON DELETE CASCADE,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status_code INT,
        response_time INT,
        success BOOLEAN,
        error_type VARCHAR(100),
        error_message TEXT,
        response_size INT
      );
      
      CREATE INDEX IF NOT EXISTS idx_monitoring_logs_api_id ON monitoring_logs(api_id);
      CREATE INDEX IF NOT EXISTS idx_monitoring_logs_timestamp ON monitoring_logs(timestamp DESC);
    `);

    // 6. Ensure load_test_runs table exists
    await appClient.query(`
      CREATE TABLE IF NOT EXISTS load_test_runs (
        id SERIAL PRIMARY KEY,
        api_id INT REFERENCES apis(id) ON DELETE CASCADE,
        batch_id VARCHAR(100),
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        trigger_type VARCHAR(50) NOT NULL DEFAULT 'manual',
        virtual_users INT NOT NULL,
        duration VARCHAR(50) NOT NULL,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE,
        total_requests INT DEFAULT 0,
        successful_requests INT DEFAULT 0,
        failed_requests INT DEFAULT 0,
        error_rate NUMERIC(6, 2) DEFAULT 0,
        throughput NUMERIC(10, 2) DEFAULT 0,
        avg_latency NUMERIC(10, 2) DEFAULT 0,
        min_latency NUMERIC(10, 2) DEFAULT 0,
        max_latency NUMERIC(10, 2) DEFAULT 0,
        p50_latency NUMERIC(10, 2) DEFAULT 0,
        p90_latency NUMERIC(10, 2) DEFAULT 0,
        p95_latency NUMERIC(10, 2) DEFAULT 0,
        p99_latency NUMERIC(10, 2) DEFAULT 0,
        status_codes JSONB DEFAULT '{}'::jsonb,
        error_message TEXT,
        raw_metrics JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Ensure columns exist on load_test_runs if table was already created
    await appClient.query(`
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS api_id INT REFERENCES apis(id) ON DELETE CASCADE;
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS batch_id VARCHAR(100);
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(50) DEFAULT 'manual';
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS virtual_users INT DEFAULT 1;
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS duration VARCHAR(50) DEFAULT '10s';
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS total_requests INT DEFAULT 0;
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS successful_requests INT DEFAULT 0;
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS failed_requests INT DEFAULT 0;
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS error_rate NUMERIC(6, 2) DEFAULT 0;
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS throughput NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS avg_latency NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS min_latency NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS max_latency NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS p50_latency NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS p90_latency NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS p95_latency NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS p99_latency NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS status_codes JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS error_message TEXT;
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS raw_metrics JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE load_test_runs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `);

    // 8. Create Load Test Indexes
    await appClient.query(`
      CREATE INDEX IF NOT EXISTS idx_load_test_runs_api_id ON load_test_runs(api_id);
      CREATE INDEX IF NOT EXISTS idx_load_test_runs_batch_id ON load_test_runs(batch_id);
      CREATE INDEX IF NOT EXISTS idx_load_test_runs_status ON load_test_runs(status);
      CREATE INDEX IF NOT EXISTS idx_load_test_runs_created_at ON load_test_runs(created_at DESC);
    `);

    // 9. Ensure alert_rules table exists
    await appClient.query(`
      CREATE TABLE IF NOT EXISTS alert_rules (
        id SERIAL PRIMARY KEY,
        api_id INT NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
        environment VARCHAR(50) NOT NULL,
        metric VARCHAR(50) NOT NULL,
        operator VARCHAR(50) NOT NULL,
        threshold NUMERIC NOT NULL,
        evaluation_window_mins INT DEFAULT 0,
        consecutive_failures_count INT DEFAULT 1,
        severity VARCHAR(20) NOT NULL,
        cooldown_mins INT DEFAULT 5,
        last_triggered_at TIMESTAMP WITH TIME ZONE,
        is_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_alert_rules_api_id ON alert_rules(api_id);
      CREATE INDEX IF NOT EXISTS idx_alert_rules_environment ON alert_rules(environment);
      CREATE INDEX IF NOT EXISTS idx_alert_rules_is_enabled ON alert_rules(is_enabled);
    `);

    // 10. Ensure incidents table exists
    await appClient.query(`
      CREATE TABLE IF NOT EXISTS incidents (
        id SERIAL PRIMARY KEY,
        api_id INT NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
        rule_id INT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
        environment VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
        trigger_details TEXT,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP WITH TIME ZONE,
        failed_checks_count INT DEFAULT 1,
        error_info TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_incidents_api_id ON incidents(api_id);
      CREATE INDEX IF NOT EXISTS idx_incidents_rule_id ON incidents(rule_id);
      CREATE INDEX IF NOT EXISTS idx_incidents_environment ON incidents(environment);
      CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
      CREATE INDEX IF NOT EXISTS idx_incidents_started_at ON incidents(started_at);
      CREATE INDEX IF NOT EXISTS idx_incidents_resolved_at ON incidents(resolved_at);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_unique_open ON incidents(api_id, rule_id, environment) WHERE status = 'OPEN';
    `);

    // 11. Ensure incident_timeline table exists
    await appClient.query(`
      CREATE TABLE IF NOT EXISTS incident_timeline (
        id SERIAL PRIMARY KEY,
        incident_id INT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        description TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_incident_timeline_incident_id ON incident_timeline(incident_id);
      CREATE INDEX IF NOT EXISTS idx_incident_timeline_timestamp ON incident_timeline(timestamp);
    `);

    // 12. Seeds
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
