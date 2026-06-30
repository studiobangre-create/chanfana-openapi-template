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
import { PawaPayClient, parsePawaPayCredentials } from "./client";

// pawaPay amounts are decimal strings in the major currency unit (e.g. "15.00" = 15 ZMW).
// Our internal amounts are integers in the smallest unit (e.g. 1500 = 15.00 ZMW).
// Most MoMo currencies use 2 decimal places; UGX and a few others use 0.
// Callers are responsible for sending amounts in the correct sub-unit.
function toAmountString(amount: number): string {
	return (amount / 100).toFixed(2);
}

function mapStatus(pawapayStatus: string): ProviderStatus {
	switch (pawapayStatus) {
		case "COMPLETED":
			return "succeeded";
		case "FAILED":
		case "REJECTED":
			return "failed";
		case "ACCEPTED":
		default:
			return "pending";
	}
}

export class PawaPayProvider implements PaymentProvider {
	constructor(private readonly client: PawaPayClient) {}

	// Initiates a mobile money deposit (collect from customer).
	// Requires metadata.momo_phone and metadata.momo_provider (e.g. "MTN_MOMO_ZMB").
	// pawaPay is async — returns pending immediately; final status arrives via webhook callback.
	async charge(params: ChargeParams): Promise<ProviderResult> {
		const phone = params.metadata.momo_phone;
		const momoProvider = params.metadata.momo_provider;

		if (!phone || !momoProvider) {
			throw Object.assign(
				new Error("pawaPay requires metadata.momo_phone and metadata.momo_provider"),
				{ status: 422 },
			);
		}

		// We own the depositId — use it as our providerRef for subsequent operations
		const depositId = crypto.randomUUID();

		const response = await this.client.initiateDeposit({
			depositId,
			amount: toAmountString(params.amount),
			currency: params.currency,
			payer: {
				type: "MMO",
				accountDetails: {
					provider: momoProvider,
					phoneNumber: phone,
				},
			},
			...(params.metadata.customer_message && {
				customerMessage: params.metadata.customer_message,
			}),
			...(params.metadata.client_reference_id && {
				clientReferenceId: params.metadata.client_reference_id,
			}),
		});

		if (response.status === "REJECTED") {
			throw Object.assign(
				new Error(
					`pawaPay rejected deposit: ${response.failureReason?.failureCode} — ${response.failureReason?.failureMessage}`,
				),
				{ status: 422 },
			);
		}

		return { providerRef: depositId, status: mapStatus(response.status) };
	}

	// pawaPay mobile money is direct debit — there is no authorize → capture two-step flow.
	async capture(_params: CaptureParams): Promise<ProviderResult> {
		throw Object.assign(
			new Error("pawaPay mobile money does not support separate capture (direct debit only)"),
			{ status: 422 },
		);
	}

	// Initiates a refund against an existing deposit.
	// If params.amount is omitted the full original amount is refunded.
	// Async — returns pending; final status arrives via webhook callback.
	async refund(params: RefundParams): Promise<ProviderResult> {
		const refundId = crypto.randomUUID();
		const refundAmount = params.amount ?? params.originalAmount;

		const response = await this.client.initiateRefund({
			refundId,
			depositId: params.providerRef,
			amount: toAmountString(refundAmount),
			currency: params.currency,
		});

		if (response.status === "REJECTED") {
			throw Object.assign(
				new Error(
					`pawaPay rejected refund: ${response.failureReason?.failureCode} — ${response.failureReason?.failureMessage}`,
				),
				{ status: 422 },
			);
		}

		// Return the refundId as the new providerRef so webhooks can correlate it
		return { providerRef: refundId, status: mapStatus(response.status) };
	}

	// pawaPay does not support voiding/cancelling an accepted deposit.
	async cancel(_params: CancelParams): Promise<ProviderResult> {
		throw Object.assign(
			new Error("pawaPay does not support cancellation of accepted mobile money deposits"),
			{ status: 422 },
		);
	}
}

export function createPawaPayProvider(rawCredentials: string, log?: Logger): PaymentProvider {
	const creds = parsePawaPayCredentials(rawCredentials);
	return new PawaPayProvider(new PawaPayClient(creds, log));
}
