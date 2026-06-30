import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { HandleArgs } from "../../types";
import { PaymentIdParam, PaymentSchema, RefundBody } from "./schemas";
import { getPaymentById, getProviderSlug, loadProvider, updatePaymentStatus } from "./service";

export class RefundPayment extends OpenAPIRoute<HandleArgs> {
	schema = {
		tags: ["Payments"],
		summary: "Refund a payment",
		security: [{ apiKey: [] }],
		request: {
			params: PaymentIdParam,
			body: contentJson(RefundBody),
		},
		responses: {
			"200": {
				description: "Refund initiated",
				...contentJson(z.object({ success: z.literal(true), result: PaymentSchema })),
			},
			"404": {
				description: "Payment not found",
				...contentJson(z.object({ success: z.literal(false), error: z.string() })),
			},
			"409": {
				description: "Payment cannot be refunded in its current state",
				...contentJson(z.object({ success: z.literal(false), error: z.string() })),
			},
		},
	};

	async handle(c: HandleArgs[0]) {
		const data = await this.getValidatedData<typeof this.schema>();
		const organizationId = c.get("apiKey").key.referenceId;
		const log = c.get("logger").with({ orgId: organizationId, paymentId: data.params.id });

		const payment = await getPaymentById(c.env.DB, data.params.id, organizationId);
		if (!payment) {
			return c.json({ success: false as const, error: "Payment not found" }, 404);
		}
		if (payment.status !== "succeeded") {
			log.warn("payment.refund_rejected", { currentStatus: payment.status });
			return c.json(
				{ success: false as const, error: `Cannot refund a payment with status "${payment.status}"` },
				409,
			);
		}

		const slug = await getProviderSlug(c.env.DB, payment.provider_id);
		const provider = await loadProvider(c.env.PSP_CREDENTIALS, slug, organizationId, log.with({ provider: slug }));

		const result = await provider.refund({
			providerRef: payment.provider_ref!,
			currency: payment.currency,
			originalAmount: payment.amount,
			amount: data.body.amount,
			reason: data.body.reason,
		});

		const updated = await updatePaymentStatus(
			c.env.DB,
			payment.id,
			organizationId,
			result.status === "succeeded" ? "refunded" : result.status,
			result.providerRef,
		);

		log.info("payment.refunded", {
			provider: slug,
			currency: payment.currency,
			refundAmount: data.body.amount ?? payment.amount,
			status: updated?.status,
		});
		return c.json({ success: true as const, result: updated! }, 200);
	}
}
