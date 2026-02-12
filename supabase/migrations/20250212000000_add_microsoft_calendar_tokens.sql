-- Store Microsoft OAuth tokens for Outlook calendar integration (reception + doctors)
ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_token_expires_at TIMESTAMPTZ;
