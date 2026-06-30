// Wave Checkout API client
// Docs: https://wave.com/en/documentation/checkout/api/
// Base URL: https://api.wave.com

import type { Logger } from "../../lib/logger";

export interface WaveCredentials {
	apiKey: string;
	// Optional: if set, every mutating request is signed with HMAC-SHA256
	signingSecret?: string;
	baseUrl?: string; // defaults to https://api.wave.com
}

// ── Request / response shapes ─────────────────────────────────────────────────

export interface CreateSessionRequest {
	amount: string; // string, e.g. "1000". XOF has no decimal places.
	currency: string; // "XOF"
	success_url: string;
	error_url: string;
	client_reference?: string;
	restrict_payer_mobile?: string;
	aggregated_merchant_id?: string;
}

export type CheckoutStatus = "open" | "complete" | "expired";
export type PaymentStatus = "processing" | "cancelled" | "succeeded";

export interface CheckoutSession {
	id: string; // cos-xxx
	amount: string;
	checkout_status: CheckoutStatus;
	client_reference: string | null;
	currency: string;
	error_url: string;
	last_payment_error: { code: string; message: string } | null;
	business_name: string;
	payment_status: PaymentStatus;
	transaction_id: string;
	success_url: string;
	wave_launch_url: string;
	when_completed: string | null;
	when_created: string;
	when_expires: string;
	aggregated_merchant_id?: string;
	restrict_payer_mobile?: string;
}

export interface WaveError {
	error: { code: string; message: string; httpcode: number };
}

// ── HMAC-SHA256 request signing ───────────────────────────────────────────────
// Wave-Signature: t={unix_timestamp},v1={hmac_hex}
// Payload = timestamp_string + raw_body (empty string for GET)

async function buildSignatureHeader(body: string, secret: string): Promise<string> {
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const payload = timestamp + body;
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
	const hex = Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `t=${timestamp},v1=${hex}`;
}

// ── Client ────────────────────────────────────────────────────────────────────

export class WaveClient {
	private readonly baseUrl: string;
	private readonly apiKey: string;
	private readonly signingSecret: string | undefined;
	private readonly log: Logger | undefined;

	constructor(creds: WaveCredentials, log?: Logger) {
		this.baseUrl = (creds.baseUrl ?? "https://api.wave.com").replace(/\/$/, "");
		this.apiKey = creds.apiKey;
		this.signingSecret = creds.signingSecret;
		this.log = log;
	}

	private async post<T>(path: string, body: object): Promise<T> {
		const raw = JSON.stringify(body);
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Authorization: `Bearer ${this.apiKey}`,
		};
		if (this.signingSecret) {
			headers["Wave-Signature"] = await buildSignatureHeader(raw, this.signingSecret);
		}
		const start = performance.now();
		const res = await fetch(`${this.baseUrl}${path}`, {
			method: "POST",
			headers,
			body: raw,
		});
		this.log?.info("wave.request", {
			op: "POST",
			path,
			status: res.status,
			latencyMs: Math.round(performance.now() - start),
		});
		if (!res.ok) {
			const err = (await res.json()) as WaveError;
			throw Object.assign(
				new Error(`Wave API error ${res.status}: ${err.error?.message ?? res.statusText}`),
				{ status: res.status, code: err.error?.code },
			);
		}
		// Some endpoints (refund, expire) return empty body on success
		const text = await res.text();
		return (text ? JSON.parse(text) : {}) as T;
	}

	private async get<T>(path: string): Promise<T> {
		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.apiKey}`,
		};
		if (this.signingSecret) {
			// GET requests sign an empty body
			headers["Wave-Signature"] = await buildSignatureHeader("", this.signingSecret);
		}
		const start = performance.now();
		const res = await fetch(`${this.baseUrl}${path}`, { headers });
		this.log?.info("wave.request", {
			op: "GET",
			path,
			status: res.status,
			latencyMs: Math.round(performance.now() - start),
		});
		if (!res.ok) {
			const err = (await res.json()) as WaveError;
			throw Object.assign(
				new Error(`Wave API error ${res.status}: ${err.error?.message ?? res.statusText}`),
				{ status: res.status, code: err.error?.code },
			);
		}
		return (await res.json()) as T;
	}

	createSession(req: CreateSessionRequest): Promise<CheckoutSession> {
		return this.post<CheckoutSession>("/v1/checkout/sessions", req);
	}

	getSession(id: string): Promise<CheckoutSession> {
		return this.get<CheckoutSession>(`/v1/checkout/sessions/${id}`);
	}

	// Returns empty body on success (HTTP 200)
	refundSession(id: string): Promise<void> {
		return this.post<void>(`/v1/checkout/sessions/${id}/refund`, {});
	}

	// Returns empty body on success (HTTP 200)
	expireSession(id: string): Promise<void> {
		return this.post<void>(`/v1/checkout/sessions/${id}/expire`, {});
	}
}

export function parseWaveCredentials(raw: string): WaveCredentials {
	const creds = JSON.parse(raw) as WaveCredentials;
	if (!creds.apiKey) throw new Error("Wave credentials must have apiKey");
	return creds;
}
