import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { HandleArgs } from "../../types";
import { PaymentIdParam, PaymentSchema } from "./schemas";
import { getPaymentWithProviderSlug, loadProvider, updatePaymentStatus } from "./service";

const CANCELLABLE_STATUSES = ["pending", "authorized"] as const;

export class CancelPayment extends OpenAPIRoute<HandleArgs> {
	schema = {
		tags: ["Payments"],
		summary: "Cancel / void a payment",
		security: [{ apiKey: [] }],
		request: {
			params: PaymentIdParam,
		},
		responses: {
			"200": {
				description: "Payment cancelled",
				...contentJson(z.object({ success: z.literal(true), result: PaymentSchema })),
			},
			"404": {
				description: "Payment not found",
				...contentJson(z.object({ success: z.literal(false), error: z.string() })),
			},
			"409": {
				description: "Payment cannot be cancelled in its current state",
				...contentJson(z.object({ success: z.literal(false), error: z.string() })),
			},
		},
	};

	async handle(c: HandleArgs[0]) {
		const data = await this.getValidatedData<typeof this.schema>();
		const organizationId = c.get("apiKey").key.referenceId;
		const log = c.get("logger").with({ orgId: organizationId, paymentId: data.params.id });

		const found = await getPaymentWithProviderSlug(c.env.DB, data.params.id, organizationId);
		if (!found) {
			return c.json({ success: false as const, error: "Payment not found" }, 404);
		}
		const { payment, providerSlug } = found;
		if (!(CANCELLABLE_STATUSES as readonly string[]).includes(payment.status)) {
			log.warn("payment.cancel_rejected", { currentStatus: payment.status });
			return c.json(
				{ success: false as const, error: `Cannot cancel a payment with status "${payment.status}"` },
				409,
			);
		}

		const provider = await loadProvider(c.env.PSP_CREDENTIALS, providerSlug, organizationId, log.with({ provider: providerSlug }));

		const result = await provider.cancel({ providerRef: payment.provider_ref! });
		const updated = await updatePaymentStatus(
			c.env.DB,
			payment,
			result.status === "failed" ? "cancelled" : result.status,
			result.providerRef,
		);

		log.info("payment.cancelled", { provider: providerSlug, status: updated.status });
		return c.json({ success: true as const, result: updated }, 200);
	}
}
