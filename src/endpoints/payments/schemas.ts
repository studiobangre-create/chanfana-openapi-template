import { z } from "zod";

export const PaymentStatus = z.enum([
	"pending",
	"authorized",
	"succeeded",
	"failed",
	"refunded",
	"cancelled",
]);

export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const PaymentSchema = z.object({
	id: z.string().uuid(),
	organization_id: z.string(),
	provider_id: z.string(),
	provider_ref: z.string().nullable(),
	amount: z.number().int().describe("Amount in smallest currency unit (e.g. cents)"),
	currency: z.string().length(3).describe("ISO 4217 currency code"),
	status: PaymentStatus,
	// Present for redirect-based providers (e.g. Wave). Must be opened by the user's browser.
	redirect_url: z.string().url().nullable(),
	idempotency_key: z.string().nullable(),
	metadata: z.record(z.string()).describe("Arbitrary key-value pairs"),
	created_at: z.string().datetime(),
	updated_at: z.string().datetime(),
});

export type Payment = z.infer<typeof PaymentSchema>;

export const CreatePaymentBody = z.object({
	amount: z.number().int().positive().describe("Amount in smallest currency unit (e.g. 1099 = $10.99)"),
	currency: z
		.string()
		.length(3)
		.transform((v) => v.toUpperCase())
		.describe("ISO 4217 currency code (e.g. USD, NGN, XOF)"),
	idempotency_key: z
		.string()
		.max(255)
		.optional()
		.describe("Unique key — resubmitting with the same key returns the original payment"),
	metadata: z.record(z.string()).optional().describe("Arbitrary key-value pairs attached to the payment"),
});

export const RefundBody = z.object({
	amount: z
		.number()
		.int()
		.positive()
		.optional()
		.describe("Partial refund amount; omit to refund the full amount"),
	reason: z.string().max(500).optional(),
});

export const PaymentIdParam = z.object({
	id: z.string().uuid().describe("Payment ID"),
});

// Row as stored in D1 — metadata is a JSON string
export interface PaymentRow {
	id: string;
	organization_id: string;
	provider_id: string;
	provider_ref: string | null;
	amount: number;
	currency: string;
	status: PaymentStatus;
	redirect_url: string | null;
	idempotency_key: string | null;
	metadata: string;
	created_at: string;
	updated_at: string;
}

export function deserializePayment(row: PaymentRow): Payment {
	return {
		...row,
		metadata: JSON.parse(row.metadata) as Record<string, string>,
	};
}
