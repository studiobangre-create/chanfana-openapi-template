import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { HandleArgs } from "../../types";
import { PaymentIdParam, PaymentSchema } from "./schemas";
import { getPaymentById } from "./service";

export class GetPayment extends OpenAPIRoute<HandleArgs> {
	schema = {
		tags: ["Payments"],
		summary: "Get a payment",
		security: [{ apiKey: [] }],
		request: {
			params: PaymentIdParam,
		},
		responses: {
			"200": {
				description: "Payment details",
				...contentJson(z.object({ success: z.literal(true), result: PaymentSchema })),
			},
			"404": {
				description: "Payment not found",
				...contentJson(z.object({ success: z.literal(false), error: z.string() })),
			},
		},
	};

	async handle(c: HandleArgs[0]) {
		const data = await this.getValidatedData<typeof this.schema>();
		const organizationId = c.get("apiKey").key.referenceId;

		const payment = await getPaymentById(c.env.DB, data.params.id, organizationId);
		if (!payment) {
			return c.json({ success: false as const, error: "Payment not found" }, 404);
		}

		return c.json({ success: true as const, result: payment }, 200);
	}
}
