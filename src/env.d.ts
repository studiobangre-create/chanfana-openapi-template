// Augments the auto-generated Env interface with secrets and additional bindings.
// Secrets are set via: wrangler secret put <NAME>
// KV namespace is created via: wrangler kv namespace create PSP_CREDENTIALS

declare interface Env {
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	PSP_CREDENTIALS: KVNamespace;
	// Comma-separated list of allowed browser origins, e.g. "https://app.example.com,https://admin.example.com"
	CORS_ALLOWED_ORIGINS: string;
}
