import type {
	CancelParams,
	CaptureParams,
	ChargeParams,
	PaymentProvider,
	ProviderResult,
	ProviderStatus,
	RefundParams,
} from "../base";
import type { Logger } from "../../lib/logger";
import { WaveClient, parseWaveCredentials } from "./client";

// Wave only supports XOF (West African Franc) which has no decimal sub-unit.
// Amounts are stored internally as integers; for XOF, 1 unit = 1 franc.
// For other Wave currencies (if added in future) adjust accordingly.
function toWaveAmount(amount: number, currency: string): string {
	if (currency === "XOF") return amount.toString();
	// Fallback: assume 2 decimal places (divide by 100)
	return (amount / 100).toFixed(2);
}

function mapStatus(
	checkoutStatus: string,
	paymentStatus: string,
): ProviderStatus {
	if (checkoutStatus === "complete" && paymentStatus === "succeeded") return "succeeded";
	if (checkoutStatus === "expired" || paymentStatus === "cancelled") return "failed";
	return "pending";
}

export class WaveProvider implements PaymentProvider {
	constructor(private readonly client: WaveClient) {}

	// Creates a Wave checkout session. Returns a redirectUrl (wave_launch_url) that
	// MUST be opened in the customer's browser — do not embed in a webview.
	// Requires metadata.wave_success_url and metadata.wave_error_url.
	async charge(params: ChargeParams): Promise<ProviderResult> {
		const successUrl = params.metadata.wave_success_url;
		const errorUrl = params.metadata.wave_error_url;

		if (!successUrl || !errorUrl) {
			throw Object.assign(
				new Error("Wave requires metadata.wave_success_url and metadata.wave_error_url"),
				{ status: 422 },
			);
		}

		const session = await this.client.createSession({
			amount: toWaveAmount(params.amount, params.currency),
			currency: params.currency,
			success_url: successUrl,
			error_url: errorUrl,
			...(params.metadata.client_reference && {
				client_reference: params.metadata.client_reference,
			}),
			...(params.metadata.restrict_payer_mobile && {
				restrict_payer_mobile: params.metadata.restrict_payer_mobile,
			}),
			...(params.metadata.aggregated_merchant_id && {
				aggregated_merchant_id: params.metadata.aggregated_merchant_id,
			}),
		});

		return {
			providerRef: session.id,
			status: mapStatus(session.checkout_status, session.payment_status),
			redirectUrl: session.wave_launch_url,
		};
	}

	// Wave checkout has no separate capture step.
	async capture(_params: CaptureParams): Promise<ProviderResult> {
		throw Object.assign(
			new Error("Wave checkout does not support separate capture"),
			{ status: 422 },
		);
	}

	// Full refund only — Wave does not accept a partial amount on refund.
	// Idempotent: refunding twice returns HTTP 200 without creating a second transaction.
	async refund(params: RefundParams): Promise<ProviderResult> {
		if (params.amount !== undefined && params.amount !== params.originalAmount) {
			throw Object.assign(
				new Error("Wave only supports full refunds — omit amount or set it equal to the original amount"),
				{ status: 422 },
			);
		}
		await this.client.refundSession(params.providerRef);
		// Wave refund is synchronous (HTTP 200 = done)
		return { providerRef: params.providerRef, status: "succeeded" };
	}

	// Expires an open checkout session so it can no longer be paid.
	// Fails if the session is already complete or expired (409 from Wave).
	async cancel(params: CancelParams): Promise<ProviderResult> {
		await this.client.expireSession(params.providerRef);
		return { providerRef: params.providerRef, status: "failed" };
	}
}

export function createWaveProvider(rawCredentials: string, log?: Logger): PaymentProvider {
	const creds = parseWaveCredentials(rawCredentials);
	return new WaveProvider(new WaveClient(creds, log));
}
