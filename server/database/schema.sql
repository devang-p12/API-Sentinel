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
