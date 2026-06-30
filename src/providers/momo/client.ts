// pawaPay Merchant API V2 client
// Docs: https://docs.pawapay.io/
// Sandbox: https://api.sandbox.pawapay.io
// Production: https://api.pawapay.io

import type { Logger } from "../../lib/logger";

export interface PawaPayCredentials {
	apiToken: string;
	baseUrl: string;
}

// ── Request / response shapes ─────────────────────────────────────────────────

export interface DepositRequest {
	depositId: string;
	amount: string;
	currency: string;
	payer: {
		type: "MMO";
		accountDetails: {
			provider: string;
			phoneNumber: string;
		};
	};
	customerMessage?: string;
	clientReferenceId?: string;
	metadata?: Array<Record<string, string>>;
}

export interface DepositInitResponse {
	depositId: string;
	status: string; // ACCEPTED | REJECTED
	created?: string;
	failureReason?: { failureCode: string; failureMessage: string };
}

export interface DepositStatusResponse {
	status: string; // FOUND | NOT_FOUND
	data?: {
		depositId: string;
		status: string; // COMPLETED | FAILED
		amount: string;
		currency: string;
		country: string;
		payer: { type: string; accountDetails: { phoneNUmber: string; provider: string } };
		customerMessage?: string;
		clientReferenceId?: string;
		created: string;
		providerTransactionId?: string;
	};
	failureReason?: { failureCode: string; failureMessage: string };
}

export interface RefundRequest {
	refundId: string;
	depositId: string;
	amount: string;
	currency: string;
	metadata?: Array<Record<string, string>>;
}

export interface RefundInitResponse {
	refundId: string;
	status: string; // ACCEPTED | REJECTED
	created?: string;
	failureReason?: { failureCode: string; failureMessage: string };
}

// ── Client ────────────────────────────────────────────────────────────────────

export class PawaPayClient {
	private readonly baseUrl: string;
	private readonly headers: HeadersInit;
	private readonly log: Logger | undefined;

	constructor(creds: PawaPayCredentials, log?: Logger) {
		this.baseUrl = creds.baseUrl.replace(/\/$/, "");
		this.headers = {
			"Content-Type": "application/json",
			Authorization: `Bearer ${creds.apiToken}`,
		};
		this.log = log;
	}

	async initiateDeposit(req: DepositRequest): Promise<DepositInitResponse> {
		const start = performance.now();
		const res = await fetch(`${this.baseUrl}/v2/deposits`, {
			method: "POST",
			headers: this.headers,
			body: JSON.stringify(req),
		});
		const data = (await res.json()) as DepositInitResponse;
		this.log?.info("pawapay.request", {
			op: "initiateDeposit",
			depositId: req.depositId,
			status: res.status,
			pawapayStatus: data.status,
			latencyMs: Math.round(performance.now() - start),
		});
		if (res.status >= 500) {
			throw new Error(`pawaPay server error: ${data.failureReason?.failureMessage ?? res.statusText}`);
		}
		return data;
	}

	async getDeposit(depositId: string): Promise<DepositStatusResponse> {
		const start = performance.now();
		const res = await fetch(`${this.baseUrl}/v2/deposits/${depositId}`, {
			headers: this.headers,
		});
		const data = (await res.json()) as DepositStatusResponse;
		this.log?.info("pawapay.request", {
			op: "getDeposit",
			depositId,
			status: res.status,
			latencyMs: Math.round(performance.now() - start),
		});
		if (!res.ok) {
			throw new Error(`pawaPay get deposit failed: ${data.failureReason?.failureMessage ?? res.statusText}`);
		}
		return data;
	}

	async initiateRefund(req: RefundRequest): Promise<RefundInitResponse> {
		const start = performance.now();
		const res = await fetch(`${this.baseUrl}/v2/refunds`, {
			method: "POST",
			headers: this.headers,
			body: JSON.stringify(req),
		});
		const data = (await res.json()) as RefundInitResponse;
		this.log?.info("pawapay.request", {
			op: "initiateRefund",
			refundId: req.refundId,
			depositId: req.depositId,
			status: res.status,
			pawapayStatus: data.status,
			latencyMs: Math.round(performance.now() - start),
		});
		if (res.status >= 500) {
			throw new Error(`pawaPay server error: ${data.failureReason?.failureMessage ?? res.statusText}`);
		}
		return data;
	}
}

export function parsePawaPayCredentials(raw: string): PawaPayCredentials {
	const creds = JSON.parse(raw) as PawaPayCredentials;
	if (!creds.apiToken || !creds.baseUrl) {
		throw new Error("pawaPay credentials must have apiToken and baseUrl");
	}
	return creds;
}
