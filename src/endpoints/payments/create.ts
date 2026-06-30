import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { HandleArgs } from "../../types";
import { CreatePaymentBody, PaymentSchema } from "./schemas";
import {
	getPaymentByIdempotencyKey,
	insertPayment,
	loadProvider,
	resolveProvider,
} from "./service";

export class CreatePayment extends OpenAPIRoute<HandleArgs> {
	schema = {
		tags: ["Payments"],
		summary: "Create a payment",
		security: [{ apiKey: [] }],
		request: {
			body: contentJson(CreatePaymentBody),
		},
		responses: {
			"201": {
				description: "Payment created",
				...contentJson(z.object({ success: z.literal(true), result: PaymentSchema })),
			},
			"200": {
				description: "Duplicate — returning existing payment for this idempotency key",
				...contentJson(z.object({ success: z.literal(true), result: PaymentSchema })),
			},
			"422": {
				description: "No provider configured for this currency / organization",
				...contentJson(z.object({ success: z.literal(false), error: z.string() })),
			},
		},
	};

	async handle(c: HandleArgs[0]) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { amount, currency, idempotency_key, metadata = {} } = data.body;
		const organizationId = c.get("apiKey").key.referenceId;
		const log = c.get("logger").with({ orgId: organizationId });

		// Idempotency check — return existing payment if key already seen
		if (idempotency_key) {
			const existing = await getPaymentByIdempotencyKey(c.env.DB, idempotency_key, organizationId);
			if (existing) {
				log.info("payment.idempotent", { paymentId: existing.id, currency, amount });
				return c.json({ success: true as const, result: existing }, 200);
			}
		}

		// Resolve which PSP handles this currency for this org
		const resolved = await resolveProvider(c.env.DB, organizationId, currency, amount);
		if (!resolved) {
			log.warn("payment.no_provider", { currency, amount });
			return c.json(
				{ success: false as const, error: `No provider configured for ${currency} in this organization` },
				422,
			);
		}

		const providerLog = log.with({ provider: resolved.providerSlug });
		const provider = await loadProvider(c.env.PSP_CREDENTIALS, resolved.providerSlug, organizationId, providerLog);
		const result = await provider.charge({ amount, currency, metadata });

		const payment = await insertPayment(c.env.DB, {
			id: crypto.randomUUID(),
			organization_id: organizationId,
			provider_id: resolved.providerId,
			provider_ref: result.providerRef,
			amount,
			currency,
			status: result.status,
			redirect_url: result.redirectUrl ?? null,
			idempotency_key: idempotency_key ?? null,
			metadata,
		});

		log.info("payment.created", {
			paymentId: payment.id,
			provider: resolved.providerSlug,
			currency,
			amount,
			status: result.status,
		});
		return c.json({ success: true as const, result: payment }, 201);
	}
}
