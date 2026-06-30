-- Migration number: 0003 	 2026-06-30T00:00:00.000Z
-- Redirect-based providers (e.g. Wave Checkout) return a URL the customer must open.
ALTER TABLE payments ADD COLUMN redirect_url TEXT;
