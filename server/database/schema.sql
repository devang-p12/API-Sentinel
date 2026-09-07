-- ==========================================================
-- API-Sentinel PostgreSQL Database Schema
-- Database: api_sentinel
-- ==========================================================

-- 1. Applications Table
CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Environments Table
CREATE TABLE IF NOT EXISTS environments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. APIs Table
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
    permissions JSONB DEFAULT '{"read": true, "write": false, "delete": false}'::jsonb,
    api_key VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    headers JSONB DEFAULT '[]'::jsonb,
    request_body JSONB DEFAULT NULL,
    expected_status INT DEFAULT 200,
    application_id INT REFERENCES applications(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_apis_name ON apis(name);
CREATE INDEX IF NOT EXISTS idx_apis_environment ON apis(environment);
CREATE INDEX IF NOT EXISTS idx_apis_status ON apis(status);
CREATE INDEX IF NOT EXISTS idx_apis_created_at ON apis(created_at DESC);

-- 5. Seed Initial Default Environments
INSERT INTO environments (name, description)
VALUES 
    ('development', 'Local & Development Environment'),
    ('staging', 'Staging / Pre-production Environment'),
    ('production', 'Live Production Environment')
ON CONFLICT (name) DO NOTHING;

-- 6. Seed Initial Default Application
INSERT INTO applications (name, description)
VALUES 
    ('Default Application', 'Default application container for registered APIs')
ON CONFLICT (name) DO NOTHING;

-- 7. Alert Rules Table
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

-- 8. Incidents Table
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

-- 9. Incident Timeline Table
CREATE TABLE IF NOT EXISTS incident_timeline (
    id SERIAL PRIMARY KEY,
    incident_id INT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    description TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_incident_timeline_incident_id ON incident_timeline(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_timeline_timestamp ON incident_timeline(timestamp);
