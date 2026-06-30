// Augments the auto-generated Env interface with secrets and additional bindings.
// Secrets are set via: wrangler secret put <NAME>
// KV namespace is created via: wrangler kv namespace create PSP_CREDENTIALS

interface RateLimit {
	limit(options: { key: string }): Promise<{ success: boolean }>;
}

declare interface Env {
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	// PSP credentials — set with: wrangler secret put <NAME>
	// pawapay: JSON string { "apiToken": "...", "baseUrl": "https://api.pawapay.io" }
	// wave:    JSON string { "apiKey": "wave_sn_prod_...", "signingSecret": "wave_sn_AKS_..." }
	PAWAPAY_CREDENTIALS: string;
	WAVE_CREDENTIALS: string;
	// Comma-separated list of allowed browser origins, e.g. "https://app.example.com,https://admin.example.com"
	CORS_ALLOWED_ORIGINS: string;
	RATE_LIMITER: RateLimit;
}
