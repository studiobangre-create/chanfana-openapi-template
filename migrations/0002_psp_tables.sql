-- Migration number: 0002 	 2026-06-30T00:00:00.000Z

-- PSP provider registry
CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Per-org routing config: which PSPs a tenant uses and in what order
CREATE TABLE IF NOT EXISTS tenant_providers (
    organization_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    currencies TEXT NOT NULL DEFAULT '[]',
    routing_rules TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_id, provider_id)
);

-- Transaction log
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY NOT NULL,
    organization_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    provider_ref TEXT,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    idempotency_key TEXT UNIQUE,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_org ON payments (organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);

-- Inbound webhook events from PSPs
CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY NOT NULL,
    provider TEXT NOT NULL,
    payment_id TEXT,
    payload TEXT NOT NULL DEFAULT '{}',
    verified INTEGER NOT NULL DEFAULT 0,
    processed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events (provider);
